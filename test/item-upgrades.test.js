import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planItemUpgrades, classify, bestReforge } from '../src/analysis/item-upgrades.js';

// Мини-копия констант NEU — только то, что нужно для проверок
const constants = {
  enchants: {
    enchants: {
      BOW: ['power', 'cubism', 'overload', 'punch', 'ultimate_soul_eater', 'ultimate_duplex', 'toxophilite'],
      SWORD: ['sharpness', 'smite', 'critical', 'knockback', 'ultimate_wise', 'ultimate_soul_eater', 'experience', 'champion'],
      CHESTPLATE: ['protection', 'blast_protection', 'growth', 'ultimate_legion', 'ultimate_wisdom'],
    },
    enchant_pools: [['sharpness', 'smite'], ['protection', 'blast_protection'], ['ultimate_soul_eater', 'ultimate_duplex', 'ultimate_wise', 'ultimate_legion', 'ultimate_wisdom']],
    enchants_xp_cost: {
      power: [1, 2, 3, 4, 5, 6, 7], cubism: [1, 2, 3, 4, 5, 6], overload: [1, 2, 3, 4, 5], punch: [1, 2], sharpness: [1, 2, 3, 4, 5, 6, 7], smite: [1, 2, 3, 4, 5, 6, 7],
      critical: [1, 2, 3, 4, 5, 6, 7], knockback: [1, 2], experience: [1, 2, 3, 4], champion: [1], toxophilite: [1],
      protection: [1, 2, 3, 4, 5, 6, 7], blast_protection: [1, 2, 3, 4, 5, 6, 7], growth: [1, 2, 3, 4, 5, 6, 7],
      soul_eater: [1, 2, 3, 4, 5], duplex: [1, 2, 3, 4, 5], ultimate_wise: [1, 2, 3, 4, 5], legion: [1, 2, 3, 4, 5], wisdom: [1, 2, 3, 4, 5],
    },
  },
  reforgestones: {
    OPTICAL_LENS: { reforgeName: 'Precise', itemTypes: 'BOW', requiredRarities: ['LEGENDARY'], reforgeCosts: { LEGENDARY: 100000 }, reforgeStats: { LEGENDARY: { strength: 25, crit_chance: 13, crit_damage: 50 } } },
    SPIRIT_DECOY: { reforgeName: 'Spiritual', itemTypes: 'BOW', requiredRarities: ['LEGENDARY'], reforgeCosts: { LEGENDARY: 250000 }, reforgeStats: { LEGENDARY: { strength: 28, crit_chance: 12, crit_damage: 55 } } },
    PRECURSOR_GEAR: { reforgeName: 'Ancient', itemTypes: 'ARMOR', requiredRarities: ['LEGENDARY'], reforgeCosts: { LEGENDARY: 250000 }, reforgeAbility: '§7Grants §9+1 Crit Damage §7per §cCatacombs §7skill level you have.', reforgeStats: { LEGENDARY: { strength: 25, crit_chance: 12, intelligence: 20 } } },
    NECROMANCER_BROOCH: { reforgeName: 'Necrotic', itemTypes: 'ARMOR', requiredRarities: ['LEGENDARY'], reforgeCosts: { LEGENDARY: 100000 }, reforgeStats: { LEGENDARY: { intelligence: 150 } } },
  },
  reforges: { Heroic: { reforgeName: 'Heroic', itemTypes: 'SWORD/ROD', reforgeStats: { LEGENDARY: { strength: 40, intelligence: 100 } } } },
  essencecosts: {
    TERMINATOR: { type: 'Dragon', 1: 100, 2: 200, 3: 300, 4: 500, 5: 750, items: { 4: ['SKYBLOCK_COIN:10000'], 5: ['SKYBLOCK_COIN:25000'] } },
    POWER_WITHER_CHESTPLATE: { type: 'Wither', 1: 150, 2: 300, 3: 500, 4: 900, 5: 1500 },
    CRIMSON_CHESTPLATE: { type: 'Crimson', 1: 30, 2: 35, 3: 40, 4: 45, 5: 50, 6: 55, 7: 60, 8: 70, 9: 80, 10: 90 },
  },
  gemstonecosts: { POWER_WITHER_CHESTPLATE: { COMBAT_0: ['SKYBLOCK_COIN:250000', 'FLAWLESS_JASPER_GEM:1'], JASPER_0: ['SKYBLOCK_COIN:250000', 'FLAWLESS_JASPER_GEM:2'] } },
  misc: { talisman_upgrades: { ENDER_ARTIFACT: ['ENDER_RELIC'] } },
};
const PRICES = {
  RECOMBOBULATOR_3000: 8e6, HOT_POTATO_BOOK: 80e3, FUMING_POTATO_BOOK: 1.2e6, THE_ART_OF_WAR: 9e6, BOOK_OF_STATS: 5e4, ESSENCE_DRAGON: 1500,
  FIRST_MASTER_STAR: 10e6, SECOND_MASTER_STAR: 20e6, THIRD_MASTER_STAR: 40e6, FOURTH_MASTER_STAR: 80e6, FIFTH_MASTER_STAR: 150e6,
  OPTICAL_LENS: 3e5, SPIRIT_DECOY: 2e6, PRECURSOR_GEAR: 1e6, ENCHANTMENT_POWER_7: 20e6, ENCHANTMENT_OVERLOAD_4: 2e6,
  PERFECT_JASPER_GEM: 15e6, FLAWLESS_JASPER_GEM: 3e5, ENDER_RELIC: 300e6, ENDER_ARTIFACT: 60e6, ACCESSORY_ENRICHMENT: 3e6, PET_ITEM_TIER_BOOST: 50e6,
};
const NEU = {
  TERMINATOR: { lore: ['§7Damage: §c+310', '§7Strength: §c+50', '', '§6§lLEGENDARY BOW'] },
  HYPERION: { lore: ['§7Damage: §c+260', '§7Strength: §c+150', '§7Intelligence: §a+350', '', '§6§lLEGENDARY DUNGEON SWORD'] },
  POWER_WITHER_CHESTPLATE: { lore: ['§7Strength: §c+40', '§7Health: §a+260', '', '§6§lLEGENDARY DUNGEON CHESTPLATE'] },
  ENDER_ARTIFACT: { lore: ['', '§5§lEPIC ACCESSORY'] }, ENDER_RELIC: { name: 'Ender Relic', lore: ['', '§6§lLEGENDARY ACCESSORY'] },
  'ENDER_DRAGON;3': { name: 'Ender Dragon' }, 'ENDER_DRAGON;4': { name: 'Ender Dragon' },
};
const ctx = {
  constants, priceOf: id => PRICES[id] || 0, petPriceOf: (id, maxed) => (maxed ? 700e6 : 500e6),
  getItem: id => (NEU[id] ? { id, ...NEU[id] } : null),
  member: { dungeonClass: 'archer', dungeons: { catacombs: { level: 27 } } },
};
const step = (plan, key) => [...plan.todo, ...plan.done].find(s => s.key === key);

