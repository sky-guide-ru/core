// Проверенные данные для боевых гайдов.
// Источники: NotEnoughUpdates-REPO (items/*.json: требования слеера, рецепты; constants/rngscore.json: дропы RNG-метра;
// constants/leveling.json и misc.json: опыт и стоимость квестов) и вики hypixel-skyblock.fandom.com (тиры, HP, механики).
// Сверено 2026-11-23. Если в игре что-то поменяется — правится здесь, логика гайдов не трогается.

// ---------- Slayers ----------
// Стоимость квеста по тирам. Блейз дороже остальных, вампир платится Motes.
export const SLAYER_COST = {
  default: [2000, 7500, 20000, 50000, 100000],
  blaze: [10000, 25000, 60000, 150000],
  vampire: [2000, 4000, 5000, 7000, 10000],
};
// Опыт слеера за босса по тирам (NEU leveling.slayer_boss_xp / slayer_boss_xp_type)
export const SLAYER_BOSS_XP = { default: [5, 25, 100, 500, 1500], vampire: [10, 25, 60, 120, 150] };
export const SLAYER_MAX_TIER = { zombie: 5, spider: 5, wolf: 4, enderman: 4, blaze: 4, vampire: 5 };

export const SLAYER_INFO = {
  zombie: {
    title: 'Revenant Horror', ru: 'Зомби', icon: 'BEHEADED_HORROR', where: 'Hub → Graveyard (кладбище и склепы)',
    unlock: 'Открыт сразу',
    tiers: [
      { hp: '500', mech: 'Life Drain: высасывает здоровье' },
      { hp: '20 тыс.', mech: 'Pestilence: урон по площади и −25% защиты' },
      { hp: '400 тыс.', mech: 'Enrage: через 40 с босс звереет и бьёт сильнее' },
      { hp: '1,5 млн', mech: 'Всё то же, но больше урона и здоровья' },
      { hp: '10 млн', mech: 'Atoned Horror: TNT, усиленная стадия с 1/3 HP, молния через 30 с. Нужен Zombie Slayer 7' },
    ],
    gear: [
      'Броня: Reaper/Revenant на старте, дальше Warden Helmet и любая сильная мили-броня (Crimson, Necron)',
      'Оружие: Reaper Falchion → Axe of the Shredded (Halberd) или Reaper Scythe; хорошо идёт и Hyperion/Livid Dagger',
      'Зачарование Smite VI–VII (Smite VI падает с босса) даёт большой бонус против нежити',
      'Питомец: Golden Dragon, Ender Dragon или Tiger',
    ],
    money: 'T5 убивается быстро, Revenant Viscera и Foul Flesh продаются всегда. Главные деньги — редкие Scythe Blade, Shard of the Shredded (Shredded Sinew) и Warden Heart.',
  },
  spider: {
    title: 'Tarantula Broodfather', ru: 'Паук', icon: 'TARANTULA_HELMET', where: "Spider's Den → Arachne's Burrow (и верхушка горы)",
    unlock: 'Нужен Revenant Horror T2',
    tiers: [
      { hp: '—', mech: 'Первый тир' },
      { hp: '—', mech: 'Сильнее предыдущего' },
      { hp: '—', mech: 'Сильнее предыдущего' },
      { hp: '—', mech: 'Сильнее предыдущего' },
      { hp: '—', mech: 'Высший тир' },
    ],
    gear: [
      'Броня: Tarantula (с 4–5 уровня) → Primordial (7 уровень)',
      'Оружие: Recluse Fang, Scorpion Foil (6 уровень) → Sting (8 уровень); лучники берут Spider Shortbow / Mosquito Shortbow',
      'Зачарование Bane of Arthropods VI–VII (книга VI падает с босса)',
    ],
    money: 'Tarantula Silk и Tarantula Web идут на крафты (Terminator требует 128 Silk). Дорогие редкие дропы — Shriveled Wasp, Ensnared Snail, Digested Mosquito и Primordial Eye.',
  },
  wolf: {
    title: 'Sven Packmaster', ru: 'Волк', icon: 'MASTIFF_HELMET', where: 'Hub → Ruins или Howling Cave в Парке',
    unlock: 'Нужен Tarantula Broodfather T2',
    tiers: [
      { hp: '—', mech: 'Быстрые удары с истинным уроном (True Damage)' },
      { hp: '—', mech: 'Больше урона и здоровья' },
      { hp: '—', mech: 'На 50% HP зовёт щенков и неуязвим, пока они живы' },
      { hp: '—', mech: 'То же, сильнее; лучший тир для фарма' },
    ],
    gear: [
      'Нужна истинная защита (True Defense): Mastiff даёт много здоровья, Sorrow/Necron тоже подходят',
      'Оружие: Pooch Sword (6 уровень) или любой сильный мили-меч, Hyperion',
      'Питомец: Golden Dragon или Tiger',
    ],
    money: 'Wolf Teeth и Golden Tooth стабильно продаются. Редкие: Overflux Capacitor (дорогой), Red Claw Egg, Grizzly Bait, Couture Rune.',
  },
  enderman: {
    title: 'Voidgloom Seraph', ru: 'Эндермен', icon: 'FINAL_DESTINATION_HELMET', where: "The End → Bruiser Hideout / Dragon's Nest, с 4 уровня — Void Sepulture",
    unlock: 'Нужен Sven Packmaster T4',
    tiers: [
      { hp: '300 тыс.', mech: 'Телепорты, щит из 15 ударов (Hitshield)' },
      { hp: '12 млн', mech: 'Yang Glyphs (маяки — встань и сломай), щит 30 ударов' },
      { hp: '50 млн', mech: 'Головы Nukekubi (бей их), щит 60 ударов' },
      { hp: '210 млн', mech: 'Лучи Broken Heart Radiation (8 с неуязвимости), щит 100 ударов' },
    ],
    gear: [
      'Броня: Final Destination (4 уровень) — сильнее с каждым убитым эндерменом',
      'Оружие: Voidedge → Vorpal → Atomsplit Katana; на T4 многие бьют Hyperion или Terminator',
      'Щит ломается количеством ударов, а не уроном: Terminator и Atomsplit сбивают его быстрее всего',
      'Питомец: Ender Dragon или Golden Dragon',
    ],
    money: 'Самый денежный слеер: Null Sphere/Null Ovoid, Summoning Eye, Judgement Core (для Terminator), Pocket Espresso Machine, Handy Blood Chalice, Exceedingly Rare Ender Artifact Upgrader.',
  },
  blaze: {
    title: 'Inferno Demonlord', ru: 'Блейз', icon: 'FIREDUST_DAGGER', where: 'Crimson Isle → Smoldering Tomb (с 4 уровня есть свиток телепорта) и Stronghold',
    unlock: 'Нужен Voidgloom Seraph T3',
    tiers: [
      { hp: '2,5 млн', mech: 'Immolate: истинный урон каждую секунду; на 50% HP делится на Quazii и Typhoeus' },
      { hp: '10 млн', mech: 'Hellion Shield: урон режется на 99%, если аттюнмент кинжала не совпал; щит меняется каждые 8 ударов' },
      { hp: '45 млн', mech: 'Огненные ямы (DDR Apocalypse), луч у Quazii' },
      { hp: '150 млн', mech: 'Огненный след у Typhoeus, демоны делятся на 2/3 и 1/3 HP' },
    ],
    gear: [
      'Оружие: только кинжалы блейз-слеера — Firedust или Twilight (2 уровень) → Kindlebane или Mawdredge (4) → Pyrochaos или Deathripper (6)',
      'Против щита переключай аттюнмент кинжала (ПКМ), чтобы цвет совпадал',
      'Броня: Crimson (мили) с Kuudra или Aurora; на старте хватит любой сильной брони',
    ],
    money: 'Дорогие редкие дропы: High Class Archfiend Dice, Fine Opal Gemstone, Kelvin/Subzero Inverter, Scorched Power Crystal, Wilson\'s Engineering Plans. Ещё Derelict Ashe и Enchanted Blaze Powder.',
  },
  vampire: {
    title: 'Riftstalker Bloodfiend', ru: 'Вампир', icon: 'STEAK_STAKE', where: 'Rift → Stillgore Château',
    unlock: 'Нужен Sven Packmaster T2 и доступ в Stillgore Château',
    motes: true,
    tiers: [
      { hp: '625', mech: 'Coagulation, Spectral Form, Mania' },
      { hp: '1100', mech: 'Twinclaws (уклоняйся), Stonewrath' },
      { hp: '1800', mech: 'Killer Spring, Impel (жми нужную кнопку)' },
      { hp: '2400', mech: 'Больше урона' },
      { hp: '3000', mech: 'Blood Ichor' },
    ],
    gear: [
      'В Рифте своё снаряжение: всё решают Hearts и Rift-статы, а не броня основного мира',
      'Steak Stake (2 уровень) добивает босса на низком HP; Super Sharp \'n Stabby Steak Stake — с 3 уровня',
      'Silver-Laced Karambit → Silver-Twist Karambit, Leggings of the Coven, Lively Sepulture Chestplate (5 уровень)',
    ],
    money: 'Денег почти не даёт: ценность в постоянных статах и SkyBlock XP. Редкие McGrubber\'s Burger и Unfanged Vampire Part полезны в Рифте.',
  },
};

