import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  itemStats, mpMultiplier, powerStats, tuningStats, levelBonus, sbLevelStats, petStats, activeAccessories, statSheet, compareWithGame,
  tuningPoints, bonusLineStats, harpIntelligence, slayerTable,
} from '../src/calc/stats.js';
import { combatBonus, enchantBonus, meleeHit, expectedHit, meleeHitsPerSecond, meleeDps, abilityHit, ehp, damageReduction } from '../src/calc/damage.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('лор: итог вне данжа и серое число в скобках — внутри', () => {
  const s = itemStats(['§7Gear Score: §d615', '§7Health: §a+245 §8(+852.6)', '§7Strength: §c+50 §9(+20)', '§7Crit Damage: §c+30%', '§7Bonus Attack Speed: §c+5%', '§7Requires §5Catacombs 20']);
  assert.deepEqual(s.world, { health: 245, strength: 50, crit_damage: 30, attack_speed: 5 });
  assert.equal(s.dungeon.health, 852.6);
  assert.equal(s.dungeon.strength, 50, 'синяя скобка перековки — не данжевое значение');
});

test('множитель Magical Power совпадает со статами камней при 250 MP', () => {
  // Forceful: 18 Strength базово, в игре при 250 MP — 173.56
  near(mpMultiplier(250) * 18, 173.56, 0.05);
  assert.equal(mpMultiplier(0), 0);
  const p = powerStats('Forceful', 250);
  near(p.stats.strength, 173.56, 0.05);
  assert.deepEqual(p.unique, { ferocity: 4 });
  assert.equal(powerStats('несуществующая', 500), null);
});

test('Tuning: очки × прибавка за очко', () => {
  assert.deepEqual(tuningStats({ slot_0: { strength: 30, critical_chance: 5, health: 2 }, highest_unlocked_slot: 1 }), { strength: 30, crit_chance: 1, health: 10 });
});

test('бонусы скиллов по таблице NEU: ступени по уровням', () => {
  const farming = { 1: { health: 2 }, 15: { health: 3 }, 20: { health: 4 }, 26: { health: 5 } };
  assert.equal(levelBonus(farming, 14).health, 28);
  assert.equal(levelBonus(farming, 60).health, 14 * 2 + 5 * 3 + 6 * 4 + 35 * 5);
  near(levelBonus({ 1: { crit_chance: 0.5, damage_increase: 0.04 } }, 50).crit_chance, 25);
  assert.equal(levelBonus({ 1: { defence: 1 } }, 3).defense, 3, 'defence из NEU → defense');
});

test('SkyBlock Level: 5 Health за уровень, Strength за каждые 5', () => {
  assert.deepEqual(sbLevelStats(287.4), { health: 1435, strength: 57 });
  assert.deepEqual(sbLevelStats(0), {});
});

test('питомец: интерполяция и Tier Boost', () => {
  const petnums = { TIGER: { EPIC: { 1: { statNums: { STRENGTH: 5 } }, 100: { statNums: { STRENGTH: 105 } } }, LEGENDARY: { 1: { statNums: { STRENGTH: 5, CRIT_DAMAGE: 1 } }, 100: { statNums: { STRENGTH: 105, CRIT_DAMAGE: 51 } } } } };
  near(petStats({ type: 'TIGER', tier: 'EPIC', level: 50 }, petnums).strength, 54.49, 0.05);
  assert.deepEqual(petStats({ type: 'TIGER', tier: 'EPIC', level: 100, heldItem: 'PET_ITEM_TIER_BOOST' }, petnums), { strength: 105, crit_damage: 51 });
  assert.deepEqual(petStats({ type: 'NOPE', tier: 'EPIC', level: 1 }, petnums), {});
});

test('аксессуары: дубликаты и младшие версии линейки не считаются', () => {
  const up = { SPEED_TALISMAN: ['SPEED_RING', 'SPEED_ARTIFACT'], SPEED_RING: ['SPEED_ARTIFACT'] };
  const items = [{ id: 'SPEED_TALISMAN' }, { id: 'SPEED_ARTIFACT' }, { id: 'SPEED_ARTIFACT' }, { id: 'RED_CLAW_RING' }];
  assert.deepEqual(activeAccessories(items, up).map(i => i.id), ['SPEED_ARTIFACT', 'RED_CLAW_RING']);
});

