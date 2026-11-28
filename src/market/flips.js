// Поиск флипов: Bazaar (ордера), NPC, крафт и Forge, недооценённые лоты аукциона.
// Все функции чистые: получают ctx с рыночными данными и возвращают массивы для интерфейса.
import { DEFAULT_BAZAAR_TAX, ahNet, extractRecipes, marketId, crafttextRu, nameOf, median } from './util.js';
import { soldStats } from './auctions.js';
import { trend } from './history.js';
import { categoryOf } from './categories.js';
import { tx } from '../../i18n/msg.js';

/**
 * @typedef {object} MarketCtx
 * @property {Map<string, import('./bazaar.js').BazaarRec>} bazaar
 * @property {Map<string, { price: number, count: number, second?: number, auction?: string, max?: number }>} bin
 * @property {import('./auctions.js').SoldStore} [sold]
 * @property {Record<string, number[][]>} [history]    почасово [ts, buy, sell]
 * @property {Record<string, number[][]>} [binHistory] почасово [ts, price]
 * @property {Map<string, number>} [npc]               цена продажи NPC
 * @property {Map<string, any>} [items]                база NEU
 * @property {number} [tax]                            налог Bazaar (по умолчанию 1.125%)
 * @property {number} [now]
 */

const TICK = 0.1;

/** Манипуляция ценой: текущая цена сильно выше недельной медианы. */
function manipulation(ctx, id, p) {
  const h = ctx.history?.[id];
  if (!h || h.length < 24) return null;
  const tb = trend(h, p.buy, 1, ctx.now);
  const ts = trend(h, p.sell, 2, ctx.now);
  if (tb.median7 && p.buy > tb.median7 * 2) return tx`цена мгновенной покупки в ${(p.buy / tb.median7).toFixed(1)} раза выше медианы за неделю`;
  if (ts.median7 && p.sell > ts.median7 * 2) return tx`цена мгновенной продажи в ${(p.sell / ts.median7).toFixed(1)} раза выше медианы за неделю`;
  return null;
}

function riskOf(weeklyUnits, marginPct, manip) {
  if (manip) return 'высокий';
  if (weeklyUnits < 20_000 || marginPct > 40) return 'высокий';
  if (weeklyUnits < 200_000 || marginPct > 15) return 'средний';
  return 'низкий';
}

/**
 * Обычный спред товара за неделю: медиана почасовых (продажа после налога − покупка).
 * Снимок стакана часто ловит случайный разрыв, который перебьют за минуты; на деле флиппер получает
 * не больше обычного спреда. Нет истории (меньше суток) — null.
 */
function typicalMargin(ctx, id, tax) {
  const h = ctx.history?.[id];
  if (!h || h.length < 24) return null;
  const since = (ctx.now ?? Date.now()) - 7 * 24 * 3600_000;
  const m = h.filter(p => p[0] >= since && p[1] > 0 && p[2] > 0).map(p => p[1] * (1 - tax) - p[2]);
  return m.length >= 24 ? median(m) : null;
}

/** Доля часового оборота, которую реально забрать своими ордерами: осторожно / обычно / удачно. */
export const BAZAAR_SHARE = { low: 0.01, mid: 0.02, high: 0.04 };
/** Сколько часов деньги заморожены в ордерах за один круг (купить → продать). */
const CYCLE_H = 2;

/**
 * Флипы на Bazaar: ставим ордер на покупку чуть выше лучшего, продаём ордером чуть ниже лучшего предложения.
 * Доход в час ограничен тремя вещами: обычным (а не сиюминутным) спредом, долей оборота, которую
 * реально перехватить у конкурентов, и капиталом (деньги заморожены в ордерах ~2 часа за круг).
 * @param {MarketCtx} ctx
 * @param {{ limit?: number, minWeekly?: number, minWeeklyCoins?: number, maxPrice?: number, budget?: number,
 *   share?: number, includeRisky?: boolean }} [opts]
 */
