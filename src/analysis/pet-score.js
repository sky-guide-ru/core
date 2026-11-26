import { tx } from '../../i18n/msg.js';
// Pet Score и кап Taming: сколько очков сейчас, сколько до следующего порога Magic Find
// и какие покупки дадут очки дешевле всего.
//
// Правила счёта сверены с SkyCrypt (SkyCrypt-Backend, stats/pets.go GetPetScore, 2026-11-23)
// и с вики (fandom «Pets», раздел Pet Score):
//  - каждый тип питомца считается один раз, по самой высокой редкости: Common 1 … Mythic 6;
//  - Tier Boost у питомца поднимает его редкость на ступень;
//  - +1 очко за тип, у которого есть питомец максимального уровня;
//  - Fractured Montezuma Soul не считается.
// Пороги Magic Find — constants PET_REWARDS из того же SkyCrypt.

export const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
export const PET_SCORE_REWARDS = [
  [10, 1], [25, 2], [50, 3], [75, 4], [100, 5], [130, 6], [175, 7],
  [225, 8], [275, 9], [325, 10], [375, 11], [450, 12], [500, 13],
];
export const TAMING_BASE_CAP = 50;
export const TAMING_MAX_CAP = 60;
const SKIP_TYPES = new Set(['FRACTURED_MONTEZUMA_SOUL']);

const tierIndex = t => RARITIES.indexOf(String(t || '').toUpperCase());

/** Редкость с учётом Tier Boost (как в игре и SkyCrypt). */
export function effectiveTier(p) {
  let i = tierIndex(p.tier);
  if (i >= 0 && p.heldItem === 'PET_ITEM_TIER_BOOST') i = Math.min(i + 1, RARITIES.length - 1);
  return i;
}

/** Magic Find за данный счёт и следующий порог. */
export function petScoreReward(score) {
  let mf = 0, next = null;
  for (const [need, v] of PET_SCORE_REWARDS) {
    if (score >= need) mf = v;
    else { next = { need, mf: v, left: need - score }; break; }
  }
  return { mf, next };
}

/**
 * Счёт по списку питомцев профиля (member.pets).
 * @returns {{ score, rarityPoints, maxedPoints, types: Map<string,{tier:number, maxed:boolean}> }}
 */
export function computePetScore(pets = []) {
  const types = new Map();
  for (const p of pets) {
    if (!p?.type || SKIP_TYPES.has(p.type)) continue;
    const t = effectiveTier(p);
    if (t < 0) continue;
    const cur = types.get(p.type) || { tier: -1, maxed: false };
    cur.tier = Math.max(cur.tier, t);
    if (p.maxLevel && p.level >= p.maxLevel) cur.maxed = true;
    types.set(p.type, cur);
  }
  let rarityPoints = 0, maxedPoints = 0;
  for (const v of types.values()) { rarityPoints += v.tier + 1; if (v.maxed) maxedPoints++; }
  return { score: rarityPoints + maxedPoints, rarityPoints, maxedPoints, types };
}

/**
 * Все способы добавить очки покупкой:
 *  - new: новый тип (очки = редкость);
 *  - rarity: тот же тип, но редкость выше (очки = разница);
 *  - maxed: питомец этого типа максимального уровня (+1).
 * Для каждого типа берётся один лучший вариант по цене за очко, чтобы план не советовал двух питомцев одного типа.
 */
