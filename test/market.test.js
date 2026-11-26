import test from 'node:test';
import assert from 'node:assert/strict';
import * as mk from '../src/market/index.js';
import { ctxFrom, memberOwnerCat, bazaarJson } from './fixtures/market.js';

globalThis.__mk = mk;
const NOW = 1_790_000_000_000;

test('parseBazaar: buy = мгновенная покупка (buy_summary), sell = мгновенная продажа (sell_summary)', () => {
  const m = mk.parseBazaar(bazaarJson());
  const d = m.get('ENCHANTED_DIAMOND');
  assert.equal(d.buy, 1500);
  assert.equal(d.sell, 1350);
  assert.equal(d.buyWeek, 4_000_000);
});

test('parseIngredient и marketId понимают формат NEU', () => {
  assert.deepEqual(mk.parseIngredient('SUGAR_CANE:32'), { id: 'SUGAR_CANE', n: 32 });
  assert.deepEqual(mk.parseIngredient('INK_SACK-3:16'), { id: 'INK_SACK-3', n: 16 });
  assert.deepEqual(mk.parseIngredient('HYPERION'), { id: 'HYPERION', n: 1 });
  const items = ctxFrom().items;
  assert.equal(mk.marketId('INK_SACK-3', items), 'INK_SACK:3');
  assert.equal(mk.marketId('ULTIMATE_LEGION;1', items), 'ENCHANTMENT_ULTIMATE_LEGION_1');
  assert.equal(mk.marketId('ENDER_DRAGON;4', items), 'ENDER_DRAGON;4');
});

test('ahNet: комиссии аукциона по порогам', () => {
  assert.equal(mk.ahNet(500_000), 495_000);           // 1% листинг, без налога на получение
  assert.equal(Math.round(mk.ahNet(5_000_000)), 4_900_000); // 1% + 1%
  assert.equal(Math.round(mk.ahNet(50_000_000)), 48_500_000); // 2% + 1%
  assert.equal(Math.round(mk.ahNet(200_000_000)), 193_000_000); // 2.5% + 1%
});

test('auctionKey: книги, руны, питомцы 100 уровня', () => {
  assert.equal(mk.auctionKey({ id: 'ENCHANTED_BOOK', enchants: { ultimate_legion: 1 } }).key, 'ENCHANTMENT_ULTIMATE_LEGION_1');
  assert.equal(mk.auctionKey({ id: 'ENCHANTED_BOOK', enchants: { a: 1, b: 2 } }), null);
  assert.equal(mk.auctionKey({ id: 'RUNE' }, { runes: { SNAKE: 1 } }).key, 'SNAKE_RUNE;1');
  const pet = mk.auctionKey({ id: 'ENDER_DRAGON;4', pet: { type: 'ENDER_DRAGON', tier: 'LEGENDARY', exp: 30_000_000 } });
  assert.deepEqual(pet, { key: 'ENDER_DRAGON;4', petMax: true });
});

test('createBinBuilder: lowest, second, count, цена питомца 100 уровня', () => {
  const b = mk.createBinBuilder();
  b.add('X', 300, 'a'); b.add('X', 100, 'b'); b.add('X', 200, 'c'); b.add('X', 150, 'd', true);
  const r = b.result().get('X');
  assert.equal(r.price, 100); assert.equal(r.second, 150); assert.equal(r.count, 4); assert.equal(r.auction, 'b'); assert.equal(r.max, 150);
});

test('учёт продаж: медиана устойчива к выбросу', () => {
  const s = mk.createSoldStore();
  for (const p of [100, 110, 105, 95, 10_000]) mk.recordSale(s, 'X', p, NOW - 3600_000);
  const st = mk.soldStats(s, 'X', NOW);
  assert.equal(st.count24h, 5);
  assert.equal(st.median, 105);
  mk.pruneSold(s, NOW + 30 * 24 * 3600_000);
  assert.equal(mk.soldStats(s, 'X', NOW), null);
});

