import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as xv from '../src/parse/extras-view.js';

test('атрибуты Hunting: настоящее название, осколок и максимум по редкости', () => {
  const [a] = xv.viewAttributes([{ id: 'arachno', n: 40 }]);
  assert.equal(a.name, 'Arthropod Ruler');
  assert.equal(a.shard, 'Flaming Spider');
  assert.equal(a.shardId, 'ATTRIBUTE_SHARD_ARACHNO;1');
  assert.equal(a.max, xv.ATTRIBUTE_MAX.UNCOMMON);
  assert.match(a.effect, /членистоног/);
});

test('осколки: тип из API находит предмет, в том числе при расхождении названий', () => {
  const v = xv.viewShards([{ type: 'ZEALOT', owned: 1 }, { type: 'WITHER_SPECTER', owned: 4 }, { type: 'BRUISER', owned: 1 }, { type: 'NOPE_X', owned: 2 }, { type: 'BAL', owned: 0 }]);
  const by = Object.fromEntries(v.map(s => [s.type, s]));
  assert.equal(by.ZEALOT.name, 'Zealot');
  assert.ok(by.ZEALOT.shardId);
  assert.equal(by.WITHER_SPECTER.name, 'Wither Spectre');
  assert.equal(by.BRUISER.name, 'Zealot Bruiser');
  assert.equal(by.NOPE_X.name, 'Nope X');
  assert.equal(by.BAL, undefined, 'нулевые не показываем');
  assert.equal(v[0].type, 'WITHER_SPECTER', 'сортировка по количеству');
});

test('сад, кролики, деревья и кооператив: названия и максимумы', () => {
  const chips = xv.viewGardenChips({ vermin_vaporizer: 20, mechamind: 15 });
  assert.deepEqual(chips.map(c => [c.id, c.name, c.level, c.max]), [['VERMIN_VAPORIZER_GARDEN_CHIP', 'Vermin Vaporizer', 20, 20], ['MECHAMIND_GARDEN_CHIP', 'Mechamind', 15, 20]]);
  assert.deepEqual(xv.viewEmployees({ rabbit_dog: 220, rabbit_bro: 200 }).map(e => e.name), ['Rabbit Bro', 'Rabbit Dog']);
  assert.deepEqual(xv.viewTreeGifts({ MANGROVE: 19, FIG: 134, note: 'x' }).map(t => [t.id, t.n]), [['FIG_LOG', 134], ['MANGROVE_LOG', 19]]);
  const coop = xv.viewCommunity({ island_size: 1, minion_slots: 5 });
  assert.deepEqual(coop.map(c => [c.name, c.level, c.max]), [['Размер острова', 1, 10], ['Слоты миньонов', 5, 5]]);
  assert.deepEqual(xv.viewGreenhouse({ GROWTH_SPEED: 5 }), [{ key: 'GROWTH_SPEED', name: 'Скорость роста', level: 5 }]);
  const [v] = xv.viewVisitors([{ npc: 'queen_mismyla', items: [{ id: 'ENCHANTED_WHEAT', amount: 241 }] }]);
  assert.equal(v.name, 'Queen Mismyla');
  assert.equal(v.items[0].amount, 241);
  assert.equal(xv.gardenLevel(171632).level, 15);
  assert.equal(xv.gardenLevel(100).level, 2);
});
