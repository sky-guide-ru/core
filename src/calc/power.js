// Боевая сводка игрока для плана «Что делать»: лист статов, удар основным мечом, EHP, готовность к этажам данжа
// и «сколько процентов урона даст прибавка статов». Всё по данным API — значит примерно: без зелий, баффов и сетовых бонусов.
import { statSheet, itemStats, powerStats, tuningStats } from './stats.js';
import { meleeHit, expectedHit, enchantBonus, ehp } from './damage.js';
import { buildUpgrades } from '../lib/acc-upgrades.js';

import { itemType, MELEE, buildKit, bestKit, kitText } from './kit.js';
import { dungeonLoadout } from '../advisor/lib/loadouts.js';
import { tx } from '../../i18n/msg.js';

export { itemType };
const strip = s => String(s || '').replace(/§[0-9a-fk-or]/gi, '');

/**
 * Лучший меч игрока по среднему удару в мире. Сравниваем только оружие ближнего боя между собой:
 * лук, меч и магия бьют по-разному, и сравнивать их по одной цифре урона нельзя.
 */
export function bestMelee(member, base, combatLevel) {
  const inv = member?.inv || {};
  const pool = [...(inv.inventory || []), ...(inv.enderChest || []), ...Object.values(inv.backpacks || {}).flat()];
  let best = null;
  const seen = new Set();
  for (const it of pool) {
    if (!it?.id || seen.has(it.uuid || it.id) || !MELEE.has(itemType(it))) continue;
    seen.add(it.uuid || it.id);
    const s = itemStats(it.lore).world;
    if (!s.damage) continue;
    const strength = (base.strength || 0) + (s.strength || 0);
    const critDamage = (base.crit_damage || 0) + (s.crit_damage || 0);
    const critChance = (base.crit_chance || 0) + (s.crit_chance || 0);
    const hit = meleeHit({ weaponDamage: s.damage, strength, critDamage, combatLevel, enchants: enchantBonus(it.enchants || {}) });
    const avg = expectedHit(hit, critChance);
    if (!best || avg > best.avg) best = { id: it.id, name: strip(it.name), hit, avg: Math.round(avg), strength, critDamage, critChance: Math.min(100, critChance) };
  }
  return best;
}

/** Во сколько раз вырастет удар от прибавки Strength и Crit Damage (удар ∝ (1 + Str/100) × (1 + CD/100)) */
export function hitGain(base, delta) {
  const s = base.strength || 0, c = base.crit_damage || 0;
  // Прибавка меняет Crit Chance (например, смена Power: Fortuitous даёт много Crit Chance, Bloody — ни капли) —
  // считаем средний удар: крит срабатывает с шансом min(Crit Chance, 100%). Иначе потерю критов не видно
  if (delta.crit_chance) {
    const cc0 = base.crit_chance || 0, cc1 = cc0 + delta.crit_chance;
    const avg = (str, cd, cc) => (1 + str / 100) * (1 + Math.min(Math.max(cc, 0), 100) / 100 * Math.max(cd, 0) / 100);
    const b = avg(s, c, cc0);
    return b > 0 ? avg(s + (delta.strength || 0), c + (delta.crit_damage || 0), cc1) / b - 1 : 0;
  }
  const before = (1 + s / 100) * (1 + c / 100);
  const after = (1 + (s + (delta.strength || 0)) / 100) * (1 + (c + (delta.crit_damage || 0)) / 100);
  return before > 0 ? after / before - 1 : 0;
}

/** Прибавка статов от Power и Tuning, если Magical Power вырастет на gain */
export function mpGainStats(member, gain) {
  const mp = member?.magicalPower || 0;
  const out = {};
  const a = powerStats(member?.selectedPower, mp), b = powerStats(member?.selectedPower, mp + gain);
  if (a && b) for (const k of Object.keys(b.stats)) out[k] = (b.stats[k] || 0) - (a.stats[k] || 0);
  return out;
}

// Ориентиры Magical Power для этажей (Berserk Guide на вики; M1–M2 по сложности близки к F7)
export const FLOOR_MP = { F5: 550, F6: 550, F7: 700, M1: 700, M2: 700, M3: 950, M4: 1050, M5: 1200, M6: 1350, M7: 1500 };

/**
 * Готовность к этажу Master Mode: Magical Power, звёзды брони, EHP в данже.
 * @returns {{ floor, verdict: 'ready'|'almost'|'early', score, checks: Array<{ ok, text }> }}
 */
