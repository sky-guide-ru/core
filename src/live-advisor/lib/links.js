// Кликабельные предметы в ответах советчика. Модель пишет [[ID|Название]]; здесь проверяем каждую ссылку по базе
// предметов: неизвестный ID пробуем найти по названию, не нашли — оставляем просто жирное название.
// Модель часто забывает про [[…]], поэтому названия предметов в обычном тексте тоже ищем сами по базе NEU:
// с апострофами и точками (L.A.S.R.'s Eye), скобками (Necron's Blade (Unrefined)), множественным числом,
// после «8×». Сайт рисует [[ID|Название]] кнопкой, которая открывает карточку предмета.
import { STOP } from '../../guides/refs.js';

const LINK = /\[\[([^\]|\n]{1,80})(?:\|([^\]\n]{1,80}))?\]\]/g;
const BOLD = /\*\*([^*\n]{2,60})\*\*/g;
const strip = s => String(s || '').replace(/§./g, '').trim();
const norm = s => strip(s).replace(/[’`]/g, '\'').replace(/\s+/g, ' ').toLowerCase();
const ENTITY = /\((NPC|Monster|Sea Creature|Boss|Miniboss|Creature|Mayor|Animal)\)$/;
// Слова, которые в ответе почти всегда значат не предмет («Hot» Kuudra, «Combat», «Rift»…)
const EXTRA_STOP = new Set(['Hot', 'Rift', 'Garden', 'Dungeon', 'Master', 'Slayer', 'Kuudra', 'Catacombs', 'Bazaar', 'Auction', 'Power', 'Essence', 'Recipe', 'Reforge', 'Booster Cookie Menu', 'Mage', 'Archer', 'Tank', 'Healer', 'Berserk']);

/** Индекс названий: норм. название → { id, name, words }. Строится один раз на базу NEU. */
const indexCache = new WeakMap();
export function nameIndex(items) {
  if (!items) return null;
  if (indexCache.has(items)) return indexCache.get(items);
  const byName = new Map();
  const better = (a, b) => {
    // одно название у нескольких id: обычный предмет лучше звёздного/варианта, питомец — высшей редкости
    const score = x => (x.id.includes(';') ? 10 - Number(x.id.split(';')[1] || 0) : 0) + (/^STARRED_|_SKIN|^PET_SKIN/.test(x.id) ? 50 : 0) + x.id.length / 100;
    return score(a) < score(b) ? a : b;
  };
  const put = (name, id, alias = false) => {
    const n = norm(name);
    if (n.length < 3) return;
    const cur = byName.get(n);
    if (cur && (alias ? !cur.alias : false)) return; // псевдоним не перебивает настоящее название
    const v = { id, name: strip(name), alias, single: !/[\s'.\-]/.test(strip(name)) };
    byName.set(n, cur && cur.alias === alias ? better(cur, v) : v);
  };
  for (const [id, it] of items) {
    let name = strip(it?.name);
    if (!name || ENTITY.test(name) || /^Enchanted Book$|Skin$|^\d+$/.test(name) || id.startsWith('PET_SKIN')) continue;
    const pet = /^\[Lvl \{LVL\}\]\s*(.+)$/.exec(name);
    if (pet) name = pet[1];
    else if (name.startsWith('[')) continue;
    if (STOP.has(name) || EXTRA_STOP.has(name)) continue;
    put(name, id);
    // «Necron's Blade (Unrefined)» → и «Necron's Blade», если так не называется другой предмет
    const base = /^(.*\S)\s*\([^)]*\)$/.exec(name)?.[1];
    if (base && !STOP.has(base)) put(base, id, true);
    // сет: «Necron's Chestplate» → «Necron's Armor» ведёт на нагрудник (как в гайдах)
    if (/_CHESTPLATE$/.test(id) && / Chestplate$/.test(name)) put(name.replace(/ Chestplate$/, ' Armor'), id, true);
  }
  for (const [n, v] of byName) if (v.single && (v.name.length < 4 || !/^[A-Z]/.test(v.name))) byName.delete(n);
  // Поиск без огромного регулярного выражения: кандидаты по первому слову, длинные названия первыми
  const byFirst = new Map();
  for (const [n, v] of byName) {
    const k = FIRST.exec(n)?.[0];
    if (!k) continue;
    if (!byFirst.has(k)) byFirst.set(k, []);
    byFirst.get(k).push({ n, v });
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.n.length - a.n.length);
  const idx = { byName, byFirst };
  indexCache.set(items, idx);
  return idx;
}

const FIRST = /^[\p{L}\p{N}]+/u;
const WORDCH = /[\p{L}\p{N}_]/u;
// Нижний регистр и прямой апостроф без изменения длины строки (позиции совпадают с исходным текстом)
const lowerSame = s => Array.from(s, c => { const l = c === '’' || c === '`' ? '\'' : c.toLowerCase(); return l.length === c.length ? l : c; }).join('');

