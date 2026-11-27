// «Дешёвый SkyBlock XP» для «Прогресса»: SkyBlock Level по категориям и где XP дешевле всего за монету.
// Цифры XP — NEU constants/sblevels.json (ветка prerelease) и misc.json (minionXp); 1 уровень = 100 XP.
import { ru } from '../../i18n/msg.js';

export const SBXP = {
  fairyPerExchange: 10, fairyMax: 490,   // 10 XP за каждую сдачу 5 душ Tia
  perMp: 1,                               // Accessory Bag: 1 XP за 1 Magical Power
  perPetScore: 3,                         // Pet Score: 3 XP за очко
  perCollectionTier: 4, collectionsMax: 2696,
  minionMax: 2834, minionByTier: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3, 9: 4, 10: 6, 11: 12, 12: 24 },
  perAbiphone: 10, abiphoneMax: 490,
  skillsMax: 7510,
};

// XP за уровень скилла: 1–10 по 5, 11–25 по 10, 26–50 по 20, 51–60 по 30
export const skillLevelXp = lvl => { let s = 0; for (let i = 1; i <= lvl; i++) s += i <= 10 ? 5 : i <= 25 ? 10 : i <= 50 ? 20 : 30; return s; };
const SKILLS = ['farming', 'mining', 'combat', 'foraging', 'fishing', 'enchanting', 'alchemy', 'taming', 'carpentry', 'hunting'];

/**
 * @param {object} m разобранный участник
 * @param {{ acc?: object, petScore?: object, museumBest?: {id,name,cost,gain,perXp}|null, museumFreeXp?: number }} o
 * @returns {{ level: number, xp: number, toNext: number, rows: Array<{ id, title, have, max, free?: number, perXp?: number|null, cost?: number|null, gain?: number|null, text, href }> }}
 */
export function sbxpPlan(m, o = {}) {
  if (!m) return null;
  const xp = Math.round((Number(m.sbLevel) || 0) * 100);
  const rows = [];

  // Fairy Souls: несданные души — XP прямо сейчас у Tia в Wilderness
  const fs = m.fairySouls || {};
  const fairyHave = (fs.exchanges || 0) * SBXP.fairyPerExchange;
  const fairyFree = Math.floor((fs.unspent || 0) / 5) * SBXP.fairyPerExchange;
  if (fairyHave < SBXP.fairyMax) rows.push({ id: 'fairy', title: 'Fairy Souls', have: fairyHave, max: SBXP.fairyMax, free: fairyFree, perXp: fairyFree ? 0 : null,
    text: fairyFree ? ru`Несданные души (${fs.unspent}) отнести Tia в Wilderness.` : 'Каждые 5 найденных душ у Tia в Wilderness — 10 XP.', href: '#/guides/collectibles' });

  // Magical Power: самый дешёвый аксессуар за 1 MP
  const accBest = (o.acc?.cheapestNext || []).find(r => r.perMp > 0);
  if (accBest) rows.push({ id: 'mp', title: 'Magical Power', have: Number(m.magicalPower) || 0, max: null, perXp: Math.round(accBest.perMp / SBXP.perMp), cost: Math.round(accBest.price), gain: accBest.gain * SBXP.perMp,
    text: ru`1 XP за каждый Magical Power. Дешевле всего: ${accBest.name} (+${accBest.gain} MP).`, href: '#/accessories' });

  // Pet Score: 3 XP за очко
  const petBest = (o.petScore?.cheapest || []).find(r => r.perPoint > 0);
  if (petBest) rows.push({ id: 'pets', title: 'Pet Score', have: (o.petScore.score || 0) * SBXP.perPetScore, max: null, perXp: Math.round(petBest.perPoint / SBXP.perPetScore), cost: Math.round(petBest.cost), gain: petBest.points * SBXP.perPetScore,
    text: ru`3 XP за очко Pet Score. Дешевле всего: ${petBest.name || petBest.id} (+${petBest.points}).`, href: '#/pets' });

  // Museum: то, что уже лежит у игрока, — бесплатно; дальше самое дешёвое за XP
  const mb = o.museumBest;
  if (o.museumFreeXp > 0 || mb) rows.push({ id: 'museum', title: 'Museum', have: null, max: null, free: o.museumFreeXp || 0, perXp: o.museumFreeXp > 0 ? 0 : mb?.perXp ?? null, cost: mb?.cost ?? null, gain: mb?.gain ?? null,
    text: o.museumFreeXp > 0 ? ru`Пожертвовать то, что уже есть: +${o.museumFreeXp} XP бесплатно.` : ru`Дешевле всего за XP: ${mb.name || mb.id} (+${mb.gain} XP).`, href: '#/museum' });

  // Minions: уникальные крафты; тиры XI и XII дают 12 и 24 XP
  const crafted = [...new Set([...(m.minions || []), ...(m.coop?.minions || [])])];
  const minionHave = crafted.reduce((s, id) => s + (SBXP.minionByTier[String(id).split('_').pop()] || 0), 0);
  if (minionHave < SBXP.minionMax) rows.push({ id: 'minions', title: 'Minions', have: Math.min(minionHave, SBXP.minionMax), max: SBXP.minionMax, perXp: null,
    text: 'Каждый новый крафт миньона даёт XP, больше всего — тиры XI (12 XP) и XII (24 XP).', href: '#/minions' });

  // Collections: 4 XP за тир
  const tiers = (m.unlockedCollTiers || []).length;
  if (tiers) rows.push({ id: 'collections', title: 'Collections', have: Math.min(tiers * SBXP.perCollectionTier, SBXP.collectionsMax), max: SBXP.collectionsMax, perXp: null,
    text: '4 XP за каждый новый тир коллекции.', href: '#/collections' });

  // Skills: XP за уровни
  const skillHave = SKILLS.reduce((s, k) => s + skillLevelXp(Math.min(60, m.skills?.[k]?.level || 0)), 0);
  rows.push({ id: 'skills', title: 'Skills', have: Math.min(skillHave, SBXP.skillsMax), max: SBXP.skillsMax, perXp: null,
    text: 'Уровни скиллов: до 10 — по 5 XP, до 25 — по 10, до 50 — по 20, дальше по 30.', href: '#/skills' });

  // Abiphone: 10 XP за контакт
  const contacts = m.abiphone?.active?.length ?? m.crimson?.abiphoneContacts ?? 0;
  if (contacts || m.crimson?.faction) rows.push({ id: 'abiphone', title: 'Abiphone', have: contacts * SBXP.perAbiphone, max: SBXP.abiphoneMax, perXp: null,
    text: '10 XP за каждый контакт в Abiphone: у многих NPC свой небольшой квест.', href: '#/guides/crimson' });

  // Порядок: бесплатное сейчас, потом за монеты по цене за XP, потом то, что требует времени
  const rank = r => (r.free > 0 ? 0 : r.perXp > 0 ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || (b.free || 0) - (a.free || 0) || (a.perXp ?? Infinity) - (b.perXp ?? Infinity));
  return { level: Math.floor(xp / 100), xp, toNext: 100 - (xp % 100), rows };
}
