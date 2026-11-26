// Доход по таблице дропов: шанс × количество × живая цена − расходы, с учётом того, сколько рынок реально купит.
// Общий помощник для боевых методов (слееры, мобы, сундуки данжей и Kuudra); им могут пользоваться и другие категории.
import { sellValue, DEMAND_SHARE } from './flips.js';
import { nameOf } from './util.js';

/** Ниже этого шанса дроп считаем «редким» (удача), выше — «стабильным» доходом. */
export const RARE_CHANCE = 0.05;
/**
 * Дроп, который выпадает реже раза в сутки игры, рынок всегда успеет купить: лимит спроса к нему не применяем,
 * иначе дорогой редкий предмет (Divan's Alloy, Judgement Core) обнулялся бы дневным оборотом.
 */
export const RARE_PER_HOUR = 1 / 24;

/**
 * Цена одной штуки при продаже: Bazaar ордером или аукцион по реальным продажам; в крайнем случае NPC.
 * @returns {{ unit: number, market: string, volumeDay: number, sold24h: number|null, thin: boolean } | null}
 */
export function unitValue(ctx, id) {
  const sv = sellValue(ctx, id, 'offer');
  const npc = Number(ctx.npc?.get(id) || 0);
  if (sv?.net > 0) {
    if (npc > sv.net) return { unit: npc, market: 'NPC', volumeDay: Infinity, sold24h: null, thin: false };
    // на аукционе без единой продажи за сутки цене лота не доверяем полностью
    const thin = sv.market === 'Auction House' && !(sv.sold24h > 0);
    return { unit: thin ? sv.net * 0.7 : sv.net, market: sv.market, volumeDay: sv.volumeDay || 0, sold24h: sv.sold24h ?? null, thin };
  }
  if (npc > 0) return { unit: npc, market: 'NPC', volumeDay: Infinity, sold24h: null, thin: false };
  return null;
}

/** Сколько штук в час рынок реально заберёт у одного игрока по этой цене. */
function demandPerHour(v) {
  if (!v) return 0;
  if (v.market === 'NPC') return Infinity;
  if (v.market === 'Bazaar') return (v.volumeDay * DEMAND_SHARE.bazaar) / 24;
  // аукцион: 15% продаж за сутки, но хотя бы одна штука в сутки (редкий дроп всё равно продашь, просто дольше)
  return Math.max((v.volumeDay || 0) * DEMAND_SHARE.auction, 1) / 24;
}

/** Мгновенная продажа на Bazaar: когда ордеров на продажу больше, чем покупают, остаток сливаем по цене спроса. */
function instantValue(ctx, id) {
  const sv = sellValue(ctx, id, 'instant');
  return sv?.market === 'Bazaar' && sv.net > 0 ? { unit: sv.net, market: 'Bazaar', volumeDay: sv.volumeDay || 0 } : null;
}

/**
 * Доход по списку дропов.
 * @param {import('./flips.js').MarketCtx} ctx
 * @param {{ id: string, qty?: number, chance?: number, name?: string }[]} drops qty — среднее число штук, chance — 0..1
 * @param {{ perHour?: number, cost?: number, magicFind?: number }} [o] perHour — убийств (заходов) в час, cost — расход на одно убийство,
 *   magicFind — повышает шанс редких дропов (меньше 5%) в 1 + MF/100 раз, как в игре
 * @returns {{ perKill: number, steadyPerKill: number, rarePerKill: number, perHour: number, cost: number,
 *   rows: object[], unpriced: string[], capped: string[] }}
 */
export function dropIncome(ctx, drops, o = {}) {
  const perHour = Math.max(0, Number(o.perHour) || 0);
  const cost = Number(o.cost) || 0;
  const mf = Math.max(0, Number(o.magicFind) || 0);
  const rows = [], unpriced = [], capped = [];
  let perKill = 0, steady = 0, rare = 0, hourly = 0;
  for (const d of drops) {
    const base = d.chance ?? 1, qty = d.qty ?? 1;
    if (!(base > 0) || !(qty > 0)) continue;
    const isRare = base < RARE_CHANCE;
    const chance = isRare ? Math.min(1, base * (1 + mf / 100)) : base;
    const v = unitValue(ctx, d.id);
    const known = nameOf(ctx, d.id);
    const name = known && known !== d.id ? known : d.name || d.id;
    if (!v) { unpriced.push(name); continue; }
    const ev = chance * qty * v.unit;
    const want = chance * qty * perHour;
    const can = want <= RARE_PER_HOUR ? Infinity : demandPerHour(v);
    let income = Math.min(want, can) * v.unit;
    let left = Math.max(0, want - can);
    if (left > 0 && v.market === 'Bazaar') {
      // остаток продаём мгновенно, дешевле, пока хватает спроса
      const iv = instantValue(ctx, d.id);
      if (iv) { const n = Math.min(left, (iv.volumeDay * DEMAND_SHARE.bazaar) / 24); income += n * Math.min(iv.unit, v.unit); left -= n; }
    }
    if (left > want * 0.05 && left > 0) capped.push(name);
    perKill += ev;
    if (isRare) rare += ev; else steady += ev;
    hourly += income;
    rows.push({ id: d.id, name, chance, qty, unit: Math.round(v.unit), market: v.market, thin: v.thin, perKill: ev, perHour: income, rare: isRare,
      // раз в сколько часов в среднем выпадает (при заданном темпе)
      everyHours: perHour > 0 && chance > 0 ? 1 / (chance * perHour) : null });
  }
  rows.sort((a, b) => b.perKill - a.perKill);
  return { perKill, steadyPerKill: steady, rarePerKill: rare, perHour: hourly - cost * perHour, cost, rows, unpriced, capped };
}

