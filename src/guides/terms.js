// Игровые термины для подсказок, собранные автоматически из баз игры. Ручной словарь (glossary.js) остаётся
// главным: если термин есть и там, побеждает он. Отсюда приходит всё остальное:
//   • скиллы — из NEU constants/leveling (leveling_caps: список скиллов и их максимальный уровень);
//   • статы — полный список из перевода лора (items-ru/lib/terms.js) + короткое объяснение;
//   • мэры и их перки — из раздела «События» (calendar/mayors.js);
//   • острова — из NEU constants/islands (area_names, варпы);
//   • reforges — из NEU constants/reforges и reforgestones (статы на Legendary считаются из данных);
//   • слееры и их боссы, этажи данжей, редкости и игровые меню — небольшие таблицы ниже.
// Чары с уровнями (Sharpness V) и питомцы («Wolf Pet») добавляет refs.js прямо из предметов NEU.
//
// buildTerms(constants) → Map key → { names, kind, title, text, how?, warp?, items? } (тот же вид, что GLOSSARY).

import { STAT_NAMES } from '../items-ru/lib/terms.js';
import { MAYORS, PERK_RU } from '../calendar/mayors.js';
import { tx } from '../../i18n/msg.js';

const SKILL_RU = {
  farming: 'Навык фермерства: растёт за урожай. После 50 кап поднимается до 60 у Anita за медали Jacob\'s Contest.',
  mining: 'Навык добычи: растёт за руды, камень и гемы. Даёт Defense и Mining Fortune.',
  combat: 'Навык боя: растёт за убийства мобов. Даёт Crit Chance и открывает многое снаряжение.',
  foraging: 'Навык рубки деревьев: даёт Strength и Foraging Fortune.',
  fishing: 'Навык рыбалки: растёт за улов и Sea Creatures. Даёт Health.',
  enchanting: 'Навык зачарования: растёт за чары на столе и Experimentation Table. Даёт Intelligence и Ability Damage.',
  alchemy: 'Навык алхимии: растёт за варку зелий. Даёт Intelligence и делает зелья дольше.',
  taming: 'Навык приручения: растёт, когда питомцы получают опыт. Даёт Pet Luck, нужен для высоких уровней питомцев.',
  carpentry: 'Навык плотничества: растёт за крафт. Даёт Health, проще всего качается крафтом мебели.',
  runecrafting: 'Навык рун: растёт за руны и убийства с рунами. Только косметика и немного опыта SkyBlock.',
  social: 'Навык общения: растёт, когда гости на твоём острове что-то добывают. Только опыт SkyBlock.',
  hunting: 'Навык охоты: растёт за ловлю зверей и шарды (Hunting). Даёт статы и открывает новые места охоты.',
  catacombs: 'Уровень Dungeons (Catacombs): растёт за прохождения данжей. Даёт бонус к статам внутри данжа и открывает этажи.',
};
const SKILL_NAME = { HOTM: null, HOTF: null }; // у них своя запись в glossary.js

