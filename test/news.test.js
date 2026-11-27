// «Новости» (src/news/entries.js): порядок записей, id, запрещённые слова; ответ /api/news проверяет api.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEWS, KIND_RU } from '../src/news/entries.js';
import { newsView } from '../src/news/index.js';
import { newsLinks, plainNews } from '../src/news/links.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WEB_SRC, skipNoWeb } from './_web.js';
import { GUIDES as GUIDE_LIST } from '../src/guides/index.js';
const GUIDES = path.dirname(fileURLToPath(new URL('../src/guides/index.js', import.meta.url)));
const clientSrc = () => {
  const out = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (/\.jsx?$/.test(f.name)) out.push(fs.readFileSync(p, 'utf8'));
  } };
  walk(WEB_SRC);
  return out.join('\n');
};

test('записи: самая новая первой, id уникальны и начинаются с даты', () => {
  assert.ok(NEWS.length > 0);
  const ids = new Set();
  for (let i = 0; i < NEWS.length; i++) {
    const e = NEWS[i];
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, `${e.id}: дата ГГГГ-ММ-ДД`);
    assert.ok(e.id.startsWith(e.date), `${e.id}: id начинается с даты`);
    assert.match(e.id, /^[a-z0-9-]+$/, `${e.id}: id латиницей`);
    assert.ok(!ids.has(e.id), `${e.id}: id повторяется`);
    ids.add(e.id);
    assert.ok(KIND_RU[e.kind], `${e.id}: kind — new, better или fix`);
    assert.ok(e.title && Array.isArray(e.items) && e.items.length, `${e.id}: есть заголовок и пункты`);
    if (i) assert.ok(NEWS[i - 1].date >= e.date, `${e.id}: записи идут от новых к старым`);
  }
});

test('в новостях нет ников владельца и друзей, технических слов и советчика для гостей', () => {
  const text = NEWS.flatMap(e => [e.title, ...e.items]).join('\n');
  for (const bad of ['OwnerCat', 'Friend4ik', 'Nightowl', 'Zucchini', 'Pomegranate']) assert.ok(!text.includes(bad), `ник: ${bad}`);
  for (const bad of [/\bPR\b/, /\bAPI\b/i, /\be2e\b/i, /\bdevelop\b/i, /\bdeploy/i, /\bcommit/i, /\bgit\b/i, /\.env\b/, /ветк[аиу]/i, /\bSMTP\b/i, /советчик/i])
    assert.ok(!bad.test(text), `техническое слово или скрытая возможность: ${bad}`);
});

test('новости короткие: заголовок до 6 слов, до 4 пунктов, пункт до 130 знаков, без «ты» и устройства сайта', () => {
  const word = w => new RegExp(`(?<![\\p{L}])(${w})(?![\\p{L}])`, 'iu');
  for (const e of NEWS) {
    assert.ok(plainNews(e.title).split(/\s+/).length <= 6, `${e.id}: заголовок длиннее 6 слов`);
    assert.ok(e.items.length <= 4, `${e.id}: больше 4 пунктов — разбей на темы или вычеркни лишнее`);
    for (const t of [e.title, ...e.items]) {
      const p = plainNews(t);
      assert.ok(p.length <= 130, `${e.id}: пункт длиннее 130 знаков: ${p}`);
      for (const bad of ['ты', 'тебе', 'тебя', 'твой', 'твоя', 'твои', 'твоё', 'мы', 'нам'])
        assert.ok(!word(bad).test(p), `${e.id}: без обращения на «ты» и без «мы» (${bad}): ${p}`);
      for (const bad of ['данные', 'данных', 'загрузк[а-я]*', 'сервер[а-я]*', 'браузер[а-я]*', 'кэш[а-я]*', 'больше не нужно'])
        assert.ok(!word(bad).test(p), `${e.id}: устройство сайта или оправдание (${bad}): ${p}`);
    }
  }
});

test('ссылки в новостях ведут на существующий раздел и блок', { skip: skipNoWeb }, () => {
  const app = fs.readFileSync(path.join(WEB_SRC, 'App.jsx'), 'utf8');
  const pages = new Set([...app.slice(app.indexOf('const PAGES')).matchAll(/\{ id: '([a-z-]+)'/g)].map(m => m[1]));
  const guides = new Set(fs.readdirSync(GUIDES).filter(f => f.endsWith('.js'))
    .flatMap(f => [...fs.readFileSync(path.join(GUIDES, f), 'utf8').matchAll(/export default \{\s*id: '([a-z-]+)'/g)].map(m => m[1]))
    .concat(GUIDE_LIST.map(g => g.id))); // гайды слееров собираются кодом
  // Блоки гайдов (секции с news: '…') приходят с сервера, поэтому ищем и в core/src/guides
  const src = clientSrc() + fs.readdirSync(GUIDES).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(GUIDES, f), 'utf8')).join('\n');
  const links = newsLinks(NEWS);
  assert.ok(links.length > 0);
  for (const l of links) {
    const [page, sub] = l.path.split('/');
    assert.ok(pages.has(page), `${l.id}: нет раздела «${page}» (ссылка «${l.label}»)`);
    if (page === 'guides' && sub) assert.ok(guides.has(sub), `${l.id}: нет гайда «${sub}»`);
    if (l.anchor) assert.ok(new RegExp(`(data-news="${l.anchor}"|news="${l.anchor}"|news: '${l.anchor}')`).test(src),
      `${l.id}: на сайте нет блока с data-news="${l.anchor}" (ссылка «${l.label}»)`);
  }
  assert.equal(plainNews('В [Запасах](stash/essence#essence) сверху'), 'В Запасах сверху');
});
