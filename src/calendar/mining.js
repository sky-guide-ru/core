// Ивенты майнинга в Dwarven Mines, Crystal Hollows и Glacite Mineshafts.
// Факты сверены с вики hypixelskyblock.minecraft.wiki (ноябрь 2026). В API Hypixel ивентов нет, поэтому что идёт
// сейчас берём из открытого трекера Soopy: его собирают игроки с модами, у каждого лобби своё расписание,
// и трекер отдаёт сводку по лобби. Ответ обновляется раз в минуту; не ответил — блок просто пустой.
import { getJson } from '../http.js';

export const CH_EVENTS_URL = 'https://api.soopy.dev/skyblock/chevents/get';

export const ISLANDS = [
  { id: 'DWARVEN_MINES', name: 'Dwarven Mines' },
  { id: 'CRYSTAL_HOLLOWS', name: 'Crystal Hollows' },
  { id: 'MINESHAFT', name: 'Glacite Mineshafts' },
];

// where — где бывает, min — длительность в минутах (null — случайный), gives — что даёт, todo — что делать
export const MINING_EVENTS = [
  { id: 'DOUBLE_POWDER', name: '2x Powder', where: 'Dwarven Mines, Crystal Hollows', min: 15, hot: true,
    gives: 'Весь Mithril, Gemstone и Glacite Powder ×2, в том числе от заданий, Fetchur, Puzzler и Daily Powder.',
    todo: 'Сдавай накопленные задания, копай гемы и открывай сундуки в Crystal Hollows.',
    tip: 'Весь Powder ×2: копай гемы и сдавай задания сейчас.' },
  { id: 'BETTER_TOGETHER', name: 'Better Together', where: 'Dwarven Mines, Crystal Hollows', min: 18,
    gives: '+250 Mining Speed и +20 Mining Fortune за каждого игрока в той же зоне, до 5 игроков.',
    todo: 'Копай в людной зоне или с пати.',
    tip: 'Копай рядом с другими игроками: до +1 250 Mining Speed.' },
  { id: 'GOBLIN_RAID', name: 'Goblin Raid', where: 'Dwarven Mines', min: 5,
    gives: 'За 25 своих убийств и выполненную цель: 30 000 Mining XP, 20 000 Mithril Powder + 100 за гоблина и 2 предмета.',
    todo: 'Беги в указанную зону и бей Goblin Raider, Superprotectron считается за 10.',
    tip: 'Убей 25 Goblin Raider в зоне рейда за 5 минут.' },
  { id: 'RAFFLE', name: 'Raffle', where: 'Dwarven Mines', min: 3,
    gives: 'Mithril Powder, Mining XP и предмет; шанс на тройную награду равен доле твоих билетов.',
    todo: 'Собери от 10 Raffle Ticket и сдай в Raffle Box до конца. Нужно от 10 игроков в лобби.',
    tip: 'Собирай Raffle Ticket и неси в Raffle Box, нужно от 10 билетов.' },
  { id: 'MITHRIL_GOURMAND', name: 'Mithril Gourmand', where: 'Dwarven Mines', min: 10,
    gives: 'За 10 своих Tasty Mithril: Mithril Powder, Mining XP и предметы.',
    todo: 'Копай Mithril в указанной зоне (30% на Tasty Mithril) и неси Don Expresso: /tptodonexpresso.',
    tip: 'Копай Mithril ради Tasty Mithril и неси Don Expresso: /tptodonexpresso.' },
  { id: 'FALLEN_STAR', name: 'Fallen Star', where: 'Dwarven Mines', min: null,
    gives: 'Больше Mithril, Titanium и Mithril Powder рядом со звездой, шанс на Starfall.',
    todo: 'Если звезда рядом, копай у неё пару минут.' },
  { id: 'POWDER_GHAST', name: 'Powder Ghast', where: 'Dwarven Mines', min: null,
    gives: 'Mithril Powder за каждое попадание.',
    todo: 'Стреляй из лука, пока не убьёшь.' },
];
const BY_ID = new Map(MINING_EVENTS.map(e => [e.id, e]));
// Названия в ответах трекера, которые отличаются от наших id
const ALIAS = { '2X_POWDER': 'DOUBLE_POWDER', DOUBLE_POWDER: 'DOUBLE_POWDER', GOURMAND: 'MITHRIL_GOURMAND' };

