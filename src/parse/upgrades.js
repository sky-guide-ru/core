import { tx } from '../../i18n/msg.js';
// Улучшения, вложенные в предмет (гемы, мастер-звёзды, свитки, части дрели и т.п.).
// Возвращает список «деталей» с коэффициентом: цена детали × count × mult идёт в оценку предмета.
// Коэффициенты близки к принятым в SkyHelper-Networth (SkyCrypt): часть стоимости улучшения теряется при продаже.

const GEM_SLOTS = new Set(['COMBAT', 'OFFENSIVE', 'DEFENSIVE', 'UNIVERSAL', 'MINING', 'CHISEL']);
const NO_SILEX = new Set(['PROMISING_SPADE', 'PROMISING_AXE']);
const TURBO = [['TURBO_GOURD', 6, true], ['ENCHANTED_TURBO_GOURD', 7, true]];
/** Зачарование → [предмет, с какого уровня, «один раз на предмет»] */
const ENCH_UPGRADES = {
  SCAVENGER: [['GOLDEN_BOUNTY', 6]], PESTERMINATOR: [['PESTHUNTING_GUIDE', 6]], LUCK_OF_THE_SEA: [['GOLD_BOTTLE_CAP', 7]],
  PISCARY: [['TROUBLED_BUBBLE', 7]], FRAIL: [['SEVERED_PINCER', 7]], SPIKED_HOOK: [['OCTOPUS_TENDRIL', 7]], CHARM: [['CHAIN_END_TIMES', 6]],
  SMITE: [['SEVERED_HAND', 7]], ENDER_SLAYER: [['ENDSTONE_IDOL', 7]], BANE_OF_ARTHROPODS: [['ENSNARED_SNAIL', 7]], VENOMOUS: [['FATEFUL_STINGER', 7]],
  THORNS: [['PRICKLY_CREEPER', 4]], SCUBA: [['VIBRANT_CORAL', 6]], FOREST_PLEDGE: [['WATER_HYACINTH', 6]], KARMA: [['FORESTS_FAVOR', 6]], STEALTH: [['DISTANT_ECHO', 6]],
  ...Object.fromEntries(['WHEAT', 'CARROT', 'POTATO', 'PUMPKIN', 'MELON', 'MUSHROOMS', 'COCOA', 'CACTI', 'CANE', 'WARTS', 'SUNFLOWER', 'MOONFLOWER', 'ROSE'].map(c => [tx`TURBO_${c}`, TURBO])),
};
const MASTER_STARS = ['FIRST_MASTER_STAR', 'SECOND_MASTER_STAR', 'THIRD_MASTER_STAR', 'FOURTH_MASTER_STAR', 'FIFTH_MASTER_STAR'];

/** Простые счётчики: поле ExtraAttributes → id предмета, коэффициент. «!» в конце поля — флаг (одна штука) */
const COUNTED = [
  ['art_of_war_count', 'THE_ART_OF_WAR', 0.6],
  ['artOfPeaceApplied!', 'THE_ART_OF_PEACE', 0.8],
  ['mana_disintegrator_count', 'MANA_DISINTEGRATOR', 0.8],
  ['farming_for_dummies_count', 'FARMING_FOR_DUMMIES', 0.5],
  ['tuned_transmission', 'TRANSMISSION_TUNER', 0.7],
  ['wood_singularity_count', 'WOOD_SINGULARITY', 0.5],
  ['jalapeno_count', 'JALAPENO_BOOK', 0.8],
  ['ethermerge!', 'ETHERWARP_CONDUIT', 1],
  ['polarvoid!', 'POLARVOID_BOOK', 1],
  ['divan_powder_coating!', 'DIVAN_POWDER_COATING', 0.8],
  ['stats_book!', 'BOOK_OF_STATS', 0.6],
];

/**
 * @param {any} ea сырые ExtraAttributes
 * @returns {{ id: string, count: number, mult: number, kind: string }[]}
 */