export function bazaarFlips(ctx, opts = {}) {
  const { limit = 40, minWeekly = 2_000, minWeeklyCoins = 200_000_000, maxPrice = Infinity, budget = 50_000_000, share = BAZAAR_SHARE.mid, includeRisky = false } = opts;
  const tax = ctx.tax ?? DEFAULT_BAZAAR_TAX;
  const out = [];
  for (const [id, p] of ctx.bazaar) {
    if (!p.buy || !p.sell || p.buy > maxPrice) continue;
    const weekly = Math.min(p.buyWeek, p.sellWeek);
    if (weekly < minWeekly || weekly * p.sell < minWeeklyCoins) continue;
    const buyAt = p.sell + TICK;
    const sellAt = p.buy - TICK;
    const margin = sellAt * (1 - tax) - buyAt;
    if (margin <= 0) continue;
    const marginPct = margin / buyAt * 100;
    const manip = manipulation(ctx, id, p);
    const risk = riskOf(weekly, marginPct, manip);
    if (!includeRisky && (manip || risk === 'высокий')) continue;
    // обычный спред за неделю: если сейчас разрыв шире, его быстро закроют конкуренты
    const usual = typicalMargin(ctx, id, tax);
    const realMargin = usual != null ? Math.max(0, Math.min(margin, usual)) : margin * 0.7;
    const capUnits = budget / (buyAt * CYCLE_H);
    const units = sh => Math.min(weekly / 168 * sh, capUnits);
    const unitsPerHour = units(share);
    const perHour = realMargin * unitsPerHour;
    if (perHour <= 0) continue;
    out.push({
      id, name: nameOf(ctx, id), category: categoryOf(id, ctx), buyAt, sellAt, margin, marginPct, realMargin, weekly, weeklyCoins: weekly * p.sell, unitsPerHour: Math.floor(unitsPerHour), invest: buyAt * unitsPerHour * CYCLE_H, perHour,
      // осторожно: половина обычного спреда и 1% оборота; удачно: сегодняшний спред и 4% оборота
      perHourLow: realMargin * 0.5 * units(BAZAAR_SHARE.low), perHourHigh: margin * units(BAZAAR_SHARE.high),
      sharePct: share * 100, capitalLimited: capUnits < weekly / 168 * share,
      competition: { buyOrders: p.buyOrders, sellOrders: p.sellOrders }, risk, warning: manip,
      howRu: tx`Ордер на покупку по ${fmt(buyAt)}, затем ордер на продажу по ${fmt(sellAt)}. Прибыль после налога ${fmt(margin)} за штуку`
        + (realMargin < margin * 0.95 ? tx`, но обычно разрыв уже: в среднем ${fmt(realMargin)} за штуку — по нему и считаем доход.` : '.'),
    });
  }
  return out.sort((a, b) => b.perHour - a.perHour).slice(0, limit);
}

/**
 * Перепродажа NPC: покупаем на Bazaar дешевле, чем NPC платит за предмет.
 * @param {MarketCtx} ctx
 */
export function npcFlips(ctx, { limit = 30, mode = 'order', share = 0.05, minProfit = 0.5 } = {}) {
  const out = [];
  if (!ctx.npc) return out;
  for (const [id, p] of ctx.bazaar) {
    const npc = ctx.npc.get(id);
    if (!npc || !p.buy) continue;
    const cost = mode === 'instant' ? p.buy : p.sell + TICK;
    const profit = npc - cost;
    if (profit < minProfit) continue;
    const weekly = mode === 'instant' ? p.buyWeek : p.sellWeek;
    const unitsPerHour = weekly / 168 * share;
    out.push({ id, name: nameOf(ctx, id), cost, npc, profit, pct: profit / cost * 100, unitsPerHour: Math.floor(unitsPerHour), perHour: profit * unitsPerHour, mode });
  }
  return out.sort((a, b) => b.perHour - a.perHour).slice(0, limit);
}

// ---------- оценка покупки и продажи ----------

/**
 * Цена покупки одной штуки на рынке.
 * @param {MarketCtx} ctx @param {string} id id рынка @param {'instant'|'order'} mode
 * @returns {{ price: number, market: 'Bazaar'|'Auction House'|'монеты' } | null}
 */
export function buyPrice(ctx, id, mode = 'instant') {
  if (id === 'SKYBLOCK_COIN') return { price: 1, market: 'монеты' };
  // Профиль без рынка (Ironman, Stranded, Bingo): купить можно только у NPC за монеты
  if (ctx.npcOnly) { const c = ctx.npcBuy?.(id) || 0; return c > 0 ? { price: c, market: 'NPC' } : null; }
  const bz = ctx.bazaar.get(id);
  if (bz && (bz.buy || bz.sell)) {
    const price = mode === 'order' ? (bz.sell ? bz.sell + TICK : bz.buy) : (bz.buy || bz.sell * 1.05);
    return { price, market: 'Bazaar' };
  }
  const b = ctx.bin.get(id);
  if (b?.price) return { price: b.price, market: 'Auction House' };
  return null;
}

