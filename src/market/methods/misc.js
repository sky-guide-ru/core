// Методы заработка вне рыбалки, боя и майнинга: Рифт, Garden (Pests, Composter, Jacob), обмен валют
// (Bits, Copper, North Star, Pelt, медали), Kat, NPC-флипы, миньоны, Foraging и осколки, ивенты.
// Подключается в methods.js одной строкой (...MISC_METHODS), тексты разбора — MISC_DETAILS в method-details.js.
//
// Источники (23.11.2026): NEU-REPO — магазины за валюты (recipes type npc_shop), рецепты Kat (katgrade),
// метка «Rift-Transferable», рецепты Рифта; SkyHanni-REPO constants/Garden.json — органика и топливо Composter;
// server/calendar — когда идут ивенты. Сверено с вики fandom 23.11.2026 (страницы Composter, Compost/Organic Matter Table,
// Machine Fuel, Pest, Cropie, Squash, Fermento, Helianthus, Agatha's Coupon, Starlyn Contest): правила Composter
// (4 000 органики и 2 000 топлива на 1 Compost раз в 10 минут), органика и топливо, Pests, шансы редких культур, купоны.
import { sellValue, buyPrice, npcFlips, DEMAND_SHARE } from '../flips.js';
import { nameOf } from '../util.js';
import { nowAndNext } from '../../calendar/index.js';
import { BITS_SHOP, COOKIE_BITS } from '../../analysis/wealth-data.js';
import { actionTime, DROPS as MINION_DROPS, minionSlots, typeName, COMMUNITY_SLOTS_MAX } from '../../minions/index.js';
import { SOURCES as SHARD_SOURCES } from '../../guides/hunting-data.js';
import { tx } from '../../../i18n/msg.js';

const M = 1_000_000;
const DAYS = 24;

// ---------- помощники ----------
const lvl = o => Number(o?.level || 0);
const skill = (m, k) => lvl(m?.skills?.[k]);
const fmtN = n => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const fmtC = n => {
  const v = Number(n || 0);
  if (Math.abs(v) >= M) return tx`${(v / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
  if (Math.abs(v) >= 10_000) return tx`${Math.round(v / 1000).toLocaleString('ru-RU')} тыс.`;
  return v.toLocaleString('ru-RU', { maximumFractionDigits: v < 10 ? 2 : 0 });
};
const need = (label, cur, min, extra = {}) => ({ text: tx`${label} ${min}+`, ok: cur >= min, have: tx`у тебя ${fmtN(cur)}`, ...extra });

function ownedSet(m) {
  const set = new Set();
  const walk = v => {
    if (!v) return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (typeof v === 'object') { if (typeof v.id === 'string') { set.add(v.id); return; } for (const x of Object.values(v)) walk(x); }
  };
  const inv = m?.inv || {};
  for (const k of ['inventory', 'armor', 'equipment', 'wardrobe', 'enderChest', 'vault', 'backpacks', 'backpackItems', 'talismans']) walk(inv[k]);
  return set;
}
const owns = (m, prefix) => { for (const id of ownedSet(m)) if (id.startsWith(prefix)) return true; return false; };

/**
 * Сколько чистыми даст продажа одной штуки и сколько штук в день рынок реально заберёт у одного продавца.
 * Предметы аукциона без 2+ продаж в сутки не считаем: цене одинокого лота не верим.
 */
export function sellable(ctx, id) {
  const v = sellValue(ctx, id, 'offer');
  if (!v?.net) return null;
  if (v.market === 'Auction House') {
    if ((v.sold24h || 0) < 2) return null;
    return { ...v, perDay: v.sold24h * DEMAND_SHARE.auction };
  }
  return { ...v, perDay: (v.volumeDay || 0) * DEMAND_SHARE.bazaar };
}

/** Магазины за игровые валюты из NEU: валюта → [{ result, count, amount, extra: {id: n} }]. Кэш на базу предметов. */
const shopCache = new WeakMap();
export function currencyShops(items) {
  if (!items) return {};
  if (shopCache.has(items)) return shopCache.get(items);
  const out = {};
  const seen = new Set();
  for (const it of items.values()) {
    for (const r of it?.recipes || []) {
      if (r?.type !== 'npc_shop' || !Array.isArray(r.cost)) continue;
      let cur = null, amount = 0, coins = 0;
      const extra = {};
      for (const c of r.cost) {
        const p = /^([^:]+):([\d.]+)$/.exec(String(c));
        const id = p ? p[1] : String(c);
        const n = p ? Number(p[2]) : 1;
        if (id === 'SKYBLOCK_COIN') coins += n;
        else if (id.startsWith('SKYBLOCK_') && !cur) { cur = id.slice(9); amount = n; }
        else extra[id] = (extra[id] || 0) + n;
      }
      const rp = /^([^:]+)(?::([\d.]+))?$/.exec(String(r.result || ''));
      if (!rp) continue;
      const row = { result: rp[1], count: Number(rp[2] || 1), amount, coins, extra, npc: it.id };
      const key = tx`${cur}|${row.result}|${amount}|${JSON.stringify(extra)}|${coins}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const k = cur || 'COIN';
      (out[k] ||= []).push(row);
    }
  }
  shopCache.set(items, out);
  return out;
}

// Книга «EXPERTISE;1» на Bazaar лежит как ENCHANTMENT_EXPERTISE_1
const marketIds = id => { const b = /^([A-Z0-9_]+);(\d+)$/.exec(id); return b ? [id, tx`ENCHANTMENT_${b[1]}_${b[2]}`] : [id]; };
function sellableAny(ctx, id) { for (const k of marketIds(id)) { const s = sellable(ctx, k); if (s) return { ...s, id: k }; } return null; }

/**
 * Монет за единицу валюты по каждому товару магазина: (продажа − доплата монетами и предметами) / цена в валюте.
 * Учитываем только то, что реально продаётся (Bazaar или 2+ продаж в сутки на аукционе).
 */
export function currencyValue(ctx, currency, rows = null) {
  const list = rows || currencyShops(ctx.items)[currency] || [];
  const out = [];
  for (const r of list) {
    if (!r.amount) continue;
    const s = sellableAny(ctx, r.result);
    if (!s) continue;
    let extraCost = r.coins || 0;
    let ok = true;
    for (const [id, n] of Object.entries(r.extra || {})) {
      if (id.startsWith('SKYBLOCK_')) continue; // вторая валюта (мухи, пауки Рифта) — монет не стоит
      const b = buyPrice(ctx, id);
      if (!b) { ok = false; break; }
      extraCost += b.price * n;
    }
    if (!ok) continue;
    const gain = s.net * r.count - extraCost;
    if (gain <= 0) continue;
    out.push({ id: r.result, name: nameOf(ctx, s.id), amount: r.amount, gain, perUnit: gain / r.amount, market: s.market, perDay: s.perDay * r.count });
  }
  return out.sort((a, b) => b.perUnit - a.perUnit);
}

const valueLine = (rows, unit, n = 3) => rows.slice(0, n).map(r => tx`${r.name} — ${fmtC(r.perUnit)} за 1 ${unit} (${fmtN(r.amount)} ${unit}, ${r.market})`).join('; ');

/** Цена предметов для «Что продавать» и «Цены дропов»: только то, что продаётся. */
function priceLine(ctx, ids, n = 5) {
  return ids.map(id => ({ id, s: sellable(ctx, id) })).filter(x => x.s).sort((a, b) => b.s.net - a.s.net).slice(0, n)
    .map(x => tx`${nameOf(ctx, x.id)} ${fmtC(x.s.net)}`).join(', ');
}

/** Ивент из календаря: идёт ли сейчас и когда следующий. */
function eventReq(o, ids, label) {
  const now = o.now ?? Date.now();
  const list = [].concat(ids);
  let ev;
  try { ev = nowAndNext(now, { limit: 40 }); } catch { return { text: label, ok: false, unknown: true, have: 'календарь недоступен' }; }
  const act = ev.active.find(e => list.includes(e.id));
  if (act) return { text: label, ok: true, have: tx`идёт ещё ${hm(act.end - now)}` };
  const next = ev.upcoming.filter(e => list.includes(e.id)).sort((a, b) => a.start - b.start)[0];
  // Ивент нельзя «открыть» прокачкой: unknown убирает метод из целей плана, но показывает, когда он начнётся
  return { text: label, ok: false, unknown: true, have: next ? tx`начнётся через ${hm(next.start - now)}` : 'не скоро' };
}
function hm(ms) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return tx`${min} мин`;
  const h = Math.floor(min / 60), mm = min % 60;
  return h >= 48 ? tx`${Math.round(h / 24)} дн.` : mm ? tx`${h} ч ${mm} мин` : tx`${h} ч`;
}

const riftOpen = m => Number(m?.rift?.motes || 0) > 0 || Number(m?.rift?.enigmaSouls || 0) > 0 || (m?.rift?.areasSeen || []).length > 0;
const gardenOpen = m => !!(m?.garden && (m.garden.experience || m.garden.copper || m.garden.unlockedPlots));

// ---------- Рифт ----------
// Переносимые из Рифта товары (метка Rift-Transferable в NEU) и из чего они собираются. per — сырья на 1 штуку.
export const RIFT_CRAFTS = [
  { out: 'CADUCOUS_FEEDER', from: 'CADUCOUS_STEM', per: 448, where: 'Caducous Stem растёт в Колизее (Colosseum) Рифта' },
  { out: 'BERBERIS_FUEL_INJECTOR', from: 'WILTED_BERBERIS', per: 336, where: 'Wilted Berberis — на Dreadfarm в Рифте' },
  { out: 'EXPORTABLE_CARROTS', from: 'HALF_EATEN_CARROT', per: 120 / 48, where: 'Half-Eaten Carrot — на Dreadfarm; на крафт ещё по 1 Volt и Scribe Crux' },
  { out: 'AGARICUS_CHUM_CAP', from: 'AGARICUS_CAP', per: 1, where: 'Agaricus Cap — грибы в West Village и Wyld Woods; на 8 штук нужно Rift Bucket (1 000 Motes)' },
  { out: 'HEMOGLASS', from: 'HEMOVIBE', per: 160, where: 'Hemovibe падает с вампиров Vampire Slayer' },
];
const RIFT_SELL = ['FAMILY_DOUBLOON', 'DYE_CELADON', 'DYE_SANGRIA', 'TRANSMISSION_TUNER', 'ENCHANTED_BOOK_BUNDLE_THE_ONE', 'SOULTWIST_RUNE;1', 'LEGGINGS_OF_THE_PACK', 'FREE_WILL'];

export function riftCraftValues(ctx) {
  return RIFT_CRAFTS.map(c => {
    const s = sellable(ctx, c.out);
    if (!s) return null;
    return { ...c, name: nameOf(ctx, c.out), fromName: nameOf(ctx, c.from), net: s.net, perRaw: s.net / c.per, perDay: s.perDay, market: s.market };
  }).filter(Boolean).sort((a, b) => b.perRaw - a.perRaw);
}

