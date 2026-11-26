// Гайд по Рифту: зоны по порядку, Enigma Souls (найдено / где искать остальные), таймчармы,
// глаза Porhtal, Montezuma, Motes, Vampire Slayer, механика Rift Time. Расчёт — server/rift/.
import { analyzeRift, AREAS } from '../rift/index.js';
import { getMarks } from '../rift/marks.js';
import { petLevel } from '../parse/leveling.js';
import { tx } from '../../i18n/msg.js';

const fmt = n => Math.round(n || 0).toLocaleString('ru-RU');
const posText = p => p ? p.split(':').join(' ') : '—';

export const MECHANICS = [
  'Вход: Dimensional Infusion у Wizard в Wizard Tower (Hub), потом портал за горой. Бесплатный Infusion — раз в 4 часа, иначе 32 Grand Experience Bottle или 200 Bits. Rift Prism делает вход всегда бесплатным.',
  'Rift Time (ф) — главный ресурс: база 8:00, тикает 1 ф в секунду, некоторые мобы и эффекты отнимают ещё. На нуле тебя выкидывает в Wizard Tower, прогресс квестов остаётся.',
  'Что поднимает максимум: Enigma Cloak +20 с за каждую душу (до +1040 за все 52), Rift Necklace от таймчармов, уровни Vampire Slayer (+235 с суммарно), глаза Porhtal (до +280 с), Montezuma (+15 с и ещё +15 за каждую часть), пояса Leech / Vermin, линейка Crux-аксессуаров, Wyld-броня (+15 с за часть).',
  'Respiration-аксессуары (Talisman → Ring → Artifact) задерживают начало потери времени на 10 / 20 / 30 с при входе.',
  'В замке Stillgore монстры бьют по ❤ здоровью — для этого нужен Healing Melon (крафт открывается после 12 убитых вампиров).',
  'Обычное снаряжение в Рифт не берётся, кроме помеченного «Rift-Transferable». Переносить предметы между мирами можно через эндер-сундук у Inverted Sirius (за Dark Auction).',
  'Каждый таймчарм в галерее Elise даёт +100 SkyBlock XP и усиливает Rift Necklace — он работает и вне Рифта (в Hub скажи Elise «CARAMEL»).',
];

export const MOTES_TIPS = [
  'Motes — валюта Рифта. Розовые шарики на карте дают по 25 Motes и +2 с Rift Time — собирай их по пути.',
  'Мобы и боссы: Leech Supreme ≈3 тыс., Bacte ≈6 тыс. Motes за убийство (оценки игроков). Vampire Slayer окупает следующий квест.',
  'Рифт-предметы продавай Motes Grubber (Wyld Woods, West Village, замок Stillgore). Перед продажей съешь McGrubber\'s Burger: каждый +5% к выплатам, до +25% за пять.',
  'Dr. Emmett один раз платит 60 000 Motes после Mirrorverse.',
  'Тратить Motes в первую очередь на прогресс: Enigma Cloak (100), Wyld-броня, Rift Bucket, покупаемые души, квесты Vampire Slayer.',
];

