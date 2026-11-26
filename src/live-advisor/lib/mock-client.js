// Поддельный клиент Anthropic для тестов и симуляции без ключа.
// Повторяет форму ответов API и считает токены приблизительно (estimateTokens), включая кэш промпта.
import { estimateTokens } from './util.js';
import { tx } from '../../../i18n/msg.js';

const textOfContent = c => typeof c === 'string' ? c : (c || []).map(b => b.text ?? (typeof b.content === 'string' ? b.content : JSON.stringify(b.input ?? b.content ?? ''))).join('\n');

export function createMockClient({ clock = () => Date.now() } = {}) {
  const cache = new Map(); // ключ префикса → истекает в
  const log = [];

  function usageFor(params, outText) {
    // Блоки по порядку рендера: tools → system → messages; точки кэша там, где cache_control
    const blocks = [];
    if (params.tools) blocks.push({ text: JSON.stringify(params.tools) });
    for (const s of params.system || []) blocks.push({ text: s.text, cc: s.cache_control });
    for (const m of params.messages || []) {
      if (typeof m.content === 'string') blocks.push({ text: m.content });
      else for (const b of m.content) blocks.push({ text: textOfContent([b]), cc: b.cache_control });
    }
    let prefix = '', input = 0, read = 0, w5 = 0, w1 = 0, pendingTok = 0;
    const now = clock();
    for (const b of blocks) {
      prefix += '\u0000' + b.text;
      pendingTok += estimateTokens(b.text);
      if (!b.cc) continue;
      const key = prefix;
      const ttl = b.cc.ttl === '1h' ? 3600_000 : 300_000;
      if ((cache.get(key) || 0) > now) read += pendingTok;
      else if (b.cc.ttl === '1h') w1 += pendingTok; else w5 += pendingTok;
      cache.set(key, now + ttl); // чтение тоже продлевает срок
      pendingTok = 0;
    }
    input = pendingTok;
    // для простоты «чтение» засчитываем целиком префиксу до самой длинной точки, которая есть в кэше
    const thinking = params.output_config?.effort === 'low' ? 150 : 400;
    return {
      input_tokens: input,
      cache_read_input_tokens: read,
      cache_creation_input_tokens: w5 + w1,
      cache_creation: { ephemeral_5m_input_tokens: w5, ephemeral_1h_input_tokens: w1 },
      output_tokens: estimateTokens(outText) + thinking,
    };
  }

  function adviceFrom(params) {
    const content = params.messages[0].content;
    const digest = content[0].text, delta = content[1]?.text || '';
    const changes = delta.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
    const steps = [...digest.matchAll(/^\d+\. \[([^\]]+)\] \(([^,]+),[^)]*\) ([^.]+)\./gm)].map(m => ({ id: m[1], cat: m[2], title: m[3] }));
    const top = steps[0] || { id: '', title: 'Продолжай текущий план' };
    const time = digest.match(/^# Куда ушло время[^\n]*\n([^\n]+)/m)?.[1];
    return {
      headline: tx`[симуляция] Главное узкое место: ${top.title}`.slice(0, 120),
      facts: [changes.length ? tx`Изменилось: ${changes.slice(0, 2).join('; ')}.` : 'Существенных изменений нет.', ...(time ? [time] : [])].slice(0, 2),
      goal: /^# Цель игрока/m.test(digest) ? 'В реальном режиме здесь будет шаг к цели.' : '',
    };
  }

  async function create(params) {
    let content, stop = 'end_turn';
    if (params.output_config?.format) {
      content = [{ type: 'text', text: JSON.stringify(adviceFrom(params)) }];
    } else {
      // Чат: в первом раунде просим get_steps, во втором отвечаем
      const lastMsg = params.messages[params.messages.length - 1];
      const afterTool = Array.isArray(lastMsg.content) && lastMsg.content[0]?.type === 'tool_result';
      if (!afterTool && params.tool_choice?.type !== 'none') {
        content = [{ type: 'tool_use', id: `toolu_mock_${log.length}`, name: 'get_steps', input: { filter: '' } }];
        stop = 'tool_use';
      } else {
        const tr = afterTool ? JSON.parse(lastMsg.content[0].content || '[]') : [];
        content = [{ type: 'text', text: tx`[симуляция] Судя по твоему плану, сейчас главное: ${tr[0]?.title || 'продолжать по плану'}. Причина: ${tr[0]?.why || '—'}` }];
      }
    }
    const outText = textOfContent(content);
    const usage = usageFor(params, outText);
    const resp = { id: `msg_mock_${log.length}`, type: 'message', role: 'assistant', model: params.model, content, stop_reason: stop, usage };
    log.push({ at: clock(), params, resp });
    return resp;
  }

  return { messages: { create }, beta: { messages: { create } }, log, mock: true };
}
