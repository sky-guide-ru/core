import { ru } from '../../../i18n/msg.js';
import { tx } from '../../../i18n/msg.js';
// Реальные сеты игрока: надетая броня и слоты гардероба (система наборов, member.inv.wardrobeSets).
// Главное — броня Wither: у Necron/Storm/Goldor/Maxor и обычной Wither один и тот же бонус сета
// «Witherborn (x/4)», и он считается по любым частям Wither вперемешку. Поэтому смешанный сет
// (например, шлем Necron + нагрудник Maxor) — полноценный сет, а не «две неполные брони».

export const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
export const SLOT_RU = { HELMET: 'шлем', CHESTPLATE: 'нагрудник', LEGGINGS: 'поножи', BOOTS: 'ботинки' };

// Семейства брони Wither (id части = <PREFIX>_<SLOT>)
export const WITHER_FAMILIES = {
  POWER_WITHER: { short: 'Necron', name: "Necron's Armor", stats: 'сила и крит. урон', for: ['berserk', 'archer'] },
  SPEED_WITHER: { short: 'Maxor', name: "Maxor's Armor", stats: 'скорость и крит. урон, +5% к урону стрел', for: ['archer', 'berserk'] },
  WISE_WITHER: { short: 'Storm', name: "Storm's Armor", stats: 'интеллект (урон способностей)', for: ['mage', 'healer'] },
  TANK_WITHER: { short: 'Goldor', name: "Goldor's Armor", stats: 'защита и здоровье', for: ['tank'] },
  WITHER: { short: 'Wither', name: 'Wither Armor', stats: 'только здоровье и защита', for: [] },
};
const WITHER_RE = /^(POWER_WITHER|SPEED_WITHER|WISE_WITHER|TANK_WITHER|WITHER)_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/;

/** Семейство Wither по id части (POWER_WITHER, …) или null. WITHER_GOGGLES/WITHER_CLOAK не части сета. */
export function witherFamily(id) {
  const r = WITHER_RE.exec(String(id || ''));
  return r ? r[1] : null;
}

/** Все сеты игрока: сначала надетый, затем слоты гардероба. items — [шлем, нагрудник, поножи, ботинки]. */
export function armorLoadouts(m) {
  const inv = m?.inv || {};
  const out = [];
  const worn = (inv.armor || []).slice(0, 4);
  const sets = inv.wardrobeSets || [];
  const eq = sets.find(s => s.equipped);
  if (worn.some(i => i?.id)) {
    out.push({ key: 'worn', slot: eq?.slot ?? null, label: eq ? slotLabel(eq) : 'надетая броня', equipped: true, items: worn.map(i => i?.id ? i : null) });
  }
  for (const s of sets) {
    const items = SLOTS.map((_, i) => (s.items?.[i]?.id ? s.items[i] : null));
    if (!items.some(Boolean)) continue;
    // Надетый слот уже учтён как «worn» (те же вещи), второй раз не добавляем
    if (s.equipped && out[0]?.key === 'worn') continue;
    out.push({ key: tx`slot${s.slot}`, slot: s.slot, label: slotLabel(s), equipped: !!s.equipped, items });
  }
  return out;
}

function slotLabel(s) {
  const n = (s.names || []).filter(Boolean)[0];
  return n && !/^\d+$/.test(n) ? ru`слот гардероба ${s.slot} «${n}»` : ru`слот гардероба ${s.slot}`;
}

/** Разбор сета: части Wither, семейства, бонус Witherborn. */
export function describeLoadout(lo) {
  const pieces = lo.items.map((it, i) => it && { slot: SLOTS[i], item: it, family: witherFamily(it.id) }).filter(Boolean);
  const wither = pieces.filter(p => p.family);
  const fams = [...new Set(wither.map(p => p.family))];
  return {
    ...lo,
    pieces,
    wither: wither.length,
    families: fams,
    mixed: fams.length > 1,
    witherborn: wither.length >= 4,
    stars: wither.reduce((s, p) => s + (p.item.stars || 0), 0),
  };
}

/**
 * Сет, в котором игрок ходит в данжи: слот с наибольшим числом частей Wither
 * (при равенстве — надетый, затем с большим числом звёзд). null, если частей Wither нет нигде.
 */
export function dungeonLoadout(m) {
  const all = armorLoadouts(m).map(describeLoadout).filter(l => l.wither > 0);
  if (!all.length) return null;
  all.sort((a, b) => b.wither - a.wither || Number(b.equipped) - Number(a.equipped) || b.stars - a.stars);
  return all[0];
}

/** Части Wither по всем хранилищам (owned — Map id → [вещи]): { total, bySlot, byFamily }. */
export function witherOwned(owned) {
  const bySlot = {}, byFamily = {};
  let total = 0;
  for (const [id, list] of owned || []) {
    const f = witherFamily(id);
    if (!f || !list?.length) continue;
    const slot = id.slice(f.length + 1);
    bySlot[slot] = (bySlot[slot] || 0) + list.length;
    byFamily[f] = (byFamily[f] || 0) + list.length;
    total += list.length;
  }
  return { total, bySlot, byFamily, slotsCovered: SLOTS.filter(s => bySlot[s]).length };
}

/** «Necron + Maxor» — короткая подпись смешанного сета. */
export function familiesLabel(fams) {
  return fams.map(f => WITHER_FAMILIES[f]?.short || f).join(' + ');
}

/** Части сета, которые для класса лучше заменить (например, Goldor у лучника). */
export function offClassPieces(lo, cls) {
  if (!cls) return [];
  return (lo?.pieces || []).filter(p => p.family && !WITHER_FAMILIES[p.family].for.includes(cls));
}

/** Лучшее семейство Wither для класса. */
export function bestFamilyFor(cls) {
  return Object.keys(WITHER_FAMILIES).find(f => WITHER_FAMILIES[f].for[0] === cls)
    || Object.keys(WITHER_FAMILIES).find(f => WITHER_FAMILIES[f].for.includes(cls)) || 'POWER_WITHER';
}
