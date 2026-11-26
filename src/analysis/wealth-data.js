// Справочные данные для «Bank», «Bits» и советов по Maxwell.
// Источники (вики из облака недоступны, поэтому сверено по данным модов и гайду):
// - ступени банка и потолки процентов: гайд «Should you upgrade your bank?» (hypixel.net, 2021–2022),
//   названия улучшений — NEU constants/sblevels.json (BANK_UPGRADE_*), ступени процентов выведены из потолков гайда;
// - цены Community Shop в Bits: kr45732/skyblock-plus-data BitPrices.json (июль 2024);
// - множители Bits за Fame: SkyHanni-REPO constants/FameRank.json;
// - силы Maxwell: лор Power Stone в NEU items (статы при 250 Accessory Power).

// Проценты платятся раз в сезон SkyBlock (3 месяца = 31 час), каждая ступень — свой процент на свой кусок баланса.
// max — потолок баланса счёта, upgradeCoins — примерная стоимость перехода с предыдущего счёта (монеты + предметы по ценам 2021).
export const BANK_TIERS = [
  { id: 'STARTER', name: 'Starter', max: 50e6, upgradeCoins: 0, brackets: [[10e6, 0.02], [5e6, 0.01]] },
  { id: 'GOLD', name: 'Gold', max: 100e6, upgradeCoins: 5.12e6, brackets: [[10e6, 0.02], [10e6, 0.01]] },
  { id: 'DELUXE', name: 'Deluxe', max: 250e6, upgradeCoins: 10.6e6, brackets: [[10e6, 0.02], [10e6, 0.01], [10e6, 0.005]] },
  { id: 'SUPER_DELUXE', name: 'Super Deluxe', max: 500e6, upgradeCoins: 27.4e6, brackets: [[10e6, 0.02], [10e6, 0.01], [10e6, 0.005], [20e6, 0.002]] },
  { id: 'PREMIER', name: 'Premier', max: 1e9, upgradeCoins: 56e6, brackets: [[10e6, 0.02], [10e6, 0.01], [10e6, 0.005], [20e6, 0.002], [110e6, 0.001]] },
  // Два новых счёта: в первую очередь поднимают потолок баланса, нужны пожертвования в Музей. Прибавку к процентам не сверили.
  { id: 'LUXURIOUS', name: 'Luxurious', max: null, upgradeCoins: null, brackets: null, unverified: true },
  { id: 'PALATIAL', name: 'Palatial', max: null, upgradeCoins: null, brackets: null, unverified: true },
];

// Реальное время: SkyBlock-день = 20 минут, месяц = 31 день, сезон = 3 месяца
export const SB_EPOCH = 1560275700000;
export const SB_DAY = 20 * 60_000;
export const SB_MONTH = 31 * SB_DAY;
export const SB_SEASON = 3 * SB_MONTH; // 31 час

export const COOKIE_BITS = 4800; // Bits за одно печенье до множителя Fame

export const FAME_RANKS = [
  ['New player', 0, 1.0], ['Settler', 20e3, 1.1], ['Citizen', 80e3, 1.2], ['Contributor', 200e3, 1.3], ['Philanthropist', 400e3, 1.4],
  ['Patron', 800e3, 1.6], ['Famous Player', 1.5e6, 1.8], ['Attaché', 3e6, 1.9], ['Ambassador', 10e6, 2.0], ['Statesperson', 20e6, 2.04],
  ['Senator', 33e6, 2.08], ['Dignitary', 50e6, 2.12], ['Councilor', 72e6, 2.16], ['Minister', 100e6, 2.2], ['Premier', 135e6, 2.22],
  ['Chancellor', 178e6, 2.24], ['Supreme', 230e6, 2.26], ['Overseer', 250e6, 2.28], ['Regent', 290e6, 2.3], ['Viceroy', 330e6, 2.32],
  ['Sovereign', 370e6, 2.34], ['Archon', 410e6, 2.36], ['Imperator', 450e6, 2.38], ['Paragon', 500e6, 2.4],
].map(([name, fame, mult]) => ({ name, fame, mult }));

