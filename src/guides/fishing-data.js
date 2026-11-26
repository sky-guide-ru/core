import { tx } from '../../i18n/msg.js';
// Справочные данные гайда по рыбалке.
// Удочки, броня, детали удочек и наживки: id, требования и описания сверены с репозиторием NEU (items/*.json, ноябрь 2026).
// Sea Creatures: список и ключи бестиария из NEU constants/bestiary.json. Требования Fishing сверены 23.11.2026
// по страницам существ на fandom-вики; lvl = null только у Nutcracker (на вики его страницы нет).
// Trophy Fish: условия поимки из описаний предметов NEU (*_BRONZE.json), разделка у Odger — fandom «Odger» и SkyHanni (у NEU для Lavahorse ошибка).

/** Удочки для воды и лавы по порядку улучшения. lvl — требование Fishing из описания предмета. */
export const RODS = [
  { id: 'CHALLENGE_ROD', lvl: 5, kind: 'water', note: 'первая нормальная удочка, крафт' },
  { id: 'CHAMP_ROD', lvl: 15, kind: 'water', note: '+8% Sea Creature Chance' },
  { id: 'LEGEND_ROD', lvl: 20, kind: 'water', note: '+12% Sea Creature Chance' },
  { id: 'ROD_OF_THE_SEA', lvl: 24, kind: 'water', note: '+15% Sea Creature Chance, 2 слота самоцветов' },
  { id: 'STARTER_LAVA_ROD', lvl: 10, kind: 'lava', note: 'первая удочка для лавы; без зачарований нужна для Vanille' },
  { id: 'POLISHED_TOPAZ_ROD', lvl: 19, kind: 'lava', note: 'нужен ещё Heart of the Mountain 5' },
  { id: 'MAGMA_ROD', lvl: 27, kind: 'lava', note: '+10% Sea Creature Chance, +15 Trophy Chance' },
  { id: 'INFERNO_ROD', lvl: 30, kind: 'lava', note: '+15% Sea Creature Chance, +20 Trophy Chance' },
  { id: 'HELLFIRE_ROD', lvl: 35, kind: 'lava', note: '+20% Sea Creature Chance, +25 Trophy Chance, 2 слота самоцветов' },
];

/** Детали удочек (ставит Roddy в Backwater Bayou). */
export const ROD_PARTS = [
  { id: 'SPEEDY_LINE', lvl: 5, slot: 'Леска', text: '+10 Fishing Speed' },
  { id: 'SHREDDED_LINE', lvl: 20, slot: 'Леска', text: '+250 урона и +50 Ferocity: быстрее убивать существ' },
  { id: 'TROPHY_LINE', lvl: 20, slot: 'Леска', text: '+5 Trophy Chance (нужна коллекция Lotus IX)' },
  { id: 'TITAN_LINE', lvl: 30, slot: 'Леска', text: '+2 Double Hook Chance' },
  { id: 'COMMON_HOOK', lvl: 10, slot: 'Крючок', text: 'обычные существа на 25% чаще' },
  { id: 'HOTSPOT_HOOK', lvl: 20, slot: 'Крючок', text: '+20% шанс существ Хотспота' },
  { id: 'PHANTOM_HOOK', lvl: 21, slot: 'Крючок', text: 'Spooky Hook: +20% шанс существ Spooky Festival' },
  { id: 'TREASURE_HOOK', lvl: 25, slot: 'Крючок', text: 'ловит только предметы и сокровища' },
  { id: 'HOTSPOT_SINKER', lvl: 20, slot: 'Грузило', text: 'бонусы Хотспота ×2' },
  { id: 'STINGY_SINKER', lvl: 5, slot: 'Грузило', text: '10% шанс не потратить наживку' },
  { id: 'FESTIVE_SINKER', lvl: 5, slot: 'Грузило', text: 'шанс поймать подарки в Season of Jerry' },
];

