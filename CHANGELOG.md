# Что менялось в core

Правила номеров — [CONTRIBUTING.md](CONTRIBUTING.md#версии).

## Не выпущено

## 0.2.3

- Зелья и баффы игрока: `member.effects` (`lib/effects.js`: действующие, на паузе, выключенные зелья с временем и статами по уровням, торты Century Cake; `buffTotals`).
- Из ответа `/player`, который уже грузится ради ранга, — `member.hypixel` (`lib/hypixel-player.js`: Network Level, Achievement Points, первый вход, ссылки, SkyBlock-достижения); `hypixelInfo(uuid)` в `rank.js`. Новых запросов нет.
- Данжи: `bestScore`, `masterBestScore`, `mostDamage` (по классам), `watcherKills`; Jacob's Contest: `jacob.contests` (`contestStats`: всего, медали за всё время, лучшее место).
- Демо: `data/fixture-player.json` даёт ранг и сведения Hypixel.

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
