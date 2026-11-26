import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statePart, partVersions, lightAnalysis, lightMember, PARTS } from '../src/lib/state-parts.js';

const analysis = {
  gear: { networth: { total: 5 }, itemCount: 3, topItems: Array.from({ length: 30 }, (_, i) => ({ id: `I${i}` })), armorSets: [{ id: 'X' }], worn: { armor: [] } },
  acc: { count: 2, recombPrice: 9, list: [{ id: 'A' }], cheapestNext: [], missing: [{ id: 'B', family: ['B2', 'B1'] }] },
  chocolate: { eggs: [] }, petScore: { score: 1 }, map: { branches: [1] }, roadmap: [{ id: 's' }], summary: { headline: 'x' },
};
const member = { uuid: 'u', extras: { view: {} }, unlockedCollTiers: ['A_1'], bankTransactions: [1], pets: [] };

test('лёгкий разбор: только сводка тяжёлых кусков, остальное как было', () => {
  const a = lightAnalysis(analysis);
  assert.deepEqual(Object.keys(a.gear).sort(), ['itemCount', 'networth', 'topItems']);
  assert.equal(a.gear.topItems.length, 10);
  assert.deepEqual(a.acc, { count: 2, recombPrice: 9 });
  assert.equal(a.chocolate, undefined); assert.equal(a.petScore, undefined); assert.equal(a.map, undefined);
  assert.deepEqual(a.roadmap, analysis.roadmap);
  const m = lightMember(member);
  assert.equal(m.extras, undefined); assert.equal(m.unlockedCollTiers, undefined); assert.equal(m.bankTransactions, undefined);
  assert.equal(m.hasExtras, true);
});

test('куски: версия стабильна, меняется вместе с данными, у аксессуаров ключ семейства', () => {
  const view = { member, analysis };
  const v1 = partVersions(view);
  assert.deepEqual(Object.keys(v1).sort(), Object.keys(PARTS).sort());
  assert.ok(Object.values(v1).every(Boolean));
  assert.deepEqual(partVersions(view), v1);
  assert.deepEqual(JSON.parse(statePart(view, 'gear').json), analysis.gear);
  const acc = JSON.parse(statePart(view, 'acc').json);
  assert.equal(acc.missing[0].fk, 'B1'); assert.equal(acc.missing[0].family, undefined);
  assert.deepEqual(JSON.parse(statePart(view, 'extras').json), { extras: member.extras, chocolate: analysis.chocolate });
  const v2 = partVersions({ member, analysis: { ...analysis, gear: { ...analysis.gear, itemCount: 4 } } });
  assert.notEqual(v2.gear, v1.gear);
  assert.equal(v2.acc, v1.acc);
  assert.equal(statePart(view, 'nope'), null);
  assert.equal(statePart({ member: null, analysis: null }, 'gear'), null);
});
