# Что менялось в core

Правила номеров — [CONTRIBUTING.md](CONTRIBUTING.md#версии).

## Не выпущено

- Новый гайд «Taming и прокачка питомцев» (`src/guides/taming.js`, группа skills) по вики (Taming, Pets, Pet Items, Exp Share, Pet Food, Fann, Kat, George, Beastmaster Crest, 28.11.2026): вехи Taming, множители опыта питомца (`XP_FACTORS`) с тем, что есть у игрока, свои питомцы и скилл полного опыта (NEU `pet_types`), Exp Boost (`EXP_BOOSTS`), доля Exp Share (`expShareRate`), тренировка Fann (`FANN`), Carrot Candy (`FOOD`), опыт до 100/200, выгода докачки на продажу (lowest BIN 100 уровня против дешёвого лота, `cheapestXp`), George для капа, остальные Pet Items (`PET_ITEMS`: что дают, где взять, кому подходят; у кого из питомцев уже надет) и совет предмета для каждого своего питомца (`petItemFor`: по типу, уровню и уровню Garden). Шаги: Diana, Exp Boost активному, Taming 10/20, Fann, Exp Share, кап George.
- «Питомцы по этапам» (`petLadder`): режим профиля, деньги и наличие рынка берутся из `ctx.adv` — раньше в гайдах деньги считались нулём (любой платный питомец «дорого») и Ironman видел цены аукциона.

## 0.2.55

- Новый гайд «Enchanting и Experiments» (`src/guides/enchanting.js`, группа skills) по вики (Experiments, Experimentation Table, Metaphysical Serum, Enchanting, 28.11.2026): ставки Superpairs, Chronomatron и Ultrasequencer (`SUPERPAIRS`, `CHRONOMATRON`, `ULTRASEQUENCER`, `runXp`), заряды и докупка за Bits (`RESETS`), как играть, что продаётся, Metaphysical Serum и RNG Meter, уровни Enchanting, зачарования по слотам (`ENCHANTS`). Шаги: пройти Experiments сегодня, играть на открытой ставке, следующий уровень, Serum, Guardian.
- `extras.experiments`: `top` — самая высокая ставка, на которой играл (по `attempts_N`/`claims_N`), `claims` — всего наград Superpairs.
- «Дела на сегодня»: Experiments — «игры стола», а не «столы», ссылка ведёт в гайд.
- Совет Enchanting без Bookshelf Power (убран из игры в 0.26.1).
- Фикстура: данные экспериментов и Serum.

## 0.2.54

- Гайд Mining: блок Fossil Excavator (`src/guides/fossil.js`) — как открыть Suspicious Scrap, формы шести окаменелостей с процентом «Fossil Excavation Progress», сданные Dr. Stone (`gather.fossils`), выгода «открыть или продать» (`excavatorValue`: веса лута с вики, но забирается только откопанное — заряды, Citrine, Onyx, Aquamarine, Peridot из гемов Chisel через `chiselGems`) и Chisel игрока. Шаги «Скрап выгоднее продать / открой», «Сдай Dr. Stone» (только те окаменелости, что лежат у игрока), «Улучши Chisel».
- Новый тип секции гайда `shapes` (фигуры на сетке), описан в `src/guides/README.md`.
- `mining.fossilDust` убран: с апреля 2026 Fossil Dust заменён на Fossil Essence (`essence.FOSSIL`).
- `enrichGuide`: секция-дерево (`rows` — число рядов) больше не роняет подсказки по тексту всего гайда Mining.
- Способ «Glacite Mineshaft»: уточнено, что скрап открывают ради окаменелостей, а не монет.

## 0.2.53

- Гайд Mining: Frozen Corpse Milestones (`guides/corpses.js`: `CORPSE_TYPES`, `MILESTONES`, `RNG_METER`, `milestoneState`, `corpseGuide`) по вики «Frozen Corpses» / «Grandpa Wolf» (28.11.2026). Таблица 7 вех с прогрессом по `glacite_player_data.corpses_looted` (`news: 'corpses'`), таблица трупов с Glacite Powder и очками RNG Meter, таблица целей RNG Meter с монетами за труп.
- Шаги: «Забери награду за веху у Grandpa Wolf» (веха пройдена, а Organ Donor нужного уровня нигде нет), «Frozen Corpse Milestone N» с ценой недостающих ключей; дороже трети денег — «На потом», перки Gifts from the Departed / Dead Man's Chest и ключи в инвентаре — в совете.
- «Заработок», Glacite Mineshaft: таблицы лута по патчу 0.24.2 (веса редких предметов по вики), броски 4,5 / 5,5 / 6,5 вместо 3, 2,5 трупа на шахту. Экспорт `CORPSES` (+`rolls`, Vanguard), `CORPSES_PER_SHAFT`; `CORPSE_ROLLS` убран.
- Глоссарий: Frozen Corpse Milestones, Grandpa Wolf; `curated-ru`: откуда Organ Donor Talisman/Ring/Artifact и Shattered Locket.
- Новость «Frozen Corpse Milestones в гайде Mining».

## 0.2.51

- Гайд майнинга: чек-лист «Другие кристаллы: для Perfect-гемов» (Jasper, Ruby, Opal, Aquamarine, Peridot, Onyx, Citrine) — где искать и что найдено по `mining_core.crystals`.
- `guides/crystals.js`: справочник 12 Gemstone Crystals (где искать) и `crystalFound(member, key)`. «Как получить» (`costTree`, `buildObtainGuide`): кристалл в рецепте Perfect-гема — «найден / не найден · где искать» вместо «нет цены и рецепта», у карточки кристалла первым способ «Найти кристалл».
- Новость «Кристаллы для Perfect-гемов в гайде».

## 0.2.50

- Гайды: «Питомцы по этапам» (`src/guides/pets.js`: `PET_LADDERS`, `petLadderSection`, `petNextStep`) в Mining, Farming, Foraging, Fishing, Trophy Fish, слеерах (свой босс), Dungeons (свой класс), Kuudra и Crimson Isle. Старт → средний → эндгейм с живой ценой AH, шансом выпадения и источником (fandom, NEU, 28.11.2026). Питомец той же цели ступенью выше закрывает младшего; в добыче стартовых не советуем после первого среднего; шаг плана — только по карману (30% монет), без рынка — по монетам NPC; Bingo без эндгейма; питомцы событий в план не идут. Старые таблицы питомцев в Mining, Farming, Foraging и строки питомцев в Fishing заменены.

## 0.2.49

- Дерево HotM: сборка `mithril` («Mithril и Titanium»): Titanium Insanium, Metal Head, Strong Arm, Precision Mining, Mining Speed Boost, Luck of the Cave, Sky Mall (×5 Titanium на день). Mithril и Titanium — Dwarven Metals (NEU), поэтому перки металлов сверху дерева.
- `peel` (что снять при перестановке): сначала лишние перки, «по желанию» (Sky Mall и др.) — только если лишнее не снять; после каждого снятия снова с лишних.
- Секция дерева HotM в гайде Mining: `news: 'hotm'` для ссылок из новостей.

## 0.2.48

- Гайд «The Forge» (`guides/forge.js`, вид `extra.forge`): слоты из `gather.forge` с временем готовности (Quick Forge учтён), выгодные рецепты под ритм заходов 4/12/24 ч (`forgeProfitPlans`: слот занят `ceil(длительность/ритм)·ритм`), цели под 🔒, цепочки деталей бура (`drillUpgrades`, `forgeChain`: вычитает запасы из хранилищ, Sacks и деталей на бурах, считает время по слотам и длинной ветке, цену материалов и готового).
- Ironman/Stranded/Bingo: в гайде вместо цен — «Что ковать для себя» (`forgeForSelf`).
- `guideCtx`: новые `deps.market` (MarketCtx) и `deps.collections`.
- `craftFlips`: поле `hotm` (уровень HotM из рецепта) для колонки в «Заработке».
- Шаг 3 гайда Mining ведёт в гайд The Forge (`link` у шага); новость «Гайд The Forge».

## 0.2.47

- «Где XP дешевле» (`sbxpPlan`, опция `collections`): Collections считаются тем же `analyzeCollections`, что раздел «Коллекции» (кооп и максимум из справочника). Было 2696 / 2696 против 3172 в разделе.

## 0.2.46

Проверка на профиле очень сильного игрока: где сайт считал сделанное несделанным или советовал лишнее.

- `bestKit`: кинжалы Blaze узнаются по id (в лоре у них «SLAYER SWORD», не DAGGER). Раньше свои кинжалы игрока никогда не попадали в расчёт: «нет кинжала» и «пока нет: расчёт сделан так, будто пара уже есть» при Pyrochaos и Deathripper в хранилище.
- `kuudraUpgradePlan`: если в слоте гардероба с частями Kuudra недостающая часть — другая броня (Warden Helmet), её не советуем докупать, а сравнение с готовым сетом идёт по тем частям, что игрок носит.
- `petRules`: у ключевого питомца есть `alt` — Golden Dragon закрывает Ender Dragon.
- `computePetScore`: Special и Very Special (Phoenix) считаются как Common — так совпадает с числом из игры.
- `petScoreMf`: пороги до 500 (+13) из таблицы SkyCrypt; в NEU таблица обрывается на 325 (+10), и раздел «Снаряжение» показывал +10 при 485 очках.
- `analyzeAccessories`: Recombobulator переходит на улучшенную версию аксессуара — прирост MP у апгрейда рекомбнутой младшей версии считается от рекомбнутой старшей (как шаг «tier»). Раньше план не видел дешёвых апгрейдов, которые есть в разделе «Аксессуары».
- `minionRules`, `collectionRules`, карта прогрессии: в коопе уникальные крафты миньонов и количество в коллекциях общие. Раньше план советовал «49 крафтов до 20-го слота» при 713 крафтах коопа и коллекции при 90/90 максимальных.
- `analyzeCollections`: тир не выше максимума справочника (было «801 / 793»).
- Музей в плане и карте считает вещи из экипировки гардероба, как раздел «Музей» (было 7 предметов и +125 XP против 9 и +143); экипировка гардероба — «в ходу».
- Chocolate сверх предела из таблицы — «у потолка фабрики», без «67 млрд из 60 млрд»; «Не тронуты 0 островов» не пишем.
- Abiphone в «Где XP дешевле»: максимум не меньше набранного (было «700 / 490»).
- Заработок: Mythological Ritual идёт и при министре Diana с этим перком; капитал считает и личный Bank.
- Новость «Точнее советы для сильных профилей».

## 0.2.45

- `slayerPlan`: тир с 5+ победами — опора «уже проходишь», даже если оружия под него не видно (кинжалы Blaze не в API); сравнение тогда идёт по расчёту с парой кинжалов. Раньше T2 без побед при пройденном T4 выходил «нет кинжала · пока не потянуть».
- Гайд Blaze: младшие пройденные тиры показывают набор тира фарма (и кинжалы старше), «Кинжалы по тирам» не советуют покупать пару, если есть сильнее или её тир уже пройден.
- Новость «Гайд Blaze верно оценивает младшие тиры».

## 0.2.44

- `getAvatar` рисует голову сам из скина Mojang (`headFromSkin`: лицо + второй слой, правило старых скинов 64×32); mc-heads.net — только запасной путь, его ответ живёт в кэше 10 минут. Раньше mc-heads иногда присылал голову Steve, и она держалась 6 часов. Кэш — новые файлы `head_*.png`.
- Новость «Головы игроков — по их скину».

## 0.2.43

- Museum и Pet Score без рынка (Ironman, Stranded, Bingo): цены NPC за монеты (`npcCoinPrice`) вместо AH. `museumPage(m, { items })` и `analyzeMember` ставят `npcOnly: true`; у Pet Score нет варианта «питомец максимального уровня» с AH.
- Новость «План для Bingo и Stranded»: пункт про Museum и Pet Score.

## 0.2.42

- `makeBuy(prices, { soldStats })` в `market/quote.js` (перенесён из api): если BIN-лотов нет, но за неделю были продажи — цена по медиане продаж с `noLots: true`. «Как получить» показывает «Купить на аукционе» и для таких вещей (Master Skull и т. п.), шаги без «самый дешёвый сейчас».
- Шаги дропа с Master Mode: «Catacombs 24 и пройденный F7 — без него Master Mode закрыт».
- Новость «Покупка на аукционе в „Как получить“».

## 0.2.41

- Словарь подсказок: COMMON-аксессуары из одного слова (Runebook) — ссылки; знаки ™ ® © не мешают (`InfiniPot™`, `InfiniVacuum™ Hooverius`: словарь хранит имя без знака, `findPhrases` пропускает знак между словами).
- Питомцы в шагах плана (`pets-missing`, кап Taming, `pets-level`, Pet Item) пишутся «X Pet» (`petName` в `advisor/lib/util.js`), чтобы ссылка вела на питомца, а не на моба.

## 0.2.40

- Bingo: `bingoGoalsLeft(resp, event)` в `lib/live-status.js` (цели ивента с `lore`), `member.bingoGoals` у профиля Bingo, шаг плана `bingo-goals` (`bingoRules`).
- Stranded (`island`): шаги про Dungeons, Kuudra, Crimson Isle, Rift, HOTM, HOTF и их снаряжение убираются из плана (`STRANDED_AWAY`).
- Новость «План для Bingo и Stranded».

## 0.2.39

- «План добычи» (`roadmap/farm.js`, `buildFarmPlan`, `farmSource`): для профилей без рынка — шаги плана по важности, у каждой вещи где взять (NPC с островом, ценой и координатами, крафт с материалами «есть / нужно», Forge, дроп с мобом, островом и шансом). Правки игрока — в той же корзине, что «План покупок» (`farmSkipKey`).
- Новость «„План добычи“ для Ironman».

## 0.2.38

- `analyzeCraft(member, { buy })`: с ценой покупки (обычный профиль) вещь остаётся, только если докупить недостающее дешевле готовой; у неё `buyCost`, `missCost`, `saving`, список по `saving`.
- Новость «Что продать»: пункт про «На что потратить».

## 0.2.37

- Словарь подсказок (`guides/refs.js`, `guides/terms.js`, `glossary.js`) полнее:
  - ресурсы всех коллекций (`collections/data/resource.json`) — ссылки, даже COMMON из одного слова: Wheat, Melon, Mushroom, Sunflower, Moonflower, Emerald…; культуры убраны из `STOP`;
  - питомец из одного слова — ссылка на питомца, если в NEU нет моба с тем же именем (Megalodon, Griffin, Hedgehog, Tarantula); Pet Score в плане пишет «Wolf Pet»;
  - NPC Рифта (`(Rift NPC)`), NPC от трёх букв (Kat), «Maddox the Slayer» и по «Maddox»;
  - зоны Рифта (`rift/data.js`) и зоны Galatea, Dwarven Mines; гемы (Ruby… Peridot); Desk, SkyMart, Plots, фракции, Fallen Star, Fusion Machine, SkyBlock Menu; Fig/Mangrove/Helix/Hunter Fortune;
  - семейства снаряжения одним словом: Lasso, Fishing Net, Black Hole, Hunter Armor.
- Новость «Больше названий открываются нажатием», переводы en.

## 0.2.36

- `canSellCopy` и в аксессуарах: у своих аксессуаров флаг `sellable`; доплата за следующую версию (шаг `tier`, `upgradeFrom`, `acc_upgrade` в `planItemUpgrades`) без вычета младшей версии из Museum или Soulbound.

## 0.2.35

- `lib/item-props.js`: `canSellCopy(it)` — экземпляр, сданный в Museum (одолженный обратно), и Soulbound / Co-op Soulbound продать нельзя. «Без дела лежит» (`money-idle`) и «Что продать» такие вещи не советуют.
- Новости «Что продать из своих запасов» и «Вещи из Museum не советуют продать».

## 0.2.34

- «Что продать» (`stash/sell.js`, `analyzeSell`): вещи из инвентаря, рюкзаков, Ender Chest и мешков — где выгоднее продать (Bazaar, AH или NPC), «сразу» и «подождав», после налога (`ahNet`, `BAZAAR_TAX`); лишние копии снаряжения; нужное плану — в `keep`; без рынка — только NPC и `noNpc`.
- «На что потратить» (`stash/craft.js`, `analyzeCraft`): вещи из плана, на которые уже есть часть ресурсов по рецепту, и чего не хватает.

## 0.2.33

- Ещё варианты для профилей без рынка (Ironman, Stranded, Bingo):
  - `buildObtainGuide(id, { noMarket })`: без Bazaar, аукциона и Dark Auction, в дереве ингредиентов — только NPC и добыча;
  - `sbxpPlan(m, { noMarket })`: Magical Power, Pet Score и Museum без цены за XP;
  - `magicFind(m, { noMarket, obtain })`: шаги без цены NPC остаются с подсказкой «где добыть»;
  - `state.analyzeMember`: Magic Find по ценам NPC, сундуки данжей — по ценам продажи NPC (`npcOnlyCtx`).
- Переводы en для новости и текстов 0.2.32.

## 0.2.32

- Варианты для профилей без рынка (Ironman, Stranded, Bingo), обычный профиль не меняется:
  - новый `lib/npc-shop.js`: `npcCoinOffer` (самое дешёвое предложение NPC только за монеты), `obtainHint` (одна строка «купить у NPC / скрафтить / Forge / выпадает с»);
  - план: опция `obtain` у советчика (`analysis/roadmap.js` передаёт `obtainHint`), `ctx.market`/`ctx.mode`; «Купить: X» → «Купить у NPC …: X — ~цена» или «Добыть: X — где»; цена шага — только если всё продаёт NPC; «монеты» → «нужно добыть»;
  - свои тексты правил без рынка: Booster Cookie за Gems, кинжалы Blaze, броня Kuudra (только улучшение), Rift Prism, Recombobulator, питомцы, миньоны, коллекции, Museum, советы Alchemy/Carpentry;
  - аксессуары (`mp-cheap`) без рынка: из всех недостающих, по порядку NPC → крафт → Forge → дроп, с подсказкой где взять;
  - «Заработок»: `npcOnlyCtx` — покупка только у NPC за монеты, продажа NPC без налога (`buyPrice`/`sellValue` с `ctx.npcOnly`).

## 0.2.31

- Переводы для нового вида «Плана покупок» (web): бюджет с полосой, «+ Своя вещь», строки списка.

## 0.2.30

- Перевод новой легенды тиров на странице «Миньоны» (web).

## 0.2.29

- `coopShared`: уникальные крафты миньонов — объединение `crafted_generators` всех, кто был в коопе, включая ушедших (`deletion_notice`), как в игре и у SkyCrypt / SkyHelper. Коллекции и `members` — по-прежнему только нынешние участники. Если остался один участник, но ушедшие что-то крафтили, `coop` = `{ members: [он], collections: null, minions }`; «кооп» в миньонах, коллекциях и гайде показывается только при `members.length > 1`.

## 0.2.28

- `inv.apiDisabled` верен и тогда, когда Hypixel присылает `inventory` только с Sack of Sacks (`bag_contents.sacks_bag`): так выглядит выключенный Inventory API. Раньше проверялось лишь отсутствие `inventory`, и сумка аксессуаров читалась как пустая.
- `analyzeAccessories` при выключенном Inventory API отдаёт `hidden: true`, пустые `list`/`missing`/`steps` и `highestMp` (наибольший MP из `accessory_bag_storage`) — без плана «купить всё с нуля».

## 0.2.27

- «Как получить»: ингредиенты рецептов (крафт, Forge, NPC, Kat) берутся из всего, что есть у игрока — инвентарь, рюкзаки, эндер-сундук, гардероб, Accessory Bag, мешки, питомцы — а не только из Sacks. У строки `from` — где лежит («рюкзак 1»); «выгоднее всего» считается по тому, что осталось докупить.
- Новый `lib/owned.js` (`whereOwned`, `ownedCount`, `ownedPool`, `takeOwned`) — один источник «что у игрока есть»; `roadmap/cart.js ownedCount` идёт через него.

## 0.2.26

- Шаги плана отдают `catKey` — категорию без перевода (в SKIP_KEYS переводчика): «Нравится / Не хочу» не теряется при смене языка.
- Панель «Сервер»: 404 у файловых хостов (GitHub, jsDelivr) — ответ, а не сбой (иконки ищутся перебором путей).
- «С возвращением»: «Активности в SkyBlock не видно N дн.» вместо «не заходили» (метки активности видят не всё).
- Видео про Fairy Souls подписано «227 из 289».

## 0.2.25

- Шаг плана «Booster Cookie»: +10 Magic Find, как после реворка 0.27.3 (было +15; в блоке Magic Find уже +10).

## 0.2.24

- «С возвращением»: метки активности профиля (parse/activity.js) вместо пустого last_save, перерыв 30+ дней и что нового (analysis/returning.js).
- «Дела на сегодня»: Experiments, квесты Crimson Isle, Matriarch, Garden Visitors по меткам API, сброс в полночь по Нью-Йорку (analysis/dailies.js).
- «Дешёвый SkyBlock XP»: XP по категориям и цена за 1 XP (analysis/sbxp.js, данные NEU sblevels/misc); museumSummary.best.
- Сундуки данжей по открытым этажам: Bedrock/Obsidian, Dungeon Chest Key, Kismet Feather (dungeonChests в market/methods/combat.js).
- «Как получить»: запасы из Sacks в дереве крафта (have/need/rest, fromStock).
- analyzeMember отдаёт returning, dailies, sbxp, chests; новости и переводы.

## 0.2.23

- Magic Find после реворка 0.27.3 (`calc/magic-find.js`): источники MF игрока, что взять дальше по цене за 1 MF, временные баффы, что не видно в API, MF на отдельных мобов и Bestiary. В разборе — `analysis.gear.mf`.
- В профиле `bestiaryKills` (убийства по мобам Bestiary), в `/api/state` не уходит.
- Новость «Magic Find по новым правилам».

## 0.2.21

- `roadmap/cart.js`: план покупок с правками игрока — убрать шаг, добавить свою вещь (`applyCartOp`), подсчёт с вычетом того, что уже есть (`buildCart`, `ownedCount`), хранение у владельца (`getCart`/`setCart`, data/roadmap-cart.json). Купленное уходит само.
- `advise().summary.perHour` — лучший активный заработок в час (`bestPerHour`), для «когда хватит» в плане покупок.
- Новость «План покупок можно править» и перевод для /en/.

## 0.2.18

- Английский перевод кнопки и карточки Discord на сайте.

## 0.2.17

- Рыбалка после апдейтов 2025: Sea Emperor заменён на The Loch Emperor (Moonglade Marsh), добавлены существа Galatea, Torrhus Canyon, Lotus Atoll, новых Хотспотов и Mithril Grubber; Nutcracker — Fishing 28.
- Советы по рыбалке и Foraging без устаревшего: опыт по уровням вместо «лучше всего лава» для всех, Sloth и топоры Galatea вместо Monkey, HotF через задания Hina и Whispers; Thunder Fragment вместо Thunder Shards в тексте.

## 0.2.16

- Новость «Бот Sky Guide в Discord» и её перевод для /en/.

## 0.2.15

- Убрана новость «Роль Verified в Discord»: владелец решил не выпускать её.

## 0.2.14

- Новость «Роль Verified в Discord» и перевод страницы /discord (привязка Discord к нику, api) для /en/.

## 0.2.13

- `calendar/announce.js`: `dueAnnouncements(now)` — какие объявления событий пора отправить в Discord (Jacob и Dark Auction за 5 минут, большие события года и Fishing Festival за 10, открытие выборов, новый мэр с министром, Fire Sales). Только по уже загруженным выборам и Fire Sales, без своих запросов к Hypixel.
- `calendar/jacob.js`: культуры конкурсов Jacob из открытого расписания elitebot.dev (`createJacobCrops`), запрос раз в год SkyBlock.
- `calendar/index.js`: `fireSalesList()`.

## 0.2.12

- Лестницы снаряжения получили `style` (bow / melee / mage). Новая лестница `dungeon-melee-weapon` для Berserk: Livid Dagger / Shadow Fury (F5) → Giant's Sword (F6) → Dark Claymore (M7); требование `masterFloor`.
- Меч против слеера (Revenant, Voidgloom) при луке Juju/Terminator опускается на 15 и поясняет, что лук — свой стиль. Кинжалы Blaze не трогаем: они обязательны.

## 0.2.11

- Перевод новости «Советы плана стали точнее» для /en/ (api-тест seo падал на русском тексте).
- Лестницы снаряжения: «Купить: … на Auction House» вместо «(Bazaar или аукцион)» — оружие и броня на Bazaar не продаются.

## 0.2.10

- Советчик: `hitGain` учитывает Crit Chance, если прибавка его меняет (смена Power Fortuitous → Bloody больше не даёт +139%); в шаге — предупреждение о падении Crit Chance.
- `tuningPoints` = MP / 10: Accessory Enrichment очков Tuning не даёт (ложный шаг «распредели Tuning» у игроков со всем распределённым).
- Booster Cookie: +15 Magic Find (было +10). Kuudra: «фарми Infernal», а не «переходи на Infernal» при сотнях заходов. Коллекции: «до тира N из M осталось …» вместо двусмысленного «тир 10/10».
- Культуры в Crop Upgrades по-английски. Лестница фермерской брони: + Helianthus. Ключевой питомец Farming — Mooshroom Cow вместо Elephant. Final Destination Armor не советуется при Enderman 9.

## 0.2.9

- Новость о Discord-сервере Sky Guide (с переводом).

## 0.2.8

- `knownStatus(uuid, maxAge)` в `live.js`: онлайн из недавней проверки (5 минут) без нового запроса — для «Рейтинга».

## 0.2.7

- `live.js`: запросы с ключом ради «живых» сведений, с кэшем (`createCached`). `/status` — онлайн и остров (`member.online`), пока профиль смотрят (у чужих — пока хватает лимита), не чаще раза в 2 минуты на игрока. `/skyblock/bingo` — `member.bingo` (очки, ивенты, нынешний ивент), раз в 6 часов; у чужих игроков — только при Bingo-профиле. `/skyblock/news` — `skyblockNews()`, патчноуты SkyBlock, раз в 3 часа на весь сайт.
- `lib/live-status.js`: разбор ответов (`statusOf`, `islandName`, `bingoOf`, `bingoEventOf`, `skyblockNewsOf`).
- Календарь: `setBingo` / `bingoEvent` / `bingoEvents` — ивент Bingo из `/resources/skyblock/bingo` (без ключа, вместе с Fire Sales).
- Расход ключа: вид запросов `status`.
- Демо: `data/fixture-status.json`, `data/fixture-bingo.json`.

## 0.2.6

- Перевод подсказки «Гильдия {0}» (название гильдии без тега в «Рейтинге»).

## 0.2.5

- Зелья и баффы игрока: `member.effects` (`lib/effects.js`: действующие, на паузе, выключенные зелья с временем и статами по уровням, торты Century Cake; `buffTotals`).
- Из ответа `/player`, который уже грузится ради ранга, — `member.hypixel` (`lib/hypixel-player.js`: Network Level, Achievement Points, первый вход, ссылки, SkyBlock-достижения); `hypixelInfo(uuid)` в `rank.js`. Новых запросов нет.
- Данжи: `bestScore`, `masterBestScore`, `mostDamage` (по классам), `watcherKills`; Jacob's Contest: `jacob.contests` (`contestStats`: всего, медали за всё время, лучшее место).
- «Рекорды»: `extras.deathCauses`, `extras.petMilestones` + `view.petMilestones` (вехи Rock/Dolphin), `extras.communityUpgrading` + `view.upgrading` (что строится в Community Shop).
- Fire Sales: `getFireSales` (`/skyblock/firesales`, без ключа) раз в 20 минут вместе с мэром; `setFireSales` / `fireSaleEvents` — события в календаре.
- Демо: `data/fixture-player.json` даёт ранг и сведения Hypixel.

## 0.2.4

- Networth ближе к SkyHelper-Networth, своя оценка остаётся основной. Вещи без рынка идут по цене крафта (`parse/craft-value.js`, по рецептам NEU, ингредиенты без цены считаются как 0). Добавлены открытые слоты гемов Divan (×0,9) и Kuudra (×0,6), предметы для звёзд (Heavy Pearl), торты из New Year Cake Bag, Thunder in a Bottle, Overclocker, Sil Ex, части удочки и предметы-улучшения зачарований. Для «тяжёлых» ultimate коэффициенты ×0,2–0,65, накопительные зачарования считаются по книге I.
- `networth.cosmetic`: сколько из оценки дают скины и краски (на предметах, в музее и у питомцев). Сумма в `total` не меняется. `itemValueParts(it)` возвращает `{ value, cosmetic }`.
- Старые точки истории не пересчитываются. После обновления networth вырастет примерно на 3–5%.

## 0.2.3

- Гильдия игрока: `guild.js` (`guildFor`, кэш на час по uuid, на диске `data/guild-cache.json`), запрос `getGuild` — `/guild?player=`. В профиле `member.guild`: `{ name, tag, tagColor, rank, joined, members, level }`.
- `createPlayers` принимает `guildFor`: гильдия друга запрашивается параллельно с профилем, новый запрос — только при запасе лимита больше 10.

## 0.2.2

- «Мои лоты»: свои лоты Auction House со статусом (продан, истёк, висит, есть дешевле) и свои ставки (перебили или лидер) — `player-auctions.js` (`createPlayerAuctions`), чистые расчёты — `market/my-auctions.js` (в публичном входе как `myAuctions`).
- Скан аукциона собирает индекс ставок по игрокам (`bidsOf`), `auctionItemOf` разбирает предмет лота; `getPlayerAuctions` — запрос `/skyblock/auction?player=`.

## 0.2.1

- Аксессуары: шаги плана «что сделать дальше» (`steps`: покупка, tier, Recombobulator, Enrichment по цене за 1 MP) и `enrichPrice`; у аксессуаров `tier`, `stat`, `how`, у недостающих — `req`.
- Переводы английской версии: «Обзор» (Bank в коопе), заголовок стартовой.

## 0.2.0

Несовместимо с 0.1.0. В api при переходе: первой строкой `src/index.js` — `import 'dotenv/config'`, в зависимости — `@anthropic-ai/sdk`.

- Публичный вход `import { … } from '@sky-guide/core'`: чистые расчёты (бой, статы, рынок, календарь, Rift, Museum, новости).
- Тест границ: публичный вход не тянет диск, сеть, `process.env` и таймеры и собирается для браузера; в core нет маршрутов HTTP.
- core больше не читает `.env` сам: api загружает его первой строкой (`import 'dotenv/config'`).
- `@anthropic-ai/sdk` — необязательная зависимость: её ставит api, если включён живой советчик.
- Сторож личных строк в `npm test`: ники и почта сверяются по хешам, сам список в репо не хранится.
- Описание слоёв — `docs/architecture.md`.
- Аксессуары: у пробелов в Accessory Bag есть следующее улучшение (`next`) и признаки `canRecomb` / `canEnrich`.
- Тесты свечей перенесены в core.

## 0.1.0

Первая версия: расчёты сайта, перенесённые из старого репо без изменений.
