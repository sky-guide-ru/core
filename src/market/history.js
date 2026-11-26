// История цен: почасовые средние и расчёт трендов
import { HOUR, DAY, median } from './util.js';

const KEEP = 14 * DAY;

/**
 * Добавить наблюдение в почасовую историю как среднее за час.
 * Точка: [часTs, v1, v2, ...]; счётчик наблюдений текущего часа хранится в counters (не сохраняется на диск).
 * @param {Record<string, number[][]>} store
 * @param {Map<string, number>} counters
 * @param {string} id
 * @param {number} ts
 * @param {number[]} values
 */
export function pushHourly(store, counters, id, ts, values) {
  const bucket = Math.floor(ts / HOUR) * HOUR;
  const arr = (store[id] ||= []);
  const last = arr[arr.length - 1];
  if (last && last[0] === bucket) {
    const n = (counters.get(id) || 1) + 1;
    counters.set(id, n);
    for (let i = 0; i < values.length; i++) {
      const prev = last[i + 1] ?? values[i];
      last[i + 1] = round(prev + (values[i] - prev) / n);
    }
  } else {
    arr.push([bucket, ...values.map(round)]);
    counters.set(id, 1);
  }
  while (arr.length && arr[0][0] < ts - KEEP) arr.shift();
}

const round = v => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

/** Значение ряда на момент (ближайшая точка не позже ts). */
function valueAt(points, ts, idx) {
  let best = null;
  for (const p of points) {
    if (p[0] <= ts) best = p; else break;
  }
  return best ? best[idx] : null;
}

/**
 * Тренд цены по истории.
 * @param {number[][]} points [[ts, ...values]]
 * @param {number} now текущее значение
 * @param {number} idx индекс значения в точке (1 — первое значение)
 * @param {number} [ts]
 */
export function trend(points, now, idx = 1, ts = Date.now()) {
  if (!points?.length || !now) return { now: now || 0, d1: null, d7: null, min7: null, max7: null, median7: null, volatility: null, points: 0 };
  const week = points.filter(p => p[0] >= ts - 7 * DAY).map(p => p[idx]).filter(v => v > 0);
  const p1 = valueAt(points, ts - DAY, idx);
  // если истории меньше недели, берём самую старую точку, но только когда ей хотя бы 2 суток,
  // иначе «изменение за неделю» на деле было бы изменением за пару часов после запуска
  const first = points.find(p => p[0] >= ts - 7 * DAY);
  const p7 = valueAt(points, ts - 7 * DAY, idx) ?? (first && first[0] <= ts - 2 * DAY ? first[idx] : null);
  const pct = from => (from ? Math.round((now / from - 1) * 1000) / 10 : null);
  const med = median(week);
  // волатильность: средний модуль почасового изменения, %
  let vol = 0;
  for (let i = 1; i < week.length; i++) vol += Math.abs(week[i] / week[i - 1] - 1);
  return {
    now,
    d1: p1 ? { from: p1, pct: pct(p1) } : null,
    d7: p7 ? { from: p7, pct: pct(p7) } : null,
    min7: week.length ? Math.min(...week) : null,
    max7: week.length ? Math.max(...week) : null,
    median7: med || null,
    volatility: week.length > 1 ? Math.round(vol / (week.length - 1) * 1000) / 10 : null,
    points: week.length,
  };
}

/** Направление тренда словами для интерфейса */
export function trendLabel(t) {
  const p = t?.d1?.pct ?? t?.d7?.pct;
  if (p == null) return 'нет данных';
  if (p > 15) return 'резкий рост';
  if (p > 3) return 'растёт';
  if (p < -15) return 'резкое падение';
  if (p < -3) return 'падает';
  return 'стабильно';
}

/**
 * Изменение за сутки, %: текущая цена против МЕДИАНЫ почасовых точек 18–30 часов назад (а не одной точки).
 * Одна случайная цена (ордер за 1 монету у товара без сделок) давала «+1 923 995 500%».
 * Истории меньше суток — медиана первых трёх точек, если им хотя бы 6 часов. Нет данных — null.
 * @param {number[][]} points [[часMs, v1, v2...]] по возрастанию
 * @param {number} now текущая цена
 * @param {number} [idx] индекс значения в точке
 */
export function dayChangePct(points, now, idx = 1, ts = Date.now()) {
  if (!points?.length || !(now > 0)) return null;
  let win = points.filter(p => p[0] >= ts - 30 * HOUR && p[0] <= ts - 18 * HOUR).map(p => p[idx]).filter(v => v > 0);
  if (!win.length && points[0][0] <= ts - 6 * HOUR) win = points.slice(0, 3).filter(p => p[0] <= ts - 6 * HOUR).map(p => p[idx]).filter(v => v > 0);
  const from = median(win);
  return from > 0 ? Math.round((now / from - 1) * 1000) / 10 : null;
}
