import { tx, both } from '../../i18n/msg.js';
// Общие константы и помощники модуля цен (чистые функции, без состояния)

/** Налог Bazaar на продажу. 1.25% базово; 1.125% / 1% с апгрейдом Bazaar Flipper в Community Shop. */
export const DEFAULT_BAZAAR_TAX = 0.01125;

/**
 * Сколько получит продавец с аукциона после комиссий.
 * Листинг: 1% (< 10 млн), 2% (10–100 млн), 2.5% (≥ 100 млн). Налог при получении монет: 1% для сумм > 1 млн.
 * @param {number} price цена продажи
 * @returns {number}
 */
export function ahNet(price) {
  if (!price) return 0;
  const listing = price >= 100_000_000 ? 0.025 : price >= 10_000_000 ? 0.02 : 0.01;
  const claim = price > 1_000_000 ? 0.01 : 0;
  return price * (1 - listing - claim);
}

/**
 * Название предмета для списков рынка. В контексте ядра есть ctx.name (русское из items-ru, см. server/names.js);
 * без него — имя из NEU, а в крайнем случае ID.
 * @param {{ name?: (id: string) => string, items?: Map<string, {name?: string}> }} ctx
 * @param {string} id
 */
export function nameOf(ctx, id) {
  const n = ctx?.name?.(id) || ctx?.items?.get(id)?.name || ctx?.items?.get(String(id).replace(/:(\d+)$/, '-$1'))?.name || id;
  return String(n).replace(/§./g, '').trim();
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/** "SUGAR_CANE:32" -> { id: 'SUGAR_CANE', n: 32 }; "INK_SACK-3:16" -> { id: 'INK_SACK-3', n: 16 } (формат NEU) */
export function parseIngredient(s) {
  const str = String(s);
  const i = str.lastIndexOf(':');
  if (i > 0 && /^\d+(\.\d+)?$/.test(str.slice(i + 1))) return { id: str.slice(0, i), n: Number(str.slice(i + 1)) };
  return { id: str, n: 1 };
}

/**
 * Перевод id из формата NEU в формат рынка (Bazaar/аукцион/контракт):
 * "INK_SACK-3" -> "INK_SACK:3", книга "ULTIMATE_LEGION;1" -> "ENCHANTMENT_ULTIMATE_LEGION_1".
 * @param {string} id
 * @param {Map<string, any>} [items] база NEU, чтобы отличить книгу от питомца (оба вида "X;N")
 */
export function marketId(id, items) {
  if (!id) return id;
  if (/-\d+$/.test(id)) return id.replace(/-(\d+)$/, ':$1');
  const m = id.match(/^([A-Z0-9_]+);(\d+)$/);
  if (m && items?.get(id)?.mcId === 'minecraft:enchanted_book') return tx`ENCHANTMENT_${m[1]}_${m[2]}`;
  return id;
}

const SLOTS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

/**
 * Достаёт все рецепты предмета NEU в едином виде.
 * @param {{ id: string, recipe?: object, recipes?: object[] }} item
 * @returns {{ type: 'craft'|'forge', inputs: Record<string, number>, count: number, duration?: number, output: string }[]}
 */
// Рецепты зависят только от предмета NEU, а спрашивают их на каждом пересчёте заработка (~9000 предметов,
// ~0,2 с на каждый разбор профиля). Запоминаем на объект предмета; результат заморожен — его только читают
const recipesMemo = new WeakMap();
export function extractRecipes(item) {
  if (!item || typeof item !== 'object') return [];
  let r = recipesMemo.get(item);
  if (!r) {
    r = Object.freeze(extractRecipesRaw(item).map(x => Object.freeze({ ...x, inputs: Object.freeze(x.inputs) })));
    recipesMemo.set(item, r);
  }
  return r;
}
function extractRecipesRaw(item) {
  const out = [];
  const add = (r, fallbackType) => {
    if (!r || typeof r !== 'object') return;
    const type = r.type || fallbackType;
    const inputs = {};
    if (type === 'forge') {
      for (const s of r.inputs || []) {
        const { id, n } = parseIngredient(s);
        inputs[id] = (inputs[id] || 0) + n;
      }
      if (!Object.keys(inputs).length) return;
      out.push({ type: 'forge', inputs, count: Number(r.count || 1), duration: Number(r.duration || 0), output: r.overrideOutputId || item.id });
      return;
    }
    if (type !== 'crafting' && type !== 'craft' && type !== undefined) return; // npc_shop, drops, trade и т.п. здесь не нужны
    let any = false;
    for (const k of SLOTS) {
      if (!r[k]) continue;
      const { id, n } = parseIngredient(r[k]);
      inputs[id] = (inputs[id] || 0) + n;
      any = true;
    }
    if (!any) return;
    out.push({ type: 'craft', inputs, count: Number(r.count || item.craftCount || 1), output: r.overrideOutputId || item.id });
  };
  add(item.recipe, 'crafting');
  for (const r of item.recipes || []) add(r, r?.type || 'crafting');
  return out;
}

/** "Requires: Sugar Cane IV" -> "Требуется: Sugar Cane IV" */
export function crafttextRu(t) {
  if (!t) return '';
  return both(String(t).replace(/^Requires:?\s*/i, 'Требуется: '), String(t)); // на английской версии — строка из игры
}

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
