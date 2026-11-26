// Справочник «Души и коллекции»: Fairy Souls, контакты Abiphone, песни арфы Melody.
// Источники:
//  - data/fairy_souls.json, data/abiphone.json, data/island_warps.json — снимок NEU-REPO constants (fairy_souls,
//    abiphone, islands.island_warps) от 2026-11-23. Если на сервере загружен свежий NEU, берутся его константы.
//  - песни арфы: id и поля API — по открытому парсеру skyblock-api (matdoes, src/cleaners/skyblock/harp.ts);
//    названия, сложность и награды сверены 23.11.2026 по fandom «Harp» и «Personal Harp»: Intelligence навсегда
//    (Easy +1, Hard +2, Expert +3, Virtuoso +4, песни Personal Harp +1) и SkyBlock XP (4 / 8 / 16 / 28, Prodigy 35).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tx } from '../../i18n/msg.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
export const FAIRY_SNAPSHOT = read('fairy_souls.json');
export const ABIPHONE_SNAPSHOT = read('abiphone.json');
export const WARPS_SNAPSHOT = read('island_warps.json').island_warps;

// Острова в порядке, удобном для сбора фей (сначала доступные с самого начала)
export const ISLANDS = {
  hub: { name: 'Hub', ru: 'Hub',
    tip: 'Больше всего фей. Часть на крышах домов и в шпилях, часть в подземельях: канализация под Hub, шахта в Graveyard, пещеры под Wilderness. Высокие удобнее брать с Aspect of the End или Grappling Hook.' },
  foraging_1: { name: 'The Park', ru: 'Парк',
    tip: 'Феи раскиданы по лесам разных пород: на кронах, в дуплах и у пещеры Howling Cave. Отсюда же вход к Melody с арфой.' },
  farming_1: { name: 'The Farming Islands', ru: 'Фермерские острова',
    tip: 'The Barn и Mushroom Desert: феи на полях, в трещинах пустыни, у Trapper и на скалах.' },
  combat_1: { name: "Spider's Den", ru: '',
    tip: 'Много фей на горе к вершине Arachne и в пещерах под ней. Наверх ведут паутина и уступы.' },
  mining_1: { name: 'Gold Mine', ru: 'Золотой рудник',
    tip: 'Небольшой остров: феи в тоннелях и на верхних ярусах шахты.' },
  mining_2: { name: 'Deep Caverns', ru: 'Глубокие пещеры',
    tip: 'Феи по уровням пещер сверху вниз: Gunpowder Mines → Lapis Quarry → Pigmen\'s Den → Slimehill → Diamond Reserve → Obsidian Sanctuary.' },
  mining_3: { name: 'Dwarven Mines', ru: 'Dwarven Mines',
    tip: 'Большая карта: феи у Royal Palace, Forge, в Cliffside Veins, Rampart\'s Quarry и на ледяных скалах. Ищи и под потолком.' },
  combat_3: { name: 'The End', ru: 'Энд',
    tip: 'Феи на шипах обсидиана, у Dragon\'s Nest и в Void Sepulture. Зилоты и эндермены мешают — бери броню против Энда.' },
  crimson_isle: { name: 'Crimson Isle', ru: 'Crimson Isle',
    tip: 'Остров огромный и опасный: феи в Dragontail, Scarleton, Stronghold, у вулкана Blazing Volcano и в Burning Desert. Без огнестойкости в лаве не ныряй.' },
  dungeon_hub: { name: 'Dungeon Hub', ru: 'Dungeon Hub',
    tip: 'Все феи на поверхности хаба данжей и в его постройках, обычно за 5 минут.' },
  winter: { name: "Jerry's Workshop", ru: 'Мастерская Джерри',
    tip: 'Открыта только в Late Winter (последний месяц года SkyBlock), вход через портал в Hub. Запланируй заранее — иначе ждать год.' },
  fishing_1: { name: 'Backwater Bayou', ru: 'Болото',
    tip: 'Феи у воды, на сваях домиков и на деревьях над болотом.' },
  foraging_2: { name: 'Galatea', ru: 'Галатея',
    tip: 'Остров леса Galatea: феи на огромных деревьях и на островках в болоте.' },
  foraging_3: { name: 'Torrhus Canyon', ru: 'Каньон Torrhus',
    tip: 'Новая зона: феи на стенах каньона и уступах. Сверяйся с высотой в подсказке.' },
  lotus_atoll: { name: 'Lotus Atoll', ru: 'Атолл Lotus',
    tip: 'Маленький атолл: феи на островках и под водой у кораллов.' },
  safari: { name: 'Safari', ru: 'Сафари',
    tip: 'Зона охоты (Hunting): феи по краям сафари.' },
  garden: { name: 'The Garden', ru: 'Garden' },
  crystal_hollows: { name: 'Crystal Hollows', ru: 'Crystal Hollows' },
  dungeon: { name: 'Dungeon', ru: 'Dungeon' },
};
// острова — как в игре, без русских подписей (поле ru оставлено для старых данных, на сайте не показывается)
export const islandName = id => ISLANDS[id] ? ISLANDS[id].name : (id || 'неизвестно где');

