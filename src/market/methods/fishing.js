// Методы заработка на рыбалке: доход считается по таблице Sea Creatures (веса и дропы с вики) и живым ценам.
// Подключается в methods.js (FISHING_METHODS) и method-details.js (FISHING_DETAILS) одной строкой.
//
// Как считаем доход одного существа: вероятность поймать его = вес / сумма весов доступных тебе существ в этом месте
// (с учётом уровня Fishing и наград Odger). Дальше по каждому дропу: шанс × количество × цена продажи.
// Цена — мгновенная продажа на Bazaar или медиана продаж аукциона с налогом. Если за час выпадает больше,
// чем рынок покупает (3% оборота Bazaar, 15% продаж аукциона), лишнее считаем по цене NPC или не считаем вовсе.
// Сколько существ ловится в час, в API нет: берём осторожный и хороший темп для каждого места (SC_PER_HOUR).
import { sellValue, buyPrice, DEMAND_SHARE } from '../flips.js';
import { nameOf } from '../util.js';
import { hasAny } from '../methods.js';
import { sbDate } from '../../calendar/time.js';
import { SEA_CREATURES, TROPHY_LOCKED } from './fishing-data.js';
import { tx } from '../../../i18n/msg.js';

const M = 1_000_000;
const lvl = o => Number(o?.level || 0);
const fishingLvl = m => lvl(m?.skills?.fishing);
const fmtN = n => Number(n || 0).toLocaleString('ru-RU');
const fmtM = n => tx`${(n / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
const fmtK = n => (Math.abs(n) >= M ? fmtM(n) : Math.abs(n) >= 1000 ? tx`${Math.round(n / 1000).toLocaleString('ru-RU')} тыс.` : fmtN(Math.round(n)));
const pct = x => tx`${(x * 100).toLocaleString('ru-RU', { maximumFractionDigits: x < 0.01 ? 2 : 1 })}%`;
const need = (label, cur, min, extra = {}) => ({ text: tx`${label} ${min}+`, ok: cur >= min, have: tx`у тебя ${fmtN(cur)}`, ...extra });

/** Награды Odger по трофеям из профиля: Novice — 15 видов от бронзы, Adept — все 18 от серебра. */
export function trophyRanks(m) {
  const t = m?.fishing?.trophyTiers?.tiers || {};
  const bronze = Number(t.bronze?.atLeast || 0), silver = Number(t.silver?.atLeast || 0);
  // Существ открывает не сам улов, а забранная у Odger награда (1 — Novice, 2 — Adept).
  // Если API отдал список забранных наград, верим ему; если нет — судим по улову, как раньше.
  const raw = m?.fishing?.trophyFish?.rewards;
  const rewards = Array.isArray(raw) ? raw.map(Number) : null;
  const noviceReady = bronze >= 15, adeptReady = silver >= 18;
  return {
    novice: rewards ? rewards.includes(1) : noviceReady,
    adept: rewards ? rewards.includes(2) : adeptReady,
    noviceReady, adeptReady, rewardsKnown: !!rewards, bronze, silver,
  };
}
const combatLvl = m => lvl(m?.skills?.combat);
// Лава — только на Crimson Isle, а туда пускают с Combat 24 (server/guides/crimson-data.js)
const crimsonAccess = m => ({ ...need('Combat', combatLvl(m), 24), text: 'Combat 24+ (вход на Crimson Isle)' });

/**
 * Сколько чистыми приносит одна штука, если продавать units штук в час.
 * Bazaar — мгновенная продажа (ордера на покупку), аукцион — не дороже медианы реальных продаж.
 * Сверх спроса рынка остаток идёт NPC (если NPC его покупает) — так тонкий рынок не раздувает доход.
 */
export function dropUnitValue(ctx, ids, unitsPerHour = 0) {
  const list = Array.isArray(ids) ? ids : [ids];
  const id = list.find(x => ctx.bazaar.has(x) || ctx.bin.has(x)) || list[0];
  const npc = Number(ctx.npc?.get(id) || 0);
  const s = sellValue(ctx, id, ctx.bazaar.has(id) ? 'instant' : 'offer');
  if (!s?.net || s.net <= npc) return { id, unit: npc, market: npc ? 'NPC' : null, capped: false, volumeDay: s?.volumeDay ?? 0 };
  const share = s.market === 'Bazaar' ? DEMAND_SHARE.bazaar : DEMAND_SHARE.auction;
  // у аукциона без продаж за сутки спрос неизвестен: считаем, что получится продать одну штуку в день
  const perHourMax = Math.max(s.volumeDay * share, s.market === 'Bazaar' ? 0 : 1) / 24;
  // реже раза в сутки рынок всегда купит: дорогой редкий дроп лимит спроса не режет
  if (unitsPerHour <= perHourMax || unitsPerHour <= 1 / 24) return { id, unit: s.net, market: s.market, capped: false, volumeDay: s.volumeDay };
  const unit = (perHourMax * s.net + (unitsPerHour - perHourMax) * npc) / unitsPerHour;
  return { id, unit, market: s.market, capped: true, volumeDay: s.volumeDay };
}

/** Какие существа доступны игроку в этих местах: уровень Fishing и награды Odger. */
export function creaturePool(m, zones, { lvl: lv = fishingLvl(m), ranks = trophyRanks(m), weightMul = {} } = {}) {
  const set = new Set(zones);
  return SEA_CREATURES.filter(c => set.has(c.zone) && c.lvl <= lv && (!TROPHY_LOCKED[c.name] || ranks[TROPHY_LOCKED[c.name]]))
    .map(c => ({ ...c, w0: c.w, w: c.w * (weightMul[c.zone] || 1) }));
}

/**
 * Доход с Sea Creatures в час при scPerHour существах в час.
 * @returns {{ perHour: number, perSc: number, xpPerHour: number, drops: object[], creatures: object[] }}
 */
export function poolIncome(ctx, pool, scPerHour) {
  const W = pool.reduce((s, c) => s + c.w, 0);
  if (!W || !scPerHour) return { perHour: 0, perSc: 0, xpPerHour: 0, drops: [], creatures: [] };
  // сначала собираем, сколько штук каждого предмета падает в час, чтобы проверить спрос по сумме со всех существ
  const units = new Map();
  for (const c of pool) {
    const share = c.w / W;
    for (const [ids, count, chance] of c.drops) {
      const key = Array.isArray(ids) ? ids.join('|') : ids;
      const u = units.get(key) || { ids, perHour: 0, events: 0 };
      u.perHour += scPerHour * share * count * chance;
      u.events += scPerHour * share * chance; // сколько раз в час дроп выпадает (стопка считается одним разом)
      units.set(key, u);
    }
  }
  const value = new Map();
  for (const [key, u] of units) value.set(key, { ...dropUnitValue(ctx, u.ids, u.perHour), perHourUnits: u.perHour, eventsPerHour: u.events });
  const drops = [...value.values()].map(v => ({ ...v, coinsPerHour: v.unit * v.perHourUnits })).filter(d => d.coinsPerHour > 0)
    .sort((a, b) => b.coinsPerHour - a.coinsPerHour);
  const creatures = pool.map(c => {
    const share = c.w / W;
    const perKill = c.drops.reduce((s, [ids, count, chance]) => s + count * chance * (value.get(Array.isArray(ids) ? ids.join('|') : ids)?.unit || 0), 0);
    return { name: c.name, share, perHour: scPerHour * share, perKill, coinsPerHour: scPerHour * share * perKill };
  }).sort((a, b) => b.coinsPerHour - a.coinsPerHour);
  const perHour = drops.reduce((s, d) => s + d.coinsPerHour, 0);
  const xpPerHour = pool.reduce((s, c) => s + scPerHour * (c.w / W) * c.xp, 0);
  return { perHour, perSc: perHour / scPerHour, xpPerHour, drops, creatures };
}

/**
 * Темп: Sea Creatures в час для осторожной и хорошей игры. Числа — оценка: личный лимит существ (5 в Crimson Isle,
 * 20 в Crystal Hollows), время на убийство крупных существ и переходы между Хотспотами.
 */
export const SC_PER_HOUR = {
  water: [150, 300], bayou: [150, 300], hotspot: [110, 220], lava: [90, 170], lavaHotspot: [80, 150],
  hollows: [150, 280], galatea: [120, 240], spooky: [150, 300], winter: [150, 300], festival: [150, 300], trophy: [40, 80],
};
/** Шанс Sea Creature за улов, чтобы перевести существ в число забросов (для расхода наживки). */
const SCC = 0.5;

/**
 * Сокровища (вики «Fishing/List of Drops», «Treasure Chance», сверено 23.11.2026): если на улове не попалось существо,
 * с шансом Treasure Chance выпадает сокровище — 90% Good Catch, 10% Great Catch. Предмет выбирается по весу из пула.
 * Treasure Chance базово 0,1 за уровень Fishing (5 на 50), сверху удочка (Luck of the Sea до +3,5), Golden Bait (+4) и т.п.
 * Монеты, наживка, пластинки и питомцы стоят в пуле, но в доход не идут (их количество или цену не узнать).
 */
export const TREASURE = {
  water: { good: [88, [['GOLDEN_APPLE', 10], ['GRAND_EXP_BOTTLE', 10], ['PRISMARINE_SHARD', 5], ['PRISMARINE_CRYSTALS', 5], ['SEA_LANTERN', 8], ['SPONGE', 5]]],
    great: [1042, [['ENCHANTED_CLAY_BALL', 160], ['ENCHANTED_DIAMOND', 240], ['ENCHANTED_GOLD', 160], ['ENCHANTED_GOLDEN_APPLE', 160], ['ENCHANTED_IRON', 160], ['ENCHANTED_PUFFERFISH', 80], ['TITANIC_EXP_BOTTLE', 40]]] },
  lava: { good: [48, [['GRAND_EXP_BOTTLE', 5], ['SILVER_MAGMAFISH', 3]]],
    great: [1230, [['ENCHANTED_COAL', 170], ['ENCHANTED_BLAZE_POWDER', 300], ['LAVA_SHELL', 150], ['ENCHANTED_MAGMA_CREAM', 400], ['ENCHANTED_NETHER_STALK', 170], ['TITANIC_EXP_BOTTLE', 40]]] },
};
const LAVA_ZONES = new Set(['lava', 'lavaHotspot', 'hollowsLava', 'trophy']);

/** Средняя цена одного сокровища и сокровищ в час при scPerHour существах и Treasure Chance tc (в процентах). */
export function treasureIncome(ctx, kind, scPerHour, tc) {
  const t = TREASURE[kind];
  const unit = id => { const v = sellValue(ctx, id, 'instant'); const npc = Number(ctx.npc?.get(id) || 0); return Math.max(v?.net || 0, npc); };
  const pool = ([total, items]) => items.reduce((s, [id, w]) => s + (w / total) * unit(id), 0);
  const perTreasure = 0.9 * pool(t.good) + 0.1 * pool(t.great);
  const treasures = scPerHour * (1 - SCC) / SCC * (tc / 100);
  return { perTreasure, treasures, perHour: perTreasure * treasures };
}

/**
 * Наживки, которые меняют, каких существ ловишь (вики «Sea Creature Weight»): множитель веса по существу.
 * Остальные наживки (Hot Bait — трофеи, Worm Bait — только черви) на деньги с существ здесь не влияют.
 */
export const BAIT_WEIGHT = {
  WHALE_BAIT: c => (c.w0 < 400 ? 1.25 : 1),
  HOTSPOT_BAIT: c => (c.zone === 'hotspot' || c.zone === 'lavaHotspot' ? 1.5 : 1),
  SPOOKY_BAIT: c => (c.zone === 'spooky' ? 1.15 : 1),
  SHARK_BAIT: c => (c.zone === 'festival' ? 1.2 : 1),
};

/** Расход наживки в час: одна на заброс, забросов ≈ существ / шанс существа. */
function baitCost(ctx, baitId, scPerHour) {
  if (!baitId) return 0;
  const p = buyPrice(ctx, baitId, 'order');
  return (p?.price || 0) * scPerHour / SCC;
}

/**
 * Общий расчёт метода: доход по пулу существ на трёх темпах. Наживку считаем, только если она окупается:
 * сравниваем «с наживкой» (её множитель веса минус её цена) и «без неё» и берём лучшее.
 * @returns {object|null} то, что ждёт moneyMethods от compute: coinsPerHour, range, detail, top
 */
function fishCompute(ctx, m, { zones, pace, bait, weightMul, intro, extra }) {
  const base = creaturePool(m, zones, { weightMul });
  if (!base.length) return null;
  const [lo, hi] = SC_PER_HOUR[pace];
  const mid = (lo + hi) / 2;
  const run = (pool, baitId) => [lo, mid, hi].map(n => {
    const r = poolIncome(ctx, pool, n);
    const cost = baitCost(ctx, baitId, n);
    return { ...r, cost, net: Math.max(0, r.perHour - cost) };
  });
  // Сокровища сверху: Treasure Chance только от уровня Fishing (удочку и наживку из профиля не видно)
  const tc = Math.min(5, fishingLvl(m) * 0.1);
  const tKind = zones.some(z => LAVA_ZONES.has(z)) ? 'lava' : 'water';
  let res = run(base, null), usedBait = null;
  const mul = bait && BAIT_WEIGHT[bait];
  if (mul) {
    const withBait = run(base.map(c => ({ ...c, w: c.w * mul(c) })), bait);
    if (withBait[1].net > res[1].net) { res = withBait; usedBait = bait; }
  }
  for (const [i, n] of [lo, mid, hi].entries()) { const tr = treasureIncome(ctx, tKind, n, tc); res[i] = { ...res[i], treasure: tr, net: res[i].net + tr.perHour }; }
  const [a, b, c] = res;
  if (!b.perHour) return null;
  const top = b.drops.slice(0, 5).map(d => ({ id: d.id, name: nameOf(ctx, d.id), perHour: Math.round(d.coinsPerHour) }));
  const capped = b.drops.filter(d => d.capped).slice(0, 2).map(d => nameOf(ctx, d.id));
  const rare = b.creatures.filter(x => x.share < 0.02 && x.perKill > 0).slice(0, 3)
    .map(x => tx`${x.name} примерно ${(x.perHour).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} в час, ${fmtK(x.perKill)} монет за штуку`);
  const parts = [
    intro,
    tx`Существ в час: ${lo}–${hi} (оценка темпа), одно в среднем приносит ${fmtK(b.perSc)} монет.`,
    tx`Больше всего денег: ${top.slice(0, 3).map(t => tx`${t.name} (${fmtK(t.perHour)} в час)`).join(', ')}.`,
    rare.length ? tx`Редкие: ${rare.join('; ')}.` : '',
    usedBait ? tx`С наживкой ${nameOf(ctx, usedBait)}: она стоит ${fmtK(b.cost)} в час, это уже вычтено.`
      : mul && bait ? tx`Наживка ${nameOf(ctx, bait)} сейчас не окупается: посчитано без неё.` : '',
    capped.length ? tx`Рынок не берёт весь улов: ${capped.join(', ')}. Лишнее посчитано по цене NPC.` : '',
    tc > 0 ? tx`Сокровища: на уловах без существа шанс ${tc.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% (0,1 за уровень Fishing), одно в среднем ${fmtK(b.treasure.perTreasure)} — это ≈${fmtK(b.treasure.perHour)} в час, уже в доходе. Luck of the Sea на удочке и Golden Bait поднимают шанс.` : '',
    tx`Опыт Fishing: около ${fmtN(Math.round(b.xpPerHour / 1000) * 1000)} в час без бонусов к опыту.`,
    extra || '',
  ];
  if (!b.net) return null;
  // Разбор для окна метода: шанс предмета на одно существо, цена, вклад и раз в сколько часов выпадает (редкие — отдельно)
  const breakdown = b.drops.slice(0, 14).map(d => {
    // шанс получить дроп с одного существа и сколько штук в стопке — отдельно (Yeti: 1% и 24 Enchanted Raw Fish, а не 24%)
    const chance = Math.min(1, d.eventsPerHour / mid);
    const qty = d.eventsPerHour > 0 ? d.perHourUnits / d.eventsPerHour : 1;
    return { id: d.id, name: nameOf(ctx, d.id), chance, qty, unit: Math.round(d.unit), perKill: Math.round(d.perHourUnits / mid * d.unit),
      perHour: Math.round(d.coinsPerHour), everyHours: d.eventsPerHour > 0 ? 1 / d.eventsPerHour : null, rare: chance < 0.05 };
  });
  return { coinsPerHour: b.net, range: [a.net, c.net], detail: parts.filter(Boolean).join(' '), top, breakdown, breakdownUnit: 'существо' };
}

/** Есть ли у игрока удочка для лавы (без неё лаву не половишь). */
const LAVA_RODS = ['STARTER_LAVA_ROD', 'POLISHED_TOPAZ_ROD', 'MAGMA_ROD', 'INFERNO_ROD', 'HELLFIRE_ROD'];
const GOOD_LAVA_RODS = ['MAGMA_ROD', 'INFERNO_ROD', 'HELLFIRE_ROD'];
const WATER_RODS = ['ROD_OF_THE_SEA', 'LEGEND_ROD', 'CHAMP_ROD', 'ROD_OF_LEGENDS', 'ROD_OF_CHAMPIONS', 'GIANT_FISHING_ROD'];

/** Идёт ли событие сейчас по календарю SkyBlock: Spooky Festival — 29–31 Autumn, Jerry's Workshop — весь Late Winter. */
function eventNow(now, id) {
  const d = sbDate(now ?? Date.now());
  if (id === 'spooky') return d.month === 7 && d.day >= 29;
  if (id === 'winter') return d.month === 11;
  if (id === 'festival') return d.day <= 3; // Fishing Festival — первые 3 дня каждого месяца (server/calendar/events.js)
  return false;
}
const eventReq = (o, id, label) => {
  const on = eventNow(o?.now, id);
  // Не идёт — не «ошибка требований», а «жди события»: помечаем как неизвестное, чтобы метод не попадал в цели плана
  return { text: label, ok: on, unknown: !on, have: on ? 'идёт сейчас' : 'сейчас не идёт, смотри «События»' };
};

export const FISHING_METHODS = [
  {
    id: 'fish-crimson-lava', title: 'Лава Crimson Isle: Thunder и Lord Jawbus', tag: 'Fishing', mode: 'active',
    desc: 'Ловишь лавовых Sea Creatures в Crimson Isle. Основной доход — Magma Lord Fragment с Lord Jawbus, Thunder Fragment с Thunder и броня существ. Thunder открывает награда Odger Novice, Lord Jawbus — Adept.',
    req: m => {
      const r = trophyRanks(m);
      return [need('Fishing', fishingLvl(m), 27), crimsonAccess(m),
        { text: 'Удочка для лавы (Magma, Inferno, Hellfire Rod)', ok: hasAny(m, GOOD_LAVA_RODS), soft: true, buy: ['MAGMA_ROD', 'INFERNO_ROD'] },
        { text: 'Награда Odger Novice (15 видов трофеев от бронзы): открывает Thunder', ok: r.novice, soft: true, have: r.noviceReady && !r.novice ? 'условие выполнено, забери награду у Odger' : tx`видов от бронзы: ${r.bronze} из 18` },
        { ...need('Fishing', fishingLvl(m), 45), text: 'Fishing 45+ и награда Odger Adept (все 18 от серебра): открывает Lord Jawbus', ok: fishingLvl(m) >= 45 && r.adept, soft: true, have: r.adeptReady && !r.adept ? tx`у тебя Fishing ${fishingLvl(m)}; условие Adept выполнено, забери награду у Odger` : tx`у тебя Fishing ${fishingLvl(m)}, видов от серебра: ${r.silver} из 18` }];
    },
    compute: (ctx, m) => {
      const r = trophyRanks(m);
      const locked = [!r.novice && 'Thunder (нужна награда Novice)', !(r.adept && fishingLvl(m) >= 45) && 'Lord Jawbus (нужны Fishing 45 и награда Adept)'].filter(Boolean);
      let extra = '';
      if (locked.length) {
        const full = poolIncome(ctx, creaturePool(m, ['lava'], { lvl: Math.max(45, fishingLvl(m)), ranks: { novice: true, adept: true } }), 130);
        extra = tx`Пока закрыты: ${locked.join(', ')}. С ними было бы ≈${fmtM(full.perHour)} в час.`;
      }
      return fishCompute(ctx, m, { zones: ['lava'], pace: 'lava', bait: null,
        intro: 'Лимит — 5 своих существ одновременно, поэтому убивай сразу.', extra });
    },
    drops: ['MAGMA_LORD_FRAGMENT', 'THUNDER_SHARDS', 'FLAMING_HEART', 'ORB_OF_ENERGY', 'RADIOACTIVE_VIAL'],
  },
  {
    id: 'fish-lava-hotspot', title: 'Лавовые Хотспоты: Fiery Scuttler и Ragnarok', tag: 'Fishing', mode: 'active',
    desc: 'Хотспот — временное пятно с частицами на лаве Crimson Isle. В нём к обычным лавовым существам добавляются Fried Chicken, Fireproof Witch, Fiery Scuttler (с Fishing 37) и мифический Ragnarok (с Fishing 47).',
    req: m => [need('Fishing', fishingLvl(m), 37), crimsonAccess(m),
      { text: 'Удочка для лавы (Magma, Inferno, Hellfire Rod)', ok: hasAny(m, GOOD_LAVA_RODS), soft: true, buy: ['MAGMA_ROD', 'INFERNO_ROD'] },
      { text: 'Hotspot Hook или Hotspot Bait (существа Хотспота в 1,5–2 раза чаще)', ok: hasAny(m, ['HOTSPOT_HOOK']), soft: true, buy: ['HOTSPOT_HOOK'] }],
    // Hotspot Hook ×2 к весу существ Хотспота, если он есть у игрока
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['lava', 'lavaHotspot'], pace: 'lavaHotspot', bait: 'HOTSPOT_BAIT',
      weightMul: { lavaHotspot: hasAny(m, ['HOTSPOT_HOOK']) ? 2 : 1 },
      intro: hasAny(m, ['HOTSPOT_HOOK']) ? 'Посчитано с твоим Hotspot Hook: существа Хотспота вдвое чаще.' : 'Без Hotspot Hook: с ним существа Хотспота попадались бы вдвое чаще.' }),
    drops: ['SCORCHED_CRAB_STICK', 'BRIMSTONE_HANDLE', 'CHAIN_END_TIMES', 'BURNT_TEXTS', 'SCUTTLER_SHELL'],
  },
  {
    id: 'fish-water-hotspot', title: 'Водные Хотспоты: Blue Ringed Octopus и Wiki Tiki', tag: 'Fishing', mode: 'active',
    desc: 'Хотспоты на воде Hub, Spider\'s Den и Backwater Bayou. К обычным водным существам добавляются Frog Man, Snapping Turtle, Blue Ringed Octopus (с Fishing 35) и мифический Wiki Tiki (с Fishing 40).',
    req: m => [need('Fishing', fishingLvl(m), 35),
      { text: 'Водная удочка (Rod of the Sea, Rod of Legends)', ok: hasAny(m, WATER_RODS), soft: true, buy: ['ROD_OF_THE_SEA'] },
      { text: 'Hotspot Hook (существа Хотспота вдвое чаще)', ok: hasAny(m, ['HOTSPOT_HOOK']), soft: true, buy: ['HOTSPOT_HOOK'] }],
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['water', 'hotspot'], pace: 'hotspot', bait: 'HOTSPOT_BAIT',
      weightMul: { hotspot: hasAny(m, ['HOTSPOT_HOOK']) ? 2 : 1 },
      intro: 'Хотспот живёт несколько минут и переезжает: часть времени уходит на переходы (Hotspot Radar показывает ближайший).' }),
    drops: ['BLUE_RING', 'TIKI_MASK', 'TROUBLED_BUBBLE', 'OCTOPUS_TENDRIL', 'EDIBLE_SEAWEED'],
  },
  {
    id: 'fish-bayou', title: 'Backwater Bayou: Titanoboa и Alligator', tag: 'Fishing', mode: 'active',
    desc: 'Болото Backwater Bayou (вход из Hub). Свои существа: Trash Gobbler, Dumpster Diver, Banshee, Bayou Sludge, Alligator и мифический Titanoboa с Titanoboa Shed. Плюс обычные водные существа.',
    req: m => [need('Fishing', fishingLvl(m), 5),
      { text: 'Водная удочка (Rod of the Sea, Rod of Legends)', ok: hasAny(m, WATER_RODS), soft: true, buy: ['ROD_OF_THE_SEA'] }],
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['water', 'bayou'], pace: 'bayou', bait: 'WHALE_BAIT',
      intro: 'Считаем, что в Bayou клюют и обычные водные существа.' }),
    drops: ['TITANOBOA_SHED', 'ALLIGATOR_SKIN', 'CALCIFIED_HEART', 'OVERFLOWING_TRASH_CAN', 'POISON_SAMPLE'],
  },
  {
    id: 'fish-water', title: 'Обычная вода: Water Hydra', tag: 'Fishing', mode: 'active',
    desc: 'Рыбалка в любой воде (обычно у Hub или на своём острове). Денег немного: главное — опыт Fishing, Sponge, книги вроде Luck of the Sea VI и голова Water Hydra.',
    req: m => [need('Fishing', fishingLvl(m), 1),
      { text: 'Водная удочка (Rod of the Sea, Rod of Legends)', ok: hasAny(m, WATER_RODS), soft: true, buy: ['ROD_OF_THE_SEA'] }],
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['water'], pace: 'water', bait: 'WHALE_BAIT',
      intro: 'На своём острове шанс Sea Creature ниже, поэтому лови в Hub.' }),
    drops: ['WATER_HYDRA_HEAD', 'ENCHANTMENT_LUCK_OF_THE_SEA_6', 'SPONGE', 'FISH_AFFINITY_TALISMAN'],
  },
  {
    id: 'fish-hollows', title: 'Crystal Hollows: черви и лава Magma Fields', tag: 'Fishing', mode: 'active',
    desc: 'В воде Goblin Holdout ловятся Water Worm и Poisoned Water Worm (янтарь), в Mithril Deposits и Precursor Remnants — Abyssal Miner (три вида гемов). Лава: Flaming Worm (сапфир), в Magma Fields — Lava Blaze и Lava Pigman (топаз, Magma Core).',
    req: m => [need('Fishing', fishingLvl(m), 15),
      { text: 'Доступ в Crystal Hollows (Crystal Hollows Pass или HotM)', ok: !!m?.mining?.hotm, soft: true, unknown: !m?.mining },
      { text: 'Удочка для лавы для Magma Fields', ok: hasAny(m, LAVA_RODS), soft: true, buy: ['MAGMA_ROD'] }],
    compute: (ctx, m) => {
      const water = poolIncome(ctx, creaturePool(m, ['hollows']), 215);
      const lava = poolIncome(ctx, creaturePool(m, ['hollowsLava']), 215);
      const useLava = lava.perHour > water.perHour && hasAny(m, LAVA_RODS);
      return fishCompute(ctx, m, { zones: [useLava ? 'hollowsLava' : 'hollows'], pace: 'hollows', bait: null,
        intro: useLava ? 'Сейчас выгоднее лава (Flaming Worm, Lava Blaze, Lava Pigman).' : 'Сейчас выгоднее вода: черви с Worm Bait (клюют только черви) и Abyssal Miner.',
        extra: tx`Вода ≈${fmtM(water.perHour)} в час, лава ≈${fmtM(lava.perHour)} в час при среднем темпе. Лимит — 20 своих существ, удобно собирать пачкой и бить по площади.` });
    },
    drops: ['WORM_MEMBRANE', 'MAGMA_CORE', 'ETERNAL_FLAME_RING', 'BLAZEN_SPHERE', 'FLAWED_JADE_GEM'],
  },
  {
    id: 'fish-galatea', title: 'Galatea: Loch Emperor и Nessie', tag: 'Fishing', mode: 'active',
    desc: 'Вода острова Galatea: Bogged, Wetwing, Tadgang, Ent, The Loch Emperor (Emperor\'s Skull, питомец Flying Fish) и Nessie (Mangcore, Vibrant Coral). Лава Galatea — Stridersurfer.',
    req: m => [need('Fishing', fishingLvl(m), 5),
      { text: 'Остров Galatea открыт', ok: false, unknown: true, have: 'по профилю не видно' }],
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['galatea'], pace: 'galatea', bait: 'WHALE_BAIT',
      intro: 'Лимит Sea Creatures на сервере Galatea ниже обычного (около 30), в людных лобби меньше поймаешь.' }),
    drops: ['MANGCORE', 'DIVER_FRAGMENT', 'VIBRANT_CORAL', 'MOUND_OF_SEAGRASS', 'FLYING_FISH;4'],
  },
  {
    id: 'fish-spooky', title: 'Spooky Festival: Grim Reaper и конфеты', tag: 'Fishing', mode: 'active',
    desc: 'Три дня SkyBlock (1 реальный час) в конце осени в любой воде ловятся Scarecrow, Nightmare, Werewolf, Phantom Fisher и Grim Reaper. Конфеты, Deep Sea Orb, Spooky Hook, Bobbin\' Scriptures.',
    req: (m, o) => [need('Fishing', fishingLvl(m), 9), eventReq(o, 'spooky', 'Идёт Spooky Festival')],
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['water', 'spooky'], pace: 'spooky', bait: 'SPOOKY_BAIT',
      weightMul: { spooky: hasAny(m, ['PHANTOM_HOOK']) ? 2 : 1 },
      intro: hasAny(m, ['PHANTOM_HOOK']) ? 'Посчитано с твоим Spooky Hook: хэллоуинские существа вдвое чаще.' : 'Без Spooky Hook: с ним хэллоуинские существа попадались бы вдвое чаще.' }),
    drops: ['DEEP_SEA_ORB', 'PHANTOM_HOOK', 'PURPLE_CANDY', 'GREEN_CANDY', 'BOBBIN_SCRIPTURES'],
  },
  {
    id: 'fish-winter', title: "Jerry's Workshop: Yeti и Reindrake", tag: 'Fishing', mode: 'active',
    desc: "Весь Late Winter (около 10 часов) открыт остров Jerry: Frozen Steve, Frosty, Grinch, Nutcracker, Yeti (питомец Baby Yeti) и Reindrake (подарки, книга Prosperity). Ice Essence продаётся и идёт в перки.",
    req: (m, o) => [need('Fishing', fishingLvl(m), 1), eventReq(o, 'winter', "Открыт Jerry's Workshop")],
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['winter'], pace: 'winter', bait: null,
      intro: 'Лови в воде пещеры острова.' }),
    drops: ['ESSENCE_ICE', 'RED_GIFT', 'BABY_YETI;3', 'HILT_OF_TRUE_ICE', 'ENCHANTMENT_PROSPERITY_1'],
  },
  {
    id: 'fish-festival', title: 'Fishing Festival: акулы', tag: 'Fishing', mode: 'active',
    desc: 'Когда у мэра Marina перк Fishing Festival, первые 3 дня каждого месяца SkyBlock в любой воде ловятся акулы: Shark Fin, зубы и питомец Megalodon.',
    req: (m, o) => [need('Fishing', fishingLvl(m), 5),
      (() => {
        // Фестиваль даёт перк Fishing Festival — у мэра или министра Marina (как в календаре событий), а не само имя мэра
        const perks = Array.isArray(o.perks) && o.perks.length ? o.perks : null;
        const perk = perks ? perks.includes('Fishing Festival') : !!o.mayor && /marina/i.test(o.mayor);
        const on = perk && eventNow(o.now, 'festival');
        return { text: 'Идёт Fishing Festival (перк Marina, дни 1–3 месяца)', ok: on, unknown: !on,
          have: !perks && !o.mayor ? 'мэр пока неизвестен' : !perk ? 'сейчас ни у мэра, ни у министра нет перка Fishing Festival' : on ? 'идёт сейчас' : 'перк Fishing Festival есть, но фестиваль только в первые 3 дня месяца' };
      })()],
    compute: (ctx, m) => fishCompute(ctx, m, { zones: ['water', 'festival'], pace: 'festival', bait: 'SHARK_BAIT',
      weightMul: { festival: hasAny(m, ['SHARK_SCALE_CHESTPLATE']) ? 1.25 : 1 },
      intro: hasAny(m, ['SHARK_SCALE_CHESTPLATE']) ? 'Посчитано с твоей Shark Scale Armor: акулы на 25% чаще.' : 'Shark Scale Armor сделала бы акул на 25% чаще.' }),
    drops: ['GREAT_WHITE_SHARK_TOOTH', 'TIGER_SHARK_TOOTH', 'SHARK_FIN', 'MEGALODON;4'],
  },
  {
    id: 'trophy', title: 'Trophy Fishing', tag: 'Fishing', mode: 'active',
    desc: 'Lava Fishing в Crimson Isle ради Trophy Fish: прогресс наград Odger (они открывают Thunder и Lord Jawbus), Magmafish за разделку и продажа золотых и алмазных трофеев. Денег меньше, чем охота на существ.',
    req: m => [need('Fishing', fishingLvl(m), 30),
      { text: 'Удочка для лавы (Magma, Inferno, Hellfire Rod)', ok: hasAny(m, GOOD_LAVA_RODS), soft: true, buy: ['MAGMA_ROD'] }],
    compute: (ctx, m) => {
      // Трофеи не ловят существ специально: считаем лаву на медленном темпе плюс текущие цены редких трофеев для справки
      const TROPHY = ['GOLDEN_FISH_DIAMOND', 'GOLDEN_FISH_GOLD', 'OBFUSCATED_FISH_3_DIAMOND', 'KARATE_FISH_DIAMOND', 'MOLDFIN_DIAMOND', 'SOUL_FISH_DIAMOND', 'SKELETON_FISH_DIAMOND', 'VANILLE_DIAMOND'];
      const prices = TROPHY.map(id => ({ id, v: dropUnitValue(ctx, id, 0) })).filter(x => x.v.unit > 0 && x.v.market !== 'NPC')
        .sort((a, b) => b.v.unit - a.v.unit).slice(0, 3);
      const ranks = trophyRanks(m);
      return fishCompute(ctx, m, { zones: ['lava'], pace: 'trophy', bait: null,
        intro: 'Сюда входят только Sea Creatures, пойманные по пути; трофеи в основном идут на разделку у Odger и в награды.',
        extra: [prices.length ? tx`Дороже всего сейчас продаются: ${prices.map(p => tx`${nameOf(ctx, p.id)} ${fmtK(p.v.unit)}`).join(', ')}.` : '',
          tx`Твои награды Odger: ${ranks.adept ? 'Adept получен' : ranks.novice ? tx`Novice есть, для Adept не хватает серебра у ${18 - ranks.silver} видов` : tx`для Novice нужно ещё ${Math.max(0, 15 - ranks.bronze)} видов от бронзы`}.`].filter(Boolean).join(' ') });
    },
    drops: ['MAGMA_FISH_SILVER', 'MAGMA_FISH_GOLD', 'GOLDEN_FISH_DIAMOND', 'OBFUSCATED_FISH_3_DIAMOND'],
  },
];

// Удочки и крючки уже есть в требованиях (req с buy), а moneyMethods складывает покупки из req и kit:
// чтобы не считать одну удочку дважды, в kit их не дублируем
const fishKit = [];
const lavaKit = [];

export const FISHING_DETAILS = {
  'fish-crimson-lava': {
    effort: 'focus', risk: 'mid', xp: 'Много опыта Fishing (Jawbus — 40 000 за штуку), бестиарий',
    steps: [
      'Сначала открой существ: награда Novice у Odger (15 видов трофеев от бронзы) даёт Thunder, Adept (все 18 от серебра) и Fishing 45 — Lord Jawbus.',
      'Возьми лавовую удочку (Inferno или Hellfire Rod) с Shredded Line, сет для лавы (Thunder или Magma Lord Armor) и оружие против существ.',
      'Лови в лаве Crimson Isle (удобно у Blazing Volcano или в Plhlegblast Pool). Свой лимит — 5 существ, поэтому убивай сразу.',
      'Thunder и Lord Jawbus сильные: держи лечение и не лови толпу рядом с ними. Другие игроки первые 5 секунд почти не наносят им урон.',
      'Magma Lord Fragment, Thunder Fragment, Flaming Heart и Orb of Energy продавай на Bazaar, броню существ (Taurus Helmet, Flaming Chestplate) — на аукционе.',
    ],
    risks: [
      'Lord Jawbus при малом уроне легко убивает и сбивает лимит существ.',
      'Основной доход держится на редких существах: за час может не выпасть ни одного Jawbus.',
      'С патча 0.27.3 Thunder Fragment и Magma Lord Fragment выпадают с шансом 50% вместо 100% (по анонсу Hypixel; на вики ещё 100%). В расчёте уже 50%.',
    ],
    kit: lavaKit,
  },
  'fish-lava-hotspot': {
    effort: 'focus', risk: 'mid', xp: 'Опыт Fishing, бестиарий редких существ',
    steps: [
      'Найди Хотспот на лаве Crimson Isle: это пятно с частицами, Hotspot Radar показывает ближайший.',
      'Поставь Hotspot Hook и Hotspot Sinker у Roddy, положи Hotspot Bait в Fishing Bag.',
      'Лови так, чтобы поплавок падал внутрь пятна: тогда бонусы Хотспота действуют.',
      'Fiery Scuttler и Ragnarok очень живучие: нужен хороший урон. Ragnarok даёт Brimstone Handle, Chain of the End Times и Burnt Texts.',
      'Хотспот исчезает через несколько минут: переходи к следующему.',
    ],
    risks: ['Ragnarok выпадает редко (вес 5), без удачи доход сильно ниже среднего.', 'Редкие дропы продаются на аукционе медленно, цена может проседать.'],
    kit: lavaKit,
  },
  'fish-water-hotspot': {
    effort: 'focus', risk: 'mid', xp: 'Опыт Fishing',
    steps: [
      'Найди водный Хотспот (Hub, Spider\'s Den, Backwater Bayou), помогает Hotspot Radar.',
      'Поставь Hotspot Hook, Hotspot Sinker и возьми Hotspot Bait.',
      'Лови внутри пятна: Blue Ringed Octopus даёт Blue Ring, мифический Wiki Tiki — Tiki Mask и Troubled Bubble.',
      'Edible Seaweed и Broken Radar продавай на аукционе.',
    ],
    risks: ['Wiki Tiki и Tiki Mask редкие: доход скачет от часа к часу.', 'Хотспот переезжает, часть времени уходит на поиск.'],
    kit: fishKit,
  },
  'fish-bayou': {
    effort: 'semi', risk: 'low', xp: 'Опыт Fishing, бестиарий Bayou',
    steps: [
      'Иди в Backwater Bayou (вход из Hub) и лови в воде болота.',
      'Возьми Whale Bait: он поднимает шанс редких существ.',
      'Alligator даёт Alligator Skin, Banshee — Calcified Heart, мифический Titanoboa — Titanoboa Shed.',
      'Мусор вроде Overflowing Trash Can и Bronze Bowl тоже продаётся: проверяй цену на аукционе.',
    ],
    risks: ['Titanoboa редкий (вес 10): основной доход от него — удача.', 'Дешёвые дропы (глина, рыба) почти ничего не стоят.'],
    kit: fishKit,
  },
  'fish-water': {
    effort: 'semi', risk: 'low', xp: 'Опыт Fishing — главный плюс метода',
    steps: [
      'Встань у воды в Hub (на своём острове шанс существа ниже).',
      'Возьми водную удочку, Whale Bait и сет на Sea Creature Chance.',
      'Собирай существ пачкой и бей по площади: так выше темп.',
      'Продавай Sponge, книги Luck of the Sea VI и Water Hydra Head, остальное — сжатыми формами на Bazaar.',
    ],
    risks: ['Денег мало: метод больше ради опыта.', 'Лимит существ на сервере — 60, в людном лобби меньше поймаешь.'],
    kit: fishKit,
  },
  'fish-hollows': {
    effort: 'semi', risk: 'low', xp: 'Опыт Fishing, немного гемов для HotM',
    steps: [
      'Зайди в Crystal Hollows. Для червей: вода в Goblin Holdout, наживка Worm Bait (клюют только черви).',
      'Для лавы: Precursor Remnants (Flaming Worm) или Magma Fields (Lava Blaze и Lava Pigman с Magma Core).',
      'Лимит — 20 своих существ: собирай пачку и бей по площади.',
      'Rough-гемы сжимай в Flawed/Fine и продавай на Bazaar, Worm Membrane — на Bazaar.',
    ],
    risks: ['Цены гемов после патча 0.27.3 упали, доход зависит от них.', 'Пропуск в Crystal Hollows нужно продлевать.'],
    kit: [],
  },
  'fish-galatea': {
    effort: 'semi', risk: 'low', xp: 'Опыт Fishing, бестиарий Galatea',
    steps: [
      'Открой остров Galatea (продолжение Foraging) и лови в его воде.',
      'The Loch Emperor даёт Emperor\'s Skull и питомца Flying Fish, Nessie — Mangcore, Mound of Seagrass и Vibrant Coral.',
      'Sea Lumies и Mangrove Log сжимай и продавай на Bazaar или используй для крафта Diver\'s Armor.',
    ],
    risks: ['Лимит существ на сервере Galatea около 30: в людном лобби ловится меньше.', 'Редкие дропы Nessie выпадают нечасто.'],
    kit: fishKit,
  },
  'fish-spooky': {
    effort: 'focus', risk: 'low', xp: 'Опыт Fishing (Grim Reaper — 3 950 за штуку)',
    steps: [
      'Дождись Spooky Festival (29–31 Autumn, время видно в «Событиях»).',
      'Поставь Spooky Hook, возьми Spooky Bait и лови в любой воде (ночью конфет больше).',
      'Убивай Grim Reaper и Phantom Fisher первыми: с них Deep Sea Orb, Spooky Hook и Bobbin\' Scriptures.',
      'Конфеты меняй у Fear Mongerer в Hub или продавай на Bazaar.',
    ],
    risks: ['Событие длится всего час реального времени.', 'Цены конфет во время фестиваля падают: продавай позже.'],
    kit: fishKit,
  },
  'fish-winter': {
    effort: 'semi', risk: 'low', xp: 'Опыт Fishing (Yeti — 4 050 за штуку)',
    steps: [
      'Пока открыт Jerry\'s Workshop (весь Late Winter), лови в воде острова.',
      'Возьми Frozen Bait: Yeti и Reindrake попадаются чаще.',
      'Yeti даёт питомца Baby Yeti и Hilt of True Ice, Reindrake — подарки и книгу Prosperity.',
      'Ice Essence продавай на Bazaar или трать на перки, подарки открывай или продавай.',
    ],
    risks: ['Остров открыт только около 10 часов в году SkyBlock (раз в 5 реальных суток).', 'Reindrake сильный, нужен хороший урон.'],
    kit: fishKit,
  },
  'fish-festival': {
    effort: 'semi', risk: 'low', xp: 'Опыт Fishing',
    steps: [
      'Когда мэр Marina, первые 3 дня каждого месяца SkyBlock идёт Fishing Festival.',
      'Возьми Shark Bait и лови в любой воде: появляются Nurse, Blue, Tiger и Great White Shark.',
      'Shark Fin и зубы продавай на Bazaar или крафти Shark Scale Armor, питомца Megalodon — на аукционе.',
    ],
    risks: ['Бывает только при мэре Marina.', 'Во время фестиваля Shark Fin дешевеет: много кто ловит.'],
    kit: fishKit,
  },
  trophy: {
    effort: 'semi', risk: 'low', xp: 'Опыт Fishing, прогресс наград Odger',
    steps: [
      'Иди в Crimson Isle к лавовым озёрам, возьми лавовую удочку и Hot Bait.',
      'Лови виды по условиям из гайда «Трофейная рыбалка» (у вулкана, у серы, в Dojo и т.д.).',
      'Трофеи сдавай Odger: награды Novice и Adept открывают Thunder и Lord Jawbus, это главный денежный шаг.',
      'Лишние трофеи разделывай у Odger на Magmafish, золотые и алмазные редких видов продавай на аукционе.',
    ],
    risks: ['Сами трофеи приносят немного: метод больше ради наград Odger.', 'Алмазный тир — 0,2% за бросок, удача решает.'],
    kit: lavaKit,
  },
};
