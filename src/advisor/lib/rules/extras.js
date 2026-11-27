// Pet Score и шоколадная фабрика в общем плане. Подробности — на страницах «Питомцы» и «Прогресс».
import { petScoreSummary, RARITIES } from '../../../analysis/pet-score.js';
import { chocolateAdvice } from '../../../analysis/chocolate.js';
import { fmtCoins } from '../util.js';
import { ru } from '../../../../i18n/msg.js';
import { tx } from '../../../../i18n/msg.js';

// «Wolf Pet», а не «Wolf»: одним словом это имя моба, и ссылка открыла бы его, а не питомца
const petName = n => (/ Pet$/.test(n) ? n : tx`${n} Pet`);

export function petScoreRules(ctx, add) {
  const m = ctx.m;
  if (!m.pets?.length) return;
  // ID питомцев из NEU (тип × редкость); цены — те же, что у остального советчика
  const petIds = Object.keys(ctx.data.petTypes || {}).flatMap(t => RARITIES.map((_, i) => tx`${t};${i}`));
  const ps = petScoreSummary(m, { petIds, price: ctx.price, name: ctx.name });
  if (!ps.next) return;
  const picks = ps.plan.picks;
  const near = ps.nearMax || [];
  if (!picks.length && !near.length) return;
  add({
    id: 'pets-score', cat: 'Питомцы', priority: ps.next.left <= 3 ? 58 : 48, effort: picks.length ? 'монеты' : 'часы',
    title: tx`Pet Score ${ps.score} → ${ps.next.need}: +1 ✯ Magic Find`,
    why: ru`Pet Score даёт Magic Find навсегда (сейчас +${ps.mf}). До следующего порога не хватает ${ps.next.left}. Каждый тип питомца считается один раз по высшей редкости, ещё +1 за питомца максимального уровня.`,
    how: [
      ...near.slice(0, 3).map(p => ru`Докачай ${petName(p.name)} (Lvl ${p.level} → ${p.maxLevel}): +1 очко бесплатно`),
      ...picks.map(o => ru`Купить: ${petName(o.name)}${o.tier ? tx` (${o.tier[0]}${o.tier.slice(1).toLowerCase()})` : ''} — ~${fmtCoins(o.cost)}, +${o.points}`),
    ],
    items: picks.map(o => o.id),
    cost: picks.length ? ps.plan.cost : undefined,
    payoff: '+1 ✯ Magic Find',
    link: 'pets',
  });
}

export function chocolateRules(ctx, add) {
  const adv = chocolateAdvice(ctx.m.extras?.chocolate);
  if (!adv?.tips?.length) return;
  const top = adv.tips.filter(t => t.prio >= 55).slice(0, 3);
  if (!top.length) return;
  add({
    id: 'chocolate-next', cat: 'Быстрые победы', priority: top[0].prio >= 88 ? 70 : 42, effort: 'минуты',
    title: tx`Chocolate Factory: ${top[0].title}`,
    why: 'Chocolate копится сам: в Chocolate Shop он меняется на полезные предметы и открывает кроликов, а кролики усиливают фабрику.',
    how: top.map(t => tx`${t.title}. ${t.text}`),
    link: 'skills',
  });
}