test('история: среднее за час и тренд за сутки/неделю', () => {
  const store = {}; const c = new Map();
  const h = 3600_000; const base = Math.floor(NOW / h) * h;
  mk.pushHourly(store, c, 'X', base + 1, [100]);
  mk.pushHourly(store, c, 'X', base + 2, [200]);
  assert.equal(store.X[0][1], 150);
  const pts = [];
  for (let i = 8 * 24; i >= 1; i--) pts.push([base - i * h, i > 24 ? 100 : 120]);
  const t = mk.trend(pts, 132, 1, base);
  assert.equal(t.d1.pct, 10);   // 120 -> 132
  assert.equal(t.d7.pct, 32);   // 100 -> 132
  assert.equal(mk.trendLabel(t), 'растёт');
});

test('bazaarFlips: находит флип, отсекает манипуляцию', () => {
  const ctx = ctxFrom();
  const flips = mk.bazaarFlips(ctx, { minWeeklyCoins: 0 });
  const ids = flips.map(f => f.id);
  assert.ok(ids.includes('ENCHANTED_DIAMOND'));
  assert.ok(!ids.includes('MANIPULATED_ITEM'));
  const d = flips.find(f => f.id === 'ENCHANTED_DIAMOND');
  assert.ok(Math.abs(d.margin - ((1500 - 0.1) * (1 - 0.01125) - 1350.1)) < 1e-6);
  const risky = mk.bazaarFlips(ctx, { minWeeklyCoins: 0, includeRisky: true });
  assert.ok(risky.find(f => f.id === 'MANIPULATED_ITEM')?.warning);
});

test('npcFlips: покупка на Bazaar дешевле цены NPC', () => {
  const f = mk.npcFlips(ctxFrom());
  assert.equal(f[0].id, 'CHEAP_NPC');
  assert.ok(Math.abs(f[0].profit - (4 - 1.1)) < 1e-9);
});

test('craftFlips: Enchanted Sugar Cane выгоднее с подкрафтом Enchanted Sugar', () => {
  const ctx = ctxFrom();
  const flat = mk.craftFlips(ctx, { depth: 0, minProfit: 0, minPct: 0, includeForge: false });
  const deep = mk.craftFlips(ctx, { depth: 1, minProfit: 0, minPct: 0, includeForge: false });
  const a = flat.find(x => x.id === 'ENCHANTED_SUGAR_CANE');
  const b = deep.find(x => x.id === 'ENCHANTED_SUGAR_CANE');
  // покупка 160 Enchanted Sugar по 700 = 112 000; крафт из 25 600 Sugar Cane по 4.2 = 107 520
  assert.equal(Math.round(a.cost), 112_000);
  assert.equal(Math.round(b.cost), 107_520);
  assert.deepEqual(b.subCrafts, ['ENCHANTED_SUGAR']);
  assert.equal(b.req, 'Требуется: Sugar Cane IX');
});

test('forgeFlips: Refined Mithril, доход в час на слот', () => {
  const f = mk.forgeFlips(mk.craftFlips.length ? ctxFrom() : null, { minProfit: 0 });
  const r = f.find(x => x.id === 'REFINED_MITHRIL');
  assert.ok(r, 'рецепт Forge найден');
  assert.equal(r.kind, 'forge');
  assert.equal(r.durationH, 6);
  const expected = ((330_000 - 0.1) * (1 - 0.01125) - 160 * 1500);
  assert.ok(Math.abs(r.profit - expected) < 1e-6);
  assert.ok(Math.abs(r.perHour - expected / 6) < 1e-6);
});

test('binSnipes: лот сильно дешевле второго и медианы продаж', () => {
  const ctx = ctxFrom();
  ctx.sold = mk.createSoldStore();
  for (let i = 0; i < 5; i++) mk.recordSale(ctx.sold, 'CHEAP_SWORD', 3_000_000, NOW - 1000 * i);
  const s = mk.binSnipes(ctx);
  assert.equal(s[0].id, 'CHEAP_SWORD');
  assert.ok(s[0].profit > 1_900_000);
});

