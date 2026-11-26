import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillPetLore } from '../src/lib/pet-lore.js';

const petnums = { ENDER_DRAGON: { LEGENDARY: {
  1: { otherNums: [2, 0.5], statNums: { STRENGTH: 0.5, CRIT_DAMAGE: 0.5 } },
  100: { otherNums: [200, 50], statNums: { STRENGTH: 50, CRIT_DAMAGE: 50 } },
} } };

test('лор питомца: подстановка чисел для 100 уровня', () => {
  const r = fillPetLore('ENDER_DRAGON;4', '[Lvl {LVL}] Ender Dragon', ['§7Strength: §c+{STRENGTH}', '§7Deal §a{0}% §7more', '{UNKNOWN}'], petnums);
  assert.equal(r.name, '[Ур. 100] Ender Dragon');
  assert.deepEqual(r.lore, ['§7Strength: §c+50', '§7Deal §a200% §7more', '{UNKNOWN}']);
});

test('лор питомца: интерполяция между уровнями и не-питомцы', () => {
  const r = fillPetLore('ENDER_DRAGON;4', '[Lvl {LVL}] Ender Dragon', ['+{STRENGTH}'], petnums, 50);
  assert.equal(r.lore[0], '+25');
  assert.equal(r.name, '[Ур. 50] Ender Dragon');
  const plain = fillPetLore('HYPERION', 'Hyperion', ['+{0}'], petnums);
  assert.deepEqual(plain.lore, ['+{0}']);
  const noTable = fillPetLore('ROCK;4', '[Lvl {LVL}] Rock', ['+{0}'], petnums);
  assert.equal(noTable.lore[0], '+{0}');
});
