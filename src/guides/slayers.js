// Гайды по каждому слееру: тиры, что открывают уровни, снаряжение, дропы, деньги — по профилю игрока.
import { SLAYER_INFO, SLAYER_UNLOCKS, SLAYER_RNG, SLAYER_COST, SLAYER_BOSS_XP, SLAYER_MAX_TIER } from './combat/data.js';
import { fmtCoins, plural, num, priceText, method, methodText, sortNext, nice, priceOfDrop } from './combat/util.js';
import { slayerPlan, VERDICT_RU, LACK_RU, secText, DAGGER_PAIRS } from '../calc/slayer-ready.js';
import { pieceDetail, upgradeHints } from '../calc/kit-detail.js';
import { SLAYER_BOSSES } from '../calc/slayer-bosses.js';
import { activePerks } from '../calendar/index.js';
import { tx } from '../../i18n/msg.js';

const TONE = { proven: 'good', easy: 'good', ok: 'warn', hard: 'bad', no: 'bad', 'no-weapon': 'bad' };
const shortNum = n => (n >= 1e6 ? tx`${String(Math.round(n / 1e5) / 10).replace('.', ',')} млн` : n >= 1e3 ? tx`${Math.round(n / 1e3)} тыс.` : String(n));

const LACK_SHORT = { damage: 'урон', survive: 'живучесть' };
const lackText = l => (l?.length ? l.map(x => LACK_SHORT[x]).join(' и ') : '');

/** Какой набор показать для тира: тиры ниже фарма — тем же набором; сохранённый набор, если он почти не хуже */
function pickKit(plan, t) {
  const farm = plan.farm;
  const src = farm && t.verdict === 'proven' && t.tier < farm.tier && farm.best ? farm : t;
  const b = src.best || t.hypo?.best;
  const sv = src.best ? src.saved?.[0] : null;
  const useSaved = sv?.loadout?.name && b && sv.f.ttk <= b.f.ttk * 1.25 && sv.verdict === b.verdict;
  return { c: useSaved ? sv : b, saved: useSaved ? sv.loadout.name : null };
}
const setText = (c, saved) => (saved ? tx`набор «${saved}»${c.armor?.set ? tx` (${c.armor.set})` : ''}` : tx`${c.armor?.label || '—'}${c.armor?.set ? tx` (${c.armor.set})` : ''}`);

/** Строки таблицы «Что надеть»: для каждого тира — оценка, лучший набор из твоих вещей и что подтянуть */
function wearRows(plan, ctx) {
  return plan.tiers.map(t => {
    const { c, saved } = pickKit(plan, t);
    if (!c) return [tx`T${t.tier}`, { text: VERDICT_RU[t.verdict] || t.verdict, tone: TONE[t.verdict] || 'muted' }, '—', '—', '—', '—'];
    if (t.verdict === 'no-weapon' && t.hypo) {
      const h = t.hypo, p = h.pair;
      const cost = p.ids.reduce((n, id) => n + (ctx.price(id) || 0), 0);
      return [tx`T${t.tier}`,
        { text: tx`нет кинжала · с ним: ${VERDICT_RU[h.verdict] || h.verdict}`, tone: TONE[h.verdict] || 'muted' },
        setText(c, saved),
        { text: tx`${p.names} (Blaze ${p.level})`, item: p.ids[0] },
        c.pet?.pet ? c.pet.label : 'без питомца',
        tx`сначала кинжалы${cost ? tx`: ~${fmtCoins(cost)} за пару` : ''}${h.lack ? tx`, потом ${lackText(h.lack)}` : ''}`];
    }
    const time = t.verdict === 'proven' || t.ratio ? '' : tx` · ~${secText(c.f.ttk)}`;
    const verdict = { text: tx`${VERDICT_RU[t.verdict] || t.verdict}${time}`, tone: TONE[t.verdict] || 'muted' };
    const need = t.lack ? lackText(t.lack) : t.verdict === 'proven' ? '—' : 'хватает';
    return [tx`T${t.tier}`, verdict, setText(c, saved), { text: c.weapon.name, item: c.weapon.id }, c.pet?.pet ? c.pet.label : 'без питомца', need];
  });
}

