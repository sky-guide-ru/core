import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commissionState, commissionsToNextHotm, commissionGuide, COMMISSION_MILESTONES } from '../src/guides/commissions.js';

const ctxOf = (owned = []) => ({ price: () => 0, name: id => id, has: id => owned.includes(id), m: { inv: {} }, adv: {} });
const member = ({ done = null, claimed = 0, potm = 0, lvl = 4, xp = { xpCurrent: 0, xpForNext: 60000 }, contacts = [] } = {}) => ({
  mining: { hotm: { level: lvl, ...xp }, potm, commissionMilestone: claimed, commissionsDone: done },
  // общее по аккаунту число из /player не должно попадать в профиль
  hypixel: { achievements: [{ key: 'skyblock_hard_working_miner', value: 9999 }] },
  abiphone: { active: contacts },
});

test('вехи заданий: числа из вики', () => {
  assert.deepEqual(COMMISSION_MILESTONES.map(m => m.need), [5, 25, 100, 250, 500, 750]);
  assert.equal(COMMISSION_MILESTONES.reduce((s, m) => s + m.sbxp, 0), 255);
});

test('состояние: слоты, забранная веха, сколько до следующей', () => {
  const s = commissionState(member({ done: 120, claimed: 2, potm: 3 }));
  assert.equal(s.reached, 3);
  assert.equal(s.slots, 4);
  assert.equal(s.next.need, 250);
  assert.equal(s.left, 130);
  // профиль не отдал число заданий — только забранная веха, аккаунтное 9999 не используется
  const s2 = commissionState(member({ claimed: 4 }));
  assert.equal(s2.completions, null);
  assert.equal(s2.reached, 4);
  assert.equal(s2.atLeast, 250);
  assert.equal(s2.slots, 3);
  const g = commissionGuide(member({ claimed: 4, lvl: 6, potm: 3 }), ctxOf());
  assert.ok(!g.next.some(n => /Забери награду/.test(n.title)), 'без числа по профилю шага «забери» нет');
  assert.match(g.sections[0].note, /не меньше 250/);
  assert.doesNotMatch(JSON.stringify(g), /9[ \u00a0]?999/);
});

test('сколько заданий до следующего HotM', () => {
  const t = commissionsToNextHotm({ level: 7, xpCurrent: 10_000, xpForNext: 150_000 });
  assert.equal(t.per, 750);
  assert.equal(t.count, Math.ceil(140_000 / 750));
  assert.equal(t.days, Math.ceil(140_000 / (4 * (750 + 900))));
  assert.equal(commissionsToNextHotm({ level: 1, xpCurrent: 0, xpForNext: 3000 }).per, 100);
  assert.equal(commissionsToNextHotm({ level: 10 }), null);
});

test('гайд: шаг «забери веху», четвёртый слот и голубь', () => {
  const g = commissionGuide(member({ done: 520, claimed: 2, lvl: 6, potm: 1 }), ctxOf());
  const claim = g.next.find(n => /Milestone V/.test(n.title));
  assert.ok(claim, 'шаг про веху V');
  assert.equal(claim.item, 'ROYAL_PIGEON');
  assert.ok(g.next.some(n => /Core of the Mountain 1 → 3/.test(n.title)));
  assert.ok(g.next.some(n => /Royal Pigeon:/.test(n.title)));
  const ms = g.sections.find(s => s.news === 'commissions');
  assert.equal(ms.rows.length, 6);
  assert.equal(ms.current, 5);
  // голубь обменян на контакт — шага нет
  const g2 = commissionGuide(member({ done: 520, claimed: 5, lvl: 6, potm: 3, contacts: ['queen_mismyla'] }), ctxOf());
  assert.equal(g2.next.length, 0);
});

