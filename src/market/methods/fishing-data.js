// Sea Creatures для расчёта дохода с рыбалки: где ловятся, требование Fishing, базовый вес и дропы.
// Источник: hypixel-skyblock.fandom.com, страницы «Sea Creatures/List/Water», «Sea Creatures/List/Lava» (веса, требования)
// и страница каждого существа (шаблон Mob Drops Table: количество и шанс), выгружено 23.11.2026 через браузер.
//
// w — базовый вес: шанс поймать существо = его вес / сумма весов всех доступных существ (вики «Sea Creature Weight»).
// drops: [id или список id-кандидатов, среднее количество, шанс 0..1]. Для «x1, +1 @100%, 50%» взято среднее 1,5.
// Цены сюда не пишем: они живые, с Bazaar и аукциона (methods/fishing.js).
//
// zone: water — любая вода; hotspot — водные Хотспоты (вместе с обычной водой); bayou — Backwater Bayou;
// hollows / hollowsLava — вода и лава Crystal Hollows; galatea / galateaLava — Galatea; lava — лава Crimson Isle;
// lavaHotspot — лавовые Хотспоты Crimson Isle (вместе с обычной лавой); spooky / winter / festival — события; oasis — Oasis.
// Патч 0.27.3 (ноябрь 2026, анонс Hypixel): Thunder Fragment и Magma Lord Fragment падают с шансом 50% вместо 100%;
// вики ещё показывает 100%, здесь уже 0,5.
// Уровень Thunder и Lord Jawbus, кроме Fishing, требует наград Odger (Novice и Adept Trophy Fisher).

