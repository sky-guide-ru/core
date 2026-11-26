// Коллекции: тиры, сколько до следующего, что откроет следующий тир (рецепты, миньоны, бонусы).
//   GET /api/collections — разбор коллекций выбранного игрока (свой профиль, друг или гость по нику)
// Тиры берутся из ресурса Hypixel /v2/resources/skyblock/collections (грузится при старте сервера);
// пока он не пришёл — из снимка data/resource.json, чтобы раздел не был пустым.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tx } from '../../i18n/msg.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let snapshot = null;
let live = null;

export function setCollectionsResource(resp) { if (resp?.collections) live = resp; }
export function collectionsResource() {
  if (live) return live;
  if (!snapshot) { try { snapshot = JSON.parse(fs.readFileSync(path.join(here, 'data', 'resource.json'), 'utf8')); } catch { snapshot = { collections: {} }; } }
  return snapshot;
}

export const CATEGORY_RU = { FARMING: 'Farming', MINING: 'Mining', COMBAT: 'Combat', FORAGING: 'Foraging', FISHING: 'Fishing', RIFT: 'Rift' };
export const CATEGORY_ICON = { FARMING: 'GOLD_HOE', MINING: 'STONE_PICKAXE', COMBAT: 'STONE_SWORD', FORAGING: 'JUNGLE_SAPLING', FISHING: 'FISHING_ROD', RIFT: 'RIFT_PRISM' };
const SKILL_RU = { Farming: 'Farming', Mining: 'Mining', Combat: 'Combat', Foraging: 'Foraging', Fishing: 'Fishing', Alchemy: 'Alchemy', Hunting: 'Hunting', Enchanting: 'Enchanting' };

// ID коллекции → предмет для иконки и ссылки (коллекции с «:» в NEU пишутся через «-»)
const ICON_FIX = { MUSHROOM_COLLECTION: 'RED_MUSHROOM', GEMSTONE_COLLECTION: 'ROUGH_RUBY_GEM', MYCEL: 'MYCEL', SULPHUR_ORE: 'SULPHUR_ORE' };
export const collectionItemId = id => ICON_FIX[id] || String(id).replace(':', '-');

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
export const roman = n => ROMAN[n] || String(n);

/** Индекс «английское имя → ID» по базе NEU, чтобы рецепты из наград были ссылками на карточку предмета. */
let nameIdx = null, nameIdxSize = -1;
function nameIndex(items) {
  if (!items?.size) return new Map();
  if (nameIdx && nameIdxSize === items.size) return nameIdx;
  nameIdx = new Map();
  for (const it of items.values()) {
    if (!it?.name || /;|_GENERATOR_\d+$|^PET_SKIN_/.test(it.id)) continue;
    const k = it.name.toLowerCase();
    // При совпадении имён выигрывает «чистый» ID (без цифр-вариантов)
    if (!nameIdx.has(k) || (/-\d+$/.test(nameIdx.get(k)) && !/-\d+$/.test(it.id))) nameIdx.set(k, it.id);
  }
  nameIdxSize = items.size;
  return nameIdx;
}

/** Строка награды тира → { kind, ru, item? }. */
export function parseUnlock(text, items) {
  const t = String(text || '').trim();
  let r;
  if ((r = /^(.+) Minion Recipes?$/.exec(t))) {
    const gen = minionGenFor(r[1], items);
    return { kind: 'minion', ru: tx`Рецепты миньона ${r[1]}`, name: tx`${r[1]} Minion`, item: gen ? tx`${gen}_1` : null, gen };
  }
  if ((r = /^\+([\d,]+) SkyBlock XP$/.exec(t))) return { kind: 'xp', ru: tx`+${r[1]} SkyBlock XP`, xp: Number(r[1].replace(/,/g, '')) };
  if ((r = /^\+([\d,]+) (\w+) Experience$/.exec(t))) return { kind: 'skillxp', ru: tx`+${r[1]} опыта ${SKILL_RU[r[2]] || r[2]}` };
  if ((r = /^(.+) Exp Discount \(-(\d+)%\)$/.exec(t))) return { kind: 'perk', ru: tx`Зачарование ${r[1]} на ${r[2]}% дешевле по опыту` };
  if ((r = /^(.+) Trade$/.exec(t))) return { kind: 'perk', ru: tx`Обмен у торговцев: ${r[1]}`, item: nameIndex(items).get(r[1].toLowerCase()) || null };
  if ((r = /^(.+) Upgrade \(\+(\d+) slots\)$/.exec(t))) return { kind: 'perk', ru: tx`${r[1]}: +${r[2]} слотов` };
  if ((r = /^\+(\d+) (\w+) Level Cap$/.exec(t))) return { kind: 'perk', ru: tx`+${r[1]} к максимальному уровню ${SKILL_RU[r[2]] || r[2]}` };
  if ((r = /^(.+) Recipes?$/.exec(t))) {
    const id = nameIndex(items).get(r[1].toLowerCase()) || null;
    return { kind: 'recipe', ru: r[1], name: r[1], item: id };
  }
  return { kind: 'perk', ru: t, item: nameIndex(items).get(t.toLowerCase()) || null };
}

