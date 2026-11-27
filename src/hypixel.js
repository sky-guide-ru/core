// Клиент официального Hypixel API v2 (https://api.hypixel.net)
import { config } from './config.js';
import fs from 'node:fs';
import path from 'node:path';
import { getJson } from './http.js';
import { createKeyUsage } from './lib/key-usage.js';
import { tx } from '../i18n/msg.js';

const BASE = 'https://api.hypixel.net/v2';

// Запросы с ключом идут через одни «ворота» (createKeyed):
// - журнал за 5 минут: лимит Hypixel — 300 запросов на ключ за 5 минут, по нему профили друзей решают,
//   можно ли сейчас спросить свежие данные;
// - одинаковые запросы, пока первый ещё летит, ждут его ответ, а не уходят второй раз;
// - после ответа 429 (лимит за 5 минут или суточный лимит ключа разработчика) ключ стоит на паузе до сброса:
//   запросы не уходят и сразу получают ошибку RATE, а сайт показывает последние полученные данные;
// - счётчик расхода по дням (server/lib/key-usage.js) для страницы «Сервер».
const KIND = p => (/\/skyblock\/(profiles|garden|museum)/.exec(p) || [])[1] || (p.startsWith('/player') ? 'player' : p.startsWith('/guild') ? 'guild' : p.startsWith('/status') ? 'status' : 'other');

export function createKeyed({ fetcher = getJson, usage = null, clock = () => Date.now(), apiKey = () => config.apiKey, pauseFile = null } = {}) {
  const log = [];
  const inflight = new Map();
  const own = new Set(); // uuid и id профиля владельца: расход делим на «свой профиль» и «чужие»
  // { until, daily, cause }. Хранится в файле: после перезапуска (выкладки) сайт не стучится в Hypixel до сброса
  let pause = null;
  if (pauseFile) { try { const p = JSON.parse(fs.readFileSync(pauseFile, 'utf8')); if (p?.until > clock()) pause = p; } catch { /* паузы нет */ } }

  function recent(windowMs = 5 * 60_000, now = clock()) {
    while (log.length && now - log[0] > windowMs) log.shift();
    return log.length;
  }
  const paused = () => (pause && pause.until > clock() ? { ...pause } : null);
  function rateError(p) {
    const left = Math.max(1, Math.round((p.until - clock()) / 60_000));
    const when = left >= 90 ? tx`примерно через ${Math.round(left / 60)} ч` : tx`через ${left} мин`;
    const e = new Error(p.daily
      ? tx`Сайт израсходовал суточный лимит запросов к Hypixel. Профили обновятся ${when}, пока показаны последние полученные данные`
      : tx`Hypixel ограничил частоту запросов. Профили обновятся ${when}`);
    e.code = 'RATE';
    e.limitedUntil = p.until;
    return e;
  }

  function call(apiPath) {
    const key = apiKey();
    if (!key) {
      const e = new Error('Не задан HYPIXEL_API_KEY в файле .env');
      e.code = 'NO_KEY';
      throw e;
    }
    const p = paused();
    if (p) { usage?.skipped('limited'); return Promise.reject(rateError(p)); }
    const same = inflight.get(apiPath);
    if (same) { usage?.skipped('deduped'); return same; }
    log.push(clock());
    const id = (/[?&](?:uuid|profile|player)=([\w-]+)/i.exec(apiPath) || [])[1]?.replace(/-/g, '').toLowerCase();
    usage?.count(KIND(apiPath), id && own.has(id) ? 'own' : 'others');
    const promise = Promise.resolve()
      .then(() => fetcher(`${BASE}${apiPath}`, { headers: { 'API-Key': key } }))
      .catch(e => {
        if (e.status === 429) {
          const daily = /daily/i.test(e.cause429 || e.message || '');
          // Срок из ответа Hypixel; без него — 5 минут (окно лимита), суточный — не дольше суток
          const sec = Math.min(24 * 3600, Math.max(60, Number(e.retryAfterSec) || (daily ? 3600 : 300)));
          pause = { until: clock() + sec * 1000, daily, cause: e.cause429 || null, at: clock() };
          if (pauseFile) { try { fs.mkdirSync(path.dirname(pauseFile), { recursive: true }); fs.writeFileSync(pauseFile, JSON.stringify(pause)); } catch { /* не критично */ } }
          console.warn(`[hypixel] 429${daily ? ' (суточный лимит ключа)' : ''}: пауза запросов с ключом на ${Math.round(sec / 60)} мин`);
          throw rateError(pause);
        }
        throw e;
      })
      .finally(() => inflight.delete(apiPath));
    inflight.set(apiPath, promise);
    return promise;
  }

  return {
    call, recent, paused,
    setOwner(...ids) { own.clear(); for (const x of ids) if (x) own.add(String(x).replace(/-/g, '').toLowerCase()); },
    inflight: () => inflight.size,
  };
}

export const keyUsage = createKeyUsage({ file: path.join(config.dataDir, 'hypixel-usage.json') });
const gate = createKeyed({ usage: keyUsage, pauseFile: process.env.NODE_TEST_CONTEXT ? null : path.join(config.dataDir, 'hypixel-pause.json') });
export const keyedCallsRecent = (windowMs, now) => gate.recent(windowMs, now);
/** Пауза после 429: { until, daily, cause } или null */
export const keyedPause = () => gate.paused();
export const setKeyOwner = (...ids) => gate.setOwner(...ids);
const keyed = path => gate.call(path);

export async function resolveUuid(name) {
  try {
    const d = await getJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`);
    return { uuid: d.id, name: d.name };
  } catch {
    // запасной вариант
    const d = await getJson(`https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(name)}`);
    return { uuid: d.id, name: d.name };
  }
}

/** Ник по uuid (кооп-соседи в ответе Hypixel записаны только uuid) */
export async function resolveName(uuid) {
  const id = String(uuid).replace(/-/g, '');
  const d = await getJson(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, { timeout: 8000, retries: 1 });
  return { uuid: d.id || id, name: d.name };
}

export const getProfiles = uuid => keyed(`/skyblock/profiles?uuid=${uuid}`);
export const getGarden = profileId => keyed(`/skyblock/garden?profile=${profileId}`);
export const getMuseum = profileId => keyed(`/skyblock/museum?profile=${profileId}`);
export const getPlayer = uuid => keyed(`/player?uuid=${uuid}`);
// Гильдия игрока (src/guild.js хранит ответ час)
export const getGuild = uuid => keyed(`/guild?player=${uuid}`);
export const getStatus = uuid => keyed(`/status?uuid=${uuid}`);
export const getBingo = uuid => keyed(`/skyblock/bingo?uuid=${uuid}`);
export const getSkyblockNews = () => keyed('/skyblock/news');
// Лоты игрока на Auction House (висящие и закончившиеся, но не забранные) — блок «Мои лоты»
export const getPlayerAuctions = uuid => keyed(`/skyblock/auction?player=${uuid}`);
// Публичные эндпоинты, ключ не нужен
export const getBazaar = () => getJson(`${BASE}/skyblock/bazaar`);
export const getAuctionPage = page => getJson(`${BASE}/skyblock/auctions?page=${page}`);
export const getItemsResource = () => getJson(`${BASE}/resources/skyblock/items`);
export const getCollectionsResource = () => getJson(`${BASE}/resources/skyblock/collections`);
export const getElection = () => getJson(`${BASE}/resources/skyblock/election`);
export const getFireSales = () => getJson(`${BASE}/skyblock/firesales`);
export const getBingoResource = () => getJson(`${BASE}/resources/skyblock/bingo`);
