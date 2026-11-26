// Бережём лимит ключа Hypixel: склейка одинаковых запросов, пауза после 429, учёт расхода, 429 без многочасового ожидания
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeyed } from '../src/hypixel.js';
import { createKeyUsage } from '../src/lib/key-usage.js';
import { getJson } from '../src/http.js';
import { state, ownerRefreshDue, markOwnerWatched, OWNER_IDLE_MS } from '../src/state.js';

const err429 = (cause, sec) => Object.assign(new Error(`HTTP 429: ${cause}`), { status: 429, retryAfterSec: sec, cause429: cause });

test('createKeyed: одинаковые запросы, пока первый летит, уходят один раз', async () => {
  let calls = 0, release;
  const usage = createKeyUsage();
  const k = createKeyed({ apiKey: () => 'k', usage, fetcher: () => { calls++; return new Promise(r => { release = r; }); } });
  const a = k.call('/skyblock/profiles?uuid=abc'), b = k.call('/skyblock/profiles?uuid=abc');
  await new Promise(r => setImmediate(r));
  release({ ok: true });
  assert.deepEqual(await a, { ok: true });
  assert.deepEqual(await b, { ok: true });
  assert.equal(calls, 1);
  assert.equal(usage.today().deduped, 1);
  const c = k.call('/skyblock/profiles?uuid=abc');
  await new Promise(r => setImmediate(r));
  release({});
  await c;
  assert.equal(calls, 2, 'после ответа следующий запрос уходит заново');
});

test('createKeyed: после суточного 429 ключ на паузе до сброса, запросы не уходят', async () => {
  let now = 1_000_000, calls = 0;
  const usage = createKeyUsage({ clock: () => now });
  const k = createKeyed({ apiKey: () => 'k', usage, clock: () => now, fetcher: async () => { calls++; throw err429('Daily developer key throttle', 34800); } });
  await assert.rejects(k.call('/skyblock/profiles?uuid=a'), e => e.code === 'RATE' && /суточный/.test(e.message) && e.limitedUntil === now + 34800_000);
  assert.equal(k.paused().daily, true);
  await assert.rejects(k.call('/skyblock/garden?profile=p'), e => e.code === 'RATE');
  assert.equal(calls, 1, 'на паузе в Hypixel больше не ходим');
  assert.equal(usage.today().limited, 1);
  now += 34801_000;
  assert.equal(k.paused(), null, 'после сброса пауза снята');
});

test('createKeyed: обычный 429 без срока — пауза 5 минут', async () => {
  const now = 0;
  const k = createKeyed({ apiKey: () => 'k', clock: () => now, fetcher: async () => { throw err429('Key throttle', 0); } });
  await assert.rejects(k.call('/player?uuid=a'), e => e.code === 'RATE');
  assert.equal(k.paused().until, 300_000);
  assert.equal(k.paused().daily, false);
});

test('createKeyed: расход делится на свой профиль и чужие, по видам запросов', async () => {
  const usage = createKeyUsage();
  const k = createKeyed({ apiKey: () => 'k', usage, fetcher: async () => ({}) });
  k.setOwner('aaaa-bbbb', 'prof1');
  await k.call('/skyblock/profiles?uuid=aaaabbbb');
  await k.call('/skyblock/garden?profile=prof1');
  await k.call('/skyblock/profiles?uuid=zzz');
  await k.call('/player?uuid=zzz');
  const t = usage.today();
  assert.equal(t.total, 4);
  assert.deepEqual(t.who, { own: 2, others: 2 });
  assert.deepEqual(t.kind, { profiles: 2, garden: 1, player: 1 });
  assert.equal(k.recent(), 4);
});

test('createKeyed: без ключа — ошибка NO_KEY', () => {
  const k = createKeyed({ apiKey: () => '' });
  assert.throws(() => k.call('/player?uuid=a'), e => e.code === 'NO_KEY');
});

test('getJson: 429 с долгим Retry-After не ждёт часами, а сразу отдаёт ошибку со сроком', async () => {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ success: false, cause: 'Daily developer key throttle' }), { status: 429, headers: { 'retry-after': '34800' } }); };
  try {
    const t0 = Date.now();
    await assert.rejects(getJson('https://api.hypixel.net/v2/skyblock/profiles?uuid=a'), e => e.status === 429 && e.retryAfterSec === 34800 && /Daily/.test(e.cause429));
    assert.ok(Date.now() - t0 < 2000);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = real; }
});

test('ownerRefreshDue: раз в минуту при зрителях, раз в 15 минут без них', () => {
  const saved = { status: state.status, updatedAt: state.updatedAt };
  try {
    const now = 10 * 3600_000;
    Object.assign(state, { status: 'ok', updatedAt: now - 70_000 });
    markOwnerWatched(0);
    assert.equal(ownerRefreshDue(now, { every: 60_000 }), false, 'никто не смотрит — минуты мало');
    markOwnerWatched(now - 10_000);
    assert.equal(ownerRefreshDue(now, { every: 60_000 }), true, 'вкладка открыта — раз в минуту');
    markOwnerWatched(0);
    state.updatedAt = now - OWNER_IDLE_MS - 1;
    assert.equal(ownerRefreshDue(now, { every: 60_000 }), true, 'без зрителей — раз в 15 минут');
    state.status = 'error'; state.updatedAt = now;
    assert.equal(ownerRefreshDue(now, { every: 60_000 }), true, 'прошлое обновление не удалось — пробуем');
  } finally { Object.assign(state, saved); }
});

