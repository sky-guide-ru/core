import { tx } from '../../i18n/msg.js';
// Факты о Crimson Isle для гайда crimson.js. Источники сверки (23.11.2026):
//  - ключи API Dojo и пороги рангов: код SkyCrypt-Backend (src/stats/crimson_isle.go, src/constants/crimson_isle.go);
//  - испытания и советы: skykings.net/guides/dojo (обновлено 03.08.2025);
//  - пояса: предметы DOJO_*_BELT в NEU-REPO (статы из лора);
//  - квесты фракции: fandom Faction_Quests; мини-боссы, Vanquisher, Magma Boss: fandom Crimson_Isle и патч 0.13;
//  - Matriarch: патч 0.13 («3 Heavy Pearl в реальные сутки»).
// Чего НЕТ (страницы вики не открылись): очки для каждого пояса, цены ключей Kuudra, звания фракции по репутации.

// Порядок — как в меню Dojo. key → dojo_points_<key> / dojo_time_<key> в nether_island_player_data.dojo
export const DOJO_TESTS = [
  { key: 'mob_kb', name: 'Force', ru: 'Сила', icon: 'STICK',
    what: 'Сбивай зомби с платформы. Зомби дают 10, 20 или 30 очков, один особый зомби отнимает 30.',
    tip: 'Не трать время на 10-очковых, если не сбиваешь их с одного удара. Попал по «минус 30», а целишься в 1000 — начни заново.' },
  { key: 'wall_jump', name: 'Stamina', ru: 'Выносливость', icon: 'RABBIT_FOOT',
    what: 'Прыгай сквозь дыры в надвигающихся стенах. Четыре сложности, 9 очков за каждую секунду, пока жив.',
    tip: 'Смотри на следующую стену заранее и не стой у края: ранг считается по времени.' },
  { key: 'archer', name: 'Mastery', ru: 'Мастерство', icon: 'BOW',
    what: 'Стреляй из лука по шерсти на столбах: зелёная 8 очков, жёлтая 16, красная 32.',
    tip: 'Красная исчезает быстро. Пока жёлтая не догорела, бей зелёные рядом.' },
  { key: 'sword_swap', name: 'Discipline', ru: 'Дисциплина', icon: 'DIAMOND_SWORD',
    what: 'Бей зомби мечом того же материала, что у него на голове: +8 за верный, −16 за неверный.',
    tip: 'Стой в центре. Если идёшь на 1000 и ошибся дважды — перезапусти.' },
  { key: 'snake', name: 'Swiftness', ru: 'Скорость', icon: 'LEASH',
    what: 'Иди по новым блокам над лавой, за тобой тянется хвост. С 500 очков появляются прыжки через блок, с 800 — через два.',
    tip: 'Включи вид от третьего лица (F5): видно, куда ведёт хвост.' },
  { key: 'lock_head', name: 'Control', ru: 'Контроль', icon: 'EYE_OF_ENDER',
    what: 'Держи взгляд на голове скелета и не упади в лаву. Больше всего очков, пока голова алмазная.',
    tip: 'Двигай мышь плавно и маленькими шагами; чувствительность лучше снизить.' },
  { key: 'fireball', name: 'Tenacity', ru: 'Стойкость', icon: 'FIREBALL',
    what: 'Устой на платформе, пока до четырёх гастов стреляют огненными шарами.',
    tip: 'Бегай туда-обратно по центру и смотри в F5, чтобы видеть шары.' },
];

// Ранг испытания по очкам (как в SkyCrypt): S ≥ 1000, A ≥ 800, B ≥ 600, C ≥ 400, D ≥ 200, иначе F
export const DOJO_RANKS = [['S', 1000], ['A', 800], ['B', 600], ['C', 400], ['D', 200], ['F', 0]];
export const dojoRank = p => DOJO_RANKS.find(([, min]) => (p || 0) >= min)[0];
export const nextRank = p => [...DOJO_RANKS].reverse().find(([, min]) => min > (p || 0)) || null;

// Пояса Dojo (экипировка в слот пояса). Статы — из лора NEU; очки (сумма лучших результатов всех испытаний)
// и опыт Combat за пояс — fandom «Dojo» и «Black Belt», сверено 23.11.2026. Белый дают без порога очков.
export const BELTS = [
  { id: 'DOJO_WHITE_BELT', name: 'White', ru: 'Белый', points: 0, xp: 0, stats: '+10 ❤, +5 ❈, −0,5% урона' },
  { id: 'DOJO_YELLOW_BELT', name: 'Yellow', ru: 'Жёлтый', points: 1000, xp: 80_000, stats: '+15 ❤, +5 ❈, −1% урона' },
  { id: 'DOJO_GREEN_BELT', name: 'Green', ru: 'Зелёный', points: 2000, xp: 100_000, stats: '+20 ❤, +10 ❈, −3% урона' },
  { id: 'DOJO_BLUE_BELT', name: 'Blue', ru: 'Синий', points: 4000, xp: 120_000, stats: '+25 ❤, +15 ❈, −4% урона' },
  { id: 'DOJO_BROWN_BELT', name: 'Brown', ru: 'Коричневый', points: 6000, xp: 140_000, stats: '+30 ❤, +20 ❈, −5% урона' },
  { id: 'DOJO_BLACK_BELT', name: 'Black', ru: 'Чёрный', points: 7000, xp: 160_000, stats: '+35 ❤, +25 ❈, −6% урона' },
];