/**
 * Сколько чистыми получим за одну штуку при продаже.
 * Bazaar «ордером»: лучшее предложение, но не дороже обычной цены за неделю (одинокий завышенный лот не в счёт).
 * Аукцион: по реальным продажам — не дороже медианы, если продажи есть; без продаж цене самого дешёвого лота не верим.
 * @returns {{ net: number, gross: number, market: string, volumeDay: number, sold24h?: number } | null}
 */
export function sellValue(ctx, id, mode = 'offer') {
  // Профиль без рынка: продать можно только NPC, без налога и без предела по спросу
  if (ctx.npcOnly) { const p = ctx.npc?.get(id) || 0; return p > 0 ? { net: p, gross: p, market: 'NPC', volumeDay: Infinity } : null; }
  const tax = ctx.tax ?? DEFAULT_BAZAAR_TAX;
  const bz = ctx.bazaar.get(id);
  if (bz && (bz.buy || bz.sell)) {
    let gross = mode === 'instant' ? bz.sell : (bz.buy ? bz.buy - TICK : bz.sell);
    const h = ctx.history?.[id];
    if (mode !== 'instant' && h && h.length >= 24) {
      const t = trend(h, gross, 1, ctx.now);
      if (t.median7 && gross > t.median7 * 1.3) gross = Math.max(t.median7, bz.sell || 0);
    }
    const volumeDay = (mode === 'instant' ? bz.sellWeek : bz.buyWeek) / 7;
    return { net: gross * (1 - tax), gross, market: 'Bazaar', volumeDay };
  }
  const b = ctx.bin.get(id);
  if (!b?.price) return null;
  const st = ctx.sold ? soldStats(ctx.sold, id, ctx.now) : null;
  let gross = b.price;
  // продают обычно чуть дешевле самого дешёвого лота и не дороже, чем реально покупали за сутки
  if (st?.median && st.count24h >= 2) gross = Math.min(gross, st.median);
  if (mode === 'instant') gross *= 0.9; // продать быстро — выставить заметно дешевле рынка
  return { net: ahNet(gross), gross, market: 'Auction House', volumeDay: st ? st.count24h : 0, sold: st, sold24h: st?.count24h ?? null, binCount: b.count };
}

/**
 * Минимальная себестоимость предмета: купить или скрафтить из более дешёвых частей (рекурсивно).
 * @returns {{ cost: number, via: 'market'|'craft', market?: string, parts?: object[] } | null}
 */
function bestCost(ctx, id, mode, depth, memo, visiting) {
  const mid = marketId(id, ctx.items);
  const key = mid + '|' + depth;
  if (memo.has(key)) return memo.get(key);
  const market = buyPrice(ctx, mid, mode);
  let best = market ? { cost: market.price, via: 'market', market: market.market } : null;
  if (depth > 0 && !visiting.has(id)) {
    const item = ctx.items?.get(id);
    if (item) {
      visiting.add(id);
      for (const r of extractRecipes(item)) {
        if (r.type !== 'craft') continue;
        const c = recipeCost(ctx, r, mode, depth - 1, memo, visiting);
        if (c && (!best || c.cost / r.count < best.cost * 0.98)) best = { cost: c.cost / r.count, via: 'craft', parts: c.parts };
      }
      visiting.delete(id);
    }
  }
  memo.set(key, best);
  return best;
}

function recipeCost(ctx, r, mode, depth, memo, visiting) {
  let cost = 0;
  const parts = [];
  for (const [id, n] of Object.entries(r.inputs)) {
    const c = bestCost(ctx, id, mode, depth, memo, visiting);
    if (!c) return null;
    cost += c.cost * n;
    parts.push({ id: marketId(id, ctx.items), name: nameOf(ctx, id), n, unit: c.cost, via: c.via, market: c.market || null });
  }
  return { cost, parts };
}

/** Какую долю дневного спроса реально занять своим товаром: Bazaar — 3% оборота, аукцион — 15% продаж. */
export const DEMAND_SHARE = { bazaar: 0.03, auction: 0.15 };
/** Маржа выше этого — почти всегда ошибка цены (устаревший лот, пустой стакан), а не находка. */
export const SUSPICIOUS_PCT = 150;

