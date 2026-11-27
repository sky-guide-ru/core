// Расход ключа Hypixel по дням: сколько запросов с ключом ушло сегодня, на что (профили, Garden, музей, ранг)
// и чьи (свой профиль владельца или чужие). Ключ разработчика Hypixel ограничен и за 5 минут, и за сутки —
// по этим цифрам на странице «Сервер» видно, что съедает суточный лимит. Хранится в data/hypixel-usage.json,
// последние 14 дней. Ники и uuid не пишем — только счётчики.
import fs from 'node:fs';
import path from 'node:path';

const DAYS = 14;
const dayOf = t => new Date(t).toISOString().slice(0, 10); // сутки по UTC

export function createKeyUsage({ file = null, clock = () => Date.now(), saveDelayMs = 30_000 } = {}) {
  let days = {};
  if (file) { try { days = JSON.parse(fs.readFileSync(file, 'utf8')).days || {}; } catch { /* первый запуск */ } }
  let timer = null;

  function save() {
    timer = null;
    if (!file) return;
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ days })); } catch { /* не критично */ }
  }
  function later() { if (file && !timer) { timer = setTimeout(save, saveDelayMs); timer.unref?.(); } }
  function day(t = clock()) {
    const k = dayOf(t);
    if (!days[k]) {
      days[k] = { total: 0, kind: {}, who: {}, limited: 0, deduped: 0 };
      const keys = Object.keys(days).sort();
      for (const old of keys.slice(0, Math.max(0, keys.length - DAYS))) delete days[old];
    }
    return days[k];
  }

  return {
    /** Запрос ушёл в Hypixel: kind — profiles | garden | museum | player | guild, who — own | others */
    count(kind, who = 'others') {
      const d = day();
      d.total++;
      d.kind[kind] = (d.kind[kind] || 0) + 1;
      d.who[who] = (d.who[who] || 0) + 1;
      later();
    },
    /** Запрос не ушёл: ждал такой же уже летящий (deduped) или ключ на паузе после 429 (limited) */
    skipped(why) { const d = day(); d[why] = (d[why] || 0) + 1; later(); },
    today() { return { day: dayOf(clock()), ...day() }; },
    /** Последние дни, новые сверху */
    recent(n = 7) { return Object.keys(days).sort().reverse().slice(0, n).map(k => ({ day: k, ...days[k] })); },
    flush() { if (timer) { clearTimeout(timer); save(); } },
  };
}
