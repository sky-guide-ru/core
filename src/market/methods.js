// Методы заработка: проверка требований по профилю, доход в час, план «что открыть дальше»
import { profileMode } from '../lib/profile-mode.js';
import { bazaarFlips, craftFlips, forgeFlips, planForge, buyPrice } from './flips.js';
import { cropProfits } from './crops.js';
import { trend } from './history.js';
import { nameOf } from './util.js';
import { personalRate } from './calibration.js';
import { checkCrafttext, collectionsFromNeu } from './requirements.js';
import { METHOD_DETAILS, EFFORT, RISK } from './method-details.js';
import { COMBAT_METHODS } from './methods/combat.js';
import { FISHING_METHODS } from './methods/fishing.js';
import { MISC_METHODS, MISC_PATCHES } from './methods/misc.js';
import { MINING_METHODS } from './methods/mining.js';
import { RESALE_METHODS } from './methods/resale.js';
import { CRIMSON_METHODS } from './methods-crimson.js';
import { PASSIVE_METHODS } from './methods-passive.js';
import { PASSIVE_DETAILS } from './method-details-passive.js';
import { mayorBoost, mayorNoteText } from './mayor-boost.js';
import { tx } from '../../i18n/msg.js';

Object.assign(METHOD_DETAILS, PASSIVE_DETAILS);

const M = 1_000_000;

// ---------- помощники по профилю ----------
const lvl = (o) => Number(o?.level || 0);
const skill = (m, k) => lvl(m?.skills?.[k]);
const slayer = (m, k) => lvl(m?.slayers?.[k]);
const cata = m => lvl(m?.dungeons?.catacombs);
const floors = (m, f) => Number(m?.dungeons?.floors?.[f] || 0);
const master = (m, f) => Number(m?.dungeons?.masterFloors?.[f] || 0);
const hotm = m => lvl(m?.mining?.hotm);
const kuudra = (m, t) => Number(m?.crimson?.kuudra?.[t] || 0);
// Тиры Kuudra открываются репутацией любой из фракций (Mages или Barbarians)
const crimsonRep = m => Math.max(Number(m?.crimson?.barbarianRep || 0), Number(m?.crimson?.mageRep || 0));

/** Все id предметов игрока (инвентарь, броня, гардероб, эндер-сундук, рюкзаки, хранилище, экипировка). */
export function ownedIds(m) {
  if (m?._ownedIds) return m._ownedIds;
  const set = new Set();
  const inv = m?.inv || {};
  const walk = v => {
    if (!v) return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (typeof v === 'object') {
      if (typeof v.id === 'string') { set.add(v.id); return; }
      for (const x of Object.values(v)) walk(x);
    }
  };
  for (const k of ['inventory', 'armor', 'equipment', 'wardrobe', 'enderChest', 'vault', 'backpacks', 'quiver', 'fishingBag']) walk(inv[k]);
  for (const p of m?.pets || []) if (p?.type) set.add(tx`PET_${p.type}`);
  try { Object.defineProperty(m, '_ownedIds', { value: set, enumerable: false }); } catch {}
  return set;
}

/** Есть ли у игрока хоть один из предметов. Шаблон "*_CRIMSON_CHESTPLATE" ловит HOT_/BURNING_/… варианты, "THEORETICAL_HOE*" — все тиры. */
export function hasAny(m, patterns) {
  const ids = ownedIds(m);
  return patterns.some(p => {
    if (p.startsWith('*')) { const suf = p.slice(1); for (const id of ids) if (id.endsWith(suf)) return true; return false; }
    if (p.endsWith('*')) { const pre = p.slice(0, -1); for (const id of ids) if (id.startsWith(pre)) return true; return false; }
    return ids.has(p);
  });
}

const fmtN = n => Number(n || 0).toLocaleString('ru-RU');
/** Требование «уровень X+» с тем, что есть у игрока сейчас: «Farming 40+», have «у тебя 60». */
const need = (label, cur, min, extra = {}) => ({ text: tx`${label} ${min}+`, ok: cur >= min, have: tx`у тебя ${fmtN(cur)}`, ...extra });
const raz = n => (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'раза' : 'раз');
const runs = n => (n > 0 ? tx`пройден ${fmtN(n)} ${raz(n)}` : 'ещё не пройден');

