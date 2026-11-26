// Заработок на Crimson Isle помимо Kuudra: мини-боссы, Magma Boss, Vanquisher, мобы острова, Sulphur, квесты фракции.
// Kuudra и лавовая рыбалка живут в других файлах (бой и рыбалка), здесь их нет.
//
// Источники (23.11.2026):
//  - таблицы дропов: NEU-REPO items/*_MINIBOSS.json, MAGMA_CUBE_BOSS.json, VANQUISHER_MONSTER.json, *_MONSTER.json (шансы и количество);
//  - Vanquisher (вики fandom, сверено 23.11.2026): шанс появления 1/640 за любое убийство на острове, после 640/960/1280 убийств
//    без него шанс ×2/×3/×4; дроп — 3 Nether Star тому, кто его вызвал (Bazaar-ID CORRUPTED_NETHER_STAR, NEU зовёт их Corrupted);
//  - мини-боссы и Magma Boss (вики, сверено 24.11.2026): лут каждому, кто нанёс 1 млн урона; 20 + 10 (70%) + 5 (50%) = 29,5 сырья;
//    Ashfang возрождается через 2 минуты после смерти, Magma Boss появляется каждые 2 минуты во всех лобби, Hot Kuudra Key с него 8%;
//  - квесты фракции (вики Faction_Quests): Ⓓ–Ⓢ дают 2–20 тыс. опыта Combat, 30–125 репутации, 20–60 Bits и случайный материал;
//  - Sulphur Ore: NEU-REPO mining/blocks/sulphur.json (губка, Breaking Power 8, прочность 500), рецепты Enchanted Sulphur (160) и Cube (160);
//  - вход на остров с Combat 24, ключи Kuudra Co-op Soulbound: server/guides/crimson-data.js.
// Сколько убийств или блоков в час — оценка (в API этого нет): поэтому везде диапазон «осторожно — обычно».
// Цены живые: Bazaar по стакану, аукцион — по реальным продажам (sellValue), доход каждого предмета ограничен спросом.

import { sellValue, DEMAND_SHARE } from './flips.js';
import { nameOf } from './util.js';
import { KUUDRA_KEYS } from '../guides/crimson-data.js';
import { tx } from '../../i18n/msg.js';

