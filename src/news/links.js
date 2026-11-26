// Ссылки в тексте новостей: [название](раздел/подраздел#блок) — нажатие открывает раздел сайта (#/раздел/подраздел),
// прокручивает к блоку с data-news="блок" и подсвечивает его. Без #блок просто открывается раздел.
// Тот же разбор — в client/src/newsLinks.js.
export const NEWS_LINK = /\[([^\]\n]+)\]\(([a-z0-9][a-z0-9/_-]*)(?:#([a-z0-9-]+))?\)/g;

/** Текст без разметки ссылок: только название (для подсказок по тексту, поиска и нейросетей). */
export const plainNews = s => String(s ?? '').replace(NEWS_LINK, '$1');

/** Все ссылки в записях: [{ id, label, path, anchor }]. */
export function newsLinks(list) {
  const out = [];
  for (const e of list) for (const t of [e.title, ...e.items])
    for (const m of String(t).matchAll(NEWS_LINK)) out.push({ id: e.id, label: m[1], path: m[2], anchor: m[3] || null });
  return out;
}
