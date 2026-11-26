import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weaponTypeBonus, armorVs, setName, buildKit, bestKit, kitText } from '../src/calc/kit.js';
import { slayerPlan } from '../src/calc/slayer-ready.js';
import { SLAYER_BOSSES } from '../src/calc/slayer-bosses.js';
import { combatKitView } from '../src/calc/power.js';
import { slayerRules } from '../src/advisor/lib/rules/combat.js';
import { makeCtx } from '../src/advisor/lib/util.js';
import { pieceDetail, upgradeHints } from '../src/calc/kit-detail.js';
import { guideFor } from '../src/advisor/index.js';

const piece = (id, slot, lore) => ({ id: `${id}_${slot}`, name: `${id} ${slot}`, lore: [...lore, `§6§lLEGENDARY ${slot}`] });
const set = (id, lore) => ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => piece(id, s, lore));
const sword = (id, damage, extra = [], type = 'SWORD') => ({ id, uuid: id, name: id, lore: [`§7Damage: §c+${damage}`, ...extra, `§6§lLEGENDARY ${type}`], enchants: {} });

// Игрок в фермерской броне, а в Wardrobe лежит боевой сет; оружие — меч и кинжал
function member(o = {}) {
  return {
    skills: { combat: { level: 50 } },
    slayers: o.slayers || {},
    pets: [],
    inv: {
      armor: set('FARM', ['§7Health: §a+10']),
      equipment: [],
      wardrobeSets: [
        { slot: 1, names: [], equipped: true, worn: true, items: set('FARM', ['§7Health: §a+10']) },
        { slot: 2, names: [], equipped: false, items: set('HOT_CRIMSON', ['§7Health: §a+300', '§7Defense: §a+200', '§7Strength: §c+60']) },
      ],
      equipmentSets: [],
      loadouts: [{ id: 1, name: 'atack', armorSlot: 2, equipmentSlot: null, pet: null, power: null }],
      inventory: [sword('GIANTS_SWORD', 500, ['§7Strength: §c+100']), ...(o.daggers ? [sword('FIREDUST_DAGGER', 90, ['§7Deal §c1.2x §7damage to §cInfernal mobs.'], 'DAGGER'), sword('MAWDUST_DAGGER', 90, [], 'DAGGER')] : [])],
      enderChest: [], backpacks: {},
    },
  };
}

test('бонус оружия против типа мобов из лора', () => {
  assert.deepEqual(weaponTypeBonus(['§7Deal §a+300% §7damage to Endermen.']), { ender: 3 });
  near(weaponTypeBonus(['§7Deal §c1.2x §7damage to  §cInfernal mobs.']).infernal, 0.2);
  assert.deepEqual(weaponTypeBonus(['§7Take -20% damage from Animal mobs']), {});
});