export function masterReadiness(member, floor, snap) {
  const key = tx`M${floor}`;
  const mp = member?.magicalPower || 0;
  const needMp = FLOOR_MP[key] || 700;
  // Данж-броня — из сета, в котором игрок ходит в данжи (Wardrobe), а не то, что надето прямо сейчас
  const dl = dungeonLoadout(member);
  const armor = (dl?.items || member?.inv?.armor || []).filter(it => it?.id);
  const dungeonArmor = armor.filter(it => /DUNGEON/.test(strip((it.lore || []).at(-1))));
  const stars = dungeonArmor.length ? Math.min(...dungeonArmor.map(it => it.stars || 0)) : 0;
  const checks = [
    { ok: mp >= needMp, part: Math.min(1, mp / needMp), text: tx`Magical Power ${mp} из ~${needMp}, с которыми обычно идут на ${key}` },
    { ok: dungeonArmor.length >= 4 && stars >= 5, part: dungeonArmor.length >= 4 ? Math.min(1, stars / 5) : dungeonArmor.length / 8, text: dungeonArmor.length >= 4 ? tx`данж-броня: звёзд ${stars} из 5` : 'надета не данж-броня: в данже её статы не растут от Catacombs' },
  ];
  if (floor >= 3) {
    const ms = dungeonArmor.length ? Math.min(...dungeonArmor.map(it => Math.max(0, (it.stars || 0) - 5))) : 0;
    checks.push({ ok: ms >= 1, part: ms >= 1 ? 1 : 0.5, text: tx`Master Stars на броне: ${ms} из 5` });
  }
  const score = checks.reduce((s, c) => s + c.part, 0) / checks.length;
  const verdict = checks.every(c => c.ok) ? 'ready' : score >= 0.8 ? 'almost' : 'early';
  return { floor, key, verdict, score: Math.round(score * 100) / 100, needMp, checks: checks.map(({ ok, text }) => ({ ok, text })), ehp: snap?.combat?.dungeonEhp || snap?.ehp?.dungeon?.normal || null };
}

/** NEU-константы для листа статов из neu.constants */
// Линейки аксессуаров считаются по справочнику NEU, а он меняется раз в несколько часов: помним по объекту
let upMemo = null;
const upgradesOf = raw => (upMemo && upMemo.raw === raw ? upMemo : (upMemo = { raw, map: buildUpgrades(raw) })).map;
export function neuForCalc(constants = {}) {
  return {
    petnums: constants.petnums || null,
    bonuses: constants.bonuses || null,
    upgrades: constants.misc?.talisman_upgrades ? upgradesOf(constants.misc.talisman_upgrades) : {},
  };
}

/**
 * Боевая сводка игрока.
 * @param {Object} member
 * @param {Object} [constants]  neu.constants
 */
export function combatSnapshot(member, constants = {}) {
  if (!member) return null;
  const neu = neuForCalc(constants);
  const world = statSheet(member, { neu, where: 'world' });
  const dungeon = statSheet(member, { neu, where: 'dungeon' });
  const combatLevel = member.skills?.combat?.level || 0;
  const weapon = bestMelee(member, world.total, combatLevel);
  const t = world.total, d = dungeon.total;
  return {
    approx: true,
    world: t,
    dungeon: d,
    sources: world.sources.map(s => ({ label: s.label, sure: s.sure, stats: s.stats })),
    missing: world.missing,
    ehp: { world: ehp(t.health, t.defense, t.true_defense), dungeon: ehp(d.health, d.defense, d.true_defense) },
    weapon,
    hasPet: !!(member.pets || []).find(p => p.active),
    tuning: tuningStats(member.tuning),
    neuReady: !!(neu.petnums && neu.bonuses),
    combat: combatKitView(member, neu, combatLevel),
  };
}

// Обычный крепкий моб: чтобы выбрать боевой набор «вообще», без особенностей конкретного босса
const GENERIC_TARGET = { hp: 50_000_000, dps: 5000, types: [] };

/**
 * Боевой набор игрока: лучший сет из Wardrobe, снаряжение, питомец и меч против обычного крепкого моба.
 * Нужен, чтобы статы на «Обзоре» и готовность к данжам не считались по фермерской или рыбацкой броне, надетой сейчас.
 */
export function combatKitView(member, neu, combatLevel) {
  try {
    const kit = buildKit(member, neu);
    const r = bestKit(kit, GENERIC_TARGET);
    const b = r.best;
    if (!b) return null;
    const st = b.stats;
    const hit = meleeHit({ weaponDamage: b.weapon.damage, strength: st.strength, critDamage: st.crit_damage, combatLevel, enchants: enchantBonus(b.weapon.enchants || {}) });
    const sv = r.saved[0];
    const loadout = sv?.loadout?.name && sv.armor === b.armor && sv.f.dps >= b.f.dps * 0.85 ? sv.loadout.name : null;
    // EHP в данже: данж-сет (по частям Wither) со снаряжением и питомцем боевого набора
    const dl = dungeonLoadout(member);
    let dungeonEhp = null;
    if (dl) {
      const d = statSheet(member, { neu, where: 'dungeon', armor: dl.items, equipment: b.equip?.items || [], pet: b.pet?.pet || null }).total;
      dungeonEhp = ehp(d.health, d.defense, d.true_defense).normal;
    }
    const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
    return {
      label: kitText(b),
      short: loadout ? tx`набор «${loadout}»: ${[b.armor?.set, b.pet?.pet ? b.pet.label.replace(/ \(.*\)$/, '') : null, b.weapon.name].filter(Boolean).join(', ')}` : kitText(b),
      set: b.armor?.set || null,
      loadout,
      worn: !!b.armor?.equipped,
      world: round(st),
      ehp: { world: ehp(st.health, st.defense, st.true_defense) },
      weapon: { id: b.weapon.id, name: b.weapon.name, hit },
      dungeonEhp,
    };
  } catch {
    return null;
  }
}
