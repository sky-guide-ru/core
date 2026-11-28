// Русский глоссарий SkyBlock. Расширяет server/i18n/ru.js ядра: все его экспорты сохранены
// с теми же именами, поэтому ядро может импортировать этот файл вместо своего.
//
// Политика перевода (как в контракте): имена собственные предметов, боссов, NPC и локаций
// остаются на английском, как в игре и на аукционе. Переводим характеристики, типы предметов,
// редкости, служебные фразы лора и ванильные предметы Minecraft (по официальной локализации ru_ru).
import { unitIndex } from '../../lib/num-units.js';

const COIN_UNITS = [[1e3, 'тыс.', 1], [1e6, 'млн', 2], [1e9, 'млрд', 2]];


export const SKILLS = {
  farming: 'Farming', mining: 'Mining', combat: 'Combat', foraging: 'Foraging',
  fishing: 'Fishing', enchanting: 'Enchanting', alchemy: 'Alchemy', carpentry: 'Carpentry',
  runecrafting: 'Runecrafting', taming: 'Taming', social: 'Social', hunting: 'Hunting',
};

export const SLAYERS = {
  zombie: { name: 'Revenant Horror', ru: 'Zombie' },
  spider: { name: 'Tarantula Broodfather', ru: 'Spider' },
  wolf: { name: 'Sven Packmaster', ru: 'Wolf' },
  enderman: { name: 'Voidgloom Seraph', ru: 'Enderman' },
  blaze: { name: 'Inferno Demonlord', ru: 'Blaze' },
  vampire: { name: 'Riftstalker Bloodfiend', ru: 'Vampire' },
};

/** Ключи slayer_req из NEU → русский текст */
export const SLAYER_REQ = { ZOMBIE: 'Zombie', SPIDER: 'Spider', WOLF: 'Wolf', EMAN: 'Enderman', BLAZE: 'Blaze', VAMPIRE: 'Vampire' };

export const CLASSES = { healer: 'Healer', mage: 'Mage', berserk: 'Berserk', archer: 'Archer', tank: 'Tank' };

export const RARITY = {
  COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary',
  MYTHIC: 'Mythic', DIVINE: 'Divine', SPECIAL: 'Special', 'VERY SPECIAL': 'Very Special',
  ULTIMATE: 'Ultimate', ADMIN: 'Admin',
};

// Статы показываем как в игре, на английском (24.11.2026: игроки просили не переводить игровые термины)
export const STATS = Object.fromEntries([
  'Health', 'Max Health', 'Defense', 'True Defense', 'Strength', 'Speed', 'Crit Chance', 'Crit Damage',
  'Intelligence', 'Mana', 'Mana Regen', 'Bonus Attack Speed', 'Attack Speed', 'Sea Creature Chance', 'Magic Find',
  'Pet Luck', 'Ferocity', 'Ability Damage', 'Mining Speed', 'Mining Fortune', 'Gemstone Fortune', 'Block Fortune',
  'Ore Fortune', 'Farming Fortune', 'Foraging Fortune', 'Hunting Fortune', 'Pristine', 'Mining Spread',
  'Gemstone Spread', 'Health Regen', 'Vitality', 'Mending', 'Damage', 'Gear Score', 'Fishing Speed', 'Swing Range',
  'Combat Wisdom', 'Mining Wisdom', 'Farming Wisdom', 'Foraging Wisdom', 'Fishing Wisdom', 'Enchanting Wisdom',
  'Alchemy Wisdom', 'Carpentry Wisdom', 'Taming Wisdom', 'Social Wisdom', 'Runecrafting Wisdom', 'Hunting Wisdom',
  'Breaking Power', 'Heat Resistance', 'Cold Resistance', 'Pressure Resistance', 'Respiration', 'Bonus Pest Chance',
  'Trophy Fish Chance', 'Double Hook Chance', 'Treasure Chance', 'Sweep', 'Shot Cooldown', 'Rift Time',
  'Rift Damage', 'Hearts', 'Overbloom', 'Accessory Power', 'Mana Cost', 'Cooldown', 'Soulflow Cost', 'Fuel',
  'Gemstones', 'Pull', 'Fear', 'Timber', 'Trophy Chance', 'Speed Cap', 'Max Storage', 'Time Between Actions',
  'Resources Generated', 'Capacity', 'Mining Speed Boost',
].map(k => [k, k]));