/** Броня для рыбалки по порядку. set — префикс id частей (HELMET/CHESTPLATE/LEGGINGS/BOOTS). */
export const ARMOR = [
  { set: 'ANGLER', name: 'Angler Armor', lvl: 0, kind: 'water', note: 'Fishing Merchant в Fisherman’s Hut (Hub), 100 монет за часть' },
  { set: 'BACKWATER', name: 'Backwater Armor', lvl: 5, kind: 'water', note: 'Junker Joel в Backwater Bayou: Angler-часть + 4 Rusty Coin' },
  { set: 'SALMON', name: 'Salmon Armor', lvl: 13, kind: 'water', note: 'крафт из Enchanted Raw Salmon (коллекция Raw Salmon VI)' },
  { set: 'SPONGE', name: 'Sponge Armor', lvl: 17, kind: 'water', note: 'крафт из 8 Enchanted Wet Sponge на нагрудник (коллекция Sponge IX)' },
  { set: 'DIVER', name: "Diver's Armor", lvl: 20, kind: 'water', ids: ['DIVER_HELMET', 'DIVER_CHESTPLATE', 'DIVER_LEGGINGS', 'DIVER_BOOTS'], note: 'крафт: часть Snorkeling Armor + Gill Membrane + Enchanted Sea Lumies' },
  { set: 'ABYSSAL', name: 'Abyssal Armor', lvl: 22, kind: 'water', note: 'крафт: часть Diver\'s Armor + Gill Membrane + Enchanted Sea Lumies + Emperor\'s Skull' },
  { set: 'SHARK_SCALE', name: 'Shark Scale Armor', lvl: 24, kind: 'water', note: 'из чешуи Great White Shark (Fishing Festival)' },
  { set: 'LAVA_MIX', name: 'Slug Boots + Moogma Leggings + Flaming Chestplate + Taurus Helmet', lvl: 27, kind: 'lava',
    ids: ['SLUG_BOOTS', 'MOOGMA_LEGGINGS', 'FLAMING_CHESTPLATE', 'TAURUS_HELMET'], note: 'по частям с Magma Slug (27), Moogma (28), Lava Flame (33), Taurus (35)' },
  { set: 'THUNDER', name: 'Thunder Armor', lvl: 36, kind: 'lava', note: 'крафт из Thunder Shards (с Thunder)' },
  { set: 'MAGMA_LORD', name: 'Magma Lord Armor', lvl: 45, kind: 'lava', note: 'крафт из Magma Lord Fragment (с Lord Jawbus)' },
];
export const PIECES = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
export const armorIds = a => a.ids || PIECES.map(p => tx`${a.set}_${p}`);

/** Снаряжение (плащ/пояс/перчатки) с Fishing Speed. */
export const EQUIPMENT = [
  { id: 'ICHTHYIC_CLOAK', tier: 'Ichthyic', fs: 6 },
  { id: 'FINWAVE_CLOAK', tier: 'Finwave', fs: 10 },
  { id: 'GILLSPLASH_CLOAK', tier: 'Gillsplash', fs: 14 },
];

/**
 * Sea Creatures. where — место/условие, keys — ключи бестиария (members.bestiary.kills), cap — убийств до макс. бестиария (NEU).
 * lvl: требование Fishing, null — вики его не описывает.
 */
