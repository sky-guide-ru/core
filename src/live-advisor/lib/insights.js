// Факты для «диагноза аккаунта»: сайт считает их сам (бесплатно и точно), ИИ только делает вывод.
//  timeUse: куда ушло время за последние дни по почасовой истории профиля (server/history.js).
import { fmtCoins } from './util.js';
import { tx } from '../../../i18n/msg.js';

const DAY = 24 * 3600_000;
const SKIP_SKILLS = new Set(['social', 'runecrafting']);
const num = v => (Number.isFinite(v) ? v : 0);
// Прирост поля, которое есть в обеих точках: у старых снимков части полей нет, иначе прирост = всё значение
const gain = (a, b, k) => (Number.isFinite(a?.[k]) && Number.isFinite(b?.[k]) ? Math.max(0, b[k] - a[k]) : 0);

/**
 * Куда ушло время за последние `days` дней.
 * @param {Object[]} points  почасовые снимки (server/state.js snapshot): { t, coins, nw, cata, skills: {k: xp}, slayers: {k: xp}, floors?, garden? }
 * @param {Object} member    Member: нужны названия и максимумы скиллов
 * @param {{ now?: number, days?: number }} [o]
 * @returns {null | { days:number, activeHours:number, skills:Object[], slayers:Object[], cata:number, runs:number, coins:number, nw:number, wastedShare:number }}
 */
export function timeUse(points, member, o = {}) {
  const now = o.now ?? Date.now();
  const days = o.days ?? 7;
  const from = now - days * DAY;
  const pts = (points || []).filter(p => p && p.t <= now);
  // опорная точка — последняя до начала окна (или первая в окне)
  let i = pts.findIndex(p => p.t >= from);
  if (i < 0) return null;
  i = Math.max(0, i - 1);
  const win = pts.slice(i);
  if (win.length < 2) return null;
  const a = win[0], b = win[win.length - 1];
  const spanDays = Math.max(1, Math.round((b.t - a.t) / DAY));

  // Часы, в которые что-то менялось (снимки почасовые): грубая оценка времени в игре
  let activeHours = 0;
  for (let k = 1; k < win.length; k++) {
    const p = win[k - 1], c = win[k];
    const moved = Object.keys(c.skills || {}).some(s => num(c.skills[s]) > num(p.skills?.[s]))
      || Object.keys(c.slayers || {}).some(s => num(c.slayers[s]) > num(p.slayers?.[s]))
      || num(c.floors) > num(p.floors) || num(c.cata) > num(p.cata);
    if (moved) activeHours += Math.min(3, Math.max(1, Math.round((c.t - p.t) / 3600_000)));
  }

  const sk = member?.skills || {};
  const skills = Object.keys(b.skills || {}).filter(k => !SKIP_SKILLS.has(k)).map(k => {
    const xp = Math.max(0, num(b.skills[k]) - num(a.skills?.[k]));
    const s = sk[k] || {};
    return { key: k, name: s.name || k, xp, level: s.level ?? null, maxed: s.maxLevel != null && s.level >= s.maxLevel };
  }).filter(s => s.xp > 0).sort((x, y) => y.xp - x.xp);
  const total = skills.reduce((t, s) => t + s.xp, 0);
  for (const s of skills) s.share = total ? s.xp / total : 0;
  const wastedShare = total ? skills.filter(s => s.maxed).reduce((t, s) => t + s.xp, 0) / total : 0;

  const sl = member?.slayers || {};
  const slayers = Object.keys(b.slayers || {}).map(k => ({ key: k, name: sl[k]?.name || k, xp: Math.max(0, num(b.slayers[k]) - num(a.slayers?.[k])) }))
    .filter(s => s.xp > 0).sort((x, y) => y.xp - x.xp);

  return {
    days: spanDays,
    activeHours,
    skills,
    slayers,
    cata: +(num(b.cata) - num(a.cata)).toFixed(2),
    runs: gain(a, b, 'floors'),
    kuudra: gain(a, b, 'kuudra'),
    coins: num(b.coins) - num(a.coins),
    nw: num(b.nw) - num(a.nw),
    garden: gain(a, b, 'garden'),
    wastedShare,
  };
}

const pctTxt = v => `${Math.round(v * 100)}%`;
const sign = v => (v > 0 ? `+${fmtCoins(v)}` : v < 0 ? `−${fmtCoins(-v)}` : '0');

/** Текст раздела «Куда ушло время» для ИИ */
export function timeUseLines(t) {
  if (!t) return ['Истории ещё мало (нужно хотя бы 2 почасовые точки): про время ничего сказать нельзя.'];
  const L = [tx`За ${t.days} дн.: заметная активность примерно ${t.activeHours} ч.`];
  if (t.skills.length) {
    L.push(tx`Опыт скиллов: ${t.skills.slice(0, 6).map(s => `${s.name} ${pctTxt(s.share)} (+${fmtCoins(s.xp)} XP${s.maxed ? ', скилл на максимуме: опыт уровней не даёт' : ''})`).join(', ')}.`);
    if (t.wastedShare >= 0.3) L.push(tx`${pctTxt(t.wastedShare)} опыта скиллов ушло в скиллы на максимуме.`);
  } else L.push('Опыт скиллов не рос.');
  L.push(t.slayers.length ? tx`Слееры: ${t.slayers.map(s => `${s.name} +${fmtCoins(s.xp)} XP`).join(', ')}.` : 'Слееров не било.');
  L.push(`Dungeons: ${t.runs ? tx`${t.runs} ранов` : 'ранов не было'}${t.cata > 0 ? tx`, Catacombs +${t.cata} ур.` : ''}. Kuudra: ${t.kuudra ? tx`${t.kuudra} заходов` : 'не ходил'}.`);
  L.push(tx`Монеты: ${sign(t.coins)}, networth: ${sign(t.nw)}.`);
  return L;
}
