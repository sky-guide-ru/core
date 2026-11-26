// Боевые методы «Заработка»: доход по таблицам дропа с вики × живые цены (слееры, данжи, Kuudra, мобы).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBazaar } from '../src/market/bazaar.js';
import { dropIncome, chestValue } from '../src/market/drop-income.js';
import { COMBAT_METHODS, COMBAT_DETAILS, LOOT, slayerTiers, slayerTierOpen, floorOpen, floorValue, kuudraValue, kuudraKeyCost } from '../src/market/methods/combat.js';
import { moneyMethods } from '../src/market/methods.js';
import { createSoldStore, recordSale } from '../src/market/auctions.js';

const NOW = 1_800_000_000_000;
const H = 3600_000;

function ctxWith(bz = {}, bin = {}, sales = {}) {
  const products = {};
  for (const [id, [buy, sell, week]] of Object.entries(bz)) {
    products[id] = {
      product_id: id,
      sell_summary: [{ amount: 100, pricePerUnit: sell, orders: 5 }], buy_summary: [{ amount: 100, pricePerUnit: buy, orders: 5 }],
      quick_status: { productId: id, buyPrice: buy, sellPrice: sell, buyMovingWeek: week, sellMovingWeek: week },
    };
  }
  const sold = createSoldStore();
  for (const [id, [price, n]] of Object.entries(sales)) for (let i = 0; i < n; i++) recordSale(sold, id, price, NOW - (i + 1) * H / 2);
  return {
    bazaar: parseBazaar({ products }), bin: new Map(Object.entries(bin).map(([id, price]) => [id, { price, count: 5 }])),
    sold, history: {}, binHistory: {}, npc: new Map(), items: new Map(), tax: 0.01125, now: NOW,
  };
}

const lvl = level => ({ level });

test('у каждого боевого метода есть разбор, данные с вики и цифры не из воздуха', () => {
  assert.ok(COMBAT_METHODS.length >= 18);
  for (const m of COMBAT_METHODS) {
    const d = COMBAT_DETAILS[m.id];
    assert.ok(d && d.steps.length >= 2 && d.risks.length >= 1, `${m.id}: разбор`);
    assert.ok(typeof m.compute === 'function', `${m.id}: живой расчёт`);
    assert.equal(m.range, undefined, `${m.id}: без ориентира «с потолка»`);
  }
  for (const k of ['zombie', 'spider', 'wolf', 'enderman', 'blaze']) assert.ok(LOOT.slayers[k].drops.length >= 9, k);
  for (const f of ['F1', 'F7', 'M1', 'M7']) assert.ok(LOOT.dungeons[f], f);
  assert.ok(LOOT.dungeons.M7.Bedrock.some(d => d.id === 'DARK_CLAYMORE'));
  for (const t of ['basic', 'hot', 'burning', 'fiery', 'infernal']) assert.ok(LOOT.kuudra[t].drops.length > 15, t);
});

test('dropIncome: шанс × количество × цена, налог Bazaar и потолок спроса', () => {
  const ctx = ctxWith({ FLESH: [10, 9, 70_000_000], RARE_BZ: [30_000, 29_000, 700] });
  const r = dropIncome(ctx, [{ id: 'FLESH', qty: 60 }, { id: 'RARE_BZ', chance: 0.01 }], { perHour: 40, cost: 50_000 });
  const flesh = r.rows.find(x => x.id === 'FLESH');
  assert.ok(Math.abs(flesh.perKill - 60 * (10 - 0.1) * (1 - 0.01125)) < 1, 'продаём ордером по лучшему предложению минус налог');
  assert.ok(r.rarePerKill > 0 && r.steadyPerKill > r.rarePerKill);
  // 700 в неделю → 3% в день ≈ 3 в сутки; мы бы продавали 0,4 в час → упираемся в спрос
  assert.ok(r.capped.length === 1, 'редкий товар с тонким рынком ограничен спросом');
  assert.ok(r.perHour < r.perKill * 40 - 40 * 50_000);
});

test('chestValue: платный сундук открывают, только если предмет дороже открытия', () => {
  const ctx = ctxWith({ CHEAP: [100_000, 90_000, 1e6], GOOD: [20e6, 19e6, 1e5] });
  const v = chestValue(ctx, [{ id: 'CHEAP', chance: 0.5, cost: 1_000_000 }, { id: 'GOOD', chance: 0.1, cost: 6_000_000 }]);
  assert.equal(v.rows.length, 1);
  assert.ok(Math.abs(v.ev - 0.1 * (19_999_999.9 * (1 - 0.01125) - 6_000_000)) < 10);
});

