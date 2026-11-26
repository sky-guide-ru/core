// Мелкие помощники без зависимостей

export const MIN = 60_000;
export const HOUR = 60 * MIN;

/** 1234567 → «1,2M», 75800000 → «75,8M» (коротко, как в игре) */
export function fmtCoins(n) {
  if (n == null || !Number.isFinite(n)) return '?';
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  const f = (v, u) => `${s}${(+v.toFixed(v >= 100 ? 0 : 1)).toString().replace('.', ',')}${u}`;
  if (a >= 1e9) return f(a / 1e9, 'B');
  if (a >= 1e6) return f(a / 1e6, 'M');
  if (a >= 1e3) return f(a / 1e3, 'k');
  return `${s}${Math.round(a)}`;
}

export function pct(from, to) {
  if (!from) return to ? Infinity : 0;
  return (to - from) / from;
}

export function fmtPct(p) {
  const v = Math.round(p * 100);
  return `${v > 0 ? '+' : ''}${v}%`;
}

/** Дата в часовом поясе пользователя, для текста дайджеста (без секунд, чтобы не ломать кэш лишний раз) */
export function fmtTime(ts, tz = 'Europe/Moscow') {
  try {
    return new Date(ts).toLocaleString('ru-RU', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Детерминированный JSON (сортировка ключей) — чтобы одинаковые данные давали одинаковые байты для кэша */
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Грубая оценка числа токенов (только для симуляции без API): кириллица ≈ 2,6 символа на токен, латиница ≈ 3,8 */
export function estimateTokens(text) {
  const s = String(text || '');
  let cyr = 0;
  for (const ch of s) if (ch >= 'Ѐ' && ch <= 'ӿ') cyr++;
  return Math.ceil(cyr / 2.6 + (s.length - cyr) / 3.8);
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function dayKey(ts, tz = 'Europe/Moscow') {
  try {
    return new Date(ts).toLocaleDateString('sv-SE', { timeZone: tz }); // YYYY-MM-DD
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}
