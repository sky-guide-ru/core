// Свечи аукциона (Auction House) для графиков «Рынка». Тот же формат из 11 чисел, что у Bazaar (candles.js),
// но смысл полей свой:
//   [t, bo, bh, bl, bc, so, sh, sl, sc, 0, n]
//   bo..bc — lowest BIN за свечу (по сканам аукциона раз в 3 минуты): за сколько можно купить сразу;
//   so..sc — цены настоящих продаж за свечу (auctions_ended); 0 — продаж в эту свечу не было;
//   n      — сколько штук продано за свечу (стак из 64 — 64 штуки; настоящее число, а не оценка, как у Bazaar).
// Перед выдачей пустые места заполняются (ahFill): у свечи без продаж цена продаж = прошлая продажа,
// без лотов — прошлый lowest BIN. Поэтому графику не нужно знать про нули.
import { bridgeFlat, cleanSpikes } from './candles.js';

const DAY = 86400;
// Храним всё 30 дней (просьба владельца), дневные свечи — всегда: это ~16 КБ на предмет в год
export const AH_BASES = {
  '5m': { sec: 300, keep: 30 * DAY },
  '1h': { sec: 3600, keep: 30 * DAY },
  '1d': { sec: DAY, keep: Infinity },
};

/** Новая свеча. bin/sale — цена за штуку или 0, qty — штук в проданном лоте. */
export function ahOpen(t, bin = 0, sale = 0, qty = 1) {
  return [t, bin, bin, bin, bin, sale, sale, sale, sale, 0, sale > 0 ? qty : 0];
}

/** Скан аукциона: lowest BIN в открытую свечу. */
export function ahAddBin(c, p) {
  if (!(p > 0)) return c;
  if (!(c[1] > 0)) { c[1] = c[2] = c[3] = c[4] = p; return c; }
  if (p > c[2]) c[2] = p;
  if (p < c[3]) c[3] = p;
  c[4] = p;
  return c;
}

/** Настоящая продажа в открытую свечу: p — цена за штуку, qty — штук в лоте. */
export function ahAddSale(c, p, qty = 1) {
  if (!(p > 0)) return c;
  if (!(c[10] > 0)) { c[5] = c[6] = c[7] = c[8] = p; c[10] = qty; return c; }
  if (p > c[6]) c[6] = p;
  if (p < c[7]) c[7] = p;
  c[8] = p;
  c[10] += qty;
  return c;
}

/** Слить более позднюю свечу b в a (на месте): пустые части (нули) не портят минимум. */
export function ahMerge(a, b) {
  if (b[1] > 0) {
    if (!(a[1] > 0)) { a[1] = b[1]; a[2] = b[2]; a[3] = b[3]; a[4] = b[4]; }
    else { if (b[2] > a[2]) a[2] = b[2]; if (b[3] < a[3]) a[3] = b[3]; a[4] = b[4]; }
  }
  if (b[10] > 0) {
    if (!(a[10] > 0)) { a[5] = b[5]; a[6] = b[6]; a[7] = b[7]; a[8] = b[8]; }
    else { if (b[6] > a[6]) a[6] = b[6]; if (b[7] < a[7]) a[7] = b[7]; a[8] = b[8]; }
    a[10] += b[10];
  }
  return a;
}

/**
 * Заполнить пустые места, чтобы обе линии шли непрерывно. Меняет копию.
 * Нет лотов → прошлый lowest BIN (а в самом начале — цена продажи); нет продаж → прошлая продажа (в начале — BIN).
 */
export function ahFill(list) {
  const out = [];
  let bin = 0, sale = 0;
  for (const src of list) {
    const c = src.slice();
    if (!(c[1] > 0)) { const v = bin || (c[10] > 0 ? c[8] : 0); c[1] = c[2] = c[3] = c[4] = v; }
    if (!(c[10] > 0)) { const v = sale || c[4]; c[5] = c[6] = c[7] = c[8] = v; }
    if (c[4] > 0) bin = c[4];
    if (c[10] > 0) sale = c[8];
    if (c[1] > 0 || c[5] > 0) out.push(c);
  }
  return out;
}

/** Обработка перед выдачей: заполнить пустое, убрать иголки, открыть плоские свечи по прошлому закрытию. */
export const ahClean = list => bridgeFlat(cleanSpikes(ahFill(list)));
