// «Перепродажа»: сборка книг, улучшение предметов (звёзды, Master Stars, Recombobulator), снайп и Kismet
import test from 'node:test';
import assert from 'node:assert/strict';
import { bookCombos, combineCap, starCost, upgradeFlips, variantKey } from '../src/market/resale.js';
import { moneyMethods } from '../src/market/methods.js';
import { createSoldStore, recordSale } from '../src/market/auctions.js';

const NOW = 1_800_000_000_000;
const H = 3600_000;
const constants = {
  enchants: {
    max_xp_table_levels: { sharpness: 5, looting: 3 },
    enchants_xp_cost: { sharpness: [10, 15, 20, 25, 30, 100, 200], chimera: [1, 2, 3, 4, 5] },
  },
  essencecosts: {
    HYPERION: { type: 'Wither', 1: 150, 2: 300, 3: 500, 4: 900, 5: 1500, items: { 4: ['SKYBLOCK_COIN:10000'], 5: ['SKYBLOCK_COIN:25000'] } },
    BURNING_TERROR_CHESTPLATE: { type: 'Crimson', 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 10: 100 },
  },
};
const bz = (buy, sell, week = 70_000) => ({ buy, sell, buyWeek: week, sellWeek: week });
const member = (coins, extra = {}) => ({ purse: 0, bank: coins, skills: {}, slayers: {}, dungeons: {}, mining: {}, inv: {}, pets: [], ...extra });

test('пределы сборки книг: обычные чары до максимума стола, ультимативные до V', () => {
  assert.equal(combineCap('SHARPNESS', constants), 5);
  assert.equal(combineCap('LOOTING', constants), 3, 'Looting IV и V только с мобов');
  assert.equal(combineCap('ULTIMATE_CHIMERA', constants), 5);
  assert.equal(combineCap('DRAGON_HUNTER', constants), 0, 'неизвестную чару не собираем');
});

test('сборка книг: выгодная сборка найдена, Sharpness VI из двух V не предлагаем', () => {
  const bazaar = new Map([
    ['ENCHANTMENT_ULTIMATE_CHIMERA_1', bz(25_000_000, 24_500_000, 7_000)],
    ['ENCHANTMENT_ULTIMATE_CHIMERA_5', bz(430_000_000, 420_000_000, 1_400)],
    ['ENCHANTMENT_SHARPNESS_5', bz(10_000, 9_000, 1e6)],
    ['ENCHANTMENT_SHARPNESS_6', bz(5_000_000, 4_900_000, 1e5)],
  ]);
  const list = bookCombos({ bazaar, bin: new Map(), constants, now: NOW, tax: 0.01125 });
  assert.ok(!list.some(x => x.id === 'ENCHANTMENT_SHARPNESS_6'), 'VI не собирается из V');
  const c = list.find(x => x.id === 'ENCHANTMENT_ULTIMATE_CHIMERA_5');
  assert.ok(c, 'Chimera I → V есть');
  assert.equal(c.books, 16);
  assert.ok(Math.abs(c.profit - (430_000_000 - 0.1) * (1 - 0.01125) + 16 * 25_000_000) < 1);
  // спрос: 1 400 продаж в неделю = 200 в день × 3% = 6 книг в день
  assert.ok(Math.abs(c.demandDay - 6) < 0.01);
  assert.ok(c.perHour <= c.profit * 6 / 24 + 1, 'доход ограничен спросом');
  // 16 книг по 25 млн = 400 млн: при бюджете 100 млн такую сборку не предлагаем
  assert.ok(!bookCombos({ bazaar, bin: new Map(), constants, now: NOW }, { budget: 100_000_000 }).some(x => x.id === 'ENCHANTMENT_ULTIMATE_CHIMERA_5'));
});

test('стоимость звёзд: эссенция и Master Stars по живым ценам, Crimson до 10 за эссенцию', () => {
  const bazaar = new Map([
    ['ESSENCE_WITHER', bz(2_000, 1_900)], ['ESSENCE_CRIMSON', bz(1_000, 900)],
    ...['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH'].map((n, i) => [`${n}_MASTER_STAR`, bz((i + 1) * 10_000_000, 1)]),
  ]);
  const ctx = { bazaar, bin: new Map(), constants };
  const s5 = starCost(ctx, 'HYPERION', 0, 5);
  assert.equal(s5.essence, 3350);
  assert.equal(s5.cost, 3350 * 2000 + 35_000);
  const s10 = starCost(ctx, 'HYPERION', 5, 10);
  assert.equal(s10.master, 5);
  assert.equal(s10.cost, 150_000_000);
  const cr = starCost(ctx, 'BURNING_TERROR_CHESTPLATE', 5, 10);
  assert.equal(cr.master, 0, 'у брони Crimson звёзды 6–10 за эссенцию');
  assert.equal(cr.cost, (60 + 70 + 80 + 90 + 100) * 1000);
  assert.equal(starCost(ctx, 'NO_SUCH', 0, 5), null);
});

