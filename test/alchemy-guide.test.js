import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientCosts, godHours, alchemyInt, xpCostPerMillion, brewCost, godActive, GOD_EFFECTS, XP_BREWS, BREWS, build } from '../src/guides/alchemy.js';
import { auctionKey } from '../src/market/auctions.js';

test('alchemy: God Potion и награды уровней по вики', () => {
  assert.equal(godHours(0), 12);
  assert.equal(godHours(50), 24);
  assert.equal(godHours(60), 24);
  assert.equal(alchemyInt(14), 14);
  assert.equal(alchemyInt(50), 86);
  assert.equal(GOD_EFFECTS.length, 32);
});

test('alchemy: цена 1 млн XP и себестоимость зелья', () => {
  const P = { ENCHANTED_SUGAR_CANE: 52_000, NETHER_STALK: 4, GLOWSTONE_DUST: 60, ENCHANTED_BLAZE_ROD: 590_000, ENCHANTED_REDSTONE_BLOCK: 25_000, ENCHANTED_GLOWSTONE: 168_000 };
  const buy = id => P[id] || 0;
  const c = xpCostPerMillion(XP_BREWS[0], buy);
  assert.equal(c.spend3, 52_000 + 12 + 60);
  assert.equal(c.perMillion, Math.round((52_072 - 17_499) / 45_000 * 1e6));
  const s = brewCost(BREWS.find(b => b.effect === 'strength'), buy);
  assert.equal(s.lvl, 8);
  assert.equal(s.perPotion, Math.round((590_000 + 25_000 + 168_000) / 3 + 4));
  assert.equal(xpCostPerMillion(XP_BREWS[0], () => 0), null);
  for (const b of BREWS) assert.ok(b.ings.at(-1)[1] + 3 >= b.max, `${b.name}: максимум достижим с Enchanted Glowstone`);
});

test('alchemy: God Potion узнаётся по набору эффектов', () => {
  const all = { active: GOD_EFFECTS.map(id => ({ id, secLeft: 20_000 })) };
  assert.equal(godActive(all), true);
  assert.equal(godActive({ active: [{ id: 'strength', secLeft: 20_000 }] }), false);
  assert.equal(godActive(null), false);
});

test('alchemy: ключ аукциона для зелий как в NEU', () => {
  assert.deepEqual(auctionKey({ id: 'POTION' }, { potion: 'strength', potion_level: 8 }), { key: 'POTION_STRENGTH;8' });
  assert.deepEqual(auctionKey({ id: 'POTION' }, { potion: 'strength', potion_level: 8, splash: 1 }), { key: 'POTION' });
  assert.deepEqual(auctionKey({ id: 'POTION' }, {}), { key: 'POTION' });
});

test('alchemy: Ironman без цен рынка', () => {
  const m = { skills: { alchemy: { level: 12 } }, mode: { id: 'ironman', market: false }, effects: { active: [] }, inv: {}, pets: [] };
  const ctx = { price: () => 1000, priceInfo: () => ({ bazaar: { buy: 1000 }, bin: { price: 1000 } }), name: id => id, has: () => false, owned: new Map(), m };
  const g = build(m, ctx);
  const brews = g.sections.find(s => s.news === 'brews');
  assert.ok(!brews.columns.includes('Аукцион'));
  assert.ok(!g.sections.some(s => s.news === 'sell'));
  assert.ok(!JSON.stringify(g).includes('аукцион'), 'в Ironman не предлагаем аукцион');
  assert.equal(g.level.value, 12);
});

test('alchemy: ингредиент купить, скрафтить из сырья или своё', () => {
  const items = new Map([['ENCHANTED_SUGAR_CANE', { id: 'ENCHANTED_SUGAR_CANE', recipe: { B2: 'ENCHANTED_SUGAR:160' } }], ['ENCHANTED_SUGAR', { id: 'ENCHANTED_SUGAR', recipe: { B2: 'SUGAR_CANE:160' } }]]);
  const B = { ENCHANTED_SUGAR_CANE: 60_000, ENCHANTED_SUGAR: 400, SUGAR_CANE: 2 };
  const S = { ENCHANTED_SUGAR_CANE: 55_000, ENCHANTED_SUGAR: 380, SUGAR_CANE: 2.5 };
  const c = ingredientCosts('ENCHANTED_SUGAR_CANE', { buy: id => B[id] || 0, sell: id => S[id] || 0, items });
  assert.equal(c.buy, 60_000);
  assert.equal(c.craft, 160 * 160 * 2); // из Sugar Cane дешевле, чем из Enchanted Sugar
  assert.equal(c.via, 'SUGAR_CANE');
  assert.equal(c.own, 160 * 160 * 2.5); // своё сырьё дороже продать сырьём
  const none = ingredientCosts('FLINT', { buy: () => 0, sell: () => 0, items });
  assert.deepEqual([none.buy, none.craft, none.own], [0, 0, 0]);
});
