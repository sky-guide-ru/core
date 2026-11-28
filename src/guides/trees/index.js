// Деревья Heart of the Mountain и Heart of the Forest для гайдов: все перки с русским описанием по уровням,
// стоимость, твои уровни, сборки (варианты прокачки) и план, куда вложить свободный Powder.
// Секция { kind: 'tree' } рисуется компонентом TreeView (client/src/guides/Tree.jsx).
import { TREES } from './data.js';
import { BUILDS } from './builds.js';
import { tr, isEn } from '../../../i18n/lang.js';
import { tx } from '../../../i18n/msg.js';

// ---------- маленький интерпретатор формул NEU (lisp) ----------
const tokenize = s => String(s).replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim().split(/\s+/).filter(Boolean);
function parse(t) {
  const x = t.shift();
  if (x === '(') { const l = []; while (t.length && t[0] !== ')') l.push(parse(t)); t.shift(); return l; }
  if (/^".*"$/.test(x)) return { s: x.slice(1, -1) };
  const n = Number(x);
  return Number.isFinite(n) ? n : x;
}
function ev(x, env) {
  if (typeof x === 'number') return x;
  if (x && typeof x === 'object' && !Array.isArray(x)) return Number.isFinite(Number(x.s)) ? Number(x.s) : x.s;
  if (typeof x === 'string') return x in env ? env[x] : x === 'true' ? true : x === 'false' ? false : x.replace(/^:/, '');
  const [op, ...a] = x;
  const v = i => ev(a[i], env);
  switch (op) {
    case '+': return a.reduce((s, _, i) => s + v(i), 0);
    case '-': return a.length === 1 ? -v(0) : v(0) - v(1);
    case '*': return a.reduce((s, _, i) => s * v(i), 1);
    case '/': return v(0) / v(1);
    case 'pow': return Math.pow(v(0), v(1));
    case 'lt': return v(0) < v(1);
    case 'gt': return v(0) > v(1);
    case '=': return v(0) === v(1);
    case 'if': return v(0) ? v(1) : a.length > 2 ? v(2) : null;
    case 'round': return Math.round(v(0));
    case 'floor': return Math.floor(v(0));
    case 'min': return Math.min(v(0), v(1));
    case 'max': return Math.max(v(0), v(1));
    case 'id': return v(0);
    case 'round-decimals': { const p = 10 ** v(1); return Math.round(v(0) * p) / p; }
    case 'list.new': return a.map((_, i) => v(i));
    case 'list.at': return v(0)?.[v(1)];
    default: throw new Error(tx`формула: ${op}`);
  }
}
const cache = new Map();
export function calc(expr, env) {
  if (expr == null || expr === '') return null;
  if (typeof expr === 'number') return expr;
  let ast = cache.get(expr);
  if (!ast) { ast = parse(tokenize(expr)); cache.set(expr, ast); }
  try { return ev(ast, env); } catch { return null; }
}

const num = v => (typeof v === 'number' ? v.toLocaleString(isEn() ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 }) : String(v ?? '?'));

/** Описание перка на уровне level: {stat…} → значения формул. */
export function describe(p, level, env = {}) {
  const e = { level, level0: level, maxLevel: p.max, potm: env.potm ?? 0, hotm: env.hotm ?? 0 };
  return tr(p.ru).replace(/\{(stat\w*)\}/g, (_, k) => num(calc(p.stats?.[k], e)));
}

// Token of the Mountain за уровни HotM (1-й даёт 1, 7-й даёт 3, остальные по 2) + 4 от Core of the Mountain (5, 7 и 10 уровни)
const HOTM_TOKENS = [1, 2, 2, 2, 2, 2, 3, 2, 2, 2];
export function hotmTokens(hotm, core) {
  const base = HOTM_TOKENS.slice(0, Math.max(0, Math.min(10, hotm))).reduce((s, v) => s + v, 0);
  const fromCore = (core >= 5 ? 1 : 0) + (core >= 7 ? 1 : 0) + (core >= 10 ? 2 : 0);
  return base + fromCore;
}

const RES = {
  MITHRIL: 'Mithril Powder', GEMSTONE: 'Gemstone Powder', GLACITE: 'Glacite Powder',
  FOREST_WHISPERS: 'Forest Whispers', DESERT_WHISPERS: 'Desert Whispers',
};

