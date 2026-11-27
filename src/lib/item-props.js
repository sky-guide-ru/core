// Свойства предмета как в блоке «Item Properties» на вики: продаётся NPC, можно передать, выставить на аукцион, сдать в музей.
// Источник — Hypixel /v2/resources/skyblock/items (поля npc_sell_price, soulbound, can_trade, can_auction, museum, museum_data)
// и obtainment — короткая строка «откуда», если в NEU способа получения нет. Чистые функции.

const meta = new Map(); // id → { npc, soulbound, canTrade, canAuction, museum, obtainment }

/** Запомнить нужное из ответа Hypixel (вызывается ядром после getItemsResource) */
export function setItemsResource(items = []) {
  meta.clear();
  for (const it of items) {
    if (!it?.id) continue;
    meta.set(it.id, {
      npc: it.npc_sell_price || 0, soulbound: it.soulbound || null,
      canTrade: it.can_trade !== false, canAuction: it.can_auction !== false,
      museum: !!(it.museum_data || it.museum), obtainment: it.obtainment || null,
    });
  }
}

/**
 * Свойства предмета или null, если Hypixel о нём не знает.
 * На Bazaar и аукционе одновременно предмет не бывает: товар Bazaar на аукцион не выставить.
 * @param {string} id
 * @param {{ bazaar?: boolean }} [opt]
 */
export function itemProps(id, opt = {}) {
  const m = meta.get(id);
  if (!m) return null;
  const tradeable = !m.soulbound && m.canTrade;
  return {
    salable: m.npc > 0, npc: m.npc || 0,
    tradeable, soulbound: m.soulbound,
    auctionable: tradeable && m.canAuction && !opt.bazaar,
    bazaar: !!opt.bazaar,
    museum: m.museum,
  };
}

const TOKEN = /\{(npc|zone|recipe_unlock|item|mob|skill|collection|event|mayor):([^}]+)\}/g;
const title = s => String(s).toLowerCase().split('_').map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

/** Строка «откуда» от Hypixel без служебных меток: «Purchased at the {zone:dark_auction}.» → «Purchased at the Dark Auction.» */
export function obtainmentOf(id, nameOf = null) {
  const s = meta.get(id)?.obtainment;
  // «Recipe unlocked from {recipe_unlock:X}» ничего не объясняет — рецепт и так показан из NEU
  if (!s || /\{recipe_unlock:/.test(s)) return null;
  return s.replace(TOKEN, (_, kind, v) => (kind === 'recipe_unlock' || kind === 'item' ? (nameOf?.(v) || title(v)) : title(v))).replace(/\{[^}]*\}/g, '').replace(/%%[a-z_]+%%/g, '').trim();
}

export const _meta = meta; // для тестов

/**
 * Можно ли продать или передать именно этот экземпляр (предмет из инвентаря, normalizeItem):
 * сданный в Museum и одолженный обратно (donated_museum) и Soulbound / Co-op Soulbound — нельзя.
 * В networth такие вещи остаются, но советовать их продать нельзя.
 */
export function canSellCopy(it) {
  if (!it || it.museum) return false;
  return !(it.lore || []).some(l => /^\*?\s*(Co-op )?Soulbound\s*\*?$/i.test(String(l).replace(/§./g, '').trim()));
}