// Что открывает каждый уровень слеера (NEU items: slayer_req и строки «Requires … Slayer N»)
export const SLAYER_UNLOCKS = {
  zombie: { 1: ['WAND_OF_HEALING'], 2: ['ZOMBIE_RING', 'REVENANT_VISCERA'], 3: ['REVENANT_SWORD', 'CRYSTALLIZED_HEART', 'WAND_OF_MENDING'], 4: ['REVENANT_BOOTS', 'REVENANT_LEGGINGS'], 5: ['REVENANT_CHESTPLATE', 'DEVOUR_RING', 'VOODOO_DOLL', 'REVENANT_GENERATOR_1'], 6: ['REAPER_SWORD', 'REVIVED_HEART', 'WAND_OF_RESTORATION'], 7: ['REAPER_MASK', 'REAPER_SCYTHE', 'REAPER_CHESTPLATE', 'ZOMBIE_ARTIFACT', 'WAND_OF_ATONEMENT'], 8: ['AXE_OF_THE_SHREDDED', 'WARDEN_HELMET', 'REAPER_ORB'], 9: ['REVENANT_GENERATOR_12'] },
  spider: { 1: ['SPIDER_RING'], 2: ['TARANTULA_SILK'], 3: ['RECLUSE_FANG', 'SCORPION_BOW'], 4: ['TARANTULA_BOOTS', 'TARANTULA_LEGGINGS'], 5: ['TARANTULA_HELMET', 'TARANTULA_CHESTPLATE', 'TARANTULA_GENERATOR_1'], 6: ['SCORPION_FOIL', 'SPIDER_ARTIFACT', 'TARANTULA_TALISMAN'], 7: ['PRIMORDIAL_CHESTPLATE', 'MOSQUITO_BOW', 'TARANTULA_RING', 'SURVIVOR_CUBE'], 8: ['STING', 'THE_PRIMORDIAL'] },
  wolf: { 1: ['RED_CLAW_TALISMAN'], 2: ['RADIANT_POWER_ORB'], 3: ['SHAMAN_SWORD', 'AATROX_BATPHONE'], 4: ['MASTIFF_CHESTPLATE', 'MASTIFF_HELMET'], 5: ['RED_CLAW_RING', 'RED_CLAW_ARTIFACT', 'WEIRD_TUBA'], 6: ['POOCH_SWORD', 'CHESTPLATE_OF_THE_PACK', 'MANA_FLUX_POWER_ORB'], 7: ['OVERFLUX_POWER_ORB', 'HUNTER_TALISMAN', 'HUNTER_RING'] },
  enderman: { 1: ['VOIDWALKER_KATANA'], 2: ['SOULFLOW_PILE', 'NULL_OVOID', 'LESSER_SOULFLOW_ENGINE'], 3: ['VOIDEDGE_KATANA', 'SOUL_ESOWARD'], 4: ['FINAL_DESTINATION_CHESTPLATE', 'VOIDLING_GENERATOR_1', 'POCKET_ESPRESSO_MACHINE'], 5: ['VORPAL_KATANA', 'JUJU_SHORTBOW', 'GLOOMLOCK_GRIMOIRE', 'SOULFLOW_ENGINE', 'HANDY_BLOOD_CHALICE'], 6: ['ATOMSPLIT_KATANA', 'ASPECT_OF_THE_VOID', 'GYROKINETIC_WAND', 'SINSEEKER_SCYTHE'], 7: ['TERMINATOR', 'ENDER_RELIC', 'ETHERWARP_CONDUIT', 'SOULFLOW_SUPERCELL'] },
  blaze: { 2: ['FIREDUST_DAGGER', 'MAWDUST_DAGGER'], 3: ['BURSTSTOPPER_TALISMAN', 'INFERNO_GENERATOR_1', 'WARNING_FLARE'], 4: ['BURSTFIRE_DAGGER', 'BURSTMAW_DAGGER', 'DEMONLORD_GAUNTLET', 'SMOLDERING_CHAMBERS_TRAVEL_SCROLL'], 5: ['DESTRUCTION_CLOAK'], 6: ['HEARTFIRE_DAGGER', 'HEARTMAW_DAGGER', 'ALERT_FLARE'], 7: ['ANNIHILATION_CLOAK', 'BURSTSTOPPER_ARTIFACT', 'SOS_FLARE'], 8: ['GABAGOEY_MIXIN'] },
  vampire: { 1: ['SILVER_LACED_KARAMBIT', 'ANTI_BITE_SCARF', 'HOLY_ICE'], 2: ['STEAK_STAKE', 'JUICY_HEALING_MELON'], 3: ['SHARP_STEAK_STAKE', 'LEGGINGS_OF_THE_COVEN', 'BLOODBADGE'], 4: ['SILVERTWIST_KARAMBIT', 'ANTI_BITE_SCARF_2'], 5: ['LIVELY_SEPULTURE_CHESTPLATE', 'VAMPIRE_DENTIST_RELIC'] },
};

