import { tx } from '../../i18n/msg.js';
// Данные гайда Hunting. Сверено с fandom (2026-11-23): Hunting, Hunting/Leveling Rewards, Attributes,
// Attributes/List/{Common…Legendary}, Hunting Box, Huntraps, Lassos, Fishing Nets, Huntaxes, Salts,
// Attribute Fusion, David Hunterborough. Названия осколков и атрибутов — как в игре (по-английски).
// Эффект атрибута берётся из русского лора осколка (items-ru), здесь только «где взять».

// Сколько осколков нужно на каждый уровень атрибута (I…X) по редкости осколка
export const LEVEL_SHARDS = {
  COMMON: [1, 3, 5, 6, 7, 8, 10, 14, 18, 24],
  UNCOMMON: [1, 2, 3, 4, 5, 6, 7, 8, 12, 16],
  RARE: [1, 2, 3, 3, 4, 4, 5, 6, 8, 12],
  EPIC: [1, 1, 2, 2, 3, 3, 4, 4, 5, 7],
  LEGENDARY: [1, 1, 1, 2, 2, 2, 3, 3, 4, 5],
};
// Уровень Hunting, с которого осколок этой редкости можно извлечь (Syphon)
export const SYPHON_LEVEL = { COMMON: 0, UNCOMMON: 5, RARE: 10, EPIC: 15, LEGENDARY: 20 };
// Опыт Hunting за пойманный осколок
export const HUNT_XP = { COMMON: 75, UNCOMMON: 150, RARE: 300, EPIC: 500, LEGENDARY: 1000 };

