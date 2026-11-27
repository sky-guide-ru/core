// Запросы, которые тратят лимит ключа ради «живых» сведений, и их кэш:
// - /status (онлайн и остров) — только для своего профиля, пока его смотрят; не чаще раза в 2 минуты;
// - /skyblock/bingo — раз в 6 часов на игрока (у чужих — только если у них есть Bingo-профиль);
// - /skyblock/news (патчноуты SkyBlock) — один запрос на весь сайт раз в 3 часа.
// Ошибка запроса ничего не ломает: остаётся прошлый ответ или сведений просто нет.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { getStatus, getBingo, getSkyblockNews } from './hypixel.js';
import { statusOf, bingoOf, skyblockNewsOf } from './lib/live-status.js';

export const STATUS_MS = 2 * 60_000, BINGO_MS = 6 * 3600_000, NEWS_MS = 3 * 3600_000;

/** Кэш по ключу: свежий ответ отдаётся сразу, одинаковые запросы ждут первый, ошибка — тот же срок до повтора */
export function createCached(fetch, ttl, { now = () => Date.now() } = {}) {
  const cache = new Map(); // key → { value, at, promise }
  function get(key = '') {
    let c = cache.get(key);
    if (c?.promise) return c.promise;
    if (c && now() - c.at < ttl) return Promise.resolve(c.value);
    c = c || { value: null, at: 0 };
    cache.set(key, c);
    c.promise = Promise.resolve().then(() => fetch(key)).then(v => { c.value = v ?? c.value; }, () => {}).then(() => {
      c.at = now(); c.promise = null;
      return c.value;
    });
    return c.promise;
  }
  /** Что есть сейчас, без ожидания (и запрос в фоне, если устарело) */
  function peek(key = '') { get(key).catch(() => {}); return cache.get(key)?.value ?? null; }
  return { get, peek, _cache: cache };
}

const status = createCached(uuid => getStatus(uuid).then(r => statusOf(r)), STATUS_MS);
const bingo = createCached(uuid => getBingo(uuid), BINGO_MS);
// Без ключа (демо) — патчноуты из data/fixture-sb-news.json, если он есть
const newsDemo = () => { try { return JSON.parse(fs.readFileSync(path.join(config.dataDir, 'fixture-sb-news.json'), 'utf8')); } catch { return null; } };
const news = createCached(() => (config.apiKey ? getSkyblockNews() : Promise.resolve(newsDemo())).then(r => skyblockNewsOf(r)), NEWS_MS);

export const statusFor = uuid => status.get(uuid);
/** Статус из недавней проверки (не старше maxAge) без нового запроса; null — не проверяли или устарел */
export function knownStatus(uuid, maxAge = 5 * 60_000, now = Date.now()) {
  const v = status._cache.get(uuid)?.value;
  return v && now - (v.at || 0) < maxAge ? v : null;
}
/** Сырой ответ /skyblock/bingo; разбор с текущим ивентом — bingoOf(resp, bingoEvent()) */
export const bingoRawFor = uuid => bingo.get(uuid);
export const skyblockNews = () => news.peek();
export { bingoOf };