// Синтетический игрок Steve
const steve = {
  sbLevel: 100,
  magicalPower: 250,
  selectedPower: 'forceful',
  tuning: { slot_0: { strength: 10 } },
  skills: { combat: { level: 20 }, foraging: { level: 5 } },
  slayers: {},
  perks: {},
  pets: [{ type: 'TIGER', tier: 'LEGENDARY', level: 100, active: true }],
  inv: {
    armor: [
      { id: 'SHADOW_ASSASSIN_HELMET', name: 'Shadow Assassin Helmet', lore: ['§7Strength: §c+25', '§7Health: §a+245 §8(+852.6)'] },
    ],
    equipment: [{ id: 'MOLTEN_BELT', name: 'Molten Belt', lore: ['§7Strength: §c+10'] }],
    talismans: [{ id: 'RED_CLAW_RING', lore: ['§7Crit Damage: §c+5%'] }, { id: 'RED_CLAW_RING', lore: ['§7Crit Damage: §c+5%'] }],
  },
};
const neu = {
  petnums: { TIGER: { LEGENDARY: { 100: { statNums: { STRENGTH: 105, CRIT_DAMAGE: 51, FEROCITY: 25 } } } } },
  bonuses: { bonus_stats: { skill_combat: { 1: { crit_chance: 0.5 } }, skill_foraging: { 1: { strength: 1 } } } },
};

test('лист статов Steve: сумма источников', () => {
  const sh = statSheet(steve, { neu });
  // Strength: шлем 25 + пояс 10 + сила 173.56 + tuning 10 + питомец 105 + Foraging 5 + SB Level 20
  near(sh.total.strength, 25 + 10 + 173.56 + 10 + 105 + 5 + 20, 0.05);
  // Crit Chance: база 30 + Combat 20 × 0.5
  assert.equal(sh.total.crit_chance, 40);
  // Crit Damage: база 50 + кольцо один раз 5 + сила 46.28 + питомец 51
  near(sh.total.crit_damage, 50 + 5 + 46.28 + 51, 0.05);
  assert.equal(sh.total.ferocity, 4 + 25);
  assert.equal(sh.total.health, 100 + 245 + 16.39 + 500);
  assert.ok(sh.sources.find(s => s.key === 'power').label.includes('250 MP'));
  assert.ok(sh.missing.length > 0);
});

test('лист статов в данже берёт данжевое значение', () => {
  const sh = statSheet(steve, { neu, where: 'dungeon' });
  near(sh.total.health, 100 + 852.6 + 16.39 + 500, 0.05);
});

test('оружие в руке: его Damage не попадает в лист, а статы — да', () => {
  const sh = statSheet(steve, { neu, weapon: { id: 'X', lore: ['§7Damage: §c+260', '§7Strength: §c+150'] } });
  assert.equal(sh.total.damage, undefined);
  near(sh.total.strength, 348.56 + 150, 0.05);
});

test('сверка с игрой показывает разницу', () => {
  const sh = statSheet(steve, { neu });
  const c = compareWithGame(sh, { crit_chance: 42.5 });
  assert.deepEqual(c.crit_chance, { calc: 40, game: 42.5, diff: 2.5 });
});

test('потолок Speed 400', () => {
  const fast = { ...steve, inv: { ...steve.inv, armor: [{ id: 'B', lore: ['§7Speed: §a+400'] }] } };
  const sh = statSheet(fast, { neu });
  assert.equal(sh.total.speed, 400);
  assert.equal(sh.capped.speed, 500);
});

// ---------- урон ----------

test('Combat: 4% до 50 уровня, дальше по 1%', () => {
  near(combatBonus(26), 1.04);
  near(combatBonus(60), 2.1);
});

test('удар: пример с вики (Damage Calculation)', () => {
  // 100 Damage, 100 Strength, 0 Combat, без чар: (5+100) × 2 = 210; крит +100% = 420
  assert.deepEqual(meleeHit({ weaponDamage: 100, strength: 100, critDamage: 100 }), { normal: 210, crit: 420 });
  // Sharpness VII + Combat 50: множитель 1 + 2 + 0.65 = 3.65
  const h = meleeHit({ weaponDamage: 100, strength: 100, critDamage: 100, combatLevel: 50, enchants: enchantBonus({ sharpness: 7 }) });
  assert.equal(h.normal, Math.floor(210 * 3.65));
});

