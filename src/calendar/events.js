// События календаря SkyBlock: постоянные (в одни и те же дни каждого года), ежемесячные, ежечасные
// и зависящие от мэра. Даты — по календарю SkyBlock, реальное время считается в time.js.
// Сверено 23.11.2026 по fandom-вики (Hoppity's Hunt, Traveling Zoo, Spooky Festival, Jerry's Workshop, Season of Jerry,
// New Year Celebration, Cult of the Fallen Star, Dark Auction, Jacob's Farming Contest).
import { sbDate, sbStart, DAY, HOUR, MONTH, YEAR } from './time.js';

// tier: 'big' — редкое и важное (советчик реагирует на старт), 'small' — частое (каждый час, только список «скоро»)
// days: [месяц 0..11, первый день, последний день] — события года
export const YEARLY = [
  { id: 'hoppity', name: 'Охота Hoppity', en: "Hoppity's Hunt", icon: 'RABBIT_HAT', color: '#f59ec0', tier: 'big', days: [[0, 1, 31], [1, 1, 31], [2, 1, 31]],
    what: 'Весенняя охота за яйцами для шоколадной фабрики.',
    tip: 'Ивент идёт почти всю весну SkyBlock (около 31 часа). Каждый час появляется 9 яиц: завтрак, обед и ужин, по три раза. Яйцо одно на все острова сразу; собирай их ради новых кроликов. Сам Hoppity продаёт кроликов под уровень твоей шоколадной фабрики.' },
  { id: 'zoo-summer', name: 'Бродячий зоопарк', en: 'Traveling Zoo', icon: 'LION;4', color: '#f0b429', tier: 'big', days: [[3, 1, 3]],
    what: 'Oringo в Hub продаёт редких питомцев.',
    tip: 'Oringo стоит в Hub 3 дня SkyBlock (1 реальный час) и продаёт 3 из 6 питомцев (лев, тигр, синий кит, слон, жираф, обезьяна): один — легендарный по очереди, два — случайные от обычного до эпического. Бывает два раза в год.' },
  { id: 'spooky', name: 'Хэллоуинский фестиваль', en: 'Spooky Festival', icon: 'JACK_O_LANTERN', color: '#ff7b2e', tier: 'big', days: [[7, 29, 31]],
    what: '1 час: конфеты с мобов.',
    tip: 'С мобов падают Green и Purple Candy, ночью шанс выше. Конфеты меняются у Fear Mongerer в Hub на хэллоуинские предметы и питомцев.' },
  { id: 'zoo-winter', name: 'Бродячий зоопарк', en: 'Traveling Zoo', icon: 'LION;4', color: '#f0b429', tier: 'big', days: [[9, 1, 3]],
    what: 'Oringo в Hub продаёт редких питомцев.',
    tip: 'Oringo стоит в Hub 3 дня SkyBlock (1 реальный час): 3 питомца, один из них легендарный по очереди.' },
  { id: 'workshop', name: 'Мастерская Jerry открыта', en: "Jerry's Workshop", icon: 'SNOW_BALL', color: '#8fd3ff', tier: 'big', days: [[11, 1, 31]],
    what: 'Зимний остров Jerry открыт весь Late Winter (около 10 часов).',
    tip: 'На острове зимняя рыбалка (Frozen Steve, Yeti, Reindrake), ледяная пещера и подарки. Хорошее время для рыбалки и коллекции льда.' },
  { id: 'jerry', name: 'Сезон Jerry', en: 'Season of Jerry', icon: 'WHITE_GIFT', color: '#ef5350', tier: 'big', days: [[11, 24, 26]],
    what: 'Защита мастерской Jerry: 5 волн за 1 реальный час.',
    tip: 'Главное событие — защита мастерской: 5 раундов против лавовых мобов (больше всего Magma Cube). После каждого раунда — подарки по нанесённому урону.' },
  { id: 'newyear', name: 'Новый год', en: 'New Year Celebration', icon: 'NEW_YEAR_CAKE', color: '#ffd54a', tier: 'big', days: [[11, 29, 31]],
    what: 'Baker в Hub раздаёт New Year Cake.',
    tip: 'Забери у Baker в Hub бесплатный New Year Cake этого года: торты разных лет собирают в Cake Bag ради Cake Soul.' },
];

// Каждый месяц: дни 7, 14, 21, 28, с 00:00 до 06:00 по времени SkyBlock (5 минут реального времени)
export const CULT = { id: 'cult', name: 'Культ Падшей звезды', en: 'Cult of the Fallen Star', icon: 'STARFALL', color: '#a78bfa', tier: 'small', days: [7, 14, 21, 28], hours: 6,
  what: 'Встреча культа в Dwarven Mines.',
  tip: 'Пещера культа — в Cliffside Veins (Dwarven Mines), к ней удобно подняться по лавовому каналу из Lava Springs. Приходи с 0 до 6 утра SkyBlock: это всего 5 реальных минут.' };

// Ежечасные: Dark Auction в :55, конкурс Jacob в :15 (каждые 3 дня SkyBlock)
export const HOURLY = [
  { id: 'jacob', name: 'Конкурс фермеров Jacob', en: "Jacob's Farming Contest", icon: 'JACOBS_TICKET', color: '#9ccc65', tier: 'small', offsetDays: 1, length: DAY,
    what: '3 культуры, 20 минут, в Garden.',
    tip: 'Фарми одну из трёх культур конкурса 20 минут: медали дают Jacob\'s Ticket и бонусы к Farming Fortune. Культуры видно у Jacob в Garden или в /calendar.' },
  { id: 'darkauction', name: 'Тёмный аукцион', en: 'Dark Auction', icon: 'MIDAS_SWORD', color: '#7f8c8d', tier: 'small', offsetDays: 0, length: 5 * 60_000,
    what: 'Редкие лоты, вход через Sirius.',
    tip: 'Sirius в Hub пускает на аукцион, если в кошельке от 400 000 монет: редкие лоты вроде Midas\' Sword и скинов.' },
];

