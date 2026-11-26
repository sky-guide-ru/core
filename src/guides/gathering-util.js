// Общие помощники гайдов по добыче, Garden, Foraging и миньонам.
import { getItemRu } from '../items-ru/index.js';
import { tx, messageOf, remember } from '../../i18n/msg.js';

export const M = 1_000_000;

export const fmt = n => Math.round(Number(n) || 0).toLocaleString('ru-RU');

/** 1 234 567 → «1,2 млн», 12 345 → «12,3 тыс.» */
export function short(n) {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e9) return tx`${(v / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млрд`;
  if (a >= 1e6) return tx`${(v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
  if (a >= 1e4) return tx`${(v / 1e3).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс.`;
  return fmt(v);
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Есть ли у игрока предмет (инвентарь, гардероб, сундуки, рюкзаки, экипировка в наборах). */
export function hasItem(ctx, id) {
  if (ctx.has(id)) return true;
  const inv = ctx.m?.inv || {};
  for (const k of ['wardrobeEquipment', 'backpackItems', 'sacksBag', 'equipment']) {
    for (const it of inv[k] || []) if (it?.id === id) return true;
  }
  return false;
}

/** Есть ли питомец этого типа; возвращает лучшего (по редкости и уровню) или null. */
export function bestPet(ctx, type) {
  const list = (ctx.m?.pets || []).filter(p => p.type === type);
  if (!list.length) return null;
  const T = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
  return list.sort((a, b) => T.indexOf(b.tier) - T.indexOf(a.tier) || (b.level || 0) - (a.level || 0) || b.exp - a.exp)[0];
}

/**
 * Лестница улучшений: самый высокий предмет, который уже есть, и следующий.
 * @param {string[]} ladder id по возрастанию
 */
export function ladderPos(ctx, ladder) {
  let best = -1;
  ladder.forEach((id, i) => { if (hasItem(ctx, id)) best = i; });
  return { best, have: best >= 0 ? ladder[best] : null, next: best + 1 < ladder.length ? ladder[best + 1] : null };
}

// В базе предметов скилл называется «Foraging»; в гайдах пишем Foraging, как в игре.
const fixRu = s => String(s || '').replace(/«Foraging»/g, 'Foraging').replace(/Foraging/g, 'Foraging');

/** Как получить предмет: текст из русской базы NEU + требования + оценка стоимости по рынку. */
export function howToGet(ctx, id) {
  let r = null;
  try { r = getItemRu(id); } catch { r = null; }
  const ways = (r?.whereToGet || []).map(w => fixRu(w.textRu)).filter(Boolean);
  const req = (r?.requirementsRu || []).map(fixRu);
  let cost = 0;
  const w0 = r?.whereToGet?.[0];
  if (w0?.cost?.length && w0.kind !== 'npc') {
    for (const c of w0.cost) cost += c.id === 'SKYBLOCK_COIN' ? c.count : ctx.price(c.id) * (c.count || 1);
  }
  const market = ctx.price(id);
  return { name: r?.nameEn || ctx.name(id), ways, req, craftCost: cost, market, wiki: r?.wikiUrl || null };
}

/** Строка «как получить» одной строкой для шага. */
export function howText(ctx, id) {
  const h = howToGet(ctx, id);
  const parts = [];
  if (h.ways[0]) parts.push(h.ways[0]);
  if (h.req.length) parts.push(h.req.join(' ').replace(/\.$/, ''));
  const price = h.market || h.craftCost;
  if (price) parts.push(tx`${h.market ? 'На рынке' : 'Ингредиенты'} ~${short(price)} монет`);
  // части уже могут кончаться точкой («…DR-X655.»), поэтому склеиваем без двойных точек
  return parts.map(p => String(p).trim().replace(/[.。]+$/, '')).filter(Boolean).join('. ') || 'Подробности в карточке предмета.';
}

/** Константы NEU (hotmlayout, hotflayout, garden, misc), если ядро их передало. */
export const constants = ctx => ctx.adv?.opts?.constants || {};

export const cell = (text, extra = {}) => ({ text: String(text), ...extra });
export const tone = (ok, warn = false) => (ok ? 'good' : warn ? 'warn' : 'bad');

// «257,7 тыс.. Начни» → «257,7 тыс. Начни». Исправленной строке передаём ключ исходной, иначе английская версия её не найдёт
function tidyDots(s) {
  const c = s.replace(/\.\.(?!\.)/g, '.').replace(/\s+\./g, '.');
  if (c !== s) { const m = messageOf(s); if (m) remember(c, m); }
  return c;
}

/** Сортирует шаги по priority и обрезает до n. */
export const topNext = (list, n = 8) => list.filter(Boolean)
  .map(x => ({ ...x, why: tidyDots(String(x.why || '')) }))
  .sort((a, b) => b.priority - a.priority).slice(0, n);

/** Первая буква строчная, если строка начинается с русского слова (для «Имя: описание» внутри фразы). */
export const lc = s => (/^[А-ЯЁ][а-яё]/.test(String(s)) ? s[0].toLowerCase() + s.slice(1) : String(s));
