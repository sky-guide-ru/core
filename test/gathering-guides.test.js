import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { guideCtx } from '../src/guides/index.js';
import mining from '../src/guides/mining.js';
import farming from '../src/guides/farming.js';
import foraging from '../src/guides/foraging.js';
import minions, { minionSlots } from '../src/guides/minions.js';
import { treePerks } from '../src/advisor/lib/hotm.js';
import { ownercatMember } from './fixtures/ownercat.js';

const NEU = JSON.parse(fs.readFileSync(new URL('./fixtures/neu-gathering.json', import.meta.url), 'utf8'));

// Профиль Zucchini по реальному снимку API 2026-11-23 (skill_tree, mining_core, garden)
function zucchini() {
  const m = ownercatMember();
  m.mining = {
    hotm: { level: 10, progress: 1 },
    powder: { mithrilAvail: 8_749_860, gemstoneAvail: 27_946_599, glaciteAvail: 680_743 },
    nodes: { core_of_the_mountain: 10, blockhead: 20, eager_adventurer: 55, efficient_miner: 100, fortunate_mineman: 21, gem_lover: 20, great_explorer: 20, keep_it_cool: 50, lonesome_miner: 37, mining_fortune: 50, mining_speed: 48, mole: 200, old_school: 20, powder_buff: 50, professional: 140, quick_forge: 20, seasoned_mineman: 1, sheer_force: 1, sky_mall: 1, speedy_mineman: 50, subterranean_fisher: 40, surveyor: 11, vanguard_seeker: 1, dead_mans_chest: 1, mining_master: 3 },
    potm: 10,
    crystals: { jade: { state: 'NOT_FOUND', placed: 25 }, amber: { state: 'NOT_FOUND', placed: 25 }, amethyst: { state: 'NOT_FOUND', placed: 25 }, sapphire: { state: 'NOT_FOUND', placed: 25 }, topaz: { state: 'NOT_FOUND', placed: 25 } },
    mineshafts: 16, corpses: { lapis: 24, tungsten: 1 },
  };
  m.hotfXp = 28_080;
  m.hotfNodes = { center_of_the_forest: 0 };
  m.gather = { tokensForest: 0, whispers: { forest: { total: 250_122, available: null }, desert: { total: 0, available: null } }, treeGifts: { FIG: 134, MANGROVE: 19, milestone_tier_claimed: { FIG: 2, MANGROVE: 1 } }, hina: { tier_claimed: 1, completed_tasks_count: 20 }, starlyn: { personal_bests: { agatha: 1833 } } };
  m.garden = {
    copper: 4194, experience: 171_632, unlockedPlots: 23, plotIds: ['beginner_1', 'beginner_2', 'beginner_3', 'beginner_4', 'intermediate_1', 'intermediate_2', 'intermediate_3', 'intermediate_4', ...Array.from({ length: 12 }, (_, i) => `advanced_${i + 1}`), 'expert_1', 'expert_2', 'expert_3'],
    cropUpgrades: { MELON: 8, WHEAT: 8, PUMPKIN: 5, NETHER_STALK: 9, MUSHROOM_COLLECTION: 7, 'INK_SACK:3': 5, POTATO_ITEM: 5, CARROT_ITEM: 5, SUGAR_CANE: 8, CACTUS: 5, DOUBLE_PLANT: 1, WILD_ROSE: 1, MOONFLOWER: 7 },
    resources: { WHEAT: 140_824_844, MELON: 805_756_539 }, composter: { cost_reduction: 1 },
    activeVisitors: [{ npc: 'queen_mismyla', items: [{ id: 'ENCHANTED_WHEAT', amount: 241 }] }],
    visitorsServed: 2083, uniqueVisitors: 92,
  };
  m.jacob = { medals: { gold: 31, silver: 15, bronze: 34 }, perks: { farming_level_cap: 10, double_drops: 13 }, personalBests: { WHEAT: 415_354 } };
  return m;
}

const PRICES = { ENCHANTED_WHEAT: 1_000, ENCHANTED_COMPOST: 300_000, COMPOST: 2_000, ENCHANTED_CARROT: 500, ENCHANTED_POTATO: 400 };
const ctxOf = (m, extra = {}) => ({ ...guideCtx(m, {}, { priceOf: id => PRICES[id] || 0, constants: NEU }), ...extra });

test('hotm: перки дерева считают уровни, ряды и остаток Powder по формулам NEU', () => {
  const perks = treePerks({ mining_speed: 48, core_of_the_mountain: 10 }, NEU.hotmlayout.hotm);
  const ms = perks.find(p => p.id === 'mining_speed');
  assert.equal(ms.tier, 1);
  assert.equal(ms.powder, 'MITHRIL');
  assert.equal(ms.left, Math.floor(50 ** 3) + Math.floor(51 ** 3)); // уровни 48→49→50: (level+2)^3
  assert.equal(perks.find(p => p.id === 'core_of_the_mountain').left, 0);
  assert.equal(perks.find(p => p.id === 'mining_master').tier, 10);
  assert.deepEqual(treePerks({}, null), []);
});

