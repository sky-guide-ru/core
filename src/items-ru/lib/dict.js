// Словарь переведённых абзацев лора (data/lore-dict/*.json).
//
// Ключ — абзац на английском без §-цветов, с числами, заменёнными на {0}, {1}, …
// Значение — русский перевод с теми же {N} (порядок можно менять, число можно опустить).
// Благодаря {N} одна запись подходит всем уровням зачарований, тирам миньонов и уровням
// питомцев (у питомцев числа подставляются из petnums уже после сборки базы).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enTerms } from './terms.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'lore-dict');

// «+1,250.5», «-3», «0.5», «20» — но не цифры внутри слов («F7», «T3», «x2» остаются как есть)
const NUM = /(?<![\w.{])[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\})(?=[smhxkMB]?(?![A-Za-z0-9]))/g;

// Римские уровни II–XX («Sharpness VII», «Turbo-Wheat V») — тоже заполнители {R0}, {R1}…
// Одиночная «I» обычно не трогается: её не отличить от английского «I»…
// …кроме случая «Название I …» в начале абзаца (уровень зачарования, атрибута или зелья).
const ROMAN = /(?<![\w'’-])(?:XX|XI[XV]|XV?I{0,3}|IX|IV|VI{0,3}|II{1,2})(?![\w'’-])|(?<=^(?:[A-Z][\w'’.-]*\s){1,4})I(?=\s[A-Z(]|$)/g;

/** Нормализует абзац в ключ словаря. @returns {{ key: string, nums: string[], romans: string[] }} */
export function toKey(text) {
  const nums = [];
  const romans = [];
  const key = String(text).replace(/\s+/g, ' ').trim()
    .replace(NUM, n => `{${nums.push(n) - 1}}`)
    .replace(ROMAN, r => (r ? `{R${romans.push(r) - 1}}` : r));
  return { key, nums, romans };
}

let DICT = null;
export function loadDict() {
  if (DICT) return DICT;
  DICT = new Map();
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort(); } catch { /* нет словаря */ }
  for (const f of files) {
    const obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$') || typeof v !== 'string' || !v) continue;
      // ключ мог быть записан с исходными числами и римскими уровнями — нормализуем ещё раз;
      // римские уровни из ключа, встреченные в переводе, тоже становятся заполнителями
      const { key, romans } = toKey(k);
      let val = v;
      romans.forEach((r, i) => { val = val.replace(new RegExp(`(?<![\\w-])${r}(?![\\w-])`), `{R${i}}`); });
      DICT.set(key, enTerms(val));
    }
  }
  return DICT;
}

/** Для тестов: подложить свой словарь */
export function setDict(map) { DICT = map instanceof Map ? map : new Map(Object.entries(map)); }

/** Перевод абзаца по словарю или null */
export function lookup(text) {
  const { key, nums, romans } = toKey(text);
  const ru = loadDict().get(key);
  if (ru == null) return null;
  return ru.replace(/\{(R?)(\d+)\}/g, (_, r, i) => (r ? romans[i] : nums[i]) ?? '');
}
