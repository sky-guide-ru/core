import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePetScore, petScoreReward, petScoreOptions, cheapestPlan, tamingCapPlan, petScoreSummary } from '../src/analysis/pet-score.js';
import { chocolateAdvice, employeeCap } from '../src/analysis/chocolate.js';

const pet = (type, tier, level = 1, maxLevel = 100, heldItem = null) => ({ type, tier, level, maxLevel, heldItem, id: `${type};${['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'].indexOf(tier)}` });

test('Pet Score: тип один раз по высшей редкости, +1 за максимум, Tier Boost и Montezuma', () => {
  const r = computePetScore([
    pet('ENDER_DRAGON', 'EPIC'), pet('ENDER_DRAGON', 'LEGENDARY', 100),
    pet('BEE', 'RARE', 1, 100, 'PET_ITEM_TIER_BOOST'),
    pet('FRACTURED_MONTEZUMA_SOUL', 'MYTHIC'),
  ]);
  assert.equal(r.rarityPoints, 5 + 4);
  assert.equal(r.maxedPoints, 1);
  assert.equal(r.score, 10);
  assert.equal(r.types.size, 2);
});

test('пороги Magic Find как в SkyCrypt', () => {
  assert.deepEqual(petScoreReward(9), { mf: 0, next: { need: 10, mf: 1, left: 1 } });
  assert.equal(petScoreReward(130).mf, 6);
  assert.deepEqual(petScoreReward(174).next, { need: 175, mf: 7, left: 1 });
  assert.deepEqual(petScoreReward(520), { mf: 13, next: null });
});

test('дешёвые очки: один вариант на тип, сортировка по цене за очко, жадный план', () => {
  const { types } = computePetScore([pet('BEE', 'RARE')]);
  const prices = { 'BEE;4': 4e6, 'BAT;0': 2e5, 'BAT;3': 4e5, 'WOLF;4': 50e6, 'SQUID;2': 0 };
  const opts = petScoreOptions(types, { petIds: Object.keys(prices), price: id => prices[id] || 0, maxedPrice: id => (id === 'BEE;3' ? 1e6 : 0) });
  assert.deepEqual(opts.map(o => [o.type, o.kind, o.points]), [['BAT', 'new', 4], ['BEE', 'rarity', 2], ['WOLF', 'new', 5]]);
  const plan = cheapestPlan(opts, 5);
  assert.equal(plan.picks.length, 2);
  assert.equal(plan.cost, 4e5 + 4e6);
  assert.ok(plan.enough);
});

test('кап Taming: только список George, нужная редкость, сданные пропускаем', () => {
  const prices = { 'JELLYFISH;3': 9e6, 'JELLYFISH;4': 5e6, 'FROST_WISP;2': 2e5, 'ENDERMAN;4': 1, 'ENDERMAN;5': 3e6, 'GHOUL;3': 2e4, 'RAT;4': 3e4 };
  const sacrificed = ['black_cat', 'rift_ferret', 'slug', 'spirit', 'giraffe', 'bal', 'baby_yeti'];
  const t = tamingCapPlan({ tamingCap: 57, sacrificed, pets: [pet('ENDERMAN', 'MYTHIC', 100)], price: id => prices[id] || 0 });
  assert.equal(t.left, 3);
  // Ghoul и Rat не в списке George — их не предлагаем; Enderman нужен Mythic, и он уже есть у игрока
  assert.deepEqual(t.candidates.map(c => c.type), ['ENDERMAN', 'FROST_WISP', 'JELLYFISH']);
  assert.equal(t.candidates[0].owned.tier, 'MYTHIC');
  assert.equal(t.candidates[2].id, 'JELLYFISH;4', 'берём самую дешёвую из подходящих редкостей');
  assert.equal(t.candidates[2].minTier, 'EPIC');
  assert.equal(t.totalCost, 2e5 + 5e6);
});

test('кап Taming: Legendary Enderman не подходит — нужен Mythic', () => {
  const t = tamingCapPlan({ tamingCap: 59, sacrificed: ['BLACK_CAT', 'RIFT_FERRET', 'SLUG', 'SPIRIT', 'GIRAFFE', 'BAL', 'BABY_YETI', 'FROST_WISP', 'JELLYFISH'], pets: [pet('ENDERMAN', 'LEGENDARY')], price: () => 0 });
  assert.equal(t.candidates.length, 1);
  assert.equal(t.candidates[0].owned, null);
});

test('сводка для страницы: план до порога и почти прокачанные питомцы', () => {
  const s = petScoreSummary({ pets: [pet('BEE', 'LEGENDARY', 95), pet('BAT', 'LEGENDARY')], tamingCap: 60, tamingSacrificedTypes: [], extras: { leveling: { petScore: 10 } } },
    { petIds: ['WOLF;4'], price: () => 1e6, name: id => id });
  assert.equal(s.score, 10);
  assert.equal(s.next.need, 25);
  assert.equal(s.nearMax[0].type, 'BEE');
  assert.equal(s.plan.picks[0].id, 'WOLF;4');
  assert.equal(s.taming.left, 0);
});

test('шоколадная фабрика: кап по престижу, советы по порядку важности', () => {
  assert.equal(employeeCap(6, { rabbit_bro: 220 }), 220);
  assert.equal(employeeCap(6, { rabbit_bro: 223 }), 223, 'Divine-кролики поднимают кап');
  const a = chocolateAdvice({
    prestige: 3, chocolate: 3.9e9, total: 12e9, sincePrestige: 2e9, timeTower: 10, timeTowerCharges: 3, clickUpgrades: 10,
    employees: { rabbit_bro: 160, rabbit_cousin: 150, rabbit_sis: 140 }, shrine: 5, coach: null, hitmanSlots: 4, shopSpent: 30e6,
    found: ['castle', 'towny', 'mush_mush'], rabbits: 3, locations: { hub: ['hub_big_useless_door'] },
  });
  const ids = a.tips.map(t => t.id);
  assert.equal(ids[0], 'cf-tower-charges');
  assert.ok(ids.includes('cf-full'));
  assert.ok(ids.includes('cf-employees'));
  assert.ok(!ids.includes('cf-coach'), 'Coach открывается с 4 престижа');
  assert.match(a.tips.find(t => t.id === 'cf-prestige').title, /2 млрд из 4 млрд/);
  assert.match(a.tips.find(t => t.id === 'cf-shop').title, /Delta/);
  assert.equal(a.cap, 160);
  assert.equal(a.employees.find(e => e.key === 'rabbit_cousin').gain, 20);
  assert.ok(a.residents.found >= 3);
  assert.ok(!a.residents.missing.some(r => r.name === 'Mush Mush'));
  assert.equal(a.eggs.find(e => e.island === 'HUB').missing, 16);
});

test('фабрика на максимуме: без лишних советов про сотрудников и престиж', () => {
  const a = chocolateAdvice({ prestige: 6, chocolate: 1e9, total: 279e9, sincePrestige: 31e9, timeTower: 15, clickUpgrades: 40,
    employees: Object.fromEntries(['bro', 'cousin', 'sis', 'father', 'grandma', 'uncle', 'dog'].map(k => [`rabbit_${k}`, 220])), rabbits: 179 });
  assert.ok(a.maxedEmployees);
  const ids = a.tips.map(t => t.id);
  assert.ok(!ids.includes('cf-employees') && !ids.includes('cf-prestige') && !ids.includes('cf-tower'));
  assert.match(a.tips.find(t => t.id === 'cf-milestone').title, /Vanilla Vortex/);
  assert.equal(a.residents, null, 'ключи кроликов не совпали ни с одним резидентом — список не показываем');
});