// Редкие дропы (RNG-метр, NEU constants/rngscore.json → slayer)
export const SLAYER_RNG = {
  zombie: ['WARDEN_HEART', 'SHARD_OF_THE_SHREDDED', 'SCYTHE_BLADE', 'SEVERED_HAND', 'BEHEADED_HORROR', 'REVENANT_CATALYST', 'UNDEAD_CATALYST', 'SNAKE_RUNE;1', 'SMITE;6', 'FESTERING_MAGGOT'],
  spider: ['PRIMORDIAL_EYE', 'SHRIVELED_WASP', 'ENSNARED_SNAIL', 'DIGESTED_MOSQUITO', 'TARANTULA_TALISMAN', 'FLY_SWATTER', 'VIAL_OF_VENOM', 'TARANTULA_CATALYST', 'BANE_OF_ARTHROPODS;6', 'BITE_RUNE;1'],
  wolf: ['OVERFLUX_CAPACITOR', 'GRIZZLY_BAIT', 'RED_CLAW_EGG', 'COUTURE_RUNE;1', 'HAMSTER_WHEEL', 'FURBALL', 'CRITICAL;6', 'SPIRIT_RUNE;1'],
  enderman: ['JUDGEMENT_CORE', 'EXCEEDINGLY_RARE_ENDER_ARTIFACT_UPGRADER', 'ENDSTONE_IDOL', 'ETHERWARP_MERGER', 'HANDY_BLOOD_CHALICE', 'POCKET_ESPRESSO_MACHINE', 'SINFUL_DICE', 'TRANSMISSION_TUNER', 'NULL_ATOM', 'SUMMONING_EYE', 'HAZMAT_ENDERMAN', 'DRAGON_RUNE;1', 'ENDERSNAKE_RUNE;1'],
  blaze: ['HIGH_CLASS_ARCHFIEND_DICE', 'WILSON_ENGINEERING_PLANS', 'SUBZERO_INVERTER', 'KELVIN_INVERTER', 'FINE_OPAL_GEM', 'SCORCHED_POWER_CRYSTAL', 'ARCHFIEND_DICE', 'MANA_DISINTEGRATOR', 'SCORCHED_BOOKS', 'FIERY_BURST_RUNE;1', 'LAVATEARS_RUNE;1', 'CRUDE_GABAGOOL_DISTILLATE', 'WISP_POTION'],
  vampire: ['MCGRUBBER_BURGER', 'UNFANGED_VAMPIRE_PART', 'BUBBA_BLISTER', 'GUARDIAN_LUCKY_BLOCK', 'SOULTWIST_RUNE;1', 'CHOCOLATE_CHIP'],
};

