// Пассив, мэры и ежедневка в «Заработке» (Q5): Inferno-миньоны, Matriarch, Stonks, банк, множители мэров.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyMethods } from '../src/market/methods.js';
import { infernoPlan, infernoTier, bankInterest, INFERNO_SPEED } from '../src/market/methods-passive.js';
import { mayorBoost, mayorNoteText } from '../src/market/mayor-boost.js';
import { METHOD_DETAILS } from '../src/market/method-details.js';

const NOW = 1_800_000_000_000;
const bz = (buy, sell, week = 1e7) => ({ buy, sell, buyWeek: week, sellWeek: week });
const member = (extra = {}) => ({ purse: 0, bank: 20_000_000, skills: { combat: { level: 30 } }, slayers: { blaze: { level: 4 } }, dungeons: {}, mining: {}, inv: {}, pets: [], minions: [], ...extra });
const market = (over = {}) => ({
  items: new Map(), bin: new Map(), now: NOW, tax: 0.01125,
  bazaar: new Map(Object.entries({
    INFERNO_HYPERGOLIC_CRUDE_GABAGOOL: bz(3_000_000, 2_900_000),
    INFERNO_HEAVY_CRUDE_GABAGOOL: bz(1_000_000, 950_000),
    INFERNO_FUEL_CRUDE_GABAGOOL: bz(300_000, 290_000),
    CRUDE_GABAGOOL: bz(100, 95),
    CHILI_PEPPER: bz(60_000, 58_000),
    INFERNO_VERTEX: bz(10_000_000, 9_500_000),
    REAPER_PEPPER: bz(20_000_000, 19_000_000),
    INFERNO_APEX: bz(500_000_000, 480_000_000),
    HEAVY_PEARL: bz(200_000, 190_000),
    STOCK_OF_STONKS: bz(5_000_000, 4_800_000),
    ...over,
  })),
});

test('тир Inferno-миньона берётся из скрафченных', () => {
  assert.equal(infernoTier({ minions: ['WHEAT_1', 'INFERNO_3', 'INFERNO_7', 'BLAZE_1'] }), 7);
  assert.equal(infernoTier({}), 0);
});

test('Inferno-миньоны: скорость из NEU, 10 миньонов, топливо вычитается', () => {
  const [best, ...rest] = infernoPlan(market(), { tier: 10 });
  assert.equal(best.fuel.grade, 'Hypergolic');
  // 728 с / ((1 + 1.8) × 20) = 13 с на действие → сбор раз в 26 с → ≈3323 сбора в сутки
  assert.ok(Math.abs(best.harvests - 86400 / (2 * INFERNO_SPEED[10] / 56)) < 1);
  assert.ok(best.parts.some(p => p.id === 'CHILI_PEPPER'));
  assert.equal(best.perDay, best.perMinionDay * 10);
  assert.ok(best.steadyPerDay < best.perDay, 'без Inferno Apex меньше');
  assert.ok(rest.every(r => !r.parts.some(p => p.id === 'CHILI_PEPPER')), 'обычное топливо редкого не даёт');
});

test('если топливо дороже добычи — метод не обещает доход', () => {
  const ctx = market({ INFERNO_HYPERGOLIC_CRUDE_GABAGOOL: bz(900_000_000, 890_000_000), INFERNO_HEAVY_CRUDE_GABAGOOL: bz(9e8, 9e8), INFERNO_FUEL_CRUDE_GABAGOOL: bz(9e8, 9e8) });
  const mt = moneyMethods(member({ minions: ['INFERNO_10'] }), ctx, {}).find(x => x.id === 'inferno-minions');
  assert.equal(mt.coinsPerHour, null);
  assert.match(mt.detail, /минус/);
});

test('новые методы есть в выдаче, с разбором и требованиями', () => {
  const list = moneyMethods(member({ minions: ['INFERNO_10'] }), market(), { mayor: 'Diaz', perks: ['Stock Exchange'] });
  for (const id of ['inferno-minions', 'matriarch', 'stonks', 'bank-interest']) {
    const mt = list.find(x => x.id === id);
    assert.ok(mt, id);
    assert.ok(METHOD_DETAILS[id]?.steps?.length >= 2 && METHOD_DETAILS[id]?.risks?.length >= 1, `разбор ${id}`);
  }
  const inf = list.find(x => x.id === 'inferno-minions');
  assert.ok(inf.coinsPerHour > 0 && inf.coinsPerHourRange, 'доход и диапазон');
  assert.equal(list.find(x => x.id === 'stonks').available, true, 'Diaz со Stock Exchange — доступно');
  assert.match(list.find(x => x.id === 'matriarch').detail, /Heavy Pearl/);
});

