// Цены: Bazaar (официальный API), lowest BIN по полному скану аукциона, реальные продажи (auctions_ended),
// почасовая история (14 дней) и тренды. Замена server/prices.js ядра: прежние экспорты сохранены.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';
import { config } from './config.js';
import { getBazaar, getAuctionPage } from './hypixel.js';
import { getJson } from './http.js';
import { normalizeItem } from './nbt.js';
import { parseBazaar } from './market/bazaar.js';
import { auctionKey, createBinBuilder, createSoldStore, recordSale, pruneSold, soldStats } from './market/auctions.js';
import { pushHourly, trend, trendLabel } from './market/history.js';
import { variantKey } from './market/resale.js';
import { makeQuote, buyOf } from './market/quote.js';

export const prices = {
  bazaar: new Map(),     // id -> { buy, sell, buyVol, sellVol, buyWeek, sellWeek, buyOrders, sellOrders, buyAvg, sellAvg }
  bin: new Map(),        // id -> { price, count, second, auction, max? }  (max — цена питомца 100 уровня)
  binVar: new Map(),     // 'ID@5r' -> то же для вариантов: звёзды 0/5/10, r — с Recombobulator (флипы улучшений)
  bazaarAt: 0,
  bazaarDemo: false,     // цены из data/fixture-bazaar.json (нет сети) — графики «Рынка» рисуют примерную историю
  binAt: 0,
  binError: null,        // текст последней ошибки скана аукциона (null — всё хорошо)
  soldAt: 0,
  history: {},           // id -> [[часTs, buy, sell]] среднее за час, 14 дней
  binHistory: {},        // id -> [[часTs, price]]
  sold: createSoldStore(), // реальные продажи аукциона
};

/** Подписчики на аукцион (графики «Рынка», routes/charts.js): scan(lowest, binVar, ts) после скана, sale(ключ, цена за штуку, ts, штук) на каждую продажу */
export const auctionHooks = { scan: null, sale: null };

/** Цены уже пришли (после перезапуска сервера первые ~20-60 с их нет и предметы стоят «0») */
export function pricesReady() {
  return prices.bazaarAt > 0 && (prices.binAt > 0 || !!prices.binError);
}

const HIST_FILE = () => path.join(config.dataDir, 'price-history.json');
const BIN_FILE = () => path.join(config.dataDir, 'ah-lowest.json');
const BIN_FRESH_MS = 30 * 60_000;

// Тёплый старт аукциона: после перезапуска (каждое обновление сайта) первый полный скан — это все страницы
// и разбор десятков тысяч лотов, до минуты. Всё это время «Рынок» писал «updated never», а оценки шли без цен AH.
// Поэтому последний результат скана лежит на диске, и сервер стартует с ним (если ему не больше 30 минут)
export function loadLowestBin(now = Date.now()) {
  try {
    const d = JSON.parse(fs.readFileSync(BIN_FILE(), 'utf8'));
    if (!d?.at || now - d.at > BIN_FRESH_MS || prices.binAt) return false;
    prices.bin = new Map(d.bin || []);
    prices.binVar = new Map(d.binVar || []);
    prices.binAt = d.at;
    return prices.bin.size > 0;
  } catch { return false; }
}
function saveLowestBin() {
  const json = JSON.stringify({ at: prices.binAt, bin: [...prices.bin], binVar: [...prices.binVar] });
  const tmp = BIN_FILE() + '.tmp';
  return fs.promises.mkdir(config.dataDir, { recursive: true })
    .then(() => fs.promises.writeFile(tmp, json)).then(() => fs.promises.rename(tmp, BIN_FILE()))
    .catch(e => console.warn('[AH] снимок не сохранился:', e.message));
}
const SAVE_EVERY = 3 * 60_000; // при перезапуске теряется не больше 3 минут (точки почасовые)
const counters = { bz: new Map(), bin: new Map() };
let lastSave = 0;

