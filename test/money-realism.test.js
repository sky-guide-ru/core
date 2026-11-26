// «Заработок» должен показывать реальные цифры: жалобы игроков 23.11.2026 —
// «перекрафт в Forge 50 млрд/ч», «флип на Bazaar 15 млн/ч», «крафт Valkyrie при богатстве 300 млн».
import test from 'node:test';
import assert from 'node:assert/strict';
import { craftFlips, forgeFlips, bazaarFlips, planForge } from '../src/market/flips.js';
import { moneyMethods } from '../src/market/methods.js';
import { createSoldStore, recordSale } from '../src/market/auctions.js';

const NOW = 1_800_000_000_000;
const H = 3600_000;
const item = (id, extra = {}) => ({ id, name: id, recipe: null, recipes: [], crafttext: '', ...extra });
const forge = (inputs, duration, out) => ({ type: 'forge', inputs, count: 1, overrideOutputId: out, duration });
const member = (coins, extra = {}) => ({ purse: 0, bank: coins, skills: {}, slayers: {}, dungeons: {}, mining: { hotm: { level: 7 } }, inv: {}, pets: [], ...extra });

test('Forge без длительности не даёт «миллиарды в час»', () => {
  const items = new Map([
    ['ING', item('ING')],
    ['OUT', item('OUT', { recipes: [forge(['ING:10'], 0, 'OUT')] })],
  ]);
  const bazaar = new Map([
    ['ING', { buy: 1000, sell: 990, buyWeek: 1e7, sellWeek: 1e7 }],
    ['OUT', { buy: 100_000_000, sell: 95_000_000, buyWeek: 50_000, sellWeek: 50_000 }],
  ]);
  assert.equal(forgeFlips({ items, bazaar, bin: new Map(), now: NOW }, { minProfit: 0 }).length, 0);
});

test('предмет аукциона без реальных продаж в крафт-флипы не попадает', () => {
  const items = new Map([['ING', item('ING')], ['SWORD', item('SWORD', { recipe: { A1: 'ING:10' } })]]);
  const bazaar = new Map([['ING', { buy: 1000, sell: 990, buyWeek: 1e7, sellWeek: 1e7 }]]);
  const bin = new Map([['SWORD', { price: 500_000_000, count: 5 }]]);
  const sold = createSoldStore();
  const ctx = { items, bazaar, bin, sold, now: NOW };
  assert.equal(craftFlips(ctx, { minProfit: 0 }).length, 0, 'ноль продаж — спроса нет');
  recordSale(sold, 'SWORD', 450_000_000, NOW - H);
  assert.equal(craftFlips(ctx, { minProfit: 0 }).length, 0, 'одна продажа в сутки — мало');
  for (let i = 2; i < 6; i++) recordSale(sold, 'SWORD', 300_000_000, NOW - i * H);
  const [f] = craftFlips(ctx, { minProfit: 0 });
  assert.ok(f, 'с продажами — есть');
  assert.ok(f.sell < 300_000_000, `цена по медиане продаж, а не по самому дешёвому лоту: ${f.sell}`);
  // 5 продаж в сутки × 15% = 0,75 шт. в день → доход в час — малая доля прибыли за крафт
  assert.ok(f.perHour < f.profit / 24, `доход ${f.perHour} при прибыли ${f.profit}`);
});

test('крафт дороже бюджета игрока не советуем (Valkyrie при богатстве 300 млн)', () => {
  const items = new Map([['ING', item('ING')], ['VALKYRIE', item('VALKYRIE', { recipe: { A1: 'ING:500' } })], ['CHEAP', item('CHEAP', { recipe: { A1: 'ING:2' } })]]);
  const bazaar = new Map([
    ['ING', { buy: 1_000_000, sell: 990_000, buyWeek: 1e7, sellWeek: 1e7 }],
    ['CHEAP', { buy: 2_400_000, sell: 2_300_000, buyWeek: 70_000, sellWeek: 70_000 }],
  ]);
  const bin = new Map([['VALKYRIE', { price: 600_000_000, count: 10 }]]);
  const sold = createSoldStore();
  for (let i = 0; i < 6; i++) recordSale(sold, 'VALKYRIE', 600_000_000, NOW - i * H);
  const ctx = { items, bazaar, bin, sold, now: NOW, tax: 0.01125 };
  assert.ok(craftFlips(ctx, { minProfit: 0 }).some(f => f.id === 'VALKYRIE'), 'в общей таблице крафт есть');
  const m = member(20_000_000);
  const cf = moneyMethods(m, ctx, { networth: 300_000_000 }).find(x => x.id === 'craft-flip');
  assert.ok(!cf.top?.some(t => t.id === 'VALKYRIE'), 'в методе для игрока с 300 млн — нет');
  assert.equal(cf.top?.[0]?.id, 'CHEAP');
  assert.ok(cf.coinsPerHourRange && cf.coinsPerHourRange[0] <= cf.coinsPerHour, 'диапазон от осторожного до обычного');
});

