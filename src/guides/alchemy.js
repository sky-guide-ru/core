// Potions и Alchemy: какие зелья держать под занятие, God Potion и Booster Cookie, Mixins, как варить,
// как качать Alchemy и что выгоднее — сварить зелье или купить.
// Сверено 28.11.2026: hypixelskyblock.minecraft.wiki (Alchemy, Potions, God_Potion, Booster_Cookie, Mixins,
// Brewing_Stand, Tutorial:Alchemy_Guide) и описания зелий в NEU (POTION_<ID>;<уровень>, POTION_DUNGEON;7).
import { fmt, short, plural, cell, topNext, bestPet } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';
import { extractRecipes, marketId, ahNet } from '../market/util.js';
import { ownedCount } from '../lib/owned.js';
import { estimateFarmingFortune } from '../market/methods.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const R = n => ROMAN[n] || String(n);

// Опыт Alchemy до уровня (всего), вики Alchemy → Leveling Rewards
export const XP_TOTAL_50 = 55_172_425;
/** Intelligence с уровней Alchemy: +1 за 1–14, +2 за 15–50 */
export const alchemyInt = lvl => Math.min(lvl, 14) + 2 * Math.max(0, lvl - 14);
/** Длительность God Potion в часах: 12 + 0,24 × Alchemy (Parrot сверху не считаем) */
export const godHours = lvl => 12 + 0.24 * Math.min(50, Math.max(0, lvl));

// Модификаторы варки (вики Potions → Modifiers)
const LONG = 'ENCHANTED_REDSTONE_BLOCK'; // 40 минут
const LONG_MIN = 40;
const UP3 = 'ENCHANTED_GLOWSTONE';       // +3 уровня

// Варимые зелья, которые стоит держать. lv — с какого уровня даёт ингредиент; max — потолок варки.
// unlock — коллекция и её уровень (null — сразу). effect — id эффекта в API (player_data.active_effects).
export const BREWS = [
  { effect: 'strength', name: 'Strength', ings: [['BLAZE_POWDER', 1], ['ENCHANTED_BLAZE_POWDER', 3], ['ENCHANTED_BLAZE_ROD', 5]], max: 8, gives: '+75 Strength', unlock: null },
  { effect: 'critical', name: 'Critical', ings: [['FLINT', 1]], max: 4, gives: '+25% Crit Chance, +40 Crit Damage', unlock: ['Gravel', 7] },
  { effect: 'speed', name: 'Speed', ings: [['SUGAR_CANE', 1], ['ENCHANTED_SUGAR', 3], ['ENCHANTED_SUGAR_CANE', 5]], max: 8, gives: '+40 Speed', unlock: null },
  { effect: 'agility', name: 'Agility', ings: [['ENCHANTED_CAKE', 1]], max: 4, gives: '+40 Speed, мобы промахиваются на 40% чаще', unlock: ['Raw Chicken', 8] },
  { effect: 'resistance', name: 'Resistance', ings: [['CACTUS', 1], ['ENCHANTED_CACTUS_GREEN', 3], ['ENCHANTED_CACTUS', 5]], max: 8, gives: '+60 Defense', unlock: ['Cactus', 3] },
  { effect: 'regeneration', name: 'Regeneration', ings: [['GHAST_TEAR', 1], ['ENCHANTED_GHAST_TEAR', 5]], max: 8, gives: '+25 Health Regen', unlock: null },
  { effect: 'mana', name: 'Mana', ings: [['MUTTON', 1], ['ENCHANTED_MUTTON', 3], ['ENCHANTED_COOKED_MUTTON', 5]], max: 8, gives: '+8 Mana в секунду', unlock: ['Raw Mutton', 4] },
  { effect: 'archery', name: 'Archery', ings: [['FEATHER', 1]], max: 4, gives: '+75% урона луков', unlock: ['Feather', 3] },
  { effect: 'true_resistance', name: 'True Resistance', ings: [['TRUE_ESSENCE', 1]], max: 4, gives: '+20 True Defense', unlock: 'квест Old Shaman Nyko' },
  { effect: 'adrenaline', name: 'Adrenaline', ings: [['ENCHANTED_COCOA', 3], ['ENCHANTED_COOKIE', 5]], max: 8, gives: '+300 Absorption, +40 Speed', unlock: ['Cocoa Beans', 7] },
  { effect: 'haste', name: 'Haste', ings: [['COAL', 1]], max: 4, gives: '+200 Mining Speed', unlock: ['Coal', 3] },
  { effect: 'spelunker', name: 'Spelunker', ings: [['MITHRIL_ORE', 1]], max: 4, gives: '+20 Mining Fortune (V — только в God Potion)', unlock: ['Mithril', 2] },
  { effect: 'pet_luck', name: 'Pet Luck', ings: [['ENCHANTED_RABBIT_HIDE', 1]], max: 4, gives: '+20% к шансу питомцев', unlock: ['Raw Rabbit', 8] },
];
const brewOf = id => BREWS.find(b => b.effect === id);

