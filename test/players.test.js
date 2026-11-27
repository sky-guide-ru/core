import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayers, readViewRequest } from '../src/players.js';
import { createLiveAdvisor, createMockClient } from '../src/live-advisor/index.js';

const OWNER = { uuid: 'a'.repeat(32), name: 'OwnerCat' };
const FRND = { uuid: 'b'.repeat(32), name: 'Friend4ik' };
const NIGHTO = { uuid: 'c'.repeat(32), name: 'Nightowl' };
const prof = (id, name, members, selected = false) => ({ profile_id: id, cute_name: name, selected, members: Object.fromEntries(members.map(u => [u, { profile: { last_save: 1 } }])) });
const ZUCCHINI = prof('m1', 'Zucchini', [OWNER.uuid, NIGHTO.uuid], true);

function setup({ budgetUsed = 0, ttlMs = 180_000, failNighto = false, guildFor } = {}) {
  let now = 1_000_000;
  const calls = { profiles: [], garden: 0, museum: 0, mojang: 0, session: 0 };
  const owner = { player: OWNER, member: { profileName: 'Zucchini', profileId: 'm1' }, raw: { resp: { profiles: [ZUCCHINI, prof('o2', 'Kiwi', [OWNER.uuid])] }, at: now, profileId: 'm1', garden: { level: 15 }, museum: { members: { [OWNER.uuid]: { value: 1 }, [NIGHTO.uuid]: { value: 2 } } } } };
  const players = createPlayers({
    owner: () => owner,
    clock: () => now,
    ttlMs,
    guildFor,
    api: {
      resolveUuid: async n => { calls.mojang++; const p = [FRND, NIGHTO].find(x => x.name.toLowerCase() === n.toLowerCase()); if (!p) { const e = new Error('nf'); e.status = 404; throw e; } return p; },
      resolveName: async uuid => { calls.session++; const p = [OWNER, FRND, NIGHTO].find(x => x.uuid === uuid); if (!p) { const e = new Error('nf'); e.status = 404; throw e; } return p; },
      getProfiles: async uuid => {
        calls.profiles.push(uuid);
        if (failNighto && uuid === NIGHTO.uuid) throw new Error('HTTP 502');
        if (uuid === FRND.uuid) return { profiles: [prof('p1', 'Pomegranate', [FRND.uuid]), prof('p2', 'Lime', [FRND.uuid], true)] };
        if (uuid === NIGHTO.uuid) return { profiles: [ZUCCHINI] };
        return { profiles: [] };
      },
      getGarden: async () => { calls.garden++; return {}; },
      getMuseum: async () => { calls.museum++; return { members: {} }; },
      keyedCallsRecent: () => budgetUsed + calls.profiles.length + calls.garden + calls.museum,
    },
    parse: {
      parseMember: async (p, uuid, extra) => ({ profileId: p.profile_id, profileName: p.cute_name, uuid, coopMembers: Object.keys(p.members).length, garden: extra.garden, museum: extra.museum }),
      parseGarden: () => ({ level: 3 }),
    },
    analyze: m => ({ roadmap: [{ id: 'x', title: `шаг для ${m.uuid.slice(0, 1)}` }] }),
  });
  return { players, calls, owner, tick: ms => { now += ms; } };
}

test('заголовки X-SB-Player/X-SB-Profile и query разбираются, пусто — свой профиль', () => {
  assert.equal(readViewRequest({ headers: {} }), null);
  assert.deepEqual(readViewRequest({ headers: { 'x-sb-player': 'Friend4ik', 'x-sb-profile': 'Pomegranate' } }), { player: 'Friend4ik', profile: 'Pomegranate' });
  assert.deepEqual(readViewRequest({ headers: {}, query: { player: 'Nightowl' } }), { player: 'Nightowl', profile: '' });
});

test('свой основной профиль остаётся за state.js, свой другой профиль — нет', () => {
  const { players } = setup();
  assert.equal(players.isOwner(null), true);
  assert.equal(players.isOwner({ player: 'ownercat', profile: '' }), true);
  assert.equal(players.isOwner({ player: 'OwnerCat', profile: 'zucchini' }), true);
  assert.equal(players.isOwner({ player: 'OwnerCat', profile: 'Kiwi' }), false);
  assert.equal(players.isOwner({ player: 'Friend4ik', profile: '' }), false);
});

test('друг с выбранным профилем: Pomegranate, хотя играет сейчас в Lime; список профилей для переключателя', async () => {
  const { players, calls } = setup();
  const v = await players.get({ player: 'friend4ik', profile: 'Pomegranate' });
  assert.equal(v.player.name, 'Friend4ik');
  assert.equal(v.member.profileName, 'Pomegranate');
  assert.equal(v.analysis.roadmap[0].title, 'шаг для b');
  assert.deepEqual(v.profiles.map(p => p.name), ['Pomegranate', 'Lime']);
  assert.equal(calls.profiles.length, 1);
  assert.equal(calls.garden, 1);
  // без профиля — тот, в котором играет
  const d = await players.get({ player: 'Friend4ik', profile: '' });
  assert.equal(d.member.profileName, 'Lime');
  assert.equal(calls.profiles.length, 1, 'список профилей один на игрока, второй запрос из кэша');
});

