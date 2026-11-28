import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuides, buildGuide, guideCtx, GUIDES, GROUPS } from '../src/guides/index.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const deps = { priceOf: id => PRICES[id] || 0 };
const KINDS = new Set(['text', 'steps', 'checklist', 'table', 'tree', 'sources', 'shapes', 'cards', 'tool']);

test('гайды: оболочка собирает контекст и ловит ошибки отдельного гайда', () => {
  const m = ownercatMember();
  const ctx = guideCtx(m, {}, deps);
  assert.equal(ctx.price('TERMINATOR'), 1_050_000_000);
  assert.ok(ctx.has('JUJU_SHORTBOW'));
  const list = [
    { id: 'ok', title: 'OK', icon: 'STONE', group: 'other', build: () => ({ summary: 'есть', sections: [{ kind: 'text', title: 't', text: 'x' }] }) },
    { id: 'bad', title: 'Bad', icon: 'STONE', group: 'other', build: () => { throw new Error('бум'); } },
  ];
  const r = buildGuides(m, {}, deps, list);
  assert.equal(r[0].summary, 'есть');
  assert.equal(r[1].status, 'error');
  assert.match(r[1].summary, /бум/);
  assert.equal(buildGuide('ok', m, {}, deps, list).id, 'ok');
  assert.equal(buildGuide('nope', m, {}, deps, list), null);
  assert.deepEqual(buildGuides(null, {}, deps, list), []);
});

test('гайды: все зарегистрированные гайды собираются без ошибок и по формату', () => {
  const m = ownercatMember();
  const ids = new Set();
  for (const g of buildGuides(m, {}, deps)) {
    assert.ok(!ids.has(g.id), `повтор id ${g.id}`); ids.add(g.id);
    assert.notEqual(g.status, 'error', `${g.id}: ${g.summary}`);
    assert.ok(GROUPS[g.group], `${g.id}: неизвестная группа ${g.group}`);
    assert.ok(g.title && g.summary, `${g.id}: нет title/summary`);
    for (const s of g.sections) {
      assert.ok(KINDS.has(s.kind), `${g.id}: секция ${s.title} с типом ${s.kind}`);
      assert.ok(s.title, `${g.id}: секция без заголовка`);
      if (s.kind === 'cards') for (const it of s.items) assert.ok(it.name && it.text, `${g.id}/${s.title}: карточка без имени или текста`);
      if (s.kind === 'shapes') for (const it of s.items) assert.ok(it.name && it.cells?.length, `${g.id}/${s.title}: фигура без имени или клеток`);
      if (s.kind === 'table') for (const r of s.rows) assert.equal(r.length, s.columns.length, `${g.id}/${s.title}: ширина строки`);
    }
    for (const n of g.next || []) assert.ok(n.title, `${g.id}: шаг без заголовка`);
  }
  assert.equal(ids.size, GUIDES.length);
});

test('данжи: M2 не открыт без победы на M1 (живой профиль: F7 ×8, Catacombs 27, M-этажей нет)', () => {
  const m = ownercatMember();
  m.dungeons = { ...m.dungeons, catacombs: { level: 27, xpCurrent: 236_806, xpForNext: 445_000 }, floors: { 7: 8 }, masterFloors: {} };
  const g = buildGuide('dungeons', m, {}, deps);
  const titles = g.next.map(n => n.title).join(' | ');
  assert.match(titles, /открыты: M1\)/);
  assert.doesNotMatch(titles, /M1, M2/);
  const table = g.sections.find(s => s.title === 'Этажи и Master Mode');
  assert.equal(table.rows[2][3].text, 'сначала M1');
});

test('Kuudra: не советует перевести броню на тир, который ещё не пройден', () => {
  const m = ownercatMember();
  m.crimson = { ...m.crimson, faction: 'barbarians', barbarianRep: 1755, mageRep: -5, kuudra: { basic: 2, hot: 1, burning: 0, fiery: 0, infernal: 0 } };
  const g = buildGuide('kuudra', m, {}, deps);
  assert.ok(!g.next.some(n => /^Переведи броню на тир Burning/.test(n.title)));
  assert.match(g.next[0].title, /1\s755 → 3\s000/);
});

test('источники: у каждого гайда последним идёт блок «Источники» с рабочими ссылками', async () => {
  const { VIDEOS } = await import('../src/guides/sources.js');
  const m = ownercatMember();
  for (const g of buildGuides(m, {}, deps)) {
    const s = g.sections.at(-1);
    assert.equal(s.kind, 'sources', `${g.id}: последний блок не «Источники»`);
    assert.ok(s.data.some(d => d.title === 'Hypixel API') && s.data.some(d => d.title === 'NEU-REPO'), `${g.id}: нет API/NEU`);
    assert.ok(s.wiki.length > 0, `${g.id}: нет страниц вики`);
    for (const l of [...s.data, ...s.wiki, ...s.videos]) assert.match(l.url, /^https:\/\//, `${g.id}: ссылка ${l.url}`);
    for (const w of s.wiki) assert.match(w.url, /^https:\/\/hypixel-skyblock\.fandom\.com\/wiki\/[^ ]+$/);
    assert.equal(new Set(s.wiki.map(w => w.url)).size, s.wiki.length, `${g.id}: повтор страницы вики`);
    for (const v of s.videos) {
      assert.match(v.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/, `${g.id}: ${v.url}`);
      assert.ok(v.label && v.channel && v.title, `${g.id}: у видео ${v.id} нет подписи, канала или названия`);
      assert.match(v.label, /[а-яё]/i, `${g.id}: подпись видео ${v.id} не по-русски`);
      assert.ok(['ru', 'en'].includes(v.lang), `${g.id}: язык видео ${v.id}`);
    }
  }
  const ids = new Set(GUIDES.map(g => g.id));
  for (const k of Object.keys(VIDEOS)) assert.ok(ids.has(k), `VIDEOS: нет гайда ${k}`);
});
