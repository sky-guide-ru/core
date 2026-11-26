// Перевод лора предметов. Две ступени:
// 1) translateLoreLine — построчно: характеристики, требования, редкость/тип, служебные фразы;
// 2) translateLore — по абзацам (строки между пустыми), потому что в игре предложения
//    переносятся на несколько строк. Абзацы, для которых нет шаблона, остаются на английском
//    и считаются в поле untranslated, чтобы интерфейс мог показать оригинал.

import {
  STATS, STAT_GLYPHS, RARITY, ITEM_TYPES, SKILLS, MOB_TYPES, ISLANDS, TYPE_GENDER, agreeAdj,
} from './glossary.js';
import { lookup as dictLookup } from './dict.js';
import { both } from '../../../i18n/msg.js';

const COLOR = /§[0-9a-fk-orx]/gi;
export const stripColor = s => String(s ?? '').replace(COLOR, '');

/** Заменяет иконки ресурс-пака на обычные символы, неизвестные убирает */
export function normalizeGlyphs(s) {
  return String(s ?? '').replace(/[-]/g, ch => STAT_GLYPHS[ch] || '');
}

const statNames = Object.keys(STATS).sort((a, b) => b.length - a.length).map(s => s.replace(/ /g, '\\s'));
const STAT_LINE = new RegExp(`^(\\s*(?:§.)*)(${statNames.join('|')}):`);
const RARITY_LINE = /^((?:§.)*)(?:a )?(VERY SPECIAL|COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL|ULTIMATE|ADMIN)( DUNGEON)?(?: (.+))?$/;

const SKILL_EN = Object.fromEntries(Object.entries(SKILLS).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v]));

/** Фразы целиком (после снятия цветов и glyph'ов, без точки на конце сравниваем тоже) */
const PHRASES = {
  'This item can be reforged!': 'Этот предмет можно перековать!',
  'Combinable in Anvil': 'Можно объединять на наковальне',
  'Applied To:': 'Применяется к:',
  'Sources:': 'Источники:',
  'Source:': 'Источник:',
  'Requirements:': 'Требования:',
  'Conflicts:': 'Несовместимо с:',
  'Right-click to view recipes!': 'ПКМ — посмотреть рецепты!',
  'Consumed on use': 'Расходуется при использовании',
  'Works while in Accessory Bag!': 'Работает в Accessory Bag!',
  '* Soulbound *': '* Привязан к душе (Soulbound) *',
  '* Co-op Soulbound *': '* Привязан к кооперативу (Co-op Soulbound) *',
  'Collection Item': 'Предмет коллекции',
  'Right-click to add this pet to your pet menu!': 'ПКМ — добавить питомца в меню питомцев!',
  'Right-click to equip!': 'ПКМ — надеть!',
  'Right-click to consume!': 'ПКМ — употребить!',
  'Click to consume!': 'Нажмите, чтобы употребить!',
  'Right-click to open!': 'ПКМ — открыть!',
  'Right Click to open!': 'ПКМ — открыть!',
  'Right-click to use your class ability!': 'ПКМ — использовать способность класса!',
  'Right-click to view rarity scaling!': 'ПКМ — посмотреть рост по редкостям!',
  'Right-click to send to Hunting Box!': 'ПКМ — отправить в Hunting Box!',
  'Shift Right-click to move all!': 'Shift+ПКМ — переместить всё!',
  'Right click to add to your Factory!': 'ПКМ — добавить на вашу фабрику!',
  'Can be upgraded at Kat in The Hub!': 'Можно улучшить у Kat в Хабе!',
  '(Requires active Booster Cookie)': '(Нужен активный Booster Cookie)',
  'Furniture': 'Мебель', 'Reforge Stone': 'Камень перековки', 'Brewing Ingredient': 'Ингредиент для зелий',
  'Consumable': 'Расходник', 'Minion Skin': 'Скин миньона', 'Minion Fuel': 'Топливо для миньонов',
  'Quest Item': 'Квестовый предмет', 'Decoration Item': 'Декоративный предмет', 'Fishing Bait': 'Наживка',
  'Consumes on Catch': 'Расходуется при поимке', 'Farming Tool': 'Фермерский инструмент', 'Hunting Tool': 'Инструмент охоты',
  'Combat Pet': 'Боевой питомец', 'Fishing Pet': 'Питомец рыбалки', 'Farming Pet': 'Питомец фермерства',
  'Mining Pet': 'Питомец добычи', 'Foraging Pet': 'Питомец лесорубства', 'Enchanting Pet': 'Питомец зачарования',
  'Alchemy Pet': 'Питомец алхимии', 'Gabagool Pet': 'Gabagool Pet', 'Hunting Pet': 'Питомец охоты',
  'Holiday Cosmetic': 'Праздничная косметика', 'Halloween Cosmetic': 'Хэллоуинская косметика',
  'Summer Cosmetic': 'Летняя косметика', 'Easter Cosmetic': 'Пасхальная косметика',
  'This skin is animated!': 'Этот скин анимирован!', 'X Rift-Transferable X': 'X Можно перенести в Rift X',
  'Multiple sacks sum their capacity!': 'Вместимость нескольких мешков суммируется!',
  'The pet must be visible to apply the item!': 'Питомец должен быть призван, чтобы применить предмет!',
  'Analyze this crop!': 'Изучите эту культуру!',
  'Unique Power Bonus:': 'Уникальный бонус силы:',
  'Weapons': 'Оружие', 'Bows': 'Луки', 'Boots': 'Ботинки', 'Armor': 'Броня',
  'Item Ability:': 'Способность предмета:',
  'Full Set Bonus:': 'Бонус полного сета:',
  'Piece Bonus:': 'Бонус предмета:',
  'Dungeon Bonus:': 'Бонус в данже:',
};
const PHRASES_LC = Object.fromEntries(Object.entries(PHRASES).map(([k, v]) => [k.toLowerCase().replace(/[.!]$/, ''), v]));

/** Типы в списке «Applied To» и др. */
const LIST_ITEMS = {
  Sword: 'Меч', Longsword: 'Длинный меч', Gauntlet: 'Перчатка-оружие', Bow: 'Лук', Armor: 'Броня', Helmet: 'Шлем',
  Chestplate: 'Нагрудник', Leggings: 'Поножи', Boots: 'Ботинки', 'Fishing Rod': 'Удочка', 'Farming Tool': 'Фермерский инструмент',
  Axe: 'Топор', Pickaxe: 'Кирка', Drill: 'Бур', Shovel: 'Лопата', Hoe: 'Мотыга', Shears: 'Ножницы', Gloves: 'Перчатки',
  Necklace: 'Ожерелье', Cloak: 'Плащ', Belt: 'Пояс', Bracelet: 'Браслет', Equipment: 'Экипировка', Wand: 'Посох',
  'Fishing Weapon': 'Удочка-оружие', Chisel: 'Долото', Lasso: 'Лассо', 'Hunting Tool': 'Инструмент охоты',
  // источники зачарованных книг
  Bazaar: 'Bazaar', 'Enchantment Table': 'Стол зачарований', Experiments: 'Эксперименты (Experimentation Table)',
  'Dark Auction': 'Dark Auction', Catacombs: 'Данжи (Catacombs)', Fishing: 'Рыбалка', Kuudra: 'Kuudra',
  'Turbo Gourd': 'Turbo Gourd', 'Enchanted Turbo Gourd': 'Enchanted Turbo Gourd', Scorpius: 'Scorpius (мэр)',
  "Jacob's Farming Contest": "Jacob's Farming Contest", 'Slayer': 'Слеер', 'Anvil': 'Наковальня',
  'Wishing Compass': 'Wishing Compass', 'Mineshafts': 'Glacite Mineshafts', 'Garden': 'Garden', 'Rift': 'Rift',
};

