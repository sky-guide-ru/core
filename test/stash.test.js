import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSacks, analyzeEssence, neuId, marketId } from '../src/stash/index.js';
import { buildGuide } from '../src/guides/index.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const BZ = {
  'INK_SACK:3': { buy: 5, sell: 4, sellWeek: 7_000_000 },
  ENCHANTED_MITHRIL: { buy: 2_600, sell: 2_400, sellWeek: 70_000 },
  WOLF_TOOTH: { buy: 6, sell: 5, sellWeek: 700 },
};
const NPC = { 'INK_SACK-3': 3, WOLF_TOOTH: 10, STONE: 1 };

test('мешки: id профиля ↔ NEU, цены Bazaar и NPC, группы по видам мешков', () => {
  assert.equal(neuId('INK_SACK:3'), 'INK_SACK-3');
  assert.equal(marketId('INK_SACK-3'), 'INK_SACK:3');
  const m = { inv: { sacks: { 'INK_SACK:3': 1000, ENCHANTED_MITHRIL: 3151, WOLF_TOOTH: 2702, STONE: 40320, NOTHING: 0 } } };
  const r = analyzeSacks(m, { bazaar: id => BZ[id] || null, npc: id => NPC[id] || 0, name: id => id });
  assert.equal(r.kinds, 4, 'нулевые позиции не показываем');
  const mith = r.items.find(x => x.id === 'ENCHANTED_MITHRIL');
  assert.equal(mith.value, 3151 * 2400);
  assert.equal(mith.sack, 'Enchanted Mining');
  assert.equal(mith.how, 'bazaar');
  assert.equal(r.items[0].id, 'ENCHANTED_MITHRIL', 'сначала самое дорогое');
  const cocoa = r.items.find(x => x.id === 'INK_SACK-3');
  assert.equal(cocoa.marketId, 'INK_SACK:3');
  assert.equal(cocoa.sack, 'Agronomy');
  // NPC платит больше Bazaar — советуем NPC
  const tooth = r.items.find(x => x.id === 'WOLF_TOOTH');
  assert.equal(tooth.how, 'npc');
  assert.equal(tooth.value, 2702 * 10);
  // Камень без Bazaar, только NPC
  assert.equal(r.items.find(x => x.id === 'STONE').value, 40320);
  assert.ok(r.groups.length >= 3);
  assert.equal(r.total, r.items.reduce((s, x) => s + x.value, 0));
  assert.deepEqual(r.sell.map(x => x.id), ['ENCHANTED_MITHRIL'], 'в «продай» только позиции от 1 млн');
});

test('эссенции: перки магазина из NEU, следующий уровень, что можно купить', () => {
  const m = {
    essence: { WITHER: 600, UNDEAD: 0, CRIMSON: 3000 },
    perks: { permanent_health: 4, permanent_speed: 2, forbidden_blessing: 1, fresh_tools_kuudra: 1 },
    inv: {},
  };
  const owned = new Map([['SHADOW_ASSASSIN_CHESTPLATE', [{ id: 'SHADOW_ASSASSIN_CHESTPLATE', stars: 3, where: 'Гардероб' }]]]);
  const constants = { essencecosts: { SHADOW_ASSASSIN_CHESTPLATE: { type: 'Undead', 1: 30, 2: 60, 3: 120, 4: 240, 5: 400 } } };
  const r = analyzeEssence(m, { constants, price: id => ({ ESSENCE_WITHER: 3000, ESSENCE_CRIMSON: 1000 })[id] || 0, name: id => id, owned });
  const w = r.types.find(t => t.type === 'WITHER');
  assert.equal(w.value, 600 * 3000);
  const fh = w.perks.find(p => p.key === 'permanent_health');
  assert.deepEqual([fh.name, fh.level, fh.max, fh.next, fh.left], ['Forbidden Health', 4, 5, 1500, 1500]);
  assert.equal(fh.affordable, false);
  const fs = w.perks.find(p => p.key === 'permanent_speed');
  assert.equal(fs.next, null, 'Forbidden Speed уже максимальный');
  // 600 Wither: 1-е уровни Def, Int, Str по 100, затем 2-й уровень за 250; дальше не хватает
  assert.equal(w.buyable, 4);
  assert.ok(fh.ru, 'у Forbidden-перков есть описание');
  assert.equal(fh.ruName, 'Запретное здоровье');
  assert.ok(r.types.every(t => t.perks.every(p => p.ruName)), 'у всех перков есть русское название');
  const u = r.types.find(t => t.type === 'UNDEAD');
  assert.equal(u.stars.length, 1);
  assert.deepEqual([u.stars[0].next, u.stars[0].need, u.stars[0].affordable], [240, 640, false]);
  assert.ok(u.itemsUsing >= 1);
  assert.equal(r.types[0].type, 'WITHER', 'порядок: сначала Wither');
  assert.ok(r.types.every(t => t.info.what && t.info.get.length && t.info.use.length), 'у каждой эссенции есть справка');
});