// ---------- Composter ----------
// Органика за штуку (SkyHanni-REPO Garden.json) и сжатые формы ×160; топливо за штуку.
// Органика за 1 штуку — таблица вики «Compost/Organic Matter Table» (значения точные)
const OM_RAW = { WHEAT: 1, SEEDS: 1, PUMPKIN: 1, RED_MUSHROOM: 1, BROWN_MUSHROOM: 1, SUGAR_CANE: 0.5, CACTUS: 0.5, 'INK_SACK:3': 0.4, NETHER_STALK: 0.33, POTATO_ITEM: 0.33, POISONOUS_POTATO: 0.33, CARROT_ITEM: 0.29, MELON: 0.2, MELON_BLOCK: 1.8, HUGE_MUSHROOM_1: 9, HUGE_MUSHROOM_2: 9 };
const OM_ENCH = { ENCHANTED_WHEAT: 160, ENCHANTED_BREAD: 60, ENCHANTED_HAY_BALE: 25600, ENCHANTED_SEEDS: 160, BOX_OF_SEEDS: 25600, FINE_FLOUR: 150,
  ENCHANTED_PUMPKIN: 160, POLISHED_PUMPKIN: 25600, ENCHANTED_RED_MUSHROOM: 160, ENCHANTED_BROWN_MUSHROOM: 160, ENCHANTED_HUGE_MUSHROOM_1: 5184, ENCHANTED_HUGE_MUSHROOM_2: 5184,
  ENCHANTED_SUGAR: 80, ENCHANTED_PAPER: 96, ENCHANTED_SUGAR_CANE: 12800, ENCHANTED_CACTUS_GREEN: 80, ENCHANTED_CACTUS: 12800, ENCHANTED_COCOA: 64,
  ENCHANTED_NETHER_STALK: 52.8, MUTANT_NETHER_STALK: 8448, ENCHANTED_POTATO: 52.8, ENCHANTED_POISONOUS_POTATO: 52.8, ENCHANTED_BAKED_POTATO: 8448,
  ENCHANTED_CARROT: 46.4, ENCHANTED_GOLDEN_CARROT: 5939.2, ENCHANTED_MELON: 32, ENCHANTED_MELON_BLOCK: 5120,
  FLOWERING_BOUQUET: 6000, CROPIE: 2500, SQUASH: 10000, FERMENTO: 20000, HELIANTHUS: 30000, CONDENSED_FERMENTO: 180000, CONDENSED_HELIANTHUS: 270000 };
// Топливо, которое принимает Composter (вики «Machine Fuel», колонка Composter)
const FUEL = { ENCHANTED_DANDELION: 360, ENCHANTED_POPPY: 1024, BIOFUEL: 3000, VOLTA: 10000, OIL_BARREL: 10000, SUNFLOWER_OIL: 20000 };
export const COMPOST_OM = 4000, COMPOST_FUEL = 2000, COMPOST_SEC = 600;
/** Сколько органики помещается в Composter: 40 000 базово + 30 000 за уровень Organic Matter Cap (вики). Condensed Fermento (180 000) без улучшений не влезает. */
const omCap = up => 40_000 + 30_000 * Number(up?.organic_matter_cap || 0);

function cheapestPer(ctx, table) {
  let best = null;
  for (const [id, per] of Object.entries(table)) {
    const b = buyPrice(ctx, id, 'order');
    if (!b || b.market !== 'Bazaar') continue;
    const unit = b.price / per;
    if (!best || unit < best.unit) best = { id, unit, name: nameOf(ctx, id) };
  }
  return best;
}

export function composterProfit(ctx, upgrades = {}) {
  const cap = omCap(upgrades);
  const omTable = Object.fromEntries(Object.entries({ ...OM_RAW, ...OM_ENCH }).filter(([, v]) => v <= cap));
  const om = cheapestPer(ctx, omTable);
  const fuel = cheapestPer(ctx, FUEL);
  const compost = sellable(ctx, 'COMPOST');
  if (!om || !fuel || !compost) return null;
  // Улучшения (вики): Composter Speed +20% за уровень, Multi Drop +3% шанс второго Compost, Cost Reduction −1% органики и топлива; до 25 уровней
  const speed = 1 + 0.2 * Number(upgrades.speed || 0);
  const multi = 1 + 0.03 * Number(upgrades.multi_drop || 0);
  const reduce = 1 - 0.01 * Number(upgrades.cost_reduction || 0);
  const cost = (COMPOST_OM * om.unit + COMPOST_FUEL * fuel.unit) * reduce;
  const value = compost.net * multi;
  const perDayUnits = 86400 / COMPOST_SEC * speed;
  const sellPerDay = Math.min(perDayUnits * multi, compost.perDay || Infinity);
  return { om, fuel, cost, value, profit: value - cost, perDayUnits, perDay: (value - cost) / multi * sellPerDay, speed, multi, reduce };
}

// ---------- Kat ----------
export function katFlips(ctx, { limit = 5 } = {}) {
  const out = [];
  for (const it of ctx.items?.values?.() || []) {
    for (const r of it?.recipes || []) {
      if (r?.type !== 'katgrade' || !r.input || !r.output || !r.time) continue;
      const inB = ctx.bin.get(r.input);
      const outS = sellable(ctx, r.output);
      if (!inB?.price || !outS || outS.market !== 'Auction House') continue;
      let cost = inB.price + Number(r.coins || 0);
      let ok = true;
      for (const s of r.items || []) {
        const p = /^([^:]+)(?::([\d.]+))?$/.exec(String(s));
        const b = p && buyPrice(ctx, p[1]);
        if (!b) { ok = false; break; }
        cost += b.price * Number(p[2] || 1);
      }
      if (!ok) continue;
      const profit = outS.net - cost;
      if (profit <= 0 || profit > cost * 1.5) continue; // >150% — почти всегда кривая цена или редкий скин
      const hours = r.time / 3600;
      out.push({ input: r.input, output: r.output, name: nameOf(ctx, r.output), fromName: nameOf(ctx, r.input), cost, profit, hours, perHour: profit / hours, sold24h: outS.sold24h });
    }
  }
  return out.sort((a, b) => b.perHour - a.perHour).slice(0, limit);
}

// ---------- миньоны ----------
export function minionIncome(ctx, m) {
  const crafted = new Map();
  for (const s of m?.coop?.minions || m?.minions || []) {
    const r = /^(.+)_(\d+)$/.exec(String(s));
    if (r) crafted.set(r[1], Math.max(crafted.get(r[1]) || 0, Number(r[2])));
  }
  const unique = (m?.coop?.minions || m?.minions || []).length;
  const slots = minionSlots(unique).slots + Math.min(COMMUNITY_SLOTS_MAX, Number(m?.extras?.communityUpgrades?.minion_slots || 0));
  const rows = [];
  for (const [type, tier] of crafted) {
    const drops = MINION_DROPS[type];
    const sec = actionTime(ctx.items?.get?.(`${type}_GENERATOR_${tier}`));
    if (!drops || !sec) continue;
    const harvests = 86400 / (2 * sec);
    let perDay = 0;
    for (const [id, n] of drops) {
      const bz = sellable(ctx, id)?.net || 0;
      const npc = ctx.npc?.get(id) || 0;
      perDay += harvests * n * Math.max(bz, npc);
    }
    if (perDay > 0) rows.push({ type, tier, name: tx`${typeName(type)} ${tier}`, perDay });
  }
  rows.sort((a, b) => b.perDay - a.perDay);
  return { slots, rows, best: rows[0] || null };
}

// ---------- Pests Garden (вики «Pest», сверено 23.11.2026) ----------
// crop: [ID сжатой культуры, базовое число, +1 за столько Farming Fortune]; rare: [ID, штук, шанс] — шанс ниже 5% растёт с FF: × (1 + FF/600).
export const PESTS = [
  { name: 'Fly', lvl: 5, crop: ['ENCHANTED_WHEAT', 1, 35], rare: [['BEADY_EYES', 1, 0.015], ['ENCHANTED_HAY_BALE', 3, 0.005]] },
  { name: 'Cricket', lvl: 5, crop: ['ENCHANTED_CARROT', 3, 10.5], rare: [['ENCHANTED_GOLDEN_CARROT', 10, 0.005], ['CHIRPING_STEREO', 1, 0.005]] },
  { name: 'Locust', lvl: 5, crop: ['ENCHANTED_POTATO', 3, 10.5], rare: [['ENCHANTED_BAKED_POTATO', 10, 0.005], ['ENCHANTMENT_SUNDER_6', 1, 0.005]] },
  { name: 'Rat', lvl: 5, crop: ['ENCHANTED_PUMPKIN', 1, 35], rare: [['POLISHED_PUMPKIN', 3, 0.005]] },
  { name: 'Mosquito', lvl: 5, crop: ['ENCHANTED_SUGAR', 2, 17.5], rare: [['ENCHANTED_SUGAR_CANE', 6, 0.005], ['CLIPPED_WINGS', 1, 0.01]] },
  { name: 'Earthworm', lvl: 6, crop: ['ENCHANTED_MELON', 5, 7], rare: [['BOOKWORM_BOOK', 1, 0.02], ['ENCHANTED_MELON_BLOCK', 15, 0.005]] },
  { name: 'Mite', lvl: 7, crop: ['ENCHANTED_CACTUS_GREEN', 2, 17.5], rare: [['ENCHANTED_CACTUS', 6, 0.005], ['ATMOSPHERIC_FILTER', 1, 0.0025]] },
  { name: 'Moth', lvl: 8, crop: ['ENCHANTED_COCOA', 3, 12], rare: [['ENCHANTED_COOKIE', 9, 0.005], ['WRIGGLING_LARVA', 1, 0.005]] },
  { name: 'Slug', lvl: 9, crop: ['ENCHANTED_RED_MUSHROOM', 1, 35], rare: [['ENCHANTED_HUGE_MUSHROOM_2', 3, 0.0025], ['ENCHANTED_HUGE_MUSHROOM_1', 3, 0.0025]] },
  { name: 'Beetle', lvl: 10, crop: ['ENCHANTED_NETHER_STALK', 3, 12], rare: [['ENCHANTMENT_PESTERMINATOR_1', 1, 0.035], ['MUTANT_NETHER_STALK', 9, 0.005]] },
  { name: 'Dragonfly', lvl: 11, crop: ['ENCHANTED_SUNFLOWER', 2, 17.5], rare: [['VERMIN_VAPORIZER_GARDEN_CHIP', 1, 0.01], ['COMPACTED_SUNFLOWER', 6, 0.005]] },
  { name: 'Firefly', lvl: 11, crop: ['ENCHANTED_MOONFLOWER', 2, 17.5], rare: [['FIRE_IN_A_BOTTLE', 1, 0.01], ['COMPACTED_MOONFLOWER', 6, 0.005]] },
  { name: 'Praying Mantis', lvl: 12, crop: ['ENCHANTED_WILD_ROSE', 2, 17.5], rare: [['MANTID_CLAW', 1, 0.01], ['COMPACTED_WILD_ROSE', 6, 0.005]] },
];
/** С каждого Pest один из шести предметов, по 10% на каждый (вики). */
const PEST_COMMON = ['COMPOST', 'HONEY_JAR', 'DUNG', 'PLANT_MATTER', 'TASTY_CHEESE', 'JELLY'];
/** Pests в час [осторожно, с уменьшенной паузой]: базовая пауза 5 минут, снаряжение Pesthunter сокращает её. */
export const PESTS_PER_HOUR = [12, 20];

/** Грубый Farming Fortune по профилю, если игрок не указал своё (та же логика, что estimateFarmingFortune в methods.js). */
function roughFarmingFortune(m) {
  let ff = skill(m, 'farming') * 4;
  const ups = Object.values(m?.garden?.cropUpgrades || {});
  ff += (ups.length ? Math.max(...ups) : 0) * 5;
  ff += owns(m, 'FERMENTO_CHESTPLATE') || owns(m, 'HELIANTHUS_CHESTPLATE') ? 1100 : owns(m, 'SQUASH_CHESTPLATE') ? 850 : owns(m, 'CROPIE_CHESTPLATE') ? 650 : owns(m, 'MELON_CHESTPLATE') ? 400 : 200;
  return Math.round(ff);
}

