import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bestiaryFamilies, familyProgress, bestiarySummary, cheapestTiers, tierBonus, spotOf } from '../src/calc/bestiary.js';
import { milestoneCombatXp } from '../src/guides/bestiary-data.js';
import { buildGuide } from '../src/guides/index.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const B = JSON.parse(fs.readFileSync(new URL('./fixtures/neu-bestiary.json', import.meta.url)));
const fam = name => bestiaryFamilies(B).find(f => f.name === name);

test('bestiary: семейства и пороги совпадают с вики (28.11.2026)', () => {
  const all = bestiaryFamilies(B);
  assert.ok(all.length > 300);
  const ghoul = fam('Crypt Ghoul');
  assert.equal(ghoul.steps.length, 20);       // bracket 2, максимум 25 000
  assert.equal(ghoul.cap, 25_000);
  assert.equal(fam('Zealot').steps.length, 25);
  assert.equal(fam('Azure').reward, 'critter'); // bracketType CRITTERS
  assert.equal(fam('Azure').steps.length, 10);
  assert.equal(fam('Beetle').reward, 'pest');
  assert.ok(all.some(f => f.cat === 'fishing/lava' && f.name === 'Lord Jawbus'));
});

test('bestiary: уровень по убийствам, бонус 3 × уровень', () => {
  const [g] = familyProgress({ unburried_zombie_30: 260 }, [fam('Crypt Ghoul')]);
  assert.equal(g.tier, 7);                     // 5,10,15,25,50,100,200 ≤ 260 < 350
  assert.equal(g.next, 350);
  assert.deepEqual(tierBonus(g), { mf: 21, str: 21 });
  assert.deepEqual(tierBonus({ reward: 'pest' }, 15), { ff: 6 });
  assert.deepEqual(tierBonus({ reward: 'critter' }, 10), { hf: 10, hxp: 100 });
});

test('bestiary: вехи — каждые 10 уровней, неполученные награды, Combat XP', () => {
  const kills = { unburried_zombie_30: 25_000, zealot_enderman_55: 0 };
  const s = bestiarySummary({ bestiaryKills: kills, bestiaryMilestone: 1 }, B);
  assert.equal(s.tiers, 20);
  assert.equal(s.milestone, 2);
  assert.equal(s.unclaimed, 1);
  assert.equal(s.toNext, 10);
  assert.equal(milestoneCombatXp(5), 5_000);
  assert.equal(milestoneCombatXp(105), 1_000_000);
  assert.equal(milestoneCombatXp(7), 0);
});

test('bestiary: план до вехи — дешёвые уровни, без событий, по порядку уровней', () => {
  const s = bestiarySummary({ bestiaryKills: {} }, B);
  const total = s.plan.reduce((n, r) => n + r.tiers, 0);
  assert.equal(total, 10);
  for (const r of s.plan) {
    assert.notEqual(spotOf(r.f).place.kind, 'event', `${r.f.name} из события в плане`);
    assert.equal(r.to, r.f.tier + r.tiers);
  }
  // Новичку дешевле всего первые уровни на своём острове и в Hub, а не Kuudra
  assert.ok(s.plan.every(r => !r.f.cat.startsWith('kuudra')));
  // Один раз взятое семейство не перескакивает уровни
  const p = cheapestTiers(familyProgress({}, [fam('Crypt Ghoul')]), 3);
  assert.equal(p[0].tiers, 3);
  assert.equal(p[0].kills, 15);
});

test('гайд Bestiary: собирается по профилю и без констант', () => {
  const m = ownercatMember();
  m.bestiaryKills = { unburried_zombie_30: 1200, zealot_enderman_55: 4000, caverns_ghost_250: 50 };
  m.bestiaryMilestone = 3;
  const deps = { priceOf: id => PRICES[id] || 0, constants: { bestiary: B } };
  const g = buildGuide('bestiary', m, {}, deps);
  assert.notEqual(g.status, 'error', g.summary);
  assert.equal(g.level.label, 'Bestiary Milestone');
  assert.ok(g.sections.some(x => x.title.startsWith('До вехи')));
  assert.ok(g.next.length > 0);
  const empty = buildGuide('bestiary', m, {}, { priceOf: () => 0 });
  assert.notEqual(empty.status, 'error');
});
