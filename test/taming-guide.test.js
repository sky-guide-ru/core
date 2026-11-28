import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuide, guideCtx } from '../src/guides/index.js';
import { crestBonus, expShareRate, cheapestXp, XP_TO_100, FANN, EXP_BOOSTS } from '../src/guides/taming.js';
import { petLadder } from '../src/guides/pets.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const deps = { priceOf: id => PRICES[id] || 0 };
const titles = g => g.sections.map(s => s.title);

test('taming: числа по вики', () => {
  assert.equal(crestBonus(-1, 50_000), 0);
  assert.equal(crestBonus(0, 0), 0.1);       // Common, 0–24 убийства
  assert.equal(crestBonus(4, 10_000), 5);    // Legendary, 10 000+
  assert.equal(crestBonus(2, 600), 1.5);     // Rare, 500–999 → 0,5% × 3
  assert.equal(expShareRate(60, { item: true, diana: true, attr: true }), 37); // максимум по вики
  assert.equal(expShareRate(25), 5);
  assert.equal(XP_TO_100[4], 25_353_230);
  assert.equal(cheapestXp(() => 0).name, 'Fann Light');
  assert.equal(cheapestXp(id => (id === 'ULTIMATE_CARROT_CANDY' ? 600_000 : 0)).food.id, 'ULTIMATE_CARROT_CANDY');
  assert.ok(FANN.every(f => f.xp > 0) && EXP_BOOSTS.every(b => b.pct >= 10 && b.how));
});

test('taming: гайд собирается по профилю и советует шаги', () => {
  const m = ownercatMember();
  m.skills.taming.level = 8;
  m.pets = [
    { type: 'ENDER_DRAGON', tier: 'LEGENDARY', exp: 1_000_000, level: 40, active: true, heldItem: null },
    { type: 'GRIFFIN', tier: 'LEGENDARY', exp: 3_000_000, level: 55, active: false, heldItem: null },
  ];
  const g = buildGuide('taming', m, {}, { ...deps, constants: { pets: { pet_types: { ENDER_DRAGON: 'COMBAT' } } } });
  assert.notEqual(g.status, 'error', g.summary);
  assert.equal(g.level.value, 8);
  for (const t of ['Твой Taming', 'Что ускоряет опыт питомца', 'Fann: тренировка за монеты', 'Сколько опыта до 100 уровня']) assert.ok(titles(g).includes(t), t);
  assert.ok(g.next.some(n => /Taming до 10/.test(n.title)));
  assert.ok(g.next.some(n => /Exp Boost/.test(n.title)), 'активному без предмета советуем Exp Boost');
  const mine = g.sections.find(s => s.title === 'Твои питомцы: где качать');
  assert.match(mine.rows[0][2].text, /Combat/);
});

test('taming: без рынка (Ironman) — без цен и без таблицы выгоды', () => {
  const m = ownercatMember();
  m.gameMode = 'ironman';
  const g = buildGuide('taming', m, {}, deps);
  assert.notEqual(g.status, 'error', g.summary);
  assert.ok(!titles(g).includes('Выгодно ли докачать до 100'));
  const boost = g.sections.find(s => s.title === 'Предметы Exp Boost');
  assert.ok(!boost.columns.includes('Цена'));
});

test('питомцы по этапам: в гайде режим, деньги и рынок берутся из профиля', () => {
  const m = ownercatMember();
  m.gameMode = 'ironman';
  m.purse = 2e9;
  const ctx = guideCtx(m, {}, { priceOf: () => 5e6, market: { any: true } });
  const L = petLadder(ctx, 'mining');
  assert.equal(L.market, false);
  assert.equal(L.liquid, 2e9 + (m.bank || 0) + (m.personalBank || 0));
});
