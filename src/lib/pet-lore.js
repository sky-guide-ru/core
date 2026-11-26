// Подстановка чисел в лор питомцев из NEU: «[Lvl {LVL}] Ender Dragon», «Сила: +{STRENGTH}», «{0}%».
// NEU хранит значения в constants/petnums.json по уровням; между ними — линейная интерполяция.
import { tx } from '../../i18n/msg.js';
const TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
const fmt = v => (Math.round(v * 10) / 10).toString();

function numsAt(table, level) {
  const lv = Object.keys(table).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (!lv.length) return null;
  if (level <= lv[0]) return table[lv[0]];
  if (level >= lv[lv.length - 1]) return table[lv[lv.length - 1]];
  const hi = lv.find(n => n >= level), lo = lv[lv.indexOf(hi) - 1];
  const a = table[lo], b = table[hi], t = (level - lo) / (hi - lo);
  const mix = (x = 0, y = 0) => x + (y - x) * t;
  const statNums = {};
  for (const k of new Set([...Object.keys(a.statNums || {}), ...Object.keys(b.statNums || {})])) statNums[k] = mix(a.statNums?.[k], b.statNums?.[k]);
  return { statNums, otherNums: (b.otherNums || []).map((y, i) => mix(a.otherNums?.[i], y)) };
}

/**
 * @param {string} id  ID вида ENDER_DRAGON;4
 * @param {string} name
 * @param {string[]} lore
 * @param {object} petnums neu.constants.petnums
 * @param {number} level
 */
export function fillPetLore(id, name, lore, petnums, level = 100) {
  const m = /^(.+);(\d)$/.exec(id || '');
  const lvlLabel = s => s.replace(/\[Lvl \{LVL\}\]/g, `[Ур. ${level}]`).replace(/\{LVL\}/g, String(level));
  // Название «[Lvl {LVL}] Sloth» — по ключу, чтобы английская версия показала «[Lvl 100] Sloth»
  const nameLabel = s => { const t = /^\[Lvl \{LVL\}\] (.+)$/.exec(s || ''); return t ? tx`[Ур. ${level}] ${t[1]}` : lvlLabel(s); };
  if (!m) return { name: nameLabel(name), lore };
  const table = petnums?.[m[1]]?.[TIERS[Number(m[2])]];
  const n = table ? numsAt(table, level) : null;
  const sub = s => lvlLabel(s)
    .replace(/\{([A-Z_]+)\}/g, (all, k) => (n?.statNums?.[k] != null ? fmt(n.statNums[k]) : all))
    .replace(/\{(\d+)\}/g, (all, i) => (n?.otherNums?.[i] != null ? fmt(n.otherNums[i]) : all));
  return { name: nameLabel(name), lore: lore.map(sub), level };
}
