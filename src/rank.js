// Ранг Hypixel (VIP…MVP++) игрока: один запрос /player раз в 6 часов на игрока — ранг меняется редко,
// а лимит ключа нужен профилям. Ошибка запроса не мешает профилю: ранг просто не покажем.
import { getPlayer } from './hypixel.js';
import { rankOf } from './lib/profile-mode.js';

const cache = new Map(); // uuid → { rank, at, promise }
const TTL = 6 * 3600_000, RETRY = 10 * 60_000;

export async function rankFor(uuid, { fetcher = getPlayer, now = () => Date.now() } = {}) {
  if (!uuid) return null;
  let c = cache.get(uuid);
  if (c?.promise) return c.promise;
  if (c && now() - c.at < (c.rank ? TTL : RETRY)) return c.rank;
  c = c || { rank: null, at: 0 };
  cache.set(uuid, c);
  c.promise = (async () => {
    try { c.rank = rankOf((await fetcher(uuid))?.player) || c.rank; } catch { /* без ранга */ }
    c.at = now();
    c.promise = null;
    return c.rank;
  })();
  return c.promise;
}
export const _rankCache = cache;
