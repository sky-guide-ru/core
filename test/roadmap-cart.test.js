import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCart, applyCartOp, normCart, ownedCount, DONE_MS, MAX_CUSTOM } from '../src/roadmap/cart.js';

const PLAN = [
  { stepId: 'acc-cheap', title: 'Дешёвые аксессуары', cost: 2_000_000 },
  { stepId: 'gear-dungeon', title: 'Броня', cost: 10_000_000 },
];
const price = id => ({ BOOSTER_COOKIE: 3_000_000, ENCHANTED_DIAMOND: 1_000 }[id] || 0);
const name = id => ({ BOOSTER_COOKIE: 'Booster Cookie' }[id] || id);

test('без правок — тот же план покупок с нарастающим итогом', () => {
  const r = buildCart(PLAN, {}, { price, name, liquid: 5_000_000, perHour: 1_000_000 });
  assert.deepEqual(r.rows.map(x => x.cumulative), [2_000_000, 12_000_000]);
  assert.equal(r.rows[0].affordableNow, true);
  assert.equal(r.rows[1].affordableNow, false);
  assert.equal(r.rows[1].hoursOfFarming, 7);
  assert.equal(r.changed, false);
});

test('убранный шаг уходит из итога, своя вещь добавляется в конец', () => {
  let c = applyCartOp({}, { skip: 'gear-dungeon', value: true }, 1);
  c = applyCartOp(c, { add: 'BOOSTER_COOKIE', qty: 2 }, 2);
  const r = buildCart(PLAN, c, { price, name, inv: {}, liquid: 0 });
  assert.deepEqual(r.rows.map(x => x.stepId || x.id), ['acc-cheap', 'BOOSTER_COOKIE']);
  assert.equal(r.rows[1].cost, 6_000_000);
  assert.equal(r.rows[1].name, 'Booster Cookie');
  assert.equal(r.total, 8_000_000);
  assert.deepEqual(r.skipped.map(x => x.stepId), ['gear-dungeon']);
  c = applyCartOp(c, { skip: 'gear-dungeon', value: false });
  c = applyCartOp(c, { remove: 'BOOSTER_COOKIE' });
  assert.deepEqual(c, { skip: {}, custom: {} });
});

test('что уже есть, вычитается; набралось нужное — куплено и через сутки забыто', () => {
  const c = applyCartOp({}, { add: 'ENCHANTED_DIAMOND', qty: 160 }, 1);
  const inv = { inventory: [{ id: 'ENCHANTED_DIAMOND', count: 64 }], backpacks: { 0: [{ id: 'ENCHANTED_DIAMOND', count: 32 }] }, sacks: { ENCHANTED_DIAMOND: 4 } };
  assert.equal(ownedCount(inv, 'ENCHANTED_DIAMOND'), 100);
  let r = buildCart([], c, { price, name, inv });
  assert.equal(r.rows[0].have, 100);
  assert.equal(r.rows[0].cost, 60 * 1_000);
  const full = { ...inv, sacks: { ENCHANTED_DIAMOND: 64 } };
  r = buildCart([], c, { price, name, inv: full, now: 1000 });
  assert.equal(r.rows.length, 0);
  assert.equal(r.bought.length, 1);
  assert.ok(r.changed && r.cart.custom.ENCHANTED_DIAMOND.done === 1000);
  r = buildCart([], r.cart, { price, name, inv: full, now: 1000 + DONE_MS + 1 });
  assert.equal(r.bought.length, 0);
  assert.deepEqual(r.cart.custom, {});
});

test('убранный шаг, которого нет в плане сутки, забывается', () => {
  const c = applyCartOp({}, { skip: 'old-step', value: true }, 0);
  let r = buildCart(PLAN, c, { now: 10 });
  assert.ok(r.cart.skip['old-step'].gone);
  r = buildCart(PLAN, r.cart, { now: 10 + DONE_MS + 1 });
  assert.deepEqual(r.cart.skip, {});
});

test('битые данные отбрасываются, лимиты держатся', () => {
  assert.deepEqual(normCart({ skip: { 'bad id!': {} }, custom: { 'X Y': { qty: 1 }, OK: { qty: -5 } } }), { skip: {}, custom: { OK: { qty: 1, at: 0 } } });
  assert.throws(() => applyCartOp({}, { add: '../x' }));
  let c = {};
  for (let i = 0; i < MAX_CUSTOM; i++) c = applyCartOp(c, { add: `ITEM_${i}` });
  assert.throws(() => applyCartOp(c, { add: 'ONE_MORE' }));
});
