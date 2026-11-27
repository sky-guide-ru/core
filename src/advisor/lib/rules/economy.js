// Аксессуары и Magical Power, питомцы, миньоны, коллекции, заработок и план покупок.
import KEY_PETS from '../../data/key-pets.json' with { type: 'json' };
import LADDERS from '../../data/ladders.json' with { type: 'json' };
import { tamingCapPlan, RARITIES } from '../../../analysis/pet-score.js';
import { fmtCoins, fmtNum, plural, prettyId, bestPets, petLevel, petTierIndex, PET_TIER_RU } from '../util.js';
import { mpGainStats, hitGain } from '../../../calc/power.js';
import { powerStats, POWERS, tuningPoints } from '../../../calc/stats.js';
import { ru } from '../../../../i18n/msg.js';
import { tx } from '../../../../i18n/msg.js';

const pct = x => tx`${(Math.round(x * 1000) / 10).toString().replace('.', ',')}%`;
const statLine = d => [['strength', 'Strength'], ['crit_damage', 'Crit Damage'], ['crit_chance', 'Crit Chance'], ['health', 'Health'], ['defense', 'Defense'], ['intelligence', 'Intelligence']]
  .filter(([k]) => Math.round(d[k] || 0)).map(([k, n]) => tx`${d[k] > 0 ? '+' : ''}${Math.round(d[k])} ${n}`).join(', ');

/** Расчёт для шага: что дадут статы от прибавки Magical Power. Без листа статов — null */
export function mpCalc(ctx, gain, cost) {
  const base = ctx.power?.world;
  if (!base || !ctx.m.selectedPower || !gain) return null;
  const d = mpGainStats(ctx.m, gain);
  const g = hitGain(base, d);
  if (!statLine(d)) return null;
  const perM = cost > 0 && g > 0 ? ru` (~${pct(g / (cost / 1e6))} за 1 млн)` : '';
  return ru`Примерно ${statLine(d)} от Power ${prettyId(ctx.m.selectedPower)}: удар мечом +${pct(g)}${perM}`;
}

/** Лучшая для урона мечом сила из доступных игроку: { power, gain, stats } относительно текущей */
export function bestPowerForMelee(m, base) {
  if (!base) return null;
  const mp = m.magicalPower || 0;
  const cur = powerStats(m.selectedPower, mp);
  const curTotal = { ...(cur?.stats || {}) };
  for (const [k, v] of Object.entries(cur?.unique || {})) curTotal[k] = (curTotal[k] || 0) + v;
  const avail = new Set(['fortuitous', 'pretty', 'protected', 'simple', 'warrior', ...((m.skills?.combat?.level || 0) >= 15 ? ['commando', 'disciplined', 'inspired', 'ominous', 'prepared'] : []),
    ...(m.unlockedPowers || []).map(x => String(x).toLowerCase())]);
  let best = null;
  for (const p of avail) {
    if (!POWERS[p]) continue;
    const ps = powerStats(p, mp);
    const tot = { ...ps.stats };
    for (const [k, v] of Object.entries(ps.unique)) tot[k] = (tot[k] || 0) + v;
    const delta = {};
    for (const k of new Set([...Object.keys(tot), ...Object.keys(curTotal)])) delta[k] = (tot[k] || 0) - (curTotal[k] || 0);
    const g = hitGain(base, delta);
    if (!best || g > best.gain) best = { power: p, gain: g, delta };
  }
  return best;
}

// Граница «выгодного» аксессуара: сколько монет за 1 Magical Power ещё считаем дёшево
export const CHEAP_MP_COINS = 15_000_000;
export const MP_MILESTONES = [500, 750, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700];
// Уникальные крафты миньонов → слотов миньонов (без слотов из Community Shop)
export const MINION_SLOTS = [[0, 5], [5, 6], [15, 7], [30, 8], [50, 9], [75, 10], [100, 11], [125, 12], [150, 13], [175, 14], [200, 15], [225, 16], [250, 17], [275, 18], [300, 19], [350, 20], [400, 21], [450, 22], [500, 23], [550, 24], [600, 25], [650, 26]];

