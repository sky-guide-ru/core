// Что игрок делает прямо сейчас (/status), его Bingo (/skyblock/bingo + /resources/skyblock/bingo)
// и патчноуты SkyBlock (/skyblock/news). Здесь только разбор ответов — запросы и кэш в live.js.

// mode сервера SkyBlock → остров, как он называется в игре
export const ISLANDS = {
  dynamic: 'Private Island', hub: 'Hub', garden: 'Garden', farming_1: 'The Farming Islands',
  foraging_1: 'The Park', foraging_2: 'Galatea', mining_1: 'Gold Mine', mining_2: 'Deep Caverns',
  mining_3: 'Dwarven Mines', crystal_hollows: 'Crystal Hollows', mineshaft: 'Glacite Mineshafts',
  combat_1: "Spider's Den", combat_3: 'The End', crimson_isle: 'Crimson Isle', kuudra: 'Kuudra',
  dungeon_hub: 'Dungeon Hub', dungeon: 'Catacombs', rift: 'The Rift', dark_auction: 'Dark Auction',
  winter: "Jerry's Workshop", fishing_1: 'Backwater Bayou',
};
const title = s => String(s || '').toLowerCase().split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
export const islandName = mode => (mode ? ISLANDS[String(mode).toLowerCase()] || title(mode) : null);

/** Ответ /status → { online, game, mode, island } (online: false и при статусе, скрытом в настройках Hypixel) */
export function statusOf(resp, at = Date.now()) {
  const s = resp?.session;
  if (!s || typeof s !== 'object') return null;
  if (!s.online) return { online: false, at };
  const game = String(s.gameType || '').toUpperCase() || null;
  const sb = game === 'SKYBLOCK';
  return { online: true, game, mode: s.mode || null, island: sb ? islandName(s.mode) : null, at };
}

const ms = t => { const n = Number(t) || 0; return n && n < 1e12 ? n * 1000 : n; };

/** Ответ /resources/skyblock/bingo → { id, name, start, end, modifier, goals: [{ id, name }] } */
export function bingoEventOf(raw) {
  if (!raw || raw.id == null) return null;
  return {
    id: Number(raw.id), name: String(raw.name || ''), start: ms(raw.start), end: ms(raw.end), modifier: raw.modifier || null,
    goals: (Array.isArray(raw.goals) ? raw.goals : []).filter(g => g?.id).map(g => ({ id: String(g.id), name: String(g.name || g.id), lore: strip(g.lore).slice(0, 200) })),
  };
}

const strip = v => String(v || '').replace(/§./g, '').replace(/\s+/g, ' ').trim();

/**
 * Цели нынешнего Bingo, которые игрок ещё не выполнил: [{ id, name, lore }].
 * null — ивент не идёт (нет данных или уже закончился). Игрок мог ещё ни одной цели не взять — тогда все.
 */
export function bingoGoalsLeft(resp, event, now = Date.now()) {
  if (!event?.goals?.length || !(event.end > now)) return null;
  const mine = (Array.isArray(resp?.events) ? resp.events : []).find(e => e && Number(e.key) === event.id);
  const done = new Set((mine?.completed_goals || []).map(String));
  return event.goals.filter(g => !done.has(g.id)).map(g => ({ id: g.id, name: g.name, lore: g.lore || '' }));
}

/**
 * Ответ /skyblock/bingo игрока + текущий ивент → { events, points, current }
 * events — в скольких Bingo участвовал, points — очков за все, current — нынешний ивент (если игрок в нём что-то выполнил)
 */
export function bingoOf(resp, event = null) {
  const list = (Array.isArray(resp?.events) ? resp.events : []).filter(e => e && e.key != null);
  if (!list.length) return null;
  const points = list.reduce((s, e) => s + (Number(e.points) || 0), 0);
  const mine = event && list.find(e => Number(e.key) === event.id);
  let current = null;
  if (mine) {
    const done = new Set((mine.completed_goals || []).map(String));
    current = {
      id: event.id, name: event.name, end: event.end, points: Number(mine.points) || 0,
      done: event.goals.filter(g => done.has(g.id)).length || done.size, total: event.goals.length || null,
    };
  }
  return { events: list.length, points, current };
}

const safeUrl = v => (/^https:\/\/[^\s"'<>]+$/i.test(String(v || '')) ? String(v) : null);
/** Ответ /skyblock/news → [{ title, date, link, icon }] (новые сверху, как отдаёт Hypixel) */
export function skyblockNewsOf(resp, max = 8) {
  return (Array.isArray(resp?.items) ? resp.items : [])
    .map(n => ({ title: String(n?.title || '').slice(0, 120), date: String(n?.text || '').slice(0, 40), link: safeUrl(n?.link), icon: n?.item?.material || null }))
    .filter(n => n.title && n.link).slice(0, max);
}
