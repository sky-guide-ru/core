// Перевод для английской версии сайта — общий для сервера и браузера.
// Словарь: русский текст → английский. Ключи с вставками пишутся как «Осталось {0} шт.»; {{ и }} — обычные скобки.
// Нет перевода — остаётся русский текст (английская версия не ломается, просто кусок на русском).

export const CYR = /[А-Яа-яЁё]/;

/** Подставить значения в {0}, {1}… (для текста; для JSX см. client/src/i18n.js) */
export function fill(tpl, vals) {
  return tpl.replace(/\{\{|\}\}|\{(\d+)\}/g, (m, i) => (m === '{{' ? '{' : m === '}}' ? '}' : String(vals[+i] ?? '')));
}

/** Разбить шаблон на куски: строки и номера вставок — 'A {1} B {0}' → ['A ', 1, ' B ', 0] */
export function pieces(tpl) {
  const out = [];
  let buf = '';
  const re = /\{\{|\}\}|\{(\d+)\}/g;
  let last = 0, m;
  while ((m = re.exec(tpl))) {
    buf += tpl.slice(last, m.index);
    last = re.lastIndex;
    if (m[0] === '{{') buf += '{';
    else if (m[0] === '}}') buf += '}';
    else { if (buf) out.push(buf); buf = ''; out.push(+m[1]); }
  }
  buf += tpl.slice(last);
  if (buf) out.push(buf);
  return out;
}

