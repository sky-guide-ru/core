// Гайд «Trophy Fish»: механика (условия, шансы, тиры, гарантия), твой Trophy Fish Chance,
// счётчик по тирам и личный план до алмаза у всех 18 видов — от самого быстрого шага к самому долгому.
import { TROPHY_FISH, TIERS, TIER_RU, TROPHY_RANKS, armorIds, trophyTierCounts } from './fishing-data.js';
import { TROPHY_INFO, TIER_ROLL, CHARM_PER_LVL, PERK_PER_LVL, PITY, TFC_CAP, SPOTS, TFC_SOURCES, ASSUME } from './trophy-data.js';
import { fmtCoins, fmtNum } from '../advisor/lib/util.js';
import { tx } from '../../i18n/msg.js';
import { isEn } from '../../i18n/lang.js';

const PIECES = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const pct = (p, d = 1) => tx`${String(+(p * 100).toFixed(p < 0.01 ? 2 : d)).replace('.', ',')}%`;
const fishId = (key, tier = 'bronze') => tx`${key.toUpperCase()}_${tier.toUpperCase()}`;

// ---------- шансы тиров ----------
/**
 * Доли тиров за один улов вида с учётом Charm (уровень 0–6) и перков Essence Shop:
 * Midas Lure (Gold, 0–10) и Radiant Fisher (Diamond, 0–10) дают +2% за уровень к броску своего тира, множатся с Charm.
 */
export function tierOdds(charm = 0, { midas = 0, radiant = 0 } = {}) {
  const k = 1 + CHARM_PER_LVL * charm;
  const d = TIER_ROLL.diamond * k * (1 + PERK_PER_LVL * radiant), g = TIER_ROLL.gold * k * (1 + PERK_PER_LVL * midas), s = TIER_ROLL.silver * k;
  const exact = { diamond: d, gold: (1 - d) * g, silver: (1 - d) * (1 - g) * s };
  exact.bronze = 1 - exact.diamond - exact.gold - exact.silver;
  const atLeast = { bronze: 1, silver: 1 - exact.bronze, gold: exact.diamond + exact.gold, diamond: exact.diamond };
  return { exact, atLeast };
}

/** Сколько ещё уловов этого вида в среднем до события с шансом p, если N-й улов (всего) гарантирован. */
export function expectedCatches(p, total = 0, pityAt = null) {
  if (!pityAt) return 1 / p;
  const left = Math.max(1, pityAt - total);
  return (1 - (1 - p) ** left) / p;
}

// ---------- Trophy Fish Chance по профилю ----------
function petOf(m, type) {
  const R = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
  return (m.pets || []).filter(p => p.type === type).sort((a, b) => R.indexOf(b.tier) - R.indexOf(a.tier) || (b.level || 0) - (a.level || 0))[0] || null;
}