/** «Wheat» → WHEAT_GENERATOR (по имени «Wheat Minion I» в NEU, иначе по ID). */
const genCache = new Map();
function minionGenFor(name, items) {
  if (genCache.has(name)) return genCache.get(name);
  let gen = null;
  if (items?.size) {
    for (const it of items.values()) {
      if (/_GENERATOR_1$/.test(it.id) && it.name?.toLowerCase() === tx`${name} minion i`.toLowerCase()) { gen = it.id.replace(/_1$/, ''); break; }
    }
  }
  if (!gen) gen = tx`${name.toUpperCase().replace(/[^A-Z]+/g, '_')}_GENERATOR`;
  if (items?.size) genCache.set(name, gen);
  return gen;
}

/**
 * Разбор коллекций игрока.
 * @param m участник из parseMember (collections, unlockedCollTiers, coop)
 * @param o { resource?, items?, name? }
 */
export function analyzeCollections(m, o = {}) {
  const res = o.resource || collectionsResource();
  const items = o.items;
  const own = m?.collections || {};
  const coopCols = m?.coop?.collections || null;
  const unlocked = new Map();
  for (const s of m?.unlockedCollTiers || []) {
    const r = /^(.+)_(\d+)$/.exec(s);
    if (r) unlocked.set(r[1], Math.max(unlocked.get(r[1]) || 0, Number(r[2])));
  }
  const apiOff = !Object.keys(own).length && !unlocked.size;

  const categories = [];
  const all = [];
  for (const [catId, cat] of Object.entries(res.collections || {})) {
    const list = [];
    for (const [id, it] of Object.entries(cat.items || {})) {
      const tiers = (it.tiers || []).slice().sort((a, b) => a.tier - b.tier);
      const mine = Number(own[id] || 0);
      const amount = Math.max(mine, Number(coopCols?.[id] || 0));
      let tier = 0;
      for (const t of tiers) if (amount >= t.amountRequired) tier = t.tier;
      tier = Math.max(tier, unlocked.get(id) || 0);
      const max = it.maxTiers || tiers.length;
      const nextT = tiers.find(t => t.tier === tier + 1) || null;
      const prevReq = tiers.find(t => t.tier === tier)?.amountRequired || 0;
      const entry = {
        id, cat: catId, name: it.name, icon: collectionItemId(id),
        amount, mine, coopShare: coopCols && amount ? mine / amount : null,
        tier, max, maxed: tier >= max,
        next: nextT ? {
          tier: nextT.tier, need: nextT.amountRequired, left: Math.max(0, nextT.amountRequired - amount),
          progress: Math.max(0, Math.min(1, (amount - prevReq) / Math.max(1, nextT.amountRequired - prevReq))),
          unlocks: nextT.unlocks.map(u => parseUnlock(u, items)).filter(u => u.kind !== 'xp'),
        } : null,
        tiers: o.full ? tiers.map(t => ({ tier: t.tier, need: t.amountRequired, done: t.tier <= tier, unlocks: t.unlocks.map(u => parseUnlock(u, items)).filter(u => u.kind !== 'xp') })) : undefined,
        started: amount > 0 || tier > 0,
      };
      list.push(entry); all.push(entry);
    }
    categories.push({
      id: catId, ru: CATEGORY_RU[catId] || cat.name || catId, icon: CATEGORY_ICON[catId] || null,
      total: list.length, maxed: list.filter(e => e.maxed).length,
      tiers: list.reduce((s, e) => s + e.tier, 0), tiersMax: list.reduce((s, e) => s + e.max, 0),
      items: list.map(e => e.id),
    });
  }

  // Ближе всего к следующему тиру: доля пути пройдена, а не «осталось штук» (у разных коллекций разный масштаб)
  const close = all.filter(e => e.next && e.started).sort((a, b) => b.next.progress - a.next.progress).slice(0, 12).map(e => e.id);
  // Следующий тир откроет рецепт миньона — это ещё и новые уникальные крафты (слоты)
  const minionUnlocks = all.filter(e => e.next?.unlocks.some(u => u.kind === 'minion')).sort((a, b) => (b.next.progress - a.next.progress)).map(e => e.id);
  const notStarted = all.filter(e => !e.started).map(e => e.id);

  const tiers = all.reduce((s, e) => s + e.tier, 0);
  const tiersMax = all.reduce((s, e) => s + e.max, 0);
  return {
    status: apiOff ? 'off' : 'ok',
    coop: m?.coop ? { members: m.coop.members.length, hidden: m.coop.members.filter(x => !x.collectionsApi).length } : null,
    total: all.length, maxed: all.filter(e => e.maxed).length, tiers, tiersMax,
    // Каждый тир коллекции даёт +4 SkyBlock XP
    sbXp: tiers * 4, sbXpMax: tiersMax * 4,
    categories,
    entries: all,
    close, minionUnlocks, notStarted,
    source: live ? 'hypixel' : 'snapshot',
    version: res.version || null,
  };
}

/** Короткая сводка (для «Обзора» и советчика). */
export function collectionsSummary(m, o) {
  const a = analyzeCollections(m, o);
  const byId = new Map(a.entries.map(e => [e.id, e]));
  return { status: a.status, total: a.total, maxed: a.maxed, tiers: a.tiers, tiersMax: a.tiersMax, close: a.close.slice(0, 3).map(id => { const e = byId.get(id); return { id, name: e.name, tier: e.tier, left: e.next?.left }; }) };
}

