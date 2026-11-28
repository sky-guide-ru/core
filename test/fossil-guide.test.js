import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOSSILS, EXCAVATOR_DROPS, excavatorValue, fossilSections } from '../src/guides/fossil.js';
import { guideCtx } from '../src/guides/index.js';
import mining from '../src/guides/mining.js';
import { ownercatMember } from './fixtures/ownercat.js';

test('fossil: процент в игре = 1 / число клеток, клетки в поле 9×6 и не повторяются', () => {
  for (const f of FOSSILS) {
    assert.ok(Math.abs(Number(f.pct) - 100 / f.cells.length) < 0.06, f.name);
    assert.equal(new Set(f.cells.map(c => c.join())).size, f.cells.length, f.name);
    for (const [x, y] of f.cells) assert.ok(x >= 0 && x < 9 && y >= 0 && y < 6, f.name);
  }
  assert.equal(new Set(FOSSILS.map(f => f.pct)).size, FOSSILS.length, 'проценты различают фигуры');
});

test('fossil: веса лута как на вики (6 475), средняя выгода по ценам', () => {
  assert.equal(EXCAVATOR_DROPS.reduce((s, d) => s + d.w, 0), 6475);
  const P = { SUSPICIOUS_SCRAP: 189_000, FLAWED_AQUAMARINE_GEM: 455, FINE_AQUAMARINE_GEM: 37_500, ENCHANTED_UMBER: 14_000, ESSENCE_FOSSIL: 2_000 };
  const v = excavatorValue(id => P[id] || 0);
  assert.ok(v.groups.gems > 30_000 && v.groups.gems < 45_000, String(v.groups.gems));
  assert.ok(Math.abs(v.groups.essence - 12000 / 6475 * 11.5 * 2000) < 1);
  assert.equal(v.fossilAvg, 10_000, 'без цены Bazaar — продажа NPC');
  assert.ok(Math.abs(v.powder - 2500) < 100);
  assert.equal(v.scrap, 189_000);
});

test('fossil: сданные окаменелости в любом виде id, шаги и блоки в гайде Mining', () => {
  const m = ownercatMember();
  m.mining = { ...(m.mining || {}), hotm: { level: 8 }, mineshafts: 3 };
  m.gather = { ...(m.gather || {}), fossils: ['WEBBED', 'TUSK_FOSSIL', 'HELIX'] };
  m.inv = { ...m.inv, sacks: { SUSPICIOUS_SCRAP: 2 } };
  const P = { SUSPICIOUS_SCRAP: 10_000, FINE_ONYX_GEM: 40_000, FINE_CITRINE_GEM: 40_000 };
  const ctx = guideCtx(m, {}, { priceOf: id => P[id] || 0 });
  const { sections, next } = fossilSections(m, ctx);
  const shapes = sections.find(s => s.kind === 'shapes');
  assert.match(shapes.title, /3 из 8/);
  assert.deepEqual(shapes.items.filter(i => i.done).map(i => i.item), ['TUSK_FOSSIL', 'WEBBED_FOSSIL']);
  assert.ok(next.some(n => /Открой 2 Suspicious Scrap/.test(n.title)));
  assert.ok(next.some(n => /2 из 6/.test(n.title)));
  const g = mining.build(m, ctx);
  assert.ok(g.sections.some(s => s.kind === 'shapes'));
  assert.ok(g.sections.some(s => s.news === 'fossil'));
});

test('подсказки по тексту: секция-дерево (rows — число) не роняет гайд', async () => {
  const { enrichGuide } = await import('../src/guides/refs.js');
  const g = { status: 'ok', sections: [{ kind: 'tree', title: 'T', rows: 10 }, { kind: 'shapes', title: 'S', items: [{ name: 'Tusk Fossil', item: 'TUSK_FOSSIL', cells: [[0, 0]], text: 'Glacite Powder' }] }] };
  assert.doesNotThrow(() => enrichGuide(g, { items: new Map(), constants: {} }));
});
