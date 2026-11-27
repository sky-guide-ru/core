// Учёт внешних API для панели состояния владельца (#/status): по каждому источнику — когда последний раз ответил,
// за сколько, сколько было ошибок и какая последняя. Для Hypixel — лимит и остаток из заголовков RateLimit-*.
// Перехватываем глобальный fetch один раз при загрузке модуля (его импортирует server/index.js первым),
// поэтому сюда попадают все запросы: свой http.js, NEU, Coflnet, вики, скины и SDK ИИ-советчика.
// Сам ключ и адреса с параметрами нигде не сохраняются — только имя источника, код ответа и время.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tx } from '../../i18n/msg.js';

/** Источник по адресу запроса: { id, name } или null (локальные адреса не считаем). */
export function sourceOf(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  const h = u.hostname, p = u.pathname;
  if (h === 'localhost' || h === '127.0.0.1') return null;
  if (h === 'api.hypixel.net') {
    if (/\/skyblock\/(profiles|garden|museum)|\/player\b/.test(p)) return { id: 'hypixel-key', name: 'Hypixel: профили (с ключом)' };
    if (/\/skyblock\/bazaar/.test(p)) return { id: 'hypixel-bazaar', name: 'Hypixel: Bazaar' };
    if (/\/skyblock\/auctions/.test(p)) return { id: 'hypixel-ah', name: 'Hypixel: аукцион' };
    return { id: 'hypixel-res', name: 'Hypixel: справочники и мэр' };
  }
  if (/(^|\.)github(usercontent)?\.com$/.test(h)) return { id: 'neu', name: 'База предметов NEU (GitHub)' };
  if (h === 'sky.coflnet.com') return { id: 'coflnet', name: 'Coflnet: история цен и иконки' };
  if (/(^|\.)fandom\.com$/.test(h)) return { id: 'wiki', name: 'Вики (fandom)' };
  if (/(^|\.)anthropic\.com$/.test(h)) return { id: 'claude', name: 'ИИ-советчик (Claude)' };
  if (/mojang\.com$|minecraftservices\.com$/.test(h)) return { id: 'mojang', name: 'Mojang: ники игроков' };
  if (h === 'textures.minecraft.net') return { id: 'skins', name: 'Скины Minecraft' };
  return { id: h, name: h };
}

// Ошибка без секретов: ключи в адресах и заголовках не должны попасть на страницу
export const clean = s => String(s || '').replace(/(key|api[-_]?key|token)=[^&\s"]+/gi, '$1=***').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '***').replace(/sk-ant-[\w-]+/g, '***').slice(0, 160);

const FILE_HOSTS = new Set(['neu', 'cdn.jsdelivr.net']);
const ORDER = ['hypixel-key', 'hypixel-bazaar', 'hypixel-ah', 'hypixel-res', 'neu', 'coflnet', 'wiki', 'claude', 'mojang', 'skins'];

export function createApiStats({ clock = () => Date.now() } = {}) {
  const sources = new Map();
  const hypixel = { limit: null, remaining: null, resetSec: null, at: 0, keyError: null, keyErrorAt: 0, keyOkAt: 0 };
  const get = src => {
    let s = sources.get(src.id);
    if (!s) { s = { id: src.id, name: src.name, ok: 0, errors: 0, lastOkAt: 0, lastErrAt: 0, lastError: null, lastMs: null, avgMs: null }; sources.set(src.id, s); }
    return s;
  };
  function record(url, { status = 0, ms = 0, error = null, headers = null } = {}) {
    const src = sourceOf(url);
    if (!src) return;
    const s = get(src);
    const now = clock();
    s.lastMs = Math.round(ms);
    s.avgMs = s.avgMs == null ? s.lastMs : Math.round(s.avgMs * 0.8 + ms * 0.2);
    // 404 у файловых хостов (GitHub, jsDelivr) — сервер ответил, просто такого файла нет: иконки ищутся перебором путей
    const ok = (!error && status > 0 && status < 400) || (status === 404 && FILE_HOSTS.has(src.id));
    if (ok) { s.ok++; s.lastOkAt = now; } else { s.errors++; s.lastErrAt = now; s.lastError = clean(error || `HTTP ${status}`); }
    if (src.id === 'hypixel-key') {
      const n = k => { const v = headers?.get?.(k); return v == null || v === '' ? null : Number(v); };
      if (n('ratelimit-limit') != null) Object.assign(hypixel, { limit: n('ratelimit-limit'), remaining: n('ratelimit-remaining'), resetSec: n('ratelimit-reset'), at: now });
      if (ok) hypixel.keyOkAt = now;
      else if (status === 403 || status === 401) { hypixel.keyError = s.lastError; hypixel.keyErrorAt = now; }
    }
  }
  function snapshot() {
    const list = [...sources.values()].sort((a, b) => {
      const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
    }).map(s => ({ ...s, state: s.lastErrAt > s.lastOkAt ? 'error' : s.lastOkAt ? 'ok' : 'none' }));
    return { sources: list, hypixel: { ...hypixel } };
  }
  return { record, snapshot };
}

export const apiStats = createApiStats();

/** Обернуть fetch: каждый внешний запрос попадает в apiStats. Повторный вызов ничего не делает. */
export function installFetchTracking(stats = apiStats, target = globalThis) {
  if (!target.fetch || target.fetch.__sbTracked) return;
  const real = target.fetch;
  const wrapped = async function (input, init) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    const t0 = performance.now();
    try {
      const res = await real.call(this, input, init);
      let error = null;
      if (!res.ok) {
        // Причина от Hypixel вида {"cause":"Invalid API key"} — короткая и без секретов
        try { const txt = (await res.clone().text()).slice(0, 300); const j = JSON.parse(txt); error = `HTTP ${res.status}${j.cause ? `: ${j.cause}` : j.error?.message ? `: ${j.error.message}` : ''}`; } catch { error = `HTTP ${res.status}`; }
      }
      stats.record(url, { status: res.status, ms: performance.now() - t0, error, headers: res.headers });
      return res;
    } catch (e) {
      const why = e?.name === 'AbortError' || e?.name === 'TimeoutError' ? 'нет ответа (таймаут)' : e?.cause?.code ? tx`нет связи (${e.cause.code})` : (e?.message || 'нет связи');
      stats.record(url, { status: 0, ms: performance.now() - t0, error: why });
      throw e;
    }
  };
  wrapped.__sbTracked = true;
  target.fetch = wrapped;
}

/**
 * Когда этот ключ Hypixel впервые заработал на сайте (по отпечатку ключа, не по самому ключу).
 * Ключи разработчика Hypixel временные — дата помогает понять, не пора ли выпустить новый.
 */
export function keySince(dataDir, apiKey, now = Date.now()) {
  if (!apiKey) return null;
  const fp = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  const file = path.join(dataDir, 'api-key-seen.json');
  let d = {};
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* первый раз */ }
  if (d.fp === fp && d.since) return d.since;
  try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify({ fp, since: now })); } catch { /* не критично */ }
  return now;
}

installFetchTracking();
