// «Что продать»: вещи из инвентаря, рюкзаков, Ender Chest и мешков, которые игроку выгоднее продать, — где
// (Bazaar, аукцион или торговец), каким способом и за сколько после налога. Ironman, Stranded и Bingo продают только NPC.
// Не советуем продавать то, что нужно для шагов плана и «Плана покупок», и единственную копию снаряжения.
// Чистая функция: цены и словари приходят в o, без express и без глобальных цен.
import { isGuiItem } from '../lib/gui-items.js';
import { canSellCopy } from '../lib/item-props.js';
import { neuId, marketId, recipeParts } from './index.js';
import { ru } from '../../i18n/msg.js';

/** Налог Bazaar на продажу (без перков Community Shop) */
export const BAZAAR_TAX = 0.0125;
/** Меньше этой суммы за всю позицию — мелочь, в список не берём */
export const SELL_MIN = 50_000;
const LIMIT = 80;
// AH «быстро»: BIN на 2% ниже самого дешёвого, чтобы купили первым
const UNDERCUT = 0.98;

/** Сколько игрок получит с лота AH ценой p: сбор за выставление BIN 1% / 2% / 2,5% и 1% при получении монет выше 1 млн */
export function ahNet(p) {
  if (!(p > 0)) return 0;
  const fee = p < 10_000_000 ? 0.01 : p < 100_000_000 ? 0.02 : 0.025;
  const claim = p > 1_000_000 ? 0.01 : 0;
  return p * (1 - fee - claim);
}

// Снаряжение: продаём только лишние копии (одна остаётся у игрока)
const GEAR = /\b(SWORD|LONGSWORD|BOW|WAND|DAGGER|STAFF|GAUNTLET|HELMET|CHESTPLATE|LEGGINGS|BOOTS|ACCESSORY|NECKLACE|CLOAK|BELT|GLOVES|BRACELET|PICKAXE|DRILL|AXE|HOE|SHOVEL|FISHING ROD|FISHING WEAPON|DEPLOYABLE|CHISEL)\b/;
const strip = s => String(s || '').replace(/§[0-9a-fk-or]/gi, '');
const isGear = it => GEAR.test(strip((it.lore || []).at(-1)));
// Upgrades повышают цену лота, но насколько — гадать не будем: такие вещи не советуем
const upgraded = it => it.recomb || (it.stars || 0) > 0 || (it.hpb || 0) > 0 || !!it.gems || Object.keys(it.enchants || {}).length > 0 && it.id !== 'ENCHANTED_BOOK';

// Книга с одним зачарованием торгуется на Bazaar как ENCHANTMENT_<ИМЯ>_<УРОВЕНЬ>
function tradeId(it) {
  if (it.id !== 'ENCHANTED_BOOK') return it.id;
  const e = Object.entries(it.enchants || {});
  return e.length === 1 ? `ENCHANTMENT_${String(e[0][0]).toUpperCase()}_${e[0][1]}` : null;
}

/** Места, которые смотрим: { key, n?, list } */
function places(inv) {
  const out = [{ key: 'inv', list: inv.inventory }, { key: 'ender', list: inv.enderChest }];
  for (const [k, v] of Object.entries(inv.backpacks || {})) out.push({ key: 'bp', n: Number(k) + 1, list: v });
  return out;
}
// Где ещё лежит снаряжение (надето, Wardrobe, Accessory Bag, Personal Vault) — копия «в деле», остальные можно продать
const KEEPERS = inv => [inv.armor, inv.equipment, inv.wardrobe, inv.wardrobeEquipment, inv.talismans, inv.vault];

/**
 * @param {Object} member  state.member (inv, mode)
 * @param {Object} o {
 *   bazaar(id) → { buy, sell, sellWeek } | null, bin(id) → { price, count } | null, sold(id) → { median, count24h } | null,
 *   npc(id) → цена NPC, name(id), props(id) → itemProps | null, items (NEU Map, для рецептов),
 *   roadmap: шаги плана [{ id, title, done, items }], cartIds: свои вещи «Плана покупок» }
 */