// Русская строка требования, а английская версия сайта показывает исходную строку из игры
const translateRequirement = text => both(requirementRu(text), text.trim());
function requirementRu(text) {
  // «Requires Combat Skill 24.» / «Requires Enderman Slayer 5.» / «Requires The Catacombs Floor VII Completion.»
  let m;
  const t = text.replace(/\.$/, '');
  if ((m = /^Requires (\w+) Skill (\d+)$/.exec(t))) {
    const sk = SKILL_EN[m[1]];
    if (sk) return `Требуется ${sk} ${m[2]}.`;
    if (m[1] === 'Catacombs') return `Требуется уровень Catacombs ${m[2]}.`;
  }
  if ((m = /^Requires (Zombie|Spider|Wolf|Enderman|Blaze|Vampire) Slayer (\d+)$/.exec(t))) {
    return `Требуется ${m[1]} Slayer ${m[2]}.`;
  }
  if ((m = /^Requires The Catacombs Floor ([IVX]+) Completion$/.exec(t))) return `Требуется пройти The Catacombs, Floor ${m[1]}.`;
  if ((m = /^Requires (?:The Catacombs Master Mode|Master Mode The Catacombs) Floor ([IVX]+)(?: Completion)?$/.exec(t))) return `Требуется пройти Master Mode, Floor ${m[1]}.`;
  if ((m = /^Requires Heart of the Mountain Tier (\d+)$/.exec(t))) return `Требуется Heart of the Mountain Tier ${m[1]}.`;
  if ((m = /^Requires Heart of the Forest Tier (\d+)$/.exec(t))) return `Требуется Heart of the Forest Tier ${m[1]}.`;
  if ((m = /^Requires Garden Level (\d+)$/.exec(t))) return `Требуется Garden Level ${m[1]}.`;
  if ((m = /^Requires Kuudra (\w+) Tier Completion$/.exec(t))) return `Требуется пройти Kuudra, тир ${m[1]}.`;
  if ((m = /^Requires SkyBlock Level (\d+)$/.exec(t))) return `Требуется SkyBlock Level ${m[1]}.`;
  if ((m = /^Requires level (\d+)$/.exec(t))) return `Требуется уровень ${m[1]}.`;
  if ((m = /^Requires (.+) Reputation$/.exec(t))) return `Требуется репутация: ${m[1]}.`;
  if ((m = /^Requires wearing (.+)!?$/.exec(t))) return `Нужно носить ${m[1].replace(/!$/, '')}!`;
  if ((m = /^Requires (.+)$/.exec(t))) return `Требуется: ${m[1]}.`;
  return null;
}

/**
 * Перевод одной строки лора с сохранением §-цветов там, где это возможно.
 * Совместима с translateLoreLine ядра (server/i18n/ru.js).
 * @param {string} line
 * @returns {string}
 */
export function translateLoreLine(line) {
  return translateLineInner(normalizeGlyphs(line)).text;
}

