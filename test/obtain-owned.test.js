// «Как получить» учитывает, что у игрока уже есть: не только Sacks, но и рюкзаки, эндер-сундук, гардероб, питомцы.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObtainGuide } from '../src/analysis/obtain.js';
import { whereOwned, ownedPool, takeOwned } from '../src/lib/owned.js';
import { ownedCount } from '../src/roadmap/cart.js';

const items = new Map(Object.entries({
  DIVAN_DRILL: { id: 'DIVAN_DRILL', name: "Divan's Drill", recipes: [
    { type: 'forge', inputs: ['TITANIUM_DRILL_4:1', 'DIVAN_ALLOY:1', 'SKYBLOCK_COIN:50000000'], duration: 30 },
  ] },
  TITANIUM_DRILL_4: { id: 'TITANIUM_DRILL_4', name: 'Titanium Drill DR-X655', recipes: [] },
  DIVAN_ALLOY: { id: 'DIVAN_ALLOY', name: "Divan's Alloy", recipes: [] },
}));
const prices = { TITANIUM_DRILL_4: 475e6, DIVAN_ALLOY: 1.57e9 };
const buy = id => prices[id] ? { price: prices[id], market: 'ah' } : null;

test('Forge: бур из рюкзака помечен «есть» и не входит в «докупить»', () => {
  const member = { inv: { backpacks: { 0: [{ id: 'TITANIUM_DRILL_4', count: 1 }] }, sacks: {} } };
  const g = buildObtainGuide('DIVAN_DRILL', { items, constants: {}, buy, member });
  const forge = g.methods.find(m => m.kind === 'forge');
  const drill = forge.steps.find(s => s.tree).tree.find(n => n.id === 'TITANIUM_DRILL_4');
  assert.equal(drill.have, 1);
  assert.equal(drill.need, 0);
  assert.equal(drill.from, 'рюкзак 1');
  assert.equal(drill.rest, 0);
  assert.equal(forge.fromStock, 475e6);
  // без игрока — как раньше
  const g0 = buildObtainGuide('DIVAN_DRILL', { items, constants: {}, buy });
  const d0 = g0.methods.find(m => m.kind === 'forge').steps.find(s => s.tree).tree.find(n => n.id === 'TITANIUM_DRILL_4');
  assert.equal(d0.have, undefined);
});

test('whereOwned: все хранилища, мешки и питомцы; запас тратится один раз', () => {
  const inv = { inventory: [{ id: 'X', count: 2 }], enderChest: [{ id: 'X', count: 3 }], wardrobe: [{ id: 'X' }], sacks: { X: 10 },
    backpacks: { 2: [{ id: 'X', count: 1 }] }, rift: [{ id: 'X', count: 99 }] };
  assert.deepEqual(whereOwned(inv, 'X'), [['инвентарь', 2], ['гардероб', 1], ['эндер-сундук', 3], ['рюкзак 3', 1], ['мешки', 10]]);
  assert.equal(ownedCount(inv, 'X'), 17);
  assert.deepEqual(whereOwned(null, 'ENDER_DRAGON;3', [{ id: 'ENDER_DRAGON;3' }]), [['Pets', 1]]);
  const pool = ownedPool({ inv });
  assert.deepEqual(takeOwned(pool, 'X', 4), { have: 4, where: [['инвентарь', 2], ['гардероб', 1], ['эндер-сундук', 1]] });
  assert.deepEqual(takeOwned(pool, 'X', 20), { have: 13, where: [['эндер-сундук', 2], ['рюкзак 3', 1], ['мешки', 10]] });
  assert.deepEqual(takeOwned(pool, 'X', 1), { have: 0, where: [] });
});
