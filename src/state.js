// Общее состояние, обновление профиля и лента изменений
import { rankFor, hypixelInfo } from './rank.js';
import { rankOf, profileMode } from './lib/profile-mode.js';
import { npcCoinPrice, obtainHint } from './lib/npc-shop.js';
import { hypixelInfoOf } from './lib/hypixel-player.js';
import { guildFor } from './guild.js';
import { statusFor, bingoRawFor } from './live.js';
import { statusOf, bingoOf, bingoGoalsLeft } from './lib/live-status.js';
import { bingoEvent } from './calendar/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { config } from './config.js';
import { resolveUuid, getProfiles, getGarden, getMuseum, keyedPause, setKeyOwner } from './hypixel.js';
import { pickProfile, parseMember, parseGarden } from './parse/profile.js';
import { analyzeAccessories, analyzeGear } from './parse/gear.js';
import { advise, diffRoadmaps } from './analysis/roadmap.js';
import { moneyMethods, setMoneyOwner, marketCtx } from './analysis/money.js';
import { npcOnlyCtx } from './market/methods.js';
import { SKILLS, SLAYERS } from '../i18n/ru.js';
import { pricesReady, priceOf, buyPriceOf, prices } from './prices.js';
import { magicFind } from './calc/magic-find.js';
import { buildUpgrades } from './lib/acc-upgrades.js';
import { petScoreSummary } from './analysis/pet-score.js';
import { enrichGuide } from './guides/refs.js';
import { chocolateAdvice } from './analysis/chocolate.js';
import { returningInfo } from './analysis/returning.js';
import { dailiesOf } from './analysis/dailies.js';
import { sbxpPlan } from './analysis/sbxp.js';
import { dungeonChests } from './market/methods/combat.js';
import { listByCategory } from './items-ru/index.js';
import { neu, itemName } from './neu.js';
import { museumSummary } from './museum/index.js';
import { pushSnapshot, compactHistory } from './history.js';
import { createDiskCache } from './lib/disk-cache.js';
import { tx, messageOf, remember } from '../i18n/msg.js';

export const bus = new EventEmitter();
bus.setMaxListeners(100);

export const state = {
  status: 'starting',
  error: null,
  player: null,
  member: null,
  analysis: null,
  profiles: [],
  updatedAt: 0,
  feed: [],          // лента изменений
  history: [],       // почасовые снимки ключевых показателей
};

const HIST = () => path.join(config.dataDir, 'profile-history.json');
const FIXTURE = () => path.join(config.dataDir, 'fixture-profiles.json');

// История прореживается при загрузке: файл, записанный до прореживания (60 дней по часу), сразу ужимается
// lastSnap — последний снимок (не только часовой): после перезапуска сервера (автообновление с main) лента сравнивает
// с ним, а не с часовой точкой истории, иначе прирост с прошлого часа попадает в ленту ещё раз после каждого рестарта
let savedSnap = null;
try { const h = JSON.parse(fs.readFileSync(HIST(), 'utf8')); state.history = compactHistory(h.history || []); state.feed = h.feed || []; for (const e of state.feed) remember(e.text, e.msg || legacyMsg(e.text)); savedSnap = h.lastSnap || null; } catch {}

const r3 = x => +(Number(x) || 0).toFixed(3);
const lvl = l => r3((l?.level || 0) + (l && l.progress < 1 ? l.progress : 0));
const sum = o => Object.values(o || {}).reduce((s, v) => s + (Number(v) || 0), 0);

/**
 * Почасовой снимок для графиков истории. Поля t, sb, nw, coins, mp, cata, skills, slayers — как и раньше
 * (старые снимки остаются совместимыми), остальное добавлено для графиков «по всем показателям».
 */