export function accessoryRules(ctx, add) {
  const m = ctx.m;
  const acc = ctx.acc;
  const mp = m.magicalPower || acc?.highestMp || 0;
  const nextMs = MP_MILESTONES.find(x => x > mp);

  if (acc?.cheapestNext?.length) {
    // Две группы: выгодные (дёшево за 1 MP) — наверх плана, дорогие — отдельным шагом «на потом».
    // Иначе в один шаг попадали аксессуары по 100+ млн за 1 MP, и «главным» становилась покупка на миллиарды.
    const need = nextMs ? nextMs - mp : 50;
    const cheapLimit = Math.max(CHEAP_MP_COINS, Math.min(CHEAP_MP_COINS * 2, (ctx.liquid || 0) * 0.005));
    const cheap = [], dear = [];
    let got = 0;
    for (const r of acc.cheapestNext) {
      if (got >= need && cheap.length >= 5) break;
      // две версии одного аксессуара MP не складывают — берём только первую (самую выгодную)
      if (r.family && [...cheap, ...dear].some(p => p.family?.includes(r.id) || r.family.includes(p.id))) continue;
      const isCheap = !ctx.hasPrices || !r.perMp || r.perMp <= cheapLimit;
      if (isCheap && cheap.length < 15) cheap.push(r);
      else if (!isCheap && dear.length < 8 && got < need) dear.push(r);
      else continue;
      got += r.gain;
    }
    const sum = list => ({ gain: list.reduce((g, r) => g + r.gain, 0), cost: list.reduce((c, r) => c + (r.price || 0), 0) });
    const line = r => ru`${r.name} — +${r.gain} MP, ~${fmtCoins(r.price)} (${fmtCoins(r.perMp)} за 1 MP)${r.upgradeFrom ? ru`, апгрейд из ${r.upgradeFrom} (доплата за вычетом старой версии)` : ''}`;
    if (cheap.length) {
      const { gain, cost } = sum(cheap);
      add({
        id: 'mp-cheap', cat: 'Аксессуары и Magical Power', priority: 88, effort: 'минуты, нужны монеты',
        title: ru`Докупи ${cheap.length} ${plural(cheap.length, 'самый выгодный аксессуар', 'самых выгодных аксессуара', 'самых выгодных аксессуаров')}: +${gain} MP за ~${fmtCoins(cost)}`,
        why: ru`Сейчас ${fmtNum(mp)} MP${nextMs ? ru`, до ${nextMs} не хватает ${nextMs - mp}` : ''}. Magical Power усиливает все статы через Power в Accessory Bag — это самый дешёвый рост урона на твоём этапе.`,
        how: cheap.map(line),
        items: cheap.map(r => r.id),
        cost: cost || undefined,
        payoff: tx`+${gain} MP`,
        calc: mpCalc(ctx, gain, cost) || undefined,
        link: 'accessories',
      });
    }
    if (dear.length) {
      const { gain, cost } = sum(dear);
      add({
        id: 'mp-expensive', cat: 'Аксессуары и Magical Power', priority: cheap.length ? 40 : 52, effort: 'дорого',
        title: ru`Дорогие аксессуары на потом: ${dear.length} шт., +${gain} MP за ~${fmtCoins(cost)}`,
        why: ru`Каждый из них стоит больше ${fmtCoins(cheapLimit)} за 1 MP. Это вложение на будущее: сначала прокачай отстающие скиллы и слееров и закрой дешёвые шаги выше, а сюда откладывай со своего заработка.`,
        how: dear.map(line),
        items: dear.map(r => r.id),
        cost: cost || undefined,
        payoff: tx`+${gain} MP`,
        calc: mpCalc(ctx, gain, cost) || undefined,
        link: 'accessories',
      });
    }
  }

  if (acc?.notRecombCount > 0 && acc.recombPrice) {
    const perMp = acc.recombGain ? acc.recombPrice * acc.notRecombCount / acc.recombGain : null;
    add({
      id: 'mp-recomb', cat: 'Аксессуары и Magical Power', priority: 58, effort: 'дорого',
      title: ru`Рекомбобулируй аксессуары: ${acc.notRecombCount} шт., до +${acc.recombGain} MP`,
      why: ru`Recombobulator 3000 поднимает редкость на ступень. Сейчас ~${fmtCoins(acc.recombPrice)} за штуку${perMp ? ru`, в среднем ~${fmtCoins(perMp)} за 1 MP` : ''}. Делай это, когда дешёвые новые аксессуары закончатся (сравни с ценой за MP в шаге выше).`,
      how: ['Начинай с Legendary-аксессуаров: Legendary → Mythic даёт +6 MP', 'Применяется на Reforge Anvil'],
      items: ['RECOMBOBULATOR_3000'],
    });
  }

  // Rift Prism (+11 MP) — редкий предмет с аукциона, стоит больше миллиарда. Это не «быстрая победа»:
  // советуем, только если призма уже лежит у игрока или её цена за 1 MP выгодна / по карману.
  if (m.riftPrism === false) {
    const RIFT_PRISM_MP = 11;
    const inBag = ctx.owned?.has('RIFT_PRISM');
    const price = ctx.price('RIFT_PRISM');
    const perMp = price ? price / RIFT_PRISM_MP : 0;
    const cheapLimit = Math.max(CHEAP_MP_COINS, Math.min(CHEAP_MP_COINS * 2, (ctx.liquid || 0) * 0.005));
    if (inBag) {
      add({
        id: 'mp-rift-prism', cat: 'Быстрые победы', priority: 80, effort: 'минуты',
        title: 'Употреби Rift Prism: +11 MP навсегда',
        why: 'Rift Prism уже у тебя. После употребления она навсегда добавляет 11 Magical Power и бесплатный вход в Rift.',
        how: [ru`Rift Prism лежит: ${ctx.owned.get('RIFT_PRISM')[0].where}`],
        items: ['RIFT_PRISM'],
        payoff: '+11 MP',
      });
    } else if (price && (perMp <= cheapLimit || price <= (ctx.liquid || 0))) {
      add({
        id: 'mp-rift-prism', cat: 'Аксессуары и Magical Power', priority: perMp <= cheapLimit ? 70 : 38, effort: 'дорого',
        title: ru`Rift Prism: +11 MP за ~${fmtCoins(price)}`,
        why: ru`Покупается на аукционе, ~${fmtCoins(perMp)} за 1 MP. После употребления даёт +11 Magical Power навсегда и бесплатный вход в Rift.`,
        how: [ru`Купить: Rift Prism — ~${fmtCoins(price)}`, 'Сравни цену за 1 MP с шагами про аксессуары: обычно сначала выгоднее они'],
        items: ['RIFT_PRISM'],
        cost: price,
        payoff: '+11 MP',
        link: 'accessories',
      });
    }
  }

  const tuning = m.tuning || {};
  const slot0 = tuning.slot_0 || {};
  const spent = Object.values(slot0).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
  const points = tuningPoints({ ...m, magicalPower: mp });
  if (mp >= 100 && spent < points * 0.8) {
    add({
      id: 'mp-tuning', cat: 'Быстрые победы', priority: 78, effort: 'минуты',
      title: ru`Распредели Tuning Points: использовано ${spent} из ~${points}`,
      why: 'Каждые 10 MP дают 1 очко настройки (Tuning) — бесплатные статы. Нераспределённые очки ничего не дают.',
      how: ['Accessory Bag → Accessory Bag Thaumaturgy → Stats Tuning', 'Для данжей и боя обычно вкладывают в Crit Damage и Strength'],
      calc: tuningCalc(ctx, points - spent),
    });
  }
  const bp = bestPowerForMelee(m, ctx.power?.world);
  if (!m.selectedPower && mp >= 100) {
    add({
      id: 'mp-power', cat: 'Быстрые победы', priority: 77, effort: 'минуты',
      title: 'Выбери Power в Accessory Bag',
      why: 'Power превращает Magical Power в статы. Без выбранной силы большая часть пользы от аксессуаров теряется.',
      how: ['Accessory Bag → Accessory Bag Thaumaturgy → выбери Power', 'Сильные Power открываются Power Stone (через Maxwell)'],
      calc: bp && bp.gain > 0 ? ru`Для урона мечом лучше всего ${prettyId(bp.power)}: примерно ${statLine(bp.delta)}, удар +${pct(bp.gain)}` : undefined,
    });
  } else if (bp && bp.gain >= 0.03 && m.dungeons?.selectedClass !== 'mage' && bp.power !== String(m.selectedPower).toLowerCase()) {
    // Мага не трогаем: его урон от Intelligence, а не от удара мечом
    add({
      id: 'mp-power-switch', cat: 'Аксессуары и Magical Power', priority: 66, effort: 'минуты',
      title: ru`Смени Power на ${prettyId(bp.power)}: удар мечом примерно +${pct(bp.gain)}`,
      why: ru`Сейчас выбрана ${prettyId(m.selectedPower)}. При твоих ${fmtNum(mp)} MP сила ${prettyId(bp.power)} даёт больше урона в ближнем бою.${(() => { const cc = Math.round((ctx.power?.world?.crit_chance || 0) + (bp.delta.crit_chance || 0)); return bp.delta.crit_chance < 0 && cc < 100 ? ru` Crit Chance упадёт примерно до ${Math.max(0, cc)}% — это уже учтено в расчёте, но критов станет меньше.` : ''; })()} Если играешь магом или тебе важнее защита, оставь как есть.`,
      how: ['Accessory Bag → Accessory Bag Thaumaturgy → выбери Power', 'Смена бесплатная, вернуть можно в любой момент'],
      calc: ru`Примерно ${statLine(bp.delta)} по сравнению с ${prettyId(m.selectedPower)}`,
      link: 'accessories',
    });
  }
}

