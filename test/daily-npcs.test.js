import test from 'node:test';
import assert from 'node:assert/strict';
import { FETCHUR, fetchurIndex, nyDay, fetchurRequest, fetchurPuzzlerDailies, fetchurPuzzlerSection } from '../src/analysis/daily-npcs.js';
import { dailiesOf } from '../src/analysis/dailies.js';

// 28.11.2026 07:00 UTC = 02:00 по Нью-Йорку, 28-е число
const NOW = Date.UTC(2026, 10, 28, 7, 0, 0);

test('Fetchur: 12 предметов, круг с 1-го числа (вики: 26.11 Compass, 27.11 Mithril)', () => {
  assert.equal(FETCHUR.length, 12);
  assert.equal(FETCHUR[fetchurIndex(1)].name, 'Yellow Stained Glass');
  assert.equal(FETCHUR[fetchurIndex(26)].name, 'Compass');
  assert.equal(FETCHUR[fetchurIndex(27)].name, 'Mithril');
  assert.equal(FETCHUR[fetchurIndex(13)].name, 'Yellow Stained Glass');
  assert.equal(FETCHUR[fetchurIndex(31)].name, 'Rabbit\'s Foot');
});

test('Fetchur: день по Нью-Йорку, а не по UTC', () => {
  assert.equal(nyDay(NOW), 28);
  assert.equal(nyDay(Date.UTC(2026, 10, 28, 4, 0, 0)), 27); // 23:00 27-го в Нью-Йорке
});

test('Fetchur: дешевле у NPC, чем на рынке; что уже есть у игрока', () => {
  const ctx = {
    items: null,
    buy: id => ({ CHEAP_COFFEE: 3000, DECENT_COFFEE: 2000 })[id] || 0,
    market: () => 'Bazaar',
  };
  // 5-е число — кофе
  const r = fetchurRequest({ inv: { sacks: { BLACK_COFFEE: 1 } } }, ctx, Date.UTC(2026, 10, 5, 12));
  assert.equal(r.n, 1);
  assert.equal(r.best.id, 'DECENT_COFFEE');
  assert.equal(r.total, 2000);
  assert.equal(r.have, 1);
  // Mithril без цен — подсказка «где добыть»
  const m = fetchurRequest({}, { noMarket: true }, Date.UTC(2026, 10, 3, 12));
  assert.match(m.best.where, /Dwarven Mines/);
});

test('Fetchur и Puzzler: только с доступом в Dwarven Mines, отметка — вручную', () => {
  assert.deepEqual(fetchurPuzzlerDailies({}, {}, NOW), []);
  const list = fetchurPuzzlerDailies({ mining: { hotm: { level: 3 } } }, {}, NOW);
  assert.deepEqual(list.map(i => i.id), ['fetchur', 'puzzler']);
  assert.ok(list.every(i => i.done === null && i.manual));
  assert.match(list[0].text, /Firework Rocket/);
  const d = dailiesOf({ mining: { hotm: { level: 3 } } }, NOW);
  assert.equal(d.total, 2);
  assert.equal(d.done, 0);
});

test('Гайд Mining: таблица Fetchur по числам месяца, сегодняшний ряд отмечен', () => {
  const s = fetchurPuzzlerSection({}, {}, NOW);
  assert.equal(s.rows.length, 12);
  assert.equal(s.rows[0][0].text, '1, 13, 25');
  assert.match(s.rows[3][0].text, /сегодня/);
  assert.equal(s.news, 'fetchur');
});
