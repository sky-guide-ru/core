import { tx } from '../../i18n/msg.js';
// Подробности набора «что надеть»: каждая часть брони и оружие — звёзды, reforge, Recombobulator, Hot Potato Books,
// главные чары — и что в наборе улучшить дешевле всего. Данные — из NBT предметов (server/nbt.js).
const strip = s => String(s || '').replace(/§[0-9a-fk-or]/gi, '');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const title = s => String(s).split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const SLOT_RU = { HELMET: 'шлем', CHESTPLATE: 'нагрудник', LEGGINGS: 'поножи', BOOTS: 'ботинки' };

// Reforge, которые годятся для боя ближнего боя (броня и оружие); остальные — фермерские, шахтёрские и т. п.
const COMBAT_ARMOR_REFORGES = new Set(['ancient', 'fierce', 'renowned', 'giant', 'necrotic', 'pure', 'titanic', 'spiked', 'submerged', 'loving', 'heroic', 'wise', 'smart', 'mythic', 'clean', 'jaded', 'warped', 'empowered']);
const COMBAT_WEAPON_REFORGES = new Set(['withered', 'fabled', 'suspicious', 'dirty', 'gilded', 'spicy', 'sharp', 'legendary', 'fast', 'heroic', 'epic', 'fair', 'odd', 'gentle', 'jerry\'s', 'warped', 'bulky', 'coldfused', 'ancient']);
// Чары, которые показываем первыми
const ARMOR_ENCH = ['protection', 'growth', 'reflection', 'rejuvenate', 'true_protection', 'strong_mana', 'ferocious_mana'];
const WEAPON_ENCH = ['sharpness', 'giant_killer', 'critical', 'first_strike', 'triple_strike', 'ender_slayer', 'smite', 'bane_of_arthropods', 'execute', 'prosecute', 'looting'];
// Чары против типа моба
const TYPE_ENCH = { ender: 'ender_slayer', undead: 'smite', arthropod: 'bane_of_arthropods' };

/** «Ultimate Legion III, Protection VI, Growth VI» */
export function enchantText(ench = {}, order = []) {
  const ult = Object.entries(ench).filter(([k]) => k.startsWith('ultimate_')).map(([k, l]) => tx`${title(k.replace(/^ultimate_/, ''))} ${ROMAN[l] || l}`);
  const main = order.filter(k => ench[k]).map(k => tx`${title(k)} ${ROMAN[ench[k]] || ench[k]}`);
  return [...ult, ...main].slice(0, 4).join(', ');
}

