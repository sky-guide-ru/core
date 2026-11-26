# Sky Guide · core

Расчёты сайта [sky-guide.ru](https://sky-guide.ru) без HTTP: разбор профиля Hypixel SkyBlock, план «Что делать», рынок Bazaar и аукциона, способы заработка, гайды, русская база ~9000 предметов, переводы для английской версии.

## Что внутри

| Папка | Что там |
|---|---|
| `src/parse/`, `src/analysis/` | разбор профиля и аналитика |
| `src/advisor/`, `src/roadmap/` | план прогрессии «Что делать» |
| `src/market/`, `src/prices.js` | цены, свечи, флипы, способы заработка |
| `src/items-ru/`, `src/wiki/` | русская база предметов и вики |
| `src/guides/`, `src/news/`, `src/calendar/` | гайды, новости сайта, календарь SkyBlock |
| `src/hypixel.js`, `src/neu.js`, `src/players.js`, `src/state.js` | загрузка данных Hypixel и NEU с кэшем |
| `i18n/` | словари английской версии и сборщик текста |
| `test/` | `npm test`, фикстуры в `test/fixtures/` |

## Как подключить

```
npm install github:sky-guide-ru/core#v0.2.1
```

```js
import { bazaar, flips, calendar, damage } from '@sky-guide/core';
```

Главный вход `@sky-guide/core` — чистые расчёты: без диска, сети, `process.env` и таймеров, работают в Node, браузере,
боте и моде на JS-движке. Это проверяет тест. Остальное доступно по пути файла (`@sky-guide/core/advisor/index.js`),
но это внутренний слой сервера, он меняется без предупреждения. Слои и куда класть новый код — [docs/architecture.md](docs/architecture.md).

Версии — теги `vX.Y.Z`, правила и что поменялось — [CONTRIBUTING.md](CONTRIBUTING.md#версии) и [CHANGELOG.md](CHANGELOG.md).

## Репо проекта

| Репо | Что там |
|---|---|
| [core](https://github.com/sky-guide-ru/core) | расчёты без HTTP: разбор профиля, план «Что делать», рынок, гайды, русская база предметов, переводы. Пакет `@sky-guide/core` |
| [api](https://github.com/sky-guide-ru/api) | сервер: адреса `/api/*`, вход и аккаунты, SEO-страницы, OpenAPI и Swagger |
| [web](https://github.com/sky-guide-ru/web) | сайт [sky-guide.ru](https://sky-guide.ru) на React + Vite, данные берёт только у api |
| [deploy](https://github.com/sky-guide-ru/deploy) | запуск на сервере: Docker, Caddy, автообновление, бэкапы, браузерный e2e |

Как запустить у себя и прислать правку — [CONTRIBUTING.md](CONTRIBUTING.md). Лицензия — [AGPL-3.0](LICENSE).
