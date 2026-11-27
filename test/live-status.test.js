import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusOf, islandName, bingoOf, bingoEventOf, skyblockNewsOf } from '../src/lib/live-status.js';
import { createCached } from '../src/live.js';
import { setBingo, bingoEvents, bingoEvent } from '../src/calendar/index.js';

test('statusOf: остров SkyBlock, другая игра, не в сети', () => {
  assert.deepEqual(statusOf({ session: { online: true, gameType: 'SKYBLOCK', mode: 'foraging_2' } }, 1), { online: true, game: 'SKYBLOCK', mode: 'foraging_2', island: 'Galatea', at: 1 });
  assert.equal(statusOf({ session: { online: true, gameType: 'BEDWARS', mode: 'LOBBY' } }).island, null);
  assert.equal(statusOf({ session: { online: false } }).online, false);
  assert.equal(statusOf({}), null);
  assert.equal(islandName('dynamic'), 'Private Island');
  assert.equal(islandName('some_new_place'), 'Some New Place');
});

test('bingoOf: очки за все ивенты и нынешний ивент', () => {
  const ev = bingoEventOf({ id: 42, name: 'November', start: 1000, end: 2000, goals: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }] });
  assert.equal(ev.start, 1000 * 1000); // секунды → мс
  const b = bingoOf({ events: [{ key: 41, points: 100, completed_goals: [] }, { key: 42, points: 30, completed_goals: ['a', 'c'] }] }, ev);
  assert.deepEqual(b, { events: 2, points: 130, current: { id: 42, name: 'November', end: 2000000, points: 30, done: 2, total: 3 } });
  assert.equal(bingoOf({ events: [] }, ev), null);
  assert.equal(bingoOf({ events: [{ key: 1, points: 5 }] }, ev).current, null);
});

test('skyblockNewsOf: только https-ссылки, не больше max', () => {
  const r = skyblockNewsOf({ items: [
    { title: 'SkyBlock 0.23', text: '20th November 2026', link: 'https://hypixel.net/threads/1/', item: { material: 'NETHER_STAR' } },
    { title: 'bad', text: 'x', link: 'javascript:alert(1)' },
    { title: 'Two', text: 'y', link: 'https://hypixel.net/threads/2/' },
  ] }, 1);
  assert.deepEqual(r, [{ title: 'SkyBlock 0.23', date: '20th November 2026', link: 'https://hypixel.net/threads/1/', icon: 'NETHER_STAR' }]);
});

test('createCached: один запрос в срок, ошибка оставляет прошлый ответ', async () => {
  let t = 0, calls = 0, fail = false;
  const c = createCached(async k => { calls++; if (fail) throw new Error('x'); return `${k}${calls}`; }, 100, { now: () => t });
  assert.equal(await Promise.all([c.get('u'), c.get('u')]).then(r => r[0]), 'u1');
  assert.equal(await c.get('u'), 'u1');
  assert.equal(calls, 1);
  t = 150; fail = true;
  assert.equal(await c.get('u'), 'u1');
  assert.equal(calls, 2);
});

test('календарь: событие Bingo, пока ивент идёт', () => {
  const now = Date.now();
  setBingo({ id: 7, name: 'Test', start: now - 1000, end: now + 86400000, goals: [{ id: 'g', name: 'G' }] });
  assert.equal(bingoEvent().id, 7);
  const [e] = bingoEvents(now);
  assert.equal(e.name, 'Bingo: Test');
  assert.equal(bingoEvents(now + 2 * 86400000).length, 0);
});