/** Расчёт для свободных очков Tuning: куда выгоднее для удара мечом */
function tuningCalc(ctx, free) {
  const base = ctx.power?.world;
  if (!base || free <= 0) return undefined;
  const str = hitGain(base, { strength: free }), cd = hitGain(base, { crit_damage: free });
  const [name, g] = str >= cd ? ['Strength', str] : ['Crit Damage', cd];
  return ru`${free} ${plural(free, 'свободное очко', 'свободных очка', 'свободных очков')} в ${name}: удар мечом примерно +${pct(g)}`;
}

export function petRules(ctx, add) {
  const m = ctx.m;
  const best = bestPets(ctx);
  const sk = k => m.skills?.[k]?.level || 0;
  const active = (m.pets || []).find(p => p.active);
  const goals = new Set(['combat']);
  if ((m.dungeons?.catacombs?.level || 0) >= 15) goals.add('dungeons');
  if (Object.values(m.slayers || {}).some(s => s.level >= 4)) goals.add('slayer');
  if (m.crimson?.faction) goals.add('crimson');
  if (sk('farming') >= 30) goals.add('farming');
  if (sk('mining') >= 30) goals.add('mining');
  if (sk('fishing') >= 20) goals.add('fishing');
  if (sk('foraging') < 50) goals.add('foraging');
  if ((ctx.liquid || 0) >= 1e9 || sk('combat') >= 45) goals.add('late');

  // Недостающие ключевые питомцы
  const missing = KEY_PETS.pets.filter(p => goals.has(p.when)).filter(p => {
    const have = best.get(p.type);
    return !have || petTierIndex(have.tier) < p.tier;
  });
  if (missing.length) {
    const rows = missing.map(p => ({ ...p, price: ctx.price(tx`${p.type};${p.tier}`) }));
    rows.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    add({
      id: 'pets-missing', cat: 'Питомцы', priority: 60, effort: 'монеты',
      title: ru`Недостающие ключевые питомцы: ${rows.length}`,
      why: 'Под каждое занятие есть питомец, который даёт заметный прирост. Ниже — те, которых у тебя нет или которые ниже нужной редкости.',
      how: rows.map(p => tx`${prettyId(p.type)} (${PET_TIER_RU[p.tier]}) — ${p.role}: ${p.why}${p.price ? tx`, ~${fmtCoins(p.price)}` : ''}`),
      items: rows.map(p => tx`${p.type};${p.tier}`),
      // Цена самого дешёвого из списка: если не по карману даже он, шаг уходит вниз как покупка «накопить»
      cost: rows[0]?.price || undefined,
      link: 'pets',
    });
  }

  // Кап Taming: квест George в Pet Care — 10 конкретных питомцев не ниже нужной редкости
  if ((m.tamingCap || 50) < 60) {
    const plan = tamingCapPlan({ tamingCap: m.tamingCap || 50, sacrificed: m.tamingSacrificedTypes || [], pets: m.pets || [], price: ctx.price });
    const left = plan.left;
    const line = c => ru`${prettyId(c.type)} (${PET_TIER_RU[RARITIES.indexOf(c.minTier)]} или выше)${c.owned ? ' — уже есть у тебя' : c.cost ? tx`, ~${fmtCoins(c.cost)}` : ''}`;
    add({
      id: 'pets-taming-cap', cat: 'Питомцы', priority: 66, effort: 'монеты',
      title: ru`Подними кап Taming: ${m.tamingCap} → 60`,
      why: ru`George в Pet Care поднимает кап Taming на 1 за каждого питомца из своего списка (всего 10). Сдано ${m.tamingSacrificed || 0} из 10. Уровень Taming усиливает всех питомцев и даёт SkyBlock XP.`,
      how: [
        'Hub → Pet Care → George: отдай ему питомца из списка (продажа George), порядок любой',
        ...plan.candidates.map(c => ru`Нужен: ${line(c)}`),
        'Своего рабочего питомца не отдавай: дешевле купить отдельного на аукционе',
      ],
      payoff: ru`+${left} к капу Taming`,
      link: 'pets',
    });
  }

  // Предмет у активного питомца
  if (active && !active.heldItem) {
    add({
      id: 'pets-held-item', cat: 'Быстрые победы', priority: 72, effort: 'минуты',
      title: ru`Дай активному питомцу (${prettyId(active.type)}) предмет`,
      why: 'Pet Item усиливает питомца или ускоряет его прокачку. Пустой слот — потерянный бонус.',
      how: [
        ru`Для прокачки — Exp Boost своего скилла${ctx.price('PET_ITEM_ALL_SKILLS_BOOST_COMMON') ? ru` (All Skills Exp Boost от ~${fmtCoins(ctx.price('PET_ITEM_ALL_SKILLS_BOOST_COMMON'))})` : ''}; для боя — предмет под статы питомца`,
        'Дорогие предметы вроде Tier Boost — потом, когда хватает денег',
      ],
      items: ['PET_ITEM_ALL_SKILLS_BOOST_COMMON'],
      cost: ctx.price('PET_ITEM_ALL_SKILLS_BOOST_COMMON') || undefined,
    });
  }

  // Pet Score: уникальные типы
  const lvl100 = [...best.values()].filter(p => petLevel(ctx, p) >= 100).length;
  const lowLeg = [...best.values()].filter(p => petTierIndex(p.tier) >= 4 && petLevel(ctx, p) < 100 && goals.has(KEY_PETS.pets.find(k => k.type === p.type)?.when));
  if (lowLeg.length) {
    add({
      id: 'pets-level', cat: 'Питомцы', priority: 40, effort: 'часы',
      title: ru`Докачай важных легендарных питомцев до 100: ${lowLeg.length} шт.`,
      why: ru`Питомец даёт полный бонус только на 100 уровне. Сейчас на 100 уровне: ${lvl100} из ${best.size} типов.`,
      how: lowLeg.slice(0, 8).map(p => ru`${prettyId(p.type)} — ${petLevel(ctx, p)} ур.`).concat(['Качай на основном занятии; второй питомец получает часть опыта через предмет EXP Share']),
      link: 'pets',
    });
  }
}

