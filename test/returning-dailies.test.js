import test from 'node:test';
import assert from 'node:assert/strict';
import { activityTimes, compactActivity } from '../src/parse/activity.js';
import { breakOf, returningInfo } from '../src/analysis/returning.js';
import { dailiesOf, dailyReset } from '../src/analysis/dailies.js';
import { sbxpPlan, skillLevelXp } from '../src/analysis/sbxp.js';

const DAY = 86400_000;
const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);

test('activityTimes: метки из разных разделов, без first_join и мусора', () => {
  const m = {
    profile: { first_join: NOW - 900 * DAY },
    player_data: { last_death: Math.floor((NOW - 2 * DAY) / 1000) }, // секунды
    dungeons: { treasures: { runs: [{ completion_ts: NOW - 3 * DAY }] } },
    experimentation: { pairings: { last_claimed: NOW - 5 * DAY, best_score_1: 1700000000000 } },
    slayer: { slayer_bosses: { zombie: { xp: 1600000000000 } } },
    nether_island_player_data: { quests: { quest_data: { q1: { completed_at: NOW + 10 * DAY } } } },
  };
  const t = activityTimes(m, { now: NOW });
  assert.deepEqual(t, [NOW - 2 * DAY, NOW - 3 * DAY, NOW - 5 * DAY]);
});

test('compactActivity: свежие по часу, старых не больше трёх', () => {
  const t = [NOW - 1000, NOW - 2000, NOW - 2 * DAY, NOW - 40 * DAY, NOW - 41 * DAY, NOW - 42 * DAY, NOW - 43 * DAY];
  assert.deepEqual(compactActivity(t, NOW), [NOW - 1000, NOW - 2 * DAY, NOW - 40 * DAY, NOW - 41 * DAY, NOW - 42 * DAY]);
});

test('breakOf: давно не заходил, вернулся, играет без перерыва', () => {
  assert.equal(breakOf([NOW - 45 * DAY], NOW).state, 'away');
  assert.equal(breakOf([NOW - 45 * DAY], NOW).days, 45);
  const back = breakOf([NOW - DAY, NOW - 3 * DAY, NOW - 60 * DAY], NOW);
  assert.equal(back.state, 'back');
  assert.equal(back.days, 57);
  assert.equal(breakOf([NOW - DAY, NOW - 10 * DAY, NOW - 20 * DAY], NOW), null);
  // перерыв закончился больше 14 дней назад — уже не показываем
  assert.equal(breakOf([NOW - DAY, NOW - 20 * DAY, NOW - 80 * DAY], NOW), null);
  assert.equal(breakOf([], NOW), null);
});

test('returningInfo: что нового предлагает', () => {
  const r = returningInfo({ activity: [NOW - 50 * DAY], skills: { hunting: { xp: 0 } }, mining: { hotm: { level: 1 } } }, NOW);
  assert.equal(r.state, 'away');
  assert.ok(r.fresh.some(x => x.id === 'hunting'));
  assert.ok(!r.fresh.some(x => x.id === 'glacite'));
  assert.match(r.title, /50/);
});

test('dailyReset: полночь по Нью-Йорку', () => {
  // 27.11.2026 12:00 UTC = 07:00 EST → сброс в 05:00 UTC
  assert.equal(dailyReset(NOW), Date.UTC(2026, 10, 27, 5, 0, 0));
});

test('dailiesOf: Experiments, квесты Crimson, Matriarch, Visitors', () => {
  const reset = dailyReset(NOW);
  const m = {
    skills: { enchanting: { level: 20 } },
    crimson: { faction: 'mages' },
    garden: { experience: 1000 },
    daily: {
      experiments: [reset + 1000, reset - 1000, 0],
      quests: [{ id: 'a', status: 'COMPLETE', at: reset + 5 }, { id: 'b', status: 'COMPLETE', at: reset - 5 }],
      questList: 5, questsReset: 0, matriarch: NOW - 2 * 3600_000, visitors: 2,
    },
  };
  const d = dailiesOf(m, NOW);
  const by = Object.fromEntries(d.items.map(i => [i.id, i]));
  assert.deepEqual(by.experiments.progress, [1, 3]);
  assert.deepEqual(by.crimson.progress, [1, 5]);
  assert.equal(by.matriarch.done, true);
  assert.equal(by.visitors.done, false);
  assert.equal(d.total, 4);
  assert.equal(dailiesOf({}, NOW), null);
});

test('sbxpPlan: бесплатное первым, потом по цене за XP', () => {
  assert.equal(skillLevelXp(10), 50);
  assert.equal(skillLevelXp(25), 200);
  const m = {
    sbLevel: 123.45, magicalPower: 500, fairySouls: { exchanges: 40, unspent: 12 },
    acc: null, minions: ['WHEAT_1', 'WHEAT_11'], unlockedCollTiers: ['WHEAT_1', 'WHEAT_2'], skills: { farming: { level: 10 } },
  };
  const p = sbxpPlan(m, {
    acc: { cheapestNext: [{ name: 'Talisman', gain: 3, price: 30000, perMp: 10000 }] },
    petScore: { score: 50, cheapest: [{ id: 'BEE;0', name: 'Bee', points: 1, cost: 6000, perPoint: 6000 }] },
  });
  assert.equal(p.level, 123);
  assert.equal(p.toNext, 55);
  assert.equal(p.rows[0].id, 'fairy');
  assert.equal(p.rows[0].free, 20);
  assert.equal(p.rows[1].id, 'pets'); // 2000 за XP дешевле 10000
  assert.equal(p.rows[1].perXp, 2000);
  assert.equal(p.rows.find(r => r.id === 'minions').have, 13);
  assert.equal(p.rows.find(r => r.id === 'collections').have, 8);
});

test('restCost/stockSaving: запасы из Sacks уменьшают докупку, крафт — по ингредиентам', async () => {
  const { restCost, stockSaving } = await import('../src/analysis/obtain.js');
  const tree = [
    { id: 'A', count: 10, unit: 100, total: 1000, via: 'bazaar', have: 4, need: 6 },
    { id: 'B', count: 2, unit: 500, total: 1000, via: 'craft', have: 0, need: 2, children: [{ id: 'C', count: 20, unit: 50, total: 1000, via: 'npc', have: 20, need: 0 }] },
  ];
  assert.equal(restCost(tree[0]), 600);
  assert.equal(restCost(tree[1]), 0);
  assert.equal(stockSaving(tree), 1400);
  assert.equal(stockSaving([{ id: 'X', count: 1, unit: 5, total: 5, via: 'bazaar' }]), 0);
});