test('ключ варианта: звёзды 0/5/10 и Recombobulator, питомцы и книги мимо', () => {
  assert.equal(variantKey({ id: 'HYPERION', stars: 5, recomb: true }), 'HYPERION@5r');
  assert.equal(variantKey({ id: 'HYPERION', stars: 0 }), 'HYPERION@0');
  assert.equal(variantKey({ id: 'HYPERION', stars: 3 }), null);
  assert.equal(variantKey({ id: 'GRIFFIN;4', pet: {} }), null);
  assert.equal(variantKey({ id: 'ENCHANTED_BOOK' }), null);
  assert.equal(variantKey({ id: 'HYPERION', stars: 5, upgrades: [{ id: 'IMPLOSION_SCROLL', kind: 'scroll' }, { id: 'WITHER_SHIELD_SCROLL', kind: 'scroll' }, { id: 'SHADOW_WARP_SCROLL', kind: 'scroll' }] }), 'HYPERION@5+s3', 'со свитками — отдельный вариант');
});

function upgradeCtx() {
  const bazaar = new Map([['ESSENCE_WITHER', bz(2_000, 1_900)], ['RECOMBOBULATOR_3000', bz(7_000_000, 6_800_000)]]);
  const binVar = new Map([
    ['HYPERION@0', { price: 650_000_000, count: 4 }],
    ['HYPERION@5', { price: 740_000_000, count: 6 }],
  ]);
  const sold = createSoldStore();
  for (let i = 0; i < 10; i++) recordSale(sold, 'HYPERION@5', 730_000_000, NOW - i * H);
  return { bazaar, bin: new Map(), binVar, sold, constants, now: NOW, tax: 0.01125 };
}

test('улучшение: 0 → 5 звёзд считается по медиане продаж и спросу', () => {
  const ctx = upgradeCtx();
  const [f] = upgradeFlips(ctx);
  assert.ok(f, 'сделка найдена');
  assert.equal(f.from, 'HYPERION@0');
  assert.equal(f.to, 'HYPERION@5');
  // продажа по медиане 730 млн (дешевле самого дешёвого лота 740), комиссия 2,5% + 1%
  assert.ok(Math.abs(f.sell - 730_000_000 * 0.965) < 1);
  assert.equal(f.upgrade, 3350 * 2000 + 35_000);
  assert.ok(f.perHour <= f.profit * 1.5 / 24 + 1, '10 продаж в сутки × 15% = 1,5 шт.');
  // Путь 0→5 один на свой вариант: тот же спрос не считается дважды
  assert.equal(upgradeFlips(ctx).filter(x => x.to === 'HYPERION@5').length, 1);
  // Продажи со свитками не выдаются за продажи «голых» 5 звёзд
  const scr = upgradeCtx(); scr.sold = createSoldStore(); scr.binVar.set('HYPERION@5+s3', { price: 1_000_000_000, count: 2 });
  for (let i = 0; i < 10; i++) recordSale(scr.sold, 'HYPERION@5+s3', 1_000_000_000, NOW - i * H);
  assert.equal(upgradeFlips(scr).length, 0);
  // Без реальных продаж улучшенного предмета сделки нет
  const empty = { ...ctx, sold: createSoldStore() };
  assert.equal(upgradeFlips(empty).length, 0);
  // Дороже бюджета — не предлагаем
  assert.equal(upgradeFlips(ctx, { budget: 100_000_000 }).length, 0);
});

test('методы «Перепродажа» в списке, с разбором, и прячутся в Ironman', () => {
  const ctx = upgradeCtx();
  ctx.bazaar.set('ENCHANTMENT_ULTIMATE_CHIMERA_1', bz(25_000_000, 24_500_000, 7_000));
  ctx.bazaar.set('ENCHANTMENT_ULTIMATE_CHIMERA_5', bz(430_000_000, 420_000_000, 1_400));
  ctx.bazaar.set('KISMET_FEATHER', bz(4_000_000, 3_800_000));
  const list = moneyMethods(member(1_000_000_000), ctx);
  for (const id of ['ah-snipe', 'book-combine', 'upgrade-flip', 'kismet']) {
    const x = list.find(m => m.id === id);
    assert.ok(x, id);
    assert.equal(x.tag, 'Перепродажа');
    assert.ok(x.steps.length >= 2 && x.risks.length >= 1, `${id}: разбор`);
  }
  const up = list.find(m => m.id === 'upgrade-flip');
  assert.equal(up.source, 'live');
  assert.ok(up.coinsPerHour > 0 && up.coinsPerHour < 100_000_000, `реалистичный доход: ${up.coinsPerHour}`);
  const books = list.find(m => m.id === 'book-combine');
  assert.ok(books.coinsPerHour > 0 && books.detail.includes('Chimera'));
  assert.ok(list.find(m => m.id === 'kismet').detail.includes('Kismet Feather'));
  const iron = moneyMethods(member(1_000_000_000, { gameMode: 'ironman' }), ctx).map(m => m.id);
  assert.ok(!iron.includes('book-combine') && !iron.includes('upgrade-flip') && !iron.includes('ah-snipe'));
});
