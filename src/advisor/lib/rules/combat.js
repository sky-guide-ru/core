// Dungeons, слееры, Crimson Isle и Kuudra.
import LADDERS from '../../data/ladders.json' with { type: 'json' };
import { fmtCoins, fmtNum, plural } from '../util.js';
import { dojoState } from '../../../guides/crimson-data.js';
import { masterReadiness } from '../../../calc/power.js';
import { slayerPlan, VERDICT_RU, secText } from '../../../calc/slayer-ready.js';
import { QUEST_COST } from '../../../calc/slayer-bosses.js';
import { kitText } from '../../../calc/kit.js';
import { ru } from '../../../../i18n/msg.js';
import { tx } from '../../../../i18n/msg.js';

export const MASTER_REQ = { 1: 24, 2: 26, 3: 28, 4: 30, 5: 32, 6: 34, 7: 36 };
// Репутация фракции, нужная для тиров Kuudra
export const KUUDRA_TIERS = [
  { key: 'basic', name: 'Basic', rep: 0 },
  { key: 'hot', name: 'Hot', rep: 1000 },
  { key: 'burning', name: 'Burning', rep: 3000 },
  { key: 'fiery', name: 'Fiery', rep: 7000 },
  { key: 'infernal', name: 'Infernal', rep: 12000 },
];
const SLAYER_ORDER = ['zombie', 'spider', 'wolf', 'enderman', 'blaze', 'vampire'];
const SLAYER_WHERE = {
  zombie: 'Hub → Graveyard или Crypts',
  spider: "Spider's Den → Arachne's Burrow",
  wolf: 'Hub → Ruins или Howling Cave в Парке',
  enderman: 'The End → Dragon\'s Nest / Void Sepulture',
  blaze: 'Crimson Isle → Smoldering Tomb и Stronghold',
  vampire: 'Rift → Stillgore Château',
};

/** Какие предметы из лестниц открывает данный уровень слеера. */
function unlocksAt(slayer, level) {
  const out = [];
  for (const l of LADDERS.ladders) for (const t of l.tiers) if (t.req?.slayer === slayer && t.req.level === level) out.push(t.name);
  return out;
}

// Master Stars падают только с боссов M3–M7: First — M3 (The Professor), … Fifth — M7 (Necron). На M1–M2 их нет.
const MASTER_STAR_IDS = { 3: 'FIRST_MASTER_STAR', 4: 'SECOND_MASTER_STAR', 5: 'THIRD_MASTER_STAR', 6: 'FOURTH_MASTER_STAR', 7: 'FIFTH_MASTER_STAR' };
const MASTER_STAR_BY_FLOOR = { 3: 'First Master Star', 4: 'Second Master Star', 5: 'Third Master Star', 6: 'Fourth Master Star', 7: 'Fifth Master Star' };