// Ключевые крафты (NEU recipes), чтобы показать, чего не хватает
export const RECIPES = {
  TERMINATOR: { JUDGEMENT_CORE: 1, NULL_BLADE: 3, TESSELLATED_ENDER_PEARL: 8, BRAIDED_GRIFFIN_FEATHER: 4, TARANTULA_SILK: 128 },
  ATOMSPLIT_KATANA: { VORPAL_KATANA: 1, NULL_BLADE: 2 },
  VORPAL_KATANA: { VOIDEDGE_KATANA: 1, NULL_EDGE: 1, NULL_OVOID: 8, REFINED_MITHRIL: 8 },
  FIREDUST_DAGGER: { MOLTEN_POWDER: 1, MAGMA_FISH_SILVER: 30, STICK: 1 },
  MAWDUST_DAGGER: { MOLTEN_POWDER: 1, ENCHANTED_SULPHUR: 5, STICK: 1 },
  BURSTFIRE_DAGGER: { FIREDUST_DAGGER: 1, MOLTEN_POWDER: 8, MAGMA_FISH_GOLD: 1 },
  HEARTFIRE_DAGGER: { BURSTFIRE_DAGGER: 1, MOLTEN_POWDER: 64, INFERNO_VERTEX: 16, MAGMA_FISH_GOLD: 8 },
  AXE_OF_THE_SHREDDED: { REAPER_SWORD: 1, SHARD_OF_THE_SHREDDED: 4, REVENANT_VISCERA: 256 },
  WARDEN_HELMET: { WARDEN_HEART: 1, REVIVED_HEART: 2, ENCHANTED_IRON_BLOCK: 128 },
  STING: { SCORPION_FOIL: 1, SHRIVELED_WASP: 4, TARANTULA_SILK: 256 },
  POOCH_SWORD: { SHAMAN_SWORD: 1, GOLDEN_TOOTH: 48 },
};