test('Terminator: звёзды, мастер-звёзды, книги, чары и рекомб — с ценами и по порядку выгоды', () => {
  const plan = planItemUpgrades({
    id: 'TERMINATOR', rarity: 'LEGENDARY', reforge: 'precise', stars: 5, hpb: 10, recomb: false,
    enchants: { power: 6, cubism: 6, overload: 4, ultimate_soul_eater: 1 }, upgrades: [], lore: NEU.TERMINATOR.lore,
  }, ctx);
  assert.equal(plan.kind, 'weapon');
  assert.equal(plan.role, 'archer');
  assert.equal(step(plan, 'stars').done, true);
  assert.equal(step(plan, 'mstar:1').cost, 10e6);
  assert.equal(step(plan, 'mstar:2').locked, 'сначала предыдущие');
  assert.equal(step(plan, 'hpb').done, true);
  assert.equal(step(plan, 'fpb').cost, 5 * 1.2e6);
  assert.equal(step(plan, 'recomb').cost, 8e6);
  assert.equal(step(plan, 'ench:power').cost, 20e6);
  assert.equal(step(plan, 'ench:cubism').done, true);
  // Overload V нет на рынке — две книги IV
  assert.deepEqual([step(plan, 'ench:overload').cost, step(plan, 'ench:overload').approx], [4e6, true]);
  // Уже стоящая ультимейт-чара остаётся (Soul Eater, не Duplex); Punch не советуем
  assert.ok(step(plan, 'ench:ultimate_soul_eater'));
  assert.ok(!step(plan, 'ench:ultimate_duplex'));
  assert.ok(!step(plan, 'ench:punch'));
  // Precise почти не уступает Spiritual (меньше 10%) — перековывать не надо
  assert.equal(step(plan, 'reforge').done, true);
  // Порядок: заблокированные шаги в конце, номера идут подряд
  assert.deepEqual(plan.todo.map(s => s.order), plan.todo.map((_, i) => i + 1));
  assert.ok(plan.todo.findIndex(s => s.locked) > plan.todo.findIndex(s => s.key === 'mstar:1'));
  assert.ok(plan.missingCost > 0 && plan.score > 0 && plan.score < 100);
});

