import test from 'node:test';
import assert from 'node:assert/strict';
import { gemStat, pickGem, slotContent, itemGems, gemPlan, statText, SLOT_GEMS, kitGemHint } from '../src/calc/gems.js';
import { gemRules } from '../src/advisor/lib/rules/gear.js';

// Цены как на Bazaar 28.11.2026 (покупка)
const PRICE = {
  FINE_JADE_GEM: 32_000, FLAWLESS_JADE_GEM: 2_700_000, PERFECT_JADE_GEM: 17_600_000,
  FINE_JASPER_GEM: 43_000, FLAWLESS_JASPER_GEM: 3_600_000, PERFECT_JASPER_GEM: 24_500_000,
  FINE_SAPPHIRE_GEM: 30_000, FLAWLESS_SAPPHIRE_GEM: 2_600_000, PERFECT_SAPPHIRE_GEM: 17_500_000,
  FLAWLESS_RUBY_GEM: 2_500_000, FLAWLESS_AMETHYST_GEM: 2_150_000,
  FINE_AQUAMARINE_GEM: 38_000, FLAWLESS_AQUAMARINE_GEM: 3_070_000, PERFECT_AQUAMARINE_GEM: 15_400_000,
};
const price = id => PRICE[id] || 0;
const COSTS = {
  ROD_OF_THE_SEA: { AQUAMARINE_0: ['SKYBLOCK_COIN:50000', 'FINE_AQUAMARINE_GEM:1'], AQUAMARINE_1: ['SKYBLOCK_COIN:100000', 'FINE_AQUAMARINE_GEM:4'] },
  HYPERION: { COMBAT_0: ['SKYBLOCK_COIN:250000', 'FLAWLESS_JASPER_GEM:1', 'FLAWLESS_SAPPHIRE_GEM:1', 'FLAWLESS_RUBY_GEM:1', 'FLAWLESS_AMETHYST_GEM:1'], SAPPHIRE_0: ['SKYBLOCK_COIN:250000', 'FLAWLESS_SAPPHIRE_GEM:4'] },
  GEMSTONE_GAUNTLET: { AMBER_0: [], AMETHYST_0: [], JADE_0: [], SAPPHIRE_0: [], TOPAZ_0: [] },
  CRIMSON_CHESTPLATE: { COMBAT_0: ['SKYBLOCK_COIN:250000', 'FLAWLESS_JASPER_GEM:1'], COMBAT_1: ['SKYBLOCK_COIN:250000', 'FLAWLESS_JASPER_GEM:1'] },
};

test('гемы: статы по таблице вики (качество × редкость вещи)', () => {
  assert.equal(gemStat('JASPER', 'PERFECT', 'LEGENDARY'), 13);
  assert.equal(gemStat('JADE', 'FINE', 'MYTHIC'), 25);
  assert.equal(gemStat('AMBER', 'PERFECT', 'DIVINE'), 120);
  assert.equal(gemStat('CITRINE', 'PERFECT', 'MYTHIC'), 20); // удвоен в 0.23.3
  assert.equal(gemStat('TOPAZ', 'FLAWLESS', 'EPIC'), 1.6);
  assert.equal(gemStat('ONYX', 'PERFECT', 'EPIC'), 8);
  assert.equal(gemStat('ONYX', 'FINE', 'COMMON'), 3);
  assert.equal(gemStat('SAPPHIRE', 'FLAWED', 'LEGENDARY'), 10);
  assert.equal(gemStat('CITRINE', 'ROUGH', 'COMMON'), 1);
  assert.equal(gemStat('AQUAMARINE', 'PERFECT', 'MYTHIC'), 5); // с 0.22 — Fishing Speed
  assert.equal(gemStat('RUBY', 'PERFECT', 'DIVINE'), 30); // нет на вики для Divine — как Mythic
  assert.equal(gemStat('JADE', 'PERFECT', 'LEGENDARY', 'POWER_RELIC'), 20); // Talisman of Power — половина
  assert.equal(statText('AQUAMARINE', 2.5), '+2,5 Fishing Speed');
  assert.equal(statText('ONYX', 10), '+10% Crit Damage');
  assert.ok(SLOT_GEMS.COMBAT.includes('ONYX') && SLOT_GEMS.COMBAT.includes('OPAL'));
});

test('гемы: камень под роль и разбор NBT слота', () => {
  assert.equal(pickGem('COMBAT', 'melee'), 'JASPER');
  assert.equal(pickGem('COMBAT', 'mage'), 'SAPPHIRE');
  assert.equal(pickGem('DEFENSIVE', 'melee'), 'RUBY');
  assert.equal(pickGem('UNIVERSAL', 'farming'), 'PERIDOT');
  assert.equal(pickGem('SAPPHIRE', 'melee'), 'SAPPHIRE'); // слот одного камня
  // Onyx — только если Strength больше Crit Damage хотя бы на треть
  assert.equal(pickGem('COMBAT', 'melee', { strength: 500, crit_damage: 300 }), 'ONYX');
  assert.equal(pickGem('COMBAT', 'melee', { strength: 500, crit_damage: 400 }), 'JASPER');
  assert.deepEqual(slotContent({ COMBAT_0: 'FLAWLESS', COMBAT_0_gem: 'SAPPHIRE' }, 'COMBAT_0'), { gem: 'SAPPHIRE', quality: 'FLAWLESS' });
  assert.deepEqual(slotContent({ JADE_0: { uuid: 'x', quality: 'PERFECT' } }, 'JADE_0'), { gem: 'JADE', quality: 'PERFECT' });
  assert.equal(slotContent({}, 'JADE_0'), null);
});