export function loadHistory() {
  try {
    const d = JSON.parse(fs.readFileSync(HIST_FILE(), 'utf8'));
    prices.history = d.history || {};
    prices.binHistory = d.binHistory || {};
    // Разовая чистка после первой версии дозаполнения (для аукциона брался шумный min продаж Coflnet): убираем точки до запуска сайта на ПК
    if (!d.binClean) {
      const since = Date.UTC(2026, 10, 22, 19, 0);
      for (const id of Object.keys(prices.binHistory)) prices.binHistory[id] = prices.binHistory[id].filter(p => p[0] >= since);
      // и Bazaar: там время Coflnet было прочитано как местное (сдвиг на часовой пояс ПК) — дозаполнится заново
      for (const id of Object.keys(prices.history)) prices.history[id] = prices.history[id].filter(p => p[0] >= since);
    }
    if (d.sold?.samples) prices.sold = d.sold;
  } catch {}
}

/** Сохранить историю на диск (атомарно). force — сразу и целиком (при остановке сервера). */
export function saveHistory(force = false) {
  if (!force) { saveHistorySoon(); return; }
  lastSave = Date.now();
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = HIST_FILE() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ v: 2, binClean: true, history: prices.history, binHistory: prices.binHistory, sold: prices.sold }));
  fs.renameSync(tmp, HIST_FILE());
}

// История цен — десятки мегабайт JSON. Один JSON.stringify целиком держит сервер 0,5–1 с, и на это время
// не отвечает ни один запрос (каждые 3 минуты). Поэтому пишем по кускам: несколько сотен товаров,
// затем отдаём ход другим запросам (setImmediate) — нагрузка та же, но без замираний.
const yieldNow = () => new Promise(r => setImmediate(r));
let saving = null;
/** Сохранить по кускам, если прошло SAVE_EVERY (now — не ждать). Возвращает промис записи или null */
export function saveHistorySoon(now = false) {
  if (saving || (!now && Date.now() - lastSave < SAVE_EVERY)) return saving;
  lastSave = Date.now();
  saving = writeHistoryChunked().catch(e => console.warn('[история цен] не сохранилась:', e.message)).finally(() => { saving = null; });
  return saving;
}
async function writeHistoryChunked() {
  const t0 = Date.now();
  await fs.promises.mkdir(config.dataDir, { recursive: true });
  const tmp = HIST_FILE() + '.tmp';
  const out = fs.createWriteStream(tmp);
  const write = s => (out.write(s) ? null : new Promise(r => out.once('drain', r)));
  const map = async (name, obj, last) => {
    await write(`${JSON.stringify(name)}:{`);
    let i = 0, buf = '';
    for (const id of Object.keys(obj)) {
      buf += (i ? ',' : '') + JSON.stringify(id) + ':' + JSON.stringify(obj[id]);
      if (++i % 300 === 0) { await write(buf); buf = ''; await yieldNow(); }
    }
    await write(buf + '}' + (last ? '' : ','));
  };
  try {
    await write('{"v":2,"binClean":true,');
    await map('history', prices.history);
    await map('binHistory', prices.binHistory);
    await write(`"sold":${JSON.stringify(prices.sold)}}`);
  } finally {
    await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
  }
  await fs.promises.rename(tmp, HIST_FILE());
  return Date.now() - t0;
}

export async function refreshBazaar() {
  let d;
  try { d = await getBazaar(); prices.bazaarDemo = false; }
  catch (e) {
    // Демо-режим без сети: примерные цены из data/fixture-bazaar.json
    const fx = path.join(config.dataDir, 'fixture-bazaar.json');
    if (!fs.existsSync(fx)) throw e;
    d = JSON.parse(fs.readFileSync(fx, 'utf8'));
    prices.bazaarDemo = true;
  }
  const now = Date.now();
  const map = parseBazaar(d);
  if (!map.size) throw new Error('Bazaar вернул пустой список товаров');
  for (const [id, rec] of map) pushHourly(prices.history, counters.bz, id, now, [rec.buy, rec.sell]);
  prices.bazaar = map;
  prices.bazaarAt = now;
  saveHistory();
}