// Объяснения статов. Названия — как в игре; если стата здесь нет, текст собирается по шаблону ниже.
const STAT_RU = {
  'Health': 'Запас здоровья. Чем больше, тем дольше живёшь.',
  'Max Health': 'Максимальный запас здоровья.',
  'Defense': 'Снижает входящий урон. 100 Defense ≈ −50% урона.',
  'True Defense': 'Защищает от истинного урона (True Damage), который обычная Defense не режет.',
  'Strength': 'Увеличивает урон оружием: каждые 5 Strength дают +1% урона.',
  'Speed': 'Скорость передвижения. Обычный предел 400.',
  'Crit Chance': 'Шанс, что удар будет критическим. Больше 100% смысла нет.',
  'Crit Damage': 'Насколько сильнее бьёт критический удар. Главный стат урона вместе со Strength.',
  'Intelligence': 'Запас маны и урон способностей магического оружия.',
  'Mana': 'Тратится на способности предметов. Запас зависит от Intelligence.',
  'Mana Regen': 'Как быстро восстанавливается мана.',
  'Bonus Attack Speed': 'Скорость ударов в ближнем бою. Предел 100%.',
  'Attack Speed': 'Скорость ударов в ближнем бою. Предел 100%.',
  'Ferocity': 'Шанс нанести дополнительный удар: 100 Ferocity — ещё один удар каждый раз.',
  'Ability Damage': 'Увеличивает урон способностей предметов (маг-оружие, Hyperion и т.п.).',
  'Magic Find': 'Шанс редкого дропа с мобов. Работает только на дроп с шансом ниже 5%.',
  'Pet Luck': 'Шанс получить питомца получше и шанс редких дропов с питомцев.',
  'Sea Creature Chance': 'Шанс, что вместо рыбы клюнет Sea Creature.',
  'Fishing Speed': 'Ускоряет поклёвку.',
  'Treasure Chance': 'Шанс выловить сундук с сокровищами.',
  'Double Hook Chance': 'Шанс, что клюнут сразу два Sea Creature.',
  'Trophy Fish Chance': 'Шанс поймать Trophy Fish в лаве Crimson Isle.',
  'Health Regen': 'Как быстро восстанавливается здоровье.',
  'Vitality': 'Усиливает лечение, которое получаешь ты.',
  'Mending': 'Усиливает лечение, которое ты даёшь другим.',
  'Mining Speed': 'Как быстро ломаются блоки при добыче.',
  'Mining Fortune': 'Больше дропа с руды и камня: 100 Mining Fortune ≈ ×2.',
  'Mining Spread': 'Шанс сломать соседние блоки вместе с основным.',
  'Gemstone Spread': 'Шанс сломать соседние блоки гемов вместе с основным.',
  'Gemstone Fortune': 'Больше гемов с каждого блока.',
  'Block Fortune': 'Больше дропа с обычных блоков (камень, лёд и т.п.).',
  'Ore Fortune': 'Больше дропа с руды.',
  'Farming Fortune': 'Больше урожая: 100 Farming Fortune ≈ ×2.',
  'Foraging Fortune': 'Больше брёвен с каждого дерева.',
  'Hunting Fortune': 'Больше шардов и добычи при охоте.',
  'Pristine': 'Шанс, что гем сразу выпадет на уровень лучше (Flawed вместо Rough).',
  'Breaking Power': 'Какие блоки может ломать кирка или дрель. Нужен для твёрдых руд и гемов.',
  'Swing Range': 'Дальность удара в ближнем бою.',
  'Sweep': 'Сколько брёвен срубается за один удар топором.',
  'Heat Resistance': 'Защита от жары в Magma Fields и других горячих местах.',
  'Cold Resistance': 'Защита от холода в Glacite Tunnels и Mineshafts.',
  'Pressure Resistance': 'Защита от давления на глубине.',
  'Respiration': 'Дольше можно быть под водой.',
  'Bonus Pest Chance': 'Шанс, что в Garden появятся вредители (Pests).',
  'Magical Power': 'Сумма силы всех аксессуаров в Accessory Bag. Чем больше Magical Power, тем больше статов даёт выбранный в Maxwell Power.',
  'Accessory Power': 'Набор статов от Magical Power. Выбирается у Maxwell (Thaumaturgy).',
  'Gear Score': 'Оценка снаряжения в данже: показывает, насколько хорошо ты одет для этажа.',
  'Rift Time': 'Сколько ещё можно пробыть в Rift. Кончится — выкинет из Rift.',
  'Rift Damage': 'Урон внутри Rift.',
  'Hearts': 'Здоровье внутри Rift.',
  'Mining Speed Boost': 'Способность кирки: на время сильно ускоряет добычу.',
  'Combat Wisdom': 'Больше опыта Combat.',
  'Soulflow': 'Топливо для Soulflow Engine и щитов в Rift.',
};
// Не термины: служебные слова лора и слишком общие слова
const STAT_SKIP = new Set(['Damage', 'Mana Cost', 'Cooldown', 'Fuel', 'Gemstones', 'Pull', 'Fear', 'Speed Cap', 'Max Storage', 'Time Between Actions',
  'Resources Generated', 'Capacity', 'Soulflow Cost', 'Shot Cooldown', 'Trophy Chance']);

function statText(name) {
  if (STAT_RU[name]) return STAT_RU[name];
  let m = /^(.+) Wisdom$/.exec(name);
  if (m) return tx`Больше опыта ${m[1]}: каждые 10 ${name} дают +10% опыта этого навыка.`;
  m = /^(.+) Fortune$/.exec(name);
  if (m) return tx`Больше урожая ${m[1]}: каждые 100 ${name} — примерно ещё один урожай с блока.`;
  return null;
}