const M = 1_000_000;
const lvl = (o) => Number(o?.level || 0);
const skill = (m, k) => lvl(m?.skills?.[k]);
const fmtN = n => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const fmtM = n => tx`${(n / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
// Крупные суммы — в миллионах, мелкие — целым числом (без «тыс.», чтобы не ставить две точки в конце фразы)
const fmtK = n => (n >= 100_000 ? fmtM(n) : fmtN(n));
const need = (label, cur, min, extra = {}) => ({ text: tx`${label} ${min}+`, ok: cur >= min, have: tx`у тебя ${fmtN(cur)}`, ...extra });

/** Нагрудники, с которыми мини-боссов и мобов острова убивают без мучений. */
const COMBAT_ARMOR = ['*CRIMSON_CHESTPLATE', '*AURORA_CHESTPLATE', '*TERROR_CHESTPLATE', '*FERVOR_CHESTPLATE', '*HOLLOW_CHESTPLATE',
  'POWER_WITHER_CHESTPLATE', 'WISE_WITHER_CHESTPLATE', 'TANK_WITHER_CHESTPLATE', 'SPEED_WITHER_CHESTPLATE', 'FINAL_DESTINATION_CHESTPLATE', 'SHADOW_ASSASSIN_CHESTPLATE'];
/** Оружие по площади для фарма мобов (у Vanquisher и мобов острова много здоровья, а бегать от моба к мобу — медленно). */
const AOE_WEAPONS = ['HYPERION', 'VALKYRIE', 'SCYLLA', 'ASTRAEA', 'TERMINATOR', 'JUJU_SHORTBOW', 'MIDAS_STAFF', 'SPIRIT_SCEPTRE', 'GIANTS_SWORD'];

/** Дрели с Breaking Power 8+ (лор NEU: тир 1 Titanium/Gemstone — 7, тир 2 — 8, тиры 3–4 — 9, Divan — 10). */
const SULPHUR_DRILLS = ['TITANIUM_DRILL_2', 'TITANIUM_DRILL_3', 'TITANIUM_DRILL_4', 'GEMSTONE_DRILL_2', 'GEMSTONE_DRILL_3', 'GEMSTONE_DRILL_4', 'DIVAN_DRILL'];

// ---------- таблицы дропов (NEU-REPO) ----------
// q — сколько штук в среднем за раз, c — шанс (0..1). Предметы с шансом меньше 0,01% (краски) не учитываем: на доход в час они не влияют.
const d = (id, q, c = 1) => ({ id, q, c });
const KEY_DROPS = (basic, hot) => [d('KUUDRA_TIER_KEY', 1, basic), d('KUUDRA_HOT_TIER_KEY', 1, hot)];

export const MINIBOSS_LOOT = {
  ASHFANG: { name: 'Ashfang', where: 'руины за Пустошами', drops: [d('BLAZE_ROD', 29.5), d('ENCHANTED_BLAZE_POWDER', 1), d('LUMINO_FIBER', 1), d('MAGMA_URCHIN', 1, 0.02), d('FIRE_VEIL_WAND', 1, 0.005), ...KEY_DROPS(0.06, 0.04)] },
  BLADESOUL: { name: 'Bladesoul', where: 'Stronghold', drops: [d('ESSENCE_CRIMSON', 25), d('COAL', 29.5), d('ENCHANTED_COAL', 1), d('HALLOWED_SKULL', 1), d('MAGMA_URCHIN', 1, 0.02), d('RAGNAROCK_AXE', 1, 0.005), ...KEY_DROPS(0.06, 0.04)] },
  BARBARIAN_DUKE_X: { name: 'Barbarian Duke X', where: 'у Dragontail', drops: [d('ESSENCE_CRIMSON', 25), d('PORK', 29.5), d('ENCHANTED_PORK', 1), d('LEATHER_CLOTH', 1), d('MAGMA_URCHIN', 1, 0.02), d('FLAMING_FIST', 1, 0.005), ...KEY_DROPS(0.06, 0.04)] },
  MAGE_OUTLAW: { name: 'Mage Outlaw', where: 'за стенами Scarleton', drops: [d('ESSENCE_CRIMSON', 25), d('GLOWSTONE_DUST', 29.5), d('ENCHANTED_GLOWSTONE_DUST', 1), d('SPELL_POWDER', 1), d('MAGMA_URCHIN', 1, 0.02), d('FIRE_FREEZE_STAFF', 1, 0.005), d('WAND_OF_STRENGTH', 1, 0.005), ...KEY_DROPS(0.06, 0.04)] },
};

export const MAGMA_BOSS_LOOT = [d('MAGMA_CREAM', 29.5), d('ENCHANTED_MAGMA_CREAM', 1), d('COMPACT_OOZE', 1), d('REKINDLED_EMBER_FRAGMENT', 1),
  d('MAGMA_URCHIN', 1, 0.02), d('MOLTEN_CUBE', 1, 0.005), d('FIRE_FURY_STAFF', 1, 0.005), d('MAGMA_CUBE;3', 1, 0.015), d('MAGMA_CUBE;4', 1, 0.004),
  ...KEY_DROPS(0.12, 0.08)];

// Вики: Vanquisher даёт 3 Nether Star тому, кто его вызвал (это CORRUPTED_NETHER_STAR; ванильная NETHER_STAR — другой предмет)
export const VANQUISHER_LOOT = [d('CORRUPTED_NETHER_STAR', 3)];

/** Шанс Vanquisher за убийство (вики): 1/640, после 640, 960 и 1280 убийств без него — ×2, ×3, ×4. */
export const VANQUISHER_BASE = 1 / 640;
/** Сколько в среднем убийств на одного Vanquisher с учётом этой защиты от невезения; mult — бонусы (питомец Kuudra ×1,2 и т.п.). */
export function killsPerVanquisher(mult = 1) {
  let alive = 1, sum = 0;
  for (let k = 0; k < 20_000 && alive > 1e-9; k++) {
    sum += alive;
    alive *= 1 - Math.min(1, VANQUISHER_BASE * mult * (k >= 1280 ? 4 : k >= 960 ? 3 : k >= 640 ? 2 : 1));
  }
  return sum;
}

// Мобы острова: kph — сколько убийств в час с оружием по площади [осторожно, обычно]. Высокоуровневые блейзы редкие и толстые.
export const MOB_LOOT = [
  { id: 'WITHER_SKELETON', name: 'Wither Skeleton', where: 'Stronghold и The Wasteland', kph: [400, 800], drops: [d('COAL', 8.5), d('BONE', 8), d('WITHER_SOUL', 1, 0.2), d('ENCHANTED_COAL', 2, 0.05), d('ENCHANTED_BONE', 1, 0.05), d('ENCHANTED_CHARCOAL', 1, 0.01), d('RAMPART_CHESTPLATE', 1, 0.01)] },
  { id: 'WITHER_SPECTRE', name: 'Wither Spectre', where: 'Stronghold', kph: [400, 800], drops: [d('SULPHUR', 1), d('SPECTRE_DUST', 1, 0.2), d('RAMPART_HELMET', 1, 0.025)] },
  { id: 'BLAZE', name: 'Blaze', where: 'Burning Desert', kph: [400, 800], drops: [d('BLAZE_ROD', 1), d('BLAZE_ASHES', 1, 0.2), d('RAMPART_BOOTS', 1, 0.025)] },
  { id: 'MUTATED_BLAZE', name: 'Mutated Blaze', where: 'Burning Desert', kph: [300, 600], drops: [d('BLAZE_ROD', 4), d('MUTATED_BLAZE_ASHES', 1, 0.2), d('RAMPART_BOOTS', 1, 0.025)] },
  { id: 'BEZAL', name: 'Bezal', where: 'Burning Desert', kph: [300, 600], drops: [d('BLAZE_ROD', 4), d('BEZOS', 1, 0.1), d('RAMPART_BOOTS', 1, 0.025)] },
  { id: 'SMOLDERING_BLAZE', name: 'Smoldering Blaze', where: 'Smoldering Tomb', kph: [200, 400], drops: [d('BLAZE_ROD', 8), d('ENCHANTED_BLAZE_POWDER', 1, 0.05), d('BLAZE_ASHES', 1, 0.025)] },
  { id: 'MILLENIA_AGED_BLAZE', name: 'Millennia-Aged Blaze', where: 'Smoldering Tomb', kph: [40, 80], drops: [d('BLAZE_ROD', 16), d('ENCHANTED_BLAZE_POWDER', 1, 0.2), d('BLAZE_ASHES', 1, 0.1), d('MILLENIA_OLD_BLAZE_ASHES', 1, 0.05), d('NETHERRACK_LOOKING_SUNSHADE', 1, 0.01), d('ENCHANTED_BLAZE_ROD', 1, 0.001)] },
  { id: 'MAGMA_CUBE', name: 'Magma Cube', where: 'Magma Chamber и Burning Desert', kph: [400, 800], drops: [d('MAGMA_CREAM', 1), d('MAGMA_CHUNK', 1, 0.2), d('ENCHANTED_MAGMA_CREAM', 1, 0.01), d('RAMPART_LEGGINGS', 1, 0.025)] },
  { id: 'MAGMA_CUBE_RIDER', name: 'Magma Cube Rider', where: 'Dragontail', kph: [300, 600], drops: [d('PORK', 8), d('MAGMA_CREAM', 8), d('MAGMA_CHUNK', 1, 0.2), d('ENCHANTED_PORK', 1, 0.05), d('ENCHANTED_MAGMA_CREAM', 1, 0.05), d('SWORD_OF_BAD_HEALTH', 1, 0.025)] },
  { id: 'KADA_KNIGHT', name: 'Kada Knight', where: 'Dragontail', kph: [300, 600], drops: [d('PORK', 1), d('FEATHER', 1), d('RAW_CHICKEN', 1), d('KADA_LEAD', 1, 0.2), d('ENCHANTED_PORK', 1, 0.05), d('ENCHANTED_FEATHER', 1, 0.05), d('ENCHANTED_RAW_CHICKEN', 1, 0.05)] },
  { id: 'FLAMING_SPIDER', name: 'Flaming Spider', where: 'Burning Desert', kph: [400, 800], drops: [d('STRING', 8), d('SPIDER_EYE', 8), d('BURNING_EYE', 1, 0.2), d('ENCHANTED_STRING', 1, 0.05), d('ENCHANTED_SPIDER_EYE', 1, 0.05)] },
];

// Ключи Kuudra Co-op Soulbound: продать нельзя, но они заменяют покупку у Emissary. Из коэффициентов доход не считаем.
const SOULBOUND = new Set(['KUUDRA_TIER_KEY', 'KUUDRA_HOT_TIER_KEY']);

/**
 * Доход с дропов в час с учётом спроса.
 * mode 'instant' — продаём сразу (осторожная оценка), 'offer' — ордером или по медиане продаж аукциона (обычная).
 * Предмет аукциона, который продаётся реже двух раз в сутки, в доход не идёт: продать его быстро не выйдет.
 * Сколько штук в час реально продать: Bazaar — 3% оборота, аукцион — 15% продаж (как в крафт-флипах).
 * @returns {{ perHour: number, perKill: number, rows: object[], unpriced: string[], capped: string[] }}
 */
export function dropIncome(ctx, drops, killsPerHour, mode = 'offer') {
  const rows = [], unpriced = [], capped = [];
  let perHour = 0, perKill = 0;
  // Один предмет с разных боссов складываем, иначе спрос посчитался бы несколько раз
  const merged = new Map();
  for (const x of drops) {
    const prev = merged.get(x.id);
    merged.set(x.id, prev ? { id: x.id, q: 1, c: prev.q * prev.c + x.q * x.c } : x);
  }
  for (const x of merged.values()) {
    if (SOULBOUND.has(x.id)) continue;
    let sv = sellValue(ctx, x.id, mode);
    let ah = sv?.market === 'Auction House';
    if (ah && !(sv.sold24h >= 2)) sv = null;
    // NPC скупает без ограничений: если у NPC дороже (или рынка нет) — продаём ему
    const npc = ctx.npc?.get(x.id) || 0;
    if (npc && npc >= (sv?.net || 0)) { sv = { net: npc, market: 'NPC', volumeDay: Infinity }; ah = false; }
    if (!sv?.net) { unpriced.push(nameOf(ctx, x.id)); continue; }
    const unitsHour = x.q * x.c * killsPerHour;
    const demandHour = sv.market === 'NPC' ? Infinity : (sv.volumeDay || 0) * (ah ? DEMAND_SHARE.auction : DEMAND_SHARE.bazaar) / 24;
    const sold = Math.min(unitsHour, demandHour);
    if (sold < unitsHour * 0.999) capped.push(nameOf(ctx, x.id));
    const value = sold * sv.net;
    perHour += value;
    perKill += x.q * x.c * sv.net;
    rows.push({ id: x.id, name: nameOf(ctx, x.id), unit: sv.net, perHour: value, chance: x.c, market: sv.market });
  }
  rows.sort((a, b) => b.perHour - a.perHour);
  return { perHour, perKill, rows, unpriced, capped };
}

/** Осторожная и обычная оценка: меньше убийств и мгновенная продажа против обычного темпа и ордеров. */
function band(ctx, drops, [low, usual]) {
  const lo = dropIncome(ctx, drops, low, 'instant');
  const hi = dropIncome(ctx, drops, usual, 'offer');
  return { lo, hi };
}

/** Во сколько обходится ключ Kuudra у Emissary: монеты + материалы фракции + 2 Nether Star (вики). */
export function keyCost(ctx, tier, faction) {
  const k = KUUDRA_KEYS.find(x => x.tier === tier);
  if (!k) return null;
  const matId = /mage/.test(String(faction || '')) ? 'ENCHANTED_MYCELIUM' : 'ENCHANTED_RED_SAND';
  const mat = ctx.bazaar.get(matId);
  const star = ctx.bazaar.get('CORRUPTED_NETHER_STAR');
  return k.coins + (mat?.buy ? mat.buy * k.mat : 0) + (star?.buy ? star.buy * 2 : 0);
}

const topRows = (rows, n = 3) => rows.filter(r => r.perHour > 0).slice(0, n).map(r => ({ id: r.id, name: r.name, perHour: r.perHour }));
const limits = (r) => [
  r.capped.length ? tx`Упёрлись в спрос: ${r.capped.slice(0, 3).join(', ')}.` : '',
  r.unpriced.length ? tx`Не считаем (нет цены или почти не продаётся): ${r.unpriced.slice(0, 4).join(', ')}${r.unpriced.length > 4 ? ' и другие' : ''}.` : '',
].filter(Boolean).join(' ');

export const CRIMSON_METHODS = [
  {
    id: 'crimson-minibosses', title: 'Мини-боссы Crimson Isle', tag: 'Crimson Isle', mode: 'active',
    desc: 'Обходишь по кругу Ashfang, Bladesoul, Barbarian Duke X и Mage Outlaw. С каждого — эссенция Crimson и материалы, редко Ragnarock Axe, Flaming Fist или Fire Veil Wand, плюс шанс на бесплатный ключ Kuudra.',
    req: m => [need('Combat', skill(m, 'combat'), 24),
      { text: 'Броня Crimson Isle или сильнее', ok: hasAnyLocal(m, COMBAT_ARMOR), soft: true, buy: ['CRIMSON_CHESTPLATE', 'AURORA_CHESTPLATE'] }],
    compute: (ctx, m) => {
      const KPH = [8, 14];
      const all = Object.values(MINIBOSS_LOOT);
      // Боссы чередуются: берём среднее по четырём на одно убийство
      const avg = all.flatMap(b => b.drops.map(x => ({ ...x, q: x.q / all.length })));
      const { lo, hi } = band(ctx, avg, KPH);
      if (!hi.perHour) return null;
      const per = all.map(b => ({ b, v: dropIncome(ctx, b.drops, 1, 'offer').perKill })).sort((a, b) => b.v - a.v);
      const hot = keyCost(ctx, 'hot', m?.crimson?.faction);
      return {
        coinsPerHour: hi.perHour, range: [lo.perHour, hi.perHour],
        detail: tx`Считаем ${KPH[0]}–${KPH[1]} убийств в час (боссы возрождаются по одному, их делят с другими игроками в лобби). Дороже всего сейчас ${per[0].b.name} (≈${fmtK(per[0].v)} за убийство), дешевле ${per[per.length - 1].b.name} (≈${fmtK(per[per.length - 1].v)}). Ключи Kuudra (4–6% с босса) продать нельзя, но ключ Hot у Emissary стоит ≈${fmtK(hot || 400_000)}: если ходишь в Kuudra, это бесплатная экономия. ${limits(hi)}`.trim(),
        top: topRows(hi.rows),
      };
    },
    drops: ['ESSENCE_CRIMSON', 'MAGMA_URCHIN', 'RAGNAROCK_AXE', 'FLAMING_FIST', 'FIRE_VEIL_WAND'],
  },
  {
    id: 'crimson-magma-boss', title: 'Magma Boss', tag: 'Crimson Isle', mode: 'active',
    desc: 'Огромный куб в Magma Chamber внутри вулкана. Появляется каждые 2 минуты, бьют всем лобби, награда каждому, кто нанёс 1 млн урона. Ключи Kuudra падают вдвое чаще, чем с мини-боссов; редко Fire Fury Staff, Molten Cube и питомец Magma Cube.',
    req: m => [need('Combat', skill(m, 'combat'), 24),
      { text: 'Броня Crimson Isle или сильнее', ok: hasAnyLocal(m, COMBAT_ARMOR), soft: true, buy: ['CRIMSON_CHESTPLATE', 'AURORA_CHESTPLATE'] }],
    compute: (ctx, m) => {
      const KPH = [4, 8];
      const { lo, hi } = band(ctx, MAGMA_BOSS_LOOT, KPH);
      if (!hi.perHour) return null;
      const basic = keyCost(ctx, 'basic', m?.crimson?.faction), hot = keyCost(ctx, 'hot', m?.crimson?.faction);
      const keysHour = KPH[1] * (0.12 * (basic || 200_000) + 0.08 * (hot || 400_000));
      return {
        coinsPerHour: hi.perHour, range: [lo.perHour, hi.perHour],
        detail: tx`Считаем ${KPH[0]}–${KPH[1]} убийств в час: босс появляется каждые 2 минуты (во всех лобби одновременно), а бой с фазами деления идёт несколько минут. Лут получает каждый, кто нанёс 1 млн урона. Сейчас одно убийство даёт ≈${fmtK(dropIncome(ctx, MAGMA_BOSS_LOOT, 1, 'offer').perKill)}. Ключи Kuudra (12% Basic, 8% Hot) экономят ещё ≈${fmtK(keysHour)} в час, если ходишь в Kuudra: в доход не включено. ${limits(hi)}`.trim(),
        top: topRows(hi.rows),
      };
    },
    drops: ['MAGMA_CREAM', 'MAGMA_URCHIN', 'MOLTEN_CUBE', 'FIRE_FURY_STAFF', 'MAGMA_CUBE;4'],
  },
  {
    id: 'crimson-vanquisher', title: 'Охота на Vanquisher', tag: 'Crimson Isle', mode: 'active',
    desc: 'Vanquisher иногда появляется, когда убиваешь мобов или Sea Creatures на Crimson Isle (шанс 1 из 640). С него падают 3 Nether Star: на них покупают ключи Kuudra у эмиссара и крафтят Vanquished-аксессуары. Обычно совмещают с фармом мобов острова.',
    req: m => [need('Combat', skill(m, 'combat'), 24),
      { text: 'Оружие по площади (Hyperion, Terminator, Midas Staff)', ok: hasAnyLocal(m, AOE_WEAPONS), soft: true, buy: ['JUJU_SHORTBOW', 'MIDAS_STAFF'] }],
    compute: (ctx) => {
      // Убийств в час — как у быстрого фарма мобов острова (оценка), Vanquisher в час — по шансу с вики
      const KPH = [400, 800];
      const per = killsPerVanquisher(), perBoost = killsPerVanquisher(1.2 * 1.1);
      const VPH = KPH.map(k => k / per);
      const { lo, hi } = band(ctx, VANQUISHER_LOOT, VPH);
      if (!hi.perHour) return null;
      const f1 = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
      return {
        coinsPerHour: hi.perHour, range: [lo.perHour, hi.perHour],
        detail: tx`Шанс Vanquisher — 1 из 640 за убийство, а после 640, 960 и 1280 убийств подряд без него он растёт в 2, 3 и 4 раза (вики). В среднем это один Vanquisher на ${fmtN(per)} убийств: при ${fmtN(KPH[0])}–${fmtN(KPH[1])} убийствах в час — ${f1(VPH[0])}–${f1(VPH[1])} Vanquisher. Питомец Kuudra (до ×1,2) и перк Wither Piper в Essence Shop (×1,1) сокращают это до ${fmtN(perBoost)} убийств. Один Vanquisher сейчас стоит ≈${fmtK(dropIncome(ctx, VANQUISHER_LOOT, 1, 'offer').perKill)} (3 Nether Star). Дроп самих мобов смотри в методе «Мобы Crimson Isle», он складывается с этим. ${limits(hi)}`.trim(),
        top: topRows(hi.rows),
      };
    },
    drops: ['CORRUPTED_NETHER_STAR'],
  },
  {
    id: 'crimson-mobs', title: 'Мобы Crimson Isle', tag: 'Crimson Isle', mode: 'active',
    desc: 'Фарм обычных мобов острова оружием по площади: Wither Skeleton, блейзы, Magma Cube Rider, Kada Knight, Flaming Spider. Выбираем моба, с которого сейчас выгоднее всего продавать дроп; заодно появляются Vanquisher.',
    req: m => [need('Combat', skill(m, 'combat'), 24),
      { text: 'Оружие по площади (Hyperion, Terminator, Midas Staff)', ok: hasAnyLocal(m, AOE_WEAPONS), soft: true, buy: ['JUJU_SHORTBOW', 'MIDAS_STAFF'] }],
    compute: (ctx) => {
      const list = MOB_LOOT.map(mob => ({ mob, ...band(ctx, mob.drops, mob.kph) })).filter(x => x.hi.perHour > 0)
        .sort((a, b) => b.hi.perHour - a.hi.perHour);
      if (!list.length) return null;
      const best = list[0];
      return {
        coinsPerHour: best.hi.perHour, range: [best.lo.perHour, best.hi.perHour],
        detail: tx`Выгоднее всего сейчас ${best.mob.name} (${best.mob.where}): ${best.mob.kph[0]}–${best.mob.kph[1]} убийств в час, ≈${fmtK(best.hi.perKill)} за убийство. Дальше: ${list.slice(1, 3).map(x => tx`${x.mob.name} ≈${fmtK(x.hi.perHour)} в час`).join(', ')}. Vanquisher, которые появятся по ходу, сверху. ${limits(best.hi)}`.trim(),
        top: list.slice(0, 3).map(x => ({ id: x.hi.rows[0]?.id || x.mob.id, name: x.mob.name, perHour: x.hi.perHour })),
      };
    },
    drops: ['WITHER_SOUL', 'BLAZE_ROD', 'MAGMA_CHUNK', 'KADA_LEAD', 'BURNING_EYE'],
  },
  {
    id: 'crimson-sulphur', title: 'Добыча Sulphur', tag: 'Crimson Isle', mode: 'active',
    desc: 'После извержения вулкана по Crimson Isle разбросаны губки Sulphur Ore: копаешь их (нужна сила ломания 8). Ещё Sulphur падает с порченых мобов и лавовой рыбалки. Enchanted Sulphur Cube — один из крупнейших рынков Bazaar: его берут на топливо и крафты острова. Продаём в той форме, где выгоднее.',
    req: m => [need('Combat', skill(m, 'combat'), 24),
      { text: 'Дрель с силой ломания 8+ (Titanium/Gemstone Drill тира 2 и выше, Divan)', ok: hasAnyLocal(m, SULPHUR_DRILLS), soft: true, buy: ['TITANIUM_DRILL_2', 'GEMSTONE_DRILL_2'] }],
    compute: (ctx, m) => {
      const UPH = [1500, 3000]; // штук Sulphur в час с учётом Mining Fortune
      const forms = [['SULPHUR_ORE', 1], ['ENCHANTED_SULPHUR', 160], ['ENCHANTED_SULPHUR_CUBE', 25_600]];
      const pick = (mode) => {
        const opts = forms.map(([id, n]) => {
          const sv = sellValue(ctx, id, mode);
          return sv?.net && sv.market === 'Bazaar' ? { id, n, unit: sv.net / n, demandUnitsHour: sv.volumeDay * DEMAND_SHARE.bazaar / 24 * n } : null;
        }).filter(Boolean);
        const npc = ctx.npc?.get('SULPHUR_ORE') || 0;
        if (npc) opts.push({ id: 'NPC', n: 1, unit: npc, demandUnitsHour: Infinity });
        return opts.sort((a, b) => b.unit - a.unit);
      };
      const income = (units, mode) => {
        let left = units, sum = 0;
        for (const o of pick(mode)) { const take = Math.min(left, o.demandUnitsHour); sum += take * o.unit; left -= take; if (left <= 0) break; }
        return sum;
      };
      const best = pick('offer')[0];
      if (!best) return null;
      const have = Number(m?.collections?.SULPHUR_ORE || 0);
      const formName = best.id === 'NPC' ? 'NPC' : tx`${nameOf(ctx, best.id)} на Bazaar`;
      return {
        coinsPerHour: income(UPH[1], 'offer'), range: [income(UPH[0], 'instant'), income(UPH[1], 'offer')],
        detail: tx`Sulphur Ore (губка) рассыпается по острову после извержения вулкана, с блока падает 1 Sulphur, больше с Mining Fortune (вики). Одна штука Sulphur сейчас ≈${best.unit.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} монет (выгоднее продавать как ${formName}). Считаем ${fmtN(UPH[0])}–${fmtN(UPH[1])} штук в час: точная скорость зависит от дрели и Mining Fortune. Cube = 160 Enchanted Sulphur = 25 600 Sulphur.${have ? tx` Твоя коллекция Sulphur: ${fmtN(have)}.` : ''}`,
        top: pick('offer').filter(o => o.id !== 'NPC').slice(0, 3).map(o => ({ id: o.id, name: nameOf(ctx, o.id), perHour: Math.min(UPH[1], o.demandUnitsHour) * o.unit })),
      };
    },
    drops: ['SULPHUR_ORE', 'ENCHANTED_SULPHUR', 'ENCHANTED_SULPHUR_CUBE'],
  },
  {
    id: 'crimson-quests', title: 'Квесты фракции', tag: 'Crimson Isle', mode: 'daily',
    desc: 'До пяти заданий в день на доске своего города (Dragontail или Scarleton): мини-босс, принести предметы, рыбалка, спасение пленника, Dojo, Kuudra. Монет нет, но каждое задание даёт опыт Combat, 30–125 репутации, 20–60 Bits и случайный материал (Lumino Fiber, Hallowed Skull, Bezos и др.). Репутация открывает тиры Kuudra и ключи у Emissary.',
    req: m => {
      const rep = Math.max(Number(m?.crimson?.barbarianRep || 0), Number(m?.crimson?.mageRep || 0));
      return [need('Combat', skill(m, 'combat'), 24),
        { text: 'Выбрана фракция', ok: !!m?.crimson?.faction, have: m?.crimson?.faction ? (/mage/.test(m.crimson.faction) ? 'Mages' : 'Barbarians') : 'ещё не выбрана' },
        { text: 'Репутация 12 000 (тир Infernal)', ok: rep >= 12_000, soft: true, have: tx`у тебя ${fmtN(rep)}` }];
    },
    drops: ['ESSENCE_CRIMSON', 'ENCHANTED_RED_SAND', 'ENCHANTED_MYCELIUM'],
  },
];

// hasAny из methods.js импортировать нельзя (циклический импорт: methods.js подключает этот файл), поэтому своя копия по тем же правилам.
function hasAnyLocal(m, patterns) {
  const ids = new Set();
  const walk = v => {
    if (!v) return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (typeof v === 'object') { if (typeof v.id === 'string') { ids.add(v.id); return; } for (const x of Object.values(v)) walk(x); }
  };
  if (m?._ownedIds) for (const id of m._ownedIds) ids.add(id);
  else for (const k of ['inventory', 'armor', 'equipment', 'wardrobe', 'enderChest', 'vault', 'backpacks', 'quiver', 'fishingBag']) walk(m?.inv?.[k]);
  return patterns.some(p => {
    if (p.startsWith('*')) { const s = p.slice(1); for (const id of ids) if (id.endsWith(s)) return true; return false; }
    if (p.endsWith('*')) { const s = p.slice(0, -1); for (const id of ids) if (id.startsWith(s)) return true; return false; }
    return ids.has(p);
  });
}