const MINION_NAMES = { CAVESPIDER: 'Cave Spider', ENDER_STONE: 'End Stone', NETHERWARTS: 'Nether Wart', SNOW: 'Snow', REDSTONE: 'Redstone' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const minionTypeName = t => MINION_NAMES[t] || prettyId(t);

export function minionRules(ctx, add) {
  const list = ctx.m.minions || [];
  if (!list.length && ctx.m.inv?.apiDisabled) return;
  const unique = new Set(list).size;
  const slots = [...MINION_SLOTS].reverse().find(([n]) => unique >= n)?.[1] || 5;
  const next = MINION_SLOTS.find(([n]) => n > unique);
  // Самые дешёвые следующие тиры: у каких типов минимальный скрафченный тир
  const maxByType = {};
  for (const s of list) {
    const mm = /^(.*)_(\d+)$/.exec(s);
    if (!mm) continue;
    maxByType[mm[1]] = Math.max(maxByType[mm[1]] || 0, Number(mm[2]));
  }
  const candidates = Object.entries(ctx.data.minionMaxTier).map(([gen, max]) => {
    const type = gen.replace(/_GENERATOR$/, '');
    const cur = maxByType[type] || 0;
    return { type, cur, max };
  }).filter(c => c.cur < c.max).sort((a, b) => a.cur - b.cur || a.type.localeCompare(b.type));
  const total = Object.values(ctx.data.minionMaxTier).reduce((s, v) => s + v, 0);
  if (!next) return;
  const need = next[0] - unique;
  add({
    id: 'minions-slots', cat: 'Миньоны', priority: need <= 5 ? 56 : 30, effort: need <= 5 ? 'минуты' : 'монеты',
    title: ru`Скрафти ${need} ${plural(need, 'новый тир', 'новых тира', 'новых тиров')} миньонов: откроется ${next[1]}-й слот`,
    why: ru`Уникальных крафтов: ${unique} из ${total}, слотов сейчас ${slots} (без слотов из Community Shop). Каждый слот — ещё один пассивный источник дохода.`,
    how: [
      'Засчитывается каждый новый тир каждого типа; низкие тиры самые дешёвые — материалы бери на Bazaar',
      ...(() => {
        const fresh = candidates.filter(c => !c.cur).slice(0, 8).map(c => minionTypeName(c.type));
        const low = candidates.filter(c => c.cur).slice(0, 8).map(c => ru`${minionTypeName(c.type)} (есть до ${ROMAN[c.cur] || c.cur})`);
        return [
          ...(fresh.length ? [ru`Ещё не начаты (тир I стоит копейки): ${fresh.join(', ')}`] : []),
          ...(low.length ? [ru`Низкие тиры: ${low.join(', ')}`] : []),
        ];
      })(),
    ],
    payoff: ru`${next[1]}-й слот миньона`,
    link: 'minions',
  });
}

export function collectionRules(ctx, add) {
  const tiers = ctx.opts.collectionTiers;
  if (!tiers) return;
  const rows = [];
  for (const [id, thresholds] of Object.entries(tiers)) {
    const have = ctx.m.collections?.[id] || 0;
    const nextIdx = thresholds.findIndex(t => have < t);
    if (nextIdx < 0) continue;
    const need = thresholds[nextIdx] - have;
    const prev = nextIdx ? thresholds[nextIdx - 1] : 0;
    const progress = (have - prev) / (thresholds[nextIdx] - prev);
    rows.push({ id, tier: nextIdx + 1, max: thresholds.length, need, progress, cost: ctx.price(id) * need });
  }
  if (!rows.length) return;
  rows.sort((a, b) => b.progress - a.progress);
  const top = rows.slice(0, 10);
  add({
    id: 'collections-near', cat: 'Коллекции', priority: 32, effort: 'часы',
    title: ru`Коллекции, близкие к следующему тиру: ${top.length}`,
    why: ru`Не на максимуме ${rows.length} коллекций. Тиры коллекций открывают рецепты и дают SkyBlock XP; эти ближе всего к следующему тиру.`,
    how: top.map(r => ru`${ctx.name(r.id)}: до тира ${r.tier} из ${r.max} осталось ${fmtNum(r.need)}${r.cost ? ru` (на Bazaar ~${fmtCoins(r.cost)}, но покупка не засчитывается — нужно добыть самому)` : ''}`),
    link: 'collections',
  });
}

/** Заработок: лучший доступный метод и деньги, которые лежат без дела. */
export function moneyRules(ctx, add) {
  const methods = (ctx.opts.moneyMethods || []).filter(x => x.available);
  if (methods.length) {
    // Пассивные методы (миньоны, Forge) идут фоном — «лучший заработок» выбираем среди активных
    const active = methods.filter(x => x.mode !== 'passive');
    const sorted = [...(active.length ? active : methods)].sort((a, b) => (b.coinsPerHour || 0) - (a.coinsPerHour || 0));
    const top = sorted.slice(0, 3);
    add({
      id: 'money-best', cat: 'Деньги', priority: 68, effort: 'часы',
      title: ru`Лучший заработок сейчас: ${top[0].title}${top[0].coinsPerHour ? ru` (~${fmtCoins(top[0].coinsPerHour)}/ч)` : ''}`,
      why: 'Подобрано по твоему профилю: все требования выполнены. Деньги нужны на шаги выше — аксессуары и снаряжение.',
      how: top.map(x => tx`${x.title}${x.coinsPerHour ? ru` — ~${fmtCoins(x.coinsPerHour)}/ч${x.sourceText ? tx` (${x.sourceText})` : ''}` : ''}: ${x.detail || x.desc || ''}`.trim()),
      link: 'money',
    });
  }

  // Снаряжение из лестниц прогрессии (оружие, сеты брони, инструменты) — рабочее, продавать его не советуем
  const gearIds = new Set(), gearPrefixes = [];
  for (const l of LADDERS.ladders) for (const t of l.tiers) {
    for (const id of t.ids || []) gearIds.add(id);
    for (const set of [t.set, ...(t.altSets || [])].filter(Boolean)) gearPrefixes.push(set + '_');
    for (const f of l.families || []) gearPrefixes.push(tx`${t.prefix || ''}${f}_`);
  }
  const isGear = id => gearIds.has(id) || gearPrefixes.some(p => id.startsWith(p));
  const sellable = (ctx.gear?.topItems || [])
    .filter(i => /Backpack|Рюкзак|Ender Chest|Эндер|Vault|Хранилище/.test(i.where || '') && i.value > 5_000_000 && !isGear(i.id || ''))
    .slice(0, 8);
  if (sellable.length) {
    add({
      id: 'money-idle', cat: 'Деньги', priority: 52, effort: 'минуты',
      title: ru`Без дела лежит ~${fmtCoins(sellable.reduce((s, i) => s + i.value, 0))}`,
      why: 'Эти предметы лежат в рюкзаках и сундуках и не входят в твоё основное снаряжение. Если не пользуешься ими, продай и вложи в шаги выше.',
      how: sellable.map(i => tx`${i.name} (${i.where}) — ~${fmtCoins(i.value)}`),
      link: 'money',
    });
  }
}

/** Лучший активный заработок игрока, монет в час (0 — способы заработка не посчитаны). */
export const bestPerHour = ctx => Math.max(0, ...((ctx.opts.moneyMethods || []).filter(x => x.available && x.mode !== 'passive').map(x => x.coinsPerHour || 0)));

/** План покупок: шаги с ценой по порядку приоритета и сколько часов заработка они стоят. */
export function purchasePlan(steps, ctx) {
  const buy = steps.filter(s => s.cost > 0).sort((a, b) => b.priority - a.priority);
  const perHour = bestPerHour(ctx);
  let acc = 0;
  return buy.map(s => {
    acc += s.cost;
    return {
      stepId: s.id, title: s.title, cost: s.cost, cumulative: acc,
      affordableNow: acc <= ctx.liquid,
      hoursOfFarming: perHour ? Math.max(0, (acc - ctx.liquid) / perHour) : null,
    };
  });
}
