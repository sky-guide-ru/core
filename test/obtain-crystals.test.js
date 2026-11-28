// Gemstone Crystals в «Как получить»: у кристалла в рецепте Perfect-гема — найден ли он и где искать,
// у карточки кристалла — способ «Найти кристалл».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObtainGuide, costTree } from '../src/analysis/obtain.js';
import { gemCrystal, crystalFound } from '../src/guides/crystals.js';

const items = new Map(Object.entries({
  JASPER_CRYSTAL: { id: 'JASPER_CRYSTAL', name: 'Jasper Crystal', recipes: [] },
  ONYX_CRYSTAL: { id: 'ONYX_CRYSTAL', name: 'Onyx Crystal', recipes: [] },
  JADE_CRYSTAL: { id: 'JADE_CRYSTAL', name: 'Jade Crystal', recipes: [] },
}));
const member = { mining: { crystals: { jasper: { state: 'FOUND', found: 1 }, onyx: {}, jade: { state: 'NOT_FOUND', placed: 3 } } } };
const ctx = (extra = {}) => ({ items, constants: {}, buy: () => null, ...extra });

test('справочник: 12 кристаллов, найден ли у игрока', () => {
  assert.equal(gemCrystal('JASPER_CRYSTAL').nucleus, false);
  assert.equal(gemCrystal('TOPAZ_CRYSTAL').nucleus, true);
  assert.equal(gemCrystal('SUNSHINE_CRYSTAL'), null);
  assert.equal(crystalFound(member, 'jasper'), true);
  assert.equal(crystalFound(member, 'onyx'), false);
  assert.equal(crystalFound(member, 'citrine'), false);
  assert.equal(crystalFound(null, 'jasper'), null);
});

test('в дереве рецепта: «найден» или «не найден» с подсказкой вместо «нет цены и рецепта»', () => {
  const j = costTree('JASPER_CRYSTAL', 1, ctx({ member }));
  assert.equal(j.viaRu, 'кристалл найден');
  assert.equal(j.crystal.found, true);
  const o = costTree('ONYX_CRYSTAL', 1, ctx({ member }));
  assert.match(o.viaRu, /^кристалл не найден · Onyx Mineshaft/);
  const anon = costTree('ONYX_CRYSTAL', 1, ctx());
  assert.match(anon.viaRu, /^Onyx Mineshaft/);
});

test('карточка кристалла: способ «Найти кристалл» со статусом', () => {
  const g = buildObtainGuide('ONYX_CRYSTAL', ctx({ member }));
  const m = g.methods[0];
  assert.equal(m.title, 'Найти кристалл');
  assert.ok(m);
  assert.equal(m.guide, 'mining');
  assert.match(m.steps.map(s => s.text).join(' '), /Perfect Onyx Gemstone.*пока не найден/);
  const jade = buildObtainGuide('JADE_CRYSTAL', ctx({ member }));
  assert.match(jade.methods[0].steps[1].text, /Crystal Nucleus/);
});
