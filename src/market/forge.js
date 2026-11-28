// The Forge (Dwarven Mines): слоты игрока, выгодные рецепты под ритм заходов и пошаговые цепочки деталей бура.
// Чистые функции: профиль (member), рынок (MarketCtx) и база NEU (ctx.items) приходят снаружи.
import { forgeFlips, planForge } from './flips.js';
import { extractRecipes, nameOf } from './util.js';
import { checkCrafttext } from './requirements.js';
import { tx } from '../../i18n/msg.js';

const lvl = x => Number((x && typeof x === 'object' ? x.level : x) || 0);
export const hotmOf = m => lvl(m?.mining?.hotm);

/** Слоты Forge по уровню HotM (как в «Заработке»); занятый слот с бо́льшим номером поднимает число. */
export function forgeSlots(m, override) {
  if (override) return override;
  const h = hotmOf(m);
  const base = h >= 7 ? 5 : h >= 5 ? 4 : h >= 3 ? 3 : 2;
  const busy = (m?.gather?.forge || []).reduce((a, f) => Math.max(a, Number(f.slot) || 0), 0);
  return Math.max(base, busy);
}

/** Quick Forge: 10% + 0,5% за уровень перка, не больше 30%. */
export function quickForgeOf(m, override) {
  if (override != null) return override;
  const q = Number(m?.mining?.nodes?.quick_forge || 0);
  return q > 0 ? Math.min(0.3, 0.1 + 0.005 * q) : 0;
}

