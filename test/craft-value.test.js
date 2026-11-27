import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craftValue, recipeInputs } from '../src/parse/craft-value.js';

const items = new Map([
  ['HOE_3', { recipes: [{ type: 'crafting', A1: 'TICKET:64', B1: 'STALK:60', B2: 'HOE_2:1', count: 1 }] }],
  ['HOE_2', { recipe: { A1: 'STALK:10', A2: 'HOE_1:1' } }],
  ['HOE_1', { recipes: [{ type: 'npc_shop', cost: ['SKYBLOCK_COIN:1000'], result: 'HOE_1' }] }],
  ['LOOP_A', { recipe: { A1: 'LOOP_B:1' } }],
  ['LOOP_B', { recipe: { A1: 'LOOP_A:1', A2: 'STALK:1' } }],
  ['GEM', { recipes: [{ type: 'forge', inputs: ['ROUGH:80'], count: 1 }] }],
  ['PACK', { recipe: { A1: 'STALK:8', count: 4 } }],
]);
const price = id => ({ STALK: 100, ROUGH: 3 })[id] || 0;

test('цена крафта: рецепты по цепочке, монеты NPC, ингредиент без цены — 0', () => {
  // HOE_1 = 1000, HOE_2 = 10×100 + 1000, HOE_3 = 0 (билеты) + 60×100 + 2000
  assert.equal(craftValue('HOE_3', price, items), 8000);
  assert.equal(craftValue('GEM', price, items), 240);
  assert.equal(craftValue('PACK', price, items), 200); // рецепт даёт 4 штуки
  assert.equal(craftValue('NOPE', price, items), 0);
});

test('цена крафта не зацикливается на рецептах друг через друга', () => {
  assert.ok(Number.isFinite(craftValue('LOOP_A', price, items)));
  assert.equal(recipeInputs(undefined), null);
});
