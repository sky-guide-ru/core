// «Мои лоты»: свои лоты Auction House и ставки игрока со статусом — продан, истёк, перебили цену, перебили ставку.
// Чистые функции: на вход — уже полученные лоты (ключ предмета разобран заранее), на выход — строки для сайта и /v1.
//
// Откуда данные:
// - свои лоты — /v2/skyblock/auction?player=<uuid> (с ключом; там и закончившиеся, но не забранные лоты);
// - свои ставки — полный скан /v2/skyblock/auctions (без ключа): у каждого ставочного лота есть список ставок с uuid;
// - ордера Bazaar Hypixel API не отдаёт вообще (ни в профиле, ни отдельно) — их увидит только мод в игре.

const plain = s => String(s || '').replace(/-/g, '').toLowerCase();
const r1 = x => Math.round(x * 10) / 10;

/**
 * Статус своего лота.
 * sold — продан (BIN купили или ставочный закончился со ставками), монеты ждут в Auction House;
 * expired — время вышло без покупателя, предмет ждёт в Auction House;
 * active — висит на аукционе.
 */
export function listingStatus(a, now = Date.now()) {
  const bids = a.bids?.length || 0;
  if (a.bin && bids) return 'sold';
  if (a.end <= now) return bids ? 'sold' : 'expired';
  return 'active';
}

/**
 * Свои лоты: не забранные закончившиеся сверху (их надо забрать), дальше активные по времени окончания.
 * @param {object[]} auctions ответ /skyblock/auction?player (поле key — ключ предмета для цен, variant — вариант со звёздами/Recombobulator)
 * @param {object} o { uuid, profileId — только лоты этого профиля, now, lowestOf(key) → { price, second, auction } | null }
 */
export function myListings(auctions, { uuid, profileId = null, now = Date.now(), lowestOf = () => null } = {}) {
  const me = plain(uuid), prof = plain(profileId);
  const rows = [];
  for (const a of auctions || []) {
    if (a.claimed) continue;
    if (me && plain(a.auctioneer) !== me) continue;
    if (prof && a.profile_id && plain(a.profile_id) !== prof) continue;
    const status = listingStatus(a, now);
    const count = a.count || 1;
    const top = a.highest_bid_amount || 0;
    const row = {
      id: a.uuid, name: a.item_name || '', tier: a.tier || null, key: a.key || null, count,
      bin: !!a.bin, status, start: a.start || 0, end: a.end || 0,
      price: a.bin ? a.starting_bid : top || a.starting_bid,
      bids: a.bids?.length || 0,
    };
    if (status === 'sold') row.coins = a.bin ? (top || a.starting_bid) : top;
    // Сравнение с рынком — только для висящих BIN: «самый дешёвый» или «есть дешевле на N»
    if (status === 'active' && a.bin) {
      const low = (a.variant && lowestOf(a.variant)) || (a.key && lowestOf(a.key)) || null;
      const per = a.starting_bid / count;
      if (low?.price > 0) {
        const mine = low.auction && plain(low.auction) === plain(a.uuid);
        if (mine) {
          row.cheapest = true;
          if (low.second > 0) row.next = r1(low.second * count); // следующий лот: столько можно было бы просить
        } else if (low.price < per - 0.05) {
          row.undercut = r1((per - low.price) * count); // на сколько дешевле самый дешёвый чужой лот
          row.lowest = r1(low.price * count);
        } else row.cheapest = true;
      }
    }
    rows.push(row);
  }
  const order = { sold: 0, expired: 1, active: 2 };
  rows.sort((x, y) => order[x.status] - order[y.status] || (x.status === 'active' ? x.end - y.end : y.end - x.end));
  return rows;
}

/**
 * Индекс ставок из полного скана: uuid игрока → ставочные лоты, где он ставил.
 * Собирается во время скана (prices.js) и заменяется целиком следующим сканом.
 */
export function createBidIndex() {
  const map = new Map();
  return {
    /** @param {object} a лот из /skyblock/auctions (не BIN, со ставками) @param {string|null} [key] ключ предмета */
    add(a, key = null) {
      if (a.bin || !a.bids?.length) return;
      const top = a.highest_bid_amount || 0;
      const leader = plain(a.bids.reduce((m, b) => (b.amount > (m?.amount || 0) ? b : m), null)?.bidder);
      const mine = new Map(); // bidder → { amount, profile }
      for (const b of a.bids) {
        const k = plain(b.bidder);
        if (!(mine.get(k)?.amount >= b.amount)) mine.set(k, { amount: b.amount, profile: plain(b.profile_id) });
      }
      for (const [bidder, m] of mine) {
        let list = map.get(bidder);
        if (!list) map.set(bidder, (list = []));
        list.push({ id: a.uuid, key, name: a.item_name || '', tier: a.tier || null, end: a.end || 0, top, mine: m.amount, profile: m.profile, leader: leader === bidder, bids: a.bids.length });
      }
    },
    get: uuid => map.get(plain(uuid)) || [],
    get size() { return map.size; },
  };
}

/**
 * Свои ставки: перебитые сверху (на них стоит ответить), дальше по времени окончания.
 * @param {object[]} list строки индекса ставок; profileId — только ставки с этого профиля
 */
export function myBids(list, { profileId = null, now = Date.now() } = {}) {
  const prof = plain(profileId);
  return (list || [])
    .filter(b => b.end > now && (!prof || !b.profile || b.profile === prof))
    .map(b => ({ id: b.id, key: b.key || null, name: b.name, tier: b.tier, end: b.end, mine: b.mine, top: b.top, bids: b.bids, status: b.leader ? 'leading' : 'outbid' }))
    .sort((x, y) => (x.status === 'outbid' ? 0 : 1) - (y.status === 'outbid' ? 0 : 1) || x.end - y.end);
}

/** Итог для шапки блока: сколько забрать монет и предметов, сколько лотов висит и сколько из них перебили */
export function auctionsSummary(listings, bids = []) {
  const s = { coins: 0, sold: 0, expired: 0, active: 0, undercut: 0, outbid: 0, bids: bids.length };
  for (const l of listings) {
    s[l.status]++;
    if (l.status === 'sold') s.coins += l.coins || 0;
    if (l.undercut) s.undercut++;
  }
  for (const b of bids) if (b.status === 'outbid') s.outbid++;
  return s;
}