// Титулы фракции по репутации (fandom «Faction»): совпадают с порогами тиров Kuudra. sbxp — опыт SkyBlock за титул.
export const FACTION_TITLES = [
  { name: 'Neutral', ru: 'Нейтральный', rep: 0, sbxp: 0 },
  { name: 'Friendly', ru: 'Дружелюбный', rep: 1000, sbxp: 5 },
  { name: 'Trusted', ru: 'Доверенный', rep: 3000, sbxp: 10 },
  { name: 'Honored', ru: 'Почётный', rep: 7000, sbxp: 20 },
  { name: 'Hero', ru: 'Герой', rep: 12000, sbxp: 40 },
];

// Kuudra Key у Emissary своей фракции (fandom «Kuudra Key»): Barbarians берут Enchanted Red Sand, Mages — Enchanted Mycelium,
// плюс 2 Nether Star и монеты. Репутация для покупки — как для тира. drop — шанс с мини-босса (Magma Boss — вдвое выше).
export const KUUDRA_KEYS = [
  { tier: 'basic', mat: 2, coins: 200_000, drop: '6% (Magma Boss 12%)' },
  { tier: 'hot', mat: 6, coins: 400_000, drop: '4% (Magma Boss 8%)' },
  { tier: 'burning', mat: 20, coins: 750_000, drop: null },
  { tier: 'fiery', mat: 60, coins: 1_500_000, drop: null },
  { tier: 'infernal', mat: 120, coins: 3_000_000, drop: null },
];

export const FACTIONS = {
  barbarians: { name: 'Barbarians', ru: 'Варвары', town: 'Dragontail', rescue: 'Cathedral', who: 'пиглины' },
  mages: { name: 'Mages', ru: 'Маги', town: 'Scarleton', rescue: 'The Bastion', who: 'народ Taika' },
};

// Квесты фракции: до 5 в день на доске в Community Center своего города (fandom Faction_Quests)
export const QUEST_TYPES = [
  { name: 'Miniboss', ru: 'Мини-босс', text: 'Убить мини-босса острова. Быстрее всего, если он как раз жив.' },
  { name: 'Fetch', ru: 'Принести', text: 'Сдать предметы (часто материалы Crimson Isle). Проверь мешки и Bazaar, прежде чем фармить.' },
  { name: 'Fishing', ru: 'Fishing', text: 'Поймать лавовых существ или Trophy Fish.' },
  { name: 'Rescue', ru: 'Спасение', text: 'Вызволить пленника из лагеря врага: Cathedral у Barbarians, The Bastion у Mages.' },
  { name: 'Dojo', ru: 'Dojo', text: 'Пройти испытание Dojo с рангом не ниже указанного.' },
  { name: 'Kuudra', ru: 'Kuudra', text: 'Пройти Kuudra нужного тира.' },
];

// Мини-боссы (патч 0.13 и fandom). С каждого — материалы и шанс на Kuudra Key; лут почти всегда Co-op Soulbound.
export const MINIBOSSES = [
  { id: 'BLADESOUL', name: 'Bladesoul', where: 'Stronghold', text: 'Огромный скелет-иссушитель.' },
  { id: 'BARBARIAN_DUKE_X', name: 'Barbarian Duke X', where: 'окраина Dragontail', text: 'Пиглин-вожак варваров.' },
  { id: 'MAGE_OUTLAW', name: 'Mage Outlaw', where: 'за стенами Scarleton', text: 'Изгнанный маг.' },
  { id: 'ASHFANG', name: 'Ashfang', where: 'руины бастиона за Пустошами', text: 'Огромный блейз.' },
  { id: 'MAGMA_BOSS', name: 'Magma Boss', where: 'Magma Chamber в вулкане', text: '200 млн здоровья, появляется каждые 2 минуты во всех лобби одновременно.' },
];

/** Dojo по профилю: очки и ранг каждого испытания, сумма, сколько пройдено. */
export function dojoState(dojo = {}) {
  const tests = DOJO_TESTS.map(t => {
    const raw = dojo[tx`dojo_points_${t.key}`];
    const points = Number(raw) || 0;
    return { ...t, tried: raw != null, points, rank: dojoRank(points), next: nextRank(points) };
  });
  return {
    tests,
    total: tests.reduce((s, t) => s + t.points, 0),
    tried: tests.filter(t => t.tried).length,
    sRanks: tests.filter(t => t.rank === 'S').length,
  };
}