/** Ключи характеристик из reforges.json / pets.json NEU (snake_case) → английское название */
export const STAT_KEYS = {
  health: 'Health', defense: 'Defense', true_defense: 'True Defense', strength: 'Strength', speed: 'Speed',
  walk_speed: 'Speed', crit_chance: 'Crit Chance', critical_chance: 'Crit Chance', crit_damage: 'Crit Damage',
  critical_damage: 'Crit Damage', intelligence: 'Intelligence', bonus_attack_speed: 'Bonus Attack Speed',
  attack_speed: 'Attack Speed', sea_creature_chance: 'Sea Creature Chance', magic_find: 'Magic Find', pet_luck: 'Pet Luck',
  ferocity: 'Ferocity', ability_damage: 'Ability Damage', ability_damage_percent: 'Ability Damage', mining_speed: 'Mining Speed',
  mining_fortune: 'Mining Fortune', farming_fortune: 'Farming Fortune', foraging_fortune: 'Foraging Fortune', pristine: 'Pristine',
  health_regen: 'Health Regen', vitality: 'Vitality', mending: 'Mending', damage: 'Damage', fishing_speed: 'Fishing Speed',
  swing_range: 'Swing Range', combat_wisdom: 'Combat Wisdom', mining_wisdom: 'Mining Wisdom', farming_wisdom: 'Farming Wisdom',
  foraging_wisdom: 'Foraging Wisdom', fishing_wisdom: 'Fishing Wisdom', breaking_power: 'Breaking Power',
  heat_resistance: 'Heat Resistance', cold_resistance: 'Cold Resistance', double_hook_chance: 'Double Hook Chance',
  trophy_fish_chance: 'Trophy Fish Chance', treasure_chance: 'Treasure Chance', gemstone_fortune: 'Gemstone Fortune',
  mining_spread: 'Mining Spread', hunting_fortune: 'Hunting Fortune', bonus_pest_chance: 'Bonus Pest Chance',
  sweep: 'Sweep', respiration: 'Respiration', pressure_resistance: 'Pressure Resistance', mana_regen: 'Mana Regen',
};

/** Иконки характеристик из ресурс-пака Hypixel (символы Private Use Area в лоре NEU) → обычные символы */
export const STAT_GLYPHS = {
  '': '⚔', '': '๑', '': '✎', '': '✎', '': 'Ⓟ', '': '❄', '': '☠', '': '❈',
  '': '⚓', '': '⫽', '': '☂', '': '❁', '': '❤', '': '❣', '': '♨', '': '♣',
  '': '☄', '': '⸕', '': '▚', '': 'ൠ', '': 'ൠ', '': '✯', '': '❍', '': '✧',
  '': '⚶', '': 'ф', '': 'α', '': '✦', '': '∮', '': 'Ⓢ', '': '⛃', '': '❂',
  '': '♨', '': '♔', '': '☣', '': '❁', '': '☘', '': '☘', '': '☘', '': '☘',
};

/** Типы монстров (Bestiary/бонусы урона) */
export const MOB_TYPES = {
  Airborne: 'летающие', Animal: 'животные', Aquatic: 'водные', Arcane: 'магические', Arthropod: 'членистоногие',
  Construct: 'конструкты', Cubic: 'кубические', Elusive: 'неуловимые', Ender: 'эндер-существа', Frozen: 'ледяные',
  Glacial: 'ледниковые', Humanoid: 'гуманоиды', Infernal: 'адские', Magmatic: 'магматические', Mythological: 'мифические',
  Pest: 'вредители', Shielded: 'бронированные', Skeletal: 'скелеты', Spooky: 'жуткие', Subterranean: 'подземные',
  Undead: 'нежить', Wither: 'визер-существа', Woodland: 'лесные', Critter: 'зверьки', Timid: 'пугливые',
};

