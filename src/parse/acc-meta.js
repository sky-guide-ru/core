// Аксессуары: что даёт, как получить, место в линейке, требования рецепта и шаги плана «что сделать дальше».
// Чистые функции над базой NEU и ценами — их зовёт analyzeAccessories (server/parse/gear.js).
import { neu } from '../neu.js';
import { prices, buyPriceOf, priceOf } from '../prices.js';
import { indexNeu, reqRu } from '../analysis/obtain.js';
import { checkCrafttext, collectionsFromNeu } from '../market/requirements.js';
import { darkAuctionOf } from '../analysis/dark-auction.js';

const ORDER = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
export const up1 = r => ORDER[Math.min(ORDER.indexOf(r) + 1, 5)] || r;
export const ENRICH_ID = 'ACCESSORY_ENRICHMENT';

// Строка лора «Strength: +3» → ключ фильтра «Что даёт»; берём первую строку со статом
const STAT_KEYS = [
  [/^(Strength)$/, 'str'], [/^(Crit Damage)$/, 'cd'], [/^(Crit Chance)$/, 'cc'], [/^(Intelligence)$/, 'int'],
  [/^(Health|Vitality|Health Regen)$/, 'hp'], [/^(Defense|True Defense)$/, 'def'], [/^(Speed)$/, 'speed'],
  [/^(Magic Find|Pet Luck)$/, 'mf'], [/^(Sea Creature Chance|Fishing Speed|Treasure Chance|Trophy Fish Chance)$/, 'fish'],
  [/^(Farming Fortune|Farming Wisdom)$/, 'farm'], [/^(Mining Speed|Mining Fortune|Pristine)$/, 'mining'],
  [/^(Ferocity|Bonus Attack Speed|Attack Speed)$/, 'atk'],
];
const strip = s => String(s || '').replace(/§./g, '').trim();
export function statOf(item) {
  for (const line of item?.lore || []) {
    const m = /^([A-Z][A-Za-z ]+?): ?[+-]?[\d.,]+%?/.exec(strip(line));
    if (!m) continue;
    const k = STAT_KEYS.find(([re]) => re.test(m[1]));
    if (k) return k[1];
  }
  return 'util';
}

// Как получить: у NPC за монеты, крафт, выбить с моба, Dark Auction, иначе — купить (Bazaar или аукцион)
export function howOf(id) {
  const idx = indexNeu(neu.items);
  if (darkAuctionOf(id)) return 'da';
  if ((idx.npc.get(id) || []).some(o => o.cost.every(c => c.id === 'SKYBLOCK_COIN'))) return 'npc';
  if (idx.craft.has(id) || idx.forge.has(id)) return 'craft';
  if (idx.drops.has(id)) return 'drop';
  if (idx.npc.has(id) || idx.trade.has(id)) return 'npc';
  if (prices.bazaar.has(id)) return 'bazaar';
  return 'ah';
}

let collMemo = null;
function collections() {
  if (!collMemo || collMemo.items !== neu.items) collMemo = { items: neu.items, map: collectionsFromNeu(neu.items) };
  return collMemo.map;
}

// Требование рецепта, которое игрок ещё не выполнил (текст по-русски) или null
export function reqOf(id, member) {
  const it = neu.items.get(id);
  if (!it || !member) return null;
  const sl = /^([A-Z]+)_(\d+)$/.exec(it.slayer_req || '');
  const text = [String(it.crafttext || '').replace(/^Requires:?\s*/i, '').trim(), sl ? `${sl[1][0]}${sl[1].slice(1).toLowerCase()} Slayer ${sl[2]}` : '']
    .filter(Boolean).join(' & ');
  if (!text) return null;
  const r = checkCrafttext(text, member, collections());
  return r.missing.length ? reqRu(r.missing.join(' & ')) : null;
}

// Место в линейке: [номер, всего] — Talisman → Ring → Artifact → Relic
export function tierOf(id, up, coveredBy) {
  const lower = coveredBy(id, up).size;
  return [lower + 1, lower + 1 + (up[id] || []).length];
}

/**
 * Шаги «что сделать дальше»: купить недостающий, поднять tier, Recombobulator, Accessory Enrichment.
 * cost — монеты (null, если цены нет), gain — +MP; у Enrichment gain 0 и tuning 1.
 */
export function accSteps({ list, missing, mpBy }) {
  const steps = [];
  const recombPrice = buyPriceOf('RECOMBOBULATOR_3000') || priceOf('RECOMBOBULATOR_3000') || null;
  const enrichPrice = buyPriceOf(ENRICH_ID) || priceOf(ENRICH_ID) || null;
  // недостающие: по одному на семейство — самый дешёвый за 1 MP
  const fam = new Map();
  for (const r of missing) {
    if (!r.price || r.upgradeFrom) continue; // апгрейд своего — это шаг «tier»
    const key = [...(r.family || [r.id])].sort()[0];
    const cur = fam.get(key);
    if (!cur || r.price / r.gain < cur.price / cur.gain) fam.set(key, r);
  }
  for (const r of fam.values()) steps.push({ kind: 'buy', id: r.id, name: r.name, rarity: r.rarity, cost: r.price, gain: r.gain, how: r.how, stat: r.stat, req: r.req || null });
  for (const a of list) {
    if (!a.active) continue;
    if (a.next) {
      const nr = a.recomb ? up1(a.next.rarity) : a.next.rarity;
      const gain = (mpBy[nr] || 0) - a.mp;
      const full = buyPriceOf(a.next.id) || 0;
      // младшую из Museum или Soulbound не продать — без вычета
      const cost = full ? Math.max(full - (a.sellable === false ? 0 : a.value || 0), full * 0.1) : null;
      if (gain > 0) steps.push({ kind: 'tier', id: a.id, name: a.next.name, target: a.next.id, from: a.name, rarity: nr, cost, gain });
    }
    if (a.canRecomb) steps.push({ kind: 'recomb', id: a.id, name: a.name, rarity: a.rarity, to: up1(a.rarity), cost: recombPrice, gain: (mpBy[up1(a.rarity)] || 0) - (mpBy[a.rarity] || 0) });
    if (a.canEnrich && !a.enrichment) steps.push({ kind: 'enrich', id: a.id, name: a.name, rarity: a.rarity, cost: enrichPrice, gain: 0, tuning: 1 });
  }
  const per = s => s.gain > 0 && s.cost ? s.cost / s.gain : Infinity;
  steps.sort((x, y) => per(x) - per(y) || (x.cost || Infinity) - (y.cost || Infinity));
  return { steps, enrichPrice };
}
