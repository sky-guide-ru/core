# Как устроен core

`@sky-guide/core` — расчёты Sky Guide без HTTP. Сервер ([api](https://github.com/sky-guide-ru/api)) получает
данные Hypixel, вызывает функции ядра и отдаёт результат сайту, боту и моду. Сайт ([web](https://github.com/sky-guide-ru/web))
берёт из core только словари перевода `i18n/`.

Внутри три слоя. Чем ниже слой, тем больше он знает об окружении.

## 1. Чистые расчёты — публичный интерфейс

```js
import { bazaar, flips, calendar } from '@sky-guide/core';

const products = bazaar.parseBazaar(await (await fetch('https://api.hypixel.net/v2/skyblock/bazaar')).json());
const best = flips.bazaarFlips({ bazaar: products }, { budget: 10_000_000 }); // флипы под бюджет 10M
const now = calendar.calendarView(Date.now());                               // мэр, событие, дата SkyBlock
```

Всё, что экспортирует [`src/index.js`](../src/index.js): урон и статы, «что надеть», готовность к Slayer, календарь и мэры,
разбор Bazaar и AH, свечи, флипы, доход с культур и дропа, банк, Bits, Chocolate Factory, Pet Score, Rift, Museum,
новости, тег `ru` для переводимых строк.

Правила слоя:

- на вход — данные, на выход — результат; цены, время, профиль передаются параметром;
- нельзя: `node:fs` и другие модули Node, `fetch`, `process.env`, таймеры, импорт серверного слоя;
- поэтому слой работает в любом JS: Node, браузер, Bun, Discord-бот, JS-движок в моде.

Это проверяет `test/boundaries.test.js`: он идёт по импортам от `src/index.js` и собирает вход для браузера.
Изменение того, что отсюда экспортируется, подчиняется правилам версий (см. [CONTRIBUTING.md](../CONTRIBUTING.md#версии)).

## 2. Расчёты с базой предметов — Node

Разбор профиля (`parse/`), план «Что делать» (`advisor/`, `roadmap/`), гайды (`guides/`), русская база предметов
(`items-ru/`, `analysis/obtain.js`, `names.js`), Museum, Essence, коллекции. Логика тоже чистая, но модули сами
читают базу NEU и свои JSON из `src/**/data/`, поэтому работают только в Node.

Подключаются по пути файла: `import { advise } from '@sky-guide/core/advisor/index.js'`.

## 3. Серверный слой — только для api

Загрузка и кэш: `hypixel.js`, `http.js`, `neu.js`, `prices.js`, `state.js`, `players.js`, `rank.js`, `icons.js`, `packs.js`,
`market/backfill.js`. Хранилища в папке данных сервера: `history.js`, `market/chart-store.js`, `roadmap/hidden.js`,
`rift/marks.js`, `collectibles/marks.js`, `lib/disk-cache.js`, `lib/key-usage.js`, `lib/api-stats.js`, `wiki/watch.js`.
Настройки из окружения — `config.js` (сам `.env` читает api). Живой ИИ-советчик `live-advisor/` — только для владельца
сайта, пакет `@anthropic-ai/sdk` ставит api.

Пути к папкам приходят из `config.js` или параметром; маршрутов (`app.get`, `express`) в core нет — это тоже проверяет тест.

Ещё не переехали в api: `lib/view-error.js` (отвечает через `res`) и `preferredLang`/`langMiddleware` в `i18n/lang.js`
(читают `req`). Переносятся вместе с правкой в api.

## Что значит «внутренний»

Слои 2 и 3 доступны по пути файла (`@sky-guide/core/<путь>`), но это внутренний интерфейс сервера: он может меняться
в любой версии. api закрепляет точную версию core, поэтому ничего не ломается само. Если функция нужна снаружи
(боту, моду, другому проекту) — её переносят в слой 1 и добавляют в `src/index.js`.

## Куда класть новое

| Что | Куда |
|---|---|
| Формула, таблица из игры, разбор ответа Hypixel | слой 1, экспорт в `src/index.js` |
| Нужна база NEU или русские названия | слой 2 |
| Скачать, закэшировать, записать на диск | слой 3 |
| Адрес `/api/*` или `/v1/*`, вход, cookie | репо api |
| Экран, кнопка, текст на странице | репо web (текст — по-русски, перевод в `i18n/en/`) |