const fmtM = n => tx`${(n / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;

/** Живые деньги игрока: кошелёк + Bank. */
const liquid = m => Number(m?.purse || 0) + Number(m?.bank || 0);
/**
 * Сколько игрок реально может вложить в один крафт: живые деньги, а если богатство известно — до 20% от него
 * (часть можно продать). Крафт за 500 млн при богатстве 300 млн не предлагаем.
 */
export function spendBudget(m, o = {}) {
  return Math.max(liquid(m), Number(o.networth || 0) * 0.2, 1 * M);
}

/**
 * Каталог методов. range — ориентир в монетах/час для уверенной экипировки (оценка сообщества, 2025–2026);
 * compute — точный расчёт по живым ценам. mode: active — нужна игра, passive — идёт само, daily — раз в день.
 */
export const METHODS = [
  {
    id: 'farming', title: 'Фарм культур в Garden', tag: 'Farming', mode: 'active',
    desc: 'Сильнейшая сторона профиля. Доход посчитан по живым ценам для лучшей культуры при твоём Farming Fortune; продаём в том виде, который выгоднее (NPC, сырьё или сжатое на Bazaar).',
    req: m => [need('Farming', skill(m, 'farming'), 40)],
    compute: (ctx, m, o) => {
      const ff = o.farmingFortune ?? estimateFarmingFortune(m);
      const list = cropProfits(ctx, ff, { bps: o.bps });
      const best = list[0];
      if (!best?.perHour) return null;
      return {
        coinsPerHour: best.perHour,
        detail: tx`Лучшая культура: ${best.name}, продавать как ${best.sellAsName} (${best.market}). Farming Fortune ${Math.round(typeof ff === 'number' ? ff : best.fortune)}${o.farmingFortune == null ? ' (грубая оценка: укажи своё значение ползунком на вкладке «Культуры»)' : ''}. Посчитан только урожай: с патча 0.27.3 (ноябрь 2026) NPC платит за культуры в 1,5–2 раза меньше (арбуз 0,5, тростник и незерский нарост по 1,5). Pests, Jacob's Contest и дропы Dicer сверху; Hypixel целился в ~25–30 млн/ч для фарма Pests на максимальной экипировке.`,
        top: list.slice(0, 3).map(c => ({ id: c.id, name: c.name, perHour: c.perHour })),
      };
    },
    drops: ['ENCHANTED_NETHER_STALK', 'ENCHANTED_MELON_BLOCK', 'ENCHANTED_SUGAR_CANE', 'ENCHANTED_COCOA'],
  },
  {
    id: 'bazaar-flip', title: 'Флипы на Bazaar', tag: 'Торговля', mode: 'active',
    desc: 'Ставишь ордера на покупку и продажу по самым ходовым товарам и перебиваешь конкурентов. Нужен стартовый капитал и внимание; доход — сумма трёх лучших флипов прямо сейчас.',
    req: m => [{ text: 'Капитал от 10 млн', ok: Number(m?.purse || 0) + Number(m?.bank || 0) >= 10 * M, soft: true, have: tx`монет в кошельке и банке: ${fmtM(Number(m?.purse || 0) + Number(m?.bank || 0))}` }],
    compute: (ctx, m, o) => {
      // в обороте держим половину живых денег и делим её между тремя товарами (раньше каждому давали весь бюджет)
      const budget = Math.max(10 * M, liquid(m)) * 0.5;
      const flips = bazaarFlips(ctx, { limit: 3, budget: budget / 3 });
      if (!flips.length) return null;
      const sum = k => flips.reduce((s, f) => s + (f[k] || 0), 0);
      return {
        coinsPerHour: sum('perHour'), range: [sum('perHourLow'), sum('perHourHigh')],
        detail: tx`Лучшие сейчас: ${flips.map(f => f.name).join(', ')}. В обороте ${fmtM(budget)} (половина твоих монет). Считаем по обычному спреду за неделю и 1–4% оборота товара: остальное забирают конкуренты, которые перебивают ордера каждую минуту.`,
        top: flips.map(f => ({ id: f.id, name: f.name, perHour: f.perHour })),
      };
    },
  },
  {
    id: 'craft-flip', title: 'Крафт-флипы', tag: 'Торговля', mode: 'active',
    desc: 'Покупаешь ингредиенты, крафтишь и продаёшь дороже. Учтены налоги и объём рынка; у части рецептов нужна разблокированная коллекция.',
    req: () => [],
    compute: (ctx, m, o) => {
      // craftFlips сортирует по прибыли за крафт; для дохода в час берём лучшие по монетам в час.
      // Рецепты, которые игрок ещё не открыл (коллекция, HotM, слеер), и крафты дороже его бюджета не предлагаем.
      const colls = o.collections || collectionsFromNeu(ctx.items);
      const budget = spendBudget(m, o);
      const list = craftFlips(ctx, { limit: 120, includeForge: false, maxCost: budget, budget, skipSuspicious: true })
        .filter(f => !f.suspicious && checkCrafttext(f.crafttext, m, colls).ok !== false)
        .sort((a, b) => b.perHour - a.perHour).slice(0, 3);
      if (!list.length) return null;
      const f = list[0];
      return {
        coinsPerHour: f.perHour, range: [f.perHourLow || 0, f.perHour],
        detail: tx`Лучший сейчас: ${f.name} (+${fmtM(f.profit)} за крафт, продать реально ≈${(f.craftsPerHour * 24).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} шт. в день). Учтён спрос: берём 3% дневного оборота на Bazaar и 15% продаж на аукционе, и только крафты до ${fmtM(budget)}. ${f.req || ''}`.trim(),
        top: list.map(x => ({ id: x.id, name: x.name, perHour: x.perHour })),
      };
    },
  },
  {
    id: 'forge', title: 'Forge в Dwarven Mines', tag: 'Mining', mode: 'passive',
    desc: 'Пассивный доход: загружаешь слоты Forge и забираешь результат. Посчитано на все слоты по лучшему рецепту прямо сейчас.',
    req: m => [need('HotM', hotm(m), 2)],
    compute: (ctx, m, o) => {
      const slots = o.forgeSlots ?? (hotm(m) >= 7 ? 5 : hotm(m) >= 5 ? 4 : hotm(m) >= 3 ? 3 : 2);
      // Quick Forge: 10% + 0.5% за уровень перка (если в профиле есть уровень перка)
      const qfLvl = Number(m?.mining?.nodes?.quick_forge || 0);
      const qf = o.quickForge ?? (qfLvl > 0 ? Math.min(0.3, 0.1 + 0.005 * qfLvl) : 0);
      const colls = o.collections || collectionsFromNeu(ctx.items);
      const budget = spendBudget(m, o);
      const list = forgeFlips(ctx, { limit: 40, quickForge: qf, maxCost: budget, skipSuspicious: true })
        .filter(f => checkCrafttext(f.crafttext, m, colls).ok !== false);
      const plan = planForge(list, slots);
      if (!plan.used.length) return null;
      const f = plan.used[0];
      return {
        coinsPerHour: plan.perHour, range: [plan.perHourLow, plan.perHour],
        detail: tx`${plan.used.map(x => tx`${x.name} — ${x.slots} сл. (+${fmtM(x.profit)} за ${x.durationH} ч)`).join('; ')}. Слотов: ${slots}. В один рецепт кладём не больше слотов, чем успеешь продать${plan.idle >= 0.5 ? tx`; на ${Math.round(plan.idle * 10) / 10} сл. выгодного спроса не нашлось` : ''}. Нижняя граница — если продавать сразу, а не выставлять ордер.`,
        top: plan.used.slice(0, 5).map(x => ({ id: x.id, name: x.name, perHour: x.perHour * x.slots })),
      };
    },
  },
  ...MINING_METHODS,
  // слееры, данжи, Kuudra и фарм мобов — в methods/combat.js
  ...COMBAT_METHODS,
  {
    id: 'diana', title: 'Mythological Ritual (Diana)', tag: 'Ивенты', mode: 'active', range: [10, 30],
    desc: 'Копаешь Griffin Burrows: Chimera, Minos Relic, Daedalus Stick. Только когда мэр — Diana.',
    req: (m, o) => [
      { text: 'Мэр сейчас Diana', ok: o.mayor ? /diana/i.test(o.mayor) : false, unknown: !o.mayor, have: o.mayor ? tx`сейчас мэр ${o.mayor}` : 'мэр пока неизвестен' },
      { text: 'Питомец Griffin', ok: (m?.pets || []).some(p => p?.type === 'GRIFFIN'), soft: true, buy: ['GRIFFIN;4'] },
    ],
    drops: ['ENCHANTMENT_ULTIMATE_CHIMERA_1', 'MINOS_RELIC', 'DAEDALUS_STICK', 'GRIFFIN_FEATHER'],
  },
  {
    id: 'visitors', title: 'Garden Visitors', tag: 'Farming', mode: 'daily',
    desc: 'Выполняй заказы Visitors: Copper для SkyMart, Overgrown Grass, Jungle Key, опыт Garden. Отказывайся от убыточных заказов.',
    req: m => [{ text: 'Garden открыт', ok: !!m?.garden }],
    drops: ['JUNGLE_KEY', 'FINE_FLOUR', 'OVERGROWN_GRASS', 'DEDICATION;4'],
  },
  {
    id: 'experiments', title: 'Experimentation Table', tag: 'Ежедневно', mode: 'daily',
    desc: 'Ежедневные Superpairs дают Titanic Experience Bottle и дорогие книги. 10 минут в день.',
    req: m => [{ ...need('Enchanting', skill(m, 'enchanting'), 60), text: 'Enchanting 60', soft: true }],
    drops: ['TITANIC_EXP_BOTTLE', 'GRAND_EXP_BOTTLE', 'ENCHANTMENT_ULTIMATE_LEGION_1'],
  },
  ...FISHING_METHODS,
  ...MISC_METHODS,
  ...CRIMSON_METHODS,
  ...PASSIVE_METHODS,
  // Перепродажа и улучшение (снайп, книги, звёзды, Kismet) — отдельный файл, разбор в def.details
  ...RESALE_METHODS,
];
for (const p of MISC_PATCHES) Object.assign(METHODS.find(x => x.id === p.id) || {}, p);

