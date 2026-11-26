import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';
import { museumCatalog, entriesOfItem } from '../src/museum/catalog.js';
import { analyzeMuseum, museumItemStatus, milestoneOf, setName } from '../src/museum/analyze.js';
import { museumSummary, museumPage } from '../src/museum/index.js';
import { parseMember } from '../src/parse/profile.js';
import { buildRoadmap } from '../src/advisor/index.js';
import { buildGuide } from '../src/guides/index.js';
import { summarizeForCompare } from '../src/compare.js';
import { ownercatMember } from './fixtures/ownercat.js';

const PRICES = { FANCY_SWORD: 100, ROGUE_SWORD: 500, END_SWORD: 1000, SPEED_WITHER_HELMET: 1e6, SPEED_WITHER_CHESTPLATE: 2e6, SPEED_WITHER_LEGGINGS: 1e6, ASPECT_OF_THE_END: 50_000 };
const price = id => PRICES[id] || 0;
const museum = (keys, extra = {}) => ({ status: 'ok', keys, borrowing: [], special: [], value: 0, appraisal: false, ...extra });
const member = (mu, inv = {}) => ({ museum: mu, inv });

test('каталог: 7 разделов, сеты, звёздные версии и высшие тиры', () => {
  const c = museumCatalog();
  assert.ok(c.total > 600 && c.xpMax > 3000);
  assert.deepEqual(entriesOfItem(c, 'POWER_WITHER_CHESTPLATE'), ['POWER_WITHER']);
  assert.deepEqual(entriesOfItem(c, 'STARRED_BONZO_STAFF'), ['BONZO_STAFF']);
  assert.ok(c.entries.get('ASPECT_OF_THE_END').parents.includes('ASPECT_OF_THE_VOID'));
  assert.ok(c.special.has('BEDROCK'));
  assert.equal(setName(c.entries.get('POWER_WITHER').set, id => ({ POWER_WITHER_CHESTPLATE: 'Necron\'s Chestplate' })[id] || id), 'Necron\'s Armor');
});

test('вехи: каждые 100 XP, всего 40', () => {
  assert.deepEqual([milestoneOf(0).n, milestoneOf(99).n, milestoneOf(100).n, milestoneOf(3651).n, milestoneOf(5000).n], [0, 0, 1, 36, 40]);
  assert.equal(milestoneOf(141).toNext, 59);
  assert.equal(milestoneOf(4000).nextXp, null);
});

test('анализ: высший тир засчитывает низший, одолженное считается, сет только целиком', () => {
  const m = member(museum(['ASPECT_OF_THE_VOID', 'HYPERION'], { borrowing: ['HYPERION'], special: [{ id: 'BEDROCK' }], value: 5e6 }), {
    inventory: [{ id: 'TERMINATOR' }, { id: 'HYPERION', museum: true }],
    wardrobe: ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(p => ({ id: `POWER_WITHER_${p}` })).concat([{ id: 'SPEED_WITHER_BOOTS' }]),
    enderChest: [{ id: 'BAG_OF_CASH' }],
  });
  const a = analyzeMuseum(m, { price, full: true });
  assert.equal(a.status, 'ok');
  assert.equal(a.entries.find(e => e.id === 'ASPECT_OF_THE_END').status, 'counted');
  assert.equal(a.entries.find(e => e.id === 'HYPERION').status, 'borrowed');
  assert.deepEqual(a.borrowed.map(b => b.id), ['HYPERION']);
  // Necron целиком в гардеробе — можно сдать (и он засчитает низшие сеты), Terminator — тоже; Hyperion уже в музее
  assert.deepEqual(a.canDonate.map(x => x.id).sort(), ['POWER_WITHER', 'TERMINATOR']);
  assert.ok(a.canDonate.find(x => x.id === 'POWER_WITHER').gain > 6);
  // Maxor: одна часть — неполный сет, докупить 4 млн
  const sp = a.partialSets.find(s => s.id === 'SPEED_WITHER');
  assert.equal(sp.costLeft, 4e6);
  assert.equal(a.cheapest[0].id, 'FANCY_SWORD');
  assert.ok(!a.cheapest.some(x => x.id === 'ASPECT_OF_THE_END'), 'засчитанный высшим тиром не предлагается');
  assert.deepEqual(a.specialOwned.map(x => x.id), ['BAG_OF_CASH']);
  assert.equal(a.milestonePlan.free, true);
  assert.equal(a.milestonePlan.reached, true);
  assert.equal(a.names.POWER_WITHER, 'Power Wither Armor');
});

test('анализ: выключенный Museum API и нет данных', () => {
  assert.equal(analyzeMuseum(member({ status: 'off' })).status, 'off');
  assert.equal(analyzeMuseum(member(null)).status, 'none');
  assert.equal(museumSummary(member(null), {}).status, 'none');
  assert.equal(museumItemStatus(member({ status: 'off' }), 'HYPERION').apiOff, true);
  assert.equal(museumItemStatus({}, 'HYPERION').status, 'unknown');
  assert.equal(museumItemStatus({}, 'DIRT'), null);
});

