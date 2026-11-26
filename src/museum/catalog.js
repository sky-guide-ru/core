// Каталог музея: какие предметы и сеты брони принимает музей, сколько SkyBlock XP даёт каждый,
// какой высший тир засчитывает низший (Aspect of the Void засчитывает Aspect of the End) и т. п.
//
// Источник — constants/museum.json из репозитория NEU (его собирает скрипт из Hypixel items API,
// поле museum_data). Если NEU не загрузился, берётся копия из data/museum-neu.json.
//
// Устройство музея (проверено по записи меню Hypixel, октябрь 2026, и по items API):
// - 7 категорий навыков (Combat, Farming, Mining, Fishing, Foraging, Dungeoneering, Hunting) + Special Items.
// - Запись — предмет (вместе со «звёздной» версией: STARRED_BONZO_STAFF = BONZO_STAFF) или сет брони целиком.
// - Пожертвованный высший тир засчитывает все низшие (children в NEU: ключ засчитывает значение).
// - Каждая запись даёт SkyBlock XP (itemToXp); вехи музея — каждые 100 XP, всего 40.
// - Special Items не дают XP и не входят в проценты, их можно жертвовать сколько угодно.
import FALLBACK from './data/museum-neu.json' with { type: 'json' };

export const CATEGORIES = [
  { id: 'combat', name: 'Combat', ru: 'Combat', icon: 'ASPECT_OF_THE_END' },
  { id: 'farming', name: 'Farming', ru: 'Farming', icon: 'THEORETICAL_HOE_WHEAT_1' },
  { id: 'mining', name: 'Mining', ru: 'Mining', icon: 'MITHRIL_PICKAXE' },
  { id: 'fishing', name: 'Fishing', ru: 'Fishing', icon: 'CHALLENGE_ROD' },
  { id: 'foraging', name: 'Foraging', ru: 'Foraging', icon: 'TREECAPITATOR_AXE' },
  { id: 'dungeoneering', name: 'Dungeoneering', ru: 'Dungeons', icon: 'BONZO_STAFF' },
  { id: 'hunting', name: 'Hunting', ru: 'Hunting', icon: 'ABYSMAL_LASSO' },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export const MILESTONE_XP = 100;
export const MILESTONES = 40;

// Награды вех, которые известны точно (меню Museum Milestones). Остальные вехи дают те же
// +1% Bits Multiplier и +2% Bank Interest плюс свои предметы — полный список виден только в игре.
export const MILESTONE_REWARDS = {
  1: ['+1% Bits Multiplier', '+2% Bank Interest'],
  2: ['+1% Bits Multiplier', '+2% Bank Interest'],
  3: ['Deluxe Bank Upgrade', 'Museum Appraisal Service', '+1% Bits Multiplier', '+2% Bank Interest'],
  8: ['доступ к The Hex'],
};
// Что ещё встречается среди наград вех (без точного номера вехи)
export const OTHER_REWARDS = ['Travel Scroll', 'Dust и Eon the Fish', 'рецепт Flower Minion', 'эмблемы Collecting Top Hat', 'улучшения банка'];

let cache = { src: null, cat: null };

/**
 * @param {Object} [constants]  neu.constants (берётся constants.museum)
 * @returns {{ entries: Map<string, Entry>, byItem: Map<string, string[]>, special: Set<string>, total: number, xpMax: number, byCat: Object<string, Entry[]> }}
 *   Entry = { id, cat, xp, set: string[]|null, parents: string[], children: string[] }
 */
export function museumCatalog(constants) {
  const src = constants?.museum?.items ? constants.museum : FALLBACK;
  if (cache.src === src) return cache.cat;
  const entries = new Map();
  const byItem = new Map();
  const link = (item, entry) => { const a = byItem.get(item) || []; if (!a.includes(entry)) a.push(entry); byItem.set(item, a); };
  const byCat = {};
  for (const c of CATEGORIES) {
    byCat[c.id] = [];
    for (const id of src.items?.[c.id] || []) {
      if (entries.has(id)) continue;
      const set = src.sets_to_items?.[id] || null;
      const e = { id, cat: c.id, xp: Number(src.itemToXp?.[id]) || 0, set, parents: [], children: [] };
      entries.set(id, e);
      byCat[c.id].push(e);
      if (set) for (const p of set) link(p, id);
      else link(id, id);
    }
  }
  // Звёздные версии и прочие синонимы: STARRED_X → X
  for (const [alias, base] of Object.entries(src.mapped_ids || {})) for (const e of byItem.get(base) || []) link(alias, e);
  // children: ключ (высший тир) засчитывает значение (низший)
  for (const [hi, lo] of Object.entries(src.children || {})) {
    const H = entries.get(hi), L = entries.get(lo);
    if (!H || !L) continue;
    H.children.push(lo);
    L.parents.push(hi);
  }
  const all = [...entries.values()];
  const cat = {
    entries, byItem, byCat,
    special: new Set(src.items?.special || []),
    total: all.length,
    xpMax: all.reduce((s, e) => s + e.xp, 0),
  };
  cache = { src, cat };
  return cat;
}

/** Записи музея, к которым относится предмет (обычно одна; часть брони может входить в два сета). */
export function entriesOfItem(catalog, itemId) {
  return catalog.byItem.get(itemId) || [];
}