export function petScoreOptions(types, { petIds = [], price = () => 0, maxedPrice = () => 0 } = {}) {
  const tiersByType = new Map();
  for (const id of petIds) {
    const [type, t] = String(id).split(';');
    const i = Number(t);
    if (!type || !Number.isInteger(i) || i < 0 || i >= RARITIES.length || SKIP_TYPES.has(type)) continue;
    if (!tiersByType.has(type)) tiersByType.set(type, new Set());
    tiersByType.get(type).add(i);
  }
  const best = new Map();
  const offer = o => {
    if (!(o.cost > 0) || !(o.points > 0)) return;
    o.perPoint = o.cost / o.points;
    const cur = best.get(o.type);
    if (!cur || o.perPoint < cur.perPoint) best.set(o.type, o);
  };
  for (const [type, tiers] of tiersByType) {
    const have = types.get(type);
    for (const i of tiers) {
      const id = tx`${type};${i}`;
      const cost = price(id);
      if (!have) offer({ kind: 'new', type, id, tier: RARITIES[i], points: i + 1, cost });
      else if (i > have.tier) offer({ kind: 'rarity', type, id, tier: RARITIES[i], from: RARITIES[have.tier], points: i - have.tier, cost });
    }
    // Максимальный уровень: любой редкости, если такого ещё нет
    if (have && !have.maxed) {
      for (const i of tiers) {
        const id = tx`${type};${i}`;
        const cost = maxedPrice(id);
        if (cost > 0) offer({ kind: 'maxed', type, id, tier: RARITIES[i], points: 1, cost });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.perPoint - b.perPoint || b.points - a.points);
}

/** Жадный план: самые дешёвые за очко варианты, пока не наберём need очков. */
export function cheapestPlan(options, need) {
  const picks = [];
  let got = 0, cost = 0;
  for (const o of options) {
    if (got >= need) break;
    picks.push(o); got += o.points; cost += o.cost;
  }
  return { picks, points: got, cost, enough: got >= need };
}

/**
 * Питомцы для капа Taming. Это не «любой новый тип», а квест NPC George (Pet Care, Hub): он просит
 * 10 конкретных питомцев не ниже указанной редкости, каждый первый сданный даёт +1 к капу (50 → 60),
 * порядок любой (вики fandom «George», 0.19.10). Индекс редкости: 0 Common … 5 Mythic.
 */
export const TAMING_PETS = [
  { type: 'ENDERMAN', min: 5 },
  { type: 'BLACK_CAT', min: 4 },
  { type: 'RIFT_FERRET', min: 3 },
  { type: 'SLUG', min: 3 },
  { type: 'SPIRIT', min: 3 },
  { type: 'GIRAFFE', min: 3 },
  { type: 'JELLYFISH', min: 3 },
  { type: 'BAL', min: 3 },
  { type: 'BABY_YETI', min: 3 },
  { type: 'FROST_WISP', min: 2 },
];

/**
 * Кап Taming: какие питомцы из списка George ещё не сданы, какая редкость нужна и сколько стоит самый
 * дешёвый подходящий. Если такой питомец уже есть в меню питомцев — отмечаем (можно сдать своего).
 */
export function tamingCapPlan({ tamingCap = TAMING_BASE_CAP, sacrificed = [], pets = [], price = () => 0 } = {}) {
  const left = Math.max(0, TAMING_MAX_CAP - tamingCap);
  const done = new Set(sacrificed.map(t => String(t).toUpperCase()));
  const candidates = [];
  for (const { type, min } of TAMING_PETS) {
    if (done.has(type)) continue;
    let best = null;
    for (let i = min; i < RARITIES.length; i++) {
      const cost = price(tx`${type};${i}`);
      if (cost > 0 && (!best || cost < best.cost)) best = { id: tx`${type};${i}`, tier: RARITIES[i], cost };
    }
    const own = pets.find(p => p.type === type && tierIndex(p.tier) >= min);
    candidates.push({
      type, minTier: RARITIES[min],
      id: best?.id || tx`${type};${min}`, tier: best?.tier || RARITIES[min], cost: best?.cost || 0,
      owned: own ? { tier: own.tier, level: own.level } : null,
    });
  }
  // Сначала те, что уже есть у игрока, потом по цене; без цены — в конце
  candidates.sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || (a.cost || Infinity) - (b.cost || Infinity));
  const picks = candidates.slice(0, left);
  // Тексты карточки отдаём с сервера, чтобы к ним можно было подобрать подсказки (textRefs)
  const text = {
    intro: left
      ? tx`George в Pet Care (Hub) поднимает кап Taming на 1 за каждого питомца из своего списка, всего 10, порядок любой. Осталось ${left} из 10. Уровень Taming усиливает всех питомцев и даёт SkyBlock XP.`
      : `Кап Taming максимальный: George получил всех 10 питомцев.`,
    note: 'Подходит питомец указанной редкости или выше. Своего рабочего питомца не отдавай: дешевле купить отдельного на аукционе.',
  };
  return {
    text,
    cap: tamingCap, max: TAMING_MAX_CAP, left,
    sacrificed: [...done],
    candidates,
    totalCost: picks.reduce((s, c) => s + (c.owned ? 0 : c.cost), 0),
    picksCount: picks.length,
  };
}

/**
 * Всё для карточки «Pet Score и кап Taming» на странице «Питомцы».
 * @param {Object} member  результат parse/profile.js (pets, tamingCap, tamingSacrificedTypes, extras.leveling.petScore)
 * @param {Object} opts { petIds, price(id), maxedPrice(id), name(id) }
 */
export function petScoreSummary(member, opts = {}) {
  const pets = member?.pets || [];
  const { score, rarityPoints, maxedPoints, types } = computePetScore(pets);
  const apiScore = member?.extras?.leveling?.petScore || 0;
  const reward = petScoreReward(score);
  const options = petScoreOptions(types, opts);
  const need = reward.next ? reward.next.left : 0;
  const plan = need ? cheapestPlan(options, need) : { picks: [], points: 0, cost: 0, enough: true };
  const name = opts.name || (id => id);
  const row = o => ({ ...o, name: name(o.id) });
  const taming = tamingCapPlan({
    tamingCap: member?.tamingCap || TAMING_BASE_CAP,
    sacrificed: member?.tamingSacrificedTypes || [],
    pets, price: opts.price || (() => 0),
  });
  return {
    score, rarityPoints, maxedPoints, uniqueTypes: types.size, apiScore,
    mf: reward.mf, next: reward.next,
    maxMf: PET_SCORE_REWARDS[PET_SCORE_REWARDS.length - 1][1],
    thresholds: PET_SCORE_REWARDS.map(([need, mf]) => ({ need, mf })),
    plan: { ...plan, picks: plan.picks.map(row) },
    cheapest: options.slice(0, 12).map(row),
    // Свои питомцы, которым осталось немного до максимального уровня: +1 очко без покупок
    nearMax: pets.filter(p => p.maxLevel && p.level < p.maxLevel && p.level >= p.maxLevel * 0.85 && !types.get(p.type)?.maxed)
      .sort((a, b) => b.level / b.maxLevel - a.level / a.maxLevel).slice(0, 6)
      .map(p => ({ id: p.id, type: p.type, tier: p.tier, level: p.level, maxLevel: p.maxLevel, name: name(p.id) })),
    taming: { ...taming, candidates: taming.candidates.map(c => ({ ...c, name: name(c.id) })) },
  };
}