// Слееры: босс, место и что обычно ищут. Квесты у Maddox the Slayer в Hub.
const SLAYERS = [
  { key: 'zombie', names: ['Revenant Horror', 'Revenant Slayer', 'Zombie Slayer'], boss: 'Revenant Horror', where: 'Graveyard в Hub', warp: 'crypts', drops: ['REVENANT_FLESH', 'FOUL_FLESH', 'SNAKE_RUNE', 'SCYTHE_BLADE'] },
  { key: 'spider', names: ['Tarantula Broodfather', 'Tarantula Slayer', 'Spider Slayer'], boss: 'Tarantula Broodfather', where: 'Spider\'s Den', warp: 'spider', drops: ['TARANTULA_WEB', 'TOXIC_ARROW_POISON', 'BITE_RUNE', 'DIGESTED_MOSQUITO'] },
  { key: 'wolf', names: ['Sven Packmaster', 'Sven Slayer', 'Wolf Slayer'], boss: 'Sven Packmaster', where: 'Howling Cave в The Park', warp: 'howl', drops: ['WOLF_TOOTH', 'HAMSTER_WHEEL', 'SPIRIT_RUNE', 'RED_CLAW_EGG'] },
  { key: 'enderman', names: ['Voidgloom Seraph', 'Voidgloom Slayer', 'Enderman Slayer'], boss: 'Voidgloom Seraph', where: 'The End', warp: 'end', drops: ['NULL_SPHERE', 'SUMMONING_EYE', 'JUDGEMENT_CORE', 'HANDY_BLOOD_CHALICE'] },
  { key: 'blaze', names: ['Inferno Demonlord', 'Blaze Slayer', 'Inferno Slayer'], boss: 'Inferno Demonlord', where: 'Smoldering Tomb и Stronghold на Crimson Isle', warp: 'smold', drops: ['DERELICT_ASHE', 'WISP_ICE_FLAVORED_SPLASH_POTION', 'HIGH_CLASS_ARCHFIEND_DICE', 'FIRE_ASPECT;3'] },
  { key: 'vampire', names: ['Riftstalker Bloodfiend', 'Vampire Slayer', 'Bloodfiend'], boss: 'Riftstalker Bloodfiend', where: 'Stillgore Château в Rift', warp: null, drops: ['COVEN_SEAL', 'MCGRUBBER_BURGER', 'UNFANGED_VAMPIRE_PART'] },
];

// Этажи данжей: босс этажа
const FLOORS = [['Bonzo'], ['Scarf'], ['The Professor'], ['Thorn'], ['Livid'], ['Sadan'], ['Necron и Wither Lords']];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const RARITIES = {
  COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary', MYTHIC: 'Mythic', DIVINE: 'Divine', SPECIAL: 'Special', 'VERY SPECIAL': 'Very Special',
};

