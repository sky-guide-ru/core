// Общие помощники модуля advisor: цены, форматирование, предметы игрока, уровни питомцев.
import NEU_MIN from '../data/neu-min.json' with { type: 'json' };
import { englishName } from '../../names.js';
import { combatSnapshot, neuForCalc } from '../../calc/power.js';
import { buildKit } from '../../calc/kit.js';
import { tx } from '../../../i18n/msg.js';

/**
 * @typedef {Object} AdvisorOptions
 * @property {(id: string) => number} [price]  Цена предмета в монетах (по умолчанию 0 — без цен). Ядро передаёт priceOf.
 * @property {(id: string) => (string|null|undefined)} [itemName]  Имя предмета по id (из neu.items).
 * @property {Object} [constants]  neu.constants (leveling, pets, misc, fairy_souls). Если нет — берутся встроенные копии.
 * @property {Array<Object>} [moneyMethods]  Результат moneyMethods(member) из модуля prices.
 * @property {Object<string, number[]>} [collectionTiers]  id коллекции → пороги тиров (из /v2/resources/skyblock/collections).
 * @property {number} [now]  Метка времени (для тестов).
 */

/** Собирает контекст с безопасными значениями по умолчанию. */
export function makeCtx(member, acc, gear, opts = {}) {
  const c = opts.constants || {};
  const data = {
    petLevels: c.pets?.pet_levels || NEU_MIN.petLevels,
    petRarityOffset: c.pets?.pet_rarity_offset || NEU_MIN.petRarityOffset,
    petTypes: c.pets?.pet_types || NEU_MIN.petTypes,
    slayerXp: c.leveling?.slayer_xp || NEU_MIN.slayerXp,
    slayerBossXp: c.leveling?.slayer_boss_xp || NEU_MIN.slayerBossXp,
    slayerBossXpType: c.leveling?.slayer_boss_xp_type || NEU_MIN.slayerBossXpType,
    slayerHighestTier: c.leveling?.slayer_to_highest_tier || NEU_MIN.slayerHighestTier,
    hotf: c.leveling?.HOTF || NEU_MIN.hotf,
    minionMaxTier: c.misc?.minions || NEU_MIN.minionMaxTier,
    fairySoulsMax: c.fairy_souls?.['Max Souls'] || NEU_MIN.fairySoulsMax,
  };
  const rawPrice = typeof opts.price === 'function' ? opts.price : null;
  const price = id => {
    if (!rawPrice || !id) return 0;
    try { const v = Number(rawPrice(id)); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
  };
  const owned = collectOwned(member);
  const liquid = (member.purse || 0) + (member.bank || 0) + (member.personalBank || 0);
  // Боевая сводка по движку расчёта (лист статов, удар, EHP). Сломалась — план работает и без неё
  let power = null;
  try { power = combatSnapshot(member, c); } catch { power = null; }
  // Всё, из чего игрок собирает боевой набор (Wardrobe, снаряжение, питомцы, оружие) — считается один раз, по требованию
  let kit;
  const getKit = () => {
    if (kit === undefined) { try { kit = buildKit(member, neuForCalc(c)); } catch { kit = null; } }
    return kit;
  };
  return {
    power,
    kit: getKit,
    mayorPerks: Array.isArray(opts.mayorPerks) ? opts.mayorPerks : [],
    m: member,
    acc: acc || null,
    gear: gear || null,
    opts,
    data,
    price,
    hasPrices: !!rawPrice,
    // Питомцы в NEU называются «[Lvl {LVL}] Megalodon»: шаблон уровня не показываем, где бы ни взялось имя
    name: id => String((opts.itemName && opts.itemName(id)) || englishName(id)).replace(/§./g, '').replace(/^\[Lvl \{LVL\}\]\s*/, ''),
    owned,
    liquid,
  };
}

/** HYPERION → Hyperion, ENDER_DRAGON;4 → Ender Dragon */
export function prettyId(id) {
  if (!id) return '';
  return String(id).split(';')[0].toLowerCase().split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
}

/** Монеты по-русски: 1,2 млн, 3,4 млрд. */
export function fmtCoins(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const a = Math.abs(n);
  const f = (v, u) => tx`${(n / v).toLocaleString('ru-RU', { maximumFractionDigits: v >= 1e6 ? 2 : 1 })} ${u}`;
  if (a >= 1e9) return f(1e9, 'млрд');
  if (a >= 1e6) return f(1e6, 'млн');
  if (a >= 1e3) return f(1e3, 'тыс.');
  return Math.round(n).toLocaleString('ru-RU');
}

export const fmtNum = n => Math.round(n || 0).toLocaleString('ru-RU');

/** Склонение: plural(5, 'раз', 'раза', 'раз'). */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Цена с подписью или пустая строка, если цены нет. */
export function priceTag(ctx, id, count = 1) {
  const p = ctx.price(id);
  return p ? tx`~${fmtCoins(p * count)}` : '';
}

const STORAGE = [
  ['inventory', 'Инвентарь'], ['armor', 'Надето'], ['equipment', 'Экипировка'], ['wardrobe', 'Wardrobe'],
  ['enderChest', 'Ender Chest'], ['vault', 'Personal Vault'], ['quiver', 'Quiver'], ['talismans', 'Accessory Bag'],
];

/**
 * Все предметы игрока по id.
 * @returns {Map<string, Array<Object>>}
 */
export function collectOwned(m) {
  const map = new Map();
  const inv = m?.inv || {};
  const push = (it, where) => {
    if (!it?.id) return;
    const arr = map.get(it.id) || [];
    arr.push({ ...it, where });
    map.set(it.id, arr);
  };
  for (const [k, where] of STORAGE) for (const it of inv[k] || []) push(it, where);
  for (const [k, list] of Object.entries(inv.backpacks || {})) for (const it of list || []) push(it, tx`Backpack ${Number(k) + 1}`);
  return map;
}

export const hasItem = (ctx, id) => ctx.owned.has(id);

/** Сколько частей сета брони есть у игрока (максимум по каждому слоту). */
export function setPieces(ctx, base) {
  return ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].filter(s => ctx.owned.has(`${base}_${s}`)).length;
}

const PET_TIER_INDEX = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5 };
export const petTierIndex = t => PET_TIER_INDEX[t] ?? -1;
export const PET_TIER_RU = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

/** Уровень питомца по опыту (таблица NEU, максимум 100; Golden Dragon считается до 100 для простоты). */
export function petLevel(ctx, pet) {
  const offset = ctx.data.petRarityOffset[pet.tier] ?? 0;
  const table = ctx.data.petLevels.slice(offset, offset + 99);
  let lvl = 1, xp = pet.exp || 0;
  for (const need of table) {
    if (xp < need) break;
    xp -= need;
    lvl++;
  }
  return Math.min(lvl, 100);
}

/** Лучший экземпляр питомца каждого типа. */
export function bestPets(ctx) {
  const best = new Map();
  for (const p of ctx.m.pets || []) {
    const cur = best.get(p.type);
    if (!cur || petTierIndex(p.tier) > petTierIndex(cur.tier) || (p.tier === cur.tier && p.exp > cur.exp)) best.set(p.type, p);
  }
  return best;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
