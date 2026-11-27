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

/**
 * Цена покупки сейчас для «Как получить» и дерева ингредиентов: Bazaar (мгновенно и через заказ) или аукцион.
 * На аукционе — самый дешёвый BIN; если BIN-лотов сейчас нет, но за неделю были продажи — медиана продаж
 * с пометкой noLots (вещь покупается, просто лот надо подождать). Вместе с ценой — цена продажи (sell, sellNet после налога).
 * @param {{ bazaar?: Map, bin?: Map, sold?: any }} prices
 * @param {{ soldStats?: Function }} [opt] soldStats из market/auctions.js
 * @returns {(id: string) => ({ price: number, market: 'bazaar'|'ah', order?: number|null, count?: number|null, noLots?: boolean,
 *   sell: number, sellNet: number, sellFrom?: 'sales'|'cap'|'lots'|null, sold7?: number }|null)}
 */
export function makeBuy(prices, { soldStats } = {}) {
  return id => {
    const ids = [id];
    const m = /^([A-Z0-9_]+);(\d+)$/.exec(id);
    if (m) ids.push(`ENCHANTMENT_${m[1]}_${m[2]}`);
    for (const k of ids) {
      const bz = prices.bazaar?.get?.(k);
      if (bz && bz.buy > 0) return { price: bz.buy, order: bz.sell > 0 ? bz.sell : null, market: 'bazaar', sell: bz.sell || 0, sellNet: Math.round((bz.sell || 0) * (1 - DEFAULT_BAZAAR_TAX)) };
    }
    for (const k of ids) {
      const b = prices.bin?.get?.(k);
      const st = prices.sold && soldStats ? soldStats(prices.sold, k) : null;
      const salesOk = st?.median > 0 && st.count7d >= 1;
      if (b && b.price > 0) {
        const capped = salesOk && st.median > b.price; // в продажах есть улучшенные экземпляры — дороже лота не продать
        const sell = salesOk ? Math.min(st.median, b.price) : b.second || 0;
        return { price: b.price, count: b.count || null, market: 'ah', sell, sellNet: Math.round(ahNet(sell)), sellFrom: salesOk ? (capped ? 'cap' : 'sales') : sell ? 'lots' : null, sold7: st?.count7d || 0 };
      }
      // BIN-лотов сейчас нет (их раскупили), но вещь продаётся: цена — по недавним продажам
      if (salesOk) return { price: st.median, count: 0, noLots: true, market: 'ah', sell: st.median, sellNet: Math.round(ahNet(st.median)), sellFrom: 'sales', sold7: st.count7d };
    }
    return null;
  };
}