export function dungeonRules(ctx, add) {
  const d = ctx.m.dungeons;
  if (!d) return;
  const cata = d.catacombs.level;
  const mf = d.masterFloors || {};
  const f7 = Number(d.floors?.['7'] || 0);
  // M-этаж открыт, если хватает уровня Catacombs И пройден предыдущий этаж (M1 — после F7, M2 — после M1, …)
  const doneM = f => Number(mf[String(f)]) > 0;
  const unlocked = [];
  for (const [f, r] of Object.entries(MASTER_REQ).map(([f, r]) => [Number(f), r]).sort((a, b) => a[0] - b[0])) {
    if (cata < r || (f === 1 ? !(f7 > 0) : !doneM(f - 1))) break;
    unlocked.push(f);
  }
  const notDone = unlocked.filter(f => !doneM(f));

  if (f7 > 0 && notDone.length) {
    const next = notDone[0];
    const r = masterReadiness(ctx.m, next, ctx.power);
    const gaps = r.checks.filter(c => !c.ok).map(c => c.text);
    const ehpLine = r.ehp ? ru` EHP в данже примерно ${fmtNum(r.ehp)}.` : '';
    // M1 и M2 — ступенька: опыта меньше, чем на F7 (10k и 15k против 30k), лут как у F4 и F5.
    // Смысл в том, что они открывают M3, где начинаются Master Stars и опыт больше, чем на F7.
    const stepping = next <= 2;
    const why = stepping
      ? ru`Catacombs ${cata}, F7 пройден ${f7} ${plural(f7, 'раз', 'раза', 'раз')}. M${next} даёт меньше опыта Catacombs, чем F7 (${next === 1 ? '10 000' : '15 000'} против 30 000), и лут слабее. Его проходят ради доступа к M3: Master Stars падают начиная с M3, и опыта там уже больше, чем на F7.`
      : ru`Catacombs ${cata}, M${next - 1} пройден. M${next} даёт больше опыта Catacombs, чем F7, и ценный лут: ${MASTER_STAR_BY_FLOOR[next] ? tx`${MASTER_STAR_BY_FLOOR[next]}, ` : ''}Recombobulator 3000, дорогие книги.`;
    if (r.verdict === 'early') {
      add({
        id: 'dungeon-master-prep', cat: 'Dungeons', priority: 60, effort: 'долго',
        title: ru`Подготовься к M${next}: сейчас рано`,
        why: ru`Уровень Catacombs уже позволяет зайти на M${next}, но по снаряжению пока рано: мобы и боссы там намного крепче, чем на F${next}.${ehpLine} ${stepping ? 'Пока выгоднее фармить F7: он даёт больше опыта, чем M1 и M2.' : ru`Пока выгоднее фармить M${next - 1}, где ты уже проходишь.`}`,
        how: [...gaps.map(g => ru`Не хватает: ${g}`), stepping ? 'Продолжай F7 на S+ и закрывай шаги по Magical Power и снаряжению выше' : ru`Продолжай M${next - 1} и закрывай шаги по Magical Power и снаряжению выше`],
        calc: ru`Готовность к M${next} примерно ${Math.round(r.score * 100)}%`,
        link: 'dungeons',
      });
    } else {
      add({
        id: 'dungeon-master', cat: 'Dungeons', priority: r.verdict === 'ready' ? (stepping ? 70 : 84) : (stepping ? 58 : 66), effort: 'часы',
        title: unlocked.some(doneM) ? ru`Пройди M${next}: следующий открытый этаж Master Mode` : ru`Начни Master Mode с M${next}`,
        why: why + ehpLine,
        how: [
          ...(gaps.length ? gaps.map(g => ru`Подтяни: ${g}`) : []),
          ru`Dungeon Hub → Party Finder (или вход в Catacombs) → выбери Master Mode, этаж M${next}`,
          ru`Механики те же, что на F${next}, но мобы и боссы сильнее`,
          'На первых заходах помогает Kismet Feather для перекрутки сундука',
        ],
        calc: ru`Готовность к M${next} примерно ${Math.round(r.score * 100)}%${r.verdict === 'ready' ? ': снаряжение подходит' : ': почти готов'}`,
        items: [next >= 3 ? MASTER_STAR_IDS[next] : 'RECOMBOBULATOR_3000', 'KISMET_FEATHER'],
        payoff: stepping ? 'Доступ к M3 и Master Stars' : 'Больше опыта Catacombs и доход с сундуков',
        link: 'dungeons',
      });
    }
  }

  if (cata < 50) {
    const next = Object.entries(MASTER_REQ).find(([, r]) => r > cata);
    const target = next ? next[1] : Math.min(50, cata + 1);
    const left = Math.max(0, (d.catacombs.xpForNext || 0) - (d.catacombs.xpCurrent || 0));
    add({
      id: 'dungeon-cata', cat: 'Dungeons', priority: next ? 72 : 55, effort: 'долго',
      title: ru`Качай Catacombs до ${target}${next ? ru`: откроет M${next[0]}` : ''}`,
      why: ru`Сейчас ${cata} (${Math.round((d.catacombs.progress || 0) * 100)}% до ${cata + 1}, осталось ${fmtNum(left)} опыта). Каждый уровень Catacombs усиливает всё данж-снаряжение${next ? ru`, а ${next[1]} открывает новый Master-этаж` : ''}.`,
      how: [
        unlocked.filter(f => f >= 3).length ? ru`Лучший опыт сейчас: M${unlocked[unlocked.length - 1]} на S+ (если хватает снаряжения)` : 'Лучший опыт сейчас: F7 на S+ (M1 и M2 дают меньше опыта, чем F7)',
        'Включай зелье опыта данжей и выбирай мэра/перки с бонусом к опыту Catacombs, когда они есть',
        'Играй выбранным классом: остальным идёт только 25% опыта',
      ],
      payoff: next ? ru`Доступ к M${next[0]}` : 'Сильнее данж-снаряжение',
      link: 'dungeons',
    });
  }

  const weak = Object.entries(d.classes || {}).filter(([, c]) => c.level < cata - 8);
  if (weak.length) {
    add({
      id: 'dungeon-classes', cat: 'Dungeons', priority: 34, effort: 'долго',
      title: ru`Подтяни отстающие классы: ${weak.map(([, c]) => tx`${c.name} ${c.level}`).join(', ')}`,
      why: ru`Средний уровень классов ${d.classAverage.toFixed(1)}. Он нужен для достижений и SkyBlock XP, а в группе иногда не хватает именно этого класса.`,
      how: ['Играй отстающим классом на лёгких этажах (F5–F7 или M1)', 'В Party Finder ищи группы, где нужен этот класс'],
    });
  }
}

