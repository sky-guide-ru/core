// Миньоны: скрафченные тиры, слоты (уникальные крафты кооператива + Community Shop), что крафтить дальше,
// какие тиры закрыты коллекцией, примерная доходность по ценам Bazaar.
//   GET /api/minions — разбор для выбранного игрока (свой профиль, друг или гость по нику)
import { extractRecipes, marketId } from '../market/util.js';
import { stripColor } from '../nbt.js';

// Уникальных крафтов → слотов миньонов (без Community Shop). Из Hypixel: 5 слотов на старте, последний — 26-й на 650.
export const SLOT_STEPS = [[0, 5], [5, 6], [15, 7], [30, 8], [50, 9], [75, 10], [100, 11], [125, 12], [150, 13], [175, 14], [200, 15], [225, 16], [250, 17], [275, 18], [300, 19], [350, 20], [400, 21], [450, 22], [500, 23], [550, 24], [600, 25], [650, 26]];
export const COMMUNITY_SLOTS_MAX = 5;

export function minionSlots(unique) {
  let slots = 5, nextAt = null;
  for (const [need, s] of SLOT_STEPS) { if (unique >= need) slots = s; else { nextAt = need; break; } }
  return { slots, nextAt, left: nextAt != null ? nextAt - unique : 0 };
}

const TYPE_NAME = { CAVESPIDER: 'Cave Spider', ENDER_STONE: 'End Stone', NETHER_WARTS: 'Nether Wart', LILY_PAD: 'Lily Pad', DARK_OAK: 'Dark Oak', MAGMA_CUBE: 'Magma Cube', RED_SAND: 'Red Sand', HARD_STONE: 'Hard Stone' };
export const typeName = t => TYPE_NAME[t] || String(t).toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const roman = n => ROMAN[n] || String(n);

// Что миньон даёт за один сбор (базово, без улучшений). Сбор — каждое второе действие: поставить блок/моба, затем
// сломать/убить. Числа — средний дроп по вики; миньоны с редким или сложным дропом (Inferno, Vampire, Fishing,
// деревья, цветы) сюда не входят: для них доход не считаем.
export const DROPS = {
  WHEAT: [['WHEAT', 1], ['SEEDS', 1]], PUMPKIN: [['PUMPKIN', 1]], MELON: [['MELON', 5]],
  COBBLESTONE: [['COBBLESTONE', 1]], COAL: [['COAL', 1]], IRON: [['IRON_ORE', 1]], GOLD: [['GOLD_ORE', 1]],
  DIAMOND: [['DIAMOND', 1]], EMERALD: [['EMERALD', 1]], QUARTZ: [['QUARTZ', 1]], OBSIDIAN: [['OBSIDIAN', 1]],
  HARD_STONE: [['HARD_STONE', 1]], ENDER_STONE: [['ENDER_STONE', 1]], MITHRIL: [['MITHRIL_ORE', 1]], ICE: [['ICE', 1]],
  SAND: [['SAND', 1]], RED_SAND: [['SAND:1', 1]], MYCELIUM: [['MYCEL', 1]], GRAVEL: [['GRAVEL', 1]],
  LAPIS: [['INK_SACK:4', 6]], REDSTONE: [['REDSTONE', 4.5]], GLOWSTONE: [['GLOWSTONE_DUST', 3]], CLAY: [['CLAY_BALL', 4]], SNOW: [['SNOW_BALL', 4]],
  ZOMBIE: [['ROTTEN_FLESH', 1]], SKELETON: [['BONE', 1]], CREEPER: [['SULPHUR', 1]], ENDERMAN: [['ENDER_PEARL', 1]],
  BLAZE: [['BLAZE_ROD', 1]], GHAST: [['GHAST_TEAR', 1]], SLIME: [['SLIME_BALL', 1]], MAGMA_CUBE: [['MAGMA_CREAM', 1]],
  COW: [['RAW_BEEF', 1], ['LEATHER', 1]], PIG: [['PORK', 1]], CHICKEN: [['RAW_CHICKEN', 1], ['FEATHER', 1]], SHEEP: [['MUTTON', 1], ['WOOL', 1]],
};

/** «Time Between Actions: 15s» из лора NEU → секунды. */
export function actionTime(item) {
  for (const l of item?.lore || []) {
    const r = /Time Between Actions:\s*([\d.,]+)s/.exec(stripColor(l));
    if (r) return Number(r[1].replace(/,/g, ''));
  }
  return null;
}
export function maxStorage(item) {
  for (const l of item?.lore || []) {
    const r = /Max Storage:\s*([\d,]+)/.exec(stripColor(l));
    if (r) return Number(r[1].replace(/,/g, ''));
  }
  return null;
}

