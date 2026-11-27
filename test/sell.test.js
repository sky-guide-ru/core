import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSell, ahNet, BAZAAR_TAX } from '../src/stash/sell.js';

const sword = (extra = {}) => ({ id: 'LIVID_DAGGER', name: 'Livid Dagger', count: 1, lore: ['', 'LEGENDARY DUNGEON DAGGER'], enchants: {}, ...extra });
const BZ = { ENCHANTED_MITHRIL: { buy: 2_600, sell: 2_400, sellWeek: 70_000 }, 'INK_SACK:3': { buy: 5, sell: 4, sellWeek: 7e6 }, ENCHANTMENT_SHARPNESS_6: { buy: 900_000, sell: 800_000, sellWeek: 700 } };
const BIN = { LIVID_DAGGER: { price: 3_000_000, count: 12 }, DIVAN_FRAGMENT: { price: 700_000, count: 40 } };
const NPC = { ENCHANTED_MITHRIL: 1600, HAMSTER_WHEEL: 20_000, 'INK_SACK-3': 3 };
const o = (extra = {}) => ({
  bazaar: id => BZ[id] || null, bin: id => BIN[id] || null, sold: () => null, npc: id => NPC[id] || 0, name: id => id,
  roadmap: [{ id: 'drill', title: "Divan's Drill", items: ['DIVAN_FRAGMENT'] }], ...extra,
});
const member = (mode = { market: true }) => ({
  mode,
  inv: {
    inventory: [sword(), { id: 'HAMSTER_WHEEL', count: 18, lore: [] }],
    enderChest: [sword(), { id: 'DIVAN_FRAGMENT', count: 6, lore: [] }, { id: 'ENCHANTED_BOOK', count: 1, lore: [], enchants: { sharpness: 6 } }],
    backpacks: { 4: [sword({ stars: 5 })], 5: [{ id: 'ENCHANTED_BOOK', count: 1, lore: [], enchants: { sharpness: 6 }, museum: true }] },
    armor: [], equipment: [], wardrobe: [], talismans: [],
    sacks: { ENCHANTED_MITHRIL: 3151, 'INK_SACK:3': 10 },
  },
});

test('налоги: Bazaar 1,25%, AH — сбор и 1% за получение выше 1 млн', () => {
  assert.equal(ahNet(1_000_000), 990_000);
  assert.equal(ahNet(5_000_000), 4_900_000);
  assert.equal(ahNet(50_000_000), 48_500_000);
});

