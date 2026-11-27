// «С возвращением»: игрок не заходил 30+ дней или недавно вернулся после такого перерыва.
// Время берётся из меток активности профиля (parse/activity.js), а не из last_save: его Hypixel не отдаёт.
import { ru } from '../../i18n/msg.js';

const DAY = 86400_000;
export const AWAY_DAYS = 30;   // перерыв, после которого показываем блок
export const BACK_DAYS = 14;   // сколько дней после возвращения блок ещё виден

/**
 * @param {number[]} activity метки по убыванию (member.activity)
 * @returns {{ state: 'away'|'back', days: number, since: number, backAt: number|null } | null}
 */
export function breakOf(activity, now = Date.now()) {
  const t = (activity || []).filter(x => Number.isFinite(x) && x > 0).sort((a, b) => b - a);
  if (!t.length) return null;
  if (now - t[0] >= AWAY_DAYS * DAY) return { state: 'away', days: Math.floor((now - t[0]) / DAY), since: t[0], backAt: null };
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] < now - BACK_DAYS * DAY) break;
    const gap = t[i] - t[i + 1];
    if (gap >= AWAY_DAYS * DAY) return { state: 'back', days: Math.floor(gap / DAY), since: t[i + 1], backAt: t[i] };
  }
  return null;
}

// Что появилось в SkyBlock за последние годы и чего в профиле ещё нет: по одному признаку на каждое
const NEW_THINGS = [
  { id: 'hunting', when: m => !(m.skills?.hunting?.xp > 0), title: 'Hunting', text: 'Новый скилл: ловля существ ради осколков (шардов) и атрибутов.', href: '#/guides/hunting' },
  { id: 'foraging', when: m => !(Number(m.hotfXp) > 0), title: 'Galatea и Heart of the Forest', text: 'Новый остров для Foraging со своим деревом перков, как HOTM у шахтёров.', href: '#/guides/foraging' },
  { id: 'chocolate', when: m => !m.extras?.chocolate || !(m.extras.chocolate.total > 0), title: 'Chocolate Factory', text: 'Фабрика шоколада у Hoppity: копит шоколад, пока игра закрыта, и даёт питомца Rabbit.', href: '#/guides/chocolate' },
  { id: 'rift', when: m => !m.riftPrism && !(m.rift?.motes > 0) && !(m.rift?.enigmaSouls > 0), title: 'The Rift', text: 'Отдельное измерение с Motes, Enigma Souls и сильными аксессуарами.', href: '#/guides/rift' },
  { id: 'glacite', when: m => (m.mining?.hotm?.level || 0) >= 3 && !(m.mining?.mineshafts > 0) && !(m.mining?.powder?.glacite > 0), title: 'Glacite Tunnels', text: 'Шахты под Dwarven Mines: Glacite Powder, Mineshafts и Fossils.', href: '#/guides/mining' },
];

/**
 * Блок «С возвращением» для «Обзора». Что делать дальше сайт берёт из плана (analysis.roadmap),
 * новости SkyBlock за перерыв — из /api/news.
 * @returns {null | { state, days, since, backAt, title, text, fresh: Array<{id,title,text,href}> }}
 */
export function returningInfo(m, now = Date.now()) {
  const br = breakOf(m?.activity, now);
  if (!br) return null;
  const fresh = NEW_THINGS.filter(x => { try { return x.when(m); } catch { return false; } }).map(({ id, title, text, href }) => ({ id, title, text, href }));
  const title = br.state === 'away' ? ru`Активности в SkyBlock не видно ${br.days} дн.` : ru`С возвращением после ${br.days} дн. перерыва`;
  return { ...br, title, fresh };
}
