import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCollections, parseUnlock, collectionsResource, collectionItemId } from '../src/collections/index.js';
import { analyzeMinions, minionSlots, actionTime, unlockReq } from '../src/minions/index.js';
import { coopShared } from '../src/parse/profile.js';
import minionsGuide from '../src/guides/minions.js';

// Мини-база NEU: пара миньонов и предметы для ссылок из наград
const gen = (type, tier, { name, secs = 20, crafttext = '', recipe } = {}) => [`${type}_GENERATOR_${tier}`, {
  id: `${type}_GENERATOR_${tier}`, name: `${name} Minion ${['', 'I', 'II', 'III'][tier]}`, crafttext,
  lore: ['§7Place this minion', '', `§7Time Between Actions: §a${secs}s`, '§7Max Storage: §e64'], recipe,
}];
const ITEMS = new Map([
  gen('WHEAT', 1, { name: 'Wheat', secs: 15, crafttext: 'Requires: Wheat I', recipe: { A1: 'WHEAT:10', B2: 'WOOD_HOE:1' } }),
  gen('WHEAT', 2, { name: 'Wheat', secs: 15, recipe: { A1: 'WHEAT:20', B2: 'WHEAT_GENERATOR_1:1' } }),
  gen('WHEAT', 3, { name: 'Wheat', secs: 13, recipe: { A1: 'WHEAT:40', B2: 'WHEAT_GENERATOR_2:1' } }),
  gen('SNOW', 1, { name: 'Snow', secs: 13, recipe: { A1: 'SNOW_BALL:64', B2: 'WOOD_SHOVEL:1' } }),
  gen('SNOW', 2, { name: 'Snow', secs: 13, recipe: { A1: 'SNOW_BLOCK:32', B2: 'SNOW_GENERATOR_1:1' } }),
  gen('VAMPIRE', 1, { name: 'Vampire', secs: 190, crafttext: 'Requires: Hemovibe I', recipe: { A1: 'HEMOVIBE:80' } }),
  gen('INFERNO', 1, { name: 'Inferno', secs: 1013, crafttext: 'Requires: Blaze Slayer III', recipe: { A1: 'BLAZE_ROD:64' } }),
  ['FARM_SUIT_HELMET', { id: 'FARM_SUIT_HELMET', name: 'Farm Suit Helmet', lore: [] }],
  ['ENCHANTED_BREAD', { id: 'ENCHANTED_BREAD', name: 'Enchanted Bread', lore: [] }],
]);
const CONSTANTS = { misc: { minions: { WHEAT_GENERATOR: 3, SNOW_GENERATOR: 2, VAMPIRE_GENERATOR: 1, INFERNO_GENERATOR: 1 } } };
const PRICES = { WHEAT: 6, SEEDS: 1, SNOW_BALL: 3, SNOW_BLOCK: 12, WOOD_HOE: 10, WOOD_SHOVEL: 5, HEMOVIBE: 100, BLAZE_ROD: 10 };
const price = id => PRICES[id] || 0;
const name = id => ITEMS.get(id)?.name || id;

test('снимок ресурса коллекций читается и в нём все разделы', () => {
  const r = collectionsResource();
  assert.deepEqual(Object.keys(r.collections).sort(), ['COMBAT', 'FARMING', 'FISHING', 'FORAGING', 'MINING', 'RIFT']);
  assert.equal(r.collections.FARMING.items.WHEAT.tiers[0].amountRequired, 50);
  assert.equal(collectionItemId('INK_SACK:4'), 'INK_SACK-4');
  assert.equal(collectionItemId('MUSHROOM_COLLECTION'), 'RED_MUSHROOM');
});

test('награды тира: миньон, рецепт со ссылкой, опыт, скидка, слоты', () => {
  assert.deepEqual(parseUnlock('Wheat Minion Recipes', ITEMS).item, 'WHEAT_GENERATOR_1');
  assert.equal(parseUnlock('Wheat Minion Recipes', ITEMS).kind, 'minion');
  const r = parseUnlock('Farm Suit Helmet Recipe', ITEMS);
  assert.equal(r.kind, 'recipe'); assert.equal(r.item, 'FARM_SUIT_HELMET');
  assert.equal(parseUnlock('+4 SkyBlock XP').kind, 'xp');
  assert.equal(parseUnlock('+10,000 Farming Experience').ru, '+10,000 опыта Farming');
  assert.equal(parseUnlock('Harvesting Exp Discount (-25%)').ru, 'Зачарование Harvesting на 25% дешевле по опыту');
  assert.equal(parseUnlock('Medium Accessory Bag Upgrade (+6 slots)').ru, 'Medium Accessory Bag: +6 слотов');
  assert.equal(parseUnlock('+1 Foraging Level Cap').ru, '+1 к максимальному уровню Foraging');
});