/** Стоимость крафта тира по рецепту NEU (без миньона прошлого тира). null — нет рецепта (XII и т. п.). */
export function craftCost(price, name, items, type, tier) {
  const it = items?.get?.(`${type}_GENERATOR_${tier}`);
  if (!it) return null;
  const r = extractRecipes(it).find(x => x.type === 'craft');
  if (!r) return null;
  let sum = 0, unknown = false;
  const parts = [];
  for (const [id, n] of Object.entries(r.inputs)) {
    if (/_GENERATOR_\d+$/.test(id)) continue;
    const p = price(marketId(id, items));
    if (!p) unknown = true;
    sum += p * n;
    parts.push({ id, n, name: name(id) });
  }
  return { coins: unknown ? null : Math.round(sum), parts };
}

/** Кто открывает рецепт: «Requires: Wheat I» на первом тире → { kind: 'collection', name: 'Wheat', tier: 1 }. */
export function unlockReq(items, type) {
  const t = String(items?.get?.(`${type}_GENERATOR_1`)?.crafttext || '').replace(/^Requires:\s*/, '').trim();
  if (!t) return null;
  const r = /^(.+?) (Slayer )?([IVX]+)$/.exec(t);
  if (!r) return { kind: 'other', text: t };
  const tier = ROMAN.indexOf(r[3]);
  return r[2] ? { kind: 'slayer', name: r[1], tier, text: t } : { kind: 'collection', name: r[1], tier, text: t };
}

// Миньоны слееров без требования в NEU: уровень слеера — по fandom (Revenant/Tarantula/Voidling Minion, сверено 23.11.2026)
const SLAYER_MINIONS = { REVENANT: 'нужен Zombie Slayer 5', TARANTULA: 'нужен Spider Slayer 5', VOIDLING: 'нужен Enderman Slayer 4' };
const SLAYER_KEY = { Zombie: 'zombie', Spider: 'spider', Wolf: 'wolf', Enderman: 'enderman', Blaze: 'blaze', Vampire: 'vampire' };

const parseCrafted = list => {
  const map = new Map();
  for (const s of list || []) {
    const r = /^(.+)_(\d+)$/.exec(s);
    if (!r) continue;
    if (!map.has(r[1])) map.set(r[1], new Set());
    map.get(r[1]).add(Number(r[2]));
  }
  return map;
};

/**
 * Разбор миньонов игрока.
 * @param m участник (minions, coop.minions, extras.communityUpgrades, collections)
 * @param o { items, constants, price, name, collections? — результат analyzeCollections }
 */