test('чары против типа цели работают только против своих', () => {
  near(enchantBonus({ sharpness: 7, smite: 7 }, { types: ['undead'] }), 1.65);
  near(enchantBonus({ sharpness: 7, smite: 7 }, { types: ['ender'] }), 0.65);
  near(enchantBonus({ power: 7 }, {}, 'bow'), 0.65);
});

test('средний удар, частота ударов, DPS', () => {
  const hit = { normal: 100, crit: 300 };
  assert.equal(expectedHit(hit, 50), 200);
  assert.equal(expectedHit(hit, 150), 300, 'Crit Chance выше 100% не помогает');
  assert.equal(meleeHitsPerSecond(0), 2);
  assert.equal(meleeHitsPerSecond(100), 4);
  assert.equal(meleeDps({ hit, critChance: 100, attackSpeed: 0, ferocity: 50 }), 900);
});

test('способность и EHP', () => {
  assert.equal(abilityHit(10000, 1000, 1, 10), Math.floor(10000 * 11 * 1.1));
  assert.deepEqual(ehp(1000, 400, 50), { normal: 5000, true: 1500 });
  assert.equal(damageReduction(100), 0.5);
});

// ---------- боевая сводка ----------
import { itemType, bestMelee, hitGain, mpGainStats, masterReadiness, combatSnapshot } from '../src/calc/power.js';

test('тип предмета по последней строке лора', () => {
  assert.equal(itemType({ lore: ['x', '§6§lLEGENDARY DUNGEON SWORD'] }), 'SWORD');
  assert.equal(itemType({ lore: ['§5§lEPIC BOW'] }), 'BOW');
  assert.equal(itemType({ lore: [] }), null);
});

test('лучший меч: сравниваются только мечи, лук не участвует', () => {
  const member = { inv: { inventory: [
    { id: 'BOW1', name: 'Bow', lore: ['§7Damage: §c+1000', '§5§lEPIC BOW'] },
    { id: 'S1', name: 'Weak', lore: ['§7Damage: §c+100', '§9§lRARE SWORD'] },
    { id: 'S2', name: 'Strong', lore: ['§7Damage: §c+200', '§7Strength: §c+100', '§6§lLEGENDARY SWORD'], enchants: { sharpness: 5 } },
  ] } };
  const b = bestMelee(member, { strength: 100, crit_damage: 100, crit_chance: 50 }, 0);
  assert.equal(b.id, 'S2');
  assert.equal(b.hit.normal, Math.floor(205 * 3 * 1.3));
});

test('прирост удара от Strength и Crit Damage', () => {
  near(hitGain({ strength: 100, crit_damage: 100 }, { strength: 100 }), 0.5);
  assert.equal(hitGain({ strength: 0, crit_damage: 0 }, {}), 0);
});

test('прибавка статов силы от роста MP', () => {
  const d = mpGainStats({ magicalPower: 250, selectedPower: 'forceful' }, 50);
  assert.ok(d.strength > 0 && d.crit_damage > 0);
  assert.deepEqual(mpGainStats({ magicalPower: 250 }, 50), {});
});

test('готовность к M1: MP и звёзды данж-брони', () => {
  const armor = s => ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(x => ({ id: x, stars: s, lore: ['§6§lLEGENDARY DUNGEON ' + x] }));
  assert.equal(masterReadiness({ magicalPower: 800, inv: { armor: armor(5) } }, 1).verdict, 'ready');
  assert.equal(masterReadiness({ magicalPower: 355, inv: { armor: armor(0) } }, 1).verdict, 'early');
  const r3 = masterReadiness({ magicalPower: 1000, inv: { armor: armor(5) } }, 3);
  assert.equal(r3.verdict, 'almost', 'на M3 нужны Master Stars');
});

test('сводка не падает на пустом профиле', () => {
  const s = combatSnapshot({ inv: {} }, {});
  assert.equal(s.world.health, 100);
  assert.equal(s.weapon, null);
  assert.equal(combatSnapshot(null), null);
});