test('createDiskCache: ответ переживает перезапуск, старый не отдаётся', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { createDiskCache } = await import('../src/lib/disk-cache.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-dc-'));
  let now = 1000;
  const a = createDiskCache({ dir, clock: () => now });
  await a.set('p_ABC', { profiles: [1] });
  const b = createDiskCache({ dir, clock: () => now }); // «после перезапуска»
  assert.deepEqual(b.get('p_abc', 60_000), { at: 1000, data: { profiles: [1] } });
  now += 120_000;
  assert.equal(b.get('p_abc', 60_000), null);
  assert.equal(b.get('нет'), null);
});

test('players: после перезапуска профиль с диска, без запроса в Hypixel', async () => {
  const { createPlayers } = await import('../src/players.js');
  const U = 'd'.repeat(32);
  const store = new Map([[`p_${U}`, { at: 1000, data: { profiles: [{ profile_id: 'x1', cute_name: 'Fig', selected: true, members: { [U]: {} } }] } }]]);
  let calls = 0;
  const players = createPlayers({
    owner: () => ({}), clock: () => 1000 + 60_000,
    diskCache: { get: k => store.get(k) || null, set: () => {} },
    api: { resolveUuid: async () => ({ uuid: U, name: 'Steve' }), getProfiles: async () => { calls++; return { profiles: [] }; }, getGarden: async () => ({}), getMuseum: async () => ({ members: {} }), keyedCallsRecent: () => 0 },
    parse: { parseMember: async (p, uuid) => ({ profileName: p.cute_name, uuid }), parseGarden: () => ({}) },
    analyze: () => ({}),
  });
  const v = await players.get({ player: 'Steve', profile: '' });
  assert.equal(v.member.profileName, 'Fig');
  assert.equal(calls, 0);
});

test('createKeyed: пауза после 429 переживает перезапуск сайта', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const pauseFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pause-')), 'p.json');
  let now = 5000, calls = 0;
  const a = createKeyed({ apiKey: () => 'k', clock: () => now, pauseFile, fetcher: async () => { throw err429('Daily developer key throttle', 3600); } });
  await assert.rejects(a.call('/skyblock/profiles?uuid=a'), e => e.code === 'RATE');
  const b = createKeyed({ apiKey: () => 'k', clock: () => now, pauseFile, fetcher: async () => { calls++; return {}; } });
  await assert.rejects(b.call('/skyblock/profiles?uuid=a'), e => e.code === 'RATE');
  assert.equal(calls, 0, 'после перезапуска в Hypixel не ходим до сброса');
  now += 3601_000;
  const c = createKeyed({ apiKey: () => 'k', clock: () => now, pauseFile, fetcher: async () => { calls++; return {}; } });
  await c.call('/skyblock/profiles?uuid=a');
  assert.equal(calls, 1);
});

test('players: Hypixel не отдал профиль — берём с диска ответ любой давности', async () => {
  const { createPlayers } = await import('../src/players.js');
  const U = 'e'.repeat(32);
  const store = new Map([[`p_${U}`, { at: 1, data: { profiles: [{ profile_id: 'x1', cute_name: 'Fig', selected: true, members: { [U]: {} } }] } }]]);
  const players = createPlayers({
    owner: () => ({}), clock: () => 10 * 3600_000,
    diskCache: { get: (k, maxAge = Infinity) => { const d = store.get(k); return d && 10 * 3600_000 - d.at <= maxAge ? d : null; }, set: () => {} },
    api: { resolveUuid: async () => ({ uuid: U, name: 'Steve' }), getProfiles: async () => { throw Object.assign(new Error('лимит'), { code: 'RATE' }); }, getGarden: async () => ({}), getMuseum: async () => ({ members: {} }), keyedCallsRecent: () => 0 },
    parse: { parseMember: async (p, uuid) => ({ profileName: p.cute_name, uuid }), parseGarden: () => ({}) },
    analyze: () => ({}),
  });
  const v = await players.get({ player: 'Steve', profile: '' });
  assert.equal(v.member.profileName, 'Fig');
});

test('ownerRefreshDue: на паузе ключа — только чтобы поднять профиль с диска после перезапуска', () => {
  const saved = { status: state.status, updatedAt: state.updatedAt, member: state.member };
  const paused = { until: Infinity, daily: true };
  try {
    Object.assign(state, { status: 'error', updatedAt: 0, member: null });
    assert.equal(ownerRefreshDue(10 * 3600_000, { every: 60_000, paused }), true, 'профиля нет — поднять с диска');
    Object.assign(state, { status: 'ok', updatedAt: 0, member: {} });
    assert.equal(ownerRefreshDue(10 * 3600_000, { every: 60_000, paused }), false, 'профиль есть — ждём сброса');
  } finally { Object.assign(state, saved); }
});
