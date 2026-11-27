// Цена вещи, которой нет на рынке (Theoretical Hoe и Dicer T3, мешки, крафтовые вещи без лотов): стоимость материалов по рецепту NEU.
// Считаем по низу: ингредиент без цены (Jacob's Ticket, валюты мероприятий) идёт как 0, поэтому оценка не завышена.
// Чистая функция: рецепты и цены передаются снаружи.

const MAX_DEPTH = 4;

/** Ингредиенты первого подходящего рецепта: крафт, Forge или покупка у NPC (монеты отдельно). */
export function recipeInputs(item) {
  const all = [item?.recipe && { type: 'crafting', ...item.recipe }, ...(item?.recipes || [])].filter(Boolean);
  const r = all.find(x => !x.type || x.type === 'crafting') || all.find(x => x.type === 'forge') || all.find(x => x.type === 'npc_shop');
  if (!r) return null;
  const list = r.type === 'forge' ? r.inputs || [] : r.type === 'npc_shop' ? r.cost || []
    : Object.entries(r).filter(([k]) => /^[A-C][1-3]$/.test(k)).map(([, v]) => v);
  const out = new Map();
  for (const v of list) {
    if (!v) continue;
    const [id, n] = String(v).split(':');
    out.set(id, (out.get(id) || 0) + (Number(n) || 1));
  }
  const made = Number(r.count) || 1; // рецепт может давать несколько штук
  return { parts: [...out].map(([id, count]) => ({ id, count: count / made })) };
}

/**
 * @param {string} id
 * @param {(id: string) => number} price цена на рынке (0 — нет)
 * @param {Map<string, any>} items предметы NEU
 * @param {Map<string, number>} [memo]
 */
export function craftValue(id, price, items, memo = new Map(), depth = 0, seen = new Set()) {
  if (memo.has(id)) return memo.get(id);
  if (depth > MAX_DEPTH || seen.has(id)) return 0;
  const rec = recipeInputs(items.get(id));
  if (!rec) { memo.set(id, 0); return 0; }
  seen.add(id);
  let v = 0;
  for (const p of rec.parts) {
    if (p.id === 'SKYBLOCK_COIN') { v += p.count; continue; }
    const pp = price(p.id);
    v += p.count * (pp > 0 ? pp : craftValue(p.id, price, items, memo, depth + 1, seen));
  }
  seen.delete(id);
  memo.set(id, v);
  return v;
}
