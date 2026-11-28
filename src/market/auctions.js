// Аукцион: ключ предмета, сборка lowest BIN, учёт реальных продаж (auctions_ended)
import { HOUR, DAY, median, mean } from './util.js';
import { tx } from '../../i18n/msg.js';

const PET_TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
// Опыт питомца до 100 уровня по редкости (таблица pet_levels NEU; Mythic как Legendary)
const PET_MAX_EXP = [5_624_785, 8_644_220, 12_626_665, 18_608_500, 25_353_230, 25_353_230];

/**
 * Ключ предмета для цен аукциона.
 * @param {{ id: string|null, pet?: any, enchants?: Record<string, number> }} item нормализованный предмет (nbt.js normalizeItem)
 * @param {any} [ea] сырые ExtraAttributes (для рун)
 * @returns {{ key: string, petMax?: boolean } | null}
 */
export function auctionKey(item, ea = {}) {
  if (!item?.id) return null;
  let id = item.id;
  if (item.pet) {
    const tier = PET_TIERS.indexOf(item.pet.tier);
    const max = tier >= 0 && Number(item.pet.exp || 0) >= PET_MAX_EXP[tier];
    return { key: id, petMax: max };
  }
  if (id === 'ENCHANTED_BOOK') {
    const ench = Object.entries(item.enchants || {});
    if (ench.length !== 1) return null; // книги с несколькими чарами не сравнимы
    const [name, lvl] = ench[0];
    return { key: tx`ENCHANTMENT_${String(name).toUpperCase()}_${lvl}` };
  }
  // Зелья лежат под общим id POTION: ключ как в NEU — POTION_STRENGTH;8. Splash-зелья не смешиваем с обычными.
  if (id === 'POTION' && ea?.potion && !ea.splash) {
    const lvl = Number(ea.potion_level) || 0;
    if (lvl > 0) return { key: `POTION_${String(ea.potion).toUpperCase()};${lvl}` };
  }
  if ((id === 'RUNE' || id === 'UNIQUE_RUNE') && ea?.runes) {
    const r = Object.entries(ea.runes)[0];
    if (r) return { key: tx`${String(r[0]).toUpperCase()}_RUNE;${r[1]}` };
  }
  return { key: id };
}

/** Сборщик lowest BIN за один полный проход по аукциону */
export function createBinBuilder() {
  const map = new Map();
  return {
    /** @param {string} key @param {number} price цена за штуку @param {string} [uuid] @param {boolean} [petMax] */
    add(key, price, uuid, petMax) {
      if (!(price > 0)) return;
      let e = map.get(key);
      if (!e) { e = { price, count: 0, second: 0, auction: uuid || null }; map.set(key, e); }
      e.count++;
      if (e.count === 1) { /* первая запись */ }
      else if (price < e.price) { e.second = e.price; e.price = price; e.auction = uuid || null; }
      else if (!e.second || price < e.second) e.second = price;
      if (petMax) e.max = e.max ? Math.min(e.max, price) : price;
    },
    result() {
      for (const e of map.values()) { e.price = Math.round(e.price * 10) / 10; e.second = Math.round(e.second * 10) / 10; }
      return map;
    },
  };
}

// ---------- Реальные продажи ----------
/**
 * @typedef {{ samples: Record<string, [number, number][]>, hourly: Record<string, [number, number, number, number, number][]> }} SoldStore
 * samples[key] = [[ts, цена за штуку], ...] — последние продажи (до 60 штук, до 7 дней)
 * hourly[key]  = [[часТs, кол-во, сумма, мин, макс], ...] — 14 дней
 */
export function createSoldStore() { return { samples: {}, hourly: {} }; }

const MAX_SAMPLES = 60;
const KEEP_SAMPLES = 7 * DAY;
const KEEP_HOURLY = 14 * DAY;

/** Добавить продажу. */
export function recordSale(store, key, price, ts = Date.now()) {
  if (!key || !(price > 0)) return;
  const s = (store.samples[key] ||= []);
  s.push([ts, price]);
  if (s.length > MAX_SAMPLES) s.splice(0, s.length - MAX_SAMPLES);
  const h = (store.hourly[key] ||= []);
  const bucket = Math.floor(ts / HOUR) * HOUR;
  const last = h[h.length - 1];
  if (last && last[0] === bucket) {
    last[1]++; last[2] += price; last[3] = Math.min(last[3], price); last[4] = Math.max(last[4], price);
  } else h.push([bucket, 1, price, price, price]);
}

/** Удалить устаревшие данные. */
export function pruneSold(store, now = Date.now()) {
  for (const [k, s] of Object.entries(store.samples)) {
    while (s.length && s[0][0] < now - KEEP_SAMPLES) s.shift();
    if (!s.length) delete store.samples[k];
  }
  for (const [k, h] of Object.entries(store.hourly)) {
    while (h.length && h[0][0] < now - KEEP_HOURLY) h.shift();
    if (!h.length) delete store.hourly[k];
  }
}

/**
 * Статистика продаж по ключу.
 * @returns {{ count24h: number, count7d: number, avg24h: number, median: number, last: number, lastAt: number } | null}
 */
export function soldStats(store, key, now = Date.now()) {
  const h = store.hourly[key];
  const s = store.samples[key];
  if (!h && !s) return null;
  let count24h = 0, sum24h = 0, count7d = 0;
  for (const [t, c, sum] of h || []) {
    if (t >= now - DAY) { count24h += c; sum24h += sum; }
    if (t >= now - 7 * DAY) count7d += c;
  }
  // медиана по последним продажам устойчива к единичным «ошибочным» продажам
  const recent = (s || []).filter(([t]) => t >= now - 3 * DAY).map(x => x[1]);
  const pool = recent.length >= 3 ? recent : (s || []).map(x => x[1]);
  return {
    count24h, count7d,
    avg24h: count24h ? sum24h / count24h : 0,
    median: Math.round(median(pool)),
    mean: Math.round(mean(pool)),
    last: s?.at(-1)?.[1] || 0,
    lastAt: s?.at(-1)?.[0] || 0,
  };
}
