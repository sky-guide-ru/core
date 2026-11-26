// Справочник Rift: зоны, Enigma Souls, таймчармы, глаза Porhtal, части Montezuma, лавки за Motes.
// Источники: NEU-REPO constants/rift_guide.json и items/*_RIFT_NPC.json (цены в лавках, координаты NPC),
// SkyHanni-REPO constants/EnigmaSouls.json и island_graphs/THE_RIFT.json (координаты душ и глаз, MIT).
// Имена собственные (зоны, NPC, предметы) оставлены английскими, как в игре.

// Зоны в порядке прохождения
export const AREAS = [
  { id: 'wyld_woods', name: 'Wyld Woods', ru: 'Дикий лес', boundary: null,
    about: 'Стартовая зона: Enigma и его плащ, Porhtal, Argofay на деревьях, мини-квесты на Wyld-броню и Wyld Sword.' },
  { id: 'black_lagoon', name: 'Black Lagoon', ru: 'Чёрная лагуна', boundary: 'black_lagoon', gate: 'Рядом со стартом, отдельного условия нет.',
    about: 'Лагуна с хижиной Reed, учёные и Leech Supreme, Roy продаёт душу. Все 5 душ лагуны простые.' },
  { id: 'west_village', name: 'West Village', ru: 'Западная деревня', boundary: 'west_village', gate: 'Открывается, когда Supreme Timecharm поставлен в галерею Elise.',
    about: 'Mirrorverse доктора Emmett, Kat и заражённый дом, гонка Gunther, Sorcerer Okron с глифами.' },
  { id: 'dreadfarm', name: 'Dreadfarm', ru: 'Жуткая ферма', boundary: 'dreadfarm', gate: 'Идёт сразу за West Village.',
    about: 'Фермерская зона Shania. Квест Shania даёт Chicken Leggs и Blowgun — он нужен для душ с шариками и кнопками.' },
  { id: 'village_plaza', name: 'Village Plaza', ru: 'Деревенская площадь', boundary: 'village_plaza', gate: 'Нужны два таймчарма в галерее: Chicken N Egg и Mirrorverse.',
    about: 'Центр Рифта: Barry и протестующие, детектив Amog, аукционы Shen, Seymour и его кроссовки.' },
  { id: 'living_cave', name: 'Living Cave', ru: 'Живая пещера', boundary: 'living_cave', gate: 'Нужен SkyBlock Citizen Timecharm (квест Barry).',
    about: 'Живой металл: Self-Recursive Pickaxe, броня Living Metal, внизу Living Stillness с Frozilles.' },
  { id: 'colosseum', name: 'Colosseum', ru: 'Колизей', boundary: 'colosseum', gate: 'Нужен Living Timecharm.',
    about: 'Групповой босс Bacte (из него Globulate Timecharm) и Mole с душой «Full Circle».' },
  { id: 'stillgore_chateau', name: 'Stillgore Château', ru: 'Замок Stillgore', boundary: 'stillgore_chateau', gate: 'Через Barrier Street и Photon Pathway, дальше к Deer с Flying Boat (лодка Reed).',
    about: 'Вампиры, Maddox и Vampire Slayer, Healing Melon. Монстры здесь бьют по ❤ здоровью, а не по времени.' },
  { id: 'mountaintop', name: 'Mountaintop', ru: 'Горная вершина', boundary: 'mountaintop', gate: 'Подъём съедает много Rift Time: бери запас минимум минут на 10, на Walk of Fame — около 40.',
    about: 'Самая поздняя зона: Eleanor, Ubik, Sun Gecko, коллекция Timite и Celestial Timecharm.' },
];

