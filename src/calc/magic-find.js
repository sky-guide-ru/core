import { ru } from '../../i18n/msg.js';
import { activeAccessories } from './stats.js';
import { petScoreReward } from '../analysis/pet-score.js';
import { bestiaryFamilies, familyProgress } from './bestiary.js';
// Magic Find после реворка SkyBlock 0.27.3 (17.11.2026): откуда у игрока MF, чего не хватает и что взять дальше.
// Чистые функции: профиль, константы NEU и цены приходят параметрами.
//
// Источники (официальная вики закрыта с июля 2026):
//  - патчноут 0.27.3 и ветки тестов реворка на форуме Hypixel (15.10–10.11.2026): потолок 500, Looting стал плоским MF,
//    MF у Combat и Slayers, урезаны Booster Cookie (+10), зелье Magic Find (+2.5/5/7.5/10), Private Island Beacon (до +2.5);
//    убраны MF от SkyBlock Level, Magical Power, обычных перков питомцев, Hatcessories, сетов вроде Sorrow;
//  - NEU-REPO (лор предметов 26.11.2026): Anguish, Pulse Ring, книги Looting I–VII, осколки Cinderbat и Fortune, Divine Gift;
//  - NEU constants/bonuses.json (pet_rewards) — MF от Pet Score; на форуме максимум +13, порогов не публиковали.

/** Значок слеера: его типичный дроп */
const SLAYER_ICON = { zombie: 'REVENANT_FLESH', spider: 'TARANTULA_WEB', wolf: 'WOLF_TOOTH', enderman: 'NULL_SPHERE', blaze: 'DERELICT_ASHE', vampire: 'COVEN_SEAL' };

/** Потолок стата после реворка (было 900) */
export const MF_CAP = 500;

/** MF за уровни Combat: 1–10 по +0.1, 11–20 по +0.2, 21–30 по +0.3, 31–40 по +0.4, 41–60 по +0.5 (всего +20) */
export function combatMf(level) {
  const lv = Math.max(0, Math.min(60, Math.floor(level || 0)));
  let mf = 0;
  for (let i = 1; i <= lv; i++) mf += i <= 10 ? 0.1 : i <= 20 ? 0.2 : i <= 30 ? 0.3 : i <= 40 ? 0.4 : 0.5;
  return Math.round(mf * 10) / 10;
}

/** Прибавка за следующий уровень Combat */
export const combatNext = level => (level >= 60 ? 0 : Math.round((combatMf(level + 1) - combatMf(level)) * 10) / 10);

/** MF за уровни слеера: +1 на 1–8 и +2 на 9-м; Vampire (Рифт) — +1 на 1–4 и +2 на 5-м */
export function slayerMf(key, level) {
  const lv = Math.max(0, Math.floor(level || 0));
  const top = key === 'vampire' ? 5 : 9;
  return Math.min(lv, top - 1) + (lv >= top ? 2 : 0);
}

/** MF от Pet Score по таблице NEU (порог → MF) */
export function petScoreMf(score, table) {
  // В NEU таблица обрывается на 325 (+10), а в игре пороги идут до 500 (+13): берём большее из NEU и таблицы SkyCrypt
  let mf = petScoreReward(score).mf;
  for (const [min, v] of Object.entries(table || {})) if (score >= Number(min)) mf = Math.max(mf, Number(v?.magic_find) || 0);
  return mf;
}

/** Looting после реворка: плоский MF за уровень */
export const LOOTING_MF = [0, 2.5, 5, 7.5, 10, 15, 20, 25];

/** Осколки Cinderbat (атрибут Magic Find, Legendary): сколько осколков на каждый уровень и +0.5 MF за уровень */
export const CINDERBAT_STEPS = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5];
export function cinderbatLevel(shards) {
  let n = Math.max(0, shards || 0), lv = 0;
  for (const s of CINDERBAT_STEPS) { if (n < s) break; n -= s; lv++; }
  return lv;
}