test('Terminator без ультимейт-чары: советуется Duplex; без реформы — лучшая по статам', () => {
  const plan = planItemUpgrades({ id: 'TERMINATOR', rarity: 'LEGENDARY', stars: 2, enchants: {}, upgrades: [], lore: NEU.TERMINATOR.lore }, ctx);
  assert.ok(step(plan, 'ench:ultimate_duplex'));
  const r = step(plan, 'reforge');
  assert.equal(r.target, 'Spiritual');
  assert.equal(r.cost, 2e6 + 250000);
  const st = step(plan, 'stars');
  assert.equal(st.cost, (300 + 500 + 750) * 1500 + 10000 + 25000);
});

test('Hyperion — оружие мага: Ultimate Wise и реформа Heroic, Knockback и Smite не советуются', () => {
  const it = { id: 'HYPERION', rarity: 'LEGENDARY', enchants: { sharpness: 6 }, upgrades: [], lore: NEU.HYPERION.lore };
  const cls = classify(it, ctx.getItem('HYPERION'), ctx.member);
  assert.equal(cls.role, 'mage');
  const plan = planItemUpgrades(it, ctx);
  assert.ok(step(plan, 'ench:ultimate_wise'));
  assert.ok(!step(plan, 'ench:knockback') && !step(plan, 'ench:smite'));
  assert.equal(step(plan, 'reforge').target, 'Heroic');
  assert.ok(step(plan, 'scroll:IMPLOSION_SCROLL'));
});

test('Броня: реформа с бонусом за Catacombs, самоцветы с открытием слота, взаимоисключающие защиты', () => {
  const it = {
    id: 'POWER_WITHER_CHESTPLATE', rarity: 'LEGENDARY', reforge: 'ancient', stars: 7, hpb: 15, recomb: true,
    enchants: { blast_protection: 5, growth: 7, ultimate_legion: 5 }, gems: { COMBAT_0: 'FLAWLESS', COMBAT_0_gem: 'JASPER', unlocked_slots: ['COMBAT_0'] },
    upgrades: [{ id: 'THE_ART_OF_PEACE', count: 1, kind: 'upgrade' }], lore: NEU.POWER_WITHER_CHESTPLATE.lore,
  };
  const r = bestReforge(it, classify(it, ctx.getItem(it.id), ctx.member), ctx);
  assert.equal(r.best.name, 'Ancient'); // +27 крит. урона за Catacombs 27
  const plan = planItemUpgrades(it, ctx);
  assert.equal(plan.kind, 'armor');
  assert.equal(step(plan, 'reforge').done, true);
  assert.equal(step(plan, 'mstar:2').done, true);
  assert.equal(step(plan, 'mstar:3').done, false);
  assert.ok(!step(plan, 'ench:protection'), 'уже стоит Blast Protection — Protection не советуем');
  assert.ok(step(plan, 'ench:blast_protection'));
  // Flawless → Perfect: доплата = Perfect − цена старого камня
  assert.equal(step(plan, 'gem:COMBAT_0').cost, 15e6 - 3e5);
  // Закрытый слот Jasper: цена открытия входит в шаг
  const jasper = step(plan, 'gem:JASPER_0');
  assert.equal(jasper.cost, 15e6 + 250000 + 2 * 3e5);
  assert.match(jasper.note, /слот закрыт/);
  assert.equal(step(plan, 'aop').done, true);
});

