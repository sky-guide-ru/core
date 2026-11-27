import test from 'node:test';
import assert from 'node:assert/strict';
import { combatMf, combatNext, slayerMf, petScoreMf, cinderbatLevel, loreMf, loreMfOn, bestiaryTiers, magicFind, MF_CAP } from '../src/calc/magic-find.js';

test('Combat: +20 MF к 60 уровню, по брекетам', () => {
  assert.equal(combatMf(0), 0);
  assert.equal(combatMf(10), 1);
  assert.equal(combatMf(47), 13.5);
  assert.equal(combatMf(60), 20);
  assert.equal(combatNext(47), 0.5);
  assert.equal(combatNext(60), 0);
});

test('Slayers: +1 за уровень до 8, на 9-м +2; Vampire — до 4 и +2 на 5-м', () => {
  assert.equal(slayerMf('zombie', 8), 8);
  assert.equal(slayerMf('zombie', 9), 10);
  assert.equal(slayerMf('vampire', 4), 4);
  assert.equal(slayerMf('vampire', 5), 6);
});

test('Pet Score и Cinderbat', () => {
  const t = { 0: { magic_find: 0 }, 10: { magic_find: 1 }, 130: { magic_find: 6 }, 175: { magic_find: 7 } };
  assert.equal(petScoreMf(166, t), 6);
  assert.equal(cinderbatLevel(0), 0);
  assert.equal(cinderbatLevel(3), 3);
  assert.equal(cinderbatLevel(24), 10);
});

test('MF из лора: значок стата и цвета не мешают', () => {
  assert.equal(loreMf(['§7Magic Find: §b+1.5']), 1.5);
  assert.deepEqual(loreMfOn(['§7Grants §b+5 Magic Find §7on §9Sharks§7.']), { mf: 5, on: 'Sharks' });
  assert.equal(loreMfOn(['§7Strength: §c+10']), null);
});

test('Bestiary: tier по брекетам NEU с потолком', () => {
  const br = Array.from({ length: 25 }, (_, i) => (i + 1) * 10);
  const b = { brackets: { 1: br }, hub: { mobs: [{ name: '§aA', cap: 250, mobs: ['a_1'], bracket: 1 }, { name: '§aB', cap: 250, mobs: ['b_1', 'b_2'], bracket: 1 }] } };
  const r = bestiaryTiers({ a_1: 250, b_1: 70, b_2: 70 }, b);
  assert.equal(r.t15, 1);
  assert.equal(r.t25, 1);
  assert.deepEqual(r.near[0], { name: 'B', tier: 14, kills: 140, need: 150 });
});

test('magicFind: источники, советы по цене за 1 MF, потолок', () => {
  const m = {
    inv: {
      talismans: [{ id: 'ANGUISH_RING', name: 'Anguish Ring', lore: ['§7Magic Find: §b+1'] }],
      inventory: [{ id: 'TERMINATOR', name: 'Terminator ✪✪✪✪✪', enchants: { looting_new: 6 }, lore: [] }],
    },
    skills: { combat: { level: 60 } },
    slayers: { zombie: { name: 'Revenant Horror', level: 9 }, spider: { name: 'Tarantula Broodfather', level: 7 } },
    extras: { leveling: { petScore: 0 }, attributes: [{ id: 'magic_find', n: 3 }] },
    effects: { active: [{ id: 'magic_find', level: 4, roman: 'IV' }] },
    cookie: true,
  };
  const P = { ANGUISH_ARTIFACT: 2e6, ENCHANTMENT_LOOTING_NEW_7: 40e6, SHARD_CINDER_BAT: 50e3 };
  const r = magicFind(m, { price: id => P[id] });
  const by = Object.fromEntries(r.sources.map(s => [s.key, s.mf]));
  assert.equal(by.combat, 20);
  assert.equal(by.slayers, 17);
  assert.equal(by.accessories, 1);
  assert.equal(by.looting, 20);
  assert.equal(by.cinderbat, 1.5);
  assert.equal(r.total, 59.5);
  assert.equal(r.cap, MF_CAP);
  assert.match(r.sources.find(s => s.key === 'looting').label, /Looting VI на Terminator$/);
  // Дешевле за 1 MF — выше; бесплатные уровни — в конце
  assert.deepEqual(r.next.map(n => n.key), ['cinderbat', 'ANGUISH_ARTIFACT', 'looting', 'slayer']);
  assert.ok(r.temp.every(t => t.active));
  assert.equal(magicFind(null), null);
});
