import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeForCompare } from '../src/compare.js';
import { coopRoster } from '../src/parse/profile.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { ownercatMember } = await import(path.join(here, 'fixtures', 'ownercat.js'));

test('сравнение: короткая сводка без инвентаря, с нужными полями', () => {
  const m = ownercatMember();
  const s = summarizeForCompare({ player: { name: 'OwnerCat', uuid: 'u1' }, member: m, analysis: { gear: { networth: { total: 8.5e9, items: 5e9 }, worn: { armor: [{ id: 'X', name: 'X', value: 10, lore: ['a'], nbt: { big: 1 } }, null], equipment: [] }, weapons: [], topItems: [], topPets: [] }, roadmap: [{ id: 'a', title: 'Шаг', cat: 'Бой' }] }, updatedAt: 1 });
  assert.equal(s.player.name, 'OwnerCat');
  assert.equal(s.networth.total, 8.5e9);
  assert.ok(s.skills.farming && typeof s.skills.farming.level === 'number');
  assert.ok(s.slayers.zombie && s.slayers.zombie.name === 'Zombie');
  assert.equal(typeof s.dungeons.level, 'number');
  assert.equal(s.gear.armor[0].nbt, undefined, 'без сырых данных предмета');
  assert.equal(s.gear.armor[1], null);
  assert.equal(s.next[0].title, 'Шаг');
  assert.ok(JSON.stringify(s).length < 20_000);
});

test('сравнение: неполный профиль не роняет сводку', () => {
  const s = summarizeForCompare({ player: { name: 'Empty' }, member: { profileName: 'Kiwi' }, analysis: null });
  assert.equal(s.profile, 'Kiwi');
  assert.equal(s.networth, null);
  assert.deepEqual(s.gear.armor, []);
});

test('сравнение: просили несуществующий профиль — в ответе видно, какой показан вместо него', () => {
  const s = summarizeForCompare({ player: { name: 'Friend4ik' }, member: { profileName: 'Pomegranate' }, analysis: null, missingProfile: 'Papya' });
  assert.equal(s.missingProfile, 'Papya');
  assert.equal(s.profile, 'Pomegranate');
});

test('сравнение: кооп — соседи, доля в коллекциях и тиры', () => {
  const s = summarizeForCompare({ player: { name: 'OwnerCat', uuid: 'u1' }, member: { uuid: 'u1', profileName: 'Zucchini', profileId: 'm1', coopMembers: 2, coopRoster: [{ uuid: 'u1', share: 0.62 }, { uuid: 'u2', share: 0.38 }], unlockedCollTiers: ['WHEAT_1', 'WHEAT_2'] }, analysis: null });
  assert.equal(s.coopMates, undefined, 'uuid соседей не отдаём: друзья анонимны');
  assert.equal(s.coopShare, 0.62);
  assert.equal(s.collections.tiers, 2);
});

test('кооп-состав: вышедшие и не принявшие приглашение не считаются, доля по личному вкладу в коллекции', () => {
  const r = coopRoster({ members: {
    a: { collection: { WHEAT: 600, LOG: 150 } },
    b: { collection: { WHEAT: 250 } },
    c: { profile: { deletion_notice: { timestamp: 1 } }, collection: { WHEAT: 9999 } },
    d: { profile: { coop_invitation: { confirmed: false } } },
  } });
  assert.deepEqual(r, [{ uuid: 'a', share: 0.75 }, { uuid: 'b', share: 0.25 }]);
  assert.deepEqual(coopRoster({ members: { a: {} } }), [{ uuid: 'a', share: null }]);
});