test('что продать: где выгоднее, сразу и подождав, лишние копии снаряжения, нужное плану', () => {
  const r = analyzeSell(member(), o());
  const mith = r.items.find(x => x.id === 'ENCHANTED_MITHRIL');
  assert.equal(mith.now.how, 'bazaar'); assert.equal(mith.now.way, 'instant');
  assert.equal(mith.wait.way, 'offer');
  assert.equal(mith.wait.total, Math.round(2600 * (1 - BAZAAR_TAX) * 3151));
  assert.deepEqual(mith.where, [{ key: 'sacks', count: 3151 }]);
  // Два Livid Dagger без улучшений: один остаётся, второй — на AH; прокачанный не трогаем
  const dag = r.items.find(x => x.id === 'LIVID_DAGGER');
  assert.equal(dag.count, 1); assert.equal(dag.wait.how, 'ah'); assert.equal(dag.extra, 1);
  assert.equal(r.items.find(x => x.id === 'HAMSTER_WHEEL').wait.how, 'npc');
  const book = r.items.find(x => x.id === 'ENCHANTMENT_SHARPNESS_6');
  assert.ok(book, 'книга с одним чаром — по цене Bazaar');
  assert.equal(book.count, 1, 'сданное в Museum не продаётся');
  assert.ok(!r.items.find(x => x.id === 'INK_SACK-3'), 'мелочь дешевле 50 тыс. не показываем');
  assert.ok(!r.items.find(x => x.id === 'DIVAN_FRAGMENT'));
  assert.match(r.keep.find(x => x.id === 'DIVAN_FRAGMENT').why, /Divan's Drill/);
  assert.equal(r.items[0].id, 'ENCHANTED_MITHRIL', 'сначала самое дорогое');
  assert.ok(r.totals.wait >= r.totals.now);
  assert.equal(r.places.sacks, 1);
});

test('копия снаряжения уже надета или в Wardrobe — продаём все свободные', () => {
  const m = member(); m.inv.wardrobe = [sword()];
  assert.equal(analyzeSell(m, o()).items.find(x => x.id === 'LIVID_DAGGER').count, 2);
});

test('Ironman: только торговцы, остальное — отдельным списком', () => {
  const r = analyzeSell(member({ market: false }), o());
  assert.equal(r.market, false);
  assert.ok(r.items.every(x => x.now.how === 'npc' && x.wait.how === 'npc'));
  assert.equal(r.items.find(x => x.id === 'ENCHANTED_MITHRIL').wait.total, 1600 * 3151);
  assert.ok(r.noNpc.find(x => x.id === 'LIVID_DAGGER'));
});

test('Inventory API выключен', () => {
  assert.equal(analyzeSell({ inv: { apiDisabled: true } }, o()).apiDisabled, true);
});

test('на что потратить: рецепт из плана, что есть, чего не хватает и что можно скрафтить из запасов', async () => {
  const { analyzeCraft } = await import('../src/stash/craft.js');
  const items = new Map([
    ['DRILL', { recipe: { A1: 'ENCHANTED_MITHRIL:4', A2: 'GOLDEN_PLATE:2' } }],
    ['ENCHANTED_MITHRIL', { recipe: { A1: 'MITHRIL_ORE:32', A2: 'MITHRIL_ORE:32', A3: 'MITHRIL_ORE:32', B1: 'MITHRIL_ORE:32', B2: 'MITHRIL_ORE:32' } }],
    ['NOTHING', { recipe: { A1: 'GOLD_BLOCK:9' } }],
  ]);
  const m = { inv: { inventory: [{ id: 'ENCHANTED_MITHRIL', count: 1 }], sacks: { MITHRIL_ORE: 400 } } };
  const r = analyzeCraft(m, { items, name: id => id, roadmap: [{ id: 's', title: 'Drill', items: ['DRILL', 'NOTHING'] }] });
  assert.equal(r.items.length, 1, 'без единого ресурса не показываем');
  const em = r.items[0].parts.find(p => p.id === 'ENCHANTED_MITHRIL');
  assert.deepEqual([em.need, em.have, em.fromStash], [4, 1, 2]);
  assert.equal(r.items[0].ready, (3 / 4 + 0) / 2);
});

test('на что потратить с рынком: только если докупить дешевле готовой вещи', async () => {
  const { analyzeCraft } = await import('../src/stash/craft.js');
  const items = new Map([
    ['DRILL', { recipe: { A1: 'ENCHANTED_MITHRIL:4', A2: 'GOLDEN_PLATE:2' } }],
    ['CHEAP', { recipe: { A1: 'ENCHANTED_MITHRIL:2', A2: 'GOLDEN_PLATE:5' } }],
  ]);
  const m = { inv: { inventory: [{ id: 'ENCHANTED_MITHRIL', count: 4 }] } };
  const buy = id => ({ DRILL: 1_000_000, CHEAP: 100_000, GOLDEN_PLATE: 50_000, ENCHANTED_MITHRIL: 2_500 }[id] || 0);
  const r = analyzeCraft(m, { items, name: id => id, buy, roadmap: [{ id: 's', title: 'x', items: ['DRILL', 'CHEAP'] }] });
  assert.deepEqual(r.items.map(x => x.id), ['DRILL'], 'CHEAP: докупить 250 тыс. дороже готовой за 100 тыс.');
  assert.deepEqual([r.items[0].missCost, r.items[0].saving], [100_000, 900_000]);
});
