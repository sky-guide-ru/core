// Доход от фарма культур в Garden с учётом Farming Fortune и лучшего способа продажи
import { DEFAULT_BAZAAR_TAX, extractRecipes, marketId, nameOf } from './util.js';
import { sellValue } from './flips.js';

/** Базовый дроп с одного сломанного блока без Farming Fortune */
export const CROP_DATA = [
  { id: 'WHEAT', drops: 1, ru: 'Пшеница', key: 'wheat' },
  { id: 'CARROT_ITEM', drops: 3, ru: 'Морковь', key: 'carrot' },
  { id: 'POTATO_ITEM', drops: 3, ru: 'Картофель', key: 'potato' },
  { id: 'PUMPKIN', drops: 1, ru: 'Тыква', key: 'pumpkin' },
  { id: 'MELON', drops: 5, ru: 'Арбуз', key: 'melon' },
  { id: 'SUGAR_CANE', drops: 2, ru: 'Сахарный тростник', key: 'sugar_cane' },
  { id: 'CACTUS', drops: 2, ru: 'Кактус', key: 'cactus' },
  { id: 'INK_SACK:3', drops: 3, ru: 'Какао-бобы', key: 'cocoa_beans' },
  { id: 'NETHER_STALK', drops: 2.5, ru: 'Незерский нарост', key: 'nether_wart' },
  { id: 'RED_MUSHROOM', drops: 1, ru: 'Грибы', key: 'mushroom' },
  { id: 'DOUBLE_PLANT', drops: 1, ru: 'Подсолнух', key: 'sunflower' },
  { id: 'MOONFLOWER', drops: 1, ru: 'Лунный цветок', key: 'moonflower' },
  { id: 'WILD_ROSE', drops: 1, ru: 'Дикая роза', key: 'wild_rose' },
];

// Запасная таблица сжатий, если база NEU ещё не загружена: форма -> сколько сырья в одной штуке
const FALLBACK_FORMS = {
  WHEAT: [['ENCHANTED_WHEAT', 160], ['ENCHANTED_HAY_BALE', 25600]],
  CARROT_ITEM: [['ENCHANTED_CARROT', 160], ['ENCHANTED_GOLDEN_CARROT', 20480]],
  POTATO_ITEM: [['ENCHANTED_POTATO', 160], ['ENCHANTED_BAKED_POTATO', 25600]],
  PUMPKIN: [['ENCHANTED_PUMPKIN', 160], ['POLISHED_PUMPKIN', 25600]],
  MELON: [['ENCHANTED_MELON', 160], ['ENCHANTED_MELON_BLOCK', 25600]],
  SUGAR_CANE: [['ENCHANTED_SUGAR', 160], ['ENCHANTED_SUGAR_CANE', 25600]],
  'INK_SACK:3': [['ENCHANTED_COCOA', 160]],
  NETHER_STALK: [['ENCHANTED_NETHER_STALK', 160], ['MUTANT_NETHER_STALK', 25600]],
  RED_MUSHROOM: [['ENCHANTED_RED_MUSHROOM', 160]],
};

const formsCache = new WeakMap();

/** Индекс «сжатых» форм по рецептам NEU: сырьё -> [[форма, сколько сырья в штуке]] (до 2 уровней) */
export function compressionForms(items) {
  if (!items) return FALLBACK_FORMS;
  if (formsCache.has(items)) return formsCache.get(items);
  const direct = new Map(); // id -> [[out, ratio]]
  for (const item of items.values()) {
    for (const r of extractRecipes(item)) {
      if (r.type !== 'craft') continue;
      const keys = Object.keys(r.inputs);
      if (keys.length !== 1) continue;
      const src = marketId(keys[0], items);
      const ratio = r.inputs[keys[0]] / r.count;
      if (ratio < 2) continue;
      if (!direct.has(src)) direct.set(src, []);
      direct.get(src).push([marketId(r.output, items), ratio]);
    }
  }
  const res = {};
  for (const c of CROP_DATA) {
    const list = [];
    for (const [f1, r1] of direct.get(c.id) || []) {
      list.push([f1, r1]);
      for (const [f2, r2] of direct.get(f1) || []) list.push([f2, r1 * r2]);
    }
    res[c.id] = list.length ? list : FALLBACK_FORMS[c.id] || [];
  }
  formsCache.set(items, res);
  return res;
}

