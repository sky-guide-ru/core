// Фикстура Member для профиля OwnerCat (Zucchini) по снимку 2026-11-22.
// Цифры скиллов/слееров/данжей — реальные; инвентарь и опыт внутри уровня — правдоподобные заглушки.
const lvl = (level, maxLevel, progress = 0.4, xpForNext = 1_000_000) =>
  ({ level, maxLevel, xp: 0, xpCurrent: Math.round(xpForNext * progress), xpForNext: level >= maxLevel ? 0 : xpForNext, progress: level >= maxLevel ? 1 : progress, apiMissing: false });
const SK = { farming: 'Фермерство', mining: 'Добыча', combat: 'Бой', foraging: 'Лесорубство', fishing: 'Рыбалка', enchanting: 'Зачарование', alchemy: 'Алхимия', carpentry: 'Плотничество', runecrafting: 'Руническое ремесло', taming: 'Приручение', social: 'Общение', hunting: 'Охота' };
const sl = (name, ru, level, maxLevel, xp, xpForNext, kills) => ({ name, ru, level, maxLevel, xp, xpForNext, progress: xpForNext ? 0.3 : 1, kills });
const item = (id, name, extra = {}) => ({ id, name, rarity: 'LEGENDARY', recomb: false, hpb: 0, stars: 0, enchants: {}, lore: ['§6§lLEGENDARY'], count: 1, ...extra });

