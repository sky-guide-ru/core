// Просмотр чужих профилей (друзья, кооп-соседи, свои другие профили).
// Свой основной профиль живёт в state.js и обновляется каждую минуту. Остальные грузятся по запросу,
// кэшируются и обновляются, только пока их кто-то смотрит, с оглядкой на лимит Hypixel API
// (300 запросов на ключ за 5 минут): чужим профилям достаётся не больше FRIEND_BUDGET из них.
import * as hypixel from './hypixel.js';
import { pickProfile, parseMember, parseGarden, coopRoster } from './parse/profile.js';
import { analyzeMember, snapshot, diffFeed } from './state.js';
import { swapLayout } from './items-ru/lib/search.js';
import { pushSnapshot } from './history.js';
import { tx } from '../i18n/msg.js';
import { hypixelInfo } from './rank.js';

const MIN = 60_000;

/** Ключ вида «игрок/профиль» из заголовков или query; пусто — свой основной профиль */
export function readViewRequest(req) {
  const h = k => req.get?.(k) || req.headers?.[k.toLowerCase()];
  const dec = v => { try { return decodeURIComponent(String(v || '')).trim(); } catch { return ''; } };
  const player = dec(h('X-SB-Player') || req.query?.player).slice(0, 32);
  const profile = dec(h('X-SB-Profile') || req.query?.profile).slice(0, 40);
  return player ? { player, profile } : null;
}

const validName = n => /^[A-Za-z0-9_]{1,16}$/.test(n) || /^[0-9a-f]{32}$/i.test(n.replace(/-/g, ''));

