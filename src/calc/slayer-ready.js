// Готовность к тирам слееров по статам игрока: в чём идти, за сколько убьёшь босса, сколько продержишься,
// какой тир выгоднее всего фармить. Основа — buildKit/bestKit (kit.js) и таблица боссов (slayer-bosses.js).
import { SLAYER_BOSSES, BLAZE_DAGGERS, TIER_REQ } from './slayer-bosses.js';
import { bestKit } from './kit.js';
import { tx } from '../../i18n/msg.js';

// Что нужно пройти, чтобы открыть босса (вики, Slayer)
export const PREREQ = { spider: ['zombie', 2], wolf: ['spider', 2], enderman: ['wolf', 4], blaze: ['enderman', 3], vampire: ['wolf', 2] };
// Сколько побед на тире считаем доказательством, что тир проходится
const PROVEN_KILLS = 5;
const DAGGER_IDS = new Set(Object.keys(BLAZE_DAGGERS));

// Пары кинжалов Blaze-слеера по ступеням (NEU): урон, статы, средний бонус против Infernal у пары
// (кинжалы меняют по цвету щита, поэтому бьёшь то одним, то другим), рецепт и требование уровня.
export const DAGGER_PAIRS = [
  { level: 2, ids: ['FIREDUST_DAGGER', 'MAWDUST_DAGGER'], names: 'Firedust Dagger и Twilight Dagger', damage: 90, stats: { strength: 45, crit_damage: 15 }, vs: 0.35,
    craft: 'Firedust: 30 Silver Magmafish и 1 Molten Powder, Twilight: 5 Enchanted Sulphur и 1 Molten Powder' },
  { level: 4, ids: ['BURSTFIRE_DAGGER', 'BURSTMAW_DAGGER'], names: 'Kindlebane Dagger и Mawdredge Dagger', damage: 130, stats: { strength: 55, crit_damage: 20, attack_speed: 10 }, vs: 1,
    craft: 'улучшение прошлой пары: 8 Molten Powder и Gold Magmafish (Kindlebane) или Enchanted Sulphur Cube (Mawdredge)' },
  { level: 6, ids: ['HEARTFIRE_DAGGER', 'HEARTMAW_DAGGER'], names: 'Pyrochaos Dagger и Deathripper Dagger', damage: 160, stats: { strength: 75, crit_chance: 10, crit_damage: 25, attack_speed: 20 }, vs: 1.75,
    craft: 'улучшение прошлой пары: 64 Molten Powder, 16 Inferno Vertex и 8 Gold Magmafish или 16 Enchanted Sulphur Cube' },
];
/** Какая пара кинжалов нужна под тир Blaze: T2 — первая, T3 — вторая, T4 — третья */
export const daggerPairFor = tier => DAGGER_PAIRS[Math.min(DAGGER_PAIRS.length - 1, Math.max(0, tier - 2))];
const fakeDagger = p => ({ id: p.ids[0], name: p.names, type: 'DAGGER', damage: p.damage, stats: { ...p.stats }, enchants: {}, vs: { infernal: p.vs }, hypo: true });

export const maxKilledTier = sl => Math.max(0, ...Object.entries(sl?.kills || {}).filter(([, k]) => k > 0).map(([t]) => Number(t)));

/**
 * Разбор всех тиров одного слеера.
 * @param {Object} member
 * @param {string} key  zombie | spider | wolf | enderman | blaze
 * @param {Object} kit  buildKit(member, neu)
 * @param {number[]} bossXp  опыт слеера за босса по тирам
 * @returns {null | { key, level, top, prereq, tiers: Array, farm, next }}
 */
