// Список товаров Bazaar для раздела «Рынок»: поиск, сортировка и постраничная выдача по ВСЕМ товарам.
// Раньше браузер получал только 300 самых ходовых и сортировал их у себя, поэтому остальные ~1900 товаров
// (редкие книги, осколки, товары без ордеров) не было видно, пока не наберёшь название.

/** Сортировки списка: ключ → значение строки (null — в конец при любом направлении). */
const SORT_VALUE = {
  vol: r => (r.buyWeek + r.sellWeek) * (r.buy || r.sell),
  d1: r => r.d1?.buy ?? null,
  buy: r => (r.buy > 0 ? r.buy : null),
  spreadPct: r => (r.buy > 0 && r.sell > 0 ? (r.spread / r.buy) * 100 : null),
  buyWeek: r => r.buyWeek,
};

/**
 * @param {Map<string, any>} bazaar id → запись parseBazaar
 * @param {{ q?: string, sort?: string, offset?: number, limit?: number,
 *   row: (id: string, p: any) => any,              // строка для клиента (id, name, nameEn, цены…)
 *   searchIds?: (q: string) => Map<string, number | { at: number, score: number }> | null, // русский поиск/жаргон: id базы → место в выдаче (и очки похожести)
 *   keyOf?: (id: string) => string,                 // Bazaar-ID → ID базы поиска (ENCHANTMENT_SHARPNESS_5 → SHARPNESS;5)
 *   sorts?: Record<string, (r: any) => number|null>, // свои сортировки (аукцион); vol — порядок по умолчанию
 *   where?: (r: any) => boolean,                    // фильтры (категория, редкость)
 *   facets?: Record<string, (r: any) => string|null> // сколько найденного в каждой категории/редкости — для подписей фильтров
 * @returns {{ total: number, items: any[], facets?: Record<string, Record<string, number>> }}
 * }} opt
 */
export function listBazaar(bazaar, { q = '', sort = '', offset = 0, limit = 200, row, searchIds = null, keyOf = id => id, sorts = SORT_VALUE, where = null, facets = null }) {
  const query = String(q || '').trim().toLowerCase();
  const ruIds = query.length >= 2 && searchIds ? searchIds(query) : null;
  const ruRank = new Map(); // id товара → место в русском поиске
  const weak = new Set();   // совпали только «похоже» (очки < 60): «Magical Lava Bucket» на запрос «Magic 8 Ball»
  if (ruIds) for (const id of bazaar.keys()) {
    const v = ruIds.get(id) ?? ruIds.get(keyOf(id));
    if (v == null) continue;
    ruRank.set(id, typeof v === 'number' ? v : v.at);
    if (typeof v === 'object' && v.score < 60) weak.add(id);
  }
  const byName = r => r.name.toLowerCase().includes(query) || (r.nameEn || '').toLowerCase().includes(query) || r.id.toLowerCase().includes(query);
  const hit = r => !query || byName(r) || ruRank.has(r.id);
  const strong = r => byName(r) || (ruRank.has(r.id) && !weak.has(r.id));
  const list = [];
  // Счётчики фильтров считаются по найденному поиском, но без самих фильтров: видно, сколько будет в каждой категории
  const counts = facets ? Object.fromEntries(Object.keys(facets).map(k => [k, {}])) : null;
  for (const [id, p] of bazaar) {
    const r = row(id, p);
    if (!hit(r)) continue;
    if (counts) for (const [k, f] of Object.entries(facets)) { const v = f(r); if (v) counts[k][v] = (counts[k][v] || 0) + 1; }
    if (!where || where(r)) list.push(r);
  }
  const vol = sorts.vol;
  const [key, d] = String(sort || '').split(':');
  const dir = Number(d) || -1;
  let cmp;
  if (key === 'name') cmp = (a, b) => a.name.localeCompare(b.name, 'ru') * dir;
  else if (sorts[key]) {
    const val = sorts[key];
    cmp = (a, b) => {
      const va = val(a), vb = val(b);
      if (va == null || vb == null) return (va == null) - (vb == null) || vol(b) - vol(a);
      return (va - vb) * dir || vol(b) - vol(a);
    };
  } else if (query) {
    // При поиске — сначала совпадения по названию, потом по релевантности русского поиска, затем по обороту
    const rank = x => (x.name.toLowerCase().includes(query) || (x.nameEn || '').toLowerCase().includes(query) ? -1
      : ruRank.get(x.id) ?? 999);
    cmp = (a, b) => rank(a) - rank(b) || vol(b) - vol(a);
  } else cmp = (a, b) => vol(b) - vol(a);
  // Слабые совпадения — после точных и с пометкой similar (на клиенте — под заголовком «Похожие»); если точных нет, показываем как есть
  if (query && weak.size && list.some(strong)) {
    const sim = new Set(list.filter(r => !strong(r)));
    if (sim.size) {
      const base = cmp;
      cmp = (a, b) => Number(sim.has(a)) - Number(sim.has(b)) || base(a, b);
      list.sort(cmp);
      for (let i = 0; i < list.length; i++) if (sim.has(list[i])) list[i] = { ...list[i], similar: true };
    } else list.sort(cmp);
  } else list.sort(cmp);
  const from = Math.max(0, Math.floor(Number(offset) || 0));
  const n = Math.max(1, Math.min(Math.floor(Number(limit) || 200), 3000));
  const out = { total: list.length, items: list.slice(from, from + n) };
  if (counts) out.facets = counts;
  return out;
}