/**
 * Собирает дерево: перки с уровнями, стоимостью и описаниями.
 * @param {'hotm'|'hotf'} kind
 * @param {Object<string, number>} nodes  уровни перков из API (skill_tree.nodes.mining / .foraging)
 * @param {{ level: number, potm?: number, layout?: Object }} o  layout — constants.hotmlayout.hotm из NEU (если есть, формулы стоимости берутся оттуда)
 */
export function buildTree(kind, nodes = {}, o = {}) {
  const def = TREES[kind];
  const lay = o.layout?.perks || {};
  const rows = Math.max(...Object.values(def).map(p => p.y)) + 1;
  const env = { potm: o.potm || 0, hotm: o.level || 0 };
  const perks = [];
  for (const [id, base] of Object.entries(def)) {
    const p = { ...base, cost: lay[id]?.cost ?? base.cost, powder: lay[id]?.powder ?? base.powder };
    const level = Math.min(p.max, Math.max(0, Number(nodes[id] ?? (id === 'core_of_the_mountain' ? nodes.special_0 : 0)) || 0));
    const tier = rows - p.y;
    const costs = {};
    let costNext = null, powderNext = null, unknownCost = false;
    for (let l = level; l < p.max; l++) {
      const e = { level: l, level0: l, maxLevel: p.max };
      const c = calc(p.cost, e);
      const pw = String(calc(p.powder, e) ?? p.powder);
      if (l === level) { costNext = typeof c === 'number' ? Math.floor(c) : null; powderNext = pw; }
      if (typeof c === 'number' && c > 0) costs[pw] = (costs[pw] || 0) + Math.floor(c);
      else if (c == null && !(kind === 'hotm' && p.max === 1)) unknownCost = true; // в HotM перки-способности без уровней стоят только токен
    }
    const open = tier <= (o.level || 0);
    perks.push({
      id, name: p.name, short: p.short, x: p.x, y: p.y, tier, level, max: p.max, ability: !!p.ability,
      state: level >= p.max ? 'max' : level > 0 ? 'partial' : open ? 'open' : 'locked',
      powder: powderNext || String(calc(p.powder, { level: 0, level0: 0, maxLevel: p.max }) ?? p.powder),
      costNext, costToMax: costs, unknownCost: unknownCost && level < p.max,
      now: level > 0 ? describe(p, level, env) : null,
      next: level < p.max ? describe(p, level + 1, env) : null,
      atMax: p.max > 1 ? describe(p, p.max, env) : null,
    });
  }
  perks.sort((a, b) => a.y - b.y || a.x - b.x);
  return { kind, rows, cols: 7, perks };
}

/**
 * Куда вложить свободные ресурсы: идём по порядку сборки, докачиваем взятые перки, пока хватает.
 * @returns {Array<{ id, name, from, to, powder, cost }>}
 */
export function spendPlan(tree, order, avail, skip = new Set(), caps = {}) {
  const left = { ...avail };
  const plan = [];
  const def = TREES[tree.kind];
  for (const id of order) {
    const p = tree.perks.find(x => x.id === id);
    if (!p || p.level === 0 || p.level >= Math.min(p.max, caps[id] ?? p.max) || skip.has(id)) continue;
    skip.add(id);
    // Core of the Mountain меняет вид Powder по уровням: каждый вид — отдельный шаг плана со своей ценой
    let lvl = p.level, from = p.level, spent = 0, pw = null;
    const flush = () => { if (lvl > from) plan.push({ id, name: p.name, from, to: lvl, powder: pw, cost: spent }); from = lvl; spent = 0; };
    const cap = Math.min(p.max, caps[id] ?? p.max);
    while (lvl < cap) {
      const e = { level: lvl, level0: lvl, maxLevel: p.max };
      const c = calc(def[id].cost, e);
      const kind = String(calc(def[id].powder, e) ?? def[id].powder);
      if (typeof c !== 'number' || c <= 0 || (left[kind] ?? 0) < Math.floor(c)) break;
      if (pw && kind !== pw) flush();
      left[kind] -= Math.floor(c); spent += Math.floor(c); pw = kind; lvl++;
    }
    flush();
  }
  return { plan, left };
}