const title = id => id.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
/** id трекера → наш ивент (незнакомый — с названием из id, без советов) */
export function eventOf(raw) {
  const k = String(raw || '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const id = ALIAS[k] || k;
  return BY_ID.get(id) || { id, name: title(id) || '?' };
}

const ms = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : null; };

/**
 * Ответ трекера → { at, islands: [{ id, name, lobbies, now: [...], soon: [...] }] }.
 * now — идёт: { id, name, tip, hot, ends, lobbies, double }; soon — скоро: { id, name, from, lobbies }.
 * Кончившиеся к now (по своим часам) отбрасываются.
 */
export function parseChEvents(raw, now = Date.now()) {
  const d = raw?.data;
  if (!raw?.success || !d) return null;
  const islands = ISLANDS.map(isl => {
    const running = (Array.isArray(d.running_events?.[isl.id]) ? d.running_events[isl.id] : [])
      .map(r => ({ ev: eventOf(r?.event), ends: ms(r?.ends_at), lobbies: Number(r?.lobby_count) || 0, double: !!r?.is_double }))
      .filter(r => r.ends && r.ends > now)
      .sort((a, b) => b.lobbies - a.lobbies)
      .map(r => ({ id: r.ev.id, name: r.ev.name, tip: r.ev.tip || null, hot: !!r.ev.hot, ends: r.ends, lobbies: r.lobbies, double: r.double }));
    const nowIds = new Set(running.map(r => r.id));
    const soon = Object.entries(d.event_datas?.[isl.id] || {})
      .map(([k, v]) => ({ ev: eventOf(k), from: ms(v?.starts_at_min), lobbies: Number(v?.lobby_count) || 0 }))
      .filter(x => x.from && x.from > now && !nowIds.has(x.ev.id))
      .sort((a, b) => a.from - b.from)
      .map(x => ({ id: x.ev.id, name: x.ev.name, from: x.from, lobbies: x.lobbies }));
    return { id: isl.id, name: isl.name, lobbies: Number(d.total_lobbys?.[isl.id]) || 0, now: running, soon };
  });
  return { at: now, islands };
}

/** Самый полезный ивент «сейчас» для строки в «Делах на сегодня»: сначала 2x Powder, потом по числу лобби. */
export function headline(view) {
  const all = (view?.islands || []).flatMap(i => i.now.map(e => ({ ...e, island: i.name, of: i.lobbies })));
  if (!all.length) return null;
  all.sort((a, b) => (b.hot - a.hot) || (b.lobbies - a.lobbies));
  return all[0];
}

/**
 * Живая сводка: get() отдаёт последний разбор (или null), refresh() ходит в трекер не чаще раза в минуту.
 * @param {{ fetchJson?: (url: string) => Promise<any>, now?: () => number, url?: string, every?: number }} o
 */
export function createMiningEvents(o = {}) {
  const fetchJson = o.fetchJson || (url => getJson(url, { timeout: 10_000, retries: 0 }));
  const now = o.now || (() => Date.now());
  const url = o.url || CH_EVENTS_URL;
  const every = o.every || 60_000;
  let raw = null, okAt = 0, triedAt = 0, pending = null;

  async function refresh() {
    const t = now();
    if (t - triedAt < every) return pending || false;
    triedAt = t;
    pending = (async () => {
      try {
        const r = await fetchJson(url);
        if (!r?.success) return false;
        raw = r; okAt = now(); return true;
      } catch { return false; } finally { pending = null; }
    })();
    return pending;
  }

  /** Сводка на сейчас. Старше 10 минут — считаем, что трекер молчит. */
  function get() {
    const t = now();
    if (!raw || t - okAt > 10 * 60_000) return null;
    const v = parseChEvents(raw, t);
    if (v) v.source = 'Soopy';
    return v;
  }

  return { refresh, get };
}