/** Ник, набранный в русской раскладке («щцтуксфе» → ownercat): ники в Minecraft только латиницей */
export function fixNick(n) {
  // Ник, скопированный из Discord/Telegram, бывает с невидимыми символами и неразрывным пробелом
  const s = String(n || '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\u00A0/g, ' ').trim();
  if (validName(s) || !/[а-яё]/i.test(s)) return s;
  const sw = swapLayout(s);
  return sw && validName(sw) ? sw : s;
}

/**
 * @param {{
 *   owner: () => { player, member, raw, profiles },   // состояние своего профиля (state.js)
 *   api?: { resolveUuid, resolveName, getProfiles, getGarden, getMuseum, keyedCallsRecent },
 *   parse?: { pickProfile, parseMember, parseGarden }, analyze?: (m) => Object,
 *   clock?: () => number, ttlMs?: number, friendBudget?: number, maxViews?: number,
 *   keepHistory?: (name: string) => boolean,          // хранить историю игрока на диске (друзья с аккаунтом на сайте)
 *   historyFiles?: { load(key), save(key, history) },  // server/history.js createHistoryFiles
 *   onUpdate?: (view) => void,                         // профиль обновился — сводка в рейтинг
 * }} o
 */
export function createPlayers(o) {
  const api = { ...hypixel, ...(o.api || {}) };
  const parse = { pickProfile, parseMember, parseGarden, ...(o.parse || {}) };
  const analyze = o.analyze || analyzeMember;
  const clock = o.clock || (() => Date.now());
  // Чужой профиль обновляется не чаще раза в 10 минут: у ключа разработчика Hypixel есть и суточный лимит,
  // а за один заход посетитель редко ждёт изменений чаще. Свой профиль друга — раз в 3 минуты (ttlMs из index.js)
  const ttl = o.ttlMs ?? 10 * MIN;
  const friendBudget = o.friendBudget ?? 150; // из 300 запросов за 5 минут; свой профиль тратит ~15
  const maxViews = o.maxViews ?? 12;
  const maxRaw = o.maxRaw ?? 16;          // сырые ответы Hypixel (по несколько МБ каждый) — не больше стольких игроков
  const rawTtl = o.rawTtlMs ?? 60 * MIN;  // и не дольше часа: на публичном сайте Visitors смотрят сотни разных ников

  const names = new Map();     // ник в нижнем регистре → { uuid, name, at }
  const rawProfiles = new Map(); // uuid → { resp, at, promise }
  const extras = new Map();    // profileId → { garden, museum, at }
  const views = new Map();     // `${uuid}:${профиль}` → вид

  const ownerName = () => o.owner().player?.name?.toLowerCase();
  const budgetLeft = () => friendBudget - Math.max(0, (api.keyedCallsRecent?.() ?? 0) - 20);

  function rateError() {
    const e = new Error('Hypixel ограничил частоту запросов: чужие профили обновятся чуть позже');
    e.code = 'RATE';
    return e;
  }

  async function uuidOf(name) {
    const own = o.owner().player;
    if (own && (own.name?.toLowerCase() === name.toLowerCase() || own.uuid === name.replace(/-/g, '').toLowerCase())) return own;
    const k = name.toLowerCase();
    const c = names.get(k);
    if (c && clock() - c.at < 24 * 60 * MIN) return c;
    let r;
    // По uuid (так открываются кооп-соседи) ник спрашиваем у сервера сессий Mojang
    const asUuid = /^[0-9a-f]{32}$/i.test(name.replace(/-/g, '')) ? name.replace(/-/g, '').toLowerCase() : null;
    try { r = asUuid ? await api.resolveName(asUuid) : await api.resolveUuid(name); } catch (e) {
      if (c) return c; // Mojang недоступен — старый ответ лучше, чем ничего
      const missing = e.status === 404 || e.status === 204;
      const err = new Error(missing ? tx`Игрок ${name} не найден` : tx`Не удалось найти игрока ${name}: ${e.message}`);
      // Mojang не ответил (сеть, сбой, лимит) — это не «нет такого игрока»: иначе друг читал «опечатка в нике»
      err.code = missing ? 'NOT_FOUND' : e.status === 429 ? 'RATE' : 'NETWORK';
      throw err;
    }
    if (!r?.uuid) { const err = new Error(tx`Игрок ${name} не найден`); err.code = 'NOT_FOUND'; throw err; }
    const v = { uuid: r.uuid, name: r.name || name, at: clock() };
    names.set(k, v); names.set(v.name.toLowerCase(), v); names.set(v.uuid, v);
    return v;
  }

  /** Список профилей игрока. Свой — из ответа основного обновления, без запросов. */
  async function profilesOf(uuid, { force = false, ttlMs = ttl } = {}) {
    const own = o.owner();
    if (own.player?.uuid === uuid && own.raw?.resp) return { resp: own.raw.resp, at: own.raw.at };
    let c = rawProfiles.get(uuid);
    // После перезапуска сайта — последний ответ с диска (если не старше часа), а не новый запрос в Hypixel
    if (!c && o.diskCache) {
      const d = o.diskCache.get(`p_${uuid}`, rawTtl);
      if (d?.data) { c = { resp: d.data, at: d.at }; rawProfiles.set(uuid, c); }
    }
    if (c?.promise) return c.promise;
    if (c?.at && clock() - c.at < (force ? 30_000 : ttlMs)) return c; // «Обновить» — не чаще раза в 30 секунд
    // Кооп-сосед владельца: общий остров уже лежит в свежем ответе по своему профилю. Берём его,
    // если свой запрос не удался или лимит на исходе (остальные профили соседа тогда не видны)
    const ownCoop = () => (own.raw?.resp?.profiles || []).some(p => p.members?.[uuid]) ? { resp: { profiles: own.raw.resp.profiles.filter(p => p.members?.[uuid]) }, at: own.raw.at } : null;
    if (budgetLeft() < 1) { const oc = ownCoop(); if (oc) return oc; }
    if (budgetLeft() < 1) { if (c) return c; const d = o.diskCache?.get(`p_${uuid}`); if (d?.data) return { resp: d.data, at: d.at }; throw rateError(); }
    const promise = api.getProfiles(uuid)
      .then(resp => { const v = { resp, at: clock() }; rawProfiles.set(uuid, v); trim(rawProfiles, maxRaw); o.diskCache?.set(`p_${uuid}`, resp, v.at); return v; })
      .catch(e => {
        if (c) { rawProfiles.set(uuid, c); return c; }
        rawProfiles.delete(uuid);
        const oc = ownCoop(); if (oc) return oc;
        // Hypixel не отдал (лимит, сбой) — последний ответ с диска любой давности лучше пустой страницы
        const d = o.diskCache?.get(`p_${uuid}`);
        if (d?.data) { const v = { resp: d.data, at: d.at }; rawProfiles.set(uuid, v); return v; }
        throw e;
      });
    rawProfiles.set(uuid, { ...(c || {}), promise });
    return promise;
  }

  /** Garden (общий для острова) и музей (у каждого свой, но один ответ на весь остров) */
  async function extrasOf(profileId, uuid) {
    const own = o.owner();
    if (own.raw?.profileId === profileId && own.raw.at && (own.raw.garden || own.raw.museum)) {
      return { garden: own.raw.garden, museum: own.raw.museum?.members?.[uuid] || null, museumFetched: !!own.raw.museum };
    }
    let c = extras.get(profileId);
    if (!c || clock() - c.at > 10 * MIN) {
      if (budgetLeft() >= 2) {
        const [g, mu] = await Promise.allSettled([api.getGarden(profileId), api.getMuseum(profileId)]);
        c = { garden: g.status === 'fulfilled' ? parse.parseGarden(g.value) : c?.garden || null, museum: mu.status === 'fulfilled' ? mu.value : c?.museum || null, at: clock() };
        extras.set(profileId, c);
        trim(extras, maxRaw);
      }
    }
    return { garden: c?.garden || null, museum: c?.museum?.members?.[uuid] || null, museumFetched: !!c?.museum };
  }

  /** Кэш без предела рос с каждым новым ником (утечка памяти): выкидываем старые и лишние записи */
  function trim(map, max) {
    const now = clock();
    for (const [k, v] of map) if (!v.promise && v.at && now - v.at > rawTtl) map.delete(k);
    if (map.size <= max) return;
    const old = [...map.entries()].filter(([, v]) => !v.promise).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
    for (const [k] of old.slice(0, map.size - max)) map.delete(k);
  }

  function evict() {
    if (views.size <= maxViews) return;
    const old = [...views.entries()].sort((a, b) => a[1].seenAt - b[1].seenAt);
    for (const [k] of old.slice(0, views.size - maxViews)) views.delete(k);
  }

  async function build(v, { force = false, ttlMs = ttl } = {}) {
    // Гильдия — параллельно с профилем; новый запрос только пока лимит ключа не на исходе (как у ранга)
    const guildP = o.guildFor ? o.guildFor(v.player.uuid, { allowFetch: budgetLeft() > 10 }).catch(() => null) : null;
    const { resp, at } = await profilesOf(v.player.uuid, { force, ttlMs });
    const list = resp?.profiles || [];
    v.profiles = list.filter(p => p.members?.[v.player.uuid]).map(p => ({ id: p.profile_id, name: p.cute_name, selected: !!p.selected, mode: p.game_mode || 'normal', members: Math.max(1, coopRoster(p).length) }));
    const want = v.wantProfile;
    const profile = (want && list.find(p => p.profile_id === want.replace(/-/g, ''))) || parse.pickProfile(list.filter(p => p.members?.[v.player.uuid]), v.player.uuid, want);
    if (!profile) { const e = new Error(tx`У игрока ${v.player.name} нет профилей SkyBlock (или API выключен в настройках)`); e.code = 'NO_PROFILE'; throw e; }
    // Просили профиль, которого у игрока нет (опечатка, удалён) — показываем основной, но говорим об этом
    const w = (want || '').toLowerCase().replace(/-/g, '');
    v.missingProfile = w && w !== String(profile.cute_name || '').toLowerCase() && w !== profile.profile_id ? want : null;
    const extra = await extrasOf(profile.profile_id, v.player.uuid);
    const member = await parse.parseMember(profile, v.player.uuid, extra);
    // ранг — лишний запрос: только пока лимит ключа не на исходе
    if (o.rankFor && budgetLeft() > 10) member.rank = await o.rankFor(v.player.uuid).catch(() => null);
    member.hypixel = (o.hypixelInfo || hypixelInfo)(v.player.uuid); // из того же ответа /player, без запроса
    if (guildP) member.guild = await guildP;
    const analysis = analyze(member);
    const snap = (() => { try { return (o.snapshot || snapshot)(member, analysis.gear); } catch { return null; } })();
    if (snap && v.lastSnap) {
      const ev = diffFeed(v.lastSnap, snap);
      if (ev.length) v.feed = [...ev, ...v.feed].slice(0, 100);
    }
    if (snap) {
      v.lastSnap = snap;
      // История друга: снимок раз в час с тем же прореживанием, что у своего профиля. На диск — только для тех,
      // у кого есть аккаунт на сайте: случайные ники из публичного просмотра места на сервере не занимают
      const hk = `${v.player.uuid}_${profile.profile_id}`;
      const keep = !!o.keepHistory?.(v.player.name) && o.historyFiles;
      if (keep && v.historyKey !== hk) { v.history = o.historyFiles.load(hk); v.historyKey = hk; }
      const r = pushSnapshot(v.history, { ...snap, t: clock() });
      v.history = r.history;
      if (r.added && keep) o.historyFiles.save(hk, v.history);
    }
    Object.assign(v, { member, analysis, status: 'ok', error: null, errorCode: null, updatedAt: at || clock() });
    try { o.onUpdate?.(v); } catch (e) { console.warn('[профили]', e.message); } // рейтинг (server/leaderboard.js)
    return v;
  }

  function refreshInBackground(v, opts) {
    if (v.loading) return v.loading;
    v.loading = build(v, opts)
      .catch(e => { v.status = v.member ? 'ok' : (e.code === 'NO_KEY' ? 'no_key' : 'error'); v.error = e.message; v.errorCode = e.code || null; if (!v.member) throw e; return v; })
      .finally(() => { v.loading = null; });
    return v.loading;
  }

  return {
    /** Свой основной профиль? Тогда ответ даёт state.js как раньше. */
    isOwner(req) {
      if (!req) return true;
      const own = o.owner();
      if (!own.player) return req.player.toLowerCase() === (o.ownerName?.() || '').toLowerCase() && !req.profile;
      const nick = fixNick(req.player);
      const same = nick.toLowerCase() === ownerName() || nick.replace(/-/g, '').toLowerCase() === own.player.uuid;
      if (!same) return false;
      const p = req.profile.toLowerCase();
      return !p || p === own.member?.profileName?.toLowerCase() || p === own.member?.profileId;
    },

    /**
     * Профиль игрока для страниц сайта. Первый раз ждёт загрузки, дальше отдаёт кэш сразу
     * и обновляет его в фоне, если кэш старше ttl. passive — вкладка в фоне: только кэш, без обновления.
     */
    async get(req, { force = false, ttlMs = ttl, passive = false } = {}) {
      const typed = String(req.player || '').trim();
      req = { ...req, player: fixNick(typed) };
      const badName = () => { const e = new Error(/[а-яё]/i.test(typed) ? tx`«${typed}» — не ник Minecraft: ники пишутся только латиницей, цифрами и _` : 'Такого ника не бывает: только латиница, цифры и _, до 16 символов'); e.code = 'BAD_NAME'; return e; };
      if (!validName(req.player)) throw badName();
      // Русская раскладка: «щцтуксфе» ищем как ownercat; если такого игрока нет — понятная ошибка про кириллицу, а не «rjnbr не найден»
      const player = await uuidOf(req.player).catch(e => { throw req.player !== typed && e.code === 'NOT_FOUND' ? badName() : e; });
      const key = `${player.uuid}:${(req.profile || '').toLowerCase()}`;
      let v = views.get(key);
      if (!v) {
        v = { key, player: { uuid: player.uuid, name: player.name }, wantProfile: req.profile || '', profiles: [], member: null, analysis: null, status: 'loading', error: null, updatedAt: 0, feed: [], history: [], lastSnap: null, loading: null, seenAt: clock() };
        views.set(key, v);
        evict();
      }
      v.seenAt = clock();
      if (!v.member && passive && !v.loading) {
        // Фоновая вкладка, а профиля в памяти нет (перезапуск сайта): не загружаем ради неё,
        // вкладка спросит снова, когда её откроют
        views.delete(key);
        const e = new Error('Профиль загрузится, когда вкладку откроют'); e.code = 'PASSIVE'; throw e;
      }
      if (!v.member) {
        try { await refreshInBackground(v, { force, ttlMs }); } catch (e) { views.delete(key); throw e; }
      } else if (force) {
        await refreshInBackground(v, { force: true }).catch(() => {});
      } else if (!passive && clock() - v.updatedAt > ttlMs) {
        refreshInBackground(v, { ttlMs }).catch(() => {});
      }
      return v;
    },

    /**
     * Кооп-соседи открытого профиля с никами — для быстрого переключения и сравнения.
     * Ники берутся у Mojang (без ключа Hypixel) и кэшируются на сутки; не ответил — ник null, вместо него uuid.
     */
    async coopOf(member) {
      const list = (member?.coopRoster || []).filter(c => c.uuid !== member.uuid);
      const named = await Promise.all(list.map(async c => {
        const known = names.get(c.uuid);
        if (known && clock() - known.at < 24 * 60 * MIN) return { ...c, name: known.name };
        const r = await uuidOf(c.uuid).catch(() => null);
        return { ...c, name: r?.name || null };
      }));
      const me = (member?.coopRoster || []).find(c => c.uuid === member.uuid);
      return { profile: member?.profileName || null, profileId: member?.profileId || null, share: me?.share ?? null, members: named };
    },

    /** Названия профилей SkyBlock игрока (для проверки профиля друга на /account) */
    async profileNames(name) {
      const player = await uuidOf(fixNick(String(name || '').trim()));
      const { resp } = await profilesOf(player.uuid);
      return (resp?.profiles || []).filter(p => p.members?.[player.uuid]).map(p => p.cute_name).filter(Boolean);
    },

    stats() {
      return { views: views.size, rawProfiles: rawProfiles.size, extras: extras.size, keyedLast5min: api.keyedCallsRecent?.() ?? 0, friendBudgetLeft: budgetLeft() };
    },
    _views: views,
  };
}
