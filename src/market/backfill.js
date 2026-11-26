// Дозаполнение истории цен за прошлую неделю из публичного API Coflnet (sky.coflnet.com),
// чтобы «Движение цен» и графики работали сразу, а не через сутки после первого запуска.
// Вставляются только часы ДО самой ранней своей точки: свои живые данные не перезаписываются.
// Coflnet просит не долбить API: идём по одному запросу в ~1,2 с, только по самым ходовым товарам.
import { HOUR } from './util.js';
import { tx } from '../../i18n/msg.js';

const BASE = 'https://sky.coflnet.com/api';
const KEEP = 14 * 24 * HOUR;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Coflnet отдаёт время без часового пояса — это UTC (иначе на ПК в UTC+5 история сдвинулась бы на 5 часов)
const utc = t => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(String(t)) ? t : tx`${t}Z`);
const round = v => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'skyblock-tracker (personal use)' }, signal: AbortSignal.timeout(15_000) });
  if (r.status === 429) { const e = new Error('429'); e.rate = true; throw e; }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Слить почасовые точки [[hourTs, ...values]] в ряд store[id], не трогая уже имеющиеся часы. */
export function mergeOlder(store, id, points, now = Date.now()) {
  const arr = store[id] || [];
  const first = arr.length ? arr[0][0] : Infinity;
  const byHour = new Map();
  for (const p of points) {
    const h = Math.floor(p[0] / HOUR) * HOUR;
    if (h >= first || h < now - KEEP || p.slice(1).some(v => !(v > 0))) continue;
    byHour.set(h, [h, ...p.slice(1).map(round)]);
  }
  if (!byHour.size) return 0;
  store[id] = [...[...byHour.values()].sort((a, b) => a[0] - b[0]), ...arr];
  return byHour.size;
}

/** Ответ Coflnet по Bazaar → [[ts, buy, sell]]. Coflnet: buy — цена покупки, sell — цена продажи */
export function parseBazaarHistory(list) {
  const pts = (Array.isArray(list) ? list : []).map(x => [utc(x.timestamp), Number(x.buy), Number(x.sell)]).filter(p => p[0] > 0);
  // Страховка от перепутанных полей: у нас buy (мгновенная покупка) ≥ sell; если у Coflnet наоборот — меняем местами
  const swapped = pts.length && pts.filter(p => p[1] < p[2]).length > pts.length / 2;
  if (swapped) {
    for (const p of pts) [p[1], p[2]] = [p[2], p[1]];
  }
  return pts;
}

/** Ответ Coflnet по аукциону (по умолчанию не используется: min проданных лотов — шумный, одна странная продажа даёт ±1000%) → [[ts, price]] (минимальная цена продажи за час ≈ lowest BIN) */
export function parseAuctionHistory(list) {
  return (Array.isArray(list) ? list : []).map(x => [utc(x.time || x.timestamp), Number(x.min ?? x.avg)]).filter(p => p[0] > 0);
}

let running = false;
/**
 * @param {{ bazaar: Map, bin: Map, history: object, binHistory: object }} prices
 * @param {{ bazaarLimit?: number, binLimit?: number, onSave?: () => void, log?: (...a) => void }} opts
 */
