// «Дела на сегодня»: ежедневные дела, которые видно по профилю. Отметка ставится сама, по меткам времени из API.
// Сброс дня в SkyBlock — полночь по Нью-Йорку (America/New_York).
import { ru } from '../../i18n/msg.js';
import { fetchurPuzzlerDailies } from './daily-npcs.js';

const DAY = 86400_000;

/** Начало текущего дня SkyBlock (последняя полночь по Нью-Йорку), мс. */
export function dailyReset(now = Date.now()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(now)).map(x => [x.type, x.value]));
  const sec = ((Number(p.hour) % 24) * 60 + Number(p.minute)) * 60 + Number(p.second);
  return now - sec * 1000 - (now % 1000);
}

/**
 * @param {object} m разобранный участник (member.daily, crimson, skills…)
 * @param {object} [ctx] цены для Fetchur: { items, buy, market, noMarket } (daily-npcs.js liveCtx)
 * Дела с manual ('day' | '24h') API не видит: done = null, отметку ставит игрок на сайте.
 * @returns {null | { reset: number, next: number, done: number, total: number, items: Array<{ id, title, done, manual?, progress?, text, href? }> }}
 */
export function dailiesOf(m, now = Date.now(), ctx = {}) {
  const d = m?.daily || {};
  if (!m?.daily && !m?.mining) return null;
  const reset = dailyReset(now);
  const items = [];

  // Experiments: один заход — Chronomatron, Ultrasequencer и Superpairs (стол на Private Island)
  if ((m.skills?.enchanting?.level || 0) >= 10 || (d.experiments || []).some(Boolean)) {
    const n = (d.experiments || []).filter(t => t >= reset).length;
    items.push({ id: 'experiments', title: 'Experiments', done: n >= 3, progress: [n, 3], text: n >= 3 ? 'Заход на Experimentation Table сегодня пройден.' : ru`Пройдено ${n} из 3 игр стола: Chronomatron, Ultrasequencer и Superpairs.`, href: '#/guides/enchanting' });
  }

  // Crimson Isle: ежедневные квесты фракции (обычно 5 в день)
  if (m.crimson?.faction) {
    const from = Math.max(reset, d.questsReset && d.questsReset <= now && now - d.questsReset < DAY ? d.questsReset : 0);
    const total = d.questList || 5;
    const n = Math.min(total, (d.quests || []).filter(q => q.at >= from && /COMPLETE/i.test(q.status || 'COMPLETE')).length);
    items.push({ id: 'crimson', title: 'Crimson Isle: квесты фракции', done: n >= total, progress: [n, total], text: n >= total ? 'Квесты на сегодня сданы.' : ru`Сдано ${n} из ${total}. Доска квестов — в лагере фракции.`, href: '#/guides/crimson' });
  }

  // Matriarch: раз в 24 часа после прошлой попытки (Heavy Pearls)
  if (m.crimson?.faction && d.matriarch) {
    const ready = d.matriarch + DAY;
    const done = ready > now;
    items.push({ id: 'matriarch', title: 'Matriarch', done, ready: done ? ready : null, text: done ? 'Heavy Pearls уже собраны, Matriarch снова доступна позже.' : 'Matriarch доступна: Heavy Pearls в Belly of the Beast.', href: '#/guides/crimson' });
  }

  // Garden: посетители ждут у Desk
  if (m.garden && (m.garden.experience > 0 || d.visitors)) {
    const n = d.visitors || 0;
    items.push({ id: 'visitors', title: 'Garden Visitors', done: n === 0, progress: null, text: n ? ru`Ждут посетители: ${n}. Copper и опыт Garden.` : 'Посетителей нет, новые приходят сами.', href: '#/guides/farming' });
  }

  // Dwarven Mines: Fetchur и Puzzler — по 2 500 Mithril Powder; API не показывает, сделано ли
  items.push(...fetchurPuzzlerDailies(m, ctx, now));

  if (!items.length) return null;
  return { reset, next: reset + DAY, done: items.filter(i => i.done).length, total: items.length, items };
}
