// «Мои аксессуары»: пробелы на своих аксессуарах (следующий tier, без рекомба, без enrichment)
import test from 'node:test';
import assert from 'node:assert/strict';
import { neu } from '../src/neu.js';
import { analyzeAccessories } from '../src/parse/gear.js';

test('analyzeAccessories помечает next / canRecomb / canEnrich', () => {
  const items = [
    ['SPEED_TALISMAN', 'Speed Talisman', 'COMMON'], ['SPEED_RING', 'Speed Ring', 'UNCOMMON'], ['SPEED_ARTIFACT', 'Speed Artifact', 'RARE'],
    ['BAT_TALISMAN', 'Bat Talisman', 'RARE'], ['BAT_RING', 'Bat Ring', 'EPIC'],
    ['GOLD_RELIC', 'Gold Relic', 'LEGENDARY'], ['PANDORAS_BOX', "Pandora's Box", 'RARE'],
  ];
  const old = { items: neu.items, constants: neu.constants };
  neu.items = new Map(items.map(([id, name, rarity]) => [id, { id, name, rarity, type: 'ACCESSORY' }]));
  neu.constants = { misc: { talisman_upgrades: { SPEED_TALISMAN: ['SPEED_RING', 'SPEED_ARTIFACT'], BAT_TALISMAN: ['BAT_RING'] } } };
  try {
    const member = { inv: { talismans: [
      { id: 'SPEED_TALISMAN', name: 'Speed Talisman', rarity: 'COMMON' },
      { id: 'SPEED_RING', name: 'Speed Ring', rarity: 'UNCOMMON', recomb: false },
      { id: 'BAT_RING', name: 'Bat Ring', rarity: 'LEGENDARY', recomb: true },
      { id: 'GOLD_RELIC', name: 'Gold Relic', rarity: 'LEGENDARY', recomb: false, enrichment: 'strength' },
      { id: 'PANDORAS_BOX', name: "Pandora's Box", rarity: 'RARE' },
    ] } };
    const acc = analyzeAccessories(member);
    const by = Object.fromEntries(acc.list.map(a => [a.id, a]));
    // Ring перекрывает Talisman; у Ring есть Artifact
    assert.equal(by.SPEED_TALISMAN.active, false);
    assert.equal(by.SPEED_TALISMAN.next, null);
    assert.equal(by.SPEED_RING.next?.id, 'SPEED_ARTIFACT');
    assert.equal(by.SPEED_RING.next?.name, 'Speed Artifact');
    assert.equal(by.BAT_RING.next, null);
    // рекомб: не на неактивных, не на уже рекомбнутых, не на Pandora's Box
    assert.equal(by.SPEED_RING.canRecomb, true);
    assert.equal(by.SPEED_TALISMAN.canRecomb, false);
    assert.equal(by.BAT_RING.canRecomb, false);
    assert.equal(by.PANDORAS_BOX.canRecomb, false);
    assert.equal(by.GOLD_RELIC.canRecomb, true);
    assert.equal(acc.notRecombCount, 2);
    // enrichment — Legendary и выше
    assert.equal(by.BAT_RING.canEnrich, true);
    assert.equal(by.SPEED_RING.canEnrich, false);
    assert.equal(by.GOLD_RELIC.enrichment, 'strength');
  } finally { neu.items = old.items; neu.constants = old.constants; }
});