/** Тип предмета из последней строки лора — как в игре («LEGENDARY DUNGEON SWORD» → «Sword»), только регистр помягче */
export const ITEM_TYPES = Object.fromEntries([
  'SWORD', 'LONGSWORD', 'BOW', 'SHORTBOW', 'WAND', 'GAUNTLET', 'HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS',
  'NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET', 'ACCESSORY', 'HATCESSORY', 'PET', 'PET ITEM', 'REFORGE STONE',
  'POWER STONE', 'GEMSTONE', 'COSMETIC', 'DYE', 'SACK', 'TRAVEL SCROLL', 'PORTAL', 'ORE', 'BLOCK', 'FISHING ROD',
  'FISHING WEAPON', 'ROD PART', 'BAIT', 'AXE', 'PICKAXE', 'DRILL', 'SHOVEL', 'HOE', 'SHEARS', 'FARMING TOOL',
  'HUNTING TOOL', 'GARDEN CHIP', 'MUTATION', 'ARROW', 'ARROW POISON', 'DEPLOYABLE', 'DWARVEN METAL', 'MEMENTO',
  'TROPHY', 'SEA CREATURE', 'RABBIT', 'BOOSTER', 'SALT', 'RIFT TIMECHARM', 'CARNIVAL MASK', 'VACUUM', 'WATERING CAN',
  'TRAP', 'ITEM', 'DUNGEON ITEM', 'CHISEL', 'LASSO', 'BELT BUCKLE', 'SHARD', 'ATTRIBUTE SHARD', 'SPADE',
  'ENCHANTED BOOK', 'FISHING NET', 'CONSUMABLE', 'SLAYER SWORD', 'CAPSULE', 'ABILITY SCROLL',
].map(k => [k, k.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')]));

/** Категории базы (поле category) и их русские подписи */
export const CATEGORIES = {
  weapon: 'Оружие', armor: 'Броня', equipment: 'Экипировка', accessory: 'Аксессуар', pet: 'Питомец', pet_item: 'Предмет для питомца',
  tool: 'Инструмент', enchant_book: 'Зачарованная книга', reforge_stone: 'Камень перековки', power_stone: 'Камень силы',
  gemstone: 'Самоцвет', material: 'Материал', minion: 'Миньон', cosmetic: 'Косметика', consumable: 'Расходник',
  sack: 'Мешок', npc: 'NPC', mob: 'Моб', shard: 'Осколок', rune: 'Руна', furniture: 'Мебель', misc: 'Прочее',
};

export const WEAPON_TYPES = new Set(['SWORD', 'SLAYER SWORD', 'LONGSWORD', 'BOW', 'SHORTBOW', 'WAND', 'GAUNTLET', 'FISHING WEAPON']);
export const ARMOR_TYPES = new Set(['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS']);
export const EQUIPMENT_TYPES = new Set(['NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET']);
export const TOOL_TYPES = new Set(['AXE', 'PICKAXE', 'DRILL', 'SHOVEL', 'HOE', 'SHEARS', 'FARMING TOOL', 'FISHING ROD', 'HUNTING TOOL',
  'VACUUM', 'WATERING CAN', 'CHISEL', 'LASSO', 'SPADE', 'FISHING NET']);

export const ISLANDS = {
  hub: 'Hub', dungeon_hub: 'Dungeon Hub', crimson_isle: 'Crimson Isle', the_end: 'The End', combat_3: 'The End',
  dwarven_mines: 'Dwarven Mines', mining_3: 'Dwarven Mines',
  crystal_hollows: 'Crystal Hollows', garden: 'Garden', rift: 'Rift',
  park: 'The Park', foraging_1: 'The Park', galatea: 'Galatea', foraging_2: 'Galatea (Moonglade Marsh)',
  spider_den: "Spider's Den", combat_1: "Spider's Den",
  deep_caverns: 'Deep Caverns', mining_2: 'Deep Caverns',
  gold_mine: 'Gold Mine', mining_1: 'Gold Mine',
  barn: 'The Barn', farming_1: 'The Farming Islands', mushroom_desert: 'Mushroom Desert',
  backwater_bayou: 'Backwater Bayou', fishing_1: 'Backwater Bayou', jerry: "Jerry's Workshop",
  winter: "Jerry's Workshop", glacite_tunnels: 'Glacite Tunnels',
  mineshaft: 'Glacite Mineshafts', dynamic: 'Private Island', dungeon: 'The Catacombs',
  kuudra: "Kuudra's Hollow", lotus_atoll: 'Lotus Atoll',
};

export const CROPS = {
  WHEAT: 'Wheat', CARROT_ITEM: 'Carrot', POTATO_ITEM: 'Potato', PUMPKIN: 'Pumpkin', MELON: 'Melon',
  SUGAR_CANE: 'Sugar Cane', CACTUS: 'Cactus', INK_SACK_3: 'Cocoa Beans', 'INK_SACK:3': 'Cocoa Beans',
  MUSHROOM_COLLECTION: 'Mushroom', NETHER_STALK: 'Nether Wart', DOUBLE_PLANT: 'Sunflower', MOONFLOWER: 'Moonflower',
  WILD_ROSE: 'Wild Rose',
};

/** Ванильные чары Minecraft: официальные русские названия из ru_ru. SkyBlock-чары остаются на английском. */
export const ENCHANTS_RU = {
  sharpness: 'Острота', smite: 'Небесная кара', bane_of_arthropods: 'Бич членистоногих', knockback: 'Отдача',
  fire_aspect: 'Заговор огня', looting: 'Добыча', protection: 'Защита', fire_protection: 'Огнеупорность',
  blast_protection: 'Взрывоустойчивость', projectile_protection: 'Защита от снарядов', feather_falling: 'Невесомость',
  respiration: 'Подводное дыхание', aqua_affinity: 'Подводник', thorns: 'Шипы', depth_strider: 'Подводная ходьба',
  frost_walker: 'Ледоход', efficiency: 'Эффективность', silk_touch: 'Шёлковое касание', unbreaking: 'Прочность',
  fortune: 'Удача', power: 'Сила', punch: 'Откидывание', flame: 'Горящая стрела', infinite_quiver: 'Бесконечность',
  luck_of_the_sea: 'Морская удача', lure: 'Приманка', impaling: 'Пронзатель', piercing: 'Пронзающая стрела',
  respite: 'Respite', smelting_touch: 'Smelting Touch',
};

/** Русские слова редкостей — только для поиска («легендарный питомец»), на сайте редкость как в игре */
export const RARITY_WORDS_RU = {
  COMMON: 'Обычный', UNCOMMON: 'Необычный', RARE: 'Редкий', EPIC: 'Эпический', LEGENDARY: 'Легендарный',
  MYTHIC: 'Мифический', DIVINE: 'Божественный', SPECIAL: 'Особый', 'VERY SPECIAL': 'Очень особый',
};

export function rarityRu(r) { return RARITY[r] || r || ''; }

/** Перевод названия характеристики; неизвестное возвращается как есть */
export function translateStat(name) {
  if (!name) return '';
  const k = STAT_KEYS[name] || STAT_KEYS[String(name).toLowerCase()] || name;
  return STATS[k] || k;
}

// Форматирование чисел по-русски: 1,2 млн, 3,4 млрд
export function fmtCoins(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const i = unitIndex(a, COIN_UNITS);
  if (i < 0) return Math.round(n).toLocaleString('ru-RU');
  const [v, u, d] = COIN_UNITS[i];
  return `${(n / v).toLocaleString('ru-RU', { maximumFractionDigits: d })} ${u}`;
}

/** Длительность в секундах → «3 ч 20 мин», «5 дн.» */
export function fmtDuration(sec) {
  if (!sec) return '';
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d} дн.`);
  if (h) parts.push(`${h} ч`);
  if (m && !d) parts.push(`${m} мин`);
  return parts.join(' ') || `${sec} с`;
}

const ROMAN = { I: 1, V: 5, X: 10, L: 50 };
export function romanToInt(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], nx = ROMAN[s[i + 1]] || 0;
    n += v < nx ? -v : v;
  }
  return n;
}
export function intToRoman(n) {
  const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}

/** Род типа предмета для согласования прилагательных: m, f, n, pl */
export const TYPE_GENDER = {
  SWORD: 'm', LONGSWORD: 'm', BOW: 'm', SHORTBOW: 'm', WAND: 'm', GAUNTLET: 'f', HELMET: 'm', CHESTPLATE: 'm',
  LEGGINGS: 'pl', BOOTS: 'pl', NECKLACE: 'n', CLOAK: 'm', BELT: 'm', GLOVES: 'pl', BRACELET: 'm', ACCESSORY: 'm',
  HATCESSORY: 'm', PET: 'm', 'PET ITEM': 'm', 'REFORGE STONE': 'm', 'POWER STONE': 'm', GEMSTONE: 'm', COSMETIC: 'f',
  DYE: 'f', SACK: 'm', 'TRAVEL SCROLL': 'm', PORTAL: 'm', ORE: 'f', BLOCK: 'm', 'FISHING ROD': 'f', 'FISHING WEAPON': 'f',
  'ROD PART': 'f', BAIT: 'f', AXE: 'm', PICKAXE: 'f', DRILL: 'm', SHOVEL: 'f', HOE: 'f', SHEARS: 'pl', 'FARMING TOOL': 'm',
  'HUNTING TOOL': 'm', 'GARDEN CHIP': 'm', MUTATION: 'f', ARROW: 'f', 'ARROW POISON': 'm', DEPLOYABLE: 'm',
  'DWARVEN METAL': 'm', MEMENTO: 'm', TROPHY: 'm', 'SEA CREATURE': 'n', RABBIT: 'm', BOOSTER: 'm', SALT: 'f',
  'RIFT TIMECHARM': 'm', 'CARNIVAL MASK': 'f', VACUUM: 'm', 'WATERING CAN': 'f', TRAP: 'f', ITEM: 'm', 'DUNGEON ITEM': 'm',
  CHISEL: 'n', LASSO: 'n', SHARD: 'm', 'ATTRIBUTE SHARD': 'm', SPADE: 'f', 'ENCHANTED BOOK': 'f', CONSUMABLE: 'm',
  'SLAYER SWORD': 'm', CAPSULE: 'f', 'ABILITY SCROLL': 'm',
  'FISHING NET': 'f', 'BELT BUCKLE': 'f',
};

/** Согласует прилагательное в м.р. ед.ч. («Легендарный», «Редкий») с родом */
export function agreeAdj(adj, g) {
  if (g === 'm' || !g) return adj;
  return adj.split(' ').map(w => {
    const soft = /[кгхжшчщ]ий$/.test(w);
    if (/(ый|ий|ой)$/.test(w)) {
      const stem = w.slice(0, -2);
      if (g === 'f') return stem + 'ая';
      if (g === 'n') return stem + 'ое';
      return stem + (soft ? 'ие' : 'ые');
    }
    return w;
  }).join(' ');
}

