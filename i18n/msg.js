// Сообщения с ключом и параметрами: ru`Осталось ${n} шт.` — обычная русская строка «Осталось 5 шт.»,
// но сервер запоминает, из какого ключа («Осталось {0} шт.») и каких значений она собрана.
// Английская версия переводит такую строку по ключу из словаря i18n/en (как gettext/ICU), без угадывания
// по шаблонам: быстро и точно. Значения переводятся так же (вложенные ru`…`, слова из словаря).
// Ключ совпадает с тем, что собирает scripts/i18n.mjs, поэтому старые переводы подходят как есть.

const MAX = 100_000;
const registry = new Map(); // русская строка → { key, vals }
const keys = new WeakMap();  // куски шаблона → ключ
let sink = registry;         // куда записывать (см. collectMessages)

/** Ключ шаблона: куски текста, вставки — {0}, {1}…; фигурные скобки в тексте удваиваются */
export function keyOf(strings) {
  let key = '';
  strings.forEach((s, i) => { key += (i ? `{${i - 1}}` : '') + s.replace(/[{}]/g, m => m + m); });
  return key;
}

/** Тег шаблона: возвращает готовую русскую строку и запоминает её ключ и значения */
export function ru(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += String(vals[i] ?? '') + strings[i + 1];
  if (vals.length && /[А-Яа-яЁё]/.test(out) && !vals.includes(out)) { // «${a}${b}» с пустым b — это просто a, у него свой ключ
    const key = keys.get(strings) || keys.set(strings, keyOf(strings)).get(strings); // массив кусков один на место в коде
    // Та же строка уже собрана по ключу с русским текстом — не заменяем её шаблоном без текста («{0} {1}»)
    if (!/[А-Яа-яЁё]/.test(key) && sink.has(out)) return out;
    if (sink === registry && registry.size >= MAX) registry.delete(registry.keys().next().value);
    sink.set(out, { key, vals });
    if (strings.some(x => x.includes('<'))) htmlNodes(strings, vals);
  }
  return out;
}

// HTML-шаблон (страницы входа): английская версия переводит HTML по текстовым узлам,
// поэтому запоминаем ещё и каждый узел со вставками — «Выйти из ${name}?» → ключ «Выйти из {0}?»
const unesc = v => String(v ?? '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function htmlNodes(strings, vals) {
  let text = '', key = '', nv = [], inTag = false;
  const flush = () => {
    const t = text.trim();
    if (nv.length && /[А-Яа-яЁё]/.test(key) && !sink.has(t)) sink.set(t, { key: key.trim(), vals: nv });
    text = ''; key = ''; nv = [];
  };
  strings.forEach((st, i) => {
    // куски шаблона режем по тегам; вставка внутри тега (атрибут) в текст узла не входит
    const parts = st.split(/(<[^>]*>?)/);
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('<')) { flush(); inTag = !part.endsWith('>'); continue; }
      if (inTag) { if (part.includes('>')) { inTag = false; const rest = part.slice(part.indexOf('>') + 1); text += rest; key += rest.replace(/[{}]/g, m => m + m); } continue; }
      text += part; key += part.replace(/[{}]/g, m => m + m);
    }
    if (i < vals.length) {
      const v = String(vals[i] ?? '');
      if (inTag) return;
      if (v.includes('<')) { flush(); return; } // вставка сама из разметки — узел не собрать
      key += `{${nv.length}}`; nv.push(unesc(v)); text += unesc(v);
    }
  });
  flush();
}

/** Восстановить сообщение строки, сохранённой на диск (лента событий): { key, vals } из messageOf */
export function remember(s, msg) {
  if (s && msg?.key && Array.isArray(msg.vals) && !registry.has(s)) registry.set(s, msg);
}

/** Как собрана строка: { key, vals } или undefined (для переводчика) */
export const messageOf = s => {
  const m = registry.get(s);
  if (m) { registry.delete(s); registry.set(s, m); } // живые строки (их снова отдают) не вытесняются старыми
  return m;
};
/** То же, что ru: короткое имя для мест, где «ru» уже занято переменной */
export const tx = ru;

// Две готовые версии одного текста (русская и английская известны заранее: лор из игры, данные с полем En).
// Возвращает русскую строку, английская версия отдаётся по ней без перевода.
const pairs = new Map();
export function both(ruText, enText) {
  if (ruText && enText && ruText !== enText && /[А-Яа-яЁё]/.test(ruText)) {
    if (pairs.size >= MAX) pairs.delete(pairs.keys().next().value);
    pairs.set(ruText, enText);
  }
  return ruText;
}
/** Все пары both (сборка базы предметов в отдельном потоке передаёт их основному) */
export const allPairs = () => [...pairs];
/** Английская версия, заданная через both (для переводчика) */
export const pairOf = s => pairs.get(s);

/**
 * Собрать большую пачку строк (база предметов при запуске) в отдельный реестр, чтобы не вытеснить строки ответов.
 * Возвращает { result, messageOf } — по нему заготавливается английский текст, потом реестр выбрасывается.
 */
export function collectMessages(fn) {
  const prev = sink, own = new Map();
  sink = own;
  try { return { result: fn(), messageOf: s => own.get(s), messages: own }; } finally { sink = prev; }
}
