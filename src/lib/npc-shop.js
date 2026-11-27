// Магазины NPC за монеты (NEU recipes type npc_shop) и короткая подсказка «где добыть» для профилей без рынка.
// Ironman, Stranded и Bingo покупают только у NPC, всё остальное добывают и крафтят сами
// (lib/profile-mode.js). Чистые функции над базой NEU, индекс — общий с «Как получить» (analysis/obtain.js).
import { indexNeu } from '../analysis/obtain.js';
import { ru, tx } from '../../i18n/msg.js';

const strip = s => String(s || '').replace(/§./g, '').trim();
const nameOf = (items, id) => strip(items?.get(id)?.name) || id;

/**
 * Самое дешёвое предложение NPC только за монеты (без предметов и других валют).
 * @returns {{ npc: string, npcName: string, coins: number } | null} coins — за 1 шт.
 */
export function npcCoinOffer(items, id) {
  if (!items?.size || !id) return null;
  const offers = indexNeu(items).npc.get(id) || [];
  let best = null;
  for (const o of offers) {
    if (!o.cost.length || o.cost.some(c => c.id !== 'SKYBLOCK_COIN')) continue;
    const coins = o.cost.reduce((s, c) => s + c.count, 0) / (o.count || 1);
    if (coins > 0 && (!best || coins < best.coins)) best = { npc: o.npc, npcName: nameOf(items, o.npc).replace(/ \(NPC\)$/, ''), coins };
  }
  return best;
}

/** Цена у NPC за монеты, 0 — у NPC за монеты не продаётся. */
export const npcCoinPrice = (items, id) => npcCoinOffer(items, id)?.coins || 0;

// Порядок способов для профиля без рынка: купить у NPC проще всего, потом крафт, потом дроп
export const EASE = { npc: 0, craft: 1, forge: 2, drop: 3, shop: 4, other: 5 };

/**
 * Самый простой способ добыть предмет без Bazaar и аукциона, одной строкой.
 * @returns {{ kind: keyof EASE, text: string, coins?: number }}
 */
export function obtainHint(items, id) {
  const coin = npcCoinOffer(items, id);
  if (coin) return { kind: 'npc', coins: coin.coins, npcName: coin.npcName, text: ru`купить у NPC ${coin.npcName}` };
  if (!items?.size || !id) return { kind: 'other', text: 'добыть самому' };
  const idx = indexNeu(items);
  const craft = (idx.craft.get(id) || [])[0];
  if (craft) {
    const parts = craft.inputs.filter(x => x.id !== id).slice(0, 3).map(x => tx`${nameOf(items, x.id)} ×${x.count}`);
    const req = strip(craft.crafttext).replace(/^Requires:?\s*/i, '');
    return { kind: 'craft', text: ru`скрафтить: ${parts.join(', ')}${craft.inputs.length > 3 ? '…' : ''}${req ? ru` (нужно: ${req})` : ''}` };
  }
  const forge = (idx.forge.get(id) || [])[0];
  if (forge) return { kind: 'forge', text: ru`сделать в Forge: ${forge.inputs.slice(0, 3).map(x => tx`${nameOf(items, x.id)} ×${x.count}`).join(', ')}` };
  const drops = idx.drops.get(id) || [];
  if (drops.length) {
    const d = drops[0];
    return { kind: 'drop', text: ru`выпадает с ${d.name}${d.chance ? tx` (${d.chance})` : ''}${drops.length > 1 ? ru` и ещё ${drops.length - 1}` : ''}` };
  }
  const shop = (idx.npc.get(id) || [])[0];
  if (shop) return { kind: 'shop', text: ru`обменять у NPC ${nameOf(items, shop.npc).replace(/ \(NPC\)$/, '')}` };
  return { kind: 'other', text: 'добыть самому' };
}
