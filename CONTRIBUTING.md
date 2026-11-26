# Как помочь Sky Guide

Sky Guide — русскоязычный сайт-помощник по Hypixel SkyBlock ([sky-guide.ru](https://sky-guide.ru)). Код разделён на четыре репо:

| Репо | Что там |
|---|---|
| [core](https://github.com/sky-guide-ru/core) | расчёты без HTTP: разбор профиля, план «Что делать», рынок, гайды, русская база предметов, переводы. Пакет `@sky-guide/core` |
| [api](https://github.com/sky-guide-ru/api) | сервер: адреса `/api/*`, вход и аккаунты, SEO-страницы, OpenAPI и Swagger |
| [web](https://github.com/sky-guide-ru/web) | сайт [sky-guide.ru](https://sky-guide.ru) на React + Vite, данные берёт только у api |
| [deploy](https://github.com/sky-guide-ru/deploy) | запуск на сервере: Docker, Caddy, автообновление, бэкапы, браузерный e2e |

## Рабочая папка

Нужен [Node.js 22+](https://nodejs.org). Склонируй репо рядом друг с другом и свяжи их одной общей папкой:

```
mkdir sky-guide && cd sky-guide
git clone https://github.com/sky-guide-ru/core && git clone https://github.com/sky-guide-ru/api && git clone https://github.com/sky-guide-ru/web && git clone https://github.com/sky-guide-ru/deploy
echo '{"private":true,"workspaces":["core","api","web","deploy"]}' > package.json
npm install
```

Так `api` и `web` берут `core` из соседней папки, и правка в расчётах сразу видна на сайте.

## Запуск у себя

```
cd api
cp ../deploy/.env.example .env          # впиши HYPIXEL_API_KEY с https://developer.hypixel.net
node ../core/scripts/make-fixture.js    # или без ключа: тестовый профиль и цены в data/
npm run dev                             # сервер на http://localhost:3000
cd ../web && npm run dev                # сайт на http://localhost:5173, /api идёт на :3000
```

## Проверки

- `npm test` — в каждом репо свои тесты. Сверки с исходниками сайта (ссылки в новостях, подписи CSS) идут, когда `web` лежит рядом,
  иначе пропускаются.
- `npm run e2e` в `deploy` — прогон сайта в браузере на компьютере и телефоне (перед ним `npm run build` в `web`).

## Pull request

1. Ветка от `main` в нужном репо, одна тема на PR.
2. Правила текстов, игровых терминов и новостей — в `CLAUDE.md` (одинаковый во всех репо).
3. `npm test` зелёный; если меняется вид — скриншот в описании.
4. Сливает владелец после проверки. В `main` напрямую не пушим.

Правка сразу в расчётах и на экране: сначала PR в `core` (с новым номером версии: после слияния тег ставится сам), потом PR в `api`/`web` с новой версией.

## Версии

Версии core — теги `vX.Y.Z`. Чтобы выпустить версию, PR меняет `version` в `package.json` и переносит записи из «Не выпущено»
в раздел «## X.Y.Z» в CHANGELOG. После слияния `.github/workflows/release.yml` сам ставит тег и создаёт Release.

Пока первая цифра 0:

- **средняя цифра** (`0.1.x` → `0.2.0`) — ломающее изменение публичного входа `@sky-guide/core`: убрали или переименовали
  экспорт, поменяли параметры или форму результата;
- **последняя цифра** (`0.1.0` → `0.1.1`) — новое и исправления, старый код у пользователей работает как раньше;
- внутренние модули (путь файла `@sky-guide/core/<путь>`) — не обещание: api закрепляет точный тег и обновляет его своим PR.

Каждое заметное изменение — строка в [CHANGELOG.md](CHANGELOG.md) в разделе «Не выпущено»; при выпуске раздел получает номер.
Расчёты в слое `src/index.js` не трогают диск, сеть и `process.env` — подробно в [docs/architecture.md](docs/architecture.md).

## Чего в коде быть не должно

- Ключей, паролей, `.env`, папки `data/` — только на сервере.
- Ников игроков, почты, IP и других личных данных. Списки друзей и скрытых игроков задаются в `.env` (`SEED_FRIENDS`, `HIDDEN_PLAYERS`).
- Ключа Hypixel в браузере, моде или боте: по [правилам Hypixel](https://developer.hypixel.net/policies) запросы к Hypixel делает только сервер,
  а данные игроков через наш API получают только наши клиенты по ключу.

Это проверяет `test/no-private.test.js`: он сверяет слова в файлах с хешами из `test/private-hashes.json` (сам список
в открытом репо не лежит). Добавить слово — `node scripts/private-hash.mjs слово`, хеш дописать в этот файл.

Коммить от адреса `…@users.noreply.github.com` (GitHub → Settings → Emails → «Keep my email addresses private»).

## Лицензия

[AGPL-3.0](LICENSE). Присылая PR, ты соглашаешься, что твой код распространяется на тех же условиях.
