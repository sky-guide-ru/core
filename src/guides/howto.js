import { tx } from '../../i18n/msg.js';
// «Как это делать — пошагово»: короткая инструкция в начале каждого гайда.
// Там, где гайд перечисляет факты (тиры, броня, перки), здесь — что именно делать руками, по порядку.
// Названия предметов, NPC и мест — по-английски, как в игре: на сайте они становятся ссылками с подсказками.

const step = (title, text, items) => ({ title, text, ...(items ? { items } : {}) });

const SLAYER = [
  step('Возьми квест', 'Поговори с Maddox the Slayer в Hub (или позвони по Maddox Batphone), выбери босса и тир, оплати квест.'),
  step('Убивай мобов в зоне босса', 'Над хотбаром появится шкала: она заполняется за убийства мобов этого вида. Нужная зона указана в разделе «Где и как».'),
  step('Убей босса', 'Когда шкала заполнится, босс появится рядом с тобой. Механики тира — в таблице «Тиры босса». Если не успел или умер, квест сгорает.'),
  step('Забери опыт и дроп, бери следующий квест', 'Опыт слеера начисляется сразу. Новый квест — снова у Maddox или по Batphone.'),
  step('Поставь цель RNG-метра', 'В меню Maddox выбери редкий дроп в RNG Meter: каждый босс копит очки, и при полной шкале предмет выпадет гарантированно.'),
];

