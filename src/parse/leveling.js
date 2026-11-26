import { neu } from '../neu.js';

// Запасная таблица опыта скиллов (до 60), если NEU не загрузился
const FALLBACK_SKILL = [50,125,200,300,500,750,1000,1500,2000,3500,5000,7500,10000,15000,20000,30000,50000,75000,100000,200000,300000,400000,500000,600000,700000,800000,900000,1000000,1100000,1200000,1300000,1400000,1500000,1600000,1700000,1800000,1900000,2000000,2100000,2200000,2300000,2400000,2500000,2600000,2750000,2900000,3100000,3400000,3700000,4000000,4300000,4600000,4900000,5200000,5500000,5800000,6100000,6400000,6700000,7000000];
const FALLBACK_CATA = [50,75,110,160,230,330,470,670,950,1340,1890,2665,3760,5260,7380,10300,14400,20000,27600,38000,52500,71500,97000,132000,180000,243000,328000,445000,600000,800000,1065000,1410000,1900000,2500000,3300000,4300000,5600000,7200000,9200000,12000000,15000000,19000000,24000000,30000000,38000000,48000000,60000000,75000000,93000000,116250000];
const DEFAULT_CAPS = { farming: 50, mining: 60, combat: 60, foraging: 50, fishing: 50, enchanting: 60, alchemy: 50, carpentry: 50, runecrafting: 25, taming: 50, social: 25, hunting: 50, catacombs: 50 };

function levelFrom(xp, table, cap) {
  let lvl = 0, rem = xp;
  for (let i = 0; i < Math.min(cap, table.length); i++) {
    if (rem < table[i]) return { level: lvl, xpCurrent: rem, xpForNext: table[i], progress: rem / table[i], maxLevel: cap, xp };
    rem -= table[i];
    lvl++;
  }
  return { level: lvl, xpCurrent: rem, xpForNext: 0, progress: 1, maxLevel: cap, xp };
}

function skillTable(skill) {
  const L = neu.constants.leveling || {};
  if (skill === 'runecrafting' && L.runecrafting_xp) return L.runecrafting_xp;
  if (skill === 'social' && L.social) return L.social;
  return L.leveling_xp || FALLBACK_SKILL;
}

/**
 * Overflow-уровень: уровень без игрового капа, с дробной частью («70.95»), как у Discord-ботов (!osk) и SkyHanni.
 * Сначала своя таблица скилла; если она короче 60 уровней (Runecrafting, Social), дальше идут уровни
 * из общей таблицы (Combat) до 60. После 60 каждый уровень дороже предыдущего на 600k (61-й — 7.6M),
 * а прибавка удваивается на 70, 80, 90… Бонусов эти уровни не дают — это только мера опыта сверх максимума.
 */
export function overflowLevel(skill, xp) {
  const own = skillTable(skill);
  const common = neu.constants.leveling?.leveling_xp || FALLBACK_SKILL;
  const table = own.length < common.length ? [...own, ...common.slice(own.length)] : own;
  let lvl = 0, rem = Math.max(0, xp || 0);
  for (const need of table) {
    if (rem < need) return { level: lvl + rem / need, xpCurrent: rem, xpForNext: need };
    rem -= need; lvl++;
  }
  let slope = 600_000;
  let need = (table[table.length - 1] || 0) + slope;
  // Предел на всякий случай: даже десятки миллиардов опыта — меньше 1000 уровней сверху
  for (let guard = 0; rem >= need && guard < 1000; guard++) {
    rem -= need; lvl++;
    need += slope;
    if (lvl % 10 === 0) slope *= 2;
  }
  return { level: lvl + rem / need, xpCurrent: rem, xpForNext: need };
}

// Дробный уровень до сотых, с округлением, как у ботов (toFixed(2))
export const round2 = v => Math.round((v || 0) * 100) / 100;

export function skillLevel(skill, xp, capOverride) {
  const L = neu.constants.leveling || {};
  const cap = capOverride ?? L.leveling_caps?.[skill] ?? DEFAULT_CAPS[skill] ?? 50;
  const out = levelFrom(xp || 0, skillTable(skill), cap);
  // Опыт сверх игрового капа: отдельное поле, настоящий уровень (и всё, что от него зависит) не меняется
  if (out.level >= cap) {
    const o = overflowLevel(skill, xp);
    if (o.level > cap) out.overflow = { level: round2(o.level), xpCurrent: Math.floor(o.xpCurrent), xpForNext: o.xpForNext };
  }
  return out;
}

export function cataLevel(xp) {
  const L = neu.constants.leveling || {};
  return levelFrom(xp || 0, L.catacombs || FALLBACK_CATA, 50);
}

export function hotmLevel(xp) {
  // Поуровневая таблица, первый уровень бесплатный (0)
  const table = neu.constants.leveling?.HOTM || [0, 3000, 9000, 25000, 60000, 100000, 150000, 210000, 290000, 400000];
  return levelFrom(xp || 0, table, table.length);
}

export function hotfLevel(xp) {
  const table = neu.constants.leveling?.HOTF || [0, 3000, 9000, 25000, 60000, 100000, 150000, 200000];
  return levelFrom(xp || 0, table, table.length);
}

const SLAYER_FALLBACK = {
  zombie: [5, 15, 200, 1000, 5000, 20000, 100000, 400000, 1000000],
  spider: [5, 25, 200, 1000, 5000, 20000, 100000, 400000, 1000000],
  wolf: [10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
  enderman: [10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
  blaze: [10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
  vampire: [20, 75, 240, 840, 2400],
};
export function slayerLevel(boss, xp) {
  const table = neu.constants.leveling?.slayer_xp?.[boss] || SLAYER_FALLBACK[boss] || SLAYER_FALLBACK.zombie;
  let lvl = 0;
  for (const t of table) if (xp >= t) lvl++;
  const next = table[lvl] ?? null;
  const prev = lvl ? table[lvl - 1] : 0;
  return { level: lvl, maxLevel: table.length, xp, xpForNext: next, progress: next ? (xp - prev) / (next - prev) : 1 };
}

// Уровень питомца по опыту (таблицы NEU pets.json)
export function petLevel(type, tier, exp) {
  const P = neu.constants.pets;
  if (!P) return { level: 1, maxLevel: 100, progress: 0 };
  const custom = P.custom_pet_leveling?.[type];
  const offset = P.pet_rarity_offset?.[tier] ?? 0;
  let table = P.pet_levels.slice(offset, offset + 99);
  let maxLevel = 100;
  if (custom) {
    maxLevel = custom.max_level || 100;
    if (custom.pet_levels) table = custom.type === 1 ? [...table, ...custom.pet_levels] : custom.pet_levels;
    table = table.slice(0, maxLevel - 1);
  }
  let lvl = 1, rem = exp;
  for (const need of table) {
    if (rem < need) return { level: lvl, maxLevel, progress: rem / need };
    rem -= need; lvl++;
  }
  return { level: Math.min(lvl, maxLevel), maxLevel, progress: 1 };
}
