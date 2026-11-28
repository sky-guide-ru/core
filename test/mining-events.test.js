// Ивенты майнинга (calendar/mining.js): разбор ответа трекера Soopy, строка для «Дел на сегодня», гайд Mining.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseChEvents, headline, eventOf, createMiningEvents, MINING_EVENTS } from '../src/calendar/mining.js';
import { dailiesOf } from '../src/analysis/dailies.js';
import { PERK_EVENTS } from '../src/calendar/events.js';

const RAW = JSON.parse(fs.readFileSync(new URL('./fixtures/chevents.json', import.meta.url), 'utf8'));
const NOW = RAW.data.curr_time;

test('разбор: что идёт сейчас на каждом острове', () => {
  const v = parseChEvents(RAW, NOW);
  assert.deepEqual(v.islands.map(i => i.id), ['DWARVEN_MINES', 'CRYSTAL_HOLLOWS', 'MINESHAFT']);
  const [dm, ch, ms] = v.islands;
  assert.equal(dm.now[0].name, 'Raffle');
  assert.equal(dm.now[0].lobbies, 7);
  assert.match(dm.now[0].tip, /Raffle Box/);
  assert.equal(ch.now[0].id, 'BETTER_TOGETHER');
  assert.equal(ch.lobbies, 32);
  assert.deepEqual(ms.now, []);
  // идущий ивент не дублируется в «скоро»
  assert.deepEqual(ch.soon, []);
});

test('кончившиеся ивенты отбрасываются, «скоро» — по времени начала', () => {
  const later = parseChEvents(RAW, 1795850269415 + 1);
  assert.deepEqual(later.islands[0].now, []);
  const raw = structuredClone(RAW);
  raw.data.running_events.DWARVEN_MINES = [];
  raw.data.event_datas.DWARVEN_MINES = { GOBLIN_RAID: { starts_at_min: NOW + 120_000, lobby_count: 3 }, DOUBLE_POWDER: { starts_at_min: NOW + 60_000, lobby_count: 5 } };
  assert.deepEqual(parseChEvents(raw, NOW).islands[0].soon.map(s => s.name), ['2x Powder', 'Goblin Raid']);
});

test('плохой ответ — null, незнакомый ивент — с названием из id', () => {
  assert.equal(parseChEvents(null), null);
  assert.equal(parseChEvents({ success: false }), null);
  assert.equal(eventOf('2X_POWDER').name, '2x Powder');
  assert.equal(eventOf('GONE_WITH_THE_WIND').name, 'Gone With The Wind');
});

test('строка «сейчас»: 2x Powder важнее остальных', () => {
  const raw = structuredClone(RAW);
  raw.data.running_events.DWARVEN_MINES.push({ event: 'DOUBLE_POWDER', ends_at: NOW + 600_000, lobby_count: 2 });
  const h = headline(parseChEvents(raw, NOW));
  assert.equal(h.name, '2x Powder');
  assert.equal(h.island, 'Dwarven Mines');
  assert.equal(headline(parseChEvents(RAW, NOW)).name, 'Better Together'); // иначе — где больше лобби
  assert.equal(headline(null), null);
});

test('живая сводка: не чаще раза в минуту, молчащий трекер — null', async () => {
  let t = NOW, calls = 0;
  const me = createMiningEvents({ now: () => t, fetchJson: async () => { calls++; return RAW; } });
  assert.equal(me.get(), null);
  assert.equal(await me.refresh(), true);
  assert.equal(await me.refresh(), false);
  assert.equal(calls, 1);
  assert.equal(me.get().islands[1].now[0].name, 'Better Together');
  t += 11 * 60_000;
  assert.equal(me.get(), null);
  const bad = createMiningEvents({ now: () => t, fetchJson: async () => { throw new Error('down'); } });
  assert.equal(await bad.refresh(), false);
  assert.equal(bad.get(), null);
});

test('факты: у каждого ивента есть «что даёт» и «что делать», фиеста без «двойного дропа»', () => {
  for (const e of MINING_EVENTS) { assert.ok(e.gives && e.todo, e.id); }
  assert.ok(!/двойн/i.test(PERK_EVENTS['Mining Fiesta'].tip));
  assert.match(PERK_EVENTS['Mining Fiesta'].what, /Mining Fortune/);
});

test('«Дела на сегодня»: метка mining, если есть HotM', () => {
  assert.equal(dailiesOf({ daily: {}, mining: { hotm: { level: 3 } } }, NOW).mining, true);
  assert.equal(dailiesOf({ daily: {}, mining: { hotm: { level: 0 } } }, NOW), null);
});

test('Mining Fiesta: идёт сейчас или шансы Cole на выборах', async () => {
  const { setElection, fiestaOutlook } = await import('../src/calendar/index.js');
  const T = Date.parse('2026-11-23T10:00:00Z');
  setElection({ mayor: { key: 'mining', name: 'Cole', perks: [{ name: 'Mining Fiesta' }] }, current: { year: 1, candidates: [] } }, T);
  let f = fiestaOutlook(T);
  assert.equal(f.now.by, 'Cole');
  assert.ok(f.now.until > T);
  setElection({ mayor: { key: 'fishing', name: 'Marina', perks: [], minister: { name: 'Cole', perk: { name: 'Mining Fiesta' } } }, current: { year: 1, candidates: [] } }, T);
  assert.equal(fiestaOutlook(T).now.role, 'minister');
  setElection({ mayor: { key: 'fishing', name: 'Marina', perks: [] }, current: { year: 2, candidates: [
    { key: 'dungeons', name: 'Paul', perks: [], votes: 600 },
    { key: 'mining', name: 'Cole', perks: [{ name: 'Mining Fiesta', minister: true }, { name: 'Prospection' }], votes: 400 },
  ] } }, T);
  f = fiestaOutlook(T);
  assert.equal(f.now, null);
  assert.deepEqual(f.election.cole, { pct: 40, place: 2, fiesta: true, ministerFiesta: true });
  assert.equal(f.election.leader.name, 'Paul');
  assert.ok(f.next.to > f.next.from);
});
