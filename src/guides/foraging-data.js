// Данные гайда по Foraging (Galatea). Источник — NEU-REPO (предметы, рецепты, лор, магазины NPC),
// сверено 2026-11-23 для патча 0.27.x. Официальная вики не обновляется с июля 2026, поэтому всё,
// что можно, берём из NEU: имена, требования, статы, шансы дропа из Tree Gifts, цены магазинов.

// Топоры Galatea по возрастанию. frenzy — способность «Frenzy»: +1 Sweep за N брёвен на Galatea, до max.
export const AXES = [
  { id: 'FIG_AXE', req: 12, sweep: 15, fortune: 20, frenzy: [2_000, 20], recipe: '30× Enchanted Fig Log + 8× Stretching Sticks' },
  { id: 'FIGSTONE_AXE', req: 15, sweep: 25, fortune: 35, frenzy: [10_000, 20], gems: 2, recipe: '4× Figstone + Fig Hew' },
  { id: 'HELIX_CHOPPER', req: 20, sweep: 50, fortune: 50, frenzy: [20_000, 40], gems: 2, recipe: '3× Helixis + Figstone Splitter + 8× Flexbone' },
];
// Запасные топоры: бросок топора, без Frenzy
export const SIDE_AXES = ['SERIOUSLY_DAMAGED_AXE', 'DECENT_AXE', 'TREECAPITATOR_AXE'];

// Сеты брони: статы на одну часть; craft — сколько материала на шлем/нагрудник/поножи/ботинки
export const ARMOR = [
  { name: 'Canopy', req: 12, sweep: 6, fortune: 0, ids: ['CANOPY_HELMET', 'CANOPY_CHESTPLATE', 'CANOPY_LEGGINGS', 'CANOPY_BOOTS'], npcCoins: 116_400 + 135_800 + 126_100 + 106_700, how: 'у NPC Amaury (Moonglade Marsh) за монеты' },
  { name: 'Fig', req: 15, sweep: 10, fortune: 30, ids: ['FIG_HELMET', 'FIG_CHESTPLATE', 'FIG_LEGGINGS', 'FIG_BOOTS'], mat: 'FIGSTONE', craft: [5, 8, 7, 4], how: 'крафт: Figstone + та же часть Canopy (шлем 5, нагрудник 8, поножи 7, ботинки 4)' },
  { name: 'Helix', req: 25, sweep: 20, fortune: 45, ids: ['HELIX_ARMOR_HELMET', 'HELIX_ARMOR_CHESTPLATE', 'HELIX_ARMOR_LEGGINGS', 'HELIX_ARMOR_BOOTS'], mat: 'HELIXIS', craft: [5, 7, 6, 4], how: 'крафт: Helixis + та же часть Fig (шлем 5, нагрудник 7, поножи 6, ботинки 4)' },
];

// Снаряжение (equipment): лестницы по слотам
export const EQUIP = [
  { slot: 'Ожерелье', ladder: ['MANGROVE_LOCKET', 'HONEYCOMB_NECKLACE'] },
  { slot: 'Перчатки / браслет', ladder: ['MANGROVE_GRIPPERS', 'VEILSHROOM_BRACELET'] },
  { slot: 'Пояс', ladder: ['MANGROVE_VINE', 'TORRHUS_BELT'] },
];

// Питомцы Foraging: что делают (по лору NEU) и где взять
export const PETS = [
  { type: 'SLOTH', why: 'Sweep и Foraging Fortune; раз в 60 с следующий удар сильнее; бонус к броску топора; больше очков в Starlyn Contests', how: 'Miria (Torrhus Canyon) за 20× Miria\'s Coupon, дальше редкость у Kat за Sloth Claw', best: true },
  { type: 'FROG', why: 'Foraging Fortune на 20 с после каждого прыжка, Sweep, шанс выловить водные осколки на островах Foraging', how: 'Agatha (Moonglade Marsh) за 20× Agatha\'s Coupon, редкость у Kat за Frog Treat' },
  { type: 'JADE_DRAGON', why: 'эндгейм: сила и скорость всем топорам, +15 Fortune и +4 Sweep за каждую цифру коллекции Mangrove, Fortune от Sweep', how: '500 млн + Shiniest + по 64 Figstone, Mangcore и Helixis у NPC Jade Dragon' },
  { type: 'OCELOT', why: 'Foraging Wisdom (быстрее растёт скилл) и ускорение миньонов-лесорубов', how: 'крафт: 256× Jungle Log + Enchanted Egg, редкость у Kat' },
  { type: 'MONKEY', why: 'Foraging Fortune везде; Sweep и скорость — только в The Park (на Galatea слабее Sloth)', how: 'Oringo (Hub): брёвна джунглей + монеты' },
];

