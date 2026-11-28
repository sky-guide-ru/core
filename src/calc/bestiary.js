// Bestiary: уровни семейств, вехи и самые быстрые следующие уровни по убийствам игрока.
// Семейства и пороги — NEU constants/bestiary.json (сверено с официальной вики 28.11.2026), убийства —
// members.<uuid>.bestiary.kills из Hypixel API, полученная веха — bestiary.milestone.last_claimed_milestone.
import { PER_TIER, TIERS_PER_MILESTONE, PLACES, SPOTS, RARE, milestoneCombatXp } from '../guides/bestiary-data.js';

export const strip = s => String(s || '').replace(/§./g, '').trim();

/** Все семейства из NEU: { name, cat, catName, sub, mobs, cap, steps, reward }. */
export function bestiaryFamilies(bestiary) {
  if (!bestiary?.brackets) return [];
  const out = [];
  const walk = (cat, key, catName) => {
    for (const f of cat?.mobs || []) {
      const set = f.bracketType ? bestiary.bracketSets?.[f.bracketType] : bestiary.brackets;
      const br = set?.[f.bracket];
      if (!br) continue;
      const steps = br.filter(x => x <= (f.cap || Infinity));
      const reward = f.bracketType ? 'critter' : key === 'garden' ? 'pest' : 'mob';
      out.push({ name: strip(f.name), cat: key, catName, mobs: f.mobs || [], cap: f.cap || steps.at(-1), bracket: f.bracket, steps, reward });
    }
    for (const [k, v] of Object.entries(cat || {})) {
      if (k !== 'mobs' && v && typeof v === 'object' && Array.isArray(v.mobs)) walk(v, `${key}/${k}`, strip(v.name) || catName);
    }
  };
  for (const [k, cat] of Object.entries(bestiary)) {
    if (k === 'brackets' || k === 'bracketSets') continue;
    walk(cat, k, strip(cat?.name) || k);
  }
  return out;
}

/** Раздел семейства для PLACES: сначала полный путь (fishing/lava), затем верхний (safari/icy_biome → safari). */
export const placeOf = cat => PLACES[cat] || PLACES[cat.split('/')[0]] || { where: cat, w: 2 };

/** Где искать: место с вики или раздел бестиария. */
export function spotOf(f) {
  const s = SPOTS[`${f.name}@${f.cat.split('/')[0]}`] || SPOTS[f.name];
  const p = placeOf(f.cat);
  return { where: s?.[0] || p.where, hp: s?.[1] || 0, place: p };
}

/** Трудозатраты на одно убийство: место (дорога, данж, удочка) и запас Health моба (лог-шкала). */
export function killCost(f) {
  const { hp, place } = spotOf(f);
  const hpW = hp > 1000 ? 1 + Math.log10(hp / 1000) : 1; // 1 тыс. → 1, 1 млн → 4, 100 млн → 6
  const rare = RARE.has(f.name) || (place.kind === 'fish' && f.bracket >= 7) ? 8 : 1;
  return (place.w || 2) * hpW * rare;
}

/** Прогресс по каждому семейству. */
export function familyProgress(kills = {}, families = []) {
  return families.map(f => {
    const n = f.mobs.reduce((s, id) => s + (Number(kills[id]) || 0), 0);
    const tier = f.steps.filter(x => n >= x).length;
    const max = f.steps.length;
    return { ...f, kills: n, tier, max, next: tier < max ? f.steps[tier] : null, done: tier >= max };
  });
}

/** Бонус семейства на его уровне: Magic Find и Strength, Farming Fortune у вредителей, Hunting Fortune у существ. */
export function tierBonus(f, tier = f.tier) {
  const r = PER_TIER[f.reward] || PER_TIER.mob;
  return Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'sbxp').map(([k, v]) => [k, Math.round(v * tier * 10) / 10]));
}