test('Stonks без перка закрыт, без данных о мэре — «неизвестно»', () => {
  const off = moneyMethods(member(), market(), { mayor: 'Paul', perks: ['EZPZ'] }).find(x => x.id === 'stonks');
  assert.equal(off.available, false);
  const unk = moneyMethods(member(), market(), {}).find(x => x.id === 'stonks');
  assert.equal(unk.unknownReq, true);
});

test('проценты банка падают по ступеням', () => {
  assert.equal(bankInterest(10_000_000), 200_000);
  assert.equal(bankInterest(20_000_000), 300_000);
  assert.ok(bankInterest(1e9) < 1e9 * 0.002);
});

test('перки мэра меняют доход методов по id и по тегу', () => {
  assert.equal(mayorBoost({ id: 'slayer-zombie', tag: 'Slayers' }, ['Pathfinder', 'SLASHED Pricing']).factor, 1.16);
  assert.equal(mayorBoost({ id: 'x', tag: 'Миньоны' }, ['TURBO MINIONS!!!']).factor, 2);
  assert.equal(mayorBoost({ id: 'farming', tag: 'Farming' }, ['Pathfinder']), null);
  assert.match(mayorNoteText(mayorBoost({ id: 'forge', tag: 'Mining' }, ['Molten Forge'])), /Cole.*\+25%/);
  const base = moneyMethods(member(), market(), {}).find(x => x.id === 'slayer-zombie');
  const aatrox = moneyMethods(member(), market(), { mayor: 'Aatrox', perks: ['Pathfinder'] }).find(x => x.id === 'slayer-zombie');
  assert.ok(Math.abs(aatrox.coinsPerHour - base.coinsPerHour * 1.1) < 1);
  assert.match(aatrox.mayorNote, /Aatrox/);
  assert.equal(base.mayorNote, null);
  const derpy = moneyMethods(member({ minions: ['INFERNO_10'] }), market(), { perks: ['TURBO MINIONS!!!'] }).find(x => x.id === 'inferno-minions');
  const plain = moneyMethods(member({ minions: ['INFERNO_10'] }), market(), {}).find(x => x.id === 'inferno-minions');
  // добычи вдвое больше, а топливо стоит столько же: прибыль растёт больше чем вдвое, но меньше чем «доход ×2 и ещё ×2»
  assert.ok(derpy.coinsPerHour > plain.coinsPerHour * 2, 'прибыль больше чем вдвое');
  assert.ok(derpy.coinsPerHour < plain.coinsPerHour * 4, 'множитель не применён дважды');
  assert.match(derpy.mayorNote, /Derpy/);
});

test('Apex Minion: тир X и XI дают два Apex, Farming Simulator дохода не меняет (ревью #174)', () => {
  const apex = t => infernoPlan(market(), { tier: t })[0].parts.find(p => p.id === 'INFERNO_APEX').n;
  assert.ok(apex(10) > apex(9) * 1.9);
  assert.equal(mayorBoost({ id: 'farming', tag: 'Farming' }, ['Farming Simulator']).factor, 1);
});

test('данные с вики: Chili 1/136, Vertex 1/5950, банк до 55 млрд, сброс Matriarch в 20:00 ET', async () => {
  const { INFERNO_RARE, matriarchReset } = await import('../src/market/methods-passive.js');
  assert.equal(INFERNO_RARE.find(r => r.id === 'CHILI_PEPPER').chance, 1 / 136);
  assert.equal(INFERNO_RARE.find(r => r.id === 'INFERNO_VERTEX').chance, 1 / 5950);
  assert.equal(new Date(matriarchReset(Date.UTC(2026, 10, 23, 15))).toISOString(), '2026-11-24T01:00:00.000Z');
  assert.equal(new Date(matriarchReset(Date.UTC(2026, 10, 24, 0, 30))).toISOString(), '2026-11-24T01:00:00.000Z');
  // переходы на летнее время (ревью #181): 8 марта и 1 ноября 2026
  assert.equal(new Date(matriarchReset(Date.UTC(2026, 2, 2, 12))).toISOString(), '2026-03-03T01:00:00.000Z');
  assert.equal(new Date(matriarchReset(Date.UTC(2026, 2, 9, 12))).toISOString(), '2026-03-10T00:00:00.000Z');
  assert.equal(new Date(matriarchReset(Date.UTC(2026, 10, 1, 0, 30))).toISOString(), '2026-11-02T01:00:00.000Z');
  assert.equal(new Date(matriarchReset(Date.UTC(2026, 6, 1, 23, 59))).toISOString(), '2026-07-02T00:00:00.000Z');
  const off = moneyMethods(member(), market(), { mayor: 'Diaz' }).find(x => x.id === 'stonks');
  assert.equal(off.available, true, 'при Diaz аукцион Richard открыт и без данных о перках');
});
