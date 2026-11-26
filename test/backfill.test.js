import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeOlder, parseBazaarHistory, parseAuctionHistory } from '../src/market/backfill.js';

const H = 3600_000;
test('дозаполнение истории: только часы до своей первой точки', () => {
  const now = 1_800_000_000_000; const h0 = Math.floor(now / H) * H;
  const store = { X: [[h0 - 2 * H, 10, 9], [h0 - H, 11, 10]] };
  const pts = parseBazaarHistory([
    { timestamp: new Date(h0 - 5 * H).toISOString(), buy: 8, sell: 7 },
    { timestamp: new Date(h0 - 4 * H + 60_000).toISOString(), buy: 9, sell: 8 },
    { timestamp: new Date(h0 - 2 * H).toISOString(), buy: 99, sell: 98 }, // уже есть свои данные — не трогаем
  ]);
  assert.equal(mergeOlder(store, 'X', pts, now), 2);
  assert.deepEqual(store.X.map(p => p[0]), [h0 - 5 * H, h0 - 4 * H, h0 - 2 * H, h0 - H]);
  assert.equal(store.X[2][1], 10);
});
test('перепутанные buy/sell у источника меняются местами', () => {
  const pts = parseBazaarHistory([{ timestamp: '2026-11-20T00:00:00Z', buy: 5, sell: 6 }, { timestamp: '2026-11-20T01:00:00Z', buy: 5, sell: 7 }]);
  assert.ok(pts.every(p => p[1] >= p[2]));
  assert.deepEqual(parseAuctionHistory([{ time: '2026-11-20T00:00:00Z', min: 100, max: 200 }]).map(p => p[1]), [100]);
});