// Что держать под занятие. Имена — эффекты из API; text — где взять то, что не варится.
export const ACTIVITIES = [
  { key: 'combat', title: 'Бой и Slayers', effects: ['strength', 'critical', 'spirit', 'agility', 'resistance', 'regeneration', 'magic_find', 'true_resistance'],
    tip: 'Strength VIII и Critical IV — главный урон. Spirit IV (+40 Crit Damage) и Magic Find IV не варятся: Green Candy со Spooky Festival.' },
  { key: 'mage', title: 'Маги', effects: ['mana', 'strength', 'critical', 'spirit'],
    tip: 'Mana VIII: +8 Mana в секунду, способности чаще.' },
  { key: 'archer', title: 'Луки', effects: ['archery', 'strength', 'critical'],
    tip: 'Archery IV: +75% урона луков.' },
  { key: 'mining', title: 'Mining', effects: ['haste', 'spelunker', 'speed'],
    tip: 'Haste IV (+200 Mining Speed) и Spelunker (+20–25 Mining Fortune). На Private Island Haste работает как обычный ванильный эффект.' },
  { key: 'farming', title: 'Farming', effects: ['harvest_harbinger', 'speed'],
    tip: 'Harvest Harbinger V: +50 Farming Fortune, не варится и не входит в God Potion. Melon Juice Mixin: ещё +15 Farming Fortune.' },
  { key: 'fishing', title: 'Fishing', effects: ['mushed_glowy_tonic', 'water_breathing'],
    tip: 'Mushed Glowy Tonic: +30 Fishing Speed на час, у Moby за 8 Full Chum Bucket и 10 Glowing Mushroom. Не входит в God Potion.' },
  { key: 'pets', title: 'Питомцы', effects: ['pet_luck'],
    tip: 'Pet Luck IV: +20% к шансу питомцев с мобов и редкости при крафте.' },
];

// God Potion: эффекты (вики God Potion → God Potion Effect)
export const GOD_EFFECTS = ['critical', 'regeneration', 'strength', 'agility', 'night_vision', 'absorption', 'burning', 'stun', 'dodge', 'experience',
  'mana', 'speed', 'water_breathing', 'alchemy_xp_boost', 'combat_xp_boost', 'enchanting_xp_boost', 'farming_xp_boost', 'fishing_xp_boost',
  'foraging_xp_boost', 'mining_xp_boost', 'rabbit', 'resistance', 'archery', 'jump_boost', 'magic_find', 'pet_luck', 'spirit', 'spelunker',
  'adrenaline', 'fire_resistance', 'haste', 'true_resistance'];

// Mixins: добавляются к God Potion в Brewing Stand (вики Mixins)
export const MIXINS = [
  { id: 'ZOMBIE_BRAIN_MIXIN', gives: '+10 Ferocity', where: 'Bartender, Zombie Slayer 8, 150 тыс.' },
  { id: 'SPIDER_EGG_MIXIN', gives: '+15 Crit Damage', where: 'Bartender, Spider Slayer 8, 150 тыс.' },
  { id: 'WOLF_FUR_MIXIN', gives: '+5 Magic Find по боссам Slayers', where: 'Bartender, Wolf Slayer 8, 150 тыс.' },
  { id: 'END_PORTAL_FUMES_MIXIN', gives: '+30% overflow при конвертации Soulflow', where: 'Bartender, Enderman Slayer 8, 150 тыс.' },
  { id: 'GABAGOEY_MIXIN', gives: '+5% True Defense', where: 'Bartender, Blaze Slayer 8, 150 тыс.' },
  { id: 'DEEPTERROR_MIXIN', gives: '+210 Health и +40 Defense в The End и на Crimson Isle', where: 'крафт' },
  { id: 'MUSHED_MUSHROOM_MIXIN', gives: '+30 Fishing Speed (если нет Mushed Glowy Tonic)', where: 'Moby: 64 Full Chum Bucket и 80 Glowing Mushroom' },
  { id: 'MELON_JUICE_MIXIN', gives: '+15 Farming Fortune', where: 'крафт' },
  { id: 'HOT_CHOCOLATE_MIXIN', gives: '+15 Pet Luck и +0,05x Chocolate в секунду', where: 'Chocolate Shop, 1,5 млрд Chocolate' },
];

// Варки ради Alchemy XP (вики Tutorial:Alchemy Guide): 15 000 XP за зелье, Glowstone Dust поднимает до VI ради продажи NPC.
// sell — цена NPC за 3 зелья VI.
export const XP_BREWS = [
  { id: 'ENCHANTED_SUGAR_CANE', potion: 'Speed', base: 'Awkward Potion', wart: true, sell3: 17_499 },
  { id: 'ENCHANTED_FERMENTED_SPIDER_EYE', potion: 'Weakness', base: 'Water Bottle', wart: false, sell3: 38_700 },
  { id: 'ENCHANTED_GOLD_BLOCK', potion: 'Absorption', base: 'Awkward Potion', wart: true, sell3: 26_001 },
];
const XP_PER_POTION = 15_000;

// Откуда взять ингредиент для XP-варки: сам предмет и его сырьё (сколько штук сырья на 1 ингредиент, рецепты NEU).
// Один ингредиент варит 3 зелья (одна стойка).
export const ING_SOURCES = [
  { id: 'ENCHANTED_SUGAR_CANE', potion: 'Speed V', parts: [['ENCHANTED_SUGAR_CANE', 1], ['ENCHANTED_SUGAR', 160], ['SUGAR_CANE', 25_600]],
    where: 'Garden (Sugar Cane) или миньоны Sugar Cane', crop: 'SUGAR_CANE' },
  { id: 'ENCHANTED_GOLD_BLOCK', potion: 'Absorption V', parts: [['ENCHANTED_GOLD_BLOCK', 1], ['ENCHANTED_GOLD', 160], ['GOLD_INGOT', 25_600]],
    where: 'Gold Mine, Dwarven Mines или миньоны Gold' },
  { id: 'ENCHANTED_FERMENTED_SPIDER_EYE', potion: 'Weakness V', parts: [['ENCHANTED_FERMENTED_SPIDER_EYE', 1], ['ENCHANTED_SPIDER_EYE', 64]],
    where: "Spider's Den или миньоны Spider; ещё 64 Brown Mushroom и 64 Sugar на штуку" },
];

