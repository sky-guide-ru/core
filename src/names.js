// Читаемое название предмета по любому ID (NEU, Bazaar, аукцион) — чтобы на сайте не всплывали
// сырые ID вроде SHARD_SEA_EMPEROR или ENCHANTMENT_LAPIDARY_1.
import { getNames } from './items-ru/index.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const title = s => String(s || '').toLowerCase().split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
// «[Lvl {LVL}] Ender Dragon» → «Ender Dragon»: заготовка уровня из NEU в названии не нужна
const clean = s => String(s || '').replace(/§./g, '').replace(/^\[Lvl \{LVL\}\]\s*/, '').trim();

/**
 * Английское название, когда в базах предмета нет: собираем из ID.
 * ENCHANTMENT_ULTIMATE_WISE_5 → «Ultimate Wise V», SHARD_SEA_EMPEROR → «Sea Emperor Shard».
 */
export function prettyId(id) {
  const s = String(id || '');
  let m;
  if ((m = /^ENCHANTMENT_(.+)_(\d+)$/.exec(s))) return `${title(m[1])} ${ROMAN[+m[2]] || m[2]}`;
  if ((m = /^SHARD_(.+)$/.exec(s))) return `${title(m[1])} Shard`;
  if ((m = /^ESSENCE_(.+)$/.exec(s))) return `${title(m[1])} Essence`;
  return title(s.split(';')[0].replace(/[:-]\d+$/, ''));
}

/**
 * Название для показа — как в игре, на английском (24.11.2026: игроки просили не переводить названия предметов;
 * русские названия остались только для поиска). Берём из базы items-ru, иначе из NEU, иначе собираем из ID.
 * @param {string} id
 * @param {Map<string, {name?: string}>} [items] база NEU
 */
export function displayName(id, items) {
  if (!id) return '';
  let n = null;
  try { n = getNames(id); } catch { /* база ещё не готова */ }
  if (n?.nameEn) return clean(n.nameEn);
  const neuName = items?.get(id)?.name || items?.get(String(id).replace(/:(\d+)$/, '-$1'))?.name;
  return neuName ? clean(neuName) : prettyId(id);
}

/** Только английское (для мест, где сайт показывает оригинальные названия). */
export function englishName(id, items) {
  const own = items?.get(id)?.name || items?.get(String(id).replace(/:(\d+)$/, '-$1'))?.name;
  if (own) return clean(own);
  let n = null;
  try { n = getNames(id); } catch { /* база ещё не готова */ }
  return n?.nameEn ? clean(n.nameEn) : prettyId(id);
}

/** Категория предмета из базы items-ru (armor, weapon, accessory, pet, material, …) или null. */
export function itemCategory(id) {
  try { return getNames(id)?.category || null; } catch { return null; }
}

/** Редкость предмета из базы items-ru (COMMON … MYTHIC, SPECIAL) или null. */
export function itemRarity(id) {
  try { return getNames(id)?.rarity || null; } catch { return null; }
}