export const CREATURES = [
  // Обычная вода
  { name: 'Squid', zone: 'water', lvl: 1, where: 'любая вода', keys: ['pond_squid_1'], cap: 1000 },
  { name: 'Sea Walker', zone: 'water', lvl: 2, where: 'любая вода', keys: ['sea_walker_4'], cap: 1000 },
  { name: 'Night Squid', zone: 'water', lvl: 3, where: 'любая вода ночью (Dark Bait помогает)', keys: ['night_squid_6'], cap: 1000 },
  { name: 'Sea Guardian', zone: 'water', lvl: 5, where: 'любая вода', keys: ['sea_guardian_10'], cap: 1000 },
  { name: 'Sea Witch', zone: 'water', lvl: 7, where: 'любая вода', keys: ['sea_witch_15'], cap: 1000 },
  { name: 'Sea Archer', zone: 'water', lvl: 9, where: 'любая вода', keys: ['sea_archer_15'], cap: 1000 },
  { name: 'Rider of the Deep', zone: 'water', lvl: 11, where: 'любая вода', keys: ['zombie_deep_20', 'chicken_deep_20'], cap: 1000 },
  { name: 'Catfish', zone: 'water', lvl: 13, where: 'любая вода', keys: ['catfish_23'], cap: 750 },
  { name: 'Carrot King', zone: 'water', lvl: 15, where: 'любая вода с Carrot Bait', keys: ['carrot_king_25'], cap: 250 },
  { name: 'Sea Leech', zone: 'water', lvl: 16, where: 'любая вода', keys: ['sea_leech_30'], cap: 750 },
  { name: 'Guardian Defender', zone: 'water', lvl: 17, where: 'любая вода', keys: ['guardian_defender_45'], cap: 500 },
  { name: 'Deep Sea Protector', zone: 'water', lvl: 18, where: 'любая вода', keys: ['deep_sea_protector_60'], cap: 500 },
  { name: 'Water Hydra', zone: 'water', lvl: 19, where: 'любая вода', keys: ['water_hydra_100'], cap: 250 },
  { name: 'Sea Emperor', zone: 'water', lvl: 20, where: 'любая вода (Whale/Light/Dark Bait повышают шанс)', keys: [], cap: null },
  { name: 'Agarimoo', zone: 'water', lvl: 15, where: 'вода рядом с Chumcap Bucket', keys: ['agarimoo_35'], cap: 750 },
  { name: 'Oasis Rabbit', zone: 'water', lvl: 10, where: 'Oasis в Mushroom Desert', keys: ['oasis_rabbit_10'], cap: 300 },
  { name: 'Oasis Sheep', zone: 'water', lvl: 10, where: 'Oasis в Mushroom Desert', keys: ['oasis_sheep_10'], cap: 300 },
  { name: 'Water Worm', zone: 'hollows', lvl: 15, where: 'Crystal Hollows (Worm Bait: клюют только черви)', keys: ['water_worm_20'], cap: 750 },
  { name: 'Poisoned Water Worm', zone: 'hollows', lvl: 17, where: 'Crystal Hollows', keys: ['poisoned_water_worm_25'], cap: 750 },
  { name: 'Abyssal Miner', zone: 'hollows', lvl: 24, where: 'Crystal Hollows', keys: ['zombie_miner_150'], cap: 250 },
  { name: 'Flaming Worm', zone: 'hollows', lvl: 19, where: 'лава Crystal Hollows', keys: ['flaming_worm_50'], cap: 750 },
  { name: 'Lava Blaze', zone: 'hollows', lvl: 20, where: 'лава Crystal Hollows', keys: ['lava_blaze_100'], cap: 500 },
  { name: 'Lava Pigman', zone: 'hollows', lvl: 22, where: 'лава Crystal Hollows', keys: ['lava_pigman_100'], cap: 500 },
  { name: 'Frog Man', zone: 'hotspot', lvl: 5, where: 'водные Хотспоты', keys: ['frog_man_10'], cap: 1000 },
  { name: 'Snapping Turtle', zone: 'hotspot', lvl: 10, where: 'водные Хотспоты', keys: ['snapping_turtle_30'], cap: 750 },
  { name: 'Blue Ringed Octopus', zone: 'hotspot', lvl: 35, where: 'водные Хотспоты', keys: ['blue_ringed_octopus_275'], cap: 250 },
  { name: 'Wiki Tiki', zone: 'hotspot', lvl: 40, where: 'водные Хотспоты (мифическое)', keys: ['wiki_tiki_400'], cap: 50 },
  // Backwater Bayou
  { name: 'Trash Gobbler', zone: 'bayou', lvl: 5, where: 'Backwater Bayou', keys: ['trash_gobbler_8'], cap: 1000 },
  { name: 'Dumpster Diver', zone: 'bayou', lvl: 5, where: 'Backwater Bayou', keys: ['dumpster_diver_15'], cap: 1000 },
  { name: 'Banshee', zone: 'bayou', lvl: 10, where: 'Backwater Bayou', keys: ['banshee_10'], cap: 750 },
  { name: 'Bayou Sludge', zone: 'bayou', lvl: 15, where: 'Backwater Bayou', keys: ['bayou_sludge_25'], cap: 500 },
  { name: 'Alligator', zone: 'bayou', lvl: 20, where: 'Backwater Bayou', keys: ['alligator_120'], cap: 250 },
  { name: 'Titanoboa', zone: 'bayou', lvl: 30, where: 'Backwater Bayou (мифическое)', keys: ['titanoboa_240'], cap: 50 },
  // Лава Crimson Isle
  { name: 'Magma Slug', zone: 'lava', lvl: 27, where: 'лава Crimson Isle', keys: ['magma_slug_200'], cap: 1000 },
  { name: 'Moogma', zone: 'lava', lvl: 28, where: 'лава Crimson Isle', keys: ['moogma_210'], cap: 1000 },
  { name: 'Lava Leech', zone: 'lava', lvl: 30, where: 'лава Crimson Isle', keys: ['lava_leech_220'], cap: 750 },
  { name: 'Pyroclastic Worm', zone: 'lava', lvl: 31, where: 'лава Crimson Isle', keys: ['pyroclastic_worm_240'], cap: 750 },
  { name: 'Lava Flame', zone: 'lava', lvl: 33, where: 'лава Crimson Isle', keys: ['lava_flame_230'], cap: 750 },
  { name: 'Fire Eel', zone: 'lava', lvl: 34, where: 'лава Crimson Isle', keys: ['fire_eel_240'], cap: 750 },
  { name: 'Taurus', zone: 'lava', lvl: 35, where: 'лава Crimson Isle', keys: ['pig_rider_250'], cap: 500 },
  { name: 'Thunder', zone: 'lava', lvl: 36, where: 'лава Crimson Isle, после награды Novice Trophy Fisher', keys: ['thunder_400'], cap: 250 },
  { name: 'Lord Jawbus', zone: 'lava', lvl: 45, where: 'лава Crimson Isle, после награды Adept Trophy Fisher', keys: ['lord_jawbus_600'], cap: 50 },
  { name: 'Plhlegblast', zone: 'lava', lvl: 36, where: 'Plhlegblast Pool в Crimson Isle', keys: ['pond_squid_300'], cap: 7 },
  { name: 'Fried Chicken', zone: 'lava', lvl: 14, where: 'лавовые Хотспоты', keys: ['fried_chicken_30'], cap: 1000 },
  { name: 'Fireproof Witch', zone: 'lava', lvl: 16, where: 'лавовые Хотспоты', keys: ['fireproof_witch_75'], cap: 750 },
  { name: 'Fiery Scuttler', zone: 'lava', lvl: 37, where: 'лавовые Хотспоты', keys: ['fiery_scuttler_475'], cap: 250 },
  { name: 'Ragnarok', zone: 'lava', lvl: 47, where: 'лавовые Хотспоты (мифическое)', keys: ['ragnarok_666'], cap: 50 },
  // События
  { name: 'Scarecrow', zone: 'spooky', lvl: 9, where: 'Spooky Festival, любая вода', keys: ['scarecrow_9'], cap: 1000 },
  { name: 'Nightmare', zone: 'spooky', lvl: 14, where: 'Spooky Festival, любая вода', keys: ['nightmare_24'], cap: 750 },
  { name: 'Werewolf', zone: 'spooky', lvl: 17, where: 'Spooky Festival, любая вода', keys: ['werewolf_50'], cap: 500 },
  { name: 'Phantom Fisher', zone: 'spooky', lvl: 21, where: 'Spooky Festival, любая вода', keys: ['phantom_fisherman_160'], cap: 250 },
  { name: 'Grim Reaper', zone: 'spooky', lvl: 26, where: 'Spooky Festival, любая вода', keys: ['grim_reaper_190'], cap: 50 },
  { name: 'Nurse Shark', zone: 'festival', lvl: 5, where: 'Fishing Festival', keys: ['nurse_shark_6'], cap: 1000 },
  { name: 'Blue Shark', zone: 'festival', lvl: 10, where: 'Fishing Festival', keys: ['blue_shark_20'], cap: 750 },
  { name: 'Tiger Shark', zone: 'festival', lvl: 18, where: 'Fishing Festival', keys: ['tiger_shark_50'], cap: 500 },
  { name: 'Great White Shark', zone: 'festival', lvl: 24, where: 'Fishing Festival', keys: ['great_white_shark_180'], cap: 250 },
  { name: 'Frozen Steve', zone: 'winter', lvl: 5, where: "Jerry's Workshop", keys: ['frozen_steve_7'], cap: 1000 },
  { name: 'Frosty', zone: 'winter', lvl: 6, where: "Jerry's Workshop", keys: ['frosty_the_snowman_13'], cap: 1000 },
  { name: 'Grinch', zone: 'winter', lvl: 13, where: "Jerry's Workshop", keys: ['grinch_21'], cap: 750 },
  { name: 'Nutcracker', zone: 'winter', lvl: null, where: "Jerry's Workshop", keys: ['nutcracker_50'], cap: 500 },
  { name: 'Yeti', zone: 'winter', lvl: 25, where: "Jerry's Workshop", keys: ['yeti_175'], cap: 250 },
  { name: 'Reindrake', zone: 'winter', lvl: 35, where: "Jerry's Workshop", keys: ['reindrake_100'], cap: 50 },
];

