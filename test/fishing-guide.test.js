import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuide } from '../src/guides/index.js';
import { sbDate } from '../src/guides/fishing.js';
import { parseFishing } from '../src/parse/fishing.js';
import { CREATURES, TROPHY_FISH } from '../src/guides/fishing-data.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const deps = { priceOf: id => ({ ...PRICES, MAGMA_FISH: 1_000, HELLFIRE_ROD: 30_000_000 })[id] || 0 };

test('рыбалка: разбор сырого профиля — трофеи из members.trophy_fish, убийства из бестиария', () => {
  const r = parseFishing({
    player_stats: { items_fished: { total: 10 }, sea_creature_kills: 5, kills: { sea_walker_4: 3, zombie_knight: 9 } },
    bestiary: { kills: { sea_walker_4: 7, moogma_210: 2, pest_firefly_1: 100 } },
    trophy_fish: { blobfish: 1, blobfish_bronze: 1 },
  });
  assert.equal(r.seaCreatureKills, 5);
  assert.deepEqual(r.kills, { sea_walker_4: 7, moogma_210: 2 });
  assert.equal(r.trophyFish.blobfish, 1);
  assert.equal(parseFishing({ nether_island_player_data: { trophy_fish: { gusher: 2 } } }).trophyFish.gusher, 2);
});

test('рыбалка: гайд по профилю OwnerCat (Fishing 36, Inferno Rod, 16/18 трофеев)', () => {
  const g = buildGuide('fishing', ownercatMember(), {}, deps);
  assert.notEqual(g.status, 'error', g.summary);
  assert.match(g.summary, /Fishing 36\/50/);
  assert.match(g.summary, /16\/18/);
  assert.match(g.summary, /Inferno Rod/);
  const titles = g.next.map(n => n.title).join(' | ');
  assert.match(titles, /Hellfire Rod/);
  assert.match(titles, /Thunder Armor/);       // лавовый микс есть, следующий сет — Thunder
  assert.match(titles, /Obfuscated 3|Moldfin/); // два вида не пойманы
  assert.match(titles, /Adept/);
  const trophy = g.sections.find(s => s.title.startsWith('Trophy Fish'));
  assert.equal(trophy.rows.length, 18);
  const ranks = g.sections.find(s => s.title.startsWith('Награды Odger'));
  assert.equal(ranks.items[0].done, true);   // Novice: 16 видов ≥ 15
  assert.equal(ranks.items[1].done, false);  // Adept: серебра нет у 5 видов
  const sea = g.sections.find(s => s.title.startsWith('Sea Creatures'));
  assert.equal(sea.rows.length, CREATURES.length);
  assert.ok(sea.rows.some(r => r[1] === 'Sea Walker' && /674/.test(r[4].text)));
});

test('рыбалка: справочник без дублей, календарь SkyBlock', () => {
  assert.equal(TROPHY_FISH.length, 18);
  assert.equal(new Set(CREATURES.map(c => c.name)).size, CREATURES.length);
  assert.deepEqual(sbDate(1560275700000), { year: 1, month: 0, day: 1 });
  assert.deepEqual(sbDate(1560275700000 + 31 * 20 * 60_000 + 20 * 60_000), { year: 1, month: 1, day: 2 });
});

test('трофеи: счётчик по тирам — «именно этот тир» и «этот или выше»', async () => {
  const { trophyTierCounts } = await import('../src/guides/fishing-data.js');
  const c = trophyTierCounts(ownercatMember().fishing.trophyFish);
  assert.equal(c.species, 16);
  assert.deepEqual(c.tiers.bronze, { exact: 13, atLeast: 16 });  // Flyfish, Vanille и Obfuscated 2 без бронзы
  assert.deepEqual(c.tiers.silver, { exact: 12, atLeast: 13 });
  assert.deepEqual(c.tiers.gold, { exact: 7, atLeast: 7 });
  assert.deepEqual(c.tiers.diamond, { exact: 1, atLeast: 1 });
  assert.equal(parseFishing({ trophy_fish: { moldfin_silver: 1 } }).trophyTiers.tiers.bronze.atLeast, 1);
});

test('трофеи: гайд — пропавшие виды названы, план до алмаза от быстрого к долгому', async () => {
  const { tierOdds, expectedCatches } = await import('../src/guides/trophy.js');
  const o = tierOdds(0);
  assert.ok(Math.abs(o.exact.gold - 0.01996) < 1e-6);
  assert.ok(Math.abs(o.exact.bronze - 0.73353) < 1e-5);
  assert.ok(Math.abs(tierOdds(5).exact.diamond - 0.0022) < 1e-9);
  assert.equal(expectedCatches(0.5, 599, 600), 1);             // 600-й улов гарантирован
  assert.ok(expectedCatches(0.002, 0, 600) < 600);

  const g = buildGuide('trophy', ownercatMember(), {}, deps);
  assert.notEqual(g.status, 'error', g.summary);
  assert.match(g.summary, /бронза 13\/18 · серебро 12\/18 · золото 7\/18 · алмаз 1\/18/);
  const titles = g.next.map(n => n.title).join(' | ');
  assert.match(titles, /Moldfin/);
  assert.match(titles, /Obfuscated 3/);
  assert.match(titles, /Novice/);                              // Bronze Hunter Armor в профиле нет
  const plan = g.sections.find(s => s.title.startsWith('Личный план'));
  const goals = plan.rows.map(r => r[0]);
  assert.equal(goals[0], 'Новые виды');
  assert.ok(goals.indexOf('Master: все 4 тира у всех 18') > goals.lastIndexOf('Adept: серебро у всех 18'));
  // Внутри цели — по возрастанию времени, Obfuscated 3 до алмаза — самый долгий
  assert.equal(plan.rows.at(-1)[1].text, 'Obfuscated 3');
  const all = g.sections.find(s => s.title.startsWith('Все 18 видов'));
  assert.equal(all.rows.length, 18);
  assert.ok(g.sections.find(s => s.title.startsWith('Твой Trophy Fish Chance')).title.includes('~20'));   // Inferno Rod
});

test('трофеи: Radiant Fisher и Midas Lure множат броски алмаза и золота (+2% за уровень)', async () => {
  const { tierOdds } = await import('../src/guides/trophy.js');
  const o = tierOdds(0, { radiant: 10, midas: 10 });
  assert.ok(Math.abs(o.exact.diamond - 0.0024) < 1e-9);
  assert.ok(Math.abs(o.exact.gold - (1 - 0.0024) * 0.024) < 1e-9);
  assert.ok(Math.abs(tierOdds(5, { radiant: 10 }).exact.diamond - 0.002 * 1.1 * 1.2) < 1e-9);
});
