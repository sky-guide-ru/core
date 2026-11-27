// «План добычи» для Ironman, Stranded, Bingo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFarmPlan, farmSource, farmSkipKey } from '../src/roadmap/farm.js';
import { applyCartOp } from '../src/roadmap/cart.js';

const item = (id, extra = {}) => ({ id, name: id.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' '), recipes: [], ...extra });
const ITEMS = new Map([
  item('ADVENTURER_NPC', { name: 'Adventurer (NPC)', island: 'hub', x: -18.5, y: 70, z: -90.2, recipes: [{ type: 'npc_shop', cost: ['SKYBLOCK_COIN:500'], result: 'ZOMBIE_TALISMAN' }] }),
  item('ZOMBIE_TALISMAN'),
  item('FARMING_TALISMAN', { recipe: { A1: 'WHEAT:16', A2: 'WHEAT:16' }, crafttext: 'Requires: Wheat Collection II' }),
  item('WHEAT', { name: 'Wheat' }),
  item('LAPIS_ZOMBIE', { name: 'Lapis Zombie', recipes: [{ type: 'drops', name: 'Lapis Zombie', panorama: 'mining_2', drops: [{ id: 'LAPIS_ARMOR_HELMET', chance: '1%' }] }] }),
  item('LAPIS_ARMOR_HELMET'),
  item('TIGER;4', { name: 'Tiger' }),
].map(i => [i.id, i]));
const inv = { inventory: [{ id: 'WHEAT', count: 20 }], talismans: [{ id: 'SPEED_TALISMAN', count: 1 }] };
const steps = [
  { id: 'mp-cheap', title: 'Добудь 3 аксессуара', payoff: '+9 MP', items: ['ZOMBIE_TALISMAN', 'FARMING_TALISMAN', 'SPEED_TALISMAN'] },
  { id: 'skill-x', title: 'Качай скилл', items: [] },
  { id: 'gear-lapis', title: 'Броня для добычи', items: ['LAPIS_ARMOR_HELMET', 'ZOMBIE_TALISMAN'] },
  { id: 'pets', title: 'Питомцы', items: ['TIGER;4'] },
];

test('где взять: NPC с островом и координатами, крафт с материалами, дроп с островом', () => {
  const npc = farmSource('ZOMBIE_TALISMAN', { items: ITEMS, constants: {} });
  assert.equal(npc.kind, 'npc');
  assert.equal(npc.coins, 500);
  assert.match(npc.where, /^Adventurer/);
  assert.equal(npc.coords, '-19, 70, -91');
  const craft = farmSource('FARMING_TALISMAN', { items: ITEMS, inv });
  assert.equal(craft.kind, 'craft');
  assert.deepEqual(craft.parts, [{ id: 'WHEAT', name: 'Wheat', need: 32, have: 20 }]);
  assert.match(craft.where, /Wheat Collection II/);
  const drop = farmSource('LAPIS_ARMOR_HELMET', { items: ITEMS });
  assert.equal(drop.kind, 'drop');
  assert.match(drop.where, /^Lapis Zombie, .+, 1%$/);
});

test('план добычи: по порядку шагов, без дублей, что есть — в «собрано»', () => {
  const r = buildFarmPlan(steps, {}, { items: ITEMS, inv, now: 1 });
  assert.deepEqual(r.rows.map(x => x.id), ['ZOMBIE_TALISMAN', 'FARMING_TALISMAN', 'LAPIS_ARMOR_HELMET', 'TIGER;4']);
  assert.deepEqual(r.done.map(x => x.id), ['SPEED_TALISMAN']);
  assert.equal(r.rows[0].stepId, 'mp-cheap');
  assert.equal(r.coins, 500);
  assert.equal(r.lack, 1);
  assert.equal(r.total, 5);
});

test('план добычи: убрать строку и своя вещь — в том же списке, что «План покупок»', () => {
  let cart = applyCartOp({}, { skip: farmSkipKey('TIGER;4'), value: true }, 1);
  cart = applyCartOp(cart, { add: 'WHEAT', qty: 64 }, 1);
  const r = buildFarmPlan(steps, cart, { items: ITEMS, inv, now: 2 });
  assert.ok(!r.rows.some(x => x.id === 'TIGER;4'));
  assert.deepEqual(r.skipped.map(x => x.id), ['TIGER;4']);
  const own = r.rows.find(x => x.kind === 'item');
  assert.equal(own.id, 'WHEAT');
  assert.equal(own.have, 20);
});