test('кооп-сосед по Zucchini: сад и музей берутся из ответа своего профиля, без лишних запросов', async () => {
  const { players, calls } = setup();
  const v = await players.get({ player: 'Nightowl', profile: 'Zucchini' });
  assert.equal(v.member.profileName, 'Zucchini');
  assert.equal(v.member.uuid, NIGHTO.uuid);
  assert.deepEqual(v.member.garden, { level: 15 });
  assert.deepEqual(v.member.museum, { value: 2 });
  assert.equal(calls.garden + calls.museum, 0);
});

test('свой другой профиль (Kiwi) — из сырого ответа основного обновления, ни одного запроса', async () => {
  const { players, calls } = setup();
  const v = await players.get({ player: 'OwnerCat', profile: 'Kiwi' });
  assert.equal(v.member.profileName, 'Kiwi');
  assert.equal(calls.profiles.length, 0);
  assert.equal(calls.mojang, 0);
});

test('кэш: пока свежо — без запросов; устарело — отдаёт старое сразу и обновляет в фоне', async () => {
  const { players, calls, tick } = setup();
  await players.get({ player: 'Friend4ik', profile: 'Pomegranate' });
  tick(60_000);
  await players.get({ player: 'Friend4ik', profile: 'Pomegranate' });
  assert.equal(calls.profiles.length, 1);
  tick(200_000);
  const v = await players.get({ player: 'Friend4ik', profile: 'Pomegranate' });
  assert.ok(v.member, 'старые данные отданы сразу');
  await v.loading;
  assert.equal(calls.profiles.length, 2);
});

test('лимит API: при исчерпанном запасе новый игрок не грузится, а уже открытый отдаётся из кэша', async () => {
  const s = setup();
  await s.players.get({ player: 'Friend4ik', profile: 'Pomegranate' });
  const busy = setup({ budgetUsed: 400 });
  await assert.rejects(busy.players.get({ player: 'Friend4ik', profile: '' }), /частоту запросов/);
});

test('гильдия: в профиле друга, новый запрос только при запасе лимита больше 10', async () => {
  const asked = [];
  const guildFor = async (uuid, { allowFetch }) => { asked.push(allowFetch); return { name: 'Skyblock Kings', tag: 'SBK' }; };
  const v = await setup({ guildFor }).players.get({ player: 'Friend4ik', profile: 'Pomegranate' });
  assert.equal(v.member.guild.tag, 'SBK');
  assert.deepEqual(asked, [true]);
  asked.length = 0;
  await setup({ guildFor, budgetUsed: 160 }).players.get({ player: 'Friend4ik', profile: 'Pomegranate' }).catch(() => {});
  assert.deepEqual(asked, [false]);
});

test('неизвестный ник и мусор в нике — понятная ошибка', async () => {
  const { players } = setup();
  await assert.rejects(players.get({ player: 'NoSuchGuy', profile: '' }), /не найден/);
  await assert.rejects(players.get({ player: 'bad name!', profile: '' }), /ника не бывает/);
});

test('советчик: вопрос про друга — его сводка, общий лимит, отдельная история чата', async () => {
  const client = createMockClient();
  const live = createLiveAdvisor({ client, dailyUsd: 1 });
  const member = { profileName: 'Pomegranate', skills: {}, slayers: {}, dungeons: { catacombs: { level: 10, progress: 0 }, classes: {} } };
  const e = await live.ask('что качать?', { view: { member, analysis: {}, name: 'Friend4ik', profile: 'Pomegranate' } });
  assert.equal(e.who, 'Friend4ik (Pomegranate)');
  const st = live.getState();
  assert.equal(st.chat.length, 1);
  assert.ok(st.budget.today.usd > 0, 'расход записан в общий дневной бюджет');
});

test('ник в русской раскладке: «щцтуксфе» открывает OwnerCat, «котик» — понятная ошибка про латиницу', async () => {
  const { fixNick } = await import('../src/players.js');
  assert.equal(fixNick('щцтуксфе'), 'ownercat');
  assert.equal(fixNick(' Kotik_228 '), 'Kotik_228');
  assert.equal(fixNick('ЛщеклЮ'), 'ЛщеклЮ', 'Ю даёт точку — это не ник, не трогаем');
  const { players, calls } = setup();
  assert.ok(players.isOwner({ player: 'щцтуксфе', profile: '' }), 'свой ник в русской раскладке — свой профиль');
  const v = await players.get({ player: 'АкшутвЧшл'.replace('Ч', '4'), profile: '' }); // Friend4ik в русской раскладке
  assert.equal(v.player.name, 'Friend4ik');
  await assert.rejects(players.get({ player: 'котик', profile: '' }), e => e.code === 'BAD_NAME' && /«котик» — не ник Minecraft/.test(e.message));
  assert.ok(calls.mojang >= 2);
});

