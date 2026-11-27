// Улучшение своей брони Kuudra (Crimson / Aurora / Terror / Fervor / Hollow) на следующий тир.
// Механика (Hypixel SkyBlock Wiki, страница Crimson Armor, проверено 2026-11-23):
//  - следующий тир получается «престижем» части у кузнеца (Blacksmith), когда на ней 10 звёзд;
//  - после престижа звёзды сбрасываются;
//  - цена престижа одной части: Basic→Hot 150 эссенции Crimson + 10 Kuudra Teeth + 2 млн,
//    Hot→Burning 800 + 20 + 5 млн, Burning→Fiery 4500 + 50 + 10 млн, Fiery→Infernal 25 500 + 80 + 20 млн;
//  - носить тир можно с Combat 22/27/32/37/42 и после прохождения Kuudra того же тира.
// Цены звёзд берутся из constants/essencecosts NEU (у всех пяти семейств они одинаковые).
import { fmtCoins } from '../util.js';
import { ru } from '../../../../i18n/msg.js';
import { tx } from '../../../../i18n/msg.js';

export const KUUDRA_PREFIX = ['', 'HOT_', 'BURNING_', 'FIERY_', 'INFERNAL_'];
export const KUUDRA_TIER_RU = ['Basic', 'Hot', 'Burning', 'Fiery', 'Infernal'];
const KUUDRA_RUN = ['basic', 'hot', 'burning', 'fiery', 'infernal'];
export const PRESTIGE = [
  { essence: 150, teeth: 10, coins: 2_000_000 },
  { essence: 800, teeth: 20, coins: 5_000_000 },
  { essence: 4500, teeth: 50, coins: 10_000_000 },
  { essence: 25500, teeth: 80, coins: 20_000_000 },
];
const WEAR_COMBAT = [22, 27, 32, 37, 42];
const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const SLOT_RU = { HELMET: 'шлем', CHESTPLATE: 'нагрудник', LEGGINGS: 'поножи', BOOTS: 'ботинки' };
const FAMILY_RU = { CRIMSON: 'Crimson', AURORA: 'Aurora', TERROR: 'Terror', FERVOR: 'Fervor', HOLLOW: 'Hollow' };

export const kuudraSetName = (fam, tier) => tx`${tier ? `${KUUDRA_TIER_RU[tier]} ` : ''}${FAMILY_RU[fam] || fam}`;

/** Семейство и тир, которых у игрока больше всего частей (лучший тир важнее) */
export function ownKuudraSet(ctx, families) {
  let best = null;
  for (let t = KUUDRA_PREFIX.length - 1; t >= 0; t--) {
    for (const fam of families) {
      const pieces = SLOTS.filter(s => ctx.owned.has(`${KUUDRA_PREFIX[t]}${fam}_${s}`)).length;
      if (pieces >= 3 && (!best || (t === best.tier && pieces > best.pieces))) best = { fam, tier: t, pieces };
    }
    if (best) return best;
  }
  return null;
}

/** Essence, Heavy Pearl и монеты, чтобы поднять часть тира t со звёзд from до 10 */
function starsCost(ess, from) {
  const out = { essence: 0, pearls: 0, coins: 0 };
  if (!ess) return out;
  for (let i = from + 1; i <= 10; i++) {
    out.essence += Number(ess[i] || 0);
    for (const s of ess.items?.[i] || []) {
      const [id, n] = String(s).split(':');
      if (id === 'SKYBLOCK_COIN') out.coins += Number(n) || 0;
      else if (id === 'HEAVY_PEARL') out.pearls += Number(n) || 0;
    }
  }
  return out;
}

/**
 * План улучшения своего сета до тира target.
 * @returns {{ fam, from, target, pieces: object[], totals, upgradeCost, buyCost, resale, buyNet, cheaper, lines: string[] } | null}
 */