/** Средняя ценность одного Pest при уровне Garden lvl и Farming Fortune ff. */
export function pestValue(ctx, lvl, ff) {
  const unit = id => { const s = sellable(ctx, id); const npc = Number(ctx.npc?.get(id) || 0); return Math.max(s?.net || 0, npc); };
  const list = PESTS.filter(p => p.lvl <= Math.max(5, lvl));
  let crops = 0, rare = 0;
  const tops = new Map();
  for (const p of list) {
    const [id, base, per] = p.crop;
    crops += (base + Math.floor(ff / per)) * unit(id) / list.length;
    for (const [rid, qty, ch] of p.rare) {
      const u = unit(rid);
      if (!u) continue;
      const v = qty * Math.min(1, ch * (1 + ff / 600)) * u / list.length;
      rare += v;
      const t = tops.get(rid) || { id: rid, name: nameOf(ctx, rid), unit: u * qty, perPest: 0 };
      t.perPest += v; tops.set(rid, t);
    }
  }
  const common = PEST_COMMON.reduce((s, id) => s + 0.1 * unit(id), 0);
  const top = [...tops.values()].sort((a, b) => b.perPest - a.perPest).slice(0, 4);
  return { perPest: 1000 + crops + common + rare, crops, common, rare, top, count: list.length };
}

