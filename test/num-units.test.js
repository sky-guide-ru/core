import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitIndex } from '../src/lib/num-units.js';
import { fmtCoins } from '../src/items-ru/lib/glossary.js';
import { fmtCoins as advisorCoins } from '../src/advisor/lib/util.js';
import { short } from '../src/guides/gathering-util.js';

const nb = s => String(s).replace(/ | /g, ' ');

test('единица выбирается после округления: не «1 000 тыс.», а «1 млн»', () => {
  for (const f of [fmtCoins, advisorCoins]) {
    assert.equal(nb(f(999_960)), '1 млн');
    assert.equal(nb(f(999_940)), '999,9 тыс.');
    assert.equal(nb(f(1_020_000)), '1,02 млн');
    assert.equal(nb(f(999_996_000)), '1 млрд');
    assert.equal(nb(f(999_994_000)), '999,99 млн');
    assert.equal(nb(f(-999_960)), '-1 млн');
    assert.equal(nb(f(966_800)), '966,8 тыс.');
  }
  assert.equal(nb(short(999_960)), '1 млн');
  assert.equal(nb(short(999_960_000)), '1 млрд');
  assert.equal(nb(short(9_999)), '9 999');
  assert.equal(nb(short(12_345)), '12,3 тыс.');
});

test('unitIndex', () => {
  const U = [[1e3, 'k', 1], [1e6, 'M', 2]];
  assert.equal(unitIndex(999, U), -1);
  assert.equal(unitIndex(1000, U), 0);
  assert.equal(unitIndex(999_949, U), 0);
  assert.equal(unitIndex(999_950, U), 1);
  assert.equal(unitIndex(5e9, U), 1);
  assert.equal(unitIndex(5000, [[1e3, 'k', 1, 1e4]]), -1);
});
