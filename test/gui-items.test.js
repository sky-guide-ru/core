// Служебные предметы (звезда меню SkyBlock) не считаются вещами игрока
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allStoredItems, itemValue } from '../src/parse/gear.js';
import { allItems } from '../src/live-advisor/lib/inventory.js';
import { isGuiItem, GUI_ITEMS } from '../src/lib/gui-items.js';
import { translateLore } from '../src/items-ru/index.js';

const menu = { id: 'SKYBLOCK_MENU', name: 'SkyBlock Menu (Click)', count: 1, lore: [] };
const sword = { id: 'ASPECT_OF_THE_END', name: 'Aspect of the End', count: 1, lore: [] };

test('меню SkyBlock — служебный предмет', () => {
  assert.ok(isGuiItem(menu));
  assert.ok(!isGuiItem(sword));
  assert.match(GUI_ITEMS.SKYBLOCK_MENU.textRu, /Пасхалка/);
});

test('меню не попадает в список вещей (снаряжение, стоимость, «как улучшить») и стоит 0', () => {
  const inv = { inventory: [sword, null, menu], rift: { inventory: [menu] } };
  const ids = allStoredItems(inv).map(i => i.id);
  assert.deepEqual(ids, ['ASPECT_OF_THE_END']);
  assert.equal(itemValue(menu), 0);
});

test('советчик не видит меню в инвентаре', () => {
  const ids = allItems({ inv: { inventory: [menu, sword], rift: { inventory: [menu] } } }).map(i => i.id);
  assert.deepEqual(ids, ['ASPECT_OF_THE_END']);
});

test('лор меню переводится абзацем целиком', () => {
  const { lines, untranslated } = translateLore(['§7View all of your SkyBlock', '§7progress, including your Skills,', '§7Collections, Recipes, and more!', '', '§eClick to open!']);
  assert.equal(untranslated, 0);
  assert.ok(!lines.join(' ').match(/View all|Click to open/));
});