// ---------- каталог ----------
export const MISC_METHODS = [
  {
    id: 'rift-crafts', title: 'Сбор в Рифте на продажу', tag: 'Rift', mode: 'active',
    desc: 'Почти всё из Рифта нельзя вынести, но часть товаров с меткой Rift-Transferable продаётся за монеты: Caducous Feeder, Berberis Fuel Injector, Exportable Carrots, Agaricus Chumcap. Считаем, сколько монет приносит одна единица сырья.',
    req: m => [{ text: 'Рифт открыт', ok: riftOpen(m), have: riftOpen(m) ? tx`Motes: ${fmtN(m?.rift?.motes)}` : 'в Рифте ещё не был' }],
    compute: ctx => {
      const rows = riftCraftValues(ctx);
      if (!rows.length) return null;
      const extra = priceLine(ctx, RIFT_SELL, 4);
      return {
        coinsPerHour: null,
        sourceText: 'цена за единицу сырья по живым ценам; доход = твой темп сбора × цена',
        detail: tx`Монет за 1 единицу сырья: ${rows.map(r => tx`${r.fromName} → ${r.name}: ${fmtC(r.perRaw)} (${r.market}, рынок заберёт ≈${fmtN(r.perDay)} шт. в день)`).join('; ')}.${extra ? tx` Ещё продаются: ${extra}.` : ''} Время в Рифте ограничено, поэтому выгоднее то, что быстро собирается рядом с точкой входа.`,
        top: rows.slice(0, 3).map(r => ({ id: r.out, name: r.name, perHour: null })),
      };
    },
    drops: ['CADUCOUS_FEEDER', 'BERBERIS_FUEL_INJECTOR', 'EXPORTABLE_CARROTS', 'AGARICUS_CHUM_CAP', 'FAMILY_DOUBLOON'],
  },
  {
    id: 'pests', title: 'Охота на Pests в Garden', tag: 'Farming', mode: 'active',
    desc: 'Пока фармишь, на участках появляются Pests (pests). С каждого — 1 000 монет, сжатые культуры, часто Compost, Dung, Honey Jar, Plant Matter, Tasty Cheese или Jelly, а иногда Atmospheric Filter, Pesterminator, Chirping Stereo. Это доход сверху к урожаю.',
    req: m => { const l = gardenLevel(Number(m?.garden?.experience || 0)); return [{ text: 'Garden 5+ (Pests появляются)', ok: l >= 5, have: tx`у тебя ${l}`, soft: !m?.garden?.experience }, need('Farming', skill(m, 'farming'), 30, { soft: true })]; },
    compute: (ctx, m, o = {}) => {
      const lvl = gardenLevel(Number(m?.garden?.experience || 0)) || 12;
      const ff = Number(o.farmingFortune ?? roughFarmingFortune(m));
      const r = pestValue(ctx, lvl, ff);
      if (!r.perPest) return null;
      const range = PESTS_PER_HOUR.map(n => n * r.perPest);
      return {
        coinsPerHour: range[1], range,
        sourceText: 'правила и дропы Pests с вики, цены живые; доход сверху к урожаю',
        detail: tx`Pest появляется с шансом 0,2% за сломанную культуру, но не чаще раза в 5 минут; снаряжение Pesthunter, Pest Vest и мэр Finnegan сокращают паузу (до 2 мин 15 с без мэра). Считаем ${PESTS_PER_HOUR[0]}–${PESTS_PER_HOUR[1]} Pests в час. Один Pest в среднем приносит ${fmtC(r.perPest)}: 1 000 монет, культуры ${fmtC(r.crops)} (их больше с Farming Fortune ${fmtN(ff)}${o.farmingFortune == null ? ', грубая оценка' : ''}), ${fmtC(r.common)} с частых дропов (10% на один из шести) и ${fmtC(r.rare)} с редких. Дороже всего из редкого: ${r.top.map(x => tx`${x.name} (${fmtC(x.unit)})`).join(', ') || 'нет цен'}. Pests ${r.count} видов, каждый появляется с равным шансом.`,
        top: r.top.slice(0, 3).map(x => ({ id: x.id, name: x.name, perHour: x.perPest * PESTS_PER_HOUR[1] })),
      };
    },
    drops: ['OVERCLOCKER_3000', 'ATMOSPHERIC_FILTER', 'PESTERMINATOR;1', 'BURROWING_SPORES', 'DUNG'],
  },
  {
    id: 'composter', title: 'Composter в Garden', tag: 'Farming', mode: 'passive',
    desc: 'Композер сам превращает органику и топливо в Compost. Выгодно, если Compost на Bazaar дороже сырья: считаем по самому дешёвому источнику органики и топлива и по твоим улучшениям композера.',
    req: m => [{ text: 'Garden открыт', ok: gardenOpen(m) }],
    compute: (ctx, m) => {
      const up = m?.garden?.composter || {};
      const p = composterProfit(ctx, up);
      if (!p) return null;
      if (p.profit <= 0) {
        return { coinsPerHour: null, sourceText: 'сейчас в минус по живым ценам', detail: tx`Сейчас невыгодно: 1 Compost стоит ${fmtC(p.value)}, а сырьё на него ${fmtC(p.cost)} (органика: ${p.om.name}, топливо: ${p.fuel.name}). Composter стоит держать ради Compost для участков Garden, а продавать — когда разница станет плюсовой.` };
      }
      return {
        coinsPerHour: p.perDay / DAYS,
        sourceText: 'расчёт по текущим ценам; правила композера сверены с вики',
        detail: tx`1 Compost: продажа ${fmtC(p.value)}, сырьё ${fmtC(p.cost)} (органика выгоднее всего из ${p.om.name}, топливо — ${p.fuel.name}). Скорость ×${p.speed.toFixed(1)}, ≈${fmtN(p.perDayUnits)} Compost в сутки, если не давать композеру простаивать; доход ограничен и тем, сколько Compost рынок купит за день. По вики базово 1 Compost = 4 000 органики и 2 000 топлива раз в 10 минут; Composter Speed даёт +20% скорости за уровень, Multi Drop +3% шанс второго Compost, Cost Reduction −1% сырья (максимум 25 уровней: ×6 скорости, 75% и −25%).`,
      };
    },
    drops: ['COMPOST', 'BIOFUEL', 'VOLTA', 'OIL_BARREL'],
  },
  {
    id: 'jacob', title: "Jacob's Contest и медали", tag: 'Farming', mode: 'daily',
    desc: 'Конкурс фермеров идёт каждый реальный час: три культуры, 20 минут. За место — медали и Jacob\'s Ticket, которые меняются у Anita на Prismapump, книги Delicate V, Basket of Seeds и т.п. Сами награды можно продать.',
    req: m => [need('Farming', skill(m, 'farming'), 10, { soft: true })],
    compute: ctx => {
      const rows = [];
      for (const cur of ['BRONZE_MEDAL', 'SILVER_MEDAL', 'GOLD_MEDAL']) {
        const v = currencyValue(ctx, cur);
        if (v[0]) rows.push({ cur, ...v[0] });
      }
      if (!rows.length) return null;
      const label = { BRONZE_MEDAL: 'бронзовая', SILVER_MEDAL: 'серебряная', GOLD_MEDAL: 'золотая' };
      return {
        coinsPerHour: null, sourceText: 'стоимость медали по живым ценам',
        detail: tx`Во что выгоднее всего менять медаль (с учётом Jacob's Ticket по цене Bazaar): ${rows.map(r => tx`${label[r.cur]} → ${r.name}, ${fmtC(r.perUnit)} за медаль`).join('; ')}. Медали падают сверху к урожаю, отдельно ради них фармить не нужно.`,
      };
    },
    drops: ['JACOBS_TICKET', 'PRISMAPUMP', 'ENCHANTMENT_DELICATE_5'],
  },
  {
    id: 'npc-flip', marketOnly: true, title: 'Перепродажа NPC', tag: 'Торговля', mode: 'active',
    desc: 'Покупаешь на Bazaar ордером дешевле, чем за этот товар платит NPC, и продаёшь NPC. Почти без риска, но доход ограничен объёмом товара.',
    req: () => [],
    compute: ctx => {
      const list = npcFlips(ctx, { limit: 5, mode: 'order', share: 0.03 }).filter(f => f.perHour > 0);
      if (!list.length) return null;
      const sum = list.slice(0, 3).reduce((s, f) => s + f.perHour, 0);
      return {
        coinsPerHour: sum, range: [sum * 0.5, sum],
        detail: tx`Лучшие сейчас: ${list.slice(0, 3).map(f => tx`${f.name} (+${fmtC(f.profit)} за штуку, ≈${fmtN(f.unitsPerHour)} шт. в час)`).join('; ')}. Берём 3% оборота товара: остальное выкупают другие. Нижняя граница — если ордера исполняются медленнее.`,
        top: list.slice(0, 3).map(f => ({ id: f.id, name: f.name, perHour: f.perHour })),
      };
    },
  },
  {
    id: 'kat-flip', marketOnly: true, title: 'Прокачка питомцев у Kat', tag: 'Питомцы', mode: 'passive',
    desc: 'Kat в Hub повышает редкость питомца за монеты и время. Покупаешь питомца на аукционе, отдаёшь Kat, продаёшь более редкого. Kat держит одного питомца за раз.',
    req: () => [],
    compute: ctx => {
      const list = katFlips(ctx, { limit: 5 });
      if (!list.length) return null;
      const f = list[0];
      return {
        coinsPerHour: f.perHour, range: [f.perHour * 0.6, f.perHour],
        detail: tx`Лучшее сейчас: ${f.fromName} → ${f.name}, +${fmtC(f.profit)} за ${Math.round(f.hours * 10) / 10} ч (вложить ${fmtC(f.cost)}, продаж в сутки: ${fmtN(f.sold24h)}). Kat Flower и Kat Bouquet из магазина Bits сокращают ожидание. Ещё варианты: ${list.slice(1, 3).map(x => tx`${x.fromName} → ${x.name} (${fmtC(x.perHour)}/ч)`).join(', ') || 'нет'}.`,
        top: list.slice(0, 3).map(x => ({ id: x.output, name: x.name, perHour: x.perHour })),
      };
    },
  },
  {
    id: 'bits-shop', title: 'Bits: печенье → товары на продажу', tag: 'Ежедневно', mode: 'passive',
    desc: 'С Booster Cookie копятся Bits. В Community Shop их меняют на товары (Kismet Feather, God Potion, Kat Flower, Heat Core, улучшения), которые продаются. Считаем доход в сутки с одного печенья по лучшему товару.',
    req: m => [{ text: 'Booster Cookie активен', ok: !!m?.cookie, soft: true, buy: ['BOOSTER_COOKIE'] }],
    compute: ctx => {
      const rows = currencyValue(ctx, 'BIT', BITS_SHOP.map(s => ({ result: s.id, count: 1, amount: s.bits, coins: 0, extra: {} })));
      if (!rows.length) return null;
      const best = rows[0];
      const bitsDay = COOKIE_BITS / 4; // печенье на 4 дня, без множителя Fame
      const cookie = buyPrice(ctx, 'BOOSTER_COOKIE')?.price || 0;
      const perDay = bitsDay * best.perUnit;
      return {
        coinsPerHour: perDay / DAYS,
        detail: tx`1 Bit сейчас стоит до ${fmtC(best.perUnit)} через ${best.name}. Печенье даёт ${fmtN(COOKIE_BITS)} Bits за 4 дня (больше с рангом Fame) — около ${fmtC(perDay)} в сутки. Само печенье стоит ${fmtC(cookie)}: ${COOKIE_BITS * best.perUnit > cookie ? 'Bits окупают его' : 'Bits не окупают его целиком, но печенье берут ради бонусов'}. Другие выгодные товары: ${valueLine(rows.slice(1), 'Bit', 2)}.`,
        top: rows.slice(0, 3).map(r => ({ id: r.id, name: r.name, perHour: null })),
      };
    },
    drops: ['KISMET_FEATHER', 'GOD_POTION_2', 'KAT_FLOWER', 'HEAT_CORE', 'BOOSTER_COOKIE'],
  },
  {
    id: 'minions', title: 'Миньоны', tag: 'Миньоны', mode: 'passive',
    desc: 'Миньоны работают, пока ты не в игре (на острове должен быть кто-то или стоять улучшения). Считаем лучший из твоих миньонов на все слоты по цене дропа без топлива; с топливом и Super Compactor выходит больше.',
    req: m => [{ text: 'Есть скрафченные миньоны', ok: (m?.minions || []).length > 0 }],
    compute: (ctx, m) => {
      const r = minionIncome(ctx, m);
      if (!r.best) return null;
      const perDay = r.best.perDay * r.slots;
      return {
        coinsPerHour: perDay / DAYS,
        sourceText: 'расчёт по текущим ценам, без топлива и улучшений',
        detail: tx`Лучший из твоих: ${r.best.name} — ${fmtC(r.best.perDay)} в сутки на слот. Слотов: ${r.slots}, если поставить его во все — около ${fmtC(perDay)} в сутки. Дальше по доходу: ${r.rows.slice(1, 4).map(x => tx`${x.name} ${fmtC(x.perDay)}`).join(', ') || 'нет'}. Топливо даёт +25–90% скорости. Inferno-миньоны считаются отдельным методом.`,
        top: r.rows.slice(0, 3).map(x => ({ id: tx`${x.type}_GENERATOR_${x.tier}`, name: x.name, perHour: x.perDay / DAYS })),
      };
    },
    drops: ['ENCHANTED_CLAY_BLOCK', 'ENCHANTED_SLIME_BLOCK', 'ENCHANTED_DIAMOND_BLOCK', 'ENCHANTED_SNOW_BLOCK'],
  },
  {
    id: 'foraging-galatea', title: 'Foraging на Galatea', tag: 'Сбор', mode: 'active',
    desc: 'Рубка Fig и Mangrove на Galatea, плюс подарки деревьев (Stretching Sticks, Deep Root, книги, осколки). Продавай брёвна в той форме, где дороже.',
    req: m => [need('Foraging', skill(m, 'foraging'), 20, { soft: true })],
    compute: ctx => {
      const rows = [['FIG_LOG', 1], ['ENCHANTED_FIG_LOG', 160], ['MANGROVE_LOG', 1], ['ENCHANTED_MANGROVE_LOG', 160]]
        .map(([id, n]) => ({ id, n, s: sellable(ctx, id) })).filter(x => x.s).map(x => ({ ...x, per: x.s.net / x.n }));
      if (!rows.length) return null;
      const best = k => rows.filter(r => r.id.includes(k)).sort((a, b) => b.per - a.per)[0];
      const fig = best('FIG'), man = best('MANGROVE');
      const gifts = priceLine(ctx, ['STRETCHING_STICKS', 'DEEP_ROOT', 'TREE_THE_FISH', 'ENCHANTMENT_ULTIMATE_FIRST_IMPRESSION_1', 'ENCHANTMENT_ULTIMATE_MISSILE_1'], 4);
      return {
        coinsPerHour: null, sourceText: 'цена за бревно по живым ценам; доход = твой темп × цена',
        detail: tx`За 1 бревно: ${[fig && tx`Fig ${fmtC(fig.per)} (как ${nameOf(ctx, fig.id)})`, man && tx`Mangrove ${fmtC(man.per)} (как ${nameOf(ctx, man.id)})`].filter(Boolean).join(', ')}. ${gifts ? tx`Дороже всего из подарков деревьев: ${gifts}.` : ''}`.trim(),
      };
    },
    drops: ['ENCHANTED_FIG_LOG', 'ENCHANTED_MANGROVE_LOG', 'STRETCHING_STICKS', 'DEEP_ROOT'],
  },
  {
    id: 'hunting-shards', title: 'Hunting: осколки на Bazaar', tag: 'Сбор', mode: 'active',
    desc: 'Осколки (shards) на Galatea ловят лассо, сетью и ловушками, а продают на Bazaar. Здесь — самые дорогие из них с живым спросом прямо сейчас.',
    req: () => [],
    compute: ctx => {
      let rows = shardRows(ctx, shardsBy('hunt'));
      if (!rows.length) rows = shardRows(ctx, []);
      if (!rows.length) return null;
      return {
        coinsPerHour: null, sourceText: 'цены и спрос по живым данным Bazaar',
        detail: tx`Дорогие осколки с хорошим спросом: ${shardLine(ctx, rows)}. Где ловить каждый, смотри в гайде Hunting.`,
        top: rows.slice(0, 3).map(r => ({ id: r.id, name: nameOf(ctx, r.id), perHour: null })),
      };
    },
  },
  {
    id: 'jerry', title: "Мастерская Jerry и Season of Jerry", tag: 'Ивенты', mode: 'active',
    desc: 'Зимой открывается остров Jerry: подарки, North Star и защита мастерской в Season of Jerry. North Star меняют на товары, которые продаются; Red Gift и Glacial Fragment идут на аукцион и Bazaar.',
    req: (m, o) => [eventReq(o, 'workshop', "Мастерская Jerry открыта")],
    compute: ctx => {
      const v = currencyValue(ctx, 'NORTH_STAR');
      const line = priceLine(ctx, ['RED_GIFT', 'GREEN_GIFT', 'WHITE_GIFT', 'JERRY_BOX_GOLDEN', 'JERRY_BOX_PURPLE', 'FROZEN_BAUBLE', 'GLACIAL_FRAGMENT', 'WALNUT', 'FROZEN_BAIT'], 6);
      if (!v.length && !line) return null;
      return {
        coinsPerHour: null, sourceText: 'цены по живым данным',
        detail: tx`${v.length ? tx`1 North Star стоит до ${fmtC(v[0].perUnit)}: ${valueLine(v, 'North Star', 2)}. ` : ''}${line ? tx`Цены подарков и дропов: ${line}.` : ''}`.trim(),
      };
    },
    drops: ['RED_GIFT', 'GREEN_GIFT', 'GLACIAL_FRAGMENT', 'WALNUT'],
  },
  {
    id: 'spooky', title: 'Хэллоуинский фестиваль', tag: 'Ивенты', mode: 'active',
    desc: 'Час раз в год SkyBlock: с любых мобов падают Green и Purple Candy, их меняют у Fear Mongerer. Сверху — Ectoplasm, Pumpkin Guts, Werewolf Skin и Spooky Shard на продажу.',
    req: (m, o) => [eventReq(o, 'spooky', 'Идёт фестиваль')],
    compute: ctx => {
      const line = priceLine(ctx, ['PURPLE_CANDY', 'GREEN_CANDY', 'ECTOPLASM', 'PUMPKIN_GUTS', 'WEREWOLF_SKIN', 'SPOOKY_SHARD', 'SOUL_FRAGMENT'], 6);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Цены дропов фестиваля: ${line}.` } : null;
    },
    drops: ['PURPLE_CANDY', 'GREEN_CANDY', 'WEREWOLF_SKIN', 'ECTOPLASM'],
  },
  {
    id: 'chocolate', title: 'Chocolate Factory', tag: 'Ивенты', mode: 'passive',
    desc: 'Фабрика копит Chocolate сама. Монетами напрямую он не продаётся, но фабричные аксессуары и часть наград можно продать. Главное — не давать фабрике простаивать и забирать кроликов во время Hoppity.',
    req: m => [{ text: 'Фабрика открыта', ok: !!m?.extras?.chocolate || !!m?.chocolate, soft: true }],
    compute: ctx => {
      const line = priceLine(ctx, ['NIBBLE_CHOCOLATE_STICK', 'SMOOTH_CHOCOLATE_BAR', 'RICH_CHOCOLATE_CHUNK', 'GANACHE_CHOCOLATE_SLAB', 'PRESTIGE_CHOCOLATE_REALM', 'REFINED_DARK_CACAO_TRUFFLE', 'DYE_CHOCOLATE'], 5);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Что из фабрики сейчас продаётся дороже всего: ${line}.` } : null;
    },
    drops: ['PRESTIGE_CHOCOLATE_REALM', 'GANACHE_CHOCOLATE_SLAB', 'REFINED_DARK_CACAO_TRUFFLE'],
  },
  {
    id: 'dark-auction', marketOnly: true, title: 'Тёмный аукцион', tag: 'Торговля', mode: 'active',
    desc: 'Раз в реальный час Sirius продаёт в Hub редкие вещи: Midas Sword, Hegemony Artifact, книги и др. Иногда их можно взять дешевле аукциона, но нужен большой капитал и дисциплина.',
    req: m => [{ text: 'Капитал от 50 млн', ok: Number(m?.purse || 0) + Number(m?.bank || 0) >= 50 * M, soft: true, have: tx`у тебя ${fmtC(Number(m?.purse || 0) + Number(m?.bank || 0))}` }],
    compute: ctx => {
      const line = priceLine(ctx, ['MIDAS_SWORD', 'HEGEMONY_ARTIFACT', 'MIDAS_STAFF', 'SHENS_REGALIA', 'ENCHANTMENT_SHARPNESS_6', 'ENCHANTMENT_GIANT_KILLER_6'], 5);
      return line ? { coinsPerHour: null, sourceText: 'цены аукциона по живым данным', detail: tx`Сколько это стоит на аукционе сейчас: ${line}. Ставь не выше ~85% от этих цен, иначе после комиссии и ожидания продажи выйдешь в ноль.` } : null;
    },
    drops: ['MIDAS_SWORD', 'HEGEMONY_ARTIFACT'],
  },
  {
    id: 'trapper', title: 'Охота у Trapper', tag: 'Сбор', mode: 'active',
    desc: 'Trapper в Mushroom Desert даёт задания найти и убить зверя. За Pelt в его магазине — Talbot\'s Theodolite, Trapper Crest и другое; плюс опыт Combat и коллекция кожи.',
    req: m => [need('Farming', skill(m, 'farming'), 10, { soft: true })],
    compute: ctx => {
      const v = currencyValue(ctx, 'PELT');
      return v.length ? { coinsPerHour: null, sourceText: 'стоимость Pelt по живым ценам', detail: tx`1 Pelt сейчас стоит до ${fmtC(v[0].perUnit)}: ${valueLine(v, 'Pelt', 3)}. Денег немного, метод больше ради опыта и аксессуаров.` } : null;
    },
  },
];