/** Секции «по частям»: каждая часть набора для тира, который стоит фармить или пробовать, и что улучшить дешевле всего */
function kitSections(plan, key, ctx) {
  const t = plan.next && plan.next.open !== false && (plan.next.best || plan.next.hypo) ? plan.next : plan.farm || plan.tiers[0];
  if (!t) return [];
  const { c, saved } = pickKit(plan, t);
  if (!c?.armor) return [];
  const items = (c.armor.items || []).map(it => pieceDetail(it, 'armor')).filter(Boolean)
    .map(d => ({ title: tx`${d.slot ? d.slot[0].toUpperCase() + d.slot.slice(1) + ': ' : ''}${d.name}`, items: [d.id], text: d.text }));
  const w = c.weapon?.hypo ? null : pieceDetail(c.weapon?.item, 'weapon');
  if (w) items.push({ title: tx`Оружие: ${w.name}`, items: [w.id], text: w.text });
  else if (c.weapon?.hypo) items.push({ title: tx`Оружие: ${c.weapon.name}`, items: [c.weapon.id], text: 'пока нет: расчёт сделан так, будто пара уже есть' });
  if (c.equip && c.equip.key !== 'none') items.push({ title: tx`Снаряжение: ${c.equip.label}`, items: (c.equip.items || []).filter(i => i?.id).map(i => i.id).slice(0, 4) });
  if (c.pet?.pet) items.push({ title: tx`Питомец: ${c.pet.label}`, items: [] });
  const lack = t.lack || t.hypo?.lack;
  const hints = upgradeHints(c, { types: SLAYER_BOSSES[key]?.types, lack, price: id => ctx.price(id), fmt: fmtCoins });
  const f = c.f;
  const note = tx`${saved ? tx`Твой сохранённый набор «${saved}». ` : ''}По расчёту: удар ~${num(f.avg)}, урон в секунду ~${num(f.dps)}, Health ${num(f.health)}, EHP ~${num(Math.round(f.ehp))}.`;
  return [
    { kind: 'steps', title: tx`Набор под T${t.tier} по частям`, note, items },
    { kind: 'steps', title: 'Что улучшить в первую очередь', note: lack ? tx`Для T${t.tier} ${lack.map(x => LACK_RU[x]).join('; ')}.` : 'От дешёвого к дорогому, по твоим вещам из набора выше.', items: hints.map(h => ({ title: h })) },
  ].filter(sec => sec.items.length);
}

/** Blaze: путь к кинжалам — что, с какого уровня, из чего крафт и сколько стоит */
function daggerSection(m, ctx) {
  const lvl = m.slayers?.blaze?.level || 0;
  return { kind: 'steps', title: 'Кинжалы по тирам', note: 'С T2 урон проходит только кинжалами с нужной Attunement, поэтому нужна пара: одна закрывает Ashen и Auric, другая — Spirit и Crystal.',
    items: DAGGER_PAIRS.map((p, i) => {
      const own = p.ids.filter(id => ctx.has(id)).length;
      const cost = p.ids.reduce((n, id) => n + (ctx.price(id) || 0), 0);
      return { title: tx`T${i + 2}: ${p.names} — с Blaze ${p.level}`, items: p.ids, done: own === 2, current: own < 2 && lvl >= p.level,
        text: [tx`Крафт: ${p.craft}.`, tx`${cost ? tx`На Auction House ~${fmtCoins(cost)} за пару. ` : ''}${own === 2 ? 'Обе уже есть.' : own ? 'Одна уже есть.' : lvl < p.level ? tx`Откроется на ${p.level} уровне, сейчас ${lvl}.` : 'Уже можно брать.'}`] };
    }) };
}

export const SLAYER_ORDER = ['zombie', 'spider', 'wolf', 'enderman', 'blaze', 'vampire'];
// Что нужно пройти, чтобы открыть босса (вики, страница Slayer)
const PREREQ = { spider: ['zombie', 2], wolf: ['spider', 2], enderman: ['wolf', 4], blaze: ['enderman', 3], vampire: ['wolf', 2] };
// Минимальный уровень этого слеера для тира (известные требования)
const TIER_LEVEL = { zombie: { 5: 7 }, spider: { 5: 7 } };

