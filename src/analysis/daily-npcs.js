// Fetchur и Puzzler (Dwarven Mines): бесплатный Mithril Powder каждый день. Сверено с вики 28.11.2026
// (hypixelskyblock.minecraft.wiki/w/Fetchur, /w/Puzzler). Hypixel API не отдаёт, сдан ли Fetchur или решён ли Puzzler сегодня,
// поэтому на сайте отметку ставит сам игрок.
import { ru, tx } from '../../i18n/msg.js';
import { short, cell } from '../guides/gathering-util.js';
import { npcCoinOffer, obtainHint } from '../lib/npc-shop.js';
import { ownedCount } from '../lib/owned.js';
import { prices, buyPriceOf } from '../prices.js';

export const FETCHUR_REWARD = { powder: 2500, coins: 20_000 };
export const PUZZLER_REWARD = { powder: 2500 };

/**
 * Что Fetchur просит: 12 предметов по кругу, каждый месяц круг начинается заново с Yellow Stained Glass.
 * День берётся по Нью-Йорку (сброс в полночь America/New_York). ids — подходит любой из них.
 */
export const FETCHUR = [
  { n: 20, ids: ['STAINED_GLASS-4'], name: 'Yellow Stained Glass' },
  { n: 1, ids: ['COMPASS'], name: 'Compass' },
  { n: 20, ids: ['MITHRIL_ORE'], name: 'Mithril', hint: 'добыть в Dwarven Mines' },
  { n: 1, ids: ['FIREWORK'], name: 'Firework Rocket' },
  { n: 1, ids: ['CHEAP_COFFEE', 'DECENT_COFFEE', 'BLACK_COFFEE'], name: 'Cheap Coffee / Decent Coffee / Black Coffee' },
  { n: 1, ids: ['WOOD_DOOR', 'IRON_DOOR'], name: 'Oak Door / Iron Door' },
  { n: 3, ids: ['RABBIT_FOOT'], name: 'Rabbit\'s Foot' },
  { n: 1, ids: ['SUPERBOOM_TNT'], name: 'Superboom TNT' },
  { n: 1, ids: ['PUMPKIN'], name: 'Pumpkin' },
  { n: 1, ids: ['FLINT_AND_STEEL'], name: 'Flint and Steel' },
  { n: 50, ids: ['EMERALD'], name: 'Emerald', hint: 'добыть в Deep Caverns (Slimehill)' },
  { n: 50, ids: ['WOOL-14'], name: 'Red Wool' },
];

/** Контекст цен по живому рынку: items — база NEU; noMarket — Ironman, Stranded, Bingo (только NPC). */
export function liveCtx(items, noMarket = false) {
  return {
    items, noMarket,
    buy: id => buyPriceOf(id),
    market: id => (prices.bazaar.has(id) ? 'Bazaar' : prices.bin.has(id) ? 'Auction House' : null),
  };
}

/** День месяца по Нью-Йорку (1–31). */
export function nyDay(now = Date.now()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric' }).format(new Date(now)));
}

/** Индекс просьбы Fetchur для дня месяца. */
export const fetchurIndex = day => (Math.max(1, day) - 1) % FETCHUR.length;

/**
 * Где взять и почём одну штуку: у NPC за монеты, на Bazaar/аукционе или самому.
 * ctx: { items, buy(id) → цена покупки на рынке, market(id) → 'Bazaar'|'Auction House'|null, noMarket }
 */
function sourceOf(ctx, id, hint = null) {
  const npc = ctx?.items ? npcCoinOffer(ctx.items, id) : null;
  const mkt = ctx?.noMarket ? 0 : Number(ctx?.buy?.(id)) || 0;
  if (npc && (!mkt || npc.coins <= mkt)) return { id, coins: npc.coins, where: ru`у NPC ${npc.npcName}` };
  if (mkt) return { id, coins: mkt, where: ctx.market?.(id) || 'Bazaar' };
  if (hint) return { id, coins: 0, where: hint };
  const how = ctx?.items ? obtainHint(ctx.items, id) : null;
  return { id, coins: 0, where: how?.text || 'добыть самому' };
}

/**
 * Просьба Fetchur на день: что, сколько, где взять дешевле всего, есть ли уже у игрока.
 * @returns {{ index, n, name, ids, best: { id, coins, where }, total, have, tomorrow: { n, name } }}
 */
