// Мэры SkyBlock по-русски: кто за что отвечает, перки и что это значит для игрока.
// Названия перков — как их отдаёт Hypixel (/v2/resources/skyblock/election), ключ — имя перка.
// Если перка нет в словаре (новый или переименованный), показываем английское описание из API без цветовых кодов.

export const MAYORS = {
  aatrox: { name: 'Aatrox', role: 'слееры', color: '#e05a5a', icon: 'AATROX_BATPHONE',
    tip: 'Время слееров: квесты дешевле и опыта больше. Качай боссов, которые отстают, и копи RNG-метр.' },
  cole: { name: 'Cole', role: 'добыча', color: '#c9a36b', icon: 'MITHRIL_ORE',
    tip: 'Время копать: больше опыта добычи, быстрее Forge, фиесты добычи. Хорошо для HotM и Powder.' },
  diana: { name: 'Diana', role: 'питомцы и мифологический ивент', color: '#57c27a', icon: 'GRIFFIN_FEATHER',
    tip: 'Мифологический ритуал: копай норы грифонов в Hub (гайд «Diana»). Плюс больше опыта питомцам — время их качать.' },
  diaz: { name: 'Diaz', role: 'экономика', color: '#e6c24a', icon: 'GOLD_INGOT',
    tip: 'Экономический мэр: смотри на перки ниже, обычно это деньги, Bank и лимиты торговцев.' },
  finnegan: { name: 'Finnegan', role: 'Farming', color: '#8bc34a', icon: 'WHEAT',
    tip: 'Время фермы: конкурсы Jacob проще, Trevor даёт больше шкур. Фарми в Garden и бери медали.' },
  foxy: { name: 'Foxy', role: 'ивенты', color: '#ff9f43', icon: 'GREEN_CANDY',
    tip: 'Ивентный мэр: больше наград с ивентов и, часто, лишний ивент в году. Следи за календарём ниже.' },
  marina: { name: 'Marina', role: 'рыбалка', color: '#4aa8e0', icon: 'FISHING_ROD',
    tip: 'Время рыбалки: больше опыта и Sea Creatures, рыболовный фестиваль с акулами в первые 3 дня каждого месяца.' },
  paul: { name: 'Paul', role: 'данжи', color: '#b07cff', icon: 'DUNGEON_CHEST_KEY',
    tip: 'Время данжей: +10 к оценке (легче S+), сундуки дешевле. Лучший момент для Master Mode и дорогих сундуков.' },
  derpy: { name: 'Derpy', role: 'особый мэр', color: '#ff6bcb', icon: 'SPONGE', special: true,
    tip: 'Особый мэр: налоги выше, у мобов вдвое больше HP, зато миньоны быстрее и опыта скиллов больше.' },
  jerry: { name: 'Jerry', role: 'особый мэр', color: '#7fd6ff', icon: 'JERRY_STAFF', special: true,
    tip: 'Особый мэр: каждые несколько часов включает перки другого мэра. Смотри, кто сейчас активен.' },
  scorpius: { name: 'Scorpius', role: 'особый мэр', color: '#9b59b6', icon: 'DARK_ORB', special: true,
    tip: 'Особый мэр: Тёмный аукцион богаче, а голосовавшие за него получают монеты.' },
};