/** Сколько ингредиентов выходит из запаса игрока: count(id) — сколько штук есть. → { units, have: [[id, n]] } */
export function stockUnits(src, count) {
  let units = 0;
  const have = [];
  for (const [id, per] of src.parts) {
    const n = Number(count(id)) || 0;
    if (n <= 0) continue;
    units += n / per;
    have.push([id, n]);
  }
  return { units: Math.floor(units), have };
}

/** Enchanted Sugar Cane за час фарма в Garden: те же допущения, что в «Заработке» (19,5 блока/с, 90% времени, 2 дропа). */
export function caneFarmPerHour(ff, { bps = 19.5, uptime = 0.9 } = {}) {
  return bps * 3600 * uptime * 2 * (1 + Math.max(0, ff) / 100) / 25_600;
}

/** Стоимость 1 млн Alchemy XP по варке: ингредиент на 3 зелья + Nether Wart + Glowstone Dust − продажа NPC */
export function xpCostPerMillion(b, buy, ingPrice = buy(b.id)) {
  const ing = ingPrice, wart = b.wart ? 3 * buy('NETHER_STALK') : 0, glow = buy('GLOWSTONE_DUST');
  if (!ing) return null;
  const spend = ing + wart + glow;
  const net = spend - b.sell3;
  return { spend3: spend, net3: net, perMillion: Math.round(net / (3 * XP_PER_POTION) * 1e6) };
}

/** Себестоимость одного зелья на максимум: ингредиент + Enchanted Redstone Block + Enchanted Glowstone на 3 зелья, плюс Nether Wart */
export function brewCost(b, buy, ingPrice = buy(b.ings[b.ings.length - 1][0])) {
  const top = b.ings[b.ings.length - 1];
  const ing = ingPrice;
  if (!ing) return null;
  const lvl = Math.min(b.max, top[1] + 3);
  return { id: top[0], lvl, perPotion: Math.round((ing + buy(LONG) + buy(UP3)) / 3 + buy('NETHER_STALK')) };
}

/**
 * Ингредиент тремя способами: купить готовым, скрафтить из сырья с Bazaar (рецепт NEU, до 2 ступеней сжатия)
 * и «своё» — сколько он стоил бы при продаже (своё добытое тоже стоит денег: его можно было продать).
 * @returns {{ buy: number, craft: number, via: string|null, ratio: number, own: number }}
 */
export function ingredientCosts(id, { buy, sell, items }, depth = 2) {
  const out = { buy: buy(id) || 0, craft: 0, via: null, ratio: 0, own: sell(id) || 0 };
  const item = items?.get?.(id);
  if (depth > 0 && item) {
    for (const r of extractRecipes(item)) {
      const keys = Object.keys(r.inputs);
      if (r.type !== 'craft' || keys.length !== 1) continue;
      const src = marketId(keys[0], items), ratio = r.inputs[keys[0]] / (r.count || 1);
      if (ratio < 2) continue;
      const sub = ingredientCosts(src, { buy, sell, items }, depth - 1);
      const unit = Math.min(...[sub.buy, sub.craft].filter(x => x > 0));
      if (!Number.isFinite(unit)) continue;
      const c = unit * ratio;
      if (!out.craft || c < out.craft) Object.assign(out, { craft: c, via: sub.craft && sub.craft < sub.buy ? sub.via : src, ratio: sub.craft && sub.craft < sub.buy ? ratio * sub.ratio : ratio });
      const ownSub = (sub.own || 0) * ratio;
      if (ownSub > out.own) out.own = ownSub; // из своего сырья: оно тоже продаётся
    }
  }
  return out;
}

/**
 * Сколько стоек ставить: раунд — все стойки проходят шаги варки (вода → Nether Wart → ингредиент → Glowstone Dust).
 * Время раунда — раскладка руками (perStand секунд на стойку за шаг) плюс последняя варка, пока раскладываешь, стойки
 * уже варят. XP только с шага ингредиента.
 */
export function standPlan(n, { steps = 3, brewSec = 20, perStand = 1, xpPer = XP_PER_POTION } = {}) {
  const potions = 3 * n;
  const roundSec = steps * Math.max(brewSec, n * perStand) + brewSec;
  const rounds = 3600 / roundSec;
  return { n, potions, xpRound: potions * xpPer, roundSec: Math.round(roundSec), perHour: Math.round(potions * xpPer * rounds), potionsHour: Math.round(potions * rounds) };
}

/** Активен ли God Potion: почти все его эффекты висят с запасом больше часа */
export function godActive(effects) {
  const act = new Map((effects?.active || []).map(e => [e.id, e]));
  const hits = GOD_EFFECTS.filter(id => { const e = act.get(id); return e && (e.infinite || e.secLeft > 3600); });
  return hits.length >= 20;
}

const hm = sec => {
  const t = Math.round(sec / 60), h = Math.floor(t / 60), mn = t % 60;
  if (!h && !mn) return tx`${Math.max(1, Math.round(sec))} с`;
  return h ? (mn ? tx`${h} ч ${mn} мин` : tx`${h} ч`) : tx`${mn} мин`;
};