// 52 Enigma Souls. api — коды из profile.rift.enigma.found_souls, которые проверены на реальном профиле.
// Коды Hypixel не совпадают с названиями душ и нигде не опубликованы; неподтверждённые оставлены пустыми.
// pos — x:y:z. hint — подсказка на русском.
export const SOULS = [
  // Wyld Woods
  { id: 'enigma_original', area: 'wyld_woods', name: 'Next to Enigma', pos: '-27:71:90', api: ['RIFT_1'], hint: 'Пример-душа прямо в домике Enigma у подножия Wizard Tower.' },
  { id: 'enigma_bark', area: 'wyld_woods', name: 'Tough Bark', pos: '-15:91:94', api: ['BARK_TREE'], hint: 'Светящаяся кора на дереве; «гав-гав» подсказывает про волков рядом.' },
  { id: 'enigma_flower_pot_1', area: 'wyld_woods', name: 'Woods Flower Pot', pos: '-6:60:226', api: ['WOODS_FLOWER_POT'], hint: 'Цепочка цветочных горшков ведёт к душе — иди по горшкам.' },
  { id: 'enigma_jump_pad_1', area: 'wyld_woods', name: 'Up in the Sky', pos: '-137:133:156', api: ['FROG_JUMP_PAD'], hint: 'Душа высоко в небе: взлети на прыжковой площадке.' },
  { id: 'enigma_phantom', area: 'wyld_woods', name: 'Fleespook', pos: '-27:89:136', api: ['WOODS_PHANTOM'], hint: 'Иди за призраком Fleespook — он приведёт к душе.' },
  { id: 'enigma_pressure_water', area: 'wyld_woods', name: 'Pressurized', pos: '-137:51:120', api: ['WOODS_WATER_SOUL'], hint: 'Под водой под давлением в озере Wyld Woods; нужно найти, как туда попасть.' },
  { id: 'enigma_silk_1', area: 'wyld_woods', name: 'Between Branches', pos: '-108:117:123', api: ['BETWEEN_BRANCHES'], hint: 'Висит в воздухе между ветками деревьев Wyld Woods.' },
  { id: 'enigma_two_plates', area: 'wyld_woods', name: 'Two Plates', pos: '-129:72:77', api: [], hint: 'Душа заперта в стекле: нужны два игрока на двух плитах.' },
  { id: 'enigma_wither_cage', area: 'wyld_woods', name: 'Wither Cage', pos: '-142:68:174', api: [], hint: 'Спрятана на виду рядом с Porhtal.' },
  // Black Lagoon
  { id: 'lagoon_parkour', area: 'black_lagoon', name: 'Lagoon Cave', pos: '43:91:56', api: ['LAGOON_PARKOUR'], hint: 'Паркур в пещере; не касайся ядовитой воды и… земли.' },
  { id: 'lagoon_shop', area: 'black_lagoon', name: 'Roy', pos: '-204:75:49', api: ['LAGOON_SHOP_SOUL'], hint: 'Купить у Roy наверху Lagoon Hut за 4 000 Motes и 8 Deadgehog Spine.' },
  { id: 'long_shrooms', area: 'black_lagoon', name: 'Mushroom Guy', pos: '-168:81:12', api: ['LONG_SHROOM'], hint: 'Mushroom Guy спрятал душу в дереве рядом с собой.' },
  { id: 'rocks_enigma', area: 'black_lagoon', name: 'Spinning Runes', pos: '-93:73:36', api: ['ROCKS_GAME_SOUL'], hint: 'Поверни все руны лицом к дереву.' },
  { id: 'tel_kar', area: 'black_lagoon', name: 'Tel Kar', pos: '-115:69:61', api: ['TELKAR'], hint: 'Поговори с Tel Kar и выслушай его рассказ о Рифте.' },
  // West Village
  { id: 'cake_house_1', area: 'west_village', name: 'Cake House #1', pos: '-95:76:-82', api: ['RIFT_CAKE'], hint: 'Две души спрятаны внутри торта в «тортовом» доме.' },
  { id: 'cake_house_2', area: 'west_village', name: 'Cake House #2', pos: '-94:70:-84', api: ['RIFT_CAKE_2'], hint: 'Вторая душа в том же торте.' },
  { id: 'dolphin_soul', area: 'west_village', name: 'Dolphin Parkour', pos: '-38:44:130', api: ['DOLPHIN_PARKOUR'], hint: 'Водный паркур «как дельфин» — на самом деле под Wyld Woods.' },
  { id: 'hot_dog', area: 'west_village', name: 'Hot Dog Contest', pos: '-102:72:-103', api: [], hint: 'Помоги Joey McPizza выиграть конкурс по поеданию хот-догов.' },
  { id: 'kat_soul', area: 'west_village', name: 'Fake Neuroscience', pos: '-34:71:-88', api: [], hint: 'Помоги Kat очистить дом; Key to Kat Soul стоит 40 Silverfish.' },
  { id: 'silk_2', area: 'west_village', name: 'Between Roofs', pos: '-88:79:-102', api: [], hint: 'Висит в воздухе между крышами West Village.' },
  { id: 'two_player_soul', area: 'west_village', name: '2 Players Soul', pos: '-106:78:-101', api: [], hint: 'Нужны двое: один жмёт маяк, другой — воронку.' },
  // Dreadfarm
  { id: 'beanstalk', area: 'dreadfarm', name: 'Beanstalk', pos: '-106:249:-149', api: [], hint: 'Вырасти бобовый стебель и залезь на самый верх.' },
  { id: 'buttons_soul', area: 'dreadfarm', name: 'Buttons', pos: '-74:65:-119', api: [], hint: 'Нажми или подстрели из Blowgun все кнопки на домах West Village и Dreadfarm. Одному нужен квест Shania.' },
  { id: 'dreadfarm_balloons', area: 'dreadfarm', name: 'Farm Balloons', pos: '-77:72:-176', api: [], hint: 'Лопни все шарики на Dreadfarm из Blowgun (даёт квест Shania).' },
  { id: 'dreadfarm_flowerpot', area: 'dreadfarm', name: 'Farm Flower Pot', pos: '-76:90:-149', api: [], hint: 'Цепочка горшков на Dreadfarm ведёт к душе.' },
  // Village Plaza
  { id: 'back2basics', area: 'village_plaza', name: 'Back to Basics', pos: '-88:20:0', api: [], hint: 'Прыгни в портал в центре площади — «назад к простым временам».' },
  { id: 'horsing_around', area: 'village_plaza', name: 'Horsing Around', pos: '40:70:27', api: [], hint: 'Глубоко в Half-Eaten Cave.' },
  { id: 'lonely_dave', area: 'village_plaza', name: 'Lonely Ävaeìkx', pos: '-34:66:-25', api: [], hint: 'Побудь рядом с Ävaeìkx, но не вплотную.' },
  { id: 'plaza_balloons', area: 'village_plaza', name: 'Plaza Balloons', pos: '47:68:-59', api: [], hint: 'Лопни все шарики на площади из Blowgun (квест Shania).' },
  { id: 'rabbit_under_hat', area: 'village_plaza', name: 'Rabbit in the Hat!', pos: '-21:72:-18', api: [], hint: 'Фокус с кроликом из шляпы. Главное — сохранять спокойствие.' },
  { id: 'scammer', area: 'village_plaza', name: 'Buy BZT Today', pos: '27:71:-77', api: [], hint: '«Инвестиция» в BZT: купи у Cryptosis за 15 000 Motes и 10 Scribe Crux.' },
  { id: 'village_glass', area: 'village_plaza', name: 'Between Cooler Roofs', pos: '-23:84:-92', api: [], hint: 'Висит в воздухе над крышами площади.' },
  { id: 'village_phantom', area: 'village_plaza', name: 'Plaza Fleespook', pos: '42:88:-91', api: [], hint: 'Иди за Fleespook по площади.' },
  // Living Cave
  { id: 'cave_flowers', area: 'living_cave', name: 'Flowery Message', pos: '3:68:-204', api: [], hint: 'Горшки ведут к записке с инструкцией; выполни её, чтобы открыть душу.' },
  { id: 'cave_wall', area: 'living_cave', name: 'Behind a Living Wall', pos: '38:63:-198', api: [], hint: 'За разрушаемой стеной в Living Cave.' },
  // Colosseum
  { id: 'mole', area: 'colosseum', name: 'Full Circle', pos: '-161:98:-72', api: [], hint: 'Поговори с Mole и обойди Колизей полным кругом.' },
  // Stillgore Château
  { id: 'castle_balloons', area: 'stillgore_chateau', name: 'Castle Balloons', pos: '232:94:168', api: [], hint: 'Лопни все шарики у замка из Blowgun.' },
  { id: 'castle_flowerpot', area: 'stillgore_chateau', name: 'Castle Flower Pot', pos: '266:60:145', api: [], hint: 'Цепочка горшков у замка.' },
  { id: 'castle_phantom', area: 'stillgore_chateau', name: 'Castle Fleespook', pos: '182:92:124', api: [], hint: 'Иди за Fleespook вокруг замка.' },
  { id: 'castle_standing', area: 'stillgore_chateau', name: 'Standing there', pos: '255:74:160', api: [], hint: 'Душа просто стоит где-то на островке замка.' },
  { id: 'fairylosopher_soul', area: 'stillgore_chateau', name: 'Fairylosopher', pos: '256:130:75', api: [], hint: 'Купить у Fairylosopher в башне: 10 000 Motes и 32 Splatter Crux.' },
  { id: 'silk_castle', area: 'stillgore_chateau', name: 'Between Towers', pos: '262:118:94', api: [], hint: 'Висит в воздухе между башнями замка.' },
  // Mountaintop
  { id: 'mountain_balloons', area: 'mountaintop', name: 'Mountain Balloons', pos: '7:113:73', api: [], hint: 'Лопни все шарики на вершине из Blowgun.' },
  { id: 'mountain_flowerpot', area: 'mountaintop', name: "Rose's End Flower Pot", pos: '35:97:166', api: [], hint: 'Цепочка горшков на вершине.' },
  { id: 'mountain_ikrus', area: 'mountaintop', name: 'Ikrus', pos: '8:157:59', api: [], hint: 'Помоги Ikrus выбраться из Рифта приседаниями.' },
  { id: 'mountain_leap_of_faith', area: 'mountaintop', name: 'Leap of Faith', pos: '26:166:7', api: [], hint: 'Просто прыгни.' },
  { id: 'mountain_phantom', area: 'mountaintop', name: 'Fleespook', pos: '22:208:-5', api: [], hint: 'Иди за Fleespook на вершине.' },
  { id: 'mountain_sungecko', area: 'mountaintop', name: 'Sun Gecko', pos: '38:89:16', api: [], hint: 'Купить в лавке Sun Gecko за 25 Sun Gecko Essence.' },
  { id: 'mountain_ubik_averages', area: 'mountaintop', name: "Ubik's Averages", pos: '39:133:17', api: [], hint: 'Угадай правильное число у Ubik.' },
  { id: 'mountain_ubik_boxes', area: 'mountaintop', name: "Ubik's Boxes", pos: '21:107:55', api: [], hint: 'Выбери правильную коробку у Ubik.' },
  { id: 'mountain_ubik_tats', area: 'mountaintop', name: "Ubik's Tit for Tats", pos: '-21:135:38', api: [], hint: 'Сыграй с Ubik в Split or Steal.' },
  { id: 'mountain_walk_of_fame', area: 'mountaintop', name: 'Walk of Fame', pos: '-203:24:-57', api: [], hint: 'У сена «для лошадей» на Walk of Fame.' },
];

