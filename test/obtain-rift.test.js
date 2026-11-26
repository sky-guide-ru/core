// Коллекции Рифта в «Как получить»: подпись, тир из ресурса Hypixel, подсказка, где копить,
// и запасной текст вместо «нет цены и рецепта» для предметов Рифта.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObtainGuide, costTree, reqRu } from '../src/analysis/obtain.js';
import { collectionsByName, fixCrafttext } from '../src/market/requirements.js';
import { RIFT_COLLECTIONS, patchReqLabels } from '../src/rift/collections.js';

const items = new Map(Object.entries({
  // crafttext как в NEU (устарел: после 0.27.2 кольцо на тире IV)
  BLUETOOTH_RING: { id: 'BLUETOOTH_RING', name: 'Bluetooth Ring', crafttext: 'Requires: Living Metal Heart III', recipes: [],
    recipe: { A1: 'METAL_HEART:4', A2: 'METAL_HEART:4', A3: 'METAL_HEART:4', B1: 'METAL_HEART:4', B3: 'METAL_HEART:4', C1: 'METAL_HEART:4', C2: 'METAL_HEART:4', C3: 'METAL_HEART:4' } },
  METAL_HEART: { id: 'METAL_HEART', name: 'Living Metal Heart', recipes: [] },
  ENCHANTED_SUGAR: { id: 'ENCHANTED_SUGAR', name: 'Enchanted Sugar', crafttext: 'Requires: Sugar Cane IV', recipes: [], recipe: { A1: 'SUGAR_CANE:32' } },
  SUGAR_CANE: { id: 'SUGAR_CANE', name: 'Sugar Cane', recipes: [] },
}));
// кусок ресурса /v2/resources/skyblock/collections (версия 2026.11)
const resource = { collections: {
  RIFT: { items: { METAL_HEART: { name: 'Living Metal Heart', tiers: [
    { tier: 1, amountRequired: 1, unlocks: ['Snake-in-a-Boot Recipe', '+4 SkyBlock XP'] },
    { tier: 2, amountRequired: 10, unlocks: ['Living Metal Anchor Recipe'] },
    { tier: 3, amountRequired: 25, unlocks: ['Nothing-in-a-Bottle Recipe'] },
    { tier: 4, amountRequired: 50, unlocks: ['Bluetooth Ring Recipe'] },
    { tier: 5, amountRequired: 100, unlocks: ['Polarvoid Book Recipe'] },
  ] } } },
  FARMING: { items: { SUGAR_CANE: { name: 'Sugar Cane', tiers: [1, 2, 3, 4].map(t => ({ tier: t, amountRequired: t * 100, unlocks: t === 4 ? ['Enchanted Sugar Recipe'] : [] })) } } },
} };
const collections = collectionsByName(resource);
const member = { collections: { METAL_HEART: 12 }, unlockedCollTiers: ['METAL_HEART_2'] };
const ctx = (extra = {}) => ({ items, constants: {}, buy: () => null, collections, ...extra });

test('fixCrafttext берёт тир из наград ресурса, а не из устаревшего NEU', () => {
  assert.equal(fixCrafttext('Requires: Living Metal Heart III', 'Bluetooth Ring', collections), 'Requires: Living Metal Heart IV');
  assert.equal(fixCrafttext('Requires: Sugar Cane IV', 'Enchanted Sugar', collections), 'Requires: Sugar Cane IV');
  assert.equal(fixCrafttext('Requires: Living Metal Heart III', 'Bluetooth Ring', null), 'Requires: Living Metal Heart III');
  assert.equal(fixCrafttext('Requires: HotM 5', 'Whatever', collections), 'Requires: HotM 5');
});

test('подпись: «коллекция Рифта» только для коллекций Рифта', () => {
  assert.equal(reqRu('Requires: Living Metal Heart IV'), 'коллекция Рифта Living Metal Heart IV');
  assert.equal(reqRu('Requires: Sugar Cane IV'), 'коллекция Sugar Cane IV');
});

test('крафт Bluetooth Ring: тир IV, счётчик из 50, подсказка где копить и ссылка на гайд Рифта', () => {
  const g = buildObtainGuide('BLUETOOTH_RING', ctx({ member }));
  const m = g.methods.find(x => x.kind === 'craft');
  assert.equal(m.req.text, 'коллекция Рифта Living Metal Heart IV');
  assert.equal(m.req.ok, false);
  assert.match(m.req.have, /Living Metal Heart II \(12 из 50 шт\.\)/);
  assert.match(m.req.hint, /коллекция Рифта/);
  assert.match(m.req.hint, /50 шт\. Living Metal Heart/);
  assert.match(m.req.hint, /Living Metal Snake/);
  assert.match(m.req.hint, /Frozen Water Pungi/);
  assert.equal(m.guide, 'rift');
  // ингредиент без рынка и рецепта — не «нет цены и рецепта», а где добыть
  const heart = m.steps.find(s => s.tree).tree[0];
  assert.equal(heart.via, 'rift');
  assert.match(heart.viaRu, /Living Cave/);
  assert.doesNotMatch(heart.viaRu, /нет цены/);
});

test('у обычных коллекций подсказки Рифта нет', () => {
  const g = buildObtainGuide('ENCHANTED_SUGAR', ctx());
  const m = g.methods.find(x => x.kind === 'craft');
  assert.equal(m.req.hint, undefined);
  assert.equal(m.guide, undefined);
});

test('карточка самого Living Metal Heart: способ «Добыть в Рифте» с тирами и своим счётом', () => {
  const g = buildObtainGuide('METAL_HEART', ctx({ member }));
  const m = g.methods.find(x => x.kind === 'rift');
  assert.ok(m);
  assert.equal(m.title, 'Добыть в Рифте (Living Cave)');
  const text = m.steps.map(s => s.text).join(' ');
  assert.match(text, /1 \/ 10 \/ 25 \/ 50 \/ 100/);
  assert.match(text, /У тебя сейчас 12 шт\./);
});

test('все 7 коллекций Рифта описаны, и у каждой есть запасной текст в дереве', () => {
  assert.deepEqual(Object.keys(RIFT_COLLECTIONS).sort(), ['AGARICUS_CAP', 'CADUCOUS_STEM', 'HALF_EATEN_CARROT', 'HEMOVIBE', 'METAL_HEART', 'TIMITE', 'WILTED_BERBERIS']);
  for (const id of Object.keys(RIFT_COLLECTIONS)) {
    const n = costTree(id, 5, { items: new Map([[id, { id, name: RIFT_COLLECTIONS[id].name, recipes: [] }]]), constants: {}, buy: () => null });
    assert.equal(n.via, 'rift', id);
    assert.match(n.viaRu, /только в Рифте/, id);
  }
});

test('patchReqLabels правит готовую русскую карточку items-ru', () => {
  const ru = { descriptionRu: 'Нужно: коллекция Living Metal Heart III.', whereToGet: [{ requirementRu: 'коллекция Living Metal Heart III' }] };
  const out = patchReqLabels(ru, 'Requires: Living Metal Heart III', 'Requires: Living Metal Heart IV');
  assert.equal(out.descriptionRu, 'Нужно: коллекция Рифта Living Metal Heart IV.');
  assert.equal(out.whereToGet[0].requirementRu, 'коллекция Рифта Living Metal Heart IV');
  assert.equal(ru.descriptionRu, 'Нужно: коллекция Living Metal Heart III.');
  const sugar = { descriptionRu: 'коллекция Sugar Cane IV' };
  assert.equal(patchReqLabels(sugar, 'Requires: Sugar Cane IV', 'Requires: Sugar Cane IV'), sugar);
});

