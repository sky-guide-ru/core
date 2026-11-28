import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/market/methods.js'; // methods/mining.js грузится только через methods.js
import { milestoneState, corpseGuide, MILESTONES } from '../src/guides/corpses.js';
import { CORPSES, CORPSES_PER_SHAFT } from '../src/market/methods/mining.js';

const ctxOf = ({ prices = {}, owned = [], liquid = 100_000_000, market = true } = {}) => ({
  price: id => prices[id] || 0,
  name: id => id,
  has: id => owned.includes(id),
  m: { inv: {} },
  adv: { liquid, market },
});

test('вехи Frozen Corpse: пройденная веха и чего не хватает до следующей', () => {
  const s = milestoneState({ lapis: 14 });
  assert.equal(s.done, 1);
  assert.equal(s.next.n, 2);
  assert.deepEqual(s.missing.map(x => [x.k, x.left]), [['lapis', 11], ['umber', 1], ['tungsten', 1]]);
  assert.equal(milestoneState({}).done, 0);
  // веха IV требует Vanguard: без него остаёмся на III
  assert.equal(milestoneState({ lapis: 500, umber: 50, tungsten: 50 }).done, 3);
  assert.equal(milestoneState({ lapis: 1000, umber: 100, tungsten: 100, vanguard: 20 }).next, null);
  // сумма Powder за все вехи — 610 000 (вики)
  assert.equal(MILESTONES.reduce((s, m) => s + m.powder, 0), 610_000);
});

test('вехи Frozen Corpse: награда не забрана, цена ключей и «на потом»', () => {
  const prices = { UMBER_KEY: 3_200_000, TUNGSTEN_KEY: 3_200_000, SKELETON_KEY: 42_000_000, UMBER_PLATE: 11_000_000 };
  const g = corpseGuide(ctxOf({ prices }), { corpses: { lapis: 14 }, active: true });
  const claim = g.next.find(n => /Grandpa Wolf/.test(n.title));
  assert.ok(claim, 'шаг «забери награду»');
  assert.equal(claim.item, 'ORGAN_DONOR_TALISMAN');
  const ms = g.next.find(n => /Milestone II/.test(n.title));
  assert.match(ms.why, /6,4 млн/);
  assert.match(ms.title, /Lapis 14\/25/);
  // талисман есть — шага нет
  const g2 = corpseGuide(ctxOf({ prices, owned: ['ORGAN_DONOR_TALISMAN'] }), { corpses: { lapis: 14 }, active: true });
  assert.ok(!g2.next.some(n => /Grandpa Wolf/.test(n.title)));
  // веха V: ключи ~370 млн дороже трети денег → «На потом»
  const g3 = corpseGuide(ctxOf({ prices, owned: ['ORGAN_DONOR_RING'] }), { corpses: { lapis: 100, umber: 10, tungsten: 10, vanguard: 1 }, active: true });
  const v = g3.next.find(n => /Milestone V/.test(n.title));
  assert.match(v.title, /^На потом/);
  // RNG Meter: выгоднее всего Plate
  const rng = g.sections.find(s => s.title === 'Frozen Corpse RNG Meter');
  assert.match(rng.note, /UMBER_PLATE/);
  const tbl = g.sections.find(s => s.title === 'Frozen Corpse Milestones');
  assert.equal(tbl.current, 1);
  assert.equal(tbl.news, 'corpses');
});

test('лут трупов: веса складываются в 1, броски по вики', () => {
  for (const c of Object.values(CORPSES)) {
    const sum = c.loot.reduce((s, l) => s + l.p, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  }
  assert.equal(CORPSES.lapis.rolls, 4.5);
  assert.equal(CORPSES.umber.rolls, 5.5);
  assert.equal(CORPSES_PER_SHAFT, 2.5);
  // вики: Glacite Amalgamation с Lapis — 25 из 16 750
  const am = CORPSES.lapis.loot.find(l => l.id === 'GLACITE_AMALGAMATION');
  assert.ok(Math.abs(am.p - 25 / 16_750) < 1e-9);
});
