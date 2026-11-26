import { tx } from '../../i18n/msg.js';
// Лист статов игрока: из чего складываются Health, Strength, Crit Damage и остальные статы, с разбивкой по источникам.
// Чистые функции: всё внешнее (NEU-константы) приходит параметром, так модуль легко проверять тестами.
//
// Источники (вики Hypixel SkyBlock и NEU-REPO, проверено 24.11.2026):
//  - базовые статы игрока;
//  - лор надетой брони, экипировки, оружия в руке и аксессуаров (в лоре уже итог с перековкой, звёздами, камнями,
//    книгами и Hot Potato; серое число в скобках у данжевых вещей — значение внутри данжа);
//  - Accessory Power: базовые статы силы × множитель от Magical Power (29.97 · ln(1 + 0.0019·MP)^1.2), плюс уникальный бонус;
//  - Tuning у Maxwell (1 очко на 10 MP);
//  - питомец (NEU petnums по уровню);
//  - скиллы и слееры (NEU bonuses.json);
//  - SkyBlock Level: +5 Health за уровень, +1 Strength за каждые 5 уровней;
//  - Bestiary (+1 Health за этап), песни Melody's Harp (Intelligence), бонусы аксессуаров из строки «Current Bonus».
// Health и Intelligence сверены с меню игры Your Stats Breakdown 25.11.2026 (совпадают до десятых, кроме эффектов вроде Jerry Candy).
// Что не видно в API и поэтому не учтено: зелья и баффы, Century Cake, сетовые бонусы брони, бонусы мэров,
// временные эффекты. Источники с пометкой sure: false — по памяти, их подтверждает сверка с игрой.

const COLOR = /§[0-9a-fk-or]/gi;
const strip = s => String(s || '').replace(COLOR, '');

/** Ключи статов в листе (как в NEU) */
export const STATS = [
  'health', 'defense', 'strength', 'speed', 'crit_chance', 'crit_damage', 'intelligence', 'attack_speed', 'ferocity',
  'true_defense', 'ability_damage', 'magic_find', 'health_regen', 'vitality', 'mending', 'sea_creature_chance', 'pet_luck',
];

/** Базовые статы персонажа без вещей. Intelligence без базы: в меню игры (Your Stats Breakdown) строки Base Value у неё нет */
export const BASE = { health: 100, defense: 0, strength: 0, speed: 100, crit_chance: 30, crit_damage: 50, intelligence: 0, attack_speed: 0, ferocity: 0, true_defense: 0, ability_damage: 0, magic_find: 0, health_regen: 100, vitality: 100, mending: 100 };

/** Потолки: Speed 400 (выше — с Black Cat, Young Dragon и т. п.), Attack Speed 100. Crit Chance меню игры показывает и выше 100% */
export const CAPS = { speed: 400, attack_speed: 100 };

// Название стата в лоре → ключ
const LORE_KEY = {
  'Health': 'health', 'Defense': 'defense', 'Strength': 'strength', 'Speed': 'speed', 'Crit Chance': 'crit_chance',
  'Crit Damage': 'crit_damage', 'Intelligence': 'intelligence', 'Bonus Attack Speed': 'attack_speed', 'Attack Speed': 'attack_speed',
  'Ferocity': 'ferocity', 'True Defense': 'true_defense', 'Ability Damage': 'ability_damage', 'Magic Find': 'magic_find',
  'Health Regen': 'health_regen', 'Vitality': 'vitality', 'Mending': 'mending', 'Sea Creature Chance': 'sea_creature_chance',
  'Pet Luck': 'pet_luck', 'Damage': 'damage', 'Mining Speed': 'mining_speed', 'Mining Fortune': 'mining_fortune',
  'Farming Fortune': 'farming_fortune', 'Foraging Fortune': 'foraging_fortune', 'Fishing Speed': 'fishing_speed',
  'Swing Range': 'swing_range', 'Heat Resistance': 'heat_resistance', 'Cold Resistance': 'cold_resistance',
  'Pristine': 'pristine', 'Treasure Chance': 'treasure_chance', 'Trophy Fish Chance': 'trophy_chance', 'Gemstone Fortune': 'gemstone_fortune',
  'Ore Fortune': 'ore_fortune', 'Block Fortune': 'block_fortune', 'Wheat Fortune': 'wheat_fortune', 'Bonus Pest Chance': 'bonus_pest_chance',
  'Combat Wisdom': 'combat_wisdom', 'Mining Wisdom': 'mining_wisdom', 'Farming Wisdom': 'farming_wisdom', 'Fishing Wisdom': 'fishing_wisdom',
};