// Целевой уровень перка в сборке: targets, «light» — 1 уровень, иначе максимум
const capsOf = (tree, b) => Object.fromEntries(tree.perks.map(p => [p.id, Math.min(p.max, b.light?.includes(p.id) ? 1 : b.targets?.[p.id] ?? p.max)]));

// Порядок перков сборки: сначала order, потом остальные perks
const ordered = b => [...new Set([...(b.order || []), ...b.perks])];

/**
 * Короткий план «что сделать» для сборки: 3–5 шагов, каждый привязан к перкам на дереве.
 * Шаги: take — взять перки за свободные токены; swap — сбросить дерево и переставить токены;
 * up — докачать перк Powder'ом. Номер шага рисуется на клетке перка.
 */
/**
 * Порядок покупки с учётом связей: перк можно взять, только если соседняя клетка (слева, справа,
 * сверху, снизу) уже взята; в пустом дереве начинаем с нижнего ряда. Если до нужного перка не
 * дотянуться, добавляем перки-«мостики» по кратчайшему пути через открытые клетки.
 * @returns {string[]} перки в порядке покупки (мостики включены)
 */
export function purchaseOrder(tree, wanted, owned) {
  const at = new Map(tree.perks.map(p => [tx`${p.x},${p.y}`, p]));
  const have = new Set(owned);
  const out = [];
  const pathTo = target => {
    // BFS от взятых клеток (или от нижнего ряда, если дерево пустое) до цели через открытые клетки
    const starts = have.size ? tree.perks.filter(p => have.has(p.id)) : tree.perks.filter(p => p.tier === 1 && p.state !== 'locked');
    const prev = new Map(starts.map(p => [p.id, null]));
    const q = [...starts];
    if (!have.size && prev.has(target)) return [target];
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = at.get(`${c.x + dx},${c.y + dy}`);
        if (!n || prev.has(n.id) || n.state === 'locked') continue;
        prev.set(n.id, c.id);
        if (n.id === target) {
          const path = [];
          for (let id = target; id != null && !have.has(id); id = prev.get(id)) path.unshift(id);
          return path;
        }
        q.push(n);
      }
    }
    return null;
  };
  let left = wanted.filter(id => !have.has(id));
  while (left.length) {
    let picked = null;
    for (const id of left) { const path = pathTo(id); if (path) { picked = path; break; } }
    if (!picked) break;
    for (const id of picked) { have.add(id); out.push(id); }
    left = left.filter(id => !have.has(id));
  }
  return out;
}

// Связан ли набор перков: всё достижимо от нижнего ряда по соседним клеткам из этого же набора
export function connected(tree, ids) {
  const set = new Set(ids);
  const at = new Map(tree.perks.map(p => [tx`${p.x},${p.y}`, p]));
  const q = tree.perks.filter(p => set.has(p.id) && p.tier === 1);
  const seen = new Set(q.map(p => p.id));
  while (q.length) {
    const c = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = at.get(`${c.x + dx},${c.y + dy}`);
      if (n && set.has(n.id) && !seen.has(n.id)) { seen.add(n.id); q.push(n); }
    }
  }
  return seen.size === set.size;
}

// Какие перки можно снять, не разрывая дерево: группы по очереди (сначала лишние, потом «по желанию»),
// внутри — с меньшей прокачкой; несколько проходов, пока что-то снимается; не больше limit.
function peel(tree, owned, groups, limit, by) {
  const weak = (x, y) => by[x].level / by[x].max - by[y].level / by[y].max;
  const removed = [];
  const orders = groups.map(g => g.filter(id => owned.includes(id)).sort(weak));
  // по одному перку: всегда сначала из первой группы (лишние), «по желанию» — только если лишнее не снять,
  // и после каждого снятия снова с первой группы (снятый край мог открыть следующий)
  const canDrop = id => !removed.includes(id) && connected(tree, owned.filter(x => x !== id && !removed.includes(x)));
  while (removed.length < limit) {
    const id = orders.map(o => o.find(canDrop)).find(Boolean);
    if (!id) break;
    removed.push(id);
  }
  return removed;
}

