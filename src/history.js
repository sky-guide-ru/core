// История показателей профиля: снимок раз в час, старые точки прореживаются,
// чтобы файл не рос бесконечно.
//
//   последние 30 дней  — каждый час
//   от 30 дней до года — одна точка в день (последняя за сутки)
//   старше года        — одна точка в неделю (последняя за неделю)
//
// Сколько это места: снимок ≈ 0,8 КБ в JSON. Полный первый год = 720 часовых + 335 дневных ≈ 1050 точек ≈ 0,85 МБ,
// дальше каждый год добавляет только 52 недельные точки ≈ 40 КБ на профиль (см. estimateBytes).
import fs from 'node:fs';
import path from 'node:path';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
export const HOURLY_FOR = 30 * DAY;
export const DAILY_FOR = 365 * DAY;
// 1970-01-05 — понедельник: недели считаем с понедельника (по UTC)
const MONDAY = 4 * DAY;

/** Ключ «корзины», в которую попадает точка: в одной корзине остаётся только последняя точка. */
function bucket(t, now) {
  const age = now - t;
  if (age <= HOURLY_FOR) return `h${t}`;          // свежие не трогаем
  if (age <= DAILY_FOR) return `d${Math.floor(t / DAY)}`;
  return `w${Math.floor((t - MONDAY) / WEEK)}`;
}

/** Прореживание: история по возрастанию времени → новая история (исходный массив не меняется). */
export function compactHistory(points, now = Date.now()) {
  const sorted = (points || []).filter(p => p && Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  const out = [];
  let lastKey = null;
  for (const p of sorted) {
    const k = bucket(p.t, now);
    if (k === lastKey) out[out.length - 1] = p; // в корзине побеждает более поздняя точка
    else out.push(p);
    lastKey = k;
  }
  return out;
}

/**
 * Добавить снимок, если с прошлой точки прошло больше часа. Возвращает { history, added }.
 * force — записать даже чаще раза в час (не используется сайтом, нужно для тестов).
 */
export function pushSnapshot(history, snap, { now = snap?.t ?? Date.now(), minGap = HOUR } = {}) {
  const last = history[history.length - 1];
  if (!snap || (last && snap.t - last.t < minGap)) return { history, added: false };
  return { history: compactHistory([...history, snap], now), added: true };
}

/** Точки за последние rangeMs (null/0 — вся история). Одна точка до начала окна оставляется как опорная. */
export function sliceRange(points, rangeMs, now = Date.now()) {
  if (!rangeMs) return points;
  const from = now - rangeMs;
  const i = points.findIndex(p => p.t >= from);
  if (i < 0) return points.slice(-1);
  return points.slice(Math.max(0, i - 1));
}

/** Сколько байт займёт история одного профиля через `years` лет (bytesPerPoint — средний размер снимка в JSON). */
export function estimateBytes(years, bytesPerPoint = 800) {
  const hourly = 30 * 24;
  const daily = Math.min(years, 1) * 365 - 30;
  const weekly = Math.max(0, years - 1) * 52;
  return Math.round((hourly + Math.max(0, daily) + weekly) * bytesPerPoint);
}

/**
 * Файлы истории чужих профилей (друзья с аккаунтом на сайте): data/history/<uuid>_<profileId>.json.
 * Свой профиль по-прежнему лежит в profile-history.json вместе с лентой.
 */
export function createHistoryFiles(dir) {
  const file = key => path.join(dir, `${String(key).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
  return {
    load(key) {
      if (!dir) return [];
      try { return JSON.parse(fs.readFileSync(file(key), 'utf8')).history || []; } catch { return []; }
    },
    save(key, history) {
      if (!dir) return;
      try {
        fs.mkdirSync(dir, { recursive: true });
        const f = file(key);
        fs.writeFileSync(f + '.tmp', JSON.stringify({ history }));
        fs.renameSync(f + '.tmp', f);
      } catch (e) { console.warn('[история]', e.message); }
    },
    /** Сколько места занимают все файлы истории (для страницы «Сервер») */
    size() {
      if (!dir) return { files: 0, bytes: 0 };
      try {
        const names = fs.readdirSync(dir).filter(n => n.endsWith('.json'));
        return { files: names.length, bytes: names.reduce((s, n) => s + (fs.statSync(path.join(dir, n)).size || 0), 0) };
      } catch { return { files: 0, bytes: 0 }; }
    },
  };
}
