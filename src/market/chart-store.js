// Хранилище свечей Bazaar на диске для графиков раздела «Рынок».
// Hypixel отдаёт только текущие цены, поэтому сервер сам копит историю: каждое обновление Bazaar (раз в ~20 с)
// попадает в открытые свечи 1 мин / 5 мин / 1 ч / 1 д, закрытые свечи дописываются в конец файлов.
//
// Память: держим только открытые свечи (по 4 на товар, ~1500 товаров — меньше 2 МБ). Всё остальное — на диске:
//   <dataDir>/market/<ряд>/<ID>.bin, запись 44 байта: uint32 время (с) + 10 × float32.
// Диск при полном наполнении: 1 мин за 3 суток ≈ 190 КБ, 5 мин за 30 суток ≈ 380 КБ, 1 ч за год ≈ 385 КБ, 1 д ≈ 16 КБ/год
// на товар — около 1,5 ГБ на весь Bazaar. Лишнее срезается раз в час (compact).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { BASES, N, TIMEFRAMES, aggregate, bridgeFlat, cleanSpikes, addTick, openCandle, volumeDelta, bucketOf, mergeInto } from './candles.js';
import { tx } from '../../i18n/msg.js';

const REC = 4 + (N - 1) * 4;

/** Имя файла из ID товара: «INK_SACK:3» нельзя назвать файл на Windows, поэтому всё лишнее — как ~XX */
export const fileId = id => String(id).replace(/[^A-Za-z0-9_-]/g, ch => tx`~${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);

export function encode(list) {
  const buf = Buffer.alloc(list.length * REC);
  list.forEach((c, k) => {
    const o = k * REC;
    buf.writeUInt32LE(c[0] >>> 0, o);
    for (let i = 1; i < N; i++) buf.writeFloatLE(Number.isFinite(c[i]) ? c[i] : 0, o + i * 4);
  });
  return buf;
}

export function decode(buf) {
  const out = [];
  const n = Math.floor(buf.length / REC); // недописанный хвост (сервер выключили посреди записи) отбрасываем
  for (let k = 0; k < n; k++) {
    const o = k * REC;
    const c = [buf.readUInt32LE(o)];
    for (let i = 1; i < N; i++) c.push(buf.readFloatLE(o + i * 4));
    out.push(c);
  }
  return out;
}

/**
 * @param {{ dir: string, now?: () => number, log?: Function,
 *   bases?: Record<string, { sec: number, keep: number }>, // какие ряды хранить и сколько (по умолчанию BASES — Bazaar)
 *   merge?: (a: number[], b: number[]) => number[],       // слияние свечей (у аукциона своё: пустые продажи — нули)
 *   clean?: (list: number[][]) => number[][],             // обработка перед выдачей (иголки, плоские свечи)
 * }} opt
 */
export function createChartStore({ dir, now = () => Date.now(), log = () => {}, bases = BASES, merge = mergeInto, clean = list => bridgeFlat(cleanSpikes(list)) } = {}) {
  const BASE_LIST = Object.keys(bases);
  const open = Object.fromEntries(BASE_LIST.map(b => [b, new Map()]));   // ряд -> id -> открытая свеча
  const pending = Object.fromEntries(BASE_LIST.map(b => [b, new Map()])); // ряд -> id -> закрытые, ещё не записанные
  const last = new Map(); // id -> { t, buy, sell, bw, sw } — прошлое наблюдение (для объёма и пропусков цены)
  const chains = new Map(); // файл -> промис: запись, срез и дозаполнение одного файла идут строго по очереди
  const stats = { ticks: 0, written: 0, errors: 0, lastTick: 0, lastFlush: 0 };
  const file = (base, id) => path.join(dir, base, `${fileId(id)}.bin`);

  const chain = (f, fn) => {
    const p = (chains.get(f) || Promise.resolve()).then(fn).catch(e => { stats.errors++; log(`[рынок] ${path.basename(f)}: ${e.message}`); });
    chains.set(f, p);
    p.finally(() => { if (chains.get(f) === p) chains.delete(f); });
    return p;
  };

  /**
   * Одно обновление Bazaar: Map id -> { buy, sell, buyWeek, sellWeek }.
   * @param {Map<string, any>} bazaar
   * @param {number} [tsMs]
   */
  function tick(bazaar, tsMs = now()) {
    const t = Math.floor(tsMs / 1000);
    for (const [id, p] of bazaar) {
      const prev = last.get(id);
      // Нет ордеров с одной стороны — берём прошлую цену этой стороны, а если её не было — цену другой стороны
      let buy = p.buy > 0 ? p.buy : prev?.buy || p.sell;
      let sell = p.sell > 0 ? p.sell : prev?.sell || p.buy;
      if (!(buy > 0) || !(sell > 0)) continue;
      const dt = prev ? t - prev.t : 0;
      const bv = prev && dt > 0 ? volumeDelta(prev.bw, p.buyWeek, dt) : 0;
      const sv = prev && dt > 0 ? volumeDelta(prev.sw, p.sellWeek, dt) : 0;
      last.set(id, { t, buy, sell, bw: p.buyWeek, sw: p.sellWeek });
      for (const base of BASE_LIST) {
        const b = bucketOf(t, base);
        const cur = open[base].get(id);
        if (cur && cur[0] === b) { addTick(cur, buy, sell, bv, sv); continue; }
        if (cur) { const q = pending[base].get(id); if (q) q.push(cur); else pending[base].set(id, [cur]); }
        open[base].set(id, openCandle(b, buy, sell, bv, sv));
      }
    }
    stats.ticks++;
    stats.lastTick = tsMs;
  }

  /**
   * Одно наблюдение для одного ряда-id (аукцион): make(начало) — новая свеча, add(свеча) — дополнить открытую на месте.
   * @param {string} id @param {number} tsMs @param {(t:number)=>number[]} make @param {(c:number[])=>void} add
   */
  function observe(id, tsMs, make, add) {
    const t = Math.floor(tsMs / 1000);
    for (const base of BASE_LIST) {
      const b = bucketOf(t, base);
      const cur = open[base].get(id);
      if (cur && cur[0] === b) { add(cur); continue; }
      if (cur) { const q = pending[base].get(id); if (q) q.push(cur); else pending[base].set(id, [cur]); }
      open[base].set(id, make(b));
    }
    last.set(id, { t });
  }

  // Не больше 16 записей одновременно: тысячи разом упираются в лимит открытых файлов
  let active = 0;
  const waiters = [];
  const limited = async fn => {
    if (active >= 16) await new Promise(res => waiters.push(res));
    active++;
    try { return await fn(); } finally { active--; waiters.shift()?.(); }
  };

  /**
   * Дописать закрытые свечи на диск. Очередь записи каждого файла ставится сразу, в том же такте,
   * где свечи уходят из pending: readBase ждёт эту очередь и не увидит «дыры», пока запись идёт.
   */
  async function flush() {
    const todo = BASE_LIST.filter(b => pending[b].size);
    for (const base of todo) await fsp.mkdir(path.join(dir, base), { recursive: true });
    const jobs = [];
    for (const base of todo) {
      for (const [id, list] of pending[base]) {
        const f = file(base, id);
        jobs.push(chain(f, () => limited(async () => { await fsp.appendFile(f, encode(list)); stats.written += list.length; })));
      }
      pending[base].clear();
    }
    await Promise.all(jobs);
    stats.lastFlush = now();
  }

  /** Срезать то, что старше срока хранения ряда (раз в час). */
  async function compact() {
    let cut = 0;
    for (const base of BASE_LIST) {
      const { keep, sec } = bases[base];
      if (!Number.isFinite(keep)) continue;
      const limit = Math.ceil((keep / sec) * 1.15) * REC;
      let names = [];
      try { names = await fsp.readdir(path.join(dir, base)); } catch { continue; }
      for (const name of names) {
        const f = path.join(dir, base, name);
        let st;
        try { st = await fsp.stat(f); } catch { continue; }
        if (st.size <= limit) continue;
        await chain(f, async () => {
          const list = decode(await fsp.readFile(f));
          const from = Math.floor(now() / 1000) - keep;
          const keepList = list.filter(c => c[0] >= from);
          await fsp.writeFile(f + '.tmp', encode(keepList));
          await fsp.rename(f + '.tmp', f);
          cut += list.length - keepList.length;
        });
      }
    }
    return cut;
  }

  /** Свечи одного базового ряда: с диска + ещё не записанные + открытая. */
  async function readBase(id, base) {
    if (!open[base]) return []; // ряд этим хранилищем не ведётся (у аукциона нет минутного)
    const f = file(base, id);
    await chains.get(f); // дождаться записи, которая уже идёт
    let list = [];
    try { list = decode(await fsp.readFile(f)); } catch { /* файла ещё нет */ }
    list.push(...(pending[base].get(id) || []).map(c => c.slice()));
    const cur = open[base].get(id);
    if (cur) list.push(cur.slice());
    // Порядок и склейка дублей (после перезапуска та же минута может быть записана дважды)
    list.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const c of list) {
      const prev = out[out.length - 1];
      if (prev && prev[0] === c[0]) merge(prev, c); else out.push(c);
    }
    return out;
  }

  /**
   * Свечи периода tf. Для 5 и 15 минут недавнее берём из минутного ряда (он точнее), более старое — из 5-минутного.
   * @returns {Promise<{ candles: number[][], hasMore: boolean }>}
   */
  async function candles(id, tf, { to = Infinity, limit = 1000 } = {}) {
    const f = TIMEFRAMES[tf];
    if (!f) throw new Error(tx`неизвестный период ${tf}`);
    let list = await readBase(id, f.base);
    if (f.fine) {
      const fine = await readBase(id, f.fine);
      if (fine.length) {
        const from = bucketOf(fine[0][0], f.base) + bases[f.base].sec; // первая полная свеча из минут
        list = [...list.filter(c => c[0] < from), ...aggregate(fine.filter(c => c[0] >= from), f.base, merge)];
      }
    }
    // Порядок: склеить в свечи периода → убрать иголки-выбросы → открыть плоские свечи по закрытию прошлой
    let out = clean(aggregate(list, tf, merge));
    if (Number.isFinite(to)) out = out.filter(c => c[0] <= to);
    const hasMore = out.length > limit;
    return { candles: out.slice(-limit), hasMore };
  }

  /**
   * Дозаполнить ряд свечами из прошлого (старая почасовая история, Coflnet): только то, что раньше первой своей свечи.
   * @returns {Promise<number>} сколько свечей добавлено
   */
  async function insertOlder(id, base, older) {
    if (!older?.length) return 0;
    const f = file(base, id);
    let added = 0;
    if (!open[base]) return 0;
    await fsp.mkdir(path.join(dir, base), { recursive: true });
    await chain(f, async () => {
      let list = [];
      try { list = decode(await fsp.readFile(f)); } catch { /* нет файла */ }
      const first = Math.min(list.length ? list[0][0] : Infinity, (pending[base].get(id) || [])[0]?.[0] ?? Infinity, open[base].get(id)?.[0] ?? Infinity);
      const keep = bases[base].keep;
      const from = Number.isFinite(keep) ? Math.floor(now() / 1000) - keep : -Infinity;
      const add = older.filter(c => c[0] < first && c[0] >= from);
      if (!add.length) return;
      await fsp.writeFile(f + '.tmp', encode([...add, ...list]));
      await fsp.rename(f + '.tmp', f);
      added = add.length;
    });
    return added;
  }

  /** Время первой своей свечи ряда (секунды) или null. */
  async function firstTime(id, base) {
    const f = file(base, id);
    try {
      const fd = await fsp.open(f, 'r');
      try { const b = Buffer.alloc(4); const { bytesRead } = await fd.read(b, 0, 4, 0); return bytesRead === 4 ? b.readUInt32LE(0) : null; }
      finally { await fd.close(); }
    } catch { return open[base].get(id)?.[0] ?? null; }
  }

  /** Сколько места занято на диске (для страницы «Сервер»).
   *  Файлов — десятки тысяч (товар × ряд), и синхронный обход держал весь сервер десятки секунд:
   *  сайт не отвечал, пока открыта панель «Сервер». Теперь обход асинхронный, пачками, с передышкой */
  async function diskUsage() {
    let bytes = 0, files = 0;
    for (const base of BASE_LIST) {
      let names = [];
      try { names = await fsp.readdir(path.join(dir, base)); } catch { continue; }
      for (let i = 0; i < names.length; i += 64) {
        const sizes = await Promise.all(names.slice(i, i + 64).map(n => fsp.stat(path.join(dir, base, n)).then(st => st.size, () => -1)));
        for (const sz of sizes) if (sz >= 0) { bytes += sz; files++; }
        await new Promise(r => setImmediate(r));
      }
    }
    return { bytes, files };
  }

  /** Закрыть все открытые свечи и записать (при выключении сервера). */
  async function close() {
    for (const base of BASE_LIST) {
      for (const [id, c] of open[base]) { const q = pending[base].get(id); if (q) q.push(c); else pending[base].set(id, [c]); }
      open[base].clear();
    }
    await flush();
    await Promise.all([...chains.values()]);
  }

  /** То же синхронно — для выхода по сигналу, когда ждать промисы уже некогда. */
  function closeSync() {
    for (const base of BASE_LIST) {
      for (const [id, c] of open[base]) { const q = pending[base].get(id); if (q) q.push(c); else pending[base].set(id, [c]); }
      open[base].clear();
      if (!pending[base].size) continue;
      try { fs.mkdirSync(path.join(dir, base), { recursive: true }); } catch { /* нет места */ }
      for (const [id, list] of pending[base]) { try { fs.appendFileSync(file(base, id), encode(list)); } catch { /* не страшно */ } }
      pending[base].clear();
    }
  }

  const hasData = () => { try { return fs.readdirSync(path.join(dir, '1h')).length > 0; } catch { return false; } };

  return { tick, observe, flush, compact, candles, readBase, insertOlder, firstTime, diskUsage, close, closeSync, hasData, stats, products: () => last.size, lastOf: id => last.get(id) || null };
}
