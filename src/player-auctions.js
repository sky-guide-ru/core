// «Мои лоты»: загрузка лотов игрока с Hypixel и сборка ответа для сайта и /v1.
// Один запрос с ключом на игрока не чаще раза в CACHE_MS и только когда блок открыт (без фонового опроса:
// правила Hypixel запрещают постоянно следить за игроками). Ставки берутся из полного скана — без ключа.
import { getPlayerAuctions } from './hypixel.js';
import { prices, bidsOf, auctionItemOf } from './prices.js';
import { myListings, myBids, auctionsSummary } from './market/my-auctions.js';

const CACHE_MS = 3 * 60_000;

/**
 * @param {object} [o] fetch(uuid) → ответ Hypixel, itemOf(item_bytes), bids(uuid), lowestOf(key), clock — подменяются в тестах
 */
export function createPlayerAuctions({
  fetch = getPlayerAuctions, itemOf = auctionItemOf, bids = bidsOf,
  lowestOf = key => prices.bin.get(key) || prices.binVar.get(key) || null, clock = () => Date.now(),
} = {}) {
  const cache = new Map(); // uuid → { at, auctions, error }

  async function raw(uuid) {
    const now = clock();
    const c = cache.get(uuid);
    if (c && now - c.at < CACHE_MS) return c;
    try {
      const d = await fetch(uuid);
      const auctions = [];
      for (const a of d?.auctions || []) {
        if (a.claimed) continue;
        const it = await itemOf(a.item_bytes);
        auctions.push({ ...a, item_bytes: undefined, item_lore: undefined, key: it?.key || null, variant: it?.variant || null, count: it?.count || 1 });
      }
      const e = { at: now, auctions, error: null };
      cache.set(uuid, e);
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return e;
    } catch (err) {
      // Лимит Hypixel или сбой: показываем последнее полученное (если было) и честно пишем, почему не свежее
      if (c) return { ...c, error: err.message || String(err), errorCode: err.code || null };
      throw err;
    }
  }

  /**
   * Лоты и ставки игрока на выбранном профиле.
   * @returns {{ at, listings, bids, summary, error, bazaar: false }}
   */
  async function view({ uuid, profileId = null }) {
    const id = String(uuid || '').replace(/-/g, '').toLowerCase();
    if (!id) return null;
    const r = await raw(id);
    const now = clock();
    const listings = myListings(r.auctions, { uuid: id, profileId, now, lowestOf });
    const bidRows = myBids(bids(id), { profileId, now });
    return {
      at: r.at, error: r.error || null, errorCode: r.errorCode || null,
      scanAt: prices.binAt || null,
      listings, bids: bidRows, summary: auctionsSummary(listings, bidRows),
      // Ордера Bazaar Hypixel API не отдаёт — сайт так и пишет
      bazaar: false,
    };
  }

  return { view, forget: uuid => cache.delete(String(uuid).replace(/-/g, '').toLowerCase()) };
}
