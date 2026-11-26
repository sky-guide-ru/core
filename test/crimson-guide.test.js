import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuide } from '../src/guides/index.js';
import { dojoState, dojoRank } from '../src/guides/crimson-data.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const deps = { priceOf: id => PRICES[id] || 0 };
const DOJO = { dojo_points_mob_kb: 1040, dojo_points_wall_jump: 640, dojo_points_archer: 820, dojo_points_sword_swap: 1000, dojo_points_snake: 120, dojo_points_lock_head: 980, dojo_points_fireball: 1100 };

test('Dojo: ранги как в SkyCrypt (шаг 200), сумма и непройденные', () => {
  assert.equal(dojoRank(0), 'F');
  assert.equal(dojoRank(199), 'F');
  assert.equal(dojoRank(200), 'D');
  assert.equal(dojoRank(999), 'A');
  assert.equal(dojoRank(1000), 'S');
  const d = dojoState(DOJO);
  assert.equal(d.tried, 7);
  assert.equal(d.total, 5700);
  assert.equal(d.sRanks, 3);
  const half = dojoState({ dojo_points_mob_kb: 0, dojo_points_archer: 300 });
  assert.equal(half.tried, 2, 'ноль очков — тоже попытка');
});

test('Crimson Isle: репутация до следующего тира, слабое испытание Dojo, мини-боссы', () => {
  const m = ownercatMember();
  m.skills.combat = { level: 47 };
  m.crimson = { ...m.crimson, faction: 'barbarians', barbarianRep: 1755, mageRep: 0, dojo: DOJO, lastMinibosses: ['ASHFANG', 'MAGMA_BOSS'] };
  const g = buildGuide('crimson', m, {}, deps);
  assert.notEqual(g.status, 'error', g.summary);
  assert.match(g.summary, /Barbarians, 1\s755 реп\./);
  assert.match(g.next[0].title, /1\s755 → 3\s000/);
  assert.ok(g.next.some(n => /Dojo: подтяни Swiftness \(120, ранг F\) до D/.test(n.title)));
  const dojo = g.sections.find(s => s.title === 'Dojo: испытания');
  assert.equal(dojo.rows.length, 7);
  assert.equal(dojo.current, 4, 'подсвечено самое слабое — Swiftness');
  const bosses = g.sections.find(s => s.title === 'Мини-боссы');
  assert.equal(bosses.rows.find(r => r[0] === 'Ashfang')[3].text, 'убит недавно');
  assert.equal(bosses.rows.find(r => r[0] === 'Bladesoul')[3].text, 'давно не убит');
  const quests = g.sections.find(s => s.title === 'Квесты фракции');
  assert.match(quests.rows.find(r => /Rescue/.test(r[0]))[1], /Cathedral/);
});

test('Crimson Isle: без Combat 24 — закрыт; без фракции — старт у Elle', () => {
  const m = ownercatMember();
  m.skills.combat = { level: 20 };
  m.crimson = { faction: null, barbarianRep: 0, mageRep: 0, kuudra: {}, dojo: {} };
  let g = buildGuide('crimson', m, {}, deps);
  assert.equal(g.status, 'locked');
  assert.match(g.next[0].title, /Combat до 24/);
  m.skills.combat = { level: 30 };
  g = buildGuide('crimson', m, {}, deps);
  assert.equal(g.status, 'start');
  assert.match(g.next[0].title, /Elle/);
});

test('Kuudra: лучшая волна по тирам попадает в таблицу', () => {
  const m = ownercatMember();
  m.crimson = { ...m.crimson, kuudraWaves: { hot: 7 } };
  const g = buildGuide('kuudra', m, {}, deps);
  const t = g.sections.find(s => s.title === 'Тиры Kuudra');
  assert.equal(t.rows[1][4], '7');
  assert.equal(t.rows[0][4], '—');
});
