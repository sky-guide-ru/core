// Рыбалка из сырого профиля: пойманное, Sea Creatures, Trophy Fish, убийства существ для бестиария.
import { FISHING_MOB_KEYS, trophyTierCounts } from '../guides/fishing-data.js';

/**
 * @param {Object} m  members[uuid] из /v2/skyblock/profiles
 * @returns {{ itemsFished: Object, seaCreatureKills: number, trophyFish: Object, trophyTiers: Object, kills: Object<string, number> }}
 */
export function parseFishing(m = {}) {
  const ps = m.player_stats || {};
  const best = m.bestiary?.kills || {};
  const statKills = ps.kills || {};
  const kills = {};
  // Bestiary точнее (ключ с уровнем моба, как в NEU); если его нет — берём player_stats.kills
  for (const k of FISHING_MOB_KEYS) {
    const v = Number(best[k] ?? statKills[k] ?? 0);
    if (v > 0) kills[k] = v;
  }
  // Trophy Fish лежит в members[uuid].trophy_fish (старое место — nether_island_player_data.trophy_fish)
  const tf = m.trophy_fish || m.nether_island_player_data?.trophy_fish || {};
  return {
    itemsFished: ps.items_fished || {},
    seaCreatureKills: Number(ps.sea_creature_kills || 0),
    trophyFish: tf,
    trophyTiers: trophyTierCounts(tf), // { total: 18, species, tiers: { bronze: { exact, atLeast }, … } }
    kills,
  };
}