// ---------- разбор: шаги и риски ----------
export const MISC_DETAILS = {
  'rift-crafts': {
    effort: 'semi', risk: 'low', xp: 'Опыт Рифта и коллекции Рифта',
    steps: [
      'Войди в Рифт через портал в Wizard Tower. Время внутри ограничено, следи за таймером.',
      'Собирай сырьё, которое сайт показывает самым ценным: Caducous Stem, Wilted Berberis, Half-Eaten Carrot или Agaricus Cap.',
      'Скрафти из него товар (Caducous Feeder, Berberis Fuel Injector, Exportable Carrots, Agaricus Chumcap) прямо в Рифте.',
      'Выйди с товаром: у него метка Rift-Transferable, поэтому он переносится в обычный мир. Продай на Bazaar или аукционе.',
    ],
    risks: [
      'Рынок у этих товаров маленький: много сразу не продашь, цена проседает.',
      'Время в Рифте кончается. Души Enigma и Rift Prism увеличивают его.',
      'Темп сбора на вики не сверен, поэтому сайт показывает цену за единицу, а не доход в час.',
    ],
  },
  pests: {
    effort: 'semi', risk: 'low', xp: 'Опыт Farming и Garden',
    steps: [
      'Возьми пылесос из SkyMart (Skymart Vacuum, лучше — Infini-Vacuum).',
      'Фарми как обычно. Когда появится Pest, игра подскажет участок: дойди и засоси его.',
      'Ставь Pest Trap и пользуйся Sprayonator, чтобы Pests появлялись чаще на нужной культуре.',
      'Редкие дропы (Overclocker 3000, Atmospheric Filter, книги) продавай на аукционе, сжатые культуры — на Bazaar.',
    ],
    risks: [
      'С 4 Pests на участке Farming Fortune падает (до −75% при 8), поэтому убивай их сразу.',
      'Редкие дропы — это удача: шанс с вики, растёт с Farming Fortune.',
    ],
    kit: [{ text: 'Пылесос для Pests', own: ['SKYMART_VACUUM', 'SKYMART_TURBO_VACUUM', 'SKYMART_HYPER_VACUUM', 'INFINI_VACUUM*'] }],
  },
  composter: {
    effort: 'afk', risk: 'low', xp: 'Почти без опыта',
    steps: [
      'Открой Composter в Garden и вложи органику: сайт показывает, из чего она сейчас дешевле всего.',
      'Залей топливо (Biofuel, Volta или Oil Barrel — что дешевле на 1 единицу).',
      'Забирай Compost и продавай ордером на Bazaar или трать на новые участки Garden.',
      'Качай улучшения композера за Copper: скорость и шанс второго Compost окупаются быстрее всего.',
    ],
    risks: [
      'Разница между ценой Compost и сырья маленькая и бывает минусовой: перед закупкой обнови вкладку.',
      'Condensed Fermento (180 000 органики) влезает только с улучшением Organic Matter Cap: базовый запас 40 000.',
    ],
  },
  jacob: {
    effort: 'daily', risk: 'low', xp: 'Опыт Farming, медали и уникальные награды',
    steps: [
      'Смотри календарь: на конкурсе три культуры, выбери свою.',
      'Подойди к Jacob и начни конкурс, затем фарми 20 минут без перерыва.',
      'Забери медали и Jacob\'s Ticket у Jacob.',
      'Меняй их у Anita на то, что сайт показывает самым дорогим, и продавай.',
    ],
    risks: ['Чем выше медаль, тем больше конкуренция: золото берут только с хорошей Farming Fortune.'],
  },
  'npc-flip': {
    effort: 'semi', risk: 'low', xp: 'Опыта нет, только монеты',
    steps: [
      'Возьми товар из списка: его покупают на Bazaar дешевле, чем платит NPC.',
      'Поставь ордер на покупку на 0,1 выше лучшего.',
      'Когда ордер исполнится, продай NPC (любой торговец в Hub или /trades).',
      'Повторяй, пока разница держится.',
    ],
    risks: [
      'Разницу быстро замечают и выкупают: ордер может долго не исполняться.',
      'Доход маленький, зато без риска потерять деньги.',
    ],
    kit: [{ text: 'Свободные монеты для ордеров', capital: 1 * M }],
  },
  'kat-flip': {
    effort: 'afk', risk: 'mid', xp: 'Опыта нет, только монеты',
    steps: [
      'Купи на аукционе питомца из списка (обычно 1 уровня, самый дешёвый лот).',
      'Отдай его Kat в Hub и заплати за повышение редкости.',
      'Ускорь ожидание через Kat Flower или Kat Bouquet, если они дешевле, чем потеря времени.',
      'Забери питомца и выставь на аукцион чуть ниже самого дешёвого лота той же редкости.',
    ],
    risks: [
      'Пока Kat работает, цена питомца может упасть.',
      'Питомец продаётся днями, если продаж мало. Сайт берёт только тех, у кого 2+ продажи в сутки.',
      'Цена на аукционе зависит от уровня и скина: сравнивай с лотами 1 уровня.',
    ],
  },
  'bits-shop': {
    effort: 'daily', risk: 'low', xp: 'Опыта нет, только монеты',
    steps: [
      'Держи Booster Cookie активным: без него Bits не копятся.',
      'Открой Community Shop (Elizabeth в Hub) и посмотри, сколько Bits накопилось.',
      'Купи товар, который сайт показывает самым выгодным за 1 Bit (вкладка Bits).',
      'Продай его на аукционе или Bazaar.',
    ],
    risks: ['Цены товаров за Bits постепенно падают, когда многие продают одно и то же.', 'Ранг Fame (множитель Bits) API не отдаёт, расчёт по базе.'],
    kit: [{ text: 'Booster Cookie', buy: ['BOOSTER_COOKIE'] }],
  },
  minions: {
    effort: 'afk', risk: 'low', xp: 'Опыт навыков за сбор, уникальные крафты дают слоты',
    steps: [
      'Поставь во все слоты самого доходного миньона из списка.',
      'Добавь топливо и Super Compactor 3000, чтобы склад не забивался.',
      'Забирай дроп раз в день-два или поставь Enchanted Hopper, чтобы он продавал NPC сам.',
      'Крафть новые тиры разных миньонов: уникальные крафты открывают новые слоты.',
    ],
    risks: ['Доход посчитан без топлива и улучшений, с ними выше.', 'Миньоны со сложным дропом (Inferno, Vampire, деревья, рыбалка) здесь не считаются.'],
  },
  'foraging-galatea': {
    effort: 'semi', risk: 'low', xp: 'Опыт Foraging и HotF',
    steps: [
      'Иди на Galatea с топором и сетапом под Foraging Fortune.',
      'Руби Fig или Mangrove, что дороже сейчас.',
      'Сжимай брёвна в Enchanted, если так выгоднее (сайт сравнивает обе формы).',
      'Подарки деревьев продавай отдельно: в них бывают дорогие книги и осколки.',
    ],
    risks: ['На Galatea пускают с Foraging 12 (вики), до Mangrove нужно ещё 50 Sweep — иначе руби Fig.', 'Темп рубки зависит от снаряжения, поэтому дохода в час нет.'],
  },
  'hunting-shards': {
    effort: 'semi', risk: 'low', xp: 'Опыт Hunting',
    steps: [
      'Выбери осколок из списка: дорогой и с хорошим спросом.',
      'Посмотри в гайде Hunting, где он ловится (ловушка, сеть или моб).',
      'Лови, а лишние продавай на Bazaar ордером.',
    ],
    risks: ['Цены осколков скачут после обновлений атрибутов.', 'Редкие осколки ловятся медленно.'],
  },
  jerry: {
    effort: 'focus', risk: 'low', xp: 'Опыт Combat и Fishing',
    steps: [
      'Когда мастерская открыта, иди к Jerry через портал в Hub.',
      'Лови зимних Sea Creatures и открывай подарки ради North Star.',
      'В Season of Jerry защищай мастерскую: награды по урону.',
      'Меняй North Star на то, что сайт показывает самым дорогим, и продавай вместе с подарками.',
    ],
    risks: ['Ивент раз в год SkyBlock (~5 реальных дней).', 'В сезон предложение растёт, цены подарков падают.'],
  },
  spooky: {
    effort: 'focus', risk: 'low', xp: 'Опыт Combat',
    steps: [
      'Дождись фестиваля (на сайте он в календаре).',
      'Бей мобов, где их много: ночью шанс конфет выше.',
      'Меняй конфеты у Fear Mongerer или продавай их и дропы на Bazaar.',
    ],
    risks: ['Фестиваль длится всего 1 реальный час.'],
  },
  chocolate: {
    effort: 'afk', risk: 'low', xp: 'Прогресс фабрики',
    steps: [
      'Заходи в фабрику и качай сотрудников на Chocolate.',
      'Во время Hoppity собирай яйца ради новых кроликов.',
      'Ненужные фабричные аксессуары продавай на аукционе.',
    ],
    risks: ['Chocolate нельзя продать за монеты напрямую.', 'Стоимость наград фабрики с вики не сверена.'],
  },
  'dark-auction': {
    effort: 'focus', risk: 'high', xp: 'Опыта нет',
    steps: [
      'Будь в Hub к началу Тёмного аукциона (раз в час) с 400 000+ монет в кошельке, иначе Sirius не пустит.',
      'Сравни лот с ценой на аукционе на сайте и реши потолок ставки заранее.',
      'Купи, только если цена заметно ниже аукциона, и перепродай.',
    ],
    risks: ['Ставки часто выше рынка: легко купить дороже, чем продашь.', 'Нужен большой капитал, а продажа дорогого предмета может занять дни.'],
    kit: [{ text: 'Монеты на ставку', capital: 50 * M }],
  },
  trapper: {
    effort: 'semi', risk: 'low', xp: 'Опыт Combat и Farming',
    steps: [
      'Иди к Trapper в Mushroom Desert и возьми задание.',
      'Найди зверя по следам и убей его.',
      'Копи Pelt и меняй на то, что выгоднее продать или нужно самому.',
    ],
    risks: ['Мало денег: метод ради аксессуаров и опыта.'],
  },
};

// Дополнения к уже существующим методам из methods.js (применяются там одной строкой)
export const MISC_PATCHES = [
  {
    id: 'visitors',
    compute: ctx => {
      const v = currencyValue(ctx, 'COPPER');
      const line = priceLine(ctx, ['OVERGROWN_GRASS', 'JUNGLE_KEY', 'FINE_FLOUR', 'ENCHANTMENT_DEDICATION_4', 'ENCHANTMENT_CULTIVATING_1', 'ENCHANTMENT_REPLENISH_1', 'GREEN_BANDANA', 'SPACE_HELMET'], 5);
      if (!v.length && !line) return null;
      return {
        coinsPerHour: null, sourceText: 'стоимость наград по живым ценам',
        detail: tx`${v.length ? tx`1 Copper сейчас стоит до ${fmtC(v[0].perUnit)}: ${valueLine(v, 'Copper', 2)}. ` : ''}${line ? tx`Редкие награды Visitors: ${line}. ` : ''}Принимай заказ, если товары для него дешевле, чем награда плюс Copper по этой цене.`.trim(),
      };
    },
  },
];

