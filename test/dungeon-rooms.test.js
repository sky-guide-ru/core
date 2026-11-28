import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeonScore, rankOf, PUZZLES, WEIRDOS, scoreTable, scoreNext } from '../src/guides/dungeons-rooms.js';

test('счёт данжа: идеальный F7 — 300 + Crypts, Mimic только с F6', () => {
  const r = dungeonScore({ floor: 'F7', secrets: 100, rooms: 100, seconds: 13 * 60, crypts: 5, mimic: true });
  assert.deepEqual([r.skill, r.explore, r.speed, r.bonus, r.total, r.rank], [100, 100, 100, 7, 307, 'S+']);
  assert.equal(dungeonScore({ floor: 'F5', crypts: 5, mimic: true, seconds: 60 }).bonus, 5);
});

test('счёт данжа: смерти, загадки, норма секретов и штраф за время', () => {
  assert.equal(dungeonScore({ floor: 'F7', deaths: 2, spirit: true }).skill, 97);
  assert.equal(dungeonScore({ floor: 'F7', failed: 1 }).skill, 86);
  assert.equal(dungeonScore({ floor: 'F1', secrets: 30 }).explore, 100); // на F1 хватает 30% секретов
  assert.equal(dungeonScore({ floor: 'F7', secrets: 50 }).explore, 80);
  assert.equal(dungeonScore({ floor: 'F7', seconds: 840 + 120 }).speed, 90); // 2 минуты сверх лимита 14 мин
  assert.equal(dungeonScore({ floor: 'M5', seconds: 8 * 60 }).speed, 100);
  assert.equal(dungeonScore({ floor: 'M5', seconds: 8 * 60 + 60 }).speed, 95);
});

test('оценки и данные загадок', () => {
  assert.equal(rankOf(300), 'S+'); assert.equal(rankOf(270), 'S'); assert.equal(rankOf(269), 'A'); assert.equal(rankOf(0), null);
  assert.equal(new Set(PUZZLES.map(p => p.id)).size, PUZZLES.length);
  assert.equal(WEIRDOS.filter(w => w.reward).length, 6);
});

test('счёт по этажам и шаг «Добейся S+»', () => {
  const d = { floors: { 5: 3, 6: 1 }, masterFloors: {}, bestScore: { 5: 302, 6: 250 } };
  const t = scoreTable(d);
  assert.equal(t.rows[4][2].text, 'S+');
  assert.equal(t.rows[5][2].text, 'A');
  const nx = scoreNext(d);
  assert.match(nx[0].title, /F6: лучший счёт 250/);
  assert.equal(scoreNext({ floors: { 6: 1 }, bestScore: { 6: 301 } }).length, 0);
});