export const ZONES = {
  water: 'Вода', hollows: 'Crystal Hollows', hotspot: 'Хотспоты', bayou: 'Backwater Bayou', lava: 'Лава (Crimson Isle)',
  spooky: 'Spooky Festival', festival: 'Fishing Festival', winter: "Jerry's Workshop",
};

/** Все ключи бестиария рыбалки — по ним ядро отбирает убийства из профиля. */
export const FISHING_MOB_KEYS = new Set(CREATURES.flatMap(c => c.keys));

/** 18 Trophy Fish: ключ в API, имя, редкость, где ловить, Magmafish при разделке (бронза/серебро/золото/алмаз). */
export const TROPHY_FISH = [
  { key: 'blobfish', name: 'Blobfish', rarity: 'COMMON', how: 'ловится везде', fillet: [4, 8, 12, 16] },
  { key: 'sulphur_skitter', name: 'Sulphur Skitter', rarity: 'COMMON', how: 'стой в 4 блоках от блока Sulphur Ore', fillet: [40, 60, 80, 120] },
  { key: 'gusher', name: 'Gusher', rarity: 'COMMON', how: 'с 7-й по 16-ю минуту после извержения вулкана', fillet: [32, 48, 64, 96] },
  { key: 'steaming_hot_flounder', name: 'Steaming-Hot Flounder', rarity: 'COMMON', how: 'поплавок в 2 блоках от гейзера в Blazing Volcano', fillet: [20, 28, 40, 60] },
  { key: 'obfuscated_fish_1', name: 'Obfuscated 1', rarity: 'COMMON', how: 'на Corrupted Bait', fillet: [16, 24, 32, 48] },
  { key: 'slugfish', name: 'Slugfish', rarity: 'UNCOMMON', how: 'не подсекай 20 секунд после заброса (10 с питомцем Slug)', fillet: [40, 60, 80, 120] },
  { key: 'flyfish', name: 'Flyfish', rarity: 'UNCOMMON', how: 'Blazing Volcano, поплавок на 8+ блоков ниже тебя', fillet: [32, 48, 64, 96] },
  { key: 'obfuscated_fish_2', name: 'Obfuscated 2', rarity: 'UNCOMMON', how: 'наживка — пойманная Obfuscated 1', fillet: [40, 60, 80, 120] },
  { key: 'lava_horse', name: 'Lavahorse', rarity: 'RARE', how: 'ловится везде', fillet: [12, 16, 20, 24] },
  { key: 'mana_ray', name: 'Mana Ray', rarity: 'RARE', how: 'нужно 1200+ маны, шанс растёт с маной', fillet: [40, 60, 80, 120] },
  { key: 'volcanic_stonefish', name: 'Volcanic Stonefish', rarity: 'RARE', how: 'Blazing Volcano', fillet: [20, 28, 40, 60] },
  { key: 'vanille', name: 'Vanille', rarity: 'RARE', how: 'только Starter Lava Rod без зачарований', fillet: [80, 120, 160, 240] },
  { key: 'obfuscated_fish_3', name: 'Obfuscated 3', rarity: 'RARE', how: 'наживка — пойманная Obfuscated 2', fillet: [400, 700, 1000, 1300] },
  { key: 'skeleton_fish', name: 'Skeleton Fish', rarity: 'EPIC', how: 'Burning Desert (или Dragontail)', fillet: [32, 48, 64, 96] },
  { key: 'moldfin', name: 'Moldfin', rarity: 'EPIC', how: 'Mystic Marsh (или Scarleton)', fillet: [32, 48, 64, 96] },
  { key: 'soul_fish', name: 'Soul Fish', rarity: 'EPIC', how: 'Stronghold', fillet: [32, 48, 64, 96] },
  { key: 'karate_fish', name: 'Karate Fish', rarity: 'EPIC', how: 'лавовые бассейны Dojo', fillet: [40, 60, 80, 120] },
  { key: 'golden_fish', name: 'Golden Fish', rarity: 'LEGENDARY', how: 'всплывает в лаве через 8–12 минут рыбалки', fillet: [400, 700, 1000, 1300] },
];
export const TIERS = ['bronze', 'silver', 'gold', 'diamond'];
export const TIER_RU = { bronze: 'бронза', silver: 'серебро', gold: 'золото', diamond: 'алмаз' };