export const HOWTO = {
  dungeons: [
    step('Собери группу', 'Телепорт /warp dungeon_hub, затем Party Finder: выбери этаж, свой класс и минимальный Catacombs. В группе 5 человек, лучше разные классы.'),
    step('Подготовься', 'Возьми снаряжение из чек-листа ниже (маски «второй жизни», Aspect of the Void, Spirit-питомца) и зелья. Класс выбирается в меню данжа до старта.'),
    step('Пройди комнаты', 'Убивай мобов, ищи секреты, решай головоломки. Ключи Wither Key и Blood Key падают с мобов: ими открываются двери и Blood Room.'),
    step('Blood Room и босс', 'В Blood Room The Watcher выпускает мобов: убей их всех, и откроется проход к боссу этажа.'),
    step('Открой сундуки', 'После победы бесплатный только Wood Chest, остальные стоят монеты. Kismet Feather перекручивает содержимое сундука, Dungeon Chest Key открывает ещё один.', ['KISMET_FEATHER', 'DUNGEON_CHEST_KEY']),
    step('Цель — оценка S+', 'S+ даёт больше опыта Catacombs и лучший лут: без смертей, с секретами и быстро.'),
  ],
  kuudra: [
    step('Открой Kuudra', 'Первый заход (Basic) — по квесту у Elle в Dragontail на Crimson Isle (/warp kuudra ведёт прямо к ней).'),
    step('Собери группу', 'Kuudra Gatekeeper или Party Finder на Crimson Isle: 4 игрока, выбери тир, который тебе открыт.'),
    step('Принеси припасы и построй баллисту', 'Сначала команда собирает Supplies по арене и несёт их к баллисте, потом все стоят в зоне постройки, пока баллиста не достроится.'),
    step('Бей Kuudra', 'Стреляй из баллисты и бей Kuudra, когда он выныривает. На Infernal есть ещё финальная фаза.'),
    step('Открой сундук', 'Бесплатный сундук даётся всегда, платный — за Kuudra Key своего тира. Сравни цену ключа с ценой лута в таблице ниже.', ['KUUDRA_TIER_KEY']),
    step('Качай репутацию', 'Каждый день бери 5 квестов фракции на доске в её городе: репутация открывает следующие тиры.'),
  ],
  crimson: [
    step('Доберись до острова', 'Нужен Combat 24. На Crimson Isle ведёт лаунчпад в глубине Spider\'s Den, дальше /warp nether.'),
    step('Выбери фракцию', 'Elle даст стартовые задания, потом предложит поговорить с жителями обоих городов и выбрать: Barbarians (Dragontail) или Mages (Scarleton).'),
    step('Бери квесты фракции каждый день', 'Доска в Community Center своего города: до 5 квестов в день. Награда — репутация, она открывает тиры Kuudra.'),
    step('Пройди Dojo', 'Dojo — семь испытаний. Зайди с пустым инвентарём и без питомца, пройди каждое хотя бы раз, потом подтягивай слабые до ранга S ради пояса.'),
    step('Обойди мини-боссов и Matriarch', 'Мини-боссы дают квестовые убийства и шанс на Kuudra Key. Matriarch в вулкане выдаёт 3 Heavy Pearl в сутки — нужны на звёзды брони Kuudra.', ['HEAVY_PEARL']),
  ],
  fishing: [
    step('Собери удочку', 'Лучшая открытая тебе удочка — в таблице «Удочки». Детали (леска, крючок, грузило) ставит Roddy в Backwater Bayou (/warp bayou): ПКМ по нему, положи удочку и деталь.', ['TITAN_LINE', 'HOTSPOT_HOOK']),
    step('Выбери место', 'До Fishing 27 — вода: Backwater Bayou, Moonglade Marsh на Galatea и Хотспоты. С 27 — лава Crimson Isle (/warp nether). Лавовые Хотспоты (пятна с частицами) дают свои бонусы и существ.'),
    step('Наживка и питомец', 'Положи наживку в Fishing Bag, надень питомца рыбалки (Flying Fish, Ammonite) и броню с Sea Creature Chance.'),
    step('Лови и убивай существ', 'Sea Creature надо убить — опыт и дроп даются за убийство. Thunder и Lord Jawbus сильные: зови друзей или бери хорошее оружие.'),
    step('Сдавай трофеи Odger', 'Trophy Fish неси Odger на вершине Blazing Volcano: он засчитает виды, выдаст награды Trophy Fisher и разделает лишнее на Magmafish.'),
    step('Продавай дроп', 'Thunder Fragment, Magma Lord Fragment и Radioactive Vial — на Bazaar или аукционе (цены в таблице «Заработок»).', ['THUNDER_SHARDS', 'MAGMA_LORD_FRAGMENT', 'RADIOACTIVE_VIAL']),
  ],
  trophy: [
    step('Возьми лавовую удочку и отправляйся на Crimson Isle', 'Телепорт /warp nether. Трофеи клюют только в лаве Crimson Isle. Charm на удочке поднимает шанс серебра, золота и алмаза.', ['INFERNO_ROD', 'HELLFIRE_ROD']),
    step('Подними Trophy Fish Chance', 'Hunter Armor и зуб Odger (бесплатно за ранги Odger), Hot Bait в Fishing Bag, Trophy Line у Roddy, питомец Kuudra. Стат умножает шанс каждого вида.', ['HOT_BAIT', 'TROPHY_LINE']),
    step('Выполни условие вида', 'Встань в нужную зону или выполни приём (гейзер, высота 8 блоков, 20 секунд ожидания, наживка Obfuscated). Условия всех 18 видов — в таблице ниже.'),
    step('Сдавай Odger', 'Odger на вершине Blazing Volcano засчитывает виды и тиры, выдаёт награды рангов и разделывает рыбу на Magmafish.'),
    step('Иди по плану', 'План ниже: сначала новые виды, потом серебро (Adept), золото (Expert) и алмаз (Master), внутри — от самых быстрых.'),
  ],
  mining: [
    step('Задания в Dwarven Mines', 'Телепорт /warp mines. Бери задания (Commissions) у Emissary или через Royal Pigeon: они дают опыт Heart of the Mountain и Mithril Powder.'),
    step('Вкладывай токены и Powder', 'Открой /hotm: токены тратятся на новые перки, Powder — на уровни перков. Список важных перков — в таблице ниже.'),
    { ...step('Держи Forge занятой', 'The Forge (/warp forge) работает в реальном времени: положи рецепт и забери через несколько часов. Что выгодно ковать и как собрать детали бура — в гайде The Forge.'), link: { guide: 'forge', label: 'Гайд The Forge' } },
    step('Crystal Hollows', 'Купи пропуск у Gwendolyn в Dwarven Mines, спустись в Crystal Hollows, собери 5 кристаллов и поставь их в Crystal Nucleus.'),
    step('Glacite Tunnels и Mineshafts', 'Из Dwarven Base Camp (/warp basecamp) иди в Glacite Tunnels: Umber, Tungsten, гемы. Если откроется Mineshaft — залутай Frozen Corpse, а награды за вехи забирай у Grandpa Wolf (/corpsemilestones).'),
  ],
  forge: [
    step('Открой Forge', 'Телепорт /warp forge. Forge открывается с HotM 1, новые слоты дают уровни HotM.'),
    step('Забери готовое', 'Готовый предмет лежит в слоте, пока его не заберут: слот всё это время простаивает.'),
    step('Положи выгодный рецепт', 'Что ковать под твой HotM и ритм заходов — в блоке «Выгодно ковать». Материалы покупай на Bazaar или бери из Sacks.'),
    step('Собирай детали бура', 'Двигатель, топливный бак и модуль ставит и снимает Jotraeline Greatforge в той же кузнице. Цепочки рецептов — в блоке «Улучшить бур».', ['MITHRIL_DRILL_ENGINE', 'MITHRIL_FUEL_TANK']),
    step('Ускорь ковку', 'Перк Quick Forge в /hotm сокращает время ковки до 30%.'),
  ],
  farming: [
    step('Каждый день — Visitors Garden', 'Телепорт /warp garden. Выполняй заказы Visitors у Desk: это Copper и опыт Garden. Отказывайся, если заказ дороже награды.'),
    step('Фарми выгодную культуру', 'Какая культура сейчас выгоднее — на странице «Заработок». Во время Jacob\'s Contest фарми одну из трёх культур конкурса.'),
    step('Copper — в Crop Upgrades', 'Desk → Crop Upgrades: +5 Farming Fortune культуре за уровень. Сначала дешёвые уровни.'),
    step('Убирай Pests', 'Pests появляются на участках при фарме и режут рост. Засасывай их пылесосом (SkyMart Vacuum), дроп продаётся.', ['SKYMART_VACUUM']),
    step('Медали — к Anita', 'Медали Jacob\'s Contest меняй у Anita на постоянный Farming Fortune.'),
  ],
  foraging: [
    step('Отправляйся на Galatea', 'Телепорт /warp galatea. Начни с заданий Hina в Moonglade Marsh: они открывают зоны и дают опыт Heart of the Forest.'),
    step('Руби деревья целиком', 'Fig и Mangrove: за полностью срубленное дерево падает Tree Gift с лутом и Whispers. Helix (Torrhus Canyon) даёт Desert Whispers.'),
    step('Перки Heart of the Forest', 'Открой меню Heart of the Forest: токены — на новые перки, Whispers — на уровни (Sweep, Foraging Fortune).'),
    step('Улучшай топор и броню', 'Fig Hew и броня Canopy с Foraging 12, дальше Figstone (15) и Helix (20–25). На топор — перековка Moonglade и Wood Singularity.', ['FIG_AXE', 'CANOPY_CHESTPLATE', 'MOONGLADE_JEWEL']),
    step('Sloth и купоны', 'Sloth у Miria (Torrhus Canyon), Frog и осколки Crow/Heron у Agatha — за купоны Starlyn Contests.', ['SLOTH;4']),
    step('Конкурсы Starlyn', 'Соревнования по рубке у Agatha: чем больше очков, тем больше купонов. Бонус к очкам — Sloth и Torrhus Belt.'),
  ],
  minions: [
    step('Выбери дешёвые крафты', 'Таблица «Самые дешёвые следующие крафты» ниже: начинай сверху.'),
    step('Купи материалы', 'На Bazaar через Buy Order дешевле, чем мгновенная покупка, но нужно подождать.'),
    step('Скрафти миньона', 'Меню крафта SkyBlock. Крафт засчитывается сразу: миньона можно поставить на остров или продать.'),
    step('Новый слот — сам', 'Как только уникальных крафтов хватает до следующего порога, слот добавляется автоматически.'),
    step('Улучши миньонов', 'Super Compactor 3000, Diamond Spreading или Flycatcher и вечное топливо (Enchanted Lava Bucket и выше).', ['SUPER_COMPACTOR_3000', 'ENCHANTED_LAVA_BUCKET']),
  ],
  museum: [
    step('Найди музей', 'Музей стоит в Hub (/hub), Madame Eleanor Q. Goldsworth III у входа открывает меню Your Museum: проценты по разделам, Special Items, вехи и поиск.'),
    step('Пожертвуй предмет', 'Открой меню музея и кликни по предмету в своём инвентаре → Confirm Donation. Предмет уходит в витрину своего раздела и сразу даёт SkyBlock XP.'),
    step('Сеты брони — целиком', 'Сет сдаётся только когда все его части (шлем, нагрудник, поножи, ботинки, а у некоторых ещё пояс и плащ) лежат в инвентаре. Сдаются все части сразу.'),
    step('Высший тир засчитывает низшие', 'Сдал улучшенную версию — младшие тиры тоже засчитаны (Aspect of the Void закрывает Aspect of the End). Низший тир после высшего XP уже не даст.', ['ASPECT_OF_THE_VOID', 'ASPECT_OF_THE_END']),
    step('Забирай обратно, когда нужно', 'Клик по своему предмету в музее возвращает его (Borrowing). XP останется, а вернуть предмет в витрину можно в любой момент. Пожертвованное становится Co-op Soulbound: продать его уже нельзя.'),
    step('Забирай награды вех', 'Каждые 100 XP музея — веха (всего 40). Открой Museum Milestones и забери награды: +1% Bits Multiplier, +2% Bank Interest, а на вехе 3 — Museum Appraisal и Deluxe Bank Upgrade.'),
    step('Особые предметы', 'Special Items (трофеи событий и редкости) кладутся на отдельную страницу. XP не дают, только для коллекции и оценки музея.'),
    step('Включи Museum API', 'Чтобы сайт видел музей: SkyBlock Menu → Settings → API Settings → Museum API.'),
  ],
  essence: [
    step('Посмотри, что есть', 'Essence лежат на счёте профиля, а не в инвентаре. Сайт показывает их в разделе «Запасы» → «Essence» и в таблице ниже.'),
    step('Поставь звёзды', 'Меню Essence Crafting: положи предмет, и меню покажет цену следующей звезды. Начни с того, чем пользуешься каждый день: оружие и броня.'),
    step('Купи перки', 'Открой магазин нужной эссенции и бери перки по порядку уровней. Wither Essence в первую очередь — на Forbidden-перки: статы навсегда.'),
    step('Докупай на Bazaar', 'С Catacombs 20 недостающую эссенцию можно купить на Bazaar (Forest — без требования). Сравни цену звезды с разницей в цене предмета со звёздами и без.', ['ESSENCE_WITHER']),
  ],
  hunting: [
    step('Пройди обучение в Tangleburg', 'Galatea → Tangleburg: David Hunterborough, потом Alan (Huntaxe), Oden, Albert (Black Hole), Jaeger (сеть) и Auryon (лассо). В конце Kysha покажет фьюжн.', ['VENATOR_GENESIS', 'BASIC_FISHING_NET', 'ABYSMAL_LASSO']),
    step('Лови осколки', 'Боевых мобов бей Huntaxe до 10% здоровья и ставь Black Hole, водных лови сетью, лесных — лассо. Пойманное само падает в Hunting Box.'),
    step('Ставь ловушки и ешь соль', 'Huntrap ловит осколок за сутки сама. Соль (Lushlilac) даёт шанс на осколок с любого убитого моба — ешь её перед фармом.', ['RETIA_BASICA', 'LUSHLILAC']),
    step('Извлекай осколки', '/huntingbox → кликни по осколку: он прокачивает свой атрибут. Нужен уровень Hunting под редкость (Uncommon 5, Rare 10, Epic 15, Legendary 20).'),
    step('Фьюжн', 'Fusion Machine в Tangleburg: два вида осколков → новый. Так делаются Hunter Fortune-атрибуты и Hideonring (слоты аксессуаров).'),
  ],
  enchanting: [
    step('Подними Enchanting до 10', 'Зачаровывай вещи на Enchantment Table (/et с Booster Cookie) или ставь книги на наковальне. Опыт Minecraft даёт Experience Bottle: Librarian в Hub продаёт их по 30 монет.', ['EXP_BOTTLE']),
    step('Скрафти и поставь стол', 'Experimentation Table: 8 Oak Log и Experience Bottle. Поставь на Private Island (/warp home) и нажми ПКМ.', ['EXPERIMENTATION_TABLE']),
    step('Сыграй две доп. игры', 'Chronomatron и Ultrasequencer: повтори цепочку цветов и порядок чисел. Они дают XP и лишние клики для Superpairs.'),
    step('Сыграй Superpairs', 'Открывай клетки по две: одинаковая пара забирает награду. Выбирай самую высокую открытую ставку.'),
    step('Повторяй каждый день', 'У стола 3 заряда, они возвращаются через 24 часа. Ещё 3 захода в день покупаются за Bits и уровни опыта.'),
  ],
  taming: [
    step('Выбери питомца под занятие', 'Питомец растёт от опыта скилла своего типа: Combat-питомец в бою, Mining-питомец на шахте. Чужой скилл даёт втрое меньше.'),
    step('Дай ему Exp Boost', 'Zog в Pet Care (Hub) продаёт Exp Boost за 50–60 тыс.: +20% опыта от своего скилла или +10% от всех.', ['PET_ITEM_ALL_SKILLS_BOOST_COMMON']),
    step('Заполни слот Exp Share', 'Меню /pets → Exp Share: питомец в слоте получает долю опыта активного, даже когда не призван.', ['PET_ITEM_EXP_SHARE']),
    step('Отдай питомца Fann', 'С Taming 10 Fann в Pet Care тренирует питомца, пока ты играешь: бесплатно или быстрее за монеты.'),
    step('Подними кап у George', 'После Taming 50 George в Pet Care берёт 10 питомцев из своего списка и поднимает кап до 60.'),
  ],
  chocolate: [
    step('Открой фабрику', 'Команда /cf. Накликай 50 Chocolate и найми Rabbit Bro: дальше Chocolate копится сам.'),
    step('Качай сотрудников до капа', 'Сначала младших: при равном уровне у них +1 Chocolate/с дешевле. Кап растёт с престижем.'),
    step('Включай Time Tower', 'С престижа 2. Заряд копится 8 часов, держи не больше трёх: включай, когда играешь.'),
    step('Делай престиж', 'Когда накопишь нужный Chocolate с прошлого престижа, подними уровень фабрики: множитель и кап вырастут. Перед этим потрать лишнее в Chocolate Shop.'),
    step('Собирай кроликов', 'Весной — яйца Hoppity (лучше в Crystal Hollows), круглый год — резиденты на островах и бродячие кролики в окне фабрики.', ['EGGLOCATOR']),
  ],
  collectibles: [
    step('Отметь собранные феи', 'Hypixel отдаёт только число собранных Fairy Souls. Открой остров ниже и нажми «Нашёл» у собранных (или «Отметить весь остров») — останутся только недостающие.'),
    step('Иди по маршруту', 'Души внутри острова отсортированы маршрутом от варпа. В подсказке: от какого /warp идти, сколько блоков и в какую сторону, на какой высоте. Кнопка 📍 копирует координаты для мода с вэйпоинтами.'),
    step('Меняй феи у Tia', 'Каждые 5 душ — обмен у Tia the Fairy в Hub (Fairy Pond в Wilderness) на постоянные статы.'),
    step('Собирай контакты Abiphone', 'С телефоном в инвентаре подойди к NPC и поговори. Сначала — те, что без условий, потом выполняй условия из списка.'),
    step('Играй на арфе', 'Melody в Парке (/warp park). Песни открываются по очереди, за первое прохождение каждой — постоянный Intelligence.', ['MELODY_HAIR']),
  ],
  rift: [
    step('Войди в Рифт', 'В Hub иди в Wizard Tower (/warp wizard), сделай Dimensional Infusion у Wizard и войди в портал.'),
    step('Купи Enigma Cloak', 'Enigma стоит у подножия Wizard Tower в Рифте, плащ стоит 100 Motes: каждая душа даст +20 с Rift Time.', ['ENIGMA_CLOAK']),
    step('Собирай души и таймчармы', 'Координаты душ — в таблице ниже (их удобно вбить в мод с вэйпоинтами). Таймчармы ставь в галерею Elise.'),
    step('Зарабатывай Motes', 'Собирай розовые шарики, продавай Рифт-предметы Motes Grubber, убивай боссов.'),
  ],
};