test('Forge: слоты под рецепт ограничены спросом', () => {
  const list = [
    { id: 'RARE', perHour: 10_000_000, perHourLow: 8_000_000, maxSlots: 0.5, profit: 1, durationH: 1 },
    { id: 'COMMON', perHour: 1_000_000, perHourLow: 800_000, maxSlots: 10, profit: 1, durationH: 1 },
    { id: 'FAKE', perHour: 9e9, perHourLow: 9e9, maxSlots: 10, profit: 1, durationH: 1, suspicious: true },
  ];
  const p = planForge(list, 5);
  assert.equal(p.used.length, 2, 'подозрительный рецепт пропущен');
  assert.equal(p.used[0].slots, 0.5);
  assert.ok(Math.abs(p.perHour - (10_000_000 * 0.5 + 1_000_000 * 4.5)) < 1);
  assert.ok(p.perHourLow < p.perHour);
});

test('флип Bazaar: считаем по обычному спреду за неделю, а не по случайному разрыву', () => {
  const hist = [];
  for (let i = 7 * 24; i >= 1; i--) hist.push([NOW - i * H, 1030, 1000]); // обычный разрыв ~30 монет
  const bazaar = new Map([['X', { buy: 1200, sell: 1000, buyWeek: 5_000_000, sellWeek: 5_000_000, buyOrders: 50, sellOrders: 50 }]]);
  const [f] = bazaarFlips({ bazaar, bin: new Map(), history: { X: hist }, now: NOW, tax: 0.01125 }, { minWeeklyCoins: 0, includeRisky: true, budget: 1e12 });
  assert.ok(f.margin > 150, 'сегодняшний разрыв большой');
  assert.ok(f.realMargin < 25, `а считаем по обычному: ${f.realMargin}`);
  assert.ok(f.perHourLow <= f.perHour && f.perHour <= f.perHourHigh);
  // 2% часового оборота
  assert.ok(Math.abs(f.unitsPerHour - Math.floor(5_000_000 / 168 * 0.02)) <= 1);
});

test('флип Bazaar: капитал ограничивает доход и делится между товарами', () => {
  const bazaar = new Map();
  for (const id of ['A', 'B', 'C']) bazaar.set(id, { buy: 1100, sell: 1000, buyWeek: 1e9, sellWeek: 1e9 });
  const ctx = { bazaar, bin: new Map(), now: NOW, tax: 0.01125 };
  const bf = moneyMethods(member(10_000_000), ctx, {}).find(x => x.id === 'bazaar-flip');
  // в обороте 5 млн на троих, круг ~2 ч: (5 млн / 3) / (1000 × 2) ≈ 833 шт./ч на товар
  const perItem = (5_000_000 / 3) / (1000.1 * 2);
  const margin = (1100 - 0.1) * (1 - 0.01125) - 1000.1;
  assert.ok(bf.coinsPerHour <= 3 * perItem * margin + 1, `доход ${bf.coinsPerHour}`);
  assert.ok(bf.coinsPerHour < 1_000_000, 'с 10 млн флипы не дают миллионы в час');
  assert.ok(bf.coinsPerHourRange[0] < bf.coinsPerHour && bf.coinsPerHour <= bf.coinsPerHourRange[1]);
});

test('подозрительные рецепты не вытесняют нормальные из совета (ревью #162)', () => {
  const items = new Map([['ING', item('ING')], ['GOOD', item('GOOD', { recipe: { A1: 'ING:2' } })]]);
  const bazaar = new Map([
    ['ING', { buy: 100_000, sell: 99_000, buyWeek: 1e9, sellWeek: 1e9 }],
    ['GOOD', { buy: 260_000, sell: 250_000, buyWeek: 1e7, sellWeek: 1e7 }],
  ]);
  for (let i = 0; i < 130; i++) {
    items.set(`ODD${i}`, item(`ODD${i}`, { recipe: { A1: 'ING:1' } }));
    bazaar.set(`ODD${i}`, { buy: 1e6 + i, sell: 9e5, buyWeek: 1e7, sellWeek: 1e7 });
  }
  const ctx = { items, bazaar, bin: new Map(), now: NOW, tax: 0.01125 };
  const cf = moneyMethods(member(20_000_000), ctx, {}).find(x => x.id === 'craft-flip');
  assert.equal(cf.top?.[0]?.id, 'GOOD');
});
