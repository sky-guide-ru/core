// Где искать русский текст для английской версии и что не переводим.
// Пути — от папки core; api и web лежат рядом (../api, ../web), как в рабочей папке из CONTRIBUTING.md
export const SOURCES = ['src', '../api/src', '../web/src'];
export const EXCLUDE = [
  // Перевод описаний предметов на русский: в английской версии — оригинал из игры
  'src/items-ru/lib/lore.js', 'src/items-ru/lib/glossary.js', 'src/items-ru/lib/search.js', 'src/items-ru/lib/terms.js', 'src/items-ru/scripts',
  'i18n/lang.js', 'i18n/ru.js',
  // Только для владельца сайта: панели, почта
  '../api/src/monitor/', '../api/src/lib/mailer.js', '../web/src/pages/StatusMonitor.jsx', '../web/src/pages/FeedbackAdmin.jsx',
  // ИИ-советчик: промпт, сводка и инструменты читает только модель (на /en/ ей велено отвечать по-английски)
  'src/live-advisor/lib/', 'src/live-advisor/scripts/', '../api/src/live-advisor/integration/',
];
/** Файл словаря для исходника: ../web/src/pages/Money.jsx → client-pages-Money, src/x.js и ../api/src/x.js → server-x */
export const groupOf = file => file.replace(/^\.\.\/web\/src\//, 'client/').replace(/^(\.\.\/api\/)?src\//, 'server/').replace(/\.(m?js|jsx)$/, '').replace(/[\\/]/g, '-');

// Данные в JSON, которые сайт показывает как есть: русские строки из них тоже идут в словарь (поля _comment — нет)
export const DATA = ['src/advisor/data/ladders.json', 'src/advisor/data/key-pets.json'];
/** Русские строки JSON-данных */
export function dataStrings(json) {
  const out = [];
  const walk = (v, k) => {
    if (typeof v === 'string') { if (/[А-Яа-яЁё]/.test(v) && !/^_/.test(k || '')) out.push(v); }
    else if (Array.isArray(v)) for (const x of v) walk(x, k);
    else if (v && typeof v === 'object') for (const kk in v) walk(v[kk], kk);
  };
  walk(json, null);
  return out;
}