/**
 * Сколько в среднем выбранного предмета за действие с RNG-метром: 1 / средняя длина цикла (до выпадения или до гарантии).
 * Формула вики (RNG Meter): шанс × (1 + 2 × заполнение), на полной шкале предмет гарантирован; шкала обнуляется, когда он выпал.
 * @param {number} pRoll шанс за бросок без метра
 * @param {number} rolls бросков за действие
 * @param {number} runs действий до полной шкалы
 * @param {number} [done] сколько действий шкала уже накопила
 * @returns {{ perRun: number, natural: number, cycleRuns: number, chanceBefore: number }} chanceBefore — шанс, что выпадет раньше гарантии
 */
export function meterPerRun(pRoll, rolls, runs, done = 0) {
  const n = Math.max(1, Math.round(runs));
  let alive = 1, cycle = 0;
  for (let k = Math.max(0, Math.floor(done)); k < n; k++) {
    cycle += alive;
    const p = Math.min(1, pRoll * (1 + 2 * k / n));
    alive *= Math.pow(1 - p, rolls);
  }
  const natural = 1 - Math.pow(1 - pRoll, rolls);
  return { perRun: 1 / cycle, natural, cycleRuns: cycle, chanceBefore: 1 - alive };
}

/**
 * Лучшая цель RNG-метра среди редких дропов: тот предмет, который сильнее всего поднимает доход за действие.
 * @param {{ id: string, name: string, chance: number, value: number, rare?: boolean }[]} rows chance — шанс за действие (уже с Magic Find), value — сколько приносит одна выпавшая штука,
 *   rare — базовый шанс ниже 5% (если не задано, судим по chance)
 * @param {Record<string, number>} scale очки шкалы по ID предмета (вики)
 * @param {number} xpPerAction сколько очков даёт одно действие (босс, заход)
 * @returns {{ id: string, name: string, xp: number, runs: number, avgRuns: number, natural: number, lift: number } | null} lift — прибавка монет за действие
 */
export function bestMeterTarget(rows, scale, xpPerAction) {
  if (!scale || !(xpPerAction > 0)) return null;
  let best = null;
  for (const r of rows) {
    const xp = scale[r.id];
    // редкость — по базовому шансу (rare), а не по шансу с Magic Find: иначе MF выкидывал бы законные цели метра
    const rare = r.rare ?? r.chance < RARE_CHANCE;
    if (!xp || !(r.chance > 0) || !rare || !(r.value > 0)) continue;
    const runs = xp / xpPerAction;
    const mt = meterPerRun(r.chance, 1, runs);
    const lift = (mt.perRun - mt.natural) * r.value;
    if (lift > 0 && (!best || lift > best.lift)) best = { id: r.id, name: r.name, xp, runs: Math.round(runs), avgRuns: Math.round(mt.cycleRuns), natural: mt.natural, lift };
  }
  return best;
}

/**
 * Ценность сундука данжа: игрок видит содержимое до покупки и открывает, только если выгодно,
 * поэтому каждый предмет даёт шанс × max(0, цена − стоимость открытия).
 * @param {{ id: string, chance: number, cost: number }[]} list
 * @param {number} [extraCost] ещё расход, который платят только при открытии (Dungeon Chest Key для второго сундука)
 * @returns {{ ev: number, rows: object[], unpriced: string[] }}
 */
export function chestValue(ctx, list, extraCost = 0) {
  const rows = [], unpriced = [];
  let ev = 0;
  for (const d of list) {
    const v = unitValue(ctx, d.id);
    const known = nameOf(ctx, d.id);
    const name = known && known !== d.id ? known : d.name || d.id;
    if (!v) { unpriced.push(name); continue; }
    const gain = Math.max(0, v.unit - d.cost - extraCost);
    ev += d.chance * gain;
    if (gain > 0) rows.push({ id: d.id, name, chance: d.chance, unit: Math.round(v.unit), cost: d.cost, perRun: d.chance * gain, thin: v.thin });
  }
  rows.sort((a, b) => b.perRun - a.perRun);
  return { ev, rows, unpriced };
}