for (const k of ['zombie', 'spider', 'wolf', 'enderman', 'blaze']) HOWTO[tx`slayer-${k}`] = SLAYER;
HOWTO['slayer-vampire'] = [
  step('Открой Vampire Slayer', 'Нужен Globulate Timecharm и доступ в Stillgore Château в Рифте.'),
  step('Возьми квест', 'Maddox в замке Stillgore Château, оплата в Motes.'),
  ...SLAYER.slice(1, 4),
];

HOWTO.diana = [
  step('Проверь, идёт ли ивент', 'Мифологический ритуал идёт, только пока у Diana этот перк (она мэр или министр). Сейчас ли он — видно вверху гайда и на странице «События».'),
  step('Возьми Griffin и лопату', 'Надень питомца Griffin (чем выше редкость, тем больше видов мобов) и возьми Ancestral Spade у Diana в Hub.', ['ANCESTRAL_SPADE']),
  step('Найди нору', 'В Hub нажми ПКМ лопатой (Echo): частицы покажут путь к ближайшей норе грифона. Копай нору лопатой.'),
  step('Иди по цепочке', 'После каждой норы Echo ведёт к следующей. В конце цепочки — сокровище или мифический моб; убей его, пока не добили другие.'),
  step('Сдавай и крафти', 'Griffin Feather, Ancient Claw и Mythos Fragment идут на камни Griffin (улучшение у Kat), лопаты и броню. Редкий дроп продавай на аукционе или Bazaar.', ['GRIFFIN_FEATHER', 'ANCIENT_CLAW']),
];

/** Секция «Как это делать — пошагово» для гайда (или null). */
export function howtoSection(id) {
  const items = HOWTO[id];
  if (!items) return null;
  return { kind: 'steps', title: 'Как это делать — пошагово', note: 'Подчёркнутые слова — подсказки: наведи, чтобы прочитать, нажми на предмет, чтобы открыть его карточку.', items, howto: true };
}