function stepsFor(kind, tree, b, { free = null, avail = null } = {}) {
  const by = Object.fromEntries(tree.perks.map(p => [p.id, p]));
  const seq = ordered(b);
  const owned = tree.perks.filter(p => p.level > 0).map(p => p.id);
  const wanted = seq.filter(id => by[id] && by[id].state !== 'locked');
  const bridgeOf = ids => ids.filter(id => !b.perks.includes(id));
  const steps = [];
  let take = [];
  const buyNow = purchaseOrder(tree, wanted, owned);
  if (free == null) take = buyNow.slice(0, 4);             // HotF: сколько токенов, API не говорит
  else if (free > 0) take = buyNow.slice(0, free);
  if (take.length) steps.push({ kind: 'take', add: take, bridge: bridgeOf(take), free });
  if (free != null && buyNow.length > take.length) {
    // Сброс дерева: снимаем лишнее (а если не хватает — перки «по желанию»), но только так,
    // чтобы оставшееся дерево не разорвалось. Снимаем с краёв, проходами по кругу.
    const base = owned.concat(take);
    const want = buyNow.slice(take.length);
    // Перки, через которые идёт путь к нужным, снимать нельзя: исключаем их и подбираем замену (до 3 попыток)
    const keep = new Set();
    let remove = [], route = [];
    for (let i = 0; i < 3; i++) {
      const cand = [b.extra, owned.filter(id => b.optional?.includes(id))].map(g => g.filter(id => !keep.has(id)));
      remove = peel(tree, base, cand, Math.min(want.length, 4), by);
      route = purchaseOrder(tree, wanted, base.filter(id => !remove.includes(id)));
      const need = remove.filter(id => route.includes(id));
      if (!need.length) break;
      need.forEach(id => keep.add(id));
      remove = remove.filter(id => !need.includes(id));
      route = purchaseOrder(tree, wanted, base.filter(id => !remove.includes(id)));
    }
    route = route.slice(0, remove.length);
    if (route.length) steps.push({ kind: 'swap', add: route, bridge: bridgeOf(route), remove: remove.slice(0, route.length) });
  }
  if (avail) {
    const done = new Set();
    const { plan } = spendPlan(tree, seq.filter(id => b.perks.includes(id)), avail, done, capsOf(tree, b));
    // докачиваем только перки сборки: остальные — «по желанию» или на снятие
    for (const x of plan.slice(0, Math.max(1, 5 - steps.length))) steps.push({ kind: 'up', ...x });
  }
  return steps;
}

function buildsFor(kind, tree, o = {}) {
  const have = new Set(tree.perks.filter(p => p.level > 0).map(p => p.id));
  return (BUILDS[kind] || []).map(b => {
    const r = {
      ...b,
      missing: ordered(b).filter(id => !have.has(id)),
      extra: [...have].filter(id => !b.perks.includes(id) && !b.optional?.includes(id) && !['core_of_the_mountain', 'center_of_the_forest'].includes(id)),
    };
    r.steps = stepsFor(kind, tree, r, o);
    // Цель по каждому перку: до какого уровня качать (max — до максимума), брать ли вообще
    r.targets = {};
    const caps = capsOf(tree, b);
    const byId = Object.fromEntries(tree.perks.map(p => [p.id, p]));
    const canDrop = new Set(peel(tree, [...have], [r.extra], Infinity, byId));
    for (const p of tree.perks) {
      const inB = b.perks.includes(p.id) || ['core_of_the_mountain', 'center_of_the_forest'].includes(p.id);
      const opt = b.optional?.includes(p.id);
      const target = inB ? caps[p.id] : 0;
      const status = inB ? (p.level >= target ? 'done' : p.level === 0 ? (p.state === 'locked' ? 'later' : 'add') : 'up')
        : opt ? 'opt' : p.level > 0 ? (canDrop.has(p.id) ? 'remove' : 'bridge') : 'skip';
      r.targets[p.id] = { target, status };
    }
    // что план предлагает снять при перестановке — помечаем «снять», даже если это перк «по желанию»
    for (const st of r.steps) for (const id of st.remove || []) r.targets[id] = { target: 0, status: 'remove' };
    return r;
  });
}

