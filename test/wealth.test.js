// Банк (проценты, счета), Bits (Community Shop) и Maxwell (силы, Tuning)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interestFor, bankAnalysis, nextInterestAt, bankTier, maxInterest } from '../src/analysis/bank.js';
import { bitsAnalysis } from '../src/analysis/bits.js';
import { maxwellAnalysis, powerScale } from '../src/analysis/maxwell.js';
import { BANK_TIERS, SB_EPOCH, SB_SEASON, POWER_STONES } from '../src/analysis/wealth-data.js';
import { ownercatMember } from './fixtures/ownercat.js';

const T = Object.fromEntries(BANK_TIERS.map(t => [t.id, t]));

test('потолки процентов совпадают с гайдом: 250k / 300k / 350k / 390k / 500k', () => {
  assert.deepEqual(['STARTER', 'GOLD', 'DELUXE', 'SUPER_DELUXE', 'PREMIER'].map(id => maxInterest(T[id])), [250_000, 300_000, 350_000, 390_000, 500_000]);
});

test('проценты идут ступенями: 2% на первые 10 млн, потом меньше', () => {
  assert.equal(interestFor(5e6, T.STARTER), 100_000);
  assert.equal(interestFor(12e6, T.STARTER), 220_000);
  assert.equal(interestFor(75.8e6, T.PREMIER), 415_800);
  assert.equal(interestFor(75.8e6, T.SUPER_DELUXE), 390_000);
});

test('следующее начисление — начало сезона, раз в 31 час', () => {
  const now = SB_EPOCH + 100 * SB_SEASON + 5 * 3600_000;
  assert.equal(nextInterestAt(now), SB_EPOCH + 101 * SB_SEASON);
  assert.equal(SB_SEASON, 31 * 3600_000);
});

test('счёт берётся из BANK_UPGRADE_*, а без них — нижняя граница по балансу', () => {
  assert.equal(bankTier({ bankUpgrades: ['BANK_UPGRADE_GOLD', 'BANK_UPGRADE_DELUXE'], bank: 1 }).tier.id, 'DELUXE');
  const g = bankTier({ bankUpgrades: [], bank: 75.8e6 });
  assert.equal(g.tier.id, 'GOLD');
  assert.equal(g.known, false);
});

test('bankAnalysis: Super Deluxe и 75,8 млн — потолок достигнут, Premier окупается', () => {
  const m = { ...ownercatMember(), bankUpgrades: ['BANK_UPGRADE_GOLD', 'BANK_UPGRADE_DELUXE', 'BANK_UPGRADE_SUPER_DELUXE'],
    bankTransactions: [{ amount: 390_000, at: 1000, action: 'DEPOSIT', by: 'Bank Interest' }, { amount: 5e6, at: 2000, action: 'DEPOSIT', by: 'OwnerCat' }] };
  const b = bankAnalysis(m, SB_EPOCH + 10 * SB_SEASON + 1);
  assert.equal(b.tier.id, 'SUPER_DELUXE');
  assert.equal(b.expected, 390_000);
  assert.equal(b.expectedPerDay, Math.round(390_000 * 24 / 31));
  assert.deepEqual(b.last, { amount: 390_000, at: 1000 });
  const prem = b.tiers.find(t => t.id === 'PREMIER');
  assert.equal(prem.gain, 25_800);
  assert.ok(prem.paybackDays > 0);
  assert.ok(b.tips.some(t => t.includes('больше не растут')));
});

test('bankAnalysis без баланса не падает', () => {
  const b = bankAnalysis({ bank: null, personalBank: 0 });
  assert.equal(b.expected, null);
});

test('bitsAnalysis: монет за Bit, лучший товар, личные советы', () => {
  const prices = { KISMET_FEATHER: 2_700_000, GOD_POTION_2: 1_500_000, ENCHANTMENT_HECATOMB_1: 600_000, BOOSTER_COOKIE: 9_600_000 };
  const r = bitsAnalysis(ownercatMember(), { sellPrice: id => prices[id] || 0, buyPrice: id => prices[id] || 0, itemName: id => id, bits: 3000, fame: 8 });
  assert.equal(r.best.id, 'KISMET_FEATHER');
  assert.equal(r.best.perBit, 2000);
  assert.equal(r.items.find(i => i.id === 'HECATOMB;1').price, 600_000);
  assert.equal(r.cookie.bits, 9600); // Ambassador ×2
  assert.equal(r.cookie.coinsPerBit, 1000);
  assert.equal(r.bitsWorth, 6_000_000);
  assert.ok(r.forYou.some(i => i.id === 'GOD_POTION_2'));
});

test('maxwellAnalysis: Silky у лучника, очки Tuning', () => {
  const r = maxwellAnalysis(ownercatMember());
  assert.equal(r.role, 'melee');
  assert.ok(r.powers.find(p => p.power === 'Silky').selected);
  assert.equal(r.tuning.points, 100);
  assert.equal(r.tuning.spent, 100);
  assert.equal(r.tuning.free, 0);
  assert.ok(Math.abs(powerScale(250) - 1) < 1e-9);
  assert.ok(r.scale > 3);
  assert.equal(POWER_STONES.length, r.powers.length);
});
