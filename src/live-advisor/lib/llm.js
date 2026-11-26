// Вызовы Claude: автосовет (структурированный JSON) и чат с инструментами.
// Кэш промпта: системная часть кэшируется на 1 час, сводка профиля в чате на 5 минут.
import { SYSTEM_PROMPT, AUTO_INSTRUCTIONS, CHAT_INSTRUCTIONS, ADVICE_SCHEMA, LANG_EN } from './prompt.js';
import { TOOLS } from './tools.js';
import { addUsage } from './budget.js';
import { tx } from '../../../i18n/msg.js';

const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5']);

/** Системный промпт маршрута: общая часть + инструкция маршрута (+ язык для /en/), точка кэша в конце */
export function systemFor(routeText, lang = 'ru') {
  const parts = [{ type: 'text', text: SYSTEM_PROMPT }, { type: 'text', text: routeText }];
  if (lang === 'en') parts.push({ type: 'text', text: LANG_EN });
  parts[parts.length - 1] = { ...parts[parts.length - 1], cache_control: { type: 'ephemeral', ttl: '1h' } };
  return parts;
}

/**
 * Sonnet/Opus 5.5 получают серверный фолбэк на случай отказа (у Haiku его нет).
 * С onText ответ идёт потоком: текст показывается на сайте по мере генерации.
 */