export const SEA_CREATURES = [
  { name: "Squid", zone: 'water', lvl: 1, w: 1200, xp: 75, drops: [["WATER_LILY", 1.5, 1], ["INK_SACK", 2.5, 1], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Sea Walker", zone: 'water', lvl: 1, w: 800, xp: 150, drops: [["ROTTEN_FLESH", 6.5, 1], ["RAW_FISH", 2, 1], ["WATER_LILY", 1, 1], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Sea Guardian", zone: 'water', lvl: 5, w: 600, xp: 250, drops: [["WATER_LILY", 1.5, 1], ["PRISMARINE_CRYSTALS", 2.5, 1], ["PRISMARINE_SHARD", 2.5, 1], ["SEA_LANTERN", 1, 0.1], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Sea Witch", zone: 'water', lvl: 7, w: 700, xp: 400, drops: [["RAW_FISH:1", 2, 1], ["WATER_LILY", 1.5, 1], ["RAW_FISH:2", 1, 0.2], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Sea Archer", zone: 'water', lvl: 9, w: 550, xp: 169, drops: [["RAW_FISH", 2, 1], ["WATER_LILY", 1, 1], ["BONE", 10.5, 1], ["ENCHANTED_BONE", 1, 0.01], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Rider of the Deep", zone: 'water', lvl: 11, w: 400, xp: 338, drops: [["DARK_BAIT", 1, 0.5], ["ENCHANTED_FEATHER", 1, 0.5], ["ENCHANTED_ROTTEN_FLESH", 1, 0.5], ["WATER_LILY", 2, 1], ["ENCHANTMENT_MAGNET_6", 1, 0.02], ["SPONGE", 1, 0.2], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Catfish", zone: 'water', lvl: 13, w: 250, xp: 405, drops: [["RAW_FISH", 20, 1], ["RAW_FISH:1", 10, 1], ["RAW_FISH:3", 5, 1], ["RAW_FISH:2", 2, 1], ["WATER_LILY", 2.5, 1], ["SPONGE", 1, 0.2], ["ENCHANTMENT_FRAIL_6", 1, 0.01], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Sea Leech", zone: 'water', lvl: 16, w: 160, xp: 675, drops: [["RAW_FISH", 10, 1], ["WATER_LILY", 3.5, 1], ["RAW_FISH:2", 2, 1], ["SPONGE", 1, 0.4], ["ENCHANTMENT_SPIKED_HOOK_6", 1, 0.02], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Guardian Defender", zone: 'water', lvl: 17, w: 130, xp: 1013, drops: [["RAW_FISH", 15, 1], ["WATER_LILY", 6.1, 1], ["SPONGE", 1, 1], ["ENCHANTED_PRISMARINE_SHARD", 1, 0.6], ["ENCHANTED_PRISMARINE_CRYSTALS", 1, 0.5], ["ENCHANTMENT_LURE_6", 1, 0.02], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Deep Sea Protector", zone: 'water', lvl: 18, w: 88, xp: 1350, drops: [["WATER_LILY", 13.5, 1], ["ENCHANTED_IRON", 2, 1], ["RAW_FISH:2", 2.5, 1], ["SPONGE", 1, 1], ["ENCHANTMENT_ANGLER_6", 1, 0.02], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Water Hydra", zone: 'water', lvl: 19, w: 18, xp: 2025, drops: [["RAW_FISH", 20, 1], ["RAW_FISH:1", 2, 1], ["RAW_FISH:3", 2, 1], ["RAW_FISH:2", 2, 1], ["SPONGE", 5, 1], ["WATER_LILY", 17, 1], ["FISH_AFFINITY_TALISMAN", 1, 0.3], ["WATER_HYDRA_HEAD", 1, 0.14], ["ENCHANTMENT_LUCK_OF_THE_SEA_6", 1, 0.06], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Oasis Rabbit", zone: 'oasis', lvl: 10, w: 300, xp: 350, drops: [["WATER_LILY", 1.5, 1], ["RABBIT", 1, 1], ["RABBIT_FOOT", 1, 0.7], ["RABBIT_HIDE", 1, 0.7], ["ENCHANTED_RABBIT", 1, 0.05]] },
  { name: "Oasis Sheep", zone: 'oasis', lvl: 10, w: 700, xp: 350, drops: [["MUTTON", 1, 1], ["WOOL", 1, 1], ["WATER_LILY", 1.5, 1], ["ENCHANTED_MUTTON", 1, 0.05], ["ENCHANTED_COOKED_MUTTON", 1, 0.001]] },
  { name: "Water Worm", zone: 'hollows', lvl: 15, w: 300, xp: 400, drops: [["ROUGH_AMBER_GEM", 14.9, 1], ["WORM_MEMBRANE", 1, 0.15]] },
  { name: "Poisoned Water Worm", zone: 'hollows', lvl: 17, w: 300, xp: 270, drops: [["ROUGH_AMBER_GEM", 27.5, 1], ["WORM_MEMBRANE", 1, 0.2]] },
  { name: "Abyssal Miner", zone: 'hollows', lvl: 24, w: 90, xp: 770, drops: [["ROUGH_AMETHYST_GEM", 20, 1], ["ROUGH_JADE_GEM", 20, 1], ["ROUGH_SAPPHIRE_GEM", 20, 1], ["QUARTZ", 10, 1], ["FLAWED_AMETHYST_GEM", 1, 0.2], ["FLAWED_JADE_GEM", 1, 0.2], ["FLAWED_SAPPHIRE_GEM", 1, 0.2], ["ENCHANTMENT_PISCARY_6", 1, 0.005], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Flaming Worm", zone: 'hollowsLava', lvl: 19, w: 180, xp: 240, drops: [["ROUGH_SAPPHIRE_GEM", 27.5, 1], ["WORM_MEMBRANE", 1, 0.25], ["ETERNAL_FLAME_RING", 1, 0.005], ["DYE_CARMINE", 1, 2e-07]] },
  { name: "Lava Blaze", zone: 'hollowsLava', lvl: 20, w: 36, xp: 548, drops: [["ROUGH_TOPAZ_GEM", 27.5, 1], ["BLAZE_ROD", 5, 1], ["BLAZEN_SPHERE", 1, 0.01], ["ETERNAL_FLAME_RING", 1, 0.005], ["MAGMA_CORE", 1, 0.005], ["DYE_CARMINE", 1, 2e-07]] },
  { name: "Lava Pigman", zone: 'hollowsLava', lvl: 22, w: 36, xp: 568, drops: [["ROUGH_TOPAZ_GEM", 27.5, 1], ["ETERNAL_FLAME_RING", 1, 0.005], ["MAGMA_CORE", 1, 0.005], ["DYE_CARMINE", 1, 2e-07]] },
  { name: "Scarecrow", zone: 'spooky', lvl: 9, w: 1000, xp: 420, drops: [["HAY_BLOCK", 2, 1], ["WATER_LILY", 4, 1], ["GREEN_CANDY", 1, 1], ["PURPLE_CANDY", 1, 0.25]] },
  { name: "Nightmare", zone: 'spooky', lvl: 14, w: 550, xp: 820, drops: [["WATER_LILY", 7.2, 1], ["ENCHANTED_ROTTEN_FLESH", 1, 1], ["GREEN_CANDY", 2, 1], ["PURPLE_CANDY", 0.9, 1], ["LUCKY_HOOF", 1, 0.01]] },
  { name: "Werewolf", zone: 'spooky', lvl: 17, w: 250, xp: 1235, drops: [["GREEN_CANDY", 2, 1], ["PURPLE_CANDY", 1.4, 1], ["WATER_LILY", 18.5, 1], ["WEREWOLF_SKIN", 1.2, 1], ["DEEP_SEA_ORB", 1, 0.001]] },
  { name: "Phantom Fisher", zone: 'spooky', lvl: 21, w: 90, xp: 2525, drops: [["GREEN_CANDY", 5, 1], ["PURPLE_CANDY", 2.5, 1], ["WATER_LILY", 19, 1], ["PHANTOM_HOOK", 1, 0.01], ["DEEP_SEA_ORB", 1, 0.01], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Grim Reaper", zone: 'spooky', lvl: 26, w: 25, xp: 3950, drops: [["SPONGE", 3, 1], ["WATER_LILY", 38, 1], ["SOUL_FRAGMENT", 1, 1], ["PURPLE_CANDY", 4, 1], ["GREEN_CANDY", 7, 1], ["PET_ITEM_VAMPIRE_FANG", 1, 0.11], ["BOBBIN_SCRIPTURES", 1, 0.0185], ["SHREDDED_LINE", 1, 0.01], ["DEEP_SEA_ORB", 1, 0.01], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Frozen Steve", zone: 'winter', lvl: 1, w: 5000, xp: 101, drops: [["ESSENCE_ICE", 1, 1], ["ICE", 3, 1], ["WHITE_GIFT", 0.5, 1], ["ICY_SINKER", 1, 0.01]] },
  { name: "Frosty", zone: 'winter', lvl: 1, w: 2875, xp: 203, drops: [["ESSENCE_ICE", 3, 1], ["ICE", 24, 1], ["SNOW_BLOCK", 24, 1], ["ICE_HUNK", 1, 1], ["WHITE_GIFT", 0.5, 1], ["GREEN_GIFT", 0.5, 1], ["ENCHANTED_ICE", 1, 0.04], ["RED_GIFT", 1, 0.02]] },
  { name: "Grinch", zone: 'winter', lvl: 13, w: 1500, xp: 405, drops: [["ESSENCE_ICE", 6, 1], ["ICE", 48, 1], ["WHITE_GIFT", 1, 1], ["GREEN_GIFT", 0.5, 1], ["RED_GIFT", 1, 0.1], ["ENCHANTED_PACKED_ICE", 1, 0.005]] },
  { name: "Nutcracker", zone: 'winter', lvl: 28, w: 500, xp: 950, drops: [["ESSENCE_ICE", 18, 1], ["ENCHANTED_ICE", 1, 1], ["RED_GIFT", 1, 1], ["WALNUT", 0.5, 0.1], ["ENCHANTED_PACKED_ICE", 1, 0.02]] },
  { name: "Yeti", zone: 'winter', lvl: 25, w: 100, xp: 4050, drops: [["ESSENCE_ICE", 100, 1], ["ENCHANTED_ICE", 48, 1], ["ENCHANTED_RAW_FISH", 24, 1], ["RED_GIFT", 1.5, 1], ["ENCHANTED_PACKED_ICE", 1, 1], ["BLUE_ICE_HUNK", 1.5, 1], ["BABY_YETI;3", 1, 0.02], ["HILT_OF_TRUE_ICE", 1, 0.01]] },
  { name: "Reindrake", zone: 'winter', lvl: 35, w: 25, xp: 0, drops: [["WHITE_GIFT", 6.5, 1], ["GREEN_GIFT", 2.5, 1], ["RED_GIFT", 1, 1], ["ENCHANTMENT_PROSPERITY_1", 1, 1]] },
  { name: "Nurse Shark", zone: 'festival', lvl: 5, w: 1100, xp: 405, drops: [["SHARK_FIN", 2, 1], ["NURSE_SHARK_TOOTH", 1, 0.1], ["CARNIVAL_TICKET", 1, 0.001]] },
  { name: "Blue Shark", zone: 'festival', lvl: 10, w: 550, xp: 810, drops: [["SHARK_FIN", 4, 1], ["BLUE_SHARK_TOOTH", 1, 0.1], ["CARNIVAL_TICKET", 1, 0.0015]] },
  { name: "Tiger Shark", zone: 'festival', lvl: 18, w: 300, xp: 1013, drops: [["SHARK_FIN", 8, 1], ["TIGER_SHARK_TOOTH", 1, 0.1], ["MEGALODON;3", 1, 0.01], ["CARNIVAL_TICKET", 1, 0.0025]] },
  { name: "Great White Shark", zone: 'festival', lvl: 24, w: 150, xp: 2025, drops: [["SHARK_FIN", 16, 1], ["GREAT_WHITE_SHARK_TOOTH", 1, 0.1], ["MEGALODON;4", 1, 0.01], ["CARNIVAL_TICKET", 1, 0.005]] },
  { name: "Trash Gobbler", zone: 'bayou', lvl: 5, w: 750, xp: 175, drops: [["WATER_LILY", 1.5, 1], ["RAW_FISH", 1.5, 1], ["CLAY", 1.5, 1], ["CAN_OF_WORMS", 1, 0.2], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Dumpster Diver", zone: 'bayou', lvl: 5, w: 500, xp: 250, drops: [["RAW_FISH", 3, 1], ["WATER_LILY", 3, 1], ["CLAY", 3, 1], ["SPONGE", 1, 0.5], ["BRONZE_BOWL", 1, 0.045], ["OVERFLOWING_TRASH_CAN", 1, 0.02], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Banshee", zone: 'bayou', lvl: 10, w: 300, xp: 1000, drops: [["WATER_LILY", 6, 1], ["RAW_FISH:1", 6, 1], ["RAW_FISH:2", 3, 1], ["CLAY", 6, 1], ["ENCHANTED_CLAY_BALL", 1, 0.045], ["TORN_CLOTH", 1, 0.045], ["CALCIFIED_HEART", 1, 0.045], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Bayou Sludge", zone: 'bayou', lvl: 15, w: 100, xp: 1000, drops: [["WATER_LILY", 6, 1], ["SLIME_BALL", 6, 1], ["CLAY", 6, 1], ["ENCHANTED_SLIME_BALL", 1, 0.045], ["POISON_SAMPLE", 1, 0.01], ["ENCHANTMENT_RESPITE_1", 1, 0.01], ["ENCHANTED_SLIME_BLOCK", 1, 0.005], ["ENCHANTMENT_BLESSING_6", 1, 0.001], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Alligator", zone: 'bayou', lvl: 20, w: 50, xp: 1250, drops: [["WATER_LILY", 24, 1], ["RABBIT", 12, 1], ["RAW_FISH", 16, 1], ["ENCHANTED_RABBIT_FOOT", 1, 1], ["ALLIGATOR_SKIN", 1, 1], ["CLAY", 24, 1], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Titanoboa", zone: 'bayou', lvl: 30, w: 10, xp: 10000, drops: [["ENCHANTED_CLAY_BALL", 2, 1], ["ENCHANTED_PUFFERFISH", 1, 1], ["ENCHANTED_RAW_SALMON", 1, 1], ["ENCHANTED_RAW_FISH", 1, 1], ["ENCHANTED_WATER_LILY", 2, 1], ["ENCHANTED_CLAY_BLOCK", 1, 0.005], ["TITANOBOA_SHED", 1, 0.002], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Frog Man", zone: 'hotspot', lvl: 5, w: 1000, xp: 200, drops: [["HALF_EATEN_MUSHROOM", 1, 1], ["WATER_LILY", 1.5, 1], ["RAW_FISH:2", 1.5, 1], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Snapping Turtle", zone: 'hotspot', lvl: 10, w: 250, xp: 500, drops: [["WATER_LILY", 6, 1], ["GOLD_INGOT", 6, 1], ["RAW_FISH", 6, 1], ["ENCHANTED_GOLD", 1, 0.1], ["BROKEN_RADAR", 1, 0.01], ["EDIBLE_SEAWEED", 1, 0.005], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "Blue Ringed Octopus", zone: 'hotspot', lvl: 35, w: 25, xp: 5000, drops: [["ENCHANTED_RAW_FISH", 1, 1], ["ENCHANTED_WATER_LILY", 1, 1], ["ENCHANTED_RAW_SALMON", 1, 1], ["BLUE_RING", 1, 1], ["OCTOPUS_TENDRIL", 1, 0.002], ["EDIBLE_SEAWEED", 1, 0.005], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Wiki Tiki", zone: 'hotspot', lvl: 40, w: 5, xp: 20000, drops: [["ENCHANTED_JUNGLE_LOG", 32, 1], ["ENCHANTED_WATER_LILY", 8, 1], ["BOBBIN_SCRIPTURES", 1, 0.025], ["TROUBLED_BUBBLE", 1, 0.005], ["TIKI_MASK", 1, 0.0033], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Bogged", zone: 'galatea', lvl: 5, w: 5000, xp: 225, drops: [["SEA_LUMIES", 1.5, 1], ["MANGROVE_LOG", 12, 1], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Wetwing", zone: 'galatea', lvl: 7, w: 2875, xp: 650, drops: [["SEA_LUMIES", 3, 1], ["MANGROVE_LOG", 24, 1], ["ENCHANTED_MANGROVE_LOG", 1, 0.1], ["WET_WATER", 1, 0.025], ["DYE_AQUAMARINE", 1, 2e-07]] },
  { name: "Tadgang", zone: 'galatea', lvl: 9, w: 1500, xp: 150, drops: [["SEA_LUMIES", 6, 1], ["MANGROVE_LOG", 48, 1], ["ENCHANTED_MANGROVE_LOG", 1, 0.1], ["ENCHANTED_SEA_LUMIES", 1, 0.025], ["GILL_MEMBRANE", 1, 0.2]] },
  { name: "Ent", zone: 'galatea', lvl: 12, w: 500, xp: 270, drops: [["SEA_LUMIES", 12, 1], ["ENCHANTED_MANGROVE_LOG", 2, 1], ["ENCHANTED_SEA_LUMIES", 1, 0.05], ["MANGCORE", 1, 0.005], ["DYE_AQUAMARINE", 1, 4e-07]] },
  { name: "The Loch Emperor", zone: 'galatea', lvl: 20, w: 100, xp: 3375, drops: [["SEA_LUMIES", 48, 1], ["ENCHANTED_MANGROVE_LOG", 12, 1], ["DIVER_FRAGMENT", 1, 0.2], ["ENCHANTED_SEA_LUMIES", 1, 0.2], ["FLYING_FISH;2", 1, 0.04], ["FLYING_FISH;3", 1, 0.02], ["FLYING_FISH;4", 1, 0.005], ["MANGCORE", 1, 0.01], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Nessie", zone: 'galatea', lvl: 25, w: 25, xp: 7500, drops: [["ENCHANTED_SEA_LUMIES", 3, 1], ["ENCHANTED_MANGROVE_LOG", 24, 1], ["MANGCORE", 1, 0.1], ["MOUND_OF_SEAGRASS", 1, 0.02], ["BOBBIN_SCRIPTURES", 1, 0.01], ["VIBRANT_CORAL", 1, 0.005], ["DYE_AQUAMARINE", 1, 2e-05]] },
  { name: "Stridersurfer", zone: 'galateaLava', lvl: 17, w: 5000, xp: 800, drops: [["GILL_MEMBRANE", 1.4, 1], ["STURDY_BONE", 1, 0.4], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Magma Slug", zone: 'lava', lvl: 27, w: 1600, xp: 730, drops: [["MAGMA_FISH", 5, 1], ["LUMP_OF_MAGMA", 1.5, 1], ["SLUG_BOOTS", 1, 0.02], ["DYE_CARMINE", 1, 2e-07]] },
  { name: "Moogma", zone: 'lava', lvl: 28, w: 1200, xp: 950, drops: [["MAGMA_FISH", 8, 1], ["MOOGMA_PELT", 1.5, 1], ["MOOGMA_LEGGINGS", 1, 0.02], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Lava Leech", zone: 'lava', lvl: 30, w: 600, xp: 1400, drops: [["MAGMA_FISH", 20, 1], ["CUP_OF_BLOOD", 1, 1], ["BLADE_OF_THE_VOLCANO", 1, 0.05], ["PITCHIN_KOI", 1, 0.004], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Pyroclastic Worm", zone: 'lava', lvl: 31, w: 400, xp: 1100, drops: [["MAGMA_FISH", 10, 1], ["PYROCLASTIC_SCALE", 1, 1], ["ENCHANTMENT_CHARM_1", 1, 0.01], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Lava Flame", zone: 'lava', lvl: 33, w: 360, xp: 2100, drops: [["MAGMA_FISH", 40, 1], ["FLAMING_HEART", 1, 1], ["FLAMING_CHESTPLATE", 1, 0.02], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Fire Eel", zone: 'lava', lvl: 34, w: 280, xp: 2200, drops: [["MAGMA_FISH", 50, 1], ["ORB_OF_ENERGY", 1, 1], ["STAFF_OF_THE_VOLCANO", 1, 0.05], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Taurus", zone: 'lava', lvl: 35, w: 160, xp: 4300, drops: [["HORN_OF_TAURUS", 1, 1], ["MAGMA_FISH_SILVER", 1, 1], ["TAURUS_HELMET", 1, 0.02], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Thunder", zone: 'lava', lvl: 36, w: 40, xp: 12000, drops: [["THUNDER_SHARDS", 1, 0.5], ["MAGMA_FISH_SILVER", 10, 1], ["ENCHANTMENT_FLASH_1", 1, 0.015], ["DYE_CARMINE", 1, 4e-06], ["SHARD_BOGGED", 1, 0.02], ["SHARD_LAVA_FLAME", 1, 0.02], ["SHARD_MAGMA_SLUG", 1, 0.02], [["SHARD_LOCH_EMPEROR", "SHARD_SEA_EMPEROR"], 1, 0.02], ["SHARD_NIGHT_SQUID", 1, 0.02], ["SHARD_WATER_HYDRA", 1, 0.02], [["SHARD_LORD_JAWBUS", "SHARD_JAWBUS"], 1, 0.02], ["SHARD_FIRE_EEL", 1, 0.02]] },
  { name: "Lord Jawbus", zone: 'lava', lvl: 45, w: 8, xp: 40000, drops: [["MAGMA_LORD_FRAGMENT", 1, 0.5], ["MAGMA_FISH_SILVER", 25, 1], ["BOBBIN_SCRIPTURES", 1, 0.04], ["RADIOACTIVE_VIAL", 1, 0.005], ["DYE_CARMINE", 1, 4e-06], ["SHARD_BOGGED", 1, 0.02], ["SHARD_LAVA_FLAME", 1, 0.02], ["SHARD_MAGMA_SLUG", 1, 0.02], [["SHARD_LOCH_EMPEROR", "SHARD_SEA_EMPEROR"], 1, 0.02], ["SHARD_NIGHT_SQUID", 1, 0.02], ["SHARD_WATER_HYDRA", 1, 0.02], [["SHARD_LORD_JAWBUS", "SHARD_JAWBUS"], 1, 0.02], ["SHARD_FIRE_EEL", 1, 0.02]] },
  { name: "Fried Chicken", zone: 'lavaHotspot', lvl: 14, w: 1000, xp: 400, drops: [["RAW_CHICKEN", 3, 1], ["MAGMA_FISH", 1, 1], ["FRIED_FEATHER", 1, 0.5], ["ENCHANTED_RAW_CHICKEN", 1, 0.04], ["DYE_CARMINE", 1, 2e-07]] },
  { name: "Fireproof Witch", zone: 'lavaHotspot', lvl: 16, w: 250, xp: 1250, drops: [["MAGMA_FISH", 60, 1], ["ENCHANTED_GLOWSTONE_DUST", 1, 0.5], ["SINGED_POWDER", 1, 0.025], ["ENCHANTED_GLOWSTONE", 1, 0.005], ["ENCHANTMENT_FIRE_PROTECTION_6", 1, 0.0001], ["DYE_CARMINE", 1, 4e-07]] },
  { name: "Fiery Scuttler", zone: 'lavaHotspot', lvl: 37, w: 25, xp: 15000, drops: [["ENCHANTED_RAW_FISH", 8, 1], ["ENCHANTED_RAW_SALMON", 8, 1], ["SCORCHED_CRAB_STICK", 1, 1], ["MAGMA_FISH_SILVER", 1, 1], ["ENCHANTED_BLAZE_ROD", 1, 0.005], ["SEVERED_PINCER", 1, 0.002], ["SCUTTLER_SHELL", 1, 0.001], ["DYE_CARMINE", 1, 2e-05]] },
  { name: "Ragnarok", zone: 'lavaHotspot', lvl: 47, w: 5, xp: 20000, drops: [["MAGMA_FISH_SILVER", 32, 1], ["ENCHANTED_COAL", 32, 1], ["BRIMSTONE_HANDLE", 1, 0.02], ["BOBBIN_SCRIPTURES", 1, 0.045], ["CHAIN_END_TIMES", 1, 0.025], ["BURNT_TEXTS", 1, 0.01], ["DYE_CARMINE", 1, 2e-05]] },
];

/** Существа, которые открывает награда Odger, а не только уровень Fishing. */
export const TROPHY_LOCKED = { Thunder: 'novice', 'Lord Jawbus': 'adept' };
