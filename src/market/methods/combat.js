// Боевые методы заработка: слееры, данжи, Kuudra, фарм мобов.
// Доход считается по таблицам дропа с вики (data/combat-loot.json) и живым ценам: шанс × количество × цена − расходы.
// Темп (боссов, заходов, убийств в час) — оценка для уверенной экипировки, это единственное допущение в расчёте.
import { createRequire } from 'node:module';
import { dropIncome, chestValue, unitValue, RARE_CHANCE, bestMeterTarget } from '../drop-income.js';
import { buyPrice } from '../flips.js';
import { nameOf } from '../util.js';
import { tx } from '../../../i18n/msg.js';

const require = createRequire(import.meta.url);
export const LOOT = require('../data/combat-loot.json');
// Шкалы RNG-метра с вики (RNG Meter/UI/Slayer, RNG Meter/UI/Catacombs) по ID предмета
export const METERS = require('../data/rng-meters.json');
/** Slayer XP за босса по тиру (вики): шкалу метра заполняют только T3 и выше. */
export const SLAYER_XP = [0, 5, 25, 100, 500, 1500];
/** Dungeon Score за заход S+ (вики: S+ — от 300 очков; S даёт метру только 70%). */
export const DUNGEON_SCORE = 300;

const M = 1_000_000;
const lvl = o => Number(o?.level || 0);
const skill = (m, k) => lvl(m?.skills?.[k]);
const slayerLvl = (m, k) => lvl(m?.slayers?.[k]);
const cata = m => lvl(m?.dungeons?.catacombs);
const hotm = m => lvl(m?.mining?.hotm);
const fmtN = n => Number(n || 0).toLocaleString('ru-RU');
const raz = n => (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'раза' : 'раз');
const fmtC = n => {
  const a = Math.abs(n);
  if (a >= M) return tx`${(n / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
  if (a >= 1000) return tx`${Math.round(n / 1000).toLocaleString('ru-RU')} тыс.`;
  return Math.round(n).toLocaleString('ru-RU');
};
const pct = c => tx`${(c * 100).toLocaleString('ru-RU', { maximumFractionDigits: c < 0.001 ? 3 : 2 })}%`;
const need = (label, cur, min, extra = {}) => ({ text: tx`${label} ${min}+`, ok: cur >= min, have: tx`у тебя ${fmtN(cur)}`, ...extra });
const ROM = ['', 'I', 'II', 'III', 'IV', 'V'];

function ownedIds(m) {
  const set = new Set();
  const walk = v => {
    if (!v) return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (typeof v === 'object') { if (typeof v.id === 'string') { set.add(v.id); return; } for (const x of Object.values(v)) walk(x); }
  };
  for (const k of ['inventory', 'armor', 'equipment', 'wardrobe', 'enderChest', 'vault', 'backpacks']) walk(m?.inv?.[k]);
  return set;
}
const hasAny = (m, ids) => { const s = ownedIds(m); return ids.some(p => (p.startsWith('*') ? [...s].some(x => x.endsWith(p.slice(1))) : s.has(p))); };

// ---------------- слееры ----------------

/**
 * Темп: боссов в час [осторожно, хорошо] вместе с призывом босса. Оценка для уверенной экипировки под тир.
 * from — какой слеер и тир нужно убить, чтобы открыть T1 (по вики).
 */
const SLAYERS = {
  zombie: { boss: 'Revenant Horror', label: 'Zombie Slayer', place: 'склепы Graveyard в Hub', rate: [null, [80, 120], [60, 90], [45, 70], [35, 55], [20, 35]], from: null, t5: 7 },
  spider: { boss: 'Tarantula Broodfather', label: 'Spider Slayer', place: 'Spider\'s Den', rate: [null, [70, 100], [55, 80], [40, 60], [30, 45], [15, 25]], from: ['zombie', 2], t5: 7 },
  wolf: { boss: 'Sven Packmaster', label: 'Wolf Slayer', place: 'Howling Cave в The Park', rate: [null, [70, 100], [55, 80], [40, 60], [30, 45]], from: ['spider', 2] },
  enderman: { boss: 'Voidgloom Seraph', label: 'Enderman Slayer', place: 'Void Sepulture в The End', rate: [null, [60, 90], [45, 65], [30, 45], [18, 30]], from: ['wolf', 4] },
  blaze: { boss: 'Inferno Demonlord', label: 'Blaze Slayer', place: 'Smoldering Tomb на Crimson Isle', rate: [null, [35, 50], [20, 30], [12, 20], [8, 14]], from: ['enderman', 3] },
};
// Если в профиле нет счётчика убийств по тирам: какой уровень слеера почти наверняка значит, что тир уже убит
const KILLED_BY_LEVEL = [0, 1, 2, 3, 4, 7];
// Magic Find в боевой экипировке [осторожно, хорошо]: в API профиля его нет, поэтому берём типичный диапазон
export const MF_RANGE = [60, 200];
const mfRange = o => (o?.magicFind != null ? [o.magicFind, o.magicFind] : MF_RANGE);

/** Убит ли тир t (1–5) этого слеера. */
export function slayerKilled(m, key, t) {
  const s = m?.slayers?.[key];
  const k = s?.kills;
  if (k && typeof k === 'object' && Object.keys(k).length) return Number(k[t] || 0) > 0 || [t + 1, t + 2, t + 3].some(x => Number(k[x] || 0) > 0);
  return lvl(s) >= KILLED_BY_LEVEL[t];
}

/** Открыт ли тир t: убит предыдущий (T1 — по цепочке слееров), для T5 нужен ещё 7 уровень. */
export function slayerTierOpen(m, key, t) {
  const def = SLAYERS[key];
  if (t === 1) return !def.from || slayerKilled(m, def.from[0], def.from[1]);
  if (t === 5 && def.t5 && slayerLvl(m, key) < def.t5) return false;
  return slayerKilled(m, key, t - 1);
}

/** Доход по каждому тиру слеера при текущих ценах. Учтены только дропы, открытые уровнем игрока. */
export function slayerTiers(ctx, m, key, o = {}) {
  const def = SLAYERS[key];
  const data = LOOT.slayers[key];
  const level = slayerLvl(m, key);
  const out = [];
  for (let t = 1; t <= data.cost.length; t++) {
    const drops = data.drops.filter(d => d.chance[t - 1] != null && d.qty[t - 1] != null && d.lvl <= level)
      .map(d => ({ id: d.id, name: d.name, qty: d.qty[t - 1], chance: d.chance[t - 1] }));
    const locked = data.drops.filter(d => d.chance[t - 1] != null && d.lvl > level).map(d => ({ name: d.name, id: d.id, lvl: d.lvl }));
    const [lo, hi] = def.rate[t];
    const [mfLo, mfHi] = mfRange(o);
    const a = dropIncome(ctx, drops, { perHour: lo, cost: data.cost[t - 1], magicFind: mfLo });
    const b = dropIncome(ctx, drops, { perHour: hi, cost: data.cost[t - 1], magicFind: mfHi });
    // RNG-метр: с T3 каждый босс добавляет Slayer XP в шкалу выбранного предмета (вики). Берём самую выгодную цель.
    const asMeter = r => ({ id: r.id, name: r.name, chance: Math.min(1, r.chance), value: r.unit * r.qty, rare: r.rare });
    const ma = t >= 3 ? bestMeterTarget(a.rows.map(asMeter), METERS.slayer[key], SLAYER_XP[t]) : null;
    const mb = ma ? bestMeterTarget(b.rows.filter(r => r.id === ma.id).map(asMeter), METERS.slayer[key], SLAYER_XP[t]) : null;
    const meter = ma ? { ...ma, lift: [ma.lift, mb?.lift ?? ma.lift] } : null;
    out.push({ tier: t, open: slayerTierOpen(m, key, t), cost: data.cost[t - 1], rate: [lo, hi], mf: [mfLo, mfHi],
      low: a.perHour + (meter ? meter.lift[0] * lo : 0), high: b.perHour + (meter ? meter.lift[1] * hi : 0),
      steady: a.steadyPerKill, rare: [a.rarePerKill, b.rarePerKill], rows: b.rows, unpriced: a.unpriced, capped: b.capped, locked, priced: a.rows.length, meter });
  }
  return out;
}

function slayerCompute(key) {
  return (ctx, m, o) => {
    const def = SLAYERS[key];
    const tiers = slayerTiers(ctx, m, key, o).filter(t => t.priced && t.tier >= 2);
    if (!tiers.length) return null;
    const mid = t => (t.low + t.high) / 2;
    const open = tiers.filter(t => t.open);
    const best = (open.length ? open : tiers).reduce((a, b) => (mid(b) > mid(a) ? b : a));
    const top = best.rows.filter(r => r.perHour > 0).slice(0, 5);
    const lockedRich = best.locked.length ? tx` Пока не падают (нужен уровень слеера выше): ${best.locked.slice(0, 3).map(x => tx`${nameOf(ctx, x.id) || x.name} (${x.lvl})`).join(', ')}.` : '';
    const others = tiers.filter(t => t !== best).map(t => tx`T${t.tier} ≈ ${fmtC(mid(t))}/ч${t.open ? '' : ' (закрыт)'}`).join(', ');
    return {
      coinsPerHour: Math.round(mid(best)), range: [Math.round(best.low), Math.round(best.high)],
      detail: tx`${open.includes(best) ? 'Выгоднее всего для тебя' : 'Цель'}: ${def.boss} T${best.tier}. С одного босса стабильно ${fmtC(best.steady)} (частые дропы) и ещё ${fmtC(best.rare[0])}–${fmtC(best.rare[1])} в среднем с редких дропов, то есть удача. Квест у Maddox стоит ${fmtC(best.cost)}, он уже вычтен. Темп ${fmtN(best.rate[0])}–${fmtN(best.rate[1])} боссов в час — оценка для хорошей экипировки. Шансы редких дропов с вики умножены на Magic Find ${best.mf[0] === best.mf[1] ? best.mf[0] : tx`${best.mf[0]}–${best.mf[1]}`} (в профиле его не видно).${best.meter ? tx` RNG-метр (${fmtN(SLAYER_XP[best.tier])} Slayer XP за босса T${best.tier}) выгоднее всего ставить на ${nameOf(ctx, best.meter.id) || best.meter.name}: шкала ${fmtN(best.meter.xp)} очков — это ${fmtN(best.meter.runs)} боссов; с ним предмет выходит в среднем за ${fmtN(best.meter.avgRuns)} вместо ${fmtN(Math.round(1 / best.meter.natural))} боссов и добавляет ≈${fmtC(best.meter.lift[0])}–${fmtC(best.meter.lift[1])} за босса (уже в доходе).` : best.tier < 3 ? ' RNG-метр заполняют только боссы T3 и выше.' : ''}${lockedRich}${others ? tx` Другие тиры: ${others}.` : ''}`,
      top: top.map(r => ({ id: r.id, name: r.name, perHour: Math.round(r.perHour) })),
      breakdown: best.rows.slice(0, 12).map(r => ({ id: r.id, name: r.name, chance: r.chance, qty: r.qty, unit: r.unit, perKill: Math.round(r.perKill), perHour: Math.round(r.perHour), everyHours: r.everyHours, rare: r.rare })),
    };
  };
}

function slayerReq(key, minTier) {
  return m => {
    const def = SLAYERS[key];
    const reqs = [];
    if (def.from) reqs.push({ text: tx`Убит ${SLAYERS[def.from[0]].boss} T${def.from[1]} (открывает слеер)`, ok: slayerTierOpen(m, key, 1), have: slayerTierOpen(m, key, 1) ? 'да' : 'ещё нет' });
    const open = [5, 4, 3, 2, 1].find(t => SLAYERS[key].rate[t] && slayerTierOpen(m, key, t)) || 0;
    reqs.push({ text: tx`Открыт ${def.boss} T${minTier} или выше`, ok: open >= minTier, have: open ? tx`открыт до T${open}` : 'не открыт' });
    reqs.push({ text: tx`${def.label}: уровень для дорогих дропов`, ok: slayerLvl(m, key) >= 7, soft: true, have: tx`у тебя ${slayerLvl(m, key)}` });
    return reqs;
  };
}

// ---------------- данжи ----------------

// Минимальный уровень Catacombs для входа на этаж
const FLOOR_CATA = { F1: 0, F2: 1, F3: 3, F4: 5, F5: 9, F6: 14, F7: 20, M1: 24, M2: 26, M3: 28, M4: 30, M5: 32, M6: 34, M7: 36 };
// Заходов в час [осторожно, хорошо] с ожиданием группы
const FLOOR_RATE = { F1: [8, 12], F2: [8, 12], F3: [7, 11], F4: [6, 9], F5: [6, 8], F6: [5, 7], F7: [4, 6], M1: [8, 11], M2: [7, 10], M3: [6, 9], M4: [6, 9], M5: [5, 7], M6: [4.5, 6.5], M7: [3.5, 5] };
const floorRuns = (m, f) => Number((f[0] === 'M' ? m?.dungeons?.masterFloors : m?.dungeons?.floors)?.[f.slice(1)] || 0);

/** Открыт ли этаж: уровень Catacombs и пройден предыдущий (для M1 — F7). */
export function floorOpen(m, f) {
  if (cata(m) < FLOOR_CATA[f]) return false;
  const n = Number(f.slice(1));
  // уровень Catacombs для следующего этажа почти наверняка значит, что этот уже открыт (для F7 такого признака нет)
  if (f[0] === 'F') return n === 1 || floorRuns(m, tx`F${n - 1}`) > 0 || floorRuns(m, f) > 0 || (n < 7 && cata(m) >= FLOOR_CATA[tx`F${n + 1}`]);
  return (n === 1 ? floorRuns(m, 'F7') > 0 : floorRuns(m, tx`M${n - 1}`) > 0) || floorRuns(m, f) > 0;
}

/** Ценность одного захода на этаж: лучший сундук (Bedrock, иначе Obsidian) и второй — за Dungeon Chest Key. */
export function floorValue(ctx, f) {
  const chests = LOOT.dungeons[f];
  if (!chests) return null;
  const main = chests.Bedrock ? 'Bedrock' : 'Obsidian';
  const a = chestValue(ctx, chests[main]);
  const key = buyPrice(ctx, 'DUNGEON_CHEST_KEY')?.price || 0;
  // ключ тратят, только когда в сундуке предмет дороже открытия и ключа вместе
  const second = main === 'Bedrock' && key ? chestValue(ctx, chests.Obsidian, key) : null;
  const extra = second ? second.ev : 0;
  // RNG-метр Catacombs: каждый заход S+ добавляет Dungeon Score в шкалу выбранного предмета этажа (вики), выпадает он в сундуке
  const meter = bestMeterTarget(a.rows.map(r => ({ id: r.id, name: r.name, chance: r.chance, value: r.unit - r.cost })), METERS.catacombs[f], DUNGEON_SCORE);
  const lift = meter?.lift || 0;
  return { floor: f, main, low: a.ev + lift, high: a.ev + extra + lift, rows: a.rows, unpriced: a.unpriced, key, secondEv: second?.ev || 0, meter };
}

function dungeonCompute(floors) {
  return (ctx, m) => {
    const vals = floors.map(f => ({ ...floorValue(ctx, f), open: floorOpen(m, f), rate: FLOOR_RATE[f] })).filter(v => v.main && (v.low > 0 || v.rows.length));
    if (!vals.length) return null;
    const ph = v => [v.low * v.rate[0], v.high * v.rate[1]];
    const mid = v => (ph(v)[0] + ph(v)[1]) / 2;
    const open = vals.filter(v => v.open);
    const best = (open.length ? open : vals).reduce((a, b) => (mid(b) > mid(a) ? b : a));
    const [lo, hi] = ph(best);
    const top = best.rows.slice(0, 5);
    const others = vals.filter(v => v !== best).map(v => tx`${v.floor} ≈ ${fmtC(mid(v))}/ч${v.open ? '' : ' (закрыт)'}`).join(', ');
    return {
      coinsPerHour: Math.round((lo + hi) / 2), range: [Math.round(lo), Math.round(hi)],
      detail: tx`${open.includes(best) ? 'Выгоднее всего для тебя' : 'Цель'}: ${best.floor}. Сундук ${best.main} на S+ в среднем приносит ${fmtC(best.low)} за заход: считаем, что ты открываешь его, только если предмет дороже цены открытия.${best.high > best.low ? tx` Второй сундук (Obsidian) за Dungeon Chest Key (${fmtC(best.key)}) добавляет ещё до ${fmtC(best.high - best.low).replace(/\.$/, '')}.` : ''} Самое ценное: ${top.map(r => tx`${r.name} (${pct(r.chance)}, ${fmtC(r.unit)})`).join(', ') || 'нет выгодных предметов'}. Темп ${fmtN(best.rate[0])}–${fmtN(best.rate[1])} заходов в час с быстрой группой. ${best.meter ? tx`RNG-метр (≈${fmtN(DUNGEON_SCORE)} очков Dungeon Score за S+) выгоднее всего ставить на ${best.meter.name}: шкала ${fmtN(best.meter.xp)} очков — это ${fmtN(best.meter.runs)} заходов; с ним предмет выходит в среднем за ${fmtN(best.meter.avgRuns)} вместо ${fmtN(Math.round(1 / best.meter.natural))} заходов и добавляет ≈${fmtC(best.meter.lift)} за заход (уже в доходе). ` : ''}Essence и бесплатный сундук не учтены, Kismet Feather и Boss Luck повышают доход.${others ? tx` Другие этажи: ${others}.` : ''}`,
      top: top.map(r => ({ id: r.id, name: r.name, perHour: Math.round(r.perRun * best.rate[0]) })),
      breakdown: best.rows.slice(0, 12).map(r => ({ id: r.id, name: r.name, chance: r.chance, unit: r.unit, cost: r.cost, perKill: Math.round(r.perRun),
        perHour: Math.round(r.perRun * best.rate[0]), everyHours: r.chance > 0 ? 1 / (r.chance * best.rate[0]) : null, rare: r.chance < RARE_CHANCE })),
    };
  };
}

// ---------------- Kuudra ----------------

const KUUDRA_RATE = { basic: [10, 14], hot: [9, 12], burning: [7, 10], fiery: [6, 8], infernal: [4.5, 6.5] };
const KUUDRA_REP = { basic: 0, hot: 1000, burning: 3000, fiery: 7000, infernal: 12000 };
const KUUDRA_PREV = { hot: 'basic', burning: 'hot', fiery: 'burning', infernal: 'fiery' };
const KUUDRA_NAME = { basic: 'Basic', hot: 'Hot', burning: 'Burning', fiery: 'Fiery', infernal: 'Infernal' };
// Ключ у эмиссара фракции: монеты + Enchanted Red Sand (или Enchanted Mycelium) + 2 Nether Star
// (вики: это звёзды с Vanquisher, их Bazaar-ID — CORRUPTED_NETHER_STAR, а не ванильная NETHER_STAR)
const KUUDRA_KEY = { basic: [200_000, 2], hot: [400_000, 6], burning: [750_000, 20], fiery: [1_500_000, 60], infernal: [3_000_000, 120] };
const ARMOR_SETS = ['AURORA', 'CRIMSON', 'FERVOR', 'HOLLOW', 'TERROR'];
const ARMOR_PARTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const kuudraRuns = (m, t) => Number(m?.crimson?.kuudra?.[t] || 0);
const crimsonRep = m => Math.max(Number(m?.crimson?.barbarianRep || 0), Number(m?.crimson?.mageRep || 0));

export function kuudraKeyCost(ctx, tier) {
  const [coins, sand] = KUUDRA_KEY[tier];
  const mat = Math.min(...['ENCHANTED_RED_SAND', 'ENCHANTED_MYCELIUM'].map(id => buyPrice(ctx, id)?.price || Infinity));
  const star = buyPrice(ctx, 'CORRUPTED_NETHER_STAR')?.price || 0;
  return coins + (Number.isFinite(mat) ? mat * sand : 0) + star * 2;
}

/** Ценность платного сундука Kuudra за вычетом ключа. */
export function kuudraValue(ctx, tier) {
  const data = LOOT.kuudra[tier];
  const drops = [];
  for (const d of data.drops) {
    if (d.armor) {
      // Броня из сундука приходит без звёзд и хороших атрибутов: цены лотов высоких тиров — это прокачанные вещи.
      // Поэтому оцениваем её по цене базовой брони (без тира), так доход не раздувается.
      for (const s of ARMOR_SETS) for (const p of ARMOR_PARTS) drops.push({ id: tx`${s}_${p}`, name: tx`${s}_${p}`, qty: 1, chance: d.chance });
    } else drops.push({ id: d.id, name: d.name, qty: d.qty, chance: d.chance });
  }
  const key = kuudraKeyCost(ctx, tier);
  const [a, b] = KUUDRA_RATE[tier];
  // доход в час — с потолком спроса на каждом темпе; ключ тратится на каждый заход
  const lo = dropIncome(ctx, drops, { perHour: a, cost: key });
  const hi = dropIncome(ctx, drops, { perHour: b, cost: key });
  return { tier, chest: lo.perKill, key, net: lo.perKill - key, low: lo.perHour, high: hi.perHour, capped: hi.capped, rows: lo.rows, unpriced: lo.unpriced, priced: lo.rows.length };
}

function kuudraCompute(tier) {
  return ctx => {
    const v = kuudraValue(ctx, tier);
    if (!v.priced) return null;
    const [a, b] = KUUDRA_RATE[tier];
    const top = v.rows.filter(r => r.perKill > 0).slice(0, 5);
    return {
      coinsPerHour: Math.round((v.low + v.high) / 2), range: [Math.round(v.low), Math.round(v.high)],
      detail: tx`Платный сундук Kuudra ${KUUDRA_NAME[tier]} в среднем стоит ${fmtC(v.chest)}, ключ обходится в ${fmtC(v.key)} (монеты эмиссару + материалы по ценам Bazaar), чистыми ${fmtC(v.net)} за заход. Больше всего дают: ${top.map(r => tx`${r.name} (${pct(r.chance)})`).join(', ')}. Темп ${fmtN(a)}–${fmtN(b)} заходов в час с сыгранной группой. ${v.capped.length ? tx`Рынок не заберёт всё сразу (${v.capped.join(', ')}): лишнее в доход в час не входит. ` : ''}Kismet Feather для перекрутки и бесплатный сундук не учтены; броня посчитана по цене обычной брони без тира и атрибутов, как она и выпадает.`,
      top: top.map(r => ({ id: r.id, name: r.name, perHour: Math.round(r.perKill * a) })),
      breakdown: v.rows.slice(0, 12).map(r => ({ id: r.id, name: r.name, chance: r.chance, qty: r.qty, unit: r.unit, perKill: Math.round(r.perKill), perHour: Math.round(r.perHour), everyHours: r.everyHours, rare: r.rare })),
    };
  };
}

function kuudraReq(tier) {
  return m => {
    const reqs = [];
    if (tier === 'basic') reqs.push(need('Combat', skill(m, 'combat'), 24, { text: 'Combat 24+ (вход на Crimson Isle)' }));
    else {
      reqs.push({ text: tx`Репутация фракции ${fmtN(KUUDRA_REP[tier])}+`, ok: crimsonRep(m) >= KUUDRA_REP[tier] || kuudraRuns(m, tier) > 0, have: tx`у тебя ${fmtN(crimsonRep(m))}` });
      const prev = KUUDRA_PREV[tier];
      reqs.push({ text: tx`Пройден Kuudra ${KUUDRA_NAME[prev]}`, ok: kuudraRuns(m, prev) > 0 || kuudraRuns(m, tier) > 0, have: kuudraRuns(m, prev) > 0 ? tx`пройден ${fmtN(kuudraRuns(m, prev))} ${raz(kuudraRuns(m, prev))}` : 'ещё не пройден' });
    }
    if (tier !== 'basic' && tier !== 'hot') {
      const want = tier === 'burning' ? ['*AURORA_CHESTPLATE', '*TERROR_CHESTPLATE', '*CRIMSON_CHESTPLATE', '*FERVOR_CHESTPLATE', '*HOLLOW_CHESTPLATE']
        : ['FIERY_TERROR_CHESTPLATE', 'INFERNAL_TERROR_CHESTPLATE', 'FIERY_AURORA_CHESTPLATE', 'INFERNAL_AURORA_CHESTPLATE', 'FIERY_CRIMSON_CHESTPLATE', 'INFERNAL_CRIMSON_CHESTPLATE'];
      reqs.push({ text: tier === 'burning' ? 'Броня Crimson Isle (Aurora/Terror/Crimson)' : 'Броня Kuudra тира Fiery/Infernal', ok: hasAny(m, want), soft: true, buy: tier === 'burning' ? ['AURORA_CHESTPLATE', 'TERROR_CHESTPLATE'] : ['FIERY_TERROR_CHESTPLATE', 'FIERY_AURORA_CHESTPLATE'] });
    }
    return reqs;
  };
}

// ---------------- фарм мобов ----------------

const MOBS = {
  zealot: { rate: [500, 900], coins: 15 },
  ghost: { rate: [300, 600], coins: 0, mf: true },
  automaton: { rate: [150, 300], coins: 10, mf: true },
};

function mobCompute(key, extra = '') {
  return (ctx, m, o) => {
    const def = MOBS[key];
    const [lo, hi] = def.rate;
    const [mfLo, mfHi] = def.mf ? mfRange(o) : [0, 0];
    const a = dropIncome(ctx, LOOT.mobs[key], { perHour: lo, cost: -def.coins, magicFind: mfLo });
    const b = dropIncome(ctx, LOOT.mobs[key], { perHour: hi, cost: -def.coins, magicFind: mfHi });
    if (!a.rows.length) return null;
    const top = b.rows.slice(0, 5);
    return {
      coinsPerHour: Math.round((a.perHour + b.perHour) / 2), range: [Math.round(a.perHour), Math.round(b.perHour)],
      detail: tx`С одного моба в среднем ${fmtC(a.perKill + def.coins)}: частые дропы ${fmtC(a.steadyPerKill + def.coins)}, редкие ${fmtC(a.rarePerKill)}${def.mf ? tx`–${fmtC(b.rarePerKill)} (Magic Find ${mfLo}–${mfHi})` : ''}. Темп ${fmtN(lo)}–${fmtN(hi)} убийств в час. Самое ценное: ${top.map(r => tx`${r.name} (${pct(r.chance)}, ${fmtC(r.unit)})`).join(', ')}.${b.capped.length ? tx` Рынок не заберёт всё сразу: ${b.capped.join(', ')}, продавай частями.` : ''} ${extra}`.trim(),
      top: top.map(r => ({ id: r.id, name: r.name, perHour: Math.round(r.perHour) })),
      breakdown: b.rows.slice(0, 12).map(r => ({ id: r.id, name: r.name, chance: r.chance, qty: r.qty, unit: r.unit, perKill: Math.round(r.perKill), perHour: Math.round(r.perHour), everyHours: r.everyHours, rare: r.rare })),
    };
  };
}

// ---------------- каталог ----------------

const slayerDrops = key => LOOT.slayers[key].drops.filter(d => d.lvl >= 5).sort((a, b) => b.lvl - a.lvl).slice(0, 5).map(d => d.id);

export const COMBAT_METHODS = [
  {
    id: 'slayer-zombie', title: 'Revenant Horror (Zombie Slayer)', tag: 'Slayers', mode: 'active',
    desc: 'Бьёшь зомби в склепах Graveyard, пока не появится босс. Revenant Flesh и Foul Flesh дают стабильный доход, Scythe Blade, Shard of the Shredded и Warden Heart — редкая удача. Сайт сам выбирает самый выгодный открытый тир.',
    req: slayerReq('zombie', 3), compute: slayerCompute('zombie'), drops: slayerDrops('zombie'),
  },
  {
    id: 'slayer-spider', title: 'Tarantula Broodfather (Spider Slayer)', tag: 'Slayers', mode: 'active',
    desc: 'Пауки в Spider\'s Den. Tarantula Web и Toxic Arrow Poison продаются всегда, T5 даёт Tarantula Silk; редкие Digested Mosquito, Shriveled Wasp и Primordial Eye.',
    req: slayerReq('spider', 3), compute: slayerCompute('spider'), drops: slayerDrops('spider'),
  },
  {
    id: 'slayer-wolf', title: 'Sven Packmaster (Wolf Slayer)', tag: 'Slayers', mode: 'active',
    desc: 'Волки в Howling Cave. Деньги средние: Wolf Tooth и Hamster Wheel, редко Overflux Capacitor и Red Claw Egg. Главная польза — уровни Wolf Slayer для экипировки.',
    req: slayerReq('wolf', 3), compute: slayerCompute('wolf'), drops: slayerDrops('wolf'),
  },
  {
    id: 'slayer-enderman', title: 'Voidgloom Seraph (Enderman Slayer)', tag: 'Slayers', mode: 'active',
    desc: 'Эндермены в Void Sepulture. Null Sphere и Null Atom стабильно, Summoning Eye, Pocket Espresso Machine и Judgement Core — редкие дропы.',
    req: m => [...slayerReq('enderman', 3)(m),
      { text: 'Оружие против эндерменов (Atomsplit/Vorpal Katana, Terminator, Hyperion)', ok: hasAny(m, ['ATOMSPLIT_KATANA', 'VORPAL_KATANA', 'TERMINATOR', 'HYPERION', 'JUJU_SHORTBOW']), soft: true, buy: ['ATOMSPLIT_KATANA', 'JUJU_SHORTBOW'] }],
    compute: slayerCompute('enderman'), drops: slayerDrops('enderman'),
  },
  {
    id: 'slayer-blaze', title: 'Inferno Demonlord (Blaze Slayer)', tag: 'Slayers', mode: 'active',
    desc: 'Блейзы на Crimson Isle. Derelict Ashe и дистилляты стабильно, Archfiend Dice, книги Duplex и Fire Aspect, High Class Archfiend Dice — редкие. Нужны кинжалы Blaze Slayer и броня Crimson Isle.',
    req: m => [...slayerReq('blaze', 2)(m),
      { text: 'Броня Crimson Isle (Crimson/Aurora/Terror/Fervor/Hollow)', ok: hasAny(m, ['*CRIMSON_CHESTPLATE', '*AURORA_CHESTPLATE', '*TERROR_CHESTPLATE', '*FERVOR_CHESTPLATE', '*HOLLOW_CHESTPLATE']), soft: true, buy: ['CRIMSON_CHESTPLATE', 'AURORA_CHESTPLATE'] }],
    compute: slayerCompute('blaze'), drops: slayerDrops('blaze'),
  },
  {
    id: 'dungeon-f1-f4', title: 'Catacombs F1–F4', tag: 'Dungeons', mode: 'active',
    desc: 'Первые этажи: Hot Potato Book, Necromancer\'s Brooch, Bonzo\'s Staff, Spirit Wing и Spirit Bow. Денег немного, зато быстро растёт Catacombs.',
    req: m => [need('Catacombs', cata(m), 0, { text: 'Catacombs (вход на F1 открыт всем)' })], compute: dungeonCompute(['F1', 'F2', 'F3', 'F4']),
    drops: ['SPIRIT_WING', 'BONZO_STAFF', 'RECOMBOBULATOR_3000', 'HOT_POTATO_BOOK'],
  },
  {
    id: 'dungeon-f5-f6', title: 'Catacombs F5–F6', tag: 'Dungeons', mode: 'active',
    desc: 'Появляется сундук Bedrock: Shadow Assassin, Livid Dagger, Shadow Fury, Necromancer Lord, Giant\'s Sword, книги Ultimate Wise и Last Stand.',
    req: m => [need('Catacombs', cata(m), 9), { text: 'Пройден F4', ok: floorRuns(m, 'F4') > 0 || floorRuns(m, 'F5') > 0 || cata(m) >= 14, have: floorRuns(m, 'F4') > 0 ? 'да' : 'не видно в профиле' }],
    compute: dungeonCompute(['F5', 'F6']), drops: ['SHADOW_FURY', 'GIANTS_SWORD', 'LIVID_DAGGER', 'SHADOW_ASSASSIN_CHESTPLATE'],
  },
  {
    id: 'dungeon-f7', title: 'Catacombs F7', tag: 'Dungeons', mode: 'active',
    desc: 'Сундуки F7: Necron\'s Handle, свитки Implosion, Shadow Warp и Wither Shield, Wither-броня, Auto Recombobulator. Ступень к Master Mode.',
    req: m => [{ text: 'F7 открыт (Catacombs 20+, пройден F6)', ok: floorOpen(m, 'F7'), have: tx`Catacombs ${cata(m)}` }, need('Catacombs', cata(m), 24, { soft: true, text: 'Catacombs 24+ (комфортно)' })],
    compute: dungeonCompute(['F7']), drops: ['NECRON_HANDLE', 'IMPLOSION_SCROLL', 'SHADOW_WARP_SCROLL', 'WITHER_SHIELD_SCROLL', 'AUTO_RECOMBOBULATOR'],
  },
  {
    id: 'dungeon-m1-m3', title: 'Master Mode M1–M3', tag: 'Dungeons', mode: 'active',
    desc: 'Recombobulator, много опыта Catacombs и First Master Star (падает только на M3). Быстрые заходы.',
    req: m => [{ text: 'F7 пройден', ok: floorRuns(m, 'F7') > 0, have: floorRuns(m, 'F7') > 0 ? tx`пройден ${fmtN(floorRuns(m, 'F7'))} ${raz(floorRuns(m, 'F7'))}` : 'ещё не пройден' }, { text: 'Catacombs 24+ (M1), 28+ (M3)', ok: cata(m) >= 24, have: tx`у тебя ${cata(m)}` }],
    compute: dungeonCompute(['M1', 'M2', 'M3']), drops: ['FIRST_MASTER_STAR', 'RECOMBOBULATOR_3000', 'FUMING_POTATO_BOOK'],
  },
  {
    id: 'dungeon-m4-m6', title: 'Master Mode M4–M6', tag: 'Dungeons', mode: 'active',
    desc: 'Second, Third и Fourth Master Star, Spirit Wing, Shadow Fury, Giant\'s Sword, Summoning Ring. Нужна топовая экипировка и команда.',
    req: m => [{ text: 'Catacombs 30+ (M4), 34+ (M6)', ok: cata(m) >= 30, have: tx`у тебя ${cata(m)}` }, { text: 'Пройден M3', ok: floorRuns(m, 'M3') > 0, have: floorRuns(m, 'M3') > 0 ? 'да' : 'ещё не пройден' },
      { text: 'Оружие для данжей (Terminator, Hyperion/Astraea, Giant\'s Sword)', ok: hasAny(m, ['TERMINATOR', 'HYPERION', 'ASTRAEA', 'VALKYRIE', 'SCYLLA', 'GIANTS_SWORD']), soft: true, buy: ['TERMINATOR', 'HYPERION'] }],
    compute: dungeonCompute(['M4', 'M5', 'M6']), drops: ['FOURTH_MASTER_STAR', 'GIANTS_SWORD', 'SHADOW_FURY', 'SECOND_MASTER_STAR'],
  },
  {
    id: 'dungeon-m7', title: 'Master Mode M7', tag: 'Dungeons', mode: 'active',
    desc: 'Самый дорогой этаж: Dark Claymore, Necron\'s Handle, Fifth Master Star, свитки и Wither-броня.',
    req: m => [need('Catacombs', cata(m), 36), { text: 'Пройден M6', ok: floorRuns(m, 'M6') > 0, have: floorRuns(m, 'M6') > 0 ? 'да' : 'ещё не пройден' },
      { text: 'Necron/Storm/Goldor/Maxor броня', ok: hasAny(m, ['POWER_WITHER_CHESTPLATE', 'WISE_WITHER_CHESTPLATE', 'TANK_WITHER_CHESTPLATE', 'SPEED_WITHER_CHESTPLATE']), soft: true, buy: ['POWER_WITHER_CHESTPLATE'] }],
    compute: dungeonCompute(['M7']), drops: ['DARK_CLAYMORE', 'NECRON_HANDLE', 'FIFTH_MASTER_STAR', 'IMPLOSION_SCROLL'],
  },
  ...['basic', 'hot', 'burning', 'fiery', 'infernal'].map(t => ({
    id: tx`kuudra-${t}`, title: tx`Kuudra ${KUUDRA_NAME[t]}`, tag: 'Crimson Isle', mode: 'active',
    desc: {
      basic: 'Первый тир Kuudra: Kuudra Teeth, эссенция Crimson, осколки Kraken и книги маны. Ступень к Hot.',
      hot: 'Kuudra Teeth, эссенция Crimson, осколки Bezal и Magma Slug, иногда Wheel of Fate. Ступень к Burning.',
      burning: 'Появляются Burning Kuudra Core и Mandraa, больше осколков и Wheel of Fate. Нужна броня Crimson Isle.',
      fiery: 'Heavy Pearl, большие пачки эссенции и зубов, дорогие осколки. Нужна броня Kuudra тира Fiery.',
      infernal: 'Главный денежный тир: Burning Kuudra Core, Tormentor, Hellstorm Wand, редкие осколки вроде Ananke. Нужна сыгранная команда.',
    }[t],
    req: kuudraReq(t), compute: kuudraCompute(t),
    drops: { basic: ['KUUDRA_TEETH', 'ESSENCE_CRIMSON', 'SHARD_KRAKEN'], hot: ['KUUDRA_TEETH', 'WHEEL_OF_FATE', 'SHARD_BEZAL'], burning: ['BURNING_KUUDRA_CORE', 'WHEEL_OF_FATE', 'MANDRAA'], fiery: ['BURNING_KUUDRA_CORE', 'HEAVY_PEARL', 'WHEEL_OF_FATE'], infernal: ['BURNING_KUUDRA_CORE', 'TORMENTOR', 'HELLSTORM_STAFF', 'WHEEL_OF_FATE'] }[t],
  })),
  {
    id: 'mobs-zealot', title: 'Фарм Zealot в The End', tag: 'Мобы', mode: 'active',
    desc: 'Zealot в Dragon\'s Nest: Ender Pearl с каждого, а примерно один из 420 — Special Zealot с гарантированным Summoning Eye.',
    req: m => [need('Combat', skill(m, 'combat'), 12, { text: 'Combat 12+ (вход в The End)' }),
      { text: 'Оружие по площади (Juju Shortbow, Terminator, Hyperion)', ok: hasAny(m, ['JUJU_SHORTBOW', 'TERMINATOR', 'HYPERION', 'ASTRAEA', 'VALKYRIE', 'SCYLLA']), soft: true, buy: ['JUJU_SHORTBOW'] }],
    compute: mobCompute('zealot', 'Шанс Special Zealot около 1 из 420, питомец Ender Dragon и Zealot-бонусы не учтены.'),
    drops: ['SUMMONING_EYE', 'ENCHANTED_ENDER_PEARL'],
  },
  {
    id: 'mobs-ghost', title: 'Фарм Ghost в Dwarven Mines', tag: 'Мобы', mode: 'active',
    desc: 'Призраки в The Mist (Dwarven Mines): редкие Sorrow, Volta, Plasma и Ghostly Boots. Почти весь доход — удача, зато много опыта Combat.',
    req: m => [need('HotM', hotm(m), 1, { text: 'Доступ в Dwarven Mines' }),
      { text: 'Оружие по площади (Hyperion, Terminator, Livid Dagger)', ok: hasAny(m, ['HYPERION', 'ASTRAEA', 'VALKYRIE', 'SCYLLA', 'TERMINATOR', 'LIVID_DAGGER']), soft: true, buy: ['LIVID_DAGGER'] }],
    compute: mobCompute('ghost', 'Призраки невидимы и бьют сильно: нужна защита и ночное зрение или скин, который их подсвечивает.'),
    drops: ['SORROW', 'VOLTA', 'PLASMA', 'GHOST_BOOTS'],
  },
  {
    id: 'mobs-automaton', title: 'Фарм Automaton в Crystal Hollows', tag: 'Мобы', mode: 'active',
    desc: 'Роботы в Precursor Remnants: Rough Sapphire с каждого и детали Precursor (Synthetic Heart, Control Switch и др.), которые нужны для Divan Drill и Ingot.',
    req: m => [need('HotM', hotm(m), 3, { text: 'HotM 3+ (вход в Crystal Hollows)' })],
    compute: mobCompute('automaton', 'Пропуск в Crystal Hollows платный, его стоимость не вычтена.'),
    drops: ['SYNTHETIC_HEART', 'CONTROL_SWITCH', 'ELECTRON_TRANSMITTER', 'FTX_3070'],
  },
];

// ---------------- разбор методов ----------------

const SLAYER_RISKS = ['Большая часть дохода с высоких тиров — редкие дропы, то есть удача. Цифра — среднее за долгий срок.', 'Квест у Maddox платный, проваленный квест — чистый минус.'];
const slayerSteps = (boss, place, sell) => [
  tx`Возьми квест «${boss}» у Maddox (в таверне Hub или через Maddox Batphone). Тир сайт подсказывает в расчёте.`,
  tx`Иди в ${place} и бей обычных мобов, пока не появится босс.`,
  'Включи RNG-метр на самый дорогой дроп: каждый босс T3+ приближает его гарантированное выпадение.',
  sell,
];

export const COMBAT_DETAILS = {
  'slayer-zombie': { effort: 'focus', risk: 'low', xp: 'Опыт Zombie Slayer и Combat',
    steps: slayerSteps('Revenant Horror', SLAYERS.zombie.place, 'Revenant Flesh, Foul Flesh и Revenant Viscera продавай на Bazaar, редкие дропы на аукционе.'),
    risks: [...SLAYER_RISKS, 'T5 (Atoned Horror) не получает урон от способностей и сильно бьёт: нужны защита и лечение.'] },
  'slayer-spider': { effort: 'focus', risk: 'low', xp: 'Опыт Spider Slayer и Combat',
    steps: slayerSteps('Tarantula Broodfather', SLAYERS.spider.place, 'Tarantula Web, Toxic Arrow Poison и Tarantula Silk продавай на Bazaar, редкие дропы на аукционе.'), risks: SLAYER_RISKS },
  'slayer-wolf': { effort: 'focus', risk: 'low', xp: 'Опыт Wolf Slayer и Combat',
    steps: slayerSteps('Sven Packmaster', SLAYERS.wolf.place, 'Wolf Tooth и Hamster Wheel продавай на Bazaar, Overflux Capacitor и Red Claw Egg на аукционе.'),
    risks: [...SLAYER_RISKS, 'Доход низкий: метод больше ради уровней Wolf Slayer.'] },
  'slayer-enderman': { effort: 'focus', risk: 'mid', xp: 'Опыт Enderman Slayer и Combat',
    steps: [...slayerSteps('Voidgloom Seraph', SLAYERS.enderman.place, 'Null Sphere, Null Atom и книги продавай на Bazaar, Judgement Core и Pocket Espresso Machine на аукционе.').slice(0, 2),
      'Сбей щит ударами, затем наноси урон. Брошенный маяк ломай за 5 секунд, иначе умрёшь.',
      ...slayerSteps('', '', 'Null Sphere, Null Atom и книги продавай на Bazaar, Judgement Core и Pocket Espresso Machine на аукционе.').slice(2)],
    risks: [...SLAYER_RISKS, 'Без хорошего оружия и брони T4 убивает.'] },
  'slayer-blaze': { effort: 'focus', risk: 'high', xp: 'Опыт Blaze Slayer и Combat',
    steps: [...slayerSteps('Inferno Demonlord', SLAYERS.blaze.place, 'Derelict Ashe и дистилляты продавай на Bazaar, Archfiend Dice и книги на Bazaar или аукционе.').slice(0, 2),
      'Меняй настройку кинжала (Firedust, Kindlebane и др.) под цвет щита босса.',
      ...slayerSteps('', '', 'Derelict Ashe и дистилляты продавай на Bazaar, Archfiend Dice и книги на Bazaar или аукционе.').slice(2)],
    risks: [...SLAYER_RISKS, 'Самый сложный слеер: без кинжалов и брони Crimson Isle T3–T4 не пройти.', 'Броски Archfiend Dice — лотерея, их в расчёте нет.'] },
};
const DUNGEON_STEPS = floors => [
  'Собери группу через Party Finder (/pf) под свой класс.',
  tx`Проходи ${floors} на S+: от оценки зависит, будет ли сундук Bedrock.`,
  'В конце смотри все сундуки: открывай платный, только если предмет внутри дороже цены открытия. Второй сундук можно открыть за Dungeon Chest Key.',
  'Дорогие предметы продавай на аукционе по медиане продаж, книги и Recombobulator — на Bazaar.',
];
const DUNGEON_RISKS = ['Нужна команда: медленный заход в разы снижает доход в час.', 'Дорогие предметы редкие, цифра — среднее за много заходов.'];
for (const [id, fl, extra] of [['dungeon-f1-f4', 'F1–F4', 'Денег мало: эти этажи нужны в основном ради опыта.'], ['dungeon-f5-f6', 'F5–F6', null], ['dungeon-f7', 'F7', null], ['dungeon-m1-m3', 'M1–M3', null], ['dungeon-m4-m6', 'M4–M6', 'Без топовой экипировки заходы срываются.'], ['dungeon-m7', 'M7', 'Нужно знать механики терминалов и Wither Lords.']]) {
  COMBAT_DETAILS[id] = { effort: 'party', risk: id === 'dungeon-m7' ? 'high' : 'mid', xp: 'Опыт Catacombs и класса', steps: DUNGEON_STEPS(fl), risks: extra ? [...DUNGEON_RISKS, extra] : DUNGEON_RISKS };
}
for (const t of ['basic', 'hot', 'burning', 'fiery', 'infernal']) {
  COMBAT_DETAILS[tx`kuudra-${t}`] = { effort: 'party', risk: t === 'infernal' ? 'high' : t === 'basic' || t === 'hot' ? 'low' : 'mid', xp: 'Опыт Combat, репутация фракции',
    steps: [
      'Собери группу из четырёх через Party Finder (/pf), раздел Kuudra.',
      tx`Купи ключ Kuudra ${KUUDRA_NAME[t]} у эмиссара своей фракции (Mage или Barbarian): без него платный сундук не открыть.`,
      'Пройди заход: собери припасы, построй баллисту, добей Kuudra.',
      'Продавай зубы, эссенцию и осколки на Bazaar, броню и экипировку на аукционе.',
    ],
    risks: ['Ключ платный: проваленный заход — чистый минус.', ...(t === 'fiery' || t === 'infernal' ? ['Без брони высокого тира и сильного оружия группа не справится.'] : []), 'Дорогие предметы выпадают редко, рынок на них тонкий.'] };
}
for (const [id, place] of [['mobs-zealot', 'Dragon\'s Nest в The End'], ['mobs-ghost', 'The Mist в Dwarven Mines'], ['mobs-automaton', 'Precursor Remnants в Crystal Hollows']]) {
  COMBAT_DETAILS[id] = { effort: 'semi', risk: 'low', xp: 'Опыт Combat',
    steps: [tx`Иди в ${place}.`, 'Убивай мобов оружием по площади, двигаясь по кругу, чтобы не ждать появления новых.', 'Частые дропы продавай на Bazaar сразу, редкие — на аукционе.'],
    risks: ['Редкие дропы решают всё: за час может не выпасть ни одного.', 'Темп сильно зависит от оружия и того, сколько игроков фармят рядом.'] };
}

export { unitValue };
