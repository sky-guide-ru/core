import { tx } from '../../i18n/msg.js';
// Свечи Bazaar для биржевых графиков раздела «Рынок»: чистые функции без диска и сети.
// Свеча — массив из 11 чисел:
//   [t, bo, bh, bl, bc, so, sh, sl, sc, bv, sv]
//   t — начало свечи в секундах (UTC);
//   bo/bh/bl/bc — открытие/максимум/минимум/закрытие цены мгновенной покупки (лучший ордер на продажу);
//   so/sh/sl/sc — то же для цены мгновенной продажи (лучший ордер на покупку);
//   bv/sv — примерный объём: сколько штук купили и продали мгновенно за свечу (оценка, см. volumeDelta).
export const N = 11;

// Базовые ряды, которые хранятся на диске, и сколько их держим (секунды)
export const BASES = {
  '1m': { sec: 60, keep: 3 * 86400 },
  '5m': { sec: 300, keep: 30 * 86400 },
  '1h': { sec: 3600, keep: 366 * 86400 },
  '1d': { sec: 86400, keep: Infinity },
};
export const BASE_LIST = Object.keys(BASES);

// Периоды свечей на графике: из какого базового ряда строятся и как считается начало свечи
const WEEK = 7 * 86400;
const MONDAY = 4 * 86400; // 1 января 1970 — четверг, первый понедельник — 5 января
export const TIMEFRAMES = {
  '1m': { base: '1m', sec: 60 },
  '5m': { base: '5m', sec: 300, fine: '1m' },
  '15m': { base: '5m', sec: 900, fine: '1m' },
  '30m': { base: '5m', sec: 1800 },
  '1h': { base: '1h', sec: 3600 },
  '4h': { base: '1h', sec: 4 * 3600 },
  '1d': { base: '1d', sec: 86400 },
  '1w': { base: '1d', sec: WEEK },
  '1M': { base: '1d', sec: 30 * 86400, month: true },
};

/** Начало свечи периода tf, в которую попадает момент t (секунды). */
export function bucketOf(t, tf) {
  const f = TIMEFRAMES[tf] || BASES[tf];
  if (!f) throw new Error(tx`неизвестный период ${tf}`);
  if (f.month) { const d = new Date(t * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000; }
  if (f.sec === WEEK) return Math.floor((t - MONDAY) / WEEK) * WEEK + MONDAY;
  return Math.floor(t / f.sec) * f.sec;
}

const r = v => (!Number.isFinite(v) ? 0 : Math.abs(v) >= 1000 ? Math.round(v) : Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

/** Новая свеча из одного наблюдения. */
export function openCandle(t, buy, sell, bv = 0, sv = 0) {
  return [t, buy, buy, buy, buy, sell, sell, sell, sell, bv, sv];
}

/** Добавить наблюдение в открытую свечу (на месте). */
export function addTick(c, buy, sell, bv = 0, sv = 0) {
  if (buy > c[2]) c[2] = buy;
  if (buy < c[3]) c[3] = buy;
  c[4] = buy;
  if (sell > c[6]) c[6] = sell;
  if (sell < c[7]) c[7] = sell;
  c[8] = sell;
  c[9] += bv;
  c[10] += sv;
  return c;
}

/** Слить свечу b (более позднюю) в свечу a (на месте). */
export function mergeInto(a, b) {
  if (b[2] > a[2]) a[2] = b[2];
  if (b[3] < a[3]) a[3] = b[3];
  a[4] = b[4];
  if (b[6] > a[6]) a[6] = b[6];
  if (b[7] < a[7]) a[7] = b[7];
  a[8] = b[8];
  a[9] += b[9];
  a[10] += b[10];
  return a;
}

/**
 * Свечи одного ряда → свечи периода tf. Вход отсортирован по времени; свечи с одинаковым началом
 * (после перезапуска сервера записывается вторая половина той же минуты) сливаются.
 */
export function aggregate(list, tf, merge = mergeInto) {
  const out = [];
  let cur = null;
  for (const c of list) {
    const b = bucketOf(c[0], tf);
    if (cur && cur[0] === b) { merge(cur, c); continue; }
    if (cur && b < cur[0]) continue; // запись из прошлого (сбились часы) — пропускаем
    cur = c.slice();
    cur[0] = b;
    out.push(cur);
  }
  return out;
}

/**
 * «Плоские» свечи (одно наблюдение: открытие = максимум = минимум = закрытие) — почасовые средние из старой истории
 * и минуты тонких товаров, где за минуту пришло одно обновление. На свечном графике они выглядят чёрточками
 * на разной высоте. Как на биржах, открываем такую свечу по закрытию предыдущей (если разрыв не больше трёх свечей),
 * тогда график идёт непрерывно. Меняет копию, вход не трогает.
 */
export function bridgeFlat(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i].slice();
    const p = out[i - 1];
    const step = i >= 2 ? list[i - 1][0] - list[i - 2][0] : i === 1 ? list[1][0] - list[0][0] : 0;
    if (p && step > 0 && c[0] - p[0] <= step * 3) {
      for (const k of [1, 5]) {
        if (c[k] === c[k + 1] && c[k] === c[k + 2] && c[k] === c[k + 3] && p[k + 3] > 0) {
          c[k] = p[k + 3];
          c[k + 1] = Math.max(c[k + 1], c[k]);
          c[k + 2] = Math.min(c[k + 2], c[k]);
        }
      }
    }
    out.push(c);
  }
  return out;
}