test('гайд «Эссенции и перки» собирается на фикстуре', () => {
  const g = buildGuide('essence', ownercatMember(), {}, { priceOf: id => PRICES[id] || 0 });
  assert.notEqual(g.status, 'error', g.summary);
  assert.ok(g.sections.some(s => s.title === 'Твои эссенции'));
  assert.ok(g.sections.some(s => s.title === 'Перки за Wither Essence'));
  assert.ok(g.sections.some(s => /Crimson Essence/.test(s.title)));
});

test('мешки: лестница размеров — каких нет, что увеличить, рецепт и цена', async () => {
  const { analyzeSackLadder, recipeParts } = await import('../src/stash/index.js');
  const it = (recipe, crafttext, cap) => ({ recipe, crafttext, lore: [`§7Capacity: §e${cap} of each item`] });
  const grid = (mat, n, mid) => ({ A1: `${mat}:${n}`, A2: `${mat}:${n}`, A3: `${mat}:${n}`, B1: `${mat}:${n}`, B2: mid ? `${mid}:1` : `${mat}:${n}`, B3: `${mat}:${n}`, C1: `${mat}:${n}`, C2: `${mat}:${n}`, C3: `${mat}:${n}` });
  const items = new Map([
    ['BEGINNER_AGRONOMY_SACK', it(null, '', 640)],
    ['SMALL_AGRONOMY_SACK', it(grid('ENCHANTED_WHEAT', 1, 'BEGINNER_AGRONOMY_SACK'), 'Requires: Wheat VII', 2240)],
    ['MEDIUM_AGRONOMY_SACK', it(grid('ENCHANTED_WHEAT', 32, 'SMALL_AGRONOMY_SACK'), 'Requires: Wheat VIII', 6720)],
    ['LARGE_AGRONOMY_SACK', it(grid('ENCHANTED_WHEAT', 64, 'MEDIUM_AGRONOMY_SACK'), 'Requires: Wheat X', 20160)],
    ['SMALL_COMBAT_SACK', it(null, '', 2240)], ['MEDIUM_COMBAT_SACK', it(null, '', 6720)], ['LARGE_COMBAT_SACK', it(null, '', 20160)],
    ['FLOWER_SACK', it(null, '', 1000)],
  ]);
  assert.deepEqual(recipeParts(items.get('MEDIUM_AGRONOMY_SACK')), [{ id: 'ENCHANTED_WHEAT', count: 256 }, { id: 'SMALL_AGRONOMY_SACK', count: 1 }]);
  const constants = { sacks: { sacks: {
    Agronomy: { item: 'LARGE_AGRONOMY_SACK', contents: ['WHEAT'] },
    Combat: { item: 'LARGE_COMBAT_SACK', contents: ['ROTTEN_FLESH'] },
    Flower: { item: 'FLOWER_SACK', contents: ['ROSE'] },
  } } };
  const m = { inv: { sacksBag: [{ id: 'SMALL_AGRONOMY_SACK' }], sacks: { ROSE: 5 } } };
  const r = analyzeSackLadder(m, { constants, items, price: id => ({ ENCHANTED_WHEAT: 160 })[id] || 0, name: id => id });
  const ag = r.families.find(f => f.name === 'Agronomy');
  assert.equal(ag.state, 'upgrade');
  assert.equal(ag.steps[ag.ownedTier].size, 'маленький');
  assert.equal(ag.next.id, 'MEDIUM_AGRONOMY_SACK');
  assert.equal(ag.next.craftCost, 256 * 160, 'цена крафта без предыдущего мешка');
  assert.ok(ag.next.needsPrev);
  assert.deepEqual(ag.next.collection, { name: 'Wheat', tier: 8, roman: 'VIII', milestone: false });
  assert.deepEqual(ag.next.where, []);
  assert.equal(ag.next.capacity, 6720);
  assert.equal(r.families.find(f => f.name === 'Combat').state, 'missing');
  const fl = r.families.find(f => f.name === 'Flower');
  assert.equal(fl.state, 'unknown', 'мешка не видно, но в нём лежат вещи');
  assert.equal(fl.steps[0].size, null, 'у мешка одного размера размер не пишем');
  assert.deepEqual([r.upgradable, r.missing], [1, 1]);
  assert.equal(r.families[0].name, 'Agronomy', 'сначала что увеличить');
});