test('cropProfits: выбирает лучший способ продажи и сортирует', () => {
  const ctx = ctxFrom();
  const list = mk.cropProfits(ctx, 1500, { bps: 20, uptime: 1 });
  const cane = list.find(c => c.id === 'SUGAR_CANE');
  // 72 000 блоков * 2 * 16 = 2 304 000 штук
  assert.equal(cane.items, 2_304_000);
  assert.ok(cane.unit >= 4, 'не хуже NPC (4)');
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].perHour >= list[i].perHour);
});

test('cropProfits: тонкий рынок Melon Block не завышает доход (живые цены 23.11.2026)', () => {
  // Реальный стакан: MELON без ордеров на покупку, Melon Block — одиночный ордер 81,7 (≈9 монет за арбуз),
  // NPC арбуза после ноябрьского нерфа 0,5. Раньше NaN в сортировке выбирал Melon Block → 42 млн/ч.
  const bz = (sell, sellWeek) => ({ buy: sell * 1.1, sell, buyWeek: sellWeek, sellWeek });
  const ctx = {
    bazaar: new Map([['MELON', { buy: 2.07, sell: 0, buyWeek: 7e6, sellWeek: 111e6 }], ['MELON_BLOCK', bz(81.7, 450_436)],
      ['ENCHANTED_MELON', bz(63.9, 85e6)], ['ENCHANTED_MELON_BLOCK', bz(12472, 2_148_238)]]),
    npc: new Map([['MELON', 0.5], ['MELON_BLOCK', 4.5], ['ENCHANTED_MELON', 80], ['ENCHANTED_MELON_BLOCK', 12800]]),
    bin: new Map(), tax: 0.0125,
    // рецепты как в NEU: Melon Block = 9 Melon, Enchanted Melon = 160 Melon, Enchanted Melon Block = 160 Enchanted Melon
    items: new Map([
      ['MELON_BLOCK', { id: 'MELON_BLOCK', name: 'Melon', recipe: { A1: 'MELON:1', A2: 'MELON:1', A3: 'MELON:1', B1: 'MELON:1', B2: 'MELON:1', B3: 'MELON:1', C1: 'MELON:1', C2: 'MELON:1', C3: 'MELON:1' } }],
      ['ENCHANTED_MELON', { id: 'ENCHANTED_MELON', name: 'Enchanted Melon', recipe: { A2: 'MELON:32', B1: 'MELON:32', B2: 'MELON:32', B3: 'MELON:32', C2: 'MELON:32' } }],
      ['ENCHANTED_MELON_BLOCK', { id: 'ENCHANTED_MELON_BLOCK', name: 'Enchanted Melon Block', recipe: { A2: 'ENCHANTED_MELON:32', B1: 'ENCHANTED_MELON:32', B2: 'ENCHANTED_MELON:32', B3: 'ENCHANTED_MELON:32', C2: 'ENCHANTED_MELON:32' } }],
    ]),
  };
  assert.ok(mk.compressionForms(ctx.items).MELON.some(([f]) => f === 'MELON_BLOCK'), 'Melon Block среди форм');
  const melon = mk.cropProfits(ctx, 1385, { bps: 19.5, uptime: 0.9 }).find(c => c.id === 'MELON');
  assert.ok(melon.unit <= 0.6, `цена за арбуз ${melon.unit}`);
  assert.ok(melon.perHour < 3_000_000, `доход ${melon.perHour}`);
});

test('moneyMethods: требования по профилю OwnerCat', () => {
  const ctx = ctxFrom();
  const list = mk.moneyMethods(memberOwnerCat(), ctx, { farmingFortune: 1600 });
  const by = Object.fromEntries(list.map(x => [x.id, x]));
  assert.equal(by.farming.available, true);
  assert.equal(by.farming.source, 'live');
  assert.equal(by['slayer-blaze'].available, false);
  assert.equal(by['dungeon-m7'].available, false);
  assert.equal(by['dungeon-m1-m3'].available, true);
  assert.equal(by.gemstones.ready, true, 'Divan Drill найден в рюкзаке');
  assert.equal(by['kuudra-burning'].available, false, 'всего 1 Hot');
  assert.ok(by['slayer-enderman'].reqText.some(t => t.startsWith('✅')));
  assert.ok(by.diana.reqText[0].startsWith('❔'), 'мэр неизвестен');
  for (const x of list) assert.ok(Array.isArray(x.reqText) && typeof x.title === 'string');
});