/**
 * Счётчик по тирам: сколько видов из 18 поймано именно в этом тире (exact) и в этом или старше (atLeast — так считает Odger).
 * @param {Object} tf  members[uuid].trophy_fish
 * @returns {{ total: number, species: number, tiers: Object<string, { exact: number, atLeast: number }> }}
 */
export function trophyTierCounts(tf = {}) {
  const has = (k, t) => Number(tf[tx`${k}_${t}`] || 0) > 0;
  const tiers = Object.fromEntries(TIERS.map((t, i) => [t, {
    exact: TROPHY_FISH.filter(f => has(f.key, t)).length,
    atLeast: TROPHY_FISH.filter(f => TIERS.slice(i).some(x => has(f.key, x))).length,
  }]));
  return { total: TROPHY_FISH.length, species: tiers.bronze.atLeast, tiers };
}

/** Награды Odger (Trophy Fisher). rewards[] в API — номера полученных наград 1..4. */
export const TROPHY_RANKS = [
  { n: 1, name: 'Novice Trophy Fisher', need: 'bronze', count: 15, reward: 'Bronze Hunter Armor, Odger’s Bronze Tooth, Bronze Trophy Fishing Sack, открывает Thunder', armor: 'BRONZE_HUNTER' },
  { n: 2, name: 'Adept Trophy Fisher', need: 'silver', count: 18, reward: 'Silver Hunter Armor, Odger’s Silver Tooth, Silver Trophy Fishing Sack, открывает Lord Jawbus', armor: 'SILVER_HUNTER' },
  { n: 3, name: 'Expert Trophy Fisher', need: 'gold', count: 18, reward: 'Gold Hunter Armor, Odger’s Gold Tooth', armor: 'GOLD_HUNTER' },
  { n: 4, name: 'Master Trophy Fisher', need: 'diamond', count: 18, reward: 'Diamond Hunter Armor, Odger’s Diamond Tooth, Diamond the Fish', armor: 'DIAMOND_HUNTER' },
];

