// Чек-лист улучшений СВОЕГО предмета: что уже вложено, чего не хватает до «максимума», сколько это стоит
// и в каком порядке брать (сначала самое выгодное: больше пользы за меньшие деньги).
//
// Модуль чистый: все данные приходят через ctx, поэтому его легко тестировать без сервера.
//   ctx.constants    — neu.constants (enchants, reforgestones, reforges, essencecosts, gemstonecosts, misc)
//   ctx.getItem(id)  — предмет из базы NEU ({ id, name, rarity, type, lore })
//   ctx.priceOf(id)  — цена ПОКУПКИ (Bazaar Instant Buy / lowest BIN), 0 если неизвестна
//   ctx.sellOf(id)   — цена продажи (своя старая версия при апгрейде); по умолчанию priceOf
//   ctx.petPriceOf(id, maxed)
//   ctx.member       — разобранный профиль (класс данжей, уровень Catacombs)
//
// Что считается «максимумом» — мета-сборка, а не абсолютно всё возможное: например, на меч не советуем
// Knockback, а из взаимоисключающих чар (Sharpness / Smite / Bane) берём ту, что уже стоит, иначе основную.

import { buildUpgrades, nextUpgrade } from '../lib/acc-upgrades.js';
import { SLOT_GEMS as GEM_SLOTS_ALLOWED, ROLE_GEMS, GEM_STAT, gemStat, statText } from '../calc/gems.js';
import { tx } from '../../i18n/msg.js';
import { canSellCopy } from '../lib/item-props.js';