// Коды из found_souls, которые есть на реальном профиле, но точное соответствие душе неизвестно.
// Кандидаты — души тех зон, где игрок уже был, с неподтверждённым кодом.
export const AMBIGUOUS_SOUL_CODES = ['PIECE_TREE', 'SOUL_IN_A_BOX', 'TREE_LAUNCH'];

// Таймчармы: тип в profile.rift.gallery.secured_trophies[].type → предмет RIFT_TROPHY_<TYPE>
export const TIMECHARMS = [
  { type: 'wyldly_supreme', id: 'RIFT_TROPHY_WYLDLY_SUPREME', name: 'Supreme Timecharm', area: 'black_lagoon',
    how: 'Крафт: 4 Bottled Odonata, 32 Lil Pad, 24 Deadgehog Spine и 4 Leech Supreme Fragment (босс Leech Supreme в лагуне).' },
  { type: 'mirrored', id: 'RIFT_TROPHY_MIRRORED', name: 'mrahcemiT esrevrorriM', area: 'west_village',
    how: 'Награда за прохождение Mirrorverse (подвал West Village). Если потерян — ttemme .rD продаёт за 10 000 Motes и 10 Shadow Crux.' },
  { type: 'chicken_n_egg', id: 'RIFT_TROPHY_CHICKEN_N_EGG', name: 'Chicken N Egg Timecharm', area: 'dreadfarm',
    how: 'Крафт на Dreadfarm: Protochicken, 8 Metaphoric Egg и связки урожая (Caducous, Agaricus, Wilted Berberis).' },
  { type: 'citizen', id: 'RIFT_TROPHY_CITIZEN', name: 'SkyBlock Citizen Timecharm', area: 'village_plaza',
    how: 'Разберись с протестующими у Barry, получи Barry\'s Montgray Pen и обменяй его вместе с 16 Scribe Crux в Old Election Box.' },
  { type: 'lazy_living', id: 'RIFT_TROPHY_LAZY_LIVING', name: 'Living Timecharm', area: 'living_cave',
    how: 'Крафт: 160 Living Metal и 20 Frosty Crux (Frozilles в Living Stillness).' },
  { type: 'slime', id: 'RIFT_TROPHY_SLIME', name: 'Globulate Timecharm', area: 'colosseum',
    how: 'Крафт: 8 Bacte Fragment (групповой босс Bacte) и 20 Shy Crux. Открывает Vampire Slayer.' },
  { type: 'vampiric', id: 'RIFT_TROPHY_VAMPIRIC', name: 'Vampiric Timecharm', area: 'stillgore_chateau',
    how: 'Крафт из Bloodbadge и 3 Wilted Berberis Bunch; рецепт открывается на Vampire Slayer 3.' },
  { type: 'mountain', id: 'RIFT_TROPHY_MOUNTAIN', name: 'Celestial Timecharm', area: 'mountaintop',
    how: 'Последний таймчарм: помоги всем Eleanor на вершине и пройди испытания Shen.' },
];

