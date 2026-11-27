import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiStats } from '../src/lib/api-stats.js';

test('404 у файловых хостов — ответ, а не сбой; у Hypixel — ошибка', () => {
  const s = createApiStats({ clock: () => 1000 });
  s.record('https://cdn.jsdelivr.net/gh/x/items/nope.png', { status: 404 });
  s.record('https://raw.githubusercontent.com/x/blocks/nope.png', { status: 404 });
  s.record('https://api.hypixel.net/v2/skyblock/profiles?uuid=1', { status: 404 });
  const by = Object.fromEntries(s.snapshot().sources.map(x => [x.id, x.state]));
  assert.equal(by['cdn.jsdelivr.net'], 'ok');
  assert.equal(by.neu, 'ok');
  assert.equal(by['hypixel-key'], 'error');
});

test('jsDelivr: 500 и таймаут — по-прежнему ошибка', () => {
  const s = createApiStats({ clock: () => 1000 });
  s.record('https://cdn.jsdelivr.net/gh/x/a.png', { status: 500 });
  assert.equal(s.snapshot().sources[0].state, 'error');
});
