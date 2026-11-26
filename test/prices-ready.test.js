// После перезапуска сервера (автообновление на ПК) цены приходят не сразу: пока их нет,
// оценка состояния = одни монеты, и такая точка не должна попадать в историю
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prices, pricesReady } from '../src/prices.js';

test('pricesReady: ждём Bazaar и аукцион (или ошибку аукциона)', () => {
  const save = { bazaarAt: prices.bazaarAt, binAt: prices.binAt, binError: prices.binError };
  try {
    Object.assign(prices, { bazaarAt: 0, binAt: 0, binError: null });
    assert.equal(pricesReady(), false, 'ничего не пришло');
    prices.bazaarAt = Date.now();
    assert.equal(pricesReady(), false, 'только Bazaar — предметы с аукциона ещё «0»');
    prices.binAt = Date.now();
    assert.equal(pricesReady(), true);
    Object.assign(prices, { binAt: 0, binError: 'fetch failed' });
    assert.equal(pricesReady(), true, 'аукцион не грузится — не ждём вечно');
  } finally { Object.assign(prices, save); }
});
