// Overflow-уровни скиллов: уровень без игрового капа, с дробной частью (как у бота !osk и SkyHanni).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overflowLevel, skillLevel, round2 } from '../src/parse/leveling.js';

const TO_60 = 111_672_425; // весь опыт до 60 по таблице скиллов

test('до 60 overflow совпадает с таблицей', () => {
  assert.equal(overflowLevel('mining', 0).level, 0);
  assert.equal(overflowLevel('mining', TO_60).level, 60);
  assert.equal(overflowLevel('mining', TO_60 - 3_500_000).level, 59.5);
});

test('после 60: 7.6M за 61-й, дальше дороже на 600k, шаг удваивается на 70', () => {
  assert.equal(overflowLevel('mining', TO_60 + 7_600_000).level, 61);
  assert.equal(overflowLevel('mining', TO_60 + 7_600_000 + 8_200_000).level, 62);
  // 61…70: 7.6M + 8.2M + … + 13.0M = 103M; 71-й стоит 13.6M, 72-й — уже на 1.2M дороже
  const to70 = TO_60 + 103_000_000;
  assert.equal(overflowLevel('mining', to70).level, 70);
  assert.equal(overflowLevel('mining', to70 + 13_600_000).level, 71);
  assert.equal(overflowLevel('mining', to70 + 13_600_000 + 14_800_000).level, 72);
});

test('настоящий уровень не меняется, overflow — отдельным полем и только сверх капа', () => {
  const capped = skillLevel('farming', 300_000_000, 50);
  assert.equal(capped.level, 50);
  assert.equal(capped.maxLevel, 50);
  assert.equal(capped.overflow.level, 75.27);
  assert.equal(skillLevel('mining', 1_000_000).overflow, undefined);
  assert.equal(skillLevel('mining', TO_60).overflow, undefined); // ровно 60 — сверху ничего нет
});

test('дробь округляется до сотых, как у ботов', () => {
  assert.equal(round2(99.994), 99.99);
  assert.equal(round2(70.956), 70.96);
});

test('Runecrafting после 25 идёт по общей таблице до 60, потом как остальные', () => {
  const rc25 = overflowLevel('runecrafting', 0);
  assert.equal(rc25.level, 0);
  // Опыт за 60 Runecrafting = своя таблица 1–25 + общая 26–60; дальше 61-й снова стоит 7.6M
  let total = 0, lvl = 0;
  while (overflowLevel('runecrafting', total).level < 60 && lvl < 60) { total += overflowLevel('runecrafting', total).xpForNext; lvl++; }
  assert.equal(overflowLevel('runecrafting', total).level, 60);
  assert.equal(overflowLevel('runecrafting', total + 7_600_000).level, 61);
});
