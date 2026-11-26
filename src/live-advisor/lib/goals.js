// Цель игрока: ИИ в чате ставит её инструментом set_goal (путь от профиля игрока), а прогресс сайт считает сам
// по данным профиля при каждом обновлении — бесплатно и без ошибок модели.
import { fmtCoins } from './util.js';
import { tx } from '../../../i18n/msg.js';

export const GOAL_KINDS = ['sb', 'catacombs', 'class', 'skill', 'slayer', 'floor', 'master', 'kuudra', 'mp', 'hotm', 'coins'];
const KUUDRA_TIERS = ['basic', 'hot', 'burning', 'fiery', 'infernal'];
const MAX_TARGETS = 4;
const MAX_ROUTE = 5;

const lvl = s => (s ? (s.level || 0) + (s.maxLevel != null && s.level >= s.maxLevel ? 0 : (s.progress || 0)) : 0);
const r1 = v => Math.floor(v * 10) / 10;
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/** Текущее значение показателя цели. null — такого показателя у игрока нет (опечатка в key) */
export function metricValue(m, kind, key) {
  if (!m) return null;
  const k = String(key || '').toLowerCase();
  switch (kind) {
    case 'sb': return m.sbLevel || 0;
    case 'catacombs': return lvl(m.dungeons?.catacombs);
    case 'class': return m.dungeons?.classes?.[k] ? lvl(m.dungeons.classes[k]) : null;
    case 'skill': return m.skills?.[k] ? lvl(m.skills[k]) : null;
    case 'slayer': return m.slayers?.[k] ? m.slayers[k].level || 0 : null;
    case 'floor': return /^[0-7]$/.test(k) ? Number(m.dungeons?.floors?.[k] || 0) : null;
    case 'master': return /^[1-7]$/.test(k) ? Number(m.dungeons?.masterFloors?.[k] || 0) : null;
    case 'kuudra': return KUUDRA_TIERS.includes(k) ? Number(m.crimson?.kuudra?.[k] || 0) : null;
    case 'mp': return m.magicalPower || 0;
    case 'hotm': return m.mining?.hotm ? lvl(m.mining.hotm) : null;
    case 'coins': return Math.round((m.purse || 0) + (m.bank || 0) + (m.personalBank || 0));
    default: return null;
  }
}

/** Подпись показателя по-игровому: «Catacombs», «Combat», «M3 (прохождения)» */
export function metricLabel(m, kind, key) {
  const k = String(key || '').toLowerCase();
  switch (kind) {
    case 'sb': return 'SkyBlock Level';
    case 'catacombs': return 'Catacombs';
    case 'class': return m?.dungeons?.classes?.[k]?.name || k;
    case 'skill': return m?.skills?.[k]?.name || k;
    case 'slayer': return `Slayer ${m?.slayers?.[k]?.name || k}`;
    case 'floor': return tx`F${k}: прохождения`;
    case 'master': return tx`M${k}: прохождения`;
    case 'kuudra': return tx`Kuudra ${k[0]?.toUpperCase()}${k.slice(1)}: заходы`;
    case 'mp': return 'Magical Power';
    case 'hotm': return 'HOTM';
    case 'coins': return 'Монеты';
    default: return kind;
  }
}

/**
 * Проверка и чистка цели от ИИ. Ошибка — строкой, чтобы модель могла исправиться в том же ответе.
 * @returns {{ goal?: Object, error?: string }}
 */
export function normalizeGoal(input, member, now = Date.now()) {
  const title = cut(input?.title, 80);
  if (!title) return { error: 'Нужно короткое название цели (title).' };
  const targets = [];
  for (const t of (Array.isArray(input?.targets) ? input.targets : []).slice(0, MAX_TARGETS)) {
    const kind = String(t?.kind || '');
    if (!GOAL_KINDS.includes(kind)) return { error: tx`Неизвестный показатель «${kind}». Можно: ${GOAL_KINDS.join(', ')}.` };
    const key = String(t?.key || '').toLowerCase().trim();
    const cur = metricValue(member, kind, key);
    if (cur == null) return { error: tx`У игрока нет показателя ${kind}${key ? ` «${key}»` : ''}. Для skill/slayer/class — ключ как в данных (combat, blaze, archer), для floor/master — номер этажа, для kuudra — basic/hot/burning/fiery/infernal.` };
    const target = Number(t?.target);
    if (!Number.isFinite(target) || target <= 0) return { error: tx`Цель для ${kind} должна быть положительным числом.` };
    targets.push({ kind, key, target });
  }
  if (!targets.length) return { error: 'Нужен хотя бы один измеримый показатель (targets), иначе сайт не сможет вести прогресс.' };
  const route = (Array.isArray(input?.route) ? input.route : []).map(s => cut(s, 140)).filter(Boolean).slice(0, MAX_ROUTE);
  return { goal: { title, targets, route, at: now } };
}

/** Цель с прогрессом по текущему профилю (для сайта и для сводки ИИ) */
export function goalProgress(goal, member) {
  if (!goal) return null;
  const targets = goal.targets.map(t => {
    const cur = metricValue(member, t.kind, t.key) ?? 0;
    const money = t.kind === 'coins';
    const fmt = v => (money ? fmtCoins(v) : Number.isInteger(t.target) && ['floor', 'master', 'kuudra', 'mp', 'slayer'].includes(t.kind) ? String(Math.floor(v)) : String(r1(v)).replace('.', ','));
    return { ...t, label: metricLabel(member, t.kind, t.key), cur, p: Math.max(0, Math.min(1, cur / t.target)), text: `${fmt(cur)} / ${fmt(t.target)}`, done: cur >= t.target };
  });
  const p = targets.reduce((a, t) => a + t.p, 0) / targets.length;
  return { title: goal.title, route: goal.route || [], at: goal.at, targets, p, done: targets.every(t => t.done) };
}

/** Раздел сводки для ИИ: какая цель и сколько осталось */
export function goalLines(gp) {
  if (!gp) return [];
  return [tx`Цель: ${gp.title}${gp.done ? ' (достигнута!)' : ''}.`, ...gp.targets.map(t => `- ${t.label}: ${t.text}${t.done ? ' ✓' : ''}`), ...(gp.route.length ? [tx`Путь, который ты предложил: ${gp.route.join(' → ')}`] : [])];
}