test('Ender Dragon Legendary 100 ур.: +10% к статам (сверено с меню игры)', () => {
  const dragon = { ...steve, pets: [{ type: 'ENDER_DRAGON', tier: 'LEGENDARY', level: 100, active: true }] };
  const plain = statSheet({ ...steve, pets: [] }, { neu });
  const sh = statSheet(dragon, { neu });
  near(sh.total.crit_damage, plain.total.crit_damage * 1.1, 0.05);
  assert.ok(sh.sources.some(s => s.key === 'pet-boost:ENDER_DRAGON'));
  // Epic Ender Dragon такого перка не имеет
  const epic = statSheet({ ...steve, pets: [{ type: 'ENDER_DRAGON', tier: 'EPIC', level: 100, active: true }] }, { neu });
  assert.ok(!epic.sources.some(s => s.key.startsWith('pet-boost')));
});

test('Crit Chance выше 100% не обрезается в листе (как в меню игры)', () => {
  const sh = statSheet({ ...steve, inv: { ...steve.inv, armor: [{ id: 'X', lore: ['§7Crit Chance: §9+150%'] }] } }, { neu });
  assert.equal(sh.total.crit_chance, 190);
});

test('Intelligence без базы: в меню игры строки Base Value нет', () => {
  const sh = statSheet({ ...steve, pets: [] }, { neu });
  assert.equal(sh.total.intelligence || 0, 0);
});

test('Bestiary: +1 Health за этап (сверено с меню игры)', () => {
  const plain = statSheet(steve, { neu });
  const sh = statSheet({ ...steve, bestiaryMilestone: 185 }, { neu });
  near(sh.total.health - plain.total.health, 185);
});

test('бонус аксессуара из строки «Current Bonus» (New Year Cake Bag)', () => {
  assert.deepEqual(bonusLineStats(['§7Current Bonus: §c+7\ue001 Health']), { health: 7 });
  assert.deepEqual(bonusLineStats(['§7Bonus: §c+5 Strength', '§7Bonus: §c+9 Strength']), { strength: 5 });
  assert.deepEqual(bonusLineStats(['§7Health: §c+7']), {});
  const bag = { id: 'NEW_YEAR_CAKE_BAG', lore: ['§7Current Bonus: §c+7 Health'] };
  const withLine = { id: 'X_TALISMAN', lore: ['§7Health: §c+3', '§7Current Bonus: §c+3 Health'] };
  const plain = statSheet(steve, { neu });
  const sh = statSheet({ ...steve, inv: { ...steve.inv, talismans: [...steve.inv.talismans, bag, withLine] } }, { neu });
  // у второго аксессуара обычная строка уже есть: бонус не удваивается
  assert.equal(sh.total.health - plain.total.health, 10);
});

test('песни Melody\'s Harp: Intelligence только за идеальное прохождение', () => {
  assert.equal(harpIntelligence(null), 0);
  const harp = { songs: { hymn_joy: { perfect: 1 }, pachelbel: { best: 1 }, fire_and_flames: { best: 0.8, completions: 3 }, unknown: { perfect: 1 } } };
  assert.equal(harpIntelligence(harp), 1 + 7);
  const sh = statSheet({ ...steve, harp }, { neu });
  assert.equal(sh.sources.find(s => s.key === 'harp').stats.intelligence, 8);
});

test('Voidgloom Seraph 7: +9 Intelligence (в NEU меньше, сверено с меню игры)', () => {
  // как в NEU: запись на каждый уровень
  const neuTable = { 1: { health: 1 }, 2: { intelligence: 1 }, 3: { health: 2 }, 4: { intelligence: 2 }, 5: { health: 3 }, 6: { intelligence: 3 }, 7: { health: 4 } };
  const t = slayerTable(neuTable, 'enderman');
  assert.equal(levelBonus(t, 7).intelligence, 2 + 3 + 4);
  assert.equal(levelBonus(t, 7).health, 1 + 2 + 3 + 4);
  assert.equal(slayerTable(neuTable, 'zombie'), neuTable);
});

test('очки Tuning: 1 за 10 MP и 1 за аксессуар с Accessory Enrichment', () => {
  assert.equal(tuningPoints({ magicalPower: 1059 }), 105);
  const inv = { talismans: [{ id: 'A', enrichment: 'intelligence' }, { id: 'B', upgrades: [{ kind: 'enrichment' }] }, { id: 'C' }] };
  assert.equal(tuningPoints({ magicalPower: 1059, inv }), 107);
  assert.equal(tuningPoints(null), 0);
});
