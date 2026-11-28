// Гайд Bestiary: вехи и что они дают, уровни семейств, какие мобы быстрее всего добить до следующей вехи и где их искать.
// Расчёт — calc/bestiary.js (семейства и пороги NEU, убийства из API), данные вики — bestiary-data.js (сверено 28.11.2026).
import { bestiarySummary, tierBonus, spotOf, placeOf, killCost } from '../calc/bestiary.js';
import { PER_TIER, TIERS_PER_MILESTONE, milestoneCombatXp } from './bestiary-data.js';
import { fmt, short, plural } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

/** «+12 Magic Find, +12 Strength» / «+2 Farming Fortune» / «+3 Hunting Fortune, +30% Hunting XP» */
export function bonusText(b) {
  const parts = [];
  if (b.mf) parts.push(tx`+${b.mf} Magic Find`);
  if (b.str) parts.push(tx`+${b.str} Strength`);
  if (b.ff) parts.push(tx`+${String(b.ff).replace('.', ',')} Farming Fortune`);
  if (b.hf) parts.push(tx`+${b.hf} Hunting Fortune`);
  if (b.hxp) parts.push(tx`+${b.hxp}% Hunting XP`);
  return parts.join(', ') || '—';
}

const killsText = n => tx`${fmt(n)} ${plural(n, 'убийство', 'убийства', 'убийств')}`;
const tierCell = f => ({ text: tx`${f.tier} / ${f.max}`, tone: f.done ? 'good' : f.tier === 0 ? 'muted' : undefined });

