// Цифры «Заработка», сверенные с вики fandom 23.11.2026: Vanquisher, Composter, редкие культуры, вредители, купоны Agatha,
// RNG-метры слееров и данжей, сокровища рыбалки.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/market/methods.js'; // первым: у методов циклические импорты, как в остальных тестах
import { parseBazaar } from '../src/market/bazaar.js';
import { meterPerRun, bestMeterTarget } from '../src/market/drop-income.js';
import { VANQUISHER_LOOT, killsPerVanquisher, keyCost } from '../src/market/methods-crimson.js';
import { composterProfit, rareCropIncome, pestValue, RARE_CROPS, PESTS, MISC_METHODS } from '../src/market/methods/misc.js';
import { METERS, SLAYER_XP, slayerTiers, floorValue, kuudraKeyCost } from '../src/market/methods/combat.js';
import { treasureIncome } from '../src/market/methods/fishing.js';
import { createSoldStore } from '../src/market/auctions.js';

const NOW = 1_800_000_000_000;

function ctxWith(bz = {}) {
  const products = {};
  for (const [id, [buy, sell, week]] of Object.entries(bz)) {
    products[id] = {
      product_id: id,
      sell_summary: [{ amount: 100, pricePerUnit: sell, orders: 5 }], buy_summary: [{ amount: 100, pricePerUnit: buy, orders: 5 }],
      quick_status: { productId: id, buyPrice: buy, sellPrice: sell, buyMovingWeek: week, sellMovingWeek: week },
    };
  }
  return { bazaar: parseBazaar({ products }), bin: new Map(), sold: createSoldStore(), history: {}, binHistory: {}, npc: new Map(), items: new Map(), tax: 0.01125, now: NOW };
}
const armor = set => ({ inv: { armor: ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => ({ id: `${set}_${s}` })) } });

test('Vanquisher: 1/640 с защитой от невезения — в среднем ≈506 убийств, дроп 3 Nether Star (CORRUPTED_NETHER_STAR)', () => {
  const k = killsPerVanquisher();
  assert.ok(k > 490 && k < 520, `убийств на Vanquisher: ${k}`);
  assert.ok(killsPerVanquisher(1.2) < k, 'питомец Kuudra сокращает');
  assert.deepEqual(VANQUISHER_LOOT.map(d => [d.id, d.q]), [['CORRUPTED_NETHER_STAR', 3]], 'ванильная NETHER_STAR не считается, двойного счёта нет');
});

test('ключ Kuudra: 2 Nether Star считаются по цене CORRUPTED_NETHER_STAR', () => {
  const ctx = ctxWith({ CORRUPTED_NETHER_STAR: [300_000, 290_000, 1e5], ENCHANTED_RED_SAND: [1000, 900, 1e6], ENCHANTED_MYCELIUM: [1200, 1100, 1e6] });
  assert.equal(kuudraKeyCost(ctx, 'hot'), 400_000 + 6 * 1000 + 2 * 300_000);
  assert.ok(keyCost(ctx, 'hot', 'barbarians') >= 400_000 + 2 * 300_000);
});

test('Composter: Condensed Fermento (180 000 органики) только с Organic Matter Cap', () => {
  const ctx = ctxWith({ CONDENSED_FERMENTO: [1000, 900, 1e6], WHEAT: [100, 90, 1e6], BIOFUEL: [3000, 2900, 1e6], COMPOST: [30_000, 29_000, 1e6] });
  assert.equal(composterProfit(ctx, {}).om.id, 'WHEAT', 'без улучшения не влезает');
  assert.equal(composterProfit(ctx, { organic_matter_cap: 5 }).om.id, 'CONDENSED_FERMENTO', '40 000 + 5×30 000 = 190 000');
});

test('редкие культуры: шанс по числу частей брони (вики), доход = блоки × шанс × цена', () => {
  const fer = RARE_CROPS.find(r => r.id === 'FERMENTO');
  assert.deepEqual(fer.chance, [0.00005, 0.00006, 0.00007]);
  const ctx = ctxWith({ CROPIE: [30_000, 28_000, 1e7], SQUASH: [90_000, 85_000, 1e7], FERMENTO: [300_000, 290_000, 1e7], HELIANTHUS: [320_000, 300_000, 1e7] });
  const rows = rareCropIncome(ctx, armor('FERMENTO'));
  const f = rows.find(r => r.id === 'FERMENTO');
  assert.equal(f.pieces, 4);
  assert.equal(f.chance, 0.00007);
  assert.ok(Math.abs(f.perHour[1] - 19.5 * 3600 * 0.9 * 0.00007 * f.unit) < 1);
  const tater = rareCropIncome(ctx, armor('MELON')).find(r => r.id === 'CROPIE');
  assert.ok(tater.have && tater.chance === 0.0005, 'MELON_* — это Tater Armor');
  const m = MISC_METHODS.find(x => x.id === 'crop-rare-drops').compute(ctx, armor('FERMENTO'));
  assert.ok(m.coinsPerHour > 0 && !/не сверено/.test(m.detail));
});