/** Ценные выпадения (цены — живые, с Bazaar/AH). */
export const DROPS = [
  { id: 'THUNDER_SHARDS', from: 'Thunder', note: 'материал для Thunder Armor' },
  { id: 'MAGMA_LORD_FRAGMENT', from: 'Lord Jawbus', note: 'материал для Magma Lord Armor' },
  { id: 'RADIOACTIVE_VIAL', from: 'Lord Jawbus', note: 'редкий: Flying Fish до Mythic' },
  { id: 'TITANOBOA_SHED', from: 'Titanoboa' },
  { id: 'GREAT_WHITE_SHARK_TOOTH', from: 'Great White Shark' },
  { id: 'TIGER_SHARK_TOOTH', from: 'Tiger Shark' },
  { id: 'BLUE_SHARK_TOOTH', from: 'Blue Shark' },
  { id: 'NURSE_SHARK_TOOTH', from: 'Nurse Shark' },
  { id: 'SHARK_FIN', from: 'акулы Fishing Festival' },
  { id: 'MAGMA_FISH', from: 'разделка трофеев у Odger' },
];

/** Питомцы для рыбалки (тип в API). */
// Типы питомцев с навыком Fishing по NEU constants/pets.json (pet_types)
export const FISHING_PETS = ['FLYING_FISH', 'AMMONITE', 'MEGALODON', 'BLUE_WHALE', 'DOLPHIN', 'BABY_YETI', 'SQUID', 'HERMIT_CRAB', 'SEAL', 'REINDEER'];

/** Коллекции рыбалки: ключи members.collection в API (лосось, рыба-клоун, иглобрюх — RAW_FISH:1/2/3). */
export const COLLECTIONS = [
  ['RAW_FISH', 'Raw Fish'], ['RAW_FISH:1', 'Raw Salmon'], ['RAW_FISH:2', 'Clownfish'], ['RAW_FISH:3', 'Pufferfish'],
  ['PRISMARINE_SHARD', 'Prismarine Shard'], ['PRISMARINE_CRYSTALS', 'Prismarine Crystals'], ['CLAY_BALL', 'Clay'],
  ['WATER_LILY', 'Lily Pad'], ['INK_SACK', 'Ink Sac'], ['SPONGE', 'Sponge'], ['MAGMA_FISH', 'Magmafish'],
];