function build(m, ctx) {
  const s = bestiarySummary(m, ctx.constants?.bestiary);
  if (!s) {
    return {
      summary: 'Нет данных о семействах Bestiary: загляни позже.', status: 'start',
      sections: [{ kind: 'text', title: 'Как работает Bestiary', text: howText() }],
    };
  }
  const next = [];
  const sections = [];
  const none = s.tiers === 0;

  // ── Где ты сейчас
  if (s.unclaimed > 0) {
    next.push({
      title: tx`Забрать награды за ${s.unclaimed} ${plural(s.unclaimed, 'веху', 'вехи', 'вех')} Bestiary`,
      why: tx`Уровни уже набраны: +${s.unclaimed} Health и Combat XP ждут в меню Bestiary (кнопка Milestones).`, priority: 90,
    });
  }
  if (none) {
    next.push({ title: 'Поговорить с Bramass Beastslayer в Spider\'s Den', why: 'Без этого убийства в Bestiary не считаются.', priority: 80 });
  }
  sections.push({
    bx: true, kind: 'checklist', title: 'Твой прогресс', news: 'progress',
    note: tx`Веха — каждые ${TIERS_PER_MILESTONE} уровней семейств, сумма по всем мобам.`,
    items: [
      { text: tx`Bestiary Milestone ${s.milestone} из ${s.maxMilestone}`, done: s.milestone >= s.maxMilestone,
        hint: tx`До вехи ${s.nextMs}: ещё ${s.toNext} ${plural(s.toNext, 'уровень', 'уровня', 'уровней')} любых семейств.` },
      { text: tx`Награды забраны за ${s.claimed} ${plural(s.claimed, 'веху', 'вехи', 'вех')}: +${s.claimed} Health`, done: s.unclaimed === 0,
        hint: s.unclaimed ? tx`Ещё ${s.unclaimed} ждут в меню Bestiary → Milestones.` : undefined },
      { text: tx`Уровней семейств: ${fmt(s.tiers)} из ${fmt(s.maxTiers)}`, done: s.tiers >= s.maxTiers },
      { text: tx`Семейств найдено: ${s.found} из ${s.families}, на максимуме: ${s.maxed}`, done: s.maxed >= s.families },
    ],
  });

  // ── До следующей вехи: самое быстрое
  if (s.plan.length) {
    const first = s.plan[0];
    next.push({
      title: tx`До вехи ${s.nextMs}: ${s.toNext} ${plural(s.toNext, 'уровень', 'уровня', 'уровней')} Bestiary`,
      why: tx`Быстрее всего: ${s.plan.slice(0, 3).map(r => tx`${r.f.name} (${fmt(r.kills)})`).join(', ')}. Начни с ${first.f.name}: ${spotOf(first.f).where}.`,
      priority: 55, bx: true, // на своей странице это карточка «Быстрее всего»
    });
    sections.push({
      bx: true, kind: 'table', title: tx`До вехи ${s.nextMs}: самое быстрое`, news: 'plan',
      note: tx`Нужно ${s.toNext} ${plural(s.toNext, 'уровень', 'уровня', 'уровней')}. Оценка по числу убийств, Health моба и дороге; события не учтены.${s.nextXp ? tx` Веха ${s.nextXpAt} даст ещё ${short(s.nextXp)} Combat XP.` : ''}`,
      columns: ['Моб', 'Где', 'Убить', 'Уровень', 'Бонус на нём'],
      rows: s.plan.map(r => [
        r.f.name,
        spotOf(r.f).where,
        fmt(r.kills),
        tx`${r.f.tier} → ${r.to}`,
        bonusText(tierBonus(r.f, r.to)),
      ]),
    });
  }

  // ── Мобы, которых ты бьёшь чаще всего
  const main = s.progress.filter(f => f.kills > 0).sort((a, b) => b.kills - a.kills).slice(0, 8);
  if (main.length) {
    sections.push({
      bx: true, kind: 'table', title: 'Твои главные мобы', news: 'main',
      note: 'Бонус действует только против этого семейства: Magic Find повышает шанс редкого дропа.',
      columns: ['Моб', 'Убито', 'Уровень', 'Сейчас', 'До следующего'],
      rows: main.map(f => [f.name, fmt(f.kills), tierCell(f), bonusText(tierBonus(f)),
        f.done ? { text: 'максимум', tone: 'good' } : killsText(f.next - f.kills)]),
    });
  }

  // ── Почти максимум
  const almost = s.progress.filter(f => !f.done && f.kills > 0 && f.max - f.tier <= 2 && placeOf(f.cat).kind !== 'event')
    .sort((a, b) => (a.cap - a.kills) * killCost(a) - (b.cap - b.kills) * killCost(b)).slice(0, 8);
  if (almost.length) {
    sections.push({
      bx: true, kind: 'table', title: 'Почти максимум',
      note: 'Последние уровни семейства: на максимуме бонус против него самый большой.',
      columns: ['Моб', 'Где', 'Уровень', 'До максимума', 'Бонус на максимуме'],
      rows: almost.map(f => [f.name, spotOf(f).where, tierCell(f), killsText(f.cap - f.kills), bonusText(tierBonus(f, f.max))]),
    });
  }

  // ── События: в план не идут
  const ev = s.progress.filter(f => !f.done && placeOf(f.cat).kind === 'event')
    .map(f => ({ f, left: (f.next ?? f.cap) - f.kills })).sort((a, b) => a.left - b.left).slice(0, 8);
  if (ev.length) {
    sections.push({
      bx: true, kind: 'table', title: 'Во время событий',
      note: 'Эти мобы бывают только на событиях: когда событие идёт, их уровни самые быстрые.',
      columns: ['Моб', 'Когда', 'Уровень', 'До следующего'],
      rows: ev.map(({ f, left }) => [f.name, spotOf(f).where, tierCell(f), killsText(left)]),
    });
  }

  // ── По островам
  sections.push({
    bx: true, kind: 'table', title: 'По разделам Bestiary', news: 'islands',
    columns: ['Раздел', 'Найдено', 'На максимуме', 'Уровни'],
    rows: s.islands.map(r => [r.where, tx`${r.found} / ${r.families}`,
      { text: tx`${r.maxed} / ${r.families}`, tone: r.maxed === r.families ? 'good' : undefined },
      { text: tx`${fmt(r.tiers)} / ${fmt(r.max)}`, tone: r.tiers === 0 ? 'muted' : undefined }]),
  });

  // ── Как работает и награды вех
  sections.push({ kind: 'text', title: 'Как работает Bestiary', text: howText() });
  const upcoming = [];
  for (let n = Math.max(5, Math.ceil(s.nextMs / 5) * 5); upcoming.length < 6; n += 5) upcoming.push(n);
  sections.push({
    kind: 'table', title: 'Награды вех',
    note: 'Каждая веха: +1 Health. Каждая 5-я: Combat XP (Combat Wisdom не влияет). Каждая 10-я: +10 SkyBlock XP.',
    columns: ['Веха', 'Combat XP', 'SkyBlock XP'],
    rows: upcoming.map(n => [tx`${n}`, fmt(milestoneCombatXp(n)), n % 10 ? '—' : '+10']),
  });

  // Данные для своего вида страницы (web/src/guides/Bestiary.jsx): карточки и полоски вместо таблиц.
  // Секции с bx: true — то же самое таблицами для общего рендера, поиска и английской версии без своего вида.
  const mob = f => ({ name: f.name, where: spotOf(f).where, kills: f.kills, tier: f.tier, max: f.max,
    left: f.done ? 0 : (f.next ?? f.cap) - f.kills, toMax: f.cap - f.kills, bonus: bonusText(tierBonus(f)), maxBonus: bonusText(tierBonus(f, f.max)) });
  const extra = { bestiary: {
    milestone: s.milestone, maxMilestone: s.maxMilestone, claimed: s.claimed, unclaimed: s.unclaimed,
    nextMs: s.nextMs, toNext: s.toNext, inMs: TIERS_PER_MILESTONE - s.toNext, perMs: TIERS_PER_MILESTONE, nextXp: s.nextXp, nextXpAt: s.nextXpAt,
    tiers: s.tiers, maxTiers: s.maxTiers, found: s.found, families: s.families, maxed: s.maxed, started: !none,
    plan: s.plan.map(r => ({ ...mob(r.f), need: r.kills, to: r.to, gain: r.tiers, bonusTo: bonusText(tierBonus(r.f, r.to)) })),
    main: main.map(mob), almost: almost.map(mob), events: ev.map(({ f }) => mob(f)),
    islands: s.islands.map(r => ({ where: r.where, found: r.found, families: r.families, maxed: r.maxed, tiers: r.tiers, max: r.max })),
    rewards: upcoming.map(n => ({ n, xp: milestoneCombatXp(n), sbxp: n % 10 ? 0 : 10 })),
  } };

  const status = none ? 'start' : s.milestone >= s.maxMilestone ? 'done' : 'progress';
  return {
    summary: none ? 'Bestiary ещё не начат: убийства не считаются, пока не поговоришь с Bramass Beastslayer.'
      : tx`Веха ${s.milestone}, до ${s.nextMs} — ${s.toNext} ${plural(s.toNext, 'уровень', 'уровня', 'уровней')}. Семейств на максимуме: ${s.maxed} из ${s.families}.`,
    status,
    level: { label: 'Bestiary Milestone', value: s.milestone, max: s.maxMilestone },
    next: next.sort((a, b) => b.priority - a.priority),
    sections,
    extra,
  };
}

function howText() {
  const mob = PER_TIER.mob;
  return [
    'Bestiary считает убийства каждого семейства мобов. Начать счёт: поговорить с Bramass Beastslayer у Grandma\'s House в Spider\'s Den.',
    tx`Уровень семейства даёт против этих мобов +${mob.mf} Magic Find и +${mob.str} Strength, больше монет и опыта, а ещё +1 SkyBlock XP.`,
    'Вредители Garden вместо этого дают Farming Fortune, существа Hunting — Hunting Fortune и Hunting XP.',
    tx`Каждые ${TIERS_PER_MILESTONE} уровней любых семейств — веха: +1 Health навсегда, а за каждую 5-ю ещё и Combat XP.`,
    'Убийство засчитывается, если ты в пятёрке по урону. В Dungeons и Kuudra — всей группе, Sea Creature — тому, кто её поймал.',
    'Первые уровни у новых семейств почти бесплатные: часто хватает 1–20 убийств.',
  ];
}

export default { id: 'bestiary', title: 'Bestiary', icon: 'BOOK_AND_QUILL', group: 'combat', build };
