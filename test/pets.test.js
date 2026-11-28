import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_LADDERS, petLadder, petLadderSection, petNextStep } from '../src/guides/pets.js';

const pet = (type, tier, level = 100) => ({ type, tier, level, exp: 0 });
const ctx = (pets, o = {}) => ({
  m: { pets }, market: o.market ?? true, mode: { id: o.mode || 'normal' }, liquid: o.liquid ?? 1e9,
  price: id => (o.prices || {})[id] || 0, name: id => id.split(';')[0],
});

test('питомцы: у каждой ступени есть всё нужное', () => {
  for (const [k, list] of Object.entries(PET_LADDERS)) for (const r of list) {
    assert.ok(r.type && r.use && r.why && r.how, `${k} ${r.type}`);
    assert.ok([1, 2, 3].includes(r.stage) && r.tier >= 0 && r.tier <= 5, `${k} ${r.type}`);
  }
});

test('питомцы: старший для той же цели закрывает младшего, стартовые не советуем', () => {
  const L = petLadder(ctx([pet('BAL', 'LEGENDARY'), pet('SILVERFISH', 'EPIC', 70)]), 'mining');
  const row = t => L.rows.find(r => r.type === t);
  assert.ok(row('BAL').has);
  assert.ok(row('SILVERFISH').late, 'Silverfish Epic → Legendary не советуем, когда есть средний питомец');
  assert.equal(L.next.stage, 2);
  const g = petLadder(ctx([pet('SCATHA', 'LEGENDARY')]), 'mining');
  assert.ok(g.rows.find(r => r.type === 'ARMADILLO').covered, 'Scatha закрывает Armadillo (гемы)');
});

test('питомцы: дорогой дроп не советуем, если не по карману; шанс виден', () => {
  const prices = { 'SCATHA;4': 369e6, 'GOBLIN;4': 7.5e6 };
  const have = ['SILVERFISH', 'MITHRIL_GOLEM', 'ARMADILLO', 'MOLE', 'BAL', 'SNAIL', 'GLACITE_GOLEM', 'MAMMOTH', 'GOBLIN'].map(t => pet(t, 'LEGENDARY'));
  assert.equal(petNextStep(ctx(have, { liquid: 100e6, prices }), 'mining'), null);
  assert.equal(petNextStep(ctx(have, { liquid: 2e9, prices }), 'mining').item, 'SCATHA;4');
  const sec = petLadderSection(ctx([], { prices }), 'mining');
  const scatha = sec.rows.find(r => r[1].item === 'SCATHA;4');
  assert.match(scatha[4], /1 из 2500/);
  assert.match(scatha[4], /369 млн/);
});

test('питомцы: без рынка — без цен, яйца драконов сверяются с монетами', () => {
  const iron = ctx([pet('TIGER', 'LEGENDARY'), pet('TYRANNOSAURUS', 'LEGENDARY')], { market: false, mode: 'ironman', liquid: 100e6 });
  assert.notEqual(petNextStep(iron, 'slayers')?.item, 'GOLDEN_DRAGON;4');
  const sec = petLadderSection(ctx([], { market: false, mode: 'ironman', prices: { 'MOLE;4': 1 } }), 'mining');
  assert.ok(sec.rows.every(r => !/аукцион/.test(r[4])));
});

test('питомцы: Bingo без эндгейма, события и onlyOwned не советуем', () => {
  const b = petLadder(ctx([], { mode: 'bingo', market: false }), 'farming');
  assert.ok(b.rows.every(r => r.stage < 3));
  assert.ok(!b.rows.some(r => r.type === 'ELEPHANT'));
  const all = ['DOLPHIN', 'AMMONITE', 'SQUID', 'HERMIT_CRAB', 'FLYING_FISH', 'PENGUIN'].map(t => pet(t, t === 'FLYING_FISH' ? 'MYTHIC' : 'LEGENDARY'));
  assert.equal(petNextStep(ctx(all), 'fishing'), null, 'питомцы событий не идут в «Что делать»');
});

test('питомцы: слееры — только свой босс, Dungeons — свой класс', () => {
  const s = petLadder(ctx([]), 'slayers', { boss: 'spider' });
  assert.ok(s.rows.some(r => r.type === 'TARANTULA'));
  assert.ok(!s.rows.some(r => r.type === 'ENDERMAN' || /WISP/.test(r.type)));
  const d = petLadder(ctx([]), 'dungeons', { cls: 'mage' });
  assert.ok(d.rows.some(r => r.type === 'SHEEP') && d.rows.some(r => r.type === 'SPIRIT'));
  assert.ok(!d.rows.some(r => r.type === 'JELLYFISH' || r.type === 'TIGER'));
});