/** Постоянные источники, которых нет в API Hypixel: игрок проверяет их сам */
export const HIDDEN = [
  { key: 'divine_gift', id: 'DIVINE_GIFT', mf: 5, label: 'Divine Gift', note: 'по +1 за каждый съеденный, до 5' },
  { key: 'account', icon: 'NETHER_STAR', mf: 5, label: 'Magic Find в Account Upgrades', note: 'улучшение в Community Shop' },
  { key: 'necron_ladder', id: 'NECRONS_LADDER', mf: 1, label: "Necron's Ladder", note: 'один раз использовать' },
  { key: 'dianas_bookshelf', id: 'DIANAS_BOOKSHELF', mf: 1, label: "Diana's Bookshelf", note: 'один раз использовать' },
  { key: 'bucket_of_dye', id: 'BUCKET_OF_DYE', mf: 1, label: 'Bucket of Dye', note: 'один раз использовать' },
  { key: 'beacon', icon: 'BEACON', mf: 2.5, label: 'Private Island Beacon', note: '+0.5 за уровень, до V' },
];

/** Аксессуары с MF для любых мобов: линейка и MF каждой ступени (лор NEU и игры). Pulse Ring после реворка MF в лоре не даёт */
export const ACC_LINES = [
  { label: 'Anguish', steps: [['ANGUISH_TALISMAN', 0.5], ['ANGUISH_RING', 1], ['ANGUISH_ARTIFACT', 1.5]] },
];

const COLOR = /§[0-9a-fk-or]/gi;
// Значок стата в лоре — символ из личной зоны Unicode (между числом и названием стата)
const strip = s => String(s || '').replace(COLOR, '').replace(/[\ue000-\uf8ff]/g, '').replace(/\s+/g, ' ').trim();
const r1 = v => Math.round(v * 10) / 10;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
// Имя вещи без звёзд и пробелов по краям: «Withered Giant's Sword ✪✪✪✪✪» → «Withered Giant's Sword»
const nameOf = it => strip(it?.name || it?.id).replace(/\s*[✪➊-➎].*$/, '').trim();

/** «Magic Find: +1.5» из лора — MF предмета для всех мобов */
export function loreMf(lore) {
  for (const l of lore || []) { const m = strip(l).match(/^Magic Find: \+([\d.]+)/); if (m) return Number(m[1]); }
  return 0;
}

