import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadmap } from '../src/advisor/index.js';
import { ownercatMember } from './fixtures/ownercat.js';

const ESS_HOT = { type: 'Crimson', 1: 170, 2: 190, 3: 215, 4: 240, 5: 270, 6: 300, 7: 340, 8: 390, 9: 440, 10: 500,
  items: { 4: ['SKYBLOCK_COIN:10000'], 5: ['SKYBLOCK_COIN:25000'], 6: ['SKYBLOCK_COIN:50000'], 7: ['SKYBLOCK_COIN:100000'], 8: ['SKYBLOCK_COIN:250000', 'HEAVY_PEARL:3'], 9: ['SKYBLOCK_COIN:500000', 'HEAVY_PEARL:4'], 10: ['SKYBLOCK_COIN:1000000', 'HEAVY_PEARL:5'] } };
const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const constants = { essencecosts: Object.fromEntries(SLOTS.map(s => [`HOT_CRIMSON_${s}`, ESS_HOT])) };

function member(stars) {
  const m = ownercatMember();
  m.crimson.barbarianRep = 3500; // открыт Burning
  m.inv.wardrobe = [...(m.inv.wardrobe || []), ...SLOTS.map((s, i) => ({ id: `HOT_CRIMSON_${s}`, name: `Hot Crimson ${s}`, rarity: 'LEGENDARY', stars: stars[i] }))];
  return m;
}
const step = (m, prices) => buildRoadmap(m, null, null, { price: id => prices[id] || 0, constants, itemName: id => id.toLowerCase() }).find(s => s.id === 'gear-kuudra-armor');
const norm = s => ({ ...s, how: s.how.map(l => l.replace(/[\u00a0\u202f]/g, ' ')) }); // ru-RU ставит неразрывные пробелы в числах

test('своя Hot Crimson: шаг «улучши свою» с точной ценой престижа и звёзд, сравнение с покупкой', () => {
  const prices = { ESSENCE_CRIMSON: 1000, KUUDRA_TEETH: 50_000, HEAVY_PEARL: 100_000, ...Object.fromEntries(SLOTS.map(s => [`BURNING_CRIMSON_${s}`, 40e6])), ...Object.fromEntries(SLOTS.map(s => [`HOT_CRIMSON_${s}`, 5e6])) };
  const s = norm(step(member([10, 10, 10, 10]), prices));
  assert.match(s.title, /Улучши свою броню Kuudra: Hot Crimson → Burning Crimson/);
  assert.ok(!/Aurora/.test(s.title), 'в заголовке только свой сет');
  // 10★ на всех частях — остаётся только престиж: 4 × (800 эссенции, 20 зубов, 5 млн)
  assert.equal(s.cost, 4 * (800 * 1000 + 20 * 50_000 + 5e6));
  assert.ok(s.how[0].includes('3 200 эссенции Crimson, 80 Kuudra Teeth'), s.how[0]);
  assert.ok(s.how.some(l => /престиж/.test(l) && /Blacksmith/.test(l)));
  assert.ok(s.how.some(l => /купить готовый Burning Crimson ~160/.test(l)), s.how.join('\n'));
  assert.ok(s.how.some(l => /пройти Kuudra Burning/.test(l)), 'требование, чтобы надеть');
  assert.equal(s.itemNames.KUUDRA_TEETH, 'kuudra_teeth');
});

test('звёзды до 10 входят в цену; если готовая броня намного дешевле — советуем купить', () => {
  const prices = { ESSENCE_CRIMSON: 1000, KUUDRA_TEETH: 50_000, HEAVY_PEARL: 100_000, BURNING_CRIMSON_HELMET: 1e6, BURNING_CRIMSON_CHESTPLATE: 1e6, BURNING_CRIMSON_LEGGINGS: 1e6, BURNING_CRIMSON_BOOTS: 1e6 };
  const s = norm(step(member([0, 7, 10, 10]), prices));
  assert.match(s.title, /выгоднее купить/);
  const helm = s.how.find(l => l.startsWith('шлем'));
  assert.match(helm, /звёзды 0→10 \(3 055 эссенции, 12 Heavy Pearl\)/);
});
