// «Рынок»: список товаров Bazaar должен отдавать ВСЕ товары (а не топ-300), включая книги, осколки и товары без ордеров
import test from 'node:test';
import assert from 'node:assert/strict';
import { listBazaar } from '../src/market/bazaar-list.js';
import { getNames, normalizeId } from '../src/items-ru/index.js';
import { displayName } from '../src/names.js';

const rec = (buy, sell, week = 0) => ({ buy, sell, buyWeek: week, sellWeek: week, buyVol: 0, sellVol: 0, buyOrders: 0, sellOrders: 0 });
const bazaar = new Map([
  ['ENCHANTED_DIAMOND', rec(1500, 1400, 100000)],
  ['ENCHANTMENT_SHARPNESS_5', rec(30000, 25000, 50)],
  ['SHARD_CINDER_BAT', rec(9000, 8000, 10)],
  ['ESSENCE_WITHER', rec(3000, 2900, 500)],
  ['ENCHANTMENT_CAYENNE_1', rec(0, 0)], // без ордеров
  ['INK_SACK:3', rec(5, 4, 1000)],
]);
// 2000 «прочих» товаров — как на настоящем Bazaar
for (let i = 0; i < 2000; i++) bazaar.set(`FILLER_${i}`, rec(10 + i, 9 + i, i));
const row = (id, p) => ({ id, name: displayName(id), nameEn: getNames(id)?.nameEn || id, ...p, spread: p.buy - p.sell });
const search = q => (/остр/.test(q) ? new Map([['SHARPNESS;5', 0]]) : /зачарованный алмаз/.test(q) ? new Map([['ENCHANTED_DIAMOND', 0]]) : null);
const opt = extra => ({ row, searchIds: search, keyOf: normalizeId, ...extra });

test('без поиска видны все товары: total = размер Bazaar, страницы идут подряд', () => {
  const a = listBazaar(bazaar, opt({ limit: 200 }));
  assert.equal(a.total, bazaar.size);
  assert.equal(a.items.length, 200);
  assert.equal(a.items[0].id, 'ENCHANTED_DIAMOND'); // по обороту
  const all = [];
  for (let off = 0; off < a.total; off += 500) all.push(...listBazaar(bazaar, opt({ offset: off, limit: 500 })).items);
  assert.equal(new Set(all.map(r => r.id)).size, bazaar.size);
  for (const id of ['ENCHANTMENT_SHARPNESS_5', 'SHARD_CINDER_BAT', 'ESSENCE_WITHER', 'ENCHANTMENT_CAYENNE_1', 'INK_SACK:3']) assert.ok(all.some(r => r.id === id), id);
});

test('сортировка по всем товарам; без цены — в конце', () => {
  const cheap = listBazaar(bazaar, opt({ sort: 'buy:1', limit: 3000 })).items;
  assert.equal(cheap[0].id, 'INK_SACK:3');
  assert.equal(cheap.at(-1).id, 'ENCHANTMENT_CAYENNE_1');
  const dear = listBazaar(bazaar, opt({ sort: 'buy:-1', limit: 1 })).items;
  assert.equal(dear[0].id, 'ENCHANTMENT_SHARPNESS_5');
});

test('поиск: по-русски (через ID базы), по-английски и по ID', () => {
  assert.deepEqual(listBazaar(bazaar, opt({ q: 'острота' })).items.map(r => r.id), ['ENCHANTMENT_SHARPNESS_5']);
  assert.ok(listBazaar(bazaar, opt({ q: 'зачарованный алмаз' })).items.some(r => r.id === 'ENCHANTED_DIAMOND'));
  assert.ok(listBazaar(bazaar, opt({ q: 'cinderbat' })).items.some(r => r.id === 'SHARD_CINDER_BAT'));
  assert.ok(listBazaar(bazaar, opt({ q: 'cayenne' })).items.some(r => r.id === 'ENCHANTMENT_CAYENNE_1'));
});

test('названия без сырых ID: книги и материалы как в игре, осколки по базе', () => {
  assert.equal(displayName('ENCHANTED_DIAMOND'), 'Enchanted Diamond');
  assert.match(displayName('ENCHANTMENT_SHARPNESS_5'), /^Sharpness V$/);
  assert.equal(displayName('INK_SACK:3'), 'Cocoa Beans');
  for (const [bz, en] of [['SHARD_CINDER_BAT', 'Cinderbat Shard'], ['SHARD_ENDSTONE_PROTECTOR', 'End Stone Protector Shard'],
    ['SHARD_PACKRAT_SKULL', 'Packrat Shard'], ['SHARD_ABYSSAL_LANTERN', 'Abyssal Lanternfish Shard'], ['SHARD_SEA_EMPEROR', 'Loch Emperor Shard']]) {
    assert.equal(getNames(bz)?.nameEn, en, bz);
  }
  assert.equal(getNames('ENCHANTED_CARROT_ON_A_STICK')?.id, 'ENCHANTED_CARROT_STICK');
  // Товара нет ни в одной базе — имя собирается из ID, но без подчёркиваний
  assert.equal(displayName('SHARD_BRAND_NEW_MOB'), 'Brand New Mob Shard');
});

test('поиск: слабые совпадения уходят вниз с пометкой «похожие», только если есть точные', () => {
  const ah = new Map([['MAGIC_8_BALL', rec(1, 1, 5)], ['MAGICAL_LAVA_BUCKET', rec(1, 1, 999)], ['MAGMA_BOW', rec(1, 1, 50)]]);
  const r = (id, p) => ({ id, name: { MAGIC_8_BALL: 'Magic 8 Ball', MAGICAL_LAVA_BUCKET: 'Magical Lava Bucket', MAGMA_BOW: 'Magma Bow' }[id], nameEn: '', ...p });
  const ids = () => new Map([['MAGIC_8_BALL', { at: 0, score: 100 }], ['MAGICAL_LAVA_BUCKET', { at: 1, score: 40 }], ['MAGMA_BOW', { at: 2, score: 30 }]]);
  const out = listBazaar(ah, { q: 'magic 8 ball', row: r, searchIds: ids });
  assert.equal(out.items[0].id, 'MAGIC_8_BALL');
  assert.ok(!out.items[0].similar);
  assert.ok(out.items.slice(1).every(x => x.similar));
  // точных нет — слабые показываются как обычные
  const none = listBazaar(ah, { q: 'mgic', row: r, searchIds: () => new Map([['MAGMA_BOW', { at: 0, score: 40 }]]) });
  assert.ok(none.items.every(x => !x.similar));
});