test('moneyPlan и личная калибровка', () => {
  const ctx = ctxFrom();
  const sessions = [mk.makeSession({ method: 'slayer-enderman', minutes: 60, coins: 50_000_000 }, NOW)];
  const plan = mk.moneyPlan(memberOwnerCat(), ctx, { farmingFortune: 1600, sessions, now: NOW });
  const eman = mk.moneyMethods(memberOwnerCat(), ctx, { sessions }).find(x => x.id === 'slayer-enderman');
  assert.equal(eman.source, 'personal');
  assert.equal(eman.coinsPerHour, 50_000_000);
  assert.ok(plan.summary.startsWith('Сейчас выгоднее всего'));
  assert.ok(plan.now.length > 0);
  assert.throws(() => mk.makeSession({ method: 'x', minutes: 0, coins: 1 }), /Длительность/);
});

test('estimateFarmingFortune и hasAny с шаблоном', () => {
  const m = memberOwnerCat();
  assert.ok(mk.hasAny(m, ['*AURORA_CHESTPLATE']));
  assert.ok(!mk.hasAny(m, ['TERMINATOR']));
  assert.equal(mk.estimateFarmingFortune(m), 60 * 4 + 9 * 5 + 1100);
});

test('topMovers: рост и падение', () => {
  const ctx = ctxFrom();
  ctx.history.ENCHANTED_DIAMOND = ctx.history.ENCHANTED_DIAMOND.map(p => [p[0], p[1], 1000]);
  const mv = mk.topMovers(ctx, { minWeeklyCoins: 0 });
  const d = mv.up.find(x => x.id === 'ENCHANTED_DIAMOND');
  assert.equal(d.pct, 35);
  assert.ok(mv.up.find(x => x.id === 'MANIPULATED_ITEM'), 'накрутку тоже видно в росте');
});

test('topMovers: тонкий рынок с движением >100% — шум, одиночный выброс в истории сглаживается', () => {
  const ctx = ctxFrom();
  // Сутки назад цена была 1000, а за час до этого — разовый выброс до 100 000: сравнение идёт с медианой, а не с выбросом
  const dayAgo = ctx.now - 24 * 3600_000;
  const h = ctx.history.ENCHANTED_DIAMOND;
  const spike = h.reduce((a, p) => (Math.abs(p[0] - dayAgo) < Math.abs(a[0] - dayAgo) ? p : a))[0];
  ctx.history.ENCHANTED_DIAMOND = h.map(p => [p[0], p[1], p[0] === spike ? 100_000 : 1000]);
  const mv = mk.topMovers(ctx, { minWeeklyCoins: 0 });
  assert.equal(mv.up.find(x => x.id === 'ENCHANTED_DIAMOND')?.pct, 35);
  assert.ok(!mv.down.find(x => x.id === 'ENCHANTED_DIAMOND'));
  // MANIPULATED_ITEM: +400% при обороте 6 млрд/нед виден, а при пороге 10 млрд — уже нет
  assert.ok(mv.up.find(x => x.id === 'MANIPULATED_ITEM'));
  const strict = mk.topMovers(ctx, { minWeeklyCoins: 0, bigMoveWeeklyCoins: 10_000_000_000 });
  assert.ok(!strict.up.find(x => x.id === 'MANIPULATED_ITEM'), 'большое движение на тонком рынке отфильтровано');
  assert.ok(strict.up.find(x => x.id === 'ENCHANTED_DIAMOND'), 'обычные движения остаются');
  assert.ok(mv.up.every(r => typeof r.weekly === 'number'), 'оборот отдаётся для показа');
});

