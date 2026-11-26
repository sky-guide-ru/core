// Методы заработка «Рифт, Сад, валюты, ивенты» (server/market/methods/misc.js): расчёты по живым ценам
import test from 'node:test';
import assert from 'node:assert/strict';
import { currencyShops, currencyValue, composterProfit, katFlips, npcToMarket, riftCraftValues, minionIncome, gardenLevel, shardsBy, MISC_METHODS, MISC_DETAILS } from '../src/market/methods/misc.js';
import { moneyMethods, METHODS } from '../src/market/methods.js';
import { createSoldStore, recordSale } from '../src/market/auctions.js';

const NOW = 1_800_000_000_000;
const H = 3600_000;
const item = (id, extra = {}) => ({ id, name: id, lore: [], recipe: null, recipes: [], crafttext: '', ...extra });
const bz = (buy, sell, week = 1_000_000) => ({ buy, sell, buyWeek: week, sellWeek: week });

function ctxWith(items, bazaar, bin = new Map(), sold = createSoldStore()) {
  return { items: new Map(items.map(i => [i.id, i])), bazaar: new Map(Object.entries(bazaar)), bin, sold, npc: new Map(), now: NOW };
}

test('магазин за валюту: монет за 1 Bit с учётом доплаты предметом', () => {
  const ctx = ctxWith([
    item('ELIZABETH_NPC', { recipes: [
      { type: 'npc_shop', cost: ['SKYBLOCK_BIT:1000'], result: 'GOOD' },
      { type: 'npc_shop', cost: ['SKYBLOCK_BIT:1000', 'TICKET:10'], result: 'WITH_TICKET' },
      { type: 'npc_shop', cost: ['SKYBLOCK_BIT:1000'], result: 'NO_MARKET' },
    ] }),
  ], { GOOD: bz(2_100_000, 2_000_000), WITH_TICKET: bz(2_100_000, 2_000_000), TICKET: bz(50_000, 45_000) });
  const shops = currencyShops(ctx.items);
  assert.equal(shops.BIT.length, 3);
  const v = currencyValue(ctx, 'BIT');
  assert.deepEqual(v.map(r => r.id), ['GOOD', 'WITH_TICKET'], 'без рынка не считаем');
  assert.ok(v[0].perUnit > v[1].perUnit, 'доплата билетами уменьшает цену Bit');
  assert.ok(v[0].perUnit > 2000 && v[0].perUnit < 2100);
});

test('Composter: прибыль = Compost − (4000 органики + 2000 топлива), улучшения учитываются', () => {
  const ctx = ctxWith([], { WHEAT: bz(2, 1.5), BIOFUEL: bz(3000, 2900), COMPOST: bz(30_000, 28_000) });
  const base = composterProfit(ctx, {});
  // органика: ордер 1.6 × 4000 = 6400; топливо: (2900.1/3000) × 2000 ≈ 1933
  assert.ok(Math.abs(base.cost - (4000 * 1.6 + 2000 * 2900.1 / 3000)) < 1);
  assert.ok(base.profit > 0);
  const up = composterProfit(ctx, { speed: 25, cost_reduction: 25 });
  assert.ok(up.perDayUnits > base.perDayUnits * 5, 'скорость 25 уровня = ×6');
  assert.ok(up.cost < base.cost);
});

test('Kat: прибыль за час по рецепту NEU, без продаж на аукционе — не предлагаем', () => {
  const sold = createSoldStore();
  const items = [item('ELEPHANT;3', { recipes: [{ type: 'katgrade', coins: 900_000, time: 432_000, input: 'ELEPHANT;2', output: 'ELEPHANT;3', items: [] }] })];
  const bin = new Map([['ELEPHANT;2', { price: 1_000_000, count: 5 }], ['ELEPHANT;3', { price: 4_000_000, count: 5 }]]);
  assert.equal(katFlips(ctxWith(items, {}, bin, sold)).length, 0);
  for (let i = 1; i <= 4; i++) recordSale(sold, 'ELEPHANT;3', 3_800_000, NOW - i * H);
  const [f] = katFlips(ctxWith(items, {}, bin, sold));
  assert.ok(f);
  assert.equal(f.hours, 120);
  assert.ok(f.profit > 1_500_000 && f.profit < 2_000_000, `прибыль ${f.profit}`);
});