// =====================================================================================
// Вторая волна (по каталогу заработка /mnt/project-files/money/catalog.md, группы 🌀, Q2 и Q3)
// =====================================================================================

// Уровень Garden по опыту (NEU constants/garden.json garden_exp — прибавки на уровень)
const GARDEN_EXP = [0, 70, 70, 140, 240, 600, 1500, 2000, 2500, 3000, 10000, 10000, 10000, 10000, 10000];
export function gardenLevel(xp) {
  let lvl = 0, sum = 0;
  for (const step of GARDEN_EXP) { sum += step; if (xp >= sum) lvl++; else break; }
  return lvl;
}

/** NPC → рынок: купить у NPC за монеты (и предметы) и продать на Bazaar или аукционе дороже. */
export function npcToMarket(ctx, { limit = 5, npc = null } = {}) {
  const rows = currencyShops(ctx.items).COIN || [];
  const out = [];
  for (const r of rows) {
    if (npc && r.npc !== npc) continue;
    if (!r.coins) continue;
    const s = sellableAny(ctx, r.result);
    if (!s) continue;
    let cost = r.coins, ok = true;
    for (const [id, n] of Object.entries(r.extra || {})) {
      const b = buyPrice(ctx, id);
      if (!b) { ok = false; break; }
      cost += b.price * n;
    }
    if (!ok) continue;
    const profit = s.net * r.count - cost;
    if (profit <= 0 || profit > cost * 1.5) continue;
    const perDayUnits = s.perDay / r.count;
    out.push({ id: r.result, name: nameOf(ctx, s.id), npc: r.npc, cost, profit, market: s.market, perDay: profit * perDayUnits, perDayUnits });
  }
  return out.sort((a, b) => b.perDay - a.perDay).slice(0, limit);
}

/** Прокачка питомца: самый дешёвый лот против самого дешёвого лота 100 уровня (bin.max). */
export function petLevelFlips(ctx, { limit = 5 } = {}) {
  const out = [];
  for (const [key, b] of ctx.bin) {
    if (!/;[0-5]$/.test(key) || !b?.max || !b.price || b.max <= b.price) continue;
    const s = ctx.sold ? sellable(ctx, key) : null;
    if (!s) continue; // нужен живой спрос на этого питомца
    const profit = s.market === 'Auction House' ? (b.max * (s.net / s.gross)) - b.price : 0;
    if (profit <= 0 || profit > b.price * 3) continue;
    out.push({ id: key, name: nameOf(ctx, key), buy: b.price, sell: b.max, profit, sold24h: s.sold24h });
  }
  return out.sort((a, b) => b.profit - a.profit).slice(0, limit);
}