export function upgradeParts(ea = {}) {
  const out = [];
  const add = (id, count, mult, kind) => { if (id && count > 0) out.push({ id: String(id).toUpperCase(), count, mult, kind }); };

  // Гемы: { JADE_0: 'PERFECT', COMBAT_0: 'FLAWLESS', COMBAT_0_gem: 'SAPPHIRE', ... } (качество бывает объектом { quality })
  const gems = ea.gems || {};
  for (const [slot, val] of Object.entries(gems)) {
    if (slot === 'unlocked_slots' || slot.endsWith('_gem')) continue;
    const quality = typeof val === 'string' ? val : val?.quality;
    if (!quality || !/^(ROUGH|FLAWED|FINE|FLAWLESS|PERFECT)$/.test(quality)) continue;
    const base = slot.replace(/_\d+$/, '');
    const type = GEM_SLOTS.has(base) ? gems[tx`${slot}_gem`] : base;
    if (type) add(tx`${quality}_${type}_GEM`, 1, 1, 'gem');
  }

  // Мастер-звёзды: upgrade_level 6..10
  const stars = Number(ea.upgrade_level ?? ea.dungeon_item_level ?? 0);
  for (let i = 0; i < Math.min(5, stars - 5); i++) add(MASTER_STARS[i], 1, 1, 'star');

  if (ea.rarity_upgrades) add('RECOMBOBULATOR_3000', 1, 0.8, 'recomb');
  const hpb = Number(ea.hot_potato_count || 0);
  add('HOT_POTATO_BOOK', Math.min(hpb, 10), 1, 'hpb');
  add('FUMING_POTATO_BOOK', Math.max(0, hpb - 10), 0.6, 'hpb');

  for (const [key, id, mult] of COUNTED) {
    const flag = key.endsWith('!'); // «!» — улучшение ставится один раз, число в поле не количество (у Book of Stats это убийства)
    const v = ea[flag ? key.slice(0, -1) : key];
    const n = flag ? (v ? 1 : 0) : typeof v === 'number' ? v : v ? 1 : 0;
    add(id, n, mult, 'upgrade');
  }

  // Свитки Necron's Blade и Power Scroll
  for (const s of ea.ability_scroll || []) add(s, 1, 1, 'scroll');
  if (ea.power_ability_scroll) add(ea.power_ability_scroll, 1, 0.5, 'scroll');

  // Части дрели
  for (const k of ['drill_part_engine', 'drill_part_fuel_tank', 'drill_part_upgrade_module']) add(ea[k], 1, 1, 'drill');

  // Обогащение аксессуара, краска, скин
  // Прежние обогащения (TALISMAN_ENRICHMENT_*) заменены одним Accessory Enrichment — по нему и цена
  if (ea.talisman_enrichment) add('ACCESSORY_ENRICHMENT', 1, 0.5, 'enrichment');
  if (ea.dye_item) add(ea.dye_item, 1, 0.9, 'dye');
  if (ea.skin && !ea.petInfo) add(ea.skin, 1, 0.9, 'skin');

  // Правила ниже — как в SkyHelper-Networth (MIT): улучшения, которые раньше в оценку не шли
  // Части удочки (line / hook / sinker)
  for (const k of ['line', 'hook', 'sinker']) add(ea[k]?.part, 1, 1, 'rod');
  // Overclocker 3000 и Thunder in a Bottle в Pulse Ring (одна бутылка — 50 000 заряда, максимум 5 млн)
  add('OVERCLOCKER_3000', Number(ea.levelable_overclocks) || 0, 0.9, 'upgrade');
  if (ea.id === 'PULSE_RING') add('THUNDER_IN_A_BOTTLE', Math.floor(Math.min(Number(ea.thunder_charge) || 0, 5_000_000) / 50_000), 0.8, 'upgrade');
  // Торты в New Year Cake Bag (годы достаёт nbt.js из new_year_cake_bag_data)
  for (const y of ea.cakeYears || []) add(tx`NEW_YEAR_CAKE_${y}`, 1, 1, 'cake');
  // Efficiency выше V — это Sil Ex; уровни зачарований сверх книги — предметы-улучшения
  const ench = ea.enchantments || {};
  const eff = Number(ench.efficiency || 0);
  if (eff >= 6 && !NO_SILEX.has(ea.id)) add('SIL_EX', eff - (ea.id === 'STONK_PICKAXE' ? 6 : 5), 0.75, 'silex');
  const once = new Set();
  for (const [name, lvl] of Object.entries(ench)) {
    for (const [item, tier, perItem] of ENCH_UPGRADES[name.toUpperCase()] || []) {
      if (lvl < tier || (perItem && once.has(item))) continue;
      if (perItem) once.add(item);
      add(item, 1, 0.8, 'enchup');
    }
  }

  return out;
}