export function build(m, ctx) {
  const sk = m.skills?.alchemy || {};
  const lvl = sk.level || 0;
  const noMarket = m.mode?.market === false;
  const effects = m.effects || {};
  const active = new Map((effects.active || []).map(e => [e.id, e]));
  const god = godActive(effects);
  const cookie = !!m.cookie;
  const bag = (m.inv?.potions || []).filter(Boolean);
  const parrot = bestPet(ctx, 'PARROT');
  const witch = bestPet(ctx, 'WITCH');
  const info = id => ctx.priceInfo?.(id) || null;
  const buy = id => info(id)?.bazaar?.buy || ctx.price(id) || 0;
  const bin = id => info(id)?.bin?.price || 0;
  const sell = id => info(id)?.bazaar?.sell || 0;
  const ingOf = id => ingredientCosts(id, { buy, sell, items: ctx.items });
  const cheap = c => { const v = Math.min(...[c.buy, c.craft].filter(x => x > 0)); return Number.isFinite(v) ? v : 0; };
  const cols = ctx.collections;
  const unlocked = u => {
    if (!u) return true;
    if (typeof u === 'string') return null;
    const c = cols?.get?.(u[0].toLowerCase());
    if (!c?.tiers?.[u[1] - 1] || !m.collections) return null;
    return Number(m.collections[c.id] || 0) >= c.tiers[u[1] - 1];
  };
  const hours = godHours(lvl);
  const sections = [];
  const next = [];

  // ── Где ты сейчас
  const godPrice = noMarket ? 0 : bin('GOD_POTION_2') || ctx.price('GOD_POTION_2');
  const cookiePrice = noMarket ? 0 : buy('BOOSTER_COOKIE');
  sections.push({
    kind: 'checklist', title: 'Твои баффы сейчас', news: 'buffs',
    note: 'Зелья — это временные статы. Время уходит, только пока ты в игре.',
    items: [
      { text: god ? 'God Potion действует' : 'God Potion не действует', done: god, item: 'GOD_POTION_2',
        hint: god ? undefined : tx`Самое важное зелье: почти все баффы сразу на ${hm(hours * 3600)}. Стоит 1 500 Bits у Elizabeth${godPrice ? tx` или ${short(godPrice)} на аукционе` : ''}.` },
      { text: cookie ? 'Booster Cookie действует' : 'Booster Cookie не действует', done: cookie, item: 'BOOSTER_COOKIE',
        hint: cookie ? undefined : tx`Опыт быстрее, +10 Magic Find и Bits, на которые покупают God Potion.${cookiePrice ? tx` Сейчас ${short(cookiePrice)} на Bazaar.` : ''}` },
      { text: tx`Alchemy ${lvl} из 50: зелья дольше на ${lvl}%, +${alchemyInt(lvl)} Intelligence`, done: lvl >= 50,
        hint: lvl < 50 && sk.xpForNext ? tx`До ${lvl + 1}: ${fmt(sk.xpForNext - (sk.xpCurrent || 0))} XP` : undefined },
      { text: bag.length ? tx`Potion Bag: ${bag.length} ${plural(bag.length, 'зелье', 'зелья', 'зелий')}` : 'Potion Bag пуст или закрыт в API', done: bag.length > 0,
        hint: 'Сумка для зелий: /potionbag, до 45 штук.' },
      ...(parrot ? [{ text: tx`Parrot ${parrot.tier}: God Potion дольше до 20%`, done: parrot.tier === 'LEGENDARY' || parrot.tier === 'MYTHIC', item: 'PARROT;4' }] : []),
    ],
  });

  // Действующие эффекты
  const shown = [...active.values()].filter(e => !e.infinite || Object.keys(e.stats || {}).length);
  if (shown.length) {
    const off = new Set(effects.disabled || []);
    sections.push({
      kind: 'table', title: 'Действующие эффекты', news: 'effects',
      note: off.size ? tx`Выключено в меню Booster Cookie: ${off.size}.` : undefined,
      columns: ['Эффект', 'Осталось'],
      rows: shown.sort((a, b) => (b.secLeft ?? 1e12) - (a.secLeft ?? 1e12)).slice(0, 40).map(e => [
        cell(tx`${e.name} ${e.roman}`, { tone: off.has(e.id) ? 'muted' : 'good' }), e.infinite ? 'бессрочно' : hm(e.secLeft || 0),
      ]),
    });
  }

  // ── Что держать под занятие
  sections.push({
    kind: 'table', title: 'Какие зелья нужны под занятие', news: 'activities',
    note: god ? 'У тебя God Potion: он уже даёт почти всё из списка. Докупать стоит только Harvest Harbinger и Mushed Glowy Tonic. ✓ — действует сейчас.' : 'Почти всё из списка даёт один God Potion. Отдельно нужны только Harvest Harbinger и Mushed Glowy Tonic. ✓ — действует сейчас.',
    columns: ['Чем занят', 'Зелья', 'Главное'],
    rows: ACTIVITIES.map(a => [
      a.title,
      a.effects.map(id => {
        const e = active.get(id);
        const b = brewOf(id);
        return tx`${b?.name || id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}${e ? ' ✓' : ''}`;
      }).join(', '),
      a.tip,
    ]),
  });
  sections.push({
    kind: 'text', title: 'Dungeons', news: 'dungeons',
    text: [
      'В Catacombs God Potion и другие зелья на паузе, а за заход можно выпить только одно зелье.',
      'Бери Dungeon Potion: VII даёт на 40 минут сразу Strength, Critical, Speed, Resistance, Archery и Regeneration. Продаёт Ophelia в Dungeon Hub, 5 000 монет за уровень.',
      'Healer с питомцем Jellyfish усиливает такие зелья для всей команды.',
    ],
  });

  // ── God Potion и Booster Cookie
  const perHour = godPrice ? godPrice / hours : 0;
  sections.push({
    kind: 'table', title: 'God Potion и Booster Cookie', news: 'god',
    note: 'Обычные зелья поверх God Potion ничего не добавляют, а Milk Bucket снимает все эффекты: не пей его случайно.',
    columns: ['', 'God Potion', 'Booster Cookie'],
    rows: [
      ['Что даёт', 'Почти все зелья сразу и на максимуме: 32 эффекта, в том числе Strength VIII, Critical IV, Magic Find IV', 'Опыт всех скиллов +25%, +10 Magic Find, Bits, команды /ah и /bz из любого места, монеты не теряются при смерти'],
      ['Сколько длится', tx`12 ч на Alchemy 0, 24 ч на Alchemy 50. У тебя ${hm(hours * 3600)}${parrot ? ', Parrot добавляет до 20%' : ''}. Можно пить подряд, время складывается`, '4 дня, идёт и когда ты не в игре. Можно съесть несколько подряд'],
      ['Где взять', noMarket ? '1 500 Bits у Elizabeth в Community Center' : '1 500 Bits у Elizabeth в Community Center или аукцион', '325 SkyBlock Gems у Elizabeth или Bazaar. Первый — бесплатно, раз на аккаунт'],
      ...(noMarket ? [] : [['Цена сейчас', godPrice ? tx`${short(godPrice)}, это ${short(perHour)} в час игры` : '—', cookiePrice ? tx`${short(cookiePrice)}, это ${short(cookiePrice / 96)} в час` : '—']]),
    ],
  });
  sections.push({
    kind: 'table', title: 'Mixins к God Potion', news: 'mixins',
    note: 'Mixin кладут в Brewing Stand вместе с God Potion, он действует всё время зелья. С Booster Cookie Mixin можно выпить прямо из инвентаря.',
    columns: ['Mixin', 'Что даёт', 'Где взять', 'Цена'],
    rows: MIXINS.map(x => [cell(ctx.name(x.id) || x.id, { item: x.id }), x.gives, x.where, noMarket ? '—' : (bin(x.id) || ctx.price(x.id)) ? short(bin(x.id) || ctx.price(x.id)) : '—']),
  });

  // ── Как варить
  sections.push({
    kind: 'steps', title: 'Как варить', news: 'brew',
    items: [
      { title: 'Brewing Stand', text: 'Продаёт Alchemist в Hub за 30 монет или крафт: 3 Cobblestone и Blaze Rod. Ставь сразу несколько.' },
      { title: 'Основа', text: 'Внизу 3 Water Bottle (у Alchemist). Nether Wart превращает их в Awkward Potion. Weakness варится прямо из воды.' },
      { title: 'Ингредиент', text: 'Сверху кладёшь ингредиент зелья: зачарованный даёт уровень выше. Варка идёт 20 секунд, Witch ускоряет до 10.' },
      { title: 'Сильнее и дольше', text: 'Glowstone поднимает уровень зелья (+1, +2 или +3 у зачарованных форм). Redstone продлевает: 8, 16 или 40 минут.' },
      { title: 'Порядок', text: 'Одного типа усилителя действует один. Enchanted Gunpowder кладут после Redstone, иначе он работает как обычный порох.' },
      { title: 'Новые зелья', text: 'Большинство зелий открываются уровнем коллекции ингредиента: рецепты видно в Recipe Book.' },
    ],
  });

  // ── Сварить или купить
  const brewRows = BREWS.map(b => {
    const topId = b.ings[b.ings.length - 1][0];
    const ic = noMarket ? null : ingOf(topId);
    const c = ic && cheap(ic) ? brewCost(b, buy, cheap(ic)) : null;
    const own = ic?.own ? brewCost(b, buy, ic.own) : null;
    const key = c ? `POTION_${b.effect === 'true_resistance' ? 'TRUE_DEFENSE' : b.effect.toUpperCase()};${c.lvl}` : null;
    const ah = key ? bin(key) : 0;
    const ok = unlocked(b.unlock);
    const unlockText = !b.unlock ? 'сразу' : typeof b.unlock === 'string' ? b.unlock : tx`${b.unlock[0]} ${R(b.unlock[1])}`;
    const craftWins = ic && ic.craft && ic.craft < ic.buy * 0.97;
    return { b, c, own, ah, ic, ok, craftWins, row: [
      cell(tx`${b.name} ${R(b.max)}`, { item: topId }),
      b.gives,
      cell(unlockText, { tone: ok === true ? 'good' : ok === false ? 'bad' : undefined }),
      noMarket ? b.ings.map(([id, l]) => tx`${ctx.name(id) || id} (${R(l)})`).join(' → ')
        : cell(ic?.buy ? tx`${ctx.name(topId) || topId}: ${short(ic.buy)}` : ctx.name(topId) || topId, { item: topId, tone: ic?.buy && !craftWins ? 'good' : undefined }),
      ...(noMarket ? [] : [
        ic?.craft ? cell(tx`${short(ic.craft)} из ${ctx.name(ic.via) || ic.via}`, { tone: craftWins ? 'good' : undefined }) : '—',
        c ? short(c.perPotion) : '—',
        own ? short(own.perPotion) : '—',
        ah ? cell(short(ah), { tone: c && ah < c.perPotion ? 'good' : undefined }) : '—',
      ]),
    ] };
  });
  sections.push({
    kind: 'table', title: noMarket ? 'Что варить' : 'Сварить или купить', news: 'brews',
    note: noMarket
      ? 'Ингредиенты добывай сам: миньоны, коллекции, мобы. Уровень поднимает Glowstone, время — Redstone.'
      : tx`Для тех, кто хочет экономить или зарабатывать. Зелёное — дешевле. «1 зелье» — максимальный уровень на ${fmt(LONG_MIN * (1 + lvl / 100))} минут. «Из своего фарма» — если ингредиент добыл сам.`,
    columns: ['Зелье', 'Даёт', 'Открывается', ...(noMarket ? ['Ингредиент (уровень)'] : ['Купить ингредиент', 'Скрафтить', '1 зелье', 'Из своего фарма', 'Аукцион'])],
    rows: brewRows.map(x => x.row),
  });
  if (!noMarket) {
    const gain = (x, base) => ahNet(x.ah) - base.perPotion;
    const flips = brewRows.filter(x => x.c && x.ah && gain(x, x.c) > x.c.perPotion * 0.1).sort((a, b) => gain(b, b.c) - gain(a, a.c));
    const ownFlips = brewRows.filter(x => x.own && x.ah && !flips.includes(x) && gain(x, x.own) > x.own.perPotion * 0.1).sort((a, b) => gain(b, b.own) - gain(a, a.own));
    const crafts = brewRows.filter(x => x.craftWins);
    sections.push({
      kind: 'text', title: 'Варка на продажу', news: 'sell',
      text: [
        ...(perHour && brewRows[0].c ? [tx`Одно Strength VIII на ${fmt(LONG_MIN * (1 + lvl / 100))} минут обходится в ${short(brewRows[0].c.perPotion)}, а God Potion — ${short(perHour)} за час со всеми баффами: для обычной игры он дешевле.`] : []),
        flips.length
          ? tx`Окупаются даже с покупкой ингредиентов: ${flips.slice(0, 3).map(x => tx`${x.b.name} ${R(x.c.lvl)} (сварить ${short(x.c.perPotion)}, на аукционе ${short(x.ah)})`).join('; ')}. Спрос на отдельные зелья маленький: продавай понемногу.`
          : 'С покупкой ингредиентов сейчас ни одно зелье на аукционе не окупается заметно.',
        ...(ownFlips.length ? [tx`Из своих ресурсов выгоднее варить, чем продавать ингредиент: ${ownFlips.slice(0, 3).map(x => tx`${x.b.name} ${R(x.own.lvl)} (+${short(gain(x, x.own))} с зелья)`).join('; ')}.`] : []),
        ...(crafts.length ? [tx`Ингредиент дешевле скрафтить из сырья, чем купить: ${crafts.slice(0, 4).map(x => ctx.name(x.ic.via) ? tx`${ctx.name(x.b.ings[x.b.ings.length - 1][0])} из ${ctx.name(x.ic.via)}` : x.b.name).join(', ')}.`] : []),
        'NPC платит за зелья меньше, чем стоят ингредиенты: продажа NPC только возвращает часть денег при прокачке Alchemy.',
        'Главный спрос — God Potion и Booster Cookie, а не отдельные зелья: God Potion перекрывает почти все баффы.',
      ],
    });
  }

  // ── Автоварка
  sections.push({
    kind: 'text', title: 'Автоварка', news: 'auto',
    text: [
      'Воронки (Hopper) подают ингредиенты в Brewing Stand, но, по вики, так варятся только ванильные зелья. Зелья SkyBlock и XP Alchemy надёжно получаются только руками.',
      'Варка идёт, только пока Private Island загружен: без тебя на острове стойки стоят.',
      'Быстрее всего — ряды по 64 стойки: заполни все водой, потом Nether Wart, ингредиент и Glowstone Dust. Все стойки варят одновременно, 20 секунд на шаг (с Witch — 10).',
      'Water Bottle продаёт Alchemist в Hub. Готовую партию продавай NPC прямо из меню Booster Cookie.',
    ],
  });

  // ── Как качать Alchemy
  const xpLeft = Math.max(0, XP_TOTAL_50 - (sk.xp || 0));
  const xpRowsAll = noMarket ? [] : XP_BREWS.map(b => { const ic = ingOf(b.id); return { b, c: cheap(ic) ? xpCostPerMillion(b, buy, cheap(ic)) : null }; }).filter(x => x.c);
  xpRowsAll.sort((a, b) => a.c.perMillion - b.c.perMillion);
  const xpRows = xpRowsAll;
  const xpPlain = noMarket || !xpRows.length;
  const boost = active.get('alchemy_xp_boost');
  const wisdom = (cookie ? 25 : 0) + (boost ? [0, 5, 10, 20][Math.min(3, boost.level)] || 0 : 0);
  const xpPer = Math.round(XP_PER_POTION * (1 + wisdom / 100));
  const potionsTo50 = Math.ceil(xpLeft / xpPer);
  const best = xpRows[0];
  const wf = 1 + wisdom / 100; // Wisdom удешевляет 1 млн XP
  const costTo50 = best ? best.c.perMillion / wf * xpLeft / 1e6 : 0;

  // ── God Potion растёт с Alchemy
  const ladder = [...new Set([0, 10, 20, 30, 40, 50, lvl])].sort((a, b) => a - b);
  sections.push({
    kind: 'table', title: 'God Potion растёт с Alchemy', news: 'godlevel',
    note: lvl >= 50
      ? 'У тебя Alchemy 50: каждый God Potion длится 24 часа — вдвое дольше, чем на старте.'
      : tx`Каждый уровень Alchemy добавляет каждому God Potion 14 минут. На 50 он длится 24 ч — вдвое дольше, чем на старте. Тебе до 50: ${short(xpLeft)} XP, это около ${fmt(potionsTo50)} зелий${costTo50 > 0 ? tx` и ${short(costTo50)} монет` : ''}.`,
    columns: ['Alchemy', 'God Potion длится', 'С 1 500 Bits выходит'],
    rows: ladder.map(l => [cell(l === lvl ? tx`${l} (ты)` : String(l), { tone: l === lvl ? 'good' : l < lvl ? 'muted' : undefined }), hm(godHours(l) * 3600), tx`${fmt(godHours(l) / 12 * 100)}% от базовых 12 ч`]),
    current: ladder.indexOf(lvl),
  });

  // ── Сколько стоек ставить
  if (lvl < 50 && best) {
    const steps = best.b.wart ? 3 : 2;
    const brewSec = witch ? 10 : 20;
    const plans = [8, 16, 32, 64].map(n => standPlan(n, { steps, brewSec, xpPer }));
    sections.push({
      kind: 'table', title: 'Сколько стоек ставить', news: 'stands',
      note: tx`Расчёт для ${ctx.name(best.b.id) || best.b.id} (${best.b.potion}): ${fmt(xpPer)} XP за зелье${wisdom ? tx` с твоими +${wisdom} Alchemy Wisdom` : ''}. Пока раскладываешь ингредиенты по стойкам, первые уже варят, поэтому больше стоек — больше XP в час. Время примерное: около секунды на стойку за шаг${witch ? ', варка с Witch — 10 секунд' : ''}.`,
      columns: ['Стоек', 'Зелий за круг', 'XP за круг', 'Круг', 'XP в час', ...(costTo50 > 0 ? ['Потратишь за час'] : []), 'До Alchemy 50'],
      rows: plans.map(x => [
        cell(String(x.n), { tone: x.n === 64 ? 'good' : undefined }), fmt(x.potions), short(x.xpRound), x.roundSec < 600 ? tx`${Math.floor(x.roundSec / 60)} мин ${x.roundSec % 60} с` : hm(x.roundSec), short(x.perHour),
        ...(costTo50 > 0 ? [short(best.c.perMillion / wf * x.perHour / 1e6)] : []),
        x.perHour ? hm(xpLeft / x.perHour * 3600) : '—',
      ]),
    });
  }
  sections.push({
    kind: 'table', title: 'Как качать Alchemy', news: 'leveling',
    note: xpPlain
      ? 'Без Bazaar: ферма Sugar Cane или миньоны Sugar Cane и Gold. Absorption III из Enchanted Gold даёт 300 XP за зелье.'
      : tx`Каждое такое зелье даёт ${fmt(xpPer)} XP${wisdom ? tx` (15 000 и твои +${wisdom} Alchemy Wisdom)` : ''}. Добавь Glowstone Dust и продай зелья NPC: так вернётся часть денег.${lvl < 50 ? tx` До Alchemy 50 осталось ${short(xpLeft)} XP.` : ''}`,
    columns: xpPlain ? ['Ингредиент', 'Зелье', 'XP за зелье'] : ['Ингредиент', 'Зелье', 'Основа', 'Потратишь на 3', 'Вернёт NPC', 'Цена 1 млн XP', ...(lvl < 50 ? ['До 50'] : [])],
    rows: xpPlain
      ? [[cell('Enchanted Sugar Cane', { item: 'ENCHANTED_SUGAR_CANE' }), 'Speed V', '15 000'], [cell('Enchanted Gold Block', { item: 'ENCHANTED_GOLD_BLOCK' }), 'Absorption V', '15 000'], [cell('Enchanted Gold', { item: 'ENCHANTED_GOLD' }), 'Absorption III', '300']]
      : xpRows.map((x, i) => [
        cell(ctx.name(x.b.id) || x.b.id, { item: x.b.id, tone: i === 0 ? 'good' : undefined }), tx`${x.b.potion} V → VI`, x.b.base,
        short(x.c.spend3), short(x.b.sell3), short(x.c.perMillion / wf), ...(lvl < 50 ? [short(x.c.perMillion / wf * xpLeft / 1e6)] : []),
      ]),
  });
  sections.push({
    kind: 'text', title: 'Советы по прокачке', news: 'tips',
    text: [
      'Ставь ряд Brewing Stand и вари партиями: вода → Nether Wart → ингредиент → Glowstone Dust. С Booster Cookie продавай зелья NPC прямо из меню печенья.',
      'Wisdom ускоряет: Booster Cookie (+25 Alchemy Wisdom) и Alchemy XP Boost III из подарков Jerry\'s Workshop (+20). God Potion включает этот буст.',
      'Каждый уровень Alchemy: +1% к длительности твоих зелий и +1 Intelligence (с 15-го +2). На 50 — +50% и +86 Intelligence, God Potion на 24 ч.',
      'Питомец Witch вдвое ускоряет варку: 10 секунд вместо 20.',
    ],
  });

  // ── Где взять ингредиенты: свой запас, фарм в Garden, покупка
  {
    const count = id => ownedCount(m.inv, id);
    const potsOf = u => u * 3;
    const pots = n => tx`${fmt(n)} ${plural(n, 'зелье', 'зелья', 'зелий')}`;
    const srcRows = ING_SOURCES.map(src => ({ src, ...stockUnits(src, count), price: noMarket ? 0 : cheap(ingOf(src.id)), sellNow: noMarket ? 0 : sell(src.id) }));
    const ff = estimateFarmingFortune(m);
    const caneHour = caneFarmPerHour(ff);
    const bestStock = [...srcRows].sort((a, b) => b.units - a.units)[0];
    const text = [];
    if (bestStock?.units > 0) {
      text.push(tx`Из твоего запаса выйдет ${fmt(bestStock.units)} ${ctx.name(bestStock.src.id) || bestStock.src.id}: это ${pots(potsOf(bestStock.units))} и ${short(potsOf(bestStock.units) * xpPer)} XP. Начни с него.`);
    } else {
      text.push('В мешках и сундуках пока не хватает ни на один ингредиент для XP-варки.');
    }
    const farmLine = tx`Час фарма Sugar Cane в Garden (у тебя примерно ${fmt(ff)} Farming Fortune) — около ${fmt(Math.floor(caneHour))} Enchanted Sugar Cane, это ${pots(Math.floor(caneHour) * 3)} и ${short(Math.floor(caneHour) * 3 * xpPer)} XP.`;
    if (noMarket) {
      text.push(tx`${farmLine} Это лучший источник для Ironman.`);
      text.push('Gold и Spider Eye бери, если они уже накопились от миньонов: добывать их специально дольше.');
      text.push('Nether Wart и Water Bottle продаёт Alchemist в Hub (Nether Wart — 10 монет).');
    } else {
      const cane = srcRows[0];
      const buyHour = cane.price * caneHour, sellHour = cane.sellNow * caneHour;
      text.push(buyHour > 0 ? tx`${farmLine} Купить столько же на Bazaar — ${short(buyHour)}${sellHour > 0 ? tx`, продать свой урожай — ${short(sellHour)}` : ''}.` : farmLine);
      if (best) text.push(tx`Если покупать, сейчас дешевле всего ${ctx.name(best.b.id) || best.b.id}: ${short(best.c.perMillion / wf)} за 1 млн XP с учётом продажи зелий NPC.`);
      text.push('Если урожай выгоднее продать, чем сварить, — продай его и купи ингредиент.');
    }
    sections.push({
      kind: 'table', title: 'Где взять ингредиенты', news: 'ingredients',
      note: text.join(' '),
      columns: ['Ингредиент', 'Зелье', 'У тебя есть', 'Хватит на', 'Где добыть', ...(noMarket ? [] : ['Купить 1 шт', 'Твой запас на Bazaar'])],
      rows: srcRows.map(r => [
        cell(ctx.name(r.src.id) || r.src.id, { item: r.src.id, tone: r === bestStock && r.units > 0 ? 'good' : undefined }),
        r.src.potion,
        r.have.length ? r.have.map(([id, n]) => tx`${ctx.name(id) || id} ×${fmt(n)}`).join(', ') : '—',
        r.units ? tx`${pots(potsOf(r.units))}, ${short(potsOf(r.units) * xpPer)} XP` : '—',
        r.src.where,
        ...(noMarket ? [] : [r.price ? short(r.price) : '—', r.units && r.sellNow ? short(r.units * r.sellNow) : '—']),
      ]),
    });
  }

  // Порядок: сначала простое (баффы, God Potion, что нужно), потом варка, в конце — деньги и тонкости
  const ORDER = ['buffs', 'effects', 'god', 'godlevel', 'activities', 'dungeons', 'brew', 'leveling', 'ingredients', 'stands', 'tips', 'brews', 'sell', 'mixins', 'auto'];
  sections.sort((a, b) => ORDER.indexOf(a.news) - ORDER.indexOf(b.news));

  // ── Что дальше
  if (!god && m.mode?.id !== 'bingo') next.push({ title: 'Выпей God Potion', priority: 60, item: 'GOD_POTION_2', why: tx`Strength VIII, Critical IV, Spirit IV, Magic Find IV и ещё 28 эффектов на ${hm(hours * 3600)} игры.` });
  if (lvl < 50 && xpRows[0]) next.push({ title: tx`Качай Alchemy на ${ctx.name(xpRows[0].b.id) || xpRows[0].b.id}`, priority: lvl < 20 ? 35 : 20, item: xpRows[0].b.id, why: tx`Самая дешёвая варка сейчас: ${short(xpRows[0].c.perMillion / wf)} за 1 млн XP. Каждый уровень — +14 минут к God Potion, на 50 он длится 24 ч.` });
  if (!witch && lvl < 50) next.push({ title: 'Питомец Witch для варки', priority: 10, why: 'Варка идёт вдвое быстрее: 10 секунд вместо 20.' });

  const status = lvl >= 50 ? 'done' : lvl > 0 ? 'progress' : 'start';
  const summary = tx`Alchemy ${lvl}/50 · God Potion: ${god ? 'действует' : 'нет'} · Booster Cookie: ${cookie ? 'есть' : 'нет'}`;
  return { summary, status, level: { label: 'Alchemy', value: lvl, max: 50 }, next: topNext(next), sections };
}

export default {
  id: 'alchemy', title: 'Зелья и Alchemy', icon: 'BREWING_STAND_ITEM', group: 'skills',
  build,
};