export function snapshot(m, gear) {
  const s = {
    t: Date.now(),
    sb: m.sbLevel,
    nw: Math.round(gear.networth.total),
    coins: Math.round(gear.networth.coins),
    mp: m.magicalPower,
    cata: +(m.dungeons.catacombs.level + m.dungeons.catacombs.progress).toFixed(3),
    skills: Object.fromEntries(Object.entries(m.skills).map(([k, s]) => [k, Math.round(s.xp)])),
    slayers: Object.fromEntries(Object.entries(m.slayers).map(([k, s]) => [k, s.xp])),
  };
  const extra = {
    items: Math.round(gear.networth.items || 0),
    bank: Math.round(m.bank || 0),
    purse: Math.round(m.purse || 0),
    classes: m.dungeons?.classes ? Object.fromEntries(Object.entries(m.dungeons.classes).map(([k, c]) => [k, lvl(c)])) : null,
    secrets: m.dungeons?.secrets,
    floors: sum(m.dungeons?.floors) + sum(m.dungeons?.masterFloors),
    hotm: lvl(m.mining?.hotm),
    powder: m.mining?.powder ? { mithril: m.mining.powder.mithril || 0, gemstone: m.mining.powder.gemstone || 0, glacite: m.mining.powder.glacite || 0 } : null,
    hotfXp: m.hotfXp,
    garden: m.garden?.experience,
    visitors: m.garden?.visitorsServed,
    kuudra: sum(m.crimson?.kuudra),
    rep: Math.max(m.crimson?.barbarianRep || 0, m.crimson?.mageRep || 0),
    trophy: m.crimson?.trophyFish?.total_caught || sum(m.crimson?.trophyFish && Object.fromEntries(Object.entries(m.crimson.trophyFish).filter(([k, v]) => /_(bronze|silver|gold|diamond)$/.test(k) && typeof v === 'number'))),
    petScore: m.leveling?.petScore,
    pets: m.pets?.length,
    souls: m.fairySouls?.collected,
    museum: m.museum?.status === 'ok' ? m.museum.count : null,
    bestiary: m.bestiaryMilestone,
    tasks: m.leveling?.tasksDone,
  };
  // Нет данных (API выключен, поля нет у профиля) — поле не пишем, и на графике будет «нет данных», а не ноль
  for (const [k, v] of Object.entries(extra)) if (v != null && !Number.isNaN(v)) s[k] = v;
  return s;
}

// Старые записи ленты (до сохранения ключа на диск): ключ восстанавливаем по виду строки, чтобы английская версия их перевела
const LEGACY_FEED = [
  [/^\+(.+) опыта слеера: (.+)$/, '+{0} опыта слеера: {1}'],
  [/^\+(.+) опыта: (.+)$/, '+{0} опыта: {1}'],
  [/^Новый совет: (.+)$/s, 'Новый совет: {0}'],
  [/^Выполнено: (.+)$/s, 'Выполнено: {0}'],
  [/^Новый уровень SkyBlock: (\d+)!$/, 'Новый уровень SkyBlock: {0}!'],
];
export function legacyMsg(text) {
  for (const [re, key] of LEGACY_FEED) { const m = re.exec(text || ''); if (m) return { key, vals: m.slice(1) }; }
  return null;
}

// Шаги, которые зависят от цен и меняются без действий игрока — их в ленту не пишем
const PRICE_DRIVEN = /^(money-|mp-cheap|mp-expensive|mp-recomb|museum-cheap|museum-milestone|gear-upgrades)/;

/** Что изменилось в плане после обновления профиля: выполненные шаги и новые важные советы. */
export function adviceFeed(prevRoadmap, roadmap, t = Date.now()) {
  if (!prevRoadmap?.length || !roadmap) return [];
  const { completed, added } = diffRoadmaps(prevRoadmap.filter(s => !PRICE_DRIVEN.test(s.id)), roadmap.filter(s => !PRICE_DRIVEN.test(s.id)));
  return [
    ...completed.map(s => ({ t, kind: 'done', text: tx`Выполнено: ${s.title}` })),
    ...added.filter(s => s.priority >= 50).map(s => ({ t, kind: 'advice', text: tx`Новый совет: ${s.title}` })),
  ];
}