// Разделы и меню игры
const MENUS = {
  dungeons: { names: ['Dungeons', 'Dungeon', 'данжи', 'Данжи', 'данжей', 'данжах', 'данж', 'данже'], kind: 'mech', title: 'Dungeons', warp: 'dungeon_hub',
    text: 'Данжи: этажи Catacombs F1–F7 и Master Mode M1–M7 с боссами. Играют впятером, у каждого класс (Archer, Berserk, Mage, Healer, Tank). Награды — сундуки в конце, Essence и Catacombs XP.',
    how: ['/warp dungeon_hub, у входа — Party Finder.', 'Выбери класс и этаж по уровню Catacombs.', 'Пройди комнаты, открой Blood Room, убей босса и забери сундук.'] },
  slayers: { names: ['Slayers', 'Slayer', 'слееры', 'Слееры', 'слееров', 'слеерам', 'слеер', 'Слеер'], kind: 'mech', title: 'Slayers',
    text: 'Слееры — квесты на боссов у Maddox the Slayer в Hub: Revenant Horror, Tarantula Broodfather, Sven Packmaster, Voidgloom Seraph, Inferno Demonlord, Riftstalker Bloodfiend. Набиваешь опыт с мобов — появляется босс. Уровни слеера открывают рецепты и дают статы.',
    how: ['Подойди к Maddox the Slayer в Hub (или Maddox Batphone).', 'Начни квест нужного тира и убивай мобов этого вида.', 'Убей появившегося босса: опыт слеера, дроп и RNG Meter.'] },
  kuudra: { names: ['Kuudra', 'Kuudra\'s Hollow', 'Kuudra’s Hollow'], kind: 'mob', title: 'Kuudra', warp: 'nether',
    text: 'Босс Crimson Isle для команды из четырёх. Тиры Basic, Hot, Burning, Fiery, Infernal. Открывается квестами фракции; награды — броня Kuudra, Attribute Shards и Essence.' },
  rift: { names: ['The Rift', 'Rift', 'Рифт', 'Рифте', 'Рифта'], kind: 'place', title: 'The Rift', warp: 'rift',
    text: 'Отдельное измерение через Wizard Tower в Hub. Своя валюта Motes, время пребывания (Rift Time), Enigma Souls и Vampire Slayer.' },
  accessory_bag: { names: ['Accessory Bag', 'Talisman Bag'], kind: 'mech', title: 'Accessory Bag',
    text: 'Сумка для аксессуаров (talismans, rings, artifacts). Работают только аксессуары внутри неё; каждый даёт Magical Power. Слоты растут с Redstone Collection и Pigman-квестами.' },
  wardrobe: { names: ['Wardrobe'], kind: 'mech', title: 'Wardrobe', text: 'Гардероб: хранит наборы брони и надевает их в один клик. Меню через SkyBlock Menu или /wardrobe.' },
  ender_chest: { names: ['Ender Chest'], kind: 'mech', title: 'Ender Chest', text: 'Личное хранилище, доступное с любого острова. Страницы докупаются за Gems.' },
  auction_house: { names: ['Auction House', 'Auction', 'аукцион', 'аукционе', 'аукциона', 'Аукцион'], kind: 'place', title: 'Auction House', warp: 'hub',
    text: 'Аукцион в Hub (/ah с Booster Cookie): продажа предметов игрокам. Бывает BIN (купить сразу) и обычные торги.' },
  sacks: { names: ['Sacks', 'Sack of Sacks', 'мешки', 'мешках', 'Мешки'], kind: 'mech', title: 'Sacks', text: 'Мешки: сами собирают ресурсы при добыче, не занимая инвентарь. Крафтятся из коллекций.' },
  personal_vault: { names: ['Personal Vault', 'Bank'], kind: 'mech', title: 'Bank и Personal Vault', text: 'Банк в Hub хранит монеты (не теряются при смерти) и даёт проценты. Personal Vault — безопасное хранилище предметов там же.' },
  backpack: { names: ['Backpacks', 'Backpack'], kind: 'mech', title: 'Backpack', text: 'Рюкзаки: дополнительные хранилища в Storage (/storage).' },
  quiver: { names: ['Quiver'], kind: 'mech', title: 'Quiver', text: 'Колчан для стрел: лук берёт стрелы отсюда.' },
  pets_menu: { names: ['Pets Menu', 'Pet Score', 'Pet Items'], kind: 'mech', title: 'Pets', text: 'Меню питомцев (/pets). Активный питомец даёт статы и способности; Pet Score даёт Magic Find.' },
  collections: { names: ['Collections', 'Collection', 'коллекции', 'Коллекции', 'коллекций'], kind: 'mech', title: 'Collections',
    text: 'Коллекции: за каждый собранный ресурс растёт его коллекция. Уровни открывают рецепты, миньонов и SkyBlock XP.' },
  minions: { names: ['Minions', 'Minion', 'миньоны', 'Миньоны', 'миньонов', 'миньонам'], kind: 'mech', title: 'Minions',
    text: 'Миньоны работают на твоём острове без тебя. Уникальные крафты миньонов дают больше слотов.' },
  skyblock_level: { names: ['SkyBlock Level', 'SkyBlock Levels', 'SB Level'], kind: 'mech', title: 'SkyBlock Level', text: 'Уровень SkyBlock: 100 SkyBlock XP = 1 уровень. Опыт дают задания в меню SkyBlock Leveling почти за всё.' },
  fairy_souls: { names: ['Fairy Souls', 'Fairy Soul', 'души фей', 'Души фей', 'душ фей'], kind: 'mech', title: 'Fairy Souls',
    text: 'Спрятанные души на островах. Каждые 5 сдаются Tia the Fairy в Wilderness (Hub) за Health, Defense, Strength и Speed.' },
  community_center: { names: ['Community Center', 'Elizabeth'], kind: 'place', title: 'Community Center', warp: 'hub', text: 'Магазин в Hub: Booster Cookie, Bits Shop, улучшения аккаунта, выборы мэра.' },
  bits: { names: ['Bits'], kind: 'cur', title: 'Bits', text: 'Валюта Bits: копится, пока действует Booster Cookie. Тратится у Elizabeth в Community Center.' },
  gems: { names: ['SkyBlock Gems'], kind: 'cur', title: 'SkyBlock Gems', text: 'Валюта за реальные деньги. Тратится на Booster Cookie, страницы Ender Chest и косметику.' },
  experimentation_table: { names: ['Experimentation Table', 'Experiments', 'Superpairs', 'Chronomatron', 'Ultrasequencer'], kind: 'mech', title: 'Experimentation Table',
    text: 'Стол экспериментов на твоём острове: мини-игры раз в день дают Enchanting XP и книги.' },
  hex: { names: ['The Hex', 'Hex'], kind: 'mech', title: 'The Hex', text: 'Меню в Dungeon Hub и на столе зачарования: Hot Potato Book, гемы, Recombobulator, книги и Reforge в одном месте.' },
  maxwell: { names: ['Maxwell', 'Thaumaturgy', 'Tuning'], kind: 'mech', title: 'Maxwell', text: 'Меню Accessory Bag: выбор Power (набор статов от Magical Power) и Tuning — распределение очков в статы.' },
  chocolate_factory: { names: ['Chocolate Factory', 'Hoppity'], kind: 'mech', title: 'Chocolate Factory', text: 'Шоколадная фабрика (/cf): кликер с Rabbits; Hoppity\'s Hunt — охота за яйцами раз в год.' },
  abiphone: { names: ['Abiphone'], kind: 'mech', title: 'Abiphone', text: 'Телефон: звонки NPC (Maddox, Kat, торговцы) из любого места. Контакты открываются квестами.' },
  private_island: { names: ['Private Island'], kind: 'place', title: 'Private Island', warp: 'home', text: 'Твой остров: миньоны, сундуки, Experimentation Table. /warp home.' },
  skill_average: { names: ['Skill Average', 'Skill Avg'], kind: 'mech', title: 'Skill Average', text: 'Средний уровень скиллов (без Runecrafting и Social). Нужен для некоторых мест и предметов.' },
  hpb: { names: ['Hot Potato Books', 'Hot Potato Book', 'Fuming Potato Books', 'Fuming Potato Book', 'HPB'], kind: 'mech', title: 'Hot Potato Book',
    text: 'Книги улучшения: каждая даёт оружию +2 Strength и +2 Damage, броне +4 Health и +2 Defense. До 10 Hot и 5 Fuming.' },
  recomb: { names: ['Recombobulator 3000', 'Recombobulator', 'recomb'], kind: 'mech', title: 'Recombobulator 3000', text: 'Поднимает редкость предмета на ступень: больше статов и Magical Power у аксессуаров.' },
  stars: { names: ['Dungeon Stars', 'звёзды', 'звёзд', 'Звёзды'], kind: 'mech', title: 'Звёзды предмета', text: 'Улучшение предметов данжей за Essence: каждая звезда +10% статов в данже. 5 звёзд обычные, дальше Master Stars.' },
  attribute_shards: { names: ['Attribute Shards', 'Attribute Shard', 'Attributes'], kind: 'mech', title: 'Attributes', text: 'Атрибуты на снаряжении Kuudra и Crimson Isle. Повышаются слиянием и шардами.' },
};

