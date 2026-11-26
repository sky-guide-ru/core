// Русский глоссарий. Имена собственные (Hyperion, Kuudra, Bazaar) оставляем на английском,
// как принято в русскоязычном комьюнити SkyBlock, потому что в игре и на аукционе они только на английском.

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

export const CLASSES = { healer: 'Healer', mage: 'Mage', berserk: 'Berserk', archer: 'Archer', tank: 'Tank' };

export const RARITY = {
  COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary',
  MYTHIC: 'Mythic', DIVINE: 'Divine', SPECIAL: 'Special', 'VERY SPECIAL': 'Very Special',
  ULTIMATE: 'Ultimate', ADMIN: 'Admin',
};

// Статы показываем как в игре, на английском (24.11.2026: игроки просили не переводить игровые термины)
export const STATS = Object.fromEntries([
  'Health', 'Defense', 'True Defense', 'Strength', 'Speed', 'Crit Chance', 'Crit Damage', 'Intelligence',
  'Bonus Attack Speed', 'Attack Speed', 'Sea Creature Chance', 'Magic Find', 'Pet Luck', 'Ferocity',
  'Ability Damage', 'Mining Speed', 'Mining Fortune', 'Farming Fortune', 'Foraging Fortune', 'Pristine',
  'Health Regen', 'Vitality', 'Mending', 'Damage', 'Gear Score', 'Fishing Speed', 'Swing Range', 'Combat Wisdom',
  'Mining Wisdom', 'Farming Wisdom', 'Breaking Power', 'Heat Resistance', 'Cold Resistance', 'Bonus Pest Chance',
  'Trophy Fish Chance', 'Double Hook Chance',
].map(k => [k, k]));

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

export function rarityRu(r) { return RARITY[r] || r || ''; }

// Перевод строк лора: переводим названия характеристик, остальное оставляем как в игре
const statRe = new RegExp(`^((?:§.)*)(${Object.keys(STATS).sort((a, b) => b.length - a.length).map(s => s.replace(/ /g, '\\s')).join('|')}):`, '');
export function translateLoreLine(line) {
  return line.replace(statRe, (_, colors, stat) => `${colors}${STATS[stat] || stat}:`)
    .replace(/§6§l(LEGENDARY|EPIC|RARE|MYTHIC)/, m => m)
    .replace(/Requires/g, 'Требуется')
    .replace(/This item can be reforged!/, 'Этот предмет можно перековать!');
}

// Форматирование чисел по-русски: 1,2 млн, 3,4 млрд
export function fmtCoins(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const f = (v, u) => `${(n / v).toLocaleString('ru-RU', { maximumFractionDigits: v >= 1e6 ? 2 : 1 })} ${u}`;
  if (a >= 1e9) return f(1e9, 'млрд');
  if (a >= 1e6) return f(1e6, 'млн');
  if (a >= 1e3) return f(1e3, 'тыс.');
  return Math.round(n).toLocaleString('ru-RU');
}

// Склонение: plural(5, 'раз', 'раза', 'раз')
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