let upMemo = null;
const upgradesFor = raw => (upMemo && upMemo.raw === raw ? upMemo : (upMemo = { raw, map: buildUpgrades(raw) })).map;

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL', 'VERY SPECIAL'];
const MASTER_STARS = ['FIRST_MASTER_STAR', 'SECOND_MASTER_STAR', 'THIRD_MASTER_STAR', 'FOURTH_MASTER_STAR', 'FIFTH_MASTER_STAR'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const strip = s => String(s ?? '').replace(/§./g, '');
const roman = n => ROMAN[n] || String(n);
const title = s => String(s).toLowerCase().replace(/^ultimate_/, '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');

// ---------- Что это за предмет ----------

const WEAPON = /SWORD|LONGSWORD|BOW|WAND|STAFF|GAUNTLET|FISHING WEAPON|DEPLOYABLE/;
const ARMOR = /HELMET|CHESTPLATE|LEGGINGS|BOOTS|CARNIVAL MASK/;
const EQUIP = /NECKLACE|CLOAK|BELT|GLOVES|BRACELET/;
const TOOL = /PICKAXE|DRILL|AXE|HOE|SHOVEL|FISHING ROD|FARMING TOOL|CHISEL|SHEARS|VACUUM|LASSO/;

/** Тип предмета из последней строки лора: «LEGENDARY DUNGEON BOW» → { type: 'BOW', dungeon: true } */
export function typeFromLore(lore = []) {
  const last = strip(lore[lore.length - 1] || '').trim();
  const m = /^(?:a )?(?:VERY SPECIAL|COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL|ULTIMATE|ADMIN)\s*(DUNGEON\s+)?(.*)$/.exec(last);
  return m ? { type: m[2].trim(), dungeon: !!m[1] } : { type: '', dungeon: false };
}

/** Число характеристики из лора: statFromLore(lore, 'Intelligence') → 350 */
function statFromLore(lore, stat) {
  for (const l of lore || []) {
    const m = new RegExp(`^${stat}: \\+?(-?[\\d,.]+)`).exec(strip(l).trim());
    if (m) return Number(m[1].replace(/,/g, ''));
  }
  return 0;
}

const hasLore = (lore, re) => (lore || []).some(l => re.test(strip(l)));

/**
 * Категория и «роль» предмета.
 * kind: weapon | armor | equipment | accessory | tool | pet | other
 * role: melee | archer | mage | tank | mining | farming | fishing | foraging
 */
export function classify(it, neuItem, member) {
  if (it.pet || /;\d$/.test(it.id || '')) return { kind: 'pet', type: 'PET', role: null, dungeon: false };
  let lore = it.lore?.length ? it.lore : neuItem?.lore || [];
  let { type, dungeon } = typeFromLore(lore);
  if (!type && neuItem?.type) type = neuItem.type;
  if (!dungeon && neuItem?.lore) dungeon = typeFromLore(neuItem.lore).dungeon;
  const T = type.toUpperCase();
  // Статы для определения роли: свой лор + базовый из NEU (в своём лоре их может не быть, например в старых снимках)
  lore = [...lore, ...(neuItem?.lore || [])];
  const domain = hasLore(lore, /Farming Fortune|Crop Fortune|Wheat Fortune/) ? 'farming'
    : hasLore(lore, /Mining Fortune|Mining Speed|Pristine/) ? 'mining'
      : hasLore(lore, /Sea Creature Chance|Fishing Speed/) ? 'fishing'
        : hasLore(lore, /Foraging Fortune|Sweep/) ? 'foraging' : 'combat';
  const cls = String(member?.dungeonClass || member?.dungeons?.selectedClass || '').toLowerCase();
  const classRole = cls === 'mage' ? 'mage' : cls === 'tank' ? 'tank' : cls === 'healer' ? 'mage' : cls === 'archer' ? 'archer' : 'melee';
  const int = statFromLore(lore, 'Intelligence'), str = statFromLore(lore, 'Strength');
  const isMage = hasLore(lore, /Ability Damage/) || (int >= 100 && int > str * 1.5);

  let kind = 'other', role = domain === 'combat' ? classRole : domain;
  // У аксессуара «роли» нет: реформ больше нет, а статы (у Magic 8 Ball — меняются каждый сезон) не делают его фермерским
  if (/ACCESSORY|HATCESSORY/.test(T)) { kind = 'accessory'; role = null; }
  else if (WEAPON.test(T) && !/FISHING ROD/.test(T)) { kind = 'weapon'; role = /BOW/.test(T) ? 'archer' : isMage || /WAND|STAFF/.test(T) ? 'mage' : 'melee'; }
  else if (ARMOR.test(T)) kind = 'armor';
  else if (EQUIP.test(T)) kind = 'equipment';
  else if (TOOL.test(T)) { kind = 'tool'; role = /FISHING ROD/.test(T) ? 'fishing' : /HOE|FARMING/.test(T) ? 'farming' : /PICKAXE|DRILL|CHISEL/.test(T) ? 'mining' : domain === 'combat' ? 'foraging' : domain; }
  return { kind, type: T, role, dungeon };
}

// ---------- Реформа ----------

/** Веса характеристик для выбора лучшей реформы под роль */
const WEIGHTS = {
  melee: { strength: 1, crit_damage: 1, ferocity: 2, attack_speed: 0.6, crit_chance: 0.3, damage: 1 },
  archer: { strength: 1, crit_damage: 1, crit_chance: 0.3, attack_speed: 0.3, damage: 1 },
  mage: { intelligence: 1, ability_damage: 25, strength: 0.05, crit_damage: 0.05 },
  tank: { health: 0.5, defense: 1, true_defense: 2 },
  mining: { mining_fortune: 1, block_fortune: 0.6, mining_speed: 0.1 },
  farming: { farming_fortune: 1, bonus_pest_chance: 0.3 },
  fishing: { sea_creature_chance: 10, fishing_speed: 1, treasure_chance: 2, trophy_chance: 1 },
  foraging: { foraging_fortune: 1, sweep: 3 },
};
const ROLE_RU = { melee: 'ближний бой', archer: 'лучник', mage: 'маг', tank: 'танк', mining: 'добыча', farming: 'Farming', fishing: 'рыбалка', foraging: 'Foraging' };

// Цена одного ролла у кузнеца (случайная реформа) — по редкости
const BLACKSMITH_COST = { COMMON: 250, UNCOMMON: 500, RARE: 1000, EPIC: 2500, LEGENDARY: 5000, MYTHIC: 10000, DIVINE: 15000, SPECIAL: 25000, 'VERY SPECIAL': 50000 };

/** Подходит ли реформа к предмету: itemTypes из NEU бывает строкой «SWORD/ROD» или { internalName: [...] } */
function reforgeFits(r, it, cls) {
  const t = r.itemTypes;
  if (t && typeof t === 'object') return (t.internalName || []).includes(it.id);
  const T = cls.type;
  return String(t || '').split('/').some(x => {
    switch (x) {
      case 'SWORD': return /SWORD|FISHING WEAPON/.test(T);
      case 'BOW': return /BOW/.test(T);
      case 'ROD': return /FISHING ROD|FISHING WEAPON/.test(T);
      case 'ARMOR': return cls.kind === 'armor';
      case 'EQUIPMENT': return cls.kind === 'equipment';
      case 'PICKAXE': return /PICKAXE|DRILL|GAUNTLET/.test(T);
      case 'FARMING_TOOL': return /HOE|FARMING/.test(T) || (/AXE/.test(T) && cls.role === 'farming');
      case 'AXE': return /\bAXE\b/.test(T) && cls.role !== 'farming';
      default: return T.includes(x.replace(/_/g, ' '));
    }
  });
}

/** Бонус «+N к X за уровень Catacombs» из описания способности реформы (Withered, Ancient) */
function abilityBonus(r, cataLevel) {
  const m = /\+(\d+)\S*\s+(Strength|Crit Damage|Intelligence|Defense|Health)\s.*per\s.*Catacombs/i.exec(strip(r.reforgeAbility || ''));
  return m ? { [m[2].toLowerCase().replace(' ', '_')]: Number(m[1]) * cataLevel } : {};
}

function reforgeScore(stats = {}, bonus = {}, weights = {}) {
  let s = 0;
  for (const [k, w] of Object.entries(weights)) s += ((stats[k] || 0) + (bonus[k] || 0)) * w;
  return s;
}

const modKey = s => String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[\s-]+/g, '_');