/**
 * Крафт-флипы и Forge-флипы по рецептам NEU.
 * Доход в час ограничен спросом: сколько штук в день реально продать (а не сколько можно скрафтить),
 * объёмом ингредиентов на Bazaar и капиталом (budget). Предметы аукциона без реальных продаж не берём.
 * @param {MarketCtx} ctx
 * @param {{ limit?: number, buyMode?: 'instant'|'order', sellMode?: 'offer'|'instant', depth?: number,
 *   minProfit?: number, minPct?: number, minVolumeDay?: number, minSoldDay?: number, includeForge?: boolean, forgeOnly?: boolean,
 *   quickForge?: number, share?: number, budget?: number, maxCost?: number, skipSuspicious?: boolean }} [opts]
 *   depth — сколько уровней промежуточных крафтов разрешено (0 = всё покупаем); quickForge — ускорение Forge (0..0.3, перк HotM Quick Forge);
 *   minSoldDay — сколько продаж в сутки нужно предмету аукциона; maxCost — дороже этого крафт не предлагаем
 */
export function craftFlips(ctx, opts = {}) {
  const { limit = 40, buyMode = 'instant', sellMode = 'offer', depth = 1, minProfit = 10_000, minPct = 5, minVolumeDay = 50, minSoldDay = 2,
    includeForge = true, forgeOnly = false, quickForge = 0, share = DEMAND_SHARE.bazaar, budget = Infinity, maxCost = Infinity, skipSuspicious = false } = opts;
  if (!ctx.items) return [];
  const memo = new Map();
  const out = [];
  for (const item of ctx.items.values()) {
    for (const r of extractRecipes(item)) {
      if (r.type === 'forge' ? !includeForge : forgeOnly) continue;
      // у Forge без длительности доход в час не посчитать (раньше брали 1 минуту — отсюда «миллиарды в час»)
      if (r.type === 'forge' && !(r.duration > 0)) continue;
      const outId = marketId(r.output, ctx.items);
      const sell = sellValue(ctx, outId, sellMode);
      if (!sell) continue;
      const ah = sell.market !== 'Bazaar';
      if (!ah && sell.volumeDay < minVolumeDay) continue;
      // аукцион: нужны реальные продажи; без данных о продажах (первые минуты после запуска) — хотя бы несколько лотов
      if (ah && (ctx.sold ? (sell.sold24h || 0) < minSoldDay : (sell.binCount || 0) < 3)) continue;
      const c = recipeCost(ctx, r, buyMode, depth, memo, new Set([item.id]));
      if (!c || !c.cost || c.cost > maxCost) continue;
      const revenue = sell.net * r.count;
      const profit = revenue - c.cost;
      const pct = profit / c.cost * 100;
      if (profit < minProfit || pct < minPct) continue;
      // осторожный вариант: продать сразу (в ордер на покупку / дешевле рынка)
      const low = sellMode === 'instant' ? sell : sellValue(ctx, outId, 'instant');
      const profitLow = low ? low.net * r.count - c.cost : 0;
      // спрос: сколько штук этого предмета в день реально продать
      const salesDay = ah ? (ctx.sold ? sell.sold24h || 0 : 1) : sell.volumeDay;
      const demandDay = salesDay * (ah ? DEMAND_SHARE.auction : share) / r.count;
      const suspicious = pct > SUSPICIOUS_PCT;
      // для советов отсекаем до обрезки по limit, иначе подозрительные займут весь список
      if (suspicious && skipSuspicious) continue;
      const row = {
        id: outId, name: nameOf(ctx, outId), category: categoryOf(outId, ctx), kind: r.type === 'forge' ? 'forge' : 'craft', count: r.count,
        cost: c.cost, sell: revenue, profit, profitLow, pct, market: sell.market, volumeDay: Math.round(sell.volumeDay || 0),
        demandDay: Math.round(demandDay * 10) / 10, suspicious,
        ingredients: Object.fromEntries(c.parts.map(p => [p.id, p.n])), parts: c.parts,
        subCrafts: c.parts.filter(p => p.via === 'craft').map(p => p.id),
        req: crafttextRu(item.crafttext), crafttext: item.crafttext || '',
        hotm: Number(String(item.crafttext || '').match(/HotM\s+(\d+)/i)?.[1] || 0), // уровень HotM для колонки в «Заработке»
      };
      // ингредиенты тоже надо купить: не больше той же доли часового оборота каждого из них на Bazaar
      let ingCap = Infinity;
      for (const part of c.parts) {
        const bz = ctx.bazaar.get(part.id);
        if (bz?.buyWeek) ingCap = Math.min(ingCap, (bz.buyWeek / 168 * share) / part.n);
      }
      if (r.type === 'forge') {
        const hours = Math.max(r.duration * (1 - quickForge), 60) / 3600;
        row.durationH = Math.round(hours * 100) / 100;
        row.perHour = profit / hours; // доход на один слот Forge
        row.perHourLow = Math.max(0, profitLow) / hours;
        // сколько слотов имеет смысл занять этим рецептом, чтобы успевать продавать результат
        row.maxSlots = Math.max(0, Math.min(demandDay, ingCap * 24) * hours / 24);
        // доход в час для таблицы: если спроса не хватает даже на один слот, слот простаивает
        row.slotFill = Math.min(1, row.maxSlots);
      } else {
        const rate = Math.min(demandDay / 24, ingCap, budget / c.cost, 200);
        row.craftsPerHour = rate;
        row.perHour = profit * rate;
        row.perHourLow = Math.max(0, profitLow) * rate * 0.5;
      }
      const warns = [];
      if (ah) warns.push('Цена на аукционе взята по реальным продажам за сутки. Проверь, что твой предмет такой же: звёзды, чары и перековка (reforge) здесь не учитываются.');
      if (suspicious) warns.push(tx`Маржа ${Math.round(pct)}% подозрительно высокая: скорее всего, цена устарела или рынок почти пустой. Проверь стакан перед покупкой.`);
      if (demandDay < 1) warns.push(tx`Спрос маленький: реально продать около ${demandDay < 0.1 ? 'одной штуки в 10+ дней' : tx`${Math.round(demandDay * 10) / 10} шт. в день`}.`);
      row.warning = warns.length ? warns.join(' ') : null;
      out.push(row);
    }
  }
  const sortKey = forgeOnly ? 'perHour' : 'profit';
  return out.sort((a, b) => b[sortKey] - a[sortKey]).slice(0, limit);
}

