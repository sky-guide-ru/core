import { config } from './config.js';
import { tx } from '../i18n/msg.js';

// maxWaitMs: сколько можно ждать по Retry-After после ответа 429. Дольше — не ждём, а сразу отдаём ошибку
// со сроком (err.retryAfterSec): суточный лимит ключа Hypixel отвечает «подожди ~10 часов», и раньше запрос
// просто засыпал на эти часы, держа открытыми запросы посетителей
export async function getJson(url, { headers = {}, timeout = 30_000, retries = 2, maxWaitMs = 15_000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': config.userAgent, ...headers }, signal: ctrl.signal });
      if (res.status === 429) {
        const sec = h => { const v = Number(res.headers.get(h)); return Number.isFinite(v) && v > 0 ? v : 0; };
        const wait = Math.max(sec('retry-after'), sec('ratelimit-reset')) || 10;
        if (wait * 1000 > maxWaitMs || attempt === retries) {
          const body = await res.text().catch(() => '');
          let cause = '';
          try { cause = JSON.parse(body).cause || ''; } catch { cause = body.slice(0, 120); }
          const err = new Error(tx`HTTP 429 для ${url.replace(/key=[^&]+/, 'key=***')}${cause ? `: ${cause}` : ''}`);
          Object.assign(err, { status: 429, retryAfterSec: wait, cause429: cause });
          throw err;
        }
        clearTimeout(t);
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new Error(tx`HTTP ${res.status} для ${url.replace(/key=[^&]+/, 'key=***')}: ${body.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (e.status && e.status < 500) break;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}
