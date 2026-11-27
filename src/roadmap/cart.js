// План покупок, который игрок правит сам: data/roadmap-cart.json у вошедшего владельца профиля, у гостя — в браузере.
// { byKey: { 'uuid:profileId': { skip: { stepId: { at } }, custom: { itemId: { qty, at, done? } } } } }
// Основа — шаги плана с ценой (advisor purchasePlan). Игрок убирает ненужные шаги и добавляет свои вещи.
// Своя вещь, которая уже лежит у игрока в нужном количестве, считается купленной: сразу уходит из итога,
// а через сутки (DONE_MS) удаляется из списка совсем. Убранный шаг, которого нет в плане сутки, тоже забывается.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { pruneHidden } from './hidden.js';
import { ownedCount as ownedCountAll } from '../lib/owned.js';

const FILE = () => path.join(config.dataDir, 'roadmap-cart.json');
const STEP_ID = /^[A-Za-z0-9_:.\-]{1,100}$/;
const ITEM_ID = /^[A-Za-z0-9_:;\-.]{1,80}$/;
export const MAX_CUSTOM = 60;
export const MAX_QTY = 100_000;
export const DONE_MS = 24 * 3600_000;
let cache = null;

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE(), 'utf8')) || {}; } catch { cache = {}; }
  if (!cache.byKey) cache = { byKey: {} };
  return cache;
}
function save() {
  try { fs.mkdirSync(config.dataDir, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(cache)); } catch { /* останется в памяти до перезапуска */ }
}

const qtyOf = q => Math.max(1, Math.min(MAX_QTY, Math.round(Number(q)) || 1));

/** Привести список к правильному виду: лишнее и битое отбрасывается (так же читается список гостя из браузера). */
export function normCart(raw) {
  const out = { skip: {}, custom: {} };
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw.skip || {})) {
    if (STEP_ID.test(id)) out.skip[id] = { at: Number(v?.at) || 0, ...(v?.gone ? { gone: Number(v.gone) } : {}) };
  }
  for (const [id, v] of Object.entries(raw.custom || {}).slice(0, MAX_CUSTOM)) {
    if (!ITEM_ID.test(id)) continue;
    out.custom[id] = { qty: qtyOf(v?.qty), at: Number(v?.at) || 0, ...(v?.done ? { done: Number(v.done) } : {}) };
  }
  return out;
}

/** Сколько штук предмета у игрока: инвентарь, сундуки, рюкзаки, Wardrobe, Accessory Bag и мешки (общий источник — lib/owned.js). */
export function ownedCount(inv, id) {
  return inv && id ? ownedCountAll(inv, id) : 0;
}

/**
 * Чистая функция: план покупок с правками игрока.
 * @param {Array} plan — advisor purchasePlan: [{ stepId, title, cost }]
 * @param {Object} cart — normCart()
 * @param {{ price:(id)=>number, name:(id)=>string, inv?:Object, liquid?:number, perHour?:number, now?:number }} o
 * @returns {{ rows: Array, skipped: Array, bought: Array, total: number, liquid: number, cart: Object, changed: boolean }}
 *   rows — что купить по порядку: шаги плана, потом свои вещи; у каждой cost, cumulative, affordableNow, hoursOfFarming.
 */
export function buildCart(plan = [], cart = {}, o = {}) {
  const now = o.now ?? Date.now();
  const liquid = Math.max(0, o.liquid || 0);
  const perHour = o.perHour || 0;
  let changed = false;
  const c = normCart(cart);
  // Убранные шаги: как скрытые шаги плана — забываются, если шага нет в плане дольше суток
  if (plan.length) {
    const r = pruneHidden(c.skip, plan.map(p => p.stepId), now);
    if (r.changed) { c.skip = r.hidden; changed = true; }
  }
  const out = [], skipped = [], bought = [];
  for (const p of plan) {
    if (c.skip[p.stepId]) skipped.push({ kind: 'step', stepId: p.stepId, title: p.title, cost: p.cost });
    else out.push({ kind: 'step', stepId: p.stepId, title: p.title, cost: p.cost });
  }
  for (const [id, v] of Object.entries(c.custom)) {
    const have = ownedCount(o.inv, id);
    const row = { kind: 'item', id, name: o.name?.(id) || id, qty: v.qty, have: Math.min(have, v.qty) };
    if (o.inv && have >= v.qty) {
      // Куплено: из итога сразу, из списка — через сутки
      if (!v.done) { c.custom[id] = { ...v, done: now }; changed = true; }
      else if (now - v.done > DONE_MS) { delete c.custom[id]; changed = true; continue; }
      bought.push(row);
      continue;
    }
    if (v.done) { c.custom[id] = { qty: v.qty, at: v.at }; changed = true; }
    const unit = o.price?.(id) || 0;
    out.push({ ...row, unit, cost: unit * (v.qty - row.have) });
  }
  let acc = 0;
  const rows = out.map(r => {
    acc += r.cost || 0;
    return {
      ...r, cumulative: acc,
      affordableNow: acc <= liquid,
      hoursOfFarming: perHour ? Math.max(0, (acc - liquid) / perHour) : null,
    };
  });
  return { rows, skipped, bought, total: acc, liquid, cart: c, changed };
}

/** Правка списка: { skip: stepId, value } — убрать/вернуть шаг; { add: itemId, qty } — своя вещь; { remove: itemId }. */
export function applyCartOp(cart, op = {}, now = Date.now()) {
  const c = normCart(cart);
  if (op.skip != null) {
    const id = String(op.skip);
    if (!STEP_ID.test(id)) throw new Error('Неверный id шага');
    if (op.value) c.skip[id] = { at: now }; else delete c.skip[id];
  } else if (op.add != null) {
    const id = String(op.add);
    if (!ITEM_ID.test(id)) throw new Error('Неверный id предмета');
    if (!c.custom[id] && Object.keys(c.custom).length >= MAX_CUSTOM) throw new Error(`В списке уже ${MAX_CUSTOM} своих вещей`);
    c.custom[id] = { qty: qtyOf(op.qty ?? c.custom[id]?.qty), at: c.custom[id]?.at || now };
  } else if (op.remove != null) {
    delete c.custom[String(op.remove)];
  } else throw new Error('Не понятно, что изменить');
  return c;
}

/** Список профиля с сервера. */
export function getCart(key) {
  if (!key) return normCart();
  return normCart(load().byKey[key]);
}

/** Сохранить список профиля (после applyCartOp или уборки в buildCart). */
export function setCart(key, cart) {
  if (!key) throw new Error('Профиль ещё не загружен');
  const d = load();
  const c = normCart(cart);
  if (Object.keys(c.skip).length + Object.keys(c.custom).length) d.byKey[key] = c; else delete d.byKey[key];
  save();
  return c;
}

/** Для тестов: сбросить кэш (файл перечитается). */
export function _resetCart() { cache = null; }