/** Только Forge, отсортировано по доходу в час на слот. */
export function forgeFlips(ctx, opts = {}) {
  return craftFlips(ctx, { minVolumeDay: 5, minProfit: 50_000, ...opts, forgeOnly: true, includeForge: true });
}

/**
 * Раскладка рецептов по слотам Forge с учётом спроса: в один рецепт не кладём больше слотов,
 * чем успеешь продать. Возвращает доход в час на все слоты и что куда положить.
 * @param {object[]} list результат forgeFlips (по убыванию perHour)
 * @param {number} slots
 */
export function planForge(list, slots) {
  let left = slots, mid = 0, low = 0;
  const used = [];
  for (const f of list) {
    if (left <= 0) break;
    if (f.suspicious) continue;
    const n = Math.min(left, f.maxSlots ?? left);
    if (n <= 0.05) continue;
    mid += f.perHour * n;
    low += (f.perHourLow ?? 0) * n;
    left -= n;
    used.push({ ...f, slots: Math.round(n * 10) / 10 });
  }
  return { perHour: mid, perHourLow: low, used, idle: Math.max(0, left) };
}

/**
 * Недооценённые лоты аукциона (снимок последнего скана, лоты быстро выкупают).
 * Сравнивает самый дешёвый лот со вторым по цене и с медианой реальных продаж.
 */
export function binSnipes(ctx, { limit = 30, minProfit = 500_000, maxPrice = Infinity, minSoldDay = 3 } = {}) {
  const out = [];
  for (const [id, b] of ctx.bin) {
    if (!b.second || b.price > maxPrice || /;\d$/.test(id)) continue; // питомцы зависят от уровня — пропускаем
    const st = ctx.sold ? soldStats(ctx.sold, id, ctx.now) : null;
    if (!st || st.count24h < minSoldDay) continue;
    const fair = Math.min(b.second, st.median);
    const profit = ahNet(fair) - b.price;
    if (profit < minProfit || b.price > fair * 0.9) continue;
    out.push({ id, name: nameOf(ctx, id), category: categoryOf(id, ctx), price: b.price, second: b.second, median: st.median, sold24h: st.count24h, profit, pct: profit / b.price * 100, auction: b.auction, command: b.auction ? tx`/viewauction ${b.auction}` : null });
  }
  return out.sort((a, b) => b.profit - a.profit).slice(0, limit);
}

function fmt(n) {
  return n >= 1000 ? Math.round(n).toLocaleString('ru-RU') : (Math.round(n * 10) / 10).toLocaleString('ru-RU');
}