export function kuudraUpgradePlan(ctx, own, target) {
  const constants = ctx.opts?.constants || {};
  const essAll = constants.essencecosts || {};
  const { fam, tier: from } = own;
  const totals = { essence: 0, teeth: 0, pearls: 0, coins: 0, buyMissing: 0 };
  const pieces = [];
  for (const slot of SLOTS) {
    const id = tx`${KUUDRA_PREFIX[from]}${fam}_${slot}`;
    const it = (ctx.owned.get(id) || []).slice().sort((a, b) => (b.stars || 0) - (a.stars || 0))[0]; // самая прокачанная копия
    if (!it) {
      const buyId = tx`${KUUDRA_PREFIX[target]}${fam}_${slot}`;
      const p = ctx.price(buyId);
      totals.buyMissing += p;
      pieces.push({ slot, missing: true, buyId, price: p });
      continue;
    }
    const stars = Math.min(10, Number(it.stars || 0));
    const steps = [];
    for (let t = from; t < target; t++) {
      const sc = starsCost(essAll[tx`${KUUDRA_PREFIX[t]}${fam}_${slot}`], t === from ? stars : 0);
      const pr = PRESTIGE[t];
      totals.essence += sc.essence + pr.essence; totals.pearls += sc.pearls; totals.coins += sc.coins + pr.coins; totals.teeth += pr.teeth;
      steps.push({ tier: t, starsFrom: t === from ? stars : 0, stars: sc, prestige: pr });
    }
    pieces.push({ slot, id, stars, steps, attributes: it.attributes || null });
  }
  const ep = ctx.price('ESSENCE_CRIMSON'), tp = ctx.price('KUUDRA_TEETH'), pp = ctx.price('HEAVY_PEARL');
  const unpriced = (totals.essence && !ep) || (totals.teeth && !tp) || (totals.pearls && !pp);
  const upgradeCost = totals.essence * ep + totals.teeth * tp + totals.pearls * pp + totals.coins + totals.buyMissing;
  const buyCost = SLOTS.reduce((s, sl) => s + ctx.price(tx`${KUUDRA_PREFIX[target]}${fam}_${sl}`), 0);
  const resale = pieces.filter(p => !p.missing).reduce((s, p) => s + ctx.price(p.id), 0);
  const buyNet = buyCost ? Math.max(0, buyCost - resale) : 0;
  // Без рынка (Ironman, Stranded, Bingo) готовый сет не купить: только улучшать свой
  const cheaper = ctx.market !== false && !unpriced && buyNet && buyNet < upgradeCost * 0.9 ? 'buy' : 'upgrade';

  const n = x => Math.round(x).toLocaleString('ru-RU');
  const targetName = kuudraSetName(fam, target);
  const lines = [];
  lines.push(ru`Всего на улучшение: ${n(totals.essence)} эссенции Crimson, ${n(totals.teeth)} Kuudra Teeth${totals.pearls ? tx`, ${n(totals.pearls)} Heavy Pearl` : ''} и ${fmtCoins(totals.coins)} монет${upgradeCost && !unpriced && ctx.market !== false ? ru` — по ценам Bazaar ~${fmtCoins(upgradeCost)}` : ''}${totals.buyMissing ? ru` (с докупкой недостающих частей ~${fmtCoins(totals.buyMissing)})` : ''}`);
  for (const p of pieces) {
    if (p.missing) { lines.push(ctx.market === false ? ru`${SLOT_RU[p.slot]}: части нет — нужна из сундуков Kuudra (${targetName})` : ru`${SLOT_RU[p.slot]}: части нет — купить ${targetName}${p.price ? tx` ~${fmtCoins(p.price)}` : ''}`); continue; }
    const parts = p.steps.map(s => {
      const starTxt = s.starsFrom < 10 ? ru`звёзды ${s.starsFrom}→10 (${n(s.stars.essence)} эссенции${s.stars.pearls ? tx`, ${s.stars.pearls} Heavy Pearl` : ''})` : 'звёзды уже 10';
      return ru`${KUUDRA_TIER_RU[s.tier]}: ${starTxt}, затем престиж → ${KUUDRA_TIER_RU[s.tier + 1]} (${n(s.prestige.essence)} эссенции, ${s.prestige.teeth} зубов, ${fmtCoins(s.prestige.coins)})`;
    });
    const attrs = p.attributes && typeof p.attributes === 'object' ? Object.entries(p.attributes).filter(([, v]) => typeof v === 'number') : [];
    lines.push(tx`${SLOT_RU[p.slot]} (${p.stars}★): ${parts.join('; ')}${attrs.length ? ru` · атрибуты: ${attrs.map(([k, v]) => tx`${k} ${v}`).join(', ')}` : ''}`);
  }
  lines.push('Как: звёзды и престиж ставятся в меню улучшения предмета у кузнеца (Blacksmith). Престиж доступен, когда на части 10 звёзд; после него звёзды обнуляются, поэтому качай по одному тиру');
  lines.push(ctx.market === false ? 'Где брать: эссенция Crimson и Kuudra Teeth гарантированно падают из сундуков Kuudra (на высоких тирах больше)'
    : ru`Где брать: эссенция Crimson и Kuudra Teeth гарантированно падают из сундуков Kuudra (на высоких тирах больше) и продаются на Bazaar${totals.pearls ? '; Heavy Pearl — Bazaar' : ''}`);
  const combat = ctx.m.skills?.combat?.level || 0;
  const runs = ctx.m.crimson?.kuudra?.[KUUDRA_RUN[target]] || 0;
  const wear = [combat < WEAR_COMBAT[target] && ru`Combat ${WEAR_COMBAT[target]} (у тебя ${combat})`, !runs && ru`пройти Kuudra ${KUUDRA_TIER_RU[target]}`].filter(Boolean);
  if (wear.length) lines.push(ru`Чтобы надеть ${targetName}, нужно: ${wear.join(' и ')}. Улучшать можно заранее`);
  if (buyCost && ctx.market !== false) {
    lines.push(cheaper === 'buy'
      ? ru`Сейчас выгоднее купить готовый ${targetName} (~${fmtCoins(buyCost)}) и продать свой (~${fmtCoins(resale)}): выходит ~${fmtCoins(buyNet)} против ~${fmtCoins(upgradeCost)} за улучшение`
      : ru`Для сравнения: купить готовый ${targetName} ~${fmtCoins(buyCost)}${resale ? ru`, минус продажа своего ~${fmtCoins(resale)} = ~${fmtCoins(buyNet)}` : ''}${unpriced ? '' : ru`; улучшать свой — ~${fmtCoins(upgradeCost)}`}`);
  }
  return { fam, from, target, pieces, totals, upgradeCost: unpriced ? 0 : upgradeCost, buyCost, resale, buyNet, cheaper, lines };
}