/** Осколки Bazaar по способу добычи (коды источников из гайда Hunting). */
const shardId = name => tx`SHARD_${String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
export function shardsBy(kind) {
  const re = { hunt: /(^|\|)(L|N|T:|G)/, combat: /(^|\|)(B|S|K|D:)/, fusion: /^U:/ }[kind];
  return Object.entries(SHARD_SOURCES).filter(([, code]) => re.test(code)).map(([name]) => shardId(name));
}
function shardRows(ctx, ids) {
  const want = new Set(ids);
  const rows = [];
  for (const [id] of ctx.bazaar) {
    if (!id.startsWith('SHARD_') || (want.size && !want.has(id))) continue;
    const s = sellable(ctx, id);
    if (!s || s.perDay < 1) continue;
    rows.push({ id, s, score: s.net * Math.min(s.perDay, 50) });
  }
  return rows.sort((a, b) => b.score - a.score);
}
const shardLine = (ctx, rows, n = 6) => rows.slice(0, n).map(r => tx`${nameOf(ctx, r.id)} ${fmtC(r.s.net)} (≈${fmtN(r.s.perDay)} в день)`).join(', ');

const MUTATIONS = ['ALL_IN_ALOE', 'ASHWREATH', 'BLASTBERRY', 'CHEESEBITE', 'CHLORONITE', 'CHOCOBERRY', 'CINDERSHADE', 'COALROOT', 'CREAMBLOOM', 'DEVOURER', 'DO_NOT_EAT_SHROOM', 'DUSKBLOOM', 'DUSTGRAIN', 'FLESHTRAP', 'GLASSCORN', 'GLOOMGOURD', 'GODSEED', 'JERRYFLOWER', 'LONELILY', 'MAGIC_JELLYBEAN', 'NOCTILUME', 'PHANTOMLEAF', 'PUFFERCLOUD', 'SCOURROOT', 'SHADEVINE', 'SHELLFRUIT', 'SNOOZLING', 'SOGGYBUD', 'STARTLEVINE', 'STOPLIGHT_PETAL', 'THORNSHADE', 'THUNDERLING', 'TIMESTALK', 'TURTLELLINI', 'VEILSHROOM', 'WITHERBLOOM', 'ZOMBUD'];
const CHIPS = ['RAREFINDER_GARDEN_CHIP', 'OVERDRIVE_GARDEN_CHIP', 'MECHAMIND_GARDEN_CHIP', 'CROPSHOT_GARDEN_CHIP', 'SOWLEDGE_GARDEN_CHIP', 'SYNTHESIS_GARDEN_CHIP', 'HYPERCHARGE_GARDEN_CHIP', 'QUICKDRAW_GARDEN_CHIP', 'EVERGREEN_GARDEN_CHIP', 'VERMIN_VAPORIZER_GARDEN_CHIP'];
const LOGS = ['OAK', 'SPRUCE', 'BIRCH', 'DARK_OAK', 'ACACIA', 'JUNGLE'];

/** Цена за 1 сырую единицу по лучшей форме продажи: [[id, сколько сырья в штуке]]. */
function perRaw(ctx, forms) {
  return forms.map(([id, n]) => ({ id, n, s: sellable(ctx, id) })).filter(x => x.s).map(x => ({ ...x, per: x.s.net / x.n })).sort((a, b) => b.per - a.per)[0] || null;
}

// ---------- редкие культуры (вики: Cropie, Squash, Fermento, Helianthus) ----------
// Шанс за сломанную спелую культуру при 2/3/4 частях подходящей брони. Части разных сетов между собой не складываются.
// MELON_* — это Tater Armor (переименована), NEU оставил старые ID.
export const RARE_CROPS = [
  { id: 'CROPIE', crops: 'пшеницы, моркови и картофеля', sets: ['MELON', 'FERMENTO', 'HELIANTHUS'], chance: [0.0003, 0.0004, 0.0005] },
  { id: 'SQUASH', crops: 'тыквы, арбуза и какао', sets: ['CROPIE', 'FERMENTO', 'HELIANTHUS'], chance: [0.0001, 0.0002, 0.0003] },
  { id: 'FERMENTO', crops: 'тростника, кактуса, грибов и незерского нароста', sets: ['SQUASH', 'FERMENTO', 'HELIANTHUS'], chance: [0.00005, 0.00006, 0.00007] },
  { id: 'HELIANTHUS', crops: 'Moonflower, Sunflower и Wild Rose', sets: ['FERMENTO', 'HELIANTHUS'], chance: [0.00002, 0.00003, 0.00004] },
];
const ARMOR_SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
/** Сколько частей сета у игрока (где угодно: надето, гардероб, сундуки). */
const setPieces = (m, set, owned = ownedSet(m)) => ARMOR_SLOTS.filter(sl => owned.has(`${set}_${sl}`)).length;
/** Блоков в час: 15–19,5 блоков в секунду и 90% времени в фарме (как в расчёте урожая). */
const CROP_BLOCKS_HOUR = [15 * 3600 * 0.9, 19.5 * 3600 * 0.9];

/** Доход в час с редких культур для каждой: лучший сет игрока (или цель 4/4, если брони нет). */
export function rareCropIncome(ctx, m) {
  const owned = ownedSet(m);
  return RARE_CROPS.map(rc => {
    const best = rc.sets.map(set => ({ set, n: setPieces(m, set, owned) })).sort((a, b) => b.n - a.n)[0];
    const have = best.n >= 2;
    const chance = rc.chance[(have ? Math.min(best.n, 4) : 4) - 2];
    const s = sellable(ctx, rc.id);
    const npc = Number(ctx.npc?.get(rc.id) || 0);
    const unit = Math.max(s?.net || 0, npc);
    if (!unit) return null;
    const perDayCap = s && s.net >= npc ? s.perDay : Infinity;
    const perHour = CROP_BLOCKS_HOUR.map(b => Math.min(b * chance, perDayCap / 24) * unit);
    return { ...rc, set: have ? best.set : rc.sets[rc.sets.length - 1], pieces: have ? best.n : 0, have, chance, unit, perHour, everyBlocks: Math.round(1 / chance) };
  }).filter(Boolean);
}

MISC_METHODS.push(
  {
    id: 'crop-rare-drops', title: 'Редкие дропы культур (Cropie, Squash, Fermento)', tag: 'Farming', mode: 'active',
    desc: 'Во время фарма иногда падают Cropie, Squash, Fermento и Helianthus, если на тебе хотя бы 2 части нужной фермерской брони. Их скупают для брони следующего тира. Это доход сверху к урожаю.',
    req: m => [{ text: 'Garden открыт', ok: gardenOpen(m) },
      { text: 'Фермерская броня: 2+ части Tater, Cropie, Squash, Fermento или Helianthus', ok: ['MELON', 'CROPIE', 'SQUASH', 'FERMENTO', 'HELIANTHUS'].some(set => setPieces(m, set) >= 2), soft: true, buy: ['MELON_CHESTPLATE', 'CROPIE_CHESTPLATE'] }],
    compute: (ctx, m) => {
      const rows = rareCropIncome(ctx, m);
      if (!rows.length) return null;
      const mine = rows.filter(r => r.have);
      const list = (mine.length ? mine : rows).sort((a, b) => b.perHour[1] - a.perHour[1]);
      const best = list[0];
      const setName = set => ({ MELON: 'Tater', CROPIE: 'Cropie', SQUASH: 'Squash', FERMENTO: 'Fermento', HELIANTHUS: 'Helianthus' }[set]);
      const pc = c => tx`${(c * 100).toLocaleString('ru-RU', { maximumFractionDigits: 3 })}%`;
      const line = r => tx`${nameOf(ctx, r.id)} — с ${r.crops}, ${pc(r.chance)} (1 на ${fmtN(r.everyBlocks)} культур)${r.have ? tx` с твоими ${r.pieces}/4 ${setName(r.set)}` : ' с 4/4 брони'}, ${fmtC(r.unit)} за штуку, ≈${fmtC(r.perHour[1])} в час`;
      return {
        coinsPerHour: best.perHour[1], range: best.perHour,
        sourceText: 'шансы с вики, цены живые; доход сверху к урожаю',
        detail: tx`${mine.length ? 'С твоей бронёй' : 'Подходящей брони пока нет, поэтому считаем цель 4/4'}: ${list.map(line).join('; ')}. Считаем 15–19,5 сломанных культур в секунду. Rarefinder Chip, питомец Rose Dragon и атрибут Crop Bug множат шанс до ×2,4 (здесь не учтены). В Greenhouse шансы в сотни раз выше (Cropie до 20% за культуру с 4/4 Tater).`,
        top: list.slice(0, 3).map(r => ({ id: r.id, name: nameOf(ctx, r.id), perHour: r.perHour[1] })),
      };
    },
    drops: ['CROPIE', 'SQUASH', 'FERMENTO', 'HELIANTHUS'],
  },
  {
    id: 'greenhouse', title: 'Greenhouse: мутации и Garden Chips', tag: 'Farming', mode: 'active',
    desc: 'В Greenhouse Garden растут мутации культур (Glasscorn, Devourer, Timestalk и др.). Часть продаётся на Bazaar, часть нужна для Garden Chips и брони. Здесь — что из этого сейчас дороже всего.',
    req: m => { const l = gardenLevel(Number(m?.garden?.experience || 0)); return [{ text: 'Garden 7+ (Greenhouse)', ok: l >= 7, have: tx`у тебя ${l}`, soft: !m?.garden?.experience }]; },
    compute: ctx => {
      const mut = priceLine(ctx, MUTATIONS, 6);
      const chips = priceLine(ctx, CHIPS, 4);
      if (!mut && !chips) return null;
      return { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`${mut ? tx`Дорогие мутации: ${mut}. ` : ''}${chips ? tx`Garden Chips: ${chips}. ` : ''}Условия роста каждой мутации смотри в игре через Plant Diagnostics Tool.`.trim() };
    },
    drops: ['GLASSCORN', 'DEVOURER', 'TIMESTALK', 'RAREFINDER_GARDEN_CHIP'],
  },
  {
    id: 'mushroom-desert', title: 'Мицелий, красный песок и грибы', tag: 'Farming', mode: 'active',
    desc: 'Мицелий и красный песок копают в Mushroom Desert и на участках Garden, гигантские грибы — там же. Сжатые кубы идут в рецепты Garden.',
    req: () => [],
    compute: ctx => {
      const my = perRaw(ctx, [['MYCEL', 1], ['ENCHANTED_MYCELIUM', 160], ['ENCHANTED_MYCELIUM_CUBE', 25600]]);
      const rs = perRaw(ctx, [['SAND:1', 1], ['ENCHANTED_RED_SAND', 160], ['ENCHANTED_RED_SAND_CUBE', 25600]]);
      const hm = priceLine(ctx, ['ENCHANTED_HUGE_MUSHROOM_1', 'ENCHANTED_HUGE_MUSHROOM_2'], 2);
      if (!my && !rs && !hm) return null;
      return { coinsPerHour: null, sourceText: 'цена за блок по живым ценам; доход = твой темп × цена', detail: tx`За 1 блок: ${[my && tx`мицелий ${fmtC(my.per)} (продавать как ${nameOf(ctx, my.id)})`, rs && tx`красный песок ${fmtC(rs.per)} (как ${nameOf(ctx, rs.id)})`].filter(Boolean).join(', ')}.${hm ? tx` Гигантские грибы: ${hm}.` : ''}` };
    },
  },
  {
    id: 'galatea-gather', title: 'Ресурсы Galatea', tag: 'Сбор', mode: 'active',
    desc: 'На Galatea кроме брёвен собирают Lushlilac, Vinesap, Tender Wood и Sea Lumies, а с деревьев и подарков падают Figstone, Mangcore, Moonglade Jewel и Wood Singularity.',
    req: m => [need('Foraging', skill(m, 'foraging'), 12, { text: 'Foraging 12+ (вход на Galatea)' })],
    compute: ctx => {
      const rows = [
        ['Vinesap', perRaw(ctx, [['VINESAP', 1], ['ENCHANTED_VINESAP', 160]])],
        ['Tender Wood', perRaw(ctx, [['TENDER_WOOD', 1], ['ENCHANTED_TENDER_WOOD', 160]])],
        ['Lushlilac', perRaw(ctx, [['LUSHLILAC', 1]])],
        ['Sea Lumies', perRaw(ctx, [['SEA_LUMIES', 1]])],
      ].filter(([, r]) => r);
      const rare = priceLine(ctx, ['FIGSTONE', 'MANGCORE', 'MOONGLADE_JEWEL', 'WOOD_SINGULARITY', 'FORESTS_FAVOR'], 5);
      if (!rows.length && !rare) return null;
      return { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`${rows.length ? tx`За 1 штуку: ${rows.map(([n, r]) => tx`${n} ${fmtC(r.per)} (как ${nameOf(ctx, r.id)})`).join(', ')}. ` : ''}${rare ? tx`Редкое: ${rare}.` : ''}`.trim() };
    },
    drops: ['ENCHANTED_VINESAP', 'FIGSTONE', 'MANGCORE', 'MOONGLADE_JEWEL', 'WOOD_SINGULARITY'],
  },
  {
    id: 'foraging-park', title: 'Рубка в The Park', tag: 'Сбор', mode: 'active',
    desc: 'Старый способ: рубить дуб, ель, берёзу, тёмный дуб, акацию и джунгли в The Park с Treecapitator. Денег меньше, чем на Galatea, зато без требований.',
    req: () => [],
    compute: ctx => {
      const rows = LOGS.map(l => ({ l, r: perRaw(ctx, [[tx`ENCHANTED_${l}_LOG`, 160]]) })).filter(x => x.r).sort((a, b) => b.r.per - a.r.per);
      return rows.length ? { coinsPerHour: null, sourceText: 'цена за бревно по живым ценам', detail: tx`За 1 бревно (через Enchanted-форму): ${rows.slice(0, 4).map(x => tx`${nameOf(ctx, x.r.id)} ${fmtC(x.r.per)}`).join(', ')}.` } : null;
    },
  },
  {
    id: 'galatea-coupons', title: 'Купоны Agatha и Miria', tag: 'Сбор', mode: 'daily',
    desc: 'Agatha в Moonglade Marsh на Galatea каждый час проводит 20-минутный конкурс Starlyn Contest: очки за рубку деревьев, охоту, рыбалку и сбор Lushlilac. За результат дают 10–45 Agatha\'s Coupon, они продаются на Bazaar.',
    req: m => [need('Foraging', skill(m, 'foraging'), 12, { text: 'Foraging 12+ (вход в Moonglade Marsh)' })],
    compute: ctx => {
      const s = sellable(ctx, 'AGATHA_COUPON');
      if (!s) { const line = priceLine(ctx, ['MIRIA_COUPON'], 1); return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Цена купона сейчас: ${line}.` } : null; }
      const B = [['Common', 25, 10], ['Uncommon', 250, 15], ['Rare', 1000, 20], ['Epic', 2000, 25], ['Legendary', 3000, 30], ['Mythic', 5000, 35], ['Divine', 8000, 40], ['Supreme', 12000, 45]];
      const perContest = n => n * s.net;
      return {
        coinsPerHour: perContest(30), range: [perContest(20), perContest(30)],
        sourceText: 'награды конкурса с вики, цена купона живая; конкурс — 20 минут раз в час',
        detail: tx`Купон сейчас ≈${fmtC(s.net)}. За конкурс (вики): ${B.map(([r, pts, n]) => tx`${r} от ${fmtN(pts)} очков — ${n}`).join(', ')}. Доход в час — за один конкурс на Rare–Legendary (20–30 купонов), рынок заберёт ≈${fmtN(s.perDay)} купонов в день. С Epic шанс 10% и с Legendary 20% на Starlyn Prize, первые три конкурса в сутки дают ещё 1 200 опыта HotF.`,
      };
    },
    drops: ['AGATHA_COUPON', 'MIRIA_COUPON'],
  },
  {
    id: 'shards-combat', title: 'Осколки с мобов и боссов', tag: 'Сбор', mode: 'active',
    desc: 'Часть осколков падает с мобов, если ловить их Black Hole или бить с солью. Дорогие боевые осколки (Starborn, Molthorn, Apex Dragon и др.) продаются по миллиону и больше.',
    req: () => [],
    compute: ctx => {
      const rows = shardRows(ctx, shardsBy('combat'));
      return rows.length ? { coinsPerHour: null, sourceText: 'цены и спрос по живым данным Bazaar', detail: tx`Дорогие осколки с мобов: ${shardLine(ctx, rows)}.` } : null;
    },
  },
  {
    id: 'attribute-fusion', marketOnly: true, title: 'Attribute Fusion: сплав осколков', tag: 'Сбор', mode: 'active',
    desc: 'В Fusion House (Tangleburg) два осколка сплавляют в новый. Некоторые осколки получаются только так и стоят дороже суммы исходных.',
    req: () => [],
    compute: ctx => {
      const rows = shardRows(ctx, shardsBy('fusion'));
      return rows.length ? { coinsPerHour: null, sourceText: 'цены по живым данным; рецепты сплава — в гайде Hunting', detail: tx`Осколки, которые получаются сплавом, и их цена: ${shardLine(ctx, rows)}. Сравни с ценой двух исходных осколков (рецепт в гайде Hunting): выгодно, если результат дороже.` } : null;
    },
  },
  {
    id: 'npc-to-market', marketOnly: true, title: 'Купить у NPC, продать на рынке', tag: 'Торговля', mode: 'active',
    desc: 'Некоторые товары NPC продают дешевле, чем они стоят на Bazaar или аукционе. Покупаешь у NPC и перепродаёшь.',
    req: () => [],
    compute: ctx => {
      const list = npcToMarket(ctx, { limit: 5 });
      if (!list.length) return null;
      const perDay = list.slice(0, 3).reduce((s, f) => s + f.perDay, 0);
      return {
        coinsPerHour: null, sourceText: 'расчёт по текущим ценам: прибыль за день при доле спроса',
        detail: tx`Лучшее сейчас: ${list.slice(0, 3).map(f => tx`${f.name} у ${nameOf(ctx, f.npc).replace(/ ?NPC$/i, '')} (+${fmtC(f.profit)} за штуку, рынок заберёт ≈${fmtN(f.perDayUnits)} в день)`).join('; ')}. Всего около ${fmtC(perDay)} в день. Число покупок у NPC может быть ограничено.`,
        top: list.slice(0, 3).map(f => ({ id: f.id, name: f.name, perHour: null })),
      };
    },
  },
  {
    id: 'pet-level-flip', marketOnly: true, title: 'Прокачка питомцев на продажу', tag: 'Питомцы', mode: 'active',
    desc: 'Купить питомца 1 уровня, прокачать до 100 и продать. Опыт даёт то, что ты и так делаешь, плюс Exp Share и предметы опыта.',
    req: m => [need('Taming', skill(m, 'taming'), 20, { soft: true })],
    compute: ctx => {
      const list = petLevelFlips(ctx, { limit: 5 });
      return list.length ? { coinsPerHour: null, sourceText: 'разница цен по живым лотам аукциона', detail: tx`Самая большая разница между 1 и 100 уровнем сейчас: ${list.slice(0, 3).map(x => tx`${x.name}: ${fmtC(x.buy)} → ${fmtC(x.sell)} (+${fmtC(x.profit)} после комиссии)`).join('; ')}. Сколько опыта нужно, смотри на вкладке «Питомцы»: легендарному до 100 уровня нужно 25 млн опыта.` } : null;
    },
  },
  {
    id: 'traveling-zoo', marketOnly: true, title: 'Бродячий зоопарк', tag: 'Ивенты', mode: 'active',
    desc: 'Дважды в год Oringo в Hub продаёт питомцев (лев, тигр, кит, слон, жираф, обезьяна) за монеты и брёвна или рыбу. Иногда их выгодно перепродать.',
    req: (m, o) => [eventReq(o, ['zoo-summer', 'zoo-winter'], 'Идёт Бродячий зоопарк')],
    compute: ctx => {
      const list = npcToMarket(ctx, { limit: 3, npc: 'ORINGO_NPC' });
      return list.length ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Выгодно перепродать: ${list.map(f => tx`${f.name} (+${fmtC(f.profit)})`).join(', ')}. Oringo привозит только 3 питомца из 6.` } : { coinsPerHour: null, sourceText: 'по живым ценам перепродажа сейчас невыгодна', detail: 'По текущим ценам ни один питомец Oringo не даёт прибыли после комиссии.' };
    },
  },
  {
    id: 'year-witch', title: 'Year of the Witch', tag: 'Ивенты', mode: 'active',
    desc: 'Редкий ивент (раз в несколько лет SkyBlock): с мобов падают ингредиенты для зелий ведьмы (Singed Powder, Spell Powder и др.), у Agnes — свой магазин. Оборот ингредиентов на Bazaar большой.',
    req: () => [],
    compute: ctx => {
      const line = priceLine(ctx, ['SINGED_POWDER', 'SPELL_POWDER', 'WITCH_BELONGINGS', 'WITCH_HAT', 'WITCH_BROOMSTICK'], 5);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Цены сейчас: ${line}. Когда идёт ивент, сайт пока не определяет — смотри объявления Hypixel.` } : null;
    },
  },
  {
    id: 'great-spook', title: 'Great Spook', tag: 'Ивенты', mode: 'active',
    desc: 'Хэллоуинский ивент с Primal Fears: страхи появляются рядом с игроком, за них дают руны и предметы на продажу.',
    req: (m, o) => [eventReq(o, 'spooky', 'Хэллоуин в SkyBlock')],
    compute: ctx => {
      const line = priceLine(ctx, ['PRIMAL_FEAR_RUNE;3', 'FEAR_RUNE;1', 'PRIMAL_FEAR_RUNE;1'], 3);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Цены сейчас: ${line}.` } : null;
    },
  },
  {
    id: 'new-year', title: 'Новый год: торты', tag: 'Ивенты', mode: 'daily',
    desc: 'В Новый год SkyBlock Baker раздаёт бесплатный New Year Cake. Торты старых лет и наборы Century Cake коллекционеры покупают на аукционе.',
    req: (m, o) => [eventReq(o, 'newyear', 'Идёт Новый год')],
    compute: ctx => {
      const line = priceLine(ctx, ['NEW_YEAR_CAKE', 'FULL_CENTURY_CAKE_PACK', 'RANDOM_CENTURY_CAKE_PACK'], 3);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Цены сейчас: ${line}. Свой торт забирай каждый год: он бесплатный.` } : null;
    },
  },
  {
    id: 'cult', title: 'Культ Падшей звезды', tag: 'Ивенты', mode: 'daily',
    desc: 'Четыре раза в месяц SkyBlock в Dwarven Mines собирается культ: зайди на встречу и получи награду (Starfall и др.).',
    req: (m, o) => [eventReq(o, 'cult', 'Идёт встреча культа')],
    compute: ctx => {
      const line = priceLine(ctx, ['STARFALL'], 1);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Starfall сейчас: ${line}. Встреча длится 5 минут реального времени.` } : null;
    },
    drops: ['STARFALL'],
  },
  {
    id: 'carnival', title: 'Carnival (мэр Foxy)', tag: 'Ивенты', mode: 'active',
    desc: 'При мэре Foxy работает Carnival: мини-игры дают Carnival Ticket и очки на улучшения ивентов.',
    req: (m, o) => [{ text: 'Мэр сейчас Foxy', ok: o.mayor ? /foxy/i.test(o.mayor) : false, unknown: !o.mayor || !/foxy/i.test(o.mayor), have: o.mayor ? tx`сейчас мэр ${o.mayor}` : 'мэр пока неизвестен' }],
    compute: ctx => {
      const line = priceLine(ctx, ['CARNIVAL_TICKET'], 1);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Carnival Ticket сейчас: ${line}.` } : null;
    },
  },
  {
    id: 'hoppity-rabbits', title: 'Hoppity: кролики фракций', tag: 'Ивенты', mode: 'active',
    desc: 'Во время Hoppity\'s Hunt можно получить кроликов фракций (Faction Rabbits) — они продаются на аукционе по несколько миллионов.',
    req: (m, o) => [eventReq(o, 'hoppity', "Идёт Hoppity's Hunt")],
    compute: ctx => {
      const ids = [...(ctx.items?.keys?.() || [])].filter(id => id.startsWith('FACTION_RABBIT_'));
      const line = priceLine(ctx, ids, 5);
      return line ? { coinsPerHour: null, sourceText: 'цены по живым данным', detail: tx`Дороже всего сейчас: ${line}.` } : null;
    },
  },
);
const extraDrops = { jerry: ['JERRY_BOX_GOLDEN', 'JERRY_BOX_PURPLE', 'FROZEN_BAUBLE'], 'foraging-galatea': ['FIGSTONE', 'MANGCORE', 'MOONGLADE_JEWEL', 'WOOD_SINGULARITY'], pests: ['OVERGROWN_GRASS', 'PESTHUNTING_GUIDE'] };
for (const [id, list] of Object.entries(extraDrops)) { const d = MISC_METHODS.find(x => x.id === id); if (d) d.drops = [...new Set([...(d.drops || []), ...list])]; }

