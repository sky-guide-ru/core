// Поиск русского текста в исходниках (сборка и сбор словаря). Работает по дереву разбора oxc (rolldown/parseAst),
// поэтому не путает текст с кодом. Возвращает «места» — куда и что подставить для английской версии:
//  - str:  строка-литерал 'Текст'                         → __t('Текст')
//  - tpl:  шаблон `Осталось ${n} шт.`                     → __tt('Осталось {0} шт.', [n])
//  - jsx:  текст внутри JSX вместе с соседними вставками   → {__tj('Обновлено {0} назад', [<b/>])}
//  - attr: строка в атрибуте JSX title="Текст"            → title={__t('Текст')}
// Ключ словаря — русский текст, вставки заменены на {0}, {1}… Перевод хранится в i18n/en/*.json.
import { parseAst } from 'rolldown/parseAst';

export const CYR = /[А-Яа-яЁё]/;

// Где строку переводить нельзя: она сравнивается, служит ключом, путём, регуляркой и т. п.
const SKIP_CALLEE = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'test', 'match', 'matchAll', 'split', 'replace', 'replaceAll',
  'RegExp', 'getItem', 'setItem', 'removeItem', 'has', 'get', 'set', 'delete', 'localeCompare', 'require', 'import', 'querySelector', 'querySelectorAll',
  'addEventListener', 'noT', 'createHash', 'update', 'digest', 'console', 'log', 'warn', 'error', 'info', 'debug', 'raw', 'fromCharCode', 'sendFile', 'set']);
const SKIP_PROP = new Set(['id', 'key', 'kind', 'type', 'slug', 'icon', 'fb', 'href', 'src', 'path', 'className', 'class', 'style', 'pattern', 're', 'regex', 'rx', 'match', 'test', 'alias', 'aliases', 'search', 'q', 'nameRu', 'syn', 'synonyms', 'keywords', 'words']);

/** JSX-текст так, как его увидит React: строки обрезаются, переносы с отступами схлопываются в пробел */
export function cookJsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmpty = i;
  let str = '';
  for (let i = 0; i < lines.length; i++) {
    const isFirst = i === 0, isLast = i === lines.length - 1, isLastNonEmpty = i === lastNonEmpty;
    let t = lines[i].replace(/\t/g, ' ');
    if (!isFirst) t = t.replace(/^[ ]+/, '');
    if (!isLast) t = t.replace(/[ ]+$/, '');
    if (t) { if (!isLastNonEmpty) t += ' '; str += t; }
  }
  return decodeEntities(str);
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', laquo: '«', raquo: '»', hellip: '…', middot: '·', times: '×', rarr: '→', larr: '←', thinsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m));
}

const tplKey = q => q.map(x => (x.value.cooked ?? x.value.raw).replace(/[{}]/g, m => m + m)).reduce((a, s, i) => (i ? `${a}{${i - 1}}${s}` : s), '');

/**
 * @returns {{ sites: Array, error?: string }}
 * sites: { kind, key, start, end, ... } — непересекающиеся куски исходника, отсортированные по start
 */
