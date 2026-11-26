import { ru } from '../../../i18n/msg.js';
// Сколько powder ещё можно потратить в дереве Heart of the Mountain.
// Формулы стоимости берутся из NEU constants/hotmlayout.json (маленький lisp-подобный язык).
// Нужно, чтобы не советовать «потрать powder», когда все перки уже прокачаны до максимума.

const tokenize = s => s.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim().split(/\s+/).filter(Boolean);

function parse(tokens) {
  const t = tokens.shift();
  if (t === '(') {
    const list = [];
    while (tokens.length && tokens[0] !== ')') list.push(parse(tokens));
    tokens.shift();
    return list;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : t;
}

function evaluate(x, env) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string') {
    if (x in env) return env[x];
    return x.replace(/^:/, '');
  }
  const [op, ...a] = x;
  const v = i => evaluate(a[i], env);
  switch (op) {
    case 'pow': return Math.pow(v(0), v(1));
    case '+': return a.reduce((s, _, i) => s + v(i), 0);
    case '-': return a.length === 1 ? -v(0) : v(0) - v(1);
    case '*': return a.reduce((s, _, i) => s * v(i), 1);
    case '/': return v(0) / v(1);
    case 'lt': return v(0) < v(1);
    case '=': return v(0) === v(1);
    case 'if': return v(0) ? v(1) : v(2);
    case 'list.new': return a.map((_, i) => v(i));
    case 'list.at': return v(0)[v(1)];
    case 'round': return Math.round(v(0));
    case 'floor': return Math.floor(v(0));
    default: throw new Error(ru`hotm: неизвестная операция ${op}`);
  }
}

const cache = new Map();
function run(expr, env) {
  if (expr == null || expr === '') return 0;
  if (typeof expr === 'number') return expr;
  let ast = cache.get(expr);
  if (!ast) { ast = parse(tokenize(String(expr))); cache.set(expr, ast); }
  return evaluate(ast, env);
}

const NODE_ALIASES = { core_of_the_mountain: ['special_0', 'core_of_the_mountain'] };

/**
 * Сколько powder каждого вида нужно, чтобы докачать все перки HotM до максимума.
 * @param {Object<string, number>} nodes  mining_core.nodes из API
 * @param {Object} layout                 neu.constants.hotmlayout
 * @returns {{ MITHRIL: number, GEMSTONE: number, GLACITE: number } | null}  null — нет данных о раскладке
 */
export function hotmPowderRemaining(nodes, layout) {
  const perks = layout?.hotm?.perks;
  if (!perks) return null;
  const need = { MITHRIL: 0, GEMSTONE: 0, GLACITE: 0 };
  for (const [id, p] of Object.entries(perks)) {
    const max = Number(p.maxLevel) || 1;
    const keys = NODE_ALIASES[id] || [id];
    const cur = Math.min(max, Math.max(0, ...keys.map(k => Number(nodes?.[k]) || 0)));
    for (let level = cur; level < max; level++) {
      // level — текущий уровень (как в подсказке NEU «Cost: …» для следующего уровня)
      let cost, powder;
      try {
        cost = run(p.cost, { level, level0: level, maxLevel: max });
        powder = String(run(p.powder, { level, level0: level, maxLevel: max }));
      } catch { cost = 0; }
      if (typeof cost === 'number' && cost > 0 && need[powder] != null) need[powder] += Math.floor(cost);
    }
  }
  return need;
}

/**
 * Перки дерева (HotM или HotF) по раскладке NEU: уровень, максимум, ряд и сколько ресурса осталось вложить.
 * @param {Object<string, number>} nodes  уровни перков из API
 * @param {Object} tree  layout.hotm или layout.hotf ({ perks })
 * @returns {Array<{ id, name, tier, level, max, powder, left }>}  tier — ряд дерева (1 — нижний, открывается на 1 уровне)
 */
export function treePerks(nodes, tree) {
  const perks = tree?.perks;
  if (!perks) return [];
  const maxY = Math.max(...Object.values(perks).map(p => Number(p.y) || 0));
  const out = [];
  for (const [id, p] of Object.entries(perks)) {
    const max = Number(p.maxLevel) || 1;
    const keys = NODE_ALIASES[id] || [id];
    const level = Math.min(max, Math.max(0, ...keys.map(k => Number(nodes?.[k]) || 0)));
    let left = 0, powder = null;
    for (let l = level; l < max; l++) {
      try {
        const cost = run(p.cost, { level: l, level0: l, maxLevel: max });
        const pw = String(run(p.powder, { level: l, level0: l, maxLevel: max }));
        powder ||= pw;
        if (typeof cost === 'number' && cost > 0) left += Math.floor(cost);
      } catch { /* формула не разобралась — считаем 0 */ }
    }
    if (!powder) { try { powder = String(run(p.powder, { level: 0, level0: 0, maxLevel: max })); } catch { powder = String(p.powder || ''); } }
    out.push({ id, name: p.name || id, tier: maxY + 1 - (Number(p.y) || 0), level, max, powder, left });
  }
  return out.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}