/**
 * Выбросы тонкого стакана: один ордер на минуту делает цену в разы выше/ниже — на графике это иголка через весь экран,
 * а остальные свечи сплющиваются. Свечу, чьё закрытие в 2,5+ раза отличается от медианы соседей (по 5 с каждой стороны),
 * приравниваем к предыдущей; тени длиннее половины цены тела обрезаем. Меняет копию.
 */
export function cleanSpikes(list) {
  const out = list.map(c => c.slice());
  const med = a => { const b = a.filter(v => v > 0).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  for (const k of [1, 5]) {
    const closes = list.map(c => c[k + 3]);
    for (let i = 0; i < out.length; i++) {
      const c = out[i];
      const around = [...closes.slice(Math.max(0, i - 5), i), ...closes.slice(i + 1, i + 6)];
      const m = around.length >= 4 ? med(around) : 0;
      if (m > 0 && (c[k + 3] > m * 2.5 || c[k + 3] < m / 2.5)) {
        const p = i > 0 ? out[i - 1][k + 3] : m;
        c[k] = c[k + 1] = c[k + 2] = c[k + 3] = p;
        continue;
      }
      const top = Math.max(c[k], c[k + 3]), bot = Math.min(c[k], c[k + 3]);
      if (c[k + 1] > top * 1.5) c[k + 1] = top * 1.5;
      if (c[k + 2] < bot / 1.5) c[k + 2] = bot / 1.5;
    }
  }
  return out;
}

/** Округлить цены и объёмы для ответа API (меньше трафика). */
export const compact = c => c.map((v, i) => (i === 0 ? v : r(v)));

/**
 * Примерный объём за интервал по скользящему недельному счётчику Hypixel (buyMovingWeek / sellMovingWeek).
 * Счётчик = продажи за последние 7 суток: за dt секунд в него добавились новые сделки и выпали сделки недельной давности.
 * Выпавшие оцениваем средним темпом недели, поэтому объём ≈ Δсчётчика + неделя·dt/7сут (не меньше нуля).
 */
export function volumeDelta(prevWeek, week, dtSec) {
  if (!(prevWeek >= 0) || !(week >= 0) || !(dtSec > 0)) return 0;
  const v = week - prevWeek + (week * Math.min(dtSec, 3600)) / WEEK;
  return v > 0 ? v : 0;
}

/**
 * Точки истории Coflnet → свечи ряда base. Coflnet отдаёт средние цены за интервал и иногда min/max.
 * @param {Array<{timestamp:string, buy:number, sell:number, maxBuy?:number, minBuy?:number, maxSell?:number, minSell?:number}>} list
 */
export function coflToCandles(list, base) {
  const utc = t => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(String(t)) ? t : tx`${t}Z`) / 1000;
  let pts = (Array.isArray(list) ? list : []).map(x => ({
    t: utc(x.timestamp || x.time),
    b: Number(x.buy), s: Number(x.sell),
    bh: Number(x.maxBuy), bl: Number(x.minBuy), sh: Number(x.maxSell), sl: Number(x.minSell),
  })).filter(p => p.t > 0 && p.b > 0 && p.s > 0).sort((a, b) => a.t - b.t);
  // У нас цена покупки ≥ цены продажи; если у Coflnet в большинстве точек наоборот — поля перепутаны
  if (pts.length && pts.filter(p => p.b < p.s).length > pts.length / 2) {
    pts = pts.map(p => ({ t: p.t, b: p.s, s: p.b, bh: p.sh, bl: p.sl, sh: p.bh, sl: p.bl }));
  }
  const raw = pts.map(p => {
    const c = openCandle(p.t, p.b, p.s);
    // min/max только если они правдоподобны (охватывают среднюю цену и не дальше чем в 20 раз)
    const ok = (lo, v, hi) => lo > 0 && hi >= v && lo <= v && hi / lo < 20;
    if (ok(p.bl, p.b, p.bh)) { c[2] = p.bh; c[3] = p.bl; }
    if (ok(p.sl, p.s, p.sh)) { c[6] = p.sh; c[7] = p.sl; }
    return c;
  });
  return aggregate(raw, base);
}

/** Почасовые точки старой истории [[часMs, buy, sell]] → свечи ряда base (только средние, без min/max). */
export function hourlyToCandles(points, base) {
  const raw = (points || []).filter(p => p[1] > 0 && p[2] > 0).map(p => openCandle(Math.floor(p[0] / 1000), p[1], p[2]));
  return aggregate(raw, base);
}