test('коллекции: тир, сколько до следующего, что откроет; кооп суммирует', () => {
  const m = { collections: { WHEAT: 600, CACTUS: 0 }, unlockedCollTiers: ['WHEAT_4'] };
  const a = analyzeCollections(m, { items: ITEMS, full: true });
  assert.equal(a.status, 'ok');
  const w = a.entries.find(e => e.id === 'WHEAT');
  assert.equal(w.tier, 4); // 500 ≤ 600 < 1000
  assert.equal(w.next.need, 1000); assert.equal(w.next.left, 400);
  assert.ok(Math.abs(w.next.progress - 0.2) < 1e-9);
  assert.ok(w.next.unlocks.some(u => u.item === 'ENCHANTED_BREAD'));
  assert.ok(!w.next.unlocks.some(u => u.kind === 'xp'), 'SkyBlock XP не дублируется в наградах');
  assert.equal(a.sbXp, a.tiers * 4);
  assert.ok(a.close.includes('WHEAT'));
  assert.ok(a.notStarted.includes('CACTUS'));
  assert.ok(a.minionUnlocks.includes('CACTUS'), 'I тир Cactus откроет миньона');

  // unlocked_coll_tiers выше, чем по количеству (кооп без доступа к чужому API) — верим тиру из игры
  const b = analyzeCollections({ collections: { WHEAT: 10 }, unlockedCollTiers: ['WHEAT_3'] }, { items: ITEMS });
  assert.equal(b.entries.find(e => e.id === 'WHEAT').tier, 3);

  const c = analyzeCollections({ collections: { WHEAT: 300 }, coop: { members: [{ collectionsApi: true }, { collectionsApi: false }], collections: { WHEAT: 1200 } } }, { items: ITEMS });
  const cw = c.entries.find(e => e.id === 'WHEAT');
  assert.equal(cw.amount, 1200); assert.equal(cw.tier, 5); assert.equal(cw.coopShare, 0.25);
  assert.equal(c.coop.hidden, 1);

  assert.equal(analyzeCollections({ collections: {}, unlockedCollTiers: [] }).status, 'off');
});

test('coopShared: складывает коллекции и крафты, пропускает ушедших', () => {
  assert.equal(coopShared({ members: { a: {} } }, 'a'), null);
  const p = { members: {
    a: { collection: { WHEAT: 10 }, player_data: { crafted_generators: ['WHEAT_1', 'WHEAT_2'] } },
    b: { collection: { WHEAT: 5, CACTUS: 3 }, player_data: { crafted_generators: ['WHEAT_1', 'SNOW_1'] } },
    c: { profile: { deletion_notice: { timestamp: 1 } }, collection: { WHEAT: 999 } },
  } };
  const s = coopShared(p, 'a');
  assert.deepEqual(s.collections, { WHEAT: 15, CACTUS: 3 });
  assert.deepEqual(s.minions.sort(), ['SNOW_1', 'WHEAT_1', 'WHEAT_2']);
  assert.equal(s.members.length, 2);
});

test('миньоны: слоты с Community Shop, пропуски тиров, замки, дешёвые крафты, доход', () => {
  assert.equal(minionSlots(109).slots, 11);
  assert.equal(actionTime(ITEMS.get('INFERNO_GENERATOR_1')), 1013);
  assert.deepEqual(unlockReq(ITEMS, 'INFERNO'), { kind: 'slayer', name: 'Blaze', tier: 3, text: 'Blaze Slayer III' });

  const collections = analyzeCollections({ collections: { WHEAT: 100 } }, { items: ITEMS, full: true });
  const m = { minions: ['WHEAT_1', 'WHEAT_3'], extras: { communityUpgrades: { minion_slots: 2 } }, slayers: { blaze: { level: 2 } } };
  const a = analyzeMinions(m, { items: ITEMS, constants: CONSTANTS, price, name, collections });
  assert.equal(a.unique, 2); assert.equal(a.slots, 5); assert.equal(a.totalSlots, 7); assert.equal(a.left, 3);
  const wheat = a.types.find(t => t.type === 'WHEAT');
  assert.deepEqual(wheat.missing, [2]);
  assert.equal(wheat.next, null, 'III — максимум в мини-базе');
  assert.equal(a.types.find(t => t.type === 'VAMPIRE').locked.kind, 'collection');
  assert.equal(a.types.find(t => t.type === 'INFERNO').locked.have, 2);
  // Кандидаты: пропущенный Wheat II (120) и Snow I (192); закрытые не предлагаются
  assert.deepEqual(a.cheapest.map(c => `${c.type}${c.tier}`), ['WHEAT2', 'SNOW1']);
  assert.ok(a.cheapest[0].gap);
  assert.equal(a.toNextCost, null, 'на 3 крафта открытых кандидатов только 2');
  // Wheat III: 13 с между действиями → 86400/26 сборов × (6 + 1)
  assert.equal(wheat.perDay, Math.round(86400 / 26 * 7));
  assert.equal(a.profit[0], 'SNOW'); // 86400/26 × 4 × 3 = 39 877 > 23 262

  // В коопе считаются крафты всех участников
  const c = analyzeMinions({ ...m, coop: { members: [{}, {}], minions: ['WHEAT_1', 'WHEAT_2', 'WHEAT_3', 'SNOW_1'] } }, { items: ITEMS, constants: CONSTANTS, price, name, collections });
  assert.equal(c.unique, 4); assert.equal(c.ownUnique, 2);
});

test('гайд «Миньоны» считает кооп и Community Shop', () => {
  const ctx = { items: ITEMS, price, name, adv: { data: {}, opts: { constants: CONSTANTS } }, owned: new Map(), has: () => false };
  const g = minionsGuide.build({ minions: ['WHEAT_1'], coop: { members: [{}, {}], minions: ['WHEAT_1', 'SNOW_1', 'SNOW_2', 'WHEAT_2', 'WHEAT_3'] }, extras: { communityUpgrades: { minion_slots: 3 } } }, { ...ctx, constants: CONSTANTS });
  const text = g.sections.find(s => s.title === 'Как работают слоты').text.join(' ');
  assert.match(text, /В коопе 5 из/);
  assert.match(text, /ещё 3 из Community Shop, всего 9/);
});