export function ownercatMember() {
  const skills = {
    farming: lvl(60, 60), mining: lvl(60, 60), enchanting: lvl(60, 60), taming: lvl(50, 50), combat: lvl(47, 60, 0.55, 2_600_000),
    fishing: lvl(36, 50, 0.2, 1_800_000), foraging: lvl(24, 54, 0.6, 600_000), alchemy: lvl(50, 50), carpentry: lvl(44, 50, 0.1, 2_400_000),
    runecrafting: lvl(25, 25), social: lvl(20, 25), hunting: lvl(8, 50, 0.3, 3_500),
  };
  for (const [k, n] of Object.entries(SK)) skills[k].name = n;
  return {
    uuid: '0123456789abcdef0123456789abcdef', profileId: 'fedcba9876543210fedcba9876543210', profileName: 'Zucchini', gameMode: 'normal', coopMembers: 4,
    sbLevel: 273.3, purse: 0, bank: 75_800_000, personalBank: 0, cookie: true,
    essence: { WITHER: 4_000, DRAGON: 12_000, CRIMSON: 3_000 },
    fairySouls: { collected: 245, exchanges: 49, unspent: 0 },
    skills, skillAverage: 49.6, farmingCap: 60, tamingCap: 50, tamingSacrificed: 0,
    slayers: {
      zombie: sl('Revenant Horror', 'Зомби', 8, 9, 520_000, 1_000_000, { 1: 5, 2: 10, 3: 40, 4: 300, 5: 120 }),
      spider: sl('Tarantula Broodfather', 'Паук', 7, 9, 160_000, 400_000, { 1: 5, 2: 10, 3: 50, 4: 250, 5: 0 }),
      wolf: sl('Sven Packmaster', 'Волк', 7, 9, 150_000, 400_000, { 1: 5, 2: 10, 3: 60, 4: 260, 5: 0 }),
      enderman: sl('Voidgloom Seraph', 'Эндермен', 7, 9, 180_000, 400_000, { 1: 5, 2: 20, 3: 120, 4: 250, 5: 0 }),
      blaze: sl('Inferno Demonlord', 'Блейз', 0, 9, 0, 10, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
      vampire: sl('Riftstalker Bloodfiend', 'Вампир', 0, 5, 0, 20, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
    },
    dungeons: {
      catacombs: { level: 27, progress: 0.35, xp: 0, xpCurrent: 115_000, xpForNext: 328_000 },
      selectedClass: 'archer',
      classes: { healer: { level: 12, name: 'Хилер' }, mage: { level: 15, name: 'Маг' }, berserk: { level: 17, name: 'Берсерк' }, archer: { level: 27, name: 'Лучник' }, tank: { level: 10, name: 'Танк' } },
      classAverage: 16.2, floors: { 0: 3, 1: 10, 2: 10, 3: 12, 4: 15, 5: 30, 6: 25, 7: 8 }, masterFloors: {}, fastestS: {}, fastestSPlus: {}, masterFastestSPlus: {}, secrets: 2400,
    },
    mining: { hotm: { level: 10, progress: 1 }, powder: { mithril: 12e6, gemstone: 20e6, glacite: 5e6, mithrilAvail: 300_000, gemstoneAvail: 900_000, glaciteAvail: 100_000 }, nodes: {}, potm: 5, nucleusRuns: 40 },
    hotfXp: 9_500,
    crimson: { faction: 'barbarians', barbarianRep: 2_400, mageRep: 0, kuudra: { basic: 0, hot: 1, burning: 0, fiery: 0, infernal: 0 }, dojo: {}, trophyFish: {} },
    magicalPower: 1009, selectedPower: 'silky', tuning: { slot_0: { critical_damage: 100 } }, unlockedPowers: [], bagUpgrades: 10, riftPrism: true,
    pets: [
      { type: 'ENDER_DRAGON', tier: 'LEGENDARY', exp: 30_000_000, active: true, heldItem: 'PET_ITEM_TIER_BOOST' },
      { type: 'ELEPHANT', tier: 'LEGENDARY', exp: 26_000_000, active: false, heldItem: null },
      { type: 'MOOSHROOM_COW', tier: 'LEGENDARY', exp: 26_000_000, active: false, heldItem: null },
      { type: 'BAL', tier: 'LEGENDARY', exp: 8_000_000, active: false, heldItem: null },
      { type: 'BLACK_CAT', tier: 'EPIC', exp: 1_000_000, active: false, heldItem: null },
    ],
    collections: { WHEAT: 50_000_000, LOG: 40_000, BLAZE_ROD: 5_000 },
    minions: ['WHEAT_1', 'WHEAT_2', 'WHEAT_3', 'WHEAT_4', 'WHEAT_5', 'WHEAT_6', 'WHEAT_7', 'WHEAT_8', 'WHEAT_9', 'WHEAT_10', 'WHEAT_11', 'WHEAT_12',
      ...Array.from({ length: 11 }, (_, i) => `COBBLESTONE_${i + 1}`), ...Array.from({ length: 11 }, (_, i) => `SNOW_${i + 1}`),
      ...Array.from({ length: 300 }, (_, i) => `FILLER${Math.floor(i / 10)}_${(i % 10) + 1}`)],
    perks: {},
    garden: { copper: 120_000, experience: 0, cropUpgrades: { WHEAT: 9, CARROT: 9, POTATO: 7, MELON: 9, PUMPKIN: 9, SUGAR_CANE: 9, CACTUS: 6, COCOA_BEANS: 9, MUSHROOM: 9, NETHER_WART: 9 }, unlockedPlots: 24 },
    jacob: { medals: {}, perks: { farming_level_cap: 10 }, uniqueBrackets: {}, personalBests: {} },
    rift: { motes: 50_000, enigmaSouls: 18 }, bestiaryMilestone: 200,
    // Рыбалка — реальный снимок Zucchini 2026-11-23 (сокращён)
    fishing: {
      itemsFished: { total: 4919, normal: 3780, treasure: 407, large_treasure: 57, outstanding: 6, trophy_fish: 669 },
      seaCreatureKills: 2751,
      kills: { sea_walker_4: 674, pond_squid_1: 893, sea_witch_15: 560, sea_archer_15: 397, sea_guardian_10: 502, catfish_23: 159, water_hydra_100: 11, magma_slug_200: 291, moogma_210: 205, lava_leech_220: 96, pyroclastic_worm_240: 13, lava_flame_230: 2, fire_eel_240: 1, lord_jawbus_600: 1, scarecrow_9: 173, phantom_fisherman_160: 13 },
      trophyFish: {
        total_caught: 735, last_caught: 'sulphur_skitter/bronze',
        blobfish: 332, blobfish_bronze: 249, blobfish_silver: 74, blobfish_gold: 9,
        obfuscated_fish_1: 84, obfuscated_fish_1_bronze: 56, obfuscated_fish_1_silver: 26, obfuscated_fish_1_gold: 1, obfuscated_fish_1_diamond: 1,
        obfuscated_fish_2: 1, obfuscated_fish_2_gold: 1,
        gusher: 79, gusher_bronze: 55, gusher_silver: 21, gusher_gold: 3,
        sulphur_skitter: 73, sulphur_skitter_bronze: 51, sulphur_skitter_silver: 18, sulphur_skitter_gold: 4,
        lava_horse: 63, lava_horse_bronze: 47, lava_horse_silver: 15, lava_horse_gold: 1,
        golden_fish: 39, golden_fish_bronze: 25, golden_fish_silver: 12, golden_fish_gold: 2,
        volcanic_stonefish: 15, volcanic_stonefish_bronze: 14, volcanic_stonefish_silver: 1,
        skeleton_fish: 11, skeleton_fish_bronze: 6, skeleton_fish_silver: 5,
        karate_fish: 11, karate_fish_bronze: 11, mana_ray: 10, mana_ray_bronze: 8, mana_ray_silver: 2,
        slugfish: 10, slugfish_bronze: 9, slugfish_silver: 1, steaming_hot_flounder: 3, steaming_hot_flounder_bronze: 3,
        soul_fish: 2, soul_fish_bronze: 2, flyfish: 1, flyfish_silver: 1, vanille: 1, vanille_silver: 1,
      },
    }, museum: null,
    inv: {
      inventory: [item('JUJU_SHORTBOW', 'Juju Shortbow', { rarity: 'EPIC', lore: ['§5§lEPIC BOW'], hpb: 10, enchants: { power: 6 } })],
      armor: ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => item(`SHADOW_ASSASSIN_${s}`, `Shadow Assassin ${s[0] + s.slice(1).toLowerCase()}`, { lore: ['§6§lLEGENDARY DUNGEON ' + s], stars: 5, hpb: 10 })),
      equipment: [null, null, null, null],
      wardrobe: ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => item(`FERMENTO_${s}`, `Fermento ${s}`)),
      enderChest: [item('DIVAN_DRILL', "Divan's Drill", { value: 0 })], vault: [item('ROD_OF_THE_SEA', 'Rod of the Sea'), item('INFERNO_ROD', 'Inferno Rod', { rarity: 'EPIC' }), item('STARTER_LAVA_ROD', 'Starter Lava Rod', { rarity: 'UNCOMMON' }),
        item('SLUG_BOOTS', 'Slug Boots', { rarity: 'RARE' }), item('MOOGMA_LEGGINGS', 'Moogma Leggings', { rarity: 'RARE' }), item('FLAMING_CHESTPLATE', 'Flaming Chestplate', { rarity: 'RARE' }), item('TAURUS_HELMET', 'Taurus Helmet', { rarity: 'RARE' }),
        ...['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => item(`SHARK_SCALE_${s}`, `Shark Scale ${s}`))], backpacks: {}, talismans: [], quiver: [], potions: [], fishingBag: [], sacks: {},
      apiDisabled: false,
    },
    lastSave: Date.UTC(2026, 10, 22, 19, 0),
  };
}

export const PRICES = {
  TERMINATOR: 1_050_000_000, RECOMBOBULATOR_3000: 6_500_000, HOT_POTATO_BOOK: 80_000, FUMING_POTATO_BOOK: 1_300_000,
  POWER_WITHER_HELMET: 40e6, POWER_WITHER_CHESTPLATE: 150e6, POWER_WITHER_LEGGINGS: 120e6, POWER_WITHER_BOOTS: 30e6,
  FIREDUST_DAGGER: 2e6, MAWDUST_DAGGER: 2.5e6, BOOSTER_COOKIE: 6e6, 'GRIFFIN;4': 4e6, 'GOLDEN_DRAGON;4': 700e6, 'TIGER;4': 2e6,
  'ROCK;2': 50_000, 'SQUID;3': 30_000, 'BEE;2': 20_000,
};