test('NPC → рынок и переносимые предметы Рифта', () => {
  const ctx = ctxWith([
    item('BUILDER_NPC', { recipes: [{ type: 'npc_shop', cost: ['SKYBLOCK_COIN:100'], result: 'BRICK:64' }] }),
    item('CADUCOUS_FEEDER'), item('CADUCOUS_STEM'),
  ], { BRICK: bz(3, 2.8, 10_000_000), CADUCOUS_FEEDER: bz(900_000, 850_000, 7000) });
  const [f] = npcToMarket(ctx);
  assert.equal(f.id, 'BRICK');
  assert.ok(f.profit > 70);
  const [r] = riftCraftValues(ctx);
  assert.equal(r.out, 'CADUCOUS_FEEDER');
  assert.ok(Math.abs(r.perRaw - r.net / 448) < 1e-9);
});

test('миньоны: лучший тип на все слоты', () => {
  const lore = s => [`§7Time Between Actions: §a${s}s`];
  const ctx = ctxWith([item('CLAY_GENERATOR_11', { lore: lore(16) }), item('COBBLESTONE_GENERATOR_5', { lore: lore(20) })], { CLAY_BALL: bz(5, 4), COBBLESTONE: bz(2, 1.5) });
  const r = minionIncome(ctx, { minions: ['CLAY_11', 'COBBLESTONE_5', 'COBBLESTONE_1'] });
  assert.equal(r.best.type, 'CLAY');
  assert.equal(r.slots, 5);
});

test('уровень Сада и классификация осколков', () => {
  assert.equal(gardenLevel(0), 1);
  assert.equal(gardenLevel(2620), 7);
  assert.ok(shardsBy('hunt').includes('SHARD_PHANPYRE'));
  assert.ok(shardsBy('combat').includes('SHARD_ZEALOT'));
});

test('все новые методы есть в каталоге, с разбором, и не падают без цен', () => {
  const ids = new Set(METHODS.map(m => m.id));
  for (const m of MISC_METHODS) {
    assert.ok(ids.has(m.id), m.id);
    const d = MISC_DETAILS[m.id];
    assert.ok(d && d.steps.length >= 2 && d.risks.length >= 1, `${m.id}: шаги и риски`);
  }
  assert.equal(new Set(METHODS.map(m => m.id)).size, METHODS.length, 'id не повторяются');
  const list = moneyMethods({ skills: {}, slayers: {}, inv: {}, pets: [] }, ctxWith([], {}), { now: NOW });
  for (const x of list) assert.ok(typeof x.title === 'string');
});

test('английские слова в текстах — только имена собственные (нет «pests» без перевода и т.п.)', () => {
  for (const m of MISC_METHODS) for (const t of [m.title, m.desc]) assert.doesNotMatch(t, /\b(profit|farm|drop|coins|per hour)\b/i, `${m.id}: ${t}`);
});

test('Ironman: методы с покупкой на рынке не предлагаются', () => {
  const list = moneyMethods({ gameMode: 'ironman', skills: {}, slayers: {}, inv: {}, pets: [] }, ctxWith([], {}), { now: NOW });
  const ids = new Set(list.map(x => x.id));
  for (const id of ['npc-flip', 'kat-flip', 'pet-level-flip', 'npc-to-market', 'dark-auction']) assert.ok(!ids.has(id), id);
  assert.ok(ids.has('composter'));
});

test('Бродячий зоопарк: учитываются и летний, и зимний', () => {
  const zoo = MISC_METHODS.find(m => m.id === 'traveling-zoo');
  const r = zoo.req({}, { now: NOW })[0];
  assert.ok(/зоопарк/i.test(r.text));
  assert.ok(r.ok || /через/.test(r.have));
});
