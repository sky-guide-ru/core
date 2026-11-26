// Инструменты для чата: ИИ сам запрашивает подробности, вместо того чтобы мы слали всё сразу.
// Так сводка остаётся маленькой (дёшево), а ответы точными.
import { fmtCoins } from './util.js';
import { allItems, compactItem, compareWeapons, cleanName, stripReforge, wornStats } from './inventory.js';
import { armorLoadouts, describeLoadout, dungeonLoadout, familiesLabel, SLOTS, SLOT_RU } from '../../advisor/lib/loadouts.js';
import { tx } from '../../../i18n/msg.js';

/** Порядок и текст определений фиксированы: они входят в кэшируемый префикс. */
export const TOOLS = [
  {
    name: 'get_item',
    description: 'Информация о предмете SkyBlock на русском: описание, где взять (крафт, дроп, NPC, магазин), текущая цена. Принимает SkyBlock ID (HYPERION) или название на русском/английском («гиперион», «терма»).',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', description: 'ID или название предмета' } } },
  },
  {
    name: 'get_price',
    description: 'Цены предмета: Bazaar (мгновенная покупка/продажа), lowest BIN и медиана продаж на аукционе, изменение за сутки и неделю.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', description: 'SkyBlock ID, например ENCHANTED_DIAMOND или TERMINATOR' } } },
  },
  {
    name: 'get_steps',
    description: 'Полные шаги плана прогрессии игрока от движка правил (зачем, как, цена). Можно отфильтровать по категории («Dungeons», «Slayers», «Снаряжение», «Аксессуары», «Питомцы», «Skills», «Деньги» и т.д.) или по id шага.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['filter'], properties: { filter: { type: 'string', description: 'Категория, id шага или пустая строка для топ-10' } } },
  },
  {
    name: 'get_money_methods',
    description: 'Способы заработка, доступные игроку сейчас, с оценкой монет в час и требованиями.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: [], properties: {} },
  },
  {
    name: 'get_gear',
    description: 'Снаряжение игрока с итоговыми статами из лора (уже с перековкой, книгами, звёздами, камнями): reforge, звёзды, Hot/Fuming Potato Books, recomb, зачарования, камни, атрибуты, цена. section: worn — надетые броня и экипировка с суммой статов; weapons — всё оружие; wardrobe — гардероб по слотам, как в игре: номер слота, название набора, каждая часть с перековкой, звёздами, книгами, чарами и камнями, какой слот надет и какой сет для данжей; armor — все сеты брони (включая гардероб и хранилища); equipment — ожерелья/плащи/пояса/перчатки; tools — инструменты.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['section'], properties: { section: { type: 'string', enum: ['worn', 'wardrobe', 'weapons', 'armor', 'equipment', 'tools'] } } },
  },
  {
    name: 'compare_weapons',
    description: 'Сравнить всё оружие игрока по урону: статы каждого оружия из лора и оценка урона за удар (обычный и крит) вместе со статами надетой брони и экипировки. Вызывай на вопросы «что у меня сильнее», «чем бить».',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: [], properties: {} },
  },
  {
    name: 'find_items',
    description: 'Найти предметы игрока во всех хранилищах (инвентарь, эндер-сундук, рюкзаки, гардероб, хранилище, сумки) и мешках (sacks) по названию или ID, с подробностями. Можно писать с приставкой перековки и звёздами («Withered Giant\'s Sword», «Heroic AOTV»).',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', description: 'Название или ID; пустая строка — самые дорогие предметы' } } },
  },
  {
    name: 'get_pets',
    description: 'Все питомцы игрока: уровень, редкость, предмет в руках, скин, активный ли, цена.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: [], properties: {} },
  },
  {
    name: 'get_accessories',
    description: 'Аксессуары игрока: Magical Power, список с редкостью, перековкой, recomb и enrichment; сколько без recomb; самые дешёвые недостающие аксессуары по цене за 1 MP.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: [], properties: {} },
  },
  {
    name: 'set_goal',
    description: 'Поставить игроку цель, когда он сам её назвал («хочу M7», «хочу Infernal Kuudra», «хочу Terminator»). Переводи цель в 1–4 измеримых показателя, по которым сайт сам ведёт полоску прогресса, и путь от ТЕКУЩЕГО профиля в 2–5 коротких шагах. Новая цель заменяет старую. Показатели: sb, catacombs, mp, coins (key пустой); skill, slayer, class (key: combat, blaze, archer…); floor, master (key: номер этажа, target — число прохождений); kuudra (key: basic/hot/burning/fiery/infernal, target — заходы); hotm.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['title', 'targets', 'route'],
      properties: {
        title: { type: 'string', description: 'Коротко: «M7», «Infernal Kuudra», «Terminator»' },
        targets: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['kind', 'key', 'target'],
            properties: {
              kind: { type: 'string', enum: ['sb', 'catacombs', 'class', 'skill', 'slayer', 'floor', 'master', 'kuudra', 'mp', 'hotm', 'coins'] },
              key: { type: 'string' },
              target: { type: 'number' },
            },
          },
        },
        route: { type: 'array', items: { type: 'string' }, description: '2–5 шагов от текущего профиля' },
      },
    },
  },
];