test('гемы: слоты Chisel (перки Fossil Excavator) не считаются', () => {
  assert.equal(itemGems({ id: 'REINFORCED_CHISEL', rarity: 'RARE', gems: {} }, { costs: { REINFORCED_CHISEL: { CHISEL_0: [] } }, role: 'mining', price }), null);
});

test('гемы: закрытый слот — цена открытия входит в шаг, качество под бюджет', () => {
  const rod = { id: 'ROD_OF_THE_SEA', name: 'Rod of the Sea', rarity: 'MYTHIC', gems: {} };
  const poor = itemGems(rod, { costs: COSTS, role: 'fishing', price, coins: 60e6 });
  const s = poor.slots[0];
  assert.equal(s.locked, true);
  assert.equal(s.unlock.cost, 50_000 + 38_000);
  assert.equal(s.best, 'FINE'); // 1% от 60 млн — Fine
  assert.equal(s.options.find(o => o.quality === 'FINE').cost, 38_000 + 88_000);
  const rich = itemGems(rod, { costs: COSTS, role: 'fishing', price, coins: 4e9 });
  assert.equal(rich.slots[0].best, 'PERFECT');
});

test('гемы: камень не под роль меняется, снятие платное, старый продаётся', () => {
  const it = { id: 'CRIMSON_CHESTPLATE', rarity: 'LEGENDARY', gems: { unlocked_slots: ['COMBAT_0'], COMBAT_0: 'FLAWLESS', COMBAT_0_gem: 'SAPPHIRE' } };
  const g = itemGems(it, { costs: COSTS, role: 'melee', price, sell: price, coins: 4e9 });
  const s = g.slots.find(x => x.slot === 'COMBAT_0');
  assert.equal(s.wrongType, true);
  assert.equal(s.gem, 'JASPER');
  const p = s.options.find(o => o.quality === 'PERFECT');
  assert.equal(p.cost, 24_500_000 - (2_600_000 - 100_000));
  assert.equal(p.gain, 13);
  // Onyx мечнику подходит: предлагаем только поднять качество Onyx, а не менять на Jasper
  const onyx = itemGems({ ...it, gems: { unlocked_slots: ['COMBAT_0'], COMBAT_0: 'FINE', COMBAT_0_gem: 'ONYX' } }, { costs: COSTS, role: 'melee', price });
  assert.equal(onyx.slots[0].gem, 'ONYX');
  assert.equal(onyx.slots[0].wrongType, false);
});

test('гемы: план — пустые слоты первыми, запас из мешка бесплатно, без рынка без цен', () => {
  const list = [
    { item: { id: 'GEMSTONE_GAUNTLET', name: 'Gemstone Gauntlet', rarity: 'MYTHIC', gems: { AMBER_0: 'FINE', SAPPHIRE_0: 'FINE', AMETHYST_0: 'FINE', TOPAZ_0: 'FINE' } }, role: 'mining', group: 'tool' },
    { item: { id: 'ROD_OF_THE_SEA', name: 'Rod of the Sea', rarity: 'MYTHIC', gems: {} }, role: 'fishing', group: 'tool' },
  ];
  const plan = gemPlan(list, { costs: COSTS, price, coins: 60e6 });
  assert.equal(plan.summary.slots, 7);
  assert.equal(plan.summary.empty, 1);
  assert.equal(plan.summary.locked, 2);
  assert.equal(plan.moves[0].name, 'Fine Jade Gemstone');
  assert.equal(plan.moves[0].text, '+25 Mining Fortune');
  assert.ok(plan.summary.budget.steps >= 3);
  const stocked = gemPlan(list, { costs: COSTS, price, coins: 60e6, stock: { FINE_JADE_GEM: 1 } });
  assert.equal(stocked.moves[0].have, true);
  assert.equal(stocked.moves[0].cost, 0);
  const iron = gemPlan(list, { costs: COSTS, price, coins: 60e6, market: false });
  assert.ok(iron.moves.every(m => m.cost == null));
  assert.equal(iron.summary.budget, null);
});

test('гемы: шаг плана и подсказка для набора', () => {
  const gear = { worn: { armor: [], equipment: [] }, armorSets: [], equipment: [], weapons: [{ id: 'HYPERION', name: 'Hyperion', rarity: 'LEGENDARY', gems: {} }], tools: [{ id: 'GEMSTONE_GAUNTLET', name: 'Gemstone Gauntlet', rarity: 'MYTHIC', gems: { AMBER_0: 'FINE' } }] };
  const steps = [];
  const ctx = { gear, m: { inv: {} }, price, market: true, liquid: 60e6, opts: { constants: { gemstonecosts: COSTS } } };
  gemRules(ctx, s => steps.push(s));
  assert.equal(steps.length, 1);
  assert.equal(steps[0].id, 'gear-gems');
  assert.ok(steps[0].cost > 0);
  assert.match(steps[0].how[0], /Gemstone Gauntlet, Jade слот: вставить Fine Jade Gemstone \(\+25 Mining Fortune\)/);
  const hint = kitGemHint([{ id: 'HYPERION', rarity: 'LEGENDARY', gems: {} }], { costs: COSTS, price, coins: 60e6, fmt: n => String(n) });
  assert.match(hint, /^Гемы: 2 пустых слота/);
});
