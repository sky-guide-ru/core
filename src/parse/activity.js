// Когда игрок последний раз что-то делал в SkyBlock. Поле profile.last_save Hypixel больше не отдаёт (на живых
// профилях null), поэтому собираем метки времени, которые игра пишет сама: этажи данжей, Jacob, квесты Crimson Isle,
// Experiments, смерти, Chocolate Factory, Trapper, Rift и так далее. Самая поздняя — последний заход.
import { sbStart } from '../calendar/time.js';

const FIRST = Date.UTC(2019, 5, 1);
// Ключи с моментом действия. first_join сюда не входит: это начало профиля, а не заход
const KEY = /(timestamp|_ts$|completed_at|last_attempt|last_claimed|last_death|last_viewed|last_access|last_task_time|last_free|last_give|last_payment|last_changed|last_complete|recent_refreshes|feeder_uses)/i;
const SKIP = /^(inventory|inv_|ender_chest|wardrobe|backpack|bag_contents|sacks_counts|collection|first_join)/i;

const asMs = (v, now) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e11 ? n * 1000 : n; // секунды или миллисекунды
  return ms >= FIRST && ms <= now + 3600_000 ? Math.min(ms, now) : null;
};

/**
 * Метки активности игрока (мс, по убыванию, без повторов).
 * @param {object} m сырой участник профиля (members[uuid])
 * @param {{ now?: number, bank?: Array<{at:number}> }} [o] bank — переводы банка, только для одиночного профиля
 * @returns {number[]}
 */
export function activityTimes(m, { now = Date.now(), bank = [] } = {}) {
  const out = new Set();
  const seen = new Set();
  const walk = (o, key, depth) => {
    if (o == null || depth > 8) return;
    if (typeof o === 'number' || typeof o === 'string') {
      if (KEY.test(key)) { const t = asMs(o, now); if (t) out.add(t); }
      return;
    }
    if (typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) { for (const v of o.slice(0, 200)) walk(v, key, depth + 1); return; }
    for (const [k, v] of Object.entries(o)) {
      if (SKIP.test(k)) continue;
      walk(v, k, depth + 1);
    }
  };
  try { walk(m, '', 0); } catch { /* странный профиль — что успели собрать */ }
  // Jacob: ключи конкурсов «год:месяц_день:культура» (год с 0, месяц с 0)
  for (const key of Object.keys(m?.jacobs_contest?.contests || {})) {
    const [y, md] = key.split(':');
    const [mo, d] = String(md || '').split('_').map(Number);
    const t = sbStart(Number(y) + 1, mo, d || 1);
    if (Number.isFinite(t) && t >= FIRST && t <= now) out.add(t);
  }
  for (const b of bank || []) { const t = asMs(b?.at, now); if (t) out.add(t); }
  return [...out].sort((a, b) => b - a);
}

/**
 * Короче для хранения: метки за последние 15 дней (по одной на час) и три более старые — этого хватает,
 * чтобы найти перерыв в 30+ дней, закончившийся недавно.
 * @param {number[]} times по убыванию
 */
export function compactActivity(times, now = Date.now()) {
  const H = 3600_000, recent = now - 15 * 86400_000;
  const hours = new Set(), out = [];
  let older = 0;
  for (const t of times) {
    if (t >= recent) { const h = Math.floor(t / H); if (!hours.has(h)) { hours.add(h); out.push(t); } }
    else if (older++ < 3) out.push(t);
    else break;
  }
  return out;
}
