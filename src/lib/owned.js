// Что у игрока есть и где лежит: один источник для карточки предмета, рецептов («Как получить») и плана покупок.
// Чистые функции над member.inv (parse/profile.js inventories) и member.pets.
import { tx } from '../../i18n/msg.js';

/** Хранилища member.inv → как назвать место. Rift-инвентарь сюда не входит: из Рифта вещи не выносятся. */
export const OWN_PLACES = {
  inventory: 'инвентарь', armor: 'надето', equipment: 'экипировка', wardrobe: 'гардероб', enderChest: 'эндер-сундук',
  vault: 'личное хранилище', talismans: 'Accessory Bag', quiver: 'колчан', potions: 'Potion Bag', fishingBag: 'Fishing Bag',
  backpackItems: 'рюкзаки', sacksBag: 'Sack of Sacks',
};

const countIn = (list, id) => (Array.isArray(list) ? list : []).reduce((n, it) => n + (it?.id === id ? Number(it.count) || 1 : 0), 0);

/**
 * Где лежит предмет: [[место, штук], …] — «инвентарь ×1 · рюкзак 3 ×2 · мешки ×120».
 * pets — member.pets: питомец «TYPE;тир» считается, если такой есть в меню Pets.
 */
export function whereOwned(inv, id, pets = null) {
  if (!id) return [];
  const out = [];
  if (inv) {
    for (const [k, label] of Object.entries(OWN_PLACES)) { const n = countIn(inv[k], id); if (n) out.push([label, n]); }
    for (const [k, list] of Object.entries(inv.backpacks || {})) { const n = countIn(list, id); if (n) out.push([tx`рюкзак ${Number(k) + 1}`, n]); }
    const s = Number(inv.sacks?.[id]) || 0;
    if (s > 0) out.push(['мешки', s]);
  }
  if (/;\d+$/.test(id) && Array.isArray(pets)) { const n = pets.filter(p => p?.id === id).length; if (n) out.push(['Pets', n]); }
  return out;
}

/** Сколько штук всего (во всех местах). */
export function ownedCount(inv, id, pets = null) {
  return whereOwned(inv, id, pets).reduce((s, [, n]) => s + n, 0);
}

/**
 * Запас игрока на один способ получения: Map id → { n, where: [[место, штук]] }.
 * Каждая вещь берётся один раз на всё дерево ингредиентов (takeOwned уменьшает n).
 * Считается лениво: место ищется только для тех id, что встретились в рецепте.
 */
export function ownedPool(member) {
  const inv = member?.inv, pets = member?.pets;
  if (!inv && !Array.isArray(pets)) return null;
  const cache = new Map();
  return {
    get(id) {
      if (!cache.has(id)) { const where = whereOwned(inv, id, pets); cache.set(id, { n: where.reduce((s, [, n]) => s + n, 0), where }); }
      return cache.get(id);
    },
  };
}

/** Взять из запаса до count штук: → { have, where } (where — места, откуда взято, по порядку). */
export function takeOwned(pool, id, count) {
  const e = pool?.get(id);
  if (!e || e.n <= 0 || count <= 0) return { have: 0, where: [] };
  const have = Math.min(count, e.n);
  // места, из которых берём: сначала то, что лежит дальше от расхода — уже взятое отбрасываем
  const used = e.where.reduce((s, [, n]) => s + n, 0) - e.n;
  const where = [];
  let skip = used, left = have;
  for (const [label, n] of e.where) {
    const avail = Math.max(0, n - skip); skip = Math.max(0, skip - n);
    if (!avail || !left) continue;
    const t = Math.min(avail, left); left -= t; where.push([label, t]);
  }
  e.n -= have;
  return { have, where };
}
