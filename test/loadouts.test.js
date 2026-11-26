import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuide } from '../src/guides/index.js';
import { buildRoadmap } from '../src/advisor/index.js';
import { dungeonLoadout, witherFamily } from '../src/advisor/lib/loadouts.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const deps = { priceOf: id => PRICES[id] || 0 };
const it = (id, extra = {}) => ({ id, name: id, rarity: 'LEGENDARY', recomb: false, hpb: 10, stars: 5, enchants: {}, lore: ['§6§lLEGENDARY DUNGEON ARMOR'], count: 1, ...extra });
const farm = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => it(`FERMENTO_${s}`, { lore: ['§6§lLEGENDARY'] }));
// Как у OwnerCat: надета фермерская броня, в слоте 5 — смешанный сет Wither
const mixed = [it('POWER_WITHER_HELMET'), it('SPEED_WITHER_CHESTPLATE'), it('POWER_WITHER_LEGGINGS'), it('WISE_WITHER_BOOTS')];

function member() {
  const m = ownercatMember();
  m.dungeons = { ...m.dungeons, selectedClass: 'archer', catacombs: { level: 27, xpCurrent: 1, xpForNext: 2 }, floors: { 7: 8 }, masterFloors: {} };
  m.inv = { ...m.inv, armor: farm, wardrobeSets: [
    { slot: 1, names: ['farming'], equipped: true, items: farm },
    { slot: 4, names: [], equipped: false, items: [it('SHADOW_ASSASSIN_HELMET'), null, null, null] },
    { slot: 5, names: [], equipped: false, items: mixed },
  ] };
  // inv.wardrobe намеренно не заполняем: сеты должны читаться прямо из слотов гардероба
  return m;
}

test('сеты: части Necron/Maxor/Storm/Wither — одно семейство Wither, плащ и очки — нет', () => {
  assert.equal(witherFamily('POWER_WITHER_HELMET'), 'POWER_WITHER');
  assert.equal(witherFamily('WITHER_BOOTS'), 'WITHER');
  assert.equal(witherFamily('WITHER_CLOAK'), null);
  assert.equal(witherFamily('WITHER_GOGGLES'), null);
  const lo = dungeonLoadout(member());
  assert.equal(lo.slot, 5);
  assert.equal(lo.wither, 4);
  assert.ok(lo.witherborn && lo.mixed);
});

test('данжи: смешанный сет из гардероба — «прокачай свой сет», а не «Necron 2/4, Maxor 1/4»', () => {
  const g = buildGuide('dungeons', member(), {}, deps);
  const all = JSON.stringify(g);
  assert.doesNotMatch(all, /Necron's Armor 2\/4|Maxor's Armor 1\/4/);
  const titles = g.next.map(n => n.title).join(' | ');
  assert.match(titles, /Прокачай свой сет Wither — слот гардероба 5 \(Necron \+ Maxor \+ Storm\)/);
  // Storm-ботинки лучнику лучше заменить, бонус сохранится
  assert.match(titles, /замени ботинки Storm/);
  const table = g.sections.find(s => s.title.startsWith('Твой сет'));
  assert.equal(table.rows.length, 4);
  assert.match(g.sections.find(s => s.title === 'Как быстрее качать Catacombs').text[1], /Witherborn 4\/4 активен/);
});

test('данжи: частей Wither хватает, но они в разных местах — собрать в один слот', () => {
  const m = member();
  m.inv.wardrobeSets[2].items = [mixed[0], mixed[1], null, null];
  m.inv.wardrobe = m.inv.wardrobeSets.flatMap(s => s.items); // как в parse/profile.js
  m.inv.enderChest = [mixed[2], mixed[3]];
  const g = buildGuide('dungeons', m, {}, deps);
  assert.match(g.next.map(n => n.title).join(' | '), /Собери 4 части Wither в один слот гардероба/);
});

test('«Что делать»: смешанный Wither считается полученным тиром брони для данжей', () => {
  const steps = buildRoadmap(member(), null, null, { price: id => PRICES[id] || 0 });
  const s = steps.find(x => x.id === 'gear-dungeon-armor');
  assert.ok(!s, `не должно быть шага «купи Necron»: ${s?.title}`);
  const up = steps.find(x => x.id === 'gear-upgrades');
  if (up) assert.ok(up.how.some(l => /WITHER/.test(l) || /Necron|Maxor|Wither/.test(l)), up.how.join('\n'));
});

test('Kuudra: части разных тиров одного семейства складываются в сет', () => {
  const m = member();
  m.crimson = { ...m.crimson, faction: 'barbarians', barbarianRep: 3500, kuudra: { basic: 5, hot: 3, burning: 1, fiery: 0, infernal: 0 } };
  m.dungeons.selectedClass = 'berserk';
  m.inv.inventory = [it('HOT_CRIMSON_HELMET'), it('BURNING_CRIMSON_CHESTPLATE'), it('HOT_CRIMSON_LEGGINGS'), it('HOT_CRIMSON_BOOTS')];
  const g = buildGuide('kuudra', m, {}, deps);
  assert.doesNotMatch(g.next.map(n => n.title).join(' | '), /Собери полный сет/);
});

test('советчик ИИ: сводка знает про смешанный Wither в гардеробе и не даёт советовать покупку сета', async () => {
  const { buildDigest } = await import('../src/live-advisor/lib/digest.js');
  const m = member();
  const d = buildDigest(m, buildRoadmap(m, deps), {});
  assert.match(d, /Wardrobe:.*слот гардероба 5: POWER_WITHER_HELMET/);
  assert.match(d, /Сет для данжей: слот гардероба 5: 4\/4 частей Wither вперемешку \(Necron \+ Maxor \+ Storm\)/);
  assert.match(d, /НЕ советуй покупать Wither-броню с нуля/);
  assert.match(d, /Под класс archer хуже подходят: ботинки Storm/);
});
