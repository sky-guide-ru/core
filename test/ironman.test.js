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

import { buildObtainGuide } from '../src/analysis/obtain.js';
import { sbxpPlan } from '../src/analysis/sbxp.js';
import { magicFind } from '../src/calc/magic-find.js';

test('«Как получить» без рынка: нет Bazaar и аукциона, есть NPC и крафт', () => {
  const buy = () => ({ price: 1000, market: 'ah' });
  const normal = buildObtainGuide('ZOMBIE_TALISMAN', { items: ITEMS, constants: {}, buy });
  assert.ok(normal.methods.some(m => m.kind === 'market'));
  const iron = buildObtainGuide('ZOMBIE_TALISMAN', { items: ITEMS, constants: {}, buy, noMarket: true });
  assert.ok(!iron.methods.some(m => m.kind === 'market'));
  assert.ok(iron.methods.some(m => m.kind === 'npc'));
  assert.ok(buildObtainGuide('FARMING_TALISMAN', { items: ITEMS, constants: {}, buy, noMarket: true }).methods.some(m => m.kind === 'craft'));
});

test('SkyBlock XP без рынка: без цен за XP', () => {
  const m = { sbLevel: 100, magicalPower: 500, fairySouls: { exchanges: 40, unspent: 0 }, skills: {} };
  const o = { acc: { cheapestNext: [{ name: 'Talisman', gain: 3, price: 30000, perMp: 10000 }] }, petScore: { score: 50, cheapest: [{ id: 'BEE;0', name: 'Bee', points: 1, cost: 6000, perPoint: 6000 }] }, museumBest: { id: 'X', name: 'X', cost: 5e5, gain: 5, perXp: 1e5 } };
  const p = sbxpPlan(m, { ...o, noMarket: true });
  for (const r of p.rows) { assert.equal(r.cost ?? null, null, r.id); assert.ok(!(r.perXp > 0), r.id); }
  assert.ok(['mp', 'pets', 'museum'].every(id => p.rows.some(r => r.id === id)));
});

test('Magic Find без рынка: аксессуары и Looting с подсказкой «где добыть»', () => {
  const m = { inv: { talismans: [], inventory: [] }, skills: { combat: { level: 30 } }, slayers: {}, extras: {}, effects: {}, cookie: false };
  const r = magicFind(m, { price: () => 0, noMarket: true, obtain: id => ({ text: `где ${id}` }) });
  assert.ok(r.next.some(n => n.key === 'looting' && /^где ENCHANTMENT_LOOTING/.test(n.how)));
  assert.ok(r.next.some(n => n.how?.startsWith('где ') && n.key !== 'looting'), 'аксессуары с MF');
  assert.equal(magicFind(m, { price: () => 0 }).next.filter(n => n.key === 'looting').length, 0, 'обычный профиль без цены — как раньше');
});

import { bingoGoalsLeft, bingoEventOf } from '../src/lib/live-status.js';

test('Bingo: невыполненные цели ивента — первым шагом плана', () => {
  const ev = bingoEventOf({ id: 42, name: 'November', start: 1000, end: Date.now() + 86400000, goals: [
    { id: 'a', name: 'Farmer', lore: '§7Reach §aFarming XV§7.' }, { id: 'b', name: 'Fisher', lore: '§7Catch a Squid.' }, { id: 'c', name: 'Miner' }] });
  const left = bingoGoalsLeft({ events: [{ key: 42, points: 3, completed_goals: ['b'] }] }, ev);
  assert.deepEqual(left.map(g => g.id), ['a', 'c']);
  assert.equal(left[0].lore, 'Reach Farming XV.');
  assert.equal(bingoGoalsLeft(null, ev).length, 3, 'ещё ни одной цели — все');
  assert.equal(bingoGoalsLeft(null, { ...ev, end: 1 }), null, 'ивент закончился');
  const m = { ...ownercatMember(), gameMode: 'bingo', cookie: false, bingoGoals: left };
  const steps = buildRoadmap(m, ACC, GEAR, { price, obtain });
  const s = byId(steps).get('bingo-goals');
  assert.match(s.title, /осталось целей — 2/);
  assert.match(s.how[0], /^Farmer: Reach Farming XV\.$/);
  assert.ok(!byId(buildRoadmap({ ...m, gameMode: 'ironman' }, ACC, GEAR, { price, obtain })).has('bingo-goals'), 'не Bingo — без шага');
});

test('Stranded: нет шагов про острова, куда не попасть', () => {
  const away = /^(dungeon-|kuudra|crimson-|rift-|hotm|hotf)/;
  const normal = buildRoadmap({ ...ownercatMember(), cookie: false }, ACC, GEAR, { price, obtain });
  assert.ok(normal.some(s => away.test(s.id)), 'у обычного профиля такие шаги есть — проверка не пустая');
  const stranded = buildRoadmap({ ...ownercatMember(), gameMode: 'island', cookie: false }, ACC, GEAR, { price, obtain });
  assert.deepEqual(stranded.filter(s => away.test(s.id)).map(s => s.id), []);
  assert.ok(stranded.length > 0);
});