export async function backfillHistory(prices, { bazaarLimit = 250, binLimit = 0, onSave = () => {}, log = console.log } = {}) {
  if (running) return;
  running = true;
  const need = arr => !arr || !arr.length || arr[0][0] > Date.now() - 6 * 24 * HOUR; // меньше ~6 дней истории
  const bz = [...prices.bazaar.entries()]
    .filter(([id]) => need(prices.history[id]))
    .sort((a, b) => ((b[1].buyWeek || 0) + (b[1].sellWeek || 0)) * (b[1].sell || 0) - ((a[1].buyWeek || 0) + (a[1].sellWeek || 0)) * (a[1].sell || 0))
    .slice(0, bazaarLimit);
  const ah = [...prices.bin.entries()]
    .filter(([id]) => !id.includes(';') && need(prices.binHistory[id]))
    .sort((a, b) => (b[1].count || 0) * b[1].price - (a[1].count || 0) * a[1].price)
    .slice(0, binLimit);
  if (!bz.length && !ah.length) { running = false; return; }
  log(`[история цен] дозаполняю прошлую неделю с Coflnet: Bazaar ${bz.length}, аукцион ${ah.length} товаров`);
  let added = 0, fails = 0, done = 0;
  const jobs = [
    ...bz.map(([id]) => async () => mergeOlder(prices.history, id, parseBazaarHistory(await getJson(`${BASE}/bazaar/${encodeURIComponent(id)}/history/week`)))),
    ...ah.map(([id]) => async () => mergeOlder(prices.binHistory, id, parseAuctionHistory(await getJson(`${BASE}/item/price/${encodeURIComponent(id)}/history/week`)))),
  ];
  try {
    for (const job of jobs) {
      try { added += await job(); }
      catch (e) {
        if (e.rate) { await sleep(30_000); continue; }
        if (++fails >= 15 && added === 0) { log('[история цен] Coflnet недоступен, пропускаю дозаполнение'); break; }
      }
      if (++done % 50 === 0) onSave();
      await sleep(1200);
    }
  } finally {
    onSave();
    running = false;
    log(`[история цен] дозаполнено часов: ${added}`);
  }
}

// ---------- свечи для раздела «Рынок» ----------
let candlesRunning = false;
/**
 * Дозаполнить свечи графиков за прошлый месяц с Coflnet (часовые и дневные), чтобы на «Рынке» сразу была история,
 * а не только то, что сервер успел накопить сам. Берутся только самые ходовые товары; свои свечи не трогаются.
 * Товар пропускается, если у него уже есть 25+ дней часовых свечей. Ответ Coflnet разбирается с запасом:
 * если формат поменяется, просто ничего не добавится.
 * @param {{ insertOlder: Function, firstTime: Function }} store
 * @param {{ bazaar: Map }} prices
 * @param {{ coflToCandles: Function, limit?: number, log?: Function, fetchJson?: Function, pause?: number }} opts
 */
export async function backfillCandles(store, prices, { coflToCandles, limit = 250, log = console.log, fetchJson = getJson, pause = 1200 } = {}) {
  if (candlesRunning) return 0;
  candlesRunning = true;
  let added = 0, fails = 0;
  try {
    const want = Date.now() / 1000 - 25 * 86400;
    const top = [...prices.bazaar.entries()]
      .sort((a, b) => ((b[1].buyWeek || 0) + (b[1].sellWeek || 0)) * (b[1].sell || 0) - ((a[1].buyWeek || 0) + (a[1].sellWeek || 0)) * (a[1].sell || 0))
      .slice(0, limit).map(([id]) => id);
    const todo = [];
    for (const id of top) { const f = await store.firstTime(id, '1h'); if (f == null || f > want) todo.push(id); }
    if (!todo.length) return 0;
    log(`[рынок] дозаполняю свечи за месяц с Coflnet: ${todo.length} товаров`);
    for (const id of todo) {
      try {
        const list = await fetchJson(`${BASE}/bazaar/${encodeURIComponent(id)}/history/month`);
        added += await store.insertOlder(id, '1h', coflToCandles(list, '1h'));
        added += await store.insertOlder(id, '1d', coflToCandles(list, '1d'));
      } catch (e) {
        if (e.rate) { await sleep(30_000); continue; }
        if (++fails >= 15 && added === 0) { log('[рынок] Coflnet недоступен, свечи не дозаполнены'); break; }
      }
      await sleep(pause);
    }
    log(`[рынок] дозаполнено свечей: ${added}`);
    return added;
  } finally {
    candlesRunning = false;
  }
}
