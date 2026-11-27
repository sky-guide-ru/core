// Пошаговое получение предмета: у какого NPC и где купить, что нужно открыть, из чего крафтить
// (дерево ингредиентов с живыми ценами и тем, где взять каждый), с кого выбить и с каким шансом.
// Чистая функция над базой NEU: buildObtainGuide(id, ctx) → { wiki, methods[], cheapest }.
//
// ctx: {
//   items: Map<id, Item>        — server/neu.js neu.items (разобранные предметы NEU),
//   constants: object           — neu.constants (islands.json для названий островов и варпов),
//   buy(id) → { price, market: 'bazaar'|'ah', count?, order? } | null — цена покупки сейчас,
//   member?: Member             — профиль выбранного игрока (проверка требований),
//   collections?: Map           — пороги коллекций (market/requirements.js collectionsByName),
//   noMarket?: boolean          — профиль без рынка (Ironman, Stranded, Bingo): без Bazaar, аукциона и Dark Auction,
// }

import fs from 'node:fs';
import { ISLANDS, fmtCoins, fmtDuration } from '../items-ru/lib/glossary.js';
import { checkCrafttext, fixCrafttext, roman } from '../market/requirements.js';
import { RIFT_COLLECTIONS, riftCollectionByName } from '../rift/collections.js';
import { englishName } from '../names.js';
import { SLAYER_COST, SLAYER_INFO, MASTER_REQ } from '../guides/combat/data.js';
import { tx } from '../../i18n/msg.js';
import { darkAuctionOf } from './dark-auction.js';
import { ownedPool, takeOwned } from '../lib/owned.js';

const strip = s => String(s || '').replace(/§./g, '').trim();
const SLOTS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export const WIKI_BASE = 'https://hypixelskyblock.minecraft.wiki';

/** "ENCHANTED_DIAMOND:32" / "SKYBLOCK_COIN:8.0" → { id, count } */
export function parseCount(s) {
  const str = String(s || '');
  const i = str.lastIndexOf(':');
  if (i <= 0) return { id: str, count: 1 };
  const n = Number(str.slice(i + 1));
  return Number.isFinite(n) ? { id: str.slice(0, i), count: n } : { id: str, count: 1 };
}

// Валюты в магазинах NPC: как называется и откуда берётся
const CURRENCY = {
  SKYBLOCK_COIN: { ru: 'монет', coins: true },
  SKYBLOCK_BIT: { ru: 'Bits', how: 'Bits начисляются, пока активен Booster Cookie; тратятся в Community Shop у Elizabeth (Hub)' },
  SKYBLOCK_BITS: { ru: 'Bits', how: 'Bits начисляются, пока активен Booster Cookie; тратятся в Community Shop у Elizabeth (Hub)' },
  SKYBLOCK_COPPER: { ru: 'Copper', how: 'Copper дают посетители Garden (Visitors) за выполненные заказы' },
  SKYBLOCK_MOTE: { ru: 'Motes', how: 'Motes — валюта Rift: за мобов, продажу предметов и задания в Rift' },
  SKYBLOCK_PELT: { ru: 'Pelts', how: 'Pelts дают за охоту на животных по заданиям Trevor в Mushroom Desert' },
  SKYBLOCK_NORTH_STAR: { ru: 'North Stars', how: 'North Stars дают в Jerry\'s Workshop во время Season of Jerry' },
  SKYBLOCK_GEMS: { ru: 'SkyBlock Gems', how: 'SkyBlock Gems покупаются за реальные деньги в магазине Hypixel' },
};
const currencyOf = id => CURRENCY[id] || (/^SKYBLOCK_/.test(id) ? { ru: id.replace(/^SKYBLOCK_/, '').toLowerCase().replace(/_/g, ' ') } : null);

// ---------- индексы по базе NEU (строятся один раз на загрузку базы) ----------
const cache = new WeakMap();
export function indexNeu(items) {
  if (cache.has(items)) return cache.get(items);
  const idx = { craft: new Map(), forge: new Map(), npc: new Map(), drops: new Map(), kat: new Map(), trade: new Map() };
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const grid = r => {
    const cnt = new Map();
    for (const k of SLOTS) if (r[k]) { const c = parseCount(r[k]); cnt.set(c.id, (cnt.get(c.id) || 0) + c.count); }
    return [...cnt].map(([id, count]) => ({ id, count }));
  };
  for (const it of items.values()) {
    const crafts = [];
    if (it.recipe) crafts.push({ ...it.recipe, type: 'crafting' });
    for (const r of it.recipes || []) {
      if (r.type === 'crafting') crafts.push(r);
      else if (r.type === 'forge') push(idx.forge, r.overrideOutputId || it.id, { inputs: (r.inputs || []).map(parseCount), duration: r.duration || 0, count: r.count || 1, crafttext: it.crafttext });
      else if (r.type === 'npc_shop') {
        const res = parseCount(r.result);
        push(idx.npc, res.id, { npc: it.id, count: res.count || 1, cost: (r.cost || []).map(parseCount) });
      } else if (r.type === 'drops') {
        for (const d of [...(r.drops || []), ...(r.drops || []).flatMap(x => x.alternatives || [])]) {
          const did = parseCount(d.id).id;
          push(idx.drops, did, { mob: it.id, name: strip(r.name) || it.name, level: r.level || null, chance: chanceRu(d.chance), panorama: r.panorama || null, coins: r.coins || 0, amount: dropAmount(d) || wikiDropAmount(it, items.get(did)?.name) });
        }
      } else if (r.type === 'katgrade') push(idx.kat, r.output, { input: parseCount(r.input).id, coins: r.coins || 0, time: r.time || 0, items: (r.items || []).map(parseCount) });
      else if (r.type === 'trade') {
        const res = parseCount(r.result);
        push(idx.trade, res.id, { npc: /_NPC$/.test(it.id) ? it.id : null, cost: [parseCount(r.cost)], count: res.count || 1 });
      }
    }
    const seen = new Set();
    for (const r of crafts) {
      const out = r.overrideOutputId || it.id;
      const inputs = grid(r);
      const key = out + JSON.stringify(inputs);
      if (seen.has(key)) continue;
      seen.add(key);
      push(idx.craft, out, { inputs, count: r.count || 1, grid: r, crafttext: out === it.id ? it.crafttext : '', slayerReq: out === it.id ? it.slayer_req : null });
    }
  }
  cache.set(items, idx);
  return idx;
}