/**
 * Приблизительный Farming Fortune по профилю, если точного значения нет.
 * Уровень Farming даёт 4 FF за уровень, апгрейды культур в Garden по 5 FF за уровень; остальное — по набору брони.
 */
export function estimateFarmingFortune(m) {
  let ff = skill(m, 'farming') * 4;
  const ups = Object.values(m?.garden?.cropUpgrades || {});
  ff += (ups.length ? Math.max(...ups) : 0) * 5;
  if (hasAny(m, ['FERMENTO_CHESTPLATE', 'HELIANTHUS_CHESTPLATE'])) ff += 1100;
  else if (hasAny(m, ['SQUASH_CHESTPLATE'])) ff += 850;
  else if (hasAny(m, ['CROPIE_CHESTPLATE'])) ff += 650;
  else if (hasAny(m, ['MELON_CHESTPLATE'])) ff += 400;
  else ff += 200;
  return Math.round(ff);
}

function marketPrice(ctx, id) {
  const bz = ctx.bazaar.get(id);
  if (bz) return bz.sell || bz.buy || 0;
  return ctx.bin.get(id)?.price || 0;
}

/**
 * Методы заработка с проверкой требований и доходом в час.
 * @param {object} member объект Member из ядра
 * @param {import('./flips.js').MarketCtx} ctx
 * @param {{ farmingFortune?: number|Record<string, number>, bps?: number, mayor?: string, forgeSlots?: number, quickForge?: number,
 *   sessions?: import('./calibration.js').Session[] }} [opts]
 */