export function analyzeSell(member, o = {}) {
  const inv = member?.inv || {};
  const market = member?.mode?.market !== false;
  if (inv.apiDisabled) return { market, apiDisabled: true, items: [], keep: [], noNpc: [], totals: { now: 0, wait: 0 }, places: {} };

  // Что нужно для плана: предметы шагов, их рецепты (один уровень) и свои вещи «Плана покупок»
  const need = new Map(); // id → причина
  for (const s of o.roadmap || []) {
    if (s.done) continue;
    for (const id of s.items || []) {
      if (!need.has(id)) need.set(id, ru`нужно для шага плана «${s.title}»`);
      for (const p of recipeParts(o.items?.get?.(id))) if (!need.has(p.id)) need.set(p.id, ru`идёт в крафт ${o.name?.(id) || id} из плана`);
    }
  }
  for (const id of o.cartIds || []) if (!need.has(id)) need.set(id, ru`есть в «Плане покупок»`);

  // Сколько копий снаряжения уже «в деле»
  const busy = new Map();
  for (const list of KEEPERS(inv)) for (const it of list || []) if (it?.id) busy.set(it.id, (busy.get(it.id) || 0) + 1);

  // Собираем позиции: id → { count, where: [{ key, n, count }] }
  const acc = new Map();
  const add = (id, count, where, it) => {
    const a = acc.get(id) || { id, count: 0, where: [], gear: false, src: it };
    a.count += count;
    const w = a.where.find(x => x.key === where.key && x.n === where.n);
    if (w) w.count += count; else a.where.push({ ...where, count });
    acc.set(id, a);
  };
  for (const pl of places(inv)) {
    for (const it of pl.list || []) {
      if (!it?.id || isGuiItem(it) || it.pet || !canSellCopy(it)) continue; // сданное в Museum и Soulbound не продать
      const id = tradeId(it);
      if (!id) continue;
      if (isGear(it)) {
        if (upgraded(it)) continue;
        add(id, it.count || 1, { key: pl.key, n: pl.n }, it);
        acc.get(id).gear = true;
      } else add(id, it.count || 1, { key: pl.key, n: pl.n }, it);
    }
  }
  for (const [raw, count] of Object.entries(inv.sacks || {})) if (count > 0) add(neuId(raw), count, { key: 'sacks' });

  const items = [], keep = [], noNpc = [];
  for (const a of acc.values()) {
    let count = a.count;
    // Снаряжение: одна копия остаётся, если других нет «в деле»
    if (a.gear && !(busy.get(a.id) > 0)) count -= 1;
    if (count <= 0) continue;
    const mid = marketId(a.id);
    const props = o.props?.(a.id) || null;
    if (props && props.tradeable === false && !props.npc) continue;
    const bz = o.bazaar?.(mid) || o.bazaar?.(a.id) || null;
    const bin = bz ? null : o.bin?.(a.id) || null;
    const sold = bz ? null : o.sold?.(a.id) || null;
    const npc = props?.npc || o.npc?.(a.id) || o.npc?.(neuId(a.id)) || 0;
    const opts = [];
    if (market && bz) {
      if (bz.sell > 0) opts.push({ how: 'bazaar', way: 'instant', unit: bz.sell * (1 - BAZAAR_TAX) });
      if (bz.buy > 0) opts.push({ how: 'bazaar', way: 'offer', unit: bz.buy * (1 - BAZAAR_TAX) });
    }
    if (market && !bz && (bin?.price || sold?.median) && props?.auctionable !== false) {
      const low = bin?.price || sold.median;
      const mid2 = Math.max(bin?.price || 0, sold?.median || 0);
      // цена за штуку × count одним лотом (стаки) — налог от суммы лота
      opts.push({ how: 'ah', way: 'fast', unit: ahNet(low * UNDERCUT * count) / count });
      opts.push({ how: 'ah', way: 'avg', unit: ahNet(mid2 * count) / count });
    }
    if (npc > 0) opts.push({ how: 'npc', way: 'npc', unit: npc });
    const name = o.name?.(a.id) || a.src?.name || a.id;
    if (!market && !npc) { if (props?.tradeable !== false) noNpc.push({ id: a.id, name, count }); continue; }
    if (!opts.length) continue;
    // «Сразу» — без ожидания: Sell Instantly, BIN ниже всех или торговец; «Подождать» — лучшее из всего
    const fast = opts.filter(x => x.way !== 'offer' && x.way !== 'avg').sort((x, y) => y.unit - x.unit)[0] || opts[0];
    const best = [...opts].sort((x, y) => y.unit - x.unit)[0];
    const row = {
      id: a.id, name, count, where: a.where, gear: a.gear, extra: a.gear && a.count > count ? a.count - count : 0,
      now: { how: fast.how, way: fast.way, unit: Math.round(fast.unit), total: Math.round(fast.unit * count) },
      wait: { how: best.how, way: best.way, unit: Math.round(best.unit), total: Math.round(best.unit * count) },
      npc,
      demand: bz ? { perDay: Math.round((bz.sellWeek || 0) / 7) } : bin || sold ? { lots: bin?.count || 0, sold24h: sold?.count24h || 0 } : null,
    };
    if (row.wait.total < SELL_MIN) continue;
    const why = need.get(a.id);
    if (why) { keep.push({ id: a.id, name, count, value: row.wait.total, why }); continue; }
    items.push(row);
  }
  items.sort((x, y) => y.wait.total - x.wait.total);
  keep.sort((x, y) => y.value - x.value);
  noNpc.sort((x, y) => y.count - x.count);
  const list = items.slice(0, LIMIT);
  const placeCount = {};
  for (const it of list) for (const w of new Set(it.where.map(w => w.key))) placeCount[w] = (placeCount[w] || 0) + 1;
  return {
    market,
    items: list,
    more: Math.max(0, items.length - LIMIT),
    keep: keep.slice(0, 12),
    noNpc: noNpc.slice(0, 8),
    places: placeCount,
    totals: { now: list.reduce((s, x) => s + x.now.total, 0), wait: list.reduce((s, x) => s + x.wait.total, 0) },
    apiDisabled: false,
  };
}