const short = (s, n = 600) => { s = typeof s === 'string' ? s : JSON.stringify(s); return s.length > n ? s.slice(0, n) + '…' : s; };

/**
 * Обработчики инструментов. Всё, что нужно, передаёт ядро через deps.
 * @param {{
 *   getAnalysis: () => Object,
 *   getItemRu?: (id:string, opt?:Object) => Object|null,
 *   searchItems?: (q:string, opt?:Object) => Object[],
 *   priceInfo?: (id:string) => Object,
 *   priceOf?: (id:string) => number,
 *   pricesRaw?: Object,
 * }} deps
 */
export function makeToolHandlers(deps) {
  const member = () => deps.getMember?.() || null;
  const value = it => deps.itemValue ? deps.itemValue(it) : (deps.priceOf?.(it.id) || 0);
  const reforgeNames = () => [...new Set(allItems(member()).map(i => i.reforge).filter(Boolean))];
  // Предметы игрока, чьё название (без звёзд) совпадает с запросом, в том числе с приставкой перековки
  const ownedMatches = q => {
    const want = cleanName(q).clean.toLowerCase();
    const bare = stripReforge(q, reforgeNames()).toLowerCase();
    if (!want) return [];
    return allItems(member()).filter(it => {
      const n = cleanName(it.name).clean.toLowerCase();
      return n === want || it.id.toLowerCase() === want.replace(/\s+/g, '_') || n.includes(want) || stripReforge(it.name, it.reforge ? [it.reforge] : []).toLowerCase() === bare;
    });
  };
  const findId = q => {
    const raw = cleanName(q).clean;
    if (/^[A-Z0-9_:;]+$/.test(raw)) return raw;
    const own = ownedMatches(raw)[0];
    if (own) return own.id;
    for (const variant of [raw, stripReforge(raw, reforgeNames())]) {
      const hit = deps.searchItems?.(variant, { limit: 1 })?.[0];
      if (hit) return hit.id;
    }
    return raw.toUpperCase().replace(/\s+/g, '_');
  };
  return {
    set_goal(input) {
      if (!deps.setGoal) return { error: 'Цель можно поставить только для своего профиля: этот профиль открыт для просмотра.' };
      return deps.setGoal(input);
    },
    get_item({ query }) {
      const id = findId(query);
      const it = deps.getItemRu?.(id, { prices: deps.pricesRaw });
      const mine = ownedMatches(query).concat(ownedMatches(id)).filter((x, i, a) => a.findIndex(y => (y.uuid || y.where + y.id) === (x.uuid || x.where + x.id)) === i).slice(0, 3);
      if (!it) return mine.length ? { note: 'В базе предметов нет, но он есть у игрока', owned: mine.map(x => compactItem(x, { value })) } : { error: tx`Предмет «${query}» не найден в базе` };
      return {
        ...(mine.length ? { owned: mine.map(x => compactItem(x, { value })), ownedNote: 'Это экземпляр игрока: статы уже с перековкой, книгами, звёздами и камнями' } : {}),
        id: it.id, nameEn: it.nameEn, nameRu: it.nameRu, category: it.category,
        description: short(it.descriptionRu, 700),
        whereToGet: (it.whereToGet || []).slice(0, 6).map(w => w.textRu),
        price: deps.priceOf ? fmtCoins(deps.priceOf(it.id)) : undefined,
        wikiUrl: it.wikiUrl,
      };
    },
    get_price({ id }) {
      const key = findId(id);
      const p = deps.priceInfo?.(key);
      if (!p) return { id: key, error: 'Цен нет в данных' };
      const t = p.trend || {};
      return {
        id: key,
        bazaar: p.bazaar ? { instantBuy: p.bazaar.buy, instantSell: p.bazaar.sell, weekVolume: (p.bazaar.buyWeek || 0) + (p.bazaar.sellWeek || 0) } : null,
        auction: p.bin ? { lowestBin: p.bin.price, listings: p.bin.count } : null,
        soldMedian: p.sold?.median ?? null,
        // pct из priceTrend уже в процентах
        change24h: t.d1?.pct != null ? `${Math.round(t.d1.pct)}%` : null,
        change7d: t.d7?.pct != null ? `${Math.round(t.d7.pct)}%` : null,
        trend: t.label || null,
      };
    },
    get_steps({ filter }) {
      const all = (deps.getAnalysis()?.roadmap || []).filter(s => s.priority > 0 && !s.done);
      const f = String(filter || '').trim().toLowerCase();
      const list = f ? all.filter(s => s.id.toLowerCase() === f || s.cat.toLowerCase().includes(f) || s.title.toLowerCase().includes(f)) : all.slice(0, 10);
      return list.slice(0, 8).map(s => ({ id: s.id, cat: s.cat, priority: s.priority, title: s.title, why: s.why, how: s.how, cost: s.cost ? fmtCoins(s.cost) : undefined, items: s.items }));
    },
    get_gear({ section }) {
      const m = member();
      if (!m) return { error: 'Профиль не загружен' };
      const g = deps.getAnalysis()?.gear || {};
      const cut = list => (list || []).slice(0, 12).map(it => compactItem(it, { value }));
      if (section === 'worn') {
        return {
          armor: (m.inv?.armor || []).filter(Boolean).map(it => compactItem({ ...it, where: 'надето' }, { value })),
          equipment: (m.inv?.equipment || []).filter(Boolean).map(it => compactItem({ ...it, where: 'надето' }, { value })),
          totalFromGear: wornStats(m),
          note: 'totalFromGear — сумма статов надетой брони и экипировки (без скиллов, питомца, аксессуаров)',
        };
      }
      if (section === 'wardrobe') {
        const dl = dungeonLoadout(m);
        const slots = armorLoadouts(m).map(describeLoadout).map(lo => ({
          slot: lo.slot, label: lo.label, equipped: lo.equipped || undefined,
          wither: lo.wither ? tx`${lo.wither}/4 частей Wither${lo.mixed ? tx` вперемешку (${familiesLabel(lo.families)})` : ''}${lo.witherborn ? ', бонус Witherborn полный' : ''}` : undefined,
          pieces: lo.items.map((it, i) => (it ? { part: SLOT_RU[SLOTS[i]], ...compactItem({ ...it, where: lo.label }, { value }) } : { part: SLOT_RU[SLOTS[i]], empty: true })),
        }));
        if (!slots.length) return { note: 'Wardrobe пуст или закрыт в настройках API' };
        return {
          slots,
          dungeonSet: dl ? dl.label : null,
          note: 'Номера слотов как в игре. Necron/Storm/Maxor/Goldor/Wither делят один бонус Witherborn: смешанный сет из 4 частей Wither — полный сет.',
        };
      }
      if (section === 'weapons') return cut(g.weapons);
      if (section === 'tools') return cut(g.tools);
      if (section === 'equipment') return cut(g.equipment);
      if (section === 'armor') return (g.armorSets || []).slice(0, 8).map(set => ({ set: cleanName(set.pieces?.[0]?.name || set.id).clean.replace(/ (Helmet|Chestplate|Leggings|Boots)$/, ''), value: fmtCoins(set.value), pieces: set.pieces.map(it => compactItem(it, { value })) }));
      return { error: 'Неизвестный раздел' };
    },
    compare_weapons() {
      const m = member();
      if (!m) return { error: 'Профиль не загружен' };
      return compareWeapons(m, { value });
    },
    find_items({ query }) {
      const m = member();
      if (!m) return { error: 'Профиль не загружен' };
      const q = String(query || '').trim();
      const items = q ? ownedMatches(q) : allItems(m).sort((a, b) => value(b) - value(a));
      const sacks = Object.entries(m.inv?.sacks || {}).filter(([id, n]) => n > 0 && (!q || id.toLowerCase().includes(q.toLowerCase().replace(/\s+/g, '_'))))
        .map(([id, n]) => ({ id, name: deps.itemName?.(id) || id, count: n, value: fmtCoins((deps.priceOf?.(id) || 0) * n) }))
        .sort((a, b) => b.count - a.count).slice(0, 15);
      return { items: items.slice(0, 12).map(it => compactItem(it, { value })), found: items.length, sacks };
    },
    get_pets() {
      const m = member();
      if (!m) return { error: 'Профиль не загружен' };
      const top = deps.getAnalysis()?.gear?.topPets || [];
      const priceByKey = new Map(top.map(p => [`${p.type}:${p.tier}:${p.level}`, p.value]));
      return (m.pets || []).slice(0, 40).map(p => ({
        type: p.type, tier: p.tier, level: p.level, active: p.active || undefined, heldItem: p.heldItem || undefined, skin: p.skin || undefined,
        value: priceByKey.has(`${p.type}:${p.tier}:${p.level}`) ? fmtCoins(priceByKey.get(`${p.type}:${p.tier}:${p.level}`)) : undefined,
      }));
    },
    get_accessories() {
      const a = deps.getAnalysis()?.acc;
      if (!a) return { error: 'Анализ аксессуаров ещё не готов' };
      return {
        magicalPower: a.highestMp ?? a.calculatedMp, count: a.count,
        withoutRecomb: a.notRecombCount, recombPrice: fmtCoins(a.recombPrice), mpFromRecombAll: a.recombGain,
        owned: (a.list || []).slice(0, 60).map(x => [cleanName(x.name).clean, x.rarity, x.reforge, x.recomb ? 'recomb' : '', x.enrichment ? `enrich ${x.enrichment}` : '', x.active ? '' : 'не активен'].filter(Boolean).join(' · ')),
        cheapestNext: (a.cheapestNext || []).slice(0, 12).map(r => ({ name: r.name, rarity: r.rarity, mp: r.gain, price: fmtCoins(r.price), perMp: r.perMp ? fmtCoins(r.perMp) : null, upgradeFrom: r.upgradeFrom || undefined })),
      };
    },
    get_money_methods() {
      const ms = deps.getAnalysis()?.methods || [];
      return ms.slice().sort((a, b) => (b.coinsPerHour || 0) - (a.coinsPerHour || 0)).slice(0, 10)
        .map(x => ({ title: x.title, available: x.available, perHour: x.coinsPerHour ? fmtCoins(x.coinsPerHour) : null, needs: x.reqText, note: short(x.desc, 200) }));
    },
  };
}
