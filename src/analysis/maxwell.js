// Maxwell (Accessory Bag Thaumaturgy): какая сила лучше под твой стиль игры и как распределить очки Tuning.
import { POWER_STONES, STARTER_POWERS, TUNING_PER_POINT, TUNING_RU } from './wealth-data.js';
import { tuningPoints } from '../calc/stats.js';
import { tx } from '../../i18n/msg.js';

/**
 * Во сколько раз статы силы больше, чем при 250 MP. Формула множителя с вики
 * (29.97 · ln(1 + 0.0019·MP)^1.2); значение при 250 MP из лора камней точное, остальное — оценка.
 */
export function powerScale(mp) {
  const f = x => 29.97 * Math.pow(Math.log(1 + 0.0019 * Math.max(0, x)), 1.2);
  return mp > 0 ? f(mp) / f(250) : 0;
}

const ROLE = {
  melee: { label: 'бой и данжи (урон оружием)', score: s => (s.Strength || 0) + (s['Crit Damage'] || 0) },
  mage: { label: 'маг (урон способностями)', score: s => (s.Intelligence || 0) + (s['Ability Damage'] || 0) * 40 },
};

export function maxwellAnalysis(member) {
  if (!member) return null;
  const mp = member.magicalPower || 0;
  const scale = powerScale(mp);
  const role = member.dungeons?.selectedClass === 'mage' ? 'mage' : 'melee';
  const selected = (member.selectedPower || '').toLowerCase() || null;
  const unlocked = new Set((member.unlockedPowers || []).map(x => String(x).toLowerCase()));
  const combat = member.skills?.combat?.level || 0;

  const powers = POWER_STONES.map(p => {
    const reqLvl = Number(/Combat Skill (\d+)/.exec(p.req || '')?.[1]) || 0;
    // Уникальный бонус не растёт от MP, основные статы — растут
    const at = Object.fromEntries(Object.entries(p.stats).map(([k, v]) => [k, Math.round(v * scale * 10) / 10]));
    const total = { ...at };
    for (const [k, v] of Object.entries(p.unique)) total[k] = (total[k] || 0) + v;
    const key = p.power.toLowerCase();
    return {
      power: p.power, stone: p.stone, stoneName: p.stoneName, rarity: p.rarity, reqCombat: reqLvl, combatOk: combat >= reqLvl,
      stats250: p.stats, statsNow: at, unique: p.unique,
      selected: key === selected, unlocked: key === selected || unlocked.has(key),
      score: Math.round(ROLE[role].score(total)), scoreMelee: Math.round(ROLE.melee.score(total)), scoreMage: Math.round(ROLE.mage.score(total)),
    };
  }).sort((a, b) => b.score - a.score);

  const best = powers[0];
  const cur = powers.find(p => p.selected) || null;
  const tips = [];
  if (!selected) tips.push('Сила не выбрана: открой Accessory Bag → Accessory Bag Thaumaturgy (Maxwell) и выбери силу, иначе Magical Power почти ничего не даёт.');
  else if (cur && best && cur.power !== best.power && best.score > cur.score * 1.05) {
    tips.push(tx`Для стиля «${ROLE[role].label}» ${best.power} даёт больше (${best.score} против ${cur.score} очков Strength+Crit Damage${role === 'mage' ? '/Intelligence' : ''}). ${best.unlocked ? 'Она уже открыта — просто переключись у Maxwell.' : tx`Нужно 9 × ${best.stoneName} у Thaumaturgist в Hub${best.combatOk ? '' : tx` и Combat ${best.reqCombat}`}.`}`);
  } else if (cur) tips.push(tx`${cur.power} — одна из лучших сил для стиля «${ROLE[role].label}». Менять не нужно.`);
  if (!cur && selected && STARTER_POWERS.map(s => s.toLowerCase()).includes(selected)) tips.push(tx`Сейчас стоит стартовая сила (${selected[0].toUpperCase() + selected.slice(1)}). Силы из Power Stone заметно сильнее: см. таблицу.`);

  // Tuning: 1 очко на 10 MP
  const slot = member.tuning?.slot_0 || {};
  const points = tuningPoints({ ...member, magicalPower: mp });
  const dist = Object.entries(slot).filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([k, v]) => ({ key: k, name: TUNING_RU[k] || k, points: v, gives: TUNING_PER_POINT[k] != null ? Math.round(v * TUNING_PER_POINT[k] * 10) / 10 : null }));
  const spent = dist.reduce((s, d) => s + d.points, 0);
  const free = Math.max(0, points - spent);
  if (free > 0) tips.push(tx`Не распределено ${free} очков Tuning из ${points}: это бесплатные статы. Stats Tuning в том же меню.`);
  const tuningAdvice = role === 'mage'
    ? 'Mage почти все очки — в Intelligence (2 Intelligence за очко).'
    : 'Для урона оружием делят между Strength и Crit Damage (по 1 за очко). Выгоднее докладывать в тот стат, которого у тебя меньше относительно другого: урон растёт как (1 + Strength/100) × (1 + Crit Damage/100).';
  if (role === 'melee' && spent > 20 && dist.length === 1 && ['critical_damage', 'strength'].includes(dist[0].key)) {
    tips.push(tx`Все ${spent} очков сейчас в ${dist[0].name}. Если ${dist[0].key === 'strength' ? 'Crit Damage' : 'Strength'} у тебя заметно меньше, часть очков лучше перенести туда.`);
  }

  return {
    mp, scale: Math.round(scale * 100) / 100, role, roleLabel: ROLE[role].label, selected, combat,
    powers, starter: STARTER_POWERS,
    tuning: { points, spent, free, dist, perPoint: Object.entries(TUNING_PER_POINT).map(([k, v]) => ({ key: k, name: TUNING_RU[k], v })), advice: tuningAdvice },
    tips,
  };
}
