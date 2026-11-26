// Анализ музея игрока: что засчитано, сколько SkyBlock XP, какая веха, что можно пожертвовать прямо сейчас
// (предметы уже лежат в инвентаре, хранилищах, гардеробе), что дешевле всего докупить и что выгоднее по XP за монету.
// Чистая функция: годится и для своего профиля, и для друзей/Visitors по нику.
import { museumCatalog, CATEGORIES, CATEGORY_BY_ID, MILESTONE_XP, MILESTONES, MILESTONE_REWARDS } from './catalog.js';
import { collectOwned } from '../advisor/lib/util.js';
import { tx } from '../../i18n/msg.js';

const EXTRA_PLACES = [['wardrobeEquipment', 'Wardrobe (экипировка)'], ['potions', 'Potion Bag'], ['fishingBag', 'Fishing Bag']];

/** Все предметы игрока: то же, что видит advisor, плюс экипировка из гардероба. */
export function ownedForMuseum(m) {
  const map = collectOwned(m);
  const inv = m?.inv || {};
  for (const [k, where] of EXTRA_PLACES) {
    for (const it of inv[k] || []) {
      if (!it?.id) continue;
      const arr = map.get(it.id) || [];
      arr.push({ ...it, where });
      map.set(it.id, arr);
    }
  }
  return map;
}

export function milestoneOf(xp) {
  const n = Math.min(MILESTONES, Math.floor((xp || 0) / MILESTONE_XP));
  const nextXp = n >= MILESTONES ? null : (n + 1) * MILESTONE_XP;
  return { n, max: MILESTONES, xp: xp || 0, nextXp, toNext: nextXp == null ? 0 : nextXp - (xp || 0), progress: nextXp == null ? 1 : ((xp || 0) - n * MILESTONE_XP) / MILESTONE_XP, next: nextXp == null ? null : n + 1, rewardsNext: nextXp == null ? [] : MILESTONE_REWARDS[n + 1] || null };
}

/**
 * @param {Object} m  member (server/parse/profile.js): m.museum = { status, keys, borrowing, special, value, appraisal }
 * @param {Object} [o]  { constants, price(id) → монеты, name(id) → имя, owned: Map id → [{ ...item, where }], full: true — список всех записей }
 */
