// Иконки: ID с Bazaar и из подсказок должны находить картинку, а не барьер (красный знак «запрещено»)
import test from 'node:test';
import assert from 'node:assert/strict';
import { neu } from '../src/neu.js';
import { iconMeta, neuIconId } from '../src/icons.js';

const book = '{display:{Name:"§fEnchanted Book"},ench:[]}';
neu.items.set('REJUVENATE;5', { id: 'REJUVENATE;5', name: '§9Rejuvenate V', mcId: 'minecraft:enchanted_book', rawNbt: book });
neu.items.set('ULTIMATE_LAST_STAND;5', { id: 'ULTIMATE_LAST_STAND;5', name: '§d§lUltimate Last Stand V', mcId: 'minecraft:enchanted_book', rawNbt: book });
neu.items.set('SAPLING-3', { id: 'SAPLING-3', name: 'Jungle Sapling', mcId: 'minecraft:sapling', damage: 3, rawNbt: '{ItemModel:"minecraft:jungle_sapling"}' });
neu.items.set('INK_SACK-3', { id: 'INK_SACK-3', name: 'Cocoa Beans', mcId: 'minecraft:dye', damage: 3, rawNbt: '' });
neu.loadedAt = neu.loadedAt || Date.now();

test('книги зачарований с Bazaar → ID в NEU', () => {
  assert.equal(neuIconId('ENCHANTMENT_REJUVENATE_5'), 'REJUVENATE;5');
  assert.equal(neuIconId('ENCHANTMENT_ULTIMATE_LAST_STAND_5'), 'ULTIMATE_LAST_STAND;5');
  assert.equal(neuIconId('INK_SACK:3'), 'INK_SACK-3');
  assert.equal(neuIconId('JUNGLE_SAPLING'), 'SAPLING-3');
  assert.equal(iconMeta('ENCHANTMENT_REJUVENATE_5').name, 'enchanted_book');
  assert.equal(iconMeta('JUNGLE_SAPLING').name, 'jungle_sapling');
});

test('книга, которой нет в NEU, и чертёж — не барьер', () => {
  assert.deepEqual(iconMeta('ENCHANTMENT_FEATHER_FALLING_10'), { kind: 'item', name: 'enchanted_book', glint: true });
  assert.equal(iconMeta('MATHEMATICAL_HOE_BLUEPRINT').name, 'paper');
  assert.equal(iconMeta('SOMETHING_UNKNOWN').name, 'barrier');
});

test('новый осколок и печенька Bazaar, которых нет в NEU, — не барьер', () => {
  assert.equal(iconMeta('SHARD_BRAND_NEW_MOB').name, 'prismarine_shard');
  assert.equal(iconMeta('BAZAAR_COOKIE').name, 'cookie');
});

test('старые имена текстур 1.8 → современные (иначе картинка не находилась)', () => {
  neu.items.set('TEST_DEADBUSH', { id: 'TEST_DEADBUSH', name: 'Dead Plant', mcId: 'minecraft:deadbush', rawNbt: '' });
  neu.items.set('TEST_RED_FLOWER', { id: 'TEST_RED_FLOWER', name: 'Bachelor Rose', mcId: 'minecraft:red_flower', rawNbt: '' });
  assert.equal(iconMeta('TEST_DEADBUSH').name, 'dead_bush');
  assert.equal(iconMeta('TEST_RED_FLOWER').name, 'poppy');
});

test('блоки без своей картинки предмета берут текстуру материала', async () => {
  const { blockAlt } = await import('../src/icons.js');
  assert.equal(blockAlt('oak_stairs'), 'oak_planks');
  assert.equal(blockAlt('brick_stairs'), 'bricks');
  assert.equal(blockAlt('cobblestone_wall'), 'cobblestone');
  assert.equal(blockAlt('lime_stained_glass_pane'), 'lime_stained_glass');
  assert.equal(blockAlt('glass_pane'), 'glass');
  assert.equal(blockAlt('red_carpet'), 'red_wool');
  assert.equal(blockAlt('black_banner'), 'black_wool');
  assert.equal(blockAlt('crafter'), 'crafter_north');
  assert.equal(blockAlt('diamond'), null);
});