test('карточка предмета: в музее, засчитан, можно пожертвовать, особый', () => {
  const m = member(museum(['ASPECT_OF_THE_VOID'], { special: [{ id: 'BEDROCK' }] }), { inventory: [{ id: 'TERMINATOR' }] });
  assert.equal(museumItemStatus(m, 'ASPECT_OF_THE_VOID').status, 'donated');
  const aote = museumItemStatus(m, 'ASPECT_OF_THE_END', { name: () => 'Aspect of the Void' });
  assert.equal(aote.status, 'counted');
  assert.equal(aote.names.ASPECT_OF_THE_VOID, 'Aspect of the Void');
  const term = museumItemStatus(m, 'TERMINATOR');
  assert.equal(term.status, 'missing');
  assert.equal(term.owned, true);
  assert.equal(museumItemStatus(m, 'BEDROCK').status, 'special-donated');
  assert.equal(museumItemStatus(m, 'POWER_WITHER_HELMET').set.length, 4);
});

test('разбор ответа Hypixel: ключи, одолженное, особые, статус off', async () => {
  const S = v => ({ type: 'string', value: v }), B = v => ({ type: 'byte', value: v }), SH = v => ({ type: 'short', value: v });
  const it = id => ({ id: SH(276), Count: B(1), Damage: SH(0), tag: { type: 'compound', value: { ExtraAttributes: { type: 'compound', value: { id: S(id), donated_museum: B(1) } }, display: { type: 'compound', value: { Name: S(id) } } } } });
  const data = items => ({ type: 0, data: gzipSync(nbt.writeUncompressed({ type: 'compound', name: '', value: { i: { type: 'list', value: { type: 'compound', value: items } } } })).toString('base64') });
  const uuid = 'u1';
  const profile = { profile_id: 'p', cute_name: 'Zucchini', members: { [uuid]: { player_data: {}, profile: {} } } };
  const raw = { value: 7, appraisal: true, items: { HYPERION: { donated_time: 1, borrowing: true, items: data([it('HYPERION')]) }, FANCY_SWORD: { donated_time: 2, items: data([it('FANCY_SWORD')]) } }, special: [{ donated_time: 3, items: data([it('BEDROCK')]) }] };
  const m = await parseMember(profile, uuid, { museum: raw, museumFetched: true });
  assert.equal(m.museum.status, 'ok');
  assert.deepEqual(m.museum.keys.sort(), ['FANCY_SWORD', 'HYPERION']);
  assert.deepEqual(m.museum.borrowing, ['HYPERION']);
  assert.deepEqual(m.museum.special.map(s => s.id), ['BEDROCK']);
  assert.equal(m.museum.decoded.length, 2, 'одолженный не считается в стоимость музея (он лежит у игрока)');
  assert.equal((await parseMember(profile, uuid, { museumFetched: true })).museum.status, 'off');
  assert.equal((await parseMember(profile, uuid, {})).museum, null);
});

test('«Что делать», гайд, страница и «Сравнение» видят музей', () => {
  const m = ownercatMember();
  m.museum = museum(['FANCY_SWORD']);
  m.inv = { ...(m.inv || {}), inventory: [...(m.inv?.inventory || []), { id: 'ROGUE_SWORD' }, { id: 'END_SWORD' }] };
  const steps = buildRoadmap(m, null, null, { price });
  const st = steps.find(s => s.id === 'museum-donate-owned');
  assert.ok(st, 'шаг «пожертвуй то, что есть»');
  assert.match(st.title, /SkyBlock XP/);
  const g = buildGuide('museum', m, {}, { priceOf: price });
  assert.equal(g.status, 'progress');
  assert.equal(g.level.max, 40);
  assert.ok(g.next.length && g.sections.some(s => s.title === 'Разделы музея'));
  assert.ok(g.sections.some(s => s.kind === 'steps'), 'пошаговая инструкция');
  const off = ownercatMember(); off.museum = { status: 'off' };
  assert.ok(buildRoadmap(off, null, null, { price }).some(s => s.id === 'museum-api'));
  assert.equal(buildGuide('museum', off, {}, { priceOf: price }).status, 'locked');
  const page = museumPage(m, { price });
  assert.equal(page.milestones.length, 40);
  assert.ok(page.entryInfo.POWER_WITHER.icon.endsWith('CHESTPLATE'));
  const cmp = summarizeForCompare({ player: { name: 'X' }, member: m, analysis: { museum: museumSummary(m, { price }) } });
  assert.equal(cmp.museum.status, 'ok');
  assert.equal(cmp.museum.donated, 1);
});