// ---------- аукцион ----------
async function decodeRaw(b64) {
  const buf = gunzipSync(Buffer.from(b64, 'base64'));
  const { parsed } = await nbt.parse(buf);
  const raw = (nbt.simplify(parsed).i || [])[0];
  return { item: normalizeItem(raw), ea: raw?.tag?.ExtraAttributes || {} };
}

// Лоты живут долго, поэтому ключ предмета кэшируем по uuid лота и не разбираем NBT повторно
const keyCache = new Map(); // uuid -> { key, count, petMax } | null
/** Сколько лотов аукциона в кэше разобранных ключей (для панели состояния) */
export const auctionCacheSize = () => keyCache.size;

async function keyOfAuction(a) {
  if (keyCache.has(a.uuid)) return keyCache.get(a.uuid);
  let v = null;
  try {
    const { item, ea } = await decodeRaw(a.item_bytes);
    const k = auctionKey(item, ea);
    if (k) v = { key: k.key, count: item.count || 1, petMax: !!k.petMax, variant: variantKey(item) };
  } catch {}
  keyCache.set(a.uuid, v);
  return v;
}

let scanning = false;
export async function refreshAuctions() {
  if (scanning) return; // прошлый скан ещё идёт — этот пропускаем
  scanning = true;
  const t0 = Date.now();
  try {
    const first = await getAuctionPage(0);
    const pages = first.totalPages || 1;
    const builder = createBinBuilder();
    const varBuilder = createBinBuilder();
    const seen = new Set();
    let n = 0;
    const handle = async auctions => {
      for (const a of auctions || []) {
        // Разбор NBT новых лотов синхронный: после перезапуска это десятки тысяч лотов подряд.
        // Каждые 200 лотов отдаём ход запросам сайта, иначе он замирает на время скана
        if (++n % 200 === 0) await yieldNow();
        if (!a.bin || a.claimed) continue;
        seen.add(a.uuid);
        const k = await keyOfAuction(a);
        if (!k) continue;
        builder.add(k.key, a.starting_bid / k.count, a.uuid, k.petMax);
        if (k.variant) varBuilder.add(k.variant, a.starting_bid / k.count, a.uuid);
      }
    };
    await handle(first.auctions);
    // Страницы по одной (следующая качается, пока разбирается текущая): раньше 6 страниц по ~1 МБ JSON
    // приходили разом и разбирались подряд, а между страницами сайт получает ход
    let next = pages > 1 ? getAuctionPage(1).catch(() => ({ auctions: [] })) : null;
    for (let p = 1; p < pages; p++) {
      const page = await next;
      next = p + 1 < pages ? getAuctionPage(p + 1).catch(() => ({ auctions: [] })) : null;
      await handle(page.auctions);
      await yieldNow();
    }
    for (const uuid of keyCache.keys()) if (!seen.has(uuid)) keyCache.delete(uuid);
    const lowest = builder.result();
    if (!lowest.size) throw new Error('Аукцион вернул пустой список');
    prices.bin = lowest;
    prices.binVar = varBuilder.result();
    prices.binAt = Date.now();
    for (const [id, v] of lowest) pushHourly(prices.binHistory, counters.bin, id, prices.binAt, [v.price]);
    try { auctionHooks.scan?.(lowest, prices.binVar, prices.binAt); } catch (e) { console.warn('[AH] свечи:', e.message); }
    saveHistory();
    saveLowestBin();
    prices.binError = null;
    console.log(`[AH] просканировано страниц: ${pages}, уникальных BIN-предметов: ${lowest.size}, лотов ${n}, ${((Date.now() - t0) / 1000).toFixed(1)} с`);
  } catch (e) {
    prices.binError = e.message || String(e);
    throw e;
  } finally {
    scanning = false;
  }
}