const ev = (what, sell) => ({
  effort: 'focus', risk: 'low', xp: 'Опыт Combat и прогресс ивента',
  steps: [tx`Дождись ивента: ${what}. Сайт показывает, сколько осталось до начала.`, 'Участвуй, пока ивент идёт: награды копятся только в это время.', sell],
  risks: ['Во время ивента предложение растёт и цены падают: продавай частями или чуть позже.'],
});
Object.assign(MISC_DETAILS, {
  'crop-rare-drops': {
    effort: 'semi', risk: 'low', xp: 'Опыт Farming',
    steps: ['Надень хотя бы 2 части брони, которая даёт нужный дроп: Tater — Cropie, Cropie — Squash, Squash — Fermento; Fermento и Helianthus дают все.', 'Фарми культуру под этот дроп: Cropie с пшеницы, моркови, картофеля; Squash с тыквы, арбуза, какао; Fermento с тростника, кактуса, грибов, нароста.', 'Продавай ордером на Bazaar или оставь себе на следующий сет брони.'],
    risks: ['Части разных сетов не складываются: 2 Cropie + 2 Squash не дают бонус 4/4.', 'Цена падает, когда выходят патчи на фермерскую броню.'],
  },
  greenhouse: {
    effort: 'semi', risk: 'mid', xp: 'Опыт Garden',
    steps: ['Открой Greenhouse на участке Garden (с 7 уровня Garden).', 'Сажай культуры рядом так, чтобы выросла нужная мутация: условия видно через Plant Diagnostics Tool.', 'Продавай дорогие мутации на Bazaar, остальное — на Garden Chips или себе.'],
    risks: ['Мутации растут не сразу и не всегда.', 'Рынок у редких мутаций маленький.'],
  },
  'mushroom-desert': {
    effort: 'semi', risk: 'low', xp: 'Опыт Farming',
    steps: ['Иди в Mushroom Desert или поставь мицелий и красный песок на участке Garden.', 'Копай лопатой с Efficiency, сжимай в Enchanted-формы.', 'Продавай в той форме, где цена за блок выше.'],
    risks: ['Доход маленький: способ для коллекции и рецептов Garden.'],
  },
  'galatea-gather': {
    effort: 'semi', risk: 'low', xp: 'Опыт Foraging и HotF',
    steps: ['На Galatea собирай то, что сайт показывает самым ценным за штуку.', 'Сжимай в Enchanted-формы, если так выгоднее.', 'Редкие дропы (Figstone, Mangcore, Moonglade Jewel) продавай отдельно.'],
    risks: ['Где что растёт (вики): Lushlilac — у фиговых деревьев в North, South и West Reaches и на Evergreen Plateau, Tender Wood — в верхней части Moonglade Marsh, Vinesap — в нижней.'],
  },
  'foraging-park': {
    effort: 'semi', risk: 'low', xp: 'Опыт Foraging',
    steps: ['Возьми Treecapitator или Jungle Axe.', 'Руби в The Park то дерево, которое сейчас дороже.', 'Сжимай брёвна в Enchanted и продавай на Bazaar.'],
    risks: ['Денег мало: на Galatea выгоднее.'],
  },
  'galatea-coupons': {
    effort: 'daily', risk: 'low', xp: 'Опыт Foraging',
    steps: ['Поговори со Swoop, David Hunterborough и Kysha в деревне Galatea, потом с Agatha в Moonglade Marsh (нужен Foraging 12).', 'Каждый час 20 минут идёт конкурс: руби Fig и Mangrove, лови существ, собирай Lushlilac — за всё дают очки.', 'Купоны продавай на Bazaar или трать в магазине Agatha (Fig/Mangrove Fortune, Moonglade-аксессуары).'],
    risks: ['Цена купона падает, когда много игроков продают одновременно.', 'Брэкеты очков Hypixel уже менял дважды (июль и август 2025).'],
  },
  'shards-combat': {
    effort: 'focus', risk: 'low', xp: 'Опыт Combat и Hunting',
    steps: ['Выбери дорогой осколок из списка и найди моба в гайде Hunting.', 'Лови моба Black Hole или бей с активной солью.', 'Продавай осколки на Bazaar ордером.'],
    risks: ['Дорогие осколки падают с сильных боссов: нужна экипировка.'],
  },
  'attribute-fusion': {
    effort: 'semi', risk: 'mid', xp: 'Опыт Hunting',
    steps: ['Найди в гайде Hunting рецепт сплава для дорогого осколка.', 'Купи два исходных осколка на Bazaar, если вместе они дешевле результата.', 'Сплавь их в Fusion House и продай результат.'],
    risks: ['Сплав не всегда даёт нужный осколок, если в рецепте есть выбор.', 'Цены осколков быстро меняются.'],
  },
  'npc-to-market': {
    effort: 'semi', risk: 'low', xp: 'Опыта нет, только монеты',
    steps: ['Найди NPC из списка и купи у него товар.', 'Продай на Bazaar ордером или выставь на аукцион.', 'Повторяй, пока разница держится.'],
    risks: ['Разницу быстро выкупают другие игроки.', 'У NPC может быть дневной лимит покупок.'],
  },
  'pet-level-flip': {
    effort: 'semi', risk: 'mid', xp: 'Опыт питомца и Taming',
    steps: ['Купи питомца 1 уровня из списка.', 'Качай его, пока делаешь обычные дела: опыт идёт от навыка, под который питомец подходит.', 'Ускорь Exp Share и предметами опыта, если они окупаются.', 'Продай питомца 100 уровня на аукционе.'],
    risks: ['Прокачка до 100 занимает много часов.', 'Цена питомца может упасть, пока качаешь.'],
  },
  'traveling-zoo': ev('Бродячий зоопарк, 2 раза в год', 'Купи у Oringo питомца, который сайт показывает выгодным, и выставь на аукцион.'),
  'year-witch': ev('Year of the Witch, раз в несколько лет SkyBlock', 'Ингредиенты продавай на Bazaar или вари зелья у Agnes, если так выгоднее.'),
  'great-spook': ev('Хэллоуин в SkyBlock', 'Руны и предметы продавай на аукционе.'),
  'new-year': { effort: 'daily', risk: 'low', xp: 'Опыта нет', steps: ['В Новый год SkyBlock забери торт у Baker в Hub.', 'Храни торты в New Year Cake Bag или продай коллекционерам.'], risks: ['Свежие торты стоят мало: дорожают с годами.'] },
  cult: { effort: 'daily', risk: 'low', xp: 'Опыта нет', steps: ['Будь в Dwarven Mines, когда начинается встреча культа.', 'Подойди к культистам и забери награду.'], risks: ['Встреча всего 5 минут реального времени.'] },
  carnival: ev('мэр Foxy и его Carnival', 'Трать очки на улучшения ивентов или продавай Carnival Ticket.'),
  'hoppity-rabbits': ev("Hoppity's Hunt весной SkyBlock", 'Rabbits фракций, которые тебе не нужны, продавай на аукционе.'),
});
