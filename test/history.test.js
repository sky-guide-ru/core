import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compactHistory, pushSnapshot, sliceRange, estimateBytes, createHistoryFiles, HOURLY_FOR } from '../src/history.js';
import { createPlayers } from '../src/players.js';
import { snapshot } from '../src/state.js';

const H = 3600_000, D = 24 * H;
const NOW = Date.UTC(2027, 10, 23, 12);

test('прореживание: 30 дней по часу, потом по дню, после года по неделе', () => {
  // Два года почасовых точек
  const pts = [];
  for (let t = NOW - 2 * 365 * D; t <= NOW; t += H) pts.push({ t, v: t });
  const out = compactHistory(pts, NOW);
  const hourly = out.filter(p => NOW - p.t <= HOURLY_FOR).length;
  const daily = out.filter(p => NOW - p.t > HOURLY_FOR && NOW - p.t <= 365 * D).length;
  const weekly = out.filter(p => NOW - p.t > 365 * D).length;
  assert.equal(hourly, 30 * 24 + 1);
  assert.ok(daily >= 334 && daily <= 336, `дневных ${daily}`);
  assert.ok(weekly >= 52 && weekly <= 54, `недельных ${weekly}`);
  assert.equal(out[out.length - 1].t, NOW, 'свежая точка на месте');
  // В дневной корзине остаётся последняя точка суток
  const d = out.find(p => NOW - p.t > 40 * D);
  assert.equal(new Date(d.t).getUTCHours(), 23);
  // Повторное прореживание ничего не меняет
  assert.deepEqual(compactHistory(out, NOW), out);
});

test('снимок пишется не чаще раза в час и не теряется порядок', () => {
  let h = [];
  h = pushSnapshot(h, { t: NOW }).history;
  const r1 = pushSnapshot(h, { t: NOW + 30 * 60_000 });
  assert.equal(r1.added, false);
  const r2 = pushSnapshot(h, { t: NOW + H });
  assert.equal(r2.added, true);
  assert.deepEqual(r2.history.map(p => p.t), [NOW, NOW + H]);
});

test('окно: точки за период плюс одна опорная до него', () => {
  const pts = [0, 1, 2, 3, 4].map(i => ({ t: NOW - (4 - i) * D }));
  assert.deepEqual(sliceRange(pts, 2 * D, NOW).map(p => p.t), [NOW - 3 * D, NOW - 2 * D, NOW - D, NOW]);
  assert.equal(sliceRange(pts, 0, NOW).length, 5);
  assert.equal(sliceRange([{ t: NOW - 10 * D }], D, NOW).length, 1);
});

test('оценка места: ~0,85 МБ за первый год, дальше ~40 КБ в год', () => {
  assert.ok(estimateBytes(1) < 900_000 && estimateBytes(1) > 800_000);
  assert.ok(estimateBytes(5) - estimateBytes(4) < 45_000);
});

test('снимок: новые показатели для графиков, старые поля на месте', () => {
  const m = {
    sbLevel: 120.5, magicalPower: 900, bank: 5e6, purse: 1e5,
    skills: { farming: { xp: 1234.6 } }, slayers: { zombie: { xp: 5000 } },
    dungeons: { catacombs: { level: 30, progress: 0.25 }, classes: { mage: { level: 25, progress: 0.5 } }, secrets: 900, floors: { 1: 10, 7: 5 }, masterFloors: { 1: 2 } },
    mining: { hotm: { level: 7, progress: 0.1 }, powder: { mithril: 1e6, gemstone: 2e6, glacite: 0 } },
    crimson: { kuudra: { basic: 3, hot: 2 }, barbarianRep: 100, mageRep: 3000, trophyFish: { total_caught: 77 } },
    leveling: { petScore: 150, tasksDone: 300 }, pets: [1, 2], fairySouls: { collected: 200 },
    museum: { status: 'off' }, bestiaryMilestone: 12, hotfXp: null,
  };
  const s = snapshot(m, { networth: { total: 1e8, coins: 5.1e6, items: 9.49e7 } });
  assert.equal(s.cata, 30.25);
  assert.deepEqual(s.skills, { farming: 1235 });
  assert.equal(s.classes.mage, 25.5);
  assert.equal(s.floors, 17);
  assert.equal(s.hotm, 7.1);
  assert.equal(s.kuudra, 5);
  assert.equal(s.rep, 3000);
  assert.equal(s.trophy, 77);
  assert.equal(s.powder.glacite, 0, 'ноль — тоже точка');
  assert.equal('museum' in s, false, 'музей выключен — поля нет');
  assert.equal('hotfXp' in s, false);
  assert.ok(JSON.stringify(s).length < 900);
});

test('история друга с аккаунтом пишется на диск раз в час, случайного ника — нет', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  const files = createHistoryFiles(dir);
  let now = NOW;
  const FR = { uuid: 'b'.repeat(32), name: 'Friend4ik' }, RND = { uuid: 'd'.repeat(32), name: 'Random' };
  const prof = (id, u) => ({ profile_id: id, cute_name: 'Pomegranate', selected: true, members: { [u]: {} } });
  let xp = 0;
  const players = createPlayers({
    owner: () => ({ player: { uuid: 'a'.repeat(32), name: 'OwnerCat' } }),
    clock: () => now, ttlMs: 0,
    keepHistory: n => n === 'Friend4ik', historyFiles: files,
    snapshot: () => ({ t: 0, skills: { farming: (xp += 100) }, slayers: {} }),
    api: {
      resolveUuid: async n => [FR, RND].find(p => p.name.toLowerCase() === n.toLowerCase()),
      getProfiles: async u => ({ profiles: [prof(u === FR.uuid ? 'p1' : 'p9', u)] }),
      getGarden: async () => ({}), getMuseum: async () => ({ members: {} }), keyedCallsRecent: () => 0,
    },
    parse: { parseMember: async (p, uuid) => ({ uuid, profileId: p.profile_id }), parseGarden: () => ({}) },
    analyze: () => ({ gear: {} }),
  });
  await players.get({ player: 'Friend4ik', profile: '' });
  now += 10 * 60_000; await players.get({ player: 'Friend4ik', profile: '' }, { force: true });
  now += H; await players.get({ player: 'Friend4ik', profile: '' }, { force: true });
  await players.get({ player: 'Random', profile: '' });
  const saved = files.load(`${FR.uuid}_p1`);
  assert.equal(saved.length, 2, 'вторая загрузка через 10 минут в историю не попала');
  assert.deepEqual(fs.readdirSync(dir), [`${FR.uuid}_p1.json`]);
  assert.ok(files.size().bytes > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
