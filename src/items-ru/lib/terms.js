// Игровые термины оставляем как в игре, на английском (24.11.2026: игроки просили не переводить
// названия статов, скиллов и мест). Переведённый лор и описания остаются русскими, но название стата
// после значка (❁ Силы → ❁ Strength) возвращаем к оригиналу. Работает поверх готовых переводов,
// поэтому старый словарь лора не нужно переписывать.

const GLYPHS = '⚔๑✎Ⓟ❄☠❈⚓⫽☂❁❤❣♨♣☄⸕▚ൠ✯❍✧⚶α✦∮Ⓢ⛃❂♔☣☘';
const W = '[а-яё]*';

const CROP_FORTUNE = [
  ['пшениц' + W, 'Wheat'], ['морков' + W, 'Carrot'], ['картофел' + W, 'Potato'], ['тыкв' + W, 'Pumpkin'],
  ['арбуз' + W, 'Melon'], ['гриб' + W, 'Mushroom'], ['кактус' + W, 'Cactus'], ['сахарн' + W + ' тростни' + W, 'Sugar Cane'],
  ['адск' + W + ' нарост' + W, 'Nether Wart'], ['незерск' + W + ' нарост' + W, 'Nether Wart'], ['какао-боб' + W, 'Cocoa Beans'],
  ['подсолнух' + W, 'Sunflower'], ['лунн' + W + ' цвет' + W, 'Moonflower'], ['дик' + W + ' роз' + W, 'Wild Rose'],
];

// [русская фраза (основа + любые окончания), английский стат]. Длинные фразы — раньше коротких.
const STAT_RU = [
  ['Крит\\.? урон' + W, 'Crit Damage'], ['Шанс' + W + ' крита', 'Crit Chance'],
  ['Шанс' + W + ' морского существа', 'Sea Creature Chance'], ['Шанс' + W + ' сокровища', 'Treasure Chance'],
  ['Шанс' + W + ' двойного улова', 'Double Hook Chance'], ['Шанс' + W + ' трофе' + W, 'Trophy Fish Chance'],
  ['Бонусн' + W + ' шанс' + W + ' вредителей', 'Bonus Pest Chance'], ['Шанс' + W + ' вредителей', 'Bonus Pest Chance'],
  ['Удач' + W + ' добычи', 'Mining Fortune'], ['Фермерск' + W + ' удач' + W, 'Farming Fortune'], ['Удач' + W + ' фермерства', 'Farming Fortune'],
  ['Удач' + W + ' лесорубства', 'Foraging Fortune'], ['Удач' + W + ' охоты', 'Hunting Fortune'], ['Удач' + W + ' питомцев', 'Pet Luck'],
  ['Удач' + W + ' на самоцветы', 'Gemstone Fortune'], ['Удач' + W + ' на блоки', 'Block Fortune'], ['Удач' + W + ' на руду', 'Ore Fortune'],
  ...CROP_FORTUNE.map(([ru, en]) => ['Удач' + W + ' на ' + ru, `${en} Fortune`]),
  ['Регенераци' + W + ' здоровья', 'Health Regen'], ['Регенераци' + W + ' маны', 'Mana Regen'],
  ['Истинн' + W + ' защит' + W, 'True Defense'], ['Скорост' + W + ' добычи', 'Mining Speed'], ['Скорост' + W + ' рыбалки', 'Fishing Speed'],
  ['Скорост' + W + ' атаки', 'Bonus Attack Speed'], ['Радиус' + W + ' добычи', 'Mining Spread'], ['Дальност' + W + ' удара', 'Swing Range'],
  ['Сопротивлени' + W + ' давлению', 'Pressure Resistance'], ['Поиск' + W + ' магии', 'Magic Find'],
  ['Морозостойкост' + W, 'Cold Resistance'], ['Термостойкост' + W, 'Heat Resistance'],
  ['Скорост' + W, 'Speed'], ['Сил(?:а|ы|у|е|ой)', 'Strength'], ['Урон' + W, 'Damage'], ['Защит' + W, 'Defense'],
  ['Здоровь' + W, 'Health'], ['Интеллект' + W, 'Intelligence'], ['Свирепост' + W, 'Ferocity'], ['Живучест' + W, 'Vitality'],
  ['Лечени' + W, 'Mending'], ['Размах' + W, 'Sweep'], ['Чистот' + W, 'Pristine'], ['Дыхани' + W, 'Respiration'], ['Ман(?:а|ы|у|ой)', 'Mana'],
];