// Как сказать, во что одеться: сохранённый набор игры, если он почти не хуже лучшего, иначе — лучший набор целиком
function wearLine(t) {
  if (!t?.best) return null;
  const sv = t.saved?.[0];
  const rank = { easy: 3, ok: 2, hard: 1, no: 0 };
  if (sv?.loadout?.name && rank[sv.verdict] >= rank[t.best.verdict] && sv.f.ttk <= t.best.f.ttk * 1.25) {
    return ru`Надень свой набор «${sv.loadout.name}» и возьми ${sv.weapon.name}`;
  }
  return ru`Надень: ${kitText(t.best)}`;
}

/** «С кинжалами T2 по твоим статам: тяжело, не хватает урона» — расчёт так, будто пара уже есть */
function t2Line(plan) {
  const h = plan?.tiers?.[1]?.hypo;
  if (!h) return null;
  const lack = h.lack?.length ? ru`, не хватает ${h.lack.map(x => (x === 'damage' ? 'урона' : 'живучести')).join(' и ')}` : '';
  return ru`С кинжалами T2 по твоим статам: ${VERDICT_RU[h.verdict] || h.verdict}${lack}. Подробно по каждому тиру — в гайде`;
}
const DAGGERS_TEXT = 'Firedust Dagger (Ashen и Auric) и Twilight Dagger (Spirit и Crystal)';

