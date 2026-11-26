// Гайд по Diana (Mythological Ritual): Griffin, лопаты, мифические мобы и их дроп, снаряжение — по профилю игрока.
// Уровни мобов, рецепты камней Griffin и лопат, лор — из NEU-REPO. Шансы редкого дропа и вес мобов сверены 23.11.2026
// по fandom «Mythological Ritual» (правка март 2026): у NEU там устаревшие цифры.
// Идёт ли ивент сейчас — по мэру и министру (server/calendar).
import { calendarView, activePerks } from '../calendar/index.js';
import { fmtCoins, plural, num, sortNext, priceOfDrop, nice } from './combat/util.js';
import { tx } from '../../i18n/msg.js';

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
const RARITY_RU = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
// Приставка мобов: у каждой редкости Griffin своя ступень (уровни мобов в NEU идут ровно по 6 ступеням)
const PREFIX = ['(без приставки)', 'Blessed', 'Stalwart', 'Venerable', 'Exalted', 'Empyrean'];

// Мифические мобы: с какой редкости Griffin появляются, главный редкий дроп и шанс на младшей → старшей ступени
export const MYTH_MOBS = [
  { name: 'Minos Hunter', from: 0, levels: '20–211', drop: 'HILT_OF_REVELATIONS', chance: '0,25% → 2%', weight: 1000 },
  { name: 'Siamese Lynx', from: 0, levels: '15–193', drop: 'CROCHET_TIGER_PLUSHIE', chance: '0,05% → 4%', weight: 1000 },
  { name: 'Cretan Bull', from: 1, levels: '47–216', drop: 'CRETAN_URN', chance: '0,2% → 0,5%', weight: 800 },
  { name: 'Stranded Nymph', from: 1, levels: '44–208', drop: 'WASHED_UP_SOUVENIR', chance: '0,2% → 0,5%', weight: 800 },
  { name: 'Gaia Construct', from: 2, levels: '106–240', drop: 'DWARF_TURTLE_SHELMET', chance: '0,35% → 0,6%', weight: 600 },
  { name: 'Harpy', from: 2, levels: '113–251', drop: 'ANTIQUE_REMEDIES', chance: '0,35% → 0,6%', weight: 600 },
  { name: 'Minotaur', from: 3, levels: '141–236', drop: 'DAEDALUS_STICK', chance: '0,04% → 0,08%', weight: 400 },
  { name: 'Minos Champion', from: 3, levels: '175–285', drop: 'MINOS_RELIC', chance: '0,02% → 0,04%', weight: 400 },
  { name: 'Minos Inquisitor', from: 4, levels: '264–290', drop: 'ULTIMATE_CHIMERA;1', chance: '1% → 1,25%', weight: 75 },
  { name: 'Sphinx', from: 4, levels: '315–349', drop: 'BRAIN_FOOD', chance: '0,25% → 0,5%', weight: 75 },
  { name: 'King Minos', from: 5, levels: '338', drop: 'CROWN_OF_GREED', chance: '2%', extra: 'и Shimmering Wool 0,2%', weight: 15 },
  { name: 'Manticore', from: 5, levels: '377', drop: 'FATEFUL_STINGER', chance: '0,5%', extra: 'и Manti-core 0,2%', weight: 15 },
];

// Улучшение Griffin у Kat: камень (рецепт из NEU), монеты и время
const UPGRADES = [
  { to: 1, stone: 'GRIFFIN_UPGRADE_STONE_UNCOMMON', recipe: '8 Griffin Feather, 64 Enchanted Gold Ingot, 32 Ancient Claw', coins: 100, time: '1 мин' },
  { to: 2, stone: 'GRIFFIN_UPGRADE_STONE_RARE', recipe: '16 Griffin Feather, 4 Enchanted Gold Block, 64 Ancient Claw', coins: 10_000, time: '1 ч' },
  { to: 3, stone: 'GRIFFIN_UPGRADE_STONE_EPIC', recipe: '64 Griffin Feather, 4 Mythos Fragment, 4 Enchanted Ancient Claw, 12 Enchanted Gold Block', coins: 250_000, time: '1 день' },
  { to: 4, stone: 'GRIFFIN_UPGRADE_STONE_LEGENDARY', recipe: '16 Mythos Fragment, Braided Griffin Feather, 32 Enchanted Ancient Claw, 96 Enchanted Gold Block', coins: 500_000, time: '3 дня' },
  { to: 5, stone: 'GRIFFIN_UPGRADE_STONE_MYTHIC', recipe: '48 Mythos Fragment, 2 Braided Griffin Feather, 128 Enchanted Ancient Claw, 192 Enchanted Gold Block', coins: 1_000_000, time: '1 ч' },
];

