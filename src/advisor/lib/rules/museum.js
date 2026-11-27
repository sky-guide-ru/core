// Советы по музею: пожертвовать то, что уже лежит у игрока, дойти до следующей вехи дешевле всего,
// включить Museum API, если он выключен. Расчёт — server/museum/analyze.js.
import { analyzeMuseum } from '../../../museum/analyze.js';
import { fmtCoins, fmtNum, plural } from '../util.js';
import { ru } from '../../../../i18n/msg.js';
import { tx } from '../../../../i18n/msg.js';

const IN_USE = new Set(['Инвентарь', 'Надето', 'Экипировка', 'Wardrobe']);

const HOW_DONATE = [
  'Hub → Museum (рядом с Bazaar и Community Center), Madame Eleanor Q. Goldsworth III открывает меню музея.',
  'Открой меню музея и кликни по предмету в своём инвентаре → Confirm Donation. Сет брони кладётся целиком: все части должны быть в инвентаре.',
  'Предмет станет Co-op Soulbound (продать его уже нельзя), но его можно в любой момент забрать обратно кликом в музее: XP останется.',
];

export function museumRules(ctx, add) {
  const mu = analyzeMuseum(ctx.m, { constants: ctx.opts?.constants, price: ctx.price, name: ctx.name, owned: ctx.owned });
  const nm = id => mu.names?.[id] || ctx.name(id);
  if (mu.status === 'off') {
    add({
      id: 'museum-api', cat: 'Музей', priority: 40, effort: 'минуты',
      title: 'Включи Museum API, чтобы сайт видел музей',
      why: 'Hypixel не отдаёт музей этого игрока: в настройках выключен Museum API (или музей ещё ни разу не открывали). Без него не посчитать XP музея, вехи и что пожертвовать.',
      how: ['В игре: SkyBlock Menu → Settings → API Settings → Museum API → включить.', 'Через пару минут нажми «Обновить» на сайте.'],
      link: 'museum',
    });
    return;
  }
  if (mu.status !== 'ok') return;

  if (mu.canDonate.length) {
    // То, что лежит в хранилищах, — первым; оружие и броня в ходу (инвентарь, надето, гардероб) — последними:
    // в музее ими не попользуешься, пока не заберёшь обратно
    const inUse = x => x.where?.length && x.where.every(w => IN_USE.has(w));
    const top = [...mu.canDonate].sort((a, b) => inUse(a) - inUse(b)).slice(0, 8);
    add({
      id: 'museum-donate-owned', cat: 'Музей', priority: mu.canDonateXp >= 20 ? 50 : 44, effort: 'минуты',
      title: ru`Пожертвуй в музей ${mu.canDonate.length} ${plural(mu.canDonate.length, 'предмет', 'предмета', 'предметов')}, что уже есть: +${fmtNum(mu.canDonateXp)} SkyBlock XP`,
      why: ru`Они лежат у тебя (${[...new Set(top.flatMap(x => x.where))].slice(0, 3).join(', ')}), но ещё не в музее. Это бесплатный SkyBlock XP${mu.milestonePlan?.free && mu.milestonePlan.reached ? ru` и сразу веха музея ${mu.milestonePlan.target}` : ''}. Пожертвованное можно забрать обратно — XP останется.`,
      how: [...HOW_DONATE, ...top.map(x => tx`${nm(x.id)} — +${x.gain} XP${x.where?.length ? tx` (${x.where.join(', ')}${inUse(x) ? ' — сейчас в ходу, жертвуй, только если не нужен' : ''})` : ''}`)],
      items: top.map(x => x.set ? x.items.find(i => /CHESTPLATE/.test(i)) || x.items[0] : x.id),
      link: 'museum',
    });
  }

  const plan = mu.milestonePlan;
  if (plan && !plan.free && plan.reached && plan.coins > 0) {
    const buy = plan.steps.filter(s => !s.free);
    add({
      id: 'museum-milestone', cat: 'Музей', priority: plan.coins <= Math.max(1_000_000, (ctx.liquid || 0) * 0.02) ? 52 : 38, effort: ctx.market ? 'монеты' : 'нужно добыть',
      title: ctx.market ? ru`Веха музея ${plan.target}: не хватает ${mu.milestone.toNext} XP — дешевле всего за ${fmtCoins(plan.coins)}` : ru`Веха музея ${plan.target}: не хватает ${mu.milestone.toNext} XP`,
      why: ru`Вехи идут каждые 100 SkyBlock XP музея и дают +1% к множителю Bits, +2% к процентам банка и свои награды${mu.milestone.rewardsNext?.length ? ru` (следующая: ${mu.milestone.rewardsNext.join(', ')})` : ''}. Сейчас у тебя ${fmtNum(mu.xp)} XP музея, веха ${mu.milestone.n} из ${mu.milestone.max}.`,
      how: [...buy.slice(0, 8).map(s => ru`Купить: ${nm(s.id)} — ~${fmtCoins(s.cost)} (+${s.gain} XP)`), 'Потом пожертвуй их в музее (Hub → Museum).'],
      items: buy.slice(0, 8).map(s => s.items?.length > 1 ? s.items.find(i => /CHESTPLATE/.test(i)) || s.items[0] : s.id),
      cost: plan.coins,
      link: 'museum',
    });
  }

  const cheap = mu.bestValue.filter(x => x.cost <= 200_000).slice(0, 6);
  if (cheap.length >= 3) {
    const sum = cheap.reduce((s, x) => s + x.cost, 0);
    const gain = cheap.reduce((s, x) => s + x.gain, 0);
    add({
      // Дешёвый относительно денег игрока — почти бесплатный SkyBlock XP за минуты
      id: 'museum-cheap', cat: 'Музей', priority: sum <= Math.max(1_000_000, (ctx.liquid || 0) * 0.01) ? 66 : 34, effort: ctx.market ? 'минуты, нужны монеты' : 'нужно добыть',
      title: ctx.market ? ru`Дешёвый SkyBlock XP: ${cheap.length} ${plural(cheap.length, 'предмет', 'предмета', 'предметов')} для музея за ${fmtCoins(sum)} (+${gain} XP)` : ru`SkyBlock XP: ${cheap.length} ${plural(cheap.length, 'предмет', 'предмета', 'предметов')} для музея (+${gain} XP)`,
      ...(ctx.market ? {} : { why: 'Простые предметы, которых нет в твоём музее. Каждый пожертвованный предмет навсегда добавляет SkyBlock XP.' }),
      why: 'Самые выгодные по XP за монету предметы, которых нет в твоём музее. Каждый пожертвованный предмет навсегда добавляет SkyBlock XP.',
      how: cheap.map(x => ru`Купить: ${nm(x.id)} — ~${fmtCoins(x.cost)} (+${x.gain} XP)`),
      items: cheap.map(x => x.set ? x.items.find(i => /CHESTPLATE/.test(i)) || x.items[0] : x.id),
      cost: sum,
      link: 'museum',
    });
  }

  if (mu.milestone.n >= 3 && !mu.appraisal) {
    add({
      id: 'museum-appraisal', cat: 'Музей', priority: 18, effort: 'монеты',
      title: 'Можно оценить музей: Museum Appraisal Service открыт',
      why: 'Открывается на вехе 3. Разовая услуга (10 млн): Madame Goldsworth оценивает стоимость музея, и она появляется в профиле и в рейтингах. На прогресс не влияет — только если хочешь видеть оценку.',
      how: ['Hub → Museum → Madame Eleanor Q. Goldsworth III → Museum Appraisal.'],
      cost: 10_000_000,
      link: 'museum',
    });
  }
}