// Перки мэров из двух и больше слов идут в подсказки (Mining Fiesta, Pathfinder одним словом — нет)
const PERK_OK = n => /\s/.test(n) && n.length >= 8;

let cached = null;
let cachedFor = null;

/** Все автоматические термины. constants — NEU constants (может быть пустым объектом). */
export function buildTerms(constants = {}) {
  if (cached && cachedFor === constants) return cached;
  const m = new Map();
  const add = (key, e) => { if (e.names?.length && e.text) m.set(key, e); };

  // Скиллы
  const caps = constants.leveling?.leveling_caps || { farming: 60, mining: 60, combat: 60, foraging: 50, fishing: 50, enchanting: 60, alchemy: 50, taming: 50, carpentry: 50, runecrafting: 25, social: 25, hunting: 50, catacombs: 50 };
  for (const [k, cap] of Object.entries(caps)) {
    if (k in SKILL_NAME || !SKILL_RU[k]) continue;
    const name = k[0].toUpperCase() + k.slice(1);
    add(tx`skill.${k}`, { names: [name, tx`${name} Skill`, tx`${name} XP`], kind: 'skill', title: name, text: tx`${SKILL_RU[k]} Максимум — ${k === 'farming' ? 60 : cap} уровень.` });
  }

  // Статы
  for (const name of STAT_NAMES) {
    if (STAT_SKIP.has(name)) continue;
    const text = statText(name);
    if (text) add(tx`stat.${name}`, { names: [name], kind: 'stat', title: name, text });
  }
  for (const name of Object.keys(STAT_RU)) if (!m.has(`stat.${name}`)) add(tx`stat.${name}`, { names: [name], kind: 'stat', title: name, text: STAT_RU[name] });

  // Мэры и перки
  for (const [key, mayor] of Object.entries(MAYORS)) {
    add(tx`mayor.${key}`, { names: [mayor.name, tx`Mayor ${mayor.name}`], kind: 'npc', title: tx`Мэр ${mayor.name}`, text: tx`Мэр SkyBlock (${mayor.role}). ${mayor.tip}`, items: mayor.icon ? [mayor.icon] : undefined });
  }
  for (const [perk, [ru, what]] of Object.entries(PERK_RU)) {
    if (!PERK_OK(perk)) continue;
    add(tx`perk.${perk}`, { names: [perk], kind: 'mech', title: perk, text: tx`Перк мэра: ${ru.toLowerCase()}. ${what}` });
  }

  // Разделы и меню
  for (const [k, e] of Object.entries(MENUS)) add(tx`menu.${k}`, e);

  // Острова (имена, которые уже есть в меню выше, — пропускаем)
  const taken = new Set([...m.values()].flatMap(e => e.names));
  const isl = constants.islands?.area_names || {};
  for (const [k, name] of Object.entries(isl)) {
    if (!name || k === 'dungeon') continue;
    const warp = (constants.islands?.island_warps || []).find(w => w.mode === k)?.warp || (k === 'hub' ? 'hub' : null);
    const names = [name, /^The /.test(name) ? name.slice(4) : null].filter(n => n && !taken.has(n));
    add(tx`isle.${k}`, { names, kind: 'place', title: name, text: tx`Остров SkyBlock${k === 'dynamic' ? ': твой личный остров' : ''}.`, warp: warp || undefined });
  }

  // Слееры
  for (const s of SLAYERS) {
    add(tx`slayer.${s.key}`, {
      names: s.names, kind: 'mob', title: s.boss,
      text: tx`Босс слеера. Где: ${s.where}. Квест у Maddox the Slayer в Hub: набей опыт с мобов этого вида — появится босс. Тиры I–${s.key === 'vampire' ? 'V' : s.key === 'zombie' ? 'V' : 'IV'}.`,
      warp: s.warp || undefined, items: s.drops,
    });
  }

  // Этажи данжей: F1–F7, M1–M7, Floor 7, Floor VII
  FLOORS.forEach(([boss], i) => {
    const n = i + 1;
    add(tx`floor.f${n}`, { names: [tx`F${n}`, tx`Floor ${n}`, tx`Floor ${ROMAN[i]}`, tx`Catacombs F${n}`], kind: 'floor', title: tx`Catacombs Floor ${n}`, text: tx`${n}-й этаж Catacombs. Босс: ${boss}.`, warp: 'dungeon_hub' });
    add(tx`floor.m${n}`, { names: [tx`M${n}`, tx`Master Mode ${n}`, tx`Master Mode Floor ${n}`], kind: 'floor', title: tx`Master Mode ${n}`, text: tx`${n}-й этаж Master Mode: тот же босс (${boss}), но мобы намного сильнее, а награды лучше. Открывается после F${n} на S.`, warp: 'dungeon_hub' });
  });

  // Редкости
  const ord = Object.values(RARITIES);
  for (const [k, name] of Object.entries(RARITIES)) {
    add(tx`rarity.${k}`, { names: [name], kind: 'rarity', title: name,
      text: tx`Редкость предмета${k === 'SPECIAL' || k === 'VERY SPECIAL' ? ' (особые предметы ивентов)' : ''}. Порядок: ${ord.slice(0, 7).join(' → ')}. Recombobulator 3000 поднимает на ступень.` });
  }

  // Reforges: статы на Legendary из данных NEU
  const STAT_KEY = { health: 'Health', defense: 'Defense', strength: 'Strength', speed: 'Speed', crit_chance: 'Crit Chance', crit_damage: 'Crit Damage', intelligence: 'Intelligence',
    bonus_attack_speed: 'Attack Speed', ferocity: 'Ferocity', magic_find: 'Magic Find', sea_creature_chance: 'Sea Creature Chance', mining_speed: 'Mining Speed', mining_fortune: 'Mining Fortune',
    farming_fortune: 'Farming Fortune', foraging_fortune: 'Foraging Fortune', true_defense: 'True Defense', ability_damage: 'Ability Damage', pet_luck: 'Pet Luck', fishing_speed: 'Fishing Speed',
    vitality: 'Vitality', mending: 'Mending', health_regen: 'Health Regen', gemstone_fortune: 'Gemstone Fortune', pristine: 'Pristine' };
  const TYPE_RU = { SWORD: 'мечей', BOW: 'луков', ARMOR: 'брони', EQUIPMENT: 'снаряжения', PICKAXE: 'кирок', AXE: 'топоров', HOE: 'мотыг', FISHING_ROD: 'удочек', VACUUM: 'пылесосов', DRILL: 'дрелей', ROD: 'удочек' };
  const reforgeEntry = (r, stone) => {
    const name = r.reforgeName;
    if (!name || name.length < 4 || RARITY_WORDS.has(name) || REFORGE_SKIP.has(name)) return;
    const st = r.reforgeStats?.LEGENDARY || r.reforgeStats?.EPIC || null;
    const stats = st ? Object.entries(st).filter(([k, v]) => STAT_KEY[k] && v).map(([k, v]) => tx`${v > 0 ? '+' : ''}${v} ${STAT_KEY[k]}`).join(', ') : '';
    const types = String(r.itemTypes || '').split(/[,\s/]+/).map(t => TYPE_RU[t]).filter(Boolean);
    const text = tx`Reforge${types.length ? tx` для ${types.join(', ')}` : ''}${stone ? ' (камень у Reforge Anvil)' : ' (у Blacksmith)'}.${stats ? tx` На Legendary: ${stats}.` : ''}`;
    add(tx`reforge.${name}`, { names: [name], kind: 'reforge', title: tx`Reforge ${name}`, text, items: stone && r.internalName ? [r.internalName] : undefined });
  };
  for (const r of Object.values(constants.reforges || {})) reforgeEntry(r, false);
  for (const r of Object.values(constants.reforgestones || {})) reforgeEntry(r, true);


  cached = m; cachedFor = constants;
  return m;
}