export default {
  id: 'rift', title: 'Rift', icon: 'RIFT_PRISM', group: 'rift',
  build(m) {
    const r = analyzeRift(m, { marks: getMarks(m.uuid), petLevel });
    const s = r.souls;
    const charmsDone = r.charms.filter(c => c.secured).length;
    const status = s.found >= s.total && charmsDone === r.charms.length ? 'done' : s.found > 0 ? 'progress' : 'start';

    const sections = [];
    sections.push({
      kind: 'steps', title: 'Зоны по порядку прохождения',
      note: 'Отмечено, где ты уже был и сколько душ найдено в каждой зоне.',
      items: r.areas.map(a => ({
        title: tx`${a.name} — ${a.ru} · души ${a.souls.found}${a.souls.maybe ? tx` (+${a.souls.maybe}?)` : ''}/${a.souls.total}`,
        text: [a.about, !a.visited && a.gate ? tx`Как открыть: ${a.gate}` : null].filter(Boolean),
        done: a.souls.found >= a.souls.total && a.charms.every(c => c.secured) && a.eyes.every(e => e.done),
        current: a.id === r.current,
      })),
    });
    const missing = s.list.filter(x => x.status !== 'found');
    sections.push({
      kind: 'table', title: tx`Недостающие Enigma Souls: ${s.total - s.found}`,
      note: s.unexplained
        ? tx`${s.unexplained} из найденных душ Hypixel записал кодами, которые не удаётся сопоставить. Помеченные «возможно» — кандидаты; отметь их вручную на странице.`
        : 'Координаты x y z — для мода с вэйпоинтами (SkyHanni, Skytils) или команды в чате.',
      columns: ['Душа', 'Зона', 'Где', 'Координаты', 'Статус'],
      rows: missing.map(x => [x.name, x.areaName, x.hint, posText(x.pos), x.status === 'maybe' ? { text: 'возможно найдена', tone: 'warn' } : { text: 'не найдена', tone: 'bad' }]),
    });
    sections.push({
      kind: 'checklist', title: tx`Таймчармы: ${charmsDone} из ${r.charms.length}`,
      note: 'Таймчарм засчитывается, когда его ставят в Rift Gallery у Elise.',
      items: r.charms.map(c => ({ text: tx`${c.name} (${c.areaName})`, done: c.secured, hint: c.secured ? 'в галерее' : c.inBag ? 'уже скрафчен — отнеси Elise' : c.how, item: c.id })),
    });
    sections.push({
      kind: 'checklist', title: tx`Глаза Porhtal: ${r.eyes.filter(e => e.done).length} из ${r.eyes.length}`,
      note: 'Каждый глаз добавляет Rift Time: до +280 с за все семь.',
      items: r.eyes.map(e => ({ text: tx`${e.name} — ${e.areaName}`, done: e.done, hint: e.done ? null : tx`${e.hint} (${posText(e.pos)})` })),
    });
    const mont = r.montezuma;
    sections.push({
      kind: 'checklist', title: tx`Montezuma: ${r.cats.filter(c => c.done).length} из 9 частей`,
      note: mont
        ? tx`Montezuma уже у тебя (${mont.tier === 'EPIC' ? 'Epic' : 'Rare'}). Он не качается опытом: каждая часть души даёт +15 с Rift Time, а 6 частей делают его Epic.`
        : 'Начни квест Sad Jacquelle в Wyld Woods и найди первую часть — получишь питомца Montezuma. Части ищи с Dead Cat Detector.',
      items: r.cats.map(c => ({ text: tx`Часть ${c.n} — ${c.areaName}`, done: c.done, hint: c.done ? null : c.hint })),
    });
    sections.push({
      kind: 'table', title: tx`Что купить за Motes (у тебя ${fmt(r.motes)})`,
      columns: ['Предмет', 'Цена', 'Где', 'Зачем'],
      rows: r.shop.map(x => [
        { text: x.name, item: x.id, tone: x.owned ? 'muted' : undefined },
        { text: tx`${fmt(x.motes)} Motes${x.extra ? tx` + ${x.extra}` : ''}`, tone: x.owned ? 'muted' : x.affordable ? 'good' : undefined },
        tx`${x.npc}${x.areaName ? tx`, ${x.areaName}` : ''}`,
        x.owned ? 'уже есть' : x.why,
      ]),
    });
    sections.push({ kind: 'text', title: 'Motes: как зарабатывать', text: MOTES_TIPS });
    const v = r.vamp;
    sections.push({
      kind: 'text', title: tx`Vampire Slayer: ${v.level} из ${v.max}`,
      text: [
        'Квест берётся у Maddox в замке Stillgore Château (потом — по Maddox Badphone). Открывается после Globulate Timecharm. Босс — Riftstalker Bloodfiend.',
        'Цена квеста в Motes: T1 2 000 · T2 4 000 · T3 5 000 · T4 7 000 · T5 10 000. Уровни 1–5 дают +20 / +30 / +45 / +60 / +80 с Rift Time.',
        v.level < v.max ? tx`Опыт: ${fmt(v.xp)} из ${fmt(v.nextXp)} до уровня ${v.level + 1}.` : 'Максимальный уровень — готово.',
        'Уровень 3 открывает Bloodbadge и Vampiric Timecharm, уровень 5 — Vampire Dentist Relic (Bloodbadge + Unfanged Vampire Part, работает и вне Рифта) и McGrubber\'s Burger.',
        'Perma-Jelled Garlic-Flavored Re-Heated Gummy Polar Bear (нужен Vampire Slayer 3) даёт +5 опыта Combat за убийства в Рифте.',
      ],
    });
    sections.push({ kind: 'text', title: 'Как устроено время в Рифте', text: MECHANICS });

    return {
      summary: tx`Enigma Souls ${s.found}/${s.total} · таймчармы ${charmsDone}/${r.charms.length} · Motes ${fmt(r.motes)}`,
      status,
      level: { label: 'Enigma Souls', value: s.found, max: s.total },
      next: r.next.slice(0, 8),
      sections,
      rift: {
        motes: r.motes, current: r.current, riftTimeFromSouls: r.riftTimeFromSouls,
        souls: s.list.map(({ id, name, area, areaName, pos, hint, status, marked }) => ({ id, name, area, areaName, pos, hint, status, marked })),
        unexplained: s.unexplained, found: s.found, total: s.total,
        areas: r.areas.map(({ id, name, ru, visited, souls }) => ({ id, name, ru, visited, souls })),
        charms: r.charms, eyes: r.eyes.map(({ name, areaName, done }) => ({ name, areaName, done })),
        cats: r.cats.filter(c => c.done).length, montezuma: r.montezuma, vamp: r.vamp,
      },
    };
  },
};

export { AREAS };