export function diffFeed(prev, cur) {
  if (!prev) return [];
  const ev = [];
  for (const [k, xp] of Object.entries(cur.skills)) {
    const d = xp - (prev.skills?.[k] || 0);
    if (d > 0) ev.push({ t: cur.t, kind: 'skill', text: tx`+${d.toLocaleString('ru-RU')} опыта: ${SKILLS[k]}` });
  }
  for (const [k, xp] of Object.entries(cur.slayers)) {
    const d = xp - (prev.slayers?.[k] || 0);
    if (d > 0) ev.push({ t: cur.t, kind: 'slayer', text: tx`+${d.toLocaleString('ru-RU')} опыта слеера: ${SLAYERS[k]?.name || k}` });
  }
  if (cur.mp !== prev.mp) ev.push({ t: cur.t, kind: 'mp', text: tx`Magical Power: ${prev.mp} → ${cur.mp}` });
  if (Math.floor(cur.sb) > Math.floor(prev.sb)) ev.push({ t: cur.t, kind: 'level', text: tx`Новый уровень SkyBlock: ${Math.floor(cur.sb)}!` });
  if (Math.floor(cur.cata) > Math.floor(prev.cata)) ev.push({ t: cur.t, kind: 'level', text: tx`Catacombs ${Math.floor(cur.cata)}!` });
  const dc = cur.coins - prev.coins;
  if (Math.abs(dc) > 100_000) ev.push({ t: cur.t, kind: 'coins', text: tx`${dc > 0 ? '+' : ''}${dc.toLocaleString('ru-RU')} монет` });
  return ev;
}

/** Полный анализ участника (аксессуары, снаряжение, план, заработок). Чистая функция: годится и для чужих профилей. */
export function analyzeMember(m) {
  const acc = analyzeAccessories(m);
  const gear = analyzeGear(m);
  const { roadmap, map, plan, summary, power } = advise(m, acc, gear);
  const methods = moneyMethods(m, { networth: gear?.networth?.total });
  let museum = null;
  try { museum = museumSummary(m, { constants: neu.constants, price: priceOf, name: itemName }); } catch (e) { console.warn('[музей]', e.message); }
  let petScore = null;
  try { petScore = petScoreSummary(m, { petIds: allPetIds(), price: priceOf, maxedPrice: id => { const b = prices.bin.get(id); return b?.max || 0; }, name: itemName }); } catch (e) { console.warn('[pet score]', e.message); }
  // Подсказки по тексту карточки «Кап Taming»
  if (petScore?.taming?.text) {
    try {
      const t = petScore.taming;
      const text = [t.text.intro, t.text.note, ...t.candidates.map(c => c.name)].join('\n');
      t.refs = enrichGuide({ status: 'ok', sections: [{ kind: 'text', text }] }, { items: neu.items, constants: neu.constants, price: priceOf }).refs;
    } catch (e) { console.warn('[taming refs]', e.message); }
  }
  let chocolate = null;
  try { chocolate = chocolateAdvice(m.extras?.chocolate); } catch (e) { console.warn('[Chocolate]', e.message); }
  // Magic Find — в куске «Снаряжения» (в /api/state не уходит)
  // Ironman, Stranded, Bingo: без рынка — цены только NPC, остальное «где добыть»
  const noMarket = profileMode(m.gameMode).market === false;
  if (gear) {
    try { gear.mf = magicFind(m, { constants: neu.constants, price: noMarket ? id => npcCoinPrice(neu.items, id) : buyPriceOf, name: itemName, upgrades: mfUpgrades(), noMarket, obtain: id => obtainHint(neu.items, id) }); } catch (e) { console.warn('[magic find]', e.message); }
  }
  const safe = (name, fn) => { try { return fn(); } catch (e) { console.warn(tx`[${name}]`, e.message); return null; } };
  // «Обзор»: перерыв в игре и ежедневные дела; «Прогресс»: дешёвый SkyBlock XP и сундуки данжей
  const returning = safe('возвращение', () => returningInfo(m));
  const dailies = safe('дейлики', () => dailiesOf(m));
  const sbxp = safe('SkyBlock XP', () => sbxpPlan(m, { acc, petScore, museumBest: museum?.best || null, museumFreeXp: museum?.canDonateXp || 0, noMarket }));
  const chests = safe('сундуки', () => dungeonChests(noMarket ? npcOnlyCtx(marketCtx()) : marketCtx(), m));
  return { acc, gear, roadmap, map, plan, summary, power, methods, museum, petScore, chocolate, returning, dailies, sbxp, chests };
}

