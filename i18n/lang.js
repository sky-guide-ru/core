// Английская версия сайта на сервере: язык запроса и перевод ответов.
// Язык: заголовок X-Lang (запросы сайта к /api) → адрес /en/… → ?lang= → cookie sb-lang (страницы входа, поток событий).
// Английский текст — на выходе: JSON ответов /api и HTML-страницы проходят через словарь i18n/en/*.json (русский → английский).
// Ничего не угадывается: строка берётся из словаря целиком, по ключу шаблона tx`…` или из заготовок (both, база предметов).
// Новый текст сервера с вставками — только через tx`…`/ru`…` (i18n/msg.js). Чего нет в словаре — остаётся по-русски.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createTranslator } from './runtime.js';
import { loadDict } from './dict.js';
import { messageOf, pairOf } from './msg.js';

const store = new AsyncLocalStorage();
let translator = null;
export function getTranslator() { return (translator ||= createTranslator(loadDict(), { messageOf, pairOf })); }
/** Заготовить английский для строк базы предметов (в фоне, частями) */
export const prepareEn = (list, ownOf) => getTranslator().prepare(list, ownOf);
/** Для тестов: свой словарь */
export function setTranslatorDict(dict) { translator = createTranslator(dict, { messageOf, pairOf }); }

/** Язык текущего запроса ('ru' | 'en') — для мест, где текст выбирается по языку (описание предмета, советчик) */
export const currentLang = () => store.getStore()?.lang || 'ru';
export const isEn = () => currentLang() === 'en';
/** Перевести строку для текущего запроса (в русской версии — как есть) */
/** Выполнить fn с заданным языком (общие кэши строим по-русски: перевод — на выходе) */
export const inLang = (lang, fn) => store.run({ lang }, fn);
export const tr = s => (isEn() ? getTranslator().tr(s) : s);

const pathLang = p => (/^\/en(\/|$)/.test(p) ? 'en' : null);
const norm = v => (v === 'en' ? 'en' : v === 'ru' ? 'ru' : null);
const cookieLang = req => norm(/(?:^|;\s*)sb-lang=(\w+)/.exec(req.headers.cookie || '')?.[1]);

// Язык посетителя для первой страницы: выбранный раньше (cookie sb-lang ставит каждая открытая версия и переключатель RU/EN),
// иначе — язык браузера: русский и языки СНГ → русская версия, остальные → английская.
// Роботов (поисковики, превью ссылок, проверки) не перекидываем: им каждая версия отдаётся по своему адресу, как в hreflang
const RU_LIKE = /^(ru|uk|be|kk|ky|uz|tg|hy|az|ka)\b/i;
const BOT = /bot|crawl|spider|slurp|yandex|google|bing|duckduck|baidu|yahoo|facebookexternalhit|telegram|whatsapp|vkshare|discord|skype|preview|lighthouse|headless|curl|wget|python|node-fetch|axios/i;
export function preferredLang(req) {
  const ua = String(req.headers?.['user-agent'] || '');
  if (!ua || BOT.test(ua)) return null;
  const chosen = cookieLang(req);
  if (chosen) return chosen;
  const first = String(req.headers?.['accept-language'] || '').split(',')[0].trim();
  if (!first || first === '*') return null;
  return RU_LIKE.test(first) ? 'ru' : 'en';
}

export function langOf(req) {
  return norm(req.get?.('x-lang') || req.headers?.['x-lang']) || pathLang(req.path || req.url || '') || norm(req.query?.lang) || cookieLang(req) || 'ru';
}

// Внутри <script> и <style> переводим только строки в кавычках; текст между тегами и подписи в атрибутах — целиком
const ATTRS = /(\s(?:title|placeholder|alt|aria-label|content|value|data-tip)=")([^"]*[А-Яа-яЁё][^"]*)(")/g;
export function translateHtml(html, t = getTranslator()) {
  const parts = html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/i);
  return parts.map((part, i) => {
    if (i % 2) return part.replace(/(["'`])((?:(?!\1)[^\\\n]|\\.)*[А-Яа-яЁё](?:(?!\1)[^\\\n]|\\.)*)\1/g, (m, q, s) => { const o = t.tr(s); return o === s ? m : q + o.replace(new RegExp(q, 'g'), '\\' + q) + q; });
    return part
      .replace(/<html lang="ru"/, '<html lang="en"').replace(/content="ru_RU"/, 'content="en_US"')
      .replace(ATTRS, (m, a, s, b) => a + escAttr(t.tr(unesc(s))) + b)
      .replace(/>([^<]*[А-Яа-яЁё][^<]*)</g, (m, s) => `>${escText(t.tr(unesc(s)))}<`);
  }).join('');
}
const unesc = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => escText(s).replace(/"/g, '&quot;');

/** Ключи JSON, которые не переводим: по ним сайт ищет данные или это ввод игрока */
const SKIP_KEYS = new Set(['nameRu', 'aliases', 'search', 'q', 'id', 'key', 'raw', 'nick', 'name_ru', 'loreRu', 'msg']);

/** Перевести дерево JSON на английский (ключи из SKIP_KEYS не трогаем) */
export const translateDeep = v => getTranslator().deep(v, SKIP_KEYS, { budgetMs: 1500, onOver: () => warnSlow('разбор профиля') });

export const RESPONSE_BUDGET_MS = 400;
const slowAt = new Map();
function warnSlow(p) { const t = Date.now(); if (slowAt.size > 500) slowAt.clear(); if (t - (slowAt.get(p) || 0) > 600_000) { slowAt.set(p, t); console.warn(`[перевод] ${p}: не уложился в ${RESPONSE_BUDGET_MS} мс, часть ответа по-русски`); } }

/** middleware: язык запроса в req.sbLang и в AsyncLocalStorage; на английском — перевод JSON и HTML */
export function langMiddleware() {
  return (req, res, next) => {
    req.sbLang = langOf(req);
    if (req.path.startsWith('/api')) res.vary('X-Lang');
    const json = res.json.bind(res), send = res.send.bind(res);
    // Не дольше RESPONSE_BUDGET_MS на ответ: остальное — по-русски, а не замерший на минуту сервер
    res.json = body => (req.sbLang === 'en' && !res.sbNoTranslate
      ? json(getTranslator().deep(body, SKIP_KEYS, { budgetMs: RESPONSE_BUDGET_MS, onOver: () => warnSlow(req.path) }))
      : json(body));
    res.send = body => {
      if (req.sbLang === 'en' && typeof body === 'string' && /html/.test(String(res.get('Content-Type') || ''))) return send(translateHtml(body));
      return send(body);
    };
    store.run({ get lang() { return req.sbLang; } }, next);
  };
}