const RARITY_WORDS = new Set(Object.values(RARITIES));
// Reforges, совпадающие с обычными словами, частями других терминов или статами
const REFORGE_SKIP = new Set(['Light', 'Pure', 'Fair', 'Fast', 'Fine', 'Neat', 'Odd', 'Rich', 'Keen', 'Wise', 'Strong', 'Shiny', 'Simple', 'Strange', 'Pretty', 'Pleasant', 'Grand',
  'Sweet', 'Clean', 'Heavy', 'Smart', 'Lucky', 'Gentle', 'Hasty', 'Great', 'Rapid', 'Deadly', 'Hot', 'Fiery', 'Burning', 'Infernal', 'Superior', 'Perfect', 'Undead',
  'Giant', 'Hyper', 'Toil', 'Moil', 'Spiked', 'Snowy', 'Salty', 'Stiff', 'Itchy', 'Bloody', 'Rugged', 'Cubic', 'Precise', 'Magnetic', 'Earthy', 'Heroic', 'Sharp',
  'Godly', 'Unreal', 'Vivid', 'Bizarre', 'Ominous', 'Silky', 'Hurtful', 'Zealous', 'Festive', 'Loving', 'Blessed', 'Strengthened', 'Mossy', 'Squeaky', 'Waxed', 'Chomp',
  'Royal', 'Titanic', 'Refined', 'Dimensional', 'Moonglade', 'Glacial', 'Frozen', 'Warped', 'Sunny', 'Jerry\'s']);
// Список выше — только частые английские слова и reforges, которые в тексте обычно значат другое.
// Остальные (Fabled, Withered, Suspicious, Ridiculous…) подсвечиваются.