// ---------- Dungeons ----------
export const MASTER_REQ = { 1: 24, 2: 26, 3: 28, 4: 30, 5: 32, 6: 34, 7: 36 };
export const FLOORS = [
  { f: 0, boss: 'The Watcher' },
  { f: 1, boss: 'Bonzo', loot: ['BONZO_STAFF', 'BONZO_MASK'], mloot: ['MASTER_SKULL_TIER_1'] },
  { f: 2, boss: 'Scarf', loot: ['ADAPTIVE_BELT', 'STONE_BLADE', 'RED_SCARF'], mloot: ['MASTER_SKULL_TIER_2'] },
  { f: 3, boss: 'The Professor', loot: ['ADAPTIVE_CHESTPLATE', 'SUSPICIOUS_VIAL'], mloot: ['FIRST_MASTER_STAR'] },
  { f: 4, boss: 'Thorn', loot: ['SPIRIT;4', 'ITEM_SPIRIT_BOW', 'SPIRIT_SWORD'], mloot: ['SECOND_MASTER_STAR', 'SPIRIT_MASK'] },
  { f: 5, boss: 'Livid', loot: ['LAST_BREATH', 'SHADOW_FURY', 'LIVID_DAGGER', 'SHADOW_ASSASSIN_CHESTPLATE'], mloot: ['THIRD_MASTER_STAR'] },
  { f: 6, boss: 'Sadan', loot: ['GIANTS_SWORD', 'PRECURSOR_EYE', 'NECROMANCER_LORD_CHESTPLATE', 'SUMMONING_RING'], mloot: ['FOURTH_MASTER_STAR'] },
  { f: 7, boss: 'Necron (Maxor, Storm, Goldor, Necron)', loot: ['NECRON_HANDLE', 'IMPLOSION_SCROLL', 'SHADOW_WARP_SCROLL', 'WITHER_SHIELD_SCROLL', 'WITHER_CHESTPLATE'], mloot: ['FIFTH_MASTER_STAR', 'DARK_CLAYMORE', 'MASTER_SKULL_TIER_5'] },
];
// Броня Wither по классам (POWER — Necron, WISE — Storm, TANK — Goldor, SPEED — Maxor)
export const WITHER_SETS = [
  { base: 'POWER_WITHER', name: "Necron's Armor", for: ['berserk', 'archer'] },
  { base: 'WISE_WITHER', name: "Storm's Armor", for: ['mage', 'healer'] },
  { base: 'TANK_WITHER', name: "Goldor's Armor", for: ['tank'] },
  { base: 'SPEED_WITHER', name: "Maxor's Armor", for: [] },
];
export const CLASS_GEAR = {
  archer: { weapons: ['TERMINATOR', 'JUJU_SHORTBOW', 'LAST_BREATH', 'ITEM_SPIRIT_BOW'], note: 'Archer живёт на Terminator: он стреляет тремя стрелами, ломает щиты и чистит комнаты. До него — Juju Shortbow.' },
  mage: { weapons: ['HYPERION', 'NECRON_BLADE', 'MIDAS_STAFF', 'BAT_WAND'], note: 'Mage чистит комнаты Hyperion (Implosion, Shadow Warp, Wither Shield) и бьёт боссов способностями.' },
  berserk: { weapons: ['DARK_CLAYMORE', 'GIANTS_SWORD', 'SHADOW_FURY', 'LIVID_DAGGER'], note: 'Berserk — ближний урон: Livid Dagger, Shadow Fury, Giant\'s Sword, на M7 Dark Claymore.' },
  healer: { weapons: ['HYPERION', 'SOUL_WHIP', 'BAT_WAND'], note: 'Healer держит группу живой (Wand of Atonement и т. п.) и часто стоит в Storm\'s Armor.' },
  tank: { weapons: ['AXE_OF_THE_SHREDDED', 'GIANTS_SWORD'], note: 'Tank держит урон и стоит в Goldor\'s Armor.' },
};
export const DUNGEON_ESSENTIALS = [
  { id: 'SPIRIT_MASK', hint: 'спасает от смерти раз в 30 с (M4 / покупка)' },
  { id: 'BONZO_MASK', alt: ['STARRED_BONZO_MASK'], hint: 'ещё одна «вторая жизнь» (F1/M1)' },
  { id: 'ASPECT_OF_THE_VOID', hint: 'телепорт и Etherwarp по комнатам' },
  { id: 'INFINITE_SPIRIT_LEAP', alt: ['SPIRIT_LEAP'], hint: 'прыжок к сокоманднику' },
  { id: 'WITHER_CLOAK', hint: 'неуязвимость на боссе F7/M7' },
  { id: 'ICE_SPRAY_WAND', hint: 'замораживает мобов, нужен на M-этажах' },
  { id: 'SPRING_BOOTS', hint: 'высокий прыжок через стены' },
  { id: 'CATACOMBS_EXPERT_RING', hint: 'аксессуар для данжей' },
];