/** Названия предметов в обычном тексте → [[ID|как написано]]. Готовые ссылки и `код` не трогаем. */
export function linkPlainNames(text, idx) {
  if (!idx?.byFirst || !text) return text;
  return text.split(/(\[\[[^\]\n]*\]\]|`[^`\n]*`)/).map((part, pi) => {
    if (pi % 2) return part;
    const low = lowerSame(part);
    let out = '', last = 0;
    for (let i = 0; i < part.length; i++) {
      if (!WORDCH.test(part[i]) || (i > 0 && (WORDCH.test(part[i - 1]) || part[i - 1] === '\'' || part[i - 1] === '’'))) continue;
      const key = FIRST.exec(low.slice(i, i + 40))?.[0];
      const cands = key && idx.byFirst.get(key);
      if (!cands) continue;
      for (const { n, v } of cands) {
        if (!low.startsWith(n, i)) continue;
        let end = i + n.length;
        const pl = /^(e?s)(?![\p{L}\p{N}_])/u.exec(low.slice(end, end + 3));
        if (pl) end += pl[1].length;
        if (end < part.length && WORDCH.test(part[end])) continue;
        if (v.single && part[i] !== v.name[0]) continue; // одно слово — только с заглавной, как в базе
        out += part.slice(last, i) + `[[${v.id}|${part.slice(i, end).replace(/[[\]|]/g, '')}]]`;
        last = end; i = end - 1;
        break;
      }
    }
    return out + part.slice(last);
  }).join('');
}

/**
 * @param {string} text
 * @param {{ getItemRu?: (id: string) => any, searchItems?: (q: string, o?: object) => any[], neuItems?: () => Map }} deps
 */
export function linkItems(text, deps = {}) {
  if (!text || typeof text !== 'string') return text;
  const idx = (() => { try { return nameIndex(deps.neuItems?.()); } catch { return null; } })();
  const byId = id => { try { return deps.getItemRu?.(id) || (deps.neuItems?.()?.get(id) ? { id, nameEn: strip(deps.neuItems().get(id).name) } : null); } catch { return null; } };
  // Точное совпадение названия: «Maddox» не должен стать «Maddox Badphone»
  const byName = name => {
    const n = norm(name);
    if (!n) return null;
    const hit = idx?.byName.get(n) || idx?.byName.get(n.replace(/e?s$/, ''));
    if (hit) return { id: hit.id, nameEn: hit.name };
    try { return (deps.searchItems?.(name, { limit: 3 }) || []).find(x => norm(x.nameEn) === n) || null; } catch { return null; }
  };
  const link = (it, label) => `[[${it.id}|${(label || it.nameEn || it.id).replace(/[[\]|]/g, '')}]]`;
  let out = text.replace(LINK, (_, rawId, label) => {
    const id = rawId.trim().toUpperCase().replace(/\s+/g, '_');
    const it = /^[A-Z0-9_:;-]+$/.test(id) ? byId(id) : null;
    if (it) return link(it, label?.trim());
    const guess = byName(label || rawId);
    if (guess) return link(guess, label?.trim());
    return `**${(label || rawId).trim()}**`;
  });
  // Жирное точное название → ссылка целиком (без звёздочек)
  out = out.replace(BOLD, (m, name) => { const it = byName(name); return it ? link(it, name.trim()) : m; });
  // Остальные названия в тексте
  return linkPlainNames(out, idx);
}
