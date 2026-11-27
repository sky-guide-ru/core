import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upgradeParts } from '../src/parse/upgrades.js';

test('улучшения предмета: гемы, мастер-звёзды, свитки, части дрели', () => {
  const parts = upgradeParts({
    gems: { JADE_0: 'PERFECT', COMBAT_0: { quality: 'FLAWLESS' }, COMBAT_0_gem: 'SAPPHIRE', unlocked_slots: ['COMBAT_0'] },
    upgrade_level: 7, rarity_upgrades: 1, hot_potato_count: 15, art_of_war_count: 1, stats_book: 12879,
    ability_scroll: ['IMPLOSION_SCROLL', 'WITHER_SHIELD_SCROLL', 'SHADOW_WARP_SCROLL'],
    drill_part_engine: 'amber_polished_drill_engine', talisman_enrichment: 'magic_find',
  });
  const ids = parts.map(p => p.id);
  for (const id of ['PERFECT_JADE_GEM', 'FLAWLESS_SAPPHIRE_GEM', 'FIRST_MASTER_STAR', 'SECOND_MASTER_STAR', 'RECOMBOBULATOR_3000',
    'THE_ART_OF_WAR', 'IMPLOSION_SCROLL', 'AMBER_POLISHED_DRILL_ENGINE', 'ACCESSORY_ENRICHMENT']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('THIRD_MASTER_STAR'));
  assert.equal(parts.find(p => p.id === 'BOOK_OF_STATS').count, 1); // в поле число убийств, а книга одна
  assert.equal(parts.find(p => p.id === 'HOT_POTATO_BOOK').count, 10);
  assert.equal(parts.find(p => p.id === 'FUMING_POTATO_BOOK').count, 5);
});

test('улучшения как в SkyHelper: части удочки, Overclocker, Thunder, торты, Sil Ex, улучшенные зачарования', () => {
  const parts = upgradeParts({
    id: 'PULSE_RING', thunder_charge: 6_000_000, levelable_overclocks: 2, cakeYears: [1, 50],
    line: { part: 'titan_line' }, hook: { part: 'hotspot_hook' },
    enchantments: { efficiency: 8, turbo_wheat: 7, smite: 7, scavenger: 5 },
  });
  const get = id => parts.find(p => p.id === id);
  assert.equal(get('THUNDER_IN_A_BOTTLE').count, 100); // заряд ограничен 5 млн
  assert.equal(get('OVERCLOCKER_3000').count, 2);
  assert.ok(get('NEW_YEAR_CAKE_1') && get('NEW_YEAR_CAKE_50'));
  assert.ok(get('TITAN_LINE') && get('HOTSPOT_HOOK'));
  assert.equal(get('SIL_EX').count, 3);
  assert.ok(get('TURBO_GOURD') && get('ENCHANTED_TURBO_GOURD') && get('SEVERED_HAND'));
  assert.ok(!get('GOLDEN_BOUNTY')); // Scavenger V — обычная книга
});

test('Thunder in a Bottle только у Pulse Ring', () => {
  assert.ok(!upgradeParts({ id: 'HYPERION', thunder_charge: 100000 }).some(p => p.id === 'THUNDER_IN_A_BOTTLE'));
});
