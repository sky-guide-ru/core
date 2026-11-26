// Помощники боевых гайдов: форматирование, ячейки с предметами, стоимость крафта, оценки заработка.
import { fmtCoins, plural } from '../../../i18n/ru.js';
import { tx } from '../../../i18n/msg.js';

export { fmtCoins, plural };
export const num = n => Math.round(n || 0).toLocaleString('ru-RU');

/** Ячейка таблицы с иконкой предмета и ценой (если известна). */
export function itemCell(ctx, id, extra = '') {
  return { text: tx`${ctx.name(id)}${extra}`, item: id };
}

export function priceText(ctx, id, count = 1) {
  const p = ctx.price(id);
  return p > 0 ? fmtCoins(p * count) : '—';
}

/** Сколько стоит собрать рецепт по рыночным ценам; что уже есть у игрока, не считаем. */
export function craftCost(ctx, recipe) {
  let total = 0;
  const unknown = [];
  for (const [id, n] of Object.entries(recipe || {})) {
    if (ctx.has(id) && n === 1) continue;
    const p = ctx.price(id);
    if (p > 0) total += p * n; else unknown.push(id);
  }
  return { total, unknown };
}

/** Метод заработка из модуля цен (analysis.methods) по id. */
export function method(ctx, id) {
  return (ctx.analysis?.methods || []).find(x => x.id === id) || null;
}

export function methodText(mt) {
  if (!mt?.coinsPerHour) return null;
  const r = mt.coinsPerHourRange;
  const v = r ? tx`${fmtCoins(r[0])}–${fmtCoins(r[1])}` : fmtCoins(mt.coinsPerHour);
  return tx`${mt.title}: ~${v} в час (${mt.sourceText || 'оценка'})${mt.available ? '' : tx`. Пока не открыто: ${(mt.missing || []).join(', ')}`}`;
}

export const sortNext = next => next.filter(Boolean).sort((a, b) => b.priority - a.priority).slice(0, 6);

/** Сколько частей сета (HELMET/CHESTPLATE/LEGGINGS/BOOTS) есть у игрока. */
export function pieces(ctx, base) {
  return ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].filter(s => ctx.has(`${base}_${s}`)).length;
}
export function setPrice(ctx, base) {
  return ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].reduce((s, p) => s + (ctx.has(`${base}_${p}`) ? 0 : ctx.price(tx`${base}_${p}`)), 0);
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const BOOK_RE = /^((?:ULTIMATE_)?[A-Z_]+);(\d{1,2})$/;
const isBook = id => /^(SMITE|BANE_OF_ARTHROPODS|CRITICAL|SMOLDERING|MANA_STEAL|SMARTY_PANTS|ULTIMATE_[A-Z_]+);\d+$/.test(id);
const title = s => s.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

/** Человеческое имя: книги («Книга Smite VI»), питомцы без «[Lvl {LVL}]». */
export function nice(ctx, id) {
  if (isBook(id)) {
    const [, e, l] = BOOK_RE.exec(id);
    return tx`Книга ${title(e.replace(/^ULTIMATE_/, ''))} ${ROMAN[l] || l}`;
  }
  return String(ctx.name(id) || id).replace(/^\[Lvl \{LVL\}\]\s*/, '');
}
/** Цена с учётом формата Bazaar для книг (ENCHANTMENT_SMITE_6). */
export function priceOfDrop(ctx, id) {
  if (isBook(id)) { const [, e, l] = BOOK_RE.exec(id); return ctx.price(tx`ENCHANTMENT_${e}_${l}`); }
  return ctx.price(id);
}