/** «Requires: Mithril X & HotM 3» → 3 (или 0, если уровень не нужен). */
export function hotmReq(crafttext) {
  const m = String(crafttext || '').match(/HotM\s+(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/** Рецепт Forge предмета из базы NEU: { inputs, duration (с), count, crafttext } или null. */
export function forgeRecipe(items, id) {
  const it = items?.get?.(id);
  const r = it ? extractRecipes(it).find(x => x.type === 'forge') : null;
  return r ? { ...r, crafttext: it.crafttext || '' } : null;
}

// ---------- что лежит в Forge ----------

/**
 * Слоты Forge игрока по данным профиля: что куётся, когда будет готово.
 * @returns {{ slots: number, qf: number, list: Array<{ slot, id, name, start, end, ready, leftMs, progress }|{ slot, empty: true }> }}
 */
export function forgeNow(m, items, now = Date.now(), opts = {}) {
  const slots = forgeSlots(m, opts.slots);
  const qf = quickForgeOf(m, opts.quickForge);
  const busy = new Map();
  for (const f of m?.gather?.forge || []) {
    const r = forgeRecipe(items, f.id);
    const durMs = r?.duration > 0 ? r.duration * 1000 * (1 - qf) : null;
    const end = durMs && f.start ? f.start + durMs : null;
    busy.set(Number(f.slot) || busy.size + 1, {
      id: f.id, name: nameOf({ items }, f.id), start: f.start || null, end,
      ready: end != null && end <= now, leftMs: end != null ? Math.max(0, end - now) : null,
      progress: end != null && durMs ? Math.min(1, Math.max(0, (now - f.start) / durMs)) : null,
    });
  }
  const list = [];
  for (let s = 1; s <= slots; s++) list.push(busy.has(s) ? { slot: s, ...busy.get(s) } : { slot: s, empty: true });
  return { slots, qf, list };
}

// ---------- выгодные рецепты под ритм ----------

/** Ритмы заходов в Forge: каждые 4 ч, 2 раза в день, раз в сутки. */
export const VISITS = [4, 12, 24];

/** Сколько часов рецепт занимает слот, если заходить раз в visitH часов. */
export const slotHours = (durationH, visitH) => Math.max(1, Math.ceil(durationH / visitH - 1e-9)) * visitH;

/** Сколько штук предмета у игрока: хранилища, Sacks и уже лежащее в Forge. */
export function stockOf(m, owned) {
  const out = new Map();
  const add = (id, n) => { if (id && n > 0) out.set(id, (out.get(id) || 0) + n); };
  for (const [id, list] of owned || []) for (const it of list) add(id, Number(it.count) || 1);
  for (const [id, n] of Object.entries(m?.inv?.sacks || {})) add(id, Number(n) || 0);
  // детали, стоящие на бурах, тоже «есть»: их снимает Jotraeline Greatforge
  for (const [, list] of owned || []) for (const it of list) for (const u of it.upgrades || []) if (u.kind === 'drill') add(u.id, 1);
  return out;
}

// Перебор всех рецептов NEU тяжёлый, а список гайдов собирается на каждый запрос: кэш до смены контекста рынка
const flipsMemo = new WeakMap();
function cachedFlips(mctx, qf, maxCost) {
  let m = flipsMemo.get(mctx);
  if (!m) { m = new Map(); flipsMemo.set(mctx, m); }
  const cap = maxCost === Infinity ? Infinity : Math.max(1e6, Math.round(maxCost / 1e6) * 1e6);
  const key = `${qf}|${cap}`;
  if (!m.has(key)) {
    if (m.size > 50) m.clear();
    m.set(key, forgeFlips(mctx, { limit: 80, quickForge: qf, maxCost: cap, skipSuspicious: true }));
  }
  return m.get(key);
}

/**
 * Выгодные рецепты Forge для игрока и раскладка по его слотам для каждого ритма заходов.
 * @param {object} mctx MarketCtx
 * @param {object} m member (или гость без профиля)
 * @param {{ stock?: Map, collections?: Map, maxCost?: number, guest?: boolean }} o
 */
export function forgeProfitPlans(mctx, m, o = {}) {
  const slots = forgeSlots(m, o.slots);
  const qf = quickForgeOf(m, o.quickForge);
  const list = cachedFlips(mctx, qf, o.maxCost ?? Infinity);
  const stock = o.stock || new Map();
  const rows = list.map(f => {
    const r = forgeRecipe(mctx.items, f.id);
    const need = r ? Object.entries(r.inputs) : [];
    const check = o.guest ? { ok: true, missing: [] } : checkCrafttext(f.crafttext, m, o.collections);
    return {
      id: f.id, name: f.name, count: f.count, durationH: f.durationH, profit: f.profit, cost: f.cost, market: f.market,
      parts: (f.parts || []).map(p => ({ id: p.id, n: p.n, name: p.name })),
      hotm: hotmReq(f.crafttext), locked: check.ok === false ? check.missing : null,
      own: need.length > 0 && need.every(([id, n]) => (stock.get(id) || 0) >= n), // на одну ковку хватит своих запасов
      maxSlots: f.maxSlots, warning: f.warning,
    };
  });
  const open = rows.filter(r => !r.locked);
  const plans = VISITS.map(visitH => {
    const sorted = open.map(r => {
      const h = slotHours(r.durationH, visitH);
      return { ...r, slotH: h, perHour: r.profit / h, perHourLow: 0, maxSlots: (r.maxSlots ?? 0) * h / Math.max(r.durationH, 0.01) };
    }).sort((a, b) => b.perHour - a.perHour);
    const p = planForge(sorted, slots);
    const used = new Set(p.used.map(u => u.id));
    return {
      visitH, perHour: p.perHour, idle: Math.round(p.idle * 10) / 10,
      used: p.used.map(u => ({ id: u.id, slots: u.slots, slotH: u.slotH, perHour: u.perHour })),
      top: sorted.slice(0, 8).map(r => ({ id: r.id, perHour: r.perHour, slotH: r.slotH, slots: used.has(r.id) ? p.used.find(u => u.id === r.id).slots : 0 })),
    };
  });
  // цели: лучшие закрытые рецепты, ближайшие по уровню HotM
  const goals = rows.filter(r => r.locked).sort((a, b) => a.hotm - b.hotm || b.profit / b.durationH - a.profit / a.durationH).slice(0, 2)
    .map(r => ({ ...r, perHour: r.profit / slotHours(r.durationH, 12) }));
  return { slots, qf, rows: Object.fromEntries(rows.map(r => [r.id, r])), plans, goals };
}

// ---------- улучшение бура ----------

// Цепочки деталей и самих буров. Детали снимаются и переносятся на новый бур у Jotraeline Greatforge.
export const DRILL_CHAINS = [
  { key: 'engine', label: 'Двигатель', field: 'drill_part_engine', icon: 'MITHRIL_DRILL_ENGINE', why: '+Mining Speed',
    ids: ['MITHRIL_DRILL_ENGINE', 'TITANIUM_DRILL_ENGINE', 'RUBY_POLISHED_DRILL_ENGINE', 'SAPPHIRE_POLISHED_DRILL_ENGINE', 'AMBER_POLISHED_DRILL_ENGINE'] },
  { key: 'tank', label: 'Топливный бак', field: 'drill_part_fuel_tank', icon: 'MITHRIL_FUEL_TANK', why: 'больше топлива',
    ids: ['MITHRIL_FUEL_TANK', 'TITANIUM_FUEL_TANK', 'GEMSTONE_FUEL_TANK', 'PERFECTLY_CUT_FUEL_TANK'] },
  { key: 'module', label: 'Модуль', field: 'drill_part_upgrade_module', icon: 'GOBLIN_OMELETTE', why: 'бонус модуля',
    ids: ['GOBLIN_OMELETTE', 'GOBLIN_OMELETTE_BLUE_CHEESE'] },
];
export const DRILLS = [
  ['MITHRIL_DRILL_1', 'MITHRIL_DRILL_2', 'TITANIUM_DRILL_1', 'TITANIUM_DRILL_2', 'TITANIUM_DRILL_3', 'TITANIUM_DRILL_4', 'DIVAN_DRILL'],
  ['GEMSTONE_DRILL_1', 'GEMSTONE_DRILL_2', 'GEMSTONE_DRILL_3', 'GEMSTONE_DRILL_4'],
];
const DRILL_IDS = DRILLS.flat();
const drillRank = id => {
  for (const line of DRILLS) { const i = line.indexOf(id); if (i >= 0) return line === DRILLS[0] ? i * 2 : i * 2 + 3; }
  return -1;
};

/** Лучший бур игрока (по месту в линейке) и его детали. */
export function playerDrill(owned) {
  let best = null;
  for (const id of DRILL_IDS) for (const it of owned?.get(id) || []) if (!best || drillRank(id) > drillRank(best.id)) best = { id, item: it };
  if (!best) return null;
  const parts = {};
  for (const u of best.item.upgrades || []) if (u.kind === 'drill') {
    const c = DRILL_CHAINS.find(ch => ch.ids.includes(u.id));
    if (c) parts[c.key] = u.id;
  }
  return { id: best.id, parts };
}

/**
 * Пошаговая цепочка Forge до предмета: промежуточные ковки (снизу вверх) и материалы.
 * Что уже есть у игрока — вычитается; детали, которые сами куются, раскладываются дальше.
 */
export function forgeChain(items, target, { stock = new Map(), price = () => null, qf = 0, slots = 2, noMarket = false } = {}) {
  const left = new Map(stock);
  const take = (id, n) => { const h = left.get(id) || 0; const t = Math.min(h, n); left.set(id, h - t); return t; };
  const steps = new Map(); // id → { id, need, have, durationH, inputs, depth }
  const mats = new Map(); // id → { need, have }
  const walk = (id, n, depth, seen) => {
    const r = forgeRecipe(items, id);
    if (!r || seen.has(id)) {
      const m = mats.get(id) || { id, need: 0, have: 0 };
      m.need += n; m.have += take(id, n); mats.set(id, m);
      return;
    }
    const s = steps.get(id) || { id, need: 0, have: 0, durationH: r.duration / 3600 * (1 - qf), inputs: r.inputs, count: r.count || 1, depth: 0 };
    s.depth = Math.max(s.depth, depth);
    s.need += n;
    const got = depth === 0 ? 0 : take(id, n); // сам предмет-цель всегда куём
    s.have += got;
    steps.set(id, s);
    const crafts = Math.ceil((n - got) / s.count);
    if (crafts <= 0) return;
    const next = new Set(seen).add(id);
    for (const [inp, k] of Object.entries(r.inputs)) {
      if (inp !== 'SKYBLOCK_COIN') { walk(inp, k * crafts, depth + 1, next); continue; }
      const c = mats.get(inp) || { id: inp, need: 0, have: 0 };
      c.need += k * crafts;
      mats.set(inp, c);
    }
  };
  walk(target, 1, 0, new Set());
  const list = [...steps.values()].sort((a, b) => b.depth - a.depth).map(s => {
    const crafts = Math.max(0, Math.ceil((s.need - s.have) / s.count));
    return { id: s.id, name: nameOf({ items }, s.id), need: s.need, have: s.have, crafts, durationH: Math.round(s.durationH * 100) / 100,
      done: crafts === 0, inputs: Object.entries(s.inputs).map(([id, n]) => ({ id, n, name: id === 'SKYBLOCK_COIN' ? 'Coins' : nameOf({ items }, id) })) };
  });
  const materials = [...mats.values()].map(x => {
    const missing = Math.max(0, x.need - x.have);
    const unit = x.id === 'SKYBLOCK_COIN' ? 1 : price(x.id);
    return { id: x.id, name: x.id === 'SKYBLOCK_COIN' ? 'Coins' : nameOf({ items }, x.id), need: x.need, have: x.have, missing, cost: unit && missing ? unit * missing : missing ? null : 0 };
  });
  // время: вся работа по слотам, но не меньше самой длинной ветки (её не ускорить лишними слотами)
  const total = list.reduce((a, s) => a + s.crafts * s.durationH, 0);
  const hours = Math.max(total / Math.max(1, slots), critPath(list));
  const unknown = materials.some(x => x.missing && x.cost == null && x.id !== 'SKYBLOCK_COIN');
  const cost = noMarket ? null : unknown ? null : materials.reduce((a, x) => a + (x.cost || 0), 0);
  return { target, steps: list, materials, forgeHours: Math.round(total * 10) / 10, hours: Math.round(hours * 10) / 10, cost };
}

// Самая длинная цепочка ковок подряд (ингредиент → предмет), без учёта числа слотов
function critPath(list) {
  const by = new Map(list.map(s => [s.id, s]));
  const memo = new Map();
  const len = id => {
    if (memo.has(id)) return memo.get(id);
    const s = by.get(id);
    if (!s || !s.crafts) { memo.set(id, 0); return 0; }
    memo.set(id, 0);
    const v = s.durationH + Math.max(0, ...s.inputs.map(i => len(i.id)));
    memo.set(id, v);
    return v;
  };
  return Math.max(0, ...list.map(s => len(s.id)));
}

/**
 * Что улучшить в буре: следующая деталь в каждой цепочке и следующий бур, у каждого — пошаговая цепочка Forge.
 * @param {object} items база NEU
 * @param {{ owned: Map, stock: Map, price: (id) => number|null, priceAh?: (id) => number|null, qf, slots, noMarket, member }} o
 */
export function drillUpgrades(items, o = {}) {
  const drill = playerDrill(o.owned);
  const h = hotmOf(o.member);
  const chainOpts = { stock: o.stock, price: o.price, qf: o.qf || 0, slots: o.slots || 2, noMarket: !!o.noMarket };
  const make = (key, label, icon, cur, next, why) => {
    if (!next || !items?.get?.(next)) return null;
    const r = forgeRecipe(items, next);
    const req = hotmReq(r?.crafttext);
    const ch = forgeChain(items, next, chainOpts);
    const ready = !o.noMarket && o.priceAh ? o.priceAh(next) : null;
    return { key, label, icon, current: cur, currentName: cur ? nameOf({ items }, cur) : null, next, nextName: nameOf({ items }, next), why,
      hotm: req, locked: req > h ? tx`HotM ${req}` : null, readyPrice: ready || null, ...ch };
  };
  const out = [];
  for (const c of DRILL_CHAINS) {
    const cur = drill?.parts?.[c.key] || null;
    const i = cur ? c.ids.indexOf(cur) : -1;
    out.push(make(c.key, c.label, c.icon, cur, c.ids[i + 1], c.why));
  }
  // сам бур: следующий в своей линейке; без бура — первый Mithril Drill
  const line = drill ? DRILLS.find(l => l.includes(drill.id)) : DRILLS[0];
  const nextDrill = drill ? line[line.indexOf(drill.id) + 1] : line[0];
  out.push(make('drill', 'Сам бур', drill?.id || 'MITHRIL_DRILL_1', drill?.id || null, nextDrill, null));
  return { drill: drill ? { id: drill.id, name: nameOf({ items }, drill.id), parts: drill.parts } : null, parts: out.filter(Boolean) };
}

/** Для профилей без рынка: какие ковки нужны своей прокачке (шаги цепочек бура) и хватает ли материалов. */
export function forgeForSelf(upgrades) {
  const seen = new Map();
  for (const p of upgrades?.parts || []) {
    if (p.locked) continue;
    for (const s of p.steps) {
      if (s.done || seen.has(s.id)) continue;
      // чего не хватает именно на этот шаг (промежуточные ковки цепочки не в счёт — они идут раньше)
      const missing = p.materials.filter(x => x.missing > 0 && x.id !== 'SKYBLOCK_COIN' && s.inputs.some(i => i.id === x.id));
      seen.set(s.id, { id: s.id, name: s.name, durationH: s.durationH, crafts: s.crafts, forId: p.next, forName: p.nextName, inputs: s.inputs,
        enough: missing.length === 0, missing: missing.slice(0, 2).map(x => ({ id: x.id, name: x.name, n: x.missing })) });
    }
  }
  return [...seen.values()].slice(0, 6);
}