export function fetchurRequest(m, ctx = {}, now = Date.now()) {
  const day = nyDay(now);
  const index = fetchurIndex(day);
  const r = FETCHUR[index];
  const opts = r.ids.map(id => sourceOf(ctx, id, r.hint));
  const priced = opts.filter(o => o.coins > 0).sort((a, b) => a.coins - b.coins);
  const best = priced[0] || opts[0];
  const have = r.ids.reduce((s, id) => s + ownedCount(m?.inv, id), 0);
  // Завтра: следующий день по Нью-Йорку (1-е число начинает круг заново)
  const t = FETCHUR[fetchurIndex(nyDay(now + 86400_000))];
  return { index, day, n: r.n, name: r.name, ids: r.ids, best, total: best.coins * r.n, have, tomorrow: { n: t.n, name: t.name } };
}

/** Есть ли у игрока доступ в Dwarven Mines (там стоят оба NPC). */
export function hasDwarvenMines(m) {
  const mi = m?.mining || {};
  return (mi.hotm?.level || 0) >= 1 || (mi.powder?.mithril || 0) > 0;
}

/** Строки «Дел на сегодня» для Fetchur и Puzzler (отметку ставит игрок: done = null). */
export function fetchurPuzzlerDailies(m, ctx = {}, now = Date.now()) {
  if (!hasDwarvenMines(m)) return [];
  const f = fetchurRequest(m, ctx, now);
  const what = tx`${f.n}× ${f.name}`;
  const how = f.have >= f.n ? ru`уже есть: ${f.have} шт.` : f.total > 0 ? ru`${f.best.where}, около ${short(f.total)} монет` : f.best.where;
  return [
    {
      id: 'fetchur', title: 'Fetchur', manual: 'day', done: null, href: '#/guides/mining', anchor: 'fetchur',
      text: ru`Сегодня просит ${what} (${how}). Награда: 2 500 Mithril Powder и 20 000 монет. Завтра: ${f.tomorrow.n}× ${f.tomorrow.name}.`,
      fetchur: { n: f.n, name: f.name, ids: f.ids, item: f.best.id, coins: f.total, have: f.have },
    },
    {
      id: 'puzzler', title: 'Puzzler', manual: '24h', done: null, href: '#/guides/mining', anchor: 'fetchur',
      text: 'У Grand Library: встаньте на Glowstone лицом к выходу из комнаты, пройдите по стрелкам и сломайте блок под ногами. Награда: 2 500 Mithril Powder.',
    },
  ];
}

/** Секция гайда Mining: где стоят NPC, круг Fetchur по дням месяца, как решать Puzzler. */
export function fetchurPuzzlerSection(m, ctx = {}, now = Date.now()) {
  const today = fetchurIndex(nyDay(now));
  const days = i => Array.from({ length: 31 }, (_, d) => d + 1).filter(d => fetchurIndex(d) === i).join(', ');
  return {
    kind: 'table', news: 'fetchur', title: 'Каждый день: Fetchur и Puzzler',
    note: 'Оба NPC стоят в Dwarven Mines и дают по 2 500 Mithril Powder в день, Powder Buff и событие 2x Powder увеличивают награду. Fetchur (84, 224, −118) просит один предмет на всех игроков и ещё платит 20 000 монет: просьба меняется в полночь по Нью-Йорку, с 1-го числа круг начинается заново, отдать нужно ровно столько, сколько он просит. Puzzler (182, 196, 136) сидит в комнате рядом с Grand Library: нажмите на него, встаньте на Glowstone лицом к выходу из комнаты и пройдите по стрелкам (одна стрелка — один блок: ▲ к выходу, ▼ от выхода, ◀ влево, ▶ вправо), затем сломайте блок, на котором оказались. Новая головоломка — через 24 часа после решения.',
    columns: ['Числа месяца', 'Fetchur просит', 'Где взять'],
    rows: FETCHUR.map((r, i) => {
      const src = r.ids.map(id => sourceOf(ctx, id, r.hint)).filter(o => o.coins > 0).sort((a, b) => a.coins - b.coins)[0] || sourceOf(ctx, r.ids[0], r.hint);
      return [
        cell(i === today ? tx`${days(i)} · сегодня` : days(i), i === today ? { tone: 'good' } : {}),
        cell(tx`${r.n}× ${r.name}`, { item: r.ids[0] }),
        src.coins > 0 ? ru`${src.where}, около ${short(src.coins * r.n)} монет` : src.where,
      ];
    }),
  };
}
