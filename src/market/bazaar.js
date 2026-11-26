// Разбор ответа /v2/skyblock/bazaar
/**
 * @typedef {{ buy: number, sell: number, buyVol: number, sellVol: number, buyWeek: number, sellWeek: number,
 *   buyOrders: number, sellOrders: number, buyAvg: number, sellAvg: number }} BazaarRec
 * buy  — цена мгновенной покупки (лучший ордер на продажу, первая запись buy_summary);
 * sell — цена мгновенной продажи (лучший ордер на покупку, первая запись sell_summary).
 * buyAvg/sellAvg — средневзвешенные цены из quick_status (топ-2% стакана), устойчивее к одиночным ордерам.
 */

/**
 * @param {any} json ответ Hypixel
 * @returns {Map<string, BazaarRec>}
 */
export function parseBazaar(json) {
  const out = new Map();
  for (const [id, p] of Object.entries(json?.products || {})) {
    const q = p.quick_status || {};
    // В API Hypixel buy_summary — ордера на продажу (по ним мы мгновенно покупаем), sell_summary — ордера на покупку
    const buy = p.buy_summary?.[0]?.pricePerUnit ?? q.buyPrice ?? 0;
    const sell = p.sell_summary?.[0]?.pricePerUnit ?? q.sellPrice ?? 0;
    out.set(id, {
      buy: buy || 0,
      sell: sell || 0,
      buyVol: q.buyVolume || 0,
      sellVol: q.sellVolume || 0,
      buyWeek: q.buyMovingWeek || 0,
      sellWeek: q.sellMovingWeek || 0,
      buyOrders: q.buyOrders || 0,
      sellOrders: q.sellOrders || 0,
      buyAvg: q.buyPrice || buy || 0,
      sellAvg: q.sellPrice || sell || 0,
    });
  }
  return out;
}
