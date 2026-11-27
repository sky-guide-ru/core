// Методы «Перепродажа»: снайп аукциона, сборка книг на наковальне, улучшение предметов (звёзды, Master Stars,
// Recombobulator) и Kismet Feather. Подключаются в METHODS (methods.js); разбор (шаги, риски, набор) лежит
// здесь же в поле details, чтобы не толкаться с другими категориями в method-details.js.
import { binSnipes } from '../flips.js';
import { bookCombos, upgradeFlips } from '../resale.js';
import { median, nameOf } from '../util.js';
import { tx } from '../../../i18n/msg.js';

const M = 1_000_000;
const fmtM = n => tx`${(n / M).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
const liquid = m => Number(m?.purse || 0) + Number(m?.bank || 0) + Number(m?.personalBank || 0); // как в плане: кошелёк, Bank и личный Bank
const budgetOf = (m, o) => Math.max(liquid(m), Number(o?.networth || 0) * 0.2, 1 * M);
const capitalReq = (m, min) => ({ text: tx`Капитал от ${fmtM(min)}`, ok: liquid(m) >= min, soft: true, have: tx`монет в кошельке и банке: ${fmtM(liquid(m))}` });
const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
/** «Ultimate Chimera V» из ENCHANTMENT_ULTIMATE_CHIMERA_5, если в базе нет имени получше. */
const bookName = (ctx, id) => {
  const n = nameOf(ctx, id);
  if (n !== id) return n;
  const mm = /^ENCHANTMENT_(.+)_(\d+)$/.exec(id);
  return mm ? tx`${mm[1].toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} ${roman(Number(mm[2]))}` : id;
};

export const RESALE_METHODS = [
  {
    id: 'ah-snipe', title: 'Снайп аукциона', tag: 'Перепродажа', mode: 'active', marketOnly: true,
    desc: 'Ловишь лоты, выставленные заметно дешевле рынка, и перепродаёшь по обычной цене. Сайт сканирует весь аукцион раз в 3 минуты и сверяет цену с реальными продажами.',
    req: m => [capitalReq(m, 5 * M)],
    compute: (ctx, m, o) => {
      const budget = budgetOf(m, o);
      const list = binSnipes(ctx, { limit: 10, maxPrice: budget, minProfit: 300_000 });
      if (!list.length) return null;
      // Лоты из снимка выкупают за секунды: без модов реально успеть 1–3 таких в час
      const p = median(list.map(x => x.profit));
      return {
        coinsPerHour: p * 2, range: [p, p * 3],
        detail: tx`Сейчас в снимке ${list.length} лот(ов) до ${fmtM(budget)}, обычная прибыль с одного около ${fmtM(p)}. Лучший: ${list[0].name} за ${fmtM(list[0].price)} при обычной цене ${fmtM(Math.min(list[0].second, list[0].median))}. Такие лоты выкупают за секунды, поэтому считаем 1–3 удачных покупки в час, а не все из списка.`,
      };
    },
    details: {
      effort: 'focus', risk: 'mid', xp: 'Опыта нет, только монеты',
      steps: [
        'Открой вкладку «Дешёвые лоты AH» на сайте: там лоты дешевле второго по цене и медианы продаж за сутки, с командой /viewauction.',
        'Скопируй команду и введи в чат игры. Если лот ещё висит, купи его.',
        'Проверь предмет: звёзды, чары, перековку (reforge) и Recombobulator. Сайт сравнивает только по названию.',
        'Выставь купленное с мгновенной покупкой (BIN) чуть дешевле самого дешёвого лота, но не ниже медианы продаж.',
        'Держи в обороте не больше половины свободных монет: часть покупок будет продаваться днями.',
      ],
      risks: [
        'Хорошие лоты за секунды забирают игроки с модами-снайперами. Большую часть списка ты не успеешь купить.',
        'Дешёвый лот бывает дешёвым не просто так: без звёзд, чар или с худшей перековкой. Смотри предмет перед покупкой.',
        'Аукцион берёт 1–2,5% за выставление и 1% при получении монет. Это уже вычтено из прибыли.',
        'Цена может упасть, пока предмет висит на продаже: тогда продаёшь в ноль или ждёшь.',
      ],
      kit: [{ text: 'Свободные монеты на покупку лотов', capital: 5 * M }],
    },
  },
  {
    id: 'book-combine', title: 'Сборка книг на наковальне', tag: 'Перепродажа', mode: 'active', marketOnly: true,
    desc: 'Покупаешь дешёвые книги низкого уровня на Bazaar, собираешь из двух одинаковых книгу на уровень выше и продаёшь. Собирать книги бесплатно; выше максимума стола зачарования обычные чары не собираются.',
    req: m => [capitalReq(m, 2 * M)],
    compute: (ctx, m, o) => {
      const budget = budgetOf(m, o);
      const list = bookCombos(ctx, { budget, limit: 10 });
      if (!list.length) return null;
      const top = list.slice(0, 3);
      const sum = k => top.reduce((s, x) => s + (x[k] || 0), 0);
      const b = list[0];
      return {
        coinsPerHour: sum('perHour'), range: [sum('perHourLow'), sum('perHour')],
        detail: tx`Лучшее сейчас: ${b.books} × ${bookName(ctx, b.from)} → ${bookName(ctx, b.id)}, +${fmtM(b.profit)} за книгу (${b.combines} сбор${b.combines === 1 ? 'ка' : 'ок'} на наковальне). Продать реально около ${b.demandDay.toLocaleString('ru-RU')} шт. в день: берём 3% дневного оборота книги, остальное забирают другие. Доход — три лучшие сборки вместе.`,
        top: top.map(x => ({ id: x.id, name: bookName(ctx, x.id), perHour: x.perHour })),
      };
    },
    drops: ['ENCHANTMENT_ULTIMATE_CHIMERA_1', 'ENCHANTMENT_ULTIMATE_LEGION_1', 'ENCHANTMENT_ULTIMATE_WISE_1'],
    details: {
      effort: 'semi', risk: 'low', xp: 'Опыта нет, только монеты',
      steps: [
        'Посмотри лучшие сборки в блоках «Что это» и «Доход» выше: сколько книг какого уровня купить и что получится.',
        'Купи нужное число книг на Bazaar. Ордером на покупку дешевле, но дольше; мгновенно — быстрее.',
        'Положи две одинаковые книги в наковальню (Anvil): получится книга на уровень выше. Повторяй, пока не соберёшь нужный уровень.',
        'Продай готовые книги ордером на продажу на Bazaar чуть дешевле лучшего предложения.',
      ],
      risks: [
        'Обычные чары собираются только до максимума стола зачарования (Sharpness V, Looting III, Growth V). Две книги уровнем выше дадут книгу ниже, а не выше.',
        'Если купить сразу много, цена книг низкого уровня вырастет, а готовых упадёт. Делай партиями.',
        'Bazaar берёт налог 1,125–1,25% с продажи. Он уже вычтен.',
      ],
      kit: [{ text: 'Монеты на закупку книг', capital: 2 * M }],
    },
  },
  {
    id: 'upgrade-flip', title: 'Улучшить и перепродать', tag: 'Перепродажа', mode: 'active', marketOnly: true,
    desc: 'Покупаешь на аукционе «голый» предмет, ставишь звёзды за эссенцию, Master Stars или Recombobulator 3000 и продаёшь дороже, чем потратил. Цены сравниваем по реальным продажам таких же улучшенных предметов.',
    req: m => [capitalReq(m, 10 * M)],
    compute: (ctx, m, o) => {
      const budget = budgetOf(m, o);
      const list = upgradeFlips(ctx, { budget, limit: 10 });
      if (!list.length) return null;
      const top = list.slice(0, 3);
      const sum = k => top.reduce((s, x) => s + (x[k] || 0), 0);
      const b = list[0];
      const ess = b.essence ? tx`, эссенция ${b.essence.toLocaleString('ru-RU')} шт.` : '';
      return {
        coinsPerHour: sum('perHour'), range: [sum('perHourLow'), sum('perHour')],
        detail: tx`Лучшее сейчас: ${b.name} — купить за ${fmtM(b.buy)}, поставить ${b.what} за ${fmtM(b.upgrade)}${ess}, продать около ${fmtM(b.sell)} после комиссий: +${fmtM(b.profit)}. Таких продаётся ${b.sold24h} в сутки, считаем 15% этого спроса. Доход — три лучшие сделки вместе, и только до ${fmtM(budget)} за предмет.`,
        top: top.map(x => ({ id: x.id, name: tx`${x.name}: ${x.what}`, perHour: x.perHour })),
      };
    },
    drops: ['RECOMBOBULATOR_3000', 'FIRST_MASTER_STAR', 'FIFTH_MASTER_STAR', 'ESSENCE_WITHER', 'ESSENCE_DRAGON'],
    details: {
      effort: 'semi', risk: 'mid', xp: 'Опыта нет, только монеты',
      steps: [
        'Выбери сделку в блоках «Что это» и «Доход» выше: какой предмет купить и что на него поставить.',
        'Найди на аукционе самый дешёвый такой предмет без звёзд (или с 5 звёздами для Master Stars). Сверь, что Recombobulator на нём нет, если собираешься ставить свой.',
        'Купи эссенцию нужного типа и Master Stars на Bazaar, Recombobulator 3000 — там же.',
        'Звёзды за эссенцию ставь в меню Essence Crafting у Malik в Dungeon Hub; Master Stars и Recombobulator 3000 — на наковальне (Anvil).',
        'Выставь с мгновенной покупкой (BIN) не дороже медианы продаж и не ниже суммы затрат.',
      ],
      risks: [
        'Чары, Hot Potato Book и перековку (reforge) сайт не различает: если купленный предмет хуже тех, что продаются, выручка будет меньше.',
        'Дорогие предметы продаются по 1–5 штук в сутки: монеты могут висеть на аукционе днями.',
        'Пока улучшаешь, цена может сдвинуться. Перед покупкой проверь свежие продажи (/ah).',
        'Комиссия аукциона 2–3,5% на дорогих лотах уже вычтена.',
      ],
      kit: [{ text: 'Монеты на предмет и улучшения', capital: 10 * M }],
    },
  },
  {
    id: 'kismet', title: 'Kismet Feather: когда перебрасывать', tag: 'Перепродажа', mode: 'daily',
    desc: 'Kismet Feather перебрасывает содержимое сундука после забега в данже. Подсказка: когда тратить перо, а когда выгоднее продать его на Bazaar.',
    req: m => [{ text: 'Пройден хотя бы один этаж Catacombs', ok: Object.values(m?.dungeons?.floors || {}).some(n => Number(n) > 0) || Object.values(m?.dungeons?.masterFloors || {}).some(n => Number(n) > 0) }],
    compute: (ctx) => {
      const b = ctx.bazaar.get('KISMET_FEATHER');
      const p = b ? (b.buy || b.sell) : ctx.bin.get('KISMET_FEATHER')?.price;
      if (!p) return null;
      const net = b ? b.sell * (1 - (ctx.tax ?? 0.01125)) : p;
      return {
        coinsPerHour: null,
        detail: tx`Kismet Feather сейчас: купить ${fmtM(p)}, продать ${fmtM(net)}. Перебрасывай только сундук, где возможен дроп во много раз дороже пера (Master Mode M5–M7, сундуки Bedrock и Obsidian). На низких этажах перо выгоднее продать.`,
      };
    },
    drops: ['KISMET_FEATHER', 'RECOMBOBULATOR_3000', 'FIFTH_MASTER_STAR'],
    details: {
      effort: 'daily', risk: 'low', xp: 'Опыт Catacombs за сами забеги',
      steps: [
        'После забега открой награды у Croesus или в сундуках на месте босса.',
        'Посмотри, что лежит в лучшем сундуке, и сравни с ценой открытия и ценой пера (она выше).',
        'Если сундук пустой по ценности, а этаж высокий, перебрось его пером и посмотри снова.',
        'На F1–F6 и M1–M3 перья лучше продавать: шанс окупить их там маленький.',
      ],
      risks: [
        'Переброс случайный: новый сундук может оказаться хуже старого.',
        'Перо одноразовое, и цена открытия сундука не меняется.',
      ],
    },
  },
];
