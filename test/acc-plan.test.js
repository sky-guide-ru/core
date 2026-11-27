// План «что сделать дальше» в «Аксессуарах»: шаги купить / tier / Recombobulator / Enrichment, место в линейке, стат
import test from 'node:test';
import assert from 'node:assert/strict';
import { neu } from '../src/neu.js';
import { prices } from '../src/prices.js';
import { analyzeAccessories } from '../src/parse/gear.js';
import { statOf } from '../src/parse/acc-meta.js';

test('statOf: первая строка со статом в лоре', () => {
  assert.equal(statOf({ lore: ['§7Strength: §c+3', '§7Crit Damage: §c+1%'] }), 'str');
  assert.equal(statOf({ lore: ['§7Intelligence: §a+5'] }), 'int');
  assert.equal(statOf({ lore: ['§7Grants +1 Tuning Point'] }), 'util');
  assert.equal(statOf(null), 'util');
});

test('analyzeAccessories: шаги плана и tier', () => {
  const items = [
    ['SPEED_TALISMAN', 'Speed Talisman', 'COMMON'], ['SPEED_RING', 'Speed Ring', 'UNCOMMON'], ['SPEED_ARTIFACT', 'Speed Artifact', 'RARE'],
    ['GOLD_RELIC', 'Gold Relic', 'LEGENDARY'], ['BAT_TALISMAN', 'Bat Talisman', 'RARE'], ['BAT_RING', 'Bat Ring', 'EPIC'],
  ];
  const old = { items: neu.items, constants: neu.constants, bin: prices.bin, bz: prices.bazaar };
  neu.items = new Map(items.map(([id, name, rarity]) => [id, { id, name, rarity, type: 'ACCESSORY', lore: [] }]));
  neu.constants = { misc: { talisman_upgrades: { SPEED_TALISMAN: ['SPEED_RING', 'SPEED_ARTIFACT'], BAT_TALISMAN: ['BAT_RING'] } } };
  prices.bin = new Map([['SPEED_ARTIFACT', { price: 3e6 }], ['SPEED_RING', { price: 1e6 }], ['BAT_TALISMAN', { price: 2e6 }], ['BAT_RING', { price: 9e6 }],
    ['RECOMBOBULATOR_3000', { price: 8e6 }], ['ACCESSORY_ENRICHMENT', { price: 4e6 }]]);
  prices.bazaar = new Map();
  try {
    const acc = analyzeAccessories({ inv: { talismans: [
      { id: 'SPEED_RING', name: 'Speed Ring', rarity: 'UNCOMMON', recomb: false },
      { id: 'GOLD_RELIC', name: 'Gold Relic', rarity: 'LEGENDARY', recomb: false },
    ] } });
    const by = Object.fromEntries(acc.list.map(a => [a.id, a]));
    assert.deepEqual(by.SPEED_RING.tier, [2, 3]);
    assert.deepEqual(by.GOLD_RELIC.tier, [1, 1]);
    const k = s => `${s.kind}:${s.id}`;
    const steps = Object.fromEntries(acc.steps.map(s => [k(s), s]));
    // tier: Ring → Artifact, доплата = цена Artifact − стоимость Ring
    assert.equal(steps['tier:SPEED_RING'].cost, 2e6);
    assert.equal(steps['tier:SPEED_RING'].gain, 3);
    // Recombobulator: Uncommon → Rare (+3), Legendary → Mythic (+6)
    assert.equal(steps['recomb:SPEED_RING'].gain, 3);
    assert.equal(steps['recomb:GOLD_RELIC'].gain, 6);
    assert.equal(steps['recomb:GOLD_RELIC'].cost, 8e6);
    // Enrichment — только Legendary и выше, +1 очко Tuning
    assert.equal(steps['enrich:GOLD_RELIC'].tuning, 1);
    assert.equal(steps['enrich:SPEED_RING'], undefined);
    // покупка: одна на семейство Bat — дешевле за 1 MP (Talisman 2 млн / 8 MP против Ring 9 млн / 12 MP)
    assert.equal(acc.steps.filter(s => s.kind === 'buy').map(s => s.id).join(), 'BAT_TALISMAN');
    // порядок — по цене за 1 MP, Enrichment (без MP) в конце
    assert.equal(acc.steps.at(-1).kind, 'enrich');
    assert.equal(acc.enrichPrice, 4e6);
    assert.equal(by.SPEED_RING.sellable, true);
    // Speed Ring сдан в Museum и одолжен обратно: продать нельзя — доплата за Artifact полная, «можно продать» не пишем
    const mu = analyzeAccessories({ inv: { talismans: [{ id: 'SPEED_RING', name: 'Speed Ring', rarity: 'UNCOMMON', recomb: false, museum: true }] } });
    assert.equal(mu.list[0].sellable, false);
    assert.equal(mu.steps.find(s => s.kind === 'tier').cost, 3e6);
  } finally { neu.items = old.items; neu.constants = old.constants; prices.bin = old.bin; prices.bazaar = old.bz; }
});
