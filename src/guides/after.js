// Что показывать, когда гайд пройден или почти пройден. Гайд не становится пустым:
// личный блок «Что делать» сворачивается в итог, справка (таблицы, механики, подсказки) остаётся,
// а вместо шагов появляется «Что дальше»: эндгейм-цели этого направления и связанные гайды.
//
// AFTER[id] = { goals: [строки], related: [id гайдов] }. Связанные гайды клиент показывает, только если они ещё не пройдены.

const SLAYERS = ['slayer-zombie', 'slayer-spider', 'slayer-wolf', 'slayer-enderman', 'slayer-blaze', 'slayer-vampire'];
const slayerGoals = [
  'Фарми высший тир ради денег: редкие дропы из таблицы «Редкие дропы» и цель RNG-метра у Maddox.',
  'Опыт сверх максимального уровня ничего не открывает, поэтому дальше выбирай тир по выгоде, а не по опыту.',
];

export const AFTER = {
  dungeons: {
    goals: [
      'Фарми M7 ради дорогого дропа: Necron\'s Handle, Dark Claymore, Master Skull - Tier 5.',
      'Поставь Master Stars (звёзды 6–10) на броню и оружие: First–Fifth Master Star падают на M3–M7.',
      'Подтяни остальные классы до 50: средний уровень классов даёт SkyBlock XP.',
    ],
    related: ['kuudra', 'slayer-enderman', 'slayer-blaze'],
  },
  dragons: {
    goals: [
      'Superior Dragon Armor и Legendary Ender Dragon — главные цели боёв с драконами.',
      'Enderman Slayer: Voidgloom Seraph тоже роняет Summoning Eye, а Juju Shortbow и Terminator лучше всего бьют драконов.',
    ],
    related: ['slayer-enderman', 'dungeons'],
  },
  kuudra: {
    goals: [
      'Фарми Infernal ради денег: Kuudra Teeth, Wheel of Fate, Enrager, Burning Kuudra Core.',
      'Звёзды 11–15 на Infernal-броне за Kuudra Teeth.',
      'Сравнивай цену Kuudra Key с ценой лута: иногда выгоднее открыть только бесплатный сундук.',
    ],
    related: ['crimson', 'slayer-blaze', 'dungeons'],
  },
  bestiary: {
    goals: [
      'Добивай до максимума семейства, которых фармишь: +3 Magic Find за уровень повышает шанс редкого дропа.',
      'Закрой события: Spooky Festival, Diana и Jerry дают много дешёвых уровней раз в год.',
      'Каждая 5-я веха даёт Combat XP, после 100-й — по 1 000 000.',
    ],
    related: ['slayer-zombie', 'dungeons', 'fishing'],
  },
  crimson: {
    goals: [
      'Ранг S во всех семи испытаниях Dojo — чёрный пояс.',
      'Каждый день 5 квестов фракции и 3 Heavy Pearl у Matriarch: жемчуг уйдёт на звёзды брони Kuudra.',
      'Охоться на Vanquisher: Nether Star меняется у Emissary на Kuudra Key.',
    ],
    related: ['kuudra', 'trophy', 'slayer-blaze'],
  },
  fishing: {
    goals: [
      'Добей Bestiary Sea Creatures: уровни дают Magic Find против них и приближают вехи.',
      'Фарми Lord Jawbus и Thunder ради Magma Lord Fragment и Radioactive Vial.',
      'Master Trophy Fisher: алмазный тир у всех 18 видов Trophy Fish.',
    ],
    related: ['trophy', 'rift'],
  },
  trophy: {
    goals: [
      'Лишнюю Trophy Fish разделывай у Odger на Magmafish: это коллекция и деньги.',
      'Добивай Trophy Fishing ради бестиария и Odger\'s Diamond Tooth.',
    ],
    related: ['fishing'],
  },
  forge: {
    goals: [
      'Собери лучшие детали бура: Amber-Polished Drill Engine и Perfectly-Cut Fuel Tank.',
      'Держи все слоты занятыми на ночь: длинные рецепты вроде Drill Motor или Mithril Plate.',
      'Divan\'s Drill и броня Divan тоже куются здесь — из материалов Crystal Hollows.',
    ],
    related: ['mining'],
  },
  mining: {
    goals: [
      'Гемы ради денег: Divan\'s Drill, броня Divan, Perfect-гемы в слоты, продажа Flawless на Bazaar.',
      'Держи все слоты The Forge занятыми: что выгодно ковать — в гайде The Forge.',
      'Mineshafts и Frozen Corpse ради материалов и Glacite Powder.',
    ],
    related: ['foraging', 'minions'],
  },
  farming: {
    goals: [
      'Jacob\'s Contest на золото и выше: медали и уникальные награды.',
      'Вехи культур (milestones) в Garden и фарм самой выгодной культуры ради денег.',
      'Visitors Garden каждый день: Copper и редкие дропы.',
    ],
    related: ['minions', 'foraging'],
  },
  foraging: {
    goals: [
      'Starlyn Contests у Agatha на высокие места: Agatha\'s Prize и Shiniest.',
      'Атрибуты Hunting для Foraging (Crow, Heron, Vulture, коллекционеры) до 10 уровня.',
      'Снаряжение Foraging 30: Honeycomb Necklace и Veilshroom Bracelet.',
      'Коллекции Fig Log, Mangrove Log и Helix Log до максимума, дальше — Jade Dragon.',
    ],
    related: ['farming', 'mining'],
  },
  minions: {
    goals: [
      'Подними всех миньонов до XII уровня: каждый уровень — ещё один уникальный крафт и больше дохода.',
      'Поставь всем Super Compactor 3000 и вечное топливо, выбери самых доходных миньонов.',
    ],
    related: ['farming', 'mining'],
  },
  rift: {
    goals: [
      'Vampire Slayer до 5 уровня: Rift Time и Vampire Dentist Relic.',
      'Montezuma: все 9 частей.',
      'Лишние Motes — на поздние покупки вроде Shen\'s Ringalia.',
    ],
    related: ['slayer-vampire', 'museum'],
  },
  essence: {
    goals: [
      'Все перки куплены: лишнюю эссенцию можно продать на Bazaar или пустить на звёзды новых предметов.',
      'Мастер-звёзды (➊–➎) на данжевом оружии — следующий шаг после 5 обычных звёзд.',
    ],
    related: ['dungeons', 'kuudra'],
  },
  museum: {
    goals: [
      'Особые предметы (Special Items) и сеты брони дают дополнительные очки музея.',
      'Пожертвованные предметы застрахованы: проверь, что дорогие вещи сданы.',
    ],
    related: ['dungeons', 'rift'],
  },
  collectibles: {
    goals: [
      'Следи за обновлениями: новые острова приносят новые Fairy Souls и контакты Abiphone.',
      'Through the Campfire на Personal Harp — песня только для коллекции, без Intelligence.',
    ],
    related: ['rift', 'museum'],
  },
  diana: {
    goals: [
      'Mythic Griffin: King Minos (Crown of Greed, Shimmering Wool) и Manticore.',
      'Deific Spade и Daedalus Notes: самые длинные цепочки нор.',
      'Полный сет Mythos (8 частей) для бонуса Unearthed.',
    ],
    related: ['fishing', 'museum'],
  },
  hunting: {
    goals: [
      'Все атрибуты на X: дальше только Hunter Fortune-линия (Megalith) и Echo-атрибуты усиливают остальное.',
      'Лишние осколки продавай на Bazaar или пускай в фьюжн на редкие: Galaxy Fish, Molthorn, Starborn.',
      'Добей 30 вех David Hunterborough: статы и David\'s Cloak сильнее.',
    ],
    related: ['foraging', 'fishing', 'kuudra'],
  },
  enchanting: {
    goals: [
      'Experiments каждый день ради Titanic Experience Bottle и книг: стол остаётся одним из лучших ежедневных доходов.',
      'Ultra-Rare книги в RNG Meter стола: каждые 1 000 XP из Superpairs — очко.',
      'Mythic Guardian: +7% к шансу Ultra-Rare книг.',
    ],
    related: ['essence', 'museum'],
  },
  alchemy: {
    goals: [
      'God Potion без перерыва: с Alchemy 50 одна бутылка — 24 часа игры, Parrot добавляет ещё до 20%.',
      'Mixins к God Potion: Spider Egg (+15 Crit Damage) и Zombie Brain (+10 Ferocity) открываются на Slayer 8.',
      'Harvest Harbinger и Mushed Glowy Tonic под Farming и Fishing: их нет в God Potion.',
    ],
    related: ['enchanting', 'dungeons'],
  },
  taming: {
    goals: [
      'Pet Score: каждый новый вид питомца и каждый питомец 100 уровня дают очки и Magic Find.',
      'Exp Share с предметом Exp Share: запасные питомцы качаются сами, пока ты играешь основным.',
      'Golden, Jade и Rose Dragon растут до 200 уровня: на это уходит больше 200 млн опыта.',
    ],
    related: ['diana', 'dungeons'],
  },
  chocolate: {
    goals: [
      'Все кролики: яйца Hoppity каждую весну, резиденты на островах и бродячие кролики в окне фабрики.',
      'Вехи магазина до Omega (800 млрд): золотые кролики вдвое чаще.',
      'Rabbit Shrine до 20 перед весной: больше редких кроликов из яиц.',
    ],
    related: ['collectibles', 'diana'],
  },
};
for (const id of SLAYERS) AFTER[id] = { goals: slayerGoals, related: [...SLAYERS.filter(x => x !== id), 'dungeons'] };

const DEFAULT = { goals: ['Справка ниже осталась: механики, предметы и подсказки по-прежнему открываются.'], related: [] };

/** Доля пройденного по полоске уровня гайда (0..1) или null. */
export function guideProgress(g) {
  const lv = g?.level;
  if (!lv || !(lv.max > 0)) return null;
  return Math.max(0, Math.min(1, Number(lv.value) / lv.max));
}

/**
 * Дописывает к гайду: almost (почти пройден) и complete (что дальше) для пройденного.
 * Гайд может сам выставить almost / complete — тогда они не перетираются.
 */
export function finalizeGuide(g) {
  if (!g || g.status === 'error') return g;
  const p = guideProgress(g);
  if (g.almost == null) g.almost = g.status === 'progress' && p != null && p >= 0.85 && p < 1;
  if (g.status === 'done' && !g.complete) {
    const a = AFTER[g.id] || DEFAULT;
    g.complete = { goals: a.goals, related: a.related || [], optional: (g.next || []).length };
  }
  return g;
}