export function slayerPlan(member, key, kit, bossXp) {
  const boss = SLAYER_BOSSES[key];
  if (!boss || !kit) return null;
  const sl = member?.slayers?.[key] || { level: 0, kills: {} };
  const level = sl.level || 0;
  const top = maxKilledTier(sl);
  const pre = PREREQ[key];
  const prereq = !pre || maxKilledTier(member?.slayers?.[pre[0]]) >= pre[1] ? null : { slayer: pre[0], tier: pre[1] };
  const raw = boss.tiers.map((t, i) => {
    const T = i + 1;
    const needLevel = Math.max(TIER_REQ[key]?.[T] || 0, t.dagger ? 2 : 0);
    const open = !prereq && T <= top + 1 && level >= needLevel;
    const target = { ...t, types: boss.types };
    const r = bestKit(kit, target, { daggerIds: DAGGER_IDS });
    const kills = sl.kills?.[T] || 0, attempts = sl.attempts?.[T] || 0;
    // Нет кинжала — считаем, как пойдёт бой, когда нужная пара появится: какая броня и питомец к ней
    let hypo = null;
    if (r.weaponless && t.dagger) {
      const pair = daggerPairFor(T);
      const h = bestKit({ ...kit, weapons: [fakeDagger(pair)] }, target, { daggerIds: new Set([pair.ids[0]]) });
      if (h.best) hypo = { pair, best: h.best };
    }
    return { tier: T, hp: t.hp, xp: bossXp?.[i] || 0, open, needLevel, dagger: !!t.dagger, kills, attempts, model: r.weaponless ? 'no-weapon' : r.best?.verdict || 'no', best: r.best, saved: r.saved, hypo };
  });
  // Модель без зелий, сетовых бонусов и лечения занижает силу игрока. Поэтому тир, где уже есть победы, — «проходишь»,
  // а следующий оцениваем относительно него: во сколько раз дольше бой и во сколько раз быстрее умираешь.
  // Победы засчитываются, даже если оружия для тира не видно (кинжалы в закрытом API, продал и т. п.):
  // тогда опорой для сравнения служит расчёт с парой кинжалов этого тира.
  const proven = [...raw].reverse().find(t => t.kills >= PROVEN_KILLS) || null;
  const provenBest = proven && (proven.best || proven.hypo?.best);
  const relative = best => {
    if (!provenBest) return { ratio: null, verdict: best.verdict };
    const kT = best.f.ttk / Math.max(provenBest.f.ttk, 1);
    const kS = best.f.survive / Math.max(provenBest.f.survive, 0.1);
    return { ratio: { ttk: kT, survive: kS, vs: proven.tier }, verdict: kT <= 2 && kS >= 0.7 ? 'easy' : kT <= 5 && kS >= 0.35 ? 'ok' : kT <= 12 && kS >= 0.15 ? 'hard' : 'no' };
  };
  const tiers = raw.map(t => {
    let verdict = t.model, ratio = null;
    // Ниже пройденного тира — тоже «проходишь»: босс слабее, а оружие старшего тира (кинжалы Blaze) подходит и здесь
    if (t.kills >= PROVEN_KILLS || (proven && t.tier < proven.tier && t.open)) verdict = 'proven';
    else if (t.model !== 'no-weapon' && proven && t.tier > proven.tier && t.best) ({ ratio, verdict } = relative(t.best));
    if (t.hypo) {
      const rel = proven && t.tier > proven.tier ? relative(t.hypo.best) : { ratio: null, verdict: t.hypo.best.verdict };
      t.hypo = { ...t.hypo, ...rel, lack: lackOf(t.hypo.best, rel.ratio) };
    }
    // Уже были попытки без победы — не обещаем, что легко
    const failed = t.attempts - t.kills;
    if (verdict !== 'proven' && failed >= 2 && (verdict === 'easy' || verdict === 'ok')) verdict = 'hard';
    const lack = ['hard', 'no'].includes(verdict) && t.best ? lackOf(t.best, ratio) : null;
    return { ...t, verdict, ratio, lack };
  });
  const usable = tiers.filter(t => t.open && ['proven', 'easy', 'ok'].includes(t.verdict));
  const farm = usable[usable.length - 1] || null;
  const next = tiers.find(t => t.tier === (farm?.tier || 0) + 1) || null;
  return { key, name: boss.name, level, top, prereq, tiers, farm, next };
}

/**
 * Чего не хватает до тира: урона (бой слишком долгий) или живучести (умираешь быстрее, чем надо).
 * По отношению к пройденному тиру, если он есть, иначе по абсолютной оценке.
 * @returns {null | Array<'damage' | 'survive'>}
 */
export function lackOf(best, ratio) {
  if (!best?.f) return null;
  const out = [];
  if (ratio ? ratio.ttk > 5 : best.f.ttk > 90) out.push('damage');
  if (ratio ? ratio.survive < 0.35 : best.f.survive < 6) out.push('survive');
  return out.length ? out : null;
}

export const LACK_RU = {
  damage: 'не хватает урона: Strength, Crit Damage, оружие с бонусом против этого босса',
  survive: 'не хватает живучести: Health, Defense, лечащий питомец или броня с Health',
};

export const VERDICT_RU = { proven: 'уже проходишь', easy: 'легко', ok: 'посильно', hard: 'тяжело', no: 'пока не потянуть', 'no-weapon': 'нет подходящего оружия' };

/** «12 с» / «2 мин» */
export function secText(sec) {
  if (!Number.isFinite(sec)) return 'очень долго';
  if (sec < 90) return tx`${Math.max(1, Math.round(sec))} с`;
  return tx`${Math.round(sec / 60)} мин`;
}
