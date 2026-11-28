import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOSSILS, EXCAVATOR_DROPS, excavatorValue, chiselGems, fossilSections } from '../src/guides/fossil.js';
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

test('fossil: веса лута как на вики (6 475); забирается только откопанное', () => {
  assert.equal(EXCAVATOR_DROPS.reduce((s, d) => s + d.w, 0), 6475);
  const P = { SUSPICIOUS_SCRAP: 189_000, FLAWED_AQUAMARINE_GEM: 455, FINE_AQUAMARINE_GEM: 37_500, ENCHANTED_UMBER: 14_000, ESSENCE_FOSSIL: 2_000 };
  const price = id => P[id] || 0;
  const base = excavatorValue(price, { charges: 16 });
  assert.ok(base.found > 2.8 && base.found < 3.6, String(base.found)); // ~16 кликов по 54 клеткам
  assert.equal(base.fossilAvg, 10_000, 'без цены Bazaar — продажа NPC');
  const lit = excavatorValue(price, { charges: 22, gems: { CITRINE: 3 } });
  const onyx = excavatorValue(price, { charges: 22, gems: { ONYX: 1.5 } });
  const plain = excavatorValue(price, { charges: 22 });
  assert.ok(lit.found > onyx.found && onyx.found > plain.found && plain.found > base.found);
  const per = excavatorValue(price, { charges: 22, gems: { PERIDOT: 1 } });
  assert.ok(Math.abs(per.groups.essence - 2 * plain.groups.essence) < 1, 'Peridot +100% к Essence');
  assert.ok(lit.total < 189_000, 'даже лучший Chisel не окупает скрап по этим ценам');
});

test('fossil: гемы Chisel из предмета (оба вида записи огранки)', () => {
  assert.deepEqual(chiselGems({ gems: { CHISEL_0_gem: 'CITRINE', CHISEL_0: { quality: 'PERFECT' }, CHISEL_1_gem: 'CITRINE', CHISEL_1: { quality: 'PERFECT' } } }),
    { ONYX: 0, CITRINE: 2, PERIDOT: 0, AQUAMARINE: 0 });
  assert.deepEqual(chiselGems({ gems: { CHISEL_0_gem: 'ONYX', CHISEL_0: 'FINE', CHISEL_1_gem: 'ONYX', CHISEL_1: 'FINE', CHISEL_2_gem: 'ONYX', CHISEL_2: 'FINE' } }),
    { ONYX: 1.5, CITRINE: 0, PERIDOT: 0, AQUAMARINE: 0 });
  assert.deepEqual(chiselGems(null), { ONYX: 0, CITRINE: 0, PERIDOT: 0, AQUAMARINE: 0 });
});

test('fossil: сданные окаменелости в любом виде id, шаги и блоки в гайде Mining', () => {
  const m = ownercatMember();
  m.mining = { ...(m.mining || {}), hotm: { level: 8 }, mineshafts: 3 };
  m.gather = { ...(m.gather || {}), fossils: ['WEBBED', 'TUSK_FOSSIL', 'HELIX'] };
  m.inv = { ...m.inv, sacks: { SUSPICIOUS_SCRAP: 2 } };
  const P = { SUSPICIOUS_SCRAP: 200_000, FINE_ONYX_GEM: 40_000, FINE_CITRINE_GEM: 40_000 };
  const ctx = guideCtx(m, {}, { priceOf: id => P[id] || 0 });
  const { sections, next } = fossilSections(m, ctx);
  const shapes = sections.find(s => s.kind === 'shapes');
  assert.match(shapes.title, /3 из 8/);
  assert.deepEqual(shapes.items.filter(i => i.done).map(i => i.item), ['TUSK_FOSSIL', 'WEBBED_FOSSIL']);
  assert.ok(next.some(n => /Suspicious Scrap: 2 шт. выгоднее продать/.test(n.title)), next.map(n => n.title).join('; '));
  const g = mining.build(m, ctx);
  assert.ok(g.sections.some(s => s.kind === 'shapes'));
  assert.ok(g.sections.some(s => s.news === 'fossil'));
});

test('подсказки по тексту: секция-дерево (rows — число) не роняет гайд', async () => {
  const { enrichGuide } = await import('../src/guides/refs.js');
  const g = { status: 'ok', sections: [{ kind: 'tree', title: 'T', rows: 10 }, { kind: 'shapes', title: 'S', items: [{ name: 'Tusk Fossil', item: 'TUSK_FOSSIL', cells: [[0, 0]], text: 'Glacite Powder' }] }] };
  assert.doesNotThrow(() => enrichGuide(g, { items: new Map(), constants: {} }));
});
