// Ссылки и подсказки в гайдах: находит в тексте гайда названия предметов, сетов, питомцев, NPC, мобов,
// мест и механик и отдаёт клиенту словарь guide.refs. Сами данные гайда не меняются: клиент сам
// подчёркивает найденные фразы (клик по предмету — карточка, наведение — короткая подсказка).
//
// guide.refs = {
//   phrases: { 'Shark Scale Armor': 'i:SHARK_SCALE_CHESTPLATE', 'Хотспота': 't:hotspot', 'Roddy': 'n:RODDY_NPC', … },
//   data: { 'i:ID': { kind:'item', id, name, rarity, hint }, 't:key' | 'n:ID' | 'm:ID': { kind, title, text, how?, where?, warp?, items? } },
// }
// Плюс два улучшения прямо в данных: пустые ячейки «Откуда / Как получить» заполняются способом получения
// предмета строки, а шаги «Что делать» получают item + how (как достать главный предмет шага).

import { indexNeu, islandRu, nearestWarp, costLine, reqRu } from '../analysis/obtain.js';
import { GLOSSARY } from './glossary.js';
import { CREATURES } from './fishing-data.js';
import { buildTerms } from './terms.js';
import { tx } from '../../i18n/msg.js';

const strip = s => String(s || '').replace(/§./g, '').trim();
const normQ = s => s.replace(/[’`]/g, '\'');
const ENTITY = { NPC: 'n', Monster: 'm', 'Sea Creature': 'm', Boss: 'm', Miniboss: 'm', Creature: 'm', Mayor: 'n' };
const RARITY_RANK = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5 };
// Слова, которые совпадают с названием предмета, но в тексте почти всегда значат другое
export const STOP = new Set(['Speed', 'Strength', 'Defense', 'Health', 'Intelligence', 'Ferocity', 'Magic Find', 'Mining', 'Fishing', 'Farming', 'Foraging', 'Combat',
  'Spirit', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Special', 'Basic', 'Hot', 'Burning', 'Fiery', 'Infernal', 'Wither', 'Crimson', 'Terror', 'Aurora',
  'Fervor', 'Hollow', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Mithril', 'Gemstone', 'Glacite', 'Lapis', 'Umber', 'Tungsten', 'Vanguard', 'Sweep', 'Collector',
  'Professional', 'Front Loaded', 'Daily Powder', 'Daily Grind', 'Sky Mall', 'Speedy Mineman', 'Powder Buff', 'Strong Arm', 'Steady Hand', 'Surveyor',
  'Metal Head', 'Mining Master', 'Great Explorer', 'Fortunate Mineman', 'Gem Lover', 'Quick Forge', 'Dead Man\'s Chest', 'Gifts from the Departed',
  'Mining Speed', 'Mining Fortune', 'Axe Toss', 'Damage Boost', 'Deep Waters', 'Hunters Luck', 'Luck of the Forest', 'Multi Drop', 'Fuel Cap', 'Cost Reduction',
  'Organic Matter Cap', 'Absorb', 'Dominus', 'Hydra Strike', 'Arcane Energy', 'Night', 'Dark', 'Light', 'Water', 'Lava', 'Ice', 'Fire', 'Shadow', 'Red', 'Blue',
  'Golden', 'Green', 'Purple', 'Pink', 'Black', 'White', 'Super', 'Max', 'Rod', 'Fish', 'Mask', 'Ring', 'Talisman', 'Artifact', 'Bow', 'Sword', 'Pickaxe', 'Drill',
  'Stone', 'Wood', 'Dirt', 'Sand', 'Snow', 'Clay', 'Coal', 'Iron', 'Gravel', 'Wheat', 'Carrot', 'Potato', 'Pumpkin', 'Melon', 'Cactus', 'Bones', 'Bone', 'String',
  'Feather', 'Leather', 'Apple', 'Book', 'Paper', 'Map', 'Compass', 'Clock', 'Arrow', 'Egg', 'Flower', 'Rose', 'Sponge', 'Mole', 'Rabbit', 'Ocelot', 'Monkey',
  'Tiger', 'Elephant', 'Squid', 'Bal', 'Frog', 'Sloth', 'Slug', 'Hedgehog', 'Jerry', 'Pet', 'Hub', 'Forge', 'Storm', 'Necron', 'Goldor', 'Maxor', 'Livid',
  'Thorn', 'Bonzo', 'Scarf', 'Sadan', 'Thunder', 'Kuudra', 'Montezuma', 'Bacte', 'Wizard', 'Enigma', 'Elise', 'Tel Kar', 'Leech Supreme',
]);
// …но в ячейке, которая сама ссылается на предмет, это слово всё равно станет ссылкой на него (см. клиент).

// Чары одним словом, которые в тексте чаще значат другое (с уровнем — «Power V» — подсвечиваются)
const ENCH_BARE_SKIP = new Set(['Power', 'Luck', 'Fortune', 'Experience', 'Chance', 'Rainbow', 'Execute', 'Harvesting', 'Snipe', 'Piercing', 'Cubism', 'Smelting', 'Touch', 'Strike', 'Combo', 'Chimera', 'Duplex', 'Bank', 'Flash', 'Fatal Tempo', 'Swarm', 'Reflection', 'Legion', 'Habanero Tactics', 'Wisdom', 'Inferno']);
const ROMAN_RE = /^(.+?) ([IVX]+)$/;

/** Название предмета для подсказки: у книг чар NEU пишет «Enchanted Book», настоящее имя — в строке лора. */
export function displayOf(it) {
  const name = strip(it?.name).replace(/^\[Lvl \{LVL\}\]\s*/, '');
  if (name === 'Enchanted Book' && /;\d+$/.test(it.id)) {
    const line = (it.lore || []).map(strip).find(l => ROMAN_RE.test(l) && !/^Combinable/.test(l));
    if (line) return line;
  }
  return name;
}

function entryOf(items, constants) {
  // phrase → { ref, pri }; меньше pri — важнее
  const lex = new Map();
  const set = (phrase, ref, pri) => {
    const p = normQ(phrase.trim());
    if (!p || (p.length < 3 && !/^[FM][1-7]$/.test(p))) return;
    const cur = lex.get(p);
    if (!cur || pri < cur.pri) lex.set(p, { ref, pri });
  };
  const petBest = new Map();
  const enchBest = new Map(); // «Sharpness» → самая высокая книга
  for (const it of items.values()) {
    const name = strip(it.name);
    if (!name) continue;
    // Книги чар: «Sharpness V» → книга SHARPNESS;5, просто «Sharpness» → самая высокая книга
    if (name === 'Enchanted Book' && /^[A-Z0-9_]+;\d+$/.test(it.id)) {
      const full = displayOf(it);
      const m = ROMAN_RE.exec(full);
      if (!m) continue;
      set(full, `i:${it.id}`, 1);
      const lvl = Number(it.id.split(';')[1]);
      const cur = enchBest.get(m[1]);
      if (!cur || lvl > cur.lvl) enchBest.set(m[1], { id: it.id, lvl });
      continue;
    }
    const ent = /^(.*?)\s*\(([^)]+)\)$/.exec(name);
    if (ent && ENTITY[ent[2]]) {
      const kind = ENTITY[ent[2]];
      const hasDrops = (it.recipes || []).some(r => r.type === 'drops');
      if ((!STOP.has(ent[1]) || kind === 'n') && ent[1].length >= 4) set(ent[1], `${kind}:${it.id}`, kind === 'n' ? 2 : hasDrops ? 2.1 : 2.6);
      continue;
    }
    if (/^Enchanted Book$|^\d+$|Skin$|^\[/.test(name) && !/^\[Lvl/.test(name)) continue;
    const pet = /^\[Lvl \{LVL\}\]\s*(.+)$/.exec(name);
    if (pet) {
      const [base, rar] = it.id.split(';');
      const r = Number(rar) || 0;
      const cur = petBest.get(pet[1]);
      if (!cur || r > cur.r) petBest.set(pet[1], { id: it.id, r, base });
      continue;
    }
    if (it.id.includes(';')) continue; // книги, руны, тиры — у них своя запись без «;» или они в ячейках по id
    if (/^FACTION_RABBIT_|^SKYBLOCK_|^(CHEST|DESK|BUCKET|BARRIER|BOAT|CAKE|STICK|TNT)$|_COLLECTION$/.test(it.id)) continue;
    // Trophy Fish: «Skeleton Fish BRONZE» → «Skeleton Fish» (бронза), «Obfuscated-3» → и «Obfuscated 3»
    const trophy = /^(.+) (BRONZE|SILVER|GOLD|DIAMOND)$/.exec(name);
    if (trophy) {
      if (trophy[2] === 'BRONZE') { set(trophy[1], `i:${it.id}`, 1); if (trophy[1].includes('-')) set(trophy[1].replace(/-/g, ' '), `i:${it.id}`, 1); }
      continue;
    }
    // Одно слово — только для заметных предметов (не COMMON): иначе «Mushroom», «Bucket», «Emerald» подчёркивались бы везде
    if (!/\s/.test(name) && !(RARITY_RANK[it.rarity] >= 1)) continue;
    let pri = 1;
    if (/_NEW$|^STARRED_|_SKIN|^DUNGEON_|_RIFT$|^RIFT_TROPHY/.test(it.id)) pri = 1.5;
    if (/^Minion|Minion [IVX]+$/.test(name)) pri = 1.4;
    if (!STOP.has(name)) set(name, `i:${it.id}`, pri + it.id.length / 1000);
    const armor = /^(.+?) (Chestplate|Tunic|Shirt)$/.exec(name);
    if (armor) set(`${armor[1]} Armor`, `i:${it.id}`, 1.2 + it.id.length / 1000);
  }
  // Питомцы из одного слова (Wolf, Tarantula, Enderman…) в тексте почти всегда значат моба или слеер — их ссылки дают только ячейки
  for (const [name, p] of petBest) {
    if (!STOP.has(name) && /\s/.test(name)) set(name, `i:${p.id}`, 1.3);
    set(`${name} Pet`, `i:${p.id}`, 1.3); // «Wolf Pet», «Ender Dragon Pet»
  }
  for (const [name, b] of enchBest) if (!STOP.has(name) && !ENCH_BARE_SKIP.has(name)) set(name, `i:${b.id}`, 1.1);
  // Автоматические термины из баз игры (terms.js): статы, скиллы, мэры, острова, слееры, этажи, редкости, reforges, меню
  for (const [key, g] of buildTerms(constants)) for (const n of g.names) set(n, `t:${key}`, 0.5);
  for (const [key, g] of Object.entries(GLOSSARY)) for (const n of g.names) set(n, `t:${key}`, 0);
  // Sea Creatures из гайда рыбалки: у них есть уровень и место, а в NEU — дроп
  for (const c of CREATURES) set(c.name, `c:${c.name}`, 0.9);
  return lex;
}

const lexCache = new WeakMap();
export function lexicon(items, constants = {}) {
  if (!items) return new Map();
  if (!lexCache.has(items)) lexCache.set(items, entryOf(items, constants || {}));
  return lexCache.get(items);
}

// Слова: буквы/цифры, внутри апостроф и дефис («Bonzo's», «Steaming-Hot»)
const WORD = /[\p{L}\p{N}+][\p{L}\p{N}'’\-+]*/gu;
const MAX_WORDS = 7;

/** Все фразы словаря, встретившиеся в строке (жадно, самая длинная с каждой позиции). */
export function findPhrases(text, lex) {
  const s = String(text ?? '');
  const words = [];
  for (const m of s.matchAll(WORD)) words.push({ w: normQ(m[0]).replace(/['\-]+$/, ''), start: m.index, end: m.index + m[0].replace(/['’\-]+$/, '').length });
  const out = [];
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1; n--) {
      // слова фразы должны идти через один пробел или «. » (Mk. II), иначе это разные куски текста
      let ok = true;
      for (let k = i + 1; k < i + n; k++) { const gap = s.slice(words[k - 1].end, words[k].start); if (!/^(\s|\.\s|\s&\s|\s-\s)$/.test(gap)) { ok = false; break; } }
      if (!ok) continue;
      const raw = normQ(s.slice(words[i].start, words[i + n - 1].end));
      const e = lex.get(raw);
      if (e) { hit = { phrase: s.slice(words[i].start, words[i + n - 1].end), ref: e.ref, n }; break; }
    }
    if (hit) { out.push(hit); i += hit.n; } else i++;
  }
  return out;
}

// ---------- данные для подсказок ----------
function shortObtain(id, ctx) {
  const { items, idx } = ctx;
  const nm = x => strip(items.get(x)?.name) || x;
  // Монеты в рецептах NEU — «предмет» SKYBLOCK_COIN: пишем «50 млн монет», а не «50000000× SKYBLOCK_COIN»
  const part = c => (c.id === 'SKYBLOCK_COIN' ? tx`${coinsRu(c.count)} монет` : tx`${c.count}× ${nm(c.id)}`);
  const place = npcId => {
    const npc = items.get(npcId);
    const isl = npc?.island ? islandRu(npc.island, ctx.constants) : null;
    return tx`${nm(npcId).replace(/\s*\(NPC\)$/, '')}${isl ? tx` (${isl})` : ''}`;
  };
  const npc = idx.npc.get(id)?.[0];
  if (npc) return tx`Купить у NPC ${place(npc.npc)} за ${costLine(npc.cost, { get: x => ({ name: nm(x) }) })}`;
  const craft = idx.craft.get(id)?.[0];
  if (craft) {
    const req = reqRu(craft.crafttext, craft.slayerReq);
    return tx`Крафт: ${craft.inputs.slice(0, 4).map(part).join(' + ')}${req ? tx`. Нужно: ${req}` : ''}`;
  }
  const forge = idx.forge.get(id)?.[0];
  if (forge) return tx`Forge: ${forge.inputs.slice(0, 4).map(part).join(' + ')}`;
  const drops = idx.drops.get(id);
  if (drops?.length) {
    const names = [...new Set(drops.map(d => d.name.replace(/\s*\((Monster|Sea Creature|Boss|Miniboss|Creature)\)$/, '')))];
    return tx`Падает с: ${names.slice(0, 3).join(', ')}${names.length > 3 ? tx` и ещё ${names.length - 3}` : ''}`;
  }
  const trade = idx.trade.get(id)?.[0];
  if (trade) return tx`Обмен у NPC${trade.npc ? ` ${place(trade.npc)}` : ''}`;
  const kat = idx.kat.get(id)?.[0];
  if (kat) return tx`Улучшение питомца у Kat из ${nm(kat.input)}`;
  if (ctx.price?.(id) > 0) return 'Покупается на Bazaar или аукционе';
  return '';
}

function itemData(id, ctx) {
  const it = ctx.items.get(id);
  return { kind: 'item', id, name: (it && displayOf(it)) || id, rarity: it?.rarity || null, hint: shortObtain(id, ctx) };
}

function dropsOf(mob) {
  const out = [];
  for (const r of mob.recipes || []) if (r.type === 'drops') for (const d of r.drops || []) {
    const id = String(d.id || '').split(':')[0];
    if (id && !out.includes(id) && !/^SKYBLOCK_/.test(id)) out.push(id);
  }
  return out;
}

function placeOf(it, ctx) {
  if (!it?.island) return {};
  const warp = nearestWarp(it.island, it.x, it.z, ctx.constants);
  return { where: islandRu(it.island, ctx.constants), warp: warp?.warp || null, coords: it.x != null ? [it.x, it.y, it.z] : null };
}

function entityData(ref, ctx) {
  const [kind, id] = [ref[0], ref.slice(2)];
  const it = ctx.items.get(id);
  const title = strip(it?.name).replace(/\s*\([^)]+\)$/, '') || id;
  const lore = (it?.lore || []).map(strip).filter(l => l && !/^Mob Types?:/.test(l));
  if (kind === 'n') {
    const sells = [];
    for (const [out, offers] of ctx.idx.npc) if (offers.some(o => o.npc === id)) { sells.push(out); if (sells.length >= 8) break; }
    const place = placeOf(it, ctx);
    return { kind: 'npc', title, text: lore.join(' ') || (place.where ? tx`Стоит здесь: ${place.where}.` : ''), ...place, items: sells };
  }
  return { kind: 'mob', title, text: lore.slice(0, 4).join(' '), ...placeOf(it, ctx), items: dropsOf(it).slice(0, 8) };
}

function creatureData(name, ctx) {
  const c = CREATURES.find(x => x.name === name);
  const mob = ctx.scByName.get(name);
  const where = c.where;
  return {
    kind: 'mob', title: name,
    text: tx`Sea Creature: клюёт вместо рыбы. Где: ${where}.${c.lvl ? tx` Открывается на Fishing ${c.lvl}.` : ''}${c.cap ? tx` Bestiary: ${c.cap.toLocaleString('ru-RU')} убийств до максимума.` : ''}`,
    how: [/лава/i.test(c.where) ? 'Возьми удочку для лавы и рыбачь в указанном месте.' : 'Рыбачь в указанном месте; Sea Creature Chance повышает шанс.', 'Когда клюнет — убей существо: опыт и дроп идут только за убийство.'],
    items: mob ? dropsOf(mob).slice(0, 8) : [],
  };
}

function termData(key, ctx) {
  const g = GLOSSARY[key] || buildTerms(ctx.constants || {}).get(key);
  const out = { kind: g.kind, title: g.title || g.names[0], text: g.text };
  if (g.how) out.how = g.how;
  if (g.warp) out.warp = g.warp;
  if (g.items) out.items = g.items.filter(id => ctx.items.has(id));
  return out;
}

function dataFor(ref, ctx) {
  const t = ref[0];
  if (t === 'i') return itemData(ref.slice(2), ctx);
  if (t === 't') return termData(ref.slice(2), ctx);
  if (t === 'c') return creatureData(ref.slice(2), ctx);
  return entityData(ref, ctx);
}

// ---------- обход гайда ----------
function eachString(g, fn) {
  const v = x => { if (typeof x === 'string') fn(x); else if (Array.isArray(x)) x.forEach(v); };
  v(g.summary);
  for (const n of g.next || []) { v(n.title); v(n.why); v(n.how); }
  for (const s of g.sections || []) {
    v(s.note); v(s.columns);
    if (s.kind === 'text') v(s.text);
    for (const it of s.items || []) { v(it.title); v(it.text); v(it.hint); }
    for (const r of s.rows || []) for (const c of r) v(c && typeof c === 'object' ? c.text : typeof c === 'string' ? c : null);
  }
  // свои блоки гайдов (Рифт: подсказки к душам и т. п.)
  const deep = (o, d = 0) => {
    if (!o || d > 4) return;
    if (Array.isArray(o)) return o.forEach(x => deep(x, d + 1));
    if (typeof o === 'object') for (const [k, x] of Object.entries(o)) { if (typeof x === 'string' && /^(hint|how|text|note|desc|unlock)$/.test(k)) fn(x); else deep(x, d + 1); }
  };
  deep(g.extra);
}

const FROM_COL = /^(Откуда|Как получить|Где взять|Как получить следующее)$/i;
const EMPTY = c => c == null || c === '' || c === '—' || (typeof c === 'object' && (c.text == null || c.text === '' || c.text === '—'));

/**
 * Добавляет guide.refs, заполняет пустые «Откуда» и подсказывает «как достать» в шагах «Что делать».
 * deps: { items: Map (neu.items), constants, price?(id) }. Без базы NEU работает только словарь механик.
 */
export function enrichGuide(guide, deps = {}) {
  if (!guide || guide.status === 'error') return guide;
  const items = deps.items || new Map();
  const ctx = { items, constants: deps.constants, price: deps.price, idx: indexNeu(items), scByName: scIndex(items) };
  const lex = lexicon(items.size ? items : EMPTY_ITEMS, deps.constants);

  // 1) пустые «Откуда» в таблицах
  for (const s of guide.sections || []) {
    if (s.kind !== 'table') continue;
    const col = (s.columns || []).findIndex(c => FROM_COL.test(c));
    if (col < 0) continue;
    for (const r of s.rows || []) {
      if (!EMPTY(r[col])) continue;
      const id = r.map(c => c && typeof c === 'object' ? c.item : null).find(Boolean);
      const hint = id && items.size ? shortObtain(id, ctx) : '';
      if (hint) r[col] = { text: hint, item: undefined, auto: true };
    }
  }

  // 2) «Что делать»: главный предмет шага и как его достать
  for (const n of guide.next || []) {
    if (n.item || !items.size) continue;
    const hit = findPhrases(n.title, lex).find(h => h.ref.startsWith('i:'));
    if (!hit) continue;
    n.item = hit.ref.slice(2);
    if (!n.how) { const h = shortObtain(n.item, ctx); if (h) n.how = h; }
  }

  // 3) словарь ссылок
  const phrases = {};
  eachString(guide, str => { for (const h of findPhrases(str, lex)) phrases[h.phrase] = h.ref; });
  // предметы ячеек и иконок тоже получают подсказку при наведении
  const extraItems = new Set();
  for (const s of guide.sections || []) {
    for (const r of s.rows || []) for (const c of r) if (c && typeof c === 'object' && c.item) extraItems.add(c.item);
    for (const it of s.items || []) { if (it.item) extraItems.add(it.item); for (const id of it.items || []) extraItems.add(id); }
  }
  for (const n of guide.next || []) if (n.item) extraItems.add(n.item);
  const data = {};
  for (const ref of new Set(Object.values(phrases))) {
    if (ref[0] !== 't' && !items.size) continue;
    try { data[ref] = dataFor(ref, ctx); } catch { /* нет данных — фраза останется текстом */ }
  }
  for (const id of extraItems) if (items.size && !data[tx`i:${id}`]) data[tx`i:${id}`] = itemData(id, ctx);
  for (const [p, ref] of Object.entries(phrases)) if (!data[ref]) delete phrases[p];
  guide.refs = { phrases, data };
  return guide;
}

const EMPTY_ITEMS = new Map();
const scCache = new WeakMap();
function scIndex(items) {
  if (scCache.has(items)) return scCache.get(items);
  const m = new Map();
  for (const it of items.values()) {
    const e = /^(.*?)\s*\(Sea Creature\)$/.exec(strip(it.name));
    if (e && (!m.has(e[1]) || dropsOf(it).length > dropsOf(m.get(e[1])).length)) m.set(e[1], it);
  }
  scCache.set(items, m);
  return m;
}

export { RARITY_RANK, shortObtain };

function coinsRu(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return tx`${+(n / 1e9).toFixed(2)} млрд`.replace('.', ',');
  if (n >= 1e6) return tx`${+(n / 1e6).toFixed(2)} млн`.replace('.', ',');
  if (n >= 1e3) return tx`${+(n / 1e3).toFixed(1)} тыс.`.replace('.', ',');
  return String(n);
}

// ---------- общий словарь для всего сайта ----------
// Клиент грузит его один раз (GET /api/refs/lexicon) и сам подсвечивает термины в любом <Rich text=…/>,
// даже если страница не прислала свои refs. Подсказку для найденного термина он берёт через GET /api/refs/data.
const phrasesCache = new WeakMap();
// Русские слова из словаря гайдов, которые вне своего гайда чаще значат обычное («гости» сайта, «существа» вообще)
const GLOBAL_SKIP = new Set(['гости', 'Гости', 'гостей', 'одолжен', 'одолжено', 'Одолжено', 'особые предметы', 'Особые предметы', 'особых предметов',
  'существ', 'существа', 'существо', 'Существа', 'секреты', 'секретов', 'Секретов', 'Секреты']);
/** Все фразы словаря: { phrase: ref }. */
export function lexiconPhrases(items, constants) {
  if (!items?.size) items = EMPTY_ITEMS;
  if (phrasesCache.has(items)) return phrasesCache.get(items);
  const out = {};
  for (const [p, e] of lexicon(items, constants)) if (!GLOBAL_SKIP.has(p)) out[p] = e.ref;
  phrasesCache.set(items, out);
  return out;
}

/** Данные подсказок для списка ref ('i:ID', 't:key', 'n:ID', 'm:ID', 'c:Имя'). Неизвестные пропускаются. */
export function refsData(refs, deps = {}) {
  const items = deps.items || EMPTY_ITEMS;
  const ctx = { items, constants: deps.constants, price: deps.price, idx: indexNeu(items), scByName: scIndex(items) };
  const out = {};
  for (const ref of refs) {
    if (typeof ref !== 'string' || !/^[itnmc]:./.test(ref)) continue;
    if (ref[0] === 'i' && !items.has(ref.slice(2))) continue;
    if (ref[0] === 't' && !GLOSSARY[ref.slice(2)] && !buildTerms(deps.constants || {}).has(ref.slice(2))) continue;
    if (ref[0] === 'c' && !CREATURES.some(c => c.name === ref.slice(2))) continue;
    if ((ref[0] === 'n' || ref[0] === 'm') && !items.has(ref.slice(2))) continue;
    try { out[ref] = dataFor(ref, ctx); } catch { /* нет данных — термин останется текстом */ }
  }
  return out;
}