test('мешки: покупка у торговца считается в цену, Bits — нет', async () => {
  const { analyzeSackLadder } = await import('../src/stash/index.js');
  const items = new Map([['FLOWER_SACK', { lore: [] }], ['BRONZE_TROPHY_FISHING_SACK', { lore: [] }]]);
  const constants = { sacks: { sacks: { Flower: { item: 'FLOWER_SACK', contents: [] }, 'Bronze Trophy Fishing': { item: 'BRONZE_TROPHY_FISHING_SACK', contents: [] } } } };
  const W = {
    FLOWER_SACK: [{ kind: 'npc', cost: [{ id: 'SKYBLOCK_BIT', count: 14000 }], textRu: 'Купить у NPC Elizabeth (Хаб) за 14000× Bit' }],
    BRONZE_TROPHY_FISHING_SACK: [{ kind: 'npc', cost: [{ id: 'SKYBLOCK_COIN', count: 1_000_000 }], textRu: 'Купить у NPC Odger за 1 млн монет' }],
  };
  const r = analyzeSackLadder({ inv: {} }, { constants, items, price: () => 0, whereToGet: id => W[id] });
  const fl = r.families.find(f => f.name === 'Flower');
  assert.deepEqual(fl.next.where, [{ text: W.FLOWER_SACK[0].textRu, coins: null }]);
  assert.equal(r.families.find(f => f.name === 'Bronze Trophy Fishing').next.cost, 1_000_000);
});

test('мешки: Events Sack объединяет Winter и Spooky — они не «нет»', async () => {
  const { analyzeSackLadder } = await import('../src/stash/index.js');
  const items = new Map([
    ['LARGE_EVENTS_SACK', { recipes: [{ type: 'crafting', A1: 'CARNIVAL_TICKET:10', A2: 'LARGE_WINTER_SACK:1', B2: 'LARGE_CANDY_SACK:1' }], lore: [] }],
    ['LARGE_WINTER_SACK', { lore: [] }], ['LARGE_CANDY_SACK', { lore: [] }],
  ]);
  const constants = { sacks: { sacks: {
    Events: { item: 'LARGE_EVENTS_SACK', contents: ['PUMPKIN_GUTS'] }, Winter: { item: 'LARGE_WINTER_SACK', contents: ['WHITE_GIFT'] }, Spooky: { item: 'LARGE_CANDY_SACK', contents: ['PUMPKIN_GUTS'] },
  } } };
  const own = analyzeSackLadder({ inv: { sacksBag: [{ id: 'LARGE_EVENTS_SACK' }] } }, { constants, items, price: () => 0 });
  for (const n of ['Winter', 'Spooky']) {
    const f = own.families.find(x => x.name === n);
    assert.equal(f.state, 'merged', n);
    assert.equal(f.mergedInto.name, 'Events');
    assert.equal(f.next, null);
  }
  assert.deepEqual(own.families.find(x => x.name === 'Events').merges.sort(), ['Spooky', 'Winter']);
  assert.equal(own.missing, 0);
  // Без Events Sack старые мешки по-прежнему считаются отдельными
  const none = analyzeSackLadder({ inv: {} }, { constants, items, price: () => 0 });
  assert.equal(none.families.find(x => x.name === 'Winter').state, 'missing');
});

test('эссенции: где стоит NPC магазина — остров, координаты, ближайший варп', () => {
  const items = new Map([['TYZZO_NPC', { displayname: '§9Tyzzo (NPC)', island: 'combat_3', x: -597, y: 6, z: -272 }], ['FROZEN_ALEX_NPC', { displayname: 'Frozen Alex (NPC)', island: 'winter', x: -43, y: 84, z: -1 }]]);
  const constants = { islands: { island_warps: [{ mode: 'combat_3', warp: 'drag', x: -590, z: -265 }, { mode: 'combat_3', warp: 'end', x: -500, z: -300 }, { mode: 'winter', warp: 'winter', x: 0, z: 100 }] } };
  const r = analyzeEssence({ essence: {}, perks: {}, inv: {} }, { constants, items, price: () => 0 });
  const d = r.types.find(t => t.type === 'DRAGON').info.shopPlace;
  assert.equal(d.npc, 'Tyzzo');
  assert.deepEqual(d.coords, [-597, 6, -272]);
  assert.equal(d.warp, 'drag');
  assert.match(d.island, /End|Энд/);
  assert.ok(r.types.find(t => t.type === 'ICE').info.shopPlace.note, 'у Jerry\'s Workshop есть пометка про сезон');
  assert.equal(r.types.find(t => t.type === 'FOSSIL').info.shopPlace, null, 'NPC нет в базе — места нет');
  assert.ok(r.types.every(t => t.info.shop), 'у каждой эссенции указан магазин');
});