// Песни арфы Melody по порядку открытия. id — как в API (song_<id>_best_completion).
export const HARP_SONGS = [
  { id: 'hymn_joy', name: 'Hymn to the Joy', tier: 'Easy', int: 1, xp: 4 },
  { id: 'frere_jacques', name: 'Frère Jacques', tier: 'Easy', int: 1, xp: 4 },
  { id: 'amazing_grace', name: 'Amazing Grace', tier: 'Easy', int: 1, xp: 4 },
  { id: 'brahms', name: 'Brahms\' Lullaby', tier: 'Hard', int: 2, xp: 8 },
  { id: 'happy_birthday', name: 'Happy Birthday to You', tier: 'Hard', int: 2, xp: 8 },
  { id: 'greensleeves', name: 'Greensleeves', tier: 'Hard', int: 2, xp: 8 },
  { id: 'jeopardy', name: 'Geothermy?', tier: 'Expert', int: 3, xp: 16 },
  { id: 'minuet', name: 'Minuet', tier: 'Expert', int: 3, xp: 16 },
  { id: 'joy_world', name: 'Joy to the World', tier: 'Expert', int: 3, xp: 16 },
  { id: 'pure_imagination', name: 'Godly Imagination', tier: 'Virtuoso', int: 4, xp: 28 },
  { id: 'vie_de_rose', name: 'La Vie en Rose', tier: 'Virtuoso', int: 4, xp: 28, reward: "Melody's Hair (+6 Intelligence), когда все 11 песен пройдены на 90%+" },
  // Только на Personal Harp (600 000 монет у Melody после 100% в Greensleeves и всех песнях до неё)
  { id: 'fire_and_flames', name: 'Through the Campfire', tier: 'Personal Harp', int: 1, xp: 35, extra: true },
  { id: 'pachelbel', name: 'Pachelbel', tier: 'Personal Harp', int: 1, xp: 35, extra: true, reward: 'Tuning Fork за каждое идеальное прохождение' },
];
export const HARP_TIER_RU = { Easy: 'лёгкая', Hard: 'сложная', Expert: 'эксперт', Virtuoso: 'виртуоз', 'Personal Harp': 'только на Personal Harp' };

// Условия контактов Abiphone: частые шаблоны переводятся автоматически, особые — здесь.
const REQ_RU = {
  'Part of Mage Faction Quest': 'выдаётся по квесту фракции Mages',
  'Have at least 4 Bingo Goals completed.': 'выполни хотя бы 4 цели Bingo',
  "Have Jacob's contact": 'сначала нужен контакт Jacob',
  'Spider Slayer 9': 'Spider Slayer 9 уровня',
  'Attend 3 meetings of the Cult of the Fallen Star': 'побывай на 3 собраниях Cult of the Fallen Star',
  'Kill a Runic Enderman.': 'убей рунического (Runic) эндермена',
  'Give 1x Bat the Fish to Hootie': 'отдай Bat the Fish совёнку Hootie',
  'Clear Target Practice IV': 'пройди Target Practice IV',
  'Common or': 'Abiphone редкости Common или',
  'Uncommon Abiphone': 'Uncommon',
  'Flawless Gemstones in the following order:': 'Flawless-самоцветы по очереди:',
  'Reach the LEGENDARY bracket once.': 'хотя бы раз дойди до лиги LEGENDARY',
  "Scott's Contact Baked In Bread.": 'контакт Scott, запечённый в хлеб (ивент пира)',
  "Ted's Contact Baked In Bread.": 'контакт Ted, запечённый в хлеб (ивент пира)',
  'Wear a full set of Fairy Armor.': 'надень полный сет Fairy Armor',
  'Type the following sentence in chat in front of him:': 'напиши перед ним в чат фразу:',
  'Five Max Lvl Pets of Legendary tier or better in your pet menu.': 'пять питомцев Legendary+ максимального уровня в меню питомцев',
  'Kill Arachne once.': 'один раз убей Arachne',
  'Complete a Infernal tier of Kuudra': 'пройди Kuudra тира Infernal',
};

const strip = s => String(s || '').replace(/§./g, '').trim();

/** Строки условия из abiphone.json → массив русских строк. */
export function requirementRu(lines = []) {
  const out = [];
  for (const raw of lines) {
    let s = strip(raw).replace(/^-\s*/, '').trim();
    if (!s) continue;
    if (/^No Requirement\.?$/i.test(s)) { out.push('просто поговори с NPC'); continue; }
    const tail = s.endsWith(' or') ? ' или' : '';
    const core = tail ? s.slice(0, -3).trim() : s;
    if (REQ_RU[s]) { out.push(REQ_RU[s]); continue; }
    if (REQ_RU[core]) { out.push(REQ_RU[core] + tail); continue; }
    let m = core.match(/^([\d.,]+)\s*Coins$/i);
    if (m) { out.push(tx`заплатить ${m[1].replace(/[.,]/g, ' ')} монет${tail}`); continue; }
    m = core.match(/^([\d,]+)x\s+(.+?)\.?(\s*\(Must be (.+?) Collection or higher\.\))?$/);
    if (m) { out.push(tx`принести ${m[1].replace(/,/g, ' ')}× ${m[2].replace(/\.$/, '')}${m[4] ? tx` (нужна коллекция ${m[4]})` : ''}${tail}`); continue; }
    m = core.match(/^([\d,]+)\S*\s+Mage Reputation$/);
    if (m) { out.push(tx`${m[1].replace(/,/g, ' ')} репутации Mages${tail}`); continue; }
    out.push(core.replace(/^Sapphirre$/, 'Sapphire') + tail); // имена самоцветов и фразы чата оставляем как в игре
  }
  return out;
}