// Методы, которые целиком держатся на Bazaar/аукционе: в Ironman, Stranded и Bingo их нет
const MARKET_ONLY = new Set(['bazaar-flip', 'craft-flip']);

export function moneyMethods(member, ctx, opts = {}) {
  const out = [];
  const mode = profileMode(member?.gameMode);
  for (const def of METHODS) {
    if (!mode.market && (MARKET_ONLY.has(def.id) || def.marketOnly)) continue;
    const reqs = def.req(member, opts);
    const hard = reqs.filter(r => !r.soft);
    const available = hard.every(r => r.ok);
    let computed = null;
    if (def.compute) {
      try { computed = def.compute(ctx, member, opts); } catch { computed = null; }
    }
    // Перки мэра и министра (Aatrox, Paul, Derpy…) меняют доход: множитель к расчёту и ориентиру, личные сессии не трогаем
    const boost = mayorBoost(def, opts.perks);
    const k = boost?.factor || 1;
    const range0 = def.range ? def.range.map(x => x * M)
      : computed?.range && computed.coinsPerHour ? [Math.min(computed.range[0], computed.coinsPerHour), Math.max(computed.range[1], computed.coinsPerHour)] : null;
    const range = range0 && k !== 1 ? range0.map(x => x * k) : range0;
    const personal = personalRate(opts.sessions, def.id, ctx.now ?? Date.now());
    const coinsPerHour = personal?.coinsPerHour ?? (computed?.coinsPerHour ? computed.coinsPerHour * k : null) ?? (range ? (range[0] + range[1]) / 2 : null);
    const source = personal ? 'personal' : computed?.coinsPerHour ? 'live' : def.range ? 'estimate' : null;
    const dropPrices = (def.drops || []).map(id => {
      const price = marketPrice(ctx, id);
      const hist = ctx.bazaar.has(id) ? ctx.history?.[id] : ctx.binHistory?.[id];
      const t = hist ? trend(hist, price, ctx.bazaar.has(id) ? 2 : 1, ctx.now) : null;
      return { id, name: nameOf(ctx, id), price, d7: t?.d7?.pct ?? null };
    }).filter(d => d.price);
    const moving = dropPrices.filter(d => d.d7 != null && Math.abs(d.d7) >= 10);
    const missing = reqs.filter(r => !r.ok && !r.unknown);
    const upgrade = missing.filter(r => r.buy).map(r => {
      const opts2 = r.buy.map(id => ({ id, name: nameOf(ctx, id), price: marketPrice(ctx, id) })).filter(x => x.price).sort((a, b) => a.price - b.price);
      return { text: r.text, cheapest: opts2[0] || null };
    });
    const upgradeCost = upgrade.reduce((s, u) => s + (u.cheapest?.price || 0), 0);
    const det = METHOD_DETAILS[def.id] || def.details || {};
    // Стартовый набор: что уже есть, что докупить и по какой цене. Требования с buy уже в upgrade — их не дублируем.
    const kit = (det.kit || []).map(k => {
      const owned = k.own ? hasAny(member, k.own) : null;
      const offers = (k.buy || []).map(id => ({ id, name: nameOf(ctx, id), price: marketPrice(ctx, id) })).filter(x => x.price).sort((a, b) => a.price - b.price);
      return { text: k.text, owned, capital: k.capital || null, cheapest: owned ? null : offers[0] || null, note: k.note || null };
    });
    // Покупки окупаются доходом, а капитал в обороте возвращается — поэтому окупаемость считаем только по покупкам
    const buyCost = upgradeCost + kit.reduce((s, k) => s + (k.owned === false && k.cheapest ? k.cheapest.price : 0), 0);
    const capital = kit.reduce((s, k) => s + (k.capital || 0), 0);
    const startCost = buyCost + capital;
    out.push({
      id: def.id, title: def.title, tag: def.tag, mode: def.mode, desc: def.desc,
      available, ready: available && missing.length === 0,
      reqText: reqs.map(r => tx`${r.unknown ? '❔' : r.ok ? '✅' : r.soft ? '⚠️' : '❌'} ${r.text}`),
      missing: missing.map(r => r.text),
      missingHard: missing.filter(r => !r.soft).length,
      unknownReq: reqs.some(r => r.unknown),
      coinsPerHour, coinsPerHourRange: personal ? null : range, source,
      sourceText: (computed?.sourceText && source !== 'personal' ? computed.sourceText : source === 'personal' ? tx`по твоим сессиям (${personal.sessions} шт.)` : source === 'live' ? (range ? 'расчёт по текущим ценам и спросу: от осторожного до хорошего' : 'расчёт по текущим ценам') : source === 'estimate' ? 'ориентир сообщества для хорошей экипировки, до патча 0.27.3' : 'зависит от дня')
        + (!mode.market && source !== 'personal' ? tx`; в ${mode.label} продаёшь только NPC, поэтому реальный доход ниже` : ''),
      detail: computed?.detail || null, top: computed?.top || null, breakdown: computed?.breakdown || null, breakdownUnit: computed?.breakdownUnit || null, meter: computed?.meter || null,
      mayorNote: mayorNoteText(boost), mayorFactor: boost && boost.factor !== 1 ? boost.factor : null,
      dropPrices,
      marketNote: moving.length ? moving.map(d => tx`${d.name} ${d.d7 > 0 ? 'подорожал' : 'подешевел'} на ${Math.abs(d.d7)}% за неделю`).join('; ') : null,
      upgrade: upgrade.length ? upgrade : null, upgradeCost: upgradeCost || null,
      // Разбор метода: требования с тем, что есть у игрока, шаги, риски, стартовый капитал и окупаемость
      reqs: reqs.map(r => ({ text: r.text, status: r.unknown ? 'unk' : r.ok ? 'ok' : r.soft ? 'soft' : 'no', have: r.have || null, soft: !!r.soft })),
      reqDone: reqs.filter(r => r.ok).length, reqTotal: reqs.length,
      effort: det.effort || null, effortText: EFFORT[det.effort] || null,
      risk: det.risk || null, riskText: RISK[det.risk] || null,
      xp: det.xp || null, steps: det.steps || [], risks: det.risks || [],
      kit, startCost, buyCost, capital,
      paybackHours: buyCost && coinsPerHour ? Math.round(buyCost / coinsPerHour * 10) / 10 : null,
    });
  }
  const rank = x => (x.available ? 2 : 0) + (x.ready ? 1 : 0);
  return out.sort((a, b) => rank(b) - rank(a) || (b.mode === 'active') - (a.mode === 'active') || expectedPerHour(b) - expectedPerHour(a));
}