/**
 * Самые дешёвые следующие уровни: для каждого семейства — несколько ближайших уровней с ценой
 * (убийств до уровня × трудозатраты), затем жадно берём самые дешёвые, пока не наберём `count` уровней.
 * Событийные семейства (Spooky, Diana, Jerry, зимняя рыбалка) в план не идут — для них отдельный список.
 * В закрытых островах без единого убийства цена ×3: доступа может ещё не быть.
 */
export function cheapestTiers(progress, count = TIERS_PER_MILESTONE, { ahead = 3 } = {}) {
  const opts = [];
  for (const f of progress) {
    if (f.done) continue;
    const p = placeOf(f.cat);
    if (p.kind === 'event') continue;
    const per = killCost(f) * (p.gate && f.kills === 0 ? 3 : 1);
    let from = f.kills;
    for (let t = f.tier; t < Math.min(f.max, f.tier + ahead); t++) {
      const need = f.steps[t] - from;
      opts.push({ f, tier: t + 1, need, cost: need * per, prev: t > f.tier });
      from = f.steps[t];
    }
  }
  // Уровень t+2 нельзя взять раньше t+1: сортируем по цене, но для одного семейства — по порядку.
  opts.sort((a, b) => a.cost - b.cost);
  const taken = new Map();
  const pick = [];
  let guard = 0;
  while (pick.length < count && guard++ < 10_000) {
    const i = opts.findIndex(o => (taken.get(o.f) ?? o.f.tier) === o.tier - 1);
    if (i < 0) break;
    const o = opts.splice(i, 1)[0];
    taken.set(o.f, o.tier);
    pick.push(o);
  }
  // Сводим по семействам: «Crypt Ghoul: 2 уровня, 140 убийств».
  const by = new Map();
  for (const o of pick) {
    const r = by.get(o.f) || { f: o.f, tiers: 0, kills: 0, cost: 0, to: o.f.tier };
    r.tiers++; r.kills += o.need; r.cost += o.cost; r.to = o.tier;
    by.set(o.f, r);
  }
  return [...by.values()].sort((a, b) => a.cost - b.cost);
}

/**
 * Итог по бестиарию игрока.
 * @param {Object} member  разобранный профиль (bestiaryKills, bestiaryMilestone)
 * @param {Object} bestiary  NEU constants.bestiary
 */
export function bestiarySummary(member, bestiary) {
  const families = bestiaryFamilies(bestiary);
  if (!families.length) return null;
  const progress = familyProgress(member?.bestiaryKills || {}, families);
  const tiers = progress.reduce((s, f) => s + f.tier, 0);
  const maxTiers = progress.reduce((s, f) => s + f.max, 0);
  const milestone = Math.floor(tiers / TIERS_PER_MILESTONE);
  const claimed = Number(member?.bestiaryMilestone) || 0;
  const toNext = TIERS_PER_MILESTONE - (tiers % TIERS_PER_MILESTONE);
  const nextMs = milestone + 1;
  const islands = new Map();
  for (const f of progress) {
    const key = f.cat.split('/')[0];
    const r = islands.get(key) || { key, where: placeOf(key).where, families: 0, maxed: 0, found: 0, tiers: 0, max: 0 };
    r.families++; r.tiers += f.tier; r.max += f.max;
    if (f.done) r.maxed++;
    if (f.kills > 0) r.found++;
    islands.set(key, r);
  }
  return {
    progress, tiers, maxTiers, milestone, claimed,
    unclaimed: Math.max(0, milestone - claimed),
    maxMilestone: Math.floor(maxTiers / TIERS_PER_MILESTONE),
    toNext, nextMs, nextXp: milestoneCombatXp(Math.ceil(nextMs / 5) * 5), nextXpAt: Math.ceil(nextMs / 5) * 5,
    families: progress.length,
    found: progress.filter(f => f.kills > 0).length,
    maxed: progress.filter(f => f.done).length,
    plan: cheapestTiers(progress, toNext),
    islands: [...islands.values()],
  };
}
