// Журнал замираний сервера для страницы «Сервер»: отличить «сервер встал» от «медленная сеть до сервера».
// - Замирание: цикл событий Node не отвечал дольше STALL_MS (таймер опаздывает). Записываем, сколько длилось,
//   какие запросы в это время были в работе или только что закончились и какие фоновые задачи шли.
// - Долгий запрос: сервер сам потратил на ответ дольше SLOW_MS (без учёта сети до посетителя).
// Если игроки жалуются на долгую загрузку, а здесь пусто, — время уходит в сети, а не на сервере.
// Ники и параметры не пишем: от адреса остаются только первые два куска (/api/state, /api/item).

const STALL_MS = 300;
const SLOW_MS = 2000;
const KEEP_MS = 6 * 3600_000;
const MAX = 60;

/** Адрес без ников и параметров: /api/head/Steve → /api/head, /en/api/x?y → /api/x (en отдельным флагом) */
export function routeOf(p) {
  const parts = String(p || '').split('?')[0].split('/').filter(Boolean);
  return '/' + parts.slice(0, 2).join('/');
}

export function createStalls({ clock = () => Date.now(), tickMs = 100, stallMs = STALL_MS, slowMs = SLOW_MS } = {}) {
  const inFlight = new Map(); // id → { route, en, start }
  const recent = []; // закончившиеся за последние секунды: { route, en, start, end }
  const stalls = [], slow = [];
  const bg = new Map(); // фоновая задача → сколько её запусков идёт
  const bgDone = []; // недавно закончившиеся: { name, end }
  let seq = 0, hour = { since: clock(), total: 0, slow: 0, maxMs: 0 };

  const trim = list => { const now = clock(); while (list.length && (list.length > MAX || now - list[0].at > KEEP_MS)) list.shift(); };

  /** Запрос начался; вернёт функцию «закончился» */
  function begin(path, en = false) {
    const id = ++seq, r = { route: routeOf(path), en: !!en, start: clock() };
    inFlight.set(id, r);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      inFlight.delete(id);
      r.end = clock();
      const ms = r.end - r.start;
      if (r.end - hour.since > 3600_000) hour = { since: r.end, total: 0, slow: 0, maxMs: 0 };
      hour.total++;
      if (ms > hour.maxMs) hour.maxMs = ms;
      // Поток событий (/api/stream) держится открытым минутами — это не долгий ответ
      if (ms >= slowMs && r.route !== '/api/stream') { hour.slow++; slow.push({ at: r.start, ms, route: r.route, en: r.en }); trim(slow); }
      recent.push(r);
      while (recent.length > 200 || (recent.length && r.end - recent[0].end > 10_000)) recent.shift();
    };
  }

  /** Фоновая задача (цены, аукцион, профиль): fn выполняется как есть, но видно, что она шла во время замирания */
  async function background(name, fn) {
    bg.set(name, (bg.get(name) || 0) + 1);
    // Синхронная часть задачи заканчивается раньше, чем таймер заметит замирание: помним и недавно закончившиеся
    try { return await fn(); } finally {
      const n = bg.get(name) - 1; if (n > 0) bg.set(name, n); else bg.delete(name);
      bgDone.push({ name, end: clock() });
      while (bgDone.length > 50 || (bgDone.length && clock() - bgDone[0].end > 10_000)) bgDone.shift();
    }
  }

  function record(from, to) {
    const ms = to - from;
    // Кто мог держать сервер: запросы, которые шли во время замирания или закончились в нём
    const who = new Map();
    const add = r => { const k = (r.en ? 'en ' : '') + r.route; who.set(k, (who.get(k) || 0) + 1); };
    for (const r of inFlight.values()) if (r.start <= to) add(r);
    for (const r of recent) if (r.end >= from && r.start <= to) add(r);
    stalls.push({ at: from, ms, requests: [...who].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([route, n]) => ({ route, n })), background: [...new Set([...bg.keys(), ...bgDone.filter(b => b.end >= from).map(b => b.name)])] });
    trim(stalls);
  }

  let last = clock();
  const timer = setInterval(() => {
    const now = clock(), late = now - last - tickMs;
    if (late >= stallMs) record(last + tickMs, now);
    last = now;
  }, tickMs);
  timer.unref?.();

  function summary() {
    trim(stalls); trim(slow);
    const now = clock();
    const hourStalls = stalls.filter(s => now - s.at < 3600_000);
    return {
      stallMs, slowMs,
      lastHour: { requests: hour.total, slow: hour.slow, maxRequestMs: hour.maxMs, stalls: hourStalls.length, maxStallMs: hourStalls.reduce((m, s) => Math.max(m, s.ms), 0) },
      stalls: stalls.slice(-20).reverse(),
      slow: slow.slice(-20).reverse(),
    };
  }

  return { begin, background, summary, stop: () => clearInterval(timer) };
}