// Глаза Porhtal: profile.rift.wither_cage.killed_eyes. key — код из API, match — запасной поиск по подстроке.
export const EYES = [
  { key: 'wizard_tower', match: /wizard/, name: 'The Intruder', area: 'wyld_woods', pos: '-50:105:70', hint: 'В Wizard Tower.' },
  { key: 'fisherman_hut', match: /fisher|lagoon|hut/, name: 'The Gillman', area: 'black_lagoon', pos: '-205:66:50', hint: 'В Lagoon Hut.' },
  { key: 'dreadfarm', match: /dread|farm/, name: 'The Baba Yaga', area: 'dreadfarm', pos: '-15:72:-174', hint: 'На Dreadfarm.' },
  { key: 'village_plaza', match: /plaza|bank|village/, name: 'The Bankster', area: 'village_plaza', pos: '31:70:-37', hint: 'На Village Plaza.' },
  { key: 'colosseum', match: /colos/, name: 'Gooey', area: 'colosseum', pos: '-166:78:-54', hint: 'В Колизее.' },
  { key: 'castle', match: /castle|chateau|stillgore|prince/, name: 'The Prince', area: 'stillgore_chateau', pos: '158:75:80', hint: 'Вокруг замка Stillgore.' },
  { key: 'mountaintop', match: /mountain|sin/, name: 'The 7th Sin', area: 'mountaintop', pos: '47:170:39', hint: 'На горной вершине.' },
];

