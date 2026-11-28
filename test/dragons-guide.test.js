import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lootFor, averageLoot } from '../src/guides/dragons.js';
import { DRAGONS } from '../src/guides/dragons-data.js';
import { buildGuide } from '../src/guides/index.js';
import { ownercatMember } from './fixtures/ownercat.js';

const sup = DRAGONS.find(d => d.key === 'superior');
const young = DRAGONS.find(d => d.key === 'young');

test('драконы: без глаз нет Ender Dragon и Aspect of the Dragons, с 400 вкладом нет нагрудника', () => {
  const ids = lootFor(young, 0, 400, () => 1).rows.map(r => r.id);
  assert.ok(!ids.some(id => id.startsWith('ENDER_DRAGON') || id === 'ASPECT_OF_THE_DRAGON'));
  assert.ok(!ids.includes('YOUNG_DRAGON_CHESTPLATE'));
  assert.ok(ids.includes('YOUNG_DRAGON_LEGGINGS') && ids.includes('DRAGON_SCALE'));
});

test('драконы: одна главная вещь за бой — шансы складываются не больше 1', () => {
  for (const d of DRAGONS) {
    const s = lootFor(d, 8, 1200, () => 1).rows.reduce((a, r) => a + r.p, 0);
    assert.ok(s <= 1 + 1e-9, `${d.key}: ${s}`);
  }
  assert.ok(lootFor(sup, 4, 480, () => 1).rows.some(r => r.id === 'DRAGON_HORN'));
  assert.ok(!lootFor(sup, 4, 480, () => 1).rows.some(r => r.id === 'ASPECT_OF_THE_DRAGON'));
});

test('драконы: шансы вариантов в сумме 100%, без цен средний дроп 0', () => {
  assert.equal(Math.round(DRAGONS.reduce((s, d) => s + d.chance, 0) * 100), 100);
  assert.equal(averageLoot(4, 480, () => 0), 0);
});

test('драконы: бои из профиля попадают в гайд, Ironman без цен', () => {
  const m = ownercatMember();
  m.extras = { ...m.extras, dragonFight: { kills: { superior: 3, young: 10 }, deaths: {}, mostDamage: { best: 420_000, superior: 300_000 }, fastestKill: {}, summoned: { total: 40 }, eyesPlaced: { total: 12 }, crystals: 5 } };
  const g = buildGuide('dragons', m, {}, { priceOf: id => (id === 'SUMMONING_EYE' ? 1_000_000 : 0) });
  assert.match(g.summary, /13/);
  assert.match(g.summary, /Superior 3/);
  const mine = g.sections.find(s => s.title === 'Твои бои с драконами');
  assert.equal(mine.rows.find(r => r[0] === 'Superior')[2], (300_000).toLocaleString('ru-RU'));
  m.mode = { ...(m.mode || {}), market: false };
  const iron = buildGuide('dragons', m, {}, { priceOf: () => 5 });
  const scen = iron.sections.find(s => s.title === 'Выгода: сколько глаз класть');
  assert.ok(scen.rows.every(r => r[4] === '—'));
  assert.ok(iron.next.some(n => /Special Zealot/.test(n.title)));
});

test('драконы: личная удача — Magic Find множит шансы, Bestiary даёт +45 с 15 уровня, Special Zealot с бонусами', async () => {
  const { dragonBestiary, zealotChance } = await import('../src/guides/dragons.js');
  const young = DRAGONS.find(d => d.key === 'young');
  const base = lootFor(young, 4, 480, () => 1).rows.find(r => r.id === 'YOUNG_DRAGON_LEGGINGS');
  const lucky = lootFor(young, 4, 480, () => 1, { mf: 100 }).rows.find(r => r.id === 'ASPECT_OF_THE_DRAGON');
  assert.ok(lucky.p > lootFor(young, 4, 480, () => 1).rows.find(r => r.id === 'ASPECT_OF_THE_DRAGON').p * 1.9);
  assert.ok(base.p > 0);
  assert.deepEqual(dragonBestiary({ bestiaryKills: { young_dragon_100: 200, old_dragon_100: 60 } }, null).mf, 45);
  assert.equal(dragonBestiary({ bestiaryKills: { young_dragon_100: 100, master_wither_king_dragon_100: 999 } }, null).tier, 12);
  const z = zealotChance({ pets: [{ type: 'ENDERMAN', tier: 'LEGENDARY', level: 100 }], perks: { inc_zealots_odds: 5 } });
  assert.equal(Math.round(z.oneIn), Math.round(420 / (1.25 * 1.1)));
  assert.equal(Math.round(zealotChance({}).oneIn), 420);
});
