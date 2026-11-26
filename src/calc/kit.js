// «Что надеть под занятие»: перебирает сеты брони из Wardrobe, наборы снаряжения, питомцев и оружие игрока
// и находит, в чём цель убивается быстрее всего, не умирая. Цифры примерные, как и весь лист статов:
// без зелий, баффов, сетовых бонусов брони и лечения. Формулы — только из stats.js и damage.js.
import { statSheet, itemStats, petStats, petStatBoost, BOOSTED, CAPS } from './stats.js';
import { meleeHit, expectedHit, enchantBonus, meleeHitsPerSecond, ehp, damageReduction } from './damage.js';
import { armorLoadouts, witherFamily, WITHER_FAMILIES } from '../advisor/lib/loadouts.js';
import { tx } from '../../i18n/msg.js';

const strip = s => String(s || '').replace(/§[0-9a-fk-or]/gi, '');
const PET_TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

/** Тип предмета из последней строки лора: «LEGENDARY DUNGEON SWORD» → SWORD */
export function itemType(it) {
  const last = strip((it?.lore || [])[(it?.lore || []).length - 1]);
  const m = last.match(/\b(SWORD|LONGSWORD|BOW|WAND|DAGGER|HELMET|CHESTPLATE|LEGGINGS|BOOTS|ACCESSORY|NECKLACE|CLOAK|BELT|GLOVES|BRACELET)\b/);
  return m ? m[1] : null;
}
export const MELEE = new Set(['SWORD', 'LONGSWORD', 'DAGGER']);

// Слова из лора «Deal +300% damage to Endermen» → тип моба
const MOB_WORD = { endermen: 'ender', ender: 'ender', undead: 'undead', zombies: 'undead', arthropod: 'arthropod', arthropods: 'arthropod', spiders: 'arthropod', infernal: 'infernal', blazes: 'infernal', wither: 'wither', animal: 'animal', wolves: 'animal' };

/** Бонус оружия против типов мобов из лора: { ender: 3 } (+300%), { infernal: 0.2 } (1.2x) */
export function weaponTypeBonus(lore = []) {
  const out = {};
  for (const raw of lore) {
    const line = strip(raw).replace(/[-]/g, '');
    const m = line.match(/Deals?\s+(?:\+(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)x)\s+damage to\s+(?:the\s+)?([A-Za-z]+)/i);
    if (!m) continue;
    const type = MOB_WORD[m[3].toLowerCase()];
    if (!type) continue;
    out[type] = (out[type] || 0) + (m[1] ? Number(m[1]) / 100 : Number(m[2]) - 1);
  }
  return out;
}

const PIECE = /_(HELMET|CHESTPLATE|LEGGINGS|BOOTS|CROWN|MASK|HOOD|HAT|SHIRT|TUNIC|PANTS|TROUSERS|SANDALS|SHOES|SLIPPERS|SUIT|TRUNKS|GALOSHES|CAP|HEAD)$/;
const pretty = id => id.toLowerCase().split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
/** Название сета по id частей: «Hot Crimson», «Necron + Maxor», «Final Destination» */
export function setName(items = []) {
  const names = [];
  for (const it of items) {
    if (!it?.id) continue;
    const f = witherFamily(it.id);
    const n = f ? WITHER_FAMILIES[f].short : pretty(it.id.replace(PIECE, ''));
    if (!names.includes(n)) names.push(n);
  }
  return names.slice(0, 3).join(' + ');
}

// Сетовые бонусы против типа мобов (лор NEU, проверено 25.11.2026). Остальные сетовые бонусы не считаем.
// mult — прибавка к урону множителем брони, stats — статы против этих мобов.
const SET_VS = [
  // Vivacious Darkness (4/4), при приседании: +30 Strength, +20 Attack Speed, +200 Ferocity и +100% урона против Endermen
  { prefix: 'FINAL_DESTINATION_', need: 4, type: 'ender', stats: { strength: 30, attack_speed: 20, ferocity: 200 }, mult: 1 },
  // Octodexterity (4/4): каждый 4-й удар +100% урона — в среднем +25%
  { prefix: 'TARANTULA_', need: 4, type: 'arthropod', mult: 0.25 },
  // Trolling The Reaper (3/3): +100 Defense против Undead
  { prefix: 'REVENANT_', need: 3, type: 'undead', stats: { defense: 100 } },
];
// Bulwark: каждая часть копит Defense против своих мобов («Piece Bonus: +N» в лоре)
const BULWARK = { 'Zombie Bulwark': 'undead', 'Spider Bulwark': 'arthropod', 'Enderman Bulwark': 'ender', 'Wolf Bulwark': 'animal' };

