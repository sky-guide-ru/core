// Русская база предметов собирается в отдельном потоке (сервер в это время отвечает) — результат как у обычной сборки
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFromNeu, loadFromNeuAsync, allItems } from '../src/items-ru/index.js';
import { pairOf } from '../i18n/msg.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/neu-mini.json'), 'utf8'));
const neu = { items: new Map(fx.items.map(j => [j.internalname || j.id, j])), constants: fx.constants || {} };

test('loadFromNeuAsync: та же база, что и в основном потоке, и строки для английской версии', async () => {
  const sync = loadFromNeu(neu);
  await sync.en;
  const a = JSON.stringify(allItems());
  const r = await loadFromNeuAsync(neu);
  assert.equal(r.items, sync.items);
  assert.ok(r.items > 0);
  assert.equal(JSON.stringify(allItems()), a);
  const en = await r.en;
  assert.ok(en.n >= 0);
});

test('пока поток собирает базу, цикл событий свободен', async () => {
  let ticks = 0;
  const t = setInterval(() => ticks++, 5);
  const r = await loadFromNeuAsync(neu);
  clearInterval(t);
  assert.ok(r.items > 0);
  assert.ok(ticks > 0);
  assert.equal(typeof pairOf, 'function');
});
