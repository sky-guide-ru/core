// Гайд по миньонам: слоты за уникальные крафты, самые дешёвые следующие крафты по ценам Bazaar, улучшения и топливо.
import { neu } from '../neu.js';
import { extractRecipes, marketId } from '../market/util.js';
import { fmt, short, plural, hasItem, constants, cell, topNext, lc } from './gathering-util.js';

// Лестница слотов общая со страницей «Миньоны» (server/minions)
import { SLOT_STEPS, minionSlots } from '../minions/index.js';
import { tx } from '../../i18n/msg.js';
export { SLOT_STEPS, minionSlots };

// Имя типа: WHEAT → Wheat, CAVESPIDER → Cave Spider
const TYPE_NAME = { CAVESPIDER: 'Cave Spider', ENDER_STONE: 'End Stone', MAGMA_CUBE: 'Magma Cube', LILY_PAD: 'Lily Pad', DARK_OAK: 'Dark Oak', SNOW: 'Snow', REDSTONE: 'Redstone', NETHERWARTS: 'Nether Wart', SAND: 'Sand', RED_SAND: 'Red Sand', MYCELIUM: 'Mycelium' };
const typeName = t => TYPE_NAME[t] || t.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Стоимость крафта уровня по рецепту NEU (без самого миньона прошлого уровня). null — нет рецепта или цен. */
function craftCost(ctx, items, type, tier) {
  const it = items?.get?.(`${type}_GENERATOR_${tier}`);
  if (!it) return null;
  const r = extractRecipes(it).find(x => x.type === 'craft');
  if (!r) return null;
  let sum = 0, unknown = false;
  const parts = [];
  for (const [id, n] of Object.entries(r.inputs)) {
    if (/_GENERATOR_\d+$/.test(id)) continue;
    const p = ctx.price(marketId(id, items));
    if (!p) unknown = true;
    sum += p * n;
    parts.push(tx`${n}× ${ctx.name(id)}`);
  }
  return { coins: unknown ? null : sum, parts };
}

const UPGRADES = [
  ['SUPER_COMPACTOR_3000', 'Сжимает дроп в Enchanted-формы: место в миньоне не кончается'],
  ['DIAMOND_SPREADING', 'Дополнительные алмазы с каждого действия'],
  ['FLYCATCHER_UPGRADE', '+20% скорости работы'],
  ['MINION_EXPANDER', '+5% скорости и +1 блок радиуса'],
  ['ENCHANTED_HOPPER', 'Продаёт дроп NPC сам, без захода на остров (90% цены)'],
  ['CORRUPT_SOIL', 'Для миньонов мобов: дополнительный дроп'],
];
const FUELS = [
  ['ENCHANTED_LAVA_BUCKET', '+25%, навсегда'],
  ['MAGMA_BUCKET', '+30%, навсегда'],
  ['PLASMA_BUCKET', '+35%, навсегда'],
  ['EVERBURNING_FLAME', '+35% и бонус миньонам мобов, навсегда'],
];