const kills = sl => sl?.kills || {};
const maxKilledTier = sl => Math.max(0, ...Object.entries(kills(sl)).filter(([, k]) => k > 0).map(([t]) => Number(t)));

function prereqDone(m, key) {
  const p = PREREQ[key];
  if (!p) return true;
  const [other, tier] = p;
  return maxKilledTier(m.slayers?.[other]) >= tier;
}

export function build(key, m, ctx) {
  const ctxName = id => nice(ctx, id);
  const info = SLAYER_INFO[key];
  const sl = m.slayers?.[key] || { level: 0, maxLevel: 9, xp: 0, kills: {} };
  const vamp = key === 'vampire';
  const cur = vamp ? 'Motes' : 'монет';
  const costs = SLAYER_COST[key] || SLAYER_COST.default;
  const bossXp = SLAYER_BOSS_XP[key] || SLAYER_BOSS_XP.default;
  const maxTier = SLAYER_MAX_TIER[key];
  const lvl = sl.level || 0;
  const maxLvl = sl.maxLevel || 9;
  const top = maxKilledTier(sl);
  const tierAllowed = t => (TIER_LEVEL[key]?.[t] || 0) <= lvl && t <= Math.min(maxTier, top + 1);
  // Тир для фарма: самый высокий пройденный; если следующий уже разрешён и уровень позволяет — предлагаем попробовать
  const farm = Math.max(1, top);
  const tryNext = top > 0 && top < maxTier && tierAllowed(top + 1) ? top + 1 : null;
  const left = sl.xpForNext ? Math.max(0, sl.xpForNext - (sl.xp || 0)) : 0;
  const bosses = left ? Math.ceil(left / bossXp[farm - 1]) : 0;
  const questCost = bosses * costs[farm - 1];
  const unlocked = prereqDone(m, key);
  const nextUnlocks = SLAYER_UNLOCKS[key]?.[lvl + 1] || [];
  const next = [];
  let plan = null;
  if (!vamp) { try { plan = slayerPlan(m, key, typeof ctx.adv?.kit === 'function' ? ctx.adv.kit() : null, bossXp); } catch { plan = null; } }

  if (!unlocked && lvl === 0) {
    const [o, t] = PREREQ[key];
    next.push({ priority: 85, title: tx`Сначала открой босса: пройди ${SLAYER_INFO[o].title} T${t}`, why: info.unlock });
  } else if (lvl === 0 && top === 0) {
    next.push({ priority: 88, title: tx`Начни ${info.title}: квест T1 у ${vamp ? 'NPC в Stillgore Château' : 'Maddox the Slayer (Hub или Maddox Batphone)'}`,
      why: tx`Квест стоит ${num(costs[0])} ${cur}, первый уровень — ${num(left)} опыта (${Math.ceil(left / bossXp[0])} ${plural(Math.ceil(left / bossXp[0]), 'босс', 'босса', 'боссов')} T1). Где: ${info.where}.${nextUnlocks.length ? tx` Уровень 1 откроет: ${nextUnlocks.map(ctxName).join(', ')}.` : ''}` });
  }
  if (left > 0 && (unlocked || lvl > 0) && !(lvl === 0 && top === 0)) {
    next.push({ priority: 75, title: tx`${info.ru} ${lvl} → ${lvl + 1}: ~${num(bosses)} ${plural(bosses, 'босс', 'босса', 'боссов')} T${farm}`,
      why: tx`Осталось ${num(left)} опыта слеера (T${farm} даёт ${bossXp[farm - 1]}).${nextUnlocks.length ? tx` Откроет: ${nextUnlocks.map(ctxName).join(', ')}.` : ''} Квесты: ~${vamp ? num(questCost) + ' Motes' : fmtCoins(questCost)}` });
  }
  const nx = plan?.tiers?.[tryNext - 1];
  if (tryNext && nx && (nx.verdict === 'hard' || nx.verdict === 'no')) {
    const r = nx.ratio;
    next.push({ priority: 45, title: tx`T${tryNext} по твоим статам: ${VERDICT_RU[nx.verdict]}`,
      why: r ? tx`Бой примерно в ${Math.max(1, Math.round(r.ttk))} раз дольше, чем на T${r.vs}, а продержишься в ${Math.max(1, Math.round(1 / Math.max(r.survive, 0.01)))} раз меньше. Подтяни урон и живучесть: таблица «Что надеть» ниже.` : 'Подтяни урон и живучесть: таблица «Что надеть» ниже.' });
  } else if (tryNext && nx?.verdict !== 'no-weapon') {
    const mult = bossXp[tryNext - 1] / bossXp[farm - 1];
    const mech = info.tiers[tryNext - 1]?.mech;
    next.push({ priority: 70, title: tx`Пробуй T${tryNext}: в ${Number.isInteger(mult) ? mult : mult.toFixed(1).replace('.', ',')} раза больше опыта за босса`,
      why: tx`Ты проходишь T${top} (${num(kills(sl)[top] || 0)} ${plural(kills(sl)[top] || 0, 'победа', 'победы', 'побед')}).${(sl.attempts?.[tryNext] || 0) > 0 ? tx` На T${tryNext} уже ${sl.attempts[tryNext]} ${plural(sl.attempts[tryNext], 'попытка', 'попытки', 'попыток')} без победы: сначала подтяни урон и защиту.` : ''}${mech && !/^(Сильнее|Высший|Первый)/.test(mech) ? tx` На T${tryNext}: ${mech}.` : ''}` });
  }
  for (const [L, ids] of Object.entries(SLAYER_UNLOCKS[key] || {})) {
    if (Number(L) > lvl) continue;
    const want = ids.filter(id => !ctx.has(id) && ctx.price(id) > 0 && /SWORD|KATANA|DAGGER|BOW|HELMET|CHESTPLATE|SCYTHE|AXE|TERMINATOR|STING|FOIL|SHORTBOW/.test(id));
    if (want.length && Number(L) >= lvl - 2) {
      next.push({ priority: 40 + Number(L), title: tx`Уже открыто ${L} уровнем: ${want.slice(0, 2).map(ctxName).join(', ')}`, why: tx`Цена на рынке: ${want.slice(0, 2).map(id => tx`${ctxName(id)} ${priceText(ctx, id)}`).join(', ')}.` });
    }
  }
  if (key === 'blaze' && lvl < 2) {
    next.push({ priority: 72, title: 'На 2 уровне возьми Firedust и Twilight Dagger', why: 'С T2 у босса щит Hellion Shield: без кинжала с нужной Attunement урон режется на 99%. Firedust закрывает Ashen и Auric, Twilight — Spirit и Crystal, поэтому нужны оба. Крафт: Firedust — 30 Silver Magmafish и 1 Molten Powder, Twilight — 5 Enchanted Sulphur и 1 Molten Powder, или купи на Auction House.' });
  }
  let perks = [];
  try { perks = activePerks(); } catch { perks = []; }
  if (!vamp && left > 0 && perks.includes('Slayer XP Buff')) next.push({ priority: 74, title: 'Сейчас мэр Aatrox: +25% опыта слееров', why: 'Перк Slayer XP Buff действует до смены мэра. Самое время закрыть побольше квестов.' });

  // Таблица тиров
  const tierRows = info.tiers.map((t, i) => {
    const T = i + 1;
    const k = kills(sl)[T] || 0;
    const hp = t.hp && t.hp !== '—' ? t.hp : SLAYER_BOSSES[key]?.tiers?.[i]?.hp ? shortNum(SLAYER_BOSSES[key].tiers[i].hp) : '—';
    return [tx`T${T}`, hp, t.mech, vamp ? tx`${num(costs[i])} Motes` : fmtCoins(costs[i]), String(bossXp[i]), k ? { text: num(k), tone: 'good' } : { text: '0', tone: 'muted' }];
  });

  // Уровни и что они открывают
  const xpTable = ctx.adv?.data?.slayerXp?.[key] || [];
  const levelRows = [];
  for (let L = 1; L <= maxLvl; L++) {
    const ids = SLAYER_UNLOCKS[key]?.[L] || [];
    const got = L <= lvl;
    levelRows.push([
      got ? { text: tx`${L} ✓`, tone: 'good' } : String(L),
      xpTable[L - 1] != null ? num(xpTable[L - 1]) : '—',
      ids.length ? ids.map(id => tx`${ctxName(id)}${ctx.has(id) ? ' (есть)' : ''}`).join(', ') : 'постоянные статы',
    ]);
  }

  const drops = (SLAYER_RNG[key] || []).map(id => ({ id, p: priceOfDrop(ctx, id) })).sort((a, b) => b.p - a.p);
  const dropRows = drops.map(d => [{ text: nice(ctx, d.id), item: d.id }, d.p ? fmtCoins(d.p) : '—']);

  const mt = method(ctx, tx`slayer-${key}`);
  const status = lvl >= maxLvl ? 'done' : lvl === 0 && top === 0 ? (unlocked ? 'start' : 'locked') : 'progress';
  return {
    summary: tx`${info.title}: уровень ${lvl} из ${maxLvl}${top ? tx`, лучший тир T${top}` : ''}${left ? tx`, до следующего ${num(left)} опыта` : ''}.`,
    status,
    level: { label: tx`${info.ru}-слеер`, value: lvl, max: maxLvl },
    next: sortNext(next),
    sections: [
      { kind: 'text', title: 'Где и как', text: [tx`Где: ${info.where}.`, tx`Открытие: ${info.unlock}.`, vamp ? 'Квесты оплачиваются Motes (валюта Рифта).' : 'Квест берётся у Maddox the Slayer в Hub или по Maddox Batphone (открывается Wolf Slayer 3).'] },
      { kind: 'table', title: 'Тиры босса', note: 'HP и механики — по вики; опыт и цена квеста — по данным NEU.', columns: ['Тир', 'HP', 'Механика', 'Квест', 'Опыт', 'Твои убийства'], rows: tierRows, current: farm - 1 },
      ...(plan ? [{ kind: 'table', news: 'wear', title: 'Что надеть: твои вещи под каждый тир', note: 'Подобрано из твоих сетов в Wardrobe, наборов снаряжения, питомцев и оружия ближнего боя. Если твой сохранённый набор почти не хуже — показан он. Расчёт примерный: без зелий, лечения и большинства сетовых бонусов, поэтому тир, где у тебя уже есть победы, — «уже проходишь».', columns: ['Тир', 'Оценка', 'Броня', 'Оружие', 'Питомец', 'Что подтянуть'], rows: wearRows(plan, ctx), current: Math.max(0, (plan.farm?.tier || 1) - 1) }, ...kitSections(plan, key, ctx)] : []),
      ...(key === 'blaze' ? [daggerSection(m, ctx)] : []),
      { kind: 'steps', title: 'Снаряжение', items: info.gear.map(g => ({ title: g })) },
      { kind: 'table', title: 'Что открывают уровни', note: 'Опыт — сколько всего нужно набрать для уровня.', columns: ['Уровень', 'Опыт', 'Открывает'], rows: levelRows, current: Math.min(lvl, maxLvl - 1) },
      { kind: 'table', title: 'Редкие дропы', note: 'Дропы RNG-метра, отсортированы по текущей цене. Чем выше тир, тем выше шанс.', columns: ['Предмет', 'Цена'], rows: dropRows },
      { kind: 'text', title: 'Деньги', text: [info.money, methodText(mt)].filter(Boolean) },
    ],
  };
}

export default SLAYER_ORDER.map(key => ({
  id: tx`slayer-${key}`, title: tx`${SLAYER_INFO[key].title} (${SLAYER_INFO[key].ru})`, icon: SLAYER_INFO[key].icon, group: 'combat',
  build: (m, ctx) => build(key, m, ctx),
}));