test('гайд по добыче: Powder без дела, не взятые перки и кристаллы Nucleus', () => {
  const g = mining.build(zucchini(), ctxOf(zucchini()));
  assert.equal(g.level.value, 10);
  assert.match(g.summary, /HotM 10\/10/);
  const titles = g.next.map(n => n.title).join('\n');
  assert.match(titles, /Gemstone Powder/);
  assert.match(titles, /Не взято перков HotM/);
  const cr = g.sections.find(s => s.title.startsWith('Crystal Hollows'));
  assert.equal(cr.items.length, 5);
  assert.match(cr.note, /25 раз/);
  const tree = g.sections.find(s => s.kind === 'tree');
  assert.equal(tree.perks.length, 46);
  assert.ok(tree.plan.length > 0);
});

test('гайд по Саду: Crop Upgrades по меди, участок, гости, Anita', () => {
  const g = farming.build(zucchini(), ctxOf(zucchini()));
  assert.equal(g.level.value, 15);
  const titles = g.next.map(n => n.title).join('\n');
  assert.match(titles, /Crop Upgrades: 12 культур/);
  assert.match(titles, /Extra Farming Fortune: 13\/15/);
  assert.match(titles, /участок Garden: 23\/24/);
  const plot = g.next.find(n => /участок/.test(n.title));
  assert.match(plot.why, /15× /); // четвёртый экспертный участок стоит 15 Enchanted Compost
  const crops = g.sections.find(s => s.title === 'Культуры');
  assert.equal(crops.rows.length, 13);
  assert.equal(crops.rows.find(r => r[0].text === 'Пшеница')[3], '46/46');
});

test('гайд по Foraging: HotF считается по поуровневой таблице, нераспределённые токены — первый шаг', () => {
  const g = foraging.build(zucchini(), ctxOf(zucchini()));
  assert.equal(g.level.value, 3); // 28 080 опыта: 0 + 3000 + 9000 = 12 000 → 3 уровень, до 4-го нужно 25 000 сверху
  assert.match(g.next[0].title, /Heart of the Forest/);
  // таблица перков или интерактивное дерево из server/guides/trees (когда оно есть)
  assert.ok(g.sections.some(s => s.kind === 'tree' || s.title === 'Дерево Heart of the Forest'));
});

test('гайд по Foraging: топор, Sloth, осколки, Agatha и заработок по живым ценам', () => {
  const m = zucchini();
  m.skills.foraging = { ...m.skills.foraging, level: 24, maxLevel: 50 };
  m.extras = { attributes: [{ id: 'fig_sharpening', n: 3 }] };
  const prices = { ENCHANTED_FIG_LOG: 1_000, FIGSTONE: 200_000, ENCHANTED_MANGROVE_LOG: 2_000, MANGCORE: 250_000, ENCHANTED_HELIX_LOG: 3_000, HELIXIS: 400_000, WOOD_SINGULARITY: 9_000_000 };
  const g = foraging.build(m, { ...guideCtx(m, {}, { priceOf: id => prices[id] || 0, constants: NEU }) });
  assert.equal(foraging.group, 'foraging');
  const titles = g.next.map(n => n.title).join('\n');
  assert.match(titles, /первый топор Galatea/);
  assert.match(titles, /Sloth/);
  assert.match(g.summary, /нет топора Galatea/);
  const money = g.sections.find(s => s.title === 'Заработок с Galatea');
  // Fig: 160 × 1000 = 160 000 → Figstone дороже на 40 000; Helix: 480 000 > 400 000 → минус
  assert.equal(money.rows[0][4].text, '+40 тыс.');
  assert.equal(money.rows[0][4].tone, 'good');
  assert.equal(money.rows[2][4].tone, 'bad');
  assert.match(money.rows[0][2], /^6\s250$/);
  const shards = g.sections.find(s => s.title === 'Осколки Hunting для Foraging');
  assert.equal(shards.rows[0][2].text, '3 осколков');
  const skill = g.sections.find(s => s.title.startsWith('Путь скилла'));
  assert.match(skill.title, /до 50/);
  assert.equal(skill.rows.find(r => r[0] === 25)[2].text, 'нужно ещё 1');
  assert.ok(g.sections.some(s => s.title === 'Agatha, Miria и Starlyn Contests'));
});

test('гайд по миньонам: слоты, самые дешёвые следующие крафты по рецептам', () => {
  assert.deepEqual(minionSlots(0), { slots: 5, nextAt: 5, left: 5 });
  assert.equal(minionSlots(109).slots, 11);
  assert.equal(minionSlots(700).nextAt, null);
  const m = zucchini();
  m.minions = ['WHEAT_1', 'WHEAT_2', 'CARROT_1'];
  const items = new Map([
    ['WHEAT_GENERATOR_3', { id: 'WHEAT_GENERATOR_3', recipe: { A1: 'ENCHANTED_WHEAT:8', B2: 'WHEAT_GENERATOR_2:1' } }],
    ['CARROT_GENERATOR_2', { id: 'CARROT_GENERATOR_2', recipe: { A1: 'ENCHANTED_CARROT:4', B2: 'CARROT_GENERATOR_1:1' } }],
  ]);
  const g = minions.build(m, ctxOf(m, { items }));
  assert.match(g.summary, /3 уникальных/);
  const t = g.sections.find(s => s.title === 'Самые дешёвые следующие крафты');
  assert.equal(t.rows[0][0].text, 'Carrot'); // 4 × 500 дешевле, чем 8 × 1000
  assert.equal(t.rows[1][0].text, 'Wheat');
});
