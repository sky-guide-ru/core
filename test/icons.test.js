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

test('аватарка: лицо и второй слой из скина, старый скин 64×32 без сплошной «шапки»', async () => {
  const { PNG } = await import('pngjs');
  const { headFromSkin } = await import('../src/icons.js');
  const skin = (h, hatAlpha) => {
    const p = new PNG({ width: 64, height: h });
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) p.data.set([200, 150, 100, 255], (y * 64 + x) * 4); // лицо
    for (let y = 0; y < 16; y++) for (let x = 32; x < 64; x++) p.data.set([0, 0, 0, hatAlpha], (y * 64 + x) * 4); // второй слой
    p.data.set([255, 0, 0, 255], (8 * 64 + 40) * 4); // одна красная точка второго слоя — левый верхний угол лица
    return PNG.sync.write(p);
  };
  const px = (buf, x, y) => { const p = PNG.sync.read(buf); return [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)]; };
  const modern = headFromSkin(skin(64, 0), 64);
  assert.equal(PNG.sync.read(modern).width, 64);
  assert.deepEqual(px(modern, 0, 0), [255, 0, 0, 255]); // второй слой поверх лица
  assert.deepEqual(px(modern, 40, 40), [200, 150, 100, 255]);
  // 64×32 со сплошным чёрным вторым слоем: игра его не рисует — видно лицо, а не чёрный квадрат
  const legacy = headFromSkin(skin(32, 255), 32);
  assert.deepEqual(px(legacy, 20, 20), [200, 150, 100, 255]);
  assert.equal(headFromSkin(PNG.sync.write(new PNG({ width: 16, height: 16 }))), null);
});