/** Лучшая реформа для предмета и оценка текущей */
export function bestReforge(it, cls, ctx) {
  const rarity = it.rarity;
  const weights = WEIGHTS[cls.role];
  if (!weights || !rarity) return null;
  const cata = ctx.member?.dungeons?.catacombs?.level || 0;
  const list = [];
  for (const [stone, r] of Object.entries(ctx.constants?.reforgestones || {})) {
    if (!reforgeFits(r, it, cls) || (r.requiredRarities && !r.requiredRarities.includes(rarity))) continue;
    const stats = r.reforgeStats?.[rarity];
    if (!stats) continue;
    const bonus = cls.kind === 'weapon' || cls.kind === 'armor' ? abilityBonus(r, cata) : {};
    list.push({ name: r.reforgeName, key: modKey(r.nbtModifier || r.reforgeName), alt: modKey(r.reforgeName), stone, applyCost: r.reforgeCosts?.[rarity] || 0, score: reforgeScore(stats, bonus, weights) });
  }
  for (const r of Object.values(ctx.constants?.reforges || {})) {
    if (!reforgeFits(r, it, cls)) continue;
    const stats = r.reforgeStats?.[rarity];
    if (!stats) continue;
    list.push({ name: r.reforgeName, key: modKey(r.reforgeName), alt: modKey(r.reforgeName), stone: null, applyCost: BLACKSMITH_COST[rarity] || 5000, score: reforgeScore(stats, {}, weights) });
  }
  if (!list.length) return null;
  for (const r of list) {
    const sp = r.stone ? ctx.priceOf(r.stone) : 0;
    r.cost = r.stone ? (sp ? sp + r.applyCost : null) : r.applyCost * 5; // у кузнеца — в среднем несколько роллов
  }
  list.sort((a, b) => b.score - a.score || (a.cost ?? Infinity) - (b.cost ?? Infinity));
  const best = list[0];
  if (best.score <= 0) return null;
  const cur = it.reforge ? list.find(r => r.key === modKey(it.reforge) || r.alt === modKey(it.reforge)) : null;
  return { best, current: cur || null, currentName: it.reforge ? title(it.reforge) : null, alternatives: list.slice(1, 3) };
}

// ---------- Зачарования ----------

/** Мета-набор чар по типу предмета: какие брать, какие из взаимоисключающих предпочесть, какую ультимейт-чару */
const ENCH_SETS = {
  melee: {
    want: ['sharpness', 'critical', 'cubism', 'ender_slayer', 'execute', 'experience', 'fire_aspect', 'first_strike', 'giant_killer', 'impaling', 'lethality', 'looting', 'scavenger', 'syphon', 'thunderlord', 'vampirism', 'venomous', 'cleave', 'dragon_hunter', 'smoldering', 'divine_gift', 'tabasco', 'vicious', 'champion'],
    ult: 'ultimate_soul_eater', core: ['sharpness', 'critical', 'giant_killer', 'ender_slayer', 'first_strike', 'cubism', 'execute', 'dragon_hunter'],
  },
  // Урон магического оружия идёт от интеллекта: боевые чары почти не важны, главное — Ultimate Wise
  mage: {
    want: ['experience', 'looting', 'scavenger', 'syphon', 'vampirism', 'divine_gift', 'champion'],
    ult: 'ultimate_wise', core: ['ultimate_wise'],
  },
  archer: {
    want: ['power', 'aiming', 'chance', 'cubism', 'dragon_hunter', 'flame', 'impaling', 'infinite_quiver', 'piercing', 'overload', 'snipe', 'smoldering', 'divine_gift', 'tabasco', 'vicious', 'toxophilite'],
    ult: 'ultimate_soul_eater', ultById: { TERMINATOR: 'ultimate_duplex' }, core: ['power', 'overload', 'dragon_hunter', 'cubism'],
  },
  armor: {
    want: ['protection', 'growth', 'rejuvenate', 'big_brain', 'respiration', 'aqua_affinity', 'true_protection', 'counter_strike', 'smarty_pants', 'feather_falling', 'depth_strider', 'sugar_rush', 'hecatomb'],
    ult: 'ultimate_legion', core: ['protection', 'growth'],
  },
  mining: { want: ['efficiency', 'experience', 'fortune', 'pristine', 'compact', 'lapidary', 'paleontologist'], ult: 'ultimate_flowstate', core: ['fortune', 'pristine', 'efficiency'] },
  farming: { want: ['harvesting', 'cultivating', 'dedication', 'replenish', 'turbo_*'], ult: null, core: ['harvesting', 'dedication', 'cultivating'] },
  fishing: { want: ['angler', 'blessing', 'caster', 'expertise', 'frail', 'luck_of_the_sea', 'lure', 'magnet', 'spiked_hook', 'impaling', 'charm', 'corruption', 'piscary', 'quick_bite'], ult: 'ultimate_flash', core: ['lure', 'angler', 'spiked_hook', 'blessing'] },
  foraging: { want: ['efficiency'], ult: null, core: [] },
};
// Прокачиваются использованием (книга даёт I уровень, дальше — убийствами / добычей)
const LEVELED = { champion: 10, expertise: 10, compact: 10, cultivating: 10, hecatomb: 10, toxophilite: 10 };
// Предпочтение внутри групп взаимоисключающих чар
const PREFER = ['sharpness', 'protection', 'rejuvenate', 'thunderlord', 'syphon', 'execute', 'depth_strider', 'first_strike', 'giant_killer', 'fortune', 'mana_vampire', 'big_brain'];

function maxLevel(name, xp) {
  if (LEVELED[name]) return LEVELED[name];
  return xp[name]?.length || xp[name.replace(/^ultimate_/, '')]?.length || null;
}

