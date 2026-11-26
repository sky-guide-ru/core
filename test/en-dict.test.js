// Английская версия: текст сервера находится в словаре (tx`…` по ключу, данные советов, склейки) — без угадывания
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTranslator } from '../i18n/runtime.js';
import { loadDict } from '../i18n/dict.js';
import { messageOf, pairOf } from '../i18n/msg.js';
import { dataStrings, DATA } from '../i18n/sources.js';
import { sourceText, SOURCES } from '../src/guides/hunting-data.js';
import { reqRu } from '../src/analysis/obtain.js';

const t = createTranslator(loadDict(), { messageOf, pairOf });
const CYR = /[А-Яа-яЁё]/;

test('данные советов (лестницы снаряжения, питомцы) целиком есть в словаре', () => {
  const miss = DATA.flatMap(f => dataStrings(JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')))).filter(s => CYR.test(t.tr(s)));
  assert.deepEqual(miss.slice(0, 10), [], `без перевода: ${miss.length}`);
});

test('где взять осколок Hunting: все коды источников по-английски', () => {
  const miss = Object.entries(SOURCES).map(([name, code]) => t.tr(sourceText(name, code))).filter(s => CYR.test(s));
  assert.deepEqual(miss.slice(0, 5), []);
});

test('требования крафта по-английски', () => {
  for (const s of ['Requires: Living Metal Heart IV', 'Requires: Sugar Cane IV']) assert.ok(!CYR.test(t.tr(reqRu(s))), reqRu(s));
});

test('большой ответ переводится быстро', () => {
  const body = Array.from({ length: 3000 }, (_, i) => sourceText('Zealot', 'B|S|K') + (i % 2 ? '' : ' · Lasso'));
  const t0 = performance.now();
  t.deep(body);
  assert.ok(performance.now() - t0 < 300, `${Math.round(performance.now() - t0)} мс`);
});
