# live-advisor — «Живой советчик»

ИИ-слой трекера, который дёшево следит за профилем и ценами и объясняет на русском, что делать дальше.

## Как устроено

```
каждую минуту (бесплатно)                      только при важных изменениях / по вопросу
профиль + цены ─► движок правил (advisor) ─► сторож ───────────────► Claude Haiku 5.5 ─► совет на сайте
                                              │  вес изменений          (сводка ~1,5k токенов,
                                              │  пауза ≥15 мин           системный промпт из кэша)
                                              └► «ничего важного» — токены не тратятся
```

1. **Сторож** (`lib/watcher.js`) сравнивает текущий снимок профиля со снимком на момент прошлого совета и
   набирает «вес»: новый уровень скилла 3, первый уровень слеера 4, первое прохождение M-этажа 4, сменился главный шаг
   плана 4, стало хватать денег на покупку из плана 4, цена нужного предмета изменилась на 10%+ (2) или 25%+ (3),
   монеты ±20M (2), MP ±20 (3), мелкий прогресс 0,5–1. Мелочи копятся, пока не наберут вес.
2. **Решение** (`shouldCall`): вес ≥ 3 и с прошлого совета прошло ≥ 15 минут; при весе ≥ 8 хватает 5 минут.
3. **Сводка** (`lib/digest.js`): профиль, топ-8 шагов движка правил (у трёх первых с «как»), план покупок,
   заработок, цены предметов из шагов. Детерминированный текст ~1,5–2 тыс. токенов.
4. **Claude** (`lib/llm.js`):
   - автосовет — структурированный JSON (`headline`, `changes`, `now[]`, `money`, `warnings[]`), effort `low`;
   - чат — с инструментами `get_item` (русская база предметов; понимает приставки перековки вроде Withered/Heroic и
     показывает экземпляр игрока), `get_price`, `get_steps`, `get_money_methods`, `get_gear` (надетое, оружие, сеты брони,
     экипировка, инструменты: перековка, звёзды, HPB/FPB, recomb, зачарования, камни, атрибуты и итоговые статы из лора),
     `compare_weapons` (статы оружия + надетой брони и оценка урона за удар), `find_items` (все хранилища и мешки),
     `get_pets`, `get_accessories`;
     модель сама запрашивает подробности, поэтому сводка остаётся маленькой; надетая броня, её статы и оружие с оценкой
     урона уже лежат в сводке, так что частые вопросы обходятся без инструментов;
   - скорость: Haiku с effort `low`, не больше 2 раундов инструментов (у «Подробнее» effort `medium` и 3 раунда),
     ответ идёт на сайт потоком (`POST /api/live/ask` с `stream: true` отдаёт `text/event-stream`: события `text`, `tool`,
     `done`), пока модель вызывает инструмент, сайт пишет, что она смотрит; время ответа видно под ним и в логе сервера;
   - «Подробнее» — тот же чат на Claude Sonnet 5.5 (с серверным фолбэком на случай отказа).
   - Системный промпт (роль, правила, сжатый справочник по игре) кэшируется на 1 час, сводка в чате — на 5 минут.
5. **Бюджет** (`lib/budget.js`): дневной лимит (по умолчанию $0,20), автосоветы останавливаются на 80%, остаток —
   для чата. Стоимость каждого ответа видна на сайте.

Без `ANTHROPIC_API_KEY` модуль работает в режиме `free`: сторож и шаги движка правил есть, ИИ не вызывается.

## Сколько стоит (Haiku 5.5: $0,10 / $0,50 за 1 млн токенов, чтение кэша 0,1×)

| что | токены | цена |
|---|---|---|
| автосовет | ~1,5k вход + ~1,4k из кэша + ~0,8k выход | ~$0,0005–0,001 |
| вопрос в чате (1–2 инструмента) | ~2× по входу | ~$0,001–0,003 |
| «Подробнее» (Sonnet 5.5) | | ~$0,02–0,04 |

Симуляция 4 часов игры (9 автосоветов + 2 вопроса, один из них «Подробнее»): ~$0,03. Активные 6 часов в день — около
$0,04 в день, ~$1,3 в месяц. Точные цифры даёт `npm run simulate:live`.

## API (`index.js`)

```js
const live = createLiveAdvisor({
  apiKey: process.env.ANTHROPIC_API_KEY,  // или client: готовый/поддельный клиент
  model: 'claude-haiku-5-5', deepModel: 'claude-sonnet-5-5',
  dailyUsd: 0.20, tz: 'Europe/Moscow', dataDir: 'data',
  deps: { priceOf, priceTrend, priceInfo, itemName, getItemRu, searchItems, pricesRaw },
});
await live.update({ member, analysis });   // после каждого обновления профиля/цен → { check, advice|null }
await live.ask('Что качать?', { deep });   // → { q, a, model, usd, tools }
await live.refreshAdvice();                // кнопка «Обновить совет»
live.setSettings({ enabled, dailyUsd, model, minIntervalMin, minScore });
live.getState();                           // { mode, advice, pending, chat, budget, ... } для сайта
live.bus.on('advice' | 'chat' | 'check', fn);
```

Отдельно: `makeSnapshot`, `diffSnapshots`, `shouldCall`, `buildDigest`, `buildDelta`, `costOf`, `Budget`, `createMockClient`.

## Подключение к ядру

1. Скопировать модуль в `server/live-advisor/`, добавить зависимость `@anthropic-ai/sdk`.
2. В `server/index.js` после `app.use(auth.router)`:
   ```js
   import { attachLiveAdvisor } from './live-advisor/integration/attach.js';
   attachLiveAdvisor({ app, bus, state, dataDir: config.dataDir,
     deps: { priceOf, priceInfo, priceTrend: id => priceInfo(id).trend, itemName: id => neu.items.get(id)?.name || id,
             getItemRu, searchItems, pricesRaw: prices } });
   ```
   и в `/api/stream` переслать событие `live` (`bus.on('live', ...)`).
3. Маршруты: `GET /api/live/state`, `POST /api/live/ask {question, deep}`, `POST /api/live/refresh`,
   `POST /api/live/settings`, `POST /api/live/chat/clear`. Они за паролем сайта (`SITE_PASSWORD`), потому что тратят деньги.
4. `.env`: `ANTHROPIC_API_KEY=` (ключ из Claude Console, не коммитить), необязательно `LIVE_DAILY_USD`, `LIVE_MODEL`, `LIVE_TZ`.
5. Панель: пример в `integration/LiveAdvisorPanel.jsx`.

## Тесты и прогон

```bash
npm test                    # node --test, без сети и ключа
npm run simulate            # 4 часа игры на поддельном клиенте → test-run/report.md
npm run simulate:live       # то же с настоящим Claude (ключ в .env), стоит ~1–3 цента
```
