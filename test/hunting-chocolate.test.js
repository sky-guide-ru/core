import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attrLevel, catalog } from '../src/guides/hunting.js';
import { sourceText, LEVEL_SHARDS } from '../src/guides/hunting-data.js';
import { chocolateAdvice, employeeCost, employeeCostTo, towerCost } from '../src/analysis/chocolate.js';
import { buildGuide } from '../src/guides/index.js';
import { ownercatMember } from './fixtures/ownercat.js';

test('hunting: уровень атрибута по осколкам совпадает с таблицей вики', () => {
  for (const [r, steps] of Object.entries(LEVEL_SHARDS)) assert.equal(steps.reduce((a, b) => a + b, 0), { COMMON: 96, UNCOMMON: 64, RARE: 48, EPIC: 32, LEGENDARY: 24 }[r]);
  assert.deepEqual(attrLevel(96, 'COMMON'), { level: 10, max: 96, left: 0, toNext: 0 });
  assert.equal(attrLevel(4, 'COMMON').level, 2);
  assert.equal(attrLevel(3, 'COMMON').level, 1);
  assert.equal(attrLevel(0, 'RARE').toNext, 1);
});

test('hunting: каталог осколков из NEU с источниками', () => {
  const c = catalog();
  assert.ok(c.list.length > 200);
  const cod = c.list.find(s => s.shard === 'Cod');
  assert.equal(cod.name, 'Cheapstake');
  assert.match(cod.source, /Fishing Net/);
  assert.ok(c.list.filter(s => s.source).length / c.list.length > 0.6, 'у большинства осколков есть «где взять»');
  assert.equal(sourceText('Zealot', 'B|S|K'), 'поймать Black Hole: Zealot · убить с солью · сундук Kuudra');
});

test('hunting: гайд подсказывает извлечь осколки из коробки и показывает лишние', () => {
  const m = ownercatMember();
  m.skills.hunting = { level: 17 };
  const by = n => catalog().list.find(s => s.shard === n).attr.toLowerCase();
  m.extras = { ...(m.extras || {}), attributes: [{ id: by('Flaming Spider'), n: 64 }, { id: by('Sycophant'), n: 20 }],
    shards: [{ type: 'FLAMING_SPIDER', owned: 2 }, { type: 'SYCOPHANT', owned: 4 }], shardHunts: { combat: 10, fishing: 0, forest: 0, trap: 0, salt: 0 } };
  const g = buildGuide('hunting', m, {}, {});
  assert.equal(g.status, 'progress');
  assert.ok(g.next.some(n => /Извлеки/.test(n.title) && /Sycophant/.test(n.why)));
  assert.ok(g.next.some(n => /Лишние/.test(n.title) && /Flaming Spider/.test(n.why)));
});

test('шоколад: формулы цен сходятся с вики', () => {
  assert.equal(employeeCost(1, 0, 1), 50);              // (30 + 20·1)·1
  assert.equal(Math.round(employeeCost(2, 0, 1)), 1440); // база Rabbit Cousin на CF1
  assert.equal(employeeCostTo(3, 5, 5, 2), 0);
  let sum = 0; for (let L = 2; L <= 15; L++) sum += towerCost(L, 2);
  assert.equal(sum, 1_045_000_000);                     // Time Tower до 15 на CF2
});

test('шоколад: резиденты сгруппированы по островам', () => {
  const a = chocolateAdvice({ prestige: 6, employees: {}, found: ['rogue', 'mush_mush'], timeTower: 15 });
  assert.ok(a.residents.byIsland.length > 10);
  const hub = a.residents.byIsland.find(r => r.island === 'HUB');
  assert.deepEqual(hub.found, ['Rogue']);
  assert.ok(hub.missing.includes('Castle'));
  assert.equal(a.residents.total, a.residents.found + a.residents.missing.length);
  const tip = a.tips.find(t => t.id === 'cf-residents');
  assert.ok(tip.text.length < 260, 'совет короткий, список — отдельно');
});