// Части души Montezuma: profile.rift.dead_cats.found_cats (first … ninth)
export const CATS = [
  { key: 'first', area: 'wyld_woods', hint: 'Под деревом в Wyld Woods.' },
  { key: 'second', area: 'wyld_woods', hint: 'В доме Rift Gallery, за кнопкой.' },
  { key: 'third', area: 'black_lagoon', hint: 'В Leeches Lair, за водопадом.' },
  { key: 'fourth', area: 'west_village', hint: 'Спрятана на крыше в West Village.' },
  { key: 'fifth', area: 'dreadfarm', hint: 'За стеной на Dreadfarm, ломается Horsezooka.' },
  { key: 'sixth', area: 'village_plaza', hint: 'В книжной полке цветочного магазина на площади.' },
  { key: 'seventh', area: 'village_plaza', hint: 'На летающем островке к востоку от Déjà Vu Alley.' },
  { key: 'eighth', area: 'living_cave', hint: 'Под снегом в Living Stillness.' },
  { key: 'ninth', area: 'stillgore_chateau', hint: 'На Photon Pathway, второй этаж дома по дороге к замку.' },
];

// Покупки за Motes, которые стоит рассмотреть (цены из лавок NPC в NEU-REPO)
export const SHOP = [
  { id: 'WYLD_BOOTS', name: 'Wyld Boots', npc: 'Argofay Trafficker', area: 'wyld_woods', motes: 50, why: 'Первая часть Wyld-брони, почти бесплатно.' },
  { id: 'WYLD_HELMET', name: 'Wyld Helmet', npc: 'Argofay Trafficker', area: 'wyld_woods', motes: 1000, why: 'Часть стартового сета Wyld.' },
  { id: 'WYLD_LEGGINGS', name: 'Wyld Leggings', npc: 'Argofay Trafficker', area: 'wyld_woods', motes: 1000, why: 'Часть стартового сета Wyld.' },
  { id: 'WYLD_CHESTPLATE', name: 'Wyld Chestplate', npc: 'Argofay Trafficker', area: 'wyld_woods', motes: 2000, why: 'Полный сет Wyld закрывает задание гида Рифта.' },
  { id: 'WYLD_SWORD', name: 'Wyld Sword', npc: 'Argofay Threebrothers', area: 'wyld_woods', motes: 333, extra: '3 Shy Crux', why: 'Стартовое оружие Рифта.' },
  { id: 'HARMONIOUS_SURGERY_TOOLKIT', name: 'Harmonious Surgery Toolkit', npc: 'Argofay Bugshopper', area: 'wyld_woods', motes: 2000, extra: '1 Bottled Odonata', why: 'Аксессуар Рифта: +10 с Rift Time, +2 скорости.' },
  { id: 'RIFT_BUCKET', name: 'Rift Bucket', npc: 'Plumber Joe', area: 'west_village', motes: 1000, why: 'Нужен для Anti-Morph Potion и квестов.' },
  { id: 'RIFT_WIZARD_TOWER_TRAVEL_SCROLL', name: 'Wizard Tower Travel Scroll', npc: 'Roger', area: 'village_plaza', motes: 5000, why: 'Быстрый возврат к Wizard Tower — экономит Rift Time.' },
  { id: 'RIFT_STRENGTH_ELIXIR', name: 'Rift Strength Elixir', npc: 'Shifted', area: 'wyld_woods', motes: 12000, extra: '5 Shy Crux', why: 'Сила в Рифте — помогает с боссами и слеером.' },
  { id: 'RIFT_SPEED_ELIXIR', name: 'Rift Speed Elixir', npc: 'Shifted', area: 'wyld_woods', motes: 10000, extra: '5 Shy Crux', why: 'Быстрее бегаешь — больше успеваешь за визит.' },
  { id: 'ANTI_SENTIENT_PICKAXE', name: 'Anti-Sentient Pickaxe', npc: 'Chipper McPickaxe', area: null, motes: 24999, why: 'Кирка, которая работает в Рифте.' },
  { id: 'EXCEEDINGLY_COMFY_SNEAKERS', name: 'Exceedingly Comfy Sneakers', npc: 'Seymour', area: 'village_plaza', motes: 49999, extra: 'Gunther Sneakers', why: 'Задание гида «Fancy Sneakers»; ботинки навсегда.' },
  { id: 'SHENS_RINGALIA', name: "Shen's Ringalia", npc: 'Madame Eleanor X', area: 'mountaintop', motes: 25000, extra: '64 Puff Crux, по 20 Youngite/Timite/Obsolite, Disinfestor Gloves', why: 'Поздняя покупка на вершине.' },
  { id: 'ZOOP_THE_FISH', name: 'Zoop the Fish', npc: 'Finplex', area: 'west_village', motes: 99999, why: 'Дорогая коллекционная покупка — только если Motes девать некуда.' },
];

// Покупаемые души: цена для подсказки «копи Motes»
export const SOUL_PURCHASES = [
  { soul: 'lagoon_shop', motes: 4000, extra: '8 Deadgehog Spine', npc: 'Roy' },
  { soul: 'scammer', motes: 15000, extra: '10 Scribe Crux', npc: 'Cryptosis' },
  { soul: 'fairylosopher_soul', motes: 10000, extra: '32 Splatter Crux', npc: 'Fairylosopher' },
];

// Опыт Vampire Slayer по уровням (NEU leveling.json slayer_xp.vampire)
export const VAMPIRE_XP = [20, 75, 240, 840, 2400];