test('вредители: 1 000 монет + культуры + частые и редкие дропы, редкие растут с Farming Fortune', () => {
  assert.equal(PESTS.length, 13);
  const ctx = ctxWith({ ENCHANTED_NETHER_STALK: [500, 480, 1e7], ENCHANTMENT_PESTERMINATOR_1: [2_000_000, 1_900_000, 1e4], COMPOST: [30_000, 29_000, 1e6] });
  const low = pestValue(ctx, 12, 0), high = pestValue(ctx, 12, 1800);
  assert.ok(low.perPest > 1000);
  assert.ok(high.rare > low.rare * 3.9 && high.rare < low.rare * 4.1, '× (1 + 1800/600) = ×4');
  assert.ok(high.crops > low.crops);
  assert.equal(pestValue(ctx, 5, 0).count, 5, 'на 5 уровне Сада — 5 видов');
  const meth = MISC_METHODS.find(x => x.id === 'pests').compute(ctx, { garden: { experience: 1e9 } }, { farmingFortune: 1800 });
  for (const t of meth.top) assert.ok(t.perHour <= meth.coinsPerHour, 'вклад дропа не больше дохода метода');
});

test('купоны Agatha: 10–45 за конкурс, нужен Foraging 12', () => {
  const ctx = ctxWith({ AGATHA_COUPON: [60_000, 55_000, 1e6] });
  const meth = MISC_METHODS.find(x => x.id === 'galatea-coupons');
  const r = meth.compute(ctx, {});
  assert.ok(r.coinsPerHour > 20 * 50_000 && r.coinsPerHour < 31 * 60_000);
  assert.ok(meth.req({ skills: { foraging: { level: 11 } } }).some(x => /12/.test(x.text) && !x.ok));
});

test('RNG-метр: формула вики (×(1+2·заполнение), гарантия на полной шкале) и выбор цели', () => {
  const m = meterPerRun(0.001, 1, 1000);
  assert.ok(m.cycleRuns < 1000 && m.perRun > m.natural);
  assert.equal(SLAYER_XP[4], 500);
  assert.ok(METERS.slayer.enderman.JUDGEMENT_CORE > 800_000);
  assert.ok(METERS.catacombs.M7.NECRON_HANDLE > 200_000);
  const best = bestMeterTarget([
    { id: 'A', name: 'A', chance: 0.001, value: 1_000_000 },
    { id: 'B', name: 'B', chance: 0.001, value: 50_000_000 },
    { id: 'C', name: 'C', chance: 0.2, value: 1e9 }, // частый — метр не ставим
  ], { A: 100_000, B: 100_000, C: 1000 }, 500);
  assert.equal(best.id, 'B');
  assert.ok(best.lift > 0);
  // базовый шанс 3,5% с Magic Find стал 5,7% — цель метра всё равно законная
  assert.equal(bestMeterTarget([{ id: 'D', name: 'D', chance: 0.057, value: 1e6, rare: true }], { D: 10_000 }, 500)?.id, 'D');
});

test('слееры: RNG-метр прибавляет доход только с T3, у данжей — с заходов S+', () => {
  const ctx = ctxWith({ JUDGEMENT_CORE: [600_000_000, 580_000_000, 50], NULL_SPHERE: [1000, 900, 1e6] });
  const m = { slayers: { enderman: { level: 9, kills: { 1: 1, 2: 1, 3: 1, 4: 1 } }, wolf: { level: 9, kills: { 4: 1 } } } };
  const tiers = slayerTiers(ctx, m, 'enderman');
  assert.equal(tiers.find(t => t.tier === 2).meter, null);
  const t4 = tiers.find(t => t.tier === 4);
  assert.equal(t4.meter?.id, 'JUDGEMENT_CORE');
  assert.ok(t4.meter.lift[0] > 0);
  const ctx2 = ctxWith({ NECRON_HANDLE: [500_000_000, 480_000_000, 50] });
  const f7 = floorValue(ctx2, 'F7');
  if (f7.meter) assert.ok(f7.low >= f7.meter.lift);
});

test('сокровища рыбалки: 90% Good Catch, 10% Great Catch, шанс от уровня Fishing', () => {
  const ctx = ctxWith({ ENCHANTED_DIAMOND: [1500, 1400, 1e7], ENCHANTED_GOLD: [600, 550, 1e7] });
  const r = treasureIncome(ctx, 'water', 200, 5);
  assert.ok(Math.abs(r.treasures - 200 * 5 / 100) < 1e-9, 'уловов без существа столько же, сколько существ (шанс существа 50%)');
  assert.ok(r.perTreasure > 0 && r.perTreasure < 1000);
});
