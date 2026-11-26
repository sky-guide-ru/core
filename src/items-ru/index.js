// Публичный API модуля items-ru: русская база предметов Hypixel SkyBlock.
//
// Два режима:
//  1) готовые данные из data/*.json (собираются scripts/build.js) — работает сразу после импорта;
//  2) loadFromNeu(neu) — пересобрать базу в памяти из уже загруженной ядром NEU-базы
//     (server/neu.js: neu.items + neu.constants), чтобы данные всегда были свежими.

import { variableInfo } from '../lib/variable-stats.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDatabase } from './lib/build-db.js';
import { createSearch } from './lib/search.js';
import { translateLore, translateLoreLine as tLine, stripColor } from './lib/lore.js';
import { translateStat as tStat, fmtCoins } from './lib/glossary.js';
import { enTerms } from './lib/terms.js';
import { prepareEn } from '../../i18n/lang.js';
import { collectMessages, both } from '../../i18n/msg.js';
import { Worker } from 'node:worker_threads';
import { tx } from '../../i18n/msg.js';

export * as glossary from './lib/glossary.js';
export { translit, skeleton, ALIASES } from './lib/search.js';
export { translateLore, stripColor };

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const readJson = (f, def) => {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return def; }
};

const state = { items: null, lore: null, search: null, source: 'none', loadedAt: 0, shards: null };

function ensure() {
  if (state.items) return;
  state.items = readJson('items-ru.json', {});
  state.search = createSearch(state.items);
  state.source = 'data';
  state.loadedAt = Date.now();
}

/**
 * Пересобрать базу из NEU-базы ядра (server/neu.js). Вызывайте после loadNeu().
 * @param {{ items: Map<string, object>|object[], constants?: object }} neu
 * @returns {{ items: number, ms: number }}
 */
export function loadFromNeu(neu) {
  const t0 = Date.now();
  const list = neu.items instanceof Map ? neu.items.values() : neu.items;
  const curated = readJson('curated-ru.json', {});
  delete curated.$comment;
  const { result: db, messageOf: ownOf } = collectMessages(() => buildDatabase(list, { constants: neu.constants || {}, vanillaRu: readJson('vanilla-ru.json', {}), curated }));
  return apply(neu, db, ownOf, Date.now() - t0);
}

function apply(neu, db, ownOf, ms) {
  state.items = db.items;
  state.lore = db.lore;
  state.neuItems = neu.items instanceof Map ? neu.items : null; // оригинальные описания (английская версия сайта)
  state.search = createSearch(db.items);
  state.shards = null;
  state.source = 'neu';
  state.loadedAt = Date.now();
  const t1 = Date.now();
  const en = prepareEn(textsOf(db.items), ownOf).then(n => ({ n, ms: Date.now() - t1 })); // английский текст базы — в фоне
  return { items: Object.keys(db.items).length, ms, en };
}

/**
 * То же, что loadFromNeu, но сборка идёт в отдельном потоке: сервер в это время отвечает на запросы.
 * Пока поток работает, сайт пользуется прошлой базой (или готовой из data/). Поток не запустился — собираем как раньше.
 * @returns {Promise<{ items: number, ms: number, en: Promise<{n:number, ms:number}> }>}
 */
export async function loadFromNeuAsync(neu) {
  const curated = readJson('curated-ru.json', {});
  delete curated.$comment;
  const items = [...(neu.items instanceof Map ? neu.items.values() : neu.items)];
  let out;
  try {
    out = await new Promise((resolve, reject) => {
      const w = new Worker(new URL('./build-worker.js', import.meta.url), { workerData: { items, constants: neu.constants || {}, vanillaRu: readJson('vanilla-ru.json', {}), curated } });
      w.once('message', resolve);
      w.once('error', reject);
      w.once('exit', code => reject(new Error(`поток сборки завершился с кодом ${code}`)));
    });
  } catch (e) {
    console.warn('[items-ru] отдельный поток не сработал, собираю в основном:', e.message);
    return loadFromNeu(neu);
  }
  // Пары «русский → английский» из описаний (both) — переводчику основного потока
  for (const [ruText, enText] of out.pairs) both(ruText, enText);
  const own = new Map(out.messages);
  return apply(neu, { items: out.items, lore: out.lore }, s => own.get(s), out.ms);
}

