// Перепродажа и улучшение: комбинирование книг на наковальне, звёзды Essence / Master Stars / Recombobulator.
// Чистые функции от контекста рынка (MarketCtx из flips.js) — без сети и состояния.
import { ahNet, nameOf, DEFAULT_BAZAAR_TAX } from './util.js';
import { soldStats } from './auctions.js';
import { sellValue, DEMAND_SHARE, SUSPICIOUS_PCT } from './flips.js';
import { tx } from '../../i18n/msg.js';

const TICK = 0.1;

// ---------- варианты предмета на аукционе ----------
/**
 * Ключ варианта для сравнения «голый» ↔ улучшенный: ID@<звёзды><r — с Recombobulator>[+s<число свитков Necron's Blade>].
 * Пишем только 0, 5 и 10 звёзд — промежуточные почти не продаются и только шумят.
 * Питомцы, книги и руны пропускаем: у них свои ключи.
 * @param {{ id?: string|null, pet?: any, stars?: number, recomb?: boolean }} item нормализованный предмет (nbt.js)
 * @returns {string|null}
 */
export function variantKey(item) {
  const id = item?.id;
  if (!id || item.pet || /;\d+$/.test(id) || id === 'ENCHANTED_BOOK' || /RUNE$/.test(id)) return null;
  const s = Number(item.stars || 0);
  if (s !== 0 && s !== 5 && s !== 10) return null;
  // Свитки Necron's Blade (Implosion, Shadow Warp, Wither Shield) стоят сотни миллионов: предметы с ними и без не сравнимы
  const scrolls = (item.upgrades || []).filter(u => u.kind === 'scroll' && /_(IMPLOSION|SHADOW_WARP|WITHER_SHIELD)_SCROLL$|^(IMPLOSION|SHADOW_WARP|WITHER_SHIELD)_SCROLL$/.test(u.id)).length;
  return tx`${id}@${s}${item.recomb ? 'r' : ''}${scrolls ? tx`+s${scrolls}` : ''}`;
}

// ---------- комбинирование книг ----------
// Две одинаковые книги на наковальне дают книгу на уровень выше, но не выше «крафтового» максимума.
// Для обычных чар это максимум стола зачарования (Sharpness V, Looting III): уровни выше выпадают только с мобов,
// Experimentation Table или Dark Auction, и две Sharpness VI не дают VII (вики: «Enchanted Book», «Enchantments»).
// Ультимативные чары (Chimera, Legion, Wisdom…) собираются из I до V. Комбинирование книг бесплатное.
const EXTRA_CAP = { blessing: 5, cayenne: 5, big_brain: 5 };

/** Наибольший уровень, до которого чару можно собрать из книг, или 0 — нельзя. */
export function combineCap(name, constants) {
  const ench = constants?.enchants || {};
  const n = String(name).toLowerCase();
  if (n.startsWith('ultimate_')) {
    const base = n.slice(9);
    const xp = ench.enchants_xp_cost?.[base] || ench.enchants_xp_cost?.[n];
    return xp ? Math.min(xp.length, 5) : 5;
  }
  if (/^turbo_/.test(n)) return 5;
  return ench.max_xp_table_levels?.[n] ?? EXTRA_CAP[n] ?? 0;
}

/**
 * Выгодные сборки книг: купить 2^(L−k) книг уровня k на Bazaar, собрать уровень L и продать.
 * Спрос: 3% дневного оборота готовой книги; закупка — не больше 3% часового оборота исходной.
 * @param {import('./flips.js').MarketCtx & { constants?: any }} ctx
 * @param {{ limit?: number, budget?: number, minProfit?: number, share?: number }} [opts]
 */
