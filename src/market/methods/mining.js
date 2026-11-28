// Методы заработка на майнинге: Dwarven Mines, Crystal Hollows, Glacite Tunnels и Mineshaft.
// Подключается из ../methods.js (MINING_METHODS) и ../method-details.js (MINING_DETAILS).
// Импортировать этот файл только через methods.js: он берёт оттуда помощники по профилю (циклический импорт ES,
// функции вызываются уже после загрузки обоих модулей).
//
// Как считаем доход: «сколько действий в час» (блоков, убийств, ранов) × таблица дропа × живая цена.
// Цена берётся по реальной продаже (sellValue: ордер Bazaar не выше обычной цены за неделю, аукцион — не выше
// медианы продаж), из всех форм предмета выбираем самую выгодную (сырьё, сжатое, Flawless и т.д.), а продаём
// не больше, чем рынок реально берёт: 10% дневного оборота Bazaar (добытое сырьё продают все майнеры, но один
// игрок забирает лишь часть спроса) и 15% продаж аукциона за сутки, как в крафт-флипах. Остаток — по цене NPC.
//
// Темп (действий в час) — оценка для хорошей, но не максимальной экипировки, два значения: [осторожно, обычно].
// Шансы дропа: NEU-REPO (мобы), hypixel-skyblock.fandom.com (Crystal Nucleus, Jungle Loot), skykings.net
// (Ghost и Scatha), трупы Mineshaft — патч 0.24.2 и вики «Frozen Corpses» (28.11.2026). Сверено 23.11.2026.
import { hasAny } from '../methods.js';
import { sellValue, buyPrice, DEMAND_SHARE } from '../flips.js';
import { nameOf } from '../util.js';
import { RARE_CHANCE, RARE_PER_HOUR, meterPerRun } from '../drop-income.js';
import { tx } from '../../../i18n/msg.js';

const M = 1_000_000;
/** Доля дневного оборота Bazaar, которую один игрок может продать добытым. */
export const GATHER_SHARE = 0.1;

// Гемы: из одного Flawless = 80 Fine = 6 400 Flawed = 512 000 Rough
const GEM_FORMS = g => [
  { id: tx`ROUGH_${g}_GEM`, per: 1 },
  { id: tx`FLAWED_${g}_GEM`, per: 80 },
  { id: tx`FINE_${g}_GEM`, per: 6400 },
  { id: tx`FLAWLESS_${g}_GEM`, per: 512_000 },
];
// Прочность блока гема после патча 0.27.3 (ноябрь 2026): Ruby 2 500, Topaz 3 500,
// Jasper/Onyx/Aquamarine/Citrine/Peridot 4 000; Amber, Sapphire, Jade, Amethyst, Opal — 3 000, как и были.
export const GEM_STRENGTH = { RUBY: 2500, AMBER: 3000, SAPPHIRE: 3000, JADE: 3000, AMETHYST: 3000, TOPAZ: 3500, ONYX: 4000, AQUAMARINE: 4000, CITRINE: 4000, PERIDOT: 4000 };
const HOLLOWS_GEMS = ['RUBY', 'AMBER', 'SAPPHIRE', 'JADE', 'AMETHYST', 'TOPAZ'];
const TUNNEL_GEMS = ['ONYX', 'AQUAMARINE', 'CITRINE', 'PERIDOT'];
const GEM_RU = { RUBY: 'Ruby', AMBER: 'Amber', SAPPHIRE: 'Sapphire', JADE: 'Jade', AMETHYST: 'Amethyst', TOPAZ: 'Topaz', ONYX: 'Onyx', AQUAMARINE: 'Aquamarine', CITRINE: 'Citrine', PERIDOT: 'Peridot', JASPER: 'Jasper', OPAL: 'Opal' };

/** Формы предмета, в которых его можно продать: id и сколько базовых штук в одной. */
const FORMS = {
  MITHRIL_ORE: [{ id: 'MITHRIL_ORE', per: 1 }, { id: 'ENCHANTED_MITHRIL', per: 160 }],
  TITANIUM_ORE: [{ id: 'TITANIUM_ORE', per: 1 }, { id: 'ENCHANTED_TITANIUM', per: 160 }],
  UMBER: [{ id: 'UMBER', per: 1 }, { id: 'ENCHANTED_UMBER', per: 160 }],
  TUNGSTEN: [{ id: 'TUNGSTEN', per: 1 }, { id: 'ENCHANTED_TUNGSTEN', per: 160 }],
  GLACITE: [{ id: 'GLACITE', per: 1 }, { id: 'ENCHANTED_GLACITE', per: 160 }],
};
for (const g of [...HOLLOWS_GEMS, ...TUNNEL_GEMS, 'JASPER', 'OPAL']) {
  const f = GEM_FORMS(g);
  f.forEach((x, i) => { FORMS[x.id] = f.slice(i).map(y => ({ id: y.id, per: y.per / x.per })); });
}

const npcOf = (ctx, id) => Number(ctx.npc?.get(id) || 0);

/**
 * Сколько чистыми принесут `count` штук предмета в час: выбираем выгодную форму, продаём не больше спроса,
 * остаток — NPC. Возвращает null, если цены нет совсем.
 */
export function valueOf(ctx, id, count) {
  if (!count) return { perHour: 0, unit: 0, form: id, capped: false, market: null };
  const forms = FORMS[id] || [{ id, per: 1 }];
  const npcUnit = Math.max(0, ...forms.map(f => npcOf(ctx, f.id) / f.per));
  let best = null;
  for (const f of forms) {
    const s = sellValue(ctx, f.id, 'offer');
    if (!s?.net) continue;
    const unit = s.net / f.per;
    const share = s.market === 'Bazaar' ? GATHER_SHARE : DEMAND_SHARE.auction;
    // аукцион без статистики продаж: верим одной штуке в сутки, не больше
    const perDay = s.market === 'Bazaar' ? s.volumeDay : (s.sold24h ?? 1);
    // дроп реже раза в сутки рынок всегда купит: лимит спроса только для того, что идёт потоком
    const capH = count <= RARE_PER_HOUR ? Infinity : Math.max(perDay * share / 24, s.market === 'Bazaar' ? 0 : 1 / 24) * f.per;
    const sold = Math.min(count, capH);
    const perHour = sold * unit + (count - sold) * npcUnit;
    if (!best || perHour > best.perHour) best = { perHour, unit, form: f.id, capped: count > capH * 1.001, market: s.market };
  }
  if (!best && npcUnit) best = { perHour: count * npcUnit, unit: npcUnit, form: id, capped: false, market: 'NPC' };
  if (best && npcUnit * count > best.perHour) best = { perHour: npcUnit * count, unit: npcUnit, form: id, capped: false, market: 'NPC' };
  return best;
}