export default {
  id: 'minions', title: 'Миньоны', icon: 'WHEAT_GENERATOR_12', group: 'other',
  build(m, ctx) {
    const items = ctx.items || neu.items;
    const maxTier = constants(ctx).misc?.minions || ctx.adv?.data?.minionMaxTier || {};
    const crafted = new Map(); // тип → Set уровней
    for (const s of m.coop?.minions || m.minions || []) {
      const r = /^(.+)_(\d+)$/.exec(s);
      if (!r) continue;
      if (!crafted.has(r[1])) crafted.set(r[1], new Set());
      crafted.get(r[1]).add(Number(r[2]));
    }
    const unique = [...crafted.values()].reduce((n, set) => n + set.size, 0);
    const sl = minionSlots(unique);
    const community = Math.min(5, Number(m.extras?.communityUpgrades?.minion_slots || 0));
    const types = Object.entries(maxTier).map(([gen, max]) => ({ type: gen.replace(/_GENERATOR$/, ''), max: Number(max) }));
    const totalPossible = types.reduce((s, t) => s + t.max, 0);

    // Кандидаты: следующий уровень над самым высоким скрафченным (или первый уровень нового типа)
    const cands = [];
    for (const t of types) {
      const set = crafted.get(t.type) || new Set();
      const top = set.size ? Math.max(...set) : 0;
      if (top >= t.max) continue;
      const tier = top + 1;
      const cost = craftCost(ctx, items, t.type, tier);
      cands.push({ ...t, tier, top, cost: cost?.coins ?? null, parts: cost?.parts || [], isNew: top === 0 });
    }
    const priced = cands.filter(c => c.cost != null).sort((a, b) => a.cost - b.cost);
    const toNext = sl.left > 0 ? priced.slice(0, sl.left) : [];
    const toNextCost = toNext.reduce((s, c) => s + c.cost, 0);

    const next = [];
    if (sl.nextAt != null) {
      next.push({
        title: tx`${sl.left} ${plural(sl.left, 'новый крафт', 'новых крафта', 'новых крафтов')} до ${sl.slots + 1}-го слота миньона`, priority: sl.left <= 5 ? 74 : 56,
        why: tx`Уникальных крафтов: ${unique}, следующий слот на ${sl.nextAt}. ${toNext.length === sl.left ? tx`Дешевле всего добрать: ${toNext.slice(0, 6).map(c => tx`${typeName(c.type)} ${ROMAN[c.tier]} (~${short(c.cost)})`).join(', ')}${toNext.length > 6 ? ' и др.' : ''} — всего ~${short(toNextCost)} монет.` : 'Посмотри таблицу ниже: там самые дешёвые следующие уровни.'}`,
      });
    }
    const missingUp = UPGRADES.filter(([id]) => !hasItem(ctx, id)).slice(0, 3);
    if (missingUp.length) next.push({ title: 'Улучшения для миньонов', priority: 40, why: missingUp.map(([id, why]) => tx`${ctx.name(id)}: ${lc(why)}`).join('; ') + '. Если они уже стоят в миньонах на острове, API их не видит — тогда пропусти этот шаг.' });
    next.push({ title: 'Топливо навсегда вместо угля', priority: 30, why: 'Enchanted Lava Bucket → Magma Bucket → Plasma Bucket → Everburning Flame: один раз положил, и миньон работает быстрее без расхода.' });

    const sections = [];
    sections.push({
      kind: 'text', title: 'Как работают слоты',
      text: [
        tx`Слоты дают уникальные крафты: каждый новый уровень каждого миньона считается один раз. ${m.coop?.members?.length > 1 ? 'В коопе' : 'У тебя'} ${unique} из ${totalPossible || '?'} возможных, это ${sl.slots} ${plural(sl.slots, 'слот', 'слота', 'слотов')}${community ? tx` и ещё ${community} из Community Shop, всего ${sl.slots + community}` : ' (Community Shop даёт ещё до +5)'}.`,
        m.coop?.members?.length > 1 ? 'В коопе уникальные крафты всех участников складываются: здесь посчитаны крафты всего кооператива.' : 'В коопе уникальные крафты всех участников складываются.',
        'Все типы, тиры, замки коллекций и доходность — на странице «Миньоны» (в меню слева).',
        'Самый дешёвый способ добрать слоты — скрафтить низкие уровни тех миньонов, которых ещё нет, и сразу продать или разобрать их.',
      ],
    });
    sections.push({
      kind: 'table', title: 'Лестница слотов',
      columns: ['Уникальных крафтов', 'Слотов'],
      rows: (() => {
        const i = Math.max(0, SLOT_STEPS.findIndex(([, s]) => s === sl.slots));
        return SLOT_STEPS.slice(Math.max(0, i - 1), i + 6).map(([need, s]) => [cell(fmt(need), { tone: unique >= need ? 'good' : 'muted' }), cell(s, { tone: s === sl.slots ? 'good' : undefined })]);
      })(),
    });
    sections.push({
      kind: 'table', title: 'Самые дешёвые следующие крафты',
      note: priced.length ? 'Цена ингредиентов по Bazaar/аукциону прямо сейчас, без миньона прошлого уровня (он входит в рецепт).' : 'Цены или рецепты ещё не загрузились: список появится после загрузки NEU и Bazaar.',
      columns: ['Миньон', 'Сейчас', 'Следующий', 'Ингредиенты', 'Цена'],
      rows: (priced.length ? priced : cands).slice(0, 25).map(c => [
        cell(typeName(c.type), { item: tx`${c.type}_GENERATOR_${Math.max(1, c.top)}` }),
        c.top ? `${ROMAN[c.top]}/${ROMAN[c.max]}` : cell('нет', { tone: 'warn' }),
        ROMAN[c.tier],
        c.parts.join(', ') || '—',
        c.cost != null ? short(c.cost) : '—',
      ]),
    });
    sections.push({
      kind: 'table', title: 'Улучшения и топливо',
      columns: ['Предмет', 'Что даёт', 'Как получить'],
      rows: [...UPGRADES, ...FUELS].map(([id, why]) => {
        let how = '';
        try { how = ctx.price(id) ? tx`~${short(ctx.price(id))} на рынке` : ''; } catch { how = ''; }
        return [cell(ctx.name(id), { item: id }), why, how || 'крафт, см. карточку предмета'];
      }),
    });

    return {
      summary: tx`${sl.slots} ${plural(sl.slots, 'слот', 'слота', 'слотов')} · ${unique} уникальных крафтов${sl.nextAt ? tx` · до следующего слота ${sl.left}` : ''}`,
      status: sl.nextAt == null ? 'done' : 'progress',
      level: { label: 'Слоты миньонов', value: sl.slots, max: 26 },
      next: topNext(next),
      sections,
    };
  },
};