// Числа по-английски поверх перевода: «14,06 млн/ч» → «14.06M/h», «500 млн монет» → «500M coins», «5 083» → «5,083»
const UNIT = { 'млрд': 'B', 'млн': 'M', 'тыс.': 'k', 'тыс': 'k' };
export function enNumbers(s) {
  return s
    .replace(/(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:,(\d+))?[ \u00a0]?(млрд|млн|тыс\.?)(?![А-Яа-яЁё])/g, (m, i, d, u) => i.replace(/[ \u00a0\u202f]/g, ',') + (d ? '.' + d : '') + UNIT[u])
    .replace(/(\d)[\u00a0\u202f](?=\d{3}(?!\d))/g, '$1,')
    .replace(/(\d),(\d{1,2})(?![\d,])/g, '$1.$2')
    .replace(/([\dkMB]) монет(?:ы|а)?(?![А-Яа-яЁё])/g, '$1 coins')
    .replace(/([\dkMB%)])\/ч(?![А-Яа-яЁё])/g, '$1/h')
    .replace(/([\dkMB%)])\/день(?![А-Яа-яЁё])/g, '$1/day')
    .replace(/([\dkMB%)]) в час(?![А-Яа-яЁё])/g, '$1 per hour')
    .replace(/([\dkMB%)]) в день(?![А-Яа-яЁё])/g, '$1 per day')
    .replace(/(\d) ч(?![А-Яа-яЁё])/g, '$1 h')
    .replace(/(\d) мин\.?(?![А-Яа-яЁё])/g, '$1 min')
    .replace(/(\d) с(?=[.,;)]|$)/g, '$1 s') // время крафта в Forge: «30 с.»
    .replace(/(\d) дн\.\.?(?![А-Яа-яЁё])/g, '$1 d.')
    .replace(/(\d) шт\./g, '$1 pcs')
    // русские связки между английскими словами: «Titanoboa и Alligator», «Hook или Bait», «3 из 10»
    .replace(/([A-Za-z0-9)'’]) и (?=[A-Z0-9])/g, '$1 and ')
    .replace(/([A-Za-z0-9)'’]) или (?=[A-Z0-9])/g, '$1 or ')
    .replace(/(\d) из (?=\d)/g, '$1 of ');
}
/**
 * Английский текст по словарю, без угадывания. Строка находится:
 *  - целиком в словаре (с отступами, значком впереди, точкой в конце, регистром первой буквы);
 *  - по ключу сообщения ru`…`/tx`…` (из какого шаблона и каких значений её собрал сервер), значения — так же;
 *  - в заготовках: английская версия задана заранее (both(), база предметов при запуске);
 *  - склейка таких строк («A · B», «A. B»): режем только у знаков препинания, число проверок ограничено.
 * Нет пары — строка остаётся как есть.
 */
export function createTranslator(dict, { messageOf, pairOf } = {}) {
  const exact = new Map(), byKey = new Map();
  for (const [ru, en] of Object.entries(dict)) {
    if (typeof en !== 'string' || !en) continue;
    if (/\{\d+\}/.test(ru)) byKey.set(ru, en);
    else { exact.set(ru, en); if (ru.trim() !== ru) exact.set(ru.trim(), en.trim()); }
  }
  let extraOf = null; // реестр пачки строк, которую сейчас заготавливает prepare
  const msgOf = s => messageOf?.(s) ?? extraOf?.(s);
  let prepared = new Map(); // заготовленные заранее пары (база предметов собирается при запуске): русская строка → английская
  const hit = x => exact.get(x) ?? prepared.get(x) ?? pairOf?.(x);
  const look = (s, noCase) => {
    let h = hit(s);
    if (h != null) return h;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if ((m[1] || m[3]) && (h = hit(m[2])) != null) return m[1] + h + m[3];
    const pm = /^([^\p{L}\p{N}«"(+~-]+)(\p{L}[\s\S]*)$/u.exec(s);
    if (pm && (h = look(pm[2], noCase)) != null) return pm[1] + h;
    if (/[^.]\.$/.test(s) && (h = hit(s.slice(0, -1))) != null) return h + (/[.!?]$/.test(h) ? '' : '.');
    if (!/[.!?]$/.test(s) && (h = hit(s + '.')) != null) return h.replace(/\.$/, '');
    if (noCase) return null;
    const f = s[0], sw = (f === f.toLowerCase() ? f.toUpperCase() : f.toLowerCase()) + s.slice(1);
    if ((h = look(sw, true)) != null) return f === f.toLowerCase() ? h : h[0].toUpperCase() + h.slice(1);
    return null;
  };
  function tr(s, depth = 0) {
    if (typeof s !== 'string' || !CYR.test(s)) return s;
    let out = look(s);
    if (out == null && depth < 4) {
      const msg = msgOf(s);
      // Шаблон без русского в тексте (`${name} ${lvl} → ${next}`) переводить не нужно: подставляем в него переведённые значения
      const en = msg && (byKey.get(msg.key) ?? (CYR.test(msg.key) ? null : msg.key));
      if (en != null) out = fill(en, msg.vals.map(v => (typeof v === 'string' ? tr(v, depth + 1) : v)));
    }
    if (out == null && depth < 4) { // отступы вокруг (текст между тегами HTML): собранная строка без них
      const w = /^(\s+)?([\s\S]*?)(\s+)?$/.exec(s);
      if (w[1] || w[3]) { const r = tr(w[2], depth + 1); if (r !== w[2]) out = (w[1] || '') + r + (w[3] || ''); }
    }
    if (out == null) { // значок впереди («✅ », «• »): собранная строка без него
      const pm = /^([^\p{L}\p{N}«"(~-]+)(\p{L}[\s\S]*)$/u.exec(s);
      if (pm) { const r = tr(pm[2], depth + 1); if (r !== pm[2]) out = pm[1] + r; }
    }
    if (out == null && depth < 3 && !late()) out = segCached(s);
    if (out == null) out = s;
    return depth === 0 ? enNumbers(out) : out;
  }
  // Склейка готовых кусков («A · B», tx`…` + tx`…`): режем только у знаков препинания и ищем каждый кусок в словаре.
  // Не угадывание: кусок либо есть в словаре (или собран по ключу), либо строка остаётся как есть. Число проверок ограничено.
  const SEP = /[.,;:·—|()\n+]/;
  // Сначала режем только по границам предложений и списков, потом — по всем знакам
  const STRONG = /[.;•·\n]/;
  function seg(s) { return segBy(s, STRONG) ?? segBy(s, SEP); }
  function segBy(s, SEP) {
    if (s.length > 4000) return null;
    const cut = [];
    for (let i = 1; i < s.length; i++) {
      if (SEP.test(s[i])) { cut.push(i, i + 1); let j = i + 1; while (j < s.length && (s[j] === ' ' || SEP.test(s[j]))) j++; if (j < s.length && j !== i) cut.push(j); }
      if (cut.length > 600) return null;
    }
    if (!cut.length) return null;
    const asc = [...new Set(cut)].filter(x => x < s.length).sort((a, b) => a - b);
    asc.push(s.length);
    const fail = new Set();
    let budget = 3000;
    const one = p => look(p) ?? (() => { const msg = msgOf(p); const en = msg && (byKey.get(msg.key) ?? (CYR.test(msg.key) ? null : msg.key)); return en != null ? fill(en, msg.vals.map(v => (typeof v === 'string' ? tr(v, 1) : v))) : null; })();
    const piece = p => {
      if (!CYR.test(p)) return p;
      const h = one(p);
      if (h != null) return h;
      const m = /^([\s.,;:·—|+]*)([\s\S]*?)([\s.,;:·—|+]*)$/.exec(p);
      if (!m[1] && !m[3]) return null;
      const c = one(m[2]);
      return c == null ? null : m[1] + c + m[3];
    };
    const go = a => {
      if (a === s.length) return '';
      if (fail.has(a)) return null;
      // от этой точки: вся оставшаяся строка, затем ближайшие 32 разреза — от длинного куска к короткому
      let k = 0; while (k < asc.length && asc[k] <= a) k++;
      const near = asc.slice(k, k + 32).reverse();
      if (near[0] !== s.length) near.unshift(s.length);
      for (const b of near) {
        if (a === 0 && b === s.length) continue;
        if (--budget < 0) return null;
        const r = piece(s.slice(a, b));
        if (r == null) continue;
        const rest = go(b);
        if (rest != null) return r + rest;
      }
      fail.add(a);
      return null;
    };
    return go(0);
  }
  // Склейки повторяются от запроса к запросу: результат (и промах) запоминаем
  const segMemo = new Map();
  function segCached(s) {
    let r = segMemo.get(s);
    if (r === undefined) { r = seg(s); if (segMemo.size > 20_000) segMemo.clear(); segMemo.set(s, r); }
    return r;
  }
  // Ответ API: склейки разбираем не дольше budgetMs, дальше — только словарь и ключи (они мгновенные)
  let deadline = Infinity, over = false;
  const late = () => deadline !== Infinity && (over ||= Date.now() > deadline);
  function walk(v, skip) {
    if (typeof v === 'string') return tr(v);
    if (Array.isArray(v)) { let ch = null; for (let i = 0; i < v.length; i++) { const n = walk(v[i], skip); if (n !== v[i]) (ch ||= v.slice())[i] = n; } return ch || v; }
    if (v && typeof v === 'object' && v.constructor === Object) {
      let ch = null;
      for (const k in v) { if (skip?.has(k)) continue; const n = walk(v[k], skip); if (n !== v[k]) (ch ||= { ...v })[k] = n; }
      return ch || v;
    }
    return v;
  }
  function deep(v, skip, { budgetMs = Infinity, onOver } = {}) {
    deadline = Date.now() + budgetMs; over = false;
    try { return walk(v, skip); } finally { if (over) onOver?.(); deadline = Infinity; over = false; }
  }
  /** Заготовить английский текст для строк, собранных при запуске (вызывать сразу после сборки, пока помнится их ключ) */
  // Частями по ~20 мс, чтобы сервер в это время отвечал на запросы
  async function prepare(list, ownOf) {
    extraOf = ownOf;
    const next = new Map();
    let t = Date.now();
    for (const s of list) {
      if (next.has(s)) continue;
      const en = tr(s);
      if (en !== s) next.set(s, en);
      if (Date.now() - t > 20) { await new Promise(r => setTimeout(r, 0)); t = Date.now(); }
    }
    prepared = next;
    extraOf = null;
    return next.size;
  }
  return { tr, deep, prepare, size: exact.size + byKey.size };
}