export function slayerRules(ctx, add) {
  const s = ctx.m.slayers || {};
  const { slayerBossXp, slayerBossXpType, slayerHighestTier } = ctx.data;
  const kit = typeof ctx.kit === 'function' ? ctx.kit() : null;
  const aatrox = (ctx.mayorPerks || []).includes('Slayer XP Buff');

  for (const key of SLAYER_ORDER) {
    const sl = s[key];
    if (!sl) continue;
    if (sl.level >= sl.maxLevel) continue;
    const bossXp = slayerBossXpType[key] || slayerBossXp;
    const maxTier = slayerHighestTier[key] || 4;
    const costs = QUEST_COST[key] || QUEST_COST.default;
    let plan = null;
    if (key !== 'vampire') { try { plan = slayerPlan(ctx.m, key, kit, bossXp); } catch { plan = null; } }
    const doneTiers = Object.entries(sl.kills || {}).filter(([, k]) => k > 0).map(([t]) => Number(t));
    const top = doneTiers.length ? Math.max(...doneTiers) : 0;
    const left = Math.max(0, (sl.xpForNext || 0) - (sl.xp || 0));
    const unlocks = unlocksAt(key, sl.level + 1);

    // Blaze до 2 уровня: T2+ без кинжалов не пробить, а кинжалы берутся в руки только со 2 уровня
    if (key === 'blaze' && sl.level < 2) {
      if (plan?.prereq) continue; // Blaze ещё закрыт: сначала Voidgloom T3 — это шаг Enderman
      const xp2 = (ctx.data.slayerXp?.blaze || [])[1] || 30;
      const need = Math.max(1, Math.ceil((xp2 - (sl.xp || 0)) / bossXp[0]));
      const t1 = plan?.tiers?.[0];
      const calc = t1?.best && ['easy', 'ok'].includes(t1.verdict)
        ? ru` По твоим статам T1 ${VERDICT_RU[t1.verdict]}: босс с демонами умирает примерно за ${secText(t1.best.f.ttk)}.`
        : t1?.best ? ru` По твоим статам T1 пока ${VERDICT_RU[t1.verdict]}: подтяни урон или Health.` : '';
      const daggers = ['FIREDUST_DAGGER', 'MAWDUST_DAGGER'];
      const daggerCost = daggers.reduce((sum, id) => sum + ctx.price(id), 0);
      add({
        id: 'slayer-blaze', cat: 'Slayers', priority: 82, effort: 'часы',
        title: ru`Inferno Demonlord (Blaze): ${need} ${plural(need, 'босс', 'босса', 'боссов')} T1 до 2 уровня`,
        why: ru`Blaze-слеер у тебя ${sl.level} уровня. С T2 у босса Hellion Shield: без кинжала с нужной Attunement урон режется на 99%, а кинжалы открываются на 2 уровне.${calc}`,
        how: [
          wearLine(t1),
          ru`Квест T1 у Maddox the Slayer (${fmtCoins(costs[0])}), бой в ${SLAYER_WHERE.blaze}`,
          ru`На 2 уровне купи на Auction House или скрафти ${DAGGERS_TEXT}: два кинжала закрывают все четыре Attunement${daggerCost ? ru` (сейчас ~${fmtCoins(daggerCost)} за оба)` : ''}`,
          t2Line(plan),
          'Крафт: Firedust — 30 Silver Magmafish и 1 Molten Powder, Twilight — 5 Enchanted Sulphur и 1 Molten Powder; ПКМ меняет Attunement, цвет должен совпадать со щитом',
        ].filter(Boolean),
        payoff: 'Кинжалы для T2+, статы, SkyBlock XP',
        items: daggers,
        link: 'slayers',
      });
      continue;
    }

    if (sl.level === 0 && key === 'vampire') {
      add({
        id: 'slayer-vampire', cat: 'Slayers', priority: 68, effort: 'часы',
        title: ru`Начни ${sl.name} (${sl.ru}): сейчас уровень 0`,
        why: 'Вампир-слеер (Rift) даёт постоянные статы и предметы Rift. Пять уровней качаются за пару вечеров и добавляют SkyBlock XP.',
        how: ['Rift → Stillgore Château → NPC вампир-слеера', 'Нужен Steak Stake, чтобы добить босса', 'Квест стоит Motes, а не монеты: копи их в Rift'],
        payoff: 'Статы и SkyBlock XP',
        items: ['STEAK_STAKE'],
        link: 'slayers',
      });
      continue;
    }
    if (plan?.prereq && sl.level === 0) continue; // босс ещё закрыт: его откроет шаг предыдущего слеера

    // Blaze 2+ без кинжалов: главное — кинжалы
    if (key === 'blaze' && plan && plan.tiers[1]?.verdict === 'no-weapon') {
      add({
        id: 'slayer-blaze', cat: 'Slayers', priority: 80, effort: 'минуты',
        title: 'Возьми кинжалы для Inferno Demonlord T2+',
        why: ru`Blaze ${sl.level} уровня открывает кинжалы, а без них по T2+ проходит только 1% урона. Нужны оба: ${DAGGERS_TEXT}.`,
        how: ['Купи на Auction House или скрафти: Firedust — 30 Silver Magmafish и 1 Molten Powder, Twilight — 5 Enchanted Sulphur и 1 Molten Powder', 'ПКМ меняет Attunement, щит босса меняется каждые 8 ударов', t2Line(plan)].filter(Boolean),
        payoff: 'Доступ к T2–T4',
        items: ['FIREDUST_DAGGER', 'MAWDUST_DAGGER'],
        link: 'slayers',
      });
      continue;
    }

    const farm = plan?.farm || null;
    const tier = Math.min(maxTier, farm?.tier || Math.max(1, top));
    const bosses = Math.ceil(left / bossXp[tier - 1]);
    const questCost = bosses * (costs[tier - 1] || 0);
    const how = [ru`Где: ${SLAYER_WHERE[key]}`];
    if (farm && farm.verdict !== 'proven') { const w = wearLine(farm); if (w) how.push(w); }
    else if (farm?.saved?.[0]?.loadout?.name) how.push(ru`Из твоих наборов сюда лучше всего подходит «${farm.saved[0].loadout.name}»`);
    const nx = plan?.next;
    let nextNote = '';
    if (nx && nx.tier <= maxTier) {
      const mult = bossXp[nx.tier - 1] / bossXp[tier - 1];
      const nb = Math.ceil(left / bossXp[nx.tier - 1]);
      const multText = Number.isInteger(mult) ? mult : mult.toFixed(1).replace('.', ',');
      const failed = Math.max(0, nx.attempts - nx.kills);
      if (!nx.open && nx.needLevel > sl.level) nextNote = ru` T${nx.tier} откроется на ${nx.needLevel} уровне.`;
      else if (nx.verdict === 'hard' || nx.verdict === 'no') {
        nextNote = ru` T${nx.tier} даёт в ${multText} раза больше опыта (~${fmtNum(nb)} ${plural(nb, 'босс', 'босса', 'боссов')}), но по твоим статам пока ${nx.verdict === 'hard' ? 'тяжело' : 'рано'}${failed ? ru`: ${failed} ${plural(failed, 'попытка', 'попытки', 'попыток')} без победы` : ''}.`;
        const r = nx.ratio;
        if (r) {
          const lack = [r.ttk > 3 ? ru`урон (бой примерно в ${Math.round(r.ttk)} раз дольше, чем на T${r.vs})` : null, r.survive < 0.5 ? ru`живучесть (продержишься примерно в ${Math.round(1 / Math.max(r.survive, 0.01))} раз меньше)` : null].filter(Boolean);
          if (lack.length) how.push(ru`Для T${nx.tier} не хватает: ${lack.length > 1 ? ru`${lack[0]} и ${lack[1]}` : lack[0]}`);
        }
        const w = nx.best ? wearLine(nx) : null;
        if (w && w !== wearLine(farm)) how.push(ru`Для T${nx.tier}: ${w.replace(/^Надень/, 'надень')}`);
      }
    }
    how.push(doneTiers.length ? ru`Твои победы: ${doneTiers.map(t => tx`T${t}: ${sl.kills[t]}`).join(', ')}` : 'Начни с T1–T2, потом поднимай тир');
    if (aatrox) how.push('Сейчас мэр Aatrox: перк Slayer XP Buff даёт +25% опыта слееров');
    const tierWord = farm && farm.verdict !== 'proven' && farm.tier > top ? ru` T${tier} по твоим статам ${VERDICT_RU[farm.verdict]}, а опыта за босса больше.` : '';
    add({
      id: tx`slayer-${key}`, cat: 'Slayers', priority: 38 + (sl.maxLevel - sl.level) * 3 + (unlocks.length ? 10 : 0) + (aatrox ? 6 : 0), effort: bosses > 60 ? 'долго' : 'часы',
      title: tx`${sl.name} (${sl.ru}) ${sl.level} → ${sl.level + 1}: ~${fmtNum(bosses)} ${plural(bosses, 'босс', 'босса', 'боссов')} T${tier}`,
      why: ru`Осталось ${fmtNum(left)} опыта слеера${key === 'vampire' ? '' : ru`, квесты ~${fmtCoins(questCost)}`}.${tierWord}${unlocks.length ? ru` Откроет: ${unlocks.join(', ')}.` : ' Новый уровень даёт постоянные статы.'}${nextNote}`,
      how,
      payoff: unlocks.length ? ru`Новое снаряжение: ${unlocks.join(', ')}` : 'Постоянные статы',
      link: 'slayers',
    });
  }
}