export function analyzeMuseum(m, o = {}) {
  const cat = museumCatalog(o.constants);
  const price = id => { try { const v = Number(o.price?.(id)); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; } };
  const name = id => o.name?.(id) || String(id).toLowerCase().split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
  const mu = m?.museum;
  const base = { total: cat.total, xpMax: cat.xpMax, categories: CATEGORIES.map(c => ({ ...c, total: cat.byCat[c.id].length, xpMax: cat.byCat[c.id].reduce((s, e) => s + e.xp, 0), donated: 0, xp: 0 })) };
  if (!mu || mu.status !== 'ok') {
    return { status: mu?.status === 'off' ? 'off' : 'none', ...base, donated: 0, xp: 0, milestone: milestoneOf(0), value: 0, canDonate: [], cheapest: [], bestValue: [], partialSets: [], borrowed: [], special: { count: 0, items: [] }, milestonePlan: null };
  }

  const direct = new Set(mu.keys || []);
  const borrowing = new Set(mu.borrowing || []);
  // Засчитана ли запись: пожертвована сама или любой её высший тир (рекурсивно)
  const memo = new Map();
  const viaOf = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return null;
    seen.add(id);
    let via = null;
    if (direct.has(id)) via = id;
    else for (const p of cat.entries.get(id)?.parents || []) { const v = viaOf(p, seen); if (v) { via = v; break; } }
    memo.set(id, via);
    return via;
  };
  const counted = id => !!viaOf(id);

  // Сколько XP принесёт запись, если её пожертвовать: своя + все незасчитанные низшие тиры
  const gainOf = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const e = cat.entries.get(id);
    if (!e) return 0;
    let g = counted(id) ? 0 : e.xp;
    for (const c of e.children) g += gainOf(c, seen);
    return g;
  };

  const owned = o.owned || ownedForMuseum(m);
  const ownedPiece = id => {
    for (const alias of [id, `STARRED_${id}`]) {
      const list = (owned.get(alias) || []).filter(it => !it.museum);
      if (list.length) return list[0];
    }
    return null;
  };

  let xp = 0, donated = 0;
  const cats = Object.fromEntries(base.categories.map(c => [c.id, c]));
  const entries = [];
  const canDonate = [], missing = [], partialSets = [];
  for (const e of cat.entries.values()) {
    const via = viaOf(e.id);
    const c = cats[e.cat];
    if (via) { xp += e.xp; donated++; c.xp += e.xp; c.donated++; }
    const status = !via ? 'missing' : direct.has(e.id) ? (borrowing.has(e.id) ? 'borrowed' : 'donated') : 'counted';
    let have = null, pieces = null, cost = 0;
    if (e.set) {
      pieces = e.set.map(p => ({ id: p, have: !!ownedPiece(p), price: price(p) }));
      const got = pieces.filter(p => p.have).length;
      have = got === pieces.length ? pieces.map(p => ownedPiece(p.id)) : null;
      const left = pieces.filter(p => !p.have);
      cost = left.every(p => p.price > 0) ? left.reduce((s, p) => s + p.price, 0) : 0;
      if (!via && got > 0 && got < pieces.length) partialSets.push({ id: e.id, cat: e.cat, xp: e.xp, gain: gainOf(e.id), have: pieces.filter(p => p.have).map(p => p.id), missing: left.map(p => ({ id: p.id, price: p.price || null })), costLeft: cost || null });
    } else {
      const it = ownedPiece(e.id);
      have = it ? [it] : null;
      cost = price(e.id);
    }
    const row = { id: e.id, cat: e.cat, xp: e.xp, status, via: status === 'counted' ? via : undefined, set: e.set || undefined, owned: !!have };
    if (!via) {
      row.gain = gainOf(e.id);
      row.cost = cost || null;
      if (have) {
        const value = (e.set || [e.id]).reduce((s, p) => s + price(p), 0);
        canDonate.push({ id: e.id, cat: e.cat, xp: e.xp, gain: row.gain, set: e.set || undefined, where: [...new Set(have.map(it => it?.where).filter(Boolean))], value: value || null, items: e.set || [e.id] });
      } else {
        missing.push({ id: e.id, cat: e.cat, xp: e.xp, gain: row.gain, set: e.set || undefined, cost: cost || null, perXp: cost && row.gain ? Math.round(cost / row.gain) : null, items: e.set || [e.id] });
      }
    }
    if (o.full) entries.push(row);
  }

  canDonate.sort((a, b) => b.gain - a.gain || a.id.localeCompare(b.id));
  const priced = missing.filter(x => x.cost);
  const cheapest = [...priced].sort((a, b) => a.cost - b.cost);
  const bestValue = [...priced].filter(x => x.gain > 0).sort((a, b) => a.perXp - b.perXp || b.gain - a.gain);
  partialSets.sort((a, b) => (a.costLeft ?? Infinity) - (b.costLeft ?? Infinity));

  const milestone = milestoneOf(xp);
  // Как дойти до следующей вехи: сначала бесплатно (то, что уже есть), потом дешевле всего за XP
  let milestonePlan = null;
  if (milestone.nextXp != null) {
    const steps = [];
    let need = milestone.toNext, coins = 0;
    const taken = new Set();
    const take = (x, c) => {
      // Низший тир уже засчитан высшим из плана — не берём дважды
      if (taken.has(x.id) || [...taken].some(t => isAncestor(cat, t, x.id))) return;
      taken.add(x.id); steps.push({ id: x.id, gain: x.gain, cost: c, items: x.items, free: !c }); need -= x.gain; coins += c;
    };
    for (const x of canDonate) { if (need <= 0) break; take(x, 0); }
    for (const x of bestValue) { if (need <= 0) break; take(x, x.cost); }
    milestonePlan = { target: milestone.next, reached: need <= 0, steps, coins, free: steps.every(s => s.free) };
  }

  const out = {
    status: 'ok',
    ...base,
    categories: Object.values(cats),
    donated, direct: direct.size, xp, milestone,
    value: mu.value || 0, appraisal: !!mu.appraisal,
    canDonate,
    canDonateXp: canDonate.reduce((s, x) => s + x.gain, 0),
    cheapest: cheapest.slice(0, 40),
    bestValue: bestValue.slice(0, 40),
    partialSets: partialSets.slice(0, 30),
    unpriced: missing.length - priced.length,
    missingCount: missing.length + canDonate.length,
    borrowed: [...borrowing].filter(id => cat.entries.has(id)).map(id => ({ id, cat: cat.entries.get(id).cat, xp: cat.entries.get(id).xp, set: cat.entries.get(id).set || undefined })),
    special: { count: (mu.special || []).length, items: (mu.special || []).map(s => s.id) },
    specialOwned: specialOwned(cat, owned, new Set((mu.special || []).map(s => s.id))),
    milestonePlan,
  };
  if (o.full) out.entries = entries;
  // Имена для подсказок и таблиц (id → английское имя)
  const ids = new Set();
  for (const list of [out.canDonate, out.cheapest, out.bestValue, out.borrowed, out.partialSets, milestonePlan?.steps || []]) for (const x of list) { ids.add(x.id); for (const i of x.items || x.set || []) ids.add(i); for (const p of x.missing || []) ids.add(p.id); }
  for (const x of out.specialOwned) ids.add(x.id);
  if (o.full) for (const e of entries) ids.add(e.set ? e.set[0] : e.id);
  out.names = Object.fromEntries([...ids].map(id => [id, cat.entries.get(id)?.set ? setName(cat.entries.get(id).set, name) : name(id)]));
  return out;
}