/** Бонусы сета против типов мобов: { ender: { stats: {...}, mult } } */
export function armorVs(items = []) {
  const out = {};
  const put = (type, stats, mult) => { const o = (out[type] ||= { stats: {}, mult: 0 }); add(o.stats, stats); o.mult += mult || 0; };
  for (const b of SET_VS) {
    if (items.filter(it => it?.id?.startsWith(b.prefix)).length >= b.need) put(b.type, b.stats, b.mult);
  }
  for (const it of items) {
    const lore = (it?.lore || []).map(strip);
    const i = lore.findIndex(l => /Piece Bonus: (Zombie|Spider|Enderman|Wolf) Bulwark/.test(l));
    if (i < 0) continue;
    const type = BULWARK[lore[i].replace(/^.*Piece Bonus: /, '').trim()];
    const v = lore.slice(i + 1, i + 4).map(l => l.match(/^Piece Bonus: \+(\d+)/)).find(Boolean);
    if (type && v) put(type, { defense: Number(v[1]) });
  }
  return out;
}

const add = (a, b) => { for (const [k, v] of Object.entries(b || {})) if (typeof v === 'number') a[k] = (a[k] || 0) + v; return a; };
const sumLore = items => items.reduce((acc, it) => (it?.id ? add(acc, itemStats(it.lore).world) : acc), {});

function petLabel(p) {
  const name = String(p.type || '').toLowerCase().split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
  const tier = p.tier ? p.tier[0] + p.tier.slice(1).toLowerCase() : '';
  return tx`${name} (${tier}${p.level ? tx`, ур. ${p.level}` : ''})`;
}

/**
 * Всё, из чего игрок собирает боевой набор: база без брони/снаряжения/питомца, сеты, снаряжение, питомцы, оружие, сохранённые наборы.
 * @param {Object} member
 * @param {Object} neu  { petnums, bonuses, upgrades } (neuForCalc)
 */
export function buildKit(member, neu = {}) {
  const inv = member?.inv || {};
  const base = statSheet(member, { neu, armor: [], equipment: [], pet: null });
  const armors = armorLoadouts(member).map(l => ({ key: l.key, slot: l.slot, label: l.label, set: setName(l.items), vs: armorVs(l.items), equipped: l.equipped, items: l.items, stats: sumLore(l.items) }));
  const equips = [];
  if ((inv.equipment || []).some(i => i?.id)) {
    const eq = (inv.equipmentSets || []).find(s => s.equipped);
    equips.push({ key: 'worn', slot: eq?.slot ?? null, label: 'надетое снаряжение', equipped: true, items: inv.equipment, stats: sumLore(inv.equipment) });
  }
  for (const s of inv.equipmentSets || []) {
    if (!s.items?.some(i => i?.id) || (s.equipped && equips[0]?.key === 'worn')) continue;
    const n = (s.names || []).filter(Boolean)[0];
    equips.push({ key: tx`eq${s.slot}`, slot: s.slot, label: n ? tx`набор снаряжения ${s.slot} «${n}»` : tx`набор снаряжения ${s.slot}`, equipped: !!s.equipped, items: s.items, stats: sumLore(s.items) });
  }
  if (!equips.length) equips.push({ key: 'none', slot: null, label: 'без снаряжения', items: [], stats: {} });

  const saved = inv.loadouts || [];
  const savedPets = new Set(saved.map(l => l.pet).filter(Boolean));
  const seenPet = new Set();
  const pets = (member?.pets || [])
    .filter(p => p.active || savedPets.has(p.uid) || PET_TIERS.indexOf(p.tier) >= 3)
    .filter(p => { const k = p.uid || tx`${p.type}:${p.tier}:${p.exp}`; if (seenPet.has(k)) return false; seenPet.add(k); return true; })
    .sort((a, b) => Number(b.active) - Number(a.active) || PET_TIERS.indexOf(b.tier) - PET_TIERS.indexOf(a.tier) || (b.level || 0) - (a.level || 0))
    .slice(0, 16)
    .map(p => ({ pet: p, uid: p.uid, label: petLabel(p), stats: petStats(p, neu.petnums), boost: petStatBoost(p) }));
  pets.push({ pet: null, uid: null, label: 'без питомца', stats: {}, boost: 0 });

  const pool = [...(inv.inventory || []), ...(inv.enderChest || []), ...(inv.vault || []), ...Object.values(inv.backpacks || {}).flat()];
  const weapons = [];
  const seenW = new Set();
  for (const it of pool) {
    if (!it?.id || seenW.has(it.uuid || it.id) || !MELEE.has(itemType(it))) continue;
    seenW.add(it.uuid || it.id);
    const st = { ...itemStats(it.lore).world };
    const damage = st.damage || 0;
    if (!damage) continue;
    delete st.damage;
    weapons.push({ id: it.id, name: strip(it.name).trim(), type: itemType(it), damage, stats: st, enchants: it.enchants || {}, vs: weaponTypeBonus(it.lore), item: it });
  }
  return { member, base: base.total, armors, equips, pets, weapons, saved, combatLevel: member?.skills?.combat?.level || 0 };
}

