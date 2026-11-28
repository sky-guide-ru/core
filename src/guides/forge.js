// Гайд «The Forge»: что лежит в слотах, что выгодно ковать под ритм заходов и пошаговые цепочки деталей бура.
// Расчёт — в market/forge.js; гайд собирает его под профиль. Свой вид страницы: web/src/guides/Forge.jsx (extra.forge).
import { forgeNow, forgeProfitPlans, drillUpgrades, forgeForSelf, stockOf, hotmOf, VISITS } from '../market/forge.js';
import { buyPrice } from '../market/flips.js';
import { collectionsFromNeu } from '../market/requirements.js';
import { spendBudget } from '../market/methods.js';
import { nameOf } from '../market/util.js';
import { short, plural } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';


export default {
  id: 'forge', title: 'The Forge', icon: 'DRILL_ENGINE', group: 'mining',
  build(m, ctx) {
    const guest = !!m.guest;
    const items = ctx.items;
    const mctx = ctx.market || null;
    const noMarket = m.mode?.market === false;
    const h = hotmOf(m);
    const now = guest ? null : forgeNow(m, items, Date.now());
    const stock = guest ? new Map() : stockOf(m, ctx.owned);
    const slots = now?.slots ?? 2;
    const qf = now?.qf ?? 0;

    // выгодные рецепты: только с рынком (у Ironman/Stranded/Bingo продажа лишь NPC — там ковать для себя)
    let profit = null;
    if (mctx && !noMarket) {
      try {
        profit = forgeProfitPlans(mctx, m, {
          stock, guest, collections: ctx.collections || collectionsFromNeu(items), maxCost: guest ? Infinity : spendBudget(m),
        });
      } catch (e) { profit = null; }
    }

    const price = id => {
      if (noMarket) return null;
      if (mctx) return buyPrice(mctx, id)?.price ?? null;
      return ctx.price(id) || null;
    };
    const priceAh = id => (mctx ? mctx.bin?.get(id)?.price || buyPrice(mctx, id)?.price || null : ctx.price(id) || null);
    const drill = guest ? null : drillUpgrades(items, { owned: ctx.owned, stock, price, priceAh, qf, slots, noMarket, member: m });
    const self = noMarket && drill ? forgeForSelf(drill) : null;

    // для пустых слотов — что положить: лучшие рецепты плана «2 раза в день»
    if (now && profit) {
      const plan = profit.plans.find(p => p.visitH === 12) || profit.plans[0];
      const queue = plan.used.flatMap(u => Array(Math.max(1, Math.round(u.slots))).fill(u.id));
      let i = 0;
      for (const s of now.list) if (s.empty && queue[i]) { s.suggest = queue[i]; s.suggestName = nameOf({ items }, queue[i]); i++; }
    } else if (now && self) {
      let i = 0;
      for (const s of now.list) if (s.empty && self[i]) { s.suggest = self[i].id; s.suggestName = self[i].name; i++; }
    }

    // только нужные строки рецептов — список целиком есть в «Заработке»
    let rows = null;
    if (profit) {
      const ids = new Set([...profit.plans.flatMap(p => p.top.map(t => t.id)), ...profit.goals.map(g => g.id)]);
      rows = Object.fromEntries([...ids].map(id => [id, profit.rows[id]]).filter(([, r]) => r));
    }

    const ready = now ? now.list.filter(s => s.ready).length : 0;
    const empty = now ? now.list.filter(s => s.empty).length : 0;
    const next = [];
    if (ready) next.push({ title: tx`Забери готовое из Forge: ${ready}`, priority: 70, why: 'Слот простаивает, пока результат лежит в нём. /warp forge.' });
    if (empty) {
      const s = now.list.find(x => x.empty && x.suggest);
      next.push({ title: tx`Свободных слотов: ${empty}`, priority: 60, why: s ? tx`Положи ${s.suggestName} — самый выгодный сейчас рецепт под твой HotM.` : 'Положи выгодный рецепт из блока «Выгодно ковать».' });
    }
    const part = drill?.parts.find(p => !p.locked && p.key !== 'drill');
    if (part) next.push({ title: tx`${part.label} бура: ${part.nextName}`, priority: 40, why: tx`Пошаговая цепочка — в блоке «Улучшить бур»: около ${Math.max(1, Math.round(part.hours / 24))} дн. ковки на твоих слотах.` });

    const best = profit?.plans.find(p => p.visitH === 12);
    const summary = guest ? 'Что ковать в The Forge и как собрать детали бура: прибыль по живым ценам, время ковки и цепочки рецептов.'
      : h < 1 ? 'Forge откроется с HotM 1: начни с заданий в Dwarven Mines.'
        : [tx`HotM ${h}`, tx`${slots} ${plural(slots, 'слот', 'слота', 'слотов')}`, qf ? tx`Quick Forge −${Math.round(qf * 100)}%` : null, best?.perHour ? tx`≈ ${short(best.perHour)}/ч на все слоты` : null].filter(Boolean).join(' · ');

    return {
      summary, status: guest ? null : h < 1 ? 'locked' : 'progress',
      next,
      extra: {
        forge: {
          hotm: h, slots, qf, noMarket, guest, visits: VISITS,
          now: now ? now.list : null,
          plans: profit?.plans || null, goals: profit?.goals || [], rows,
          drill: drill?.drill || null, parts: drill?.parts || [], self,
        },
      },
      sections: [
        {
          kind: 'text', title: 'Как работает Forge',
          text: [
            'The Forge в Dwarven Mines (/warp forge) открывается с HotM 1. Положи материалы в слот — предмет куётся в реальном времени, даже когда ты не в игре.',
            'Слоты добавляются с уровнями HotM, перк Quick Forge ускоряет ковку до 30%. Детали бура снимает и переставляет Jotraeline Greatforge в той же кузнице.',
          ],
        },
      ],
    };
  },
};