// ---------- места ----------
export function islandRu(key, constants) {
  if (!key) return null;
  return ISLANDS[key] || constants?.islands?.area_names?.[key] || key;
}

/** Ближайший варп к точке на острове: { warp, dist } */
export function nearestWarp(island, x, z, constants) {
  const warps = (constants?.islands?.island_warps || []).filter(w => w.mode === island);
  if (island === 'hub') warps.unshift({ warp: 'hub', x: -3, z: -70 }); // точка появления в Hub
  let best = null;
  for (const w of warps) {
    const d = x == null ? 0 : Math.hypot(w.x - x, w.z - z);
    if (!best || d < best.dist) best = { warp: w.warp, dist: Math.round(d) };
  }
  return best;
}

// Основной телепорт острова (варпы из NEU islands.json + /warp hub и /warp garden)
const MAIN_WARP = { hub: 'hub', combat_1: 'spider', combat_3: 'end', crimson_isle: 'nether', mining_1: 'gold', mining_2: 'deep', mining_3: 'mines', farming_1: 'barn', foraging_1: 'park', dungeon_hub: 'dungeon_hub', garden: 'garden' };

// Сезонные и особые места: когда туда вообще можно попасть
const ISLAND_NOTE = {
  winter: 'Jerry\'s Workshop открыт только в месяц Late Winter (зима SkyBlock): попасть туда можно через порталы в Hub.',
  rift: 'В Rift попадают через портал в Wizard Tower в Hub (нужен Rift-доступ).',
  dungeon: 'Это данж: заходи через Dungeon Hub (/warp dungeon_hub), группу собирают в Party Finder.',
  kuudra: 'Kuudra — босс-бой на Crimson Isle, заходят у NPC Elle в Dragontail.',
  dynamic: 'Встречается на личном острове и в обычных местах обитания этого моба.',
};

// ---------- контекст источника дропа: этаж данжа, тир слеера, Sea Creature, ивент ----------
const DUNGEON_BOSS = { BONZO_BOSS: 1, SCARF_BOSS: 2, PROFESSOR_BOSS: 3, THORN_BOSS: 4, LIVID_BOSS: 5, SADAN_BOSS: 6, NECRON_BOSS: 7 };
const SLAYER_BOSS = { REVENANT_HORROR: 'zombie', TARANTULA_BROODFATHER: 'spider', SVEN_PACKMASTER: 'wolf', VOIDGLOOM_SERAPH: 'enderman', INFERNO_DEMONLORD: 'blaze', RIFTSTALKER_BLOODFIEND: 'vampire' };
const SLAYER_GUIDE = { zombie: 'slayer-zombie', spider: 'slayer-spider', wolf: 'slayer-wolf', enderman: 'slayer-enderman', blaze: 'slayer-blaze', vampire: 'slayer-vampire' };
const DIANA = /^(MINOS_|MINOTAUR_|GAIA_CONSTRUCT_|SIAMESE_LYNXES_|HARPY_|SPHINX_|STRANDED_NYMPH_|CRETAN_BULL_|MANTICORE_|KING_MINOS_)/;
const SPOOKY = /^(HEADLESS_HORSEMAN|TRICK_OR_TREATER|WITHER_GOURD|PHANTOM_SPIRIT|SCARY_JERRY|CRAZY_WITCH|WRAITH)_/;
const SPOOKY_SC = /^(SCARECROW|NIGHTMARE|WEREWOLF|PHANTOM_FISHER|GRIM_REAPER)_SC$/;
const SHARK_SC = /^(NURSE|BLUE|TIGER|GREAT_WHITE)_SHARK_SC$/;
const DRAGONS = /_ENDER_DRAGON_BOSS$/;
const JERRY = /^(GREEN|BLUE|PURPLE|GOLDEN)_JERRY_CREATURE$/;

/**
 * Что это за источник и что нужно, чтобы до него добраться.
 * @returns {{ how: string, req?: string, ok?: boolean|null, guide?: string, event?: string }}
 */