/** Итоговые статы набора: база + броня + снаряжение + питомец + оружие, перк питомца на «большинство статов», потолки */
export function comboStats(kit, armor, equip, pet, weapon) {
  const s = add(add(add(add({ ...kit.base }, armor?.stats), equip?.stats), pet?.stats), weapon?.stats);
  if (pet?.boost) for (const k of BOOSTED) if (s[k]) s[k] *= 1 + pet.boost;
  for (const [k, cap] of Object.entries(CAPS)) if (s[k] > cap) s[k] = cap;
  return s;
}

/**
 * Бой с целью: урон в секунду игрока, время убийства, сколько секунд продержишься без лечения.
 * @param {Object} target  { hp, dps, trueDps, truePct, types, shieldHits, dagger }
 */
export function fight(kit, stats, weapon, target, armorBonus = 0) {
  const types = target.types || [];
  const weaponBonus = types.reduce((s, t) => s + (weapon.vs?.[t] || 0), 0);
  const hit = meleeHit({ weaponDamage: weapon.damage, strength: stats.strength, critDamage: stats.crit_damage, combatLevel: kit.combatLevel, enchants: enchantBonus(weapon.enchants, { types }), weaponBonus, armorBonus });
  const avg = expectedHit(hit, stats.crit_chance);
  const hps = meleeHitsPerSecond(stats.attack_speed);
  const fero = target.dagger ? 0 : Math.max(0, stats.ferocity || 0) / 100;
  const dps = avg * hps * (1 + fero);
  const shieldSec = target.shieldHits ? (target.shieldHits * 3) / (hps * (1 + fero)) : 0;
  const ttk = dps > 0 ? target.hp / dps + shieldSec : Infinity;
  const health = stats.health || 0;
  const taken = (target.dps || 0) * (1 - damageReduction(stats.defense))
    + ((target.trueDps || 0) + (target.truePct || 0) * health) * (1 - damageReduction(stats.true_defense));
  const survive = taken > 0 ? health / taken : Infinity;
  return { dps: Math.round(dps), avg: Math.round(avg), ttk, survive, ehp: ehp(health, stats.defense, stats.true_defense).normal, health: Math.round(health) };
}

// Сколько секунд надо продержаться без лечения, чтобы бой считался посильным: обычно 6 с, у Blaze — по его true damage
const needSurvive = t => Math.min(6, t.truePct ? 0.6 / t.truePct : 6);

/** Оценка боя: easy — быстро и безопасно, ok — посильно, hard — долго или опасно, no — не пройти */
export function verdict(f, t) {
  const need = needSurvive(t);
  if (!Number.isFinite(f.ttk) || f.ttk > 600) return 'no';
  if (f.survive < need * 0.5) return 'no';
  if (f.ttk <= 30 && f.survive >= need * 1.5) return 'easy';
  if (f.ttk <= 90 && f.survive >= need) return 'ok';
  return 'hard';
}
const RANK = { easy: 3, ok: 2, hard: 1, no: 0 };

function better(a, b) {
  if (!b) return true;
  if (RANK[a.verdict] !== RANK[b.verdict]) return RANK[a.verdict] > RANK[b.verdict];
  if (a.verdict === 'no' || a.verdict === 'hard') return a.f.survive * (a.f.ttk < 600 ? 1 : 0.1) / Math.max(a.f.ttk, 1) > b.f.survive * (b.f.ttk < 600 ? 1 : 0.1) / Math.max(b.f.ttk, 1);
  return a.f.ttk < b.f.ttk;
}

/**
 * Лучший набор против цели и как справится каждый сохранённый набор игры.
 * @param {Object} kit  buildKit
 * @param {Object} target
 * @param {{ weaponFilter?: (w) => boolean }} [o]
 * @returns {{ best, saved: Array, weaponless: boolean }}
 */