let upMemo = null;
function mfUpgrades() {
  const raw = neu.constants.misc?.talisman_upgrades;
  if (!upMemo || upMemo.raw !== raw) upMemo = { raw, map: raw ? buildUpgrades(raw) : {} };
  return upMemo.map;
}

// Все ID питомцев вида TYPE;N: из базы предметов и из аукциона (там бывают новые питомцы раньше базы)
function allPetIds() {
  const ids = new Set();
  try { for (const it of listByCategory('pet')) if (/;\d$/.test(it.id)) ids.add(it.id); } catch { /* база ещё грузится */ }
  // С аукциона — только редкости известных типов питомцев: у рун (HOT_RUNE;1) и прочего тот же вид id «ТИП;N»
  const types = new Set([...ids].map(id => id.split(';')[0]));
  for (const id of prices.bin.keys()) if (/^[A-Z0-9_]+;\d$/.test(id) && (types.size ? types.has(id.split(';')[0]) : !/RUNE/.test(id))) ids.add(id);
  return [...ids];
}

let lastSnap = savedSnap;
let analyzedAt = 0;
export function reanalyze() {
  const m = state.member;
  if (!m) return;
  state.analysis = analyzeMember(m);
  analyzedAt = Date.now();
  return state.analysis.gear;
}
/**
 * Пересчёт на новые цены, если разбор не свежий. Разбор своего профиля занимает 0,3–0,7 с, и всё это время
 * сервер не отвечает. Раньше раз в минуту он шёл дважды: после обновления профиля и тут же на цены.
 * @returns {boolean} пересчитал ли
 */
export function reanalyzeForPrices(freshMs = 30_000) {
  if (Date.now() - analyzedAt < freshMs) return false;
  reanalyze();
  return true;
}

// Как часто тратить лимит ключа на свой профиль. Раньше — каждую минуту круглые сутки и сразу три запроса
// (профиль, Garden, музей): ~4300 запросов в день, хотя суточный лимит ключа разработчика намного меньше.
// Теперь раз в минуту — только пока профиль кто-то смотрит (видимая вкладка), без зрителей — раз в 15 минут;
// Garden — не чаще раза в 5 минут, музей — раза в 30 (меняются редко). После 429 ключ на паузе: не спрашиваем вовсе.
export const OWNER_IDLE_MS = 15 * 60_000;
export const GARDEN_MS = 5 * 60_000;
export const MUSEUM_MS = 30 * 60_000;
const WATCH_MS = 3 * 60_000;
let watchedAt = 0, attemptAt = 0;
const ownerDisk = createDiskCache({ dir: process.env.NODE_TEST_CONTEXT ? null : path.join(config.dataDir, 'hypixel-cache') });
/** Профиль владельца открыт в видимой вкладке (вызывается из /api на каждый такой запрос) */
export function markOwnerWatched(t = Date.now()) { watchedAt = t; }
/** Пора ли фоновому циклу обновлять свой профиль */
export function ownerRefreshDue(now = Date.now(), { every = config.profileRefresh, paused = keyedPause() } = {}) {
  if (now - attemptAt < every - 2000) return false; // и после неудачи — не чаще раза в минуту
  // Ключ на паузе: в Hypixel не ходим, но если профиля в памяти нет (перезапуск), обновление поднимет его с диска
  if (paused) return !state.member;
  const age = now - (state.updatedAt || 0);
  if (state.status !== 'ok') return true; // первый запуск или прошлое обновление не удалось
  return age >= (now - watchedAt < WATCH_MS ? every - 2000 : OWNER_IDLE_MS);
}

