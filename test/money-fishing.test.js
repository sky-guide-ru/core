import test from 'node:test';
import assert from 'node:assert/strict';
import * as mk from '../src/market/index.js';
import { ctxFrom, memberOwnerCat } from './fixtures/market.js';
import { SEA_CREATURES } from '../src/market/methods/fishing-data.js';
import { creaturePool, poolIncome, dropUnitValue, trophyRanks, FISHING_METHODS, FISHING_DETAILS } from '../src/market/methods/fishing.js';

globalThis.__mk = mk;

const bz = (ctx, id, sell, week = 70_000) => ctx.bazaar.set(id, { buy: sell * 1.05, sell, buyWeek: week, sellWeek: week, buyVol: 1, sellVol: 1, buyOrders: 1, sellOrders: 1, buyAvg: sell, sellAvg: sell });
const member = (bronze = 16, silver = 13, fishing) => {
  const m = memberOwnerCat();
  if (fishing) m.skills.fishing = { level: fishing };
  m.fishing = { trophyTiers: { tiers: { bronze: { atLeast: bronze }, silver: { atLeast: silver } } } };
  return m;
};

test('данные существ: веса, уровни и дропы на месте', () => {
  assert.ok(SEA_CREATURES.length >= 60);
  for (const c of SEA_CREATURES) {
    assert.ok(c.w > 0 && c.lvl >= 1 && c.drops.length, c.name);
    for (const [ids, count, chance] of c.drops) {
      assert.ok(ids && count > 0 && chance > 0 && chance <= 1, `${c.name}: ${ids}`);
    }
  }
  const jaw = SEA_CREATURES.find(c => c.name === 'Lord Jawbus');
  assert.equal(jaw.w, 8);
  assert.equal(jaw.drops.find(d => d[0] === 'MAGMA_LORD_FRAGMENT')[2], 0.5, 'патч 0.27.3: 50%');
});

test('пул существ: уровень Fishing и награды Odger', () => {
  const names = m => creaturePool(m, ['lava']).map(c => c.name);
  assert.ok(!names(member(16, 13, 36)).includes('Lord Jawbus'), 'Jawbus закрыт без Adept и Fishing 45');
  assert.ok(names(member(16, 13, 36)).includes('Thunder'), 'Thunder открыт наградой Novice');
  assert.ok(!names(member(10, 0, 36)).includes('Thunder'));
  assert.ok(names(member(18, 18, 45)).includes('Lord Jawbus'));
  assert.deepEqual(trophyRanks(member(15, 18)), { novice: true, adept: true, noviceReady: true, adeptReady: true, rewardsKnown: false, bronze: 15, silver: 18 });
});

test('цена дропа: сверх спроса Bazaar лишнее идёт по цене NPC', () => {
  const ctx = ctxFrom();
  bz(ctx, 'FLAMING_HEART', 10_000, 7 * 240); // 240 в день → 3% = 7,2 в день = 0,3 в час
  ctx.npc = new Map([['FLAMING_HEART', 100]]);
  const small = dropUnitValue(ctx, 'FLAMING_HEART', 0.1);
  assert.equal(small.capped, false);
  const big = dropUnitValue(ctx, 'FLAMING_HEART', 30);
  assert.equal(big.capped, true);
  assert.ok(big.unit < 500, `лишнее почти по NPC: ${big.unit}`);
  // список кандидатов: берём тот id, что есть на рынке
  bz(ctx, 'SHARD_SEA_EMPEROR', 5000);
  assert.equal(dropUnitValue(ctx, ['SHARD_LOCH_EMPEROR', 'SHARD_SEA_EMPEROR'], 0).id, 'SHARD_SEA_EMPEROR');
});

test('доход пула растёт с темпом и считается по дропам', () => {
  const ctx = ctxFrom();
  bz(ctx, 'MAGMA_LORD_FRAGMENT', 200_000, 700_000); bz(ctx, 'ORB_OF_ENERGY', 10_000, 700_000);
  const pool = creaturePool(member(18, 18, 50), ['lava']);
  const a = poolIncome(ctx, pool, 100), b = poolIncome(ctx, pool, 200);
  assert.ok(a.perHour > 0 && b.perHour > a.perHour);
  const W = pool.reduce((s, c) => s + c.w, 0);
  const jaw = 100 * 8 / W * 0.5 * 200_000 * (1 - ctx.tax);
  const eel = 100 * 280 / W * 10_000 * (1 - ctx.tax);
  assert.ok(Math.abs(a.perHour - jaw - eel) < 1, 'только два предмета с ценой');
  assert.ok(a.xpPerHour > 0);
});