/**
 * Доход в час для сравнения методов. У перепродаж разброс огромный (1,8–18 млн: «три лучшие сделки, если все пройдут»),
 * и по верху диапазона они всегда обгоняли стабильные методы. Поэтому при диапазоне берём среднее геометрическое его краёв.
 */
export function expectedPerHour(x) {
  const [lo, hi] = x.range || [];
  return lo > 0 && hi > 0 ? Math.sqrt(lo * hi) : x.coinsPerHour || 0;
}

// «около 5–8,4 млн в час», если у метода есть разброс, иначе одно число
const perHourText = x => {
  const [lo, hi] = x.range || [];
  const n = v => (v / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  return lo > 0 && hi > lo * 1.05 ? tx`${n(lo)}–${n(hi)} млн` : fmtM(x.coinsPerHour);
};

/**
 * План заработка: что делать сейчас и что выгоднее всего открыть дальше (с окупаемостью вложений).
 * @returns {{ now: object[], passive: object[], daily: object[], next: object[], summary: string }}
 */
export function moneyPlan(member, ctx, opts = {}) {
  // список уже посчитан (маршрут «Заработка» отдаёт его рядом с планом) — второй раз не считаем
  const list = opts.list || moneyMethods(member, ctx, opts);
  const active = list.filter(x => x.mode === 'active' && x.available && x.coinsPerHour).sort((a, b) => expectedPerHour(b) - expectedPerHour(a));
  const bestNow = active[0] ? expectedPerHour(active[0]) : 0;
  const next = list
    // событийный контент с неизвестным мэром (Diana) — не цель, а «когда будет ивент»
    .filter(x => x.mode === 'active' && (!x.ready) && !x.unknownReq && x.id !== active[0]?.id && (x.coinsPerHour || 0) > bestNow * 0.8)
    .map(x => {
      const gain = (x.coinsPerHour || 0) - bestNow;
      const paybackHours = x.upgradeCost && gain > 0 ? Math.round(x.upgradeCost / gain * 10) / 10 : null;
      return { id: x.id, title: x.title, coinsPerHour: x.coinsPerHour, gainPerHour: gain, missing: x.missing, missingHard: x.missingHard, upgrade: x.upgrade, upgradeCost: x.upgradeCost, paybackHours };
    })
    // ближайшие цели первыми: меньше жёстких требований не выполнено, затем больше прибавка
    .sort((a, b) => a.missingHard - b.missingHard || b.gainPerHour - a.gainPerHour)
    .slice(0, 5);
  const top = active[0];
  const summary = top
    ? tx`Сейчас выгоднее всего: ${top.title} — около ${perHourText(top)} в час (${top.sourceText}).` +
      (next[0] ? tx` Следующая цель: ${next[0].title} (около ${fmtM(next[0].coinsPerHour)} в час), не хватает: ${next[0].missing.join(', ') || 'опыта'}.` : '')
    : 'Нет данных о ценах — дождись первого обновления Bazaar.';
  return {
    now: active.slice(0, 5),
    passive: list.filter(x => x.mode === 'passive' && x.available),
    daily: list.filter(x => x.mode === 'daily' && x.available),
    next, summary,
  };
}

export { buyPrice };
