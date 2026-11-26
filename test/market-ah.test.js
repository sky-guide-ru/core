import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AH_BASES, ahOpen, ahAddBin, ahAddSale, ahMerge, ahFill, ahClean } from '../src/market/ah-candles.js';
import { createChartStore } from '../src/market/chart-store.js';
import { createAhList, variantLabel } from '../src/market/ah-list.js';
import { listBazaar } from '../src/market/bazaar-list.js';
import { createSoldStore, recordSale } from '../src/market/auctions.js';
import { AH_SORTS } from '../src/market/ah-list.js';

const T0 = 1_790_000_000;

test('свеча аукциона: lowest BIN и продажи копятся отдельно, нули не портят минимум', () => {
  const c = ahOpen(T0, 0, 100);
  assert.deepEqual(c.slice(1, 5), [0, 0, 0, 0]);
  assert.equal(c[10], 1);
  ahAddBin(c, 120); ahAddBin(c, 110);
  assert.deepEqual(c.slice(1, 5), [120, 120, 110, 110]);
  ahAddSale(c, 90); ahAddSale(c, 130);
  assert.deepEqual(c.slice(5, 9), [100, 130, 90, 130]);
  assert.equal(c[10], 3);
  ahAddSale(c, 95, 64); // стак из 64 штук — это 64 проданные штуки
  assert.equal(c[10], 67);
  assert.equal(ahOpen(T0, 0, 10, 16)[10], 16);

  const a = ahOpen(T0, 50, 0), b = ahOpen(T0 + 300, 0, 40);
  ahMerge(a, b);
  assert.deepEqual(a.slice(1, 5), [50, 50, 50, 50]); // у b лотов не было — BIN не тронут
  assert.deepEqual(a.slice(5, 9), [40, 40, 40, 40]); // у a продаж не было — берутся продажи b
  assert.equal(a[10], 1);
});

test('ahFill: пустые продажи — прошлая продажа, в начале — BIN; пустой BIN — прошлый BIN', () => {
  const list = [ahOpen(T0, 100, 0), ahOpen(T0 + 300, 0, 90), ahOpen(T0 + 600, 105, 0)];
  const out = ahFill(list);
  assert.equal(out[0][8], 100); // продаж ещё не было → BIN
  assert.equal(out[1][4], 100); // лотов не было → прошлый BIN
  assert.equal(out[1][8], 90);
  assert.equal(out[2][8], 90);  // продаж нет → прошлая продажа
  assert.equal(list[0][8], 0, 'вход не меняется');
  assert.equal(ahClean(list).length, 3);
});