test('слееры: тир открывается убийством предыдущего, редкие дропы — по уровню слеера', () => {
  const m = { slayers: { zombie: { level: 6, kills: { 1: 5, 2: 5, 3: 5, 4: 10, 5: 0 } } } };
  assert.equal(slayerTierOpen(m, 'zombie', 4), true);
  assert.equal(slayerTierOpen(m, 'zombie', 5), false, 'T5 требует Zombie Slayer 7');
  assert.equal(slayerTierOpen({ slayers: { enderman: lvl(9) } }, 'blaze', 1), true, 'без счётчиков: 9 уровень эндермена значит, что T3 убит');
  assert.equal(slayerTierOpen({ slayers: { enderman: lvl(1) } }, 'blaze', 1), false);
  const ctx = ctxWith({ REVENANT_FLESH: [8, 7, 20_000_000], SCYTHE_BLADE: [3_000_000, 2_800_000, 3000] });
  const t4 = slayerTiers(ctx, m, 'zombie').find(t => t.tier === 4);
  assert.ok(t4.locked.some(x => x.id === 'SCYTHE_BLADE'), 'Scythe Blade с 7 уровня — у игрока 6');
  assert.ok(!t4.rows.some(x => x.id === 'SCYTHE_BLADE'));
});

test('метод слеера выбирает лучший открытый тир и вычитает квест', () => {
  const ctx = ctxWith({ NULL_SPHERE: [900, 850, 30_000_000], SUMMONING_EYE: [1_500_000, 1_400_000, 20_000] });
  const m = { slayers: { wolf: lvl(9), enderman: { level: 5, kills: { 1: 1, 2: 1, 3: 3, 4: 0 } } }, skills: { combat: lvl(40) } };
  const [x] = moneyMethods(m, ctx, {}).filter(r => r.id === 'slayer-enderman');
  assert.equal(x.source, 'live');
  assert.match(x.detail, /Voidgloom Seraph T[34]/);
  assert.ok(x.coinsPerHour > 0 && x.coinsPerHourRange[0] <= x.coinsPerHour && x.coinsPerHour <= x.coinsPerHourRange[1]);
  assert.ok(x.breakdown.some(b => b.id === 'NULL_SPHERE'));
});

test('данжи: этаж открыт по Catacombs и прошлому этажу, второй сундук — за ключ', () => {
  assert.equal(floorOpen({ dungeons: { catacombs: lvl(27), floors: { 7: 8 }, masterFloors: {} } }, 'M1'), true);
  assert.equal(floorOpen({ dungeons: { catacombs: lvl(27), floors: { 7: 8 }, masterFloors: {} } }, 'M3'), false);
  assert.equal(floorOpen({ dungeons: { catacombs: lvl(19), floors: { 6: 1 } } }, 'F7'), false);
  assert.equal(floorOpen({ dungeons: { catacombs: lvl(20), floors: {} } }, 'F7'), false, 'F7 без пройденного F6 закрыт (ревью #176)');
  const ctx = ctxWith({ RECOMBOBULATOR_3000: [9e6, 8.8e6, 50_000], DUNGEON_CHEST_KEY: [600_000, 550_000, 50_000] }, { NECRON_HANDLE: 400e6 }, { NECRON_HANDLE: [380e6, 6] });
  const v = floorValue(ctx, 'F7');
  assert.equal(v.main, 'Bedrock');
  assert.ok(v.rows.some(r => r.id === 'NECRON_HANDLE'));
  assert.ok(v.high >= v.low);
  // ключ платят только при выгодном втором сундуке: Recombobulator 8,7 млн > открытие 6 млн + ключ 0,36 млн
  assert.ok(v.high > v.low, 'второй сундук с ключом даёт плюс, если предмет покрывает и ключ (ревью #176)');
});

test('Kuudra: доход в час не обходит потолок спроса (ревью #176)', () => {
  const ctx = ctxWith({ ESSENCE_CRIMSON: [10_000, 9_900, 7] });
  const v = kuudraValue(ctx, 'infernal');
  assert.ok(v.high < 1_000_000, `тонкий рынок эссенции не даёт десятки миллионов: ${v.high}`);
  assert.ok(v.capped.length >= 1);
});

test('Kuudra: ключ из монет и материалов, броня тира по префиксу', () => {
  const ctx = ctxWith({ ENCHANTED_RED_SAND: [2000, 1900, 1e6], ENCHANTED_MYCELIUM: [1500, 1400, 1e6], KUUDRA_TEETH: [5000, 4800, 1e6], ESSENCE_CRIMSON: [1500, 1400, 1e7] },
    { INFERNAL_TERROR_CHESTPLATE: 300e6, TERROR_CHESTPLATE: 500_000 }, { INFERNAL_TERROR_CHESTPLATE: [280e6, 3], TERROR_CHESTPLATE: [450_000, 10] });
  assert.equal(kuudraKeyCost(ctx, 'infernal'), 3_000_000 + 120 * 1500);
  const v = kuudraValue(ctx, 'infernal');
  assert.ok(v.rows.some(r => r.id === 'TERROR_CHESTPLATE'), 'броня из сундука — по цене обычной');
  assert.ok(!v.rows.some(r => r.id === 'INFERNAL_TERROR_CHESTPLATE'), 'прокачанные лоты высокого тира не раздувают доход');
  assert.ok(v.rows.some(r => r.id === 'ESSENCE_CRIMSON' && r.qty >= 2000));
});

test('без цен боевые методы не выдумывают доход', () => {
  const ctx = ctxWith();
  const m = { slayers: { zombie: lvl(9) }, skills: { combat: lvl(50) } };
  for (const x of moneyMethods(m, ctx, {}).filter(r => COMBAT_METHODS.some(c => c.id === r.id))) assert.equal(x.coinsPerHour, null, x.id);
});
