// Телепорты /warp: таблица свитков и правило MVP+ (src/guides/warps.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { warpTable, warpStatus, hasMvpPlus } from '../src/guides/warps.js';

const T = warpTable();

test('варпы: hub и home открыты, drag — EPIC, end — RARE', () => {
  assert.equal(T.hub.rarity, 'free');
  assert.equal(T.home.rarity, 'free');
  assert.equal(T.drag.rarity, 'EPIC');
  assert.equal(T.end.rarity, 'RARE');
  assert.match(T.drag.how, /Unstable Dragon/);
  assert.equal(T.dragons, T.drag, 'синоним ведёт на ту же запись');
});

test('варпы: запасной путь — главный варп острова и расстояние', () => {
  assert.deepEqual(T.drag.via, { warp: 'end', dist: T.drag.via.dist });
  assert.ok(T.drag.via.dist > 50 && T.drag.via.dist < 200);
  assert.equal(T.kuudra.via.warp, 'nether');
  assert.equal(T.castle.via.warp, 'hub');
  assert.ok(!T.end.via, 'у главного варпа острова нет запасного варпа');
  assert.ok(T.nether.route);
});

test('варпы: статус по рангу и отметкам', () => {
  assert.equal(warpStatus(T.hub, {}), 'ok');
  assert.equal(warpStatus(T.drag, { rankId: 'VIP_PLUS' }), 'rank');
  assert.equal(warpStatus(T.drag, { rankId: 'MVP_PLUS' }), 'scroll');
  assert.equal(warpStatus(T.drag, { rankId: 'MVP_PLUS_PLUS', marks: { drag: true } }), 'ok');
  assert.equal(warpStatus(T.drag, { rankId: null }), 'scroll', 'ранг неизвестен — про MVP+ не судим');
  assert.equal(warpStatus(T.end, { rankId: 'NONE' }), 'scroll', 'RARE-свиток работает без ранга');
  assert.equal(warpStatus(T.drag, { rankId: 'NONE', bingo: true }), 'ok');
  assert.equal(warpStatus(undefined, {}), 'plain');
  assert.equal(hasMvpPlus('MVP'), false);
  assert.equal(hasMvpPlus(null), null);
});

test('варпы: все /warp из текстов гайдов есть в таблице', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../src/guides/', import.meta.url);
  const miss = new Set();
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
    for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/\/warp ([a-z_]+)/g)) if (!T[m[1]]) miss.add(m[1]);
  }
  assert.deepEqual([...miss], []);
});