// Источники Fortune/Sweep помимо топора и брони (подсказки в таблице «Откуда брать»)
export const BOOSTS = [
  { what: 'Wood Singularity', item: 'WOOD_SINGULARITY', fortune: '+25', sweep: '', how: 'с патча 0.23.4 ставится на топор (раньше — на деревянный меч), один раз' },
  { what: 'Reforge Moonglade (топор)', item: 'MOONGLADE_JEWEL', fortune: 'да', sweep: '', how: 'камень Moonglade Jewel у Agatha за 50× Agatha\'s Coupon; ещё даёт Foraging Wisdom' },
  { what: 'Reforge Groovy (броня)', item: 'MANGROVE_GEM', fortune: 'да', sweep: '', how: 'камень Mangrove Gem: крафт из 144× Enchanted Mangrove Log' },
  { what: 'Бустер Foraging Fortune', item: 'FORAGING_FORTUNE_BOOSTER', fortune: 'да', sweep: '', how: 'Sawyer (Moonglade Marsh) за 50 тыс.; на топор, броню или снаряжение' },
  { what: 'Бустер Sweep', item: 'SWEEP_BOOSTER', fortune: '', sweep: 'да', how: 'дроп из Tree Gifts (Mangrove 1%, Fig 0,5%) или Bazaar' },
  { what: 'Бустер Foraging Wisdom', item: 'FORAGING_WISDOM_BOOSTER', fortune: '', sweep: '', how: 'дроп из Tree Gifts; ускоряет опыт скилла' },
  { what: 'Улучшение бустеров', item: 'SWEEP_BOOSTER_UNCOMMON', fortune: 'больше', sweep: 'больше', how: 'Maxim (Torrhus Canyon): Figstone + Mangcore + Helixis за каждый' },
  { what: 'Winding Ivy (предмет питомца)', item: 'WINDING_IVY', fortune: '', sweep: '+10', how: 'Miria за 250× Miria\'s Coupon' },
  { what: 'Moonglade Talisman → Ring → Artifact', item: 'MOONGLADE_TALISMAN', fortune: 'Fig/Mangrove', sweep: '', how: 'Agatha: по 30× Agatha\'s Coupon за ступень' },
  { what: 'Galaxy Fish Shard (атрибут)', item: null, fortune: 'до +10', sweep: '', how: 'Hunting: +1 Farming/Mining/Foraging Fortune за уровень атрибута' },
];

// Атрибуты Hunting, полезные для Foraging (id ключа в attributes.stacks = хвост ATTRIBUTE_SHARD_<ID>;1)
export const SHARDS = [
  { attr: 'fig_sharpening', shard: 'Crow', what: '+5 Sweep по деревьям Fig за уровень', how: 'Agatha за 15× Agatha\'s Coupon' },
  { attr: 'mangrove_sharpening', shard: 'Heron', what: 'Sweep по деревьям Mangrove', how: 'Agatha за 15× Agatha\'s Coupon (Hunting 5)' },
  { attr: 'helix_sharpening', shard: 'Vulture', what: 'Sweep по деревьям Helix', how: 'Miria за 25× Miria\'s Coupon (Hunting 10)' },
  { attr: 'fig_collector', shard: 'Sparrow', what: '+1 Fig Fortune за каждую цифру коллекции Fig Log', how: 'крафт: 32× Enchanted Fig Log + 16× Enchanted Feather + 16× Enchanted Egg (Hunting 5)' },
  { attr: 'mangrove_collector', shard: 'Seagull', what: 'Mangrove Fortune за цифры коллекции Mangrove Log', how: 'крафт из Enchanted Mangrove Log, Feather и Egg (Hunting 5)' },
  { attr: 'helix_collector', shard: 'Hawk', what: 'Helix Fortune за цифры коллекции Helix Log', how: 'крафт из Enchanted Helix Log, Feather и Egg (Hunting 5)' },
  { attr: 'first_sweep', shard: 'Torrid', what: 'первый Sweep по каждому дереву сильнее на 1% за уровень', how: 'дроп с Torrid (Hunting 10)' },
  { attr: 'axe_cooldown', shard: 'Drybark', what: 'перезарядка броска топора −1% за уровень', how: 'Helix Tree Gift (5%) или Drybark (Hunting 10)' },
];