/**
 * Статы из лора предмета. Первое число строки — итог вне данжа, серое число в скобках §8(+N) — внутри данжа.
 * @returns {{ world: Object<string, number>, dungeon: Object<string, number> }}
 */
export function itemStats(lore = []) {
  const world = {}, dungeon = {};
  for (const raw of lore || []) {
    const line = String(raw || '');
    const m = strip(line).match(/^([A-Z][A-Za-z' ]{1,30}): ([+-]?[\d,]+(?:\.\d+)?)%?(?:\s|$)/);
    if (!m) continue;
    const key = LORE_KEY[m[1].trim()];
    if (!key || world[key] != null) continue;
    const w = Number(m[2].replace(/,/g, ''));
    world[key] = w;
    const d = line.match(/§8\(([+-]?[\d,]+(?:\.\d+)?)%?\)/);
    dungeon[key] = d ? Number(d[1].replace(/,/g, '')) : w;
  }
  return { world, dungeon };
}

// ---------- Accessory Power ----------

/** Множитель статов силы от Magical Power (вики, Magical Power) */
export const mpMultiplier = mp => (mp > 0 ? 29.97 * Math.pow(Math.log(1 + 0.0019 * mp), 1.2) : 0);

/** Базовые статы сил (до множителя) и уникальный бонус (не растёт от MP). Вики: Accessory Powers, Power Stones */
export const POWERS = {
  fortuitous: { hp: 3.35, def: 1.2, str: 4.8, cc: 4.35, cd: 4.8 },
  pretty: { hp: 1.65, def: 1.2, spd: 0.65, str: 4.8, int: 10.8, cc: 0.475, cd: 1.2 },
  protected: { hp: 11.75, def: 10.8, str: 2.4, cc: 0.475, cd: 1.2 },
  simple: { hp: 5.02, def: 3.6, spd: 1.2, str: 3.6, int: 5.4, cc: 1.45, cd: 3.6 },
  warrior: { hp: 3.35, def: 1.2, str: 8.4, cc: 2.4, cd: 6 },
  commando: { hp: 5.02, def: 2.4, str: 8.4, cc: 0.475, cd: 8.4 },
  disciplined: { hp: 5.02, def: 2.4, str: 7.2, cc: 1.45, cd: 7.2 },
  inspired: { hp: 1.65, def: 1.2, str: 4.8, int: 16.2, cc: 0.95, cd: 3.6 },
  ominous: { hp: 5.02, spd: 0.95, str: 3.6, int: 6.1, cc: 1.45, cd: 3.6, as: 0.9 },
  prepared: { hp: 12.4, def: 11.3, str: 1.95, cc: 0.4, cd: 0.95 },
  forceful: { hp: 1.7, str: 18, cd: 4.8, $u: { fer: 4 } },
  bloody: { str: 10.8, int: 3.6, cd: 10.8, $u: { as: 10 } },
  bubba: { hp: 5.1, def: -9.6, str: 6, cc: 0.9, cd: 10.8, as: 1.8, tdef: 1.2 },
  shaded: { spd: 0.6, str: 4.8, cd: 18, $u: { as: 3, fer: 3 } },
  sanguisuge: { hp: 5.1, str: 12, cd: 4.8, vt: 1.2, $u: { int: 100 } },
  bizarre: { str: -2.4, int: 43.2, cd: -2.4, $u: { ad: 5 } },
  sighted: { int: 36, $u: { ad: 3 } },
  adept: { hp: 16.8, def: 9.6, int: 3.6, $u: { hp: 100, def: 50 } },
  crumbly: { hp: 10.1, int: 5.4, tdef: 0.6, vt: 2.4, md: 1.8, $u: { spd: 25 } },
  itchy: { spd: 0.6, str: 7.2, cd: 8.4, as: 2.15, $u: { str: 15, cd: 15 } },
  frozen: { def: 13.2, tdef: 1.8, $u: { str: 25, cd: 25, tdef: 10 } },
  slender: { hp: 8.4, def: 6, spd: 0.6, str: 6, int: 7.2, cd: 6, as: 1.1, $u: { def: 100, str: 50 } },
  demonic: { str: 5.5, int: 27.725, $u: { cd: 50 } },
  silky: { spd: 0.6, cd: 22.8, $u: { as: 5 } },
  hurtful: { str: 4.8, cd: 19.2, $u: { as: 15 } },
  strong: { str: 12, cd: 12, $u: { str: 25, cd: 25 } },
  mythical: { hp: 5.7, def: 4.05, spd: 0.95, str: 4.05, int: 6.1, cc: 1.65, cd: 4.05, $u: { hp: 150, str: 40 } },
  pleasant: { hp: 13.45, def: 14.4 },
  sweet: { hp: 15.1, def: 10.8, spd: 1.2, $u: { spd: 5 } },
  scorching: { str: 8.4, cd: 9.6, as: 1.8, $u: { fer: 7 } },
};
const SHORT = { hp: 'health', def: 'defense', spd: 'speed', str: 'strength', int: 'intelligence', cc: 'crit_chance', cd: 'crit_damage', as: 'attack_speed', fer: 'ferocity', tdef: 'true_defense', ad: 'ability_damage', vt: 'vitality', md: 'mending' };

/** Статы выбранной силы при данном MP: { stats, unique, multiplier } */
export function powerStats(power, mp) {
  const p = POWERS[String(power || '').toLowerCase()];
  if (!p) return null;
  const mult = mpMultiplier(mp);
  const stats = {}, unique = {};
  for (const [k, v] of Object.entries(p)) if (k !== '$u') stats[SHORT[k]] = v * mult;
  for (const [k, v] of Object.entries(p.$u || {})) unique[SHORT[k]] = v;
  return { stats, unique, multiplier: mult };
}

/** Прибавка за одно очко Tuning (меню Maxwell). attack_speed — по памяти, проверить */
export const TUNING = { health: 5, defense: 1, walk_speed: 1.5, strength: 1, critical_damage: 1, critical_chance: 0.2, attack_speed: 0.3, intelligence: 2 };
const TUNING_KEY = { health: 'health', defense: 'defense', walk_speed: 'speed', strength: 'strength', critical_damage: 'crit_damage', critical_chance: 'crit_chance', attack_speed: 'attack_speed', intelligence: 'intelligence' };

/** Tuning: в API лежит { slot_0: { health: 10, ... }, highest_unlocked_slot } — берём активный слот */
export function tuningStats(tuning) {
  const slot = tuning?.slot_0 || tuning || {};
  const out = {};
  for (const [k, v] of Object.entries(slot)) if (TUNING[k] && Number(v) > 0) out[TUNING_KEY[k]] = TUNING[k] * Number(v);
  return out;
}

// ---------- Скиллы, слееры, SkyBlock Level, питомец ----------

const NEU_KEY = { health: 'health', defence: 'defense', defense: 'defense', strength: 'strength', speed: 'speed', crit_chance: 'crit_chance', crit_damage: 'crit_damage', intelligence: 'intelligence', ferocity: 'ferocity', ability_damage: 'ability_damage', pet_luck: 'pet_luck', magic_find: 'magic_find', true_defense: 'true_defense' };

/** Сумма бонусов NEU за уровни 1..level: на каждом уровне действует ближайший ключ ≤ уровня */
export function levelBonus(table, level) {
  const out = {};
  if (!table) return out;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (let lv = 1; lv <= level; lv++) {
    const k = [...keys].reverse().find(x => x <= lv);
    if (k == null) continue;
    for (const [stat, v] of Object.entries(table[k] || {})) {
      const key = NEU_KEY[stat];
      if (key) out[key] = (out[key] || 0) + v;
    }
  }
  return out;
}

/** SkyBlock Level: +5 Health за уровень и +1 Strength за каждые 5 уровней (вики SkyBlock Level, «Stat») */
export function sbLevelStats(level) {
  const lv = Math.floor(level || 0);
  return lv > 0 ? { health: 5 * lv, strength: Math.floor(lv / 5) } : {};
}

const PET_TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

/** Статы питомца из NEU petnums с линейной интерполяцией между уровнями */
export function petStats(pet, petnums) {
  if (!pet || !petnums) return {};
  let tier = pet.tier;
  // Tier Boost поднимает редкость на ступень
  if (pet.heldItem === 'PET_ITEM_TIER_BOOST') tier = PET_TIERS[Math.min(PET_TIERS.indexOf(tier) + 1, PET_TIERS.length - 1)];
  const table = petnums[pet.type]?.[tier];
  if (!table) return {};
  const lv = Object.keys(table).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
  if (!lv.length) return {};
  const level = pet.level || 1;
  let nums;
  if (level <= lv[0]) nums = table[lv[0]].statNums || {};
  else if (level >= lv[lv.length - 1]) nums = table[lv[lv.length - 1]].statNums || {};
  else {
    const hi = lv.find(n => n >= level), lo = lv[lv.indexOf(hi) - 1], t = (level - lo) / (hi - lo);
    const a = table[lo].statNums || {}, b = table[hi].statNums || {};
    nums = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) nums[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * t;
  }
  const out = {};
  for (const [k, v] of Object.entries(nums)) {
    const key = k === 'BONUS_ATTACK_SPEED' ? 'attack_speed' : k.toLowerCase();
    out[key] = (out[key] || 0) + v;
  }
  return out;
}

// ---------- Аксессуары ----------

/**
 * Активные аксессуары: дубликаты по ID считаются один раз, из линейки (Talisman → Ring → Artifact) — только старший.
 * @param {Array} items  содержимое Accessory Bag
 * @param {Object} upgrades  { младший: [все старшие] } (buildUpgrades от misc.talisman_upgrades)
 */
export function activeAccessories(items = [], upgrades = {}) {
  const have = new Set(items.filter(it => it?.id).map(it => it.id));
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it?.id || seen.has(it.id)) continue;
    seen.add(it.id);
    if ((upgrades[it.id] || []).some(h => have.has(h) && !(upgrades[h] || []).includes(it.id))) continue;
    out.push(it);
  }
  return out;
}

// ---------- Перки питомцев, умножающие статы ----------

/** Какие статы растут от «большинства статов» */
export const BOOSTED = ['health', 'defense', 'strength', 'speed', 'crit_chance', 'crit_damage', 'intelligence', 'true_defense', 'ferocity', 'attack_speed', 'magic_find', 'sea_creature_chance', 'pet_luck', 'ability_damage'];

/** Доля прибавки ко всем статам от перка питомца (0.1 = +10%) */
export function petStatBoost(pet) {
  if (!pet) return 0;
  let tier = pet.tier;
  if (pet.heldItem === 'PET_ITEM_TIER_BOOST') tier = PET_TIERS[Math.min(PET_TIERS.indexOf(tier) + 1, PET_TIERS.length - 1)];
  if (pet.type === 'ENDER_DRAGON' && (tier === 'LEGENDARY' || tier === 'MYTHIC')) return 0.001 * (pet.level || 1);
  return 0;
}

// ---------- Очки Tuning ----------

/** Очки Tuning: 1 за каждые 10 Magical Power и 1 за каждый аксессуар с Accessory Enrichment (меню Stats Tuning) */
export function tuningPoints(member) {
  const mp = member?.magicalPower || 0;
  const enriched = (member?.inv?.talismans || []).filter(it => it?.id && (it.enrichment || (it.upgrades || []).some(u => u.kind === 'enrichment'))).length;
  return Math.floor(mp / 10) + enriched;
}

// ---------- Бонусы аксессуаров, которых нет в строках статов ----------

const GLYPH = /[\ue000-\uf8ff]/g;

/**
 * Статы из строк «Current Bonus: +7 Health» / «Bonus: +5 Strength» (New Year Cake Bag, Blood God Crest):
 * у таких аксессуаров обычной строки «Health: +N» в лоре нет. Значок стата между числом и названием убираем.
 */
export function bonusLineStats(lore = []) {
  const out = {};
  for (const raw of lore || []) {
    const m = strip(raw).replace(GLYPH, '').match(/^(?:Current )?Bonus: \+([\d,]+(?:\.\d+)?)\s*([A-Z][A-Za-z ]+?)\s*$/);
    const key = m && LORE_KEY[m[2].trim()];
    if (key && out[key] == null) out[key] = Number(m[1].replace(/,/g, ''));
  }
  return out;
}

// ---------- Melody's Harp ----------

/** Intelligence за первое идеальное прохождение песни на арфе Melody (вики Melody's Harp; сумма сверена с меню игры, 28 за 11 песен) */
export const HARP_INT = {
  hymn_joy: 1, frere_jacques: 1, amazing_grace: 1, brahms: 2, happy_birthday: 2, greensleeves: 2,
  jeopardy: 3, minuet: 3, joy_world: 4, pure_imagination: 4, vie_en_rose: 5, fire_and_flames: 6, pachelbel: 7,
};

/** Intelligence от песен арфы: песня засчитана, если пройдена идеально (perfect_completions или best_completion = 1) */
export function harpIntelligence(harp) {
  let n = 0;
  for (const [id, s] of Object.entries(harp?.songs || {})) if (HARP_INT[id] && ((s?.perfect || 0) > 0 || (s?.best || 0) >= 1)) n += HARP_INT[id];
  return n;
}

// ---------- Slayers ----------

/**
 * Поправки к таблице NEU bonuses.json, где она расходится с игрой. Voidgloom Seraph: Intelligence на уровнях 2/4/6/8 —
 * +2/+3/+4/+5 (в NEU +1/+2/+3/+4). Сверено с меню игры 25.11.2026: Voidgloom 7 даёт +9 Intelligence.
 */
const SLAYER_FIX = { enderman: { 2: { intelligence: 2 }, 4: { intelligence: 3 }, 6: { intelligence: 4 }, 8: { intelligence: 5 } } };

/** Таблица бонусов слеера: NEU с поправками SLAYER_FIX */
export function slayerTable(neuTable, key) {
  const fix = SLAYER_FIX[key];
  if (!fix) return neuTable;
  const t = { ...(neuTable || {}) };
  for (const [lv, stats] of Object.entries(fix)) t[lv] = { ...(t[lv] || {}), ...stats };
  return t;
}

// ---------- Сборка листа ----------

const add = (to, from, k = 1) => { for (const [s, v] of Object.entries(from || {})) if (Number.isFinite(v)) to[s] = (to[s] || 0) + v * k; };
const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));

