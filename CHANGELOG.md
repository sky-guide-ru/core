# Что менялось в core

Правила номеров — [CONTRIBUTING.md](CONTRIBUTING.md#версии).

## Не выпущено

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
