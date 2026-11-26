// Пассив, мэры и ежедневка для «Заработка» (очередь Q5 каталога docs/money-catalog.md):
// Inferno-миньоны на топливе Gabagool, Matriarch (Heavy Pearl), Stock of Stonks при мэре Diaz, проценты в банке.
// Методы подключаются в конец METHODS (methods.js), тексты разбора — в method-details-passive.js.
// Механика взята из NEU-REPO (рецепты, тиры и скорость миньонов, топливо) и вики fandom; что не сверено — помечено.
import { buyPrice, sellValue } from './flips.js';
import { extractRecipes, marketId, nameOf } from './util.js';
import { tx } from '../../i18n/msg.js';

const M = 1_000_000;
const fmtN = n => Number(n || 0).toLocaleString('ru-RU');
const fmtM = n => tx`${(n / M).toLocaleString('ru-RU', { maximumFractionDigits: n >= 10 * M ? 0 : 1 })} млн`;
const fmtC = n => (Math.abs(n) >= M ? fmtM(n) : tx`${fmtN(Math.round(n))} монет`);
const lvl = (o) => Number(o?.level || 0);
const need = (label, cur, min, extra = {}) => ({ text: tx`${label} ${min}+`, ok: cur >= min, have: tx`у тебя ${fmtN(cur)}`, ...extra });

// ---------- Inferno-миньоны ----------
// Время между действиями по тирам I–XI (NEU-REPO, лор INFERNO_GENERATOR_*). Сбор — каждое второе действие.
export const INFERNO_SPEED = [0, 1013, 982, 950, 919, 886, 855, 823, 792, 760, 728, 697];
// Rising Celsius: каждый Inferno-миньон на острове ускоряет все Inferno-миньоны на 18%, максимум 180% (10 штук).
export const CELSIUS_PER_MINION = 0.18;
export const CELSIUS_MAX = 10;
// Топливо работает 24 часа: множитель скорости, 4/5 обычной добычи заменяются Crude Gabagool (лор топлива в NEU).
// Редкие дропы (Chili Pepper, Inferno Vertex, Inferno Apex, Reaper Pepper) дают только Hypergolic-топлива.
export const INFERNO_FUELS = [
  { id: 'INFERNO_HYPERGOLIC_CRUDE_GABAGOOL', grade: 'Hypergolic', speed: 20, rare: true },
  { id: 'INFERNO_HEAVY_CRUDE_GABAGOOL', grade: 'Heavy', speed: 15, rare: false },
  { id: 'INFERNO_FUEL_CRUDE_GABAGOOL', grade: 'обычное', speed: 10, rare: false },
];
// На топливе с Crude Gabagool Distillate весь основной дроп — Crude Gabagool, 1 шт. за сбор (вики, таблица дропа).
export const SPECIALTY_SHARE = 1;
// Шанс на один сбор при легендарном (Hypergolic) топливе — таблица дропа вики fandom «Inferno Minion», сверено 23.11.2026
// (после патча 0.19.5: Vertex ×2,8, Apex +20%, Chili +15%). Inferno Minion X и XI создают два Apex вместо одного.
export const INFERNO_RARE = [
  { id: 'CHILI_PEPPER', chance: 1 / 136 },
  { id: 'INFERNO_VERTEX', chance: 1 / 5_950 },
  { id: 'REAPER_PEPPER', chance: 1 / 458_182 },
  { id: 'INFERNO_APEX', chance: 1 / 1_309_091, luck: true },
  { id: 'GABAGOOL_THE_FISH', chance: 1 / 3_927_273, luck: true },
];

/** Лучший скрафченный тир Inferno-миньона (из crafted_generators: «INFERNO_7»). */
export function infernoTier(m) {
  let best = 0;
  for (const s of m?.minions || []) {
    const r = /^INFERNO_(\d+)$/.exec(String(s));
    if (r) best = Math.max(best, Number(r[1]));
  }
  return best;
}

/** Цена покупки топлива: на рынке или крафтом из частей с Bazaar (что дешевле). */
function fuelCost(ctx, id) {
  const market = buyPrice(ctx, id);
  let best = market ? { cost: market.price, how: market.market } : null;
  const item = ctx.items?.get?.(id);
  for (const r of item ? extractRecipes(item) : []) {
    if (r.type !== 'craft') continue;
    let sum = 0, ok = true;
    for (const [part, n] of Object.entries(r.inputs)) {
      const p = buyPrice(ctx, marketId(part, ctx.items));
      if (!p) { ok = false; break; }
      sum += p.price * n;
    }
    if (ok && (!best || sum / r.count < best.cost)) best = { cost: sum / r.count, how: 'крафт' };
  }
  return best;
}

