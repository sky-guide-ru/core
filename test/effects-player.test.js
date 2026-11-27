import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEffects, buffTotals, effectStats } from '../src/lib/effects.js';
import { hypixelInfoOf, networkLevel } from '../src/lib/hypixel-player.js';
import { rankFor, hypixelInfo } from '../src/rank.js';

test('зелья: уровни из описаний, время в секундах, бессрочные и выключенные', () => {
  assert.deepEqual(effectStats('strength', 8), { strength: 75 });
  assert.deepEqual(effectStats('critical', 4), { crit_chance: 25, crit_damage: 40 });
  const e = parseEffects({
    active_effects: [
      { effect: 'strength', level: 8, modifiers: [], ticks_remaining: 72000, infinite: false },
      { effect: 'night_vision', level: 2, modifiers: [], ticks_remaining: 2147469336, infinite: true },
      { effect: 'spirit', level: 4, ticks_remaining: 2400 },
    ],
    paused_effects: [{ effect: 'critical', level: 4, ticks_remaining: 20 }],
    disabled_potion_effects: ['spirit'],
    temp_stat_buffs: [{ stat: 4, key: 'cake_strength', amount: 2, expire_at: 2e12 }, { key: 'cake_health', amount: 10, expire_at: 1 }],
  }, 1e12);
  assert.equal(e.active[0].secLeft, 3600);
  assert.equal(e.active[0].name, 'Strength');
  assert.equal(e.active[0].roman, 'VIII');
  assert.equal(e.active[1].infinite, true);
  assert.equal(e.active[1].secLeft, null);
  assert.equal(e.paused.length, 1);
  assert.equal(e.cakes.length, 1, 'истёкший торт отброшен');
  // spirit выключен, critical на паузе — не считаются
  assert.deepEqual(buffTotals(e, 1e12), { strength: 77 });
});

test('зелья: пустой и битый player_data не ломают разбор', () => {
  assert.deepEqual(parseEffects({ active_effects: null, temp_stat_buffs: null }), { active: [], paused: [], disabled: [], cakes: [] });
  assert.deepEqual(buffTotals(null), {});
});

test('/player: уровень сети, ссылки только https, достижения', () => {
  assert.equal(Math.floor(networkLevel(13979073)), 103);
  const i = hypixelInfoOf({
    networkExp: 13979073, achievementPoints: 2430, karma: 5, firstLogin: 1664450503023,
    socialMedia: { links: { DISCORD: 'cat', TWITCH: 'https://www.twitch.tv/x', YOUTUBE: 'javascript:alert(1)' } },
    achievements: { skyblock_unique_gifts: 28, skyblock_treasure_hunter: 0, bedwars_level: 5 },
  });
  assert.equal(Math.floor(i.networkLevel), 103);
  assert.deepEqual(i.socials, [{ id: 'DISCORD', name: 'cat' }, { id: 'TWITCH', url: 'https://www.twitch.tv/x' }]);
  assert.deepEqual(i.achievements.map(a => [a.key, a.value]), [['skyblock_unique_gifts', 28]]);
  assert.equal(hypixelInfoOf(null), null);
});

test('/player: сведения берутся из того же ответа, что и ранг', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return { player: { newPackageRank: 'MVP_PLUS', networkExp: 0, achievementPoints: 7 } }; };
  const r = await rankFor('u-test-1', { fetcher });
  assert.equal(r.id, 'MVP_PLUS');
  assert.equal(hypixelInfo('u-test-1').achievementPoints, 7);
  await rankFor('u-test-1', { fetcher });
  assert.equal(calls, 1);
});

import { contestStats } from '../src/parse/profile.js';
test("Jacob's Contest: медали за всё время и лучшее место (позиция с нуля)", () => {
  const s = contestStats({
    '471:6_18:MOONFLOWER': { collected: 1, claimed_medal: 'platinum', claimed_position: 7, claimed_participants: 1400, claimed_rewards: true },
    '472:3_6:CARROT_ITEM': { collected: 1, claimed_medal: 'silver', claimed_position: 461, claimed_participants: 1583, claimed_rewards: true },
    '472:3_9:WHEAT': { collected: 5 },
  });
  assert.equal(s.total, 3);
  assert.equal(s.claimed, 2);
  assert.equal(s.medals.platinum, 1);
  assert.equal(s.medals.silver, 1);
  assert.deepEqual([s.best.crop, s.best.place, s.best.of], ['MOONFLOWER', 8, 1400]);
  assert.equal(contestStats(null).total, 0);
});
