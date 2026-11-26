// Механика трофейной рыбалки (Crimson Isle). Источники, сверено 23.11.2026:
//  • NEU-REPO: описания *_BRONZE.json (условия), предметы Odger's Tooth, Hunter Armor, Hot Bait, Corrupted Bait,
//    Trophy Line, книги Charm I–VI.
//  • hypixel-skyblock.fandom.com (правки 2026 года): Trophy Fish, Trophy Fish Chance, Odger, Essence Shops/Gold и /Diamond:
//    шансы видов, тиры, гарантия 100/600, окно Gusher 7–16 минут, Golden Fish 8–12 мин, разделка у Odger.
//  • SkyHanni-REPO constants/TrophyFish.json: базовые шансы и разделка — совпадают с fandom (Lavahorse на алмазе 24;
//    у NEU там 40, это его ошибка: две другие базы и вики сходятся на 24).
//  • Новая вики hypixelskyblock.minecraft.wiki недоступна из России (и с ПК, и из облака), официальная wiki.hypixel.net
//    закрыта Hypixel в июле 2026, поэтому сверка идёт по fandom. Сервер раз в сутки проверяет, не правили ли эти страницы
//    после сверки (server/wiki/watch.js), и тогда гайд показывает пометку.

/** Тиры: шанс каждого броска (сверху вниз: алмаз → золото → серебро, иначе бронза) и итоговая доля. */
export const TIER_ROLL = { diamond: 0.002, gold: 0.02, silver: 0.25 };
/** Charm даёт +2% за уровень к каждому броску тира, кроме бронзы (Charm V: 0,2% → 0,22%). */
export const CHARM_PER_LVL = 0.02;
/** Midas Lure (Gold Essence, Marigold в Royal Mines) и Radiant Fisher (Diamond Essence, Gemma в Crystal Nucleus): +2% за уровень, до X. */
export const PERK_PER_LVL = 0.02;
/** Гарантия: N-й улов этого вида — гарантированно такой тир, если его ещё не было. */
export const PITY = { gold: 100, diamond: 600 };
/** Предел стата Trophy Fish Chance. */
export const TFC_CAP = 150;

/**
 * 18 видов: base — базовый шанс вида за один улов (доля), cond — точное условие, spot — где стоять,
 * group — к какой «точке» относится (для комбо), hard — почему вид трудный (если трудный).
 */
export const TROPHY_INFO = {
  blobfish: { base: 0.25, spot: 'любая лава Crimson Isle', cond: 'Без условий.', group: 'any' },
  sulphur_skitter: { base: 0.30, spot: 'лава рядом с блоком Sulphur Ore', cond: 'Ты сам должен стоять не дальше 4 блоков от блока Sulphur Ore (с 0.20.6; раньше было 8).', group: 'sulphur' },
  gusher: { base: 0.20, spot: 'любая лава после извержения Blazing Volcano', cond: 'Ловится с 7-й по 16-ю минуту после извержения вулкана. В остальное время не клюёт.', group: 'any' },
  steaming_hot_flounder: { base: 0.20, spot: 'гейзеры Blazing Volcano', cond: 'Поплавок не дальше 2 блоков от гейзера (белые частицы над лавой) в зоне Blazing Volcano.', group: 'volcano' },
  obfuscated_fish_1: { base: 0.25, spot: 'любая лава, наживка Corrupted Bait', cond: 'Только с Corrupted Bait в Fishing Bag. Ещё падает с «испорченных» (corrupted) Sea Creatures.', group: 'obf', bait: 'CORRUPTED_BAIT' },
  slugfish: { base: 0.15, spot: 'любая лава, не подсекай 20 секунд', cond: 'От заброса до подсечки должно пройти не меньше 20 секунд (10 секунд с питомцем Slug).', group: 'any', slow: true },
  flyfish: { base: 0.08, spot: 'Blazing Volcano, с высоты 8+ блоков', cond: 'Поплавок в зоне Blazing Volcano и минимум на 8 блоков ниже тебя: забрасывай с уступа над лавой.', group: 'volcano' },
  obfuscated_fish_2: { base: 0.20, spot: 'любая лава, наживка Obfuscated 1', cond: 'Наживка — пойманная Obfuscated 1 (лежит в Fishing Bag, тратится по одной за улов).', group: 'obf', bait: 'OBFUSCATED_FISH_1_BRONZE' },
  lava_horse: { base: 0.04, spot: 'любая лава Crimson Isle', cond: 'Без условий.', group: 'any' },
  mana_ray: { base: 0.012, spot: 'любая лава, много маны', cond: 'Нужно минимум 1200 маны. Шанс = мана ÷ 1000 % (1200 маны → 1,2%, 2400 → 2,4%): надень сет на Intelligence.', group: 'any', mana: true, hard: 'шанс зависит от маны: при 1200 мане всего 1,2%' },
  volcanic_stonefish: { base: 0.03, spot: 'лава Blazing Volcano', cond: 'Поплавок в зоне Blazing Volcano.', group: 'volcano' },
  vanille: { base: 0.08, spot: 'любая лава, Starter Lava Rod', cond: 'Только Starter Lava Rod без зачарований. Детали удочки, реформа, самоцветы и Wet Book можно.', group: 'vanille', hard: 'с Starter Lava Rod всего +5 Trophy Fish Chance от удочки' },
  obfuscated_fish_3: { base: 0.10, spot: 'любая лава, наживка Obfuscated 2', cond: 'Наживка — пойманная Obfuscated 2. Цепочка: Corrupted Bait → Obfuscated 1 → Obfuscated 2 → Obfuscated 3.', group: 'obf', bait: 'OBFUSCATED_FISH_2_BRONZE', hard: 'каждая попытка съедает одну Obfuscated 2, а та сама ловится только на Obfuscated 1' },
  skeleton_fish: { base: 0.02, spot: 'Burning Desert (или Dragontail)', cond: 'Поплавок в зоне Burning Desert. Dragontail тоже считается.', group: 'desert', hard: 'базовый шанс 2%' },
  moldfin: { base: 0.02, spot: 'Mystic Marsh (или Scarleton)', cond: 'Поплавок в зоне Mystic Marsh. Scarleton тоже считается; на западном краю Marsh клюёт ещё и Volcanic Stonefish.', group: 'marsh', hard: 'базовый шанс 2%' },
  soul_fish: { base: 0.02, spot: 'лава Stronghold', cond: 'Поплавок в зоне Stronghold.', group: 'stronghold', hard: 'базовый шанс 2%' },
  karate_fish: { base: 0.02, spot: 'лава Dojo', cond: 'Поплавок в зоне Dojo.', group: 'dojo', hard: 'базовый шанс 2% (до 0.20.9 был 1%)' },
  golden_fish: { base: null, spot: 'любая лава, долгая рыбалка', group: 'any', golden: true,
    cond: 'Появляется не раньше 8 минут рыбалки: шанс растёт от 0% на 8-й минуте до 100% на 12-й (бросок каждую секунду, пока поплавок в лаве). Trophy Fish Chance на неё не действует. Всплывает золотой головой в лаве: подсекай её, пока не появится «The Golden Fish escapes your hook but looks weakened», потом снова, пока не будет «The Golden Fish is weak!», и тогда тяни. После поимки отсчёт начинается заново.',
    hard: 'не больше одной примерно за 8–12 минут, Trophy Fish Chance не помогает' },
};