// Реальные продажи за последнюю минуту. Вызывать раз в 60 секунд.
const seenEnded = new Map(); // auction_id -> ts
export async function refreshEndedAuctions() {
  const d = await getJson('https://api.hypixel.net/v2/skyblock/auctions_ended');
  const now = Date.now();
  let added = 0;
  for (const a of d.auctions || []) {
    if (seenEnded.has(a.auction_id)) continue;
    seenEnded.set(a.auction_id, now);
    if (!a.bin) continue; // ставочные аукционы искажают цену
    try {
      const { item, ea } = await decodeRaw(a.item_bytes);
      const k = auctionKey(item, ea);
      if (!k) continue;
      const per = a.price / (item.count || 1), ts = a.timestamp || now;
      recordSale(prices.sold, k.key, per, ts);
      const vk = variantKey(item);
      if (vk) recordSale(prices.sold, vk, per, ts);
      try { const q = item.count || 1; auctionHooks.sale?.(k.key, per, ts, q); if (vk) auctionHooks.sale?.(vk, per, ts, q); } catch { /* графики не важнее цен */ }
      added++;
    } catch {}
  }
  for (const [id, t] of seenEnded) if (t < now - 10 * 60_000) seenEnded.delete(id);
  pruneSold(prices.sold, now);
  prices.soldAt = now;
  return added;
}

// ---------- оценки ----------
// Оценка стоимости предмета: Bazaar (мгновенная продажа), иначе lowest BIN, иначе медиана продаж
export function priceOf(id) {
  if (!id) return 0;
  const bz = prices.bazaar.get(id);
  if (bz) return bz.sell || bz.buy || 0;
  const b = prices.bin.get(id);
  if (b) return b.price;
  return soldStats(prices.sold, id)?.median || 0;
}

/**
 * Цена покупки сейчас: Bazaar — Instant Buy (дороже цены продажи), аукцион — самый дешёвый BIN, иначе медиана продаж.
 * Для стоимости шагов улучшения и «что купить»: priceOf (цена продажи) занижала её на спред Bazaar.
 */
export function buyPriceOf(id) {
  if (!id) return 0;
  const bz = prices.bazaar.get(id);
  if (bz) return bz.buy || bz.sell || 0;
  const b = prices.bin.get(id);
  if (b) return b.price;
  return soldStats(prices.sold, id)?.median || 0;
}

/** Две живые цены «купить / продать» (server/market/quote.js) или null — на рынке не торгуется. */
export function quoteOf(id) {
  if (!id) return null;
  const bz = prices.bazaar.get(id) || null;
  return makeQuote({ bazaar: bz, bin: prices.bin.get(id) || null, sold: soldStats(prices.sold, id), trend: priceTrend(id) });
}
export { buyOf };

/**
 * Цена питомца с учётом уровня: lowest BIN среди питомцев 100 уровня (для максимальных),
 * иначе самый дешёвый лот (обычно 1 уровень).
 */
export function petPriceOf(id, maxed) {
  const b = prices.bin.get(id);
  if (maxed && b?.max) return b.max;
  return priceOf(id);
}

/**
 * Изменение цены за 24 часа и 7 дней.
 * @returns {{ id, market: 'Bazaar'|'Auction House'|null, now, d1: {from, pct}|null, d7: {from, pct}|null, min7, max7, median7, volatility, label }}
 */
export function priceTrend(id) {
  const bz = prices.bazaar.get(id);
  if (bz) {
    const t = trend(prices.history[id], bz.sell, 2);
    const tb = trend(prices.history[id], bz.buy, 1);
    return { id, market: 'Bazaar', ...t, buy: tb, label: trendLabel(t) };
  }
  const b = prices.bin.get(id);
  if (b) {
    const t = trend(prices.binHistory[id], b.price, 1);
    return { id, market: 'Auction House', ...t, label: trendLabel(t) };
  }
  return { id, market: null, now: 0, d1: null, d7: null, min7: null, max7: null, median7: null, volatility: null, label: 'нет данных' };
}

export function priceInfo(id) {
  return {
    quote: quoteOf(id),
    at: prices.bazaar.has(id) ? prices.bazaarAt : prices.binAt || null,
    bazaar: prices.bazaar.get(id) || null,
    bin: prices.bin.get(id) || null,
    sold: soldStats(prices.sold, id),
    trend: priceTrend(id),
    history: prices.history[id] || null,
    binHistory: prices.binHistory[id] || null,
  };
}
