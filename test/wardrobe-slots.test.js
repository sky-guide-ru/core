// «Что у меня в слоте 5 гардероба?» — номера слотов как в игре и в разборе, и на сайте, и у советчика
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';
import { parseMember } from '../src/parse/profile.js';
import { makeToolHandlers } from '../src/live-advisor/lib/tools.js';
import { buildDigest } from '../src/live-advisor/lib/digest.js';
import { buildRoadmap } from '../src/advisor/index.js';

const S = v => ({ type: 'string', value: v }), B = v => ({ type: 'byte', value: v }), SH = v => ({ type: 'short', value: v }), I = v => ({ type: 'int', value: v });
const it = (id, name, extra = {}) => ({ id: SH(397), Count: B(1), Damage: SH(0), tag: { type: 'compound', value: {
  ExtraAttributes: { type: 'compound', value: { id: S(id), ...extra } },
  display: { type: 'compound', value: { Name: S(name), Lore: { type: 'list', value: { type: 'string', value: ['§6§lLEGENDARY DUNGEON ARMOR'] } } } },
} } });
const data = items => ({ type: 0, data: gzipSync(nbt.writeUncompressed({ type: 'compound', name: '', value: { i: { type: 'list', value: { type: 'compound', value: items } } } })).toString('base64') });
const part = (id, name, extra) => ({ type: 0, data: data([it(id, name, extra)]).data });

async function ownercat() {
  const uuid = 'u1';
  // Надет фермерский сет из слота 1 (в самом наборе пусто), в слоте 5 — смешанный Wither, как у OwnerCat
  const loadout = {
    armor: {
      equipped_set: 1,
      2: { HELMET: part('SHARK_SCALE_HELMET', '§6Shark Scale Helmet') },
      5: {
        HELMET: part('POWER_WITHER_HELMET', "§6Ancient Necron's Helmet §6✪✪✪✪✪", { modifier: S('ancient'), upgrade_level: I(5), hot_potato_count: I(10) }),
        CHESTPLATE: part('SPEED_WITHER_CHESTPLATE', "§6Ancient Maxor's Chestplate §6✪✪✪✪✪", { modifier: S('ancient'), upgrade_level: I(5) }),
        LEGGINGS: part('POWER_WITHER_LEGGINGS', "§6Ancient Necron's Leggings §6✪✪✪✪✪", { modifier: S('ancient'), upgrade_level: I(5) }),
        BOOTS: part('SPEED_WITHER_BOOTS', "§6Ancient Maxor's Boots §6✪✪✪✪✪", { modifier: S('ancient'), upgrade_level: I(5) }),
      },
    },
    loadouts: { a: { name: 'Dungeons', armor_set_id: 5 } },
  };
  const armor = ['FERMENTO_BOOTS', 'FERMENTO_LEGGINGS', 'FERMENTO_CHESTPLATE', 'FERMENTO_HELMET'].map(id => it(id, `§6${id}`));
  const profile = { profile_id: 'p', cute_name: 'Zucchini', members: { [uuid]: { player_data: {}, profile: {}, loadout, dungeons: { selected_dungeon_class: 'archer' }, inventory: { inv_armor: data(armor) } } } };
  return parseMember(profile, uuid, {});
}

test('гардероб: надетый слот 1 на своём месте, слот 5 — смешанный Wither, нумерация как в игре', async () => {
  const m = await ownercat();
  const sets = m.inv.wardrobeSets;
  assert.deepEqual(sets.map(s => s.slot), [1, 2, 5], 'первый столбец — «Слот 1 (надет)», а не «Слот 2»');
  assert.equal(sets[0].equipped && sets[0].worn, true);
  assert.equal(sets[0].items[0].id, 'FERMENTO_HELMET');
  assert.deepEqual(sets[2].names, ['Dungeons']);
  assert.ok(!m.inv.wardrobe.some(i => i?.id === 'FERMENTO_HELMET'), 'надетое не задваивается как «лежит в гардеробе»');
});

test('советчик отвечает про «слот 5»: инструмент гардероба, поиск и сводка знают номер слота', async () => {
  const m = await ownercat();
  m.dungeons = { ...(m.dungeons || {}), selectedClass: 'archer' };
  const h = makeToolHandlers({ getAnalysis: () => ({}), getMember: () => m, priceOf: () => 0, searchItems: () => [], getItemRu: () => null });
  const w = h.get_gear({ section: 'wardrobe' });
  const s5 = w.slots.find(s => s.slot === 5);
  assert.match(s5.label, /слот гардероба 5 «Dungeons»/);
  assert.match(s5.wither, /4\/4 частей Wither вперемешку \(Necron \+ Maxor\), бонус Witherborn полный/);
  assert.deepEqual(s5.pieces.map(p => p.part), ['шлем', 'нагрудник', 'поножи', 'ботинки']);
  assert.match(s5.pieces[0].name, /Necron's Helmet/);
  assert.equal(w.dungeonSet, 'слот гардероба 5 «Dungeons»');
  assert.equal(w.slots[0].equipped, true);
  const f = h.find_items({ query: 'Necron' });
  assert.ok(f.items.every(x => /слот 5/.test(x.where)), JSON.stringify(f.items.map(x => x.where)));
  const d = buildDigest(m, buildRoadmap(m, { priceOf: () => 0 }), {});
  assert.match(d, /Сет для данжей: слот гардероба 5 «Dungeons»: 4\/4 частей Wither/);
  assert.match(d, /НЕ советуй покупать Wither-броню с нуля/);
});