/** Имя сета по его частям: «Necron's Chestplate» → «Necron's Armor». */
export function setName(pieces, name) {
  const chest = pieces.find(p => /_(CHESTPLATE|TUNIC|SHIRT|JACKET|VEST|ROBE)$/.test(p));
  if (chest) return name(chest).replace(/\s+(Chestplate|Tunic|Shirt|Jacket|Vest|Robe)$/i, '') + ' Armor';
  return tx`${name(pieces[0]).replace(/\s+(Helmet|Boots|Leggings|Belt|Cloak|Necklace|Gloves|Bracelet)$/i, '')} (сет)`;
}

/** Иконка сета: нагрудник, иначе шлем, иначе первая часть. */
export function setIcon(pieces) {
  return pieces.find(p => /_(CHESTPLATE|TUNIC|SHIRT|JACKET|VEST|ROBE)$/.test(p)) || pieces.find(p => /_(HELMET|HAT|MASK|HOOD)$/.test(p)) || pieces[0];
}

function isAncestor(cat, hi, lo, seen = new Set()) {
  if (seen.has(hi)) return false;
  seen.add(hi);
  for (const c of cat.entries.get(hi)?.children || []) if (c === lo || isAncestor(cat, c, lo, seen)) return true;
  return false;
}

// Особые предметы (Special Items), которые лежат у игрока и ещё не в музее: XP не дают, но их можно выставить
function specialOwned(cat, owned, inMuseum) {
  const out = [];
  for (const [id, list] of owned) if (cat.special.has(id) && !inMuseum.has(id) && list.some(it => !it.museum)) out.push({ id, where: [...new Set(list.map(it => it.where))] });
  return out.slice(0, 40);
}

/**
 * Статус одного предмета для карточки: в музее ли он, засчитан ли высшим тиром, можно ли пожертвовать.
 * @returns {null | { entry, cat, catRu, xp, status: 'donated'|'borrowed'|'counted'|'missing'|'special'|'special-donated'|'unknown', via?, set?, gain? }}
 */
export function museumItemStatus(m, itemId, o = {}) {
  const cat = museumCatalog(o.constants);
  const ids = cat.byItem.get(itemId) || [];
  const mu = m?.museum;
  if (!ids.length) {
    if (!cat.special.has(itemId)) return null;
    const inMu = (mu?.special || []).some(s => s.id === itemId);
    return { entry: itemId, status: mu?.status === 'ok' ? (inMu ? 'special-donated' : 'special') : 'unknown', special: true };
  }
  const entryId = ids[0];
  const e = cat.entries.get(entryId);
  const base = { entry: entryId, cat: e.cat, catRu: CATEGORY_BY_ID[e.cat]?.ru, xp: e.xp, set: e.set || undefined, parents: e.parents, children: e.children };
  if (mu?.status !== 'ok') return { ...base, status: 'unknown', apiOff: mu?.status === 'off' };
  const a = analyzeMuseum(m, { ...o, full: true });
  const row = a.entries.find(x => x.id === entryId);
  const nm = id => { const x = cat.entries.get(id); return x?.set ? setName(x.set, o.name || (i => i)) : (o.name?.(id) || id); };
  const names = Object.fromEntries([...e.parents, ...e.children, row.via].filter(Boolean).map(id => [id, nm(id)]));
  return { ...base, status: row.status, via: row.via, gain: row.gain, owned: row.owned, cost: row.cost, names, setName: e.set ? nm(entryId) : undefined, value: a.value };
}
