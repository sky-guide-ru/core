// Самые сильные изменения цен на Bazaar и аукционе (для ленты «что подорожало/подешевело»)
import { HOUR, DAY, median, nameOf } from './util.js';
import { categoryOf } from './categories.js';

const PERIOD = { d1: DAY, d7: 7 * DAY };

/**
 * Сглаженная цена около момента ts: медиана почасовых точек в окне ±half.
 * Одна странная точка (кто-то выставил ордер на минуту, единичная продажа) так не делает «+700%».
 */
function smoothAt(points, ts, idx, half) {
  const vals = [];
  for (const p of points || []) if (Math.abs(p[0] - ts) <= half && p[idx] > 0) vals.push(p[idx]);
  return vals.length ? median(vals) : null;
}

/** Оборот за неделю в монетах — по меньшей из сторон (продать столько реально можно) */
const bazaarWeekly = p => Math.min(p.buyWeek || 0, p.sellWeek || 0) * (p.sell || 0);

/**
 * @param {import('./flips.js').MarketCtx} ctx
 * @param {{ period?: 'd1'|'d7', limit?: number, minWeeklyCoins?: number, bigMoveWeeklyCoins?: number }} [opts]
 *   minWeeklyCoins — порог оборота за неделю для попадания в ленту;
 *   bigMoveWeeklyCoins — порог для движений больше ±100%: на тонком рынке это почти всегда шум
 * @returns {{ up: object[], down: object[] }}
 */
export function topMovers(ctx, { period = 'd1', limit = 15, minWeeklyCoins = 100_000_000, bigMoveWeeklyCoins = 1_000_000_000 } = {}) {
  const now = ctx.now || Date.now();
  const span = PERIOD[period] || DAY;
  const half = period === 'd7' ? 6 * HOUR : 1.5 * HOUR;
  const minSpan = period === 'd7' ? 2 * DAY : DAY; // неделя: как и раньше, хватит 2 суток истории
  // Момент «тогда»: ровно период назад, а если истории меньше — самая старая точка (но не моложе minSpan)
  const refTs = pts => {
    const t = Math.max(now - span, pts[0][0] + half);
    return t <= now - minSpan + half ? t : null;
  };
  const rows = [];
  const add = (id, market, cur, from, weekly, extra = {}) => {
    if (!cur || !from) return;
    const pct = Math.round((cur / from - 1) * 1000) / 10;
    if (Math.abs(pct) > 100 && weekly != null && weekly < bigMoveWeeklyCoins) return;
    rows.push({ id, name: nameOf(ctx, id), category: categoryOf(id, ctx), market, now: cur, from, pct, weekly, ...extra });
  };
  for (const [id, p] of ctx.bazaar) {
    if (!p.sell) continue;
    const weekly = bazaarWeekly(p);
    if (weekly < minWeeklyCoins) continue;
    const pts = ctx.history?.[id];
    const ref = pts?.length ? refTs(pts) : null;
    if (ref == null) continue; // истории меньше периода — сравнивать не с чем
    // «Сейчас» — текущая цена (её и видно на Bazaar), «тогда» — медиана часов вокруг момента периода назад
    add(id, 'Bazaar', p.sell, smoothAt(pts, ref, 2, half), weekly);
  }
  for (const [id, b] of ctx.bin) {
    if ((b.count || 0) < 10 || b.price < 100_000) continue; // редкие лоты дают шум ±1000% от одной продажи
    const pts = ctx.binHistory?.[id];
    const ref = pts?.length ? refTs(pts) : null;
    if (ref == null) continue;
    add(id, 'Auction House', b.price, smoothAt(pts, ref, 1, half), null, { lots: b.count });
  }
  // Аномалии (×10 и больше за период) почти всегда — ошибка лота, а не движение рынка
  const sane = rows.filter(r => r.pct < 900 && r.pct > -90);
  const up = sane.filter(r => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, limit);
  const down = sane.filter(r => r.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, limit);
  return { up, down };
}
