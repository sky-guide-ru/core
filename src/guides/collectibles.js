// Гайд «Души и коллекции»: недостающие Fairy Souls (по островам, с маршрутом и ручными отметками),
// Enigma Souls (сводка, подробно — в гайде «Рифт»), контакты Abiphone и песни арфы Melody.
// Расчёт — server/collectibles/.
import { analyzeFairy, analyzeAbiphone, analyzeHarp } from '../collectibles/index.js';
import { getCollectMarks } from '../collectibles/marks.js';
import { HARP_TIER_RU } from '../collectibles/data.js';
import { soulStatus, areaName } from '../rift/index.js';
import { getMarks } from '../rift/marks.js';
import { tx } from '../../i18n/msg.js';

const plural = (n, a, b, c) => { const t = n % 10, h = n % 100; return t === 1 && h !== 11 ? a : t >= 2 && t <= 4 && (h < 12 || h > 14) ? b : c; };

export const FAIRY_TIPS = [
  'Hypixel отдаёт только число собранных фей, а не какие именно. Отмечай найденные на этой странице: тогда счётчики по островам станут точными, а в «недостающих» останутся только реальные.',
  'Координаты x y z удобно вставлять в мод с вэйпоинтами (SkyHanni, Skytils, NEU): кнопка 📍 копирует их. Список внутри острова идёт маршрутом — от варпа к ближайшей следующей душе.',
  'Каждые 5 фей меняются у Tia the Fairy (Hub, Fairy Pond в Wilderness) на постоянные +здоровье, +защиту, +силу и +скорость. Обмен не сгорает: копить можно сколько угодно.',
  'Высокие души берутся с Aspect of the End / Aspect of the Void и Grappling Hook, подводные — с зельем Water Breathing или шлемом с Respiration.',
];

export const ABIPHONE_TIPS = [
  'Abiphone — телефон SkyBlock. Контакт добавляется разговором с NPC, когда телефон у тебя в инвентаре; у части NPC сначала нужно выполнить условие из таблицы.',
  'Звонки — /call имя: Maddox берёт слеер-квест, Elizabeth открывает магазин Bits, Fear Mongerer и Plumber Joe — свои лавки и задания. Число контактов ограничено моделью телефона: лишние можно удалить и добавить позже.',
];

export const HARP_TIPS = [
  'Melody с арфой стоит в Парке (The Park). Песни открываются по очереди: каждая следующая — после прохождения предыдущей.',
  'Награда за первое прохождение песни — постоянный +Intelligence (лёгкие +1, сложные +2, эксперт +3, виртуоз +4) и SkyBlock XP.',
  'Ноты падают сверху по столбцам: жми слот, когда нота доходит до нижнего ряда. Отключи анимации инвентаря в модах и играй с хорошим пингом.',
  'Melody\'s Hair — аксессуар Epic (+6 Intelligence, Accessory Power): выдаётся после прохождения всей арфы.',
];

