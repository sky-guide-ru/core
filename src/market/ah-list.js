// Аукцион (Auction House) в разделе «Рынок»: строки списка, варианты предмета и сводка для карточки.
// Данные уже собирает server/prices.js: lowest BIN по полному скану раз в 3 минуты (prices.bin, prices.binVar),
// настоящие продажи раз в минуту (prices.sold) и почасовая история lowest BIN (prices.binHistory, 14 дней).
// Здесь — только сборка из этого строк для интерфейса.
import { soldStats } from './auctions.js';
import { dayChangePct } from './history.js';
import { tx } from '../../i18n/msg.js';

export const PET_TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

/** Сортировки списка аукциона (для listBazaar): vol — оборот за неделю, порядок по умолчанию */
export const AH_SORTS = {
  vol: r => r.sold7 * (r.median || r.price || 0), // оборот — по ценам настоящих продаж: дорогой единичный лот не поднимает предмет наверх
  d1: r => r.d1,
  buy: r => (r.price > 0 ? r.price : r.median || null),
  sold: r => r.sold24,
  count: r => r.count,
};

/** Подпись варианта по ключу «ID@5r+s1» / питомца «TYPE;4» */
export function variantLabel(key) {
  const pet = /;(\d)$/.exec(key);
  if (pet && !/RUNE;/.test(key)) return PET_TIERS[Number(pet[1])] || key;
  const m = /@(\d+)(r?)(?:\+s(\d))?$/.exec(key);
  if (!m) return 'Любой';
  const parts = [m[1] === '0' ? 'без ★' : tx`${m[1]}★`];
  if (m[2]) parts.push('Recomb');
  if (m[3]) parts.push(tx`${m[3]} свит.`);
  return parts.join(' + ');
}

// Рост за сутки считается по lowest BIN, поэтому нужны хотя бы 3 лота прямо сейчас. Раньше хватало 3 продаж за неделю,
// и у Lapis Armor Boots единственный лот за 600 млн (обычная цена — десятки монет) давал «+1 499 900 %».
// Вторая защита: цена лота в 10 раз выше или ниже настоящих продаж за неделю — это выброс, а не рост.
const MIN_LIVE = 3;
const OUTLIER = 10;

function dayChange(hist, price, count, sales, now) {
  if (count < MIN_LIVE) return null;
  if (sales?.count7d >= MIN_LIVE && sales.median > 0 && (price > sales.median * OUTLIER || price * OUTLIER < sales.median)) return null;
  return dayChangePct(hist, price, 1, now);
}

/**
 * Список аукциона с кэшем на одно обновление цен.
 * @param {{ prices: any, name: (id: string) => string, nameEn: (id: string) => string, isPet: (id: string) => boolean, clock?: () => number,
 *   cat?: (id: string) => string, rarity?: (id: string) => string|null }} deps  cat/rarity — для фильтров
 */
export function createAhList({ prices, name, nameEn, isPet, clock = () => Date.now(), cat = () => null, rarity = () => null }) {
  let cache = { key: '', rows: new Map(), vars: new Map() };

  function build() {
    const key = tx`${prices.binAt}|${prices.soldAt}|${prices.bazaarAt ? 1 : 0}`;
    if (cache.key === key) return cache;
    const now = clock();
    const rows = new Map();
    const vars = new Map(); // базовый ключ → [ключи вариантов]
    const addVar = (base, k) => { const a = vars.get(base); if (!a) vars.set(base, [k]); else if (!a.includes(k)) a.push(k); };
    const keys = new Set([...prices.bin.keys(), ...Object.keys(prices.sold?.hourly || {})]);
    for (const k of prices.binVar?.keys?.() || []) keys.add(k);
    for (const k of keys) {
      const at = k.indexOf('@');
      if (at > 0) { addVar(k.slice(0, at), k); continue; }
      if (prices.bazaar.has(k)) continue; // книги и прочее с Bazaar — там их основной рынок
      const pet = isPet(k);
      if (pet) addVar(k.split(';')[0] + ';pet', k);
      rows.set(k, makeRow(k, pet, now));
    }
    cache = { key, rows, vars };
    return cache;
  }

  function makeRow(k, pet, now) {
    const b = prices.bin.get(k) || prices.binVar?.get(k);
    const s = soldStats(prices.sold, k, now);
    const price = b?.price || 0;
    const base = pet ? k.split(';')[0] : k;
    const row = {
      id: k, name: name(k) + (pet ? tx` (${variantLabel(k)})` : ''), nameEn: nameEn(base),
      price, second: b?.second || 0, count: b?.count || 0, auction: b?.auction || null,
      sold24: s?.count24h || 0, sold7: s?.count7d || 0, median: s?.median || 0, last: s?.last || 0, lastAt: s?.lastAt || 0,
      cat: cat(k.split('@')[0]), rarity: (rarity(k.split('@')[0]) || '').replace(/ /g, '_') || null, // VERY SPECIAL → VERY_SPECIAL (ключ фильтра)
      d1: dayChange(prices.binHistory?.[k], price, b?.count || 0, s, now),
    };
    if (pet && b?.max) row.max = b.max; // lowest BIN питомца 100 уровня
    return row;
  }

  /** Все строки (для поиска listBazaar): Map ключ → строка */
  const rows = () => build().rows;

  /** Строка по ключу — и для вариантов «ID@5r», которых нет в общем списке */
  function row(k) {
    const c = build();
    if (c.rows.has(k)) return c.rows.get(k);
    if (!prices.bin.has(k) && !prices.binVar?.has(k) && !prices.sold?.hourly?.[k]) return null;
    const r = makeRow(k, isPet(k), clock());
    const at = k.indexOf('@');
    if (at > 0) { r.base = k.slice(0, at); r.name = tx`${name(r.base)} (${variantLabel(k)})`; r.nameEn = nameEn(r.base); }
    return r;
  }

  /** Варианты предмета: другие редкости питомца или звёзды/Recomb. Первым — сам предмет без разбивки. */
  function variants(k) {
    const c = build();
    const base = k.includes('@') ? k.slice(0, k.indexOf('@')) : k;
    let list;
    if (isPet(base)) list = (c.vars.get(base.split(';')[0] + ';pet') || []).slice().sort((a, b) => Number(a.split(';')[1]) - Number(b.split(';')[1]));
    else {
      const vs = (c.vars.get(base) || []).slice().sort(sortVar);
      if (vs.length < 2) return []; // один вариант (обычно «без ★») ничего не добавляет к самому предмету
      list = [base, ...vs];
    }
    if (list.length < 2) return [];
    return list.map(v => {
      const r = c.rows.get(v) || row(v);
      return { id: v, label: variantLabel(v), price: r?.price || 0, count: r?.count || 0, sold24: r?.sold24 || 0, median: r?.median || 0 };
    });
  }

  return { rows, row, variants, build };
}

// Порядок вариантов: звёзды по возрастанию, без Recomb раньше, без свитков раньше
const sortVar = (a, b) => {
  const p = k => { const m = /@(\d+)(r?)(?:\+s(\d))?$/.exec(k) || []; return [Number(m[1] || 0), m[2] ? 1 : 0, Number(m[3] || 0)]; };
  const x = p(a), y = p(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
