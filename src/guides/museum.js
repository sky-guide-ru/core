// Гайд по музею: что засчитано, что пожертвовать из своего, как дешевле дойти до следующей вехи,
// неполные сеты брони, одолженные и особые предметы. Расчёт — server/museum/analyze.js.
import { analyzeMuseum, setName, setIcon } from '../museum/analyze.js';
import { museumCatalog, MILESTONE_REWARDS, OTHER_REWARDS, MILESTONES, MILESTONE_XP } from '../museum/catalog.js';
import { fmt, short, plural, constants, cell, topNext } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

const icon = (x) => (x.set ? setIcon(x.set) : x.id);

export function build(m, ctx) {
  const mu = analyzeMuseum(m, { constants: constants(ctx), price: ctx.price, name: ctx.name });
  const cat = museumCatalog(constants(ctx));
  const nm = id => { const e = cat.entries.get(id); return e?.set ? setName(e.set, ctx.name) : ctx.name(id); };
  const sections = [];

  sections.push({
    kind: 'text', title: 'Как устроен музей',
    text: [
      tx`Музей в Hub принимает ${cat.total} предметов и сетов брони в 7 разделах: Combat, Farming, Mining, Fishing, Foraging, Dungeoneering и Hunting. Каждый пожертвованный предмет навсегда даёт SkyBlock XP (от 1 до 30), всего ${fmt(cat.xpMax)} XP.`,
      'Вехи музея идут каждые 100 XP музея, всего 40. Каждая даёт +1% Bits Multiplier и +2% Bank Interest, а некоторые ещё и свои награды: на вехе 3 открывается Museum Appraisal и Deluxe Bank Upgrade.',
      'Высший тир засчитывает низшие: пожертвовал Aspect of the Void — Aspect of the End тоже считается сданным. Поэтому иногда выгоднее сдать дорогой предмет и сразу закрыть несколько строк.',
      'Сет брони сдаётся только целиком: все части должны лежать в инвентаре одновременно. Звёздные версии данжевых предметов засчитываются как обычные.',
      'Пожертвованный предмет становится Co-op Soulbound: продать его уже нельзя, но можно в любой момент забрать обратно (Borrowing), и XP при этом остаётся.',
      'Special Items (особые предметы: трофеи событий, редкие вещи) XP не дают и в проценты не входят — их можно выставлять сколько угодно.',
    ],
  });

  if (mu.status === 'off' || mu.status === 'none') {
    return {
      summary: mu.status === 'off' ? 'Museum API выключен: музей этого игрока не виден' : 'Данных музея пока нет',
      status: 'locked',
      next: topNext([mu.status === 'off'
        ? { title: 'Включи Museum API', priority: 70, why: 'SkyBlock Menu → Settings → API Settings → Museum API. Без него сайт не видит музей, вехи и что пожертвовать.' }
        : { title: 'Обнови профиль', priority: 40, why: 'Hypixel не ответил по музею. Через пару минут нажми «Обновить».' }]),
      sections,
    };
  }

  const ms = mu.milestone;
  const next = [];
  if (mu.canDonate.length) {
    next.push({
      title: tx`Пожертвуй ${mu.canDonate.length} ${plural(mu.canDonate.length, 'предмет', 'предмета', 'предметов')}, что уже есть: +${mu.canDonateXp} SkyBlock XP`, priority: 80,
      why: tx`Лежат у тебя и ещё не в музее: ${mu.canDonate.slice(0, 6).map(x => tx`${nm(x.id)} (+${x.gain})`).join(', ')}${mu.canDonate.length > 6 ? ' и др.' : ''}. Забрать обратно можно в любой момент, XP останется.`,
      item: icon(mu.canDonate[0]),
    });
  }
  const plan = mu.milestonePlan;
  if (plan?.reached && !plan.free) {
    const buy = plan.steps.filter(s => !s.free);
    next.push({
      title: tx`Веха ${plan.target}: не хватает ${ms.toNext} XP, дешевле всего за ${short(plan.coins)}`, priority: 60,
      why: tx`Купить: ${buy.slice(0, 6).map(s => tx`${nm(s.id)} (~${short(s.cost)}, +${s.gain})`).join(', ')}${buy.length > 6 ? ' и др.' : ''}.`,
      item: buy[0] ? (buy[0].items?.length > 1 ? setIcon(buy[0].items) : buy[0].id) : undefined,
    });
  }
  const setNear = mu.partialSets.find(s => s.missing.length === 1 && s.costLeft);
  if (setNear) {
    next.push({
      title: tx`Добери ${nm(setNear.id)}: не хватает одной части`, priority: 48,
      why: tx`Есть ${setNear.have.length} из ${setNear.have.length + 1}. Не хватает ${ctx.name(setNear.missing[0].id)} (~${short(setNear.costLeft)}), и сет даст +${setNear.gain} XP.`,
      item: setNear.missing[0].id,
    });
  }
  if (mu.bestValue.length) {
    const b = mu.bestValue[0];
    next.push({ title: tx`Самый выгодный XP за монету: ${nm(b.id)}`, priority: 36, why: tx`~${short(b.cost)} за +${b.gain} XP (${short(b.perXp)} за 1 XP).`, item: icon(b) });
  }
  if (ms.n >= 3 && !mu.appraisal) next.push({ title: 'Museum Appraisal открыт', priority: 15, why: 'Разовая оценка музея за 10 млн у Madame Eleanor Q. Goldsworth III: показывает стоимость музея. На прогресс не влияет.' });
  if (mu.specialOwned.length) next.push({ title: tx`${mu.specialOwned.length} ${plural(mu.specialOwned.length, 'особый предмет', 'особых предмета', 'особых предметов')} можно выставить`, priority: 12, why: tx`Special Items XP не дают, только для коллекции: ${mu.specialOwned.slice(0, 5).map(x => ctx.name(x.id)).join(', ')}.`, item: mu.specialOwned[0].id });

  sections.push({
    kind: 'table', title: 'Разделы музея',
    columns: ['Раздел', 'Сдано', 'XP', 'Осталось XP'],
    rows: mu.categories.map(c => [
      cell(tx`${c.ru} (${c.name})`, { item: c.icon }),
      cell(tx`${c.donated} / ${c.total}`, { tone: c.donated >= c.total ? 'good' : undefined }),
      tx`${fmt(c.xp)} / ${fmt(c.xpMax)}`,
      cell(fmt(c.xpMax - c.xp), { tone: c.xpMax - c.xp ? 'warn' : 'good' }),
    ]),
  });

  if (mu.canDonate.length) {
    sections.push({
      kind: 'checklist', title: 'Можно пожертвовать прямо сейчас',
      note: 'Эти предметы уже есть у тебя, но не в музее. Отметка «сделано» появится сама после пожертвования и обновления профиля.',
      items: mu.canDonate.slice(0, 30).map(x => ({ text: tx`${nm(x.id)} — +${x.gain} XP`, done: false, hint: [x.where.join(', '), x.value ? tx`после пожертвования не продать (сейчас ~${short(x.value)})` : ''].filter(Boolean).join(' · '), item: icon(x) })),
    });
  }

  if (plan && ms.nextXp != null) {
    sections.push({
      kind: 'table', title: tx`Как дойти до вехи ${plan.target}`,
      note: plan.reached ? tx`Не хватает ${ms.toNext} XP. Сначала то, что уже есть, потом самое дешёвое за XP.` : tx`Не хватает ${ms.toNext} XP, а с ценами на рынке набирается меньше: остальное — предметы, которые не продаются (их добывают сами).`,
      columns: ['Предмет', 'XP', 'Цена'],
      rows: plan.steps.map(s => [cell(nm(s.id), { item: s.items?.length > 1 ? setIcon(s.items) : s.id }), tx`+${s.gain}`, s.free ? cell('уже есть', { tone: 'good' }) : tx`~${short(s.cost)}`]),
    });
  }

  if (mu.cheapest.length) {
    sections.push({
      kind: 'table', title: 'Самые дешёвые недостающие',
      note: 'Цена — Lowest BIN или Bazaar прямо сейчас; для сета — сумма всех частей.',
      columns: ['Предмет', 'Раздел', 'XP', 'Цена'],
      rows: mu.cheapest.slice(0, 20).map(x => [cell(nm(x.id), { item: icon(x) }), cat.entries.get(x.id) ? catRu(x.cat) : '', tx`+${x.gain}`, tx`~${short(x.cost)}`]),
    });
    sections.push({
      kind: 'table', title: 'Больше всего XP за монету',
      note: 'XP с учётом низших тиров, которые предмет засчитает заодно.',
      columns: ['Предмет', 'XP', 'Цена', 'За 1 XP'],
      rows: mu.bestValue.slice(0, 20).map(x => [cell(nm(x.id), { item: icon(x) }), tx`+${x.gain}`, tx`~${short(x.cost)}`, short(x.perXp)]),
    });
  }

  if (mu.partialSets.length) {
    sections.push({
      kind: 'table', title: 'Неполные сеты брони',
      note: 'Части уже есть, но сет сдаётся только целиком.',
      columns: ['Сет', 'Есть', 'Не хватает', 'Докупить'],
      rows: mu.partialSets.slice(0, 15).map(s => [
        cell(nm(s.id), { item: setIcon(cat.entries.get(s.id)?.set || s.have) }),
        tx`${s.have.length} из ${s.have.length + s.missing.length}`,
        s.missing.map(p => ctx.name(p.id)).join(', '),
        s.costLeft ? tx`~${short(s.costLeft)}` : cell('нет на рынке', { tone: 'muted' }),
      ]),
    });
  }

  const from = Math.max(1, ms.n - 1);
  sections.push({
    kind: 'table', title: 'Вехи и награды',
    note: tx`Сейчас ${fmt(mu.xp)} XP музея, веха ${ms.n} из ${MILESTONES}. Награды забираются в меню Museum Milestones. Среди наград дальних вех: ${OTHER_REWARDS.join(', ')} — точные номера видны в игре.`,
    columns: ['Веха', 'Нужно XP', 'Награды'],
    current: Math.max(0, Math.min(MILESTONES, ms.n + 1) - from),
    rows: Array.from({ length: Math.min(8, MILESTONES - from + 1) }, (_, i) => from + i).map(n => [
      cell(tx`Веха ${n}`, { tone: ms.n >= n ? 'good' : undefined }), fmt(n * MILESTONE_XP),
      (MILESTONE_REWARDS[n] || ['+1% Bits Multiplier', '+2% Bank Interest', 'и награда вехи (см. в игре)']).join(', '),
    ]),
  });

  if (mu.borrowed.length) {
    sections.push({
      kind: 'table', title: 'Одолжено из музея',
      note: 'Эти предметы ты забрал обратно. XP за них засчитан, вернуть их в витрину можно в любой момент.',
      columns: ['Предмет', 'Раздел', 'XP'],
      rows: mu.borrowed.map(b => [cell(nm(b.id), { item: icon(b) }), catRu(b.cat), b.xp]),
    });
  }

  sections.push({
    kind: 'text', title: 'Особые предметы (Special Items)',
    text: [
      mu.special.count ? tx`Выставлено особых предметов: ${mu.special.count}.` : 'Особых предметов в музее пока нет.',
      mu.specialOwned.length ? tx`У тебя есть и ещё не выставлены: ${mu.specialOwned.map(x => ctx.name(x.id)).join(', ')}.` : 'Среди твоих предметов не нашлось особых, которых нет в музее.',
      'Они не дают SkyBlock XP, поэтому их жертвуют только для коллекции и оценки музея.',
    ],
  });

  return {
    summary: tx`${mu.donated} из ${mu.total} · ${fmt(mu.xp)} XP музея · веха ${ms.n}/${MILESTONES}${mu.value ? tx` · оценка ${short(mu.value)}` : ''}`,
    status: mu.donated >= mu.total ? 'done' : mu.donated ? 'progress' : 'start',
    level: { label: 'Вехи музея', value: ms.n, max: MILESTONES },
    next: topNext(next),
    sections,
  };
}

const CAT_RU = { combat: 'Combat', farming: 'Farming', mining: 'Mining', fishing: 'Fishing', foraging: 'Foraging', dungeoneering: 'Dungeons', hunting: 'Охота' };
const catRu = id => CAT_RU[id] || id;

export default { id: 'museum', title: 'Музей', icon: 'ITEM_FRAME', group: 'other', build };
