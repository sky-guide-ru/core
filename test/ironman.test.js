// Ironman, Stranded, Bingo: свои варианты плана и «Заработка», обычный профиль — без изменений.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadmap } from '../src/advisor/index.js';
import { npcCoinOffer, obtainHint } from '../src/lib/npc-shop.js';
import { buyPrice, sellValue } from '../src/market/flips.js';
import { npcOnlyCtx } from '../src/market/methods.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const item = (id, extra = {}) => ({ id, name: id.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' '), recipes: [], ...extra });
const ITEMS = new Map([
  item('ADVENTURER_NPC', { name: 'Adventurer', recipes: [
    { type: 'npc_shop', cost: ['SKYBLOCK_COIN:500'], result: 'ZOMBIE_TALISMAN' },
    { type: 'npc_shop', cost: ['SKYBLOCK_COIN:900', 'ROTTEN_FLESH:8'], result: 'SKELETON_TALISMAN' },
  ] }),
  item('ZOMBIE_TALISMAN'),
  item('SKELETON_TALISMAN'),
  item('FARMING_TALISMAN', { recipe: { A1: 'WHEAT:16', A2: 'WHEAT:16' }, crafttext: 'Requires: Wheat Collection II' }),
  item('WHEAT', { name: 'Wheat' }),
  item('ZOMBIE_LORD', { name: 'Zombie Lord', recipes: [{ type: 'drops', name: 'Zombie Lord', drops: [{ id: 'RARE_THING', chance: '1%' }] }] }),
  item('RARE_THING'),
].map(i => [i.id, i]));

test('NPC за монеты: самое дешёвое предложение только за монеты', () => {
  assert.deepEqual(npcCoinOffer(ITEMS, 'ZOMBIE_TALISMAN'), { npc: 'ADVENTURER_NPC', npcName: 'Adventurer', coins: 500 });
  assert.equal(npcCoinOffer(ITEMS, 'SKELETON_TALISMAN'), null, 'монеты плюс предметы — не покупка за монеты');
  assert.equal(npcCoinOffer(ITEMS, 'FARMING_TALISMAN'), null);
});

test('где добыть: NPC, крафт с требованием, дроп', () => {
  assert.equal(obtainHint(ITEMS, 'ZOMBIE_TALISMAN').kind, 'npc');
  const craft = obtainHint(ITEMS, 'FARMING_TALISMAN');
  assert.equal(craft.kind, 'craft');
  assert.match(craft.text, /Wheat ×32/);
  assert.match(craft.text, /Wheat Collection II/);
  const drop = obtainHint(ITEMS, 'RARE_THING');
  assert.equal(drop.kind, 'drop');
  assert.match(drop.text, /Zombie Lord/);
  assert.equal(obtainHint(ITEMS, 'NOTHING').kind, 'other');
});

const ACC = {
  highestMp: 1009, notRecombCount: 3, recombPrice: 6.5e6, recombGain: 15,
  cheapestNext: [{ id: 'RARE_THING', name: 'Rare Thing', gain: 8, price: 400_000, perMp: 50_000 }],
  missing: [
    { id: 'RARE_THING', name: 'Rare Thing', gain: 8, price: 400_000, perMp: 50_000 },
    { id: 'FARMING_TALISMAN', name: 'Farming Talisman', gain: 3, price: 900_000, perMp: 300_000 },
    { id: 'ZOMBIE_TALISMAN', name: 'Zombie Talisman', gain: 3, price: 5_000_000, perMp: 1_600_000 },
  ],
};
const GEAR = { topItems: [{ name: 'Old Sword', where: 'Рюкзак 2', value: 30e6 }] };
const price = id => PRICES[id] || 0;
const obtain = id => obtainHint(ITEMS, id);
const byId = steps => new Map(steps.map(s => [s.id, s]));
const MARKET = /Bazaar|аукцион|Auction House|\bAH\b/;

test('Ironman: в плане нет покупок на рынке, вместо них NPC и «добыть»', () => {
  const m = { ...ownercatMember(), gameMode: 'ironman', cookie: false };
  const steps = buildRoadmap(m, ACC, GEAR, { price, obtain });
  for (const s of steps) {
    const text = [s.title, s.why, ...s.how].join(' ');
    assert.doesNotMatch(text, MARKET, `${s.id}: ${text}`);
    assert.ok(!s.how.some(h => h.startsWith('Купить: ')), `${s.id}: осталось «Купить:»`);
  }
  const s = byId(steps);
  assert.ok(!s.has('money-idle'), 'продать на рынке нельзя');
  assert.match(s.get('cookie').how[0], /Community Shop.*Gems/);
  assert.equal(s.get('cookie').cost, undefined);
  // Аксессуары: сначала то, что продаёт NPC, потом крафт, потом дроп — а не по цене AH
  const acc = s.get('mp-cheap');
  assert.match(acc.title, /^Добудь 3 аксессуара: \+14 MP$/);
  assert.match(acc.how[0], /^Zombie Talisman — \+3 MP: купить у NPC Adventurer \(~500\)/);
  assert.match(acc.how[1], /^Farming Talisman — \+3 MP: скрафтить/);
  assert.match(acc.how[2], /^Rare Thing — \+8 MP: выпадает с Zombie Lord/);
  assert.equal(acc.cost, undefined, 'не всё продаёт NPC — цены у шага нет');
});

test('Обычный профиль: варианты Ironman не включаются', () => {
  const m = { ...ownercatMember(), cookie: false };
  const s = byId(buildRoadmap(m, ACC, GEAR, { price, obtain }));
  assert.match(s.get('cookie').how[0], /Bazaar/);
  assert.match(s.get('mp-cheap').title, /^Докупи/);
  assert.ok(s.has('money-idle'));
});

test('Рынок только NPC: покупка у NPC за монеты, продажа NPC без налога', () => {
  const ctx = npcOnlyCtx({ items: ITEMS, npc: new Map([['WHEAT', 6], ['ZOMBIE_TALISMAN', 100]]), bazaar: new Map([['WHEAT', { buy: 9, sell: 8 }]]), bin: new Map([['RARE_THING', { price: 1e6 }]]), tax: 0.0125 });
  assert.deepEqual(buyPrice(ctx, 'ZOMBIE_TALISMAN'), { price: 500, market: 'NPC' });
  assert.equal(buyPrice(ctx, 'WHEAT'), null, 'пшеницу NPC не продаёт');
  assert.equal(buyPrice(ctx, 'RARE_THING'), null, 'аукциона нет');
  assert.equal(sellValue(ctx, 'WHEAT').net, 6);
  assert.equal(sellValue(ctx, 'RARE_THING'), null);
});
