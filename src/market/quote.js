// Две живые цены предмета, «купить» и «продать», одним объектом для всего сайта (карточки, шаги улучшения, списки).
//   Bazaar: купить — Instant Buy (самый дешёвый ордер на продажу), продать — Instant Sell (самый дорогой ордер на покупку),
//           sellNet — после налога Bazaar.
//   AH:     купить — самый дешёвый BIN, продать — медиана настоящих продаж (auctions_ended), но не дороже самого дешёвого лота;
//           если продаж не было — второй по дешевизне лот; sellNet — после комиссий аукциона (ahNet).
// Чистая функция: данные передаются аргументами, состояния нет.
import { ahNet, DEFAULT_BAZAAR_TAX } from './util.js';

/**
 * @typedef {{ market: 'bazaar'|'ah', buy: number, sell: number, sellNet: number, sellFrom?: 'sales'|'cap'|'lots',
 *   lots?: number, sold24?: number, sold7?: number, buyWeek?: number, sellWeek?: number, d1?: number|null, d7?: number|null }} Quote
 */

/**
 * @param {{ bazaar?: any, bin?: any, sold?: any, trend?: any }} src то, что отдаёт priceInfo(id)
 * @param {{ tax?: number }} [opt]
 * @returns {Quote|null}
 */
export function makeQuote(src = {}, opt = {}) {
  const { bazaar: bz, bin, sold, trend } = src;
  // priceTrend отдаёт { from, pct } — нам нужен процент
  const pctOf = v => (v == null ? null : typeof v === 'number' ? v : v.pct ?? null);
  const d1 = pctOf(trend?.d1), d7 = pctOf(trend?.d7);
  if (bz && (bz.buy > 0 || bz.sell > 0)) {
    const tax = opt.tax ?? DEFAULT_BAZAAR_TAX;
    const sell = bz.sell || 0;
    return { market: 'bazaar', buy: bz.buy || 0, sell, sellNet: Math.round(sell * (1 - tax)), buyWeek: bz.buyWeek || 0, sellWeek: bz.sellWeek || 0, d1, d7 };
  }
  const salesOk = sold?.median > 0 && (sold.count7d || 0) >= 1;
  if (bin?.price > 0 || salesOk) {
    // Продажи аукциона смешивают «голые» лоты и улучшенные (Hyperion: медиана 990 млн при лоте от 525 млн),
    // поэтому продать дороже самого дешёвого лота не выйдет — медиану ограничиваем им сверху
    const capped = salesOk && bin?.price > 0 && sold.median > bin.price;
    const sell = salesOk ? (capped ? bin.price : sold.median) : bin?.second || bin?.price || 0;
    return {
      market: 'ah', buy: bin?.price || 0, sell, sellNet: Math.round(ahNet(sell)), sellFrom: salesOk ? (capped ? 'cap' : 'sales') : 'lots',
      lots: bin?.count || 0, sold24: sold?.count24h || 0, sold7: sold?.count7d || 0, d1, d7,
    };
  }
  return null;
}

/** Цена покупки из котировки (0 — купить сейчас негде). */
export const buyOf = q => (q ? q.buy || (q.market === 'ah' ? q.sell : 0) || 0 : 0);
