# Что менялось в core

Правила номеров — [CONTRIBUTING.md](CONTRIBUTING.md#версии).

## Не выпущено

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