// Строка характеристики из старого перевода: «Сила: +150» → «Strength: +150»
const STAT_LINE_RU = {
  'Здоровье': 'Health', 'Макс. здоровье': 'Max Health', 'Защита': 'Defense', 'Истинная защита': 'True Defense',
  'Сила': 'Strength', 'Скорость': 'Speed', 'Шанс крита': 'Crit Chance', 'Крит. урон': 'Crit Damage',
  'Интеллект': 'Intelligence', 'Мана': 'Mana', 'Регенерация маны': 'Mana Regen',
  'Скорость атаки': 'Bonus Attack Speed', 'Шанс морского существа': 'Sea Creature Chance',
  'Magic Find (удача на дроп)': 'Magic Find', 'Удача питомцев': 'Pet Luck', 'Свирепость': 'Ferocity',
  'Урон способностей': 'Ability Damage', 'Скорость добычи': 'Mining Speed', 'Удача добычи': 'Mining Fortune',
  'Удача на самоцветы': 'Gemstone Fortune', 'Удача на блоки': 'Block Fortune', 'Удача на руду': 'Ore Fortune',
  'Фермерская удача': 'Farming Fortune', 'Удача лесорубства': 'Foraging Fortune', 'Удача охоты': 'Hunting Fortune',
  'Чистота (Pristine)': 'Pristine', 'Радиус добычи (Mining Spread)': 'Mining Spread',
  'Радиус добычи самоцветов': 'Gemstone Spread', 'Регенерация здоровья': 'Health Regen', 'Живучесть': 'Vitality',
  'Лечение': 'Mending', 'Урон': 'Damage', 'Рейтинг снаряжения': 'Gear Score', 'Скорость рыбалки': 'Fishing Speed',
  'Дальность удара': 'Swing Range', 'Мудрость боя': 'Combat Wisdom', 'Мудрость добычи': 'Mining Wisdom',
  'Мудрость фермерства': 'Farming Wisdom', 'Мудрость лесорубства': 'Foraging Wisdom',
  'Мудрость рыбалки': 'Fishing Wisdom', 'Мудрость зачарования': 'Enchanting Wisdom',
  'Мудрость алхимии': 'Alchemy Wisdom', 'Мудрость плотничества': 'Carpentry Wisdom',
  'Мудрость приручения': 'Taming Wisdom', 'Мудрость общения': 'Social Wisdom',
  'Мудрость рунического ремесла': 'Runecrafting Wisdom', 'Мудрость охоты': 'Hunting Wisdom',
  'Сила разрушения': 'Breaking Power', 'Термостойкость': 'Heat Resistance', 'Морозостойкость': 'Cold Resistance',
  'Сопротивление давлению': 'Pressure Resistance', 'Дыхание': 'Respiration', 'Шанс вредителей': 'Bonus Pest Chance',
  'Шанс трофейной рыбы': 'Trophy Fish Chance', 'Шанс двойного улова': 'Double Hook Chance',
  'Шанс сокровища': 'Treasure Chance', 'Размах (Sweep)': 'Sweep', 'Перезарядка выстрела': 'Shot Cooldown',
  'Время в Rift': 'Rift Time', 'Урон в Rift': 'Rift Damage', 'Сердца': 'Hearts', 'Сила аксессуара': 'Accessory Power',
  'Затраты маны': 'Mana Cost', 'Перезарядка': 'Cooldown', 'Затраты Soulflow': 'Soulflow Cost', 'Топливо': 'Fuel',
  'Самоцветы': 'Gemstones', 'Тяга': 'Pull', 'Страх': 'Fear', 'Шанс трофея': 'Trophy Chance',
  'Предел скорости': 'Speed Cap', 'Макс. вместимость': 'Max Storage', 'Время между действиями': 'Time Between Actions',
  'Произведено ресурсов': 'Resources Generated', 'Вместимость': 'Capacity', 'Ускорение добычи': 'Mining Speed Boost',
};

const LINE_RE = new RegExp(`^(\\s*(?:§.)*)(${Object.keys(STAT_LINE_RU).sort((a, b) => b.length - a.length).map(k => k.replace(/[.]/g, '\\.')).join('|')}):`);

const RE = new RegExp(`([${GLYPHS}]\\s?)(${STAT_RU.map(([ru]) => ru).join('|')})(?![а-яё])`, 'g');
const PARTS = STAT_RU.map(([ru, en]) => [new RegExp(`^(?:${ru})$`), en]);

/** «Даёт {0} ❁ Силы и ☠ Крит. урона» → «Даёт {0} ❁ Strength и ☠ Crit Damage» */
export function enTerms(text) {
  if (!text || typeof text !== 'string' || !/[а-яё]/i.test(text)) return text;
  return text.replace(LINE_RE, (_, pre, ru) => `${pre}${STAT_LINE_RU[ru]}:`).replace(RE, (all, glyph, ru) => {
    const hit = PARTS.find(([re]) => re.test(ru));
    return hit ? glyph + hit[1] : all;
  });
}

/** Все английские названия статов (для подсказок по тексту: server/guides/terms.js). */
export const STAT_NAMES = [...new Set([...Object.values(STAT_LINE_RU), ...STAT_RU.map(([, en]) => en)])];
