// Хранилище выборов на сервере: история с вики (data/election-history.json рядом с модулем) + что сайт видел сам
// (DATA_DIR/election-history.json: итоги и снимки голосов). Расчёт — в election.js.
//   recordElection(raw, at) — вызывать после каждого запроса /v2/resources/skyblock/election (money.js → refreshMayor)
//   electionNow(now)        — вид для /v1/election
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { electionRaw, electionUpdatedAt } from './index.js';
import { addElection, mergeResults, calibrate, electionView } from './election.js';

const FILE = () => path.join(config.dataDir, 'election-history.json');

let SEED = [];
try { SEED = JSON.parse(fs.readFileSync(new URL('./data/election-history.json', import.meta.url), 'utf8')).elections || []; } catch { SEED = []; }

const data = { results: [], polls: {}, sigmaK: 1 };
let loaded = false, persist = true;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const d = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
    if (Array.isArray(d.results)) data.results = d.results;
    if (d.polls && typeof d.polls === 'object') data.polls = d.polls;
    if (Number(d.sigmaK) > 0) data.sigmaK = Number(d.sigmaK);
  } catch { /* первый запуск */ }
}
function save() {
  if (!persist) return;
  try { fs.mkdirSync(config.dataDir, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(data)); } catch { /* не критично */ }
}

/** Для тестов: пустое хранилище без записи на диск; seed — своя «история с вики». */
export function resetElectionStore({ seed } = {}) {
  data.results = []; data.polls = {}; data.sigmaK = 1; loaded = true; persist = false;
  if (seed) SEED = seed;
}

/** Все итоги: вики + свои. */
export const allResults = () => { load(); return mergeResults(SEED, data.results); };

export function recordElection(raw, at = Date.now()) {
  load();
  const before = data.results.length;
  if (!addElection(data, raw, at)) return false;
  if (data.results.length !== before) data.sigmaK = calibrate(allResults(), data.polls, data.sigmaK);
  save();
  return true;
}

export function electionNow(now = Date.now()) {
  load();
  return { ...electionView(electionRaw(), { results: allResults(), polls: data.polls, sigmaK: data.sigmaK }, now), updatedAt: electionUpdatedAt() };
}