/** Сколько чистыми за штуку (продажа ордером на Bazaar или по медиане аукциона). */
const net = (ctx, id) => sellValue(ctx, id)?.net || 0;

/**
 * Доход Inferno-миньонов за сутки для каждого топлива.
 * @param {object} ctx рынок @param {{ tier?: number, count?: number, speedBonus?: number }} o
 * speedBonus — прочие прибавки скорости в долях (Flycatcher, маяк); speedMul — мэр Derpy (TURBO MINIONS, ×2)
 */
export function infernoPlan(ctx, { tier = 10, count = CELSIUS_MAX, speedBonus = 0, speedMul = 1 } = {}) {
  tier = Math.max(1, Math.min(11, tier));
  const celsius = CELSIUS_PER_MINION * Math.min(count, CELSIUS_MAX);
  const crude = net(ctx, 'CRUDE_GABAGOOL');
  return INFERNO_FUELS.map(f => {
    const fuel = fuelCost(ctx, f.id);
    if (!fuel) return null;
    const actionSec = INFERNO_SPEED[tier] / ((1 + celsius + speedBonus) * f.speed * speedMul);
    const harvests = 86400 / (2 * actionSec);
    const parts = [{ id: 'CRUDE_GABAGOOL', n: harvests * SPECIALTY_SHARE, unit: crude }];
    if (f.rare) {
      for (const r of INFERNO_RARE) {
        const n = harvests * r.chance * (r.id === 'INFERNO_APEX' && tier >= 10 ? 2 : 1);
        parts.push({ id: r.id, n, unit: net(ctx, r.id), luck: !!r.luck });
      }
    }
    for (const p of parts) p.value = p.n * p.unit;
    const gross = parts.reduce((s, p) => s + p.value, 0);
    const steady = parts.filter(p => !p.luck).reduce((s, p) => s + p.value, 0);
    return {
      fuel: f, fuelCost: fuel.cost, fuelHow: fuel.how, harvests,
      perMinionDay: gross - fuel.cost, steadyPerMinionDay: steady - fuel.cost,
      perDay: (gross - fuel.cost) * count, steadyPerDay: (steady - fuel.cost) * count,
      parts,
    };
  }).filter(Boolean).sort((a, b) => b.perDay - a.perDay);
}

// ---------- Matriarch ----------
// Вики fandom «The Matriarch» (сверено 23.11.2026): 3 Heavy Pearl в сутки, сброс в 20:00 по Нью-Йорку (ET);
// Matriarch's Perfume (1200 Bits) — ещё 3, до 4 раз в сутки; атрибут Matriarch Cubs — до +20% шанс лишней жемчужины.
export const MATRIARCH_PEARLS = 3;
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
/** Дата и время по Нью-Йорку для момента t: { y, m (0–11), d, h, min }. */
function nyParts(t) {
  const p = Object.fromEntries(NY.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month - 1, d: +p.day, h: +p.hour % 24, min: +p.minute };
}
/** Момент UTC, когда в Нью-Йорке наступает h:00 дня (y, m, d) — по правилам America/New_York, с переходом на летнее время. */
function nyTime(y, m, d, h) {
  let t = Date.UTC(y, m, d, h) + 5 * 3600_000; // сначала считаем как EST
  for (let i = 0; i < 2; i++) {
    const p = nyParts(t);
    t += (Date.UTC(y, m, d, h) - Date.UTC(p.y, p.m, p.d, p.h, p.min));
  }
  return t;
}
/** Ближайший сброс Matriarch: 20:00 по Нью-Йорку. */
export function matriarchReset(now = Date.now()) {
  const p = nyParts(now);
  const today = nyTime(p.y, p.m, p.d, 20);
  if (today > now) return today;
  const next = new Date(Date.UTC(p.y, p.m, p.d + 1));
  return nyTime(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 20);
}

// ---------- Bank ----------
// Проценты платят раз в сезон SkyBlock (≈31 час): по ступеням баланса, ставка падает с ростом суммы,
// у каждого уровня счёта свой потолок (Starter 250 тыс. … Palatial 1,5 млн за сезон). Ступени — вики fandom «Bank», сверено 23.11.2026.
export const BANK_TIERS = [[10 * M, 0.02], [20 * M, 0.01], [30 * M, 0.005], [50 * M, 0.002], [160 * M, 0.001], [5100 * M, 0.0001], [55000 * M, 0.00001]];
export const BANK_SEASON_H = 31;
export function bankInterest(balance) {
  let left = Number(balance || 0), prev = 0, sum = 0;
  for (const [cap, rate] of BANK_TIERS) {
    const part = Math.max(0, Math.min(left, cap - prev));
    sum += part * rate; left -= part; prev = cap;
    if (left <= 0) break;
  }
  return sum;
}

