// «Как получить»: покупка на рынке стоит рядом с дропом, даже когда BIN-лотов сейчас нет, а вещь продаётся
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObtainGuide } from '../src/analysis/obtain.js';
import { makeBuy } from '../src/market/quote.js';
import { createSoldStore, recordSale, soldStats } from '../src/market/auctions.js';

const items = new Map(Object.entries({
  MASTER_SKULL_TIER_1: { id: 'MASTER_SKULL_TIER_1', name: 'Master Skull - Tier 1', recipes: [] },
  BONZO_BOSS: { id: 'BONZO_BOSS', name: 'Bonzo', recipes: [
    { type: 'drops', name: 'Bonzo (Master Mode)', panorama: 'dungeon', drops: [{ id: 'MASTER_SKULL_TIER_1', chance: '3.488%' }] },
  ] },
}));

function soldOnly() {
  const sold = createSoldStore();
  const now = Date.now();
  for (const [i, p] of [390e3, 400e3, 410e3].entries()) recordSale(sold, 'MASTER_SKULL_TIER_1', p, now - (i + 1) * 3600e3);
  return { bazaar: new Map(), bin: new Map(), sold };
}

test('makeBuy: нет BIN-лотов, но есть продажи — цена по продажам с пометкой noLots', () => {
  const b = makeBuy(soldOnly(), { soldStats })('MASTER_SKULL_TIER_1');
  assert.equal(b.market, 'ah');
  assert.equal(b.price, 400e3);
  assert.equal(b.noLots, true);
  assert.equal(b.sold7, 3);
  // с лотом — как раньше: самый дешёвый BIN, продажи не дороже лота
  const withLot = makeBuy({ ...soldOnly(), bin: new Map([['MASTER_SKULL_TIER_1', { price: 380e3, count: 2 }]]) }, { soldStats })('MASTER_SKULL_TIER_1');
  assert.deepEqual([withLot.price, withLot.count, withLot.noLots, withLot.sell, withLot.sellFrom], [380e3, 2, undefined, 380e3, 'cap']);
  assert.equal(makeBuy({ bazaar: new Map(), bin: new Map() }, { soldStats })('MASTER_SKULL_TIER_1'), null);
});

test('Master Skull: «Купить на аукционе» первым, дроп с Bonzo рядом; без рынка — только дроп', () => {
  const g = buildObtainGuide('MASTER_SKULL_TIER_1', { items, constants: {}, buy: makeBuy(soldOnly(), { soldStats }) });
  assert.deepEqual(g.methods.map(m => m.kind), ['market', 'drop']);
  const ah = g.methods[0];
  assert.equal(ah.title, 'Купить на аукционе');
  assert.equal(ah.total, 400e3);
  assert.equal(ah.quote.sell, 0);
  const text = ah.steps.map(s => s.text).join(' ');
  assert.match(text, /BIN-лотов .* нет, но вещь продаётся: за неделю 3 шт\., в среднем по 400 тыс\./);
  assert.doesNotMatch(text, /самый дешёвый сейчас/);

  const drop = g.methods[1].steps.map(s => s.text).join(' ');
  assert.match(drop, /Босс этажа M1 в Catacombs \(Master Mode — усложнённые этажи\)/);
  assert.match(drop, /Нужно: Catacombs 24 и пройденный F7 — без него Master Mode закрыт\./);

  const iron = buildObtainGuide('MASTER_SKULL_TIER_1', { items, constants: {}, noMarket: true, buy: makeBuy(soldOnly(), { soldStats }) });
  assert.deepEqual(iron.methods.map(m => m.kind), ['drop']);
});
