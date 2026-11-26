import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listingStatus, myListings, createBidIndex, myBids, auctionsSummary } from '../src/market/my-auctions.js';
import { createPlayerAuctions } from '../src/player-auctions.js';

const NOW = 1_800_000_000_000;
const ME = 'aaaa1111bbbb2222cccc3333dddd4444';
const PROF = '11112222-3333-4444-5555-666677778888';
const lot = o => ({ uuid: 'lot' + Math.random().toString(16).slice(2), auctioneer: ME, profile_id: PROF.replace(/-/g, ''), start: NOW - 3600_000, end: NOW + 3600_000, item_name: 'Hyperion', tier: 'LEGENDARY', starting_bid: 1000, highest_bid_amount: 0, bids: [], claimed: false, bin: true, key: 'HYPERION', count: 1, ...o });

test('статус лота: продан, истёк, висит', () => {
  assert.equal(listingStatus(lot({ bids: [{ amount: 1000 }] }), NOW), 'sold');
  assert.equal(listingStatus(lot({ end: NOW - 1 }), NOW), 'expired');
  assert.equal(listingStatus(lot({ bin: false, end: NOW - 1, bids: [{ amount: 5 }], highest_bid_amount: 5 }), NOW), 'sold');
  assert.equal(listingStatus(lot({ bin: false, bids: [{ amount: 5 }] }), NOW), 'active');
  assert.equal(listingStatus(lot(), NOW), 'active');
});

test('свои лоты: забрать сверху, чужие и забранные мимо, сравнение с самым дешёвым BIN', () => {
  const cheap = lot({ uuid: 'mine1', key: 'A', starting_bid: 100 });
  const dear = lot({ uuid: 'mine2', key: 'B', starting_bid: 300, count: 2 });
  const rows = myListings([
    cheap, dear,
    lot({ uuid: 'sold', bids: [{ amount: 1000 }], highest_bid_amount: 1000 }),
    lot({ uuid: 'exp', end: NOW - 60_000 }),
    lot({ uuid: 'claimed', claimed: true }),
    lot({ uuid: 'other', auctioneer: 'ffff' }),
    lot({ uuid: 'coop', profile_id: 'someotherprofile' }),
  ], {
    uuid: ME, profileId: PROF, now: NOW,
    lowestOf: k => ({ A: { price: 100, second: 140, auction: 'mine1' }, B: { price: 120, second: 130, auction: 'x' } })[k],
  });
  assert.deepEqual(rows.map(r => r.id), ['sold', 'exp', 'mine1', 'mine2']);
  assert.equal(rows[0].coins, 1000);
  const a = rows.find(r => r.id === 'mine1');
  assert.equal(a.cheapest, true); assert.equal(a.next, 140);
  const b = rows.find(r => r.id === 'mine2');
  assert.equal(b.undercut, 60); assert.equal(b.lowest, 240); // за 2 шт.: 300 против 2×120
  const s = auctionsSummary(rows);
  assert.deepEqual([s.coins, s.sold, s.expired, s.active, s.undercut], [1000, 1, 1, 2, 1]);
});

test('ставки: лидер и перебитые, по профилю, закончившиеся мимо', () => {
  const idx = createBidIndex();
  idx.add({ uuid: 'x1', item_name: 'Juju', tier: 'EPIC', end: NOW + 60_000, highest_bid_amount: 200, bin: false,
    bids: [{ bidder: ME, profile_id: PROF, amount: 100 }, { bidder: 'bob', profile_id: 'p', amount: 200 }] }, 'JUJU_SHORTBOW');
  idx.add({ uuid: 'x2', item_name: 'Terminator', tier: 'LEGENDARY', end: NOW + 120_000, highest_bid_amount: 300, bin: false,
    bids: [{ bidder: 'bob', profile_id: 'p', amount: 250 }, { bidder: ME, profile_id: PROF, amount: 300 }] });
  idx.add({ uuid: 'x3', item_name: 'Old', end: NOW - 1, highest_bid_amount: 5, bin: false, bids: [{ bidder: ME, profile_id: PROF, amount: 5 }] });
  idx.add({ uuid: 'bin', bin: true, bids: [{ bidder: ME, amount: 1 }] });
  const rows = myBids(idx.get(ME), { profileId: PROF, now: NOW });
  assert.deepEqual(rows.map(r => [r.id, r.status, r.mine, r.top]), [['x1', 'outbid', 100, 200], ['x2', 'leading', 300, 300]]);
  assert.equal(rows[0].key, 'JUJU_SHORTBOW');
  assert.equal(myBids(idx.get(ME), { profileId: 'другой', now: NOW }).length, 0);
});

test('загрузка: кэш 3 минуты, при сбое — прошлые данные с ошибкой', async () => {
  let calls = 0, fail = false, t = NOW;
  const pa = createPlayerAuctions({
    fetch: async () => { calls++; if (fail) { const e = new Error('лимит'); e.code = 'RATE'; throw e; } return { auctions: [lot({ uuid: 'l1', item_bytes: 'x' })] }; },
    itemOf: async () => ({ key: 'HYPERION', count: 1, variant: null }),
    bids: () => [], lowestOf: () => null, clock: () => t,
  });
  const a = await pa.view({ uuid: ME, profileId: PROF });
  assert.equal(a.listings.length, 1); assert.equal(a.bazaar, false);
  await pa.view({ uuid: ME });
  assert.equal(calls, 1);
  t += 4 * 60_000; fail = true;
  const b = await pa.view({ uuid: ME, profileId: PROF });
  assert.equal(calls, 2); assert.equal(b.listings.length, 1); assert.match(b.error, /лимит/); assert.equal(b.errorCode, 'RATE');
});
