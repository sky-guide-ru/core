import { tx } from '../../i18n/msg.js';
// Как перки текущего мэра и министра меняют доход методов «Заработка».
// Перки приходят из /v2/resources/skyblock/election (server/calendar → activePerks), имена — как в API.
// Правило: perk — имя перка; ids/tags — к каким методам относится (по id метода или по тегу категории, чтобы методы
// других тредов тоже подхватывались); factor — во сколько раз меняется доход в час (1 — только подсказка);
// note — что это значит для игрока. Множители сознательно осторожные: перк влияет на часть дохода, а не на весь.

export const MAYOR_RULES = [
  // Aatrox — слееры
  { perk: 'Pathfinder', mayor: 'Aatrox', tags: ['Slayers'], factor: 1.1, note: 'редкие дропы с боссов выпадают на 20% чаще' },
  { perk: 'SLASHED Pricing', mayor: 'Aatrox', tags: ['Slayers'], factor: 1.05, note: 'квесты слееров вдвое дешевле' },
  // Paul — данжи
  { perk: 'Marauder', mayor: 'Paul', tags: ['Dungeons'], factor: 1.1, note: 'сундуки в данжах на 20% дешевле' },
  { perk: 'EZPZ', mayor: 'Paul', tags: ['Dungeons'], factor: 1, note: '+10 к оценке: S+ и лучшие сундуки проще' },
  // Cole — добыча
  { perk: 'Molten Forge', mayor: 'Cole', ids: ['forge'], factor: 1.25, note: 'Forge работает на 25% быстрее' },
  { perk: 'Mining Fiesta', mayor: 'Cole', tags: ['Mining', 'Майнинг'], factor: 1, note: 'весь срок мэра +25% Mining Fortune, а из руды и гемов падают Refined Mineral и Glossy Gemstone: хорошее время копать' },
  { perk: 'Prospection', mayor: 'Cole', tags: ['Миньоны'], factor: 1, note: 'миньоны добычи на 25% быстрее' },
  // Finnegan — Farming
  { perk: 'Pest Eradicator', mayor: 'Finnegan', ids: ['farming'], factor: 1.05, note: 'бонусы за Pests в Garden' },
  { perk: 'Farming Simulator', mayor: 'Finnegan', ids: ['farming'], factor: 1, note: 'счётчики культур на мотыгах засчитывают сбор дважды (урожай не растёт, быстрее качаются инструменты)' },
  { perk: 'Blooming Business', mayor: 'Finnegan', ids: ['visitors'], factor: 1.2, note: 'Visitors Garden приходят чаще, редких больше' },
  { perk: 'GOATed', mayor: 'Finnegan', ids: ['farming'], factor: 1, note: 'медали Jacob\'s Contest получить проще' },
  // Marina — рыбалка
  { perk: 'Double Trouble', mayor: 'Marina', tags: ['Fishing'], factor: 1.1, note: 'чаще Double Hook: два существа за заброс' },
  { perk: 'Luck of the Sea 2.0', mayor: 'Marina', tags: ['Fishing'], factor: 1.1, note: '+15 Sea Creature Chance' },
  { perk: 'Fishing Festival', mayor: 'Marina', tags: ['Fishing'], factor: 1, note: 'первые 3 дня каждого месяца ловятся акулы (Shark Fin, зубы)' },
  // Diaz — экономика
  { perk: 'Stock Exchange', mayor: 'Diaz', ids: ['stonks'], factor: 1, note: 'идёт аукцион Stonks: можно выиграть Stock of Stonks' },
  { perk: 'Volume Trading', mayor: 'Diaz', tags: ['Торговля'], factor: 1, note: 'лимиты Bazaar выше: можно ставить больше ордеров' },
  { perk: 'Long Term Investment', mayor: 'Diaz', ids: ['bank-interest'], factor: 1, note: 'проценты в банке выше' },
  // Derpy — особый мэр
  { perk: 'TURBO MINIONS!!!', mayor: 'Derpy', tags: ['Миньоны'], factor: 2, note: 'миньоны работают вдвое быстрее — топливо окупается вдвое лучше' },
  { perk: 'QUAD TAXES!!!', mayor: 'Derpy', tags: ['Торговля'], factor: 0.75, note: 'налоги на Bazaar и аукционе выше — флипы хуже' },
  { perk: 'DOUBLE MOBS HP!!!', mayor: 'Derpy', tags: ['Slayers', 'Dungeons', 'Crimson Isle'], factor: 0.7, note: 'у мобов вдвое больше здоровья — убийства медленнее' },
  // Scorpius и Foxy
  { perk: 'Darker Auctions', mayor: 'Scorpius', ids: ['dark-auction'], factor: 1, note: 'на Dark Auction больше лотов' },
  { perk: 'Sweet Benevolence', mayor: 'Foxy', tags: ['Ивенты'], factor: 1.1, note: 'больше конфет, подарков и Chocolate с ивентов' },
];

/**
 * Влияние перков на метод.
 * @param {{ id: string, tag?: string, mayorInCompute?: string[] }} def метод
 * @param {string[]} perks активные перки (мэр + министр)
 * @returns {{ factor: number, notes: { mayor: string, perk: string, note: string, factor: number }[] } | null}
 */
export function mayorBoost(def, perks) {
  if (!perks?.length) return null;
  const set = new Set(perks);
  const hits = MAYOR_RULES.filter(r => set.has(r.perk) && ((r.ids || []).includes(def.id) || (r.tags || []).includes(def.tag)));
  if (!hits.length) return null;
  // перки, которые метод уже учёл в своём расчёте (def.mayorInCompute), второй раз не умножаем
  const own = new Set(def.mayorInCompute || []);
  const f = r => (own.has(r.perk) ? 1 : r.factor);
  const factor = Math.round(hits.reduce((acc, r) => acc * f(r), 1) * 100) / 100;
  return { factor, notes: hits.map(r => ({ mayor: r.mayor, perk: r.perk, note: r.note, factor: f(r) })) };
}

/** Короткая строка для карточки: «Сейчас действует перк Aatrox: редкие дропы … (доход +10%)». Перк может быть и у министра. */
export function mayorNoteText(boost) {
  if (!boost) return null;
  const pct = Math.round((boost.factor - 1) * 100);
  const by = [...new Set(boost.notes.map(n => n.mayor))].join(' и ');
  const what = boost.notes.map(n => n.note).join('; ');
  return tx`Сейчас действует перк ${by}: ${what}${pct ? tx` (доход ${pct > 0 ? '+' : ''}${pct}%)` : ''}.`;
}