const SPADES = [
  { id: 'ANCESTRAL_SPADE', chain: 4, cd: '3 с', loot: 'мобы, Griffin Feather, монеты', how: 'Продаёт Diana в Hub во время ивента' },
  { id: 'ARCHAIC_SPADE', chain: 6, cd: '2 с', loot: '+ Mythos Fragment', how: 'Крафт: Ancestral Spade, Hilt of Revelations, 8 Enchanted Ancient Claw, 32 Griffin Feather, 2 Enchanted Gold Block' },
  { id: 'DEIFIC_SPADE', chain: 8, cd: '1 с', loot: '+ Braided Griffin Feather', how: 'Крафт: Archaic Spade, Hilt of Revelations, Braided Griffin Feather, 16 Mythos Fragment, 128 Enchanted Ancient Claw, 128 Enchanted Gold Block' },
];

const ARMOR = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS', 'NECKLACE', 'CLOAK', 'BELT', 'BRACELET'];

function griffinOf(m) {
  let best = -1;
  for (const p of m.pets || []) if (p.type === 'GRIFFIN') best = Math.max(best, RARITIES.indexOf(p.tier));
  return best;
}

const left = ms => {
  const h = Math.max(0, Math.round(ms / 3600_000));
  return h < 24 ? tx`${h} ${plural(h, 'час', 'часа', 'часов')}` : tx`${Math.floor(h / 24)} д ${h % 24} ч`;
};

