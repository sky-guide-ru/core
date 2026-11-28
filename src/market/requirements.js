import { tx } from '../../i18n/msg.js';
// Проверка требования рецепта из NEU crafttext по профилю игрока:
// "Requires: Nether Wart XI", "Requires: HotM 5", "Requires: Zombie Slayer 7", "Requires: Gemstone X & HotM 5".
// Нужна, чтобы не советовать крафт-флипы, которые игрок пока не может скрафтить.

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export function roman(s) {
  if (/^\d+$/.test(s)) return Number(s);
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], next = ROMAN[s[i + 1]] || 0;
    if (!v) return NaN;
    n += v < next ? -v : v;
  }
  return n;
}

/**
 * Пороги коллекций из /v2/resources/skyblock/collections → поиск по названию.
 * @returns {Map<string, { id: string, tiers: number[], name?: string, unlocks?: string[][] }>} ключ — название в нижнем регистре ("nether wart")
 */
export function collectionsByName(resp) {
  const out = new Map();
  for (const cat of Object.values(resp?.collections || {})) {
    for (const [id, it] of Object.entries(cat.items || {})) {
      const sorted = (it.tiers || []).slice().sort((a, b) => a.amountRequired - b.amountRequired);
      const tiers = sorted.map(t => t.amountRequired);
      // unlocks[i] — награды тира i+1 ("Bluetooth Ring Recipe"): по ним уточняем устаревший crafttext NEU
      if (it.name) out.set(String(it.name).toLowerCase(), { id, tiers, name: it.name, unlocks: sorted.map(t => t.unlocks || []) });
    }
  }
  return out;
}

const SLAYER_KEYS = { zombie: 'zombie', revenant: 'zombie', spider: 'spider', tarantula: 'spider', wolf: 'wolf', sven: 'wolf', enderman: 'enderman', voidgloom: 'enderman', blaze: 'blaze', vampire: 'vampire' };

/**
 * Запасной словарь «название → id коллекции» из базы NEU, пока ресурс коллекций Hypixel не загружен.
 * @param {Map<string, { name?: string }>} items
 */
const fromNeuMemo = new WeakMap();
export function collectionsFromNeu(items) {
  // База NEU меняется целиком (новый Map раз в несколько часов), а словарь нужен на каждый разбор профиля: помним
  if (items && typeof items === 'object' && fromNeuMemo.has(items)) return fromNeuMemo.get(items);
  const out = new Map();
  for (const [id, it] of items || []) {
    if (!/^[A-Z0-9_:]+$/.test(id) || /^(ENCHANTED_|.*_GENERATOR_)/.test(id)) continue;
    const name = String(it?.name || '').replace(/§./g, '').trim().toLowerCase();
    if (name && !out.has(name)) out.set(name, { id: id.replace(/-(\d+)$/, ':$1'), tiers: [] });
  }
  if (items && typeof items === 'object') fromNeuMemo.set(items, out);
  return out;
}

/**
 * @param {string} crafttext
 * @param {object} member  Member из ядра
 * @param {Map<string, { id: string, tiers: number[] }>|null} collections  результат collectionsByName
 * @returns {{ ok: boolean|null, missing: string[] }}  ok = null — не смогли проверить (нет данных)
 */
export function checkCrafttext(crafttext, member, collections) {
  const body = String(crafttext || '').replace(/^Requires:?\s*/i, '').trim();
  if (!body || !member) return { ok: body ? null : true, missing: [] };
  let unknown = false;
  const missing = [];
  for (const part of body.split(/\s*&\s*/)) {
    const m = part.match(/^(.+?)\s+([IVXLC]+|\d+)$/);
    if (!m) { unknown = true; continue; }
    const name = m[1].trim(), need = roman(m[2]);
    let ok = null;
    const sl = name.match(/^(\w+) Slayer$/i);
    if (/^HotM$/i.test(name)) ok = Number(member.mining?.hotm?.level || 0) >= need;
    else if (sl && SLAYER_KEYS[sl[1].toLowerCase()]) ok = Number(member.slayers?.[SLAYER_KEYS[sl[1].toLowerCase()]]?.level || 0) >= need;
    else if (collections) {
      const c = collections.get(name.toLowerCase());
      if (c) {
        // надёжнее всего — список открытых тиров из player_data.unlocked_coll_tiers
        const unlocked = member.unlockedCollTiers || [];
        const best = unlocked.filter(t => t.startsWith(c.id + '_')).map(t => Number(t.slice(c.id.length + 1))).filter(Number.isFinite);
        if (best.length) ok = Math.max(...best) >= need;
        else if (c.tiers?.[need - 1] != null && member.collections) ok = Number(member.collections[c.id] || 0) >= c.tiers[need - 1];
        else if (unlocked.length) ok = false;
      }
    }
    if (ok === null) unknown = true;
    else if (!ok) missing.push(part);
  }
  return { ok: missing.length ? false : unknown ? null : true, missing };
}

/**
 * crafttext из NEU иногда отстаёт от игры: в 0.27.2 Bluetooth Ring переехал с Living Metal Heart III на IV,
 * а NEU всё ещё пишет III. Если в ресурсе коллекций Hypixel есть награда «<предмет> Recipe», берём тир оттуда.
 * @param {string} crafttext  "Requires: Living Metal Heart III"
 * @param {string} itemName   английское название предмета ("Bluetooth Ring")
 * @param {Map|null} collections  результат collectionsByName
 * @returns {string} исправленный crafttext (или исходный)
 */
export function fixCrafttext(crafttext, itemName, collections) {
  const body = String(crafttext || '').replace(/^Requires:?\s*/i, '').trim();
  if (!body || !itemName || !collections) return crafttext || '';
  const want = String(itemName).toLowerCase();
  let changed = false;
  const parts = body.split(/\s*&\s*/).map(part => {
    const m = part.match(/^(.+?)\s+([IVXLC]+)$/);
    if (!m) return part;
    const c = collections.get(m[1].trim().toLowerCase());
    if (!c?.unlocks?.length) return part;
    const tier = c.unlocks.findIndex(list => list.some(u => String(u).replace(/\s+Recipes?$/i, '').toLowerCase() === want));
    if (tier < 0 || tier + 1 === roman(m[2])) return part;
    changed = true;
    return tx`${m[1]} ${toRoman(tier + 1)}`;
  });
  return changed ? tx`Requires: ${parts.join(' & ')}` : crafttext;
}

const ROMAN_OUT = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function toRoman(n) {
  let s = '';
  for (const [v, r] of ROMAN_OUT) while (n >= v) { s += r; n -= v; }
  return s;
}