test('Броня Crimson: звёзды до 10 за эссенцию, без мастер-звёзд', () => {
  const plan = planItemUpgrades({ id: 'CRIMSON_CHESTPLATE', rarity: 'LEGENDARY', stars: 6, enchants: {}, upgrades: [], lore: ['', '§6§lLEGENDARY CHESTPLATE'] }, ctx);
  assert.equal(step(plan, 'stars').current, '6 из 10');
  assert.ok(!step(plan, 'mstar:1'));
});

test('Аксессуар: рекомб и следующая версия семейства', () => {
  const plan = planItemUpgrades({ id: 'ENDER_ARTIFACT', name: 'Ender Artifact', rarity: 'EPIC', upgrades: [], lore: NEU.ENDER_ARTIFACT.lore }, ctx);
  assert.equal(plan.kind, 'accessory');
  assert.equal(step(plan, 'acc_upgrade').cost, 300e6 - 60e6);
  assert.ok(step(plan, 'recomb'));
  assert.ok(!step(plan, 'enrichment'), 'обогащение — только с Legendary');
  const leg = planItemUpgrades({ id: 'X', rarity: 'LEGENDARY', upgrades: [], lore: ['', '§6§lLEGENDARY ACCESSORY'] }, ctx);
  assert.equal(step(leg, 'enrichment').cost, 3e6);
  assert.deepEqual(step(leg, 'enrichment').parts.map(p => p.id), ['ACCESSORY_ENRICHMENT']);
  assert.ok(!step(leg, 'reforge'), 'аксессуары больше не перековываются');
  assert.equal(leg.role, null, 'у аксессуара нет роли');
  const div = planItemUpgrades({ id: 'X', rarity: 'DIVINE', upgrades: [], lore: ['', '§b§lDIVINE ACCESSORY'] }, ctx);
  assert.ok(!step(div, 'enrichment'), 'Enrichment — только Legendary и Mythic');
  // Recombobulator на Epic аксессуаре: Epic 12 MP → Legendary 16 MP
  assert.equal(step(plan, 'recomb').gain.mp, 4);
});

test('Аксессуар из Museum: доплата за следующую версию — полная цена, старую не продать', () => {
  const plan = planItemUpgrades({ id: 'ENDER_ARTIFACT', name: 'Ender Artifact', rarity: 'EPIC', museum: true, upgrades: [], lore: NEU.ENDER_ARTIFACT.lore }, ctx);
  const s = step(plan, 'acc_upgrade');
  assert.equal(s.cost, 300e6);
  assert.match(s.why, /не продать/);
});

test('Питомец: уровень, редкость (Tier Boost), предмет', () => {
  const plan = planItemUpgrades({ isPet: true, id: 'ENDER_DRAGON;3', type: 'ENDER_DRAGON', tier: 'EPIC', exp: 1, level: 51, maxLevel: 100 }, ctx);
  assert.equal(plan.kind, 'pet');
  assert.equal(step(plan, 'pet:level').cost, Math.round(200e6 * (1 - 50 / 99)));
  assert.equal(step(plan, 'pet:tier').cost, 50e6);
  assert.equal(step(plan, 'pet:item').done, false);
  const maxed = planItemUpgrades({ isPet: true, id: 'ENDER_DRAGON;4', type: 'ENDER_DRAGON', tier: 'LEGENDARY', exp: 1, level: 100, maxLevel: 100, heldItem: 'MINOS_RELIC' }, ctx);
  assert.equal(maxed.score, 100);
  assert.equal(maxed.todo.length, 0);
});
