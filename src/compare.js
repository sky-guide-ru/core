// Короткая сводка профиля для страницы «Сравнение»: только то, что ставится рядом в таблице,
// без инвентаря и сырых данных (ответ на 4 игроков остаётся маленьким).
import { SLAYERS } from '../i18n/ru.js';

const MAIN_SKILLS = ['farming', 'mining', 'combat', 'foraging', 'fishing', 'enchanting', 'alchemy', 'taming', 'carpentry', 'runecrafting', 'social', 'hunting'];
const FLOORS = ['0', '1', '2', '3', '4', '5', '6', '7'];

/** Предмет для иконки и подсказки — без NBT и прочего */
const slim = it => it && ({
  id: it.id, name: it.name, rawName: it.rawName, rarity: it.rarity, value: Math.round(it.value || 0),
  skin: it.skin, color: it.color, glint: it.glint, count: it.count, lore: Array.isArray(it.lore) ? it.lore.slice(0, 40) : undefined, uuid: it.uuid,
});

const highestFloor = floors => {
  let best = null;
  for (const f of FLOORS) if ((floors?.[f] || 0) > 0) best = Number(f);
  return best;
};

/** @param {{ player, member, analysis, updatedAt }} v — вид игрока (state.js или players.js) */
export function summarizeForCompare(v) {
  const m = v.member, a = v.analysis || {};
  const g = a.gear || {};
  const d = m.dungeons || {};
  const runs = Object.values(d.floors || {}).reduce((s, n) => s + (Number(n) || 0), 0) + Object.values(d.masterFloors || {}).reduce((s, n) => s + (Number(n) || 0), 0);
  const activePet = (m.pets || []).find(p => p.active);
  const kuudra = m.crimson?.kuudra || {};
  return {
    player: { name: v.player?.name, uuid: v.player?.uuid || m.uuid },
    profile: m.profileName, profileId: m.profileId, gameMode: m.gameMode, coop: m.coopMembers || 1,
    // Кооп: остров, Bank, Garden, миньоны и тиры коллекций общие. По profileId страница находит соседей среди сравниваемых
    // (uuid остальных соседей не отдаём: друзья анонимны),
    // share — доля игрока в общем сборе коллекций (сколько он сам насобирал)
    coopShare: (m.coopRoster || []).find(c => c.uuid === m.uuid)?.share ?? null,
    // Просили профиль, которого у игрока нет: сравниваем основной, но говорим об этом
    missingProfile: v.missingProfile || null,
    updatedAt: v.updatedAt || 0,
    sbLevel: m.sbLevel || 0,
    networth: g.networth ? Object.fromEntries(Object.entries(g.networth).map(([k, x]) => [k, Math.round(x || 0)])) : null,
    purse: m.purse || 0, bank: m.bank, // Bank кооп-острова общий
    skillAverage: m.skillAverage || 0,
    skills: Object.fromEntries(MAIN_SKILLS.filter(k => m.skills?.[k]).map(k => {
      const s = m.skills[k];
      return [k, { name: s.name, level: s.level, maxLevel: s.maxLevel, progress: s.progress, xp: Math.round(s.xp || 0), apiMissing: !!s.apiMissing }];
    })),
    slayers: Object.fromEntries(Object.keys(SLAYERS).filter(k => m.slayers?.[k]).map(k => {
      const s = m.slayers[k];
      return [k, { name: SLAYERS[k].ru, boss: SLAYERS[k].name, level: s.level, maxLevel: s.maxLevel, xp: Math.round(s.xp || 0) }];
    })),
    dungeons: {
      level: d.catacombs?.level || 0, progress: d.catacombs?.progress || 0, xp: Math.round(d.catacombs?.xp || 0),
      classAverage: d.classAverage || 0, selectedClass: d.selectedClass || null,
      classes: Object.fromEntries(Object.entries(d.classes || {}).map(([k, c]) => [k, { name: c.name, level: c.level }])),
      floor: highestFloor(d.floors), master: highestFloor(d.masterFloors), runs, secrets: d.secrets || 0,
      f7: Number(d.floors?.['7']) || 0,
    },
    accessories: { mp: m.magicalPower || 0, power: m.selectedPower || null, count: a.acc?.count ?? null, recombGain: a.acc?.recombGain ?? null },
    mining: { hotm: m.mining?.hotm?.level ?? null, powder: m.mining?.powder ? { mithril: m.mining.powder.mithril, gemstone: m.mining.powder.gemstone, glacite: m.mining.powder.glacite } : null },
    garden: { level: m.extras?.view?.gardenLevel?.level ?? null, copper: m.garden?.copper || 0 },
    crimson: { faction: m.crimson?.faction || null, kuudra },
    fairySouls: m.fairySouls?.collected || 0,
    collections: { tiers: (m.unlockedCollTiers || []).length },
    rift: { enigma: m.rift?.enigmaSouls || 0 },
    abiphone: m.abiphone ? (m.abiphone.active || []).length : null,
    harp: m.harp ? Object.values(m.harp.songs || {}).filter(s => s.completions > 0 || s.best >= 1).length : null,
    museum: a.museum ? { status: a.museum.status, donated: a.museum.donated, total: a.museum.total, xp: a.museum.xp, milestone: a.museum.milestone?.n || 0, value: a.museum.value || 0, special: a.museum.special || 0, canDonate: a.museum.canDonate || 0 } : null,
    pets: { count: (m.pets || []).length, active: activePet ? { type: activePet.type, tier: activePet.tier, level: activePet.level, id: activePet.id, skin: activePet.skin } : null,
      top: (g.topPets || []).slice(0, 3).map(p => ({ ...p, value: Math.round(p.value || 0) })) },
    gear: {
      armor: (g.worn?.armor || []).map(slim),
      equipment: (g.worn?.equipment || []).map(slim),
      weapons: (g.weapons || []).slice(0, 3).map(slim),
      top: (g.topItems || []).slice(0, 6).map(slim),
    },
    next: (a.roadmap || []).slice(0, 4).map(s => ({ id: s.id, title: s.title, cat: s.cat })),
  };
}
