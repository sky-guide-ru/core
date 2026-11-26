// Тип профиля (Ironman, Stranded, Bingo), ранг Hypixel и капы скиллов, которые можно поднять
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadmap } from '../src/advisor/index.js';
import { profileMode, rankOf } from '../src/lib/profile-mode.js';
import { rankFor, _rankCache } from '../src/rank.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const price = id => PRICES[id] || 0;

test('тип профиля: у Ironman, Stranded и Bingo нет рынка', () => {
  assert.equal(profileMode('normal').market, true);
  assert.equal(profileMode(undefined).id, 'normal');
  for (const m of ['ironman', 'island', 'bingo']) assert.equal(profileMode(m).market, false, m);
  assert.equal(profileMode('island').label, 'Stranded');
});

test('Ironman: в плане нет «купить на аукционе», цены и «продай лишнее»', () => {
  const gear = { topItems: [{ id: 'OLD_DRAGON_HELMET', name: 'Old Dragon Helmet', where: 'Рюкзак 2', value: 8e6 }] };
  const normal = buildRoadmap(ownercatMember(), null, gear, { price });
  assert.ok(normal.some(s => s.id === 'money-idle'));
  assert.ok(normal.some(s => (s.how || []).some(h => h.startsWith('Купить: '))), 'в обычном профиле есть покупки');
  const m = ownercatMember(); m.gameMode = 'ironman';
  const iron = buildRoadmap(m, null, gear, { price });
  assert.ok(!iron.some(s => s.id === 'money-idle'));
  assert.ok(!iron.some(s => (s.how || []).some(h => h.startsWith('Купить: '))));
  assert.ok(iron.some(s => (s.how || []).some(h => /Добудь или скрафти сам: .*Ironman/.test(h))));
  assert.ok(!iron.some(s => s.needsSaving), 'не «накопи на покупку»');
});

test('ранг Hypixel: MVP++, MVP+, без ранга, персонал', () => {
  assert.equal(rankOf({ monthlyPackageRank: 'SUPERSTAR', newPackageRank: 'MVP_PLUS' }).label, 'MVP++');
  assert.equal(rankOf({ newPackageRank: 'MVP_PLUS', monthlyPackageRank: 'NONE' }).label, 'MVP+');
  assert.equal(rankOf({ packageRank: 'VIP' }).label, 'VIP');
  assert.equal(rankOf({}).id, 'NONE');
  assert.equal(rankOf({ rank: 'YOUTUBER', newPackageRank: 'MVP_PLUS' }).label, 'YOUTUBE');
  assert.equal(rankOf(null), null);
});

test('ранг запрашивается раз в 6 часов, ошибка не ломает профиль', async () => {
  _rankCache.clear();
  let calls = 0, t = 0;
  const fetcher = async () => { calls++; return { player: { newPackageRank: 'VIP_PLUS' } }; };
  assert.equal((await rankFor('u1', { fetcher, now: () => t })).label, 'VIP+');
  t += 3600_000;
  await rankFor('u1', { fetcher, now: () => t });
  assert.equal(calls, 1, 'кэш');
  t += 6 * 3600_000;
  await rankFor('u1', { fetcher, now: () => t });
  assert.equal(calls, 2, 'устарел — новый запрос');
  assert.equal(await rankFor('u2', { fetcher: async () => { throw new Error('429'); }, now: () => t }), null);
});

test('капы: Farming и Taming показывают, до скольки можно поднять и как', async () => {
  const { parseMember } = await import('../src/parse/profile.js');
  const uuid = 'u';
  const m = await parseMember({ game_mode: 'ironman', members: { u: { player_data: { experience: { SKILL_FARMING: 1e9, SKILL_TAMING: 1e9 } }, jacobs_contest: { perks: { farming_level_cap: 3 } } } } }, uuid);
  assert.equal(m.skills.farming.maxLevel, 53);
  assert.equal(m.skills.farming.capMax, 60);
  assert.match(m.skills.farming.capHow, /Anita/);
  assert.equal(m.skills.taming.capMax, 60);
  assert.equal(m.skills.mining.capMax, undefined, 'у Mining кап не поднимается');
  assert.equal(m.mode.label, 'Ironman');
});