/** «Grants +5 Magic Find on Sharks.» — MF только против отдельных мобов: { mf, on } */
export function loreMfOn(lore) {
  const text = (lore || []).map(strip).join(' ').replace(/\s+/g, ' ');
  const m = text.match(/\+([\d.]+) Magic Find (?:on|against) (?:the )?([A-Z][\w' ]+?)(?:[.,]| while| when| for| and|$)/);
  return m ? { mf: Number(m[1]), on: m[2].trim() } : null;
}

// Где лежат вещи игрока (что носит с собой и в хранилищах)
const PLACES = ['inventory', 'armor', 'equipment', 'wardrobe', 'wardrobeEquipment', 'enderChest', 'backpackItems', 'vault', 'talismans'];
const allItems = inv => PLACES.flatMap(k => inv?.[k] || []).filter(it => it?.id);

/** Уровень Looting на предмете: новая книга (looting_new) или старая запись looting */
const lootingOf = it => Math.max(Number(it?.enchants?.looting_new) || 0, Number(it?.enchants?.looting) || 0);

/**
 * Bestiary: уровни (tier) мобов. +3 MF против семейства за уровень (вики, 0.27.3): tier 15 → +45, 20 → +60, 25 → +75.
 * @returns {{ t15, t20, t25, total, near: Array<{ name, tier, kills, need }> }}
 */
export function bestiaryTiers(kills, bestiary) {
  if (!kills || !bestiary?.brackets) return null;
  const prog = familyProgress(kills, bestiaryFamilies(bestiary)).filter(f => f.reward === 'mob'); // MF дают только обычные мобы
  let t15 = 0, t20 = 0, t25 = 0;
  const near = [];
  for (const f of prog) {
    if (f.tier >= 15) t15++;
    if (f.tier >= 20) t20++;
    if (f.tier >= 25) t25++;
    if (f.tier < 15 && f.max >= 15 && f.kills > 0) near.push({ name: f.name, tier: f.tier, kills: f.kills, need: f.steps[14] });
  }
  near.sort((a, b) => b.kills / b.need - a.kills / a.need);
  return { t15, t20, t25, total: prog.length, near: near.slice(0, 3) };
}

/**
 * Magic Find игрока.
 * @param {Object} member  разобранный профиль
 * @param {Object} [o]
 * @param {Object} [o.constants]  neu.constants (bonuses, bestiary, misc)
 * @param {(id: string) => number} [o.price]  цена покупки
 * @param {Object} [o.upgrades]  { младший: [старшие] } для линеек аксессуаров
 * @param {boolean} [o.noMarket]  Ironman, Stranded, Bingo: price — только цена NPC, шаги без цены остаются с подсказкой «где добыть»
 * @param {(id: string) => ({ text: string }|null)} [o.obtain]  где добыть предмет (lib/npc-shop.js obtainHint)
 */
export function magicFind(member, o = {}) {
  if (!member?.inv) return null;
  const c = o.constants || {};
  const price = id => { try { const v = Number(o.price?.(id)); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; } };
  const sources = [];
  const push = (key, label, mf, extra = {}) => { if (mf > 0) sources.push({ key, label, mf: r1(mf), ...extra }); };
  const next = [];
  const noMarket = !!o.noMarket;
  const where = (id, dflt) => { try { return o.obtain?.(id)?.text || dflt; } catch { return dflt; } };

  // Combat
  const combat = member.skills?.combat?.level || 0;
  push('combat', ru`Combat ${combat}`, combatMf(combat), { icon: 'DIAMOND_SWORD' });
  if (combat < 60) next.push({ key: 'combat', icon: 'DIAMOND_SWORD', label: ru`Combat ${combat + 1}`, mf: combatNext(combat), cost: 0, how: 'уровень скилла' });

  // Slayers
  let slayer = 0;
  const slayerNext = [];
  for (const [k, s] of Object.entries(member.slayers || {})) {
    const lv = s?.level || 0, max = k === 'vampire' ? 5 : 9;
    slayer += slayerMf(k, lv);
    if (lv > 0 && lv < max) slayerNext.push({ key: k, name: s.name || k, lv, mf: slayerMf(k, lv + 1) - slayerMf(k, lv) });
  }
  push('slayers', 'Slayers', slayer, { icon: 'REVENANT_FLESH', note: 'по +1 за уровень, на 9-м +2' });
  // Ближе всего — слеер с самым высоким уровнем ниже максимума
  slayerNext.sort((a, b) => b.lv - a.lv);
  if (slayerNext[0]) next.push({ key: 'slayer', icon: SLAYER_ICON[slayerNext[0].key] || 'REVENANT_FLESH', label: ru`${slayerNext[0].name} ${slayerNext[0].lv + 1}`, mf: slayerNext[0].mf, cost: 0, how: 'уровень Slayer' });

  // Pet Score
  const ps = member.extras?.leveling?.petScore || 0;
  push('pet_score', ru`Pet Score ${ps}`, petScoreMf(ps, c.bonuses?.pet_rewards), { icon: 'BONE', sure: false });

  // Аксессуары с MF для всех мобов
  const acc = activeAccessories(member.inv.talismans || [], o.upgrades || {});
  let accMf = 0, accIcon = null;
  const accNames = [];
  for (const it of acc) { const v = loreMf(it.lore); if (v) { accMf += v; accNames.push(nameOf(it)); accIcon ||= it.id; } }
  push('accessories', 'Аксессуары', accMf, { icon: accIcon, note: accNames.join(', ') });
  const have = new Set((member.inv.talismans || []).filter(it => it?.id).map(it => it.id));
  for (const line of ACC_LINES) {
    const at = line.steps.reduce((i, [id], n) => (have.has(id) ? n : i), -1);
    const nxt = line.steps[at + 1];
    if (!nxt) continue;
    const gain = nxt[1] - (at >= 0 ? line.steps[at][1] : 0);
    const cost = price(nxt[0]);
    if (cost || noMarket) next.push({ key: nxt[0], id: nxt[0], icon: nxt[0], label: o.name?.(nxt[0]) || line.label, mf: gain, cost, how: noMarket ? where(nxt[0], 'аксессуар') : at >= 0 ? 'улучшить аксессуар' : 'аксессуар' });
  }

  // Looting на оружии (MF только пока оно в руке)
  const items = allItems(member.inv);
  const best = items.filter(it => lootingOf(it) > 0).sort((a, b) => lootingOf(b) - lootingOf(a))[0];
  const lt = best ? lootingOf(best) : 0;
  if (best) push('looting', ru`Looting ${ROMAN[Math.min(lt, 7)]} на ${nameOf(best)}`, LOOTING_MF[Math.min(lt, 7)], { icon: best.id, note: 'пока это оружие в руке' });
  if (lt < 7) {
    const lv = lt >= 6 ? 7 : 6;
    const id = `ENCHANTMENT_LOOTING_NEW_${lv}`;
    const cost = price(id);
    if (cost || noMarket) next.push({ key: 'looting', id, icon: id, label: `Looting ${ROMAN[lv]}`, mf: LOOTING_MF[lv] - LOOTING_MF[lt], cost, how: noMarket && !cost ? where(id, 'книга на оружие') : 'книга на оружие' });
  }

  // Cinderbat (атрибут Magic Find)
  const shards = (member.extras?.attributes || []).find(a => a.id === 'magic_find')?.n || 0;
  const cb = cinderbatLevel(shards);
  push('cinderbat', ru`Cinderbat, уровень ${cb}`, cb * 0.5, { icon: 'SHARD_CINDER_BAT' });
  if (cb < 10) {
    const need = CINDERBAT_STEPS.slice(cb).reduce((s, x) => s + x, 0) - (shards - CINDERBAT_STEPS.slice(0, cb).reduce((s, x) => s + x, 0));
    const p = price('SHARD_CINDER_BAT');
    if (p || noMarket) next.push({ key: 'cinderbat', id: 'SHARD_CINDER_BAT', icon: 'SHARD_CINDER_BAT', label: ru`Cinderbat до 10 уровня (${need} шт.)`, mf: (10 - cb) * 0.5, cost: p * need, how: 'осколки в Hunting Box' });
  }

  // На время: Booster Cookie и зелье Magic Find (God Potion даёт то же зелье IV)
  const ef = member.effects?.active || [];
  const pot = ef.find(e => e.id === 'magic_find');
  const temp = [
    { key: 'cookie', label: 'Booster Cookie', mf: 10, active: !!member.cookie, id: 'BOOSTER_COOKIE', icon: 'BOOSTER_COOKIE', cost: price('BOOSTER_COOKIE') },
    { key: 'potion', label: pot ? ru`Зелье Magic Find ${pot.roman}` : 'Зелье Magic Find IV или God Potion', mf: pot ? 2.5 * Math.min(4, pot.level) : 10, active: !!pot, icon: 'POTION_MAGIC_FIND;4' },
  ];

  // Только против отдельных мобов: вещи игрока с такой строкой в лоре
  const seen = new Set();
  const situational = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    const on = loreMfOn(it.lore);
    if (!on) continue;
    seen.add(it.id);
    situational.push({ id: it.id, icon: it.id, label: nameOf(it), mf: on.mf, on: on.on });
  }
  situational.sort((a, b) => b.mf - a.mf);

  const hidden = HIDDEN.map(h => ({ ...h, icon: h.icon || h.id || null, cost: h.id ? price(h.id) : 0 }));

  const total = r1(Math.min(MF_CAP, sources.reduce((s, x) => s + x.mf, 0)));
  // Цель «как у Magical Power»: всё, что даёт MF на любых мобах, собранное до конца (без баффов на время и бонусов на отдельных мобов)
  const petMax = Math.max(0, ...Object.values(c.bonuses?.pet_rewards || {}).map(v => Number(v?.magic_find) || 0));
  const slayersMax = ['zombie', 'spider', 'wolf', 'enderman', 'blaze', 'vampire'].reduce((s, k) => s + slayerMf(k, k === 'vampire' ? 5 : 9), 0);
  const accMax = ACC_LINES.reduce((s, l) => s + l.steps[l.steps.length - 1][1], 0);
  const hiddenMf = HIDDEN.reduce((s, h) => s + h.mf, 0);
  const goal = r1(combatMf(60) + slayersMax + (petMax || 13) + accMax + LOOTING_MF[7] + CINDERBAT_STEPS.length * 0.5 + hiddenMf);
  // Дешевле всего за единицу MF — первыми; бесплатные (уровни) — после покупок
  for (const n of next) n.perMf = n.cost && n.mf ? Math.round(n.cost / n.mf) : 0;
  next.sort((a, b) => (a.cost ? 0 : 1) - (b.cost ? 0 : 1) || a.perMf - b.perMf || b.mf - a.mf);

  return {
    total, cap: MF_CAP, goal, hiddenMf: r1(hiddenMf),
    sources, next, temp, hidden, situational: situational.slice(0, 12),
    bestiary: bestiaryTiers(member.bestiaryKills, c.bestiary),
  };
}