export function build(m, ctx) {
  const now = Date.now();
  const cal = calendarView(now);
  const ritualOn = activePerks().includes('Mythological Ritual');
  const dianaIs = cal.mayor?.name === 'Diana' ? 'мэр' : cal.minister?.name === 'Diana' ? 'министр' : null;
  const dianaCand = cal.election?.candidates?.find(c => c.name === 'Diana');
  const g = griffinOf(m);
  const spade = [...SPADES].reverse().find(s => ctx.has(s.id));
  const stats = m.extras?.mythos || null;
  const taming = m.skills?.taming?.level || 0;
  const hasBlade = ctx.has('DAEDALUS_AXE'), hasSword = ctx.has('SWORD_OF_REVELATIONS');
  const mythosPieces = ARMOR.filter(s => ctx.has(`MYTHOS_${s}`)).length;
  const challPieces = ARMOR.filter(s => ctx.has(`CHALLENGER_${s}`) || ctx.has(`MYTHOS_${s}`)).length;
  const crown = ctx.has('CROWN_OF_AVARICE') ? 'CROWN_OF_AVARICE' : ctx.has('CROWN_OF_GREED') ? 'CROWN_OF_GREED' : null;
  const p = id => priceOfDrop(ctx, id);
  const next = [];

  // ---------- Что делать дальше ----------
  if (ritualOn) {
    next.push({ priority: g >= 0 && spade ? 95 : 88, title: tx`Ивент идёт: копай норы грифонов, осталось ${left(cal.termEnd - now)}`,
      why: tx`Diana сейчас ${dianaIs || 'в правительстве'}. Ивент бывает только при ней, следующий раз может быть нескоро.${g < 0 || !spade ? ' Сначала купи то, чего не хватает (ниже).' : ''}` });
  } else if (dianaCand) {
    next.push({ priority: 40, title: tx`Diana на выборах: ${dianaCand.pct ?? '?'}% голосов`,
      why: 'Если победит или станет второй с перком «Мифологический ритуал», ивент начнётся при смене мэра. Подготовь Griffin и лопату заранее.' });
  }
  if (g < 0) {
    next.push({ priority: ritualOn ? 92 : 50, title: 'Купи Griffin (лучше Legendary)',
      why: tx`Без Griffin из нор лезут только 2 вида мобов. Minos Inquisitor (Chimera) появляется с Legendary Griffin.${p('GRIFFIN;4') ? tx` Legendary на аукционе ~${fmtCoins(p('GRIFFIN;4'))}.` : ''}` });
  } else if (g < 4) {
    const u = UPGRADES[g];
    next.push({ priority: ritualOn ? 70 : 45, title: tx`Улучши Griffin: ${RARITY_RU[g]} → ${RARITY_RU[g + 1]}`,
      why: tx`Откроет мобов: ${MYTH_MOBS.filter(x => x.from === g + 1).map(x => x.name).join(', ')}. Нужен ${ctx.name(u.stone)} и ${fmtCoins(u.coins)} у Kat.${g + 1 < 4 ? ' Цель — Legendary: с ним появляется Minos Inquisitor с Chimera.' : ''}` });
  }
  if (!spade) {
    next.push({ priority: ritualOn ? 90 : 35, title: 'Возьми Ancestral Spade у Diana', why: 'Без лопаты норы не найти: ПКМ (Echo) показывает путь к следующей норе.' });
  } else if (spade.id === 'ANCESTRAL_SPADE' && (stats?.burrows || 0) >= 300) {
    next.push({ priority: 30, title: 'Собери Archaic Spade', why: 'Цепочка 6 нор вместо 4, перезарядка 2 с, и из нор начнут падать Mythos Fragment (нужны для камней Griffin).' });
  }
  if (!hasBlade && !hasSword) {
    next.push({ priority: 34, title: taming >= 40 ? tx`Daedalus Blade: при Taming ${taming} это сильное оружие` : 'Sword of Revelations — оружие на мифических мобов',
      why: taming >= 40 ? tx`Daedalus Blade даёт +4 урона за каждый уровень Taming (у тебя ${taming}) и копирует боевые статы питомца. Нужны 2 Daedalus Stick (с Minotaur) и Sword of Revelations.` : 'Урон ×1,5 по мифическим мобам и +5 Magic Find. Крафт: Hilt of Revelations (с Minos Hunter), 12 Griffin Feather, 8 Enchanted Ancient Claw.' });
  }
  if (challPieces < 4) {
    next.push({ priority: 25, title: 'Броня Challenger или Mythos на время ивента', why: 'В Hub во время ритуала статы этой брони удваиваются, а бонус Unearthed (до 8 частей с аксессуарами снаряжения) усиливает против мифических мобов.' });
  }

  // ---------- Таблицы ----------
  const mobRows = MYTH_MOBS.map(x => [
    x.name,
    { text: RARITY_RU[x.from], tone: g >= x.from ? 'good' : 'muted' },
    num(x.weight),
    { text: nice(ctx, x.drop) || x.drop, item: x.drop },
    tx`${x.chance}${x.extra ? tx` (${x.extra})` : ''}`,
    p(x.drop) ? fmtCoins(p(x.drop)) : '—',
  ]);
  const griffinRows = RARITIES.map((r, i) => [
    { text: RARITY_RU[i], item: tx`GRIFFIN;${i}`, tone: i === g ? 'good' : undefined },
    PREFIX[i],
    tx`${(i + 1) * 2}: ${MYTH_MOBS.filter(x => x.from === i).map(x => x.name).join(', ')}`,
    p(tx`GRIFFIN;${i}`) ? fmtCoins(p(tx`GRIFFIN;${i}`)) : '—',
  ]);
  const upgRows = UPGRADES.map(u => [
    tx`${RARITY_RU[u.to - 1]} → ${RARITY_RU[u.to]}`,
    { text: ctx.name(u.stone) || u.stone, item: u.stone },
    u.recipe,
    tx`${fmtCoins(u.coins)}, ${u.time}`,
  ]);
  const spadeRows = SPADES.map(s => [
    { text: ctx.name(s.id) || s.id, item: s.id, tone: ctx.has(s.id) ? 'good' : undefined },
    tx`${s.chain} норы, перезарядка ${s.cd}`,
    s.loot,
    s.how,
  ]);

  const status = ritualOn ? (g >= 4 && spade ? 'progress' : 'start') : 'locked';
  const summary = ritualOn
    ? tx`Ивент идёт (Diana — ${dianaIs}), ещё ${left(cal.termEnd - now)}. ${g >= 0 ? tx`Твой Griffin: ${RARITY_RU[g]}` : 'Griffin нет'}${spade ? tx`, лопата ${ctx.name(spade.id)}` : ', лопаты нет'}.`
    : tx`Сейчас ивента нет: Diana не мэр и не министр${cal.mayor ? tx` (мэр ${cal.mayor.name})` : ''}.${dianaCand ? tx` На выборах у Diana ${dianaCand.pct ?? '?'}%.` : ''}`;

  return {
    summary,
    status,
    level: g >= 0 ? { label: 'Griffin', value: g + 1, max: 6 } : undefined,
    next: sortNext(next),
    sections: [
      { kind: 'text', title: 'Что это за ивент', text: [
        'Мифологический ритуал (в игре Mythological Ritual) — ивент Diana: он идёт весь срок, пока у Diana этот перк (она мэр, или министр с этим перком). Ancestral Spade находит в Hub норы грифонов (Griffin Burrows), которые идут цепочкой.',
        'В норах бывают монеты, Griffin Feather и мифические мобы. Какие мобы и насколько сильные, решает редкость Griffin: с каждой редкостью добавляются 2 новых вида, а все мобы становятся сильнее (приставки Blessed → Empyrean) и дают редкий дроп чаще.',
        'С каждого мифического моба падает Ancient Claw (100%), с крупных — ещё Enchanted Ancient Claw. Перья, когти и фрагменты идут на камни Griffin, лопаты, броню и оружие ивента.',
        ritualOn ? tx`Сейчас ивент идёт: до смены мэра ${left(cal.termEnd - now)}.` : 'Сейчас ивента нет. Календарь и выборы — на странице «События».',
      ] },
      { kind: 'table', title: 'Редкость Griffin → какие мобы', note: 'По данным NEU: уровни мобов идут шестью ступенями, ровно по редкостям Griffin. Цена Griffin — аукцион.',
        columns: ['Griffin', 'Ступень мобов', 'Видов мобов (новые)', 'Цена'], rows: griffinRows, ...(g >= 0 ? { current: g } : {}) },
      { kind: 'table', title: 'Мифические мобы и ценный дроп', note: 'Шанс: на младшей ступени → на старшей (Empyrean, Mythic Griffin), по вики. Magic Find повышает шансы. Вес — как часто моб выходит из норы относительно других: 1000 против 15 у King Minos и Manticore. Из нор: 75% — моб, 25% — сокровище.',
        columns: ['Моб', 'С Griffin', 'Вес', 'Редкий дроп', 'Шанс', 'Цена'], rows: mobRows },
      { kind: 'table', title: 'Лопаты', columns: ['Лопата', 'Цепочка', 'Что ещё в норах', 'Где взять'], rows: spadeRows },
      { kind: 'table', title: 'Улучшение Griffin у Kat', note: 'Камень улучшения крафтится из Base Griffin Upgrade Stone (8 Griffin Feather, 16 Enchanted Gold Ingot, 8 Enchanted Cobblestone) и материалов ниже.',
        columns: ['Улучшение', 'Камень', 'Материалы камня', 'У Kat'], rows: upgRows, ...(g >= 0 && g < 5 ? { current: g } : {}) },
      { kind: 'checklist', title: 'Снаряжение для ивента', items: [
        { text: 'Griffin Legendary или выше (Minos Inquisitor и Chimera)', done: g >= 4, item: 'GRIFFIN;4', hint: g >= 0 ? tx`сейчас ${RARITY_RU[g]}` : 'нет Griffin' },
        { text: 'Лопата: Ancestral → Archaic → Deific', done: !!spade, item: spade?.id || 'ANCESTRAL_SPADE', hint: spade ? ctx.name(spade.id) : 'нет лопаты' },
        { text: 'Daedalus Blade (урон растёт с Taming) или Sword of Revelations', done: hasBlade || hasSword, item: hasBlade ? 'DAEDALUS_AXE' : 'SWORD_OF_REVELATIONS', hint: hasBlade ? 'есть Daedalus Blade' : hasSword ? 'есть Sword of Revelations' : tx`Taming ${taming}` },
        { text: 'Броня Challenger / Mythos (×2 статы в Hub во время ивента)', done: challPieces >= 4, item: 'MYTHOS_LEGGINGS', hint: tx`${challPieces}/8 частей${mythosPieces ? tx`, из них Mythos ${mythosPieces}` : ''}` },
        { text: 'Crown of Greed: ×2 монет из нор и +5 Magic Find (но урон по тебе ×1,25)', done: !!crown, item: crown || 'CROWN_OF_GREED' },
        { text: 'Daedalus Notes на лопату (перековка Erudite: +2 норы в цепочке, нужен Mining 30)', done: false, item: 'DAEDALUS_NOTES' },
        { text: 'Beastmaster Crest: аксессуар, который растёт от убитых мифических мобов', done: ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'].some(r => ctx.has(`BEASTMASTER_CREST_${r}`)) || ctx.has('BEASTMASTER_CREST'), item: 'BEASTMASTER_CREST_LEGENDARY' },
      ] },
      { kind: 'text', title: 'Советы', text: [
        'Цепочка: копай нору, на которую указывает Echo, и сразу следующую. Чем длиннее цепочка (лопата, Erudite, Mythic Griffin), тем больше нор за раз.',
        'Minos Inquisitor и King Minos — самые ценные. Убивай их сам: бей быстро, их могут добить другие игроки.',
        'Brain Food (с Sphinx) навсегда даёт +1 к выслеживанию нор, съесть можно 5 штук.',
        taming >= 40 ? tx`У тебя Taming ${taming}: Daedalus Blade с сильным боевым питомцем бьёт очень хорошо.` : 'Daedalus Blade сильнее с высоким Taming: качай Taming, пока Diana мэр (Pet XP Buff +35%).',
        stats ? tx`Твоя статистика: ${num(stats.kills)} мифических мобов, ${num(stats.burrows)} нор${stats.chains ? tx`, ${num(stats.chains)} законченных цепочек` : ''}.` : 'Статистики по ивенту в профиле пока нет.',
      ] },
    ],
  };
}

export default { id: 'diana', title: 'Diana (мифологический ритуал)', icon: 'GRIFFIN_FEATHER', group: 'events', build };
