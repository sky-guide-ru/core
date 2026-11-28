// Гайд «Драконы и Zealots» (The End): Special Zealot → Summoning Eye → призыв дракона, вклад (Dragon Weight),
// дроп и выгода по ценам, бои игрока из API. Факты — dragons-data.js (сверено по fandom-вики 28.11.2026).
import { fmtCoins, plural, num, sortNext, nice } from './combat/util.js';
import { DRAGONS, SLOTS, FRAGS_PER, PLACE_WEIGHT, MAJOR, FRAG_WEIGHT, FRAG_MAX, ZEALOT, EYE_SOURCES } from './dragons-data.js';
import { tx } from '../../i18n/msg.js';

const pct = x => `${(Math.round(x * 1000) / 10).toLocaleString('ru-RU')}%`;
const fragId = key => `${key.toUpperCase()}_FRAGMENT`;
const majorId = (mj, d) => mj.id || `${d.set}_${mj.slot}`;
const majorLabel = (ctx, mj) => mj.label || (mj.slot ? tx`Dragon ${{ HELMET: 'Helmet', CHESTPLATE: 'Chestplate', LEGGINGS: 'Leggings', BOOTS: 'Boots' }[mj.slot]}` : nice(ctx, mj.id));

/**
 * Средний дроп с одного дракона при данном вкладе (без Magic Find): главная вещь по порядку порогов,
 * остаток вклада — в фрагменты (до 32), Enchanted Ender Pearl (до 4) и Ender Pearl (до 16).
 * @returns {{ value: number, rows: [{ id, p }] }}  value — монеты, rows — шанс каждой главной вещи
 */
export function lootFor(d, eyes, weight, price) {
  let none = 1, value = 0;
  const rows = [];
  const rest = w => {
    const frags = Math.min(FRAG_MAX, Math.floor(Math.max(0, w) / FRAG_WEIGHT));
    let left = w - frags * FRAG_WEIGHT;
    const eep = Math.min(4, Math.floor(Math.max(0, left) / 15)); left -= eep * 15;
    const pearls = Math.min(16, Math.floor(Math.max(0, left) / 5));
    return frags * price(fragId(d.key)) + eep * price('ENCHANTED_ENDER_PEARL') + pearls * price('ENDER_PEARL');
  };
  for (const mj of MAJOR) {
    if (weight < mj.req) continue;
    const c = Math.min(1, mj.chance(eyes, d.key));
    if (c <= 0) continue;
    const p = none * c;
    const id = majorId(mj, d);
    value += p * (price(id) + rest(weight - mj.req));
    rows.push({ id, p });
    none -= p;
  }
  value += none * rest(weight);
  return { value, rows };
}

/** Средний дроп по всем вариантам дракона (с их шансами появления). */
export function averageLoot(eyes, weight, price) {
  return DRAGONS.reduce((s, d) => s + d.chance * lootFor(d, eyes, weight, price).value, 0);
}

// Типичные расклады: свои глаза + место по урону (доля урона от лидера — примерно)
export const SCENARIOS = [
  { label: 'Без глаз, 1 место по урону', eyes: 0, weight: 300 + 100 },
  { label: '2 глаза, 2 место', eyes: 2, weight: 200 + 250 + 60 },
  { label: '4 глаза, урон хоть какой-то', eyes: 4, weight: 400 + 70 + 10 },
  { label: '8 глаз, 1 место (соло)', eyes: 8, weight: 800 + 300 + 100 },
];

function eyesOwned(m, ctx) {
  return Number(m.inv?.sacks?.SUMMONING_EYE || 0) + (ctx.owned?.get('SUMMONING_EYE') || []).reduce((s, it) => s + (it.count || 1), 0);
}

function zealotKills(m) {
  return Object.entries(m.bestiaryKills || {}).filter(([k]) => /^zealot_(enderman|bruiser)/.test(k)).reduce((s, [, v]) => s + (Number(v) || 0), 0);
}

const BOWS = ['TERMINATOR', 'JUJU_SHORTBOW', 'MOSQUITO_BOW', 'DRAGON_SHORTBOW'];

