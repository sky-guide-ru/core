// Объявления событий SkyBlock для Discord: что и когда пора отправить, культуры Jacob
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dueAnnouncements, ROLES } from '../src/calendar/announce.js';
import { setFireSales } from '../src/calendar/index.js';
import { yearlyIn, electionWindow } from '../src/calendar/events.js';
import { sbDate } from '../src/calendar/time.js';
import { parseContests, cropName, createJacobCrops } from '../src/calendar/jacob.js';

const RAW = JSON.parse(fs.readFileSync(new URL('./fixtures/election.json', import.meta.url), 'utf8'));
const at = s => Date.parse(s);
const only = (list, role) => list.filter(a => a.role === role);

test('Jacob за 5 минут до :15, Dark Auction за 5 минут до :55; после старта — уже нет', () => {
  const crops = new Map([[at('2026-11-27T08:15:00Z'), ['Wheat', 'Cactus', 'Melon']]]);
  const j = only(dueAnnouncements(at('2026-11-27T08:11:00Z'), { election: null, sales: [], cropsAt: s => crops.get(s) }), 'jacob');
  assert.equal(j.length, 1);
  assert.equal(j[0].start, at('2026-11-27T08:15:00Z'));
  assert.deepEqual(j[0].crops, ['Wheat', 'Cactus', 'Melon']);
  assert.equal(only(dueAnnouncements(at('2026-11-27T08:09:00Z'), { election: null, sales: [] }), 'jacob').length, 0, 'рано');
  assert.equal(only(dueAnnouncements(at('2026-11-27T08:15:30Z'), { election: null, sales: [] }), 'jacob').length, 0, 'уже идёт');
  const da = only(dueAnnouncements(at('2026-11-27T08:52:00Z'), { election: null, sales: [] }), 'darkauction');
  assert.equal(da.length, 1);
  assert.equal(new Date(da[0].start).getUTCMinutes(), 55);
  for (const a of dueAnnouncements(at('2026-11-27T08:52:00Z'), { election: RAW, sales: [] })) assert.ok(ROLES.includes(a.role), a.role);
});

test('большое событие года — за 10 минут и ещё полчаса после старта', () => {
  const now = at('2026-11-27T08:00:00Z');
  const spooky = yearlyIn(sbDate(now).year + 1).find(e => e.id === 'spooky');
  const get = t => only(dueAnnouncements(t, { election: null, sales: [] }), 'events').filter(a => a.key === `spooky:${spooky.start}`);
  assert.equal(get(spooky.start - 11 * 60_000).length, 0);
  assert.equal(get(spooky.start - 9 * 60_000).length, 1);
  assert.equal(get(spooky.start + 20 * 60_000).length, 1);
  assert.equal(get(spooky.start + 31 * 60_000).length, 0);
  assert.equal(get(spooky.start - 9 * 60_000)[0].title, 'Spooky Festival');
});

test('мэр и министр — одно объявление на выборы; открытие выборов', () => {
  const m = only(dueAnnouncements(at('2026-11-23T10:00:00Z'), { election: RAW, sales: [] }), 'mayor').find(a => a.key.startsWith('mayor:'));
  assert.equal(m.key, `mayor:${RAW.mayor.election.year}:diana`);
  assert.equal(m.title, 'Mayor Diana');
  assert.ok(m.perks.some(p => p.name === 'Mythological Ritual' && p.ru));
  assert.equal(m.minister.name, 'Marina');
  assert.equal(m.minister.perk.name, 'Fishing Festival');
  const w = electionWindow(at('2026-11-23T10:00:00Z'));
  const opens = w.open ? electionWindow(w.closes + 1).opens : w.opens;
  const e = dueAnnouncements(opens + 60_000, { election: null, sales: [] }).find(a => a.key === `election-open:${opens}`);
  assert.ok(e, 'открытие выборов');
  assert.equal(dueAnnouncements(opens + 4 * 3600_000, { election: null, sales: [] }).some(a => a.key.startsWith('election-open')), false);
});

test('Fire Sale — с момента, как Hypixel объявил, до конца распродажи', () => {
  const now = at('2026-11-27T08:00:00Z');
  setFireSales({ sales: [{ item_id: 'PET_SKIN_X', start: now + 86400_000, end: now + 3 * 86400_000, amount: 5000, price: 650 }] }, () => 'X Skin');
  const f = only(dueAnnouncements(now, { election: null }), 'firesale');
  assert.equal(f.length, 1);
  assert.equal(f[0].title, 'Fire Sale: X Skin');
  assert.deepEqual(f[0].sale, { item: 'PET_SKIN_X', amount: 5000, price: 650 });
  assert.equal(only(dueAnnouncements(now + 4 * 86400_000, { election: null }), 'firesale').length, 0);
  setFireSales({ sales: [] });
});

test('культуры Jacob: разбор ответа и редкие запросы', async () => {
  assert.equal(cropName('SUGAR_CANE'), 'Sugar Cane');
  assert.equal(cropName('NETHER_STALK'), 'Nether Wart');
  assert.equal(cropName('cocoa beans'), 'Cocoa Beans');
  const m = parseContests({ contests: { 1795767300: ['WHEAT', 'CACTUS', 'MELON'], bad: ['x'], 1795770900000: ['Potato'] } });
  assert.deepEqual(m.get(1795767300000), ['Wheat', 'Cactus', 'Melon']);
  assert.deepEqual(m.get(1795770900000), ['Potato']);
  assert.equal(parseContests(null).size, 0);

  let t = 1795767000000, calls = 0;
  const jc = createJacobCrops({ now: () => t, fetchJson: async () => { calls++; return { complete: true, contests: { [(t + 300_000) / 1000]: ['Wheat'], [(t + 30 * 3600_000) / 1000]: ['Melon'] } }; } });
  assert.equal(await jc.refresh(), true);
  assert.deepEqual(jc.cropsAt(t + 300_000), ['Wheat']);
  assert.equal(await jc.refresh(), false);
  t += 2 * 3600_000;
  assert.equal(await jc.refresh(), false, 'расписание полное и не кончается — не спрашиваем');
  assert.equal(calls, 1);
  const bad = createJacobCrops({ now: () => t, fetchJson: async () => { throw new Error('нет сети'); } });
  assert.equal(await bad.refresh(), false);
  assert.equal(bad.cropsAt(t), null);
});
