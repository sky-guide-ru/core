// Человеческий вид для «прочих» разделов профиля (Hunting, Garden, шоколадная фабрика, кооп):
// сырые ID из API → настоящие названия, ID предметов для иконок и максимумы для полосок.
import { getItemRu, getLoreRu, getLoreEn, shardId } from '../items-ru/index.js';
import { itemName } from '../neu.js';
import { tx, both } from '../../i18n/msg.js';

// Сколько осколков влезает в атрибут до 10-го уровня (по редкости осколка)
export const ATTRIBUTE_MAX = { COMMON: 96, UNCOMMON: 64, RARE: 48, EPIC: 32, LEGENDARY: 24 };
// Максимальные тиры улучшений кооператива (Elizabeth → Community Shop)
export const COMMUNITY_MAX = { minion_slots: 5, coins_allowance: 5, guests_count: 5, island_size: 10, coop_slots: 3 };
export const COMMUNITY_RU = { minion_slots: 'Слоты миньонов', coins_allowance: 'Карманные монеты', guests_count: 'Лимит Visitors', island_size: 'Размер острова', coop_slots: 'Слоты кооператива' };
export const GARDEN_CHIP_MAX = 20;
export const TIME_TOWER_MAX = 15;
export const GARDEN_PLOTS = 24;
const GREENHOUSE_RU = { growth_speed: 'Скорость роста', yield: 'Урожайность', plot_limit: 'Лимит участков' };
const RABBIT_EMPLOYEES = ['bro', 'cousin', 'sis', 'father', 'grandma', 'uncle', 'dog'];

export const GARDEN_EXP_FALLBACK = [0, 70, 70, 140, 240, 600, 1500, 2000, 2500, 3000, 10000, 10000, 10000, 10000, 10000];
export function gardenLevel(exp, table = GARDEN_EXP_FALLBACK) {
  let lvl = 0, acc = 0;
  for (const need of table) { if (exp >= acc + need) { acc += need; lvl++; } else break; }
  const nextNeed = table[lvl];
  return { level: lvl, max: table.length, progress: nextNeed ? (exp - acc) / nextNeed : 1, toNext: nextNeed ? acc + nextNeed - exp : 0 };
}

const title = s => String(s || '').toLowerCase().split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

const shardByName = type => shardId(type);

function shardMeta(id) {
  const it = id ? getItemRu(id) : null;
  if (!it) return null;
  // Первая строка лора: «Arthropod Ruler I. Даёт на +3% больше ❁» — название атрибута и начало эффекта
  const parse = lore => {
    const m = /^(.+?)\s+[IVX]+\b\.?\s*(.*)$/.exec((lore[0] || '').trim());
    const effect = m && m[2] ? [m[2]] : [];
    for (const l of lore.slice(1)) { if (!l.trim()) break; effect.push(l.trim()); }
    return { attr: m ? m[1] : (lore[0] || '').trim(), effect: effect.join(' ') || null };
  };
  const ru = parse(getLoreRu(id) || []), en = parse(getLoreEn(id) || []);
  // Русский эффект для русской версии, английский — из описания в игре
  return { id, shard: (it.nameEn || '').replace(/\s+Shard$/i, ''), rarity: it.rarity || null, attribute: ru.attr || null, effect: both(ru.effect, en.effect), effectEn: en.effect || null };
}

/** Атрибуты Hunting: { id, n } → с названием атрибута, осколком, редкостью и максимумом. */
export function viewAttributes(list = []) {
  return list.map(a => {
    const meta = shardMeta(tx`ATTRIBUTE_SHARD_${String(a.id).toUpperCase()};1`);
    const max = ATTRIBUTE_MAX[meta?.rarity] || null;
    return { id: a.id, n: a.n, name: meta?.attribute || title(a.id), shardId: meta?.id || null, shard: meta?.shard || null, rarity: meta?.rarity || null, effect: meta?.effect || null, effectEn: meta?.effectEn || null, max };
  }).sort((x, y) => (y.max && y.n >= y.max) - (x.max && x.n >= x.max) || y.n / (y.max || 100) - x.n / (x.max || 100));
}

/** Осколки в Hunting Box: { type, owned } → с ID предмета и названием. */
export function viewShards(list = []) {
  return list.filter(s => s.owned > 0).map(s => {
    const meta = shardMeta(shardByName(s.type));
    return { type: s.type, owned: s.owned, name: meta?.shard || title(s.type), shardId: meta?.id || null, rarity: meta?.rarity || null, attribute: meta?.attribute || null };
  }).sort((a, b) => b.owned - a.owned);
}

export function viewEmployees(emp = {}) {
  return Object.entries(emp).map(([k, v]) => {
    const short = k.replace(/^rabbit_/, '');
    // В игре они зовутся Rabbit Daddy и Rabbit Granny, хотя в API father и grandma
    const nm = { father: 'Daddy', grandma: 'Granny' }[short] || title(short);
    return { id: k, name: tx`Rabbit ${nm}`, level: Number(v) || 0, order: RABBIT_EMPLOYEES.indexOf(short) };
  }).sort((a, b) => (a.order < 0 ? 99 : a.order) - (b.order < 0 ? 99 : b.order));
}

export function viewGardenChips(chips = {}) {
  return Object.entries(chips).map(([k, v]) => {
    const id = tx`${String(k).toUpperCase()}_GARDEN_CHIP`;
    const it = getItemRu(id);
    return { key: k, id: it ? id : null, name: it ? it.nameEn.replace(/\s+Chip$/i, '') : title(k), level: Number(v) || 0, max: GARDEN_CHIP_MAX };
  }).sort((a, b) => b.level - a.level);
}

export function viewGreenhouse(up = {}) {
  return Object.entries(up).map(([k, v]) => ({ key: k, name: GREENHOUSE_RU[String(k).toLowerCase()] || title(k), level: Number(v) || 0 }));
}

const npcId = npc => { const id = tx`${String(npc).toUpperCase()}_NPC`; return getItemRu(id) ? id : null; };
export function viewVisitors(list = []) {
  return list.map(v => ({
    npc: v.npc, name: npcId(v.npc) ? (getItemRu(npcId(v.npc)).nameEn || title(v.npc)) : title(v.npc), npcId: npcId(v.npc),
    items: (v.items || []).map(i => ({ id: i.id, name: itemName(i.id) || title(i.id), amount: i.amount })),
  }));
}

export function viewTreeGifts(g = {}) {
  return Object.entries(g).filter(([, v]) => typeof v === 'number').map(([k, v]) => {
    const log = tx`${String(k).toUpperCase()}_LOG`;
    return { key: k, name: title(k), id: getItemRu(log) ? log : null, n: v };
  }).sort((a, b) => b.n - a.n);
}

export function viewCommunity(up = {}) {
  return Object.entries(up).map(([k, v]) => {
    const key = String(k).toLowerCase();
    return { key, name: COMMUNITY_RU[key] || title(k), level: v, max: COMMUNITY_MAX[key] || null };
  });
}