export function mobContext(mobId, name, member) {
  let m;
  const isMaster = /Master Mode/i.test(name || '');
  if (DUNGEON_BOSS[mobId]) {
    const f = DUNGEON_BOSS[mobId];
    const floor = isMaster ? tx`M${f}` : tx`F${f}`;
    const out = { how: tx`Босс этажа ${floor} в Catacombs${isMaster ? ' (Master Mode — усложнённые этажи)' : ''}. Предмет лежит в сундуках награды после победы над боссом (чем выше оценка рана, тем лучше сундуки).`, guide: 'dungeons' };
    const d = member?.dungeons;
    if (isMaster) {
      // Master Mode открывается после F7, каждый следующий M — после предыдущего; плюс уровень Catacombs
      out.req = tx`Catacombs ${MASTER_REQ[f]} и пройденный ${f === 1 ? 'F7 — без него Master Mode закрыт' : tx`M${f - 1}`}`;
      if (d) {
        const lvl = d.catacombs?.level || 0;
        const prev = f === 1 ? Number(d.floors?.['7'] || 0) : Number(d.masterFloors?.[String(f - 1)] || 0);
        out.ok = lvl >= MASTER_REQ[f] && prev > 0;
        out.have = tx`у тебя Catacombs ${lvl}${prev > 0 ? '' : tx`, ${f === 1 ? 'F7' : tx`M${f - 1}`} ещё не пройден`}`;
      }
    } else {
      out.req = f > 1 ? tx`победа на F${f - 1}` : 'пройти Entrance';
      if (d) {
        const done = Number(d.floors?.[String(f)] || 0), prev = Number(d.floors?.[String(f - 1)] || 0);
        out.ok = done > 0 || prev > 0;
        out.have = done > 0 ? tx`ты проходил ${floor} ${done} раз` : prev > 0 ? tx`F${f - 1} пройден — ${floor} открыт` : tx`F${f - 1} ещё не пройден`;
      }
    }
    return out;
  }
  if ((m = /^(.+)_(\d)_BOSS$/.exec(mobId)) && SLAYER_BOSS[m[1]]) {
    const key = SLAYER_BOSS[m[1]], tier = Number(m[2]);
    const info = SLAYER_INFO[key] || {};
    const costs = SLAYER_COST[key] || SLAYER_COST.default;
    const cost = costs[tier - 1];
    const cur = key === 'vampire' ? 'Motes' : 'монет';
    const out = {
      how: tx`Slayer-босс ${info.title || name} ${ROMAN[tier]}: квест берут ${key === 'vampire' ? 'у Maddox the Slayer в Rift (Stillgore Château)' : 'у Maddox the Slayer (Hub, или по Maddox Batphone)'}${cost ? tx`, квест стоит ${fmtCoins(cost)} ${cur}` : ''}. Где бить: ${info.where || 'по месту обитания босса'}.`,
      guide: SLAYER_GUIDE[key],
    };
    const unlock = info.unlock && !/сразу/.test(info.unlock) ? info.unlock.replace(/^Нужен /, '') : null;
    const parts = [unlock, key === 'zombie' && tier === 5 ? 'Zombie Slayer 7' : null].filter(Boolean);
    if (parts.length) out.req = parts.join(', ');
    const sl = member?.slayers?.[key];
    if (sl) out.have = tx`у тебя ${info.ru ? tx`слеер «${info.ru}»` : key} ${sl.level || 0} ур.`;
    if (member && key === 'zombie' && tier === 5) out.ok = (sl?.level || 0) >= 7;
    return out;
  }
  if (DRAGONS.test(mobId)) return { how: 'Дракон Энда: призывается на Dragon\'s Nest в The End, когда игроки кладут 8 Summoning Eye в алтарь. Награда зависит от вклада в урон.' };
  if (DIANA.test(mobId)) return { how: 'Моб Mythological Ritual: появляется из грифоновых нор (Griffin Burrow), которые ищут с Ancestral Spade.', event: 'Только пока мэр — Diana (ивент Mythological Ritual).' };
  if (SPOOKY.test(mobId)) return { how: 'Моб Spooky Festival.', event: 'Только во время Spooky Festival (осень SkyBlock).' };
  if (SPOOKY_SC.test(mobId)) return { how: 'Sea Creature Spooky Festival: ловится удочкой.', event: 'Только во время Spooky Festival.' };
  if (SHARK_SC.test(mobId)) return { how: 'Акула Fishing Festival: ловится удочкой.', event: 'Только во время Fishing Festival (мэр Marina или перк Fishing Festival).' };
  if (JERRY.test(mobId)) return { how: 'Jerry, который выпрыгивает из удочки или кирки.', event: 'Только при мэре Jerry (перк Jerrypocalypse).' };
  if (/_SC$/.test(mobId)) return { how: 'Sea Creature: ловится удочкой в этой локации.' };
  if (/^SKYBLOCK_CORPSE_/.test(mobId)) return { how: 'Труп в Glacite Mineshaft: открывается ключом, лут — из трупа.' };
  if (/_GIFTS$/.test(mobId)) return { how: 'Подарок, который падает при рубке деревьев на Galatea.' };
  if (/_MINIBOSS$/.test(mobId)) return { how: 'Мини-босс.' };
  return { how: '' };
}

/**
 * Сколько штук падает за раз: из подписи NEU «Drop Count: x20-35» или из id ("ESSENCE_CRIMSON:25").
 * @returns {{ min: number, max: number }|null}  null — в базе не указано (обычно 1 шт.)
 */