const perksOf = o => o?.perks || [];

export const PASSIVE_METHODS = [
  {
    id: 'inferno-minions', title: 'Inferno-миньоны на Gabagool', tag: 'Миньоны', mode: 'passive',
    // Derpy ускоряет миньонов вдвое, но топливо стоит столько же: учитываем в скорости, а не множителем дохода
    mayorInCompute: ['TURBO MINIONS!!!'],
    desc: 'Inferno-миньоны на Hypergolic-топливе каждый день дают Crude Gabagool и Chili Pepper, а иногда Inferno Vertex, Reaper Pepper и очень редко Inferno Apex. Топливо дорогое и работает сутки, поэтому доход посчитан за вычетом топлива по живым ценам.',
    req: m => {
      const t = infernoTier(m);
      return [
        { text: 'Blaze Slayer 3+ (рецепт Inferno Minion)', ok: lvl(m?.slayers?.blaze) >= 3 || t > 0, have: t ? tx`скрафчен тир ${t}` : tx`у тебя ${lvl(m?.slayers?.blaze)}` },
        { text: 'Свободные слоты на 10 Inferno-миньонов (максимум Rising Celsius)', ok: true, soft: true, have: 'слоты проверь в разделе «Миньоны»' },
      ];
    },
    compute: (ctx, m, o) => {
      const own = infernoTier(m);
      const tier = own || 10;
      const turbo = perksOf(o).includes('TURBO MINIONS!!!');
      const plan = infernoPlan(ctx, { tier, count: CELSIUS_MAX, speedMul: turbo ? 2 : 1 });
      const best = plan[0];
      if (!best) return null;
      const perHour = best.perDay / 24, steady = best.steadyPerDay / 24;
      const rare = best.parts.filter(p => p.id !== 'CRUDE_GABAGOOL');
      const line = p => tx`${nameOf(ctx, p.id)} ≈${p.n >= 1 ? fmtN(Math.round(p.n * 10) / 10) : tx`1 за ${fmtN(Math.round(1 / p.n))} дн.`} (${fmtC(p.value)})`;
      const head = tx`${CELSIUS_MAX} миньонов тира ${tier}${own ? '' : ' (у тебя пока нет Inferno-миньонов, считаем для X)'} на топливе ${best.fuel.grade}: сбор раз в ${Math.round(86400 / best.harvests * 10) / 10} с, топливо ${fmtC(best.fuelCost)} в сутки на миньона (${best.fuelHow}).`;
      const per = tx`За сутки с одного миньона в среднем: Crude Gabagool ≈${fmtN(Math.round(best.parts[0].n))} (${fmtC(best.parts[0].value)})${rare.length ? tx`, ${rare.map(line).join(', ')}` : ''}.`;
      const total = best.perDay > 0
        ? tx`Итого ≈${fmtC(best.perDay)} в сутки на все ${CELSIUS_MAX}, без удачи с Inferno Apex и Gabagool the Fish ≈${fmtC(best.steadyPerDay)}.`
        : tx`Сейчас топливо дороже добычи: минус ≈${fmtC(-best.perDay)} в сутки на все ${CELSIUS_MAX}. Ставь миньонов, когда Chili Pepper и Inferno Vertex подорожают или топливо подешевеет.`;
      return {
        coinsPerHour: perHour > 0 ? perHour : null,
        range: perHour > 0 ? [Math.max(0, steady), perHour] : undefined,
        detail: tx`${head} ${per} ${total} Шансы дропа по таблице вики, скорость с учётом Rising Celsius (+18% за миньона) без Flycatcher и маяка${turbo ? ', плюс мэр Derpy: миньоны вдвое быстрее' : ''}.`,
        top: rare.concat(best.parts[0]).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 4)
          .map(p => ({ id: p.id, name: nameOf(ctx, p.id), perHour: p.value * CELSIUS_MAX / 24 })),
      };
    },
    drops: ['CHILI_PEPPER', 'INFERNO_VERTEX', 'INFERNO_APEX', 'REAPER_PEPPER', 'CRUDE_GABAGOOL', 'INFERNO_HYPERGOLIC_CRUDE_GABAGOOL'],
  },
  {
    id: 'matriarch', title: 'Matriarch: Heavy Pearl', tag: 'Ежедневно', mode: 'daily',
    desc: 'Раз в сутки забираешь Heavy Pearl у Matriarch в Belly of the Beast на Crimson Isle. Пять минут, без вложений.',
    req: m => {
      const mt = m?.crimson?.matriarch;
      // забран ли жемчуг после последнего сброса (20:00 ET)
      const last = Number(mt?.lastAttempt || 0);
      const reset = matriarchReset();
      const leftH = last && last > reset - 86400_000 ? (reset - Date.now()) / 3600_000 : -1;
      return [
        { text: 'Доступ на Crimson Isle', ok: !!m?.crimson?.faction || Number(m?.skills?.combat?.level || 0) >= 24, have: m?.crimson?.faction ? 'фракция выбрана' : 'фракция не выбрана' },
        ...(mt ? [{ text: 'Жемчуг сегодня ещё не забран', ok: leftH <= 0, soft: true, have: leftH > 0 ? tx`снова через ≈${Math.ceil(leftH)} ч` : tx`всего забрано ${fmtN(mt.pearls || 0)}` }] : []),
      ];
    },
    compute: (ctx) => {
      const unit = net(ctx, 'HEAVY_PEARL');
      if (!unit) return null;
      return {
        coinsPerHour: null,
        detail: tx`Heavy Pearl сейчас ≈${fmtC(unit)} чистыми. ${MATRIARCH_PEARLS} шт. за заход ≈${fmtC(unit * MATRIARCH_PEARLS)} в сутки. Жемчуг нужен для улучшения брони и оружия Kuudra, поэтому спрос стабильный. Атрибут Matriarch Cubs (осколок Hellwisp) даёт шанс на лишнюю жемчужину, в среднем 3,8. Matriarch's Perfume за 1200 Bits даёт ещё 3, до 4 раз в сутки, но Bits выгоднее тратить на другое.`,
        top: [{ id: 'HEAVY_PEARL', name: nameOf(ctx, 'HEAVY_PEARL'), perHour: unit * MATRIARCH_PEARLS / 24 }],
      };
    },
    drops: ['HEAVY_PEARL'],
  },
  {
    id: 'stonks', title: 'Stock of Stonks (мэр Diaz)', tag: 'Ивенты', mode: 'daily',
    desc: 'Пока мэр Diaz, Richard в Trade Center проводит аукцион Stonks: ставка от 2 млн, каждый участник получает хотя бы один Stock of Stonks, больше ставка — больше акций. Их продают на Bazaar или меняют у Liz на Freshly-minted Coins, Golden Fragment и Avaricious Chalice.',
    req: (m, o) => {
      const on = perksOf(o).includes('Stock Exchange') || /diaz/i.test(o?.mayor || '');
      const known = !!o?.mayor || perksOf(o).length > 0;
      return [{ text: 'Мэр сейчас Diaz', ok: on, unknown: !known, have: known ? (on ? 'перк действует сейчас' : tx`сейчас мэр ${o?.mayor || 'другой'}`) : 'мэр пока неизвестен' }];
    },
    compute: (ctx) => {
      const unit = net(ctx, 'STOCK_OF_STONKS');
      if (!unit) return null;
      return {
        coinsPerHour: null,
        detail: tx`Stock of Stonks на Bazaar сейчас ≈${fmtC(unit)} чистыми. Выгодно, если на ставку выходит меньше этой цены за акцию: минимальная ставка 2 млн, сколько акций она даст — видно в окне аукциона у Richard.`,
        top: [{ id: 'STOCK_OF_STONKS', name: nameOf(ctx, 'STOCK_OF_STONKS'), perHour: 0 }],
      };
    },
    drops: ['STOCK_OF_STONKS'],
  },
  {
    id: 'bank-interest', title: 'Проценты в банке', tag: 'Ежедневно', mode: 'passive',
    desc: 'Bank сам начисляет проценты раз в сезон SkyBlock (около 31 часа). Ставка падает с ростом суммы, поэтому много монет в банке держать нет смысла — это подсказка, а не способ заработка.',
    req: m => [{ text: 'Монеты в банке', ok: Number(m?.bank || 0) > 0, soft: true, have: tx`в банке ${fmtC(Number(m?.bank || 0))}` }],
    compute: (ctx, m, o) => {
      const bal = Number(m?.bank || 0);
      if (!bal) return null;
      const season = bankInterest(bal);
      const boosted = perksOf(o).includes('Long Term Investment');
      return {
        coinsPerHour: season / BANK_SEASON_H,
        detail: tx`При балансе ${fmtC(bal)} Bank даёт ≈${fmtC(season)} за сезон, но не больше потолка твоего счёта: от 250 тыс. (Starter) до 1,5 млн (Palatial). Выше ≈50 млн ставка почти нулевая: такие деньги выгоднее вложить в Forge, миньонов или флипы.${boosted ? ' Сейчас действует перк Diaz Long Term Investment: проценты выше.' : ''}`,
      };
    },
  },
];