test('названия рынка: книги и осколки Bazaar не показываются сырым ID', async () => {
  const { displayName, prettyId } = await import('../src/names.js');
  assert.equal(displayName('ENCHANTMENT_LAPIDARY_1'), 'Lapidary I');
  assert.equal(displayName('ENCHANTMENT_LIFE_STEAL_4'), 'Life Steal IV');
  assert.equal(displayName('SHARD_SEA_EMPEROR'), 'Loch Emperor Shard', 'старое имя осколка → новое');
  assert.equal(displayName('SHARD_SNEAKY_TIKI'), 'Sneaky Tiki Shard');
  assert.equal(displayName('SHARD_SOUL_OF_THE_ALPHA'), 'Soul of the Alpha Shard');
  assert.equal(displayName('ENCHANTED_DIAMOND'), 'Enchanted Diamond');
  assert.equal(displayName('ENCHANTMENT_ULTIMATE_BOBBIN_TIME_3'), "Bobbin' Time III", 'ультимейты из «Крафт и Forge»');
  assert.equal(displayName('ENCHANTMENT_ULTIMATE_HABANERO_TACTICS_4'), 'Habanero Tactics IV');
  assert.equal(prettyId('SHARD_SOMETHING_NEW'), 'Something New Shard');
  assert.equal(prettyId('ENCHANTMENT_ULTIMATE_WISE_5'), 'Ultimate Wise V');
  const ctx = ctxFrom();
  ctx.name = id => displayName(id, ctx.items);
  assert.ok(!mk.topMovers(ctx, { minWeeklyCoins: 0 }).up.some(r => /^[A-Z0-9_:;]+$/.test(r.name)), 'нет сырых ID');
});

test('разбор метода: требования с данными профиля, шаги, риски, старт и окупаемость', () => {
  const ctx = ctxFrom();
  const list = mk.moneyMethods(memberOwnerCat(), ctx, { farmingFortune: 1600 });
  const by = Object.fromEntries(list.map(x => [x.id, x]));
  for (const x of list) {
    assert.ok(x.steps.length >= 2, `${x.id}: есть шаги`);
    assert.ok(x.risks.length >= 1, `${x.id}: есть риски`);
    assert.ok(x.effortText && x.riskText, `${x.id}: формат и риск`);
    assert.equal(x.reqs.length, x.reqTotal);
    assert.ok(x.reqDone <= x.reqTotal);
    assert.ok(x.startCost >= x.buyCost && x.startCost === x.buyCost + x.capital, `${x.id}: старт = покупки + оборотные`);
  }
  const blaze = by['slayer-blaze'].reqs.find(r => r.text.startsWith('Blaze Slayer'));
  assert.match(blaze.have, /^у тебя \d+/);
  // Капитал флипов возвращается, поэтому окупаемость по нему не считаем
  assert.equal(by['bazaar-flip'].capital, 10_000_000);
  assert.equal(by['bazaar-flip'].paybackHours, null);
  // Броня фермера уже есть — её не просим купить
  assert.equal(by.farming.kit[0].owned, true);
});

test('категории товаров для фильтров', () => {
  const c = mk.categoryOf;
  assert.equal(c('ENCHANTED_NETHER_STALK'), 'Farming');
  assert.equal(c('INK_SACK:3'), 'Farming', 'какао, а не чернила');
  assert.equal(c('INK_SACK'), 'Fishing');
  assert.equal(c('FLAWLESS_RUBY_GEM'), 'Mining');
  assert.equal(c('ARCHFIEND_DICE'), 'Combat', 'DICE — не лёд');
  assert.equal(c('GRIFFIN_FEATHER'), 'Combat');
  assert.equal(c('ENCHANTMENT_ULTIMATE_CHIMERA_1'), 'Книги');
  assert.equal(c('SHARD_SEA_EMPEROR'), 'Осколки');
  assert.equal(c('KISMET_FEATHER'), 'Улучшения', 'перо Kismet — не фермерство');
  assert.equal(c('HOT_POTATO_BOOK'), 'Улучшения');
  assert.equal(c('FIFTH_MASTER_STAR'), 'Улучшения');
  assert.equal(c('HYPERION', { kind: () => 'weapon' }), 'Оружие');
  const f = mk.bazaarFlips(ctxFrom(), { includeRisky: true });
  for (const x of f) assert.ok(x.category && x.weeklyCoins > 0 && x.invest >= 0);
});