export function crimsonRules(ctx, add) {
  const c = ctx.m.crimson;
  if (!c) return;
  const rep = Math.max(c.barbarianRep || 0, c.mageRep || 0);
  const k = c.kuudra || {};
  const total = KUUDRA_TIERS.reduce((s, t) => s + (k[t.key] || 0), 0);
  const unlocked = KUUDRA_TIERS.filter(t => rep >= t.rep);
  const highestDone = [...KUUDRA_TIERS].reverse().find(t => (k[t.key] || 0) > 0);
  const nextLocked = KUUDRA_TIERS.find(t => rep < t.rep);
  const farmTier = unlocked.filter(t => KUUDRA_TIERS.indexOf(t) <= (highestDone ? KUUDRA_TIERS.indexOf(highestDone) + 1 : 0)).pop() || KUUDRA_TIERS[0];

  if (!c.faction) {
    add({
      id: 'crimson-faction', cat: 'Crimson Isle и Kuudra', priority: 60, effort: 'часы',
      title: 'Открой Crimson Isle и выбери фракцию',
      why: 'Без фракции нет квестов репутации, а без репутации не открываются тиры Kuudra.',
      how: ['На Crimson Isle ведёт лаунчпад в глубине Spider\'s Den (нужен Combat 24)', 'Mages (Scarleton) или Barbarians (Dragontail): на тиры Kuudra засчитывается репутация любой. Сменить можно у Elle, но репутация сгорит'],
    });
    return;
  }

  add({
    id: 'kuudra', cat: 'Crimson Isle и Kuudra', priority: total < 20 ? 74 : 55, effort: 'часы',
    title: total < 20 ? ru`Kuudra: всего ${total} ${plural(total, 'заход', 'захода', 'заходов')}, фарми ${farmTier.name}` : ((k[farmTier.key] || 0) >= 10 ? ru`Kuudra: фарми ${farmTier.name}` : ru`Kuudra: переходи на ${farmTier.name}`),
    why: ru`Репутация фракции ${fmtNum(rep)}: открыты ${unlocked.map(t => t.name).join(', ')}.${nextLocked ? ru` Для ${nextLocked.name} нужно ${fmtNum(nextLocked.rep)} репутации.` : ''} Kuudra — стабильный заработок: броня, атрибуты, Kuudra Teeth и эссенция Crimson, а ещё основа для улучшения брони Kuudra.`,
    how: [
      'Платный сундук открывается Kuudra Key своего тира (крафт за монеты и материалы; ещё падает с мини-боссов, а за Nether Star его продаёт Emissary) — сверяй его цену с ценой лута',
      ru`Прохождения по тирам: ${KUUDRA_TIERS.map(t => tx`${t.name} ${k[t.key] || 0}`).join(', ')}`,
      nextLocked ? ru`Репутацию проще всего добрать ежедневными квестами фракции (${fmtNum(nextLocked.rep - rep)} до ${nextLocked.name})` : 'Все тиры открыты — фарми максимальный тир, который проходишь стабильно',
    ],
    items: ['KUUDRA_TEETH', 'ESSENCE_CRIMSON'],
    payoff: 'Регулярный доход и материалы для брони Kuudra',
    link: 'crimson',
  });

  if (nextLocked && rep < nextLocked.rep) {
    add({
      id: 'crimson-rep', cat: 'Crimson Isle и Kuudra', priority: 46, effort: 'часы',
      title: ru`Добери репутацию до ${fmtNum(nextLocked.rep)}: откроет Kuudra ${nextLocked.name}`,
      why: ru`Сейчас ${fmtNum(rep)} репутации (${c.faction === 'mages' ? 'Mages' : 'Barbarians'}). Высокие тиры Kuudra дают в разы более дорогой лут.`,
      how: ['До 5 квестов фракции в день на доске в Community Center своего города', 'Типы квестов: мини-босс, принести предметы, рыбалка, спасение, Dojo, Kuudra'],
      link: 'crimson',
    });
  }

  const dojo = dojoState(c.dojo);
  if (dojo.tried > 0 && dojo.tried < 7) {
    add({
      id: 'crimson-dojo', cat: 'Crimson Isle и Kuudra', priority: 22, effort: 'минуты',
      title: ru`Пройди все испытания Dojo (${dojo.tried}/7)`,
      why: 'Пояс Dojo — отдельный слот экипировки, а квесты фракции «Dojo» требуют минимальный ранг.',
      how: [ru`Не пройдены: ${dojo.tests.filter(t => !t.tried).map(t => t.name).join(', ')}`, 'Вход с пустым инвентарём и без питомца'],
      link: 'crimson',
    });
  } else if (dojo.tried === 7 && dojo.sRanks < 7) {
    const w = dojo.tests.filter(t => t.rank !== 'S').sort((a, b) => a.points - b.points)[0];
    add({
      id: 'crimson-dojo', cat: 'Crimson Isle и Kuudra', priority: 18, effort: 'минуты',
      title: ru`Dojo: подтяни ${w.name} (${fmtNum(w.points)}, ранг ${w.rank})`,
      why: ru`S-рангов ${dojo.sRanks}/7. Чёрный пояс — это S во всех семи испытаниях.`,
      how: [w.tip],
      link: 'crimson',
    });
  }
}

