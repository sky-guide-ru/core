import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGuilds, parseGuild, guildLevel } from '../src/guild.js';

const U = '0123456789abcdef0123456789abcdef';
const RESP = { guild: { name: 'Skyblock Kings', tag: 'SBK', tagColor: 'DARK_AQUA', exp: 250e3, members: [{ uuid: U, rank: 'GUILDMASTER', joined: 1700000000000 }, { uuid: 'x', rank: 'Member' }] } };

test('гильдия: только нужные поля, без списка участников', () => {
  const g = parseGuild(RESP.guild, U);
  assert.deepEqual(g, { name: 'Skyblock Kings', tag: 'SBK', tagColor: 'DARK_AQUA', rank: 'Guild Master', joined: 1700000000000, members: 2, level: 2 });
  assert.equal(parseGuild(null, U), null);
});

test('уровень гильдии по опыту', () => {
  assert.equal(guildLevel(0), 0);
  assert.equal(guildLevel(99_999), 0);
  assert.equal(guildLevel(100e3), 1);
  // 15 уровней по таблице = 23 млн, дальше по 3 млн
  assert.equal(guildLevel(23e6 - 1), 14);
  assert.equal(guildLevel(23e6), 15);
  assert.equal(guildLevel(23e6 + 3e6 * 10), 25);
});

test('гильдия: один запрос в час, склейка одновременных, без запроса на исходе лимита', async () => {
  let t = 0, calls = 0;
  const g = createGuilds({ now: () => t, fetcher: async () => { calls++; return RESP; } });
  const [a, b] = await Promise.all([g.guildFor(U), g.guildFor(U)]);
  assert.equal(calls, 1);
  assert.equal(a.tag, 'SBK'); assert.equal(b.tag, 'SBK');
  t = 59 * 60_000; await g.guildFor(U); assert.equal(calls, 1);
  t = 61 * 60_000;
  assert.equal((await g.guildFor(U, { allowFetch: false })).tag, 'SBK', 'устаревшая запись лучше пустоты');
  assert.equal(calls, 1);
  await g.guildFor(U); assert.equal(calls, 2);
  assert.equal(await g.guildFor('ffffffffffffffffffffffffffffffff', { allowFetch: false }), null);
  assert.equal(calls, 2);
});

test('гильдия: игрок без гильдии тоже хранится час, ошибка — повтор через 10 минут', async () => {
  let t = 0, calls = 0, fail = false;
  const g = createGuilds({ now: () => t, fetcher: async () => { calls++; if (fail) throw new Error('429'); return { guild: null }; } });
  assert.equal(await g.guildFor(U), null);
  t = 30 * 60_000; await g.guildFor(U); assert.equal(calls, 1);
  t = 61 * 60_000; fail = true; await g.guildFor(U); assert.equal(calls, 2);
  t += 5 * 60_000; await g.guildFor(U); assert.equal(calls, 2);
  t += 6 * 60_000; await g.guildFor(U); assert.equal(calls, 3);
});

test('гильдия: peekGuild отдаёт известное без запроса', async () => {
  let calls = 0;
  const g = createGuilds({ now: () => 0, fetcher: async uuid => { calls++; return uuid === U ? RESP : { guild: null }; } });
  assert.equal(g.peekGuild(U), undefined);
  await g.guildFor(U); await g.guildFor('f'.repeat(32));
  assert.equal(g.peekGuild(U).name, 'Skyblock Kings');
  assert.equal(g.peekGuild('f'.repeat(32)), null);
  assert.equal(calls, 2);
});
