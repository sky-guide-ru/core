import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotHours, hotmReq, forgeSlots, quickForgeOf, forgeNow, forgeChain, drillUpgrades, forgeProfitPlans, stockOf, forgeForSelf } from '../src/market/forge.js';
import forgeGuide from '../src/guides/forge.js';
import { guideCtx } from '../src/guides/index.js';

// Мини-база NEU: рецепты Forge как в NEU-REPO (длительность в секундах)
const H = 3600;
const it = (id, name, inputs, hours, req) => [id, { id, name, displayname: name, crafttext: req ? `Requires: ${req}` : '', recipes: inputs ? [{ type: 'forge', inputs, duration: hours * H }] : [] }];
const items = new Map([
  it('ENCHANTED_MITHRIL', 'Enchanted Mithril'), it('ENCHANTED_COAL_BLOCK', 'Enchanted Coal Block'), it('ENCHANTED_DIAMOND_BLOCK', 'Enchanted Diamond Block'),
  it('REFINED_MITHRIL', 'Refined Mithril', ['ENCHANTED_MITHRIL:160'], 6, 'HotM 2'),
  it('REFINED_DIAMOND', 'Refined Diamond', ['ENCHANTED_DIAMOND_BLOCK:2'], 8, 'HotM 2'),
  it('FUEL_TANK', 'Fuel Canister', ['ENCHANTED_COAL_BLOCK:2'], 10, 'HotM 2'),
  it('MITHRIL_FUEL_TANK', 'Mithril-Infused Fuel Tank', ['REFINED_DIAMOND:5', 'REFINED_MITHRIL:10', 'FUEL_TANK:5'], 24, 'HotM 3'),
  it('BIG_THING', 'Big Thing', ['ENCHANTED_COAL_BLOCK:2'], 30, 'HotM 7'),
  it('MITHRIL_DRILL_1', 'Mithril Drill SX-R226', null),
]);
const P = { ENCHANTED_MITHRIL: 2_500, REFINED_MITHRIL: 520_000, ENCHANTED_DIAMOND_BLOCK: 150_000, REFINED_DIAMOND: 420_000, ENCHANTED_COAL_BLOCK: 25_000, FUEL_TANK: 130_000, BIG_THING: 120_000 };
const bazaar = new Map(Object.entries(P).map(([k, v]) => [k, { buy: v, sell: v * 0.95, buyWeek: 700_000, sellWeek: 700_000 }]));
const mctx = { bazaar, bin: new Map(), items, npc: new Map(), name: id => items.get(id)?.name || id, kind: () => null, tax: 0.0125, now: Date.now(), constants: {} };
const NOW = Date.now();

const member = (extra = {}) => ({
  uuid: 'u', purse: 50e6, mode: { market: true },
  mining: { hotm: { level: 5 }, nodes: { quick_forge: 0 } },
  inv: { inventory: [{ id: 'MITHRIL_DRILL_1', count: 1, upgrades: [] }, { id: 'FUEL_TANK', count: 5 }, { id: 'REFINED_MITHRIL', count: 3 }], sacks: { ENCHANTED_MITHRIL: 200 } },
  gather: { forge: [{ id: 'REFINED_MITHRIL', start: NOW - 7 * H * 1000, slot: 1 }, { id: 'FUEL_TANK', start: NOW - 3 * H * 1000, slot: 2 }] },
  ...extra,
});

test('forge: время слота по ритму заходов и уровень HotM из рецепта', () => {
  assert.equal(slotHours(6, 12), 12);
  assert.equal(slotHours(13, 12), 24);
  assert.equal(slotHours(24, 12), 24);
  assert.equal(slotHours(0.01, 4), 4);
  assert.equal(hotmReq('Requires: Mithril X & HotM 3'), 3);
  assert.equal(hotmReq(''), 0);
  assert.equal(forgeSlots({ mining: { hotm: { level: 5 } } }), 4);
  assert.equal(forgeSlots({ mining: { hotm: { level: 2 } }, gather: { forge: [{ slot: 3 }] } }), 3, 'занятый слот 3 — значит слотов не меньше трёх');
  assert.equal(quickForgeOf({ mining: { nodes: { quick_forge: 20 } } }), 0.2);
});

test('forge: что лежит в слотах — готово, куётся, пусто', () => {
  const r = forgeNow(member(), items, NOW);
  assert.equal(r.slots, 4);
  assert.equal(r.list[0].ready, true, 'Refined Mithril 6 ч начат 7 ч назад — готов');
  assert.equal(r.list[1].ready, false);
  assert.equal(Math.round(r.list[1].leftMs / 3600_000), 7, 'Fuel Canister 10 ч, прошло 3 ч');
  assert.ok(r.list[2].empty && r.list[3].empty);
});