export default {
  id: 'collectibles', title: 'Души и коллекции', icon: 'PLACEABLE_FAIRY_SOUL_RIFT', group: 'other',
  build(m, ctx = {}) {
    const fairy = analyzeFairy(m, { marks: getCollectMarks(m.uuid).fairy || {}, constants: ctx.constants, items: ctx.items });
    const abi = analyzeAbiphone(m, { constants: ctx.constants, owned: ctx.owned, items: ctx.items });
    const harp = analyzeHarp(m, { has: ctx.has });
    const enigma = soulStatus(m.rift || {}, getMarks(m.uuid));
    enigma.found = Math.max(enigma.found, m.rift?.enigmaSouls || 0); // число из API, даже если коды душ не разобраны

    const next = [];
    if (fairy.unspent >= 5) next.push({ title: tx`Обменяй ${fairy.unspent} ${plural(fairy.unspent, 'фею', 'феи', 'фей')} у Tia the Fairy`, why: tx`Это ${Math.floor(fairy.unspent / 5)} обмена на постоянные статы, идти минуту.`, priority: 95 });
    if (fairy.left > 0) {
      const best = fairy.islands.filter(i => i.found < i.total).sort((a, b) => (b.total - b.found) - (a.total - a.found))[0];
      next.push({
        title: tx`Собери Fairy Souls: осталось ${fairy.left} из ${fairy.max}`,
        why: fairy.marked
          ? tx`Больше всего не отмечено на острове ${best?.name} (${best ? best.total - best.found : 0}). Каждые 5 новых фей — ещё один обмен у Tia.`
          : 'Отметь на странице, какие души уже собраны, — останутся только недостающие, с маршрутом по острову.',
        priority: fairy.left >= 20 ? 62 : 40,
      });
    }
    const freeMissing = abi.contacts.filter(c => c.status === 'missing' && c.free && c.island);
    if (abi.available && freeMissing.length) {
      next.push({ title: tx`Добавь бесплатные контакты Abiphone: ${freeMissing.slice(0, 4).map(c => c.name).join(', ')}${freeMissing.length > 4 ? tx` и ещё ${freeMissing.length - 4}` : ''}`, why: 'Условий нет — достаточно подойти и поговорить с NPC.', priority: 38 });
    }
    if (harp.available && harp.next) next.push({ title: tx`Сыграй на арфе «${harp.next.name}»`, why: tx`Следующая песня у Melody в Парке: +${harp.next.int} Intelligence навсегда. Уже получено +${harp.intGot} из +${harp.intMax}.`, priority: 36 });
    else if (harp.available && !harp.hair && harp.done >= harp.total) next.push({ title: 'Забери Melody\'s Hair у Melody', why: 'Все песни пройдены — аксессуар уже положен.', priority: 50 });
    if (enigma.found < enigma.total) next.push({ title: tx`Enigma Souls в Рифте: осталось ${enigma.total - enigma.found}`, why: 'Каждая душа добавляет 20 с Rift Time через Enigma Cloak. Список с подсказками — в гайде «Рифт».', priority: 30 });
    next.sort((a, b) => b.priority - a.priority);

    const sections = [];
    sections.push({
      kind: 'table', title: tx`Fairy Souls по островам: собрано ${fairy.collected} из ${fairy.max}`,
      note: fairy.listed < fairy.max ? tx`В справочнике NEU есть координаты ${fairy.listed} душ из ${fairy.max}.` : undefined,
      columns: ['Остров', 'Отмечено', 'Где искать'],
      rows: fairy.islands.map(i => [tx`${i.name} — ${i.ru}`, { text: `${i.found}/${i.total}`, tone: i.found >= i.total ? 'good' : undefined }, i.tip]),
    });
    sections.push({ kind: 'text', title: 'Как собирать Fairy Souls', text: FAIRY_TIPS });
    sections.push({
      kind: 'table', title: abi.available ? tx`Недостающие контакты Abiphone: ${abi.total - abi.have}` : 'Контакты Abiphone',
      note: abi.available ? 'Сначала — без условий, потом — по сложности условия.' : 'В профиле нет данных Abiphone: телефона ещё не было или API их не отдал.',
      columns: ['Контакт', 'Где', 'Что нужно'],
      rows: abi.contacts.filter(c => c.status !== 'have').map(c => [c.name, c.islandName ? tx`${c.islandName}${c.where ? tx`: ${c.where}` : ''}` : 'по квесту или ивенту', c.requirement.join('; ') || '—']),
    });
    sections.push({ kind: 'text', title: 'Как устроен Abiphone', text: ABIPHONE_TIPS });
    sections.push({
      kind: 'table', title: harp.available ? tx`Песни арфы: ${harp.done} из ${harp.total}` : 'Песни арфы Melody',
      note: harp.available ? tx`Intelligence с арфы у Melody: +${harp.intGot} из +${harp.intMax}. Последние две песни есть только на Personal Harp (600 000 монет у Melody после 100% в Greensleeves) и дают ещё по +1.` : 'В профиле нет данных арфы — значит, ни одна песня ещё не сыграна.',
      columns: ['Песня', 'Сложность', 'Награда', 'Лучший результат', 'Статус'],
      rows: harp.songs.map(s => [s.name, HARP_TIER_RU[s.tier] || s.tier, [s.int ? tx`+${s.int} Intelligence` : '', s.xp ? tx`+${s.xp} SkyBlock XP` : '', s.reward || ''].filter(Boolean).join(', ') || '—', s.best ? tx`${s.best}%` : '—',
        s.perfectDone ? { text: 'идеально', tone: 'good' } : s.done ? { text: 'пройдена', tone: 'good' } : { text: 'не пройдена', tone: s === harp.next ? 'warn' : 'bad' }]),
      current: harp.next ? harp.songs.indexOf(harp.next) : undefined,
    });
    sections.push({ kind: 'text', title: 'Как играть на арфе', text: HARP_TIPS });
    const byArea = {};
    for (const s of enigma.list) if (s.status !== 'found') byArea[s.area] = (byArea[s.area] || 0) + 1;
    sections.push({
      kind: 'text', title: tx`Enigma Souls: ${enigma.found} из ${enigma.total}`,
      text: enigma.found >= enigma.total ? ['Все Enigma Souls найдены.'] : [
        tx`Не найдено: ${Object.entries(byArea).map(([a, n]) => tx`${areaName(a)} ${n}`).join(', ')}.`,
        'Подсказки по каждой душе, координаты и отметки — в гайде «Рифт».',
      ],
    });

    // Отметки свитков ставит сам игрок (Hypixel не сообщает, какие открыты): таблица и галочки — на сайте (guides/warps.js)
    sections.push({
      kind: 'tool', tool: 'warp-scrolls', news: 'warps', title: 'Мои телепорты: Travel Scrolls',
      note: 'Отметь открытые свитки — подсказки «/warp …» на всём сайте покажут, сработает ли телепорт. Hub, Private Island и Garden открыты всегда, EPIC-свитки работают только с MVP+.',
    });

    const total = fairy.max + abi.total + harp.total + enigma.total;
    const got = fairy.collected + abi.have + harp.done + enigma.found;
    return {
      summary: tx`Fairy Souls ${fairy.collected}/${fairy.max} · Enigma ${enigma.found}/${enigma.total} · Abiphone ${abi.available ? `${abi.have}/${abi.total}` : '—'} · арфа ${harp.done}/${harp.total}`,
      status: got >= total ? 'done' : got > 0 ? 'progress' : 'start',
      level: { label: 'Собрано всего', value: got, max: total },
      next: next.slice(0, 6),
      sections,
      collect: {
        fairy: {
          collected: fairy.collected, max: fairy.max, left: fairy.left, listed: fairy.listed, marked: fairy.marked, unmarkedFound: fairy.unmarkedFound, unspent: fairy.unspent,
          islands: fairy.islands,
        },
        enigma: { found: enigma.found, total: enigma.total, byArea: Object.entries(byArea).map(([a, n]) => ({ area: a, name: areaName(a), left: n })) },
        abiphone: { available: abi.available, have: abi.have, total: abi.total, contacts: abi.contacts, other: abi.other, phone: abi.phone },
        harp,
      },
    };
  },
};