// События, которые включает перк мэра или министра
export const PERK_EVENTS = {
  'Mythological Ritual': { id: 'ritual', name: 'Мифологический ритуал', en: 'Mythological Ritual', icon: 'GRIFFIN_FEATHER', color: '#57c27a', tier: 'big', whole: true,
    what: 'Норы грифонов в Hub.', tip: 'Копай норы грифонов с Ancestral Spade и питомцем Griffin. Пошагово — в гайде «Diana».', guide: 'diana' },
  'Fishing Festival': { id: 'fishfest', name: 'Рыболовный фестиваль', en: 'Fishing Festival', icon: 'SHARK_FIN', color: '#2dd4bf', tier: 'big', monthDays: [1, 3],
    what: 'Акулы в любой воде.', tip: 'Бери Shark Bait и рыбачь в любой воде: акулы дают Shark Fin и зубы, их продают или крафтят Shark Scale Armor.', guide: 'fishing' },
  'Mining Fiesta': { id: 'fiesta', name: 'Фиеста добычи', en: 'Mining Fiesta', icon: 'MITHRIL_ORE', color: '#c9a36b', tier: 'big', whole: true, approx: true,
    what: 'Двойной дроп при добыче.', tip: 'Во время фиесты добыча даёт двойной дроп: копай Mithril и гемы. Точные дни видно в игре: /calendar.' },
  'Chivalrous Carnival': { id: 'carnival', name: 'Карнавал', en: 'Carnival', icon: 'CARNIVAL_TICKET', color: '#ff9f43', tier: 'big', whole: true,
    what: 'Мини-игры в Hub.', tip: 'Мини-игры карнавала дают Carnival Ticket: на них меняются косметика и полезные предметы.' },
};

/** Ближайшее начало периодического события после from (period и offset в мс, offset от EPOCH). */
function nextPeriodic(from, period, offset, length) {
  const base = sbStart(1, 0, 1) + offset;
  let k = Math.floor((from - base) / period);
  let start = base + k * period;
  if (start + length <= from) start += period;
  return { start, end: start + length };
}

/** Все вхождения годовых событий в год year: [{ ...event, start, end, from:{m,d}, to:{m,d} }] */
export function yearlyIn(year) {
  const out = [];
  for (const e of YEARLY) {
    const ranges = e.days.slice().sort((a, b) => a[0] - b[0]);
    // несколько подряд идущих месяцев (Hoppity) склеиваем в один интервал
    const [m0, d0] = ranges[0];
    const [m1, , d1] = ranges[ranges.length - 1];
    out.push({ ...e, start: sbStart(year, m0, d0), end: sbStart(year, m1, d1) + DAY, from: { m: m0, d: d0 }, to: { m: m1, d: d1 }, spans: ranges });
  }
  return out;
}

/** Вхождения Cult of the Fallen Star в месяц. */
export function cultIn(year, month) {
  return CULT.days.map(d => { const s = sbStart(year, month, d); return { ...CULT, start: s, end: s + CULT.hours * HOUR }; });
}

/** Ближайшие вхождения ежечасных событий. */
export function hourlyNext(now, count = 3) {
  const out = [];
  for (const e of HOURLY) {
    let from = now;
    for (let i = 0; i < count; i++) {
      const o = nextPeriodic(from, 3 * DAY, e.offsetDays * DAY, e.length);
      out.push({ ...e, start: o.start, end: o.end });
      from = o.end;
    }
  }
  return out;
}

/** Ближайшее 27 Late Spring после now — смена мэра. */
export function nextTermChange(now) {
  const { year } = sbDate(now);
  const t = sbStart(year, 2, 27);
  return t > now ? t : sbStart(year + 1, 2, 27);
}

/** Окно выборов: голосование идёт с 27 Late Summer до 27 Late Spring следующего года (9 месяцев SkyBlock ≈ 93 ч). */
export function electionWindow(now) {
  const closes = nextTermChange(now);
  const opens = closes - 9 * MONTH;
  return { open: now >= opens, opens, closes };
}

/**
 * События от перков мэра и министра на отрезке [from, to): Mythological Ritual — весь срок, Fishing Festival — 1–3 числа месяцев.
 * @param {string[]} perks  имена перков, действующих сейчас
 * @param {number} from
 * @param {number} to       конец срока (смена мэра)
 */
export function perkEvents(perks, from, to) {
  const out = [];
  for (const p of new Set(perks)) {
    const e = PERK_EVENTS[p];
    if (!e) continue;
    if (e.whole) { out.push({ ...e, start: from, end: to, perk: p }); continue; }
    if (e.monthDays) {
      const d = sbDate(from);
      for (let mStart = sbStart(d.year, d.month, 1); mStart < to; mStart += MONTH) {
        const s = mStart + (e.monthDays[0] - 1) * DAY, en = mStart + e.monthDays[1] * DAY;
        if (en > from && s < to) out.push({ ...e, start: Math.max(s, from), end: Math.min(en, to), perk: p });
      }
    }
  }
  return out;
}

export { YEAR, MONTH, DAY };
