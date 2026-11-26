// Учёт токенов и денег: цена каждого вызова, дневной лимит, история по дням.
import { dayKey } from './util.js';

/** $ за 1 млн токенов (прайс Anthropic, ноябрь 2026). cacheRead — доля от input. */
export const PRICING = {
  'claude-haiku-5-5': { input: 0.10, output: 0.50, cacheRead: 0.10 },
  'claude-sonnet-5-5': { input: 2.00, output: 10.00, cacheRead: 0.05 },
  'claude-opus-5-5': { input: 4.00, output: 20.00, cacheRead: 0.05 },
};

/**
 * Стоимость одного ответа API по его usage.
 * Запись в кэш: 1,25× (5 мин) или 2× (1 час); чтение из кэша: cacheRead × input.
 * @param {Object} usage  response.usage
 * @param {string} model
 * @returns {number} доллары
 */
export function costOf(usage = {}, model) {
  const p = PRICING[model] || PRICING['claude-haiku-5-5'];
  const M = 1e6;
  const cc = usage.cache_creation || {};
  const w1h = cc.ephemeral_1h_input_tokens ?? 0;
  const w5m = cc.ephemeral_5m_input_tokens ?? Math.max(0, (usage.cache_creation_input_tokens || 0) - w1h);
  return (
    (usage.input_tokens || 0) * p.input +
    w5m * p.input * 1.25 +
    w1h * p.input * 2 +
    (usage.cache_read_input_tokens || 0) * p.input * p.cacheRead +
    (usage.output_tokens || 0) * p.output
  ) / M;
}

/** Сложить usage нескольких запросов (цикл инструментов) */
export function addUsage(a = {}, b = {}) {
  const out = { ...a };
  for (const k of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) out[k] = (a[k] || 0) + (b[k] || 0);
  const ca = a.cache_creation || {}, cb = b.cache_creation || {};
  out.cache_creation = {
    ephemeral_5m_input_tokens: (ca.ephemeral_5m_input_tokens || 0) + (cb.ephemeral_5m_input_tokens || 0),
    ephemeral_1h_input_tokens: (ca.ephemeral_1h_input_tokens || 0) + (cb.ephemeral_1h_input_tokens || 0),
  };
  return out;
}

/**
 * Дневной бюджет. Автосоветы останавливаются на autoShare (80%) лимита, чтобы оставить запас на вопросы в чате.
 */
export class Budget {
  /** @param {{ dailyUsd?: number, autoShare?: number, tz?: string, days?: Object }} o */
  constructor(o = {}) {
    this.dailyUsd = o.dailyUsd ?? 0.20;
    this.autoShare = o.autoShare ?? 0.8;
    this.tz = o.tz;
    this.days = o.days || {}; // { 'YYYY-MM-DD': { usd, calls, auto, chat, input, output, cacheRead, cacheWrite } }
  }
  today(now = Date.now()) {
    const k = dayKey(now, this.tz);
    return (this.days[k] ||= { usd: 0, calls: 0, auto: 0, chat: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  }
  canSpend(kind, now = Date.now()) {
    const d = this.today(now);
    const cap = kind === 'auto' ? this.dailyUsd * this.autoShare : this.dailyUsd;
    return d.usd < cap;
  }
  record(kind, usage, model, now = Date.now()) {
    const usd = costOf(usage, model);
    const d = this.today(now);
    d.usd += usd; d.calls++; d[kind] = (d[kind] || 0) + 1;
    d.input += usage.input_tokens || 0;
    d.output += usage.output_tokens || 0;
    d.cacheRead += usage.cache_read_input_tokens || 0;
    d.cacheWrite += usage.cache_creation_input_tokens || 0;
    // храним 60 дней
    const keys = Object.keys(this.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete this.days[k];
    return usd;
  }
  summary(now = Date.now()) {
    const d = this.today(now);
    const month = Object.entries(this.days).filter(([k]) => k.slice(0, 7) === dayKey(now, this.tz).slice(0, 7)).reduce((a, [, v]) => a + v.usd, 0);
    return { dailyUsd: this.dailyUsd, today: { ...d, usd: +d.usd.toFixed(5) }, leftUsd: +Math.max(0, this.dailyUsd - d.usd).toFixed(5), monthUsd: +month.toFixed(4), autoPaused: !this.canSpend('auto', now) };
  }
  toJSON() { return { dailyUsd: this.dailyUsd, autoShare: this.autoShare, days: this.days }; }
}
