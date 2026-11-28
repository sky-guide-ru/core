// Выборы мэра (calendar/election.js): снимки голосов, тренд, шанс победы, история, лента «Ближайшие мэры».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addElection, winChances, trendOf, historyStats, incumbentRuns, specialCycle, calibrate, electionView, mergeResults } from '../src/calendar/election.js';
import { electionWindow, nextTermChange } from '../src/calendar/events.js';
import { YEAR } from '../src/calendar/time.js';

const H = 3600_000;
// момент, когда выборы открыты: середина окна
const w0 = electionWindow(Date.parse('2026-11-28T08:00:00Z'));
const NOW = w0.open ? Date.parse('2026-11-28T08:00:00Z') : w0.opens + 10 * H;

const cand = (name, votes, perks = []) => ({ name, votes, perks: perks.map(p => ({ name: p, description: '' })) });
const RAW = {
  mayor: { name: 'Cole', key: 'mining', perks: [{ name: 'Mining Fiesta', description: '' }], minister: { name: 'Diana', perk: { name: 'Lucky!' } },
    election: { year: 527, candidates: [cand('Cole', 60000), cand('Diana', 40000), cand('Paul', 30000)] } },
  current: { year: 528, candidates: [cand('Paul', 41000, ['EZPZ']), cand('Diana', 27000, ['Mythological Ritual']), cand('Finnegan', 14000), cand('Marina', 10000), cand('Aatrox', 7000)] },
};

test('шанс: большой отрыв и мало времени — почти наверняка; равные — пополам', () => {
  const c = winChances({ paul: 41, diana: 27, fin: 14 }, 2);
  assert.ok(c.paul > 0.99);
  const e = winChances({ a: 30, b: 30 }, 50);
  assert.ok(Math.abs(e.a - 0.5) < 0.01);
  const early = winChances({ paul: 41, diana: 27.5 }, 70);
  assert.ok(early.paul > 0.8 && early.paul < 0.99, `до итогов далеко, шанс не 100%: ${early.paul}`);
  assert.ok(Math.abs(Object.values(early).reduce((s, v) => s + v, 0) - 1) < 1e-9);
});

test('тренд: догоняющий новый мэр снижает шанс лидера', () => {
  const flat = winChances({ old: 40, nova: 32 }, 20);
  const chasing = winChances({ old: 40, nova: 32 }, 20, { old: -2, nova: +3 });
  assert.ok(chasing.old < flat.old - 0.1, `${chasing.old} < ${flat.old}`);
});

test('снимки: не чаще раза в 4 минуты, тренд за 3 часа', () => {
  const data = { results: [], polls: {} };
  assert.equal(addElection(data, RAW, NOW), true);
  assert.equal(data.results[0].winner, 'Cole');
  assert.equal(data.results[0].minister, 'Diana');
  assert.equal(addElection(data, RAW, NOW + 60_000), false, 'тот же итог и меньше 4 минут — ничего');
  const later = structuredClone(RAW);
  later.current.candidates[1].votes = 40000; // Diana догоняет
  addElection(data, later, NOW + 3 * H);
  const t = trendOf(data.polls[528], 3);
  assert.ok(t.diana > 3 && t.paul < 0);
  assert.equal(trendOf(data.polls[528].slice(0, 1), 3), null);
});

const hist = [];
for (let y = 400; y < 528; y++) {
  const special = y % 8 === 0;
  const names = special ? ['Derpy', 'Paul', 'Diana', 'Cole', 'Marina'] : ['Paul', 'Diana', 'Cole', 'Marina', 'Aatrox'].filter((_, i) => i !== y % 5).concat('Finnegan');
  const prev = hist[hist.length - 1]?.winner;
  const cands = names.filter(n => n !== prev).map((n, i) => ({ name: n, votes: 1000 - i * 100 }));
  hist.push({ year: y, winner: cands[0].name, candidates: cands });
}

test('история: доля побед, мэр не выдвигается дважды подряд, особый мэр раз в 8 лет', () => {
  const s = historyStats(hist, 1000);
  assert.ok(s.paul.runs > 0 && s.paul.rate > 0);
  assert.equal(incumbentRuns(hist), false);
  const sp = specialCycle(hist);
  assert.equal(sp.every, 8);
  assert.equal(sp.next, 528);
  assert.deepEqual(mergeResults([{ year: 1, winner: 'A' }], [{ year: 1, winner: 'B' }]).map(r => r.winner), ['B']);
});

test('вид: кандидаты, лента и «когда снова» для мэра', () => {
  const data = { results: [], polls: {} };
  addElection(data, RAW, NOW);
  const v = electionView(RAW, { results: mergeResults(hist, data.results), polls: data.polls, sigmaK: 1 }, NOW);
  assert.equal(v.open, true);
  assert.equal(v.candidates[0].name, 'Paul');
  assert.equal(v.candidates[0].pct, 41.4);
  assert.match(v.candidates[0].ifWin, /Dungeons/);
  assert.ok(v.candidates[0].chance > v.candidates[1].chance);
  assert.deepEqual(v.timeline.map(x => x.kind).slice(0, 3), ['now', 'next', 'election']);
  const term = nextTermChange(NOW);
  assert.equal(v.timeline[1].start, term);
  assert.equal(v.timeline[2].skip, 'Paul', 'действующий мэр не выдвигается — Paul не будет в следующих');
  assert.equal(v.nextFor.cole.state, 'mayor');
  assert.equal(v.nextFor.cole.next, term + YEAR - 9 * 31 * 1200_000, 'Cole не было на выборах своего срока — следующий шанс на ближайших');
  assert.equal(v.nextFor.paul.state, 'running');
  assert.ok(v.odds.length >= 5);
  assert.equal(v.timeline.find(x => x.kind === 'special')?.start, term + 8 * YEAR, 'год 528 уже идёт — следующий особый через 8 лет');
});

test('новый мэр без истории — помечен, без процента по истории', () => {
  const raw = structuredClone(RAW);
  raw.current.candidates[2] = cand('Nova', 14000, ['TURBO MINIONS!!!']);
  const v = electionView(raw, { results: hist, polls: {}, sigmaK: 1 }, NOW);
  const nova = v.candidates.find(c => c.name === 'Nova');
  assert.equal(nova.isNew, true);
  assert.equal(nova.strong, true);
  assert.match(nova.why, /новый мэр/);
});

test('сверка разброса: подбирается по прошлым выборам со снимками', () => {
  const polls = {};
  for (const y of [520, 521, 522]) {
    const end = NOW + y * 1000;
    polls[y] = Array.from({ length: 12 }, (_, i) => ({ t: end - (12 - i) * 6 * H, end, v: { paul: 400 + i * 5, diana: 380 } }));
  }
  const res = [520, 521, 522].map(year => ({ year, winner: 'Paul', candidates: [{ name: 'Paul' }, { name: 'Diana' }] }));
  const k = calibrate(res, polls, 1);
  assert.ok(k >= 0.4 && k <= 3);
  assert.equal(calibrate([], {}, 1.3), 1.3);
});

test('без данных — пусто, но не падает', () => {
  const v = electionView(null, null, NOW);
  assert.equal(v.candidates, null);
  assert.equal(v.mayor, null);
});