/**
 * Доход в час по таблице дропа.
 * @param {Array<{id: string, n?: number, p?: number}>} loot  n — штук за раз, p — шанс (0..1) за одно действие
 * @param {number} perHour  действий в час
 * @returns {{ perHour: number, rows: Array<{id, count, perHour, capped, form, market}>, priced: number }}
 */
export function lootIncome(ctx, loot, perHour) {
  const byId = new Map();
  for (const l of loot) byId.set(l.id, (byId.get(l.id) || 0) + (l.n ?? 1) * (l.p ?? 1) * perHour);
  const rows = [];
  let sum = 0, priced = 0;
  for (const [id, count] of byId) {
    const v = valueOf(ctx, id, count);
    if (!v) continue;
    priced++;
    sum += v.perHour;
    rows.push({ id, count, perHour: v.perHour, capped: v.capped, form: v.form, market: v.market });
  }
  rows.sort((a, b) => b.perHour - a.perHour);
  return { perHour: sum, rows, priced };
}

/** Цена покупки (мгновенно); null, если купить негде — тогда расчёт с этой покупкой не делаем. */
const cost = (ctx, id) => buyPrice(ctx, id)?.price || null;
/** Таблица дропа, умноженная на число: «за час» = «за раз» × действий в час. */
const scaled = (loot, k) => loot.map(l => ({ ...l, p: (l.p ?? 1) * k }));