// Community Shop (Elizabeth) → предметы за Bits. use — зачем брать себе; group — для подсказки
export const BITS_SHOP = [
  { id: 'GOD_POTION_2', bits: 1500, use: 'Зелье бога: все эффекты сразу на 12+ часов (в офлайне не тратится)' },
  { id: 'KISMET_FEATHER', bits: 1350, use: 'Перебросить сундук наград в данже (M5–M7 — ради дорогих дропов)' },
  { id: 'KAT_FLOWER', bits: 500, use: 'Ускоряет прокачку питомца у Kat' },
  { id: 'KAT_BOUQUET', bits: 2500, use: 'Букет — сильнее ускоряет Kat, выгоден для дорогих апгрейдов питомцев' },
  { id: 'HEAT_CORE', bits: 3000, use: 'Крафт Magma Lord и т.п.' },
  { id: 'HYPER_CATALYST_UPGRADE', bits: 300, use: 'Улучшение катализатора миньонов' },
  { id: 'ULTIMATE_CARROT_CANDY_UPGRADE', bits: 8000, use: 'Делает Ultimate Carrot Candy для питомцев' },
  { id: 'COLOSSAL_EXP_BOTTLE_UPGRADE', bits: 1200, use: 'Колоссальная бутылка опыта' },
  { id: 'JUMBO_BACKPACK_UPGRADE', bits: 4000, use: 'Jumbo Backpack — самый большой рюкзак', once: true },
  { id: 'MINION_STORAGE_EXPANDER', bits: 1500, use: 'Больше места в миньоне' },
  { id: 'MATRIARCH_PARFUM', bits: 1200, use: 'Лишний заход к Matriarch за жемчугом' },
  { id: 'HOLOGRAM', bits: 2000, use: 'Декор острова' },
  { id: 'DITTO_BLOB', bits: 600, use: 'Ингредиент для Ditto-скинов' },
  { id: 'BUILDERS_WAND', bits: 12000, use: 'Строительство', once: true },
  { id: 'BLOCK_ZAPPER', bits: 5000, use: 'Быстро убирать блоки', once: true },
  { id: 'BITS_TALISMAN', bits: 15000, use: 'Аксессуар: +Magical Power, если его ещё нет', accessory: true, once: true },
  { id: 'POCKET_SACK_IN_A_SACK', bits: 8000, use: 'Больше места в мешках (до 3 штук на мешок)' },
  { id: 'LARGE_DUNGEON_SACK', bits: 10000, use: 'Мешок для данж-лута', once: true },
  { id: 'RUNE_SACK', bits: 10000, use: 'Мешок для рун', once: true },
  { id: 'PORTALIZER', bits: 4800, use: 'Портал на остров' },
  { id: 'TRIO_CONTACTS_ADDON', bits: 6450, use: 'Абифон: ещё 3 контакта' },
  { id: 'ABICASE_SUMSUNG_1', bits: 15000, use: 'Чехол абифона: +MP как аксессуар', accessory: true, once: true },
  { id: 'AUTOPET_RULES_2', bits: 21000, use: '+2 правила автосмены питомцев', once: true },
  { id: 'INFERNO_FUEL_BLOCK', bits: 75, use: 'Топливо для Inferno-миньонов' },
  { id: 'EXPERTISE;1', bits: 4000, use: 'Книга Expertise (удочка)' },
  { id: 'COMPACT;1', bits: 4000, use: 'Книга Compact (кирка/бур)' },
  { id: 'CULTIVATING;1', bits: 4000, use: 'Книга Cultivating (мотыга)' },
  { id: 'CHAMPION;1', bits: 4000, use: 'Книга Champion (оружие)' },
  { id: 'HECATOMB;1', bits: 6000, use: 'Книга Hecatomb (данжи)' },
  { id: 'ACCESSORY_ENRICHMENT', bits: 5000, use: 'Accessory Enrichment: +1 очко Tuning на Legendary или Mythic аксессуаре' },
];

