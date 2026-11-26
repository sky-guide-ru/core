// Запасы игрока: мешки (Sacks) с ценами и эссенции с перками магазина эссенций.
//   GET /api/sacks    — содержимое мешков по видам мешков, цена Bazaar / NPC, что продать
//   GET /api/essence  — эссенции, перки Essence Shop (куплено / осталось), звёзды на своих предметах
// Данные о мешках и перках — NEU constants (sacks.json, essenceshops.json), копия лежит в ./data на случай,
// если сервер ещё не скачал репозиторий NEU.
import { readFileSync } from 'node:fs';
import { islandRu, nearestWarp } from '../analysis/obtain.js';
import { ESSENCE_INFO, PERK_RU, PERK_NAME_RU, ESSENCE_ORDER } from './essence-info.js';
import { tx } from '../../i18n/msg.js';

const local = f => { try { return JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8')); } catch { return null; } };
let LOCAL_SACKS, LOCAL_SHOPS;
const sacksConst = c => c?.sacks?.sacks ? c.sacks : (LOCAL_SACKS ??= local('sacks.json'));
const shopsConst = c => (c?.essenceshops && Object.keys(c.essenceshops).length ? c.essenceshops : (LOCAL_SHOPS ??= local('essenceshops.json')));

// В профиле «INK_SACK:3», в NEU — «INK_SACK-3»
export const neuId = id => String(id).replace(/:(\d+)$/, '-$1');
export const marketId = id => String(id).replace(/-(\d+)$/, ':$1');

/** Ценная позиция мешка, которую стоит продать: от этой суммы показываем «продай». */
export const SELL_HINT = 1_000_000;

/**
 * Разбор мешков.
 * @param {Object} member  state.member (inv.sacks: { ID: count })
 * @param {Object} o  { constants, bazaar(id) → {buy, sell, sellWeek, buyWeek} | null, npc(id) → цена NPC, name(id) }
 */
export function analyzeSacks(member, o = {}) {
  const raw = member?.inv?.sacks || {};
  const def = sacksConst(o.constants)?.sacks || {};
  const sackOf = new Map();
  for (const [name, s] of Object.entries(def)) for (const id of s.contents || []) if (!sackOf.has(id)) sackOf.set(id, name);
  const items = [];
  for (const [id, count] of Object.entries(raw)) {
    if (!(count > 0)) continue;
    const nid = neuId(id), mid = marketId(id);
    const bz = o.bazaar?.(mid) || o.bazaar?.(id) || null;
    const npc = o.npc?.(nid) || o.npc?.(id) || 0;
    const sell = bz?.sell || 0;     // мгновенная продажа (Sell Instantly)
    const offer = bz?.buy || 0;     // выставить Sell Offer (дороже, но ждать)
    const best = Math.max(sell, npc);
    const value = best * count;
    items.push({
      id: nid, marketId: bz ? mid : null, name: o.name?.(nid) || o.name?.(id) || nid, count, sack: sackOf.get(nid) || sackOf.get(id) || null,
      sell, offer, npc, value, offerValue: offer * count, npcValue: npc * count,
      how: !value ? 'none' : npc >= sell ? 'npc' : 'bazaar',
      weekly: bz ? Math.round((bz.sellWeek || 0) / 7) : 0, // сколько в день продают на Bazaar — хватит ли спроса
    });
  }
  items.sort((a, b) => b.value - a.value || b.count - a.count);
  const groups = new Map();
  for (const it of items) {
    const k = it.sack || 'Другое';
    const g = groups.get(k) || { name: k, icon: def[k]?.item || it.id, value: 0, count: 0, kinds: 0, slots: def[k]?.contents?.length || 0 };
    g.value += it.value; g.count += it.count; g.kinds++;
    groups.set(k, g);
  }
  const total = items.reduce((s, x) => s + x.value, 0);
  const offerTotal = items.reduce((s, x) => s + Math.max(x.offerValue, x.npcValue), 0);
  return {
    total, offerTotal, kinds: items.length, count: items.reduce((s, x) => s + x.count, 0),
    groups: [...groups.values()].sort((a, b) => b.value - a.value),
    items,
    sell: items.filter(x => x.value >= SELL_HINT).slice(0, 12),
    apiDisabled: !!member?.inv?.apiDisabled,
  };
}

// ---------- Какие мешки есть, каких нет и какие можно увеличить ----------

// Размеры мешка по возрастанию; у одного вида бывают не все (у Gemstone есть Extra Large, у Witch — только один размер)
const SIZES = [['BEGINNER_', 'начальный'], ['SMALL_', 'маленький'], ['MEDIUM_', 'средний'], ['LARGE_', 'большой'], ['EXTRA_LARGE_', 'очень большой']];
const SIZE_RE = /^(BEGINNER_|SMALL_|MEDIUM_|EXTRA_LARGE_|LARGE_)/;
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15 };

/** Рецепт предмета из NEU: [{ id, count }] без пустых клеток (одинаковые складываем). */
export function recipeParts(item) {
  const r = item?.recipe || (item?.recipes || []).find(x => !x.type || x.type === 'crafting');
  if (!r) return [];
  const sum = new Map();
  for (const [k, v] of Object.entries(r)) {
    if (!/^[A-C][1-3]$/.test(k) || !v) continue;
    const [id, n] = String(v).split(':');
    sum.set(id, (sum.get(id) || 0) + (Number(n) || 1));
  }
  return [...sum].map(([id, count]) => ({ id, count }));
}

const capacityOf = item => {
  for (const l of item?.lore || []) {
    const m = String(l).replace(/§./g, '').match(/Capacity:\s*([\d,]+)/);
    if (m) return Number(m[1].replace(/,/g, ''));
  }
  return null;
};

/**
 * Лестница размеров для каждого вида мешка.
 * @param {Object} member  state.member (inv.sacksBag — Sack of Sacks, inv.sacks — содержимое)
 * @param {Object} o  { constants, items: Map NEU, price(id), name(id), owned: Map id → [item] }
 * @returns {{ families: [...], missing, upgradable, bagSeen }}
 */
export function analyzeSackLadder(member, o = {}) {
  const def = sacksConst(o.constants)?.sacks || {};
  const items = o.items || new Map();
  const ownedIds = new Set([...(o.owned?.keys?.() || [])]);
  for (const it of member?.inv?.sacksBag || []) if (it?.id) ownedIds.add(it.id);
  for (const list of Object.values(member?.inv?.backpacks || {})) for (const it of list || []) if (it?.id) ownedIds.add(it.id);
  for (const it of member?.inv?.backpackItems || []) if (it?.id) ownedIds.add(it.id);
  const bagSeen = (member?.inv?.sacksBag || []).some(Boolean);
  const counts = member?.inv?.sacks || {};
  const price = id => o.price?.(id) || 0;
  // Откуда ещё берётся мешок (NPC, обмен): база items-ru, без рецептов (их считаем сами)
  const whereOf = id => (o.whereToGet?.(id) || []).filter(w => w.kind !== 'craft' && w.subkind !== 'unknown' && w.textRu).slice(0, 2).map(w => {
    let coins = 0, other = 0, priced = true;
    for (const c of w.cost || []) {
      if (c.id === 'SKYBLOCK_COIN') coins += c.count;
      else if (/^SKYBLOCK_/.test(c.id)) priced = false; // Bits, Pests, Motes — не монеты
      else { const p = price(c.id); if (p) other += p * c.count; else priced = false; }
    }
    return { text: w.textRu, coins: priced && (coins || other) ? coins + other : null };
  });
  const families = [];
  for (const [name, s] of Object.entries(def)) {
    const base = String(s.item || '').replace(SIZE_RE, '');
    if (!base) continue;
    const ladder = [];
    for (const [pre, ru] of SIZES) { const id = pre + base; if (items.has(id) || id === s.item) ladder.push({ id, size: ru }); }
    if (!ladder.length) ladder.push({ id: s.item, size: null });
    if (ladder.length === 1) ladder[0].size = null; // один размер — размер не пишем
    let ownedTier = -1;
    ladder.forEach((st, i) => { if (ownedIds.has(st.id)) ownedTier = i; });
    // В мешке лежат вещи этого вида — мешок точно есть, даже если Sack of Sacks не виден
    const hasContents = (s.contents || []).some(id => counts[id] > 0 || counts[marketId(id)] > 0);
    const steps = ladder.map((st, i) => {
      const it = items.get(st.id);
      const parts = recipeParts(it);
      const prev = i > 0 ? ladder[i - 1].id : null;
      const mats = parts.filter(p => p.id !== prev);
      const craftCost = mats.reduce((sum, p) => sum + price(p.id) * p.count, 0);
      const req = String(it?.crafttext || '').match(/Requires:\s*(.+?)\s+([IVX]+)$/);
      return {
        id: st.id, size: st.size, name: o.name?.(st.id) || st.id, capacity: capacityOf(it), owned: i <= ownedTier,
        needsPrev: !!(prev && parts.some(p => p.id === prev)),
        mats: mats.map(p => ({ ...p, name: o.name?.(p.id) || p.id, price: price(p.id) })),
        craftCost: mats.length && mats.every(p => price(p.id) > 0) ? craftCost : null,
        buy: price(st.id) || null,
        collection: req ? { name: req[1], tier: ROMAN[req[2]] || req[2], roman: req[2], milestone: /Milestone/i.test(req[1]) } : null,
        where: whereOf(st.id),
      };
    });
    const state = ownedTier >= ladder.length - 1 ? 'max' : ownedTier >= 0 ? 'upgrade' : hasContents ? 'unknown' : 'missing';
    const next = state === 'max' ? null : steps[Math.max(0, ownedTier + 1)];
    const cheapest = next ? [next.craftCost, next.buy, ...next.where.map(w => w.coins)].filter(x => x > 0).sort((a, b) => a - b)[0] || null : null;
    families.push({ name, icon: s.item, kinds: (s.contents || []).length, state, ownedTier, steps, next: next ? { ...next, cost: cheapest } : null });
  }
  // Объединённые мешки: Events Sack крафтится из Winter Sack и Spooky Sack (они уходят в рецепт).
  // Если есть мешок, в рецепт которого входит мешок другого вида, тот вид считается объединённым, а не «нет».
  const famOf = new Map();
  for (const f of families) for (const st of f.steps) famOf.set(st.id, f);
  for (const f of families) {
    for (const st of f.steps) for (const m of st.mats) {
      const g = famOf.get(m.id);
      if (!g || g === f) continue;
      (f.merges ||= []).includes(g.name) || f.merges.push(g.name);
      g.mergedInto = { name: f.name, id: f.steps[f.steps.length - 1].id };
      if (f.ownedTier >= 0 && g.state !== 'max') { g.state = 'merged'; g.next = null; }
    }
  }
  const order = { upgrade: 0, missing: 1, unknown: 2, merged: 3, max: 3 };
  families.sort((a, b) => order[a.state] - order[b.state] || (a.next?.cost ?? Infinity) - (b.next?.cost ?? Infinity));
  return {
    families, bagSeen,
    missing: families.filter(f => f.state === 'missing').length,
    upgradable: families.filter(f => f.state === 'upgrade').length,
    maxed: families.filter(f => f.state === 'max' || f.state === 'merged').length,
  };
}

// Где стоит NPC магазина: остров, координаты и ближайший /warp (по NEU)
const SEASONAL = { winter: "Остров открыт только в Late Winter (зима SkyBlock), вход через порталы в Hub или /warp winter." };
function shopPlace(npcId, o) {
  const n = npcId && o.items?.get?.(npcId);
  if (!n?.island) return null;
  const x = Number(n.x), y = Number(n.y), z = Number(n.z);
  const has = Number.isFinite(x) && Number.isFinite(z);
  const w = has ? nearestWarp(n.island, x, z, o.constants) : null;
  return {
    npc: String(n.name || n.displayname || npcId).replace(/§./g, '').replace(/\s*\(NPC\)$/, ''),
    island: islandRu(n.island, o.constants), coords: has ? [x, y, z].map(Math.round) : null,
    warp: w?.warp || null, dist: w?.dist ?? null, note: SEASONAL[n.island] || null,
  };
}

const essencePrice = (o, type) => o.price?.(tx`ESSENCE_${type}`) || 0;

/**
 * Разбор эссенций: запас, стоимость, перки магазина и звёзды на своих предметах.
 * @param {Object} member  state.member (essence: { WITHER: n }, perks: { id: lvl })
 * @param {Object} o  { constants, price(id), name(id), owned: Map id → [item] }
 */
export function analyzeEssence(member, o = {}) {
  const have = member?.essence || {};
  const perksOwned = member?.perks || {};
  const shops = shopsConst(o.constants) || {};
  const costs = o.constants?.essencecosts || {};
  const types = [];
  const known = new Set([...ESSENCE_ORDER, ...Object.keys(shops).map(k => k.replace(/^ESSENCE_/, '')), ...Object.keys(have)]);
  for (const type of [...ESSENCE_ORDER.filter(t => known.has(t)), ...[...known].filter(t => !ESSENCE_ORDER.includes(t))]) {
    const amount = have[type] || 0;
    const price = essencePrice(o, type);
    const info = ESSENCE_INFO[type] || { ru: type, what: '', get: [], use: [], shop: null };
    const perks = Object.entries(shops[tx`ESSENCE_${type}`] || {}).map(([key, p]) => {
      const c = p.costs || [];
      const level = Math.min(c.length, Number(perksOwned[key]) || 0);
      const next = level < c.length ? c[level] : null;
      const left = c.slice(level).reduce((s, x) => s + x, 0);
      return { key, name: p.name, ruName: PERK_NAME_RU[key] || null, ru: PERK_RU[key] || null, level, max: c.length, next, left, total: c.reduce((s, x) => s + x, 0), affordable: next != null && amount >= next };
    });
    // Сколько уровней перков можно купить прямо сейчас, если каждый раз брать самый дешёвый следующий уровень
    let pool = amount, buyable = 0;
    const lv = Object.fromEntries(perks.map(p => [p.key, p.level]));
    const shop = shops[tx`ESSENCE_${type}`] || {};
    for (;;) {
      let best = null;
      for (const p of perks) { const c = shop[p.key].costs[lv[p.key]]; if (c != null && (!best || c < best.c)) best = { k: p.key, c }; }
      if (!best || pool < best.c) break;
      pool -= best.c; lv[best.k]++; buyable++;
    }
    // Звёзды на своих предметах этого типа
    const stars = [];
    const seenItem = new Set();
    for (const [id, list] of o.owned || []) {
      const ec = costs[id];
      if (!ec || String(ec.type).toUpperCase() !== type) continue;
      const max = Math.max(...Object.keys(ec).filter(k => /^\d+$/.test(k)).map(Number));
      for (const it of list) {
        const s = Number(it.stars || 0);
        const key = tx`${id}:${s}`;
        if (s >= max || seenItem.has(key)) continue;
        seenItem.add(key);
        let need = 0;
        for (let i = s + 1; i <= max; i++) need += ec[i] || 0;
        const next = ec[s + 1] || 0;
        stars.push({ id, name: o.name?.(id) || it.name || id, stars: s, max, next, need, where: it.where || null, affordable: next > 0 && amount >= next });
      }
    }
    stars.sort((a, b) => Number(b.affordable) - Number(a.affordable) || a.need - b.need);
    const perkLeft = perks.reduce((s, p) => s + p.left, 0);
    // Продавать или тратить: короткий совет к строке «Продать» на карточке
    const sellNote = !amount ? ''
      : buyable ? 'Сначала потрать на перки: уровни можно купить уже сейчас, а перк действует навсегда.'
        : stars.some(x => x.affordable) ? 'Хватает на следующую звезду на твоём предмете — выгоднее вложить туда.'
          : price > 0 && !perkLeft && !stars.length ? 'Перки куплены, звёзды ставить не на что — запас можно продавать.'
            : price > 0 ? 'Если копишь на перк или звезду — держи, лишнее можно продать.' : '';
    types.push({
      sellNote,
      type, id: tx`ESSENCE_${type}`, ru: info.ru, color: info.color || null, area: info.area || null, amount, price, value: amount * price,
      perks, perkLeft, perkDone: perks.filter(p => p.level >= p.max).length, buyable,
      itemsUsing: Object.values(costs).filter(c => String(c.type).toUpperCase() === type).length,
      stars: stars.slice(0, 20), starsCount: stars.length,
      info: { what: info.what, get: info.get, use: info.use, shop: info.shop, shopPlace: shopPlace(info.npc, o) },
    });
  }
  const total = types.reduce((s, t) => s + t.value, 0);
  return { total, types, perksKnown: Object.keys(perksOwned).length > 0 };
}

