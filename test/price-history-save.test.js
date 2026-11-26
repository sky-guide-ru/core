// История цен пишется по кускам: тот же JSON, что и разом, но без долгой остановки сервера
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';

test('история цен: запись по кускам совпадает с записью разом и не держит сервер', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-'));
  process.env.DATA_DIR = dir;
  const { prices, saveHistory, saveHistorySoon } = await import('../src/prices.js?chunked');
  const now = 1_700_000_000_000;
  for (let i = 0; i < 1500; i++) prices.history[`ITEM_${i}`] = Array.from({ length: 50 }, (_, j) => [now - j * 3600e3, i + j, i * 2 + j]);
  for (let i = 0; i < 1500; i++) prices.binHistory[`BIN_${i}`] = Array.from({ length: 50 }, (_, j) => [now - j * 3600e3, i * 10 + j]);
  const file = path.join(dir, 'price-history.json');
  saveHistory(true);
  const ref = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.rmSync(file);
  const h = monitorEventLoopDelay({ resolution: 5 }); h.enable();
  await saveHistorySoon(true);
  h.disable();
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), ref);
  assert.equal(fs.existsSync(file + '.tmp'), false);
  assert.ok(h.max / 1e6 < 200, `сервер замирал на ${Math.round(h.max / 1e6)} мс`);
  fs.rmSync(dir, { recursive: true, force: true });
});
