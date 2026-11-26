// Календарь SkyBlock, мэр и выборы (server/calendar), их след в советчике и гайд по Diana.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sbDate, sbStart, DAY, YEAR } from '../src/calendar/time.js';
import { hourlyNext, electionWindow, nextTermChange, perkEvents, yearlyIn } from '../src/calendar/events.js';
import { setElection, calendarView, calendarBrief, briefLines, spansInYear, activePerks } from '../src/calendar/index.js';
import { mayorView } from '../src/calendar/mayors.js';
import { makeSnapshot, diffSnapshots } from '../src/live-advisor/lib/watcher.js';
import { buildDigest } from '../src/live-advisor/lib/digest.js';
import diana from '../src/guides/diana.js';

const RAW = JSON.parse(fs.readFileSync(new URL('./fixtures/election.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-23T10:00:00Z');

test('дата SkyBlock: первый день и известные точки', () => {
  assert.deepEqual(sbDate(sbStart(1, 0, 1)), { year: 1, month: 0, day: 1, hour: 0, minute: 0, dayOfYear: 1, monthEn: 'Early Spring', monthRu: 'Ранняя весна' });
  const d = sbDate(NOW);
  assert.equal(d.year, 527);
  assert.equal(d.monthEn, 'Early Winter');
  assert.equal(d.day, 10);
  assert.equal(sbDate(sbStart(527, 11, 31) + DAY).year, 528, 'после 31 Late Winter начинается новый год');
});

test('Jacob в :15, Dark Auction в :55 по реальным часам', () => {
  const ev = hourlyNext(NOW, 2);
  const jacob = ev.filter(e => e.id === 'jacob');
  const da = ev.filter(e => e.id === 'darkauction');
  assert.equal(new Date(jacob[0].start).getUTCMinutes(), 15);
  assert.equal(jacob[1].start - jacob[0].start, 3600_000);
  assert.equal(jacob[0].end - jacob[0].start, 20 * 60_000);
  assert.equal(new Date(da[0].start).getUTCMinutes(), 55);
  assert.ok(jacob[0].start > NOW && jacob[0].start - NOW <= 3600_000);
});

test('выборы: 27 Late Summer → 27 Late Spring, мэр меняется 27 Late Spring', () => {
  const t = nextTermChange(NOW);
  assert.ok(t > NOW);
  const d = sbDate(t);
  assert.equal(d.monthEn, 'Late Spring'); assert.equal(d.day, 27);
  const w = electionWindow(NOW);
  assert.equal(w.closes, t);
  const o = sbDate(w.opens);
  assert.equal(o.monthEn, 'Late Summer'); assert.equal(o.day, 27);
  assert.equal(o.year, d.year - 1);
  assert.equal(w.open, true, 'в Early Winter выборы уже идут');
});

test('годовые события на своих днях', () => {
  const y = yearlyIn(527);
  // Spooky Festival — Autumn 29–31 (месяц 7, fandom «Spooky Festival»), а не Late Autumn
  const spooky = y.find(e => e.id === 'spooky');
  assert.deepEqual(spooky.spans, [[7, 29, 31]]);
  assert.equal(spooky.end - spooky.start, 3 * DAY);
  const hop = y.find(e => e.id === 'hoppity');
  assert.equal(hop.end - hop.start, 93 * DAY, 'Hoppity — вся весна, 3 месяца');
});

test('перки → события: Mythological Ritual весь срок, Fishing Festival 1–3 числа', () => {
  const end = nextTermChange(NOW), start = end - YEAR;
  const ev = perkEvents(['Mythological Ritual', 'Fishing Festival', 'Lucky!'], start, end);
  const ritual = ev.filter(e => e.id === 'ritual');
  assert.equal(ritual.length, 1);
  assert.equal(ritual[0].end - ritual[0].start, YEAR);
  const ff = ev.filter(e => e.id === 'fishfest');
  assert.ok(ff.length >= 11 && ff.length <= 13);
  for (const e of ff) { const d = sbDate(e.start); assert.ok(d.day >= 1 && d.day <= 3); assert.ok(e.end - e.start <= 3 * DAY); }
});

test('отрезки по месяцам для сетки года', () => {
  assert.deepEqual(spansInYear(sbStart(527, 1, 30), sbStart(527, 2, 3), 527), [[1, 30, 31], [2, 1, 2]]);
  assert.deepEqual(spansInYear(sbStart(528, 0, 1), sbStart(528, 0, 2), 527), []);
});

test('мэр: русские перки и запасной английский текст без кодов', () => {
  const v = mayorView(RAW.current.candidates[1]);
  assert.equal(v.name, 'Aatrox');
  assert.equal(v.perks[0].ru, '+25% опыта слееров.');
  assert.equal(v.perks[1].ru, null);
  assert.equal(v.perks[1].en, 'Something new');
  assert.equal(mayorView(null), null);
});

test('calendarView и calendarBrief по данным выборов', () => {
  setElection(RAW, NOW);
  assert.deepEqual(activePerks(), ['Lucky!', 'Mythological Ritual', 'Pet XP Buff', 'Fishing Festival']);
  const v = calendarView(NOW);
  assert.equal(v.mayor.name, 'Diana');
  assert.equal(v.minister.name, 'Marina');
  assert.equal(v.minister.perk.name, 'Fishing Festival');
  assert.equal(v.election.open, true);
  assert.equal(v.election.candidates[0].name, 'Paul');
  assert.equal(v.election.candidates[0].pct, 61);
  assert.ok(v.active.some(e => e.id === 'ritual'));
  const ids = v.upcoming.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length, 'каждое событие в «Скоро» — один раз');
  assert.ok(ids.includes('jacob') && ids.includes('darkauction'));
  assert.equal(v.grid.year, 527);
  assert.ok(v.grid.wholeTerm.some(b => b.id === 'ritual'), 'ритуал на весь срок — строкой, не клетками');
  assert.ok(!v.grid.bars.some(b => b.id === 'ritual' || b.id === 'election'));
  assert.ok(v.grid.bars.some(b => b.id === 'fishfest'));
  assert.equal(v.mayor.perks[1].title, 'Мифологический ритуал');
  assert.ok(calendarView(NOW, { year: 528 }).grid.year === 528);
  assert.equal(calendarView(NOW, { year: 999 }).grid.year, 527, 'чужой год — текущий');

  const lines = briefLines(calendarBrief(NOW));
  const text = lines.join('\n');
  assert.match(text, /Мэр: Diana/);
  assert.match(text, /Министр: Marina/);
  assert.match(text, /Идёт сейчас: Мифологический ритуал \(Mythological Ritual\)/);
  assert.match(text, /лидирует Paul \(61%\)/);
});

test('советчик: раздел «Сейчас в игре» в сводке и событие «новый мэр»', () => {
  setElection(RAW, NOW);
  const brief = calendarBrief(NOW);
  const digest = buildDigest({ profileName: 'Zucchini', skills: {} }, {}, { now: NOW, calendar: brief });
  assert.match(digest, /# Сейчас в игре/);
  assert.match(digest, /Mythological Ritual/);

  const a = makeSnapshot({}, {}, { now: NOW, calendar: brief });
  assert.equal(a.mayor, 'Diana / министр Marina');
  assert.deepEqual(a.events, { ritual: 'Мифологический ритуал' });
  const b = makeSnapshot({}, {}, { now: NOW, calendar: { ...brief, mayor: { name: 'Paul', perks: [] }, minister: null, active: [{ id: 'spooky', name: 'Хэллоуинский фестиваль', tier: 'big' }] } });
  const d = diffSnapshots(a, b);
  const t = d.events.map(e => e.text);
  assert.ok(t.includes('Новый мэр: Diana / министр Marina → Paul'));
  assert.ok(t.includes('Начался ивент: Хэллоуинский фестиваль'));
  assert.ok(t.includes('Закончился ивент: Мифологический ритуал'));
  assert.ok(d.score >= 7);
  // старый снимок без полей календаря — без ложных событий
  const old = { ...a }; delete old.mayor; delete old.events;
  assert.equal(diffSnapshots(old, b).events.filter(e => e.kind === 'event').length, 0);
});

test('гайд Diana: ивент идёт / не идёт', () => {
  const owned = new Map([['ANCESTRAL_SPADE', [{}]]]);
  const ctx = { has: id => owned.has(id), name: id => id, price: id => (id === 'GRIFFIN;4' ? 50e6 : 0) };
  const m = { pets: [{ type: 'GRIFFIN', tier: 'EPIC' }], skills: { taming: { level: 50 } }, extras: { mythos: { kills: 10, burrows: 50, chains: 9 } } };
  setElection(RAW, NOW);
  const on = diana.build(m, ctx);
  assert.equal(on.level.value, 4);
  assert.match(on.summary, /Ивент идёт/);
  assert.match(on.next[0].title, /копай норы грифонов/);
  assert.ok(on.next.some(n => /Epic → Legendary/.test(n.title)));
  setElection({ ...RAW, mayor: { key: 'dungeons', name: 'Paul', perks: [{ name: 'EZPZ', description: '' }] } }, NOW);
  const off = diana.build({ pets: [] , skills: {} }, { has: () => false, name: id => id, price: () => 0 });
  assert.equal(off.status, 'locked');
  assert.match(off.summary, /ивента нет/);
  assert.ok(off.next.some(n => /Griffin/.test(n.title)));
  setElection(RAW, NOW);
});