export const RARITY_RU = { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary' };
export const CATEGORY_RU = { FOREST: 'лес', WATER: 'вода', COMBAT: 'бой' };

// Инструменты: [id NEU, название, редкость, откуда]
export const TOOLS = {
  lasso: { title: 'Lasso (лесные осколки)', items: [
    ['ABYSMAL_LASSO', 'Abysmal Lasso', 'у Auryon (обучение в Tangleburg)'],
    ['VINERIP_LASSO', 'Vinerip Lasso', 'коллекция Vinesap II'],
    ['ENTANGLER_LASSO', 'Entangler Lasso', 'коллекция Vinesap IV'],
    ['EVERSTRETCH_LASSO', 'Everstretch Lasso', 'коллекция Vinesap VI'],
  ] },
  net: { title: 'Fishing Net (водные осколки)', items: [
    ['BASIC_FISHING_NET', 'Basic Fishing Net', 'первая бесплатно у Jaeger, потом коллекция Sea Lumies I'],
    ['MEDIUM_FISHING_NET', 'Medium Fishing Net', 'коллекция Sea Lumies V'],
    ['TURBO_FISHING_NET', 'Turbo Fishing Net', 'коллекция Sea Lumies IX'],
  ] },
  axe: { title: 'Huntaxe + Black Hole (боевые осколки)', items: [
    ['VENATOR_GENESIS', 'Worn Huntaxe - Genesis', 'коллекция Vinesap I'],
    ['SILVA_DOMINUS', 'Sharpened Huntaxe - Dominus', 'коллекция Vinesap III'],
    ['CURSUS_FERAE', 'Reinforced Huntaxe - Cursus', 'коллекция Vinesap V'],
    ['APEX_PRAEDATOR', 'Savage Huntaxe - Praedator', 'коллекция Vinesap VII'],
    ['NEX_TITANUM', 'Prime Huntaxe - Nex Titanum', 'коллекция Vinesap IX'],
    ['SMALL_POCKET_BLACK_HOLE', 'Small Pocket Black Hole', 'у Albert в Tangleburg'],
    ['MEDIUM_POCKET_BLACK_HOLE', 'Medium Pocket Black Hole', 'у Albert, улучшение маленькой'],
  ] },
  trap: { title: 'Huntrap (ловушки)', items: [
    ['RETIA_BASICA', 'Small Huntrap', 'коллекция Tender Wood I'],
    ['RETIA_MELIORA', 'Medium Huntrap', 'коллекция Tender Wood III'],
    ['RETIA_ROBUSTA', 'Large Huntrap', 'коллекция Tender Wood V'],
    ['RETIA_FORTA', 'Greater Huntrap', 'коллекция Tender Wood VII'],
    ['RETIA_SUPREMA', 'Astral Huntrap', 'коллекция Tender Wood IX'],
  ] },
  salt: { title: 'Соли (Salts)', items: [
    ['LUSHLILAC', 'Lushlilac', 'кусты ягод в Moonglade Marsh · 0,5% на любого моба'],
    ['LUSHLILAC_BONBON', 'Lushlilac Bonbon', 'коллекция Lushlilac I · 0,625%'],
    ['PRIME_LUSHLILAC_BONBON', 'Prime Lushlilac Bonbon', 'коллекция Lushlilac III · 0,75%'],
    ['EXALTED_LUSHLILAC_BONBON', 'Exalted Lushlilac Bonbon', 'коллекция Lushlilac V · 1%'],
    ['OCEANDY', 'Oceandy', 'коллекция Lushlilac II · 1,25%, только Sea Creatures'],
    ['CANDYCOMB', 'Candycomb', 'секреты данжей · 1,25%, только мобы данжа'],
  ] },
};

// Где взять осколок (вики, список атрибутов). Коды через «|»:
//  B — поймать Black Hole (B:моб, если имя моба другое), S — убить с активной солью (S:моб),
//  L — Lasso, N — Fishing Net, T:место — ловушка (~ под водой, ^ под лавой), F:место — рыбалка там,
//  K — сундук Kuudra, G — Tree Gifts (Fig и Mangrove), U:рецепт — фьюжн, P:NPC — магазин, D:источник — дроп, X:текст — как есть.
const MW = 'Murkwater Depths~';
export const SOURCES = {
  // Common
  Grove: 'U:лес Common + Uncommon или выше', Mist: 'U:вода Common + Uncommon или выше', Flash: 'U:бой Common + Uncommon или выше',
  Phanpyre: 'L|T:Galatea|G', Cod: tx`N|T:${MW}|F:Tomb Floodway`, Phanflare: 'L|T:Galatea|G', 'Night Squid': 'B|S', 'Lapis Zombie': 'B|S',
  Hideonleaf: 'X:охота на Hideonleaf в Galatea', Verdant: tx`N|T:${MW}|F:Tomb Floodway`, Chill: 'B:Chillshot, Chillblade|S|T:Wyrmgrove Tomb',
  Bogged: 'B|S', 'Voracious Spider': 'B|S', Hideongift: 'U:Shulker + Common или выше', Birries: 'N|L|T:Galatea',
  'Tank Zombie': 'S:танки-зомби в данже', Crow: 'P:Agatha', Tadgang: tx`B|S|T:${MW}`, Zealot: 'B|S', Coralot: tx`N|L|T:${MW}`,
  Harpy: 'U:Bird + бой', Mudworm: 'T:Galatea|X:трава на Galatea', 'Golden Ghoul': 'B|S', Azure: tx`T:${MW}|F:Tomb Floodway`,
  Bezal: 'B|S|K', Yog: 'B|S', 'Boreal Owl': 'U:Bird + Common или выше', Newt: 'U:Axolotl + вода', 'Miner Zombie': 'B|S',
  'Cretan Bull': 'B:Cretan Bull (Diana)|S',
  // Uncommon
  Bramble: 'U:лес Uncommon + Rare или выше', Tide: 'U:вода Uncommon + Rare или выше', Quake: 'U:бой Uncommon + Rare или выше',
  Sparrow: 'X:крафт из Enchanted Fig Log', Goldfin: 'U:Golden Ghoul + вода', Troglobyte: 'U:Cave Dweller + бой',
  Hideoncave: 'U:Shulker + Cave Dweller', Salamander: 'U:Lizard + вода', Cuboa: 'U:Shulker + Reptile',
  Pest: 'B:Pests Garden|S:Pests|L', Mossybit: 'U:Tadgang + лес|T:Galatea|X:охота в Murkwater Loch', 'Rain Slime': 'B|S',
  Seer: 'B|S', Heron: 'P:Agatha', 'Obsidian Defender': 'B|S', Salmon: tx`N|T:${MW}|F:Tomb Floodway`, Viper: 'U:Cuboa + бой|P:Kiara',
  'Praying Mantis': 'U:Pest + бой', 'Zombie Soldier': 'S:Zombie Soldier, Knight, Commander, Lord (данж)', Bambuleaf: 'T:Tranquility Sanctum (весна, лето)|X:панды на Galatea',
  Sycophant: 'B:Revenant Sycophant|S', Seagull: 'X:крафт из Enchanted Mangrove Log', Ent: tx`B|S|T:${MW}`,
  'Soul of the Alpha': 'B|S|T:Howling Cave', Mochibear: 'T:Tranquility Sanctum (осень, зима)|X:панды на Galatea',
  'Magma Slug': 'B|S|K|T:Crimson Isle^', 'Flaming Spider': 'B|S', Kiwi: 'U:Bird Uncommon или выше', Bruiser: 'B:Zealot Bruiser|S',
  Stridersurfer: 'B:Strider Surfer|S|T:Strider-Ember Fissure', Rana: 'U:Frog + бой', Termite: 'U:Bug Uncommon + добыча',
  // Rare
  Sylvan: 'U:лес Rare + Epic или выше', Cascade: 'U:вода Rare + Epic или выше', Bolt: 'U:бой Rare + Epic или выше',
  Bambloom: 'U:Panda + Uncommon или выше', Toad: 'U:Frog + лес Uncommon+', 'Glacite Walker': 'B|S', Beaconmite: 'X:настройка Moonglade Beacon',
  'Lizard King': 'U:Lizard + вода Uncommon+', Python: 'U:Viper + бой Uncommon+', Invisibug: 'T:Galatea|X:трава на Galatea',
  Piranha: tx`T:${MW}|F:Moonglade Marsh`, Hideongeon: 'U:Shulker + Wither', 'Lapis Skeleton': 'U:Lapis Zombie + Rare или выше',
  Cropeetle: 'U:Invisibug и Termite + лес', Drowned: 'B:Seacurse, Hydrospear, Tidetot|S|T:Drowned Reliquary', 'Star Sentry': 'B|S',
  Hideondra: 'U:Shulker + Demon', 'Abyssal Lanternfish': 'T:Dwarven Mines~|F:Dwarven Mines', Arachne: 'S', Bitbug: 'P:Bits Shop',
  Revenant: 'D:Revenant Horror', Silentdepth: 'T:Crystal Hollows~|F:Crystal Hollows', Skeletor: 'U:Lapis Skeleton Rare+|S',
  Thyst: 'S|T:Crystal Hollows', Quartzfang: 'U:Troglobyte + Cave Dweller', Hideonring: 'U:Shulker Rare+ + Rare или выше',
  Snowfin: "T:Jerry's Workshop~", 'Kada Knight': 'B|S|K', 'Carrot King': 'B|S', 'Wither Spectre': 'B|S|K', Matcho: 'B|S|K',
  Ladybug: 'U:Termite + Invisibug', Lumisquid: 'N|T:Squid Cave~', Crocodile: 'P:Kiara', Bullfrog: 'U:Frog + лес Rare+',
  Dreadwing: 'L|B|S|T:Galatea|G|U:Phanpyre + Phanflare', Joydive: tx`N|T:${MW}`, Stalagmight: 'U:Quartzfang + Cave Dweller',
  Fungloom: 'U:Cave Dweller + лес Epic+', Eel: 'P:Kiara|F:Moonglade Marsh', 'King Cobra': 'U:Python + бой Uncommon+',
  'Lava Flame': 'B|S|K|T:Crimson Isle^', Draconic: 'D:драконы в The End', Falcon: 'U:Bird Rare или выше',
  'Inferno Koi': 'T:Crimson Isle^|F:Crimson Isle', Wither: 'D:Catacombs F7 и M7', Gecko: 'P:Kiara', Minotaur: 'B:Minotaur (Diana)|S',
  Hummingbird: 'G',
  // Epic
  Terra: 'U:лес Epic + Legendary', Cryo: 'U:вода Epic + Legendary', Aero: 'U:бой Epic + Legendary', Pandarai: 'U:Panda Rare+',
  Leviathan: 'U:Lizard + вода Rare+', Alligator: 'U:Crocodile + бой Rare+', Fenlord: 'U:Bullfrog + лес Rare+', Basilisk: 'U:King Cobra + бой Rare+',
  Iguana: 'U:Gecko + лес Rare+', 'Moray Eel': 'U:Eel + вода Rare+', 'Lunar Moth': 'U:Ladybug + Bug Rare+', 'Fire Eel': 'B|S|K|U:Eel + Moray Eel',
  Bal: 'S', Hideonsack: 'U:Shulker Rare+ + Epic или выше', 'Water Hydra': 'B|S', Flare: 'B|S|K', 'Loch Emperor': 'B:The Loch Emperor|S',
  Prince: 'S', 'Komodo Dragon': 'U:Iguana + лес Rare+', Mimic: 'S', Shellwise: tx`N|T:${MW}`, 'Barbarian Duke X': 'B|S|K',
  Toucan: 'U:Bird Epic или выше', Hellwisp: 'B|S|K', Caiman: 'U:Alligator + бой Rare+', Firefly: 'U:Lunar Moth + огненные осколки',
  'Sea Serpent': 'U:Moray Eel + вода Rare+', Ghost: 'B|S', XYZ: 'L|S:Atom|K|T:Mystic Marsh', Leatherback: 'U:Shellwise + вода Rare+',
  Cavernshade: 'U:Cave Dweller Rare+ + Cave Dweller Epic+', Dragonfly: 'U:Firefly + Dragon', 'King Minos': 'B:Empyrean King Minos (Diana)|S',
  Sphinx: 'B:Sphinx (Diana)|S',
  // Legendary
  Tenebris: 'U:лес Legendary + Elemental Epic+', Blizzard: 'U:вода Legendary + Elemental Epic+', Tempest: 'U:бой Legendary + Elemental Epic+',
  Chameleon: 'G', Tiamat: 'U:Caiman + бой Epic+', Wyvern: 'U:Komodo Dragon + лес Epic+', Tortoise: 'U:Leatherback + вода Epic+',
  'End Stone Protector': 'D:End Stone Protector', Naga: 'U:Sea Serpent + вода Epic+', 'Lapis Creeper': 'U:Lapis Skeleton + Ghost',
  Wartybug: 'U:Dragonfly + Legendary', Spike: tx`N|T:${MW}|T:Kelpwoven Tunnels~`, Kraken: 'K', Taurus: 'B|S|K', Daemon: 'U:Kraken + Kraken|K',
  Moltenfish: 'U:Kraken + вода|K', Shinyfish: 'X:ловится рыбалкой с атрибутом Star Bait', Ananke: 'U:Kraken + Bird|K',
  Hideonbox: 'U:Shulker Epic+ + Legendary', 'Lord Jawbus': 'B|S|K', Burningsoul: 'B:Burningsoul Demon|S|T:Smoldering Tomb',
  Cinderbat: 'B|L|S|K', Megalith: 'U:Tortoise + вода Epic+', 'Power Dragon': 'D:Master Mode F7', Condor: 'U:Bird Legendary',
  'Sun Fish': 'U:Shinyfish + Shinyfish', 'Apex Dragon': 'U:Power Dragon + любой|D:Master Mode F7', Dodo: 'U:Condor + Legendary',
  Jormung: 'U:Power Dragon + Kraken', Etherdrake: 'U:Apex Dragon + Kraken', 'Galaxy Fish': 'U:Sun Fish + Sun Fish',
  Molthorn: 'U:Etherdrake + Jormung', Starborn: 'U:Elemental Legendary + Galaxy Fish', Titanoboa: 'B|S', Thorn: 'D:Master Mode F4',
  Scarf: 'D:Master Mode F2',
};

// Осколки, которые в игре (и в NEU) переименовали после правки вики: имя на вики → id атрибута.
// Для них «где взять» берём из NEU: там уже новые мобы.
export const RENAMED = { 'Night Squid': 'FISHERMAN', Pest: 'PEST_LUCK', Termite: 'INFILTRATION', Cropeetle: 'CROP_BUG', Burningsoul: 'ATTACK_SPEED' };

/** Код источника → короткий русский текст. */
export function sourceText(name, code) {
  if (!code) return null;
  return code.split('|').map(t => {
    const [k, ...rest] = t.split(':');
    const v = rest.join(':');
    switch (k) {
      case 'B': return tx`поймать Black Hole: ${v || name}`;
      case 'S': return v ? tx`убить с солью: ${v}` : 'убить с солью';
      case 'L': return 'Lasso';
      case 'N': return 'Fishing Net';
      case 'T': { const at = v.replace(/[~^]$/, ''); return v.endsWith('~') ? tx`ловушка: ${at} (под водой)` : v.endsWith('^') ? tx`ловушка: ${at} (в лаве)` : tx`ловушка: ${at}`; }
      case 'F': return tx`рыбалка: ${v}`;
      case 'K': return 'сундук Kuudra';
      case 'G': return 'Tree Gifts (Fig, Mangrove)';
      case 'U': return tx`фьюжн: ${v}`;
      case 'P': return tx`магазин ${v}`;
      case 'D': return tx`дроп: ${v}`;
      default: return v || t;
    }
  }).join(' · ');
}

// Что качать первым. Порядок внутри — от дешёвого и полезного всем к узкому.
// focus: all — всем; combat/fishing/gathering — по стилю игры; hunt — ускоряет саму охоту.
export const PRIORITY = [
  { shard: 'Hideonring', focus: 'all', why: '+1 слот в Accessory Bag за уровень, это больше Magical Power' },
  { shard: 'Newt', focus: 'hunt', why: 'Hunter Fortune на Common: больше осколков с каждой охоты' },
  { shard: 'Salamander', focus: 'hunt', why: 'Hunter Fortune на Uncommon' },
  { shard: 'Lizard King', focus: 'hunt', why: 'Hunter Fortune на Rare' },
  { shard: 'Mossybit', focus: 'hunt', why: 'ловушки ловят лесные осколки быстрее' },
  { shard: 'Viper', focus: 'hunt', why: 'Huntaxe берёт больше статов из оружия' },
  { shard: 'Hideonsack', focus: 'all', why: 'мешки вмещают больше' },
  { shard: 'Cinderbat', focus: 'all', why: 'Magic Find везде' },
  { shard: 'Apex Dragon', focus: 'combat', why: 'Combat Wisdom: быстрее Combat' },
  { shard: 'Daemon', focus: 'combat', why: 'RNG-метр слееров и данжей копится быстрее' },
  { shard: 'Barbarian Duke X', focus: 'combat', why: 'больше урона в ближнем бою' },
  { shard: 'Power Dragon', focus: 'combat', why: 'больше урона по боссам и мини-боссам' },
  { shard: 'Zombie Soldier', focus: 'combat', why: 'урон по нежити: Revenant, данжи' },
  { shard: 'Bruiser', focus: 'combat', why: 'урон по Эндерам: Voidgloom, зилоты' },
  { shard: 'Flaming Spider', focus: 'combat', why: 'урон по паукам: Tarantula' },
  { shard: 'Flare', focus: 'combat', why: 'урон по огненным мобам: Inferno, Kuudra' },
  { shard: 'Inferno Demonlord', focus: 'combat', why: 'Bonus Attack Speed' },
  { shard: 'Kraken', focus: 'combat', why: 'Vitality: сильнее лечение' },
  { shard: 'Water Hydra', focus: 'fishing', why: 'Fishing Speed' },
  { shard: 'Bogged', focus: 'fishing', why: 'Sea Creature Chance' },
  { shard: 'Loch Emperor', focus: 'fishing', why: 'Fishing Wisdom' },
  { shard: 'Fire Eel', focus: 'fishing', why: 'шанс Trophy Fish' },
  { shard: 'Lord Jawbus', focus: 'fishing', why: 'двойной улов на Crimson Isle' },
  { shard: 'Galaxy Fish', focus: 'gathering', why: 'Fortune на Farming, добычу и Foraging сразу' },
  { shard: 'Phanflare', focus: 'gathering', why: '+10 Fig и Mangrove Fortune за уровень' },
  { shard: 'Bambloom', focus: 'gathering', why: 'Foraging Fortune' },
  { shard: 'Bal', focus: 'gathering', why: 'шанс лишнего блока при добыче' },
  { shard: 'Thyst', focus: 'gathering', why: 'больше Gemstone Powder' },
];

export const PRIORITY_FOCUS_RU = { all: 'всем', hunt: 'охота', combat: 'бой', fishing: 'рыбалка', gathering: 'добыча' };

// Вехи David Hunterborough (Tangleburg): что даёт каждая ветка. Пороги в API не приходят, на вики их нет.
export const DAVID_TRACKS = [
  { key: 'combat', ru: 'Охоты в бою', gives: '+1 Strength за веху (позже +2…+3)' },
  { key: 'fishing', ru: 'Охоты в воде', gives: '+1 Health за веху (позже +2…+3)' },
  { key: 'forest', ru: 'Охоты в лесу', gives: '+1 Foraging Fortune за веху (позже +2…+3)' },
  { key: 'trap', ru: 'Осколки из ловушек', gives: 'опыт Hunting: от +100 до +50 000 за веху' },
  { key: 'salt', ru: 'Осколки с солью', gives: 'опыт Hunting: от +100 до +50 000 за веху' },
];
