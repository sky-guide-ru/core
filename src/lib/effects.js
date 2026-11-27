// Зелья и баффы игрока: player_data.active_effects / paused_effects / disabled_potion_effects и temp_stat_buffs (Century Cake).
// Статы зелий по уровням — из описаний зелий в базе NEU (POTION_<ID>;<уровень>). Зелья в SkyBlock тикают только,
// пока игрок в игре, поэтому «осталось» — игровое время и в офлайне не убывает.

const lin = step => lvl => step * lvl;
const tab = arr => lvl => arr[Math.min(arr.length, lvl) - 1] || 0;

// id эффекта в API → что даёт. Значения сверены с описаниями зелий (Strength VIII: +75 Strength и т.д.)
export const EFFECT_STATS = {
  strength: { strength: tab([5, 12.5, 20, 30, 40, 50, 60, 75]) },
  critical: { crit_chance: tab([10, 15, 20, 25]), crit_damage: tab([10, 20, 30, 40]) },
  spirit: { speed: lin(10), crit_damage: lin(10) },
  agility: { speed: lin(10) },
  adrenaline: { speed: lin(5) },
  speed: { speed: lin(5) },
  rabbit: { speed: lin(10) },
  resistance: { defense: tab([5, 10, 15, 20, 30, 40, 50, 60]) },
  true_resistance: { true_defense: lin(5) },
  true_defense: { true_defense: lin(5) },
  haste: { mining_speed: lin(50) },
  spelunker: { mining_fortune: lin(5) },
  pet_luck: { pet_luck: lin(5) },
  harvest_harbinger: { farming_fortune: lin(10) },
  mushed_glowy_tonic: { fishing_speed: lin(30) },
  wisp_ice: { true_defense: lin(25), health_regen: lin(10) },
  wisps_ice_flavored_water: { true_defense: lin(25), health_regen: lin(10) },
};

// Названия как в игре, где они не выводятся из id
const NAMES = { true_resistance: 'True Resistance', true_defense: 'True Resistance', wisp_ice: "Wisp's Ice-Flavored Water", wisps_ice_flavored_water: "Wisp's Ice-Flavored Water", stinky_cheese: 'Douce Pluie de Stinky Cheese', jump_boost: 'Jump Boost', night_vision: 'Night Vision', water_breathing: 'Water Breathing', fire_resistance: 'Fire Resistance' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const title = s => String(s || '').toLowerCase().split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
export const effectName = id => NAMES[id] || title(id);

/** Статы одного эффекта: { strength: 75, ... } */
export function effectStats(id, level) {
  const t = EFFECT_STATS[id];
  if (!t || !(level > 0)) return {};
  return Object.fromEntries(Object.entries(t).map(([k, f]) => [k, f(level)]).filter(([, v]) => v));
}

const listOf = v => (Array.isArray(v) ? v : []);

/**
 * Разбор из player_data. at — время снимка профиля (для торта: срок у него настоящий, по часам).
 * @returns {{ active: Array, paused: Array, disabled: string[], cakes: Array }}
 */
export function parseEffects(pd = {}, at = Date.now()) {
  const one = paused => e => {
    const id = String(e?.effect || '').toLowerCase();
    const level = Number(e?.level) || 0;
    if (!id) return null;
    const infinite = !!e.infinite;
    return { id, name: effectName(id), level, roman: ROMAN[level] || String(level), secLeft: infinite ? null : Math.max(0, Math.round((Number(e.ticks_remaining) || 0) / 20)), infinite, paused, stats: effectStats(id, level) };
  };
  const cakes = listOf(pd.temp_stat_buffs).map(b => {
    const key = String(b?.key || '').toLowerCase();
    const stat = key.replace(/^cake_/, '') || String(b?.stat || '').toLowerCase();
    return { key, stat, amount: Number(b?.amount) || 0, expireAt: Number(b?.expire_at) || 0 };
  }).filter(c => c.key && (!c.expireAt || c.expireAt > at));
  return {
    active: listOf(pd.active_effects).map(one(false)).filter(Boolean),
    paused: listOf(pd.paused_effects).map(one(true)).filter(Boolean),
    disabled: listOf(pd.disabled_potion_effects).map(x => String(x).toLowerCase()),
    cakes,
  };
}

/** Сумма статов от действующих зелий и тортов: { strength: 75, crit_damage: 40, ... } */
export function buffTotals(effects, now = Date.now()) {
  const out = {};
  if (!effects) return out;
  const off = new Set(effects.disabled || []);
  for (const e of effects.active || []) {
    if (off.has(e.id)) continue;
    for (const [k, v] of Object.entries(e.stats || {})) out[k] = (out[k] || 0) + v;
  }
  for (const c of effects.cakes || []) {
    if (c.expireAt && c.expireAt <= now) continue;
    if (c.amount) out[c.stat] = (out[c.stat] || 0) + c.amount;
  }
  return out;
}