// Магазины за купоны контестов. Agatha — Moonglade Marsh, Miria — Torrhus Canyon.
export const AGATHA_SHOP = [
  ['FROG;0', '20× Agatha\'s Coupon', 'питомец Frog'],
  ['ATTRIBUTE_SHARD_FIG_SHARPENING;1', '15× Agatha\'s Coupon', 'Crow Shard: Sweep по Fig'],
  ['ATTRIBUTE_SHARD_MANGROVE_SHARPENING;1', '15× Agatha\'s Coupon', 'Heron Shard: Sweep по Mangrove'],
  ['MOONGLADE_JEWEL', '50× Agatha\'s Coupon', 'перековка Moonglade на топор'],
  ['MOONGLADE_TALISMAN', '30× Agatha\'s Coupon', 'аксессуар, дальше Ring и Artifact по 30'],
  ['SMALL_FROG_TREAT', '30–60× Agatha\'s Coupon', 'Frog Treat: повышение редкости Frog (Small 30, Medium 40, Large 50, Giant 60)'],
  ['FIGHTING_BOOSTER', '100× Agatha\'s Coupon', 'боевой бустер'],
  ['SHINIEST', '20× Agatha\'s Prize', 'нужен для Jade Dragon'],
];
export const MIRIA_SHOP = [
  ['SLOTH;0', '20× Miria\'s Coupon', 'питомец Sloth — главный для Foraging'],
  ['SMALL_SLOTH_CLAW', '30–60× Miria\'s Coupon', 'Sloth Claw: редкость Sloth (Small 30, Medium 40, Large 50, Giant 60)'],
  ['ATTRIBUTE_SHARD_HELIX_SHARPENING;1', '25× Miria\'s Coupon', 'Vulture Shard: Sweep по Helix'],
  ['WINDING_IVY', '250× Miria\'s Coupon', '+10 Sweep питомцу'],
  ['VIAL_OF_SPRING_WATER', '10× Miria\'s Prize', 'для Honeycomb Necklace и Veilshroom Bracelet'],
  ['TORRHUS_TALISMAN', '30× Miria\'s Coupon', 'аксессуар, дальше Ring и Artifact'],
];

// Что падает из Tree Gifts (шансы из NEU)
export const GIFT_DROPS = [
  { id: 'TENDER_WOOD', from: 'Fig', chance: '100%' },
  { id: 'VINESAP', from: 'Mangrove', chance: '100%' },
  { id: 'STRETCHING_STICKS', from: 'Fig', chance: '10%' },
  { id: 'DEEP_ROOT', from: 'Mangrove', chance: '4%' },
  { id: 'SWEEP_BOOSTER', from: 'Mangrove / Fig', chance: '1% / 0,5%' },
  { id: 'FORAGING_WISDOM_BOOSTER', from: 'Mangrove / Fig', chance: '0,5% / 0,3%' },
  { id: 'SIGNAL_ENHANCER', from: 'все', chance: '1%' },
  { id: 'ATTRIBUTE_SHARD_AXE_COOLDOWN;1', from: 'Helix', chance: '5%' },
  { id: 'PET_ITEM_FORAGING_SKILL_BOOST_EPIC', from: 'Helix', chance: '0,025%' },
  { id: 'FORESTS_FAVOR', from: 'Helix', chance: '0,02%' },
  { id: 'TREE_THE_FISH', from: 'все', chance: '0,05%' },
];

// Вехи скилла: что открывается на уровне
export const SKILL_GATES = [
  [12, 'Fig Hew, броня Canopy, снаряжение Mangrove (Locket, Grippers, Moonglade Belt)'],
  [15, 'Figstone Splitter, броня Fig, Decent Axe'],
  [16, 'броня Snorkeling (для подводных зон Galatea)'],
  [20, 'Helix Chopper'],
  [24, 'Torrhus Belt (+10% очков Starlyn)'],
  [25, 'броня Helix'],
  [30, 'Honeycomb Necklace и Veilshroom Bracelet'],
];

// Брёвна Galatea: id, имя, сжатие, переработка в материал (160× Enchanted)
export const LOGS = [
  { id: 'FIG_LOG', name: 'Fig', ench: 'ENCHANTED_FIG_LOG', mat: 'FIGSTONE', whisper: 'Forest' },
  { id: 'MANGROVE_LOG', name: 'Mangrove', ench: 'ENCHANTED_MANGROVE_LOG', mat: 'MANGCORE', whisper: 'Forest' },
  { id: 'HELIX_LOG', name: 'Helix', ench: 'ENCHANTED_HELIX_LOG', mat: 'HELIXIS', whisper: 'Desert' },
];