const slotOf = it => (String(it?.id || '').match(/(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/) || [])[1] || null;
const starable = it => (it?.lore || []).some(l => /Gear Score|✪/.test(strip(l))) || /CRIMSON|AURORA|TERROR|FERVOR|HOLLOW|WITHER|NECRON|STORM|GOLDOR|MAXOR|SHADOW_ASSASSIN/.test(it?.id || '');

/** Одна вещь: имя и строка подробностей «5 звёзд · Reforge Ancient · Recombobulated · 10 Hot Potato Books · Protection VI» */
export function pieceDetail(it, kind = 'armor') {
  if (!it?.id) return null;
  const parts = [];
  const stars = Number(it.stars) || 0;
  if (stars) parts.push(stars > 5 ? tx`5 звёзд и ${stars - 5} Master Star` : tx`${stars} ${stars === 1 ? 'звезда' : stars < 5 ? 'звезды' : 'звёзд'}`);
  parts.push(it.reforge ? tx`Reforge ${title(it.reforge)}` : 'без Reforge');
  if (it.recomb) parts.push('Recombobulated');
  if (it.hpb) parts.push(it.hpb > 10 ? tx`10 Hot Potato и ${it.hpb - 10} Fuming` : tx`${it.hpb} Hot Potato Book`);
  const e = enchantText(it.enchants, kind === 'armor' ? ARMOR_ENCH : WEAPON_ENCH);
  if (e) parts.push(e);
  const slot = slotOf(it);
  return { id: it.id, name: strip(it.name).replace(/\s*[✪➊➋➌➍➎]+\s*/g, ' ').trim(), slot: slot ? SLOT_RU[slot] : null, text: parts.join(' · ') };
}

/**
 * Что улучшить в наборе в первую очередь — от дешёвого к дорогому: Reforge, Hot Potato Books, чары, звёзды, Recombobulator.
 * @param {{ armor?: { items }, weapon?: { item } }} c  набор из bestKit
 * @param {{ types?: string[], lack?: string[], price?: (id) => number, fmt?: (n) => string }} [o]
 * @returns {string[]} до трёх советов
 */
export function upgradeHints(c, o = {}) {
  const price = o.price || (() => 0);
  const fmt = o.fmt || (n => String(n));
  const cost = (id, n = 1) => (price(id) > 0 ? tx` (~${fmt(price(id) * n)})` : '');
  const armor = (c?.armor?.items || []).filter(i => i?.id);
  const w = c?.weapon?.hypo ? null : c?.weapon?.item;
  const ru = it => SLOT_RU[slotOf(it)] || strip(it.name);
  const list = s => s.length === 4 ? 'всех частях' : s.join(', ');
  const out = [];
  const badRef = armor.filter(i => !COMBAT_ARMOR_REFORGES.has(String(i.reforge || '').toLowerCase()));
  const wBadRef = w && !COMBAT_WEAPON_REFORGES.has(String(w.reforge || '').toLowerCase());
  if (badRef.length) out.push(tx`Reforge на ${list(badRef.map(ru))}: Fierce у Blacksmith дёшево, Ancient — с камнем Precursor Gear${cost('PRECURSOR_GEAR', badRef.length)}`);
  if (wBadRef) out.push(tx`Reforge оружия: Fabled или Withered (камни Dragon Claw${cost('DRAGON_CLAW')} и Wither Blood${cost('WITHER_BLOOD')}), дёшево — Spicy у Blacksmith`);
  const hpbNeed = [...armor, ...(w ? [w] : [])].reduce((n, i) => n + Math.max(0, 10 - (Number(i.hpb) || 0)), 0);
  if (hpbNeed > 0) out.push(tx`Hot Potato Book: ${hpbNeed} шт. до 10 на каждой вещи${cost('HOT_POTATO_BOOK', hpbNeed)} — Health и Defense на броне, урон на оружии`);
  for (const [e, gain] of [['growth', 'Health'], ['protection', 'Defense']]) {
    const miss = armor.filter(i => (i.enchants?.[e] || 0) < 5);
    if (miss.length) out.push(tx`${title(e)} V на ${list(miss.map(ru))}: дешёвая книга, больше ${gain}`);
  }
  const typeEnch = (o.types || []).map(t => TYPE_ENCH[t]).find(Boolean);
  // Smite и Bane of Arthropods не ставятся вместе с Sharpness, Ender Slayer — ставится
  const swordEnch = ['sharpness', 'smite', 'bane_of_arthropods'].some(e => w?.enchants?.[e]);
  if (w && typeEnch && (typeEnch === 'ender_slayer' || !swordEnch) && !(w.enchants?.[typeEnch] >= 6)) out.push(tx`${title(typeEnch)} VI на оружие${cost(tx`ENCHANTMENT_${typeEnch.toUpperCase()}_6`)}: урон против этого босса`);
  if (w && !swordEnch && !typeEnch) out.push('Sharpness VI на оружие: книга с Bazaar');
  const lowStars = armor.filter(i => starable(i) && (Number(i.stars) || 0) < 5);
  if (lowStars.length) out.push(tx`Звёзды за Essence на ${list(lowStars.map(ru))}: больше статов за недорогую Essence`);
  const noRecomb = armor.filter(i => !i.recomb);
  if (noRecomb.length) out.push(tx`Recombobulator 3000 на ${list(noRecomb.map(ru))}${cost('RECOMBOBULATOR_3000')} за штуку: +1 редкость и больше статов`);
  // Вещи уже прокачаны — тогда советуем то, что поднимает урон или живучесть помимо брони
  if (!out.length && o.lack?.includes('damage')) out.push('Урон сверх вещей: больше Magical Power в Accessory Bag, зелья Strength и Critical, God Potion');
  if (!out.length && o.lack?.includes('survive')) out.push('Живучесть сверх вещей: зелья Healing и Absorption, питомец с лечением, Wand of Atonement');
  if (out.length === 1 && o.lack?.length === 2) out.push('Живучесть сверх вещей: зелья Healing и Absorption, питомец с лечением, Wand of Atonement');
  return out.slice(0, 3);
}
