// Модуль advisor: движок рекомендаций прогрессии Hypixel SkyBlock.
// Чистые функции: профиль (Member) + анализ аксессуаров/снаряжения + цены → шаги на русском и карта прогрессии.
import { makeCtx, clamp, fmtCoins } from './lib/util.js';
import { dungeonRules, slayerRules, crimsonRules } from './lib/rules/combat.js';
import { ladderRules, upgradeRules, equipmentRules } from './lib/rules/gear.js';
import { accessoryRules, petRules, minionRules, collectionRules, moneyRules, purchasePlan, bestPerHour } from './lib/rules/economy.js';
import { quickRules, skillRules, foragingRules, miningRules, gardenRules, riftRules } from './lib/rules/skills.js';
import { museumRules } from './lib/rules/museum.js';
import { petScoreRules, chocolateRules } from './lib/rules/extras.js';
import { buildMap } from './lib/map.js';
import { profileMode } from '../lib/profile-mode.js';
import { ru } from '../../i18n/msg.js';
import { tx } from '../../i18n/msg.js';

// Шаги, которые без рынка не имеют смысла: продать лишнее на аукционе
const MARKET_STEPS = new Set(['money-idle']);
const QUICK = 'Быстрые победы';

// Шаг плана → гайд сайта (id гайда и блок, к которому прокрутить). Первое совпадение по началу id шага.
const GUIDE_LINKS = [
  [/^slayer-(zombie|spider|wolf|enderman|blaze|vampire)$/, m => ({ id: tx`slayer-${m[1]}`, anchor: m[1] === 'vampire' ? null : 'wear' })],
  [/^gear-(zombie|spider|wolf|enderman|blaze)-slayer/, m => ({ id: tx`slayer-${m[1]}`, anchor: 'wear' })],
  [/^(dungeon-|skill-catacombs|gear-dungeon)/, () => ({ id: 'dungeons' })],
  [/^(kuudra|gear-kuudra)/, () => ({ id: 'kuudra' })],
  [/^crimson-/, () => ({ id: 'crimson' })],
  [/^rift-/, () => ({ id: 'rift' })],
  [/^(hotm|skill-mining|gear-mining)/, () => ({ id: 'mining' })],
  [/^(garden-|skill-farming|gear-farming)/, () => ({ id: 'farming' })],
  [/^(hotf|skill-foraging|gear-foraging)/, () => ({ id: 'foraging' })],
  [/^(skill-fishing|gear-fishing)/, () => ({ id: 'fishing' })],
  [/^skill-hunting/, () => ({ id: 'hunting' })],
  [/^minions-/, () => ({ id: 'minions' })],
  [/^(fairy-|collections-)/, () => ({ id: 'collectibles' })],
  [/^chocolate-/, () => ({ id: 'chocolate' })],
];
const GUIDE_TITLES = {
  'slayer-zombie': 'Revenant Horror', 'slayer-spider': 'Tarantula Broodfather', 'slayer-wolf': 'Sven Packmaster',
  'slayer-enderman': 'Voidgloom Seraph', 'slayer-blaze': 'Inferno Demonlord', 'slayer-vampire': 'Riftstalker Bloodfiend',
  dungeons: 'Dungeons', kuudra: 'Kuudra', crimson: 'Crimson Isle', rift: 'Rift', mining: 'Mining', farming: 'Farming и Garden',
  foraging: 'Foraging', fishing: 'Fishing', hunting: 'Hunting', minions: 'Миньоны', collectibles: 'Души и коллекции', chocolate: 'Chocolate Factory',
};
/** Гайд к шагу плана: { id, title, anchor? } или null */
export function guideFor(stepId) {
  for (const [re, f] of GUIDE_LINKS) {
    const m = re.exec(stepId);
    if (m) { const g = f(m); return { ...g, title: GUIDE_TITLES[g.id] || g.id }; }
  }
  return null;
}

/**
 * @typedef {Object} Step
 * @property {string} id         Стабильный id (для отметок «сделано» и ссылок с карты)
 * @property {string} cat        Категория по-русски
 * @property {number} priority   0..100, больше — важнее
 * @property {string} effort     'минуты' | 'часы' | 'долго' | 'монеты' | ...
 * @property {string} title
 * @property {string} why        Зачем и что даст
 * @property {string[]} how      Как сделать / где взять
 * @property {string[]} [items]  SkyBlock ID для цен и иконок
 * @property {string} [link]     Вкладка сайта
 * @property {number} [cost]     Оценка затрат в монетах (если есть цены)
 * @property {string} [payoff]   Ожидаемая отдача коротко
 * @property {boolean} [needsSaving]  Не хватает ликвидных монет, нужно накопить
 * @property {boolean} done
 */

export const RULES = [
  quickRules, accessoryRules, equipmentRules, upgradeRules, ladderRules,
  dungeonRules, slayerRules, crimsonRules, petRules, skillRules, foragingRules,
  miningRules, gardenRules, riftRules, minionRules, collectionRules, moneyRules, museumRules, petScoreRules, chocolateRules,
];