/** Точки, где условия нескольких видов выполняются одновременно. */
export const SPOTS = {
  volcano: { title: 'Blazing Volcano', text: 'Встань на уступ на 8+ блоков выше лавы рядом с гейзером: клюют Steaming-Hot Flounder, Flyfish и Volcanic Stonefish. Если ещё и не подсекать 20 секунд, добавится Slugfish, а после извержения ещё и Gusher.' },
  sulphur: { title: 'Sulphur Ore', text: 'Лава, у которой ты стоишь в 4 блоках от Sulphur Ore. Тут Sulphur Skitter (30%) и всё, что ловится везде.' },
  marsh: { title: 'Mystic Marsh', text: 'Moldfin. На западном краю зоны рядом с вулканом заодно клюёт Volcanic Stonefish.' },
  desert: { title: 'Burning Desert', text: 'Skeleton Fish.' },
  stronghold: { title: 'Stronghold', text: 'Soul Fish.' },
  dojo: { title: 'Dojo', text: 'Karate Fish.' },
  obf: { title: 'Цепочка Obfuscated', text: 'Corrupted Bait → Obfuscated 1 → (как наживка) Obfuscated 2 → (как наживка) Obfuscated 3. Наживка тратится на каждый улов, даже если клюнуло другое.' },
  vanille: { title: 'Starter Lava Rod', text: 'Vanille: отдельная удочка без зачарований.' },
  any: { title: 'Любая лава', text: 'Blobfish, Lavahorse, Slugfish, Mana Ray, Gusher и Golden Fish ловятся где угодно, параллельно с остальным.' },
};

/** Откуда берётся Trophy Fish Chance (числа: fandom «Trophy Fish Chance», NEU). */
export const TFC_SOURCES = {
  rods: { STARTER_LAVA_ROD: 5, MAGMA_ROD: 15, INFERNO_ROD: 20, HELLFIRE_ROD: 25 },
  // Тир-бонус Odger's Blessing за 1/2/3/4 надетые части
  hunter: { BRONZE_HUNTER: [0, 3, 4, 5], SILVER_HUNTER: [0, 5, 7.5, 10], GOLD_HUNTER: [0, 10, 15, 20], DIAMOND_HUNTER: [0, 20, 25, 30] },
  teeth: { ODGERS_BRONZE_TOOTH: 1, ODGERS_SILVER_TOOTH: 2, ODGERS_GOLD_TOOTH: 3, ODGERS_DIAMOND_TOOTH: 4 },
  kuudraPet: { COMMON: 0, UNCOMMON: 15, RARE: 15, EPIC: 20, LEGENDARY: 20, MYTHIC: 20 },
  hotBait: 5, trophyLine: 5, hotspot: 5, hotspotSinker: 5, attributePerLvl: 2, umberella: 5,
};

/** Темп рыбалки для оценки часов: в игре такого числа нет, это средний темп с хорошей лавовой удочкой. */
export const ASSUME = { catchesPerHour: 400, slowCatchesPerHour: 150, goldenPerHour: 6 };
