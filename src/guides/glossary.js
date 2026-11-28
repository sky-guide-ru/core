// Словарь подсказок для гайдов: механики, статы, места, события, валюты.
// Каждая запись: key → { names: [как пишется в тексте гайда, все формы], kind, title?, text, how?: [шаги], warp?, items?: [id] }.
// Слова ищутся в тексте гайда целиком и с учётом регистра; длинное совпадение побеждает короткое
// («Hotspot Hook» — предмет, «Hotspot» — подсказка). NPC и мобы подтягиваются из базы NEU автоматически (refs.js),
// здесь — только то, чего в NEU нет, или где нужен свой текст.
//
// kind: mech (механика), stat (характеристика), place (место), event (событие), cur (валюта), npc, mob, skill.

export const KIND_RU = {
  mech: 'Механика', stat: 'Характеристика', place: 'Место', event: 'Событие', cur: 'Валюта', npc: 'NPC', mob: 'Существо', skill: 'Навык', item: 'Предмет',
};

export const GLOSSARY = {
  // ---------- Рыбалка ----------
  double_hook: {
    names: ['Double Hook Chance', 'Double Hook', 'двойной улов', 'Двойной улов', 'двойной крючок', 'Двойной крючок'], kind: 'stat', title: 'Double Hook Chance',
    text: 'Шанс, что вместо одного Sea Creature клюнут сразу два. Вдвое больше опыта Fishing, дропа и убийств в бестиарий за один заброс.',
    how: ['Посмотри текущее значение: SkyBlock Menu → Your SkyBlock Profile, стат Double Hook Chance.', 'Подними его Titan Line (+2) у Roddy, реофорджами удочки и снаряжением с этим статом.'],
    items: ['TITAN_LINE'],
  },
  hotspot: {
    names: ['Hotspot', 'Hotspots', 'Хотспот', 'Хотспота', 'Хотспоты', 'Хотспотах', 'Хотспотов', 'Хотспоту', 'Хотспотом', 'хотспот', 'хотспоты', 'хотспотах'], kind: 'place', title: 'Hotspot',
    text: 'Светящееся пятно с частицами на воде или лаве. Живёт несколько минут, потом появляется в другом месте. Пока поплавок внутри — действует бонус пятна (Fishing Speed, Sea Creature Chance, Treasure Chance или Trophy Chance) и клюют особые существа Хотспота.',
    how: ['Ищи частицы над водой: Backwater Bayou, Spider\'s Den, Crimson Isle (лава) и другие острова.', 'Закидывай поплавок прямо в круг — бонус работает, только пока поплавок внутри.', 'Hotspot Hook, Hotspot Sinker и Hotspot Bait усиливают пятно и шанс его существ.'],
    items: ['HOTSPOT_HOOK', 'HOTSPOT_SINKER', 'HOTSPOT_BAIT'],
  },
  scc: {
    names: ['Sea Creature Chance', 'SCC'], kind: 'stat', title: 'Sea Creature Chance',
    text: 'Шанс, что вместо обычной рыбы клюнет Sea Creature. Существа дают почти весь опыт Fishing, дроп и прогресс бестиария, поэтому это главный стат рыбака.',
    how: ['Даёт удочка (Rod of the Sea, Hellfire Rod), броня рыбака, питомцы (Flying Fish, Ammonite, Megalodon), аксессуары Sea Creature Talisman/Ring/Artifact и зелье Fishing.'],
  },
  trophy_chance: {
    names: ['Trophy Chance', 'Trophy Fish Chance'], kind: 'stat', title: 'Trophy Fish Chance',
    text: 'Шанс поймать Trophy Fish при рыбалке в лаве Crimson Isle. Чем выше, тем быстрее закрываются виды и тиры для наград Odger.',
    how: ['Даёт лавовая удочка (Magma → Inferno → Hellfire Rod), Trophy Line и Hot Bait.'],
    items: ['TROPHY_LINE', 'HOT_BAIT'],
  },
  fishing_speed: {
    names: ['Fishing Speed'], kind: 'stat', title: 'Fishing Speed',
    text: 'Насколько быстрее клюёт. Больше забросов в минуту — больше существ и опыта.',
    how: ['Даёт Speedy Line, снаряжение Ichthyic/Finwave/Gillsplash, зачарование Lure и питомцы.'],
  },
  treasure_chance: {
    names: ['Treasure Chance'], kind: 'stat', title: 'Treasure Chance',
    text: 'Шанс выловить сокровище (предметы и монеты) вместо рыбы. Для фарма опыта он почти не важен.',
  },
  trophy_fishing: {
    names: ['Trophy Fishing', 'Trophy Fish', 'трофейная рыба', 'Трофейная рыба', 'трофейную рыбу', 'трофейной рыбы', 'Трофейной рыбы'], kind: 'mech', title: 'Trophy Fish',
    text: '18 видов особой рыбы, которая ловится только в лаве Crimson Isle. У каждого вида 4 тира: бронза, серебро, золото и алмаз. За собранные виды Odger выдаёт награды Trophy Fisher.',
    how: ['Возьми лавовую удочку и рыбачь в лаве Crimson Isle.', 'Для редких видов выполни условие: место, время, наживку или способ заброса (они в таблице гайда).', 'Пойманную рыбу неси Odger на вершине Blazing Volcano: он засчитает виды и разделает лишнее на Magmafish.'],
  },
  trophy_pity: {
    names: ['гарантия на 100-й/600-й улов', 'гарантию на 100/600', 'гарантия на 100/600', 'Гарантия (pity)', 'pity'], kind: 'mech', title: 'Гарантия трофейного тира',
    text: '100-й улов одного вида Trophy Fish гарантированно золотой, 600-й — алмазный, если этого тира у тебя ещё нет. Счётчик — все уловы этого вида за всё время.',
  },
  charm: {
    names: ['Charm', 'Charm V', 'Charm VI'], kind: 'mech', title: 'Charm (зачарование)',
    text: 'Зачарование удочки: +2% за уровень к шансу серебра, золота и алмаза у Trophy Fish (Charm V: алмаз 0,2% → 0,22%). Не влияет на сам шанс поймать трофей.',
    how: ['Книги Charm I–V — с рыбалки и на Bazaar, Charm VI — из Chain of the End Times. Нужен Enchanting 25.'],
  },
  peace_treaty: {
    names: ['Peace Treaty'], kind: 'mech', title: 'Peace Treaty (Hunter Armor)',
    text: 'Бонус от 2 надетых частей Hunter Armor: Sea Creatures больше не клюют и не бьют тебя, но и ты не можешь их бить. Хорошо для чистой охоты на трофеи, плохо для опыта Fishing.',
  },
  odgers_blessing: {
    names: ["Odger's Blessing", 'Odger’s Blessing'], kind: 'mech', title: "Odger's Blessing",
    text: 'Бонус Hunter Armor к Trophy Fish Chance за 2/3/4 части: Bronze 3/4/5, Silver 5/7,5/10, Gold 10/15/20, Diamond 20/25/30.',
  },
  trophy_fisher: {
    names: ['Novice Trophy Fisher', 'Adept Trophy Fisher', 'Expert Trophy Fisher', 'Master Trophy Fisher', 'Trophy Fisher'], kind: 'mech', title: 'Награды Trophy Fisher',
    text: 'Ранги Odger за Trophy Fish. Novice — 15 видов на бронзу, Adept — серебро у всех 18, Expert — золото у всех 18, Master — все тиры у всех 18. Novice открывает Thunder, Adept — Lord Jawbus.',
    how: ['Поговори с Odger на вершине Blazing Volcano (Crimson Isle) и забери награду в его меню: само по себе условие ничего не открывает.'],
  },
  bait: {
    names: ['наживка', 'наживку', 'наживки', 'Наживка', 'Наживки'], kind: 'mech', title: 'Bait',
    text: 'Расходник для рыбалки: лежит в инвентаре или Fishing Bag и тратится по одной штуке за заброс. Каждая наживка даёт свой бонус: больше существ, шанс акул, трофеев, ночных существ и т. п.',
    how: ['Покупается у Fishing Merchant в Hub и у Roddy, часть крафтится. Stingy Sinker экономит наживку.'],
  },
  bestiary: {
    names: ['бестиарий', 'бестиария', 'бестиарию', 'бестиарием', 'Бестиарий', 'Bestiary'], kind: 'mech', title: 'Bestiary',
    text: 'Счётчик убийств каждого вида мобов. За уровни бестиария дают постоянные статы и SkyBlock XP, а у Sea Creatures — ещё и бонус к Sea Creature Chance по этому виду.',
    how: ['Прогресс виден в SkyBlock Menu → Your SkyBlock Profile → Bestiary. Для Sea Creatures просто лови их нужное число раз.'],
  },
  sea_creature: {
    names: ['Sea Creatures', 'Sea Creature', 'морские существа', 'морское существо', 'морских существ', 'Морские существа', 'существа', 'существ'], kind: 'mech', title: 'Sea Creatures',
    text: 'Мобы, которые иногда клюют вместо рыбы. Их надо убить. Дают основной опыт Fishing, дроп (материалы для брони и удочек) и бестиарий. Новые виды открываются уровнем Fishing.',
  },
  fishing_festival: {
    names: ['Fishing Festival'], kind: 'event', title: 'Fishing Festival',
    text: 'Рыболовный фестиваль: первые 3 дня каждого месяца SkyBlock, если мэр — Marina (или действует её перк). В любой воде клюют акулы: Nurse (5), Blue (10), Tiger (18), Great White (24).',
    how: ['Проверь мэра в Hub (здание Election).', 'Бери Shark Bait (+20% шанс акул) и рыбачь в любой воде.', 'Зубы и плавники акул продаются, из Shark Fin делается Shark Scale Armor.'],
    items: ['SHARK_BAIT', 'GREAT_WHITE_SHARK_TOOTH', 'SHARK_FIN'],
  },
  spooky_festival: {
    names: ['Spooky Festival'], kind: 'event', title: 'Spooky Festival',
    text: 'Хэллоуин SkyBlock: дни 29–31 месяца Autumn. В любой воде клюют существа Spooky: Scarecrow, Nightmare, Werewolf, Phantom Fisher, Grim Reaper.',
    how: ['Бери Spooky Bait и Spooky Hook, рыбачь в любой воде, лучше ночью.'],
    items: ['SPOOKY_BAIT', 'PHANTOM_HOOK'],
  },
  jerry_workshop: {
    names: ['Jerry\'s Workshop', 'Jerry’s Workshop'], kind: 'place', title: 'Jerry\'s Workshop', warp: 'winter',
    text: 'Зимний остров. Открыт только в месяц Late Winter. Там клюют зимние существа (Frozen Steve, Frosty, Grinch, Yeti, Reindrake), а Ice Bait и Frozen Bait работают только здесь.',
    how: ['Дождись Late Winter, зайди через портал в Hub или /warp winter.'],
  },
  season_of_jerry: {
    names: ['Season of Jerry'], kind: 'event', title: 'Season of Jerry',
    text: 'Зимнее событие в Jerry\'s Workshop (дни 24–26 Late Winter): защита острова, подарки и North Stars.',
  },

  // ---------- Combat и Dungeons ----------
  ferocity: {
    names: ['Ferocity'], kind: 'stat', title: 'Ferocity',
    text: 'Шанс ударить ещё раз сразу же: 50 Ferocity — 50% шанс на второй удар, 100 — второй удар всегда, сверх 100 — шанс на третий. Полезен против существ и мобов с большим HP.',
  },
  magic_find: {
    names: ['Magic Find'], kind: 'stat', title: 'Magic Find',
    text: 'Повышает шанс редких дропов с мобов (не из сундуков данжа). 100 Magic Find = редкий дроп вдвое чаще.',
  },
  witherborn: {
    names: ['Witherborn'], kind: 'mech', title: 'Witherborn',
    text: 'Бонус полного сета брони Wither (Necron\'s, Storm\'s, Goldor\'s, Maxor\'s, Wither). Каждые несколько секунд выпускает черепа-скелеты, которые бьют мобов, и даёт Wither-статы. Семейства Wither можно смешивать: бонус общий.',
    how: ['Части падают из сундуков F7/M7, улучшаются звёздами за эссенцию Wither.'],
    items: ['POWER_WITHER_CHESTPLATE', 'ESSENCE_WITHER'],
  },
  s_plus: {
    names: ['S+'], kind: 'mech', title: 'Оценка S+',
    text: 'Высшая оценка захода в данж: 300+ очков. Очки — за мастерство (без смертей), скорость, найденные секреты и убитых мобов (Exploration). S+ даёт больше опыта Catacombs и лучший лут в сундуках.',
    how: ['Не умирай: каждая смерть −2 очка (первая с Spirit-питомцем бесплатна).', 'Ищи секреты в комнатах: моды вроде Skytils/SkyHanni подсвечивают их.', 'Чисти комнаты до конца и не затягивай заход.'],
  },
  master_mode: {
    names: ['Master Mode', 'Master-этаж', 'Master-этажи', 'M-этажи', 'M-этажах', 'M-этажей'], kind: 'mech', title: 'Master Mode',
    text: 'Усложнённые этажи M1–M7: мобы и боссы намного сильнее, но опыта Catacombs и лута больше, с M3 падают Master Stars. Каждый M-этаж открывается победой на предыдущем (M1 — после F7) и уровнем Catacombs.',
    how: ['В Dungeon Hub выбери в Party Finder или у Mort режим Master Mode.'],
  },
  master_star: {
    names: ['Master Stars', 'Master Star', 'мастер-звёзды'], kind: 'mech', title: 'Master Stars',
    text: 'Звёзды 6–10 для данж-предметов (после пяти обычных звёзд за эссенцию). Каждая даёт ещё больше статов. Звёзды First–Fifth Master Star падают на M3–M7.',
    items: ['FIRST_MASTER_STAR', 'FIFTH_MASTER_STAR'],
  },
  rng_meter: {
    names: ['RNG-метр', 'RNG-метра', 'RNG-метру', 'RNG Meter'], kind: 'mech', title: 'RNG-метр',
    text: 'Шкала гарантированного дропа: выбери редкий предмет, и за каждый заход/босса шкала копит очки. Когда заполнится — предмет выпадет гарантированно. У слееров, каждого этажа данжа и трупов в Mineshafts свой метр.',
    how: ['Открывается кликом по Catacombs-сундуку, у Maddox (слееры) или у Grandpa Wolf (/corpsemilestones): выбери цель и просто фарми.'],
  },
  secrets: {
    names: ['секреты', 'Секреты', 'секретов', 'Секретов', 'Secrets'], kind: 'mech', title: 'Secrets',
    text: 'Спрятанные сундуки, предметы, летучие мыши и рычаги в комнатах. Дают очки Exploration для S+ и полезный лут; общее число секретов влияет на некоторые предметы.',
  },
  catacombs: {
    names: ['Catacombs'], kind: 'skill', title: 'Catacombs',
    text: 'Уровень данжей (1–50). Растёт за победы на этажах; открывает новые этажи и Master Mode, усиливает данж-предметы внутри данжа.',
  },
  dungeon_class: {
    names: ['Archer', 'Berserk', 'Mage', 'Healer', 'Tank', 'Лучник', 'Берсерк', 'Маг', 'Хилер', 'Танк'], kind: 'mech', title: 'Классы Dungeons',
    text: 'В данже выбирается класс: Archer, Berserk, Mage, Healer, Tank. Полный опыт получает только выбранный, остальные — 25%.',
  },
  essence: {
    names: ['эссенция', 'эссенцию', 'эссенции', 'Эссенция', 'Essence'], kind: 'cur', title: 'Essence',
    text: 'Материал для звёзд на данж- и Kuudra-предметах. Виды: Wither, Undead, Dragon, Gold, Diamond, Ice, Spider, Crimson. Падает из сундуков данжа и Kuudra, ещё её дают при разборе (salvage) предметов.',
    how: ['Звёзды ставятся в Dungeon Hub → Malik или в меню Essence Shop/Anvil.'],
  },
  true_defense: {
    names: ['True Defense', 'истинная защита', 'истинную защиту', 'Истинная защита'], kind: 'stat', title: 'True Defense',
    text: 'Защита от истинного урона (True Damage), который пробивает обычную Defense. Нужна против Sven Packmaster и Inferno Demonlord.',
  },
  true_damage: {
    names: ['True Damage', 'истинный урон', 'истинным уроном'], kind: 'stat', title: 'True Damage',
    text: 'Урон, который игнорирует обычную Defense. Режет только True Defense.',
  },
  hitshield: {
    names: ['Hitshield'], kind: 'mech', title: 'Hitshield (щит Voidgloom)',
    text: 'Щит Voidgloom Seraph снимается числом ударов, а не уроном: пока он стоит, урон по боссу почти не проходит. Поэтому быстрое оружие (Terminator, Atomsplit Katana) сбивает его лучше всего.',
  },
  attunement: {
    names: ['аттюнмент', 'аттюнмента', 'аттюнментом', 'Attunement', 'Hellion Shield'], kind: 'mech', title: 'Hellion Shield и аттюнмент',
    text: 'С T2 у Inferno Demonlord щит одного из четырёх цветов (Ashen, Spirit, Crystal, Auric). Урон режется на 99%, если аттюнмент кинжала не совпадает. Щит меняется каждые 8 ударов.',
    how: ['Держи в руке кинжал блейз-слеера (Firedust/Twilight и выше).', 'Смотри на цвет щита и ПКМ кинжалом, пока цвет аттюнмента не совпадёт.'],
    items: ['FIREDUST_DAGGER', 'MAWDUST_DAGGER'],
  },
  slayer: {
    names: ['Zombie Slayer', 'Spider Slayer', 'Wolf Slayer', 'Enderman Slayer', 'Blaze Slayer', 'Vampire Slayer', 'Revenant Slayer', 'Tarantula Slayer', 'Sven Slayer', 'Voidgloom Slayer'], kind: 'mech', title: 'Slayer Level',
    text: 'Уровень слеера растёт за убитых боссов этого вида (квесты у Maddox the Slayer). Уровни открывают рецепты, Batphone, новые тиры и дают постоянные статы. «Wolf Slayer 3» — это 3 уровень слеера волков (Sven Packmaster).',
  },
  slayer_xp: {
    names: ['опыт слеера', 'опыта слеера', 'Slayer XP', 'Slayer XP Buff'], kind: 'mech', title: 'Slayer XP',
    text: 'Каждый убитый босс даёт опыт своего слеера (T1 5, T2 25, T3 100, T4 500, T5 1500). Уровни слеера открывают рецепты и дают постоянные статы.',
  },
  aatrox: {
    names: ['Aatrox'], kind: 'npc', title: 'Мэр Aatrox',
    text: 'Мэр с перками для слееров: Slayer XP Buff (+25% опыта слеера), Pathfinder (шанс редких дропов) и дешёвые квесты. Когда он мэр — лучшее время качать слееры.',
    how: ['Проверить мэра: здание Election в Hub или /calendar.'],
  },
  marina: {
    names: ['Marina'], kind: 'npc', title: 'Мэр Marina',
    text: 'Мэр рыбаков: Fishing Festival каждый месяц, больше Sea Creature Chance и Fishing Speed.',
  },
  maddox_batphone: {
    names: ['Maddox Batphone', 'Maddox Badphone'], kind: 'mech', title: 'Maddox Batphone',
    text: 'Предмет-телефон: звонит Maddox и открывает меню слееров где угодно. Рецепт открывается на Wolf Slayer 3.',
    items: ['AATROX_BATPHONE'],
  },
  etherwarp: {
    names: ['Etherwarp'], kind: 'mech', title: 'Etherwarp',
    text: 'Телепорт на блок, на который смотришь (присед + ПКМ Aspect of the Void с Etherwarp Conduit). Главный способ быстро двигаться по данжу.',
    items: ['ETHERWARP_CONDUIT', 'ASPECT_OF_THE_VOID'],
  },
  party_finder: {
    names: ['Party Finder'], kind: 'mech', title: 'Party Finder',
    text: 'Поиск группы в Dungeon Hub и на Crimson Isle: выбираешь этаж/тир, класс и требования, игроки сами присоединяются.',
  },
  soulbound: {
    names: ['Co-op Soulbound', 'Soulbound'], kind: 'mech', title: 'Soulbound',
    text: 'Предмет привязан к профилю: его нельзя продать на аукционе или передать другому игроку.',
  },
  kuudra_key: {
    names: ['Kuudra Key'], kind: 'mech', title: 'Kuudra Key',
    text: 'Ключ от платного сундука после победы над Kuudra. Свой на каждый тир, крафтится из монет и материалов фракции, Soulbound.',
    items: ['KUUDRA_TIER_KEY', 'KUUDRA_HOT_TIER_KEY'],
  },
  reputation: {
    names: ['репутация', 'репутации', 'репутацию', 'Репутация', 'реп.'], kind: 'mech', title: 'Репутация фракции',
    text: 'Очки фракции Crimson Isle (Mages или Barbarians). Растут за ежедневные квесты фракции, мини-боссов, Dojo и Kuudra. Открывают тиры Kuudra и магазины фракции.',
    how: ['Каждый день бери 5 квестов на доске в городе своей фракции (Dragontail у Barbarians, Scarleton у Mages).'],
  },

  factions: {
    names: ['Mages', 'Barbarians', 'Mage Faction', 'Barbarian Faction'], kind: 'mech', title: 'Фракции Crimson Isle',
    text: 'На Crimson Isle две фракции: Mages (город Scarleton) и Barbarians (Dragontail). Выбираешь одну; её квесты и магазин дают репутацию, броню и доступ к Kuudra.',
  },
  fallen_star: {
    names: ['Fallen Star', 'Fallen Stars'], kind: 'event', title: 'Fallen Star',
    text: 'Упавшая звезда в Dwarven Mines: появляется время от времени, её добывают вместе с другими игроками ради Starfall и Mithril Powder.',
  },
  fusion_machine: {
    names: ['Fusion Machine'], kind: 'mech', title: 'Fusion Machine',
    text: 'Машина в Tangleburg (Galatea): из двух шардов делает новый. Так получают шарды, которые не ловятся охотой.',
  },
  skyblock_menu: {
    names: ['SkyBlock Menu'], kind: 'mech', title: 'SkyBlock Menu',
    text: 'Главное меню игры: звезда Nether Star в последнем слоте инвентаря или команда /sbmenu. Отсюда открываются скиллы, коллекции, Settings и прочие разделы.',
  },
  dojo: {
    names: ['Dojo'], kind: 'place', title: 'Dojo',
    text: 'Арена на Crimson Isle с семью испытаниями (Force, Stamina, Mastery, Discipline, Swiftness, Control, Tenacity). Ранг от F до S по очкам; за общий счёт Master Tao выдаёт пояса.',
    how: ['Зайди с пустым инвентарём и без питомца, ПКМ по Master Tao и выбери испытание.'],
    items: ['DOJO_BLACK_BELT'],
  },
  matriarch: {
    names: ['Matriarch'], kind: 'mob', title: 'Matriarch',
    text: 'Существо в глубине вулкана Crimson Isle. Выделяет 3 Heavy Pearl в реальные сутки — жемчуг нужен на звёзды брони Kuudra.',
    items: ['HEAVY_PEARL'],
  },
  vanquisher: {
    names: ['Vanquisher'], kind: 'mob', title: 'Vanquisher',
    text: 'Редкий мини-иссушитель Crimson Isle (10 млн здоровья): может появиться после убийства любого моба на острове. С него падает Nether Star, за которую Emissary продаёт Kuudra Key.',
  },

  // ---------- Добыча ----------
  hotm: {
    names: ['Heart of the Mountain', 'HotM', 'HOTM'], kind: 'mech', title: 'Heart of the Mountain',
    text: 'Дерево перков добычи (уровни 1–10). Опыт HotM дают задания в Dwarven Mines/Crystal Hollows и добыча; каждый уровень даёт токены на перки, перки качаются Powder.',
    how: ['Открой меню: SkyBlock Menu → Heart of the Mountain (или /hotm).'],
  },
  powder: {
    names: ['Powder', 'Mithril Powder', 'Gemstone Powder', 'Glacite Powder'], kind: 'cur', title: 'Powder',
    text: 'Валюта перков HotM. Mithril Powder — Dwarven Mines, Gemstone Powder — Crystal Hollows (гемы, сундуки), Glacite Powder — Glacite Tunnels и Mineshafts.',
  },
  forge: {
    names: ['Forge', 'The Forge', 'Кузница', 'кузница', 'Кузнице'], kind: 'place', title: 'The Forge', warp: 'forge',
    text: 'Forge в Dwarven Mines: превращает материалы в предметы за реальное время (часы). Слотов тем больше, чем выше HotM. Хорошо приносит деньги пассивно.',
    how: ['/warp forge, ПКМ по Forge, положи материалы рецепта, вернись, когда таймер закончится.'],
  },
  crystal_nucleus: {
    names: ['Crystal Nucleus'], kind: 'place', title: 'Crystal Nucleus',
    text: 'Центр Crystal Hollows. Поставь в него 5 кристаллов (Jade, Amber, Amethyst, Sapphire, Topaz) — откроется сундук с частями Divan, гемами и Powder.',
    how: ['Добудь все 5 кристаллов в разных зонах Crystal Hollows (см. чек-лист гайда).', 'Принеси их в центр пещер и поставь на постаменты.'],
  },
  mineshaft: {
    names: ['Mineshafts', 'Mineshaft', 'Glacite Mineshafts'], kind: 'place', title: 'Glacite Mineshafts',
    text: 'Случайные шахты, которые иногда открываются при добыче в Glacite Tunnels. Внутри Frozen Corpse с лутом и гемы. Шанс растёт с перком Surveyor.',
  },
  frozen_corpse: {
    names: ['Frozen Corpse', 'Frozen Corpses'], kind: 'mech', title: 'Frozen Corpse',
    text: 'Замёрзшие трупы гномов в Mineshafts. Lapis открывается сразу, Umber и Tungsten — своим ключом, Vanguard (только в шахте Fairy) — Skeleton Key. Дают гемы, Plate, ключи, Glacite Powder и опыт HotM.',
  },
  corpse_milestones: {
    names: ['Frozen Corpse Milestones', 'Frozen Corpse Milestone'], kind: 'mech', title: 'Frozen Corpse Milestones',
    text: '7 вех за открытые трупы в Mineshafts. Награды: Organ Donor Talisman → Ring → Artifact, +10% шанс на лишний труп и лишний предмет, Glacite Powder и очки RNG Meter. Старые трупы засчитаны.',
    how: ['Поговори с Grandpa Wolf в его пещере в Glacite Tunnels (-56 125 332).', 'Дальше меню открывается командой /corpsemilestones.', 'Награду за каждую веху забирай в меню сам.'],
  },
  grandpa_wolf: {
    names: ['Grandpa Wolf'], kind: 'npc', title: 'Grandpa Wolf',
    text: 'NPC в Grandpa Wolf’s Cave в Glacite Tunnels (-56 125 332). Открывает Frozen Corpse Milestones и RNG Meter для трупов; в его пещере не холодно.',
  },
  pristine: {
    names: ['Pristine'], kind: 'stat', title: 'Pristine',
    text: 'Шанс, что при добыче гема выпадет сразу Flawless-версия. Главный стат для денег на гемах.',
  },
  mining_fortune: {
    names: ['Mining Fortune', 'Gemstone Fortune', 'Block Fortune'], kind: 'stat', title: 'Fortune при добыче',
    text: 'Сколько лишних блоков падает с каждой добычи: 100 Fortune = вдвое больше дропа.',
  },
  mining_speed: {
    names: ['Mining Speed'], kind: 'stat', title: 'Mining Speed',
    text: 'Mining Speed: чем выше, тем быстрее ломаются руды, гемы и камень.',
  },
  hotf: {
    names: ['Heart of the Forest', 'HotF'], kind: 'mech', title: 'Heart of the Forest',
    text: 'Дерево перков Foraging на Galatea (уровни 1–8). Опыт — задания Hina и рубка деревьев, перки качаются Whispers.',
  },
  whispers: {
    names: ['Whispers', 'Forest Whispers', 'Desert Whispers'], kind: 'cur', title: 'Whispers',
    text: 'Валюта перков Heart of the Forest: падает из Tree Gifts на Galatea.',
  },
  tree_gift: {
    names: ['Tree Gifts', 'Tree Gift'], kind: 'mech', title: 'Tree Gift',
    text: 'Подарок за полностью срубленное дерево на Galatea: лут и Whispers.',
  },
  sweep: {
    names: ['Sweep'], kind: 'stat', title: 'Sweep',
    text: 'Сколько брёвен ломается одним ударом топора. Главный стат скорости Foraging.',
  },

  // ---------- Farming ----------
  farming_fortune: {
    names: ['Farming Fortune'], kind: 'stat', title: 'Farming Fortune',
    text: 'Сколько лишнего урожая падает с каждого блока: 100 Fortune = вдвое больше. Главный стат фермера.',
  },
  copper: {
    names: ['медь', 'меди', 'медью', 'Copper'], kind: 'cur', title: 'Copper',
    text: 'Валюта Garden. Её дают Visitors за выполненные заказы. Тратится на Crop Upgrades, инструменты и предметы SkyMart.',
  },
  visitors: {
    names: ['Visitors', 'гости', 'Гости', 'гостей'], kind: 'mech', title: 'Garden Visitors',
    text: 'NPC, которые сами приходят в Garden (до 5 в очереди) и просят немного урожая. За заказ — Copper, опыт Garden и иногда редкий дроп.',
    how: ['Заходи в Garden, выполняй заказы у Desk. Отказывайся, если заказ дороже награды.'],
  },
  crop_upgrades: {
    names: ['Crop Upgrades', 'Crop Upgrade'], kind: 'mech', title: 'Crop Upgrades',
    text: 'Улучшения культур в Garden за Copper: +5 Farming Fortune этой культуре за уровень, максимум 9.',
    how: ['В Garden: Desk → Crop Upgrades.'],
  },
  garden_desk: {
    names: ['Desk', 'Garden Desk'], kind: 'mech', title: 'Desk (Garden)',
    text: 'Стол в Barn в Garden: главное меню Garden. Отсюда открываются Crop Upgrades, участки (Plots), Garden Level, Crop Milestones и Composter.',
    how: ['/warp garden, подойди к столу в Barn и нажми ПКМ.'],
  },
  skymart: {
    names: ['SkyMart'], kind: 'place', title: 'SkyMart',
    text: 'Магазин в Garden за Copper: инструменты фермера, улучшения и предметы для Garden.',
  },
  plots: {
    names: ['Plots', 'Plot'], kind: 'mech', title: 'Plots',
    text: 'Участки Garden вокруг Barn: всего 24. Открываются за Compost в Desk → Configure Plots; на каждом можно растить свою культуру.',
  },
  composter: {
    names: ['Composter', 'Compost'], kind: 'mech', title: 'Composter',
    text: 'Машина в Garden: из органики и топлива сама делает Compost. Compost нужен для новых участков и продаётся на Bazaar.',
  },
  pests: {
    names: ['Pests', 'Pest', 'вредители', 'Вредители', 'вредителям', 'вредителей'], kind: 'mob', title: 'Pests',
    text: 'Мелкие мобы, которые появляются на участках Garden при фарме и замедляют рост. Убивай пылесосом: с них падают Pest-дропы, а сами Pests меняются у Pesthunter Phillip.',
  },
  jacob_contest: {
    names: ['Jacob\'s Contest', 'Jacob’s Contest'], kind: 'event', title: 'Jacob\'s Contest',
    text: 'Фермерский конкурс каждый час: 3 культуры, побеждает тот, кто собрал больше. Медали (бронза/серебро/золото) и Jacob\'s Ticket.',
    how: ['Когда начнётся — фарми одну из трёх культур 20 минут.', 'Награду забери у Jacob в Hub (Farm) или в Garden.'],
  },

  // ---------- Рифт ----------
  rift_time: {
    names: ['Rift Time'], kind: 'mech', title: 'Rift Time',
    text: 'Таймер в Рифте: тикает каждую секунду, на нуле тебя выкидывает. Максимум поднимают Enigma Souls, таймчармы и Rift-предметы.',
  },
  motes: {
    names: ['Motes'], kind: 'cur', title: 'Motes',
    text: 'Валюта Рифта: за мобов, продажу Рифт-предметов и задания. Тратится только в Рифте.',
  },
  enigma_souls: {
    names: ['Enigma Souls', 'Enigma Soul'], kind: 'mech', title: 'Enigma Souls',
    text: '52 спрятанные души в Рифте. Каждая с Enigma Cloak даёт +20 с Rift Time.',
  },
  timecharm: {
    names: ['таймчарм', 'таймчармы', 'таймчарма', 'таймчармов', 'Таймчармы', 'Timecharm'], kind: 'mech', title: 'Timecharms',
    text: '8 главных трофеев Рифта. Ставятся в галерею Elise, открывают зоны и усиливают Rift Necklace.',
  },

  // ---------- Миньоны и общее ----------
  unique_crafts: {
    names: ['уникальных крафтов', 'Уникальных крафтов', 'уникальные крафты', 'Уникальные крафты'], kind: 'mech', title: 'Уникальные крафты миньонов',
    text: 'Каждый новый уровень каждого миньона, скрафченный впервые, засчитывается один раз. Чем больше уникальных крафтов, тем больше слотов под миньонов на острове.',
  },
  bazaar: {
    names: ['Bazaar'], kind: 'place', title: 'Bazaar',
    text: 'Биржа ресурсов: мгновенная покупка/продажа или заказы по своей цене. /bz с Booster Cookie, иначе NPC Bazaar в Hub.',
  },
  bin: {
    names: ['BIN', 'Lowest BIN', 'мин. BIN'], kind: 'mech', title: 'BIN',
    text: 'Buy It Now — лот на аукционе с фиксированной ценой, покупается сразу. «Lowest BIN» — самый дешёвый такой лот.',
  },
  skyblock_xp: {
    names: ['SkyBlock XP'], kind: 'mech', title: 'SkyBlock XP',
    text: 'Общий уровень профиля: растёт почти за всё (навыки, коллекции, бестиарий, слееры). Открывает функции и даёт статы.',
  },
  booster_cookie: {
    names: ['Booster Cookie'], kind: 'mech', title: 'Booster Cookie',
    text: 'Печенье на 4 дня: /bz и /ah откуда угодно, Bits, больше опыта и Magic Find, предметы не теряются при смерти.',
    items: ['BOOSTER_COOKIE'],
  },
  reforge: {
    names: ['реофордж', 'реофорджи', 'реофорджами', 'Реофордж', 'реформу'], kind: 'mech', title: 'Reforge',
    text: 'Приставка к предмету с бонусом статов. Делается у Blacksmith в Hub за монеты или камнем реофорджа (Reforge Stone) на наковальне Reforge Anvil.',
  },

  // ---------- Навыки (заголовки таблиц) ----------
  skill_fishing: { names: ['Fishing'], kind: 'skill', title: 'Fishing', text: 'Навык рыбалки. В таблицах — уровень Fishing, с которого открывается предмет или существо.' },
  skill_mining: { names: ['Mining'], kind: 'skill', title: 'Mining', text: 'Навык добычи. Растёт за руды, гемы и камень.' },
  skill_foraging: { names: ['Foraging'], kind: 'skill', title: 'Foraging', text: 'Навык рубки деревьев: даёт силу и SkyBlock XP.' },
  skill_farming: { names: ['Farming'], kind: 'skill', title: 'Farming', text: 'Навык фермерства. Кап поднимается до 60 у Anita за медали Jacob\'s Contest.' },
  skill_combat: { names: ['Combat'], kind: 'skill', title: 'Combat', text: 'Навык боя: растёт за убийства мобов, нужен для брони Kuudra и многих предметов.' },

  // ---------- Музей ----------
  museum: {
    names: ['Museum', 'Your Museum', 'музей', 'Музей', 'музее', 'музея', 'музею'], kind: 'place', title: 'Museum', warp: 'hub',
    text: 'Здание в Hub, куда жертвуют предметы и сеты брони. Каждый пожертвованный предмет навсегда даёт SkyBlock XP, каждые 100 XP музея — веха с наградой.',
    how: ['Иди в Hub (/hub) к Madame Eleanor Q. Goldsworth III.', 'В меню Your Museum кликни по предмету в инвентаре → Confirm Donation.'],
  },
  museum_milestone: {
    names: ['Museum Milestones', 'Museum Milestone', 'веха музея', 'Веха музея', 'вехи музея', 'Вехи музея', 'Вехи музея идут'], kind: 'mech', title: 'Вехи музея',
    text: 'Каждые 100 SkyBlock XP, полученных за музей, — новая веха (всего 40). Вехи дают +1% Bits Multiplier, +2% Bank Interest и свои награды (на вехе 3 — Museum Appraisal и Deluxe Bank Upgrade).',
    how: ['Награды забираются в меню Museum Milestones в музее.'],
  },
  coop_soulbound: {
    names: ['Co-op Soulbound', 'Soulbound'], kind: 'mech', title: 'Co-op Soulbound',
    text: 'Предмет привязан к острову: его нельзя продать на аукционе и передать за пределы коопа. Любой пожертвованный в музей предмет становится Co-op Soulbound, даже если потом забрать его обратно.',
  },
  museum_borrowing: {
    names: ['Borrowing', 'одолжен', 'одолжено', 'Одолжено'], kind: 'mech', title: 'Забрать из музея (Borrowing)',
    text: 'Пожертвованный предмет можно забрать из музея кликом по нему. SkyBlock XP за него остаётся, а вернуть его в витрину можно в любой момент.',
  },
  museum_appraisal: {
    names: ['Museum Appraisal Service', 'Museum Appraisal'], kind: 'mech', title: 'Museum Appraisal',
    text: 'Разовая услуга за 10 млн, открывается на вехе 3: оценка стоимости музея. После неё оценка видна в профиле и на сайтах статистики. На прогресс не влияет.',
  },
  museum_special: {
    names: ['Special Items', 'особые предметы', 'Особые предметы', 'особых предметов'], kind: 'mech', title: 'Special Items',
    text: 'Отдельная страница музея для редких и событийных предметов. Они не дают SkyBlock XP и не входят в проценты разделов, зато увеличивают коллекцию и оценку музея.',
  },
  museum_api: {
    names: ['Museum API'], kind: 'mech', title: 'Museum API',
    text: 'Настройка Hypixel, разрешающая сайтам видеть твой музей. Без неё не видно, что пожертвовано.',
    how: ['SkyBlock Menu → Settings → API Settings → Museum API.'],
  },
  bits_multiplier: {
    names: ['Bits Multiplier'], kind: 'stat', title: 'Bits Multiplier',
    text: 'Множитель Bits, которые даёт Booster Cookie. Каждая веха музея добавляет +1%.',
  },
  bank_interest: {
    names: ['Bank Interest'], kind: 'stat', title: 'Bank Interest',
    text: 'Проценты, которые Bank начисляет на вклад каждый сезон. Вехи музея добавляют +2% к ним.',
  },
  // ---------- Места ----------
  hub: { names: ['Хаб', 'Хабе', 'Хаба', 'Hub'], kind: 'place', title: 'Hub', warp: 'hub', text: 'Главный остров с NPC, аукционом, Bazaar и порталами на другие острова.' },
  backwater_bayou: { names: ['Backwater Bayou'], kind: 'place', title: 'Backwater Bayou', warp: 'bayou', text: 'Остров рыбаков: Roddy ставит детали удочек, Junker Joel меняет Rusty Coin на Backwater Armor, свои существа (Titanoboa, Alligator) и Хотспоты.' },
  crimson_isle: { names: ['Crimson Isle'], kind: 'place', title: 'Crimson Isle', warp: 'nether', text: 'Огненный остров: фракции Mages/Barbarians, Kuudra, Inferno Demonlord, лавовая рыбалка и трофейная рыба.' },
  blazing_volcano: { names: ['Blazing Volcano'], kind: 'place', title: 'Blazing Volcano', warp: 'nether', text: 'Вулкан в центре Crimson Isle: на вершине Odger, вокруг гейзеры и лавовые пруды для трофейной рыбы.' },
  mystic_marsh: { names: ['Mystic Marsh'], kind: 'place', title: 'Mystic Marsh', warp: 'nether', text: 'Болото на Crimson Isle (к юго-западу от вулкана). Здесь ловится Moldfin.' },
  scarleton: { names: ['Scarleton'], kind: 'place', title: 'Scarleton', warp: 'nether', text: 'Город Mages на Crimson Isle. Лава здесь считается частью Mystic Marsh: клюёт Moldfin.' },
  dragontail: { names: ['Dragontail'], kind: 'place', title: 'Dragontail', warp: 'nether', text: 'Город Barbarians на Crimson Isle. Лава здесь считается частью Burning Desert: клюёт Skeleton Fish.' },
  geyser: { names: ['гейзер', 'гейзера', 'гейзеры', 'гейзером', 'гейзеров'], kind: 'place', title: 'Гейзеры Blazing Volcano', text: 'Места в лаве у вулкана, над которыми поднимаются белые частицы. Поплавок в 2 блоках от гейзера — условие для Steaming-Hot Flounder.' },
  burning_desert: { names: ['Burning Desert'], kind: 'place', title: 'Burning Desert', warp: 'nether', text: 'Пустыня на востоке Crimson Isle. Здесь ловится Skeleton Fish.' },
  stronghold: { names: ['Stronghold'], kind: 'place', title: 'Stronghold', warp: 'nether', text: 'Крепость на Crimson Isle: блейз-слеер и Soul Fish.' },
  dojo: { names: ['Dojo'], kind: 'place', title: 'Dojo', warp: 'nether', text: 'Додзё у города Barbarians на Crimson Isle: испытания за репутацию, в лаве ловится Karate Fish.' },
  smoldering_tomb: { names: ['Smoldering Tomb'], kind: 'place', title: 'Smoldering Tomb', warp: 'smold', text: 'Гробница на Crimson Isle: демоны для квестов Inferno Demonlord.' },
  crystal_hollows: { names: ['Crystal Hollows'], kind: 'place', title: 'Crystal Hollows', warp: 'crystals', text: 'Огромная пещера гемов под Dwarven Mines. Нужен пропуск (Crystal Hollows Pass) у Gwendolyn. Зоны: Mines of Divan, Goblin Holdout, Jungle, Precursor Remnants, Magma Fields.' },
  dwarven_mines: { names: ['Dwarven Mines'], kind: 'place', title: 'Dwarven Mines', warp: 'mines', text: 'Шахты гномов: Mithril, Titanium, задания, кузница (The Forge).' },
  glacite_tunnels: { names: ['Glacite Tunnels', 'Dwarven Base Camp'], kind: 'place', title: 'Glacite Tunnels', warp: 'basecamp', text: 'Ледяные туннели под Dwarven Base Camp: Umber, Tungsten, Glacite и новые гемы, вход в Mineshafts.' },
  mines_of_divan: { names: ['Mines of Divan'], kind: 'place', title: 'Mines of Divan', text: 'Зона Crystal Hollows: сундуки с Divan Fragment, кристалл Jade.' },
  goblin_holdout: { names: ['Goblin Holdout'], kind: 'place', title: 'Goblin Holdout', text: 'Зона гоблинов в Crystal Hollows: Goblin Queen и кристалл Amber.' },
  precursor_remnants: { names: ['Precursor Remnants', 'Lost Precursor City'], kind: 'place', title: 'Precursor Remnants', text: 'Руины в Crystal Hollows: Professor Robot и кристалл Sapphire.' },
  magma_fields: { names: ['Magma Fields', 'Khazad-dûm'], kind: 'place', title: 'Magma Fields', text: 'Нижняя зона Crystal Hollows: жарко, босс Bal и кристалл Topaz.' },
  graveyard: { names: ['Graveyard'], kind: 'place', title: 'Graveyard', warp: 'crypts', text: 'Кладбище в Хабе: зомби и квесты Revenant Horror.' },
  spiders_den: { names: ['Spider\'s Den', 'Spider’s Den', 'Arachne\'s Burrow'], kind: 'place', title: 'Spider\'s Den', warp: 'spider', text: 'Остров пауков: Tarantula Broodfather, Arachne. Тут же портал на Crimson Isle.' },
  the_end: { names: ['The End', 'Dragon\'s Nest', 'Void Sepulture', 'Bruiser Hideout'], kind: 'place', title: 'The End', warp: 'end', text: 'Энд: эндермены, Voidgloom Seraph, драконы.' },
  the_park: { names: ['The Park', 'Howling Cave', 'Парке'], kind: 'place', title: 'The Park', warp: 'park', text: 'Лесной остров с деревьями и волками (Howling Cave — Sven Packmaster).' },
  galatea: { names: ['Galatea', 'Moonglade Marsh'], kind: 'place', title: 'Galatea', warp: 'galatea', text: 'Новый остров Foraging: Fig, Mangrove и Helix, Hina, Heart of the Forest.' },
  garden: { names: ['Сад', 'Саду', 'Сада', 'Garden'], kind: 'place', title: 'Garden', warp: 'garden', text: 'Личный фермерский остров: участки, гости, Composter, Crop Upgrades.' },
  mushroom_desert: { names: ['Mushroom Desert', 'Oasis'], kind: 'place', title: 'Mushroom Desert', warp: 'desert', text: 'Пустыня на Farming Islands: Trevor, Oasis (вода с Oasis-существами).' },
  dungeon_hub: { names: ['Dungeon Hub'], kind: 'place', title: 'Dungeon Hub', warp: 'dungeon_hub', text: 'Хаб данжей: вход в Catacombs, Party Finder, Malik (звёзды) и магазины эссенции.' },
  wizard_tower: { names: ['Wizard Tower'], kind: 'place', title: 'Wizard Tower', warp: 'wizard', text: 'Башня волшебника в Хабе: вход в Рифт.' },
  stillgore: { names: ['Stillgore Château'], kind: 'place', title: 'Stillgore Château', text: 'Замок вампиров в Рифте: Vampire Slayer.' },
  fishermans_hut: { names: ['Fisherman’s Hut', 'Fisherman\'s Hut'], kind: 'place', title: 'Fisherman\'s Hut', warp: 'hub', text: 'Домик рыбака у озера в Хабе: Fishing Merchant продаёт наживку и Angler Armor.' },
  plhlegblast_pool: { names: ['Plhlegblast Pool'], kind: 'place', title: 'Plhlegblast Pool', text: 'Особый лавовый пруд на Crimson Isle (за водопадом Blazing Volcano), где ловится Plhlegblast.' },
};