/** @returns {{text: string, ok: boolean}} ok=false, если строка осталась на английском */
function translateLineInner(line) {
  // «§ka§r SPECIAL §ka» — шифрованные символы вокруг редкости не переводим
  if (/§k/.test(line)) line = line.replace(/§k[^§]*/g, '').replace(/((?:§.)+)\s+(?=§)/g, '$1').replace(/^((?:§.)*)\s+/, '$1').replace(/\s*(?:§.)*$/, '');
  const plain = stripColor(line).trim();
  if (!plain) return { text: line, ok: true };
  if (!/[A-Za-z]/.test(plain)) return { text: line, ok: true };

  // Характеристика: «Strength: +150»
  const sm = STAT_LINE.exec(line);
  if (sm) {
    const stat = sm[2].replace(/\s/g, ' ');
    const rest = line.slice(sm[0].length);
    if (!/[A-Za-z]{3,}/.test(stripColor(rest).replace(/\{[A-Z_]+\}/g, '').replace(/\[[^\]]*\]/g, ''))) {
      // «30s» → «30 с» (перезарядки)
      return { text: `${sm[1]}${STATS[stat]}:${rest.replace(/(\d)s\b/g, '$1 с')}`, ok: true };
    }
  }
  // Последняя строка: редкость + тип
  const rm = RARITY_LINE.exec(line.trim());
  if (rm && plain === plain.toUpperCase()) {
    // редкость и тип оставляем как в игре: «LEGENDARY DUNGEON SWORD»
    return { text: line, ok: true };
  }
  // Требования
  const req = /^([❣☠✖]?\s*)(Requires .+)$/.exec(plain);
  if (req) {
    const t = translateRequirement(req[2]);
    if (t) return { text: `${(line.match(/^(?:§.)*/) || [''])[0]}§c${req[1]}${t}`, ok: true };
  }
  // Фраза целиком
  const ph = PHRASES[plain] || PHRASES_LC[plain.toLowerCase().replace(/[.!]$/, '')];
  if (ph) return { text: `${(line.match(/^\s*(?:§.)*/) || [''])[0]}${ph}`, ok: true };
  // Пункт списка: « - Sword», « - Bazaar (VI-VII)», « - Enchanting Level 20»
  let m0;
  const li = /^-\s*(.+?)(\s*\(([IVX]+(?:-[IVX]+)?)\))?$/.exec(plain);
  if (li) {
    const name = li[1];
    let m;
    if (LIST_ITEMS[name]) return { text: ` §7- §f${LIST_ITEMS[name]}${li[3] ? ` §7(§a${li[3]}§7)` : ''}`, ok: true };
    if ((m = /^(\w+) Level (\d+)$/.exec(name)) && SKILL_EN[m[1]]) return { text: ` §7- §b${SKILL_EN[m[1]]} ${m[2]}`, ok: true };
    // имя собственное (чары, предметы) остаётся на английском — это не ошибка перевода
    if (/^([A-Z][\w'’-]*\s?)+$/.test(name)) return { text: line, ok: true };
  }
  if ((m0 = /^(Minion Upgrade|Drill Part|Garden Chip|Mining Mount|Furniture Storage|Basic Brew|Booster|Rod Part)$/.exec(plain))) {
    return { text: line.replace(m0[1], { 'Minion Upgrade': 'Улучшение миньона', 'Drill Part': 'Деталь бура', 'Garden Chip': 'Чип Garden',
      'Mining Mount': 'Ездовой питомец для добычи', 'Furniture Storage': 'Мебель-хранилище', 'Basic Brew': 'Базовое зелье', Booster: 'Бустер', 'Rod Part': 'Деталь удочки' }[m0[1]]), ok: true };
  }
  // строка-список характеристик: « ❁ Strength», «+5❁ Strength»
  const sl = /^([+\-]?[\d.,%]*\s?[^\sA-Za-z]?\s?)([A-Z][A-Za-z ]+)$/.exec(plain);
  if (sl && STATS[sl[2]]) return { text: `§7${sl[1]}${STATS[sl[2]]}`, ok: true };
  // «Accessory Power: +6» уже покрыт STATS; «Gemstones: [⚔]» — тоже
  // «Level 5 -> 6 (3/10k)» и т.п. — оставляем
  if ((/^Level \d+ -> \d+/.test(plain))) return { text: line.replace('Level', 'Уровень'), ok: true };
  if (/^Breaking Power \d+$/.test(plain)) return { text: line.replace('Breaking Power', 'Сила разрушения'), ok: true };
  // «Speed multiplier: 10x», «Specialty: Blaze Rod», «Maximum Contacts: 6» (топливо Inferno, Abiphone)
  const kv = /^(Speed multiplier|Specialty amount|Specialty|Maximum Contacts|Features):/.exec(plain);
  if (kv) return { text: line.replace(kv[1], { 'Speed multiplier': 'Множитель скорости', 'Specialty amount': 'Особых предметов',
    Specialty: 'Особый предмет', 'Maximum Contacts': 'Максимум контактов', Features: 'Возможности' }[kv[1]]), ok: true };
  if (plain === 'Contacts Directory') return { text: line.replace('Contacts Directory', 'Справочник контактов'), ok: true };
  return { text: line, ok: false };
}

// ───────────── Абзацы ─────────────
// Шаблон: регулярка по тексту абзаца без цветов (строки склеены пробелом) → функция перевода.
// Дательный падеж для оборота «+10 к силе»
const DAT = {
  'Health': 'здоровью', 'Defense': 'защите', 'True Defense': 'истинной защите', 'Strength': 'силе', 'Speed': 'скорости',
  'Crit Chance': 'шансу крита', 'Crit Damage': 'крит. урону', 'Intelligence': 'интеллекту', 'Ferocity': 'свирепости',
  'Damage': 'урону', 'Health Regen': 'регенерации здоровья', 'Vitality': 'живучести', 'Mending': 'лечению',
  'Attack Speed': 'скорости атаки', 'Bonus Attack Speed': 'скорости атаки', 'Ability Damage': 'урону способностей',
  'Mining Speed': 'скорости добычи', 'Mining Fortune': 'удаче добычи', 'Farming Fortune': 'фермерской удаче',
  'Foraging Fortune': 'удаче лесорубства', 'Fishing Speed': 'скорости рыбалки', 'Sea Creature Chance': 'шансу морского существа',
  'Pet Luck': 'удаче питомцев', 'Swing Range': 'дальности удара', 'Pristine': 'Pristine', 'Magic Find': 'Magic Find',
  'Trophy Fish Chance': 'шансу трофейной рыбы', 'Treasure Chance': 'шансу сокровища', 'Gemstone Fortune': 'удаче на самоцветы',
};
// статы как в игре: «Даёт +5❁ Strength»
const kStat = st => STATS[st] || st;
const TRIGGERS = { 'RIGHT CLICK': 'ПКМ', 'LEFT CLICK': 'ЛКМ', SNEAK: 'присесть', 'SNEAK RIGHT CLICK': 'Shift+ПКМ', 'DOUBLE RIGHT CLICK': 'двойной ПКМ' };
// названия бонусов — как в игре
const BONUS = { 'Full Set Bonus': 'Full Set Bonus', 'Tiered Bonus': 'Tiered Bonus', 'Piece Bonus': 'Piece Bonus',
  'Dungeon Bonus': 'Dungeon Bonus', 'Unique Bonus': 'Unique Bonus' };
/** @type {[RegExp, (m: RegExpExecArray) => string][]} */
// «+0.1Ⓢ Swing Range and +1⫽ Ferocity» → «+0.1Ⓢ дальность удара и +1⫽ свирепость»
const statsRu = list => list.split(/ and |, /).map(x => {
  const m = /^([+-]?[\d.,]+%?\S?)\s+(.+)$/.exec(x.trim());
  return m && STATS[m[2]] ? `${m[1]} ${STATS[m[2]]}` : x.trim();
}).join(' и ');

const PARAGRAPHS = [
  // Заряды брони Kuudra (Crimson / Aurora / Terror / Hollow / Fervor) и Wither
  [/^Every ([\d.]+)s, (melee attacks|arrow attacks|attacking a mob|dealing Magic Damage from an ability|up to (\d+) nearby player's attacks) grants? (\d+) stack of ([^.]+?)\.$/, m => {
    const who = { 'melee attacks': 'удары ближнего боя дают', 'arrow attacks': 'попадания стрелами дают', 'attacking a mob': 'атака по мобу даёт',
      'dealing Magic Damage from an ability': 'магический урон способностью даёт' }[m[2]] || `атаки до ${m[3]} игроков рядом дают`;
    return `Каждые ${m[1]}\u00a0с ${who} ${m[4]} заряд ${m[5]}.`;
  }],
  [/^Each stack grants ((?:[^.]|\.(?=\d))+?)\.$/, m => `Каждый заряд даёт ${statsRu(m[1])}.`],
  [/^At (\d+) stacks swipe in a random direction dealing ([\d.]+x) Swipe Damage to mobs in its path\.$/,
    m => `На ${m[1]} зарядах — взмах в случайную сторону, ${m[2]} урона взмахом (Swipe) мобам на пути.`],
  [/^At (\d+) stacks shoot \+(\d+) arrows that deal (\d+)% Arrow Damage\.$/, m => `На ${m[1]} зарядах выпускает ещё ${m[2]} стрелы с ${m[3]}% урона стрелы.`],
  [/^At (\d+) stacks, sneak to reset your stacks and shoot (\d+) homing missiles dealing ([\d,]+) Damage each\.$/,
    m => `На ${m[1]} зарядах присядьте: заряды сбросятся, и вылетят ${m[2]} самонаводящиеся ракеты по ${m[3]} урона.`],
  [/^At (\d+) stacks, sneak to reset your stacks and perform (\d+) Ground Pounds dealing damage to mobs within (\d+) blocks\.$/,
    m => `На ${m[1]} зарядах присядьте: заряды сбросятся, и вы ${m[2]} раза ударите о землю, нанося урон мобам в радиусе ${m[3]} блоков.`],
  [/^\(Damage scales with your EHP, max ([\d.]+\w?)\)\.?$/, m => `(Урон растёт с вашим EHP, максимум ${m[1]}.)`],
  [/^Stacks can be used with a Hollow Wand to cast spells\.$/, () => 'Заряды тратятся Hollow Wand на заклинания.'],
  [/^Attacking a mob has a (\d+)% chance to direct aggro from (\d+) mobs to you\.$/, m => `Атака по мобу с шансом ${m[1]}% переводит на вас агр ${m[2]} мобов.`],
  [/^Spawns a wither minion every (\d+) seconds up to a maximum (\d+) withers?\.$/, m => `Призывает визера-миньона каждые ${m[1]} с, не больше ${m[2]} одновременно.`],
  [/^Your withers will travel to and explode on nearby enemies\.$/, () => 'Ваши визеры летят к ближайшим врагам и взрываются.'],
  // Кролики Chocolate Factory, Abiphone, топливо Inferno, Mixins, зелья
  [/^This is an? (.+?) Rabbit!$/, m => `Это кролик: ${m[1]}!`],
  [/^Grants \+([\d,.]+) Chocolate and ([\d.]+x) Chocolate per second to your Chocolate Factory\.$/,
    m => `Даёт +${m[1]} шоколада и ${m[2]} шоколада в секунду вашей Chocolate Factory.`],
  [/^A device that can be used to contact people! Click NPCs to add them to your contacts!$/,
    () => 'Устройство для звонков! Нажимайте на NPC, чтобы добавить их в контакты!'],
  [/^Can be used as minion fuel exclusively in the Inferno minion for (\d+) hours!$/, m => `Топливо только для миньона Inferno, на ${m[1]}\u00a0ч!`],
  [/^Replaces (\d+\/\d+) of the regular minion production with a specialty item\.$/, m => `Заменяет ${m[1]} обычной добычи миньона особым предметом.`],
  [/^Mixins provide a buff that can be added to God Potions in a brewing stand and lasts for the full duration\.$/,
    () => 'Mixins дают бафф: добавляются к God Potion в варочной стойке и действуют всё время зелья.'],
  [/^Use this item in place of an Awkward Potion for certain potions\.$/, () => 'Используется вместо Awkward Potion в некоторых зельях.'],
  // Данжевое снаряжение (способности)
  [/^On teleport, gain invisibility and \+(\d+)(\S?) Speed for (\d+) seconds\.$/, m => `При телепорте — невидимость и +${m[1]}${m[2]} скорости на ${m[3]}\u00a0с.`],
  [/^Grants \+(\d+)(\S?) Strength for every mob you kill in The Catacombs\.$/, m => `+${m[1]}${m[2]} силы за каждого убитого моба в Catacombs.`],
  [/^\(Strength resets after each run\)$/, () => '(Сила сбрасывается после каждого забега)'],
  [/^Reduces the defense of your target by (\d+)% of their max (\S?) ?Defense on hit, stacking up to (\d+) times\.$/,
    m => `Каждое попадание снижает защиту цели на ${m[1]}% от её максимальной ${m[2]} защиты, до ${m[3]} раз.`],
  [/^Shoots balloons that create a large explosion on impact, dealing up to ([\d,]+) damage\.$/, m => `Стреляет шарами, которые взрываются при попадании и наносят до ${m[1]} урона.`],
  [/^Instead of dying, gain \+(\d+)(\S?) Speed and damage immunity for (\d+) seconds\.$/, m => `Вместо смерти — +${m[1]}${m[2]} скорости и неуязвимость на ${m[3]}\u00a0с.`],
  [/^Shoots a guided spirit bat, following your aim and exploding for ([\d,]+) damage\.$/, m => `Выпускает летучую мышь-духа, она летит по прицелу и взрывается на ${m[1]} урона.`],
  [/^Begin a channel\.$/, () => 'Начните концентрацию.'],
  [/^After not taking damage for (\d+)s, gain ([\d.]+x) this weapon's (\S?) ?Strength for (\d+)s\.$/,
    m => `Если ${m[1]}\u00a0с не получать урон — ${m[2]} ${m[3]} силы этого оружия на ${m[4]}\u00a0с.`],
  [/^Shoots (\d+) Ice Bolts? that deals? ([\d,]+) damage and slows enemies hit for (\d+) seconds!$/,
    m => `Выпускает ${m[1]} ледяной заряд (Ice Bolt): ${m[2]} урона и замедление врагов на ${m[3]}\u00a0с!`],
  [/^Throw the bone a short distance, dealing the damage an arrow would\.$/, () => 'Бросает кость недалеко, она наносит урон как стрела.'],
  [/^Deals double damage when coming back\.$/, () => 'На обратном пути наносит двойной урон.'],
  [/^Pierces up to (\d+) foes\.$/, m => `Пробивает до ${m[1]} врагов.`],
  [/^Deals (\d+)x damage to Sea Creatures\.$/, m => `Наносит ${m[1]}x урона морским существам.`],
  [/^Flay your whip in an arc, dealing your melee damage to all enemies in its path\.$/, () => 'Удар кнутом по дуге: урон ближнего боя всем врагам на пути.'],
  [/^Shoots a rose that ricochets between enemies, damaging up to (\d+) of your foes!$/, m => `Выпускает розу, которая отскакивает между врагами и ранит до ${m[1]} из них!`],
  [/^Damage multiplies as more enemies are hit\.$/, () => 'Урон растёт с каждым поражённым врагом.'],
  [/^Allows you to teleport to any teammate!$/, () => 'Телепорт к любому союзнику!'],
  [/^Grants (\d+) seconds? of immunity after teleporting, immunity is cancelled upon dealing damage\.$/,
    m => `После телепорта ${m[1]}\u00a0с неуязвимости; она пропадает, если нанести урон.`],
  [/^Dungeons only!$/, () => 'Только в данжах!'],
  [/^Allows you to reroll a Dungeon or Kuudra reward chest\.$/, () => 'Позволяет перекрутить наградный сундук данжа или Kuudra.'],
  [/^Keep this feather in your inventory or Dungeon Sack and open a reward chest to use\.$/,
    () => 'Держите перо в инвентаре или в Dungeon Sack и откройте наградный сундук.'],
  [/^You may only reroll (\d+) reward chests? per run!$/, m => `За забег можно перекрутить только ${m[1]} сундук!`],
  // Рыбалка: Magma Lord, Angler, Abyssal; Campfire-аксессуары
  [/^Damage taken from Lava Sea Creatures is reduced by (\d+)% and damage dealt is increased by ([\d.]+x)\.$/,
    m => `Урон от лавовых морских существ снижен на ${m[1]}%, а урон по ним увеличен в ${m[2]}.`],
  [/^Reduces the damage taken from Sea Creatures by (\d+)%\.$/, m => `Снижает урон от морских существ на ${m[1]}%.`],
  [/^Grants \+(\d+)(\S?) Treasure Chance while underwater\.$/, m => `+${m[1]}${m[2]} шанса сокровища под водой.`],
  [/^Grants the ability to breathe permanently while underwater\.$/, () => 'Можно дышать под водой без ограничений.'],
  [/^Trial of (Fire|Blue Flames) (\d+)$/, m => `Испытание ${m[1] === 'Fire' ? 'огнём' : 'синим пламенем'} ${m[2]}`],
  // Детали бура (Drill Mechanic)
  [/^(Fuel Tank|Drill Engine|Upgrade Module): Not Installed$/, m => `${{ 'Fuel Tank': 'Топливный бак', 'Drill Engine': 'Двигатель бура', 'Upgrade Module': 'Модуль улучшения' }[m[1]]}: не установлен`],
  [/^Increases fuel capacity with part installed\.$/, () => 'С деталью увеличивается запас топлива.'],
  [/^Increases (\S+) Mining Speed with part installed\.$/, m => `С деталью растёт ${m[1]} скорость добычи.`],
  [/^Applies a passive upgrade with part installed\.$/, () => 'С деталью даёт пассивное улучшение.'],
  [/^Slam your sword into the ground dealing ([\d,]+) damage to nearby enemies\.$/, m => `Бьёт мечом о землю и наносит ${m[1]} урона врагам рядом.`],
  // Booster Cookie (каждый пункт «‣» — отдельный абзац)
  [/^Consume to gain the Cookie Buff for (\d+) days:$/, m => `Съешьте, чтобы получить Cookie Buff на ${m[1]}\u00a0дн.:`],
  [/^‣ Ability to gain Bits!$/, () => '‣ Начисляются Bits!'],
  [/^‣ \+(\d+)(\S?) on all Wisdom stats$/, m => `‣ +${m[1]}${m[2]} ко всей мудрости (Wisdom)`],
  [/^‣ \+(\d+)(\S?) Magic Find$/, m => `‣ +${m[1]}${m[2]} Magic Find`],
  [/^‣ Keep coins on death$/, () => '‣ Монеты не теряются при смерти'],
  [/^‣ Permafly on private islands and gardens$/, () => '‣ Полёт на своём острове и в Саду'],
  [/^‣ Quick access to some menus using their respective commands: (.+)$/, m => `‣ Быстрый доступ к меню командами: ${m[1].replace(/, and /, ', ')}`],
  [/^‣ Sell items directly to the trades and cookie menu$/, () => '‣ Продажа предметов прямо из меню торговли и печенья'],
  [/^‣ AFK immunity on your island and garden$/, () => '‣ Не выкидывает за AFK на острове и в Саду'],
  [/^‣ Toggle specific potion effects$/, () => '‣ Можно отключать отдельные эффекты зелий'],
  [/^‣ Link your items in chat using \/show$/, () => '‣ Показ предметов в чате командой /show'],
  [/^‣ Insta-sell your Material stash to the Bazaar$/, () => '‣ Мгновенная продажа Material stash на Bazaar'],
  [/^‣ Increases Chocolate Factory production by \+([\d.]+)x$/, m => `‣ Производство Chocolate Factory +${m[1]}x`],
  [/^‣ Allows consuming Mixins directly from your inventory$/, () => '‣ Mixins можно употреблять прямо из инвентаря'],
  [/^‣ Call Abiphone Contacts with \/call$/, () => '‣ Звонки контактам Abiphone командой /call'],
  // Terminator и другие шортбоу
  [/^Shoots (\d+) arrows at once\.$/, m => `Стреляет ${m[1]} стрелами сразу.`],
  [/^Divides your (\S+) Crit Chance by (\d+)!$/, m => `Делит ваш ${m[1]} шанс крита на ${m[2]}!`],
  [/^Can be cast after landing (\d+) hits\.$/, m => `Срабатывает после ${m[1]} попаданий.`],
  [/^Shoot a beam, penetrating up to (\d+) enemies\.$/, m => `Выпускает луч, пробивающий до ${m[1]} врагов.`],
  [/^The beam always crits\.$/, () => 'Луч всегда критует.'],
  // God Potion и Mixins
  [/^Consume this potion to receive an assortment of positive potion effects!$/, () => 'Выпейте, чтобы получить набор положительных эффектов!'],
  [/^The duration of God Potions can be stacked!$/, () => 'Длительность God Potion суммируется!'],
  [/^The duration of Mixins can be stacked!$/, () => 'Длительность Mixins суммируется!'],
  [/^Place this minion and it will start generating and (?:mining|chopping|farming|killing|fishing|harvesting|collecting)? ?(.+?)! (?:Requires (.+?)\. )?Minions also work when you are offline!$/i,
    m => `Поставьте этого миньона, и он начнёт добывать ${m[1]}!${m[2] ? ` Нужно: ${m[2]}.` : ''} Миньоны работают, даже когда вы не в сети!`],
  [/^Place this minion and it will start (.+)$/i, () => 'Поставьте этого миньона, и он начнёт работать. Миньоны работают, даже когда вы не в сети!'],
  [/^Pet skins change the look and particle trail of your pet but only one skin can be active at a time!$/,
    () => 'Скины питомцев меняют облик и след частиц питомца, но одновременно может быть активен только один скин!'],
  [/^This skin can only be applied to (.+?)\.?$/, m => `Этот скин можно применить только к: ${m[1]}.`],
  [/^Right-click on your summoned pet to apply this skin!$/, () => 'ПКМ по призванному питомцу, чтобы применить скин!'],
  [/^Right-click on your summoned pet to give it this item!$/, () => 'ПКМ по призванному питомцу, чтобы отдать ему этот предмет!'],
  [/^Item skins give your gear a fresh new look! Apply them just like an enchant book using the anvil\.?$/,
    () => 'Скины предметов меняют внешний вид снаряжения! Применяются как зачарованная книга, через наковальню.'],
  [/^You can Syphon this shard from your Hunting Box\.?$/, () => 'Этот осколок можно извлечь (Syphon) из Hunting Box.'],
  [/^You can only have (\d+) Ultimate Enchantment on an item!$/, m => `На предмете может быть только ${m[1]} Ultimate-зачарование!`],
  [/^Pet Items can boost pets in many powerful ways! A pet can only hold one Pet Item, but you can swap it at any time!$/,
    () => 'Предметы для питомцев сильно усиливают питомцев! Питомец держит только один такой предмет, но его можно поменять в любой момент.'],
  [/^Grants the following stats that scale with the item's rarity:((?: .? ?[A-Z][A-Za-z ]+?)*)$/, m => {
    const list = (m[1] || '').trim();
    const tr = list ? list.split(/\s(?=\S\s[A-Z])/).map(x => { const mm = /^(\S)\s(.+)$/.exec(x.trim()); return mm && STATS[mm[2]] ? `${mm[1]} ${STATS[mm[2]]}` : (STATS[x.trim()] || x.trim()); }).join(', ') : '';
    return `Даёт характеристики, растущие с редкостью предмета${tr ? `: ${tr}` : ':'}`;
  }],
  [/^Requires an open area to place (.+?)\. Minions also work when you are offline!$/, m => `Нужна открытая площадка, чтобы ставить ${m[1]}. Миньоны работают, даже когда вы не в сети!`],
  [/^Minions also work when you are offline!$/, () => 'Миньоны работают, даже когда вы не в сети!'],
  [/^Capacity: ([\d,]+) of each item$/, m => `Вместимость: ${m[1]} каждого предмета`],
  [/^This exclusive (\w+) cosmetic can be placed on your island or traded\.?$/,
    m => `Эту эксклюзивную косметику (${({ Holiday: 'праздничную', Halloween: 'хэллоуинскую', Summer: 'летнюю', Easter: 'пасхальную' })[m[1]] || m[1]}) можно поставить на остров или обменять.`],
  [/^Changes the color of an armor piece to (.+?)\.?$/, m => `Меняет цвет предмета брони на ${m[1]}.`],
  [/^Animates the color of an armor piece(.*)$/, () => 'Анимирует цвет предмета брони.'],
  [/^Consume this item to add its destination to your Fast Travel options\.?$/, () => 'Используйте этот предмет, чтобы добавить точку назначения в быстрое перемещение (Fast Travel).'],
  [/^Holds various items obtained from (.+?)\.?$/, m => `Хранит разные предметы, получаемые из: ${m[1]}.`],
  [/^Obtained very rarely from slaying (.+?)\.?$/, m => `Очень редко выпадает при убийстве: ${m[1]}.`],
  [/^Dug up from Griffin Burrows in the Hub\.?$/, () => 'Выкапывается из Griffin Burrows в Хабе (событие Diana).'],
  [/^Found in the endless maze of the Catacombs\.?$/, () => 'Находится в бесконечном лабиринте Catacombs.'],
  [/^Placing this item on your private island (.+)$/, () => 'Поставьте этот предмет на личный остров.'],
  [/^The portal will spawn facing you on the block you click on\.?$/, () => 'Портал появится лицом к вам на блоке, по которому вы кликнули.'],
  [/^Combine x(\d+) of this item at the Thaumaturgist in the Hub to unlock the (.+?) Power\.?$/, m => `Объедините ${m[1]} шт. у Thaumaturgist в Хабе, чтобы открыть силу ${m[2]}.`],
  [/^This item is Undead( .)?!?$/, () => 'Этот предмет — нежить!'],
  [/^Increases damage dealt by ([\d.]+)%\.?$/, m => `Увеличивает наносимый урон на ${m[1]}%.`],
  [/^Deals \+?([\d.]+)% damage to (\w+) mobs\.?$/, m => `Наносит +${m[1]}% урона мобам типа ${MOB_TYPES[m[2]] || m[2]}.`],
  [/^Increases the damage you deal to (.+?) by ([\d.]+)%\.?$/, m => `Увеличивает урон по ${m[1]} на ${m[2]}%.`],
  [/^Grants \+?([\d.]+). (Strength|Health|Defense|Intelligence|Speed|Crit Chance|Crit Damage|Magic Find|Ferocity)\.?$/,
    m => `Даёт +${m[1]} ${kStat(m[2])}.`],
  [/^Reduces the damage you take from (.+?) by ([\d.]+)%\.?$/, m => `Снижает урон от ${m[1]} на ${m[2]}%.`],
  [/^Shortbow: Instantly shoots!$/, () => 'Шортбоу: стреляет мгновенно!'],
  [/^Hits (\d+) mobs on impact\.?$/, m => `Поражает ${m[1]} мобов при попадании.`],
  [/^Can damage endermen\.?$/, () => 'Может ранить эндерменов.'],
  [/^Bring this to Odger at the top of the Blazing Volcano\.?$/, () => 'Отнесите это Odger на вершину Blazing Volcano.'],
  [/^Some say that when harnessed properly, it can give its owner extra (.+?)\.?$/, m => `Говорят, если правильно им воспользоваться, оно даёт владельцу дополнительную ${m[1]}.`],
  [/^Apply this rune to (.+?) or fuse two together at the Runic Pedestal!$/, m => `Наложите руну на: ${m[1]} — или объедините две на Runic Pedestal!`],
  [/^Consume this item to unlock the (.+?)\.?$/, m => `Используйте предмет, чтобы открыть ${m[1]}.`],
  // ── отдельные предложения ──
  [/^Applies the (.+?) reforge when combined with (?:an? )?(.+?)\.?$/, m => `Даёт перековку ${m[1]} при объединении с предметом: ${LIST_ITEMS[m[2]] || m[2]}.`],
  [/^Grants \+?([\d.]+) ?(.)? ?(\w[\w ]*?) per (Catacombs|Combat|Mining|Farming|Fishing|Foraging|Enchanting|Taming) (?:skill )?level(?: you have)?\.?$/,
    m => (STATS[m[3]] ? `Даёт +${m[1]}${m[2] || ''} ${kStat(m[3])} за каждый уровень ${m[4] === 'Catacombs' ? 'Catacombs' : SKILL_EN[m[4]]}.` : null)],
  [/^Grants \+?([\d.]+) ?(.)? ?(\w[\w ]*?) and \+?([\d.]+) ?(.)? ?(\w[\w ]*?) per (Catacombs|Combat|Mining|Farming|Fishing|Foraging) (?:skill )?level(?: you have)?\.?$/,
    m => (STATS[m[3]] && STATS[m[6]] ? `Даёт +${m[1]}${m[2] || ''} ${kStat(m[3])} и +${m[4]}${m[5] || ''} ${kStat(m[6])} за каждый уровень ${m[7] === 'Catacombs' ? 'Catacombs' : SKILL_EN[m[7]]}.` : null)],
  [/^Teleport (\d+) blocks ahead of you and gain \+?(\d+) ?.? ?Speed for (\d+) seconds\.?$/, m => `Телепортирует на ${m[1]} блоков вперёд и даёт +${m[2]} ✦ скорости на ${m[3]} с.`],
  [/^Teleport (\d+) blocks ahead of you\.?$/, m => `Телепортирует на ${m[1]} блоков вперёд.`],
  [/^(\w+) Bonus$/, m => `Бонус ${m[1]}`],
  [/^Lose (\d+) stacks? after ([\d.]+)s of not gaining a stack\.?$/, m => `Теряется ${m[1]} ${m[1] === '1' ? 'заряд' : 'заряда'}, если ${m[2]}\u00a0с не получать новых.`],
  [/^\(Max (\d+) Stacks\)\.? Lose (\d+) after ([\d.]+)s of not gaining a stack\.?$/, m => `(Макс. ${m[1]} зарядов) Теряется ${m[2]}, если ${m[3]}\u00a0с не получать новых.`],
  [/^Pet Items can boost pets in many powerful ways!$/, () => 'Предметы для питомцев сильно усиливают питомцев!'],
  [/^A pet can only hold one Pet Item, but you can swap it at any time!$/, () => 'Питомец держит только один такой предмет, но его можно поменять в любой момент!'],
  [/^Ability: (.+?)\s+(RIGHT CLICK|LEFT CLICK|SNEAK RIGHT CLICK|SNEAK|DOUBLE RIGHT CLICK)$/, m => `Способность: ${m[1]} (${TRIGGERS[m[2]]})`],
  [/^Ability: ([^.!]+?)!?$/, m => `Способность: ${m[1]}`],
  [/^(Full Set Bonus|Tiered Bonus|Piece Bonus|Dungeon Bonus|Unique Bonus): (.+?)( \(\d+\/\d+\))?$/, m => `${BONUS[m[1]]}: ${m[2]}${m[3] || ''}`],
  [/^Max Bonus: (.+)$/, m => `Макс. бонус: ${m[1]}`],
  [/^Obtained: (.+)$/, m => `Получено: ${m[1]}`],
  [/^Obtained in Year (\d+)\.?$/, m => `Получено в ${m[1]}-м году SkyBlock.`],
  [/^Obtained from Fire Sales\.?$/, () => 'Продавалось на Fire Sale.'],
  [/^Drop Chance: (.+)$/, m => `Шанс выпадения: ${m[1]}`],
  [/^Mob Types: None!?$/i, () => 'Тип моба: нет'],
  [/^Mob Types:\s+(.+)$/i, m => `Тип моба: ${m[1].trim().split(/[,.]?\s+(?=\S\s|\S?[A-Z])/).map(x => x.replace(/^\W+\s*/, '').replace(/\W+$/, '')).filter(Boolean).map(x => MOB_TYPES[x] || x).join(', ')}`],
  [/^This item will vanish from your inventory after leaving the Critter Safari!$/, () => 'Предмет исчезнет из инвентаря, когда вы покинете Critter Safari!'],
  [/^Decorate your island with this eco-friendly lamp!$/, () => 'Украсьте остров этой экологичной лампой!'],
  [/^This skin adapts to the day-night cycle!$/, () => 'Скин меняется вместе со сменой дня и ночи!'],
  [/^You can store (one|two|three|four|five|six) pages? of items in this chest!$/, m => `В этом сундуке помещается страниц: ${{ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[m[1]]}.`],
  [/^This rod is broken and cannot be used to fish\.$/, () => 'Удочка сломана, рыбачить ей нельзя.'],
  [/^Each Inferno minion increases the speed of ALL Inferno minions by ([\d.]+%), up to ([\d.]+%)\.$/, m => `Каждый миньон Inferno ускоряет ВСЕХ миньонов Inferno на ${m[1]}, максимум ${m[2]}.`],
  [/^Mob Type: (.+)$/i, m => `Тип моба: ${m[1].split(/,\s*/).map(x => MOB_TYPES[x.replace(/^\W+\s*/, '')] || x).join(', ')}`],
  [/^Duration: (.+)$/, m => `Длительность: ${m[1].replace(/(\d+)h/g, '$1 ч').replace(/(\d+)m\b/g, '$1 мин').replace(/(\d+)s\b/g, '$1 с')}`],
  [/^Selected Radius: (.+)$/, m => `Выбранный радиус: ${m[1]}`],
  [/^Items you pick ?up go directly into your sacks\.?$/, () => 'Подобранные предметы сразу попадают в мешки.'],
  [/^You can place this item in any minion of your choice!$/, () => 'Этот предмет можно поставить в любого миньона!'],
  [/^Bring this to (.+?) on the (.+?)\.?$/, m => `Отнесите это NPC ${m[1]} (${m[2]}).`],
  [/^Bring it to (.+?) in (?:the )?(.+?)\.?$/, m => `Отнесите это NPC ${m[1]} (${m[2]}).`],
  [/^Bring to (.+?) in the Hub to craft it into Stews!$/, m => `Отнесите NPC ${m[1]} в Хаб, чтобы сварить рагу!`],
  [/^Complete Visitor (.+?)'s quest to Analyze this crop!$/, m => `Выполните задание посетителя ${m[1]}, чтобы изучить эту культуру!`],
  [/^This skin can be applied to (.+?)\.?$/, m => `Этот скин можно применить к: ${m[1]}.`],
  [/^This item is (\w+) ?!$/, m => `Тип предмета: ${MOB_TYPES[m[1]] || m[1]}.`],
  [/^Gain \+?([\d.]+)(.)? (Health Regen|Defense|Strength|Speed|Intelligence|Health|Crit Damage|Crit Chance|Ferocity) while burning\.?$/, m => `Даёт +${m[1]}${m[2] || ''} ${kStat(m[3])}, пока вы горите.`],
  [/^Grants \+?([\d.]+)(.)? (Health Regen|Defense|Strength|Speed|Intelligence|Health|Crit Damage|Crit Chance|Ferocity) while burning\.?$/, m => `Даёт +${m[1]}${m[2] || ''} ${kStat(m[3])}, пока вы горите.`],
  [/^Grants \+?([\d.]+)(.)? ([A-Z][A-Za-z ]+?)\.?$/, m => (STATS[m[3]] ? `Даёт +${m[1]}${m[2] || ''} ${kStat(m[3])}.` : null)],
  [/^Grants ([\d.]+)(.)? ([A-Z][A-Za-z ]+?)\.?$/, m => (STATS[m[3]] ? `Даёт ${m[1]}${m[2] || ''} ${kStat(m[3])}.` : null)],
  [/^Increases the speed of your minion by ([\d.]+)%\.?$/, m => `Ускоряет миньона на ${m[1]}%.`],
  [/^Can be applied once\.?$/, () => 'Применяется один раз.'],
  [/^This pet's perks are active even when the pet is not summoned!$/, () => 'Перки этого питомца работают, даже когда он не призван!'],
  [/^Apply this rune to (boots|chestplates|helmets|leggings|weapons|bows|swords|armor|fishing rods|pickaxes) at the Runic Pedestal!$/,
    m => `Наложите руну на ${({ boots: 'ботинки', chestplates: 'нагрудники', helmets: 'шлемы', leggings: 'поножи', weapons: 'оружие', bows: 'луки', swords: 'мечи', armor: 'броню', 'fishing rods': 'удочки', pickaxes: 'кирки' })[m[1]]} на Runic Pedestal!`],
  [/^This is an? (City|Beach|Country|Mountain|Forest) Faction Rabbit!$/, m => `Это кролик фракции ${m[1]}!`],
  [/^Furniture can be placed on your world\.?$/, () => 'Мебель можно ставить на своём острове.'],
  [/^Some furniture is interactable while some are purely cosmetic\.?$/, () => 'С частью мебели можно взаимодействовать, остальная чисто декоративная.'],
  [/^Only ONE enrichment can be applied to a given accessory\.?$/, () => 'На один аксессуар можно наложить только ОДНО обогащение (enrichment).'],
  [/^Grants additional bonuses based on your selected dungeon class!$/, () => 'Даёт дополнительные бонусы в зависимости от выбранного класса в данже!'],
  [/^Only one deployable buff applies\.?$/, () => 'Действует только один бафф от размещаемых предметов.'],
  [/^Stats added when shot!$/, () => 'Характеристики добавляются при выстреле!'],
  [/^\(Requires active Booster Cookie\)$/, () => '(Нужен активный Booster Cookie)'],
  [/^\((\d+)s Cooldown\)\.?$/, m => `(Перезарядка ${m[1]} с)`],
  [/^Increase the damage you deal with arrows by ([\d.]+)%\.?$/, m => `Увеличивает урон стрелами на ${m[1]}%.`],
  [/^Increases the damage you deal with arrows by ([\d.]+)%\.?$/, m => `Увеличивает урон стрелами на ${m[1]}%.`],
  [/^This item can be used as a minion upgrade\.?$/, () => 'Можно поставить в миньона как улучшение.'],
  [/^Right-click to (?:use|configure)!$/, () => 'ПКМ — использовать!'],
  [/^Right-Click to redeem!$/i, () => 'ПКМ — активировать!'],
  [/^Shift Right-Click to redeem all!$/i, () => 'Shift+ПКМ — активировать все!'],
  [/^Apply Drill Parts to this Drill by talking to a Drill Mechanic!$/, () => 'Детали ставятся на бур у NPC Drill Mechanic!'],
  [/^Talk to Roddy in the Backwater Bayou to apply parts to this rod\.?$/, () => 'Детали ставятся на удочку у NPC Roddy (Backwater Bayou).'],
  [/^All stats of this armor piece are doubled while on Jerry's Workshop!$/, () => "Все характеристики этого предмета брони удваиваются в Jerry's Workshop!"],
  [/^Caught everywhere\.?$/, () => 'Ловится везде.'],
  [/^Found infesting The Garden\.?$/, () => 'Встречается в Garden.'],
  [/^Each stack grants \+?([\d.]+)% Damage and \+?([\d.]+)% Arrow Speed\.?$/, m => `Каждый заряд даёт +${m[1]}% урона и +${m[2]}% скорости стрел.`],
  [/^Redeem Chips to increase their rarity!$/, () => 'Активируйте чипы, чтобы повысить их редкость!'],
];

/** Перевод абзаца: сначала целиком, затем по предложениям (все должны найтись) */
export function translateParagraph(text) {
  const r = translateParagraphPartial(text);
  return r && r.unknown === 0 ? r.text : null;
}

/** Перевод абзаца по предложениям; незнакомые предложения остаются на английском. */
export function translateParagraphPartial(text) {
  const apply = t => { const d = dictLookup(t); if (d) return d; for (const [re, fn] of PARAGRAPHS) { const m = re.exec(t); if (m) { const r = fn(m); if (r) return r; } } return null; };
  const whole = apply(text);
  if (whole) return { text: whole, unknown: 0, known: 1 };
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z+(])/);
  const out = [];
  let unknown = 0, known = 0;
  for (const sn of sentences) {
    const hit = apply(sn);
    if (hit) { out.push(hit); known++; continue; }
    const ln = translateLineInner(sn);
    if (ln.ok) { out.push(stripColor(ln.text)); known++; } else { out.push(sn); unknown++; }
  }
  return { text: out.join(' '), unknown, known };
}

// ── Цвета в переведённом абзаце ──────────────────────────────────────────────
// Перевод абзаца идёт по тексту без цветов, а потом цвета возвращаются: числа получают цвет
// того же числа в оригинале, значки характеристик (❁ ❤ ☣ …) — цвет значка вместе со словом-двумя
// после него. Остальной текст — основной цвет абзаца (обычно серый §7).
const NUM_RU = /(?<![\wА-Яа-яЁё.])[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:[.,]\d+)?/g;
const isGlyph = ch => GLYPHS.has(ch) || /[\p{So}\u2E00-\u2E7F]/u.test(ch);
const GLYPHS = new Set([...Object.values(STAT_GLYPHS), '☠', '❤', '❈', '❁', '☣', '✦', '✎', '⫽', '♣', '✯', '☘', '⸕', '❣', '☂', '⚔', '๑', 'α', '♨', '❄', 'ൠ', '❂', '⚓', '❍', '✧', 'ф', '☄', 'ᝐ', '♔']);
// слова, которые могут идти после первого слова характеристики: «Шанс крита», «Шанса морского существа», «Времени в Rift»
const STAT_TAIL = new Set(['крита', 'урон', 'урона', 'атаки', 'способностей', 'рыбалки', 'добычи', 'боя', 'маны', 'здоровья', 'защита', 'защиты',
  'морского', 'существа', 'существ', 'питомцев', 'удача', 'удачи', 'в', 'rift', 'фермерства', 'лесорубства', 'зачарования', 'алхимии',
  'приручения', 'охоты', 'трофея', 'сокровища', 'улова', 'двойного', 'вредителей', 'самоцветов', 'разрушения', 'find', 'добычи', 'аксессуара',
  'аксессуаров', 'на', 'руду', 'блоки', 'самоцветы', 'выстрела', 'удара', 'общения', 'плотничества', 'ремесла', 'рунического', 'скорости', 'трофейной', 'рыбы']);
const STOP = new Set(['и', 'или', 'к', 'в', 'на', 'за', 'от', 'до', 'при', 'для', 'по', 'с', 'со', 'у', 'из', 'против']);

function walkColors(lines) {
  const plain = [];
  const fmts = [];
  let base = '';
  const lead = /^(?:§[0-9a-fk-or])+/i.exec(lines[0] || '');
  if (lead) base = lead[0].replace(/^.*§r/i, '');
  // основной цвет — последний цветовой код ведущей серии (форматирование после него сохраняем)
  const bm = /§[0-9a-f](?:§[k-o])*$/i.exec(base);
  base = bm ? bm[0] : (base || '§7');
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li];
    let fmt = base;
    if (li > 0) { plain.push(' '); fmts.push(fmt); }
    for (let i = 0; i < l.length; i++) {
      if (l[i] === '§' && i + 1 < l.length) {
        const c = l[i + 1].toLowerCase();
        if (/[0-9a-f]/.test(c)) fmt = '§' + c; else if (c === 'r') fmt = base; else if (/[k-o]/.test(c)) fmt += '§' + c;
        i++;
        continue;
      }
      plain.push(l[i]); fmts.push(fmt);
    }
  }
  return { plain: plain.join(''), fmts, base };
}