export function dropAmount(d) {
  for (const e of d?.extra || []) {
    const m = /Drop Count:\s*x?\s*([\d.,]+)(?:\s*[-–]\s*([\d.,]+))?/i.exec(strip(e));
    if (m) {
      const a = Number(m[1].replace(',', '.')), b = Number((m[2] || m[1]).replace(',', '.'));
      if (Number.isFinite(a) && Number.isFinite(b)) return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  const m = /:(\d+(?:\.\d+)?)$/.exec(String(d?.id || ''));
  if (m && Number(m[1]) > 0) return { min: Number(m[1]), max: Number(m[1]) };
  return null;
}
// Запасной источник количества — вики (fandom), когда в NEU его нет: data/wiki-drop-counts.json
const WIKI_COUNTS = JSON.parse(fs.readFileSync(new URL('./data/wiki-drop-counts.json', import.meta.url), 'utf8'));
/** Количество по странице моба на вики: страница из NEU info (…/w/Title), с учётом перенаправлений */
export function wikiDropAmount(mob, itemName) {
  const url = (mob?.info || []).find(u => /\/w\//.test(u));
  if (!url || !itemName) return null;
  let title = decodeURIComponent(url.split('/w/')[1] || '').replace(/_/g, ' ').replace(/#.*$/, '');
  title = WIKI_COUNTS.redirects[title] || title;
  const name = strip(itemName);
  const m = WIKI_COUNTS.multi[title]?.[name];
  if (m) return { min: m[0], max: m[1], src: 'wiki' };
  if (WIKI_COUNTS.ones[title]?.includes(name)) return { min: 1, max: 1, src: 'wiki' };
  return null;
}
const fmtNum = n => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
/** «×25», «×20–35» */
export const amountRu = a => a ? tx`×${a.min === a.max ? fmtNum(a.min) : tx`${fmtNum(a.min)}–${fmtNum(a.max)}`}` : '';
/** «×20–35 · шанс 100%» */
export const dropLabel = (amount, chance) => [amountRu(amount), chance ? tx`шанс ${chance}` : ''].filter(Boolean).join(' · ');

const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };

// «.01% per Summoning Eye» из NEU → «0.01% за каждый Summoning Eye»
const chanceRu = c => (c ? String(c).replace(/(^|[^\d])\.(\d)/g, '$10.$2').replace(/\s+per\s+(.+)$/i, ' за каждый $1') : null);
const chanceNum = c => {
  const m = /([\d.,]+)\s*%/.exec(String(c || ''));
  return m ? parseFloat(m[1].replace(',', '.')) : null;
};

// ---------- дерево ингредиентов ----------
/**
 * Самый дешёвый способ получить count штук: купить, взять у NPC за монеты или скрафтить.
 * @returns {Node} { id, name, count, unit, total, via, viaRu, children?, alt? }
 */
export function costTree(id, count, ctx, depth = 0, seen = new Set(), budget = { n: 0 }) {
  const { items } = ctx;
  const idx = indexNeu(items);
  const name = englishName(id, items);
  const node = { id, name, count, unit: null, total: null, via: 'none', viaRu: '' };
  budget.n++;
  // «есть X / нужно Y»: сколько уже есть у игрока — инвентарь, рюкзаки, эндер-сундук, гардероб, мешки, питомцы
  // (ctx.stock — общий запас на всё дерево способа, lib/owned.js ownedPool)
  const { have, where } = takeOwned(ctx.stock, id, count);
  const need = count - have;
  const cur = currencyOf(id);
  if (cur) {
    if (cur.coins) Object.assign(node, { name: 'Монеты', unit: 1, total: count, via: 'coins', viaRu: 'монеты' });
    else Object.assign(node, { via: 'currency', viaRu: cur.how || cur.ru, name: cur.ru });
    return node;
  }
  const opts = [];
  const mk = ctx.buy(id);
  if (mk?.price) opts.push({ via: mk.market, unit: mk.price, viaRu: mk.market === 'bazaar' ? 'Bazaar' : 'аукцион' });
  const npcCoin = (idx.npc.get(id) || []).filter(o => o.cost.length && o.cost.every(c => c.id === 'SKYBLOCK_COIN'));
  for (const o of npcCoin) {
    const npc = items.get(o.npc);
    opts.push({ via: 'npc', unit: o.cost.reduce((s, c) => s + c.count, 0) / (o.count || 1), viaRu: tx`NPC ${npc?.name?.replace(/\s*\(NPC\)$/, '') || o.npc}${npc?.island ? tx` (${islandRu(npc.island, ctx.constants)})` : ''}`, npc: o.npc });
  }
  const recipe = (idx.craft.get(id) || [])[0] || null;
  let craft = null;
  if (recipe && depth < 3 && !seen.has(id) && budget.n < 160) {
    const s2 = new Set(seen).add(id);
    // ингредиенты — только на то, чего не хватает (если всё есть в запасах, считаем цену за штуку на 1 крафт)
    const times = Math.max(1, Math.ceil((need || 0) / (recipe.count || 1)));
    const keepStock = ctx.stock;
    if (!need) ctx.stock = null; // всё есть — запасы на ингредиенты не тратим
    const children = recipe.inputs.map(c => costTree(c.id, c.count * times, ctx, depth + 1, s2, budget));
    const priced = children.every(c => c.total != null);
    const sum = children.reduce((s, c) => s + (c.total || 0), 0);
    ctx.stock = keepStock;
    craft = { via: 'craft', unit: priced ? sum / (times * (recipe.count || 1)) : null, viaRu: 'крафт', children: need ? children : null, partial: !priced, crafttext: fixCrafttext(recipe.crafttext, name, ctx.collections) };
  }
  const priced = opts.filter(o => o.unit != null).sort((a, b) => a.unit - b.unit);
  let best = priced[0] || null;
  if (craft && craft.unit != null && (!best || craft.unit < best.unit * 0.97)) best = craft;
  if (!best && craft) best = craft; // цены нет, но рецепт есть — покажем, из чего собирать
  if (best) {
    Object.assign(node, { via: best.via, viaRu: best.viaRu, unit: best.unit, total: best.unit != null ? best.unit * count : null });
    if (best.npc) node.npc = best.npc;
    if (best === craft) { node.children = craft.children; if (craft.partial) node.partial = true; if (craft.crafttext) node.reqRu = reqRu(craft.crafttext); }
    // альтернатива, если крафт заметно дешевле или дороже покупки
    if (best !== craft && craft?.unit != null) node.alt = { via: 'craft', unit: craft.unit, viaRu: 'скрафтить' };
    else if (best === craft && priced[0]) node.alt = { via: priced[0].via, unit: priced[0].unit, viaRu: priced[0].viaRu };
  } else {
    // ни рынка, ни рецепта: подсказываем лучший источник
    const drop = bestDrop(id, idx);
    const npcAny = (idx.npc.get(id) || [])[0];
    const rift = RIFT_COLLECTIONS[id];
    if (rift) Object.assign(node, { via: 'rift', viaRu: rift.short, rift: true });
    else if (drop) { const l = dropLabel(drop.amount, drop.chance); Object.assign(node, { via: 'drop', viaRu: tx`выпадает с ${drop.name}${l ? tx` (${l})` : ''}` }); }
    else if (npcAny) Object.assign(node, { via: 'npc', viaRu: tx`NPC ${items.get(npcAny.npc)?.name?.replace(/\s*\(NPC\)$/, '') || npcAny.npc} за ${costLine(npcAny.cost, items)}` });
    else if (idx.forge.get(id)) Object.assign(node, { via: 'forge', viaRu: 'Forge в Dwarven Mines' });
    else Object.assign(node, { viaRu: 'нет цены и рецепта — смотри карточку предмета' });
  }
  if (have > 0) { node.have = have; node.need = need; node.from = where.map(([p, n]) => (where.length > 1 || n < have ? tx`${p} ×${n}` : p)).join(' · '); }
  // сколько докупить на эту строку с учётом запасов (для крафта — по ингредиентам)
  if (have > 0 || (node.children || []).some(c => c.rest != null)) node.rest = Math.round(restCost(node));
  return node;
}

/** Запасы игрока для одного способа: каждая вещь (из любого хранилища, мешков и питомцев) берётся один раз на всё дерево. */
export function stockPool(member) {
  return ownedPool(member);
}

/** Сколько ещё докупить с учётом запасов: покрытое запасом — 0, крафт — по ингредиентам, остальное — по цене за штуку. */
export function restCost(n) {
  if (!n || n.via === 'coins') return n?.total || 0;
  const need = n.need ?? n.count;
  if (!need) return 0;
  if (n.via === 'craft' && n.children) return n.children.reduce((s, c) => s + restCost(c), 0);
  return n.unit != null ? n.unit * need : 0;
}

/** Сколько монет экономят свои запасы на этом способе (0 — запасы не пригодились). */
export function stockSaving(tree) {
  const all = sumTotal(tree);
  if (all == null || !tree.some(function has(n) { return n.have > 0 || (n.children || []).some(has); })) return 0;
  return Math.max(0, Math.round(all - tree.reduce((s, n) => s + restCost(n), 0)));
}

function bestDrop(id, idx) {
  const list = idx.drops.get(id) || [];
  return list.slice().sort((a, b) => (chanceNum(b.chance) ?? -1) - (chanceNum(a.chance) ?? -1))[0] || null;
}

export function costLine(cost, items) {
  return cost.map(c => {
    const cur = currencyOf(c.id);
    if (cur) return tx`${fmtCoins(c.count)} ${cur.ru}`;
    return tx`${c.count}× ${englishName(c.id, items)}`;
  }).join(' + ');
}

// "Requires: String IV & HotM 3" → «коллекция String IV и Heart of the Mountain 3»
export function reqRu(crafttext, slayerReq) {
  let t = String(crafttext || '').replace(/^Requires:?\s*/i, '').trim();
  if (!t && slayerReq) {
    const m = /^([A-Z]+)_(\d+)$/.exec(slayerReq);
    if (m) t = tx`${m[1][0]}${m[1].slice(1).toLowerCase()} Slayer ${m[2]}`;
  }
  if (!t) return null;
  return t.split(/\s*&\s*/).map(s => {
    let m;
    if ((m = /^(\w+) Slayer (\d+)$/.exec(s))) return tx`${m[1]} Slayer ${m[2]}`;
    if ((m = /^HotM (\d+)$/i.exec(s))) return tx`Heart of the Mountain ${m[1]}`;
    if ((m = /^HotF (\d+)$/i.exec(s))) return tx`Heart of the Forest ${m[1]}`;
    if ((m = /^(.+) ([IVXLC]+)$/.exec(s))) return riftCollectionByName(m[1]) ? tx`коллекция Рифта ${m[1]} ${m[2]}` : tx`коллекция ${m[1]} ${m[2]}`;
    return s;
  }).join(' и ');
}

function reqStatus(crafttext, slayerReq, ctx) {
  const text = reqRu(crafttext, slayerReq);
  if (!text) return null;
  const raw = crafttext || (() => { const m = /^([A-Z]+)_(\d+)$/.exec(slayerReq || ''); return m ? tx`${m[1][0]}${m[1].slice(1).toLowerCase()} Slayer ${m[2]}` : ''; })();
  const out = { text };
  // коллекции Рифта мало кто знает: объясняем, что это и где копить
  const rifts = String(raw).replace(/^Requires:?\s*/i, '').split(/\s*&\s*/)
    .map(p => { const m = /^(.+?)\s+([IVXLC]+)$/.exec(p.trim()); const c = m && riftCollectionByName(m[1]); return c ? { c, tier: roman(m[2]) } : null; })
    .filter(Boolean);
  if (rifts.length) {
    out.hint = rifts.map(({ c, tier }) => {
      const need = ctx.collections?.get(c.name.toLowerCase())?.tiers?.[tier - 1];
      return tx`Это коллекция Рифта: тир ${ROMAN[tier] || tier} открывается, когда соберёшь ${need ? tx`${need.toLocaleString('ru-RU')} шт. ${c.name}` : c.name} (считаются только добытые самому, покупать их негде). ${c.how}${c.tools ? ` ${c.tools}` : ''}`;
    }).join(' ');
    out.guide = 'rift';
  }
  if (ctx.member) {
    const r = checkCrafttext(raw, ctx.member, ctx.collections || null);
    out.ok = r.ok;
    if (r.missing.length) out.missing = r.missing.map(s => reqRu(s));
    out.have = haveText(raw, ctx);
  }
  return out;
}

// «у тебя: String III (12 400 шт.)», «у тебя Zombie Slayer 5»
function haveText(raw, ctx) {
  const m = ctx.member;
  const parts = [];
  for (const part of String(raw).replace(/^Requires:?\s*/i, '').split(/\s*&\s*/)) {
    const mm = /^(.+?)\s+([IVXLC]+|\d+)$/.exec(part.trim());
    if (!mm) continue;
    const name = mm[1];
    const sl = /^(\w+) Slayer$/i.exec(name);
    if (/^HotM$/i.test(name)) parts.push(tx`HotM ${m.mining?.hotm?.level || 0}`);
    else if (sl) {
      const key = { zombie: 'zombie', revenant: 'zombie', spider: 'spider', tarantula: 'spider', wolf: 'wolf', sven: 'wolf', enderman: 'enderman', voidgloom: 'enderman', blaze: 'blaze', vampire: 'vampire' }[sl[1].toLowerCase()];
      if (key) parts.push(tx`${sl[1]} Slayer ${m.slayers?.[key]?.level || 0}`);
    } else if (ctx.collections) {
      const c = ctx.collections.get(name.toLowerCase());
      if (!c) continue;
      const tiers = (m.unlockedCollTiers || []).filter(t => t.startsWith(c.id + '_')).map(t => Number(t.slice(c.id.length + 1))).filter(Number.isFinite);
      const tier = tiers.length ? Math.max(...tiers) : 0;
      const have = Number(m.collections?.[c.id] || 0);
      const need = c.tiers?.[roman(mm[2]) - 1];
      parts.push(tx`${name} ${tier ? ROMAN[tier] || tier : '0'} (${have.toLocaleString('ru-RU')}${need ? tx` из ${need.toLocaleString('ru-RU')}` : ''} шт.)`);
    }
  }
  return parts.length ? tx`у тебя: ${parts.join(', ')}` : null;
}

function npcPlace(npcId, ctx) {
  const npc = ctx.items.get(npcId);
  if (!npc) return { name: npcId };
  const name = npc.name.replace(/\s*\((NPC|Monster)\)$/i, '');
  const coords = npc.x != null ? [npc.x, npc.y, npc.z] : null;
  const warp = npc.island ? nearestWarp(npc.island, npc.x, npc.z, ctx.constants) : null;
  return { id: npcId, name, island: npc.island, islandRu: islandRu(npc.island, ctx.constants), coords, warp, note: ISLAND_NOTE[npc.island] || null };
}

function goSteps(place) {
  const steps = [];
  if (place.islandRu) {
    const w = place.warp ? tx` — ближайший телепорт: /warp ${place.warp.warp}` : '';
    steps.push({ text: tx`Отправляйся: ${place.islandRu}${w}.`, note: place.note || undefined });
  }
  steps.push({ text: tx`Найди NPC ${place.name}${place.coords ? tx` — координаты X ${place.coords[0]}, Y ${place.coords[1]}, Z ${place.coords[2]}` : ''}.` });
  return steps;
}

function costParts(cost, ctx, times = 1) {
  const c2 = { ...ctx, stock: stockPool(ctx.member) };
  return cost.map(c => costTree(c.id, c.count * times, c2, 1));
}
const sumTotal = parts => parts.every(p => p.total != null) ? parts.reduce((s, p) => s + p.total, 0) : null;

// ---------- главная функция ----------
/**
 * @param {string} id
 * @param {object} ctx см. шапку файла
 */
export function buildObtainGuide(id, ctx) {
  // Ironman, Stranded, Bingo (ctx.noMarket): нет Bazaar, аукциона и Dark Auction — только NPC, крафт, Forge, дроп.
  // Покупку на рынке убираем и из способов, и из дерева ингредиентов: что NPC не продаёт, добывается самому
  if (ctx.noMarket) ctx = { ...ctx, buy: () => null };
  const { items } = ctx;
  const idx = indexNeu(items);
  const it = items.get(id);
  const name = englishName(id, items);
  const methods = [];

  // 1. Рынок
  const mk = ctx.buy(id);
  if (mk?.price) {
    if (mk.market === 'bazaar') {
      methods.push({
        kind: 'market', market: 'bazaar', title: 'Купить на Bazaar', total: mk.price, quote: quoteOfBuy(mk),
        steps: [
          { text: 'Открой Bazaar: команда /bz (нужен активный Booster Cookie) или NPC Bazaar в Hub.' },
          { text: tx`Найди «${name}» поиском и купи сразу (кнопка «Buy Instantly») — сейчас ${fmtCoins(mk.price)} монет за штуку.` },
          ...(mk.order ? [{ text: tx`Дешевле — выставить заявку на покупку (кнопка «Create Buy Order»): примерно ${fmtCoins(mk.order)} за штуку, но придётся подождать, пока кто-то продаст.` }] : []),
          ...(mk.sell ? [{ text: tx`Продать сразу (кнопка «Sell Instantly») можно за ${fmtCoins(mk.sell)} за штуку, после налога Bazaar ~${fmtCoins(mk.sellNet)}.` }] : []),
        ],
      });
    } else {
      methods.push({
        kind: 'market', market: 'ah', title: 'Купить на аукционе', total: mk.price, quote: quoteOfBuy(mk), ...(mk.noLots ? { noLots: true } : {}),
        steps: [
          { text: 'Открой аукцион: команда /ah (нужен Booster Cookie) или Auction Master в Hub.' },
          mk.noLots
            ? { text: tx`Сейчас BIN-лотов с «${name}» нет, но вещь продаётся: за неделю ${fmtNum(mk.sold7 || 0)} шт., в среднем по ${fmtCoins(mk.price)}. Загляни позже — новые лоты появляются регулярно.` }
            : { text: tx`Найди «${name}» и выбери лот с пометкой BIN (Buy It Now) — самый дешёвый сейчас ${fmtCoins(mk.price)}${mk.count ? tx`, всего лотов: ${mk.count}` : ''}.` },
          { text: 'Проверь в описании лота зачарования, реформу и звёзды: дешёвый лот часто «голый».' },
          ...(mk.sell && !mk.noLots ? [{ text: mk.sellFrom === 'sales'
            ? tx`Продать: такие лоты недавно уходили в среднем за ${fmtCoins(mk.sell)}, после комиссий аукциона ~${fmtCoins(mk.sellNet)}.`
            : mk.sellFrom === 'cap'
              ? tx`Продать: дороже самого дешёвого лота (${fmtCoins(mk.sell)}) не уйдёт, после комиссий аукциона ~${fmtCoins(mk.sellNet)}. Дорогие продажи — это копии с улучшениями.`
              : tx`Продать: следующий по цене лот стоит ${fmtCoins(mk.sell)}, после комиссий аукциона ~${fmtCoins(mk.sellNet)}.` }] : []),
        ],
      });
    }
  }

  // 1б. Dark Auction: лотов и цен в API нет — только то, что предмет там бывает, и минимальная ставка
  const da = ctx.noMarket ? null : darkAuctionOf(id);
  if (da) {
    methods.push({
      kind: 'dark-auction', title: da.darker ? 'Dark Auction (только при мэре Scorpius)' : 'Выиграть на Dark Auction', total: null, minBid: da.minBid,
      steps: [
        { text: 'Dark Auction проходит каждый час в :55 (раз в 3 дня SkyBlock). Вход — у NPC Sirius в Wilderness (Hub, координаты 91 75 176), в кошельке нужно от 400 000 монет.' },
        { text: tx`«${name}» выпадает не каждый раз: за аукцион выходит ${da.darker ? '8' : '5'} случайных лотов${da.darker ? ', а этот предмет бывает только с перком Darker Auctions мэра Scorpius' : ''}. Ставка — от ${fmtCoins(da.minBid)}.` },
        ...(mk?.price ? [{ text: tx`Сравни с аукционом: там сейчас от ${fmtCoins(mk.price)}. Ставки на Dark Auction часто уходят выше.` }] : []),
      ],
    });
  }

  // 2. NPC
  for (const o of (idx.npc.get(id) || []).slice(0, 4)) {
    const place = npcPlace(o.npc, ctx);
    const parts = costParts(o.cost, ctx);
    const total = sumTotal(parts);
    methods.push({
      kind: 'npc', title: tx`Купить у NPC ${place.name}`, total, fromStock: stockSaving(parts) || undefined, place,
      steps: [
        ...goSteps(place),
        { text: tx`Открой его магазин (ПКМ) и купи «${name}»${o.count > 1 ? tx` (${o.count} шт. за раз)` : ''} за ${costLine(o.cost, items)}.`, items: parts },
      ],
    });
  }

  // 3. Крафт
  for (const r of (idx.craft.get(id) || []).slice(0, 2)) {
    const req = reqStatus(fixCrafttext(r.crafttext, name, ctx.collections), r.slayerReq, ctx);
    const tctx = { ...ctx, stock: stockPool(ctx.member) };
    const tree = r.inputs.map(c => costTree(c.id, c.count, tctx, 1, new Set([id])));
    const total = sumTotal(tree);
    const steps = [];
    if (req) steps.push({ text: tx`Открой рецепт: ${req.text}.`, req });
    steps.push({ text: 'Собери ингредиенты (у каждого указано, где выгоднее взять):', tree });
    steps.push({ text: tx`Скрафти в меню крафта SkyBlock (SkyBlock Menu → Crafting Table) или на верстаке${r.count > 1 ? tx` — выйдет ${r.count} шт.` : ''}.` });
    methods.push({ kind: 'craft', title: 'Скрафтить', total: total != null ? total / (r.count || 1) : null, fromStock: Math.round(stockSaving(tree) / (r.count || 1)) || undefined, req, steps, grid: r.grid, ...(req?.guide ? { guide: req.guide } : {}) });
  }

  // 4. Forge
  for (const r of (idx.forge.get(id) || []).slice(0, 2)) {
    const tree = r.inputs.map(c => costTree(c.id, c.count, { ...ctx, stock: stockPool(ctx.member) }, 1, new Set([id])));
    const req = reqStatus(r.crafttext, null, ctx);
    const steps = [];
    if (req) steps.push({ text: tx`Нужно: ${req.text}.`, req });
    steps.push({ text: 'Собери ингредиенты:', tree });
    steps.push({ text: 'Иди в The Forge в Dwarven Mines — телепорт /warp forge.' });
    steps.push({ text: tx`Положи всё в свободный слот Forge и жди ${fmtDuration(r.duration)}. Перк Quick Forge в Heart of the Mountain сокращает время.` });
    methods.push({ kind: 'forge', title: 'Выковать в Forge', total: sumTotal(tree), fromStock: stockSaving(tree) || undefined, req, steps, duration: r.duration });
  }

  // 5. Улучшение питомца у Kat
  for (const r of (idx.kat.get(id) || []).slice(0, 1)) {
    const place = npcPlace('KAT_NPC', ctx);
    const parts = costParts([{ id: 'SKYBLOCK_COIN', count: r.coins }, ...r.items], ctx);
    const prev = items.get(r.input);
    const prevBuy = ctx.buy(r.input);
    const pet = { ...costTree(r.input, 1, { ...ctx, stock: stockPool(ctx.member) }, 1, new Set([id])), name: prev?.name || r.input };
    if (!prevBuy && !pet.have) Object.assign(pet, { via: 'none', viaRu: '' });
    const all = [pet, ...parts];
    methods.push({
      kind: 'kat', title: 'Повысить редкость питомца у Kat', total: sumTotal(parts) != null ? sumTotal(parts) + (prevBuy?.price || 0) : null, fromStock: stockSaving(all) || undefined, place,
      steps: [
        { text: tx`Нужен питомец редкостью ниже: ${prev?.name || r.input}${prevBuy?.price && !pet.have ? tx` (на аукционе от ${fmtCoins(prevBuy.price)})` : ''}.`, items: [pet] },
        ...goSteps(place),
        { text: tx`Отдай питомца и заплати ${costLine([{ id: 'SKYBLOCK_COIN', count: r.coins }, ...r.items], items)}.`, items: parts },
        { text: tx`Жди ${fmtDuration(r.time)} (можно ускорить у Kat за Flower).` },
      ],
    });
  }

  // 6. Дропы: по мобу, сначала самые вероятные
  const drops = (idx.drops.get(id) || []).slice();
  const byMob = new Map();
  for (const d of drops) {
    const k = d.mob + '|' + d.name;
    const prev = byMob.get(k);
    if (!prev) byMob.set(k, { ...d, levels: d.level ? [d.level] : [] });
    else if (d.level && !prev.levels.includes(d.level)) prev.levels.push(d.level);
  }
  const mobs = [...byMob.values()].sort((a, b) => (chanceNum(b.chance) ?? -1) - (chanceNum(a.chance) ?? -1)).slice(0, 5);
  for (const d of mobs) {
    const c = mobContext(d.mob, d.name, ctx.member);
    const pct = chanceNum(d.chance);
    const where = islandRu(d.panorama, ctx.constants);
    const warp = MAIN_WARP[d.panorama] ? { warp: MAIN_WARP[d.panorama] } : null;
    const steps = [];
    if (c.how) steps.push({ text: c.how });
    const slayer = c.guide && c.guide.startsWith('slayer-');
    if (where && !DUNGEON_BOSS[d.mob] && !slayer) steps.push({ text: tx`Где: ${where}${warp ? tx` (телепорт /warp ${warp.warp})` : ''}.`, note: ISLAND_NOTE[d.panorama] || undefined });
    if (c.req) steps.push({ text: tx`Нужно: ${c.req}.`, req: { text: c.req, ok: c.ok ?? null, have: c.have } });
    else if (c.have) steps.push({ text: c.have[0].toUpperCase() + c.have.slice(1) + '.' });
    if (c.event) steps.push({ text: c.event, warn: true });
    const lv = d.levels.sort((a, b) => a - b);
    const tries = pct && pct < 100 ? Math.max(1, Math.round(100 / pct)) : null;
    const boss = !!DUNGEON_BOSS[d.mob];
    const amt = d.amount ? tx` по ${amountRu(d.amount).slice(1)} шт.` : '';
    steps.push({ text: boss
      ? tx`Проходи этаж: ${amt ? tx`падает${amt}, ` : ''}шанс ${d.chance || 'не указан'}${tries ? tx` — в среднем ~${tries.toLocaleString('ru-RU')} ${plural(tries, 'ран', 'рана', 'ранов')} на один дроп` : ''}.`
      : tx`${slayer ? 'Побеждай' : 'Убивай'} ${d.name}${lv.length && !slayer ? tx` (ур. ${lv.join('/')})` : ''}: ${amt ? tx`падает${amt}, ` : ''}шанс ${d.chance || 'не указан'}${tries ? tx` — в среднем ~${tries.toLocaleString('ru-RU')} ${slayer ? plural(tries, 'босс', 'босса', 'боссов') : plural(tries, 'убийство', 'убийства', 'убийств')} на один дроп` : ''}.` });
    // сколько в среднем приносит один заход по цене рынка — чтобы сравнить с покупкой
    // без известного количества оценку не показываем: подставленная «1 шт.» врёт для дропа пачками (Revenant Flesh и т.п.)
    const per = pct != null && d.amount ? (d.amount.min + d.amount.max) / 2 * pct / 100 : null;
    if (per && mk?.price) {
      const what = boss ? 'один ран' : slayer ? 'один босс' : 'одно убийство';
      steps.push({ text: tx`В среднем ${what} даёт ~${fmtNum(per >= 10 ? Math.round(per) : Math.round(per * 100) / 100)} шт. — это ~${fmtCoins(per * mk.price)} монет по цене ${mk.market === 'bazaar' ? 'Bazaar' : 'аукциона'}.${per < 1 ? (mk.noLots ? tx` На аукционе 1 шт. уходит в среднем за ${fmtCoins(mk.price)}.` : tx` Купить 1 шт. сейчас стоит ${fmtCoins(mk.price)}.`) : ''}` });
    }
    if (pct != null && pct < 5 && !DUNGEON_BOSS[d.mob]) steps.push({ text: 'Редкий дроп: Magic Find (питомцы, броня, зелья) повышает шанс.' });
    methods.push({ kind: 'drop', title: tx`Выбить с ${d.name}`, chance: d.chance, amount: d.amount || null, amountRu: amountRu(d.amount) || null, perRun: per, mob: d.mob, guide: c.guide, island: d.panorama, steps });
  }

  // 6б. Предмет коллекции Рифта: на рынке его нет, добывается только руками
  const rc = RIFT_COLLECTIONS[id];
  if (rc) {
    const c = ctx.collections?.get(rc.name.toLowerCase());
    const have = ctx.member ? Number(ctx.member.collections?.[c?.id || id] || 0) : null;
    const steps = [
      { text: 'Отправляйся в Рифт через портал в Wizard Tower в Hub (время внутри ограничено Rift Time).' },
      { text: rc.how },
    ];
    if (rc.tools) steps.push({ text: rc.tools });
    if (c?.tiers?.length) steps.push({ text: tx`Каждая штука идёт в коллекцию Рифта ${rc.name}: тиры на ${c.tiers.map(n => n.toLocaleString('ru-RU')).join(' / ')} шт. открывают рецепты${have != null ? tx`. У тебя сейчас ${have.toLocaleString('ru-RU')} шт.` : '.'}` });
    methods.push({ kind: 'rift', title: tx`Добыть в Рифте (${rc.area})`, guide: 'rift', steps });
  }

  // 7. Обмен (режим Stranded и торговцы)
  for (const r of (idx.trade.get(id) || []).slice(0, 2)) {
    const place = r.npc ? npcPlace(r.npc, ctx) : null;
    methods.push({
      kind: 'trade', title: place ? tx`Обменять у NPC ${place.name}` : 'Обмен (режим Stranded)', place,
      steps: place ? [...goSteps(place), { text: tx`Обменяй ${costLine(r.cost, items)}.` }]
        : [{ text: tx`Только на профиле Stranded: обмен у торговца на ${costLine(r.cost, items)}.`, warn: true }],
    });
  }

  // самый дешёвый способ из тех, где есть цена
  // с учётом того, что уже есть у игрока: докупить меньше — выгоднее
  const priced = methods.filter(m => m.total != null && m.total > 0 && m.kind !== 'trade');
  const left = m => m.total - (m.fromStock || 0);
  const cheapest = priced.sort((a, b) => left(a) - left(b))[0] || null;
  if (cheapest) cheapest.best = true;

  // «~594 тыс..» — сокращение суммы уже кончается точкой
  for (const m of methods) for (const st of m.steps || []) if (typeof st.text === 'string') st.text = st.text.replace(/(тыс|млн|млрд|трлн)\.\./g, '$1.');
  return { id, name, wiki: wikiLinks(it, name), methods, cheapest: cheapest ? { kind: cheapest.kind, title: cheapest.title, total: cheapest.total } : null };
}

/** Две цены способа «купить на рынке» для строки способа: купить, продать и откуда цена продажи */
function quoteOfBuy(mk) {
  // лотов нет: цена покупки и есть цена недавних продаж — второй раз её не показываем
  if (mk.noLots) return { market: mk.market, buy: mk.price, sell: 0, sellNet: 0, sellFrom: null, lots: 0, sold7: mk.sold7 || 0, noLots: true };
  return { market: mk.market, buy: mk.price, sell: mk.sell || 0, sellNet: mk.sellNet || 0, sellFrom: mk.sellFrom || null, lots: mk.count || 0, sold7: mk.sold7 || 0 };
}

/** Ссылка на вики: страница из NEU (hypixelskyblock.minecraft.wiki), иначе поиск по названию там же */
export function wikiLinks(it, name) {
  const page = (it?.info || []).find(u => /^https:\/\/hypixelskyblock\.minecraft\.wiki\//.test(u)) || (it?.info || []).find(u => /^https?:\/\//.test(u)) || null;
  const clean = String(name || '').replace(/^\[Lvl \{LVL\}\]\s*/, '').replace(/\s*\((NPC|Monster|BOSS|Miniboss|Sea Creature)\)$/i, '');
  const search = `${WIKI_BASE}/index.php?search=${encodeURIComponent(clean)}`;
  return { page, search };
}
