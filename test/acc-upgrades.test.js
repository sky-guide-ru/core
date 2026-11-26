import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpgrades, nextUpgrade, NO_RECOMB } from '../src/lib/acc-upgrades.js';

// Кусок NEU misc.talisman_upgrades как есть (в NEU нет ключа PESTHUNTER_ARTIFACT → RELIC)
const RAW = {
  PESTHUNTER_BADGE: ['PESTHUNTER_RING', 'PESTHUNTER_ARTIFACT', 'PESTHUNTER_RELIC'],
  PESTHUNTER_RING: ['PESTHUNTER_ARTIFACT', 'PESTHUNTER_RELIC'],
  ABICASE_RED: ['ABICASE_BLUE', 'ABICASE_GREEN'],
  ABICASE_BLUE: ['ABICASE_RED', 'ABICASE_GREEN'],
  ABICASE_GREEN: ['ABICASE_RED', 'ABICASE_BLUE'],
};

test('линейки аксессуаров: старшая версия закрывает все младшие, даже если в NEU дыра', () => {
  const up = buildUpgrades(RAW);
  assert.deepEqual(up.PESTHUNTER_ARTIFACT, ['PESTHUNTER_RELIC']);
  for (const low of ['PESTHUNTER_BADGE', 'PESTHUNTER_RING', 'PESTHUNTER_ARTIFACT']) assert.ok(up[low].includes('PESTHUNTER_RELIC'), low);
  assert.equal(up.PESTHUNTER_RELIC, undefined);
  assert.equal(nextUpgrade('PESTHUNTER_RING', up), 'PESTHUNTER_ARTIFACT');
  assert.equal(nextUpgrade('PESTHUNTER_ARTIFACT', up), 'PESTHUNTER_RELIC');
});

test('цвета одного предмета (взаимные списки) не превращаются в линейку', () => {
  const up = buildUpgrades(RAW);
  assert.equal(up.ABICASE_RED.length, 2);
  assert.equal(nextUpgrade('ABICASE_RED', up), null);
});

test('аксессуары без рекомба', () => {
  for (const id of ['PANDORAS_BOX', 'BOOK_OF_PROGRESSION', 'BEASTSLAYERS_CODEX', 'VOTER_BADGE', 'VOTER_BADGE_SUPREME', 'RIFT_PRISM']) assert.ok(NO_RECOMB.has(id), id);
});