function run(ctx) {
  const steps = [];
  const seen = new Set();
  const add = s => {
    if (!s?.id || seen.has(s.id)) return;
    seen.add(s.id);
    steps.push({ done: false, ...s });
  };
  for (const rule of RULES) {
    try { rule(ctx, add); } catch (e) {
      // Одно сломанное правило не должно ронять весь roadmap
      add({ id: tx`error-${rule.name}`, cat: 'Служебное', priority: 0, effort: '—', title: ru`Правило ${rule.name} не сработало`, why: String(e?.message || e), how: [] });
    }
  }
  // Ironman / Stranded / Bingo: без Bazaar и аукциона. «Купить: …» → добыть самому, без цены и «накопить»
  const mode = profileMode(ctx.m?.gameMode);
  if (!mode.market) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (MARKET_STEPS.has(s.id)) { steps.splice(i, 1); continue; }
      if (s.how?.length) s.how = s.how.map(h => (/^Купить: /.test(h) ? ru`Добудь или скрафти сам: ${h.replace(/^Купить: /, '').replace(/ — ~.*$/, '')} (в ${mode.label} нет Bazaar и аукциона)` : h));
      if (s.cost) { delete s.cost; s.why = s.why.replace(/ (Цена сейчас|Выйдет) ~[^.]*\./g, ''); }
    }
  }
  // Поправка на доступность: шаг, на который надо копить, не может быть «главным сейчас» —
  // сначала то, что делается уже сегодня (скиллы, слееры, дешёвые покупки). Половина всех денег — тоже заметно ниже.
  for (const s of steps) {
    if (s.cost > 0 && ctx.liquid >= 0) {
      if (s.cost > ctx.liquid * 0.5 && s.cost <= ctx.liquid) s.priority -= 8;
      if (s.cost > ctx.liquid) {
        s.needsSaving = true;
        s.priority -= s.cost > ctx.liquid * 3 ? 40 : 30;
        s.why += ru` Сейчас на руках и в банке ${fmtCoins(ctx.liquid)}${(ctx.m?.coopMembers || 1) > 1 ? ' (Bank общий на кооп-острове)' : ''} — нужно накопить.`;
      }
      // «Быстрая победа» и «минуты» — это про то, что делается сразу. Покупка на половину денег и больше —
      // уже не быстрая победа, а «минуты» на шаге, где сначала надо копить, вводят в заблуждение.
      if (s.cat === QUICK && s.cost > ctx.liquid * 0.5) s.cat = 'Покупки';
      if (s.needsSaving && /минут/.test(s.effort)) s.effort = 'нужно накопить';
    }
    s.priority = Math.round(clamp(s.priority, 0, 100));
    // Русские/игровые названия предметов шага — для подсказки при наведении на иконку (а не BURNING_CRIMSON_BOOTS)
    if (s.items?.length) s.itemNames = Object.fromEntries(s.items.map(id => [id, ctx.name(id)]));
    if (!s.guide) { const g = guideFor(s.id); if (g) s.guide = g; }
  }
  steps.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return steps;
}

/**
 * Совместимо с ядром: buildRoadmap(member, acc, gear) → Step[].
 * @param {Object} member  Member из server/parse/profile.js
 * @param {Object} [acc]   analyzeAccessories(member)
 * @param {Object} [gear]  analyzeGear(member)
 * @param {import('./lib/util.js').AdvisorOptions} [opts]
 * @returns {Step[]}
 */
export function buildRoadmap(member, acc, gear, opts = {}) {
  return run(makeCtx(member, acc, gear, opts));
}

/**
 * Карта прогрессии для отрисовки на сайте.
 * @returns {{ branches: import('./lib/map.js').Branch[], overall: { done: number, total: number, progress: number } }}
 */
export function buildProgressMap(member, acc, gear, opts = {}) {
  return buildMap(makeCtx(member, acc, gear, opts));
}

/**
 * Всё сразу: шаги, карта, план покупок и короткая сводка.
 */
export function advise(member, acc, gear, opts = {}) {
  const ctx = makeCtx(member, acc, gear, opts);
  const roadmap = run(ctx);
  const map = buildMap(ctx);
  const plan = purchasePlan(roadmap, ctx);
  const top = roadmap.filter(s => s.priority > 0).slice(0, 5);
  return {
    generatedAt: opts.now ?? Date.now(),
    summary: {
      headline: top[0] ? ru`Главное сейчас: ${top[0].title}` : 'Всё основное сделано',
      top: top.map(s => ({ id: s.id, title: s.title, cat: s.cat })),
      liquid: ctx.liquid,
      perHour: bestPerHour(ctx),
      hasPrices: ctx.hasPrices,
      quickWins: roadmap.filter(s => s.cat === 'Быстрые победы').length,
      mapProgress: map.overall.progress,
    },
    roadmap,
    map,
    plan,
    power: ctx.power,
  };
}

/**
 * Разница между двумя roadmap — для живой ленты «что изменилось» при обновлении профиля.
 * @returns {{ completed: Step[], added: Step[] }}
 */
export function diffRoadmaps(prev = [], next = []) {
  const p = new Map(prev.map(s => [s.id, s]));
  const n = new Map(next.map(s => [s.id, s]));
  return {
    completed: prev.filter(s => !n.has(s.id) && s.priority > 0),
    added: next.filter(s => !p.has(s.id) && s.priority > 0),
  };
}

/**
 * Преобразует ответ Hypixel /v2/resources/skyblock/collections в opts.collectionTiers.
 * @returns {Object<string, number[]>}
 */
export function collectionTiersFromResources(resp) {
  const out = {};
  for (const cat of Object.values(resp?.collections || {})) {
    for (const [id, it] of Object.entries(cat.items || {})) {
      out[id] = (it.tiers || []).map(t => t.amountRequired).sort((a, b) => a - b);
    }
  }
  return out;
}