export function build(m, ctx) {
  const noMarket = m.mode?.market === false;
  const price = id => (noMarket ? 0 : ctx.price(id) || 0);
  const coins = v => (v > 0 ? fmtCoins(v) : '—');
  const combat = m.skills?.combat?.level || 0;
  const fight = m.extras?.dragonFight || null;
  const kills = fight?.kills || {};
  const totalKills = Object.values(kills).reduce((s, v) => s + v, 0);
  const summoned = fight?.summoned?.total ?? (typeof m.extras?.dragons === 'number' ? m.extras.dragons : m.extras?.dragons?.total) ?? 0;
  const placed = fight?.eyesPlaced?.total || 0;
  const bestDmg = fight?.mostDamage?.best || Math.max(0, ...Object.values(fight?.mostDamage || {}));
  const specials = m.extras?.zealotLoot || 0;
  const zk = zealotKills(m);
  const eyes = eyesOwned(m, ctx);
  const eyeP = price('SUMMONING_EYE');
  const bow = BOWS.find(id => ctx.has(id));
  const hunter = Math.max(0, ...BOWS.flatMap(id => (ctx.owned?.get(id) || []).map(it => Number(it.enchants?.dragon_hunter || 0))));
  const edrag = (m.pets || []).filter(p => p.type === 'ENDER_DRAGON').sort((a, b) => (b.tier === 'LEGENDARY') - (a.tier === 'LEGENDARY'))[0];
  const zealuck = Number(m.perks?.inc_zealots_odds || 0);
  const supSets = SLOTS.filter(s => ctx.has(`SUPERIOR_DRAGON_${s}`)).length;
  const next = [];

  // ---------- выгода раскладов ----------
  const scen = SCENARIOS.map(s => {
    const loot = averageLoot(s.eyes, s.weight, price);
    const cost = s.eyes * eyeP;
    return { ...s, loot, cost, net: loot - cost };
  });
  const four = scen.find(s => s.eyes === 4);
  const zero = scen[0];

  // ---------- Что делать дальше ----------
  if (combat < 12) {
    next.push({ priority: 60, title: tx`Combat 12 — вход в The End (сейчас ${combat})`, why: 'Zealot, драконы и Voidgloom Seraph — всё в The End. Пока качай Combat на других островах.' });
  } else {
    if (!bow) next.push({ priority: 55, title: 'Возьми лук с Dragon Tracer: Dragon Shortbow', why: 'Драконы летают, по ним бьют луком. Dragon Shortbow уже с Dragon Tracer V; дальше Juju Shortbow и Terminator.' });
    if (!eyes && !noMarket) {
      next.push({ priority: 45, title: 'Без глаз тоже есть лут: бей драконов, которых зовут другие', why: tx`Даже без своих глаз за 1 место по урону вклад ~400: шлем, поножи, ботинки Dragon Armor и фрагменты. В среднем ~${coins(zero.loot)} за дракона.` });
    }
    if (eyes > 0 && !noMarket && eyeP > 0) {
      next.push(four.net < 0
        ? { priority: 50, title: tx`Summoning Eye выгоднее продать: ${num(eyes)} шт. × ${fmtCoins(eyeP)}`, why: tx`Расклад «4 глаза» в среднем приносит ~${fmtCoins(four.loot)}, а 4 глаза стоят ${fmtCoins(four.cost)}. Призыв окупается только удачей (Ender Dragon, Aspect of the Dragons).` }
        : { priority: 50, title: tx`Клади 4 глаза с другом: в среднем +${fmtCoins(four.net)}`, why: '4 своих глаза и любой урон дают вклад 450+: вам обоим открыт весь главный дроп.' });
    }
    if (noMarket) next.push({ priority: 40, title: 'Фарми Zealot: Summoning Eye только из Special Zealot', why: 'Без рынка глаза не купить. Один Special Zealot примерно на 420 Zealot, глаз с него — 100%.' });
    if (edrag && edrag.tier === 'EPIC') {
      next.push({ priority: 30, title: tx`Ender Dragon: Epic → Legendary у Kat (8 Summoning Eye и 400 млн)`, why: tx`Legendary добавляет «Superior!»: +0,1% к большинству статов за уровень. Улучшение идёт 20 дней.${eyes ? tx` Глаз у тебя: ${num(eyes)}/8.` : ''}` });
    }
    if (zealuck < 5) next.push({ priority: 15, title: tx`Перк Zealuck ${zealuck ? tx`${zealuck} → ${zealuck + 1}` : 'I'} за Dragon Essence`, why: 'Каждый уровень +2% к шансу Special Zealot. Покупается за Dragon Essence в магазине эссенции.' });
  }

  // ---------- Таблицы ----------
  const typeRows = DRAGONS.map(d => {
    const setP = SLOTS.reduce((s, sl) => s + price(`${d.set}_${sl}`), 0);
    return [
      { text: d.name, tone: kills[d.key] ? 'good' : undefined },
      pct(d.chance),
      tx`${(d.hp / 1e6).toLocaleString('ru-RU')} млн HP, ${d.note}`,
      { text: nice(ctx, fragId(d.key)), item: fragId(d.key) },
      coins(price(fragId(d.key))),
      tx`${coins(setP)} · ${d.bonus}`,
      d.only ? { text: nice(ctx, d.only), item: d.only } : '—',
    ];
  });

  const sampleW = 480; // 4 глаза и любой урон — эталон для таблицы шансов
  const lootRows = MAJOR.map(mj => {
    const ex = DRAGONS.find(d => mj.chance(4, d.key) > 0) || DRAGONS[0];
    const id = majorId(mj, mj.slot ? DRAGONS[6] : ex);
    const p = mj.slot ? DRAGONS.reduce((s, d) => s + d.chance * price(`${d.set}_${mj.slot}`), 0) : price(id);
    return [
      { text: majorLabel(ctx, mj), item: id },
      num(mj.req),
      mj.text,
      coins(p),
    ];
  });

  const scenRows = scen.map(s => [
    s.label,
    tx`~${num(s.weight)}`,
    coins(s.loot),
    s.eyes ? coins(s.cost) : '0',
    noMarket || !eyeP ? '—' : { text: tx`${s.net >= 0 ? '+' : '−'}${fmtCoins(Math.abs(s.net))}`, tone: s.net >= 0 ? 'good' : 'bad' },
  ]);

  const myRows = DRAGONS.map(d => [
    d.name,
    num(kills[d.key] || 0),
    fight?.mostDamage?.[d.key] ? num(fight.mostDamage[d.key]) : '—',
    fight?.fastestKill?.[d.key] ? tx`${Math.round(fight.fastestKill[d.key] / 1000)} с` : '—',
  ]);

  const status = combat < 12 ? 'locked' : totalKills ? 'progress' : 'start';
  const summary = combat < 12
    ? tx`The End откроется с Combat 12 (сейчас ${combat}).`
    : totalKills
      ? tx`Убито драконов: ${num(totalKills)}${kills.superior ? tx`, из них Superior ${num(kills.superior)}` : ''}. Summoning Eye: ${num(eyes)}${placed ? tx`, положено ${num(placed)}` : ''}.`
      : tx`Драконов пока не убивал. Summoning Eye: ${num(eyes)}${specials ? tx`, Special Zealot: ${num(specials)}` : ''}.`;

  return {
    summary,
    status,
    next: sortNext(next),
    sections: [
      { kind: 'text', title: 'Как это устроено', text: [
        'Zealot — эндермены в Dragon\'s Nest, внизу острова The End. После убийства Zealot примерно 1 раз из 420 рядом появляется Special Zealot с порталом в руках: с него всегда падает Summoning Eye.',
        '8 Summoning Eye в рамки Ender Altar в центре Dragon\'s Nest — и вылупляется дракон. Положенный глаз становится Sleeping Eye: до появления дракона его можно забрать. После появления он превращается в Remnant of the Eye — один раз спасает от смерти в The End.',
        'Дракон — один из 7 вариантов. Вокруг гнезда появляются Ender Crystal: пока целы, лечат дракона. Разбитый кристалл даёт Crystal Fragment и 1 000 урона в зачёт.',
        'Урон по дракону режется: всё, что выше 0,4% его HP за удар, почти не засчитывается. Поэтому важнее частые попадания (Ferocity, шортбоу), чем один огромный удар.',
        'Не путать с Dragon\'s Lair в Crystal Hollows: там продают Golden Dragon, драконов там не призывают.',
      ] },
      { kind: 'table', title: 'Варианты дракона', note: 'Шанс — с каким вариантом вылупится дракон. Фрагменты падают того же вида. Цена брони — полный сет на аукционе.',
        columns: ['Дракон', 'Шанс', 'Особенность', 'Фрагмент', 'Цена', 'Броня: сет и бонус', 'Только с него'], rows: typeRows },
      { kind: 'table', title: 'Вклад (Dragon Weight)', note: 'Вклад = 100 за каждый свой Summoning Eye + бонус за место по урону + до 100 за долю урона от лидера. Максимум с глаз — 800.',
        columns: ['Место по урону', 'Бонус'], rows: PLACE_WEIGHT.map(x => [x.place, `+${x.w}`]) },
      { kind: 'table', title: 'Дроп: порог вклада и шанс', note: 'Вещи проверяются сверху вниз. Выпала одна — остальные главные уже не выпадут, а порог вычитается из вклада. Остаток вклада идёт в фрагменты (22 за штуку, до 32), затем в Enchanted Ender Pearl. Magic Find и Pet Luck повышают шансы.',
        columns: ['Вещь', 'Нужно вклада', 'Шанс', 'Цена'], rows: lootRows },
      { kind: 'table', title: 'Выгода: сколько глаз класть', news: 'profit', note: noMarket
        ? 'В этом режиме профиля рынка нет: глаза только из Special Zealot, броня и фрагменты — для себя.'
        : tx`Средний дроп с дракона по нынешним ценам, без Magic Find. Summoning Eye сейчас ${coins(eyeP)}. Цифра — среднее за много боёв: обычно в минус, плюс дают редкие Ender Dragon и Aspect of the Dragons.`,
        columns: ['Расклад', 'Вклад', 'Средний дроп', 'Свои глаза', 'Итог'], rows: scenRows },
      { kind: 'table', title: 'Откуда Summoning Eye', columns: ['Источник', 'Шанс', 'Условие'], rows: EYE_SOURCES.map(r => [...r]) },
      { kind: 'table', title: 'Special Zealot: что повышает шанс', note: tx`Базово 1 из ${ZEALOT.base} (с Zealot Bruiser 1 из ${ZEALOT.bruiser}), Magic Find не влияет. Глаз получает тот, кто вызвал Special Zealot, даже если добил другой.`,
        columns: ['Что', 'Эффект'], rows: ZEALOT.boosts.map(r => [...r]) },
      { kind: 'table', title: 'Твои бои с драконами', note: fight
        ? tx`Всего призвано при тебе: ${num(summoned)}. Своих глаз положено: ${num(placed)}. Разбито Ender Crystal: ${num(fight.crystals)}.${bestDmg ? tx` Лучший урон за бой: ${num(bestDmg)}.` : ''}`
        : 'В профиле пока нет боёв с драконами.',
        columns: ['Дракон', 'Убито', 'Лучший урон', 'Быстрее всего'], rows: myRows },
      { kind: 'checklist', title: 'Снаряжение для драконов', items: [
        { text: 'Лук с Dragon Tracer: Dragon Shortbow → Juju Shortbow → Terminator', done: !!bow, item: bow || 'DRAGON_SHORTBOW', hint: bow ? ctx.name(bow) : 'лука нет' },
        { text: 'Dragon Hunter на луке: больше урона по драконам', done: hunter > 0, hint: hunter ? tx`Dragon Hunter ${hunter}` : undefined },
        { text: 'Remnant of the Eye в инвентаре — один раз спасёт от смерти в The End', done: ctx.has('REMNANT_OF_THE_EYE'), item: 'REMNANT_OF_THE_EYE', hint: price('REMNANT_OF_THE_EYE') ? tx`аукцион ~${fmtCoins(price('REMNANT_OF_THE_EYE'))}, Pearl Dealer 200 тыс.` : 'Pearl Dealer, 200 тыс.' },
        { text: 'Superior Dragon Armor: +5% к статам и +50% урона Aspect of the Dragons', done: supSets >= 4, item: 'SUPERIOR_DRAGON_CHESTPLATE', hint: tx`${supSets}/4` },
        { text: 'Ender Dragon: +урон по эндер-мобам, Legendary — ко всем статам', done: !!edrag, item: edrag?.tier === 'LEGENDARY' ? 'ENDER_DRAGON;4' : 'ENDER_DRAGON;3', hint: edrag ? (edrag.tier === 'LEGENDARY' ? 'Legendary' : 'Epic') : 'нет' },
        { text: 'Перк Zealuck (эссенция Dragon) — чаще Special Zealot', done: zealuck >= 5, hint: tx`${zealuck}/5` },
      ] },
      { kind: 'text', title: 'Советы', text: [
        'Самый частый расклад — «4 глаза»: двое кладут по 4 глаза, и любого урона хватает на вклад 450+ (весь главный дроп).',
        'Без своих глаз бей чужих драконов: 1 место по урону даёт вклад ~400 — это шлем, поножи или ботинки Dragon Armor (нагруднику нужно 410).',
        tx`Фрагменты: ${Object.entries(FRAGS_PER).map(([s, n]) => tx`${n} на ${{ HELMET: 'шлем', CHESTPLATE: 'нагрудник', LEGGINGS: 'поножи', BOOTS: 'ботинки' }[s]}`).join(', ')} — броню любого дракона можно скрафтить.`,
        'Ненужную драконью броню и Aspect of the Dragons можно отдать Draconic Altar в Void Slate: Dragon Essence, фрагменты и 4,82% на Summoning Eye.',
        zk ? tx`Твоих Zealot по Bestiary: ${num(zk)}${specials ? tx`, Special Zealot: ${num(specials)} (в среднем 1 на ${num(Math.round(zk / Math.max(1, specials)))})` : ''}.` : 'Zealot по Bestiary в профиле пока нет.',
      ] },
    ],
  };
}

export default { id: 'dragons', title: 'Драконы и Zealots', icon: 'SUMMONING_EYE', group: 'combat', build };