export function trophyChance(m, ctx) {
  const parts = [];
  const unknown = [];
  const rods = Object.entries(TFC_SOURCES.rods).filter(([id]) => ctx.has(id) && id !== 'STARTER_LAVA_ROD');
  const rod = rods.sort((a, b) => b[1] - a[1])[0] || (ctx.has('STARTER_LAVA_ROD') ? ['STARTER_LAVA_ROD', 5] : null);
  let charm = 0;
  if (rod) {
    parts.push({ label: 'Удочка', what: rod[0], value: rod[1] });
    charm = Math.max(0, ...(ctx.owned.get(rod[0]) || []).map(it => Number(it.enchants?.charm || 0)));
  }
  // Hunter Armor: берём сет, который даёт больше (по числу частей, что у тебя есть)
  let hunter = null;
  for (const [set, bonus] of Object.entries(TFC_SOURCES.hunter)) {
    const n = PIECES.filter(p => ctx.has(`${set}_${p}`)).length;
    if (n && (!hunter || bonus[n - 1] >= hunter.value)) hunter = { set, n, value: bonus[n - 1] };
  }
  if (hunter) parts.push({ label: tx`${hunter.set.replace('_HUNTER', '')[0]}${hunter.set.replace('_HUNTER', '').slice(1).toLowerCase()} Hunter Armor (${hunter.n}/4)`, what: tx`${hunter.set}_CHESTPLATE`, value: hunter.value });
  const tooth = Object.entries(TFC_SOURCES.teeth).filter(([id]) => ctx.has(id)).sort((a, b) => b[1] - a[1])[0];
  if (tooth) parts.push({ label: 'Зуб Odger', what: tooth[0], value: tooth[1] });
  const kuudra = petOf(m, 'KUUDRA');
  if (kuudra && TFC_SOURCES.kuudraPet[kuudra.tier]) parts.push({ label: tx`Питомец Kuudra (${kuudra.tier})`, what: tx`KUUDRA;${['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'].indexOf(kuudra.tier)}`, value: TFC_SOURCES.kuudraPet[kuudra.tier] });
  if (ctx.has('HOT_BAIT')) parts.push({ label: 'Hot Bait (если в Fishing Bag)', what: 'HOT_BAIT', value: TFC_SOURCES.hotBait });
  // Атрибут Trophy Hunter (осколки Fire Eel): +2 за уровень, 10-й уровень — 32 осколка (эпический)
  const attr = (m.extras?.attributes || []).find(a => /trophy_hunter/i.test(a.id));
  if (attr) {
    if (attr.n >= 32) parts.push({ label: 'Атрибут Trophy Hunter (10 ур.)', what: 'ATTRIBUTE_SHARD_TROPHY_HUNTER;1', value: 20 });
    else unknown.push(tx`атрибут Trophy Hunter: ${attr.n}/32 осколков Fire Eel (+2 за уровень, точный уровень по API не считаем)`);
  }
  unknown.push('Trophy Line на удочке (+5) API не показывает');
  const total = Math.min(TFC_CAP, parts.reduce((s, p) => s + p.value, 0));
  // Перки Essence Shop: уровни лежат в player_data.perks (0–10)
  const perkLvl = id => Math.max(0, Math.min(10, Number(m.perks?.[id] || 0)));
  const midas = perkLvl('midas_lure'), radiant = perkLvl('radiant_fisher');
  return { parts, total, charm, midas, radiant, rod: rod?.[0] || null, hunter, tooth: tooth?.[0] || null, kuudra, unknown };
}

// ---------- разбор пойманного ----------
function fishState(tf) {
  return TROPHY_FISH.map(f => {
    const tiers = Object.fromEntries(TIERS.map(t => [t, Number(tf[tx`${f.key}_${t}`] || 0)]));
    const total = Number(tf[f.key] || 0) || TIERS.reduce((s, t) => s + tiers[t], 0);
    const atLeast = Object.fromEntries(TIERS.map((t, i) => [t, TIERS.slice(i).some(x => tiers[x] > 0)]));
    return { ...f, ...TROPHY_INFO[f.key], tiers, total, atLeast };
  });
}

/** Шанс вида за улов (доля) с учётом Trophy Fish Chance; для Golden Fish — null (идёт по времени). */
const fishP = (f, tfc) => (f.golden ? null : Math.min(1, f.base * (1 + tfc / 100)));

/**
 * Что нужно до цели goal у вида: ожидаемые уловы этого вида, затем всего уловов и часы.
 * goal: 'bronze' | 'silver' | 'gold' | 'master'
 */
function effort(f, goal, odds, tfc, opts = {}) {
  let need = 0;
  if (goal === 'bronze') need = f.atLeast.bronze ? 0 : 1;
  else if (goal === 'silver') need = f.atLeast.silver ? 0 : 1 / odds.atLeast.silver;
  else if (goal === 'gold') need = f.atLeast.gold ? 0 : expectedCatches(odds.atLeast.gold, f.total, PITY.gold);
  else {
    const parts = [];
    if (!f.tiers.bronze) parts.push(1 / odds.exact.bronze);
    if (!f.tiers.silver) parts.push(1 / odds.exact.silver);
    if (!f.tiers.gold) parts.push(expectedCatches(odds.exact.gold, f.total, PITY.gold));
    if (!f.tiers.diamond) parts.push(expectedCatches(odds.exact.diamond, f.total, PITY.diamond));
    need = parts.length ? Math.max(...parts) : 0;
  }
  if (!need) return null;
  if (f.golden) return { need, catches: null, hours: need / ASSUME.goldenPerHour, chain: null };
  const p = fishP(f, tfc);
  let catches = need / p;
  let chain = null;
  // Цепочка Obfuscated: каждая попытка съедает наживку предыдущего звена
  if (f.key === 'obfuscated_fish_2' || f.key === 'obfuscated_fish_3') {
    const p1 = fishP({ base: TROPHY_INFO.obfuscated_fish_1.base }, tfc);
    const p2 = fishP({ base: TROPHY_INFO.obfuscated_fish_2.base }, tfc);
    const obf2 = f.key === 'obfuscated_fish_3' ? catches : 0;
    const obf1 = f.key === 'obfuscated_fish_3' ? obf2 / p2 : catches;
    const corrupted = obf1 / p1;
    chain = { obf2: Math.ceil(obf2), obf1: Math.ceil(obf1), corrupted: Math.ceil(corrupted) };
    catches = obf2 + obf1 + corrupted;
  }
  const rate = f.slow ? ASSUME.slowCatchesPerHour * (opts.slugPet ? 2 : 1) : ASSUME.catchesPerHour;
  return { need, catches, hours: catches / rate, chain };
}