// Строки базы, которые показываются на сайте: английская версия заготавливается сразу после сборки
const NO_EN = new Set(['nameRu', 'aliases', 'search', 'loreRu']);
function textsOf(items) {
  const out = [];
  const walk = (v, k) => {
    if (typeof v === 'string') { if (!NO_EN.has(k) && /[А-Яа-яЁё]/.test(v)) out.push(v); }
    else if (Array.isArray(v)) for (const x of v) walk(x, k);
    else if (v && typeof v === 'object') for (const kk in v) if (!NO_EN.has(kk)) walk(v[kk], kk);
  };
  for (const id in items) walk(items[id], null);
  return out;
}

/** ID с Bazaar/инвентаря → ID базы: ENCHANTMENT_SHARPNESS_7 → SHARPNESS;7, INK_SACK:3 → INK_SACK-3 и т.п. */
export function normalizeId(id) {
  if (!id) return id;
  ensure();
  if (state.items[id]) return id;
  let m;
  if ((m = /^ENCHANTMENT_(.+)_(\d+)$/.exec(id))) {
    const c = `${m[1]};${m[2]}`;
    if (state.items[c]) return c;
  }
  if (id.includes(':')) {
    const c = id.replace(':', '-');
    if (state.items[c]) return c;
  }
  if (ID_ALIASES[id] && state.items[ID_ALIASES[id]]) return ID_ALIASES[id];
  // Bazaar продаёт осколки по имени моба (SHARD_SEA_EMPEROR), а NEU хранит их по атрибуту (ATTRIBUTE_SHARD_…;1)
  if ((m = /^SHARD_(.+)$/.exec(id))) {
    const c = shardId(m[1]);
    if (c) return c;
  }
  return id;
}

// В API/Bazaar и в базе названия иногда расходятся или моба переименовали
const SHARD_ALIASES = { SEA_EMPEROR: 'LOCH_EMPEROR', BRUISER: 'ZEALOT_BRUISER', PACKRAT_SKULL: 'PACKRAT', ABYSSAL_LANTERN: 'ABYSSAL_LANTERNFISH' };
// Bazaar-ID, которые не совпадают с ID в NEU (старое имя товара)
const ID_ALIASES = { ENCHANTED_CARROT_ON_A_STICK: 'ENCHANTED_CARROT_STICK' };

/**
 * ID осколка в базе по имени моба: "ZEALOT" / "SEA_EMPEROR" → "ATTRIBUTE_SHARD_…;1".
 * @param {string} type имя из API или хвост Bazaar-ID SHARD_…
 * @returns {string|undefined}
 */
export function shardId(type) {
  ensure();
  if (!state.shards) {
    state.shards = new Map();
    for (const it of Object.values(state.items)) {
      if (it.category !== 'shard' || !it.id.startsWith('ATTRIBUTE_SHARD_')) continue;
      const n = (it.nameEn || '').replace(/\s+Shard$/i, '');
      if (n) state.shards.set(n.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), it.id);
    }
  }
  const idx = state.shards;
  const t = String(type || '').toUpperCase();
  for (const k of [t, t.replace(/SPECTER/g, 'SPECTRE'), SHARD_ALIASES[t]]) if (k && idx.has(k)) return idx.get(k);
  // В Bazaar-ID слова разделены иначе, чем в названии: CINDER_BAT ↔ «Cinderbat», ENDSTONE_PROTECTOR ↔ «End Stone Protector»
  const flat = k => k.replace(/_/g, '');
  const same = [...idx.keys()].filter(k => flat(k) === flat(t));
  if (same.length === 1) return idx.get(same[0]);
  const tail = [...idx.keys()].filter(k => k.endsWith('_' + t));
  return tail.length === 1 ? idx.get(tail[0]) : undefined;
}

/**
 * Только названия предмета (дёшево, без копирования карточки).
 * @param {string} id любой ID: NEU, Bazaar (ENCHANTMENT_X_N, SHARD_X, INK_SACK:3)
 * @returns {{ id: string, nameEn: string, nameRu: string } | null}
 */
export function getNames(id) {
  ensure();
  const key = normalizeId(id);
  const it = state.items[key];
  return it ? { id: key, nameEn: it.nameEn, nameRu: it.nameRu, category: it.category || null, rarity: it.rarity || null } : null;
}

