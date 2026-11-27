// Публичный интерфейс @sky-guide/core: `import { calendar, flips } from '@sky-guide/core'`.
//
// Сюда попадают только чистые расчёты: на вход — данные, на выход — результат. Ни один модуль отсюда
// не читает диск, не ходит в сеть, не смотрит в process.env и не запускает таймеры, поэтому этот вход
// работает в любом JS: на сервере, в браузере, в боте, в моде через JS-движок.
// Это проверяет test/boundaries.test.js; ломающее изменение того, что экспортируется отсюда, — новая
// средняя цифра версии (см. CONTRIBUTING.md, «Версии»).
//
// Остальное (разбор профиля с базой NEU, план «Что делать», загрузка Hypixel, хранилища) пока доступно
// по пути файла — `@sky-guide/core/parse/profile.js`. Это внутренний слой сервера: он может меняться в любой
// версии, а api закрепляет точную версию core. Подробно — docs/architecture.md.

// ── Бой и снаряжение ─────────────────────────────────────────
export * as damage from './calc/damage.js';           // урон, DPS, EHP
export * as stats from './calc/stats.js';             // лист статов: предметы, питомцы, Accessory Bag, Tuning
export * as magicFind from './calc/magic-find.js';     // Magic Find после реворка 0.27.3: источники и что взять дальше
export * as kit from './calc/kit.js';                 // «что надеть»: сеты, оружие, бой с боссом
export * as kitDetail from './calc/kit-detail.js';    // подробности вещи и подсказки по улучшению
export * as power from './calc/power.js';             // боевая сила, Magical Power, готовность к Master Mode
export * as slayerBosses from './calc/slayer-bosses.js'; // HP и урон боссов Slayer
export * as slayerReady from './calc/slayer-ready.js';   // какой тир Slayer по силам и что мешает
export * as loadouts from './advisor/lib/loadouts.js';   // сеты в Wardrobe, классы Dungeons
export * as hotm from './advisor/lib/hotm.js';           // Powder на дерево HOTM

// ── Профиль ──────────────────────────────────────────────────
export * as profileMode from './lib/profile-mode.js';  // Ironman, Stranded, Bingo
export * as fishing from './parse/fishing.js';         // разбор рыбалки и Trophy Fish
export * as upgrades from './parse/upgrades.js';       // улучшения профиля
export * as bank from './analysis/bank.js';            // проценты банка
export * as bits from './analysis/bits.js';            // Bits и Fame
export * as chocolate from './analysis/chocolate.js';  // Chocolate Factory
export * as maxwell from './analysis/maxwell.js';      // Accessory Bag, Power Stones
export * as petScore from './analysis/pet-score.js';   // Pet Score и Taming
export * as itemUpgrades from './analysis/item-upgrades.js'; // reforges и улучшения вещи
export * as accUpgrades from './lib/acc-upgrades.js';  // следующие улучшения аксессуаров
export * as darkAuction from './analysis/dark-auction.js';
export * as wealth from './analysis/wealth-data.js';   // таблицы: банк, Bits, Fame, Power Stones
export * as compare from './compare.js';               // сводка для сравнения игроков
export * as rift from './rift/index.js';               // Rift: души, Timecharms, Enigma
export * as museumCatalog from './museum/catalog.js';  // каталог Museum и награды
export * as essence from './stash/essence-info.js';    // Essence и перки

// ── Рынок ────────────────────────────────────────────────────
export * as bazaar from './market/bazaar.js';          // разбор ответа Bazaar
export * as bazaarList from './market/bazaar-list.js'; // список Bazaar с фильтрами
export * as auctions from './market/auctions.js';      // лоты AH, проданные лоты
export * as ahList from './market/ah-list.js';
export * as myAuctions from './market/my-auctions.js'; // «Мои лоты»: статусы своих лотов и ставок
export * as candles from './market/candles.js';        // свечи Bazaar
export * as ahCandles from './market/ah-candles.js';   // свечи AH
export * as marketHistory from './market/history.js';  // тренды цен
export * as movers from './market/movers.js';          // кто вырос и упал
export * as quote from './market/quote.js';            // цена покупки и продажи
export * as flips from './market/flips.js';            // флипы Bazaar, крафт, Forge, NPC
export * as resale from './market/resale.js';          // книги, звёзды, перепродажа
export * as crops from './market/crops.js';            // доход с культур
export * as dropIncome from './market/drop-income.js'; // доход с дропа
export * as mayorBoost from './market/mayor-boost.js';
export * as categories from './market/categories.js';
export * as marketUtil from './market/util.js';        // налог, медиана, рецепты

// ── Время и тексты ───────────────────────────────────────────
export * as calendar from './calendar/index.js';       // календарь SkyBlock, мэры, события
export * as skyblockTime from './calendar/time.js';
export * as mayors from './calendar/mayors.js';
export * as news from './news/index.js';               // новости сайта
export * as glossary from './guides/glossary.js';      // объяснения механик
export * as msg from '../i18n/msg.js';                 // тег ru`…` для переводимых строк