test('forge: цепочка вычитает то, что есть, и раскладывает промежуточные ковки', () => {
  const m = member();
  const stock = stockOf(m, new Map(m.inv.inventory.map(x => [x.id, [x]])));
  const c = forgeChain(items, 'MITHRIL_FUEL_TANK', { stock, price: id => P[id] || null, slots: 4 });
  const by = Object.fromEntries(c.steps.map(s => [s.id, s]));
  assert.equal(by.FUEL_TANK.done, true, '5 Fuel Canister уже есть');
  assert.equal(by.REFINED_MITHRIL.crafts, 7, 'нужно 10, есть 3');
  assert.equal(by.REFINED_DIAMOND.crafts, 5);
  assert.equal(c.steps.at(-1).id, 'MITHRIL_FUEL_TANK', 'цель — последним шагом');
  const mith = c.materials.find(x => x.id === 'ENCHANTED_MITHRIL');
  assert.equal(mith.need, 7 * 160);
  assert.equal(mith.missing, 7 * 160 - 200, '200 Enchanted Mithril в Sacks');
  assert.ok(c.cost > 0);
  assert.ok(c.hours >= 8 + 24, 'не быстрее самой длинной ветки: Refined Diamond, потом сам бак');
});

test('forge: улучшение бура — следующая деталь в каждой цепочке, без рынка цен нет', () => {
  const m = member();
  const owned = new Map(m.inv.inventory.map(x => [x.id, [x]]));
  const u = drillUpgrades(items, { owned, stock: stockOf(m, owned), price: id => P[id] || null, member: m, slots: 4 });
  assert.equal(u.drill.id, 'MITHRIL_DRILL_1');
  const tank = u.parts.find(p => p.key === 'tank');
  assert.equal(tank.next, 'MITHRIL_FUEL_TANK');
  assert.equal(tank.locked, null, 'HotM 3 при HotM 5 открыт');
  const iron = drillUpgrades(items, { owned, stock: stockOf(m, owned), price: () => null, member: m, noMarket: true });
  assert.equal(iron.parts.find(p => p.key === 'tank').cost, null);
  const self = forgeForSelf(iron);
  assert.ok(self.some(s => s.id === 'REFINED_DIAMOND' && !s.enough), 'Ironman: Refined Diamond нужен, материалов нет');
});

test('forge: ритм заходов — при заходе раз в сутки длинный рецепт не хуже короткого', () => {
  const m = member({ mining: { hotm: { level: 7 }, nodes: {} } });
  const r = forgeProfitPlans(mctx, m, { collections: new Map() });
  const at = h => r.plans.find(p => p.visitH === h);
  assert.deepEqual(r.plans.map(p => p.visitH), [4, 12, 24]);
  for (const p of r.plans) assert.ok(p.used.length > 0 && p.perHour > 0);
  // Refined Mithril 6 ч при заходе раз в сутки держит слот 24 ч: его доход в час падает вчетверо
  const rm = h => at(h).top.find(t => t.id === 'REFINED_MITHRIL');
  if (rm(4) && rm(24)) assert.ok(rm(24).perHour < rm(4).perHour / 2);
  assert.ok(at(4).perHour >= at(24).perHour);
  const low = forgeProfitPlans(mctx, member({ mining: { hotm: { level: 2 }, nodes: {} } }), { collections: new Map() });
  assert.ok(low.goals.some(g => g.id === 'MITHRIL_FUEL_TANK' || g.id === 'BIG_THING'), 'закрытые по HotM рецепты — целями');
  assert.ok(!low.plans[0].used.some(u => u.id === 'BIG_THING'), 'закрытый рецепт в раскладку не попадает');
});

test('гайд The Forge: обычный профиль, Ironman и гость', () => {
  const deps = { priceOf: id => P[id] || 0, items, market: mctx, collections: new Map() };
  const m = member();
  const g = forgeGuide.build(m, guideCtx(m, {}, deps));
  const f = g.extra.forge;
  assert.equal(f.slots, 4);
  assert.ok(f.plans?.length === 3 && f.rows);
  assert.ok(f.now.some(s => s.empty && s.suggest), 'в пустой слот есть подсказка');
  assert.ok(g.next.some(n => /Забери готовое/.test(n.title)));

  const im = member({ mode: { market: false } });
  const gi = forgeGuide.build(im, guideCtx(im, {}, deps));
  assert.equal(gi.extra.forge.plans, null, 'Ironman: без выгодных рецептов по ценам рынка');
  assert.ok(gi.extra.forge.self.length > 0);
  assert.ok(gi.extra.forge.parts.every(p => p.cost == null));

  const guest = { guest: true, inv: {} };
  const gg = forgeGuide.build(guest, guideCtx(guest, {}, deps));
  assert.equal(gg.extra.forge.now, null);
  assert.ok(gg.extra.forge.plans);
});