function near(a, b, eps = 1e-9) { assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`); }

test('сетовый бонус Final Destination и Bulwark — против Endermen', () => {
  const fd = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => ({ id: `FINAL_DESTINATION_${s}`, lore: ['§7Piece Bonus: Enderman Bulwark', '§7Kill Endermen to accumulate defense', '§7Piece Bonus: §a+120'] }));
  const vs = armorVs(fd);
  assert.equal(vs.ender.mult, 1);
  assert.equal(vs.ender.stats.ferocity, 200);
  assert.equal(vs.ender.stats.defense, 480);
  assert.deepEqual(armorVs(fd.slice(0, 3)).ender.stats, { defense: 360 }, 'без полного сета — только Bulwark');
});

test('название сета по id частей, Wither вперемешку', () => {
  assert.equal(setName(set('HOT_CRIMSON', [])), 'Hot Crimson');
  assert.equal(setName([{ id: 'POWER_WITHER_HELMET' }, { id: 'SPEED_WITHER_BOOTS' }]), 'Necron + Maxor');
});

test('боевой набор берётся из Wardrobe, а не из надетой фермерской брони', () => {
  const m = member();
  const kit = buildKit(m, {});
  const r = bestKit(kit, { hp: 1e6, dps: 500, types: [] });
  assert.equal(r.best.armor.slot, 2);
  assert.equal(r.best.weapon.id, 'GIANTS_SWORD');
  assert.equal(r.saved[0].loadout.name, 'atack');
  assert.match(kitText(r.best), /Hot Crimson/);
  const view = combatKitView(m, {}, 50);
  assert.equal(view.worn, false);
  assert.equal(view.loadout, 'atack');
  assert.ok(view.world.defense >= 200);
});

test('Blaze T2+ — только кинжалами и со 2 уровня', () => {
  const kit = buildKit(member(), {});
  const p = slayerPlan(member({ slayers: { enderman: { level: 5, kills: { 3: 10 } }, blaze: { level: 0, kills: {} } } }), 'blaze', kit, [5, 25, 100, 500]);
  assert.equal(p.tiers[1].verdict, 'no-weapon');
  assert.equal(p.tiers[1].needLevel, 2);
  const withDaggers = buildKit(member({ daggers: true }), {});
  const p2 = slayerPlan(member({ daggers: true, slayers: { enderman: { level: 5, kills: { 3: 10 } }, blaze: { level: 2, kills: { 1: 6 } } } }), 'blaze', withDaggers, [5, 25, 100, 500]);
  assert.equal(p2.tiers[1].best.weapon.type, 'DAGGER');
  assert.equal(p2.tiers[0].verdict, 'proven');
});

test('Blaze закрыт без Voidgloom T3', () => {
  const p = slayerPlan(member({ slayers: { enderman: { level: 3, kills: { 2: 5 } } } }), 'blaze', buildKit(member(), {}), [5, 25, 100, 500]);
  assert.deepEqual(p.prereq, { slayer: 'enderman', tier: 3 });
  assert.equal(p.farm, null);
});

test('тир с победами — «уже проходишь», провалы на следующем не дают обещать «легко»', () => {
  const sl = { level: 7, kills: { 1: 1, 2: 2, 3: 11, 4: 117 }, attempts: { 4: 126, 5: 2 } };
  const m = member({ slayers: { zombie: { level: 7, kills: { 2: 5 } }, spider: sl } });
  const p = slayerPlan(m, 'spider', buildKit(m, {}), [5, 25, 100, 500, 1500]);
  assert.equal(p.tiers[3].verdict, 'proven');
  assert.equal(p.tiers[0].verdict, 'proven', 'тиры ниже пройденного тоже');
  assert.ok(['hard', 'no'].includes(p.tiers[4].verdict));
  assert.equal(p.farm.tier, 4);
  assert.ok(p.tiers[4].ratio.ttk > 1);
});

test('таблица боссов: у каждого тира есть HP и урон', () => {
  for (const [k, b] of Object.entries(SLAYER_BOSSES)) for (const t of b.tiers) assert.ok(t.hp > 0 && t.dps > 0, k);
});

test('план: Blaze 0 — путь к кинжалам с расчётом по статам, Aatrox только при мэре', () => {
  const m = member({ slayers: { enderman: { level: 7, maxLevel: 9, name: 'Voidgloom Seraph', ru: 'Enderman', xp: 100569, xpForNext: 400000, kills: { 3: 32, 4: 152 } }, blaze: { level: 0, maxLevel: 9, name: 'Inferno Demonlord', ru: 'Blaze', xp: 0, xpForNext: 10, kills: {} } } });
  const ctx = makeCtx(m, null, null, {});
  const steps = [];
  slayerRules(ctx, s => steps.push(s));
  const blaze = steps.find(s => s.id === 'slayer-blaze');
  assert.match(blaze.title, /6 боссов T1 до 2 уровня/);
  assert.match(blaze.how.join(' '), /Twilight Dagger/);
  assert.match(blaze.how[0], /atack/, 'советует сохранённый набор');
  const ender = steps.find(s => s.id === 'slayer-enderman');
  assert.match(ender.title, /T4/);
  assert.ok(!ender.how.some(h => /Aatrox/.test(h)), 'Aatrox — только когда он мэр');
  const steps2 = [];
  slayerRules(makeCtx(m, null, null, { mayorPerks: ['Slayer XP Buff'] }), s => steps2.push(s));
  assert.ok(steps2.find(s => s.id === 'slayer-enderman').how.some(h => /Aatrox/.test(h)));
});

test('Blaze T2 без кинжала: расчёт с парой кинжалов и путь к ним', () => {
  const m = member({ slayers: { enderman: { level: 5, kills: { 3: 10 } }, blaze: { level: 0, kills: {} } } });
  const p = slayerPlan(m, 'blaze', buildKit(m, {}), [5, 25, 100, 500]);
  assert.equal(p.tiers[1].verdict, 'no-weapon');
  assert.ok(p.tiers[1].hypo?.best, 'есть расчёт с кинжалом');
  assert.equal(p.tiers[1].hypo.pair.ids[0], 'FIREDUST_DAGGER');
  assert.equal(p.tiers[2].hypo.pair.level, 4);
  assert.equal(p.tiers[1].hypo.best.armor.slot, 2, 'броня под кинжал — боевой сет');
});

test('подробности вещи и дешёвые улучшения', () => {
  const it = { id: 'HOT_CRIMSON_HELMET', name: '§6Fierce Hot Crimson Helmet §6✪✪✪', stars: 3, reforge: 'fierce', recomb: false, hpb: 4, enchants: { protection: 5 }, lore: [] };
  const d = pieceDetail(it);
  assert.equal(d.slot, 'шлем');
  assert.match(d.text, /3 звезды · Reforge Fierce · 4 Hot Potato Book · Protection V/);
  const hints = upgradeHints({ armor: { items: [it, { ...it, id: 'HOT_CRIMSON_BOOTS', reforge: 'mossy' }] } }, {});
  assert.match(hints[0], /Reforge на ботинки/);
  assert.match(hints[1], /Hot Potato Book: 12 шт/);
  assert.match(hints[2], /Growth V/);
  const done = { ...it, stars: 5, reforge: 'ancient', recomb: true, hpb: 15, enchants: { protection: 5, growth: 5 } };
  assert.deepEqual(upgradeHints({ armor: { items: [done] } }, { lack: ['survive'] }).length, 1, 'всё прокачано — совет сверх вещей');
});

test('шаги плана ведут в свои гайды', () => {
  assert.deepEqual(guideFor('slayer-blaze'), { id: 'slayer-blaze', anchor: 'wear', title: 'Inferno Demonlord' });
  assert.equal(guideFor('dungeon-master').id, 'dungeons');
  assert.equal(guideFor('hotm-powder').id, 'mining');
  assert.equal(guideFor('mp-cheap'), null);
});
