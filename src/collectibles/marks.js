// Ручные отметки «Души и коллекции» в data/collectible-marks.json: у каждого игрока свои.
// { byUuid: { uuid: { fairy: { 'hub:18,68,-3': true } } } }
// Нужны, потому что Hypixel отдаёт только число собранных Fairy Souls, а не какие именно.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const FILE = () => path.join(config.dataDir, 'collectible-marks.json');
const ID = /^[a-z0-9_]{2,30}:-?\d{1,5},-?\d{1,4},-?\d{1,5}$/;
const KINDS = new Set(['fairy']);
const MAX_PER_KIND = 2000;
let cache = null;

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE(), 'utf8')) || {}; } catch { cache = {}; }
  if (!cache.byUuid) cache = { byUuid: {} };
  return cache;
}
function save() {
  try { fs.mkdirSync(config.dataDir, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(cache)); } catch { /* останется в памяти до перезапуска */ }
}

/** Отметки игрока: { fairy: { id: true } } */
export function getCollectMarks(uuid) {
  const d = load();
  return (uuid && d.byUuid[uuid]) || {};
}

/**
 * Поставить или снять отметки. ids — один id или массив (например, все души острова).
 * value: true — найдено, null/false — убрать отметку.
 */
export function setCollectMarks(uuid, kind, ids, value) {
  if (!uuid) throw new Error('Профиль ещё не загружен');
  if (!KINDS.has(kind)) throw new Error('Неизвестный тип отметки');
  const list = (Array.isArray(ids) ? ids : [ids]).map(String);
  if (!list.length || list.length > 200 || list.some(id => !ID.test(id))) throw new Error('Неверный id');
  const d = load();
  const mine = d.byUuid[uuid] ||= {};
  const k = mine[kind] = { ...(mine[kind] || {}) };
  for (const id of list) { if (value) k[id] = true; else delete k[id]; }
  if (Object.keys(k).length > MAX_PER_KIND) throw new Error('Слишком много отметок');
  save();
  return mine;
}

/** Для тестов: сбросить кэш (файл перечитается). */
export function _resetCollectMarks() { cache = null; }

/**
 * GET /api/collectibles/marks, POST /api/collectibles/marks { kind, ids, value }.
 * getUuid(req) → uuid открытого профиля; canWrite(req) → можно ли менять (только свой профиль).
 */