/**
 * Лучшая цена одной единицы сырья: NPC, Bazaar сырьём или в сжатом виде.
 * @param {import('./flips.js').MarketCtx} ctx
 * @param {string} id
 * @param {{ sellMode?: 'instant'|'offer', unitsPerHour?: number }} [opts] unitsPerHour — сколько сырья в час нужно сбыть (для проверки объёма)
 */
export function rawValue(ctx, id, { sellMode = 'instant', unitsPerHour = 0 } = {}) {
  const tax = ctx.tax ?? DEFAULT_BAZAAR_TAX;
  const options = [];
  const npc = ctx.npc?.get(id);
  if (npc) options.push({ unit: npc, market: 'NPC', sellAs: id });
  const forms = compressionForms(ctx.items)[id] || [];
  for (const [fid, ratio] of [[id, 1], ...forms]) {
    const s = ctx.bazaar.has(fid) ? sellValue({ ...ctx, tax }, fid, sellMode) : null;
    if (!s?.net) continue;
    // если за час нужно продать больше половины часового оборота — рынок не потянет, такой вариант понижаем
    const formPerHour = unitsPerHour / ratio;
    // нет данных об объёме — тоже считаем, что рынок не потянет (тонкий рынок с одиночным ордером)
    const tooBig = unitsPerHour > 0 && (!(s.volumeDay > 0) || formPerHour > s.volumeDay / 24 * 0.5);
    options.push({ unit: s.net / ratio, market: 'Bazaar', sellAs: fid, ratio, volumeDay: Math.round(s.volumeDay), tooBig });
    const fnpc = ctx.npc?.get(fid);
    if (fnpc && fid !== id) options.push({ unit: fnpc / ratio, market: 'NPC', sellAs: fid, ratio });
  }
  if (!options.length) return { unit: 0, market: '—', sellAs: id };
  // !! обязателен: у вариантов NPC нет tooBig, а undefined - true = NaN ломает сортировку
  // (так «продажа Melon Block» по одиночному ордеру 81 монета давала 42 млн/ч вместо ~2 млн/ч)
  options.sort((a, b) => (Number(!!a.tooBig) - Number(!!b.tooBig)) || b.unit - a.unit);
  return options[0];
}

/**
 * Доход в час по каждой культуре.
 * @param {import('./flips.js').MarketCtx} ctx
 * @param {number | Record<string, number>} fortune общий Farming Fortune или по культурам (ключ — id или key из CROP_DATA)
 * @param {{ bps?: number, sellMode?: 'instant'|'offer', uptime?: number }} [opts]
 *   bps — блоков в секунду (максимум 20), uptime — доля времени реально в фарме (повороты, Pests)
 */
export function cropProfits(ctx, fortune = 1500, opts = {}) {
  const { bps = 19.5, sellMode = 'instant', uptime = 0.9 } = typeof opts === 'number' ? { bps: opts } : opts;
  return CROP_DATA.map(c => {
    const ff = typeof fortune === 'number' ? fortune : (fortune[c.id] ?? fortune[c.key] ?? fortune.default ?? 1500);
    const blocks = bps * 3600 * uptime;
    const items = blocks * c.drops * (1 + ff / 100);
    const v = rawValue(ctx, c.id, { sellMode, unitsPerHour: items });
    return {
      id: c.id, name: c.ru, fortune: ff, items: Math.round(items), unit: v.unit, perHour: items * v.unit,
      market: v.market, sellAs: v.sellAs, sellAsName: nameOf(ctx, v.sellAs),
      volumeWarning: v.tooBig ? 'Объём рынка мал для такого количества, цена может просесть.' : null,
    };
  }).sort((a, b) => b.perHour - a.perHour);
}