/** Секция-дерево HotM для гайда по добыче. */
export function hotmTreeSection(m, ctx = {}) {
  const mi = m?.mining || {};
  const level = mi.hotm?.level || 0;
  const nodes = mi.nodes || {};
  const core = Number(nodes.core_of_the_mountain ?? nodes.special_0 ?? mi.potm ?? 0);
  const tree = buildTree('hotm', nodes, { level, potm: core, layout: ctx.adv?.opts?.constants?.hotmlayout?.hotm });
  const avail = { MITHRIL: mi.powder?.mithrilAvail || 0, GEMSTONE: mi.powder?.gemstoneAvail || 0, GLACITE: mi.powder?.glaciteAvail || 0 };
  const total = hotmTokens(level, core);
  const spent = mi.tokensSpent ?? null;
  const free = spent != null ? Math.max(0, total - spent) : null;
  const builds = buildsFor('hotm', tree, { free: free ?? 0, avail });
  const rec = level < 5 ? 'commissions' : 'gems';
  const recB = builds.find(b => b.id === rec);
  const done = new Set();
  const { plan, left } = spendPlan(tree, recB.order || recB.perks, avail, done);
  // остаток — в остальные взятые перки (по ряду дерева снизу вверх)
  const rest = spendPlan(tree, [...tree.perks].sort((a, b) => a.tier - b.tier).map(p => p.id), left, done);
  const resources = Object.entries(avail).map(([k, v]) => ({
    id: k, name: RES[k], avail: v,
    needOpen: tree.perks.filter(p => p.level > 0).reduce((s, p) => s + (p.costToMax[k] || 0), 0),
    needAll: tree.perks.reduce((s, p) => s + (p.costToMax[k] || 0), 0),
  }));
  return {
    kind: 'tree', title: 'Дерево Heart of the Mountain', tree: 'hotm',
    sources: 'SkyKings Mining Guide (ноябрь 2026), wiki.scd.wtf (октябрь 2026)',
    note: 'Цифры на клетках — шаги плана. Нажми на перк, чтобы увидеть, что он даёт и сколько стоит.',
    level, maxLevel: 10, rows: tree.rows, cols: tree.cols, perks: tree.perks,
    tokens: { total, spent, free },
    ability: mi.ability || null,
    resources,
    builds, recommended: rec,
    recommendReason: rec === 'gems'
      ? 'Гемы дают самый стабильный доход, а Gemstone Powder нужен больше всего.'
      : 'Пока HotM ниже 5, быстрее всего качаться на заданиях.',
    plan: [...plan, ...rest.plan],
    leftover: rest.left,
  };
}

/** Секция-дерево HotF для гайда по Foraging. */
export function hotfTreeSection(m, ctx = {}) {
  const table = ctx.adv?.opts?.constants?.leveling?.HOTF || [0, 3000, 9000, 25000, 60000, 100000, 150000, 200000];
  const xp = Number(m?.hotfXp || 0);
  let level = 0, acc = 0;
  for (const need of table) { if (xp >= acc + need) { acc += need; level++; } else break; }
  const nodes = m?.hotfNodes || {};
  const tree = buildTree('hotf', nodes, { level, layout: ctx.adv?.opts?.constants?.hotflayout?.hotf });
  const spent = m?.gather?.tokensForest ?? null;
  const builds = buildsFor('hotf', tree);
  const wh = m?.gather?.whispers || {};
  return {
    kind: 'tree', title: 'Дерево Heart of the Forest', tree: 'hotf',
    sources: 'SkyKings Heart of the Forest (октябрь 2026), форум hypixel.net (июль 2026)',
    note: 'Цифры на клетках — шаги плана. Нажми на перк, чтобы увидеть, что он даёт. Цену в Whispers смотри в игре: в базе NEU её нет.',
    level, maxLevel: table.length, rows: tree.rows, cols: tree.cols, perks: tree.perks,
    tokens: { total: null, spent, free: null },
    ability: m?.gather?.axeAbility || null,
    resources: [
      { id: 'FOREST_WHISPERS', name: RES.FOREST_WHISPERS, avail: wh.forest?.available ?? null, total: wh.forest?.total ?? null },
      { id: 'DESERT_WHISPERS', name: RES.DESERT_WHISPERS, avail: wh.desert?.available ?? null, total: wh.desert?.total ?? null },
    ],
    builds, recommended: 'logs',
    recommendReason: 'Рубка — основа Foraging: больше брёвен и Whispers, быстрее растёт скилл.',
    plan: [],
    leftover: null,
  };
}