export function scan(code, filename = 'x.jsx') {
  if (!CYR.test(code)) return { sites: [] };
  let ast;
  const lang = /\.jsx$/.test(filename) ? 'jsx' : 'js';
  try { ast = parseAst(code, { lang, sourceType: 'module' }, filename); } catch (e) { return { sites: [], error: e.message }; }
  const sites = [];
  const parents = [];

  const skipByParent = (node, parent, gp) => {
    if (!parent) return false;
    switch (parent.type) {
      case 'ImportDeclaration': case 'ExportNamedDeclaration': case 'ExportAllDeclaration': case 'ImportExpression': return true;
      case 'Property': if (parent.key === node && !parent.computed) return true;
        { const k = parent.key?.name ?? parent.key?.value; if (SKIP_PROP.has(k)) return true; } break;
      case 'PropertyDefinition': case 'MethodDefinition': if (parent.key === node) return true; break;
      case 'MemberExpression': if (parent.property === node) return true; break;
      case 'BinaryExpression': if (/^(===|!==|==|!=|in|instanceof|<|>|<=|>=)$/.test(parent.operator)) return true; break;
      case 'SwitchCase': if (parent.test === node) return true; break;
      case 'ExpressionStatement': if (parent.directive) return true; break;
      case 'CallExpression': case 'NewExpression': {
        const c = parent.callee;
        const nm = c?.type === 'Identifier' ? c.name : c?.type === 'MemberExpression' ? (c.property?.name ?? c.property?.value) : null;
        if (nm && SKIP_CALLEE.has(nm)) return true;
        if (c?.type === 'MemberExpression' && c.object?.type === 'Identifier' && c.object.name === 'console') return true;
        break;
      }
      // ru`…` (i18n/msg.js) — сообщение с ключом: тот же ключ словаря, что у обычного шаблона
      case 'TaggedTemplateExpression': if (parent.tag?.type === 'Identifier' && (parent.tag.name === 'ru' || parent.tag.name === 'tx')) break; return true;
      case 'ArrayExpression': {
        // массив ключей рядом с has/includes: new Set(['…']) — пропускаем, если он аргумент Set/Map
        if (gp && gp.type === 'NewExpression' && /^(Set|Map|WeakSet|WeakMap)$/.test(gp.callee?.name || '')) return true;
        break;
      }
      case 'AssignmentExpression': { const l = parent.left; const nm = l?.property?.name; if (nm && SKIP_PROP.has(nm)) return true; break; }
      case 'JSXAttribute': {
        const nm = parent.name?.name;
        if (nm === 'key' || nm === 'className' || nm === 'id' || nm === 'href' || nm === 'src' || nm === 'name' || nm === 'value' || nm === 'htmlFor' || nm === 'data-news' || nm === 'news' || nm === 'icon' || nm === 'to' || nm === 'lang' || nm === 'type') return true;
        break;
      }
    }
    return false;
  };

  function jsxChildren(el) {
    const kids = el.children || [];
    if (!kids.some(k => k.type === 'JSXText' && CYR.test(k.value))) return false;
    const tagName = el.openingElement?.name?.name;
    // Разбиваем детей на «текстовые прогоны»: подряд идущие JSXText и {выражения}, без крупных блоков по краям
    const parts = []; // { text } | { node }
    for (const k of kids) {
      if (k.type === 'JSXText') parts.push({ text: k.raw ?? k.value, node: k });
      else if (k.type === 'JSXExpressionContainer' && k.expression.type === 'JSXEmptyExpression') parts.push({ comment: true, node: k });
      else parts.push({ expr: true, node: k });
    }
    // Собираем ключ по всем детям; отступы между блоками, которые React выбросит, не считаем
    let key = '', vals = [];
    const cooked = parts.map(p => (p.text != null ? cookJsxText(p.text) : null));
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.comment) continue;
      if (p.text != null) key += cooked[i].replace(/[{}]/g, m => (m === '{' ? '{{' : '}}'));
      else { key += `{${vals.length}}`; vals.push(p.node); }
    }
    const first = kids[0], last = kids[kids.length - 1];
    sites.push({ kind: 'jsx', key: key, start: first.start, end: last.end, vals: vals.map(v => ({ start: v.type === 'JSXExpressionContainer' ? v.expression.start : v.start, end: v.type === 'JSXExpressionContainer' ? v.expression.end : v.end, isEl: v.type !== 'JSXExpressionContainer' })), stringOnly: /^(option|title|textarea)$/.test(tagName || '') });
    return true;
  }

  function walk(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    const gp = parents[parents.length - 2];
    if (node.type === 'Literal' && typeof node.value === 'string' && CYR.test(node.value)) {
      if (parent?.type === 'JSXAttribute') { if (!skipByParent(node, parent, gp)) sites.push({ kind: 'attr', key: node.value, start: node.start, end: node.end }); return; }
      if (!skipByParent(node, parent, gp)) sites.push({ kind: 'str', key: node.value, start: node.start, end: node.end });
      return;
    }
    if (node.type === 'TemplateLiteral' && node.quasis.some(q => CYR.test(q.value.cooked ?? q.value.raw))) {
      if (skipByParent(node, parent, gp)) return;
      const key = tplKey(node.quasis);
      if (node.expressions.length === 0) { sites.push({ kind: 'str', key, start: node.start, end: node.end }); return; }
      // вложенные шаблоны и строки в выражениях — свои места
      const inner = [];
      const save = sites.length;
      parents.push(node);
      for (const e of node.expressions) walk(e, node);
      parents.pop();
      inner.push(...sites.splice(save));
      sites.push({ kind: 'tpl', key, start: node.start, end: node.end, vals: node.expressions.map(e => ({ start: e.start, end: e.end })), inner });
      return;
    }
    if ((node.type === 'JSXElement' || node.type === 'JSXFragment')) {
      parents.push(node);
      if (node.openingElement) for (const a of node.openingElement.attributes || []) walk(a, node.openingElement);
      const save = sites.length;
      // дети: сначала вложенные места внутри выражений и элементов
      for (const k of node.children || []) if (k.type !== 'JSXText') walk(k, node);
      const inner = sites.splice(save);
      if (jsxChildren(node)) sites[sites.length - 1].inner = inner; else sites.push(...inner);
      parents.pop();
      return;
    }
    parents.push(node);
    for (const k in node) {
      if (k === 'start' || k === 'end' || k === 'type' || k === 'loc' || k === 'range') continue;
      const v = node[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, node); }
      else if (v && typeof v.type === 'string') walk(v, node);
    }
    parents.pop();
  }
  walk(ast, null);
  return { sites };
}

/** Все ключи (включая вложенные) — для сбора словаря */
export function keysOf(sites, out = []) {
  for (const s of sites) { out.push({ kind: s.kind, key: s.key }); if (s.inner) keysOf(s.inner, out); }
  return out;
}