const hoursText = h => (h < 1 ? tx`~${Math.max(5, Math.round(h * 60 / 5) * 5)} мин` : h < 10 ? tx`~${h.toFixed(1).replace('.', ',')} ч` : tx`~${fmtNum(Math.round(h))} ч`);
// Буквы тиров в легенде: Б С З А по-русски, B S G D (Bronze, Silver, Gold, Diamond) — в английской версии
const TIER_EN_LETTER = { bronze: 'B', silver: 'S', gold: 'G', diamond: 'D' };
const tierLetter = t => (isEn() ? TIER_EN_LETTER[t] : TIER_RU[t][0].toUpperCase());
const tiersText = f => TIERS.map(t => `${tierLetter(t)}${f.tiers[t] ? '✓' : '·'}`).join(' ');

export const GOALS = [
  { goal: 'bronze', rank: null, title: 'Новые виды', why: 'каждый новый вид — шаг к Novice и обязательное условие всех рангов' },
  { goal: 'silver', rank: 1, title: 'Adept: серебро у всех 18', why: 'Silver Hunter Armor, Odger’s Silver Tooth, Silver Trophy Fishing Sack и Lord Jawbus' },
  { goal: 'gold', rank: 2, title: 'Expert: золото у всех 18', why: 'Gold Hunter Armor и Odger’s Gold Tooth' },
  { goal: 'master', rank: 3, title: 'Master: все 4 тира у всех 18', why: 'Diamond Hunter Armor, Odger’s Diamond Tooth и Diamond the Fish' },
];

/** Личный план: шаги по целям, внутри цели — от быстрого к долгому. */
export function trophyPlan(fish, tfcInfo, opts = {}) {
  const odds = tierOdds(tfcInfo.charm, tfcInfo);
  const steps = [];
  for (const g of GOALS) {
    const list = fish.map(f => ({ f, e: effort(f, g.goal, odds, tfcInfo.total, opts) })).filter(x => x.e);
    list.sort((a, b) => a.e.hours - b.e.hours);
    for (const { f, e } of list) steps.push({ goal: g.goal, goalTitle: g.title, key: f.key, name: f.name, spot: f.spot, ...e, fish: f });
  }
  return { steps, odds };
}