async function create(client, params, onText) {
  const fb = FALLBACK_MODELS.has(params.model);
  const api = fb ? client.beta.messages : client.messages;
  const p = fb ? { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : params;
  if (onText && typeof api.stream === 'function') {
    const s = api.stream(p);
    s.on('text', t => { try { onText(t); } catch { /* обрыв соединения с сайтом не должен ронять ответ */ } });
    return s.finalMessage();
  }
  return api.create(p);
}

function textOf(resp) {
  return (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

/** Понятное сообщение об ошибке API (по типам SDK, если он загружен) */
export function explainError(err, Anthropic) {
  const A = Anthropic;
  if (A && err instanceof A.AuthenticationError) return 'Неверный ключ ANTHROPIC_API_KEY. Проверь его в Claude Console.';
  if (A && err instanceof A.PermissionDeniedError) return 'У ключа нет доступа к этой модели.';
  if (A && err instanceof A.RateLimitError) return 'Слишком много запросов, попробую позже.';
  if (A && err instanceof A.BadRequestError) return tx`Ошибка запроса: ${err.message}`;
  if (A && err instanceof A.APIConnectionError) return 'Нет связи с API Anthropic.';
  if (A && err instanceof A.APIError) return tx`Ошибка API ${err.status}: ${err.message}`;
  return String(err?.message || err);
}

/**
 * Автосовет по сводке и списку изменений.
 * @returns {Promise<{ advice: Object|null, usage: Object, model: string, stop: string, error?: string }>}
 */
export async function requestAdvice(client, { model, digest, delta, effort = 'low', lang = 'ru' }) {
  const resp = await create(client, {
    model,
    max_tokens: 2500,
    output_config: { effort, format: { type: 'json_schema', schema: ADVICE_SCHEMA } },
    system: systemFor(AUTO_INSTRUCTIONS, lang),
    messages: [{ role: 'user', content: [{ type: 'text', text: digest }, { type: 'text', text: delta }] }],
  });
  const out = { usage: resp.usage || {}, model: resp.model || model, stop: resp.stop_reason };
  if (resp.stop_reason === 'refusal') return { ...out, advice: null, error: 'Модель отказалась отвечать на этот запрос.' };
  if (resp.stop_reason === 'max_tokens') return { ...out, advice: null, error: 'Ответ обрезан по лимиту длины.' };
  try {
    return { ...out, advice: JSON.parse(textOf(resp)) };
  } catch {
    return { ...out, advice: null, error: 'Не удалось разобрать ответ модели.' };
  }
}

/**
 * Вопрос в чате. history — прошлые пары [{ q, a }] (только текст), digest — сводка профиля.
 * @returns {Promise<{ answer: string, usage: Object, model: string, toolCalls: {name:string, input:Object}[], error?: string }>}
 */
export async function askChat(client, { model, digest, history = [], question, handlers, effort = 'low', maxToolRounds = 2, maxTokens = 1200, onEvent, lang = 'ru' }) {
  const emit = ev => { try { onEvent?.(ev); } catch { /* сайт отключился — не страшно */ } };
  const messages = [];
  // Первое сообщение всегда начинается со сводки (точка кэша), дальше — последние пары вопрос/ответ
  const first = [{ type: 'text', text: digest, cache_control: { type: 'ephemeral' } }];
  const past = history.slice(-4);
  if (past.length) {
    first.push({ type: 'text', text: past[0].q });
    messages.push({ role: 'user', content: first });
    messages.push({ role: 'assistant', content: past[0].a });
    for (const h of past.slice(1)) {
      messages.push({ role: 'user', content: h.q });
      messages.push({ role: 'assistant', content: h.a });
    }
    messages.push({ role: 'user', content: question });
  } else {
    first.push({ type: 'text', text: question });
    messages.push({ role: 'user', content: first });
  }

  let usage = {};
  const toolCalls = [];
  let servedBy = model;
  let emptyRetry = false;
  for (let round = 0; round <= maxToolRounds; round++) {
    const last = round === maxToolRounds;
    let resp;
    try {
      resp = await create(client, {
      model,
      max_tokens: maxTokens, // вместе с рассуждением: короткий ответ и жёсткий потолок расходов
      output_config: { effort },
      system: systemFor(CHAT_INSTRUCTIONS, lang),
      tools: TOOLS,
      tool_choice: { type: last ? 'none' : 'auto' },
      messages,
      }, onEvent ? t => emit({ type: 'text', text: t }) : undefined);
    } catch (e) {
      // уже оплаченные раунды не теряем: вызывающий запишет их в бюджет
      e.usage = usage;
      e.servedBy = servedBy;
      throw e;
    }
    usage = addUsage(usage, resp.usage || {});
    servedBy = resp.model || servedBy;
    if (resp.stop_reason === 'refusal') return { answer: '', usage, model: servedBy, toolCalls, error: 'Модель отказалась отвечать на этот вопрос.' };
    if (resp.stop_reason !== 'tool_use') {
      let answer = textOf(resp);
      let cut = resp.stop_reason === 'max_tokens';
      // Пустой текст: модель потратила весь лимит на рассуждение (часто после инструментов) или закончила без текста.
      // Один повтор без инструментов и с запасом токенов; если и он пустой — честная ошибка, а не «Пустой ответ.» в чате
      if (!answer) {
        const extra = emptyRetry ? null : await create(client, {
          model, max_tokens: Math.min(4000, maxTokens * 2), output_config: { effort: 'low' },
          system: systemFor(CHAT_INSTRUCTIONS, lang), tools: TOOLS, tool_choice: { type: 'none' },
          messages: resp.content?.length && resp.stop_reason !== 'max_tokens'
            ? [...messages, { role: 'assistant', content: resp.content }, { role: 'user', content: lang === 'en' ? 'Answer in text using the data above, briefly.' : 'Ответь текстом по данным выше, коротко.' }]
            : messages,
        }, onEvent ? t => emit({ type: 'text', text: t }) : undefined).catch(e => { e.usage = usage; e.servedBy = servedBy; throw e; });
        emptyRetry = true;
        if (extra) {
          usage = addUsage(usage, extra.usage || {});
          servedBy = extra.model || servedBy;
          answer = textOf(extra);
          cut = extra.stop_reason === 'max_tokens';
        }
        if (!answer) return { answer: '', empty: true, usage, model: servedBy, toolCalls, error: 'Советчик не успел сформулировать ответ. Попробуй ещё раз или задай вопрос короче.' };
      }
      return { answer: answer + (cut ? '…' : ''), usage, model: servedBy, toolCalls, ...(cut ? { error: 'Ответ обрезан по лимиту длины.' } : {}) };
    }
    // Выполняем все вызовы инструментов и возвращаем результаты одним сообщением
    messages.push({ role: 'assistant', content: resp.content });
    const results = [];
    for (const b of resp.content) {
      if (b.type !== 'tool_use') continue;
      toolCalls.push({ name: b.name, input: b.input });
      emit({ type: 'tool', name: b.name });
      let content, isError = false;
      try {
        const fn = handlers[b.name];
        if (!fn) throw new Error(tx`Нет инструмента ${b.name}`);
        content = JSON.stringify(await fn(b.input || {}));
      } catch (e) {
        content = String(e?.message || e);
        isError = true;
      }
      results.push({ type: 'tool_result', tool_use_id: b.id, content, ...(isError ? { is_error: true } : {}) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { answer: 'Не успел собрать ответ, попробуй переформулировать вопрос.', usage, model: servedBy, toolCalls };
}