const fmtM = n => tx`${(n / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
const fmtK = n => n >= M ? fmtM(n) : n >= 10_000 ? tx`${Math.round(n / 1000).toLocaleString('ru-RU')} тыс.` : Math.round(n).toLocaleString('ru-RU');
const fmtCount = n => n >= 1000 ? tx`${fmtK(n)} шт.` : n >= 10 ? tx`${Math.round(n)} шт.` : tx`${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} шт.`;
const rowText = (ctx, r) => tx`${nameOf(ctx, r.form)} — ${fmtK(r.perHour)}/ч${r.capped ? ' (упёрлись в спрос)' : ''}`;
const topOf = (ctx, rows, n = 5) => rows.filter(r => r.perHour > 0).slice(0, n).map(r => ({ id: r.form, name: nameOf(ctx, r.form), perHour: r.perHour }));

/** Двойной расчёт [осторожно, обычно] по таблице дропа. */
function twoRates(ctx, loot, [lo, hi], extraCostPerAction = 0) {
  const a = lootIncome(ctx, loot, lo);
  const b = lootIncome(ctx, loot, hi);
  if (!b.priced) return null;
  return { lo: a.perHour - extraCostPerAction * lo, hi: b.perHour - extraCostPerAction * hi, rows: b.rows };
}

/**
 * Разбор «откуда доход» для окна метода: по каждому предмету шанс за одно действие (бросок, труп, убийство, ран),
 * среднее количество, цена, вклад за раз и за час и раз в сколько часов он выпадает. Редкие (шанс < 5%) помечены.
 * @param {Array<{loot: object[], k?: number}>} parts  таблицы дропа; k — сколько раз таблица срабатывает за одно действие
 * @param {number} perHour  действий в час
 */
export function breakdownOf(ctx, parts, perHour, limit = 14) {
  const by = new Map();
  for (const { loot, k = 1 } of parts) {
    for (const l of loot) {
      const p = Math.min(1, (l.p ?? 1)), n = l.n ?? 1;
      const e = by.get(l.id) || { none: 1, exp: 0 };
      e.none *= Math.pow(1 - p, k);   // шанс, что за действие не выпало ни разу
      e.exp += n * p * k;             // сколько штук в среднем за действие
      by.set(l.id, e);
    }
  }
  const rows = [];
  for (const [id, e] of by) {
    const chance = Math.min(1, 1 - e.none) || Math.min(1, e.exp);
    const v = valueOf(ctx, id, e.exp * perHour);
    if (!v?.unit) continue;
    const qty = chance > 0 ? e.exp / chance : 0;
    rows.push({ id, name: nameOf(ctx, id), chance, qty, unit: Math.round(v.unit), perKill: Math.round(e.exp * v.unit), perHour: Math.round(v.perHour),
      everyHours: chance > 0 && perHour > 0 ? 1 / (chance * perHour) : null, rare: chance < RARE_CHANCE });
  }
  return rows.sort((a, b) => b.perHour - a.perHour).slice(0, limit);
}

const result = (ctx, r, detail, extra = {}) => {
  if (!r || r.hi <= 0) return null;
  return { coinsPerHour: Math.round(r.hi), range: [Math.round(Math.max(0, r.lo)), Math.round(r.hi)], detail, top: topOf(ctx, r.rows), ...extra };
};

// ---------- профиль ----------
const lvl = o => Number(o?.level || 0);
const hotm = m => lvl(m?.mining?.hotm);
const miningLvl = m => lvl(m?.skills?.mining);
const combatLvl = m => lvl(m?.skills?.combat);
const fmtN = n => Number(n || 0).toLocaleString('ru-RU');
const need = (label, cur, min, extra = {}) => ({ text: tx`${label} ${min}+`, ok: cur >= min, have: tx`у тебя ${fmtN(cur)}`, ...extra });
const hollowsReq = m => need('HotM', hotm(m), 4, { have: tx`у тебя ${hotm(m)} (без него — пропуск у Gwendolyn за 10 тыс. на 6 ч)` });
const minesReq = m => need('Mining', miningLvl(m), 12);
const tunnelsReq = m => need('HotM', hotm(m), 7, { have: tx`у тебя ${hotm(m)}` });
const DRILLS = ['DIVAN_DRILL', 'GEMSTONE_DRILL_1', 'GEMSTONE_DRILL_2', 'GEMSTONE_DRILL_3', 'GEMSTONE_DRILL_4', 'TITANIUM_DRILL_1', 'TITANIUM_DRILL_2', 'TITANIUM_DRILL_3', 'TITANIUM_DRILL_4', 'MITHRIL_DRILL_1', 'MITHRIL_DRILL_2', 'GEMSTONE_GAUNTLET', 'PICKONIMBUS', 'JUNGLE_PICKAXE'];

// ---------- таблицы дропа ----------
const pct = x => x / 100;

/** Crystal Nucleus: одна награда за 14–20 бросков (fandom, Crystal Nucleus, 23.11.2026); шанс — на один бросок. */
export const NUCLEUS_ROLL = [
  ...HOLLOWS_GEMS.flatMap(g => [
    { id: tx`FLAWED_${g}_GEM`, n: 6, p: pct(6.5521139) }, { id: tx`FLAWED_${g}_GEM`, n: 12, p: pct(3.2760569) },
    { id: tx`FLAWED_${g}_GEM`, n: 24, p: pct(1.6380285) }, { id: tx`FLAWED_${g}_GEM`, n: 40, p: pct(0.6552114) },
    { id: tx`FINE_${g}_GEM`, p: pct(0.2948451) }, { id: tx`FLAWLESS_${g}_GEM`, p: pct(0.0049141) },
  ]),
  { id: 'FLAWED_JASPER_GEM', n: 6, p: pct(3.2760569) }, { id: 'FLAWED_JASPER_GEM', n: 12, p: pct(1.6380285) },
  { id: 'FLAWED_JASPER_GEM', n: 24, p: pct(0.6552114) }, { id: 'FLAWED_JASPER_GEM', n: 32, p: pct(0.229324) },
  { id: 'FINE_JASPER_GEM', p: pct(0.0655211) }, { id: 'FLAWLESS_JASPER_GEM', p: pct(0.001638) },
  { id: 'DIVAN_FRAGMENT', p: pct(1.9656342) },
  { id: 'PREHISTORIC_EGG', p: pct(1.6380285) },
  { id: 'OIL_BARREL', p: pct(3.2760569) },
  { id: 'HELIX', p: pct(1.3104228) },
  { id: 'CLAW_FOSSIL', p: pct(0.163) },
  { id: 'RUBY_CRYSTAL', p: pct(0.8190142) },
  { id: 'JASPER_CRYSTAL', p: pct(0.8190142) },
  { id: 'PICKONIMBUS', p: pct(3.2760569) },
  { id: 'BOB_OMB', n: 16, p: pct(3.9312683) },
  { id: 'JADERALD', p: pct(0.4750283) },
  { id: 'WISHING_COMPASS', p: pct(0.1638028) },
  { id: 'TREASURITE', n: 5, p: pct(0.6552114) }, { id: 'TREASURITE', n: 10, p: pct(0.0655211) },
  { id: 'RECALL_POTION', p: pct(0.0819014) },
  { id: 'PRECIOUS_PEARL', p: pct(0.1638028) },
  { id: 'GEMSTONE_MIXTURE', p: pct(0.229324) },
  { id: 'ENCHANTMENT_FORTUNE_4', p: pct(0.229324) },
  { id: 'PET_ITEM_QUICK_CLAW', p: pct(0.0163803) },
  { id: 'ESSENCE_GOLD', n: 750, p: pct(0.2457043) },
  { id: 'ESSENCE_DIAMOND', n: 750, p: pct(0.2457043) },
  // в игре (меню RNG-метра, 23.11.2026) база 0,0055%, при 3% шкалы 0,0059% — сходится с 1/18000; fandom давал 0,00588%
  { id: 'DIVAN_ALLOY', p: 1 / 18000 },
];
/**
 * RNG-метр Crystal Nucleus (меню Crystal Nucleus RNG Meter в игре, 23.11.2026): каждый ран даёт 1000 Nucleus XP,
 * выбранный дроп выпадает гарантированно на полной шкале, а пока шкала копится, его шанс растёт в 1 + 2 × заполнение раз
 * (в игре Divan's Alloy при 3%: 0,0055% → 0,0059%). Шкала обнуляется, когда выбранный предмет выпал.
 * Известно точно только для Divan's Alloy (1 000 000 XP); остальным целям шкалу оцениваем по редкости так же.
 */
export const NUCLEUS_XP_PER_RUN = 1000;
const METER_KNOWN = { DIVAN_ALLOY: 1_000_000 };

// meterPerRun живёт в drop-income.js (общая формула RNG-метра вики), здесь — реэкспорт для старых импортов
export { meterPerRun };

/** Цели RNG-метра Nucleus: редкие одиночные предметы из таблицы бросков (не гемы). */
export function nucleusMeterTargets() {
  const alloyP = NUCLEUS_ROLL.find(l => l.id === 'DIVAN_ALLOY').p;
  const by = new Map();
  for (const l of NUCLEUS_ROLL) {
    if ((l.n ?? 1) !== 1 || /_GEM$/.test(l.id) || !(l.p < 0.025)) continue;
    by.set(l.id, (by.get(l.id) || 0) + l.p);
  }
  return [...by].map(([id, p]) => {
    const xp = METER_KNOWN[id] ?? Math.max(1, Math.round(METER_KNOWN.DIVAN_ALLOY / NUCLEUS_XP_PER_RUN * alloyP / p)) * NUCLEUS_XP_PER_RUN;
    return { id, p, xp, known: id in METER_KNOWN };
  });
}

/** Гарантированно с каждого Nucleus: по одному Fine каждого гема (включая Jasper и Opal). */
export const NUCLEUS_FIXED = [...HOLLOWS_GEMS, 'JASPER', 'OPAL'].map(g => ({ id: tx`FINE_${g}_GEM` }));
export const AUTOMATON_PARTS = ['SYNTHETIC_HEART', 'CONTROL_SWITCH', 'SUPERLITE_MOTOR', 'ROBOTRON_REFLECTOR', 'FTX_3070', 'ELECTRON_TRANSMITTER'];

/**
 * Трупы в Glacite Mineshaft: таблицы лута из патча 0.24.2 (форум Hypixel, 18.02.2026) с поправками вики
 * (hypixelskyblock.minecraft.wiki «Frozen Corpses», 28.11.2026: веса Skeleton Key, Caged Wisp, Frozen Scute, Shattered Locket).
 * Каждый бросок выбирает одну строку по весу. Броски: Lapis 3–6, Umber/Tungsten 4–7, Vanguard 5–8 (берём середину).
 * Dead Man's Chestplate (добавлен в октябре 2026) не учтён: вес на вики неизвестен.
 */
const fromWeights = rows => {
  const total = rows.reduce((s, r) => s + r[2], 0);
  return rows.map(([id, n, w]) => ({ id, n, p: w / total }));
};
const GEMS4 = ['ONYX', 'PERIDOT', 'CITRINE', 'AQUAMARINE'];
const CRYSTALS = ['OPAL', 'ONYX', 'PERIDOT', 'CITRINE', 'AQUAMARINE'].map(g => tx`${g}_CRYSTAL`);
const steps = (id, list) => list.map(([n, w]) => [id, n, w]);
const LAPIS_LOOT = fromWeights([
  ...GEMS4.flatMap(g => [...steps(tx`FLAWED_${g}_GEM`, [[20, 1000], [40, 500]]), ...steps(tx`FINE_${g}_GEM`, [[1, 250], [2, 125]])]),
  ['SUSPICIOUS_SCRAP', 1, 500],
  ...['GOBLIN_EGG'].flatMap(id => steps(id, [[1, 800], [2, 400], [4, 200]])),
  ...['GOBLIN_EGG_GREEN', 'GOBLIN_EGG_YELLOW', 'GOBLIN_EGG_RED'].flatMap(id => steps(id, [[1, 700], [2, 350], [4, 175]])),
  ...['ENCHANTED_UMBER', 'ENCHANTED_TUNGSTEN', 'ENCHANTED_GLACITE'].flatMap(id => steps(id, [[1, 500], [2, 250], [4, 125]])),
  ['REFINED_UMBER', 1, 25], ['REFINED_TUNGSTEN', 1, 25], ['GLACITE_AMALGAMATION', 1, 25], ['UMBER_KEY', 1, 25], ['TUNGSTEN_KEY', 1, 25],
  ...steps('GLACITE_JEWEL', [[1, 500], [2, 250]]), ...steps('BEJEWELED_HANDLE', [[1, 100], [2, 50], [4, 25]]),
]);
const METAL_CORPSE = fromWeights([
  ...GEMS4.flatMap(g => [...steps(tx`FINE_${g}_GEM`, [[2, 800], [4, 400], [8, 200]]), [tx`FLAWLESS_${g}_GEM`, 1, 20]]),
  ...steps('SUSPICIOUS_SCRAP', [[2, 800], [4, 400]]),
  ['ENCHANTMENT_ICE_COLD_1', 1, 80], ['GOBLIN_EGG_BLUE', 1, 80], ['REFINED_UMBER', 1, 20], ['REFINED_TUNGSTEN', 1, 20], ['GLACITE_AMALGAMATION', 1, 20],
  ['UMBER_PLATE', 1, 5], ['TUNGSTEN_PLATE', 1, 5], ['MITHRIL_PLATE', 1, 10], ...CRYSTALS.map(id => [id, 1, 40]),
  ['UMBER_KEY', 1, 10], ['TUNGSTEN_KEY', 1, 10], ['FROZEN_SCUTE', 1, 4], ['DWARVEN_OS_METALLIC_MINIS', 1, 20], ['SKELETON_KEY', 1, 4], ['CAGED_WISP', 1, 2],
]);
const VANGUARD_LOOT = fromWeights([
  ...GEMS4.flatMap(g => steps(tx`FLAWLESS_${g}_GEM`, [[1, 160], [2, 80]])),
  ['DWARVEN_OS_METALLIC_MINIS', 1, 120], ...steps('SUSPICIOUS_SCRAP', [[8, 160], [16, 80]]), ['ENCHANTMENT_ICE_COLD_1', 1, 160],
  ...steps('GOBLIN_EGG_BLUE', [[1, 160], [2, 80]]), ...steps('REFINED_UMBER', [[1, 160], [2, 80]]), ...steps('REFINED_TUNGSTEN', [[1, 160], [2, 80]]),
  ...steps('GLACITE_AMALGAMATION', [[1, 160], [2, 80], [4, 40]]), ['MITHRIL_PLATE', 1, 60], ['UMBER_PLATE', 1, 30], ['TUNGSTEN_PLATE', 1, 30],
  ...CRYSTALS.map(id => [id, 1, 120]), ...steps('UMBER_KEY', [[1, 80], [2, 40], [4, 20]]), ...steps('TUNGSTEN_KEY', [[1, 80], [2, 40], [4, 20]]),
  ['SKELETON_KEY', 1, 10], ['FROZEN_SCUTE', 1, 10], ['CAGED_WISP', 1, 10], ['SHATTERED_PENDANT', 1, 5],
]);
/** chance — доля трупов этого типа (Lapis 50%, Umber и Tungsten по 25%), rolls — средние броски с трупа. */
export const CORPSES = {
  lapis: { key: null, chance: 0.5, rolls: 4.5, loot: LAPIS_LOOT },
  umber: { key: 'UMBER_KEY', chance: 0.25, rolls: 5.5, loot: METAL_CORPSE },
  tungsten: { key: 'TUNGSTEN_KEY', chance: 0.25, rolls: 5.5, loot: METAL_CORPSE },
  vanguard: { key: 'SKELETON_KEY', chance: 0, rolls: 6.5, loot: VANGUARD_LOOT },
};
/** Трупов в обычной шахте: 2 всегда, третий с шансом 50% (лишний от перков не считаем). */
export const CORPSES_PER_SHAFT = 2.5;

/** Черви в Crystal Hollows: 80% Stoneworm (NEU), 20% Scatha (skykings.net). */
export const WORM_LOOT = [
  { id: 'WORM_MEMBRANE', p: 0.8 },
  ...['AMETHYST', 'JADE', 'AMBER', 'SAPPHIRE', 'TOPAZ'].map(g => ({ id: tx`ROUGH_${g}_GEM`, n: 8, p: 0.8 })),
  { id: 'WORM_MEMBRANE', n: 4, p: 0.2 },
  { id: 'FINE_TOPAZ_GEM', p: 0.2 }, { id: 'FINE_AMETHYST_GEM', p: 0.2 * 0.4 }, { id: 'FINE_JADE_GEM', p: 0.2 * 0.2 },
  { id: 'FINE_AMBER_GEM', p: 0.2 * 0.1 }, { id: 'FINE_SAPPHIRE_GEM', p: 0.2 * 0.1 }, { id: 'DWARVEN_OS_BLOCK_BRAN', p: 0.2 * 0.1 },
  { id: 'SCATHA;2', p: 0.2 * pct(0.144) }, { id: 'SCATHA;3', p: 0.2 * pct(0.072) }, { id: 'SCATHA;4', p: 0.2 * pct(0.024) },
];

/** Гоблины в Goblin Holdout (NEU, средняя таблица Flamethrower / Murderlover / Creeperlobber). */
export const GOBLIN_LOOT = [
  { id: 'GOBLIN_EGG', p: 0.05 }, { id: 'GOBLIN_EGG_GREEN', p: 0.025 }, { id: 'GOBLIN_EGG_RED', p: 0.025 },
  { id: 'GOBLIN_EGG_YELLOW', p: 0.025 }, { id: 'GOBLIN_EGG_BLUE', p: 0.001 }, { id: 'SULPHUR', p: 0.66 },
];

// ---------- темп (оценка, [осторожно, обычно]) ----------
export const RATES = {
  mithril: [100_000, 250_000],          // Mithril в час (с Mining Fortune и Spread)
  titanium: [300, 800],                // Titanium в час попутно
  // «Rough-эквивалент» в час на Ruby (прочность 2 500), с Pristine: ~3 блока/с × 11 (Fortune) × 16,8 (Pristine 20)
  // при 70% времени за копанием ≈ 1,4 млн; совпадает с замерами SkyCofl для Ruby (~7 млн/ч), ноябрь 2026
  gemRough: [600_000, 1_400_000],
  metal: [15_000, 40_000],             // Umber / Tungsten / Glacite в час
  mineshafts: [2, 4],                  // шахт в час (вход ~1 на 2 000 блоков + счётчик)
  shaftGemShare: 0.5,                  // доля часа, когда копаешь гемы туннелей (в шахте и по пути к ней)
  nucleus: [1.5, 2.5],                 // ранов Crystal Nucleus в час, если детали и ключ покупать
  worms: [30, 55],                     // червей в час (кулдаун 30 с, максимум 120)
  goblins: [200, 400],                 // убийств гоблинов в час
};
const rateText = (r, unit) => tx`${fmtN(r[0])}–${fmtN(r[1])} ${unit} в час`;

// ---------- методы ----------
export const MINING_METHODS = [
  {
    id: 'mining-mithril', title: 'Mithril и Titanium', tag: 'Mining', mode: 'active',
    desc: 'Первый денежный майнинг: копаешь Mithril в Dwarven Mines, попутно падает Titanium. Мало денег, зато заодно идут коммишны, Powder Mithril и опыт HotM.',
    req: m => [minesReq(m), need('HotM', hotm(m), 1)],
    compute: (ctx) => {
      const loot = [{ id: 'MITHRIL_ORE', n: 1 }, { id: 'TITANIUM_ORE', n: RATES.titanium[1] / RATES.mithril[1] }];
      const r = twoRates(ctx, loot, RATES.mithril);
      return result(ctx, r, tx`Считаем ${rateText(RATES.mithril, 'Mithril')} и ${rateText(RATES.titanium, 'Titanium')}. Продаём в самой выгодной форме: ${r?.rows.slice(0, 2).map(x => rowText(ctx, x)).join('; ')}. Powder и опыт HotM в деньги не входят.`);
    },
    drops: ['ENCHANTED_MITHRIL', 'ENCHANTED_TITANIUM', 'REFINED_MITHRIL', 'REFINED_TITANIUM'],
  },
  {
    id: 'gemstones', title: 'Добыча гемов', tag: 'Mining', mode: 'active',
    desc: 'Crystal Hollows (Ruby, Jade, Amber, Sapphire, Amethyst, Topaz) и Glacite Tunnels (Onyx, Aquamarine, Citrine, Peridot). Доход посчитан по каждому гему отдельно с учётом прочности блока после патча 0.27.3, лучший показан сверху.',
    req: m => [hollowsReq(m),
      { text: 'Гемовая дрель (Divan, Gemstone/Titanium Drill, Gemstone Gauntlet)', ok: hasAny(m, DRILLS.filter(d => !/MITHRIL|PICKONIMBUS|JUNGLE/.test(d))), soft: true, buy: ['GEMSTONE_DRILL_2', 'GEMSTONE_GAUNTLET', 'DIVAN_DRILL'] }],
    compute: (ctx, m) => {
      const gems = [...HOLLOWS_GEMS, ...(hotm(m) >= 7 ? TUNNEL_GEMS : [])];
      const per = gems.map(g => {
        const k = 2500 / GEM_STRENGTH[g];
        const lo = valueOf(ctx, tx`ROUGH_${g}_GEM`, RATES.gemRough[0] * k);
        const hi = valueOf(ctx, tx`ROUGH_${g}_GEM`, RATES.gemRough[1] * k);
        return hi ? { g, lo: lo?.perHour || 0, hi: hi.perHour, form: hi.form, capped: hi.capped, market: hi.market } : null;
      }).filter(Boolean).sort((a, b) => b.hi - a.hi);
      if (!per.length || per[0].hi <= 0) return null;
      const b = per[0];
      const locked = hotm(m) >= 7 ? '' : ' Гемы Glacite Tunnels (Onyx, Aquamarine, Citrine, Peridot) откроются с HotM 7.';
      return {
        coinsPerHour: Math.round(b.hi), range: [Math.round(b.lo), Math.round(b.hi)],
        detail: tx`Лучший сейчас: ${GEM_RU[b.g]}, продавать как ${nameOf(ctx, b.form)}${b.capped ? ' (часть упрётся в спрос)' : ''}. Дальше: ${per.slice(1, 4).map(x => tx`${GEM_RU[x.g]} ${fmtK(x.hi)}/ч`).join(', ')}. Считаем ${fmtK(RATES.gemRough[0])}–${fmtK(RATES.gemRough[1])} Rough (вместе с Flawed от Pristine, пересчитанных в Rough) в час на Ruby; гемы прочнее копаются медленнее во столько же раз.${locked}`,
        top: per.slice(0, 5).map(x => ({ id: x.form, name: tx`${GEM_RU[x.g]} (${nameOf(ctx, x.form)})`, perHour: x.hi })),
      };
    },
    drops: ['FLAWLESS_RUBY_GEM', 'FLAWLESS_JADE_GEM', 'FLAWLESS_AMBER_GEM', 'FLAWLESS_TOPAZ_GEM', 'FLAWLESS_PERIDOT_GEM'],
  },
  {
    id: 'glacite-metals', title: 'Umber, Tungsten и Glacite', tag: 'Mining', mode: 'active',
    desc: 'Металлы Glacite Tunnels: идут на крафт брони и инструментов Dwarven Tunnels, поэтому спрос стабильный. Считаем лучший из трёх. Холод (Cold) режет скорость копания: выходи погреться вовремя.',
    req: m => [tunnelsReq(m)],
    compute: (ctx) => {
      const opts = ['UMBER', 'TUNGSTEN', 'GLACITE'].map(id => {
        const r = twoRates(ctx, [{ id }], RATES.metal);
        return r ? { id, ...r } : null;
      }).filter(Boolean).sort((a, b) => b.hi - a.hi);
      if (!opts.length) return null;
      const b = opts[0];
      return result(ctx, b, tx`Лучший сейчас: ${nameOf(ctx, b.id)}, продавать как ${nameOf(ctx, b.rows[0]?.form)}${b.rows[0]?.capped ? ' (упёрлись в спрос)' : ''}. Остальные: ${opts.slice(1).map(x => tx`${nameOf(ctx, x.id)} ${fmtK(x.hi)}/ч`).join(', ')}. Считаем ${rateText(RATES.metal, 'штук')} при хорошей Mining Speed и Fortune; попутно открываются Glacite Mineshaft (см. метод ниже).`,
        { top: opts.map(x => ({ id: x.rows[0]?.form || x.id, name: nameOf(ctx, x.id), perHour: x.hi })) });
    },
    drops: ['ENCHANTED_UMBER', 'ENCHANTED_TUNGSTEN', 'ENCHANTED_GLACITE', 'REFINED_UMBER', 'REFINED_TUNGSTEN'],
  },
  {
    id: 'glacite-mineshaft', title: 'Glacite Mineshaft и трупы', tag: 'Mining', mode: 'active',
    desc: 'Во время копания в Glacite Tunnels открывается вход в шахту. Внутри трупы: Lapis (без ключа), Umber и Tungsten (нужен ключ своего типа), а в редкой шахте Fairy — Vanguard (Skeleton Key). С трупов падают гемы, Suspicious Scrap, яйца гоблинов, ключи и редкие Plate, Frozen Scute и Caged Wisp.',
    req: m => [tunnelsReq(m), { text: 'Mineshaft уже открывал', ok: Number(m?.mining?.mineshafts || 0) > 0, soft: true, have: tx`входов: ${fmtN(m?.mining?.mineshafts || 0)}` }],
    compute: (ctx) => {
      // Сначала стоимость одного трупа: решаем, окупает ли он ключ (ключ без цены — труп не открываем)
      const L = CORPSES.lapis, U = CORPSES.umber;
      const lapis = lootIncome(ctx, L.loot, L.rolls).perHour;
      const metal = lootIncome(ctx, METAL_CORPSE, U.rolls);
      const keyU = cost(ctx, 'UMBER_KEY'), keyT = cost(ctx, 'TUNGSTEN_KEY');
      const openU = keyU != null && metal.perHour > keyU, openT = keyT != null && metal.perHour > keyT;
      // Затем весь лут за час одним списком, чтобы спрос рынка считался один раз на час, а не на каждую шахту
      const metalShare = ((openU ? U.chance : 0) + (openT ? CORPSES.tungsten.chance : 0)) * CORPSES_PER_SHAFT;
      const lapisShare = L.chance * CORPSES_PER_SHAFT;
      const keysPerShaft = ((openU ? U.chance * keyU : 0) + (openT ? CORPSES.tungsten.chance * keyT : 0)) * CORPSES_PER_SHAFT;
      const hourly = shafts => {
        const loot = [...scaled(L.loot, lapisShare * L.rolls * shafts), ...scaled(METAL_CORPSE, metalShare * U.rolls * shafts)];
        const li = lootIncome(ctx, loot, 1);
        return { ...li, perHour: li.perHour - keysPerShaft * shafts };
      };
      const lo = hourly(RATES.mineshafts[0]), hi = hourly(RATES.mineshafts[1]);
      // Между трупами копаешь гемы туннелей (в каждой шахте своя жила): берём лучший из четырёх
      const gems = TUNNEL_GEMS.map(g => {
        const k = RATES.shaftGemShare * 2500 / GEM_STRENGTH[g];
        return { g, lo: valueOf(ctx, tx`ROUGH_${g}_GEM`, RATES.gemRough[0] * k)?.perHour || 0, hi: valueOf(ctx, tx`ROUGH_${g}_GEM`, RATES.gemRough[1] * k)?.perHour || 0 };
      }).sort((a, b) => b.hi - a.hi)[0];
      if (hi.perHour <= 0 && !gems.hi) return null;
      const r = { lo: Math.max(0, lo.perHour) + gems.lo, hi: Math.max(0, hi.perHour) + gems.hi, rows: hi.rows };
      const keyText = k => k == null ? 'ключа нет в продаже — не открываем' : fmtK(k);
      return result(ctx, r, tx`Трупы: Lapis ≈${fmtK(lapis)}, Umber/Tungsten ≈${fmtK(metal.perHour)} за труп; ключ Umber ${keyText(keyU)}, Tungsten ${keyText(keyT)}${!openU || !openT ? ' (труп, который не окупает ключ, не открываем)' : ''}. При ${rateText(RATES.mineshafts, 'шахт')} трупы дают ${fmtK(Math.max(0, hi.perHour))}/ч. Гемы: половину времени копаешь жилы туннелей, лучший сейчас ${GEM_RU[gems.g]} — ${fmtK(gems.hi)}/ч. В шахте в среднем 2,5 трупа: половина Lapis (4–5 предметов), по четверти Umber и Tungsten (5–6 предметов). Glacite Powder и опыт HotM сверху.`,
        { top: [{ id: tx`FLAWLESS_${gems.g}_GEM`, name: tx`${GEM_RU[gems.g]} (жилы в шахте)`, perHour: gems.hi }, ...topOf(ctx, hi.rows, 4)],
          breakdown: breakdownOf(ctx, [{ loot: L.loot, k: lapisShare * L.rolls }, { loot: METAL_CORPSE, k: metalShare * U.rolls }], RATES.mineshafts[1]),
          breakdownUnit: 'шахту' });
    },
    drops: ['SUSPICIOUS_SCRAP', 'UMBER_PLATE', 'FROZEN_SCUTE', 'CAGED_WISP', 'DWARVEN_OS_METALLIC_MINIS'],
  },
  {
    id: 'crystal-nucleus', title: 'Раны Crystal Nucleus', tag: 'Mining', mode: 'active',
    desc: 'Собираешь 5 кристаллов в Crystal Hollows (Jade — Mines of Divan, Amber — Goblin Queen\'s Den, Amethyst — Jungle Temple, Sapphire — Lost Precursor City, Topaz — Bal) и ставишь их в Crystal Nucleus. Награда: 14–20 бросков по таблице (Divan Fragment, Pickonimbus 2000, Prehistoric Egg, Jaderald, Flawed гемы) плюс по одному Fine каждого гема и 800 опыта HotM.',
    req: m => [hollowsReq(m), { text: 'Питомец Mole (+1 бросок)', ok: hasAny(m, ['PET_MOLE']), soft: true },
      { text: 'Раны Nucleus уже делал', ok: Number(m?.mining?.nucleusRuns || 0) > 0, soft: true, have: tx`ранов: ${fmtN(m?.mining?.nucleusRuns || 0)}` }],
    compute: (ctx, m) => {
      const rolls = 17 + (hasAny(m, ['PET_MOLE']) ? 1 : 0);
      // Детали и ключ без цены — честный расчёт с покупкой невозможен
      const partCosts = AUTOMATON_PARTS.map(id => cost(ctx, id));
      const key = cost(ctx, 'JUNGLE_KEY');
      if (key == null || partCosts.some(c => c == null)) return null;
      const parts = partCosts.reduce((s, c) => s + c, 0);
      // Стоимость одного рана — для текста; доход в час — по луту за час одним списком (спрос считается раз на час)
      const stash = lootIncome(ctx, NUCLEUS_ROLL, rolls);
      const fixed = lootIncome(ctx, NUCLEUS_FIXED, 1);
      const run = stash.perHour + fixed.perHour;
      const net = run - parts - key;
      const hourly = runs => lootIncome(ctx, [...scaled(NUCLEUS_ROLL, rolls * runs), ...scaled(NUCLEUS_FIXED, runs)], 1).perHour - (parts + key) * runs;
      if (!stash.priced) return null;
      // RNG-метр: что добавляет гарантия для каждой цели; в доход берём самую выгодную цель (её игрок и поставит)
      const progress = m?.mining?.nucleusMeter || null;
      const targets = nucleusMeterTargets().map(t => {
        const v = valueOf(ctx, t.id, 1 / 1000);
        if (!v?.unit) return null;
        const mt = meterPerRun(t.p, rolls, t.xp / NUCLEUS_XP_PER_RUN);
        if (mt.natural >= RARE_CHANCE) return null; // частый дроп метр почти не ускоряет, а рынок лишнее не купит
        // прибавка в час с учётом спроса: продаём больше штук, чем без метра
        const gain = x => (valueOf(ctx, t.id, mt.perRun * x)?.perHour || 0) - (valueOf(ctx, t.id, mt.natural * x)?.perHour || 0);
        const extraPerHour = RATES.nucleus.map(x => Math.max(0, Math.round(gain(x))));
        return { id: t.id, name: nameOf(ctx, t.id), unit: Math.round(v.unit), pRoll: t.p, xp: t.xp, known: t.known,
          natural: mt.natural, perRun: mt.perRun, avgRuns: Math.round(mt.cycleRuns), chanceBefore: mt.chanceBefore,
          extraPerRun: Math.round(extraPerHour[1] / RATES.nucleus[1]), extraPerHour };
      }).filter(Boolean).sort((a, b) => b.extraPerRun - a.extraPerRun);
      const best = (progress?.selected && targets.find(t => t.id === progress.selected)) || targets[0] || null;
      const lift = best ? best.extraPerRun : 0;
      // окупаемость — уже с метром: без Alloy ран может быть в минус, а с гарантией в плюс
      if (net + lift <= 0) return null;
      const r = { lo: hourly(RATES.nucleus[0]) + (best?.extraPerHour[0] || 0), hi: hourly(RATES.nucleus[1]) + (best?.extraPerHour[1] || 0), rows: stash.rows };
      const meterText = best ? tx` RNG-метр Nucleus (+1000 очков за ран) на ${best.name}: шкала ${fmtN(best.xp)} очков — это ${fmtN(best.xp / NUCLEUS_XP_PER_RUN)} ранов${best.known ? '' : ' (оценка по редкости)'}, шанс растёт по мере заполнения, на полной шкале предмет гарантирован. С ним он выходит в среднем за ${fmtN(best.avgRuns)} вместо ${fmtN(Math.round(1 / best.natural))} ранов и добавляет ≈${fmtK(lift)} за ран (уже в доходе).` : '';
      return result(ctx, r, tx`Один ран приносит ≈${fmtK(run)} (${rolls} бросков${rolls > 17 ? ', с Mole' : ''}; гарантированные Fine гемы ≈${fmtK(fixed.perHour)}), минус 6 деталей Automaton для Sapphire (${fmtK(parts)}) и Jungle Key для Amethyst (${fmtK(key)}): чистыми ≈${fmtK(net)}; считаем ${fmtN(RATES.nucleus[0])}–${fmtN(RATES.nucleus[1])} рана в час, если детали и ключ покупать; если выбиваешь сам — ранов меньше, зато без расходов. Больше всего дают: ${stash.rows.slice(0, 3).map(x => nameOf(ctx, x.form)).join(', ')}.${meterText}`,
        { top: topOf(ctx, stash.rows, 5),
          breakdown: breakdownOf(ctx, [{ loot: NUCLEUS_ROLL, k: rolls }, { loot: NUCLEUS_FIXED }], RATES.nucleus[1]), breakdownUnit: 'ран',
          meter: best ? { xpPerRun: NUCLEUS_XP_PER_RUN, rolls, runsPerHour: RATES.nucleus, best: best.id, progress, targets } : null });
    },
    drops: ['DIVAN_FRAGMENT', 'PICKONIMBUS', 'PREHISTORIC_EGG', 'JADERALD', 'GEMSTONE_MIXTURE'],
  },
  {
    id: 'scatha', title: 'Черви и Scatha', tag: 'Mining', mode: 'active',
    desc: 'Копаешь Hard Stone в Crystal Hollows: с шансом 1 на 600 за блок вылезает червь (80% Stoneworm, 20% Scatha), потом 30 секунд перерыв. Scatha даёт Worm Membrane, Fine гемы и редкого питомца Scatha.',
    req: m => [hollowsReq(m)],
    compute: (ctx) => {
      const r = twoRates(ctx, WORM_LOOT, RATES.worms);
      return result(ctx, r, tx`Считаем ${rateText(RATES.worms, 'червей')} (кулдаун 30 с не даёт больше 120). Больше всего дают: ${r?.rows.slice(0, 3).map(x => rowText(ctx, x)).join('; ')}. Питомец Scatha выпадает с 0,24% Scatha (Rare/Epic/Legendary вместе), поэтому основная часть дохода — его ожидаемая цена: в коротком отрезке её может не быть.`,
        { breakdown: breakdownOf(ctx, [{ loot: WORM_LOOT }], RATES.worms[1]), breakdownUnit: 'червя' });
    },
    drops: ['WORM_MEMBRANE', 'SCATHA;2', 'SCATHA;3', 'SCATHA;4', 'DWARVEN_OS_BLOCK_BRAN'],
  },
  {
    id: 'goblins', title: 'Яйца гоблинов в Goblin Holdout', tag: 'Mining', mode: 'active',
    desc: 'Гоблины в Goblin Holdout (Crystal Hollows): обычные и цветные Goblin Egg, редкое синее. Яйца нужны для кристалла Amber и питомцев, продаются на Bazaar.',
    req: m => [hollowsReq(m)],
    compute: (ctx) => {
      const r = twoRates(ctx, GOBLIN_LOOT, RATES.goblins);
      return result(ctx, r, tx`Считаем ${rateText(RATES.goblins, 'убийств')} сильных гоблинов (Flamethrower, Murderlover, Creeperlobber). Больше всего дают: ${r?.rows.slice(0, 3).map(x => rowText(ctx, x)).join('; ')}.`,
        { breakdown: breakdownOf(ctx, [{ loot: GOBLIN_LOOT }], RATES.goblins[1]), breakdownUnit: 'убийство' });
    },
    drops: ['GOBLIN_EGG', 'GOBLIN_EGG_BLUE', 'GOBLIN_EGG_GREEN', 'GOBLIN_EGG_RED'],
  },
];

// ---------- разбор: шаги, риски, стартовый набор ----------
export const MINING_DETAILS = {
  'mining-mithril': {
    effort: 'semi', risk: 'low', xp: 'Опыт Mining и HotM, Powder Mithril, коммишны',
    steps: [
      'Открой Dwarven Mines (/warp mines) и возьми коммишны у Emissary или в меню Royal Pigeon.',
      'Копай Mithril в Royal Mines, Cliffside Veins или Rampart\'s Quarry: голубой Mithril самый прочный, серый — самый быстрый.',
      'В HotM качай Mining Speed, Mining Fortune и Titanium Insanium: Titanium стоит дороже Mithril.',
      'Сжимай в Enchanted Mithril и Enchanted Titanium (или Refined в Forge) и продавай на Bazaar, если так выгоднее.',
    ],
    risks: [
      'Денег мало: метод хорош как разгон HotM и Powder, а не как главный заработок.',
      'Во время Mining Fiesta цены на Mithril падают, потому что копают все.',
    ],
    kit: [{ text: 'Кирка или дрель для Mithril (Pickonimbus 2000, Mithril/Titanium Drill)', own: DRILLS, buy: ['PICKONIMBUS', 'MITHRIL_DRILL_1'] }],
  },
  gemstones: {
    effort: 'focus', risk: 'low', xp: 'Опыт Mining, Powder Gemstone (первые 2 500 гемов в день дают втрое больше)',
    steps: [
      'Выбери гем: сверху «Разбора» лучший по текущим ценам. Ruby есть по всей Crystal Hollows, Jade — Mithril Deposits, Amber — Goblin Holdout, Sapphire — Precursor Remnants, Amethyst — Jungle, Topaz — Magma Fields.',
      'Возьми гемовую дрель: нужна Breaking Power 6–9 и как можно больше Mining Speed, Gemstone Fortune и Pristine (каждый пункт Pristine — +1% шанс сразу получить Flawed, это 80 Rough).',
      'В HotM возьми Mining Speed Boost, а на HotM 10 — Gemstone Infusion или Sheer Force.',
      'Складывай в Gemstone Sack, сжимай до Fine или Flawless и продавай ордером на Bazaar в той форме, которую советует сайт.',
    ],
    risks: [
      'Доход зависит от скорости копания: без хорошей дрели он в 2–3 раза ниже расчёта.',
      'Жилы делишь с другими игроками, а мобы Crystal Hollows мешают копать.',
      'С патча 0.27.3 Ruby стал прочнее (2 500), а Jasper, Onyx и другие — мягче (4 000).',
    ],
  },
  'glacite-metals': {
    effort: 'focus', risk: 'low', xp: 'Опыт Mining, Powder Glacite',
    steps: [
      'Пройди квест Dulin «Beyond the Wall» на HotM 7, чтобы открыть Glacite Tunnels.',
      'Нужна Breaking Power 8+ и защита от холода: каждое очко Cold сверх твоей Cold Resistance режет Mining Speed на 0,5%, при 100 — смерть.',
      'Копай металл, который сейчас дороже (сверху «Разбора»). Перки Dwarven Fortune и Glacite Golem помогают.',
      'Продавай сжатым на Bazaar. Попутно лови вход в Mineshaft: там трупы с хорошим лутом.',
    ],
    risks: [
      'Холод: если не выходить погреться, скорость падает, а потом смерть.',
      'Спрос держится на крафте брони Dwarven Tunnels: после обновлений цена может просесть.',
    ],
  },
  'glacite-mineshaft': {
    effort: 'focus', risk: 'mid', xp: 'Опыт HotM (труп Lapis 100, Umber и Tungsten по 1 000, Vanguard 5 000), Powder Glacite',
    steps: [
      'Копай в Glacite Tunnels: примерно раз на 2 000 блоков открывается вход в Mineshaft (перки Surveyor и Tunnel Vision чаще).',
      'Заранее купи Umber Key и Tungsten Key и держи по одному в инвентаре: какой труп будет в шахте, заранее неизвестно. Для шахты Fairy нужен Skeleton Key.',
      'В шахте найди трупы: Lapis открывается без ключа, остальные ключом своего типа. Каждый игрок открывает труп один раз.',
      'Копай гемы в самой шахте, выходи (+1 000 Powder Glacite за выход) и продавай Fine гемы и Suspicious Scrap на Bazaar.',
      'Забирай награды за вехи у Grandpa Wolf (/corpsemilestones) и выбери цель RNG Meter: так каждый труп работает и на редкий дроп.',
    ],
    risks: [
      'Ключ тратится, а лут случайный: открывай Umber и Tungsten, только если ключ дешевле среднего лута (сайт это учитывает).',
      'Шахта бывает пустой на нужные трупы, а вход выпадает случайно.',
      'Лут Umber и Tungsten по таблице патча 0.24.2: вики с тех пор поправила часть весов, доход может немного отличаться.',
    ],
    kit: [{ text: 'Ключи для трупов', buy: ['UMBER_KEY', 'TUNGSTEN_KEY'], note: 'цена одного ключа' }],
  },
  'crystal-nucleus': {
    effort: 'focus', risk: 'mid', xp: 'Опыт HotM (800 за ран), опыт Mining',
    steps: [
      'Jade: в Mines of Divan найди Metal Detector\'ом 4 разные находки и отдай их Keeper\'ам.',
      'Amber: отдай любое Goblin Egg королю King Yolkar и за 20 минут дойди до Goblin Queen\'s Den (в воду не заходи).',
      'Amethyst: отдай Jungle Key стражу двери Jungle Temple и пройди паркур.',
      'Sapphire: отнеси Professor Robot в Lost Precursor City 6 разных деталей Automaton (или Precursor Apparatus).',
      'Topaz: помоги убить Bal в Khazad-dûm (Magma Fields). Затем поставь все 5 кристаллов в Crystal Nucleus и забери награду.',
      'Поставь цель RNG-метра: Crystal Nucleus Guide → Crystal Nucleus RNG Meter. Самая выгодная обычно Divan\'s Alloy: каждый ран копит 1000 очков, на 1 000 000 он выпадет гарантированно, а шанс растёт уже по ходу.',
    ],
    risks: [
      'Лут случайный: Divan Fragment выпадает примерно раз на 3 рана, а без него ран может уйти в минус.',
      'Основная часть дохода — Divan\'s Alloy: даже с RNG-метром он выпадает в среднем раз в ~500 ранов, до этого доход заметно ниже среднего.',
      'Детали Automaton и Jungle Key дорожают, когда много игроков делают раны.',
      'Пока не поставил последний кристалл, остальные можно забрать обратно: не теряй их в смерти от лавы.',
    ],
    kit: [
      { text: '6 деталей Automaton для Sapphire', buy: ['SYNTHETIC_HEART'], note: 'цена одной детали' },
      { text: 'Jungle Key для Amethyst', buy: ['JUNGLE_KEY'] },
      { text: 'Питомец Mole (+1 бросок и быстрее Jade/Sapphire)', own: ['PET_MOLE'] },
    ],
  },
  scatha: {
    effort: 'focus', risk: 'high', xp: 'Опыт Mining и Combat, Powder Gemstone',
    steps: [
      'Иди в Crystal Hollows и копай Hard Stone (лучше всего у Magma Fields) кирка с Pickobulus или дрелью.',
      'Каждый блок — шанс 1 на 600 вызвать червя, потом 30 секунд перерыв: копай без остановки.',
      'Убивай Stoneworm и Scatha быстро: у Scatha 10 ударов здоровья и сильный урон.',
      'Worm Membrane и гемы продавай на Bazaar, питомца Scatha — на аукционе.',
    ],
    risks: [
      'Почти весь доход — ожидаемая цена питомца Scatha (0,24% с одной Scatha): без него выходит мало.',
      'Scatha больно бьёт: без брони майнера легко умереть и потерять время.',
    ],
  },
  goblins: {
    effort: 'semi', risk: 'low', xp: 'Опыт Combat, бестиарий гоблинов',
    steps: [
      'Иди в Goblin Holdout (Crystal Hollows).',
      'Убивай сильных гоблинов (Flamethrower, Murderlover, Creeperlobber): у них шанс на яйца выше.',
      'Яйца продавай на Bazaar, одно оставь для кристалла Amber.',
    ],
    risks: [
      'Денег немного: синее яйцо (0,1%) делает основную часть дохода.',
      'Гоблинов делишь с другими игроками.',
    ],
  },
};
