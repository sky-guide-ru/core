// Формулы удара и выживаемости. Вики Hypixel SkyBlock: Damage Calculation, Ferocity, Attack Speed, Effective Health.
//
// Удар оружием:
//   начальный = (5 + Damage оружия) × (1 + Strength/100)
//   множитель = 1 + 0.04 × Combat (до 50 ур.; дальше +0.01 за уровень) + бонусы чар + бонус оружия (сложение)
//   итог = начальный × множитель × (1 + бонус брони) × (1 + Crit Damage/100, если крит)
// Способность: база × (1 + Intelligence/100 × масштаб способности) × (1 + Ability Damage/100). Ferocity к магии не применяется.
// EHP = Health × (1 + Defense/100); от true damage — Health × (1 + True Defense/100).

/** Бонус Combat к урону: +4% за уровень до 50, +1% за каждый уровень выше (NEU bonuses.json) */
export function combatBonus(level) {
  const lv = Math.max(0, Math.floor(level || 0));
  return 0.04 * Math.min(lv, 50) + 0.01 * Math.max(0, lv - 50);
}

/** Прибавка к множителю от чар (доля, 0.65 = +65%). Только постоянные бонусы, без условий по цели */
export const ENCHANT_BONUS = {
  sharpness: [0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.45, 0.65],
  power: [0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.50, 0.65],
};
/** Чары против типа мобов: { чара: { против, по уровням } } */
export const ENCHANT_VS = {
  smite: { vs: 'undead', lv: [0, 0.10, 0.20, 0.30, 0.40, 0.60, 0.80, 1.00] },
  bane_of_arthropods: { vs: 'arthropod', lv: [0, 0.10, 0.20, 0.30, 0.40, 0.60, 0.80, 1.00] },
  ender_slayer: { vs: 'ender', lv: [0, 0.15, 0.30, 0.45, 0.60, 0.80, 1.00, 1.30] },
  cubism: { vs: 'cubic', lv: [0, 0.10, 0.20, 0.30, 0.40, 0.60, 0.80] },
  dragon_hunter: { vs: 'dragon', lv: [0, 0.08, 0.16, 0.24, 0.32, 0.40] },
  impaling: { vs: 'aquatic', lv: [0, 0.125, 0.25, 0.375, 0.50] },
};

/**
 * Прибавка к множителю от чар оружия против данной цели.
 * @param {Object} enchants  { sharpness: 7, smite: 7, ... }
 * @param {{ types?: string[] }} [target]  типы цели: undead, arthropod, ender, cubic, dragon, aquatic
 * @param {'melee'|'bow'} [kind]
 */
export function enchantBonus(enchants = {}, target = {}, kind = 'melee') {
  let b = 0;
  const base = kind === 'bow' ? ['power'] : ['sharpness'];
  for (const k of base) b += ENCHANT_BONUS[k][enchants[k] || 0] || 0;
  const types = new Set(target.types || []);
  if (kind === 'melee') {
    for (const [k, e] of Object.entries(ENCHANT_VS)) if (types.has(e.vs) && enchants[k]) b += e.lv[Math.min(enchants[k], e.lv.length - 1)] || 0;
  }
  return b;
}

/**
 * Один удар оружием.
 * @param {Object} p
 * @param {number} p.weaponDamage  Damage оружия (из лора)
 * @param {number} p.strength
 * @param {number} p.critDamage  в процентах (304 = +304%)
 * @param {number} [p.combatLevel]
 * @param {number} [p.enchants]  доля от чар (enchantBonus)
 * @param {number} [p.weaponBonus]  доля от свойства оружия (например +50% по Wither-мобам)
 * @param {number} [p.armorBonus]  доля от брони/сетов (умножается отдельно)
 * @returns {{ normal: number, crit: number }}
 */
export function meleeHit(p) {
  const initial = (5 + (p.weaponDamage || 0)) * (1 + (p.strength || 0) / 100);
  const mult = 1 + combatBonus(p.combatLevel) + (p.enchants || 0) + (p.weaponBonus || 0);
  const normal = initial * mult * (1 + (p.armorBonus || 0));
  return { normal: Math.floor(normal), crit: Math.floor(normal * (1 + (p.critDamage || 0) / 100)) };
}

/** Средний урон удара с учётом шанса крита (Crit Chance выше 100% не помогает) */
export function expectedHit(hit, critChance) {
  const c = Math.min(Math.max(critChance || 0, 0), 100) / 100;
  return hit.normal * (1 - c) + hit.crit * c;
}

/** Ударов в секунду в ближнем бою: неуязвимость цели round(10 / (1 + AS/100)) тиков, 20 тиков в секунду */
export function meleeHitsPerSecond(attackSpeed) {
  const as = Math.min(Math.max(attackSpeed || 0, 0), 100);
  return 20 / Math.round(10 / (1 + as / 100));
}

/** Средний урон в секунду ближним боем: средний удар × удары в секунду × (1 + Ferocity/100) */
export function meleeDps({ hit, critChance, attackSpeed, ferocity }) {
  return expectedHit(hit, critChance) * meleeHitsPerSecond(attackSpeed) * (1 + Math.max(0, ferocity || 0) / 100);
}

/**
 * Урон способности.
 * @param {number} base  базовый урон способности
 * @param {number} intelligence
 * @param {number} scaling  масштаб от Intelligence (у большинства 1, у части способностей меньше)
 * @param {number} [abilityDamage]  Ability Damage в процентах
 * @param {number} [bonus]  прочие доли (чары, броня), складываются с 1
 */
export function abilityHit(base, intelligence, scaling = 1, abilityDamage = 0, bonus = 0) {
  return Math.floor(base * (1 + (intelligence || 0) / 100 * scaling) * (1 + (abilityDamage || 0) / 100) * (1 + bonus));
}

/** Эффективное здоровье: сколько урона выдержишь от обычных атак и от true damage */
export function ehp(health, defense, trueDefense = 0) {
  return {
    normal: Math.round((health || 0) * (1 + Math.max(0, defense || 0) / 100)),
    true: Math.round((health || 0) * (1 + Math.max(0, trueDefense || 0) / 100)),
  };
}

/** Доля урона, которую срезает Defense: def / (def + 100) */
export const damageReduction = defense => Math.max(0, defense || 0) / (Math.max(0, defense || 0) + 100);
