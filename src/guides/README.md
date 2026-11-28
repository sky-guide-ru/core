# Гайды (`server/guides/`)

Личные гайды по направлениям игры. Один файл — один гайд (или несколько, если они похожи, как слееры).

## Как добавить гайд

1. Создай `server/guides/<id>.js`:

```js
export default {
  id: 'rift', title: 'Рифт', icon: 'RIFT_PRISM', group: 'rift',
  build(m, ctx) { return { summary: '…', status: 'progress', sections: [] }; },
};
```

2. Добавь импорт и одну строку в `GUIDES` в `server/guides/index.js`.
3. Если нужен свой вид страницы — `client/src/guides/<Name>.jsx` и строка в `CUSTOM` в `client/src/guides/index.js`. Без этого гайд рисуется общим рендером.

`group` — ключ из `GROUPS` (combat, rift, fishing, mining, farming, skills, other). Новую группу добавь туда же.
`icon` — SkyBlock id предмета (рисуется через ItemIcon, с текстурами паков).

## Что возвращает `build(member, ctx)`

```js
{
  summary: 'Одна строка: где ты сейчас',
  status: 'start' | 'progress' | 'done' | 'locked',
  level: { label: 'Catacombs', value: 27, max: 50 },      // необязательно
  next: [{ title, why, priority }],                        // что делать дальше, по убыванию priority (0..100)
  sections: [Section],
}
```

Section (`kind`):

- `text`: `{ kind: 'text', title, text: string | string[] }`
- `steps`: `{ kind: 'steps', title, items: [{ title, text?, done?, current?, items?: [id] }] }`
- `checklist`: `{ kind: 'checklist', title, items: [{ text, done, hint?, item? }] }`
- `shapes`: `{ kind: 'shapes', title, items: [{ name, cells: [[x, y]], badge?, text?, hint?, done?, item? }] }` — фигуры на сетке (окаменелости Fossil Excavator)
- `miningEvents`: `{ kind: 'miningEvents', title, note? }` — живой блок «что идёт сейчас»: сайт сам берёт `/v1/mining-events` (calendar/mining.js)
- `cards`: `{ kind: 'cards', title, items: [{ name, text, tags?: [{ text, tone? }], lines?: [string], more?: { title, lines }, dim? }] }` — карточки с раскрываемыми подробностями (загадки Dungeons)
- `table`: `{ kind: 'table', title, columns: [string], rows: [[Cell]], current?: rowIndex }`, где Cell — строка, число или `{ text, item?, tone?: 'good'|'bad'|'warn'|'muted' }`

Любая секция может иметь `note` (мелкий текст под заголовком).

Последней оболочка сама добавляет секцию `sources` («Источники», `sources.js`): базы данных (API, NEU, SkyHanni), страницы fandom-вики (`WIKI_EXTRA` + `GUIDE_PAGES` из `wiki/watch.js`) и видеогайды (`VIDEOS`). Новое видео добавляй, только открыв его: id, своя подпись по-русски, канал, язык и оригинальное название.

## Контекст `ctx`

`{ m, analysis, inv, price(id), priceInfo(id), name(id), owned, has(id), adv }`, где `adv` — контекст advisor (`makeCtx`): `adv.data.slayerXp`, `adv.data.slayerBossXpType` и т. д.

## API

- Маршруты берут выбранного игрока (`req.sbView()`: свой профиль или друг).
- `GET /api/guides` → `{ groups, guides: [{ id, title, icon, group, summary, status, level, nextCount, next: [первый шаг] }] }`
- `GET /api/guides/:id` → гайд целиком