// ---------- Kuudra ----------
export const KUUDRA_TIERS = [
  { key: 'basic', name: 'Basic', rep: 0, combat: 22, keyId: 'KUUDRA_TIER_KEY', prefix: '', book: 'I' },
  { key: 'hot', name: 'Hot', rep: 1000, combat: 27, keyId: 'KUUDRA_HOT_TIER_KEY', prefix: 'HOT_', book: 'II' },
  { key: 'burning', name: 'Burning', rep: 3000, combat: 32, keyId: 'KUUDRA_BURNING_TIER_KEY', prefix: 'BURNING_', book: 'III' },
  { key: 'fiery', name: 'Fiery', rep: 7000, combat: 37, keyId: 'KUUDRA_FIERY_TIER_KEY', prefix: 'FIERY_', book: 'IV' },
  { key: 'infernal', name: 'Infernal', rep: 12000, combat: 42, keyId: 'KUUDRA_INFERNAL_TIER_KEY', prefix: 'INFERNAL_', book: 'V' },
];
// Сеты брони Kuudra (бонус сета из лора NEU)
export const KUUDRA_SETS = [
  { base: 'CRIMSON', bonus: 'Dominus', role: 'мили (ближний бой)', for: ['berserk', 'tank'] },
  { base: 'TERROR', bonus: 'Hydra Strike', role: 'лучник', for: ['archer'] },
  { base: 'AURORA', bonus: 'Arcane Energy', role: 'маг', for: ['mage', 'healer'] },
  { base: 'FERVOR', bonus: 'Fervor', role: 'другие сборки', for: [] },
  { base: 'HOLLOW', bonus: 'Spirit', role: 'другие сборки', for: [] },
];
export const KUUDRA_LOOT = ['KUUDRA_TEETH', 'ESSENCE_CRIMSON', 'HEAVY_PEARL', 'WHEEL_OF_FATE', 'ENRAGER', 'HELLSTORM_STAFF', 'BURNING_KUUDRA_CORE', 'TENTACLE_DYE'];