export function bestKit(kit, target, o = {}) {
  const weapons = kit.weapons.filter(w => (target.dagger ? w.type === 'DAGGER' && o.daggerIds?.has(w.id) : true) && (!o.weaponFilter || o.weaponFilter(w)));
  if (!weapons.length) return { best: null, saved: [], weaponless: true };
  const KEYS = ['strength', 'crit_damage', 'crit_chance', 'attack_speed', 'ferocity', 'health', 'defense', 'true_defense'];
  const types = target.types || [];
  const vsOf = a => {
    const st = {}; let mult = 0;
    for (const t of types) if (a?.vs?.[t]) { add(st, a.vs[t].stats); mult += a.vs[t].mult; }
    return { st, mult };
  };
  const evalCombo = (a, e, p, w, pre) => {
    const st = {};
    const mult = 1 + (p?.boost || 0);
    const vs = vsOf(a);
    for (const k of KEYS) {
      let v = (pre[k] || 0) + (w.stats[k] || 0) + (vs.st[k] || 0);
      if (BOOSTED.includes(k)) v *= mult;
      if (CAPS[k] && v > CAPS[k]) v = CAPS[k];
      st[k] = v;
    }
    const f = fight(kit, st, w, target, vs.mult);
    return { armor: a, equip: e, pet: p, weapon: w, f, verdict: verdict(f, target) };
  };
  const preOf = (a, e, p) => add(add(add({ ...kit.base }, a?.stats), e?.stats), p?.stats);
  // Полный перебор (сеты × снаряжение × питомцы × оружие) слишком долгий, а вклады почти независимы:
  // начинаем с надетого и с каждого сохранённого набора и по очереди подбираем оружие, броню, снаряжение и питомца, пока есть улучшение.
  const tryAll = c => {
    let cur = c;
    for (let round = 0; round < 3; round++) {
      const start = cur;
      for (const w of weapons) { const x = evalCombo(cur.armor, cur.equip, cur.pet, w, preOf(cur.armor, cur.equip, cur.pet)); if (better(x, cur)) cur = x; }
      for (const a of kit.armors) { const x = evalCombo(a, cur.equip, cur.pet, cur.weapon, preOf(a, cur.equip, cur.pet)); if (better(x, cur)) cur = x; }
      for (const e of kit.equips) { const x = evalCombo(cur.armor, e, cur.pet, cur.weapon, preOf(cur.armor, e, cur.pet)); if (better(x, cur)) cur = x; }
      for (const p of kit.pets) { const x = evalCombo(cur.armor, cur.equip, p, cur.weapon, preOf(cur.armor, cur.equip, p)); if (better(x, cur)) cur = x; }
      if (cur === start) break;
    }
    return cur;
  };
  const starts = [{ armor: kit.armors[0] || null, equip: kit.equips[0], pet: kit.pets.find(p => p.pet?.active) || kit.pets[kit.pets.length - 1] }];
  for (const l of kit.saved) {
    const a = kit.armors.find(x => x.slot === l.armorSlot);
    if (a) starts.push({ armor: a, equip: kit.equips.find(x => x.slot === l.equipmentSlot) || kit.equips[0], pet: kit.pets.find(x => x.uid && x.uid === l.pet) || kit.pets[kit.pets.length - 1] });
  }
  let best = null;
  for (const st of starts) {
    const c = tryAll(evalCombo(st.armor, st.equip, st.pet, weapons[0], preOf(st.armor, st.equip, st.pet)));
    if (better(c, best)) best = c;
  }
  if (best) best.stats = comboStats(kit, best.armor, best.equip, best.pet, best.weapon);
  // Сохранённые наборы игры (меню Loadouts): их броня, снаряжение и питомец, лучшее оружие под цель
  const saved = [];
  for (const l of kit.saved) {
    const a = kit.armors.find(x => x.slot === l.armorSlot) || null;
    if (!a) continue;
    const e = kit.equips.find(x => x.slot === l.equipmentSlot) || kit.equips.find(x => x.key === 'none') || null;
    const p = kit.pets.find(x => x.uid && x.uid === l.pet) || kit.pets[kit.pets.length - 1];
    const pre = preOf(a, e, p);
    let top = null;
    for (const w of weapons) {
      const c = { loadout: l, ...evalCombo(a, e, p, w, pre) };
      if (better(c, top)) top = c;
    }
    if (top) saved.push(top);
  }
  saved.sort((x, y) => (better(x, y) ? -1 : 1));
  return { best, saved, weaponless: false };
}

/** Короткое описание набора для текста совета */
export function kitText(c) {
  if (!c) return '';
  const parts = [c.armor ? tx`${c.armor.label}${c.armor.set ? tx` (${c.armor.set})` : ''}` : null, c.equip && c.equip.key !== 'none' ? c.equip.label : null, c.pet?.pet ? tx`питомец ${c.pet.label}` : null, c.weapon?.name].filter(Boolean);
  return parts.join(', ');
}
