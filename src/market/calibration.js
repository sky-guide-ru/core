// Личная калибровка: игрок записывает свои сессии, и доход в час считается по его реальным результатам
/** @typedef {{ method: string, minutes: number, coins: number, ts: number, note?: string }} Session */

const WINDOW = 30 * 24 * 3600_000;

/** Проверка и нормализация новой сессии. Бросает ошибку с русским текстом при неверных данных. */
export function makeSession({ method, minutes, coins, note }, now = Date.now()) {
  const min = Number(minutes), c = Number(coins);
  if (!method || typeof method !== 'string') throw new Error('Не указан метод заработка');
  if (!(min > 0 && min <= 24 * 60)) throw new Error('Длительность должна быть от 1 минуты до 24 часов');
  if (!Number.isFinite(c)) throw new Error('Заработок должен быть числом');
  return { method, minutes: min, coins: c, ts: now, note: note ? String(note).slice(0, 200) : undefined };
}

/** Доход в час по сессиям метода за последние 30 дней (нужно минимум 30 минут игры). */
export function personalRate(sessions, method, now = Date.now()) {
  if (!sessions?.length) return null;
  const list = sessions.filter(s => s.method === method && s.ts >= now - WINDOW);
  const minutes = list.reduce((s, x) => s + x.minutes, 0);
  if (minutes < 30) return null;
  const coins = list.reduce((s, x) => s + x.coins, 0);
  return { coinsPerHour: coins / (minutes / 60), sessions: list.length, minutes };
}