/**
 * Русская карточка предмета.
 * @param {string} id SkyBlock ID (HYPERION, SHARPNESS;7, ENCHANTMENT_SHARPNESS_7, ENDER_DRAGON;4)
 * @param {{ prices?: { bazaar?: Map<string, any>, bin?: Map<string, any> } }} [opt] цены ядра — добавят строки «Bazaar»/«аукцион»
 * @returns {null | (import('./lib/build-db.js').ItemRu & { whereToGet: import('./lib/build-db.js').WhereToGet[] })}
 */
export function getItemRu(id, opt = {}) {
  ensure();
  const key = normalizeId(id);
  const it = state.items[key];
  if (!it) return null;
  const out = { ...it, whereToGet: it.whereToGet.slice() };
  // Статы меняются (сезон, день и ночь): описание из одного снимка лора неверное — берём проверенное по вики
  const v = variableInfo(key);
  if (v) {
    if (v.text) out.descriptionRu = v.text + (v.obtain ? tx` Как получить: ${v.obtain}.` : '');
    else if (v.note) out.descriptionRu = `${out.descriptionRu} ${v.note}`;
    out.variable = v;
    // источник с вики — только если других способов нет (иначе он повторяет «Выбить с Mite» и т. п.)
    if (v.obtain) { const known = out.whereToGet.filter(w => w.subkind !== 'unknown'); if (!known.length) out.whereToGet = known.concat({ kind: 'other', subkind: 'wiki', source: 'WIKI_CHECKED', textRu: tx`Источник (по вики): ${v.obtain}` }); else out.whereToGet = known; }
  }
  const p = opt.prices;
  if (p) {
    const bzId = /;\d+$/.test(key) && it.category === 'enchant_book' ? `ENCHANTMENT_${key.replace(';', '_')}` : key;
    const bz = p.bazaar?.get?.(bzId) || p.bazaar?.get?.(key);
    if (bz && bz.buy) out.whereToGet.unshift({ kind: 'shop', source: 'BAZAAR', textRu: tx`Купить на Bazaar: ${fmtCoins(bz.buy)} монет за шт. (мгновенная покупка)` });
    const bin = p.bin?.get?.(key);
    if (bin && bin.price) out.whereToGet.unshift({ kind: 'shop', source: 'AUCTION', textRu: tx`Купить на аукционе: от ${fmtCoins(bin.price)} монет, лотов: ${bin.count ?? '?'}` });
  }
  return out;
}

/** Переведённый лор предмета (строки без §-цветов) */
export function getLoreRu(id) {
  ensure();
  const key = normalizeId(id);
  if (!state.lore) state.lore = readJson('lore-ru.json', {});
  const lines = state.lore[key];
  return lines ? lines.map(enTerms) : null;
}

/** Оригинальное описание предмета из игры (английская версия сайта), без цветовых кодов */
export function getLoreEn(id) {
  const lore = state.neuItems?.get(normalizeId(id))?.lore || state.neuItems?.get(id)?.lore;
  return lore ? lore.map(l => String(l).replace(/§./g, '')) : null;
}

/**
 * Поиск по русским и английским названиям, транслиту («гиперион»), жаргону («аоте», «терма»)
 * и словам-типам («меч», «аксессуары», «питомец дракон»).
 * @param {string} query
 * @param {{ limit?: number, category?: string, type?: string }} [opt]
 */
export function searchItems(query, opt) {
  ensure();
  return state.search(query, opt);
}

/** Все предметы базы (для карты сайта) */
export function allItems() {
  ensure();
  return Object.values(state.items);
}

/** Все предметы категории (weapon, armor, accessory, pet, enchant_book, ...) */
export function listByCategory(category) {
  ensure();
  return Object.values(state.items).filter(i => i.category === category);
}

/** Перевод названия характеристики: «Crit Damage» / «crit_damage» → «Crit Damage» */
export const translateStat = tStat;

/** Перевод строки лора с сохранением §-цветов (совместимо с server/i18n/ru.js ядра) */
export const translateLoreLine = tLine;

/** Сведения о загруженной базе */
export function info() {
  ensure();
  return { source: state.source, loadedAt: state.loadedAt, items: Object.keys(state.items).length, meta: readJson('meta.json', null) };
}