// Одно обновление за раз: двойной клик «Обновить», несколько вкладок и фоновый цикл не шлют
// параллельные запросы в Hypixel (каждое обновление — 3 запроса, лимит ключа легко выбить)
let inFlight = null;
export function refreshProfile() {
  if (!inFlight) attemptAt = Date.now();
  if (!inFlight) inFlight = doRefreshProfile().finally(() => { inFlight = null; });
  return inFlight;
}

async function doRefreshProfile() {
  try {
    let resp;
    const useFixture = !config.apiKey && fs.existsSync(FIXTURE());
    if (useFixture) {
      resp = JSON.parse(fs.readFileSync(FIXTURE(), 'utf8'));
      state.demo = true;
      state.player ||= { uuid: Object.keys(resp.profiles[0].members)[0], name: config.player };
    }
    if (!state.player) state.player = await resolveUuid(config.player);
    const uuid = state.player.uuid;
    // Гильдия — параллельно с профилем: из кэша (час) сразу, иначе один запрос, который не задерживает профиль
    const guildP = state.demo ? Promise.resolve(null) : guildFor(uuid).catch(() => null);
    // Онлайн и остров (/status) — только пока профиль смотрят, Bingo — раз в 6 часов (live.js)
    const statusP = state.demo || Date.now() - watchedAt >= WATCH_MS ? Promise.resolve(null) : statusFor(uuid).catch(() => null);
    const bingoP = state.demo ? Promise.resolve(null) : bingoRawFor(uuid).catch(() => null);
    setMoneyOwner(uuid); // личные настройки «Заработка» (Fortune, Forge, сессии) — только для своего профиля
    // Первый запуск после перезапуска сайта: свежий (до 10 минут) ответ с диска вместо запросов в Hypixel
    let disk = !useFixture && !state.raw ? ownerDisk.get('owner', 10 * 60_000) : null, staleErr = null;
    if (disk && disk.data?.uuid !== uuid) disk.data = null;
    if (disk?.data) resp = disk.data.resp;
    else if (!useFixture) {
      try { resp = await getProfiles(uuid); } catch (e) {
        // Сайт перезапустился, а Hypixel не отдаёт профиль (лимит, сбой): берём сохранённый ответ любой давности,
        // иначе разделы, которые считает сервер (гайды, запасы, музей…), пусты до сброса лимита
        const old = !state.raw ? ownerDisk.get('owner') : null;
        if (!old?.data || old.data.uuid !== uuid) throw e;
        disk = old; resp = old.data.resp; staleErr = e;
      }
    }
    state.profiles = (resp.profiles || []).map(p => ({ id: p.profile_id, name: p.cute_name, selected: !!p.selected, mode: p.game_mode || 'normal' }));
    const profile = pickProfile(resp.profiles, uuid, config.profileName);
    if (!profile) throw new Error('У игрока нет профилей SkyBlock');
    const extra = {};
    // Сырые ответы храним: профили друзей по тому же острову (кооп) и другие свои профили берутся отсюда без лишних запросов
    const prevRaw = disk?.data ? { ...disk.data, profileId: disk.data.profileId } : state.raw;
    const fetchedAt = disk?.data ? disk.at : Date.now();
    state.raw = { resp, at: fetchedAt, garden: null, museum: null, profileId: profile.profile_id };
    if (state.demo) {
      try { extra.garden = state.raw.garden = parseGarden(JSON.parse(fs.readFileSync(path.join(config.dataDir, 'fixture-garden.json'), 'utf8'))); } catch { /* в демо Garden может не быть */ }
    } else {
      setKeyOwner(uuid, profile.profile_id);
      const now = Date.now(), same = prevRaw?.profileId === profile.profile_id;
      // Garden и музей — из прошлого обновления, пока не устарели
      if (same && prevRaw.garden && now - (prevRaw.gardenAt || 0) < GARDEN_MS) Object.assign(state.raw, { garden: prevRaw.garden, gardenAt: prevRaw.gardenAt });
      else { try { state.raw.garden = parseGarden(await getGarden(profile.profile_id)); state.raw.gardenAt = now; } catch { if (same) Object.assign(state.raw, { garden: prevRaw.garden, gardenAt: prevRaw.gardenAt }); } }
      if (same && prevRaw.museum && now - (prevRaw.museumAt || 0) < MUSEUM_MS) Object.assign(state.raw, { museum: prevRaw.museum, museumAt: prevRaw.museumAt });
      else { try { state.raw.museum = await getMuseum(profile.profile_id); state.raw.museumAt = now; } catch { if (same) Object.assign(state.raw, { museum: prevRaw.museum, museumAt: prevRaw.museumAt }); } }
      extra.garden = state.raw.garden || undefined;
      if (!disk?.data) ownerDisk.set('owner', { uuid, resp, profileId: profile.profile_id, garden: state.raw.garden, gardenAt: state.raw.gardenAt, museum: state.raw.museum, museumAt: state.raw.museumAt }, fetchedAt);
      if (state.raw.museum) { extra.museum = state.raw.museum.members?.[uuid] || null; extra.museumFetched = true; }
    }
    const prevRoadmap = state.analysis?.roadmap;
    state.member = await parseMember(profile, uuid, extra);
    if (!state.demo) { state.member.rank = await rankFor(uuid).catch(() => null); state.member.hypixel = hypixelInfo(uuid); }
    else { try { const pl = JSON.parse(fs.readFileSync(path.join(config.dataDir, 'fixture-player.json'), 'utf8')).player; state.member.rank = rankOf(pl); state.member.hypixel = hypixelInfoOf(pl); } catch { /* в демо /player может не быть */ } }
    state.member.guild = await guildP;
    const demoFile = f => { try { return JSON.parse(fs.readFileSync(path.join(config.dataDir, f), 'utf8')); } catch { return null; } };
    state.member.online = state.demo ? statusOf(demoFile('fixture-status.json')) : await statusP;
    const bingoRaw = state.demo ? demoFile('fixture-bingo.json') : await bingoP;
    state.member.bingo = bingoOf(bingoRaw, bingoEvent());
    // Профиль Bingo: невыполненные цели ивента идут в план (advisor bingoRules)
    if (state.member.gameMode === 'bingo') state.member.bingoGoals = bingoGoalsLeft(bingoRaw, bingoEvent());
    const gear = reanalyze();
    const snap = snapshot(state.member, gear);
    const prev = lastSnap || state.history[state.history.length - 1];
    const ev = [...diffFeed(prev, snap), ...adviceFeed(prevRoadmap, state.analysis?.roadmap, snap.t)];
    // ключ строки сохраняется вместе с лентой: после перезапуска английская версия переводит её так же
    for (const e of ev) { const m = messageOf(e.text); if (m) e.msg = { key: m.key, vals: m.vals.map(String) }; }
    if (ev.length) state.feed = [...ev, ...state.feed].slice(0, 200);
    lastSnap = snap;
    // Пока цены не загрузились (сразу после перезапуска/автообновления), оценка = одни монеты: такую точку
    // в историю не пишем, иначе на графике «Состояние» провал после каждого обновления сайта
    // Раз в час; старые точки прореживаются до дневных (после 30 дней) и недельных (после года) — server/history.js
    if (pricesReady()) state.history = pushSnapshot(state.history, snap).history;
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(HIST(), JSON.stringify({ history: state.history, feed: state.feed, lastSnap }));
    state.status = 'ok';
    state.error = null;
    state.limitedUntil = staleErr?.limitedUntil || null;
    state.updatedAt = fetchedAt;
    bus.emit('profile');
  } catch (e) {
    // Лимит Hypixel при уже загруженном профиле — не поломка: показываем последние данные, статус не трогаем
    if (e.code === 'RATE' && state.member) { state.limitedUntil = e.limitedUntil || null; bus.emit('profile'); return; }
    state.status = e.code === 'NO_KEY' ? 'no_key' : 'error';
    state.error = e.message;
    console.error('[профиль]', e.message);
    bus.emit('profile');
  }
}