export function bookCombos(ctx, opts = {}) {
  const { limit = 30, budget = Infinity, minProfit = 50_000, share = DEMAND_SHARE.bazaar } = opts;
  const tax = ctx.tax ?? DEFAULT_BAZAAR_TAX;
  const books = new Map(); // name -> Map(level -> rec)
  for (const [id, rec] of ctx.bazaar) {
    const mm = /^ENCHANTMENT_(.+)_(\d+)$/.exec(id);
    if (!mm) continue;
    if (!books.has(mm[1])) books.set(mm[1], new Map());
    books.get(mm[1]).set(Number(mm[2]), rec);
  }
  const out = [];
  for (const [name, levels] of books) {
    const cap = combineCap(name, ctx.constants);
    if (cap < 2) continue;
    for (const [L] of levels) {
      if (L < 2 || L > cap) continue;
      const outId = tx`ENCHANTMENT_${name}_${L}`;
      const sell = sellValue(ctx, outId, 'offer');
      if (!sell?.net || sell.volumeDay < 1) continue;
      let best = null;
      for (let k = L - 1; k >= 1; k--) {
        const src = levels.get(k);
        if (!src?.buy) continue;
        const n = 2 ** (L - k);
        const cost = src.buy * n;
        if (cost > budget) continue; // не по карману целиком — дробную сборку не сделать
        const profit = sell.net - cost;
        if (!best || profit > best.profit) best = { k, n, src, cost, profit };
      }
      if (!best || best.profit < minProfit) continue;
      const pct = best.profit / best.cost * 100;
      if (pct > SUSPICIOUS_PCT) continue; // такую маржу почти всегда даёт пустой стакан или устаревшая цена
      // осторожно: продать сразу в ордер на покупку, исходные книги взять своим ордером
      const bz = ctx.bazaar.get(outId);
      const profitLow = (bz.sell || 0) * (1 - tax) - (best.src.sell ? (best.src.sell + TICK) * best.n : best.cost);
      const demandDay = sell.volumeDay * share;
      const supplyHour = (best.src.buyWeek || 0) / 168 * share / best.n;
      const rate = Math.min(demandDay / 24, supplyHour || Infinity, budget / best.cost, 60);
      const srcId = tx`ENCHANTMENT_${name}_${best.k}`;
      out.push({
        id: outId, name: nameOf(ctx, outId), from: srcId, fromName: nameOf(ctx, srcId), books: best.n, combines: best.n - 1,
        cost: best.cost, sell: sell.net, profit: best.profit, profitLow, pct, demandDay: Math.round(demandDay * 10) / 10,
        perHour: best.profit * rate, perHourLow: Math.max(0, Math.min(best.profit, profitLow)) * rate * 0.5,
      });
    }
  }
  return out.sort((a, b) => b.perHour - a.perHour).slice(0, limit);
}

// ---------- звёзды, Master Stars, Recombobulator ----------
const MASTER = ['FIRST_MASTER_STAR', 'SECOND_MASTER_STAR', 'THIRD_MASTER_STAR', 'FOURTH_MASTER_STAR', 'FIFTH_MASTER_STAR'];
const priceBz = (ctx, id) => { const b = ctx.bazaar.get(id); return b ? (b.buy || b.sell * 1.05 || 0) : 0; };
/** Цена покупки части улучшения: Bazaar, иначе самый дешёвый лот аукциона. */
const partPrice = (ctx, id) => priceBz(ctx, id) || ctx.bin.get(id)?.price || 0;

/**
 * Сколько стоит поднять звёзды с from до to (по живым ценам эссенции и Master Stars).
 * Звёзды 1–5 (и до 10 у предметов Crimson Isle) — за Essence; 6–10 у предметов данжей — Master Stars.
 * @returns {{ cost: number, essence: number, essenceId: string|null, master: number } | null} null — так поднять нельзя
 */
export function starCost(ctx, id, from, to) {
  const ec = ctx.constants?.essencecosts?.[id];
  if (!ec) return null;
  const essenceId = ec.type ? tx`ESSENCE_${String(ec.type).toUpperCase()}` : null;
  const essPrice = essenceId ? priceBz(ctx, essenceId) : 0;
  let cost = 0, essence = 0, master = 0;
  for (let lvl = from + 1; lvl <= to; lvl++) {
    if (ec[lvl] != null) {
      if (!essPrice) return null;
      essence += Number(ec[lvl]);
      cost += Number(ec[lvl]) * essPrice;
      for (const s of ec.items?.[lvl] || []) {
        const [pid, n] = String(s).split(':');
        if (pid === 'SKYBLOCK_COIN') { cost += Number(n || 0); continue; }
        const p = partPrice(ctx, pid);
        if (!p) return null;
        cost += p * Number(n || 1);
      }
    } else if (lvl >= 6 && lvl <= 10 && ec[5] != null && String(ec.type).toLowerCase() !== 'crimson') {
      const p = priceBz(ctx, MASTER[lvl - 6]);
      if (!p) return null;
      cost += p; master++;
    } else return null;
  }
  return { cost, essence, essenceId, master };
}

