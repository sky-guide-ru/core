import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prices } from '../src/prices.js';
import { neu } from '../src/neu.js';
import { itemValueParts } from '../src/parse/gear.js';

const setPrices = o => { prices.bazaar = new Map(Object.entries(o).map(([k, v]) => [k, { buy: v, sell: v }])); prices.bin = new Map(); prices.bazaarAt++; };

test('networth: слоты гемов Kuudra ×0,6 и звёзды с Heavy Pearl', () => {
  const keep = { ...neu.constants };
  neu.constants.gemstonecosts = { HOT_TERROR_HELMET: { COMBAT_0: ['SKYBLOCK_COIN:250000', 'FLAWLESS_RUBY_GEM:1'] } };
  neu.constants.essencecosts = { HOT_TERROR_HELMET: { type: 'Crimson', 1: 10, 2: 10, items: { 2: ['SKYBLOCK_COIN:5', 'HEAVY_PEARL:2'] } } };
  setPrices({ HOT_TERROR_HELMET: 1_000_000, FLAWLESS_RUBY_GEM: 750_000, HEAVY_PEARL: 100_000, ESSENCE_CRIMSON: 1000 });
  const it = { id: 'HOT_TERROR_HELMET', count: 1, stars: 2, gems: { unlocked_slots: ['COMBAT_0'] }, upgrades: [] };
  // 1 млн + слот (250k + 750k) × 0,6 + 2 Heavy Pearl + 20 эссенции × 1000 × 0,75
  assert.equal(itemValueParts(it).value, 1_000_000 + 600_000 + 200_000 + 15_000);
  Object.assign(neu.constants, keep);
});

test('networth: «тяжёлые» ultimate дешевле книги, накопительные — по книге I', () => {
  setPrices({ HYPERION: 0, ENCHANTMENT_ULTIMATE_SOUL_EATER_5: 10_000_000, ENCHANTMENT_SHARPNESS_7: 10_000_000, ENCHANTMENT_EXPERTISE_1: 1_000_000 });
  const v = itemValueParts({ id: 'HYPERION', count: 1, upgrades: [], enchants: { ultimate_soul_eater: 5, sharpness: 7, expertise: 10 } }).value;
  assert.equal(v, 3_500_000 + 8_500_000 + 850_000);
});

test('networth: косметика считается отдельно и входит в общую оценку', () => {
  setPrices({ WITHER_GOGGLES: 5_000_000, DYE_BYZANTIUM: 500_000_000 });
  const r = itemValueParts({ id: 'WITHER_GOGGLES', count: 1, upgrades: [{ id: 'DYE_BYZANTIUM', count: 1, mult: 0.9, kind: 'dye' }] });
  assert.equal(r.cosmetic, 450_000_000);
  assert.equal(r.value, 455_000_000);
});

test('networth: вещь без рынка оценивается по крафту, косметика без рынка — нет', () => {
  const keepItems = neu.items;
  neu.items = new Map([['DICER_3', { recipe: { A1: 'MELON:10', A2: 'TICKET:64' } }], ['PET_SKIN_X', { recipe: { A1: 'MELON:10' } }]]);
  setPrices({ MELON: 1000 });
  assert.equal(itemValueParts({ id: 'DICER_3', count: 1, upgrades: [] }).value, 10_000);
  assert.equal(itemValueParts({ id: 'PET_SKIN_X', count: 1, upgrades: [] }).value, 0);
  neu.items = keepItems;
});
