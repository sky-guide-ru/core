// Bank: сколько процентов придёт, когда, потолки счетов и окупится ли улучшение счёта.
import { BANK_TIERS, SB_EPOCH, SB_SEASON } from './wealth-data.js';
import { tx } from '../../i18n/msg.js';

const KNOWN = BANK_TIERS.filter(t => t.brackets);

/** Проценты за одно начисление при таком балансе на счёте tier (ступени: 2% на первые 10 млн, 1% на следующие и т.д.) */
export function interestFor(balance, tier) {
  if (!tier?.brackets) return null;
  let left = Math.max(0, Number(balance) || 0), sum = 0;
  for (const [size, rate] of tier.brackets) {
    const part = Math.min(left, size);
    sum += part * rate;
    left -= part;
    if (left <= 0) break;
  }
  return Math.round(sum);
}

/** Баланс, после которого проценты на этом счёте больше не растут */
export const balanceForMax = tier => tier?.brackets ? tier.brackets.reduce((s, [size]) => s + size, 0) : null;
export const maxInterest = tier => interestFor(balanceForMax(tier), tier);

/** Когда следующее начисление: начало каждого сезона SkyBlock (раз в 31 час) */
export function nextInterestAt(now = Date.now()) {
  const k = Math.floor((now - SB_EPOCH) / SB_SEASON) + 1;
  return SB_EPOCH + k * SB_SEASON;
}

/** Текущий счёт: по выполненным задачам BANK_UPGRADE_* (точно) или по балансу (нижняя граница) */
export function bankTier(member) {
  const ups = member?.bankUpgrades || [];
  let idx = 0, known = false;
  if (ups.length) {
    known = true;
    for (const u of ups) { const i = BANK_TIERS.findIndex(t => tx`BANK_UPGRADE_${t.id}` === u); if (i > idx) idx = i; }
  }
  // Задач нет (старый профиль или поле не пришло): баланс выше потолка счёта значит, что счёт как минимум следующий
  const bal = Number(member?.bank) || 0;
  let minIdx = 0;
  for (let i = 0; i < KNOWN.length; i++) if (KNOWN[i].max && bal > KNOWN[i].max) minIdx = i + 1;
  if (!known) idx = Math.min(minIdx, BANK_TIERS.length - 1);
  return { idx, tier: BANK_TIERS[idx], known: known || ups.length > 0, guessedFromBalance: !known };
}

export function bankAnalysis(member, now = Date.now()) {
  if (!member) return null;
  const balance = member.bank == null ? null : Number(member.bank) || 0;
  const personal = Number(member.personalBank) || 0;
  const { idx, tier, known } = bankTier(member);
  // Для Luxurious/Palatial ступени процентов не сверены: считаем как у Premier (потолок процентов у них не ниже)
  const calcTier = tier.brackets ? tier : KNOWN[KNOWN.length - 1];
  const expected = balance == null ? null : interestFor(balance, calcTier);
  // Личный Bank кооп-участника: те же ступени, но всё в 5 раз меньше (баланс и проценты)
  const personalExpected = personal > 0 ? Math.round(interestFor(personal * 5, calcTier) / 5) : 0;
  const capBalance = balanceForMax(calcTier);
  const cap = maxInterest(calcTier);
  const next = nextInterestAt(now);
  const perDay = r => (r == null ? null : Math.round(r * 24 / 31));

  const paid = (member.bankTransactions || []).filter(t => /interest/i.test(t.by) && t.amount > 0).sort((a, b) => b.at - a.at);
  const last = paid[0] || null;

  const tiers = BANK_TIERS.map((t, i) => {
    const r = t.brackets && balance != null ? interestFor(t.max ? Math.min(balance, t.max) : balance, t) : null;
    const gain = r != null && expected != null && i > idx ? r - expected : null;
    // Стоимость пути от текущего счёта до этого: сумма всех промежуточных улучшений
    const cost = i > idx ? BANK_TIERS.slice(idx + 1, i + 1).reduce((s, x) => (s == null || x.upgradeCoins == null ? null : s + x.upgradeCoins), 0) : null;
    return {
      id: t.id, name: t.name, max: t.max, current: i === idx, owned: i <= idx,
      maxInterest: maxInterest(t), balanceForMax: balanceForMax(t), interestNow: r, gain, cost,
      paybackDays: gain > 0 && cost ? Math.round(cost / gain * 31 / 24) : null, unverified: !!t.unverified,
    };
  });

  const tips = [];
  if (balance != null && capBalance != null) {
    if (balance >= capBalance) {
      const idle = balance - capBalance;
      tips.push(tx`Проценты на твоём счёте больше не растут после ${fmt(capBalance)}. ${idle > 1e6 ? tx`Ещё ~${fmt(idle)} лежат без процентов: ради процентов их держать незачем, можно вложить в снаряжение или флипы.` : ''}`.trim());
    } else {
      tips.push(tx`До потолка процентов не хватает ${fmt(capBalance - balance)}: каждый миллион сверху даёт ещё ${fmt(interestFor(balance + 1e6, calcTier) - expected)} за начисление.`);
    }
  }
  const nextTier = tiers.find(t => t.gain != null && !t.owned);
  if (nextTier) {
    if (nextTier.gain <= 0) tips.push(tx`Улучшать до ${nextTier.name} ради процентов не нужно: при твоём балансе прибавка 0. Улучшение нужно, только если хочешь хранить больше ${fmt(tier.max)}.`);
    else if (nextTier.paybackDays > 365) tips.push(tx`${nextTier.name} даст всего +${fmt(nextTier.gain)} за начисление, а стоит ~${fmt(nextTier.cost)}: окупится только через ~${(nextTier.paybackDays / 365).toFixed(1).replace('.', ',')} года. Ради процентов улучшать не стоит, только если нужно хранить больше ${fmt(tier.max)}.`);
    else tips.push(tx`${nextTier.name}: +${fmt(nextTier.gain)} за начисление (~${fmt(perDay(nextTier.gain))} в день). Улучшение стоит ~${fmt(nextTier.cost)}, окупится примерно за ${nextTier.paybackDays} дн.`);
  }

  return {
    balance, personal, coop: (member.coopMembers || 1) > 1,
    tier: { id: tier.id, name: tier.name, max: tier.max, known, unverified: !!tier.unverified },
    expected, expectedPerDay: perDay(expected), personalExpected,
    cap, capBalance, nextAt: next, periodHours: 31,
    last: last ? { amount: last.amount, at: last.at } : null,
    history: paid.slice(0, 6).map(t => ({ amount: t.amount, at: t.at })),
    tiers, tips,
  };
}

function fmt(n) {
  if (n == null) return '?';
  const a = Math.abs(n);
  if (a >= 1e9) return tx`${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '').replace('.', ',')} млрд`;
  if (a >= 1e6) return tx`${(n / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, '').replace('.', ',')} млн`;
  if (a >= 1e3) return tx`${Math.round(n / 1e3)} тыс.`;
  return String(Math.round(n));
}
