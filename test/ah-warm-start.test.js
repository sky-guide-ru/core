// Тёплый старт аукциона: снимок lowest BIN с прошлого запуска поднимается, если ему не больше 30 минут
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-warm-'));
process.env.DATA_DIR = dir;
const { prices, loadLowestBin } = await import('../src/prices.js');

test('снимок аукциона: свежий поднимается, старый — нет', () => {
  const at = Date.now() - 5 * 60_000;
  fs.writeFileSync(path.join(dir, 'ah-lowest.json'), JSON.stringify({ at, bin: [['HYPERION', { price: 1e9, count: 3, second: 1.1e9, auction: 'a' }]], binVar: [['HYPERION@5r', { price: 1.2e9, count: 1, second: 0, auction: 'b' }]] }));
  assert.equal(loadLowestBin(at + 40 * 60_000), false, 'старше 30 минут — ждём свежий скан');
  assert.equal(prices.binAt, 0);
  assert.equal(loadLowestBin(), true);
  assert.equal(prices.binAt, at);
  assert.equal(prices.bin.get('HYPERION').price, 1e9);
  assert.equal(prices.binVar.get('HYPERION@5r').price, 1.2e9);
  assert.equal(loadLowestBin(), false, 'после скана снимок не перетирает свежие цены');
});