// Силы, которые выдаются сразу (без Power Stone). Статы у Maxwell меняются, поэтому без цифр
export const STARTER_POWERS = ['Fortuitous', 'Pretty', 'Protected', 'Simple', 'Warrior', 'Commando', 'Disciplined', 'Inspired', 'Ominous', 'Prepared'];

// Силы из Power Stone (9 камней комбинируются у Thaumaturgist в Hub). Статы при 250 Accessory Power
export const POWER_STONES = [
  { power: "Forceful", stone: "ACACIA_BIRDHOUSE", stoneName: "Acacia Birdhouse", rarity: "RARE", req: "Combat Skill 20", stats: {"Health": 16.2, "Strength": 173.56, "Crit Damage": 46.28}, unique: {"Ferocity": 4.0} },
  { power: "Bloody", stone: "BEATING_HEART", stoneName: "Beating Heart", rarity: "RARE", req: "Combat Skill 20", stats: {"Strength": 104.13, "Crit Damage": 104.13, "Intelligence": 34.71}, unique: {"Attack Speed": 10.0} },
  { power: "Bubba", stone: "BUBBA_BLISTER", stoneName: "Bubba Blister", rarity: "LEGENDARY", req: "Combat Skill 25", stats: {"Health": 48.6, "Defense": -92.56, "True Defense": 7.87, "Strength": 57.85, "Crit Chance": 9.26, "Crit Damage": 104.13, "Attack Speed": 17.36}, unique: {} },
  { power: "Crumbly", stone: "CHOCOLATE_CHIP", stoneName: "Fang-tastic Chocolate Chip", rarity: "LEGENDARY", req: "Combat Skill 20", stats: {"Health": 97.19, "True Defense": 15.74, "Crit Chance": 4.63, "Attack Speed": 6.94, "Intelligence": 52.07}, unique: {"Speed": 25.0} },
  { power: "Shaded", stone: "DARK_ORB", stoneName: "Dark Orb", rarity: "RARE", req: "Combat Skill 20", stats: {"Strength": 46.28, "Crit Damage": 173.56, "Speed": 5.79}, unique: {"Attack Speed": 3.0, "Ferocity": 3.0} },
  { power: "Sanguisuge", stone: "DISPLACED_LEECH", stoneName: "Displaced Leech", rarity: "UNCOMMON", req: "Combat Skill 10", stats: {"Health": 32.4, "Strength": 138.85, "Crit Chance": 9.26, "Crit Damage": 46.28}, unique: {"Intelligence": 100.0} },
  { power: "Bizarre", stone: "ECCENTRIC_PAINTING", stoneName: "Eccentric Painting", rarity: "LEGENDARY", req: "Combat Skill 25", stats: {"Strength": -23.14, "Crit Damage": -23.14, "Intelligence": 416.54}, unique: {"Ability Damage": 5.0} },
  { power: "Sighted", stone: "ENDER_MONOCLE", stoneName: "Ender Monocle", rarity: "RARE", req: "Combat Skill 15", stats: {"Intelligence": 347.11}, unique: {"Ability Damage": 3.0} },
  { power: "Adept", stone: "END_STONE_SHULKER", stoneName: "End Stone Shulker", rarity: "RARE", req: "Combat Skill 20", stats: {"Health": 161.99, "Defense": 92.56, "Intelligence": 34.71}, unique: {"Health": 100.0, "Defense": 50.0} },
  { power: "Itchy", stone: "FURBALL", stoneName: "Furball", rarity: "RARE", req: "Combat Skill 20", stats: {"Strength": 69.42, "Crit Damage": 80.99, "Attack Speed": 20.83, "Speed": 5.79}, unique: {"Strength": 15.0, "Crit Damage": 15.0} },
  { power: "Frozen", stone: "GLACITE_SHARD", stoneName: "Glacite Chunk", rarity: "LEGENDARY", req: "Combat Skill 20", stats: {"Defense": 127.27, "True Defense": 17.7}, unique: {"True Defense": 10.0, "Strength": 25.0, "Crit Damage": 25.0} },
  { power: "Slender", stone: "HAZMAT_ENDERMAN", stoneName: "Hazmat Enderman", rarity: "LEGENDARY", req: "Combat Skill 30", stats: {"Health": 80.99, "Defense": 57.85, "Strength": 57.85, "Crit Damage": 57.85, "Attack Speed": 10.41, "Intelligence": 86.78, "Speed": 5.79}, unique: {"Defense": 100.0, "Strength": 50.0} },
  { power: "Demonic", stone: "HORNS_OF_TORMENT", stoneName: "Horns of Torment", rarity: "EPIC", req: "Combat Skill 25", stats: {"Strength": 53.22, "Intelligence": 267.28}, unique: {"Crit Damage": 50.0} },
  { power: "Silky", stone: "LUXURIOUS_SPOOL", stoneName: "Luxurious Spool", rarity: "UNCOMMON", req: "Combat Skill 15", stats: {"Crit Damage": 219.84, "Speed": 5.79}, unique: {"Attack Speed": 5.0} },
  { power: "Hurtful", stone: "MAGMA_URCHIN", stoneName: "Magma Urchin", rarity: "EPIC", req: "Combat Skill 25", stats: {"Strength": 46.28, "Crit Damage": 185.13}, unique: {"Attack Speed": 15.0} },
  { power: "Strong", stone: "MANDRAA", stoneName: "Mandraa", rarity: "RARE", req: "Combat Skill 30", stats: {"Strength": 115.7, "Crit Damage": 115.7}, unique: {"Strength": 25.0, "Crit Damage": 25.0} },
  { power: "Mythical", stone: "OBSIDIAN_TABLET", stoneName: "Obsidian Tablet", rarity: "RARE", req: "Combat Skill 20", stats: {"Health": 55.08, "Defense": 39.34, "Strength": 39.34, "Crit Chance": 15.74, "Crit Damage": 39.34, "Intelligence": 59.01, "Speed": 9.26}, unique: {"Health": 150.0, "Strength": 40.0} },
  { power: "Pleasant", stone: "PRECIOUS_PEARL", stoneName: "Precious Pearl", rarity: "EPIC", req: "Combat Skill 25", stats: {"Health": 129.59, "Defense": 138.85}, unique: {} },
  { power: "Sweet", stone: "ROCK_CANDY", stoneName: "Rock Candy", rarity: "UNCOMMON", req: "Combat Skill 15", stats: {"Health": 145.79, "Defense": 104.13, "Speed": 11.57}, unique: {"Speed": 5.0} },
  { power: "Scorching", stone: "SCORCHED_BOOKS", stoneName: "Scorched Books", rarity: "MYTHIC", req: "Combat Skill 35", stats: {"Strength": 80.99, "Crit Damage": 92.56, "Attack Speed": 17.36}, unique: {"Ferocity": 7.0} },
  { power: "Buttery", stone: "SUNFLOWER_BUTTER", stoneName: "Sunflower Butter", rarity: "RARE", req: "Combat Skill 20", stats: {"Attack Speed": 20.83, "Speed": 23.14}, unique: {"Attack Speed": 5.0} },
  { power: "Healthy", stone: "VITAMIN_DEATH", stoneName: "Vitamin Death", rarity: "LEGENDARY", req: "Combat Skill 30", stats: {"Health": 323.97}, unique: {"Health": 200.0} },
];

// Что даёт одно очко Stats Tuning (1 очко на каждые 10 Magical Power)
export const TUNING_PER_POINT = { health: 5, defense: 1, walk_speed: 1.5, strength: 1, critical_damage: 1, critical_chance: 0.2, intelligence: 2 };
export const TUNING_RU = { health: 'Health', defense: 'Defense', walk_speed: 'Speed', strength: 'Strength', critical_damage: 'Crit Damage', critical_chance: 'Crit Chance', attack_speed: 'Attack Speed', intelligence: 'Intelligence' };