/** Essence-перки, которые дают статы. Значения за уровень — по памяти, sure: false */
const PERKS_WORLD = { permanent_health: ['health', 2], permanent_defense: ['defense', 1], permanent_strength: ['strength', 1], permanent_intelligence: ['intelligence', 2], permanent_speed: ['speed', 1] };

/**
 * Лист статов.
 * @param {Object} member  разобранный профиль (server/parse/profile.js)
 * @param {Object} o
 * @param {'world'|'dungeon'} [o.where]  вне данжа или внутри
 * @param {Object} [o.weapon]  предмет в руке (его статы тоже идут в лист)
 * @param {Array} [o.armor]  другой набор брони (по умолчанию надетая)
 * @param {Object|null} [o.pet]  другой питомец (по умолчанию активный), null — без питомца
 * @param {Object} [o.neu]  { petnums, bonuses, upgrades }
 * @returns {{ total, sources: Array<{ key, label, stats, sure }>, missing: string[] }}
 */
export function statSheet(member, o = {}) {
  const where = o.where === 'dungeon' ? 'dungeon' : 'world';
  const neu = o.neu || {};
  const inv = member?.inv || {};
  const sources = [];
  const push = (key, label, stats, sure = true) => { if (stats && Object.keys(stats).length) sources.push({ key, label, stats: round(stats), sure }); };
  const lore = it => itemStats(it?.lore)[where];

  push('base', 'Базовые статы', BASE);

  const armor = o.armor || inv.armor || [];
  for (const it of armor) if (it?.id) push(tx`armor:${it.id}`, it.name || it.id, lore(it));
  for (const it of o.equipment || inv.equipment || []) if (it?.id) push(tx`equipment:${it.id}`, it.name || it.id, lore(it));
  if (o.weapon?.id) {
    const w = { ...lore(o.weapon) };
    delete w.damage; // урон оружия — не стат игрока, его считает формула удара
    push(tx`weapon:${o.weapon.id}`, o.weapon.name || o.weapon.id, w);
  }

  const acc = {};
  for (const it of activeAccessories(inv.talismans || [], neu.upgrades || {})) {
    const st = lore(it);
    add(acc, st);
    for (const [k, v] of Object.entries(bonusLineStats(it.lore))) if (st[k] == null) acc[k] = (acc[k] || 0) + v;
  }
  push('accessories', 'Аксессуары (сумма по лору)', acc);

  const power = o.power || member?.selectedPower;
  const ps = powerStats(power, member?.magicalPower || 0);
  if (ps) {
    push('power', tx`Accessory Power ${power} (×${ps.multiplier.toFixed(2)} от ${member.magicalPower} MP)`, ps.stats);
    push('power-unique', tx`Уникальный бонус ${power}`, ps.unique);
  }
  push('tuning', 'Tuning (Maxwell)', tuningStats(member?.tuning));

  const pet = o.pet !== undefined ? o.pet : (member?.pets || []).find(p => p.active) || null;
  if (pet) push(tx`pet:${pet.type}`, tx`Питомец ${pet.type} (${pet.tier}, ур. ${pet.level})`, petStats(pet, neu.petnums));

  const bonus = neu.bonuses?.bonus_stats || {};
  const skills = {};
  for (const [k, s] of Object.entries(member?.skills || {})) add(skills, levelBonus(bonus[tx`skill_${k}`], s?.level || 0));
  push('skills', 'Скиллы', skills);
  const slayers = {};
  for (const [k, s] of Object.entries(member?.slayers || {})) add(slayers, levelBonus(slayerTable(bonus[tx`slayer_${k}`], k), s?.level || 0));
  push('slayers', 'Slayers', slayers);

  push('sblevel', tx`SkyBlock Level ${Math.floor(member?.sbLevel || 0)}`, sbLevelStats(member?.sbLevel));

  const perks = {};
  for (const [k, [stat, per]] of Object.entries(PERKS_WORLD)) if (member?.perks?.[k]) perks[stat] = (perks[stat] || 0) + per * member.perks[k];
  push('perks', 'Перки Essence Shop (Forbidden …)', perks, false);

  // Bestiary: +1 Health за этап (меню игры 25.11.2026: 185 этапов → +185)
  if (member?.bestiaryMilestone) push('bestiary', tx`Bestiary, этапов: ${member.bestiaryMilestone}`, { health: member.bestiaryMilestone });

  const harpInt = harpIntelligence(member?.harp);
  if (harpInt) push('harp', 'Песни Melody\'s Harp', { intelligence: harpInt });

  const raw = {};
  for (const s of sources) add(raw, s.stats);
  // Питомцы с перком «увеличивает большинство статов на N%» (Ender Dragon Legendary: Superior, 0.1% за уровень).
  // Проверено по меню игры 25.11.2026: оружие с +70 Crit Damage в руке даёт +77 при Ender Dragon 100 ур.
  const boost = petStatBoost(pet);
  if (boost) {
    const extra = {};
    for (const k of BOOSTED) if (raw[k]) extra[k] = raw[k] * boost;
    push(tx`pet-boost:${pet.type}`, tx`Перк питомца ${pet.type}: +${Math.round(boost * 1000) / 10}% к статам`, extra);
    add(raw, extra);
  }
  const total = round(raw);
  const capped = {};
  for (const [k, cap] of Object.entries(CAPS)) if (total[k] > cap) { capped[k] = total[k]; total[k] = cap; }

  const missing = ['зелья и баффы', 'Century Cake', 'сетовые бонусы брони', 'бонусы мэров', 'Booster Cookie и прочие временные эффекты'];
  if (where === 'dungeon') missing.push('перки Undead Essence (статы в данже)', 'двойной Magical Power данжевых аксессуаров', 'бонусы класса');
  return { where, total, capped, sources, missing };
}

/** Сверка листа с цифрами из игры: { stat: { calc, game, diff } } */
export function compareWithGame(sheet, game) {
  const out = {};
  for (const [k, g] of Object.entries(game || {})) {
    const c = sheet.capped?.[k] ?? sheet.total[k] ?? 0;
    out[k] = { calc: Math.round(c * 100) / 100, game: g, diff: Math.round((g - c) * 100) / 100 };
  }
  return out;
}