// ---------- сам гайд ----------
export default {
  id: 'trophy', title: 'Trophy Fish', icon: 'GOLDEN_FISH_DIAMOND', group: 'fishing',
  build(m, ctx) {
    const f = m.fishing || {};
    const tf = f.trophyFish || {};
    const counts = f.trophyTiers || trophyTierCounts(tf);
    const fish = fishState(tf);
    const tfc = trophyChance(m, ctx);
    const slugPet = !!petOf(m, 'SLUG');
    const { steps, odds } = trophyPlan(fish, tfc, { slugPet });
    const lvl = m.skills?.fishing?.level || 0;
    const name = id => ctx.name(id);
    const price = id => ctx.price(id);
    const rewards = Array.isArray(tf.rewards) ? tf.rewards.map(Number) : null;
    const rankHave = r => (r.need === 'diamond' ? fish.filter(x => TIERS.every(t => x.tiers[t] > 0)).length : fish.filter(x => x.atLeast[r.need]).length);
    const ranks = TROPHY_RANKS.map(r => ({ ...r, have: rankHave(r), ready: rankHave(r) >= r.count, claimed: rewards ? rewards.includes(r.n) : null }));
    const missing = fish.filter(x => !x.atLeast.bronze);

    // ---------- что делать дальше ----------
    const next = [];
    const novice = ranks[0];
    const ownsReward = (armor, tooth) => PIECES.some(p => ctx.has(`${armor}_${p}`)) || ctx.has(tooth);
    if (novice.ready && (novice.claimed === false || (novice.claimed == null && !ownsReward('BRONZE_HUNTER', 'ODGERS_BRONZE_TOOTH')))) {
      next.push({ title: 'Забери у Odger награды Novice Trophy Fisher', why: tx`Условие выполнено (${novice.have}/15 видов), а Bronze Hunter Armor и Odger’s Bronze Tooth в профиле не видно. Это бесплатные +5 Trophy Fish Chance за сет и +1 за зуб, плюс Bronze Trophy Fishing Sack.`, priority: 96, item: 'BRONZE_HUNTER_CHESTPLATE' });
    }
    for (const r of ranks.slice(1)) if (r.ready && r.claimed !== true) next.push({ title: tx`Забери награду «${r.name}» у Odger`, why: tx`Условие выполнено (${r.have}/${r.count}). ${r.reward}.`, priority: 95 });
    for (const x of missing) {
      const e = effort(x, 'bronze', odds, tfc.total, { slugPet });
      next.push({
        title: tx`Поймай ${x.name} — этого вида у тебя ещё нет`,
        why: tx`${x.cond}${e?.chain ? tx` В среднем это ~${fmtNum(e.chain.obf2 || 0)} Obfuscated 2 как наживки (их самих ~${fmtNum(e.chain.obf1)} уловов на Obfuscated 1).` : e ? tx` В среднем ~${fmtNum(Math.ceil(e.catches))} уловов (${hoursText(e.hours)}).` : ''}`,
        priority: 90 - (e?.hours || 0) / 100, item: fishId(x.key),
      });
    }
    const silverLeft = steps.filter(s => s.goal === 'silver');
    if (silverLeft.length) next.push({ title: tx`Adept: серебро ещё у ${silverLeft.length} ${silverLeft.length === 1 ? 'вида' : 'видов'}`, why: tx`Быстрее всего: ${silverLeft.slice(0, 4).map(s => tx`${s.name} (${s.spot})`).join(', ')}. Награда открывает Lord Jawbus.`, priority: 80 });
    if (tfc.rod && tfc.rod !== 'HELLFIRE_ROD' && lvl >= 35) next.push({ title: 'Hellfire Rod: +25 Trophy Fish Chance вместо +20', why: 'Каждый +1 к стату — это +1% ко всем видам сразу (кроме Golden Fish).', priority: 60, item: 'HELLFIRE_ROD' });
    if (tfc.charm < 5) next.push({ title: tx`Charm ${tfc.charm ? tx`${tfc.charm} → V` : 'V'} на лавовую удочку`, why: 'Charm поднимает шанс серебра, золота и алмаза на 2% за уровень (Charm V: алмаз 0,2% → 0,22%). Книги на Bazaar; Charm VI — из Chain of the End Times.', priority: 55 });
    if (tfc.radiant < 10 && fish.some(x => !x.tiers.diamond)) next.push({ title: tx`Radiant Fisher ${tfc.radiant ? tx`${tfc.radiant} → X` : 'X'} у Gemma (Crystal Nucleus)`, why: tx`Перк за Diamond Essence: +2% к шансу алмазного трофея за уровень, на X это +20%. Весь путь до X стоит 11 000 Diamond Essence.${tfc.midas < 10 ? ' Для золота так же работает Midas Lure у Marigold в Royal Mines (Gold Essence).' : ''}`, priority: 45, item: 'ESSENCE_DIAMOND' });
    if (!slugPet && fish.find(x => x.key === 'slugfish' && !x.tiers.diamond)) next.push({ title: 'Питомец Slug ускоряет Slugfish вдвое', why: 'С ним Slugfish ловится уже через 10 секунд после заброса, а не через 20.', priority: 40 });
    next.sort((a, b) => b.priority - a.priority);

    // ---------- секции ----------
    const sections = [];
    sections.push({
      kind: 'table', title: 'Счётчик по тирам',
      note: '«Именно этот тир» — виды, у которых пойман ровно этот тир (нужно для Master). «Этот или выше» — как считает Odger для Novice, Adept и Expert.',
      columns: ['Тир', 'Именно этот тир', 'Этот или выше', 'Чего не хватает'],
      rows: TIERS.map(t => [
        { text: TIER_RU[t][0].toUpperCase() + TIER_RU[t].slice(1), item: fishId('golden_fish', t) },
        { text: `${counts.tiers[t].exact}/18`, tone: counts.tiers[t].exact >= 18 ? 'good' : undefined },
        { text: `${counts.tiers[t].atLeast}/18`, tone: counts.tiers[t].atLeast >= 18 ? 'good' : undefined },
        fish.filter(x => !x.tiers[t]).map(x => x.name).join(', ') || { text: 'всё собрано', tone: 'good' },
      ]),
    });

    sections.push({
      kind: 'table', title: tx`Твой Trophy Fish Chance: ~${fmtNum(tfc.total)}`,
      note: tx`Стат умножает шанс каждого вида: итог = база × (1 + стат/100), предел ${TFC_CAP} (×2,5). Golden Fish он не касается. Посчитано по тому, что видно в профиле; ${tfc.unknown.join('; ')}.`,
      columns: ['Источник', 'Trophy Fish Chance', 'У тебя'],
      rows: [
        ...tfc.parts.map(p => [{ text: p.label, item: p.what }, tx`+${fmtNum(p.value)}`, { text: 'есть', tone: 'good' }]),
        ...[
          ['HELLFIRE_ROD', 'Hellfire Rod (вместо Inferno +20)', '+25', tfc.rod === 'HELLFIRE_ROD'],
          ['DIAMOND_HUNTER_CHESTPLATE', 'Hunter Armor: Bronze 5 / Silver 10 / Gold 20 / Diamond 30 за 4 части', 'до +30', tfc.hunter?.n === 4 && tfc.hunter.set === 'DIAMOND_HUNTER'],
          ['ODGERS_DIAMOND_TOOTH', 'Зуб Odger: Bronze 1 / Silver 2 / Gold 3 / Diamond 4', 'до +4', tfc.tooth === 'ODGERS_DIAMOND_TOOTH'],
          ['KUUDRA;3', 'Питомец Kuudra (Epic/Legendary)', '+20', ['EPIC', 'LEGENDARY'].includes(tfc.kuudra?.tier)],
          ['ATTRIBUTE_SHARD_TROPHY_HUNTER;1', 'Атрибут Trophy Hunter 10 (осколки Fire Eel)', '+20', false],
          ['TROPHY_LINE', 'Trophy Line (Roddy)', '+5', null],
          ['HOT_BAIT', 'Hot Bait', '+5', ctx.has('HOT_BAIT')],
          ['HOTSPOT_SINKER', 'Лавовый Хотспот с Trophy Fish Chance (+ Hotspot Sinker ещё +5)', '+5…+10', null],
        ].filter(([id]) => !tfc.parts.some(p => p.what === id)).map(([id, label, v, have]) => [{ text: label, item: id }, v, have ? { text: 'есть', tone: 'good' } : have === null ? { text: 'не видно', tone: 'muted' } : { text: 'нет', tone: 'muted' }]),
      ],
    });

    sections.push({
      kind: 'table', title: 'Все 18 видов: где, как и с каким шансом',
      note: tx`«Твой шанс» — за один улов при выполненном условии, с твоим Trophy Fish Chance ~${fmtNum(tfc.total)}. Гарантия: 100-й улов вида — золото, 600-й — алмаз, если этого тира ещё не было. Время суток и погода на трофеи не влияют.`,
      columns: ['Рыба', 'Условие', 'База', 'Твой шанс', 'Тиры', 'Поймано', 'До гарантии золота / алмаза'],
      rows: fish.map(x => {
        const p = fishP(x, tfc.total);
        const left = (t, at) => (x.tiers[t] ? '✓' : x.total >= at ? 'скоро' : fmtNum(at - x.total));
        return [
          { text: x.name, item: fishId(x.key, [...TIERS].reverse().find(t => x.tiers[t]) || 'bronze') },
          x.cond,
          x.golden ? 'по времени' : x.mana ? 'мана/1000 %' : pct(x.base),
          x.golden ? '1 за 8–12 мин' : pct(p),
          tiersText(x),
          x.total ? fmtNum(x.total) : { text: 'не поймана', tone: 'bad' },
          tx`${left('gold', PITY.gold)} / ${left('diamond', PITY.diamond)}`,
        ];
      }),
    });

    const o0 = tierOdds(0), o5 = tierOdds(5);
    sections.push({
      kind: 'text', title: 'Как выбирается рыба и тир',
      text: [
        'Каждый улов в лаве Crimson Isle сначала проверяет трофеи: все виды, условия которых ты выполняешь, бросаются по очереди от самого редкого к частому. Если трофей не выпал, дальше идут Sea Creatures и обычный улов.',
        tx`Потом тир: сначала бросок на алмаз (${pct(TIER_ROLL.diamond)}), затем на золото (${pct(TIER_ROLL.gold)}), затем на серебро (${pct(TIER_ROLL.silver)}), иначе бронза. Итого: алмаз ${pct(o0.exact.diamond)}, золото ${pct(o0.exact.gold, 2)}, серебро ${pct(o0.exact.silver, 2)}, бронза ${pct(o0.exact.bronze, 2)}.`,
        tx`Charm на удочке добавляет 2% за уровень к броскам алмаза, золота и серебра: с Charm V серебро или выше ${pct(o5.atLeast.silver, 2)} вместо ${pct(o0.atLeast.silver, 2)}.${tfc.charm ? tx` У тебя Charm ${tfc.charm}.` : ' На твоей лавовой удочке Charm не видно.'}`,
        tx`Перки Essence Shop множат броски своего тира на +2% за уровень (до +20% на X): Midas Lure у Marigold в Royal Mines (Gold Essence) — золото, Radiant Fisher у Gemma в Crystal Nucleus (Diamond Essence) — алмаз. У тебя Midas Lure ${tfc.midas || 0}/10, Radiant Fisher ${tfc.radiant || 0}/10${tfc.midas || tfc.radiant ? ': это уже учтено в плане' : ''}.`,
        tx`Гарантия (pity): 100-й улов вида всегда золото, 600-й — алмаз, если этого тира у тебя ещё нет. Счётчик — все уловы этого вида за всё время, поэтому у частых видов алмаз гарантирован уже скоро${fish.find(x => x.key === 'blobfish' && !x.tiers.diamond) ? tx` (Blobfish: ${fmtNum(fish.find(x => x.key === 'blobfish').total)} из 600)` : ''}.`,
        'Золотой трофей даёт 15 Bits, алмазный — 30 (с твоим множителем Bits). Все 4 тира одного вида дают опыт SkyBlock.',
        'Два надетых предмета Hunter Armor включают Peace Treaty: Sea Creatures перестают клевать и бить тебя. Удобно для чистой охоты на трофеи, но без существ нет опыта Fishing.',
        'Odger разделывает всю Trophy Fish из инвентаря сразу. Перед разделкой убери Obfuscated, которые нужны как наживка.',
      ],
    });

    sections.push({
      kind: 'text', title: 'Самые трудные виды',
      text: fish.filter(x => x.hard).map(x => tx`${x.name}: ${x.hard}. ${x.golden ? x.cond : tx`Где: ${x.spot}.`}`),
    });

    // Личный план
    const goalOf = Object.fromEntries(GOALS.map(g => [g.goal, g]));
    const planRows = steps.map(s => [
      goalOf[s.goal].title,
      { text: s.name, item: fishId(s.key, s.goal === 'master' ? 'diamond' : s.goal === 'gold' ? 'gold' : s.goal === 'silver' ? 'silver' : 'bronze') },
      s.spot,
      tiersText(s.fish),
      s.chain ? tx`~${fmtNum(Math.ceil(s.need))} шт. = ~${fmtNum(s.chain.corrupted)} Corrupted Bait → ${fmtNum(s.chain.obf1)} Obf 1${s.chain.obf2 ? tx` → ${fmtNum(s.chain.obf2)} Obf 2` : ''}` : tx`~${fmtNum(Math.ceil(s.need))}`,
      s.catches ? tx`~${fmtNum(Math.ceil(s.catches))}` : '—',
      { text: hoursText(s.hours), tone: s.hours > 50 ? 'warn' : undefined },
    ]);
    const totalHours = GOALS.map(g => [g.title, steps.filter(s => s.goal === g.goal).reduce((a, s) => Math.max(a, s.hours), 0), steps.filter(s => s.goal === g.goal).length]);
    sections.push({
      kind: 'table', title: 'Личный план до алмаза: от быстрого к долгому',
      note: tx`Цели идут по порядку наград Odger, внутри цели — от самого быстрого вида. «Уловов этого вида» уже учитывает гарантию на 100/600. Часы — грубая оценка при ~${ASSUME.catchesPerHour} уловах в час (Slugfish ~${ASSUME.slowCatchesPerHour}/ч из-за ожидания, Golden Fish ~${ASSUME.goldenPerHour}/ч): это допущение, не игровое число. Виды из одной точки ловятся одновременно, поэтому реальное время меньше суммы.`,
      columns: ['Цель', 'Рыба', 'Где', 'Сейчас', 'Уловов этого вида', 'Всего уловов', 'Время'],
      rows: planRows,
    });
    sections.push({
      kind: 'checklist', title: 'Сколько осталось до каждой награды',
      items: totalHours.map(([t, h, n], i) => ({ text: t, done: n === 0, hint: n ? tx`${n} ${n === 1 ? 'вид' : n < 5 ? 'вида' : 'видов'} · самый долгий ${hoursText(h)}` : 'готово', item: i ? tx`${['', 'SILVER', 'GOLD', 'DIAMOND'][i]}_HUNTER_CHESTPLATE` : 'BRONZE_HUNTER_CHESTPLATE' })),
    });

    // Точки-комбо
    const groups = [...new Set(fish.filter(x => !x.tiers.diamond).map(x => x.group))];
    sections.push({
      kind: 'steps', title: 'Где ловить несколько видов разом',
      note: 'Все виды, чьи условия выполнены, бросаются в одном улове. Отмечено, если в точке не осталось видов без алмаза.',
      items: Object.entries(SPOTS).map(([k, s]) => {
        const here = fish.filter(x => x.group === k);
        const left = here.filter(x => !x.tiers.diamond);
        return { title: s.title, text: tx`${s.text}${left.length ? tx` Без алмаза: ${left.map(x => x.name).join(', ')}.` : ''}`, done: !groups.includes(k), items: here.map(x => fishId(x.key)) };
      }),
    });

    sections.push({
      kind: 'table', title: 'Odger: ранги и награды',
      note: rewards ? undefined : 'API не показал, какие награды уже забраны: «готово» значит, что условие выполнено. Потерянные части Hunter Armor продаются в Lost Rewards Shop у Odger (Diamond — 2,5M за часть).',
      columns: ['Ранг', 'Условие', 'Сейчас', 'Награда'],
      rows: ranks.map(r => [
        { text: r.name, item: tx`${r.armor}_CHESTPLATE` },
        r.need === 'bronze' ? '15 видов на бронзу или выше' : r.need === 'diamond' ? 'все 4 тира у всех 18' : tx`${TIER_RU[r.need]} или выше у всех 18`,
        { text: `${r.have}/${r.count}`, tone: r.ready ? 'good' : undefined },
        r.reward,
      ]),
    });

    const magma = price('MAGMA_FISH');
    sections.push({
      kind: 'table', title: 'Разделка у Odger: Magmafish за рыбу',
      note: tx`Цифры — по fandom-вики (Odger) и SkyHanni, они совпадают.${magma ? tx` Цена Magmafish сейчас: ${fmtCoins(magma)} за штуку.` : ''} Magmafish (и Silver/Gold/Diamond Magmafish) идут на звёзды Hunter Armor, Hot Bait и Corrupted Bait.`,
      columns: ['Рыба', 'Бронза', 'Серебро', 'Золото', 'Алмаз'],
      rows: fish.map(x => [{ text: x.name, item: fishId(x.key) }, ...x.fillet.map(String)]),
    });

    const tierLine = TIERS.map(t => tx`${TIER_RU[t]} ${counts.tiers[t].exact}/18`).join(' · ');
    return {
      summary: tx`${tierLine} · поймано ${fmtNum(Number(tf.total_caught || 0) || fish.reduce((s, x) => s + x.total, 0))} · Trophy Fish Chance ~${fmtNum(tfc.total)}`,
      status: ranks[3].ready ? 'done' : counts.species ? 'progress' : 'start',
      level: { label: 'Алмаз', value: counts.tiers.diamond.exact, max: 18 },
      next: next.slice(0, 7),
      sections,
      extra: {
        counts,
        trophy: fish.map(x => ({ key: x.key, name: x.name, rarity: x.rarity, tiers: x.tiers, how: x.cond })),
        ranks,
      },
    };
  },
};
