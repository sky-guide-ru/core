// Генерирует тестовый профиль в формате Hypixel API (для разработки без ключа).
// Цифры взяты из реального снимка одного профиля на 22.11.2026.
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';

const UUID = '0123456789abcdef0123456789abcdef';
const S = v => ({ type: 'string', value: v });
const I = v => ({ type: 'int', value: v });
const B = v => ({ type: 'byte', value: v });
const SH = v => ({ type: 'short', value: v });

function item(id, name, rarityLine, { mc = 1, count = 1, recomb = false, extra = {}, color, skull } = {}) {
  const ea = { id: S(id), ...extra };
  if (recomb) ea.rarity_upgrades = I(1);
  const display = { Name: S(name), Lore: { type: 'list', value: { type: 'string', value: ['§7Тестовый предмет', '', rarityLine] } } };
  if (color) display.color = I(color);
  const tag = { ExtraAttributes: { type: 'compound', value: ea }, display: { type: 'compound', value: display } };
  if (skull) tag.SkullOwner = { type: 'compound', value: { Properties: { type: 'compound', value: { textures: { type: 'list', value: { type: 'compound', value: [{ Value: S(Buffer.from(JSON.stringify({ textures: { SKIN: { url: 'http://textures.minecraft.net/texture/' + skull } } })).toString('base64')) }] } } } } } };
  return { id: SH(mc), Count: B(count), Damage: SH(0), tag: { type: 'compound', value: tag } };
}
function inv(items) {
  const list = items.map(it => it ? it : {});
  const root = { type: 'compound', name: '', value: { i: { type: 'list', value: { type: 'compound', value: list } } } };
  return { type: 0, data: gzipSync(nbt.writeUncompressed(root)).toString('base64') };
}

const armor = [
  item('FERMENTO_BOOTS', '§6Fermento Boots', '§6§lLEGENDARY BOOTS', { mc: 301, recomb: true }),
  item('FERMENTO_LEGGINGS', '§6Fermento Leggings', '§6§lLEGENDARY LEGGINGS', { mc: 300 }),
  item('FERMENTO_CHESTPLATE', '§6Fermento Chestplate', '§6§lLEGENDARY CHESTPLATE', { mc: 299 }),
  item('FERMENTO_HELMET', '§6Fermento Helmet', '§6§lLEGENDARY HELMET', { mc: 397 }),
];
const talismans = [
  item('HEGEMONY_ARTIFACT', '§6Hegemony Artifact', '§6§lLEGENDARY ACCESSORY', { mc: 397 }),
  item('WOLF_RING', '§9Wolf Ring', '§9§lRARE ACCESSORY', { mc: 397 }),
  item('SPEED_TALISMAN', '§aSpeed Talisman', '§f§lCOMMON ACCESSORY', { mc: 397 }),
  item('POTATO_TALISMAN', '§fPotato Talisman', '§f§lCOMMON ACCESSORY', { mc: 392 }),
  item('ENDER_ARTIFACT', '§6Ender Artifact', '§6§lLEGENDARY ACCESSORY', { mc: 397, recomb: true }),
];
const inventory = [
  item('HYPERION', '§6Hyperion', '§6§lLEGENDARY DUNGEON SWORD', { mc: 267, recomb: true, extra: { hot_potato_count: I(15) } }),
  item('MATHEMATICAL_HOE_BLUEPRINT', '§aTest', '§a§lUNCOMMON', {}),
  item('TERMINATOR', '§6Terminator', '§6§lLEGENDARY BOW', { mc: 261 }),
  item('DIVAN_DRILL', '§6Divan\'s Drill', '§6§lLEGENDARY DRILL', { mc: 409 }),
];