test('методы рыбалки в «Заработке»: разбор, доход и события', () => {
  const ctx = ctxFrom();
  bz(ctx, 'MAGMA_LORD_FRAGMENT', 200_000, 700_000); bz(ctx, 'THUNDER_SHARDS', 100_000, 700_000);
  bz(ctx, 'ORB_OF_ENERGY', 10_000, 700_000); bz(ctx, 'WHALE_BAIT', 1_000_000, 700_000);
  bz(ctx, 'SPONGE', 400, 7_000_000);
  const list = mk.moneyMethods(member(), ctx, {});
  const by = Object.fromEntries(list.map(x => [x.id, x]));
  for (const def of FISHING_METHODS) {
    assert.ok(by[def.id], def.id);
    assert.equal(by[def.id].tag, 'Fishing');
    assert.ok(FISHING_DETAILS[def.id]?.steps.length >= 2, `${def.id}: шаги`);
  }
  const lava = by['fish-crimson-lava'];
  assert.ok(lava.available && lava.coinsPerHour > 0 && lava.source === 'live');
  assert.match(lava.detail, /Lord Jawbus/, 'подсказка, сколько дал бы закрытый Jawbus');
  // Наживка за миллион не окупается — метод считается без неё, а не уходит в ноль
  assert.ok(by['fish-water'].coinsPerHour > 0);
  assert.match(by['fish-water'].detail, /не окупается/);
  // Событие не идёт — требование «неизвестно», и метод не становится целью плана
  const spooky = by['fish-spooky'].reqs.find(r => /Spooky/.test(r.text));
  assert.ok(['unk', 'ok'].includes(spooky.status));
  assert.ok(!mk.moneyPlan(member(), ctx, {}).next.some(x => x.id === 'fish-spooky' && spooky.status === 'unk'));
});

test('ревью #171: удочка не считается дважды, Fishing Festival только в дни 1–3', async () => {
  const { sbStart } = await import('../src/calendar/time.js');
  const ctx = ctxFrom();
  bz(ctx, 'ROD_OF_THE_SEA', 1_000_000); bz(ctx, 'SPONGE', 400, 7_000_000);
  const m = member(); m.inv = {};
  const water = mk.moneyMethods(m, ctx, {}).find(x => x.id === 'fish-water');
  assert.equal(water.buyCost, 1_000_000, 'одна удочка — одна покупка');
  const at = day => mk.moneyMethods(member(), ctx, { mayor: 'Marina', now: sbStart(400, 3, day) + 60_000 }).find(x => x.id === 'fish-festival');
  assert.equal(at(2).reqs.find(r => /Festival/.test(r.text)).status, 'ok');
  assert.equal(at(15).reqs.find(r => /Festival/.test(r.text)).status, 'unk');
  assert.equal(at(15).available, false, 'вне дней фестиваля метод не предлагается');
});

test('ревью #182: награды Odger, вход на Crimson и перк фестиваля', async () => {
  const { sbStart } = await import('../src/calendar/time.js');
  // Условие Novice выполнено, но награда не забрана — Thunder закрыт
  const unclaimed = member(16, 13, 36); unclaimed.fishing.trophyFish = { rewards: [] };
  const r = trophyRanks(unclaimed);
  assert.equal(r.novice, false); assert.equal(r.noviceReady, true); assert.equal(r.rewardsKnown, true);
  assert.ok(!creaturePool(unclaimed, ['lava']).map(c => c.name).includes('Thunder'));
  const claimed = member(16, 13, 36); claimed.fishing.trophyFish = { rewards: [1] };
  assert.ok(creaturePool(claimed, ['lava']).map(c => c.name).includes('Thunder'));
  // Без Combat 24 на Crimson Isle не пустят — лавовые методы недоступны
  const ctx = ctxFrom();
  const weak = member(16, 13, 40); weak.skills.combat = { level: 10 };
  const by = Object.fromEntries(mk.moneyMethods(weak, ctx, {}).map(x => [x.id, x]));
  assert.equal(by['fish-crimson-lava'].available, false);
  assert.equal(by['fish-lava-hotspot'].available, false);
  assert.equal(by['fish-crimson-lava'].reqs.find(x => /Crimson/.test(x.text)).status, 'no');
  // Перк у министра Marina при другом мэре — фестиваль идёт
  const fest = opts => mk.moneyMethods(member(), ctx, { now: sbStart(400, 3, 2) + 60_000, ...opts }).find(x => x.id === 'fish-festival').reqs.find(x => /Festival/.test(x.text)).status;
  assert.equal(fest({ mayor: 'Diana', perks: ['Fishing Festival'] }), 'ok');
  assert.equal(fest({ mayor: 'Marina', perks: ['Luck of the Sea 2.0'] }), 'unk', 'у Marina-мэра нет этого перка');
  assert.equal(fest({ mayor: 'Marina', perks: [] }), 'ok', 'мэр задан вручную, перков нет — судим по имени');
});
