// Сборки (варианты прокачки) деревьев HotM и HotF. perks — что взять; order — в каком порядке докачивать
// (первые — самые важные); optional — можно держать, если хватает токенов; targets — до какого уровня качать
// (по умолчанию до максимума); light — взять за токен, уровни по остатку ресурса.
// Сверено 23.11.2026: SkyKings (Mining Guide, Heart of the Forest), wiki.scd.wtf, форум hypixel.net.
// Основа любой сборки HotM: скорость, удача, Powder и бонусы, которые нужны всегда
// (SkyKings Mining Guide, ноябрь 2026: «Mining Speed и Mining Fortune первыми», Great Explorer до максимума,
// Front Loaded «всегда»; wiki.scd.wtf, октябрь 2026: Great Explorer, Powder Buff, Mole, Efficient Miner).
const HOTM_BASE = ['mining_speed', 'mining_fortune', 'quick_forge', 'core_of_the_mountain', 'professional', 'mole', 'great_explorer',
  'powder_buff', 'speedy_mineman', 'fortunate_mineman', 'efficient_miner', 'daily_powder', 'front_loaded'];

export const BUILDS = {
  hotm: [
    {
      id: 'gems', title: 'Гемы',
      desc: 'Копаешь гемы ради денег и Gemstone Powder.',
      pros: ['Самый стабильный доход добычей', 'Много Gemstone Powder', 'Подходит к Divan’s Drill и броне Divan'],
      cons: ['Мало Glacite Powder', 'Трупы в Mineshafts дают меньше'],
      // способность: Sheer Force (SkyKings: Hard Stone, гемы, Mineshafts) — Pickobulus на ранних уровнях
      perks: [...HOTM_BASE, 'gem_lover', 'sky_mall', 'sheer_force'],
      order: ['mining_speed', 'mining_fortune', 'great_explorer', 'powder_buff', 'professional', 'fortunate_mineman', 'speedy_mineman', 'gem_lover', 'mole', 'efficient_miner', 'quick_forge', 'core_of_the_mountain'],
      optional: ['mining_master', 'old_school', 'blockhead', 'seasoned_mineman', 'lonesome_miner', 'keep_it_cool', 'subterranean_fisher', 'gemstone_infusion', 'pickobulus', 'steady_hand'],
      targets: { mole: 70 },   // SkyKings 2026: «около 70 уровня хватает»
    },
    {
      id: 'glacite', title: 'Glacite и Mineshafts',
      desc: 'Копаешь металлы в Glacite Tunnels и ищешь Mineshaft с трупами.',
      pros: ['Много Glacite Powder', 'Больше трупов и лута в Mineshaft', 'Морозостойкость для долгих заходов'],
      cons: ['Гемы фармятся медленнее', 'Доход зависит от удачи на Mineshaft'],
      perks: [...HOTM_BASE, 'surveyor', 'metal_head', 'strong_arm', 'warm_heart', 'dead_mans_chest', 'vanguard_seeker', 'gifts_from_the_departed', 'rags_to_riches', 'eager_adventurer', 'sheer_force'],
      order: ['mining_speed', 'mining_fortune', 'surveyor', 'metal_head', 'great_explorer', 'powder_buff', 'professional', 'fortunate_mineman', 'speedy_mineman', 'mole', 'efficient_miner', 'quick_forge', 'core_of_the_mountain'],
      optional: ['mineshaft_mayhem', 'no_stone_unturned', 'steady_hand', 'keep_it_cool', 'daily_grind', 'sky_mall', 'mining_master', 'gem_lover', 'seasoned_mineman', 'lonesome_miner'],
      targets: { mole: 70 },
      // точных уровней для перков трупов и шахт источники не дают: берём за токен, качаем остатком Glacite Powder
      light: ['strong_arm', 'warm_heart', 'dead_mans_chest', 'vanguard_seeker', 'gifts_from_the_departed', 'rags_to_riches', 'eager_adventurer'],
    },
    {
      id: 'mithril', title: 'Mithril и Titanium',
      desc: 'Копаешь Mithril в Dwarven Mines ради Titanium и Mithril Powder.',
      pros: ['Больше Titanium и Mithril на продажу', 'Sky Mall иногда даёт ×5 Titanium на день', 'Много Mithril Powder', 'Golden Goblin и Fallen Star чаще'],
      cons: ['Мало Gemstone и Glacite Powder', 'Перки гемов и Crystal Hollows не работают'],
      // Mithril и Titanium — Dwarven Metals (NEU: type DWARVEN METAL), поэтому Strong Arm (Mining Speed по металлам)
      // и Metal Head (Dwarven Metal Fortune) — главные перки сверху дерева; Titanium Insanium — шанс Titanium.
      // Способность: Mining Speed Boost (SkyKings, ноябрь 2026: «почти для всего»). Sheer Force (+200 Mining Spread,
      // Spread работает и на Dwarven Metals — вики) и Pickobulus — по желанию.
      // Sky Mall: один из баффов — ×5 Titanium на игровой день (вики, Titanium: «extremely profitable»), через Old School.
      // Гемовые перки (Professional, Gem Lover, Mole, Front Loaded, Great Explorer) и Mineshaft-перки на Mithril не действуют.
      perks: ['mining_speed', 'mining_fortune', 'titanium_insanium', 'mining_speed_boost', 'precision_mining', 'efficient_miner',
        'luck_of_the_cave', 'sky_mall', 'quick_forge', 'core_of_the_mountain', 'powder_buff', 'speedy_mineman', 'fortunate_mineman', 'strong_arm', 'metal_head'],
      order: ['mining_speed', 'mining_fortune', 'titanium_insanium', 'metal_head', 'strong_arm', 'efficient_miner', 'speedy_mineman',
        'fortunate_mineman', 'powder_buff', 'precision_mining', 'mining_speed_boost', 'luck_of_the_cave', 'sky_mall', 'quick_forge', 'core_of_the_mountain'],
      optional: ['sheer_force', 'pickobulus', 'daily_powder', 'daily_grind', 'seasoned_mineman'],
    },
    {
      id: 'commissions', title: 'Задания',
      desc: 'Делаешь задания в Dwarven Mines, чтобы быстрее поднять HotM.',
      pros: ['Быстрее всего растёт уровень HotM', 'Mithril Powder и Titanium', 'Golden Goblin и Fallen Star чаще'],
      cons: ['Мало денег в час', 'Почти не нужен после HotM 7'],
      // способность: Pickobulus (SkyKings: «задания, быстрая руда»)
      perks: ['mining_speed', 'mining_fortune', 'titanium_insanium', 'pickobulus', 'efficient_miner', 'quick_forge', 'daily_powder', 'core_of_the_mountain', 'speedy_mineman', 'powder_buff', 'fortunate_mineman', 'luck_of_the_cave'],
      order: ['mining_speed', 'mining_fortune', 'titanium_insanium', 'efficient_miner', 'powder_buff', 'speedy_mineman', 'fortunate_mineman', 'luck_of_the_cave', 'quick_forge', 'core_of_the_mountain'],
      optional: ['sky_mall', 'daily_grind', 'lonesome_miner', 'old_school', 'blockhead', 'seasoned_mineman', 'professional', 'mole', 'great_explorer', 'keep_it_cool', 'warm_heart'],
    },
  ],
  hotf: [
    {
      id: 'logs', title: 'Рубка деревьев',
      desc: 'Рубишь деревья ради брёвен и Whispers.',
      pros: ['Быстрее всего растут Foraging и HotF', 'Больше брёвен на продажу и Whispers на перки'],
      cons: ['Почти ничего не даёт охоте и Starlyn'],
      // SkyKings (октябрь 2026): сначала Sweep и Foraging Fortune, затем Center of the Forest, затем Luck of the Forest
      // и 250 Gifts ради Tree Gifts; способность с HotF 7 — Homing Axe (форум, июль 2026), до неё Axe Toss
      perks: ['sweep', 'foraging_fortune', 'center_of_the_forest', 'luck_of_the_forest', '250_gifts', 'axe_toss', 'homing_axe', 'foraging_madness', 'early_bird', 'daily_wishes', 'precision_cutting', 'tree_whisperer', 'efficient_forager', 'two_for_one', 'timber', 'forest_strength'],
      order: ['sweep', 'foraging_fortune', 'center_of_the_forest', 'luck_of_the_forest', '250_gifts', 'daily_wishes', 'efficient_forager', 'two_for_one', 'timber', 'forest_strength'],
      optional: ['collector', 'lottery', 'forest_speed', 'essence_fortune', 'maniac_slicer', 'ricochet'],
    },
    {
      id: 'hunting', title: 'Охота',
      desc: 'Охотишься и сражаешься на Galatea.',
      pros: ['Больше осколков (shards) с охоты', 'Сильнее в бою на Galatea', 'Whispers за Critter'],
      cons: ['Рубка медленнее'],
      perks: ['sweep', 'hunters_luck', 'galateas_might', 'deep_waters', 'iron_lungs', 'damage_boost', 'center_of_the_forest', 'free_trial', 'strength_boost', 'speed_boost', 'monster_hunter', 'beekeeper'],
      order: ['sweep', 'hunters_luck', 'galateas_might', 'center_of_the_forest', 'deep_waters', 'iron_lungs', 'strength_boost', 'speed_boost'],
      optional: ['foraging_fortune', 'collector'],
    },
    {
      id: 'starlyn', title: 'Контесты Starlyn',
      desc: 'Набираешь очки в контестах Agatha.',
      pros: ['Выше места и награды в Starlyn'],
      cons: ['Узкая сборка: вне контестов слабее рубки'],
      perks: ['sweep', 'foraging_fortune', 'center_of_the_forest', 'foraging_madness', 'early_bird', 'starlyn_supreme', 'maniac_slicer', 'homing_axe', 'ricochet', 'two_for_one'],
      order: ['sweep', 'foraging_fortune', 'center_of_the_forest', 'starlyn_supreme', 'two_for_one', 'ricochet'],
      optional: ['luck_of_the_forest', 'strength_boost', 'forest_strength'],
    },
  ],
};