/** Цена книги уровня lvl: сама книга или 2^k книг уровнем ниже (книги одного уровня объединяются) */
function bookCost(name, lvl, priceOf) {
  const id = l => tx`ENCHANTMENT_${name.toUpperCase()}_${l}`;
  for (let k = lvl, mult = 1; k >= 1 && mult <= 64; k--, mult *= 2) {
    const p = priceOf(id(k));
    if (p) return { cost: p * mult, parts: [{ id: id(k), count: mult, price: p }], approx: mult > 1 };
  }
  return { cost: null, parts: [], approx: false };
}

function enchantSteps(it, cls, ctx) {
  const set = cls.kind === 'armor' ? ENCH_SETS.armor : ENCH_SETS[cls.role];
  const E = ctx.constants?.enchants;
  if (!set || !E) return [];
  const xp = Object.fromEntries(Object.entries(E.enchants_xp_cost || {}).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v : []]));
  const typeKey = /FISHING WEAPON/.test(cls.type) ? 'FISHING WEAPON' : Object.keys(E.enchants || {}).find(k => cls.type === k) || Object.keys(E.enchants || {}).find(k => cls.type.includes(k));
  const allowed = new Set((E.enchants?.[typeKey] || []).map(s => s.toLowerCase()));
  if (!allowed.size) return [];
  const have = Object.fromEntries(Object.entries(it.enchants || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const pools = (E.enchant_pools || []).map(p => p.map(s => s.toLowerCase()));
  const blocked = name => pools.some(p => p.includes(name) && p.some(o => o !== name && have[o] && !(o === 'ultimate_one_for_all' && name.startsWith('ultimate_'))));

  const targets = new Set();
  for (const w of set.want) {
    if (w.endsWith('*')) { for (const h of Object.keys(have)) if (h.startsWith(w.slice(0, -1))) targets.add(h); continue; }
    if (allowed.has(w)) targets.add(w);
  }
  // Ультимейт: та, что уже стоит, иначе рекомендованная
  const haveUlt = Object.keys(have).find(k => k.startsWith('ultimate_'));
  const ult = haveUlt || set.ultById?.[it.id] || set.ult;
  if (ult && (allowed.has(ult) || haveUlt)) targets.add(ult);
  // Из взаимоисключающих — уже стоящую или предпочтительную
  for (const t of [...targets]) {
    if (have[t]) continue;
    if (blocked(t)) {
      // вместо неё уже стоит взаимоисключающая (Blast Protection вместо Protection) — докачиваем ту, что стоит
      targets.delete(t);
      const other = pools.find(p => p.includes(t) && !p.includes('ultimate_one_for_all'))?.find(o => have[o] && allowed.has(o));
      if (other) targets.add(other);
      continue;
    }
    const pool = pools.find(p => p.includes(t) && !p.includes('ultimate_one_for_all'));
    if (pool) {
      const pick = pool.find(x => have[x]) || PREFER.find(x => pool.includes(x) && targets.has(x));
      if (pick && pick !== t) targets.delete(t);
    }
  }
  // Ultimate One For All снимает почти все боевые чары — в этом случае не советуем их докупать
  if (have.ultimate_one_for_all) for (const t of [...targets]) if (t !== 'ultimate_one_for_all' && pools.some(p => p.includes('ultimate_one_for_all') && p.includes(t))) targets.delete(t);

  const steps = [];
  for (const name of targets) {
    const max = maxLevel(name, xp);
    if (!max) continue;
    const cur = have[name] || 0;
    const isUlt = name.startsWith('ultimate_');
    const leveled = !!LEVELED[name];
    const core = set.core.includes(name) || isUlt;
    const label = tx`${isUlt ? 'Ultimate ' : ''}${title(name)}`;
    let cost = 0, parts = [], approx = false, note = null;
    if (cur < max) {
      if (leveled) {
        if (!cur) ({ cost, parts } = bookCost(name, 1, ctx.priceOf));
        else cost = 0;
        note = 'уровни выше I набираются использованием предмета';
      } else ({ cost, parts, approx } = bookCost(name, max, ctx.priceOf));
    }
    steps.push({
      key: tx`ench:${name}`, group: 'enchant', title: tx`${label} ${roman(max)}`,
      current: cur ? tx`${label} ${roman(cur)}` : 'нет', target: roman(max), done: cur >= max,
      cost: cur >= max ? 0 : cost, parts, approx, note,
      impact: isUlt ? 7 : core ? 5 : 1.5, why: isUlt ? 'ультимейт-чара' : core ? 'основная чара на урон/статы' : null,
    });
  }
  return steps;
}

// ---------- Звёзды ----------

function costList(list = [], priceOf) {
  let cost = 0; const parts = [];
  for (const s of list) {
    const [id, n] = String(s).split(':');
    const count = Number(n) || 1;
    if (id === 'SKYBLOCK_COIN') { cost += count; continue; }
    const p = priceOf(id) || 0;
    cost += p * count; parts.push({ id, count, price: p });
  }
  return { cost, parts };
}

function starSteps(it, cls, ctx) {
  const ess = ctx.constants?.essencecosts?.[it.id];
  if (!ess?.type) return [];
  const levels = Object.keys(ess).filter(k => /^\d+$/.test(k)).map(Number);
  const maxNormal = Math.max(...levels);
  const stars = Number(it.stars || 0);
  const steps = [];
  const essId = tx`ESSENCE_${String(ess.type).toUpperCase()}`;
  if (stars < maxNormal) {
    let n = 0, extra = 0; const parts = [];
    for (let i = stars + 1; i <= maxNormal; i++) {
      n += ess[i] || 0;
      const c = costList(ess.items?.[i], ctx.priceOf);
      extra += c.cost; parts.push(...c.parts);
    }
    const ep = ctx.priceOf(essId);
    steps.push({
      key: 'stars', group: 'stars', title: tx`Звёзды ${'✪'.repeat(maxNormal)} (${maxNormal})`, current: tx`${stars} из ${maxNormal}`, target: String(maxNormal), done: false,
      cost: ep ? n * ep + extra : null, parts: [{ id: essId, count: n, price: ep }, ...parts], impact: 1.2 * (maxNormal - stars),
      note: tx`${n.toLocaleString('ru-RU')} эссенции ${ess.type}`, why: 'каждая звезда даёт ~+2% к статам (в данже)',
    });
  } else steps.push({ key: 'stars', group: 'stars', title: tx`Звёзды ${'✪'.repeat(maxNormal)} (${maxNormal})`, current: tx`${stars} из ${maxNormal}`, target: String(maxNormal), done: true, cost: 0, parts: [], impact: 3 });
  // Мастер-звёзды (красные ➊–➎): только у предметов с 5 обычными звёздами (у Crimson/Kuudra звёзды 6–10 — обычные, за эссенцию)
  if (maxNormal === 5) {
    const ms = Math.max(0, stars - 5);
    for (let i = 0; i < 5; i++) {
      const p = ctx.priceOf(MASTER_STARS[i]);
      steps.push({
        key: tx`mstar:${i + 1}`, group: 'stars', title: tx`Мастер-звезда ${'➊➋➌➍➎'[i]}`, current: i < ms ? 'есть' : 'нет', target: 'есть', done: i < ms,
        cost: i < ms ? 0 : p || null, parts: [{ id: MASTER_STARS[i], count: 1, price: p }], impact: 3.5,
        why: 'красная звезда: ещё ~+5% к статам в данже', locked: i > ms ? 'сначала предыдущие' : null,
      });
    }
  }
  return steps;
}

// ---------- Gemstones ----------

// Какие камни в какой слот и какой роли нужен — общая таблица с блоком «Гемы в снаряжении» (calc/gems.js, по вики)
const SLOT_GEMS = GEM_SLOTS_ALLOWED;
const GEM_PREF = ROLE_GEMS;
const GEM_RU = Object.fromEntries(Object.entries(GEM_STAT).map(([g, st]) => [g, tx`${g[0] + g.slice(1).toLowerCase()} (${st})`]));
const QUALITY = ['ROUGH', 'FLAWED', 'FINE', 'FLAWLESS', 'PERFECT'];

function gemSteps(it, cls, ctx) {
  const slots = ctx.constants?.gemstonecosts?.[it.id];
  if (!slots) return [];
  const gems = it.gems || {};
  const unlocked = new Set(gems.unlocked_slots || []);
  const steps = [];
  for (const [slot, unlockCost] of Object.entries(slots)) {
    const base = slot.replace(/_\d+$/, '');
    const allowedGems = SLOT_GEMS[base] || [base];
    const rec = (GEM_PREF[cls.role] || []).find(g => allowedGems.includes(g)) || allowedGems[0];
    const isUnlocked = !unlockCost?.length || unlocked.has(slot) || gems[slot] != null;
    const val = gems[slot];
    const quality = typeof val === 'string' ? val : val?.quality || null;
    const gemType = SLOT_GEMS[base] ? gems[tx`${slot}_gem`] || null : base;
    const slotRu = SLOT_GEMS[base] ? tx`${title(base)} слот` : tx`слот ${title(base)}`;
    const unlock = isUnlocked ? null : costList(unlockCost, ctx.priceOf); // открыть слот — часть того же шага
    const targetId = tx`PERFECT_${rec}_GEM`;
    const okType = gemType && (allowedGems.length === 1 || (GEM_PREF[cls.role] || []).includes(gemType));
    const done = quality === 'PERFECT' && okType;
    let cost = null; let parts = [];
    const p = ctx.priceOf(targetId);
    if (!done && p) {
      const back = quality && gemType ? ctx.priceOf(tx`${quality}_${gemType}_GEM`) || 0 : 0; // старый камень возвращается — можно продать
      cost = Math.max(0, p - back); parts = [{ id: targetId, count: 1, price: p }];
    }
    if (unlock && cost != null) { cost += unlock.cost; parts.push(...unlock.parts); }
    steps.push({
      key: tx`gem:${slot}`, group: 'gems', title: tx`Самоцвет в ${slotRu}: Perfect ${GEM_RU[rec] || rec}`, why: statText(rec, gemStat(rec, 'PERFECT', it.rarity)) || undefined,
      current: quality ? tx`${title(quality)} ${title(gemType || '?')}` : 'пусто', target: tx`Perfect ${title(rec)}`, done, cost: done ? 0 : cost, parts,
      impact: quality ? 1 + (4 - QUALITY.indexOf(quality)) * 0.6 : 3,
      note: unlock ? `слот закрыт: открыть в меню самоцветов (Gemstone Grinder), цена открытия включена` : null,
    });
  }
  return steps;
}

// ---------- Прочие улучшения ----------

const NECRON_BLADES = new Set(['HYPERION', 'VALKYRIE', 'SCYLLA', 'ASTRAEA', 'NECRON_BLADE']);
const SCROLLS = [['IMPLOSION_SCROLL', 'Implosion'], ['SHADOW_WARP_SCROLL', 'Shadow Warp'], ['WITHER_SHIELD_SCROLL', 'Wither Shield']];
const DRILL_PARTS = [
  ['engine', /DRILL_ENGINE/, 'AMBER_POLISHED_DRILL_ENGINE', 'Двигатель бура'],
  ['tank', /FUEL_TANK/, 'PERFECTLY_CUT_FUEL_TANK', 'Топливный бак'],
  ['module', /OMELETTE/, 'GOBLIN_OMELETTE_BLUE_CHEESE', 'Модуль улучшения'],
];
// Accessory Enrichment (с 0.27.3 один предмет вместо 11 прежних TALISMAN_ENRICHMENT_*): на Legendary и Mythic аксессуар,
// +1 очко Tuning (вики «Accessory Enrichment»). Старые обогащения в профиле остаются под своими ID.
const ENRICH_ID = 'ACCESSORY_ENRICHMENT';
const ENRICH_RARITIES = new Set(['LEGENDARY', 'MYTHIC']);
const MP_BY_RARITY = { COMMON: 3, UNCOMMON: 5, RARE: 8, EPIC: 12, LEGENDARY: 16, MYTHIC: 22, DIVINE: 22, SPECIAL: 3, 'VERY SPECIAL': 5 };
/** Польза шага в Magical Power: «+4 Magical Power · 1,2 млн за 1 MP» (цена за 1 MP считается на клиенте из cost) */
const mpGain = n => (n > 0 ? { gain: { mp: n } } : {});

function part(it, id) { return (it.upgrades || []).find(u => u.id === id); }
function partCount(it, id) { return part(it, id)?.count || 0; }

function simple(key, group, titleRu, have, max, id, ctx, impact, extra = {}) {
  const p = ctx.priceOf(id);
  const missing = Math.max(0, max - have);
  return {
    key, group, title: titleRu, current: max > 1 ? tx`${have} из ${max}` : have ? 'есть' : 'нет', target: max > 1 ? String(max) : 'есть',
    done: missing === 0, cost: missing ? (p ? p * missing : null) : 0, parts: [{ id, count: missing || max, price: p }], impact, ...extra,
  };
}

function extraSteps(it, cls, ctx) {
  const s = [];
  const T = cls.type;
  const rarityIdx = RARITIES.indexOf(it.rarity);
  if (cls.kind !== 'pet' && it.rarity && rarityIdx >= 0 && rarityIdx < 7) {
    const accGain = cls.kind === 'accessory' && !it.recomb ? (MP_BY_RARITY[RARITIES[Math.min(rarityIdx + 1, 5)]] || 0) - (MP_BY_RARITY[it.rarity] || 0) : 0;
    s.push(simple('recomb', 'core', 'Recombobulator 3000 (+1 редкость)', it.recomb ? 1 : 0, 1, 'RECOMBOBULATOR_3000', ctx, cls.kind === 'accessory' ? 4 : 7,
      { why: cls.kind === 'accessory' ? 'больше Magical Power' : 'выше редкость — сильнее реформа и самоцветы', ...mpGain(accGain) }));
  }
  if (cls.kind === 'weapon' || cls.kind === 'armor') {
    const hpb = Number(it.hpb || 0);
    s.push({ ...simple('hpb', 'books', 'Hot Potato Book ×10', Math.min(hpb, 10), 10, 'HOT_POTATO_BOOK', ctx, 5), why: cls.kind === 'weapon' ? '+2 урона и +2 силы за книгу' : '+4 здоровья и +2 защиты за книгу' });
    s.push({ ...simple('fpb', 'books', 'Fuming Potato Book ×5', Math.max(0, hpb - 10), 5, 'FUMING_POTATO_BOOK', ctx, 3.5), locked: hpb < 10 ? 'сначала 10 Hot Potato' : null });
  }
  if (cls.kind === 'weapon' && cls.role !== 'mage') s.push({ ...simple('aow', 'books', 'The Art of War', partCount(it, 'THE_ART_OF_WAR'), 1, 'THE_ART_OF_WAR', ctx, 3), why: '+5 силы' });
  if (cls.kind === 'armor') s.push({ ...simple('aop', 'books', 'The Art of Peace', partCount(it, 'THE_ART_OF_PEACE'), 1, 'THE_ART_OF_PEACE', ctx, 2), why: '+40 здоровья' });
  if (cls.kind === 'weapon') s.push(simple('stats_book', 'books', 'Book of Stats (счётчик убийств)', partCount(it, 'BOOK_OF_STATS'), 1, 'BOOK_OF_STATS', ctx, 0.3));
  if (NECRON_BLADES.has(it.id)) {
    for (const [id, name] of SCROLLS) s.push({ ...simple(tx`scroll:${id}`, 'core', tx`Свиток ${name}`, partCount(it, id), 1, id, ctx, 8), why: id === 'IMPLOSION_SCROLL' ? 'основной урон Wither Impact' : 'нужен для Wither Impact' });
  }
  if (it.id === 'ASPECT_OF_THE_VOID') {
    s.push({ ...simple('ethermerge', 'core', 'Etherwarp Conduit (телепорт по Shift+ПКМ)', partCount(it, 'ETHERWARP_CONDUIT'), 1, 'ETHERWARP_CONDUIT', ctx, 8) });
    s.push(simple('tuner', 'books', 'Transmission Tuner ×4', partCount(it, 'TRANSMISSION_TUNER'), 4, 'TRANSMISSION_TUNER', ctx, 1.5));
  }
  if (/DRILL/.test(T) || /_DRILL$|DRILL_/.test(it.id || '')) {
    for (const [k, re, best, ru] of DRILL_PARTS) {
      const cur = (it.upgrades || []).find(u => u.kind === 'drill' && re.test(u.id));
      const p = ctx.priceOf(best);
      s.push({ key: tx`drill:${k}`, group: 'core', title: tx`${ru}: ${title(best)}`, current: cur ? title(cur.id) : 'нет', target: title(best), done: cur?.id === best, cost: cur?.id === best ? 0 : p || null, parts: [{ id: best, count: 1, price: p }], impact: 6 });
    }
    s.push(simple('polarvoid', 'books', 'Polarvoid Book ×5', partCount(it, 'POLARVOID_BOOK'), 5, 'POLARVOID_BOOK', ctx, 2));
    if (it.id === 'DIVAN_DRILL') s.push(simple('divan_coating', 'core', 'Divan Powder Coating', partCount(it, 'DIVAN_POWDER_COATING'), 1, 'DIVAN_POWDER_COATING', ctx, 4));
  }
  if (/HOE|FARMING/.test(T) || (cls.role === 'farming' && cls.kind === 'tool')) s.push({ ...simple('ffd', 'books', 'Farming for Dummies ×5', partCount(it, 'FARMING_FOR_DUMMIES'), 5, 'FARMING_FOR_DUMMIES', ctx, 3), why: '+1 Farming Fortune за книгу' });
  if (cls.kind === 'accessory') {
    const en = (it.upgrades || []).find(u => u.kind === 'enrichment');
    if (ENRICH_RARITIES.has(it.rarity) || en) {
      const p = ctx.priceOf(ENRICH_ID);
      s.push({
        key: 'enrichment', group: 'core', title: 'Accessory Enrichment', current: en ? 'есть' : 'нет', target: 'есть', done: !!en,
        cost: en ? 0 : p || null, parts: [{ id: ENRICH_ID, count: 1, price: p }], impact: 1.5, gain: { tuning: 1 },
        why: '+1 очко Tuning в Maxwell (Stats Tuning)', note: en ? null : 'ставится на наковальне на Legendary и Mythic аксессуар; купить на AH или у Elizabeth за 5 000 Bits',
      });
    }
    const rawUp = ctx.constants?.misc?.talisman_upgrades;
    const next = rawUp?.[it.id]?.[0] || nextUpgrade(it.id, upgradesFor(rawUp));
    if (next) {
      // сданную в Museum или Soulbound старую версию не продать: доплата — полная цена
      const sellOld = canSellCopy(it);
      const p = ctx.priceOf(next), own = sellOld ? (ctx.sellOf || ctx.priceOf)(it.id) : 0;
      const nextRarity = ctx.getItem(next)?.rarity;
      const mp = nextRarity ? (MP_BY_RARITY[RARITIES[Math.min(RARITIES.indexOf(nextRarity) + (it.recomb ? 1 : 0), 6)]] || 0) - (MP_BY_RARITY[it.rarity] || 0) : 0;
      s.push({ key: 'acc_upgrade', group: 'core', title: tx`Следующая версия: ${ctx.getItem(next)?.name || title(next)}`, current: it.name || it.id, target: ctx.getItem(next)?.name || next, done: false, cost: p ? Math.max(p - own, p * 0.1) : null, parts: [{ id: next, count: 1, price: p }], impact: 5, why: sellOld ? 'больше Magical Power; старую версию можно продать' : 'больше Magical Power; старая версия в Museum или Soulbound, её не продать', approx: true, ...mpGain(mp) });
    }
  }
  if (it.attributes && typeof it.attributes === 'object') {
    for (const [name, lvl] of Object.entries(it.attributes)) {
      if (typeof lvl !== 'number') continue;
      s.push({ key: tx`attr:${name}`, group: 'attributes', title: tx`Атрибут ${title(name)}`, current: tx`ур. ${lvl}`, target: '10', done: lvl >= 10, cost: null, parts: [], impact: 2, note: lvl < 10 ? 'повышается объединением двух предметов с одинаковым атрибутом' : null });
    }
  }
  return s;
}

function reforgeStep(it, cls, ctx) {
  // Аксессуары больше не перековываются: со времён Crimson Isle их заменили Accessory Powers в Maxwell (вики «Reforging»)
  if (cls.kind === 'accessory') return null;
  const r = bestReforge(it, cls, ctx);
  if (!r) return null;
  const done = !!r.current && (r.current.key === r.best.key || r.current.score >= r.best.score * 0.9); // разница до 10% — не повод перековывать
  const parts = r.best.stone ? [{ id: r.best.stone, count: 1, price: ctx.priceOf(r.best.stone) }] : [];
  const gainPct = r.current ? Math.max(0, 1 - r.current.score / r.best.score) : 1;
  return {
    key: 'reforge', group: 'core', title: tx`Реформа ${r.best.name}`, current: r.currentName || 'нет', target: r.best.name, done,
    cost: done ? 0 : r.best.cost, parts, impact: 2 + 7 * gainPct,
    note: [r.best.stone ? tx`камень ${title(r.best.stone)} + ${r.best.applyCost.toLocaleString('ru-RU')} монет у кузнеца` : 'у кузнеца (случайный ролл, может понадобиться несколько попыток)',
      r.alternatives[0] && tx`альтернатива: ${r.alternatives[0].name}`].filter(Boolean).join('; '),
    why: tx`лучшая по статам для роли «${ROLE_RU[cls.role] || cls.role}»`,
  };
}

// ---------- Питомцы ----------

function petSteps(p, ctx) {
  const s = [];
  const tierIdx = RARITIES.indexOf(p.tier);
  if (p.level < (p.maxLevel || 100)) {
    const maxed = ctx.petPriceOf(p.id, true), low = ctx.petPriceOf(p.id, false);
    s.push({ key: 'pet:level', group: 'core', title: tx`Уровень ${p.maxLevel || 100}`, current: tx`ур. ${p.level}`, target: String(p.maxLevel || 100), done: false,
      cost: maxed && low && maxed > low ? Math.round((maxed - low) * (1 - (p.level - 1) / ((p.maxLevel || 100) - 1))) : null, parts: [], impact: 8, approx: true,
      note: 'качать опытом (Exp Share, Taming, книги опыта) или оценка по разнице цен 1 и 100 ур. на аукционе' });
  } else s.push({ key: 'pet:level', group: 'core', title: tx`Уровень ${p.maxLevel || 100}`, current: tx`ур. ${p.level}`, target: String(p.maxLevel || 100), done: true, cost: 0, parts: [], impact: 8 });
  const [type] = String(p.id).split(';');
  let topTier = tierIdx;
  for (let t = tierIdx + 1; t <= 5; t++) if (ctx.getItem(tx`${type};${t}`)) topTier = t;
  if (topTier > tierIdx) {
    const next = RARITIES[tierIdx + 1];
    const tb = ctx.priceOf('PET_ITEM_TIER_BOOST');
    s.push({ key: 'pet:tier', group: 'core', title: tx`Редкость ${next}`, current: p.tier, target: RARITIES[topTier], done: false, cost: tb || null, parts: [{ id: 'PET_ITEM_TIER_BOOST', count: 1, price: tb }], impact: 6, note: 'Tier Boost (предмет) или улучшение у Kat в Hub' });
  }
  const held = p.heldItem;
  s.push({ key: 'pet:item', group: 'core', title: 'Предмет питомцу', current: held ? title(String(held).replace(/^PET_ITEM_/, '')) : 'нет', target: 'есть', done: !!held, cost: held ? 0 : null, parts: [], impact: 5,
    note: held ? null : 'по направлению: Minos Relic (+33% к статам питомца), Textbook, Exp Share для прокачки' });
  return s;
}

// ---------- Сборка плана ----------

/** Выгода шага: польза за потраченные монеты. Без цены — после оценённых, по пользе */
function priority(step) {
  if (step.cost == null) return step.impact / 50;
  return step.impact / (1 + step.cost / 1_000_000);
}

/**
 * План улучшений одного своего предмета (или питомца).
 * @returns {{ kind, role, roleRu, steps, todo, done, total, missingCost, unpriced, score }}
 */
export function planItemUpgrades(it, ctx) {
  const neuItem = ctx.getItem?.(it.id) || null;
  if (it.isPet || (it.type && it.tier && it.exp != null)) {
    const steps = petSteps(it, ctx);
    return finish({ kind: 'pet', role: null, steps });
  }
  const cls = classify(it, neuItem, ctx.member);
  const steps = [
    reforgeStep(it, cls, ctx),
    ...starSteps(it, cls, ctx),
    ...enchantSteps(it, cls, ctx),
    ...gemSteps(it, cls, ctx),
    ...extraSteps(it, cls, ctx),
  ].filter(Boolean);
  return finish({ kind: cls.kind, type: cls.type, role: cls.role, roleRu: ROLE_RU[cls.role] || null, steps });
}

function finish(plan) {
  const todo = plan.steps.filter(s => !s.done).sort((a, b) => Number(!!a.locked) - Number(!!b.locked) || priority(b) - priority(a));
  todo.forEach((s, i) => { s.order = i + 1; });
  const done = plan.steps.filter(s => s.done);
  const weight = plan.steps.reduce((n, s) => n + s.impact, 0) || 1;
  return {
    ...plan, steps: undefined, todo, done,
    total: plan.steps.length,
    missingCost: todo.reduce((n, s) => n + (s.cost || 0), 0),
    unpriced: todo.filter(s => s.cost == null).length,
    score: Math.round(done.reduce((n, s) => n + s.impact, 0) / weight * 100),
  };
}