/** Перки: имя (как в API) → [название по-русски, что делает]. */
export const PERK_RU = {
  // Aatrox
  'SLASHED Pricing': ['Скидка на слееров', 'Квесты слееров стоят вдвое дешевле.'],
  'Slayer XP Buff': ['Больше опыта слееров', '+25% опыта слееров.'],
  'Pathfinder': ['Следопыт', 'Шанс редкого дропа с боссов слееров выше на 20%.'],
  // Cole
  'Mining XP Buff': ['Больше опыта добычи', '+60 ☯ Mining Wisdom на общих островах.'],
  'Mining Fiesta': ['Фиеста добычи', 'Несколько фиест за срок мэра: двойной дроп при добыче.'],
  'Molten Forge': ['Быстрая кузня', 'Forge работает на 25% быстрее.'],
  'Prospection': ['Разведка', 'Миньоны добычи работают на 25% быстрее.'],
  // Diana
  'Lucky!': ['Удача', '+25 ♣ Pet Luck.'],
  'Mythological Ritual': ['Мифологический ритуал', 'Ивент Diana: с Ancestral Spade ищешь норы грифонов в Hub, из нор лезут мифические мобы с ценным дропом.'],
  'Pet XP Buff': ['Больше опыта питомцам', '+35% опыта питомцам.'],
  'Sharing is Caring': ['Делиться — хорошо', 'Ещё 2 слота Exp Share у питомцев и +10% к доле опыта.'],
  "Huntress' Intuition": ['Чутьё охотницы', 'Бонус к охоте и поиску зверей для Hunting.'],
  // Diaz
  'Shopping Spree': ['Шопинг', 'Дневные лимиты покупок у NPC ×10.'],
  'Stock Exchange': ['Биржа', 'Участвуй в аукционе Stonks ради Stock of Stonks: его меняют на дорогие предметы в Trade Center.'],
  'Volume Trading': ['Оптовая торговля', 'Больше лимиты торговли на Bazaar.'],
  'Long Term Investment': ['Долгосрочные вложения', 'Бонус к процентам банка.'],
  // Finnegan
  'GOATed': ['Лёгкие медали', 'Пороги медалей в конкурсах Jacob шире: золото и платину получить проще.'],
  'Pelt-pocalypse': ['Шкуры', 'Trevor даёт больше Pelts за пойманных животных.'],
  'Farming Simulator': ['Симулятор фермы', 'Шанс, что счётчики культур на мотыгах и Cultivating засчитают сбор дважды.'],
  'Pest Eradicator': ['Истребитель Pests', 'Бонусы за убийство Pests в Garden.'],
  'Blooming Business': ['Цветущий бизнес', 'Посетители Garden приходят чаще и среди них больше редких.'],
  // Foxy
  'Chivalrous Carnival': ['Карнавал', 'В Hub открыт карнавал с мини-играми и своими наградами.'],
  'Sweet Benevolence': ['Сладкая щедрость', 'Больше конфет, подарков и Chocolate с ивентов.'],
  'A Time for Giving': ['Время подарков', 'Больше подарков на праздниках и в сезон Jerry.'],
  'Extra Event': ['Лишний ивент', 'В году будет дополнительный ивент (фиеста добычи, рыболовный или хэллоуинский фестиваль).'],
  // Marina
  'Fishing XP Buff': ['Больше опыта рыбалки', '+50 ☯ Fishing Wisdom.'],
  'Luck of the Sea 2.0': ['Морская удача', '+15 α Sea Creature Chance.'],
  'Fishing Festival': ['Рыболовный фестиваль', 'Первые 3 дня каждого месяца в любой воде ловятся акулы.'],
  'Double Trouble': ['Двойная поклёвка', 'Выше шанс Double Hook: два Sea Creatures за раз.'],
  // Paul
  'EZPZ': ['Легкотня', '+10 очков к оценке в данжах: S+ проще.'],
  'Benediction': ['Благословение', 'Благословения в данжах сильнее на 25%.'],
  'Marauder': ['Мародёр', 'Сундуки с наградами в данжах дешевле на 20%.'],
  // Derpy
  'QUAD TAXES!!!': ['Четверные налоги', 'Налоги на аукционе и Bazaar выше.'],
  'TURBO MINIONS!!!': ['Турбо-миньоны', 'Миньоны работают вдвое быстрее.'],
  'DOUBLE MOBS HP!!!': ['Двойное здоровье мобов', 'У всех мобов вдвое больше здоровья.'],
  'MOAR SKILLZ!!!': ['Больше скиллов', '+50% опыта скиллов.'],
  // Jerry
  'Perkpocalypse': ['Перкопокалипсис', 'Каждые несколько часов включаются перки другого мэра.'],
  'Statspocalypse': ['Статопокалипсис', '+10% к большинству характеристик.'],
  'Jerrypocalypse': ['Джерипокалипсис', 'Jerry прячутся по миру, за их поиск дают награды.'],
  // Scorpius
  'Bribe': ['Взятка', 'Голосовавшие за Scorpius получают монеты.'],
  'Darker Auctions': ['Тёмные торги', 'На Dark Auction больше лотов и редкие предметы.'],
};
/** Совместимость: имя перка → описание по-русски. */
export const PERKS = Object.fromEntries(Object.entries(PERK_RU).map(([k, v]) => [k, v[1]]));
export const perkTitle = n => PERK_RU[n]?.[0] || null;

/** Убирает цветовые коды Minecraft (§a, §l…). */
export const stripCodes = s => String(s || '').replace(/§./g, '').replace(/\s+/g, ' ').trim();

/** Мэр из ответа API → вид для сайта. */
export function mayorView(raw) {
  if (!raw?.name) return null;
  const key = String(raw.key || '').toLowerCase();
  const byName = Object.values(MAYORS).find(x => x.name.toLowerCase() === String(raw.name).toLowerCase());
  const info = MAYORS[key] && MAYORS[key].name.toLowerCase() === String(raw.name).toLowerCase() ? MAYORS[key] : byName || null;
  const perk = p => ({ name: p.name, title: perkTitle(p.name), ru: PERKS[p.name] || null, en: stripCodes(p.description), minister: !!p.minister });
  return {
    key: info ? Object.keys(MAYORS).find(k => MAYORS[k] === info) : key || raw.name.toLowerCase(),
    name: raw.name,
    role: info?.role || null,
    tip: info?.tip || null,
    color: info?.color || '#9aa4b2',
    icon: info?.icon || null,
    special: !!info?.special,
    perks: (raw.perks || []).map(perk),
  };
}

export const perkNames = v => (v?.perks || []).map(p => p.name);
