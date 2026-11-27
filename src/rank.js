// Ранг Hypixel (VIP…MVP++) игрока: один запрос /player раз в 6 часов на игрока — ранг меняется редко,
// а лимит ключа нужен профилям. Ошибка запроса не мешает профилю: ранг просто не покажем.
// Из того же ответа берём уровень сети, ссылки и SkyBlock-достижения (hypixelInfo) — без лишних запросов.
import { getPlayer } from './hypixel.js';
import { rankOf } from './lib/profile-mode.js';
import { hypixelInfoOf } from './lib/hypixel-player.js';

const cache = new Map(); // uuid → { rank, info, at, promise }
const TTL = 6 * 3600_000, RETRY = 10 * 60_000;

export async function rankFor(uuid, { fetcher = getPlayer, now = () => Date.now() } = {}) {
  if (!uuid) return null;
  let c = cache.get(uuid);
  if (c?.promise) return c.promise;
  if (c && now() - c.at < (c.rank ? TTL : RETRY)) return c.rank;
  c = c || { rank: null, info: null, at: 0 };
  cache.set(uuid, c);
  c.promise = (async () => {
    try {
      const player = (await fetcher(uuid))?.player;
      c.rank = rankOf(player) || c.rank;
      c.info = hypixelInfoOf(player) || c.info;
    } catch { /* без ранга */ }
    c.at = now();
    c.promise = null;
    return c.rank;
  })();
  return c.promise;
}

/** Уровень сети, ссылки и достижения из последнего ответа /player (после rankFor); null — ещё не было ответа */
export const hypixelInfo = uuid => cache.get(uuid)?.info || null;
export const _rankCache = cache;
