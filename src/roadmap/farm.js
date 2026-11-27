// «План добычи» — вариант «Плана покупок» для профилей без рынка (Ironman, Stranded, Bingo).
// Те же шаги плана по важности, но вместо цены — где взять каждую вещь: у какого NPC (остров, цена в монетах),
// из чего скрафтить (сколько материалов уже лежит у игрока) или с кого выбить (моб, шанс, остров).
// Правки игрока — в том же списке, что и у «Плана покупок» (roadmap/cart.js): убранная строка — skip[«f:ID»],
// своя вещь — custom. Чистая функция над базой NEU.
import { indexNeu, islandRu } from '../analysis/obtain.js';
import { npcCoinOffer } from '../lib/npc-shop.js';
import { ownedCount } from '../lib/owned.js';
import { normCart, DONE_MS } from './cart.js';
import { pruneHidden } from './hidden.js';
import { ru, tx } from '../../i18n/msg.js';

const strip = s => String(s || '').replace(/§./g, '').trim();
export const MAX_ROWS = 40;        // строк в плане добычи
export const MAX_PER_STEP = 6;     // вещей одного шага (сет брони — 4)
// Ключ убранной строки: в id шага нельзя «;» (питомцы TIGER;4) — меняем на «.»
const skipKey = id => `f:${String(id).replace(/;/g, '.')}`;
// Координаты NPC из базы NEU: «x, y, z», если есть
const coordsOf = npc => (npc && npc.x != null && npc.z != null ? [npc.x, npc.y, npc.z].filter(v => v != null).map(v => Math.floor(v)).join(', ') : null);

/** Где взять одну вещь: { kind, where, coins?, parts? } — kind как в lib/npc-shop.js EASE */
export function farmSource(id, { items, constants, inv, qty = 1 } = {}) {
  const idx = items?.size ? indexNeu(items) : null;
  const nm = x => strip(items?.get(x)?.name) || x;
  const coin = npcCoinOffer(items, id);
  if (coin) {
    const npc = items.get(coin.npc);
    const isl = npc?.island ? islandRu(npc.island, constants) : null;
    return { kind: 'npc', coins: Math.round(coin.coins * qty), npc: coin.npc, where: isl ? tx`${coin.npcName}, ${isl}` : coin.npcName, coords: coordsOf(npc) };
  }
  if (!idx) return { kind: 'other', where: '' };
  const craft = (idx.craft.get(id) || [])[0];
  if (craft) {
    const req = strip(craft.crafttext).replace(/^Requires:?\s*/i, '');
    const parts = craft.inputs.filter(x => x.id !== id).slice(0, 4).map(x => {
      const need = Math.ceil(x.count * qty / (craft.count || 1));
      return { id: x.id, name: nm(x.id), need, have: Math.min(need, inv ? ownedCount(inv, x.id) : 0) };
    });
    return { kind: 'craft', where: req ? ru`нужно ${req}` : '', parts };
  }
  const forge = (idx.forge.get(id) || [])[0];
  if (forge) {
    const parts = forge.inputs.slice(0, 4).map(x => ({ id: x.id, name: nm(x.id), need: x.count * qty, have: Math.min(x.count * qty, inv ? ownedCount(inv, x.id) : 0) }));
    return { kind: 'forge', where: 'Forge, Dwarven Mines', parts };
  }
  const drops = idx.drops.get(id) || [];
  if (drops.length) {
    const d = drops[0];
    const isl = d.panorama ? islandRu(d.panorama, constants) : null;
    return { kind: 'drop', where: [d.name, isl, d.chance].filter(Boolean).join(', ') };
  }
  const shop = (idx.npc.get(id) || [])[0];
  if (shop) {
    const npc = items.get(shop.npc);
    const isl = npc?.island ? islandRu(npc.island, constants) : null;
    return { kind: 'shop', where: [nm(shop.npc).replace(/ \(NPC\)$/, ''), isl].filter(Boolean).join(', '), coords: coordsOf(npc) };
  }
  return { kind: 'other', where: '' };
}

/**
 * План добычи с правками игрока.
 * @param {Array} steps — шаги плана (advisor buildRoadmap), уже по важности
 * @param {Object} cart — normCart()
 * @param {{ items: Map, constants?: object, inv?: object, pets?: Array, name?: (id)=>string, now?: number }} o
 * @returns {{ rows: Array, skipped: Array, done: Array, total: number, ready: number, coins: number, lack: number, cart: Object, changed: boolean }}
 *   rows — что добыть по порядку: { kind: 'step'|'item', id, name, stepId?, stepTitle?, payoff?, qty, have, source }
 */
export function buildFarmPlan(steps = [], cart = {}, o = {}) {
  const now = o.now ?? Date.now();
  const c = normCart(cart);
  let changed = false;
  const name = id => o.name?.(id) || strip(o.items?.get(id)?.name) || id;
  const have = id => (o.inv ? ownedCount(o.inv, id, o.pets) : 0);
  const out = [], skipped = [], done = [];
  const seen = new Set();
  for (const s of steps) {
    if (!s?.items?.length) continue;
    for (const id of s.items.slice(0, MAX_PER_STEP)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const row = { kind: 'step', id, name: name(id), stepId: s.id, stepTitle: s.title, payoff: s.payoff || null, qty: 1, have: Math.min(1, have(id)) };
      if (row.have >= row.qty) { done.push(row); continue; }
      if (c.skip[skipKey(id)]) { skipped.push(row); continue; }
      out.push(row);
    }
  }
  // Убранные строки: забываются, если вещи нет в плане дольше суток (как скрытые шаги)
  if (steps.length) {
    const r = pruneHidden(c.skip, [...seen].map(skipKey), now);
    if (r.changed) { c.skip = r.hidden; changed = true; }
  }
  for (const [id, v] of Object.entries(c.custom)) {
    if (seen.has(id)) continue;
    const n = have(id);
    const row = { kind: 'item', id, name: name(id), qty: v.qty, have: Math.min(n, v.qty) };
    if (o.inv && n >= v.qty) {
      if (!v.done) { c.custom[id] = { ...v, done: now }; changed = true; }
      else if (now - v.done > DONE_MS) { delete c.custom[id]; changed = true; continue; }
      done.push(row);
      continue;
    }
    if (v.done) { c.custom[id] = { qty: v.qty, at: v.at }; changed = true; }
    out.push(row);
  }
  const rows = out.slice(0, MAX_ROWS).map(r => ({ ...r, source: farmSource(r.id, { ...o, qty: r.qty - r.have }) }));
  const coins = rows.reduce((sum, r) => sum + (r.source.coins || 0), 0);
  const lack = rows.reduce((sum, r) => sum + (r.source.parts || []).filter(p => p.have < p.need).length, 0);
  const ready = rows.filter(r => r.source.parts?.length && r.source.parts.every(p => p.have >= p.need)).length;
  return { rows, skipped, done, total: rows.length + done.length, ready, coins, lack, cart: c, changed };
}

export { skipKey as farmSkipKey };