const lvl = { skills: { FARMING: 451733309, MINING: 254685323, COMBAT: 44452340, FORAGING: 2713377, FISHING: 18604683, ENCHANTING: 117345237, ALCHEMY: 56660937, CARPENTRY: 111259108, RUNECRAFTING: 102679, TAMING: 404525296, SOCIAL: 548, HUNTING: 373284 } };
const experience = Object.fromEntries(Object.entries(lvl.skills).map(([k, v]) => [`SKILL_${k}`, v]));
const slayer = (xp, kills) => ({ xp, ...Object.fromEntries(kills.map((k, i) => [`boss_kills_tier_${i}`, k])) });
// Гардероб (members[uuid].loadout, как отдаёт Hypixel сейчас): два набора с длинными названиями и звёздами,
// чтобы на телефоне было видно, как сетка гардероба переносит подписи
const PARTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const loadout = { loadouts: {}, armor: { equipped_set: 1 } };
[['POWER_WITHER', 'Heroic Necron\'s', '§5§lEPIC', 'Dungeon Mage'], ['SHADOW_ASSASSIN', 'Withered Shadow Assassin', '§6§lLEGENDARY', 'Slayer Sven']].forEach(([id, nm, r, setName], set) => {
  // номера наборов в игре и в API начинаются с 1
  loadout.armor[set + 1] = Object.fromEntries(PARTS.map((part, row) => [part, inv([item(`${id}_${part}`, `§6${nm} ${part[0] + part.slice(1).toLowerCase()} §6✪✪✪✪✪§c➎`, `${r} ${part}`, { mc: [397, 299, 300, 301][row], recomb: set === 0 })])]));
  loadout.loadouts[set] = { name: setName, armor_set_id: set + 1 };
});
const member = {
  loadout,
  player_data: { experience, crafted_generators: ['WHEAT', 'CARROT', 'POTATO', 'PUMPKIN', 'MELON', 'SUGAR_CANE', 'COCOA', 'NETHER_WARTS', 'CACTUS', 'MUSHROOM', 'COBBLESTONE', 'COAL', 'IRON', 'GOLD', 'DIAMOND', 'LAPIS', 'REDSTONE', 'EMERALD', 'SNOW', 'CLAY'].flatMap((t, k) => Array.from({ length: k < 10 ? 12 : 3 + (k % 4) }, (_, i) => `${t}_${i + 1}`)).slice(0, 182),
    // Перки магазинов эссенций — как у Zucchini 23.11.2026
    perks: { catacombs_crit_damage: 1, catacombs_defense: 2, permanent_defense: 4, forbidden_blessing: 1, permanent_health: 4, permanent_speed: 2, permanent_strength: 4, eager_miner: 9, treasures_of_the_earth: 3, unbreaking: 2, high_roller: 1, radiant_fisher: 9, return_to_sender: 6, rhinestone_infusion: 10, inc_zealots_odds: 3, fresh_tools_kuudra: 1, fero_vs_dragons: 1, mana_after_ender_kill: 1 } },
  leveling: { experience: 27330, completions: { NUCLEUS_RUNS: 25 } },
  currencies: { coin_purse: 445, essence: { GOLD: { current: 1235 }, DIAMOND: { current: 1318 }, UNDEAD: { current: 572 }, WITHER: { current: 17 }, DRAGON: { current: 45 } } },
  profile: { cookie_buff_active: true, bank_account: 0, last_save: Date.now() },
  fairy_soul: { total_collected: 249, fairy_exchanges: 41, unspent_souls: 44 },
  jacobs_contest: { perks: { farming_level_cap: 10, double_drops: 13 }, medals_inv: { bronze: 34, silver: 15, gold: 31 } },
  pets_data: { pets: [
    { type: 'ENDER_DRAGON', tier: 'LEGENDARY', exp: 59314268, active: true, heldItem: 'CROCHET_TIGER_PLUSHIE' },
    { type: 'MOOSHROOM_COW', tier: 'LEGENDARY', exp: 510947129 }, { type: 'BAL', tier: 'LEGENDARY', exp: 446368553 },
    { type: 'MITHRIL_GOLEM', tier: 'MYTHIC', exp: 268647072 }, { type: 'ENDERMAN', tier: 'MYTHIC', exp: 126981181 },
    { type: 'MOLE', tier: 'LEGENDARY', exp: 0 }, { type: 'ROCK', tier: 'LEGENDARY', exp: 0 }, { type: 'RAT', tier: 'LEGENDARY', exp: 0 },
    { type: 'GRIFFIN', tier: 'LEGENDARY', exp: 15000000 }, { type: 'RABBIT', tier: 'LEGENDARY', exp: 5000000 },
  ], pet_care: { pet_types_sacrificed: [] } },
  slayer: { slayer_bosses: { zombie: slayer(400224, [1, 4, 9, 198, 200]), spider: slayer(102906, [1, 2, 11, 117]), wolf: slayer(122904, [1, 2, 3, 215]), enderman: slayer(100569, [220, 45, 32, 152]), blaze: {}, vampire: {} } },
  dungeons: { selected_dungeon_class: 'archer', secrets: 1133, dungeon_types: { catacombs: { experience: 1476445, tier_completions: { 0: 2, 1: 12, 2: 4, 3: 30, 4: 7, 5: 12, 6: 30, 7: 8 } }, master_catacombs: { tier_completions: {} } },
    player_classes: { mage: { experience: 223920 }, tank: { experience: 150084 }, archer: { experience: 1245600 }, healer: { experience: 74286 }, berserk: { experience: 276138 } } },
  mining_core: { experience: 1300000, powder_mithril: 8749860, powder_spent_mithril: 0, powder_gemstone: 27946599, nodes: { special_0: 10 } },
  nether_island_player_data: { selected_faction: 'barbarians', barbarians_reputation: 1755, kuudra_completed_tiers: { none: 2, hot: 1 },
    abiphone: { active_contacts: ['dean', 'elle', 'maddox', 'fearmongerer', 'tia', 'rusty', 'jacob', 'trevor'], contact_data: { dean: { talked_to: true }, elle: { talked_to: true }, kat: { talked_to: true } } } },
  quests: { harp_quest: { selected_song: 'brahms', song_hymn_joy_best_completion: 1, song_hymn_joy_completions: 3, song_hymn_joy_perfect_completions: 1,
    song_frere_jacques_best_completion: 1, song_frere_jacques_completions: 1, song_amazing_grace_best_completion: 1, song_amazing_grace_completions: 2, song_brahms_best_completion: 0.64 } },
  accessory_bag_storage: { highest_magical_power: 1009, selected_power: 'fortuitous', bag_upgrades_purchased: 17, unlocked_powers: ['shaded', 'bloody'] },
  garden_player_data: { copper: 4194, garden_chips: { cropshot: 20, overdrive: 20, mechamind: 15, hypercharge: 20, quickdraw: 15, rarefinder: 20, evergreen: 20, synthesis: 20, vermin_vaporizer: 20 } },
  events: { easter: { chocolate_level: 6, chocolate: 2602462808, total_chocolate: 279382191293, rabbits: Object.fromEntries(Array.from({ length: 179 }, (_, i) => ['r' + i, 1])),
    employees: { rabbit_bro: 220, rabbit_cousin: 220, rabbit_sis: 220, rabbit_father: 220, rabbit_grandma: 220, rabbit_uncle: 220, rabbit_dog: 220 }, time_tower: { level: 15 }, chocolate_since_prestige: 31200000000, rabbit_barn_capacity_level: 26, click_upgrades: 40 } },
  attributes: { stacks: { forest_fishing: 96, cheapstake: 96, hunter: 96, forest_strength: 96, arachno_resistance: 81, pest_luck: 64, ender: 64, arachno: 64, fig_collector: 12, chocolate_speed: 3, accessory_size: 20, almighty: 5, midas_touch: 7, deep_technique: 2 } },
  shards: { owned: [['ZEALOT', 1], ['HOWLING_SPIRIT', 5], ['BRUISER', 1], ['DRACONIC', 1], ['THYST', 1], ['ZOMBIE_SOLDIER', 1], ['BAL', 2], ['WITHER_SPECTER', 4], ['SYCOPHANT', 4], ['YOG', 1], ['FLARE', 1], ['PEST', 12], ['FLAMING_SPIDER', 2], ['GOLDEN_GHOUL', 2], ['VORACIOUS_SPIDER', 1]].map(([type, amount_owned]) => ({ type, amount_owned })) },
  experimentation: { pairings: { best_score_5: 7 }, simon: { best_score_4: 30 }, numbers: { best_score_3: 28 } },
  player_stats: { shard_fishing_hunts: 984, shard_combat_hunts: 306, shard_forest_hunts: 181, highest_damage: 33484284,
    auctions: { completed: 79, won: 334, gold_earned: 172247060, gold_spent: 2747041306, highest_bid: 462000000, fees: 5100000 },
    mythos: { kills: 65, burrows_dug_treasure: { total: 60 }, burrows_dug_combat: { total: 57 } }, gifts: { total_received: 2634, total_given: 489 },
    races: { end_race_best_time: 19800, rift_race_best_time: 62100, foraging_race_best_time: 11200 },
    end_island: { dragon_fight: { amount_summoned: { total: 8 } }, special_zealot_loot_collected: 315 } },
  item_data: { soulflow: 4237 },
  foraging: { tree_gifts: { FIG: 134, MANGROVE: 19 } },
  rift: { enigma: { found_souls: Array.from({ length: 18 }, (_, i) => 's' + i) } },
  collection: { WHEAT: 50000000, NETHER_STALK: 80000000, CARROT_ITEM: 410000, MELON: 2300000, COBBLESTONE: 1450000, DIAMOND: 102073, EMERALD: 241888, MITHRIL_ORE: 870000, HARD_STONE: 41900814, ENDER_PEARL: 95105, STRING: 9329, BONE: 41000, ROTTEN_FLESH: 230000, GHAST_TEAR: 380, LOG: 19371, 'LOG:2': 4200, RAW_FISH: 61000, 'INK_SACK:4': 616921, SAND: 0 },
  inventory: {
    inv_contents: inv(inventory), inv_armor: inv(armor), equipment_contents: inv([]), wardrobe_contents: inv([]),
    ender_chest_contents: inv([item('JUDGEMENT_CORE', '§6Judgement Core', '§6§lLEGENDARY', { mc: 397 })]),
    personal_vault_contents: inv([]), backpack_contents: {}, bag_contents: { talisman_bag: inv(talismans), sacks_bag: inv([['LARGE_ENCHANTED_MINING_SACK', 'Large Enchanted Mining Sack', '§5§lEPIC SACK'], ['MEDIUM_AGRONOMY_SACK', 'Medium Agronomy Sack', '§9§lRARE SACK'], ['SMALL_COMBAT_SACK', 'Small Combat Sack', '§a§lUNCOMMON SACK'], ['LARGE_GEMSTONE_SACK', 'Large Gemstone Sack', '§5§lEPIC SACK']].map(([id, n, r]) => item(id, n, r))) }, sacks_counts: { ENCHANTED_DIAMOND: 120, STONE: 40320, LOG_2: 5160, 'LOG_2:1': 5150, 'LOG:3': 5170, ENCHANTED_MITHRIL: 3151, ENCHANTED_HARD_STONE: 3005, WOLF_TOOTH: 2702, ENCHANTED_PUFFERFISH: 1885, ENDER_PEARL: 1519, BLAZE_ROD: 1428, ENCHANTED_ROTTEN_FLESH: 1416, ENCHANTED_WOOL: 1204, ROUGH_JADE_GEM: 79, FLAWED_AMBER_GEM: 40, FINE_RUBY_GEM: 3, GLACITE: 122, UMBER: 124, TITANIUM_ORE: 144, WISHING_COMPASS: 261, 'INK_SACK:3': 64000 },
  },
};
member.slayer.slayer_quest = { type: 'enderman', tier: 2, combat_xp: 0 };
member.leveling.completed_tasks = [...Array.from({ length: 293 }, (_, i) => 't' + i), 'BANK_UPGRADE_GOLD', 'BANK_UPGRADE_DELUXE', 'BANK_UPGRADE_SUPER_DELUXE'];
// История банка: начисления процентов раз в 31 час и пара своих операций (для вкладки «Банк»)
const SEASON = 31 * 3600_000, sNow = Date.now();
const bankTx = [
  { amount: 390000, timestamp: sNow - 3 * SEASON - 7200_000, action: 'DEPOSIT', initiator_name: '§5Bank Interest' },
  { amount: 12000000, timestamp: sNow - 2 * SEASON, action: 'WITHDRAW', initiator_name: '§bOwnerCat' },
  { amount: 390000, timestamp: sNow - 2 * SEASON + 3600_000, action: 'DEPOSIT', initiator_name: '§5Bank Interest' },
  { amount: 390000, timestamp: sNow - SEASON + 1800_000, action: 'DEPOSIT', initiator_name: '§5Bank Interest' },
];
member.leveling.selected_symbol = 'FARMING_MASTER';
member.player_data.death_count = 284;
member.player_data.visited_zones = Array.from({ length: 237 }, (_, i) => 'z' + i);
const out = { success: true, profiles: [{ profile_id: 'fedcba9876543210fedcba9876543210', cute_name: 'Zucchini', selected: true, banking: { balance: 75803349, transactions: bankTx },
  community_upgrades: { upgrade_states: [['minion_slots', 5], ['coins_allowance', 5], ['island_size', 1], ['guests_count', 1]].map(([upgrade, tier]) => ({ upgrade, tier })) }, members: { [UUID]: member } }] };
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/fixture-profiles.json', JSON.stringify(out));
console.log('data/fixture-profiles.json готов');