/** Цена продажи варианта на аукционе: не дороже медианы реальных продаж; нужно 2+ продажи в сутки. */
function variantSell(ctx, key) {
  const b = ctx.binVar?.get(key);
  const st = ctx.sold ? soldStats(ctx.sold, key, ctx.now) : null;
  if (!st || st.count24h < 2 || !st.median) return null;
  const gross = b?.price ? Math.min(b.price, st.median) : st.median;
  return { gross, net: ahNet(gross), sold24h: st.count24h };
}

/**
 * Купить предмет на аукционе, улучшить и продать дороже суммы.
 * Переходы: 0 → 5 звёзд (Essence), 5 → 10 (Master Stars), 0 → 10, и любой из них + Recombobulator.
 * Сравниваем только одинаковые варианты (с Recombobulator или без); чары, Hot Potato Book и перековку не различаем —
 * поэтому цена продажи берётся по медиане реальных продаж, а не по самому дорогому лоту.
 * @param {import('./flips.js').MarketCtx & { binVar?: Map<string, {price:number,count:number}>, constants?: any }} ctx
 * @param {{ limit?: number, budget?: number, minProfit?: number }} [opts]
 */
export function upgradeFlips(ctx, opts = {}) {
  const { limit = 30, budget = Infinity, minProfit = 300_000 } = opts;
  if (!ctx.binVar?.size) return [];
  const recomb = partPrice(ctx, 'RECOMBOBULATOR_3000');
  const bases = new Set();
  // Варианты со свитками (+s) не трогаем: улучшаем только предметы без свитков и сравниваем с такими же
  for (const key of ctx.binVar.keys()) if (!key.includes('+')) bases.add(key.slice(0, key.indexOf('@')));
  const out = [];
  for (const id of bases) {
    const tries = [];
    for (const r of ['', 'r']) {
      tries.push([0, 5, r, r], [5, 10, r, r], [0, 10, r, r]);
    }
    for (const s of [0, 5, 10]) tries.push([s, s, '', 'r']);
    for (const [from, to, rf, rt] of tries) {
      const fromKey = tx`${id}@${from}${rf}`, toKey = tx`${id}@${to}${rt}`;
      const lot = ctx.binVar.get(fromKey);
      if (!lot?.price) continue;
      const sell = variantSell(ctx, toKey);
      if (!sell) continue;
      let up = 0, essence = 0, essenceId = null, master = 0;
      if (to > from) {
        const sc = starCost(ctx, id, from, to);
        if (!sc) continue;
        ({ essence, essenceId, master } = sc);
        up += sc.cost;
      }
      if (rt && !rf) { if (!recomb) continue; up += recomb; }
      const cost = lot.price + up;
      if (cost > budget) continue;
      const profit = sell.net - cost;
      if (profit < minProfit) continue;
      const pct = profit / cost * 100;
      if (pct > SUSPICIOUS_PCT) continue;
      const profitLow = ahNet(sell.gross * 0.9) - cost;
      const demandDay = sell.sold24h * DEMAND_SHARE.auction;
      const rate = Math.min(demandDay / 24, budget / cost);
      const what = [to > from ? (from < 5 && to > 5 ? tx`${to - from} звёзд (5 за эссенцию и ${master} Master Stars)` : master ? tx`${master} Master Stars` : tx`${to - from} звёзд за эссенцию`) : null, rt && !rf ? 'Recombobulator' : null].filter(Boolean).join(' + ');
      out.push({
        id, name: nameOf(ctx, id), from: fromKey, to: toKey, fromStars: from, toStars: to, recomb: !!(rt && !rf),
        what, buy: lot.price, upgrade: up, essence, essenceId, master, cost, sell: sell.net, sold24h: sell.sold24h,
        profit, profitLow, pct, demandDay: Math.round(demandDay * 10) / 10,
        perHour: profit * rate, perHourLow: Math.max(0, profitLow) * rate * 0.5,
      });
    }
  }
  // Один и тот же спрос на улучшенный вариант не делим между несколькими путями (0→10 и 5→10): берём лучший путь
  const best = new Map();
  for (const f of out) if (!best.has(f.to) || best.get(f.to).perHour < f.perHour) best.set(f.to, f);
  return [...best.values()].sort((a, b) => b.perHour - a.perHour).slice(0, limit);
}
