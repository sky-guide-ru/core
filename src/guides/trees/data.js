// Сгенерировано из NEU constants/hotmlayout.json и hotflayout.json + русские описания (scripts в треде гайдов).
// x, y — клетка в меню (y=0 — верхний ряд), max — макс. уровень, powder/cost/stats — формулы NEU (lisp), ru — описание, {stat…} подставляется.
export const TREES = {
 "hotm": {
  "mining_speed": {
   "name": "Mining Speed",
   "x": 3,
   "y": 9,
   "max": 50,
   "powder": "MITHRIL",
   "cost": "(pow (+ level 2) 3)",
   "stats": {
    "stat": "(* level 20)"
   },
   "short": "Mining Speed",
   "ru": "+{stat} Mining Speed.",
   "ability": false
  },
  "mining_speed_boost": {
   "name": "Mining Speed Boost",
   "x": 1,
   "y": 8,
   "max": 1,
   "powder": "MITHRIL",
   "cost": "",
   "stats": {
    "statBoost": "(if (lt potm 2) \"200\" \"250\")",
    "statDuration": "(if (lt potm 2) \"10\" \"15\")"
   },
   "short": "Способность кирки",
   "ru": "Способность кирки Mining Speed Boost: +{statBoost}% Mining Speed на {statDuration} с. Перезарядка 120 с.",
   "ability": true
  },
  "precision_mining": {
   "name": "Precision Mining",
   "x": 2,
   "y": 8,
   "max": 1,
   "powder": "MITHRIL",
   "cost": "0",
   "stats": {},
   "short": "Точная добыча",
   "ru": "При добыче руды и Dwarven Metals на блоке появляется метка: если целиться в неё, Mining Speed +30%.",
   "ability": false
  },
  "mining_fortune": {
   "name": "Mining Fortune",
   "x": 3,
   "y": 8,
   "max": 50,
   "powder": "MITHRIL",
   "cost": "(pow (+ level 2) 3.05)",
   "stats": {
    "stat": "(* level 2)"
   },
   "short": "Mining Fortune",
   "ru": "+{stat} Mining Fortune.",
   "ability": false
  },
  "titanium_insanium": {
   "name": "Titanium Insanium",
   "x": 4,
   "y": 8,
   "max": 50,
   "powder": "MITHRIL",
   "cost": "(pow (+ level 2) 3.1)",
   "stats": {
    "stat": "(round-decimals (+ 2 (* level 0.1)) 1)"
   },
   "short": "Титан",
   "ru": "При добыче Mithril Ore шанс {stat}% превратить блок в Titanium Ore.",
   "ability": false
  },
  "pickobulus": {
   "name": "Pickobulus",
   "x": 5,
   "y": 8,
   "max": 1,
   "powder": "MITHRIL",
   "cost": "",
   "stats": {
    "stat": "(if (lt potm 2) \"60\" \"50\")"
   },
   "short": "Способность кирки",
   "ru": "Способность кирки Pickobulus: бросаешь кирку, взрыв ломает всю руду в радиусе 2 блоков. Перезарядка {stat} с.",
   "ability": true
  },
  "luck_of_the_cave": {
   "name": "Luck of the Cave",
   "x": 1,
   "y": 7,
   "max": 45,
   "powder": "MITHRIL",
   "cost": "(pow (+ level 2) 3.07)",
   "stats": {
    "stat": "(+ level 5)"
   },
   "short": "Редкие события",
   "ru": "Шанс редких событий в Dwarven Mines выше на {stat}%: Golden Goblin, Fallen Star, Powder Ghast.",
   "ability": false
  },
  "efficient_miner": {
   "name": "Efficient Miner",
   "x": 3,
   "y": 7,
   "max": 100,
   "powder": "MITHRIL",
   "cost": "(pow (+ level 2) 2.6)",
   "stats": {
    "stat": "(* level 3)"
   },
   "short": "Разброс добычи",
   "ru": "+{stat} Mining Spread (ломает соседние блоки).",
   "ability": false
  },
  "quick_forge": {
   "name": "Quick Forge",
   "x": 5,
   "y": 7,
   "max": 20,
   "powder": "MITHRIL",
   "cost": "(pow (+ level 2) 4)",
   "stats": {
    "stat": "(if (lt level 20) (+ 10 (* level 0.5)) 30)"
   },
   "short": "Быстрая Forge",
   "ru": "Forge работает на {stat}% быстрее.",
   "ability": false
  },
  "sky_mall": {
   "name": "Sky Mall",
   "x": 0,
   "y": 6,
   "max": 1,
   "powder": "MITHRIL",
   "cost": "0",
   "stats": {},
   "short": "Ежедневный бафф",
   "ru": "Каждый игровой день случайный бафф на островах добычи: +100 Mining Speed, +50 Mining Fortune, +15% Powder, −20% перезарядки способностей, ×10 шанс Golden/Diamond Goblin или ×5 Titanium.",
   "ability": false
  },
  "old_school": {
   "name": "Old-School",
   "x": 1,
   "y": 6,
   "max": 20,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 4)",
   "stats": {
    "stat": "(* level 5)"
   },
   "short": "Удача по руде",
   "ru": "+{stat} Ore Fortune.",
   "ability": false
  },
  "professional": {
   "name": "Professional",
   "x": 2,
   "y": 6,
   "max": 140,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 2.3)",
   "stats": {
    "stat": "(+ (* level 5) 50)"
   },
   "short": "Скорость по гемам",
   "ru": "+{stat} Mining Speed при добыче гемов.",
   "ability": false
  },
  "mole": {
   "name": "Mole",
   "x": 3,
   "y": 6,
   "max": 200,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 2.2)",
   "stats": {
    "stat": "(+ 50 (/ (* (- level 1) 350) 199))"
   },
   "short": "Разброс по Hard Stone",
   "ru": "+{stat} Mining Spread при добыче Hard Stone.",
   "ability": false
  },
  "gem_lover": {
   "name": "Gem Lover",
   "x": 4,
   "y": 6,
   "max": 20,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 4)",
   "stats": {
    "stat": "(+ (* level 4) 20)"
   },
   "short": "Удача по гемам",
   "ru": "+{stat} Gemstone Fortune.",
   "ability": false
  },
  "seasoned_mineman": {
   "name": "Seasoned Mineman",
   "x": 5,
   "y": 6,
   "max": 100,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 2.3)",
   "stats": {
    "stat": "(round-decimals (+ 5 (* level 0.1)) 1)"
   },
   "short": "Мудрость",
   "ru": "+{stat} Mining Wisdom (больше опыта Mining).",
   "ability": false
  },
  "front_loaded": {
   "name": "Front Loaded",
   "x": 6,
   "y": 6,
   "max": 1,
   "powder": "GEMSTONE",
   "cost": "0",
   "stats": {},
   "short": "Первые гемы дня",
   "ru": "Первые 2 500 гемов за день: ×3 Gemstone Powder, +150 Gemstone Fortune и +250 Mining Speed.",
   "ability": false
  },
  "daily_grind": {
   "name": "Daily Grind",
   "x": 1,
   "y": 5,
   "max": 1,
   "powder": "GLACITE",
   "cost": "0",
   "stats": {
    "stat": "(* (floor hotm) 500)"
   },
   "short": "Задание дня",
   "ru": "Первое задание (commission) за день на каждом острове добычи даёт +{stat} Powder своего острова: Mithril в Dwarven Mines, Gemstone в Crystal Hollows, Glacite в Glacite Tunnels.",
   "ability": false
  },
  "core_of_the_mountain": {
   "name": "Core of the Mountain",
   "x": 3,
   "y": 5,
   "max": 10,
   "powder": "(if (lt level 4) MITHRIL (if (lt level 8) GEMSTONE GLACITE))",
   "cost": "(list.at (list.new 0 50000 100000 200000 300000 400000 600000 750000 1000000 1250000 0) level)",
   "stats": {},
   "short": "Ядро горы",
   "ru": "Центр дерева. Уровни дают: +1 уровень способности кирки, +1 слот Forge, +1 слот заданий, больше базового Powder (Mithril, Gemstone, Glacite), +10% шанс Glacite Mineshaft и всего 4 Token of the Mountain.",
   "ability": false
  },
  "daily_powder": {
   "name": "Daily Powder",
   "x": 5,
   "y": 5,
   "max": 1,
   "powder": "GEMSTONE",
   "cost": "0",
   "stats": {
    "stat": "(* (floor hotm) 500)"
   },
   "short": "Руда дня",
   "ru": "Первая руда за день даёт +{stat} Powder (Mithril, Gemstone или Glacite — по виду руды).",
   "ability": false
  },
  "anomalous_desire": {
   "name": "Tunnel Vision",
   "x": 0,
   "y": 4,
   "max": 1,
   "powder": "GEMSTONE",
   "cost": "0",
   "stats": {
    "stat": "(if (lt potm 2) \"30\" \"40\")",
    "statCooldown": "(if (lt potm 2) \"120\" \"110\")"
   },
   "short": "Способность кирки",
   "ru": "Способность кирки Tunnel Vision: шанс редких событий выше на {stat}% на 30 с (Golden Goblin, Fallen Star, Powder Ghast, черви, Glacite Mineshaft). Перезарядка {statCooldown} с.",
   "ability": true
  },
  "blockhead": {
   "name": "Blockhead",
   "x": 1,
   "y": 4,
   "max": 20,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 4)",
   "stats": {
    "stat": "(* level 5)"
   },
   "short": "Удача по блокам",
   "ru": "+{stat} Block Fortune.",
   "ability": false
  },
  "subterranean_fisher": {
   "name": "Subterranean Fisher",
   "x": 2,
   "y": 4,
   "max": 40,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 3.7)",
   "stats": {
    "statFishingSpeed": "(+ (* level 0.5) 5)",
    "statSeaCreatureChance": "(+ (* level 0.1) 1)"
   },
   "short": "Рыбалка в шахтах",
   "ru": "+{statFishingSpeed} Fishing Speed и +{statSeaCreatureChance} Sea Creature Chance на островах добычи.",
   "ability": false
  },
  "keep_it_cool": {
   "name": "Keep It Cool",
   "x": 3,
   "y": 4,
   "max": 50,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 3.07)",
   "stats": {
    "stat": "(* level 0.4)"
   },
   "short": "Термостойкость",
   "ru": "+{stat} Heat Resistance (жара в Crystal Hollows).",
   "ability": false
  },
  "lonesome_miner": {
   "name": "Lonesome Miner",
   "x": 4,
   "y": 4,
   "max": 45,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 3.07)",
   "stats": {
    "stat": "(+ (* level 0.5) 4.5)"
   },
   "short": "Одиночка",
   "ru": "Сила, крит. шанс, крит. урон, защита и здоровье на островах добычи выше на {stat}%.",
   "ability": false
  },
  "great_explorer": {
   "name": "Great Explorer",
   "x": 5,
   "y": 4,
   "max": 20,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 4)",
   "stats": {
    "statChance": "(+ (* level 4) 16)",
    "statLocks": "(round (+ (/ level 5) 1))"
   },
   "short": "Сундуки",
   "ru": "Шанс найти сундук в Crystal Hollows +{statChance}%, замков на сундуке меньше на {statLocks}.",
   "ability": false
  },
  "maniac_miner": {
   "name": "Maniac Miner",
   "x": 6,
   "y": 4,
   "max": 1,
   "powder": "GEMSTONE",
   "cost": "",
   "stats": {
    "stat": "(if (lt potm 2) \"5\" \"10\")",
    "statDuration": "(if (lt potm 2) \"25\" \"30\")"
   },
   "short": "Способность кирки",
   "ru": "Способность кирки Maniac Miner: +1 Breaking Power и +{stat} Mining Fortune за каждый сломанный блок (до 1000) на {statDuration} с. Каждый блок стоит 20 маны. Перезарядка 120 с.",
   "ability": true
  },
  "powder_buff": {
   "name": "Powder Buff",
   "x": 3,
   "y": 3,
   "max": 50,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 3.2)",
   "stats": {
    "stat": "(id level)"
   },
   "short": "Больше Powder",
   "ru": "+{stat}% Powder из любых источников.",
   "ability": false
  },
  "speedy_mineman": {
   "name": "Speedy Mineman",
   "x": 1,
   "y": 3,
   "max": 50,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 3.2)",
   "stats": {
    "stat": "(* level 40)"
   },
   "short": "Скорость",
   "ru": "+{stat} Mining Speed.",
   "ability": false
  },
  "fortunate_mineman": {
   "name": "Fortunate Mineman",
   "x": 5,
   "y": 3,
   "max": 50,
   "powder": "GEMSTONE",
   "cost": "(pow (+ level 2) 3.2)",
   "stats": {
    "stat": "(* level 3)"
   },
   "short": "Удача",
   "ru": "+{stat} Mining Fortune.",
   "ability": false
  },
  "warm_heart": {
   "name": "Warm Heart",
   "x": 4,
   "y": 2,
   "max": 50,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 3.1)",
   "stats": {
    "stat": "(* level 0.4)"
   },
   "short": "Морозостойкость",
   "ru": "+{stat} Cold Resistance (холод в Glacite Tunnels).",
   "ability": false
  },
  "miners_blessing": {
   "name": "Miner's Blessing",
   "x": 0,
   "y": 2,
   "max": 1,
   "powder": "GLACITE",
   "cost": "0",
   "stats": {},
   "short": "Благословение",
   "ru": "+1 дроп за прохождение Crystal Nucleus.",
   "ability": false
  },
  "no_stone_unturned": {
   "name": "No Stone Unturned",
   "x": 1,
   "y": 2,
   "max": 50,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 3.05)",
   "stats": {
    "stat": "(* level 0.5)"
   },
   "short": "Находки",
   "ru": "Шанс найти Suspicious Scrap в Glacite Mineshaft выше на {stat}%.",
   "ability": false
  },
  "strong_arm": {
   "name": "Strong Arm",
   "x": 2,
   "y": 2,
   "max": 100,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 2.3)",
   "stats": {
    "stat": "(* level 5)"
   },
   "short": "Сильная рука",
   "ru": "+{stat} Mining Speed по Dwarven Metals (Umber, Tungsten, Glacite и др.).",
   "ability": false
  },
  "steady_hand": {
   "name": "Steady Hand",
   "x": 3,
   "y": 2,
   "max": 100,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 2.6)",
   "stats": {
    "stat": "(* level 0.1)"
   },
   "short": "Твёрдая рука",
   "ru": "+{stat} Gemstone Spread в Glacite Mineshafts.",
   "ability": false
  },
  "mineshaft_mayhem": {
   "name": "Mineshaft Mayhem",
   "x": 6,
   "y": 2,
   "max": 1,
   "powder": "GLACITE",
   "cost": "0",
   "stats": {},
   "short": "Бафф Mineshaft",
   "ru": "При входе в Glacite Mineshaft случайный бафф: +5% шанс Suspicious Scrap, +100 Mining Fortune, +200 Mining Speed, +10 Cold Resistance или −25% перезарядки способности.",
   "ability": false
  },
  "surveyor": {
   "name": "Surveyor",
   "x": 5,
   "y": 2,
   "max": 20,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 4)",
   "stats": {
    "stat": "(* level 0.75)"
   },
   "short": "Разведчик",
   "ru": "Шанс найти Glacite Mineshaft в Glacite Tunnels выше на {stat}%.",
   "ability": false
  },
  "metal_head": {
   "name": "Metal Head",
   "x": 1,
   "y": 1,
   "max": 20,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 4)",
   "stats": {
    "stat": "(* level 5)"
   },
   "short": "Удача по металлам",
   "ru": "+{stat} Dwarven Metal Fortune.",
   "ability": false
  },
  "rags_to_riches": {
   "name": "Rags to Riches",
   "x": 3,
   "y": 1,
   "max": 50,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 3.05)",
   "stats": {
    "stat": "(* level 4)"
   },
   "short": "Удача в Mineshaft",
   "ru": "+{stat} Mining Fortune внутри Glacite Mineshaft.",
   "ability": false
  },
  "eager_adventurer": {
   "name": "Eager Adventurer",
   "x": 5,
   "y": 1,
   "max": 100,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 2.3)",
   "stats": {
    "stat": "(* level 4)"
   },
   "short": "Скорость в Mineshaft",
   "ru": "+{stat} Mining Speed внутри Glacite Mineshaft.",
   "ability": false
  },
  "gemstone_infusion": {
   "name": "Gemstone Infusion",
   "x": 0,
   "y": 0,
   "max": 1,
   "powder": "GLACITE",
   "cost": "0",
   "stats": {
    "statDuration": "(if (lt potm 2) \"20\" \"25\")"
   },
   "short": "Способность кирки",
   "ru": "Способность кирки Gemstone Infusion: гемы в слотах кирки работают на 100% сильнее {statDuration} с. Перезарядка 140 с.",
   "ability": true
  },
  "crystalline": {
   "name": "Crystalline",
   "x": 1,
   "y": 0,
   "max": 50,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 3.3)",
   "stats": {
    "stat": "(* level 0.5)"
   },
   "short": "Кристаллы",
   "ru": "Шанс Glacite Mineshaft с Gemstone Crystal выше на {stat}%.",
   "ability": false
  },
  "gifts_from_the_departed": {
   "name": "Gifts from the Departed",
   "x": 2,
   "y": 0,
   "max": 100,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 2.45)",
   "stats": {
    "stat": "(* level 0.2)"
   },
   "short": "Дары мёртвых",
   "ru": "Шанс {stat}% получить лишний предмет с Frozen Corpse.",
   "ability": false
  },
  "mining_master": {
   "name": "Mining Master",
   "x": 3,
   "y": 0,
   "max": 10,
   "powder": "GLACITE",
   "cost": "(pow (+ level 8) 5)",
   "stats": {
    "stat": "(* level 0.1)"
   },
   "short": "Мастер",
   "ru": "+{stat} Pristine (чаще Flawless-гемы).",
   "ability": false
  },
  "dead_mans_chest": {
   "name": "Dead Man's Chest",
   "x": 4,
   "y": 0,
   "max": 50,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 3.2)",
   "stats": {
    "stat": "(* level 0.5)"
   },
   "short": "Лишний труп",
   "ru": "Шанс {stat}% на ещё один Frozen Corpse при входе в Glacite Mineshaft.",
   "ability": false
  },
  "vanguard_seeker": {
   "name": "Vanguard Seeker",
   "x": 5,
   "y": 0,
   "max": 50,
   "powder": "GLACITE",
   "cost": "(pow (+ level 2) 3.1)",
   "stats": {
    "stat": "(* level 1)"
   },
   "short": "Vanguard",
   "ru": "Шанс Glacite Mineshaft с Vanguard Corpse выше на {stat}%.",
   "ability": false
  },
  "sheer_force": {
   "name": "Sheer Force",
   "x": 6,
   "y": 0,
   "max": 1,
   "powder": "GLACITE",
   "cost": "0",
   "stats": {
    "stat": "(if (lt potm 2) \"20\" \"25\")"
   },
   "short": "Способность кирки",
   "ru": "Способность кирки Sheer Force: +200 Mining Spread на 25 с. Перезарядка 120 с.",
   "ability": true
  }
 },
 "hotf": {
  "sweep": {
   "name": "Sweep",
   "x": 3,
   "y": 7,
   "max": 50,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(id level)"
   },
   "short": "Размах",
   "ru": "+{stat} Sweep (сколько брёвен ломается за удар).",
   "ability": false
  },
  "damage_boost": {
   "name": "Damage Boost",
   "x": 1,
   "y": 6,
   "max": 1,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Способность топора",
   "ru": "Способность топора Damage Boost: двойной урон по существам Galatea 10 с. Перезарядка 210 с.",
   "ability": true
  },
  "luck_of_the_forest": {
   "name": "Luck of the Forest",
   "x": 2,
   "y": 6,
   "max": 40,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(round-decimals (* level 0.5) 1)"
   },
   "short": "Удача леса",
   "ru": "Tree Gifts дают на {stat}% больше лута.",
   "ability": false
  },
  "foraging_fortune": {
   "name": "Foraging Fortune",
   "x": 3,
   "y": 6,
   "max": 50,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(* level 3)"
   },
   "short": "Удача рубки",
   "ru": "+{stat} Foraging Fortune.",
   "ability": false
  },
  "collector": {
   "name": "Collector",
   "x": 4,
   "y": 6,
   "max": 50,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(* level 2)"
   },
   "short": "Собиратель",
   "ru": "Шанс {stat}% на двойные ягоды и ресурсы острова.",
   "ability": false
  },
  "axe_toss": {
   "name": "Axe Toss",
   "x": 5,
   "y": 6,
   "max": 1,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Способность топора",
   "ru": "Способность топора Axe Toss: 10 с бросок топора без штрафа к Sweep. Перезарядка 120 с.",
   "ability": true
  },
  "deep_waters": {
   "name": "Deep Waters",
   "x": 1,
   "y": 5,
   "max": 50,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(id level)"
   },
   "short": "Глубина",
   "ru": "+{stat} Pressure Resistance.",
   "ability": false
  },
  "hunters_luck": {
   "name": "Hunters Luck",
   "x": 3,
   "y": 5,
   "max": 50,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(id level)"
   },
   "short": "Удача охотника",
   "ru": "+{stat} Hunter Fortune.",
   "ability": false
  },
  "galateas_might": {
   "name": "Galatea's Might",
   "x": 5,
   "y": 5,
   "max": 50,
   "powder": "FOREST_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(round-decimals (* level 0.5) 1)"
   },
   "short": "Мощь Galatea",
   "ru": "+{stat}% к боевым статам на Galatea.",
   "ability": false
  },
  "lottery": {
   "name": "Lottery",
   "x": 0,
   "y": 4,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Лотерея",
   "ru": "Каждый игровой день случайный бафф: +50 Fig Fortune, +50 Mangrove Fortune, +50 Helix Fortune или +10 Sweep.",
   "ability": false
  },
  "foraging_madness": {
   "name": "Foraging Madness",
   "x": 1,
   "y": 4,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Безумие рубки",
   "ru": "+10 Sweep и +50 Foraging Fortune.",
   "ability": false
  },
  "iron_lungs": {
   "name": "Iron Lungs",
   "x": 2,
   "y": 4,
   "max": 50,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(id level)"
   },
   "short": "Железные лёгкие",
   "ru": "+{stat} Respiration.",
   "ability": false
  },
  "250_gifts": {
   "name": "250 Gifts",
   "x": 3,
   "y": 4,
   "max": 40,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(id level)"
   },
   "short": "250 подарков",
   "ru": "Первые 250 Tree Gifts за день: на {stat}% больше лута и +20 Forest или Desert Whispers.",
   "ability": false
  },
  "daily_wishes": {
   "name": "Daily Wishes",
   "x": 4,
   "y": 4,
   "max": 100,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(* level 200)"
   },
   "short": "Желания дня",
   "ru": "+{stat} Whispers за первый вид брёвен, срубленный на Galatea за день.",
   "ability": false
  },
  "early_bird": {
   "name": "Early Bird",
   "x": 5,
   "y": 4,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Ранняя пташка",
   "ru": "Первые 250 деревьев за день: +20 Sweep и +100 Foraging Fortune.",
   "ability": false
  },
  "precision_cutting": {
   "name": "Precision Cutting",
   "x": 6,
   "y": 4,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Точная рубка",
   "ru": "На ближних деревьях появляется метка: удар по отмеченному бревну даёт +10 Sweep.",
   "ability": false
  },
  "tree_whisperer": {
   "name": "Tree Whisperer",
   "x": 1,
   "y": 3,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Шёпот деревьев",
   "ru": "Tree Gifts с Fig и Mangrove дают +200 Forest Whispers, с Helix — +200 Desert Whispers.",
   "ability": false
  },
  "center_of_the_forest": {
   "name": "Center of the Forest",
   "x": 3,
   "y": 3,
   "max": 5,
   "powder": "(if (lt level 3) FOREST_WHISPERS (if (lt level 5) DESERT_WHISPERS))",
   "cost": "(list.at (list.new 0 50000 100000 200000 300000 0) level)",
   "stats": {
    "statTokens": "(if (= level 5) 2 1)",
    "statXP": "(list.at (list.new 0 25 60 110 175 250) level)"
   },
   "short": "Центр леса",
   "ru": "Центр дерева. Уровни дают Token of the Forest (на 5-м уровне два), SkyBlock XP, +1 уровень способности топора, +5% Sweep, больше Whispers с брёвен и Tree Gifts и Tracking на Tree Gifts.",
   "ability": false
  },
  "free_trial": {
   "name": "Free Trial",
   "x": 5,
   "y": 3,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Пробный билет",
   "ru": "Первый Tree Gift за день содержит Basic Safari Ticket.",
   "ability": false
  },
  "homing_axe": {
   "name": "Homing Axe",
   "x": 0,
   "y": 2,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Самонаводка",
   "ru": "Брошенный топор сам летит к деревьям на Galatea.",
   "ability": false
  },
  "forest_fisher": {
   "name": "Forest Fisher",
   "x": 1,
   "y": 2,
   "max": 40,
   "powder": "DESERT_WHISPERS",
   "cost": "(pow (+ level 2) 3.7)",
   "stats": {
    "statFishingSpeed": "(+ (* level 0.5) 5)",
    "statSeaCreatureChance": "(+ (* level 0.1) 1)"
   },
   "short": "Рыбалка в лесу",
   "ru": "+{statFishingSpeed} Fishing Speed и +{statSeaCreatureChance} Sea Creature Chance на островах Foraging.",
   "ability": false
  },
  "strength_boost": {
   "name": "Strength Boost",
   "x": 2,
   "y": 2,
   "max": 50,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(* level 2)"
   },
   "short": "Сила",
   "ru": "+{stat} Strength на островах Foraging.",
   "ability": false
  },
  "starlyn_supreme": {
   "name": "Starlyn Supreme",
   "x": 3,
   "y": 2,
   "max": 100,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(* level 0.2)"
   },
   "short": "Starlyn",
   "ru": "На {stat}% больше очков в Starlyn Contests.",
   "ability": false
  },
  "speed_boost": {
   "name": "Speed Boost",
   "x": 4,
   "y": 2,
   "max": 50,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(id level)"
   },
   "short": "Скорость",
   "ru": "+{stat} Speed на островах Foraging.",
   "ability": false
  },
  "efficient_forager": {
   "name": "Efficient Forager",
   "x": 5,
   "y": 2,
   "max": 100,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(round-decimals (+ (* level 0.1) 5) 1)"
   },
   "short": "Мудрость",
   "ru": "+{stat} Foraging Wisdom (больше опыта Foraging).",
   "ability": false
  },
  "maniac_slicer": {
   "name": "Maniac Slicer",
   "x": 6,
   "y": 2,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Способность топора",
   "ru": "Способность топора Maniac Slicer: бросок тратит всю ману, +1 Sweep за каждые 100 маны на 20 с. Перезарядка 60 с.",
   "ability": true
  },
  "half_empty": {
   "name": "Half Empty",
   "x": 1,
   "y": 1,
   "max": 25,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "statFortune": "(* level 2)",
    "statSweep": "(id level)"
   },
   "short": "Наполовину пуст",
   "ru": "+{statFortune} Foraging Fortune и +{statSweep} Sweep за каждого игрока на острове с Half Full (до 5).",
   "ability": false
  },
  "ricochet": {
   "name": "Ricochet",
   "x": 3,
   "y": 1,
   "max": 10,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(id level)"
   },
   "short": "Рикошет",
   "ru": "Шанс {stat}%, что брошенный топор отскочит в соседнее дерево.",
   "ability": false
  },
  "half_full": {
   "name": "Half Full",
   "x": 5,
   "y": 1,
   "max": 25,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "statFortune": "(* level 2)",
    "statSweep": "(id level)"
   },
   "short": "Наполовину полон",
   "ru": "+{statFortune} Foraging Fortune и +{statSweep} Sweep за каждого игрока на острове с Half Empty (до 5).",
   "ability": false
  },
  "monster_hunter": {
   "name": "Monster Hunter",
   "x": 0,
   "y": 0,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Охотник",
   "ru": "Охота на Critter даёт +25 Forest Whispers в Moonglade Marsh или +25 Desert Whispers в Torrhus Canyon.",
   "ability": false
  },
  "forest_speed": {
   "name": "Forest Speed",
   "x": 1,
   "y": 0,
   "max": 50,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(round-decimals (* level 0.2) 1)"
   },
   "short": "Скорость в удачу",
   "ru": "{stat}% твоей Speed идёт в Foraging Fortune и Sweep (до 500 Speed).",
   "ability": false
  },
  "essence_fortune": {
   "name": "Essence Fortune",
   "x": 2,
   "y": 0,
   "max": 50,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(round-decimals (* level 0.5) 1)"
   },
   "short": "Essence",
   "ru": "Шанс {stat}% удвоить Forest Essence.",
   "ability": false
  },
  "timber": {
   "name": "Timber",
   "x": 3,
   "y": 0,
   "max": 10,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(* level 0.1)"
   },
   "short": "Timber",
   "ru": "+{stat} Timber.",
   "ability": false
  },
  "two_for_one": {
   "name": "Two For One",
   "x": 4,
   "y": 0,
   "max": 100,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(* level 0.25)"
   },
   "short": "Два в одном",
   "ru": "Шанс {stat}% срубить всё дерево целиком.",
   "ability": false
  },
  "forest_strength": {
   "name": "Forest Strength",
   "x": 5,
   "y": 0,
   "max": 50,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {
    "stat": "(round-decimals (* level 0.1) 1)"
   },
   "short": "Сила в удачу",
   "ru": "{stat}% твоей Strength идёт в Foraging Fortune и Sweep (до 1 000 Strength).",
   "ability": false
  },
  "beekeeper": {
   "name": "Beekeeper",
   "x": 6,
   "y": 0,
   "max": 1,
   "powder": "DESERT_WHISPERS",
   "cost": "",
   "stats": {},
   "short": "Пчеловод",
   "ru": "Ульи наполняются на 20% быстрее, деревья с Honeycomb на 20% быстрее приманивают Critter и с шансом 25% второго, вдвое больше Honeycomb.",
   "ability": false
  }
 }
};
