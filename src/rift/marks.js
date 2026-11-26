// Ручные отметки Enigma Souls в data/rift-marks.json: у каждого игрока свои — { byUuid: { uuid: { soulId: true|false } } }.
// Нужны, потому что часть кодов душ в API не удаётся сопоставить с конкретной душой.
// Старый файл (одни отметки на всех) считается отметками владельца сайта.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SOULS } from './data.js';

const FILE = () => path.join(config.dataDir, 'rift-marks.json');
const IDS = new Set(SOULS.map(s => s.id));
let cache = null;
let ownerUuid = () => null;
/** Кто владелец (его отметки — из старого общего файла) */
export function setRiftOwner(fn) { ownerUuid = fn; }

function load() {
  if (cache) return cache;
  let d = {};
  try { d = JSON.parse(fs.readFileSync(FILE(), 'utf8')) || {}; } catch { d = {}; }
  cache = d.byUuid ? { byUuid: d.byUuid, legacy: d.legacy || null } : { byUuid: {}, legacy: Object.keys(d).length ? d : null };
  return cache;
}

export function getMarks(uuid) {
  const d = load();
  if (uuid && d.byUuid[uuid]) return d.byUuid[uuid];
  if (d.legacy && (!uuid || uuid === ownerUuid())) return d.legacy;
  return {};
}

/** value: true — найдена, false — не найдена, null — убрать отметку. */
export function setMark(uuid, id, value) {
  if (!IDS.has(id)) throw new Error('Нет такой души');
  if (!uuid) throw new Error('Профиль ещё не загружен');
  const d = load();
  const m = { ...getMarks(uuid) };
  if (value === null || value === undefined) delete m[id]; else m[id] = !!value;
  d.byUuid[uuid] = m;
  if (uuid === ownerUuid()) d.legacy = null;
  try { fs.mkdirSync(config.dataDir, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(d)); } catch { /* сохранится в памяти до перезапуска */ }
  return m;
}

/** getUuid(req) → uuid игрока, чей профиль открыт (свой, друга) */
/** canWrite(req) → можно ли менять отметки открытого профиля (только свой: друг не правит чужие души) */

