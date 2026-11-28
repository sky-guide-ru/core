// Frozen Corpses в Glacite Mineshafts: типы трупов, вехи Grandpa Wolf (Frozen Corpse Milestones) и RNG Meter.
// Источник: hypixelskyblock.minecraft.wiki — страницы «Frozen Corpses» и «Grandpa Wolf» (сверено 28.11.2026,
// вехи и RNG Meter добавлены в 0.24.2, февраль 2026). Прогресс игрока — glacite_player_data.corpses_looted из API.
// Забрал ли игрок награду, API не говорит: судим по Organ Donor в Accessory Bag и сундуках.
import { fmt, short, hasItem, cell } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

/** Типы трупов: ключ, Glacite Powder и опыт HotM за труп, очки RNG Meter, число бросков лута. */
export const CORPSE_TYPES = [
  { k: 'lapis', name: 'Lapis', key: null, powder: [1000, 2000], hotm: 100, meter: 500, rolls: [3, 6], spawn: 0.5 },
  { k: 'umber', name: 'Umber', key: 'UMBER_KEY', powder: [5000, 10000], hotm: 1000, meter: 2500, rolls: [4, 7], spawn: 0.25 },
  { k: 'tungsten', name: 'Tungsten', key: 'TUNGSTEN_KEY', powder: [5000, 10000], hotm: 1000, meter: 2500, rolls: [4, 7], spawn: 0.25 },
  { k: 'vanguard', name: 'Vanguard', key: 'SKELETON_KEY', powder: [25000, 50000], hotm: 5000, meter: 25000, rolls: [5, 8], fairy: true },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const EXTRA_CORPSE = '+10% шанс на лишний Frozen Corpse в Mineshaft';
const EXTRA_ITEM = '+10% шанс на лишний предмет с Frozen Corpse';

/** Вехи: сколько трупов каждого типа нужно всего (не за веху) и награда. */
export const MILESTONES = [
  { need: { lapis: 10, umber: 0, tungsten: 0, vanguard: 0 }, powder: 10_000, meter: 1_000, sbxp: 5, reward: 'Organ Donor Talisman', item: 'ORGAN_DONOR_TALISMAN' },
  { need: { lapis: 25, umber: 1, tungsten: 1, vanguard: 0 }, powder: 25_000, meter: 2_500, sbxp: 10, reward: EXTRA_CORPSE },
  { need: { lapis: 50, umber: 5, tungsten: 5, vanguard: 0 }, powder: 50_000, meter: 5_000, sbxp: 15, reward: EXTRA_ITEM },
  { need: { lapis: 100, umber: 10, tungsten: 10, vanguard: 1 }, powder: 75_000, meter: 10_000, sbxp: 20, reward: 'Organ Donor Ring', item: 'ORGAN_DONOR_RING' },
  { need: { lapis: 250, umber: 25, tungsten: 25, vanguard: 5 }, powder: 100_000, meter: 25_000, sbxp: 25, reward: EXTRA_CORPSE },
  { need: { lapis: 500, umber: 50, tungsten: 50, vanguard: 10 }, powder: 150_000, meter: 50_000, sbxp: 30, reward: EXTRA_ITEM },
  { need: { lapis: 1000, umber: 100, tungsten: 100, vanguard: 20 }, powder: 200_000, meter: 100_000, sbxp: 35, reward: 'Organ Donor Artifact', item: 'ORGAN_DONOR_ARTIFACT' },
].map((m, i) => ({ ...m, n: i + 1, roman: ROMAN[i] }));

/** Цели RNG Meter и сколько очков нужно до гарантии. */
export const RNG_METER = [
  ['DEAD_MANS_CHESTPLATE', 12_000],
  ...['ONYX', 'CITRINE', 'PERIDOT', 'AQUAMARINE'].map(g => [tx`FLAWLESS_${g}_GEM`, 60_000]),
  ['REFINED_UMBER', 60_000], ['REFINED_TUNGSTEN', 60_000], ['GLACITE_AMALGAMATION', 60_000], ['ENCHANTMENT_ICE_COLD_1', 60_000], ['GOBLIN_EGG_BLUE', 60_000],
  ...['OPAL', 'ONYX', 'PERIDOT', 'AQUAMARINE', 'CITRINE'].map(g => [tx`${g}_CRYSTAL`, 75_000]),
  ['DWARVEN_OS_METALLIC_MINIS', 75_000], ['UMBER_KEY', 100_000], ['TUNGSTEN_KEY', 100_000], ['MITHRIL_PLATE', 150_000],
  ['UMBER_PLATE', 300_000], ['TUNGSTEN_PLATE', 300_000], ['FROZEN_SCUTE', 750_000], ['CAGED_WISP', 1_250_000],
  ['SKELETON_KEY', 1_250_000], ['SHATTERED_PENDANT', 2_500_000], ['DYE_FROSTBITTEN', 5_000_000],
].map(([id, xp]) => ({ id, xp }));

const ORGAN = ['ORGAN_DONOR_TALISMAN', 'ORGAN_DONOR_RING', 'ORGAN_DONOR_ARTIFACT'];
/** Перки HotM, которые дают то же, что вехи, только сильнее. */
const CORPSE_PERKS = ['gifts_from_the_departed', 'dead_mans_chest'];
const num = v => Number(v) || 0;

/** Какая веха пройдена и чего не хватает до следующей. */
export function milestoneState(corpses = {}) {
  const have = Object.fromEntries(CORPSE_TYPES.map(t => [t.k, num(corpses[t.k])]));
  let done = 0;
  for (const m of MILESTONES) {
    if (CORPSE_TYPES.every(t => have[t.k] >= m.need[t.k])) done = m.n; else break;
  }
  const next = MILESTONES[done] || null;
  const missing = next ? CORPSE_TYPES.map(t => ({ ...t, have: have[t.k], need: next.need[t.k], left: Math.max(0, next.need[t.k] - have[t.k]) })).filter(x => x.left > 0) : [];
  return { have, done, next, missing };
}

/** Сколько монет стоят недостающие ключи (без цены — null). */
function keysCost(ctx, missing) {
  let sum = 0;
  for (const x of missing) {
    if (!x.key) continue;
    const p = ctx.price(x.key);
    if (!p) return null;
    sum += p * x.left;
  }
  return sum;
}

/** Какая награда за веху реально не забрана: веха пройдена, а Organ Donor этого уровня или выше нигде нет. */
function unclaimedOrgan(ctx, done) {
  const tiers = [1, 4, 7];
  let best = -1;
  ORGAN.forEach((id, i) => { if (hasItem(ctx, id)) best = i; });
  for (let i = tiers.length - 1; i >= 0; i--) if (done >= tiers[i] && best < i) return MILESTONES[tiers[i] - 1];
  return null;
}

/**
 * Шаги и секции про трупы для гайда Mining.
 * @param {Object} ctx  контекст гайда
 * @param {Object} o  { corpses, shafts, perks (treePerks), active: игрок уже в Glacite Tunnels }
 */
export function corpseGuide(ctx, { corpses = {}, shafts = 0, perks = [], active = false } = {}) {
  const st = milestoneState(corpses);
  const total = Object.values(st.have).reduce((s, v) => s + v, 0);
  const next = [];
  const sections = [];
  const market = ctx.adv?.market !== false;
  const liquid = num(ctx.adv?.liquid);

  // ---- Шаги ----
  if (active || total > 0) {
    const claim = unclaimedOrgan(ctx, st.done);
    if (claim) {
      next.push({
        title: tx`Забери награду за веху ${claim.roman} у Grandpa Wolf: ${claim.reward}`, priority: 57, item: claim.item,
        why: tx`Трупов уже хватает на веху ${ROMAN[st.done - 1]}, а ${claim.reward} не нашёлся ни в Accessory Bag, ни в сундуках. Награды не приходят сами: Grandpa Wolf сидит в своей пещере в Glacite Tunnels (-56 125 332), после первого разговора меню открывается командой /corpsemilestones. Заодно там лежат Glacite Powder и очки RNG Meter за вехи.`,
      });
    }
    if (st.next) {
      const m = st.next;
      const cost = market ? keysCost(ctx, st.missing) : null;
      const left = st.missing.map(x => tx`${x.name} ${fmt(x.have)}/${fmt(x.need)}`).join(', ');
      const tips = [];
      const weak = perks.filter(p => CORPSE_PERKS.includes(p.id) && p.level < p.max);
      if (m.n >= 2 && weak.length) tips.push(tx`Сначала докачай в HotM ${weak.map(p => tx`${p.name} ${p.level}/${p.max}`).join(' и ')}: они дают то же, что вехи, только сильнее (до +20% лишний предмет и до +25% лишний труп).`);
      if (st.missing.some(x => x.k === 'umber' || x.k === 'tungsten')) tips.push('Держи в инвентаре по одному Umber Key и Tungsten Key: какой труп будет в шахте, заранее неизвестно.');
      if (st.missing.some(x => x.k === 'vanguard')) tips.push('Vanguard бывает только в редкой шахте Fairy, поэтому Skeleton Key носи с собой, пока собираешь эту веху.');
      if (!market) tips.push('Без Bazaar ключи добываются из трупов: Umber и Tungsten Key падают с Lapis и металлических трупов, Skeleton Key — с Umber, Tungsten и Vanguard.');
      const costText = cost == null ? '' : cost > 0 ? tx` Ключи на неё стоят ~${short(cost)}.` : ' Ключи не нужны, только трупы Lapis.';
      let priority = m.n <= 3 ? 54 : m.n === 4 ? 46 : 40;
      let later = false;
      if (cost != null && liquid > 0 && cost > liquid / 3) { priority -= 14; later = true; }
      next.push({
        title: tx`${later ? 'На потом: ' : ''}Frozen Corpse Milestone ${m.roman} — ${left}`, priority,
        why: tx`Награда: ${m.reward}, ${fmt(m.powder)} Glacite Powder и ${fmt(m.meter)} очков RNG Meter.${costText}${m.n <= 3 ? ' Самые выгодные вехи: постоянный бонус за немного ключей.' : ''}${later ? ' Ключи дороже трети денег, а награда — те же +10% и апгрейд талисмана: сначала то, что даёт больше.' : ''} ${tips.join(' ')}`.trim(),
      });
    }
  }

  // ---- Секция: вехи ----
  sections.push({
    kind: 'table', title: 'Frozen Corpse Milestones', news: 'corpses',
    note: tx`Вехи за открытые трупы в Glacite Mineshafts. NPC Grandpa Wolf сидит в своей пещере в Glacite Tunnels (-56 125 332): поговори с ним один раз, дальше меню открывается командой /corpsemilestones. Старые трупы засчитаны. Сейчас пройдено ${st.done} из 7${st.done ? '; награду забирают в меню сами' : ''}. За каждую веху ещё очки RNG Meter и SkyBlock XP. Organ Donor звенит рядом с неоткрытым трупом и даёт Cold Resistance.`,
    columns: ['Веха', 'Lapis', 'Umber', 'Tungsten', 'Vanguard', 'Награда'],
    current: st.next ? st.next.n - 1 : undefined,
    rows: MILESTONES.map(m => {
      const passed = m.n <= st.done, isNext = st.next?.n === m.n;
      const need = t => {
        const n = m.need[t.k];
        if (!n) return cell('—', { tone: 'muted' });
        if (passed) return cell(fmt(n), { tone: 'good' });
        if (isNext) return cell(tx`${fmt(Math.min(st.have[t.k], n))}/${fmt(n)}`, { tone: st.have[t.k] >= n ? 'good' : 'warn' });
        return fmt(n);
      };
      const reward = tx`${m.reward} · ${short(m.powder)} Powder`;
      return [cell(passed ? tx`✓ ${m.roman}` : m.roman, passed ? { tone: 'good' } : {}), ...CORPSE_TYPES.map(need), m.item ? cell(reward, { item: m.item }) : reward];
    }),
  });

  // ---- Секция: типы трупов ----
  sections.push({
    kind: 'table', title: 'Glacite Tunnels и Mineshafts',
    note: tx`Входов в Mineshaft: ${fmt(shafts)}. В шахте 2–4 трупа (в шахте Fairy — один Vanguard). Шанс лишнего трупа растёт с перком Dead Man’s Chest и вехами II и V, лишнего предмета — с Gifts from the Departed и вехами III и VI.`,
    columns: ['Frozen Corpse', 'Залутано', 'Нужен ключ', 'Glacite Powder', 'RNG Meter'],
    rows: CORPSE_TYPES.map(t => [
      t.name,
      cell(fmt(st.have[t.k]), { tone: st.have[t.k] ? 'good' : 'muted' }),
      t.key ? cell(ctx.name(t.key), { item: t.key }) : 'не нужен',
      tx`${fmt(t.powder[0])}–${fmt(t.powder[1])}`,
      fmt(t.meter),
    ]),
  });

  // ---- Секция: RNG Meter ----
  const perCorpse = 2500; // очки за труп Umber/Tungsten — основной фарм
  const rows = RNG_METER.map(r => {
    const corpsesN = Math.ceil(r.xp / perCorpse);
    const price = market ? ctx.price(r.id) : 0;
    return { ...r, corpsesN, price, per: price ? price / corpsesN : 0 };
  });
  const sellable = rows.filter(r => r.per > 0).sort((a, b) => b.per - a.per);
  const best = sellable[0];
  const shown = [...sellable.slice(0, 6), rows.find(r => r.id === 'SHATTERED_PENDANT')].filter(Boolean);
  sections.push({
    kind: 'table', title: 'Frozen Corpse RNG Meter',
    note: tx`Каждый труп копит очки на выбранный предмет: Lapis 500, Umber и Tungsten 2 500, Vanguard 25 000. Чем больше очков, тем выше шанс, а при полной шкале предмет гарантирован. Цель выбирают в /corpsemilestones → RNG Meter.${best ? tx` Выгоднее всего сейчас ${ctx.name(best.id)}: ~${short(best.per)} с трупа Umber или Tungsten.` : ''} Совет: гем-кристаллы держи в инвентаре и не трать — пока они у тебя, они не выпадают, и у ключей, Plate и Caged Wisp шанс выше.`,
    columns: market ? ['Цель', 'Очков', '≈ трупов Umber/Tungsten', 'Цена', 'Монет с трупа'] : ['Цель', 'Очков', '≈ трупов Umber/Tungsten'],
    rows: (market ? shown : rows.filter(r => r.xp >= 300_000)).map(r => [
      cell(ctx.name(r.id), { item: r.id }), fmt(r.xp), fmt(r.corpsesN),
      ...(market ? [r.price ? short(r.price) : cell('не продаётся', { tone: 'muted' }), r.per ? cell(short(r.per), r === best ? { tone: 'good' } : {}) : cell('—', { tone: 'muted' })] : []),
    ]),
  });

  return { state: st, total, next, sections };
}