test('невидимые символы из Discord в нике и несуществующий профиль', async () => {
  const { fixNick } = await import('../src/players.js');
  assert.equal(fixNick('\u200BFriend4ik\u00A0'), 'Friend4ik');
  const { players } = setup();
  const v = await players.get({ player: 'Friend4ik', profile: 'Nope' });
  assert.equal(v.member.profileName, 'Lime', 'показан основной профиль');
  assert.equal(v.missingProfile, 'Nope');
  const ok = await players.get({ player: 'Friend4ik', profile: 'pomegranate' });
  assert.equal(ok.missingProfile, null);
});

test('кооп-соседи: ники по uuid у Mojang, кэш на сутки, без запросов к Hypixel', async () => {
  const { players, calls } = setup();
  const member = { uuid: OWNER.uuid, profileName: 'Zucchini', profileId: 'm1', coopRoster: [{ uuid: OWNER.uuid, share: 0.7 }, { uuid: NIGHTO.uuid, share: 0.3 }, { uuid: 'd'.repeat(32), share: 0 }] };
  const r = await players.coopOf(member);
  assert.equal(r.profile, 'Zucchini');
  assert.equal(r.share, 0.7);
  assert.deepEqual(r.members.map(c => c.name), ['Nightowl', null], 'себя не показываем, неизвестный uuid — без ника');
  assert.equal(calls.profiles.length, 0);
  const before = calls.session;
  await players.coopOf(member);
  assert.equal(calls.session, before + 1, 'Nightowl из кэша, повторно спрашиваем только неизвестного');
});

test('кооп-соседа можно открыть по uuid', async () => {
  const { players } = setup();
  const v = await players.get({ player: NIGHTO.uuid, profile: 'Zucchini' });
  assert.equal(v.player.name, 'Nightowl');
  assert.equal(v.member.profileName, 'Zucchini');
});

test('кооп-сосед: Hypixel не ответил — общий остров берётся из своего свежего ответа', async () => {
  const { players } = setup({ failNighto: true });
  const v = await players.get({ player: 'Nightowl', profile: 'Zucchini' });
  assert.equal(v.member.profileName, 'Zucchini');
  assert.equal(v.member.uuid, NIGHTO.uuid);
});

test('кэш сырых ответов Hypixel не растёт с каждым новым ником', async () => {
  let now = 1_000_000;
  const players = createPlayers({
    owner: () => ({ player: OWNER, member: null, raw: null }),
    clock: () => now, maxRaw: 5, rawTtlMs: 3_600_000,
    api: {
      resolveUuid: async n => ({ uuid: n.toLowerCase().padEnd(32, '0'), name: n }),
      resolveName: async uuid => ({ uuid, name: 'x' }),
      getProfiles: async uuid => ({ profiles: [prof('p' + uuid, 'Apple', [uuid], true)] }),
      getGarden: async () => ({}), getMuseum: async () => ({ members: {} }), keyedCallsRecent: () => 0,
    },
    parse: { parseMember: async (p, uuid) => ({ profileId: p.profile_id, profileName: p.cute_name, uuid }), parseGarden: () => ({}) },
    analyze: () => ({ roadmap: [] }),
  });
  for (let i = 0; i < 20; i++) { await players.get({ player: `Steve${i}`, profile: '' }); now += 1000; }
  assert.ok(players.stats().rawProfiles <= 5, `в кэше ${players.stats().rawProfiles}`);
  assert.ok(players.stats().extras <= 5);
  now += 2 * 3_600_000;
  await players.get({ player: 'Alex', profile: '' });
  assert.equal(players.stats().rawProfiles, 1, 'старше часа — выкинуты');
});

test('вкладка в фоне (passive): кэш без обновления, видимая — обновляет устаревший', async () => {
  const { players, calls, tick } = setup();
  await players.get({ player: 'Friend4ik', profile: '' });
  assert.equal(calls.profiles.length, 1);
  tick(200_000);
  await players.get({ player: 'Friend4ik', profile: '' }, { passive: true });
  await new Promise(r => setImmediate(r));
  assert.equal(calls.profiles.length, 1, 'фоновая вкладка лимит не тратит');
  await players.get({ player: 'Friend4ik', profile: '' });
  await new Promise(r => setImmediate(r));
  assert.equal(calls.profiles.length, 2);
});

test('вкладка в фоне и профиля нет в памяти: без запросов в Hypixel, ошибка PASSIVE', async () => {
  const { players, calls } = setup();
  await assert.rejects(players.get({ player: 'Friend4ik', profile: '' }, { passive: true }), e => e.code === 'PASSIVE');
  assert.equal(calls.profiles.length, 0);
  assert.equal(players._views.size, 0);
});