// Ответ /v2/skyblock/garden (сад: участки, улучшения теплицы, гости)
const garden = { garden: { garden_experience: 171632, unlocked_plots_ids: Array.from({ length: 23 }, (_, i) => 'p' + i), garden_upgrades: { GROWTH_SPEED: 5, YIELD: 4 },
  composter_data: { organic_matter: 381, fuel_units: 30550, upgrades: {} }, commission_data: { total_completed: 2400, unique_npcs_served: 80 },
  active_commissions: { queen_mismyla: { requirement: [{ item: 'ENCHANTED_WHEAT', amount: 241 }] }, gold_forger: { requirement: [{ item: 'GOLDEN_CARROT', amount: 1024 }] },
    puzzler: { requirement: [{ item: 'ENCHANTED_GOLDEN_CARROT', amount: 6 }] }, royal_resident: { requirement: [{ item: 'ENCHANTED_WILD_ROSE', amount: 219 }] },
    lumberjack: { requirement: [{ item: 'ENCHANTED_MELON_BLOCK', amount: 5 }] } } } };
fs.writeFileSync('data/fixture-garden.json', JSON.stringify(garden));
console.log('data/fixture-garden.json готов');

// Примерные цены Bazaar для разработки (НЕ реальные)
const bz = { BOOSTER_COOKIE: 3_200_000, RECOMBOBULATOR_3000: 6_500_000, ENCHANTED_DIAMOND: 1_250, FUMING_POTATO_BOOK: 1_100_000, WHEAT: 6, CARROT_ITEM: 3, POTATO_ITEM: 3, PUMPKIN: 10, MELON: 2.2, SUGAR_CANE: 4, CACTUS: 4, 'INK_SACK:3': 3, NETHER_STALK: 4, RED_MUSHROOM: 10, DOUBLE_PLANT: 4, MOONFLOWER: 4, WILD_ROSE: 4, JUDGEMENT_CORE: 120_000_000, FIRST_MASTER_STAR: 9_000_000, SECOND_MASTER_STAR: 15_000_000, THIRD_MASTER_STAR: 30_000_000, KUUDRA_TEETH: 9_000, ESSENCE_WITHER: 3_000, ESSENCE_DIAMOND: 600, ESSENCE_GOLD: 900, ESSENCE_UNDEAD: 800, ESSENCE_DRAGON: 1_500, ESSENCE_CRIMSON: 1_200, FLAWLESS_RUBY_GEM: 2_400_000, ENCHANTED_HAY_BALE: 1_000, MUTANT_NETHER_STALK: 160_000, TITANIC_EXP_BOTTLE: 5_000_000, SUMMONING_EYE: 1_200_000, ENCHANTED_MITHRIL: 2_400, ENCHANTED_HARD_STONE: 900, WOLF_TOOTH: 4, ENCHANTED_PUFFERFISH: 1_900, ENDER_PEARL: 9, BLAZE_ROD: 14, ENCHANTED_ROTTEN_FLESH: 260, ENCHANTED_WOOL: 900, ROUGH_JADE_GEM: 3, FLAWED_AMBER_GEM: 260, GLACITE: 6, UMBER: 9, TITANIUM_ORE: 600, LOG_2: 3, 'LOG:3': 3,
  // Товары Community Shop за Bits (вкладка «Bits»)
  KISMET_FEATHER: 1_900_000, GOD_POTION_2: 1_350_000, KAT_FLOWER: 420_000, KAT_BOUQUET: 2_300_000, HEAT_CORE: 1_150_000, HYPER_CATALYST_UPGRADE: 210_000, ULTIMATE_CARROT_CANDY_UPGRADE: 5_200_000, COLOSSAL_EXP_BOTTLE_UPGRADE: 1_000_000, MATRIARCH_PARFUM: 950_000, ENCHANTMENT_HECATOMB_1: 600_000, ENCHANTMENT_EXPERTISE_1: 2_400_000, ENCHANTMENT_COMPACT_1: 3_300_000, ENCHANTMENT_CULTIVATING_1: 2_800_000, ENCHANTMENT_CHAMPION_1: 2_100_000, TALISMAN_ENRICHMENT_CRITICAL_DAMAGE: 3_100_000, TALISMAN_ENRICHMENT_SWAPPER: 110_000, INFERNO_FUEL_BLOCK: 34_000 };

const products = {};
for (const [id, p] of Object.entries(bz)) {
  const buy = p * 1.04, sell = p;
  products[id] = { product_id: id, buy_summary: [{ pricePerUnit: buy }], sell_summary: [{ pricePerUnit: sell }],
    quick_status: { buyPrice: buy, sellPrice: sell, buyVolume: 100000, sellVolume: 120000, buyMovingWeek: 2_000_000, sellMovingWeek: 1_800_000, buyOrders: 50, sellOrders: 60 } };
}
fs.writeFileSync('data/fixture-bazaar.json', JSON.stringify({ success: true, products }));
console.log('data/fixture-bazaar.json готов');