/** Русский текст абзаца → строки с §-цветами, взятыми из исходных строк */
export function recolorWrap(ru, srcLines, width = 42) {
  const { plain, fmts, base } = walkColors(srcLines.map(normalizeGlyphs));
  const numFmt = new Map();
  for (const m of plain.matchAll(NUM_RU)) {
    const f = fmts[m.index + (/[+-]/.test(m[0][0]) ? 1 : 0)];
    const key = m[0].replace(/^\+/, '');
    if (f && f !== base && !numFmt.has(key)) numFmt.set(key, f);
  }
  const glyphFmt = new Map();
  for (let i = 0; i < plain.length; i++) if (isGlyph(plain[i]) && fmts[i] !== base && !glyphFmt.has(plain[i])) glyphFmt.set(plain[i], fmts[i]);

  const chars = [...ru];
  const cf = chars.map(() => base);
  const str = chars.join('');
  // индексы в chars и в str совпадают, пока в тексте нет суррогатных пар — для лора это так
  for (const m of str.matchAll(NUM_RU)) {
    const f = numFmt.get(m[0].replace(/^\+/, '').replace(/(\d),(\d{1,2})$/, '$1.$2'));
    if (!f) continue;
    let end = m.index + m[0].length;
    if (str[end] === '%' || str[end] === 'x' || str[end] === '×') end++;
    for (let i = m.index; i < end; i++) cf[i] = f;
  }
  for (let i = 0; i < chars.length; i++) {
    const f = glyphFmt.get(chars[i]);
    if (!f || cf[i] !== base) continue;
    cf[i] = f;
    // слово-два после значка: «❁ Силы», «☣ Шанс крита», «☠ Крит. урон»
    let j = i + 1;
    let words = 0;
    while (j < chars.length && words < 3) {
      let k = j;
      if (chars[k] === ' ') k++;
      let e = k;
      while (e < chars.length && /[\p{L}.\-]/u.test(chars[e])) e++;
      const w = chars.slice(k, e).join('');
      if (!w) break;
      const lw = w.toLowerCase().replace(/\.$/, '');
      if (words === 0 ? STOP.has(lw) : !STAT_TAIL.has(lw) && !(words === 1 && /^Крит\.$/.test(chars.slice(j, k).join('') + w))) break;
      // «в» и «на» — только как часть «Времени в Rift», «Удачи на руду»: дальше должно идти ещё слово из списка
      if (words > 0 && (lw === 'в' || lw === 'на')) {
        let k2 = e + 1, e2 = k2;
        while (e2 < chars.length && /[\p{L}.\-]/u.test(chars[e2])) e2++;
        if (!STAT_TAIL.has(chars.slice(k2, e2).join('').toLowerCase())) break;
      }
      for (let q = j; q < e; q++) cf[q] = f;
      j = e;
      words++;
    }
  }
  // по словам с переносом
  const lines = [];
  let cur = '', curLen = 0, active = base;
  let i = 0;
  const flushLine = () => { lines.push(cur); cur = ''; curLen = 0; };
  while (i < chars.length) {
    if (chars[i] === ' ') { i++; continue; }
    let e = i;
    while (e < chars.length && chars[e] !== ' ') e++;
    const wlen = e - i;
    if (curLen && curLen + 1 + wlen > width) flushLine();
    if (!curLen) { cur = cf[i] === active ? active : ''; } else { cur += ' '; curLen++; }
    for (let q = i; q < e; q++) {
      if (cf[q] !== active) { active = cf[q]; cur += active; }
      cur += chars[q];
    }
    curLen += wlen;
    i = e;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Переводит весь лор. Возвращает строки с §-цветами и статистику перевода.
 * @param {string[]} lore
 * @returns {{ lines: string[], untranslated: number, total: number }}
 */
export function translateLore(lore = [], opts = {}) {
  const out = [];
  let untranslated = 0, total = 0;
  let para = [];
  const flush = () => {
    if (!para.length) return;
    const lines = para.map(normalizeGlyphs);
    const per = lines.map(translateLineInner);
    if (per.every(p => p.ok)) {
      out.push(...per.map(p => p.text));
    } else {
      const text = stripColor(lines.join(' ')).replace(/\s+/g, ' ').trim();
      const d = dictLookup(text);
      const tr = d ? { text: d, unknown: 0, known: 1 } : translateParagraphPartial(text);
      if (tr.unknown === 0) {
        out.push(...recolorWrap(tr.text, lines));
      } else if (tr.known > 0) {
        // смешанный абзац: известные предложения по-русски, остальные как в игре
        if (opts.onUntranslated) opts.onUntranslated(text, lines);
        out.push(...recolorWrap(tr.text, lines));
        total += per.length;
        untranslated += Math.max(1, Math.round(per.length * tr.unknown / (tr.unknown + tr.known)));
        para = [];
        return;
      } else {
        if (opts.onUntranslated) opts.onUntranslated(text, lines);
        per.forEach(p => { out.push(p.text); total++; if (!p.ok) untranslated++; });
        para = [];
        return;
      }
    }
    total += per.length;
    para = [];
  };
  // Требование, перенесённое на две строки («❣ Requires Master Mode The Catacombs Floor IV» + «Completion.») — склеиваем
  const merged = [];
  for (const l of lore) {
    const prev = merged[merged.length - 1];
    const pp = prev != null ? stripColor(prev).trim() : '';
    const cur = stripColor(l).trim();
    if (/^[❣☠✖]\s*Requires\b/.test(pp) && !/[.!]$/.test(pp) && cur && !/^[❣☠✖]/.test(cur) && !RARITY_LINE.test(cur)) {
      merged[merged.length - 1] = `${prev} ${cur}`;
    } else merged.push(l);
  }
  lore = merged;
  for (const l of lore) {
    const p = normalizeGlyphs(stripColor(l)).trim();
    // строка требования — отдельный абзац
    if (/^[❣☠✖]\s*Requires\b/.test(p)) { flush(); para.push(l); flush(); continue; }
    if (!p) { flush(); out.push(''); continue; }
    // заголовки способностей/бонусов и строки характеристик — отдельные «абзацы»
    if (/^(Ability|Item Ability|Full Set Bonus|Tiered Bonus|Piece Bonus|Dungeon Bonus|Mana Cost|Cooldown|Soulflow Cost|Fuel Tank|Drill Engine|Upgrade Module):/.test(p) || /^\w+ Bonus$/.test(p) || STAT_LINE.test(normalizeGlyphs(l))) {
      flush(); para.push(l); flush(); continue;
    }
    // служебные строки (редкость, «можно перековать», Soulbound…) без пустой строки перед ними — тоже отдельно
    if (para.length && (RARITY_LINE.test(p) && p === p.toUpperCase() || PHRASES[p] || /^\* (?:Co-op )?Soulbound \*$|^X Rift-Transferable X$/.test(p))) {
      flush(); para.push(l); flush(); continue;
    }
    // пункт списка «‣ …» (Booster Cookie) — новый абзац, продолжение пункта приклеивается к нему
    if (/^‣/.test(p)) flush();
    para.push(l);
  }
  flush();
  return { lines: out, untranslated, total };
}