export function analyzeMinions(m, o = {}) {
  const items = o.items;
  const price = o.price || (() => 0);
  const name = o.name || (id => id);
  const maxTier = o.constants?.misc?.minions || {};
  const own = parseCrafted(m?.minions);
  const coopList = m?.coop?.minions || null;
  const shared = coopList ? parseCrafted(coopList) : own;
  const ownUnique = [...own.values()].reduce((n, s) => n + s.size, 0);
  const unique = [...shared.values()].reduce((n, s) => n + s.size, 0);
  const community = Math.min(COMMUNITY_SLOTS_MAX, Number(m?.extras?.communityUpgrades?.minion_slots || 0));
  const sl = minionSlots(unique);

  // Коллекции по имени («Wheat», «Raw Cod») — для замков «рецепт закрыт коллекцией»
  const colByName = new Map();
  for (const e of o.collections?.entries || []) colByName.set(e.name.toLowerCase(), e);

  const types = [];
  for (const [gen, maxRaw] of Object.entries(maxTier)) {
    const type = gen.replace(/_GENERATOR$/, '');
    const max = Number(maxRaw) || 0;
    const set = shared.get(type) || new Set();
    const mine = own.get(type) || new Set();
    const top = set.size ? Math.max(...set) : 0;
    // Пропуски: скрафчен XI, но нет V — значит V ещё даст уникальный крафт (бывает после покупки миньона на аукционе)
    const missing = [];
    for (let t = 1; t <= Math.min(top, max); t++) if (!set.has(t)) missing.push(t);
    const req = unlockReq(items, type) || SLAYER_MINIONS[type] || null;
    let locked = null;
    const colOk = o.collections?.status === 'ok';
    if (req?.kind === 'slayer' && !set.size) {
      const key = SLAYER_KEY[req.name];
      const lvl = key ? Number(m?.slayers?.[key]?.level || 0) : 0;
      if (lvl < req.tier) locked = { ...req, have: lvl };
    }
    if (req?.kind === 'collection' && colOk && !set.size) {
      const c = colByName.get(req.name.toLowerCase());
      if (c && c.tier < req.tier) locked = { ...req, id: c.id, have: c.amount, need: (c.tiers || []).find(t => t.tier === req.tier)?.need ?? c.next?.need ?? null };
    }
    const curIt = items?.get?.(`${type}_GENERATOR_${Math.max(1, top)}`);
    const nextTier = top < max ? top + 1 : null;
    const cost = nextTier ? craftCost(price, name, items, type, nextTier) : null;
    const speed = actionTime(curIt);
    const drops = DROPS[type] || null;
    let perDay = null;
    if (drops && speed) {
      const harvests = 86400 / (2 * speed);
      perDay = Math.round(harvests * drops.reduce((s, [id, n]) => s + n * (price(id) || 0), 0));
      if (!perDay) perDay = null;
    }
    types.push({
      type, gen, name: typeName(type), icon: `${gen}_${Math.max(1, top)}`, max, top,
      tiers: [...set].sort((a, b) => a - b), mine: [...mine].sort((a, b) => a - b), missing,
      next: nextTier ? { tier: nextTier, cost: cost?.coins ?? null, parts: cost?.parts || [], noRecipe: !cost } : null,
      speed, storage: maxStorage(curIt), perDay, drops: drops ? drops.map(([id, n]) => ({ id, n, name: name(id) })) : null,
      req, locked,
    });
  }
  types.sort((a, b) => a.name.localeCompare(b.name));
  const totalPossible = types.reduce((s, t) => s + t.max, 0);

  // Дешевле всего добрать уникальные крафты: следующий тир каждого типа (и пропуски), открытые и с ценой
  const cands = [];
  for (const t of types) {
    if (t.locked) continue;
    for (const tier of [...t.missing, ...(t.next ? [t.next.tier] : [])]) {
      const c = tier === t.next?.tier ? { coins: t.next.cost, parts: t.next.parts } : craftCost(price, name, items, t.type, tier);
      if (c?.coins != null) cands.push({ type: t.type, name: t.name, tier, cost: c.coins, parts: c.parts, isNew: t.top === 0, gap: tier !== t.next?.tier });
    }
  }
  cands.sort((a, b) => a.cost - b.cost);
  const toNext = sl.left > 0 ? cands.slice(0, sl.left) : [];
  const toNextCost = toNext.length === sl.left ? toNext.reduce((s, c) => s + c.cost, 0) : null;

  const profit = types.filter(t => t.perDay).sort((a, b) => b.perDay - a.perDay).map(t => t.type);
  return {
    unique, ownUnique, totalPossible,
    coop: m?.coop?.members?.length > 1 ? { members: m.coop.members.length } : null,
    slots: sl.slots, community, communityMax: COMMUNITY_SLOTS_MAX, totalSlots: sl.slots + community,
    nextAt: sl.nextAt, left: sl.left, maxSlots: SLOT_STEPS[SLOT_STEPS.length - 1][1],
    ladder: SLOT_STEPS.map(([need, s]) => ({ need, slots: s, done: unique >= need })),
    types,
    cheapest: cands.slice(0, 40),
    toNext, toNextCost,
    profit,
    locked: types.filter(t => t.locked).map(t => t.type),
    notStarted: types.filter(t => !t.top).map(t => t.type),
    maxed: types.filter(t => t.top >= t.max && !t.missing.length).length,
  };
}

// Улучшения и топливо: что даёт (по вики) — для карточек на странице
export const UPGRADES = [
  ['SUPER_COMPACTOR_3000', 'Сжимает дроп в Enchanted-формы: место в миньоне не кончается'],
  ['DIAMOND_SPREADING', 'Примерно +10% дропа алмазами'],
  ['FLYCATCHER_UPGRADE', '+20% скорости работы'],
  ['MINION_EXPANDER', '+5% скорости и +1 блок радиуса'],
  ['ENCHANTED_HOPPER', 'Продаёт дроп NPC сам, без захода на остров (90% цены)'],
  ['BUDGET_HOPPER', 'То же, но 50% цены NPC'],
  ['CORRUPT_SOIL', 'Для миньонов мобов: дополнительный дроп'],
  ['KRAMPUS_HELMET', 'Иногда даёт Red Gift, от зимнего события'],
];
export const FUELS = [
  ['ENCHANTED_LAVA_BUCKET', '+25%, навсегда'],
  ['MAGMA_BUCKET', '+30%, навсегда'],
  ['PLASMA_BUCKET', '+35%, навсегда'],
  ['EVERBURNING_FLAME', '+35% и +40% миньонам мобов, навсегда'],
  ['HAMSTER_WHEEL', '+50% на 24 часа'],
  ['FOUL_FLESH', '+90% на 5 часов'],
];

