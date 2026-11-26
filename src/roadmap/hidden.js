// Скрытые шаги плана у владельца профиля, вошедшего на сайт: data/roadmap-hidden.json, видны на всех его устройствах.
// { byKey: { 'uuid:profileId': { stepId: { at, gone? } } } }
// Гость скрывает шаги только у себя в браузере (client/src/hiddenSteps.js), чужой план вошедшему скрывать нельзя.
// Шаги плана сами исчезают, когда по данным игры они сделаны. Тогда и отметка не нужна: если шага нет в плане
// дольше суток (GONE_MS), отметка удаляется — вернётся шаг позже, его снова будет видно.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const FILE = () => path.join(config.dataDir, 'roadmap-hidden.json');
const ID = /^[A-Za-z0-9_:.\-]{1,100}$/;
const MAX = 500;
export const GONE_MS = 24 * 3600_000;
let cache = null;

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE(), 'utf8')) || {}; } catch { cache = {}; }
  if (!cache.byKey) cache = { byKey: {} };
  return cache;
}
function save() {
  try { fs.mkdirSync(config.dataDir, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(cache)); } catch { /* останется в памяти до перезапуска */ }
}

/**
 * Чистая функция: отметки, сверенные с текущим планом. Шаг есть — отметка живёт (и «пропал» сбрасывается),
 * шага нет — помечаем, когда пропал, а через GONE_MS удаляем. Без плана (не загрузился) ничего не трогаем.
 * @returns {{ hidden: Object, changed: boolean }}
 */
export function pruneHidden(hidden = {}, stepIds, now = Date.now()) {
  const ids = stepIds instanceof Set ? stepIds : new Set(stepIds || []);
  if (!ids.size) return { hidden, changed: false };
  const out = {};
  let changed = false;
  for (const [id, v0] of Object.entries(hidden)) {
    const v = v0 && typeof v0 === 'object' ? v0 : { at: typeof v0 === 'number' ? v0 : 0 };
    if (v !== v0) changed = true;
    if (ids.has(id)) {
      if (v.gone) { changed = true; out[id] = { at: v.at }; } else out[id] = v;
    } else if (!v.gone) { changed = true; out[id] = { ...v, gone: now }; }
    else if (now - v.gone > GONE_MS) changed = true;
    else out[id] = v;
  }
  return { hidden: changed ? out : hidden, changed };
}

/** Скрытые шаги профиля; stepIds — id шагов текущего плана (для уборки старых отметок). */
export function getHidden(key, stepIds, now = Date.now()) {
  if (!key) return {};
  const d = load();
  const { hidden, changed } = pruneHidden(d.byKey[key] || {}, stepIds, now);
  if (changed) { if (Object.keys(hidden).length) d.byKey[key] = hidden; else delete d.byKey[key]; save(); }
  return hidden;
}

/**
 * Скрыть (value: true) или вернуть (value: null/false) шаги. ids — один id или массив
 * (массив — ещё и перенос старых отметок из браузера при первом входе).
 */
export function setHidden(key, ids, value, now = Date.now()) {
  if (!key) throw new Error('Профиль ещё не загружен');
  const list = (Array.isArray(ids) ? ids : [ids]).map(String);
  if (!list.length || list.length > 200 || list.some(id => !ID.test(id))) throw new Error('Неверный id шага');
  const d = load();
  const mine = { ...(d.byKey[key] || {}) };
  for (const id of list) { if (value) mine[id] = { at: now }; else delete mine[id]; }
  if (Object.keys(mine).length > MAX) throw new Error('Слишком много скрытых шагов');
  if (Object.keys(mine).length) d.byKey[key] = mine; else delete d.byKey[key];
  save();
  return mine;
}

/** Для тестов: сбросить кэш (файл перечитается). */
export function _resetHidden() { cache = null; }

/**
 * GET /api/roadmap/hidden → { hidden, canWrite }; POST { ids | id, value } → { hidden, canWrite: true }.
 * getView(req) → открытый профиль ({ self, member, analysis }); canWrite — только свой профиль у вошедшего.
 */

