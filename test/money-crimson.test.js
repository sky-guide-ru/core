// Методы заработка Crimson Isle (кроме Kuudra): реалистичный доход по живым ценам и спросу.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyMethods } from '../src/market/methods.js';
import { CRIMSON_METHODS, dropIncome, MINIBOSS_LOOT } from '../src/market/methods-crimson.js';
import { METHOD_DETAILS } from '../src/market/method-details.js';
import { createSoldStore, recordSale } from '../src/market/auctions.js';

const NOW = 1_800_000_000_000;
const H = 3600_000;
const bz = (buy, sell, week = 5e6) => ({ buy, sell, buyWeek: week, sellWeek: week });
const member = (combat = 30, extra = {}) => ({ purse: 0, bank: 50e6, skills: { combat: { level: combat } }, slayers: {}, dungeons: {}, mining: {}, inv: {}, pets: [],
  crimson: { faction: 'barbarians', barbarianRep: 2400, mageRep: 0, kuudra: {} }, collections: { SULPHUR_ORE: 12_345 }, ...extra });

function market() {
  const bazaar = new Map([
    ['ESSENCE_CRIMSON', bz(1500, 1400, 2e7)], ['BLAZE_ROD', bz(12, 10, 5e8)], ['ENCHANTED_BLAZE_POWDER', bz(1000, 900)],
    ['COAL', bz(4, 3, 5e8)], ['PORK', bz(6, 5, 5e8)], ['GLOWSTONE_DUST', bz(5, 4, 5e8)], ['MAGMA_URCHIN', bz(300_000, 280_000, 2e4)],
    ['MAGMA_CREAM', bz(20, 18, 1e8)], ['CORRUPTED_NETHER_STAR', bz(450_000, 420_000, 3e4)], ['WITHER_SOUL', bz(4000, 3800, 2e5)],
    ['SULPHUR_ORE', bz(12, 10, 2e8)], ['ENCHANTED_SULPHUR', bz(2100, 2000, 3e6)], ['ENCHANTED_SULPHUR_CUBE', bz(400_000, 380_000, 4e4)],
    // ключ Kuudra на Bazaar нет, но даже если бы цена была — он Co-op Soulbound и в доход не идёт
    ['KUUDRA_HOT_TIER_KEY', bz(5e6, 5e6, 1e6)], ['ENCHANTED_RED_SAND', bz(2000, 1900)],
  ]);
  const bin = new Map([['RAGNAROCK_AXE', { price: 30e6, count: 20 }], ['FLAMING_FIST', { price: 2e6, count: 5 }]]);
  const sold = createSoldStore();
  for (let i = 0; i < 6; i++) recordSale(sold, 'RAGNAROCK_AXE', 28e6, NOW - i * H);
  return { bazaar, bin, sold, npc: new Map([['SULPHUR_ORE', 3]]), items: new Map(), now: NOW, tax: 0.01125 };
}

test('у каждого метода Crimson есть разбор и тег Crimson Isle', () => {
  for (const m of CRIMSON_METHODS) {
    const det = METHOD_DETAILS[m.id];
    assert.ok(det, `${m.id}: есть разбор`);
    assert.ok(det.steps.length >= 2 && det.risks.length >= 1, `${m.id}: шаги и риски`);
    assert.equal(m.tag, 'Crimson Isle');
    assert.doesNotMatch(m.desc, /У тебя/);
  }
});

test('без Combat 24 методы острова недоступны', () => {
  const list = moneyMethods(member(20), market(), {}).filter(x => x.id.startsWith('crimson-'));
  assert.equal(list.length, CRIMSON_METHODS.length);
  assert.ok(list.every(x => !x.available));
  assert.ok(moneyMethods(member(30), market(), {}).filter(x => x.id.startsWith('crimson-')).every(x => x.available));
});

test('ключи Kuudra не считаются доходом, аукцион без продаж — тоже', () => {
  const ctx = market();
  const r = dropIncome(ctx, MINIBOSS_LOOT.BARBARIAN_DUKE_X.drops, 10, 'offer');
  assert.ok(!r.rows.some(x => /KUUDRA/.test(x.id)), 'ключей нет в строках дохода');
  assert.ok(r.unpriced.includes('FLAMING_FIST'), 'Flaming Fist без продаж не считаем');
  const axe = dropIncome(ctx, MINIBOSS_LOOT.BLADESOUL.drops, 10, 'offer').rows.find(x => x.id === 'RAGNAROCK_AXE');
  assert.ok(axe && axe.unit <= 28e6, `топор по медиане продаж: ${axe?.unit}`);
});

test('доход мини-боссов реалистичный и с диапазоном', () => {
  const mb = moneyMethods(member(), market(), {}).find(x => x.id === 'crimson-minibosses');
  assert.equal(mb.source, 'live');
  assert.ok(mb.coinsPerHour > 100_000 && mb.coinsPerHour < 10e6, `в час ${mb.coinsPerHour}`);
  assert.ok(mb.coinsPerHourRange[0] < mb.coinsPerHourRange[1]);
  assert.match(mb.detail, /убийств в час/);
  const ids = mb.top.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, `один предмет — одна строка: ${ids}`);
});

test('дешёвый дроп упирается в спрос', () => {
  const ctx = market();
  ctx.bazaar.set('MAGMA_URCHIN', bz(300_000, 280_000, 70)); // 10 штук в день оборота
  const r = dropIncome(ctx, [{ id: 'MAGMA_URCHIN', q: 1, c: 1 }], 100, 'offer');
  assert.ok(r.capped.length === 1);
  assert.ok(r.perHour < 300_000, `не больше 3% дневного оборота: ${r.perHour}`);
});

test('Sulphur: выбирает выгодную форму и показывает коллекцию', () => {
  const s = moneyMethods(member(), market(), {}).find(x => x.id === 'crimson-sulphur');
  assert.ok(s.coinsPerHour > 0);
  assert.match(s.detail, /Enchanted Sulphur|ENCHANTED_SULPHUR/);
  assert.match(s.detail, /12\s?345/);
});

test('квесты фракции — ежедневный метод без выдуманного дохода', () => {
  const q = moneyMethods(member(), market(), {}).find(x => x.id === 'crimson-quests');
  assert.equal(q.mode, 'daily');
  assert.equal(q.coinsPerHour, null);
});

test('Sulphur: дрель тира 1 (сила ломания 7) не подходит, советуем тир 2', () => {
  const ctx = market();
  ctx.bin.set('TITANIUM_DRILL_2', { price: 20e6, count: 5 });
  const withT1 = moneyMethods(member(30, { inv: { inventory: [{ id: 'TITANIUM_DRILL_1' }] } }), ctx, {}).find(x => x.id === 'crimson-sulphur');
  assert.equal(withT1.reqs.find(r => /Дрель/.test(r.text)).status, 'soft');
  assert.equal(withT1.upgrade?.[0]?.cheapest?.id, 'TITANIUM_DRILL_2');
  const withT2 = moneyMethods(member(30, { inv: { inventory: [{ id: 'GEMSTONE_DRILL_2' }] } }), ctx, {}).find(x => x.id === 'crimson-sulphur');
  assert.equal(withT2.reqs.find(r => /Дрель/.test(r.text)).status, 'ok');
});

test('покупка снаряжения в стартовых вложениях считается один раз', () => {
  const ctx = market();
  ctx.bin.set('CRIMSON_CHESTPLATE', { price: 5e6, count: 5 });
  const mb = moneyMethods(member(), ctx, {}).find(x => x.id === 'crimson-minibosses');
  assert.equal(mb.buyCost, 5e6);
});
