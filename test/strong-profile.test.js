// Ошибки, найденные на профиле очень сильного игрока (SkyBlock 576): то, что сайт считал «не сделано» или советовал зря
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadmap } from '../src/advisor/index.js';
import { ownercatMember } from './fixtures/ownercat.js';
import { computePetScore } from '../src/analysis/pet-score.js';
import { petScoreMf } from '../src/calc/magic-find.js';
import { chocolateAdvice } from '../src/analysis/chocolate.js';
import { buildKit } from '../src/calc/kit.js';
import { slayerPlan } from '../src/calc/slayer-ready.js';

const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];

test('Pet Score: Phoenix Very Special засчитывается, как в игре', () => {
  const pets = [{ type: 'PHOENIX', tier: 'VERY_SPECIAL', level: 100, maxLevel: 100 }, { type: 'WOLF', tier: 'LEGENDARY', level: 50, maxLevel: 100 }];
  assert.equal(computePetScore(pets).score, 2 + 5);
});

test('Magic Find от Pet Score: пороги выше 325 (в NEU таблица обрывается на +10)', () => {
  const neuTable = { 0: { magic_find: 0 }, 325: { magic_find: 10 } };
  assert.equal(petScoreMf(485, neuTable), 12);
  assert.equal(petScoreMf(500, neuTable), 13);
  assert.equal(petScoreMf(330, neuTable), 10);
});

test('Chocolate больше предела из таблицы — без «67 млрд из 60 млрд»', () => {
  const a = chocolateAdvice({ prestige: 6, employees: {}, chocolate: 67e9 });
  const tip = a.tips.find(t => t.id === 'cf-full');
  assert.ok(tip && !/ из /.test(tip.title), tip?.title);
});

test('кинжалы Blaze с лором «SLAYER SWORD» (как в игре) засчитываются как кинжалы', () => {
  const dagger = (id, dmg) => ({ id, uuid: id, name: id, lore: [`§7Damage: §c+${dmg}`, '§7Strength: §c+75', '§6§lLEGENDARY SLAYER SWORD'], enchants: {} });
  const m = {
    skills: { combat: { level: 60 } }, pets: [],
    slayers: { enderman: { level: 9, kills: { 3: 10 } }, blaze: { level: 9, kills: { 1: 40, 2: 3, 3: 60, 4: 1600 } } },
    inv: { armor: [], equipment: [], wardrobeSets: [], equipmentSets: [], loadouts: [], inventory: [], backpacks: {},
      enderChest: [dagger('HEARTFIRE_DAGGER', 160), dagger('HEARTMAW_DAGGER', 160)] },
  };
  const p = slayerPlan(m, 'blaze', buildKit(m, {}), [5, 25, 100, 500]);
  const t4 = p.tiers[3];
  assert.notEqual(t4.model, 'no-weapon');
  assert.equal(t4.best.weapon.id, 'HEARTFIRE_DAGGER');
  assert.ok(!t4.best.weapon.hypo);
});

test('Kuudra: часть другого сета в том же слоте гардероба (Warden Helmet) не советуем докупать', () => {
  const m = ownercatMember();
  m.crimson.barbarianRep = 13000;
  m.crimson.faction = 'barbarians';
  const pieces = SLOTS.slice(1).map(s => ({ id: `FIERY_CRIMSON_${s}`, name: `Fiery Crimson ${s}`, rarity: 'LEGENDARY', stars: 0 }));
  const helm = { id: 'WARDEN_HELMET', name: 'Ancient Warden Helmet', rarity: 'LEGENDARY' };
  m.inv.wardrobe = [...(m.inv.wardrobe || []), helm, ...pieces];
  m.inv.wardrobeSets = [...(m.inv.wardrobeSets || []), { slot: 8, names: ['Melee'], equipped: false, items: [helm, ...pieces] }];
  const prices = { ESSENCE_CRIMSON: 1000, KUUDRA_TEETH: 50_000, HEAVY_PEARL: 100_000, ...Object.fromEntries(SLOTS.map(s => [`INFERNAL_CRIMSON_${s}`, 300e6])) };
  const s = buildRoadmap(m, null, null, { price: id => prices[id] || 0, constants: {}, itemName: id => id.toLowerCase() }).find(x => x.id === 'gear-kuudra-armor');
  assert.ok(s, 'шаг есть');
  const helmLine = s.how.find(l => l.startsWith('шлем'));
  assert.match(helmLine, /Ancient Warden Helmet/);
  assert.ok(!s.how.some(l => /части нет — купить/.test(l)), s.how.join('\n'));
  assert.ok(s.how.some(l => /купить готовый Infernal Crimson ~900/.test(l)), 'сравнение — по трём частям, которые носит');
});

test('Golden Dragon заменяет Ender Dragon в «недостающих ключевых питомцах»', () => {
  const m = ownercatMember();
  m.pets = [...(m.pets || []).filter(p => p.type !== 'ENDER_DRAGON'), { type: 'GOLDEN_DRAGON', tier: 'LEGENDARY', level: 200, maxLevel: 200, exp: 1e9 }];
  const steps = buildRoadmap(m, null, null, { price: () => 1e6 });
  const miss = steps.find(x => x.id === 'pets-missing');
  assert.ok(!miss || !miss.how.some(l => /Ender Dragon/.test(l)), miss?.how.join('\n'));
});

test('миньоны в коопе: слоты по общим уникальным крафтам', () => {
  const m = ownercatMember();
  const all = [];
  for (const t of ['COW', 'SHEEP', 'WHEAT', 'CARROT', 'POTATO', 'PUMPKIN', 'MELON', 'COBBLESTONE', 'COAL', 'IRON', 'GOLD', 'DIAMOND', 'LAPIS', 'REDSTONE', 'EMERALD', 'OBSIDIAN', 'GLOWSTONE', 'GRAVEL', 'SAND', 'CLAY', 'SNOW', 'ICE', 'ZOMBIE', 'SKELETON', 'SPIDER', 'CREEPER', 'ENDERMAN', 'BLAZE', 'GHAST', 'SLIME'])
    for (let i = 1; i <= 11; i++) all.push(`${t}_${i}`);
  m.minions = all.slice(0, 20);
  m.coop = { ...(m.coop || {}), minions: all };
  const s = buildRoadmap(m, null, null, {}).find(x => x.id === 'minions-slots');
  assert.ok(s, 'шаг есть');
  assert.match(s.why, new RegExp(`Уникальных крафтов: ${all.length} `));
});

test('«Где XP дешевле»: Collections — теми же числами, что раздел «Коллекции»', async () => {
  const { sbxpPlan } = await import('../src/analysis/sbxp.js');
  const m = ownercatMember();
  const rows = sbxpPlan(m, { collections: { tiers: 793, sbXpMax: 3172 } });
  const c = rows.find(r => r.id === 'collections');
  assert.equal(c.have, 3172);
  assert.equal(c.max, 3172);
});
