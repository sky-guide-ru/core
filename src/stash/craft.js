// «На что потратить» (Ironman, Stranded, Bingo): какие вещи из плана можно скрафтить из своих запасов и чего не хватает.
// Рецепты — NEU (один уровень + сколько недостающего можно скрафтить из того, что лежит). Чистая функция.
import { ownedCount } from '../lib/owned.js';
import { recipeParts, marketId } from './index.js';

const LIMIT = 8;

/** Сколько штук у игрока: инвентарь, сундуки, рюкзаки и мешки (в мешках id вида INK_SACK:3) */
function haveOf(inv, id) {
  const mid = marketId(id);
  return ownedCount(inv, id) + (mid !== id ? Number(inv?.sacks?.[mid]) || 0 : 0);
}

/**
 * @param {Object} member  state.member
 * @param {Object} o { items: NEU Map, name(id), roadmap: [{ id, title, done, items }], cartIds: [] }
 * @returns {{ items: Array<{ id, name, step, ready, parts: Array<{ id, name, need, have, fromStash }> }> }}
 *   ready — сколько рецепта уже есть, в среднем по частям (0..1); fromStash — сколько недостающего можно скрафтить из своих запасов.
 */
export function analyzeCraft(member, o = {}) {
  const inv = member?.inv;
  if (!inv || inv.apiDisabled) return { items: [] };
  const seen = new Set(), out = [];
  const cands = [];
  for (const s of o.roadmap || []) if (!s.done) for (const id of s.items || []) cands.push([id, s.title]);
  for (const id of o.cartIds || []) cands.push([id, null]);
  for (const [id, step] of cands) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (haveOf(inv, id) > 0) continue; // уже есть
    const parts = recipeParts(o.items?.get?.(id));
    if (!parts.length) continue;
    const rows = parts.map(p => {
      const have = haveOf(inv, p.id);
      const miss = Math.max(0, p.count - have);
      let fromStash = 0;
      if (miss) {
        // Недостающее можно скрафтить из того, что лежит (Enchanted Mithril из Mithril и т. п.)
        const sub = recipeParts(o.items?.get?.(p.id));
        if (sub.length && !sub.some(x => x.id === id)) fromStash = Math.min(miss, Math.min(...sub.map(x => Math.floor(haveOf(inv, x.id) / x.count))));
      }
      return { id: p.id, name: o.name?.(p.id) || p.id, need: p.count, have: Math.min(have, p.count), fromStash };
    });
    // Готовность — среднее по частям рецепта: 1 Fermento Boots из 1 весит столько же, сколько 64 Compacted Sunflower
    const ready = rows.reduce((s, r) => s + Math.min(1, (r.have + r.fromStash) / r.need), 0) / rows.length;
    if (!ready) continue; // ничего из рецепта нет — это уже не «потратить запасы»
    out.push({ id, name: o.name?.(id) || id, step, ready, parts: rows });
  }
  out.sort((a, b) => b.ready - a.ready);
  return { items: out.slice(0, LIMIT) };
}
