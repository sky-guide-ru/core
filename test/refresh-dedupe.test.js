// Двойной клик «Обновить» и фоновый цикл не запускают параллельные обновления профиля
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshProfile } from '../src/state.js';

test('refreshProfile: одновременные вызовы делят одно обновление', async () => {
  const a = refreshProfile(), b = refreshProfile();
  assert.equal(a, b, 'второй вызов ждёт первый, а не шлёт свои запросы');
  await a.catch(() => {});
  const c = refreshProfile();
  assert.notEqual(c, a, 'после завершения можно обновить снова');
  await c.catch(() => {});
});