test('хранилище аукциона: observe, сроки 30 дней, нет минутного ряда', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-'));
  let now = T0 * 1000;
  const st = createChartStore({ dir, now: () => now, bases: AH_BASES, merge: ahMerge, clean: ahClean });
  const bin = (k, p) => st.observe(k, now, t => ahOpen(t, p), c => ahAddBin(c, p));
  const sale = (k, p) => st.observe(k, now, t => ahOpen(t, 0, p), c => ahAddSale(c, p));
  bin('TITANIUM_TALISMAN', 25_000);
  sale('TITANIUM_TALISMAN', 24_000);
  now += 180_000; bin('TITANIUM_TALISMAN', 26_000);
  now += 300_000; bin('TITANIUM_TALISMAN', 27_000);
  await st.flush();
  const { candles } = await st.candles('TITANIUM_TALISMAN', '5m');
  assert.ok(candles.length >= 2);
  assert.equal(candles.at(-1)[4], 27_000);
  assert.equal(candles.reduce((s, c) => s + c[10], 0), 1, 'одна настоящая продажа');
  assert.deepEqual(await st.readBase('TITANIUM_TALISMAN', '1m'), []);
  assert.equal(fs.existsSync(path.join(dir, '1m')), false);
  // '15m' читает минутный ряд как «точный» — у аукциона его нет, это не ошибка
  assert.ok((await st.candles('TITANIUM_TALISMAN', '15m')).candles.length >= 1);
  await st.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function fakePrices() {
  const sold = createSoldStore();
  const now = Date.now();
  for (let i = 0; i < 5; i++) recordSale(sold, 'TITANIUM_TALISMAN', 24_000 + i * 100, now - i * 3600_000);
  recordSale(sold, 'HYPERION@5', 900_000_000, now - 1000);
  return {
    binAt: 1, soldAt: 1, bazaarAt: 1,
    bazaar: new Map([['ENCHANTMENT_SHARPNESS_5', { buy: 1, sell: 1 }]]),
    bin: new Map([
      ['TITANIUM_TALISMAN', { price: 25_000, second: 27_000, count: 12, auction: 'u1' }],
      ['ENCHANTMENT_SHARPNESS_5', { price: 5, second: 6, count: 1 }],
      ['HYPERION', { price: 800_000_000, second: 810_000_000, count: 30 }],
      ['ENDER_DRAGON;3', { price: 300_000_000, count: 5 }],
      ['ENDER_DRAGON;4', { price: 600_000_000, count: 8, max: 900_000_000 }],
    ]),
    binVar: new Map([
      ['HYPERION@0', { price: 800_000_000, count: 20 }],
      ['HYPERION@5', { price: 850_000_000, count: 5 }],
      ['HYPERION@5r', { price: 870_000_000, count: 5 }],
      ['TITANIUM_TALISMAN@0', { price: 25_000, count: 12 }],
    ]),
    binHistory: { TITANIUM_TALISMAN: [[now - 30 * 3600_000, 20_000], [now - 2 * 3600_000, 24_000]] },
    sold,
  };
}

test('список аукциона: Titanium Talisman находится, книги с Bazaar не дублируются, варианты', () => {
  const prices = fakePrices();
  const ah = createAhList({ prices, name: id => id.split(';')[0], nameEn: id => id, isPet: id => /^ENDER_DRAGON;/.test(id) });
  const rows = ah.rows();
  assert.ok(rows.has('TITANIUM_TALISMAN'));
  assert.ok(!rows.has('ENCHANTMENT_SHARPNESS_5'));
  assert.ok(![...rows.keys()].some(k => k.includes('@')), 'варианты не в общем списке');
  const t = rows.get('TITANIUM_TALISMAN');
  assert.equal(t.price, 25_000);
  assert.equal(t.sold24, 5);
  assert.equal(t.d1, 25); // 20 000 → 25 000

  const found = listBazaar(rows, { q: 'titanium', row: (id, r) => r, sorts: AH_SORTS });
  assert.equal(found.items[0].id, 'TITANIUM_TALISMAN');

  assert.deepEqual(ah.variants('TITANIUM_TALISMAN'), [], 'один вариант «без ★» не показываем');
  const hv = ah.variants('HYPERION').map(v => v.id);
  assert.deepEqual(hv, ['HYPERION', 'HYPERION@0', 'HYPERION@5', 'HYPERION@5r']);
  assert.equal(ah.row('HYPERION@5').sold24, 1);
  assert.match(ah.row('HYPERION@5r').name, /5★ \+ Recomb/);

  const pets = ah.variants('ENDER_DRAGON;4');
  assert.deepEqual(pets.map(v => v.label), ['Epic', 'Legendary']);
  assert.equal(rows.get('ENDER_DRAGON;4').max, 900_000_000);
});

test('рост за сутки на аукционе: единственный дорогой лот не даёт +1 499 900 % и не поднимает предмет по обороту', () => {
  const now = Date.now(), H = 3600_000;
  const sold = createSoldStore();
  for (let i = 0; i < 6; i++) recordSale(sold, 'LAPIS_ARMOR_BOOTS', 40, now - i * H);
  for (let i = 0; i < 4; i++) recordSale(sold, 'JUJU_SHORTBOW', 9_000_000, now - i * H);
  const hist = { LAPIS_ARMOR_BOOTS: [[now - 24 * H, 40]], JUJU_SHORTBOW: [[now - 24 * H, 8_000_000]] };
  const prices = (lapis) => ({
    binAt: 1, soldAt: 1, bazaarAt: 1, bazaar: new Map(), binHistory: hist, sold,
    bin: new Map([['LAPIS_ARMOR_BOOTS', lapis], ['JUJU_SHORTBOW', { price: 10_000_000, count: 15 }]]),
  });
  const mk = p => createAhList({ prices: p, name: id => id, nameEn: id => id, isPet: () => false, clock: () => now }).rows();
  let rows = mk(prices({ price: 600_000_000, count: 1 }));
  assert.equal(rows.get('LAPIS_ARMOR_BOOTS').d1, null, 'один лот — рост не считаем');
  assert.equal(rows.get('JUJU_SHORTBOW').d1, 25);
  const top = listBazaar(rows, { row: (id, r) => r, sorts: AH_SORTS, sort: 'vol' }).items.map(r => r.id);
  assert.deepEqual(top, ['JUJU_SHORTBOW', 'LAPIS_ARMOR_BOOTS'], 'оборот — по ценам продаж, а не по лоту за 600 млн');
  rows = mk(prices({ price: 600_000_000, count: 5 }));
  assert.equal(rows.get('LAPIS_ARMOR_BOOTS').d1, null, 'лоты в 10+ раз дороже продаж — выброс');
  rows = mk(prices({ price: 50, count: 5 }));
  assert.equal(rows.get('LAPIS_ARMOR_BOOTS').d1, 25);
});

test('подписи вариантов', () => {
  assert.equal(variantLabel('HYPERION@0'), 'без ★');
  assert.equal(variantLabel('HYPERION@10r+s3'), '10★ + Recomb + 3 свит.');
  assert.equal(variantLabel('GOLDEN_DRAGON;5'), 'Mythic');
  assert.equal(variantLabel('HYPERION'), 'Любой');
});

test('рост за сутки — от медианы, единичная цена в 1 монету не даёт миллионы процентов', async () => {
  const { dayChangePct } = await import('../src/market/history.js');
  const now = Date.now(), H = 3600_000;
  const pts = [[now - 29 * H, 1_900_000], [now - 26 * H, 1], [now - 24 * H, 2_000_000], [now - 20 * H, 2_100_000], [now - H, 1_950_000]];
  assert.equal(dayChangePct(pts, 2_000_000, 1, now), 2.6); // медиана 1 / 1,9 / 2,0 / 2,1 млн = 1,95 млн
  assert.equal(dayChangePct([[now - H, 5]], 10, 1, now), null, 'меньше 6 часов истории — нет данных');
  assert.equal(dayChangePct([[now - 8 * H, 5]], 10, 1, now), 100);
});

test('редкость «VERY SPECIAL» из базы приходит ключом фильтра VERY_SPECIAL', () => {
  const prices = fakePrices();
  const ah = createAhList({ prices, name: id => id, nameEn: id => id, isPet: () => false, rarity: id => (id === 'HYPERION' ? 'VERY SPECIAL' : null) });
  assert.equal(ah.rows().get('HYPERION').rarity, 'VERY_SPECIAL');
  assert.equal(ah.rows().get('TITANIUM_TALISMAN').rarity, null);
});
