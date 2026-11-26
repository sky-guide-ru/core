// Поиск предметов по-русски и по-английски, в том числе транслитом и жаргоном:
// «гиперион» → Hyperion, «терминатор»/«терма» → Terminator, «аоте» → Aspect of the End,
// «зачарованный алмаз» → Enchanted Diamond, «меч» → все мечи.

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

/** Кириллица → латиница (простая транслитерация) */
export function translit(s) {
  return String(s).toLowerCase().replace(/[а-яё]/g, ch => CYR[ch] ?? ch);
}

/**
 * Фонетический «скелет» латинской строки: согласные нормализованы, гласные схлопнуты.
 * Нужен, чтобы «giperion» (из «гиперион») совпал с «hyperion».
 */
export function skeleton(s) {
  let t = translit(s).replace(/[^a-z0-9 ]/g, '');
  t = t.replace(/ow\b/g, 'o')
    .replace(/dzh|zh|j/g, 'J').replace(/sch|sh/g, 'S').replace(/ch|tch/g, 'C').replace(/th/g, 'z').replace(/ph/g, 'f')
    .replace(/kh|ck/g, 'k').replace(/qu/g, 'kv').replace(/x/g, 'ks').replace(/ts|tz/g, 'c')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/w/g, 'v').replace(/h/g, 'g');
  t = t.replace(/[aeiouy]+/g, '*').replace(/(.)\1+/g, '$1');
  return t;
}

function trigrams(s) {
  const t = `  ${s} `;
  const out = new Set();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}
function similarity(a, b) {
  const A = trigrams(a), B = trigrams(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return (2 * n) / (A.size + B.size);
}

// Сеты брони: «sa» → все четыре части Shadow Assassin (части, которых нет в базе, пропускаются)
const SET = base => ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(p => `${base}_${p}`);

/**
 * Жаргон и сокращения игроков → ID (или список ID по убыванию важности).
 * Ключи латиницей автоматически работают и в русской раскладке («фщеу» → aote) и транслитом («аотд» → aotd).
 */
export const ALIASES = {
  // Аспекты и топоры
  aotd: 'ASPECT_OF_THE_DRAGON', аотд: 'ASPECT_OF_THE_DRAGON', aote: 'ASPECT_OF_THE_END', аоте: 'ASPECT_OF_THE_END',
  aotv: 'ASPECT_OF_THE_VOID', аотв: 'ASPECT_OF_THE_VOID', aots: 'AXE_OF_THE_SHREDDED', аотс: 'AXE_OF_THE_SHREDDED',
  aotj: 'ASPECT_OF_THE_JERRY', aotl: 'ASPECT_OF_THE_LEECH_1', aspect: ['ASPECT_OF_THE_END', 'ASPECT_OF_THE_VOID', 'ASPECT_OF_THE_DRAGON'],
  // Данж-оружие
  hype: 'HYPERION', hyp: 'HYPERION', hyperion: 'HYPERION', гипа: 'HYPERION', гипер: 'HYPERION', хипа: 'HYPERION', хайп: 'HYPERION',
  гиперион: 'HYPERION', хайпа: 'HYPERION', valk: 'VALKYRIE', валька: 'VALKYRIE', валя: 'VALKYRIE', валк: 'VALKYRIE',
  сцилла: 'SCYLLA', астрея: 'ASTRAEA', term: 'TERMINATOR', терм: 'TERMINATOR', терма: 'TERMINATOR', термик: 'TERMINATOR',
  juju: 'JUJU_SHORTBOW', джуджу: 'JUJU_SHORTBOW', жужу: 'JUJU_SHORTBOW', gs: 'GIANTS_SWORD', гс: 'GIANTS_SWORD',
  гигант: 'GIANTS_SWORD', гиант: 'GIANTS_SWORD', ld: 'LIVID_DAGGER', лд: 'LIVID_DAGGER', лив: 'LIVID_DAGGER', ливид: 'LIVID_DAGGER',
  sf: 'SHADOW_FURY', шф: 'SHADOW_FURY', fot: 'FLOWER_OF_TRUTH', фот: 'FLOWER_OF_TRUTH', flower: 'FLOWER_OF_TRUTH',
  bonzo: ['BONZO_STAFF', 'BONZO_MASK'], бонзо: ['BONZO_STAFF', 'BONZO_MASK'], ss: 'BAT_WAND', спирит: 'BAT_WAND',
  'spirit sceptre': 'BAT_WAND', 'spirit scepter': 'BAT_WAND', сцептр: 'BAT_WAND', клеймор: 'DARK_CLAYMORE', claymore: 'DARK_CLAYMORE',
  rag: 'RAGNAROCK_AXE', ragaxe: 'RAGNAROCK_AXE', рагна: 'RAGNAROCK_AXE', рагнарок: 'RAGNAROCK_AXE', ebow: 'EXPLOSIVE_BOW', эбоу: 'EXPLOSIVE_BOW',
  bone: 'BONE_BOOMERANG', бумеранг: 'BONE_BOOMERANG', soulwhip: 'SOUL_WHIP', whip: 'SOUL_WHIP', кнут: 'SOUL_WHIP',
  // Слееры, Kuudra, Крымсон
  vorpal: 'VORPAL_KATANA', ворпал: 'VORPAL_KATANA', atomsplit: 'ATOMSPLIT_KATANA', атомсплит: 'ATOMSPLIT_KATANA',
  voidedge: 'VOIDEDGE_KATANA', войдедж: 'VOIDEDGE_KATANA', катана: ['VORPAL_KATANA', 'ATOMSPLIT_KATANA', 'VOIDEDGE_KATANA'],
  daedalus: 'DAEDALUS_AXE', дедалус: 'DAEDALUS_AXE', reaper: 'REAPER_SCYTHE', жнец: 'REAPER_SCYTHE', lb: 'LAST_BREATH',
  midas: ['MIDAS_SWORD', 'MIDAS_STAFF'], мидас: ['MIDAS_SWORD', 'MIDAS_STAFF'], pigman: 'PIGMAN_SWORD', пигман: 'PIGMAN_SWORD',
  // Броня
  sa: SET('SHADOW_ASSASSIN'), ша: SET('SHADOW_ASSASSIN'), шадоу: SET('SHADOW_ASSASSIN'), sup: SET('SUPERIOR_DRAGON'),
  supe: SET('SUPERIOR_DRAGON'), суп: SET('SUPERIOR_DRAGON'), суперка: SET('SUPERIOR_DRAGON'), супериор: SET('SUPERIOR_DRAGON'),
  fd: SET('FINAL_DESTINATION'), фд: SET('FINAL_DESTINATION'), necron: [...SET('POWER_WITHER'), 'NECRON_HANDLE'],
  некрон: [...SET('POWER_WITHER'), 'NECRON_HANDLE'], 'necron chest': 'POWER_WITHER_CHESTPLATE', storm: SET('WISE_WITHER'),
  шторм: SET('WISE_WITHER'), goldor: SET('TANK_WITHER'), голдор: SET('TANK_WITHER'), maxor: SET('SPEED_WITHER'), максор: SET('SPEED_WITHER'),
  divan: [...SET('DIVAN'), 'DIVAN_DRILL'], диван: [...SET('DIVAN'), 'DIVAN_DRILL'], sorrow: SET('SORROW'),
  // Утилиты, свитки, книги
  некронка: 'NECRON_HANDLE', recomb: 'RECOMBOBULATOR_3000', рекомб: 'RECOMBOBULATOR_3000', рекомбобулятор: 'RECOMBOBULATOR_3000',
  hpb: 'HOT_POTATO_BOOK', хпб: 'HOT_POTATO_BOOK', fpb: 'FUMING_POTATO_BOOK', фпб: 'FUMING_POTATO_BOOK', фумин: 'FUMING_POTATO_BOOK',
  'хот потато': 'HOT_POTATO_BOOK', cookie: 'BOOSTER_COOKIE', booster: 'BOOSTER_COOKIE', кукки: 'BOOSTER_COOKIE', куки: 'BOOSTER_COOKIE', кукис: 'BOOSTER_COOKIE', кукиз: 'BOOSTER_COOKIE',
  печенька: 'BOOSTER_COOKIE', печеньки: 'BOOSTER_COOKIE', 'печенье бустер': 'BOOSTER_COOKIE', бустер: 'BOOSTER_COOKIE',
  godpot: 'GOD_POTION_2', годпот: 'GOD_POTION_2', 'год пот': 'GOD_POTION_2', грапл: 'GRAPPLING_HOOK', крюк: 'GRAPPLING_HOOK',
  grapple: 'GRAPPLING_HOOK', treecap: 'TREECAPITATOR_AXE', трикап: 'TREECAPITATOR_AXE', батфон: 'AATROX_BATPHONE',
  batphone: 'AATROX_BATPHONE', icespray: 'ICE_SPRAY_WAND', jcg: 'JERRY_STAFF', 'jerry gun': 'JERRY_STAFF',
  // Орбы и питомцы
  flux: ['PLASMAFLUX_POWER_ORB', 'OVERFLUX_POWER_ORB', 'MANA_FLUX_POWER_ORB'], флакс: ['PLASMAFLUX_POWER_ORB', 'OVERFLUX_POWER_ORB', 'MANA_FLUX_POWER_ORB'],
  plasma: 'PLASMAFLUX_POWER_ORB', плазма: 'PLASMAFLUX_POWER_ORB', overflux: 'OVERFLUX_POWER_ORB', оверфлакс: 'OVERFLUX_POWER_ORB',
  gdrag: 'GOLDEN_DRAGON;4', гдраг: 'GOLDEN_DRAGON;4', гдрак: 'GOLDEN_DRAGON;4', 'голд дракон': 'GOLDEN_DRAGON;4',
  edrag: 'ENDER_DRAGON;4', драгон: 'ENDER_DRAGON;4', эдраг: 'ENDER_DRAGON;4',
  // Английский жаргон (для /en/ и для тех, кто пишет латиницей)
  gyro: 'GYROKINETIC_WAND', гиро: 'GYROKINETIC_WAND', sceptre: 'BAT_WAND', mosq: 'MOSQUITO_BOW',
  sos: 'SOS_FLARE', flare: ['SOS_FLARE', 'ALERT_FLARE', 'WARNING_FLARE'], tuba: ['WEIRDER_TUBA', 'WEIRD_TUBA'],
  woa: 'WAND_OF_ATONEMENT', wor: 'WAND_OF_RESTORATION', wom: 'WAND_OF_MENDING', gloomlock: 'GLOOMLOCK_GRIMOIRE',
  'math hoe': ['THEORETICAL_HOE_WHEAT_3', 'THEORETICAL_HOE_WHEAT_1'], dicer: ['MELON_DICER', 'PUMPKIN_DICER'],
  wcloak: 'WITHER_CLOAK', 'wither cloak': 'WITHER_CLOAK', sfury: 'SHADOW_FURY', hurri: 'HURRICANE_BOW', runaan: 'RUNAANS_BOW',
  deletor: 'PERSONAL_DELETOR_7000', compactor: 'PERSONAL_COMPACTOR_7000', supercell: 'SOULFLOW_SUPERCELL',
};
// Однословные ключи жаргона на кириллице — для поиска по падежам («печеньку» → печенька)
const ALIAS_WORDS = Object.keys(ALIASES).filter(k => /^[а-яё]+$/.test(k));

/** Русские слова → категория / тип предмета */
const KIND_WORDS = [
  [/^(меч|мечи|мечей)$/, { type: 'SWORD' }], [/^(лук|луки|луков)$/, { type: 'BOW' }],
  [/^(посох|посохи|палка|палки)$/, { type: 'WAND' }], [/^(шлем|шлемы)$/, { type: 'HELMET' }],
  [/^(нагрудник|нагрудники|кираса)$/, { type: 'CHESTPLATE' }], [/^(поножи|штаны)$/, { type: 'LEGGINGS' }],
  [/^(ботинки|сапоги|ботики)$/, { type: 'BOOTS' }], [/^(броня|сет|сеты|армор)$/, { category: 'armor' }],
  [/^(оружие|пушка)$/, { category: 'weapon' }], [/^(аксессуар|аксессуары|талисман|талисманы|талик|талики|акса|аксы|артефакт|артефакты|кольцо|кольца)$/, { category: 'accessory' }],
  [/^(питомец|питомцы|пет|петы|пэт)$/, { category: 'pet' }], [/^(миньон|миньоны|минион|минионы)$/, { category: 'minion' }],
  [/^(книга|книги|зачарование|зачарования|энчант|энчанты|чары)$/, { category: 'enchant_book' }],
  [/^(камень|камни|реф|рефорж|перековка)$/, { category: 'reforge_stone' }], [/^(самоцвет|самоцветы|гем|гемы|джем)$/, { category: 'gemstone' }],
  [/^(кирка|кирки)$/, { type: 'PICKAXE' }], [/^(бур|дрель|дрилл)$/, { type: 'DRILL' }], [/^(топор|топоры)$/, { type: 'AXE' }],
  [/^(мотыга|мотыги|хоу)$/, { type: 'HOE' }], [/^(удочка|удочки)$/, { type: 'FISHING ROD' }],
  [/^(ожерелье|ожерелья)$/, { type: 'NECKLACE' }], [/^(плащ|плащи)$/, { type: 'CLOAK' }], [/^(пояс|пояса)$/, { type: 'BELT' }],
  [/^(перчатки|перчатка)$/, { type: 'GLOVES' }], [/^(браслет|браслеты)$/, { type: 'BRACELET' }], [/^(мешок|мешки)$/, { category: 'sack' }],
  [/^(нпс|npc|торговец)$/, { category: 'npc' }], [/^(моб|мобы|босс|боссы)$/, { category: 'mob' }],
];

/** Русские слова, часто встречающиеся в английских названиях → английское слово */
export const WORDS_RU_EN = {
  дракон: 'dragon', драконий: 'dragon', золотой: 'golden', визер: 'wither', иссушитель: 'wither', тень: 'shadow', теневой: 'shadow',
  паук: 'spider', паучий: 'spider', волк: 'wolf', зомби: 'zombie', скелет: 'skeleton', эндер: 'ender', энд: 'end', кольцо: 'ring',
  талисман: 'talisman', талик: 'talisman', артефакт: 'artifact', реликвия: 'relic', крит: 'crit', скорость: 'speed', сила: 'strength',
  здоровье: 'health', защита: 'defense', интеллект: 'intelligence', огонь: 'fire', огненный: 'fire', лава: 'lava',
  лёд: 'ice', лед: 'ice', ледяной: 'frozen', кристалл: 'crystal', ядро: 'core', сердце: 'heart', глаз: 'eye', око: 'eye',
  кровь: 'blood', кость: 'bone', душа: 'soul', звезда: 'star', мастер: 'master', шлем: 'helmet', ботинки: 'boots',
  нагрудник: 'chestplate', поножи: 'leggings', меч: 'sword', лук: 'bow', кирка: 'pickaxe', топор: 'axe', удочка: 'rod',
  мешок: 'sack', книга: 'book', зелье: 'potion', печенье: 'cookie', кукуруза: 'corn', тыква: 'pumpkin', арбуз: 'melon',
  гоблин: 'goblin', гном: 'dwarven', слизь: 'slime', магма: 'magma', блейз: 'blaze', вампир: 'vampire', ведьма: 'witch',
  призрак: 'ghost', некромант: 'necromancer', титан: 'titanium', титановый: 'titanium', мифрил: 'mithril', самоцвет: 'gemstone',
  рыба: 'fish', рыбка: 'fish', рыбный: 'fish', рыбалка: 'fishing', рыбак: 'fishing', рыболовный: 'fishing', ферма: 'farm', фермер: 'farmer',
  фермерский: 'farmer', шахта: 'mine', шахтёр: 'miner', шахтер: 'miner', охота: 'hunting', охотник: 'hunter',
  миньон: 'minion', хранилище: 'storage', рюкзак: 'backpack', компас: 'compass', свиток: 'scroll', руна: 'rune',
  // английские сокращения игроков
  ench: 'enchanted', enchant: 'enchanted', pet: '', helm: 'helmet', chest: 'chestplate', legs: 'leggings', pick: 'pickaxe',
  tali: 'talisman', arti: 'artifact', drag: 'dragon', neck: 'necklace', bp: 'backpack',
};

// Падежи и множественное число: «кости» → кость, «волка» → волк, «звезды» → звезда
const RU_ENDINGS = ['ьего', 'ьему', 'ьими', 'ьей', 'ьих', 'ьи', 'ья', 'ье', 'ью', 'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ов', 'ев', 'ей', 'ой', 'ий', 'ый', 'ая', 'яя', 'ые', 'ие', 'ую', 'юю', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'и', 'ы', 'а', 'я', 'е', 'у', 'ю', 'о'];
export function ruToEn(w) {
  if (w in WORDS_RU_EN) return WORDS_RU_EN[w];
  if (!/[а-яё]/.test(w) || w.length < 4) return w;
  for (const end of RU_ENDINGS) {
    if (!w.endsWith(end) || w.length - end.length < 3) continue;
    const stem = w.slice(0, -end.length);
    for (const c of [stem, stem + 'ь', stem + 'а', stem + 'о', stem + 'ий', stem + 'ый', stem + 'ой']) if (c in WORDS_RU_EN) return WORDS_RU_EN[c];
  }
  return w;
}


// Раскладка: набрал по-русски, имея в виду латиницу («фщеу» → aote), и наоборот («ubgf» → гипа)
const RU_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбю';
const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU2EN = Object.fromEntries([...RU_KEYS].map((c, i) => [c, EN_KEYS[i]]));
const EN2RU = Object.fromEntries([...EN_KEYS].map((c, i) => [c, RU_KEYS[i]]));
/** Перевод строки, набранной не в той раскладке. Возвращает null, если менять нечего. */
export function swapLayout(s) {
  const t = String(s).toLowerCase();
  const cyr = (t.match(/[а-яё]/g) || []).length, lat = (t.match(/[a-z]/g) || []).length;
  // ж, э, х, ъ, б, ю дают знаки препинания — значит, это настоящее русское слово, не латиница
  if (cyr && !lat) { const r = [...t].map(c => RU2EN[c === 'ё' ? 'е' : c] ?? c).join(''); return /[[\];',.]/.test(r) ? null : r; }
  if (lat && !cyr) return [...t].map(c => EN2RU[c] ?? c).join('');
  return null;
}

const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
/** «sharpness 6» → «sharpness vi», «revenant t5» → «revenant v», «миньон пшеницы лвл 11» → «… xi». null — цифр нет */
export function withRoman(q) {
  let hit = false;
  const out = String(q).replace(/(^|\s)(?:(?:t|т|tier|тир|лвл|lvl|ур|уровень|level)\s*)?(\d{1,2})(?=\s|$)/gi, (m, sp, n) => {
    const r = ROMAN[Number(n)];
    if (!r) return m;
    hit = true;
    return sp + r;
  });
  return hit && out !== q ? out : null;
}

/** Аббревиатура названия: «Aspect of the Dragons» → aotd, «Giant's Sword» → gs */
export function acronym(name) {
  const words = String(name).toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.some(w => /^[ivx]+$/.test(w) && w !== words[0])) return '';
  return words.map(w => w[0]).join('');
}

const RARITY_RANK = { COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5, MYTHIC: 6, DIVINE: 7, SPECIAL: 3, 'VERY SPECIAL': 4 };
const CATEGORY_WEIGHT = { npc: -25, mob: -20, cosmetic: -10, shard: -5, rune: -5, minion: -3 };

/**
 * Строит индекс поиска.
 * @param {Record<string, import('./build-db.js').ItemRu>} items
 */
export function createSearch(items) {
  const rows = Object.values(items).map(it => {
    const en = it.nameEn.toLowerCase();
    const ru = it.nameRu.toLowerCase();
    return { it, en, ru, id: it.id.toLowerCase(), skEn: skeleton(en), skRu: skeleton(ru), acr: acronym(it.nameEn) };
  });
  const byId = new Map(rows.map(r => [r.it.id, r]));
  // Аббревиатуры названий (3+ буквы, 2-буквенные — только из ручного списка: их слишком много совпадает)
  const byAcr = new Map();
  for (const r of rows) if (r.acr.length >= 3) (byAcr.get(r.acr) || byAcr.set(r.acr, []).get(r.acr)).push(r);
  const norm = x => String(x || '').toLowerCase().trim().replace(/[’`]/g, "'").replace(/\s+/g, ' ');

  /** Ручные сокращения и аббревиатуры для одного варианта запроса → Map(row → очки) */
  function shortcutHits(q) {
    const hits = new Map();
    for (const v of new Set([q, q.replace(/'/g, ''), translit(q)])) {
      const ids = ALIASES[v];
      if (ids) [].concat(ids).forEach((id, i) => { const r = byId.get(id); if (r && !hits.has(r)) hits.set(r, 130 - i); });
      if (v.length >= 3 && !v.includes(' ')) for (const r of byAcr.get(v) || []) if (!hits.has(r)) hits.set(r, 104 + (RARITY_RANK[r.it.rarity] || 0));
    }
    // Падежи жаргона: «печеньку», «рекомбом», «гиперионом» — ищем ключ с той же основой
    if (!hits.size && /^[а-яё]{5,}$/.test(q)) {
      const stem = q.replace(/(ами|ями|ом|ем|ой|ей|ою|ую|ям|ам|ах|ях|у|ю|е|и|ы|а|я)$/, '');
      if (stem.length >= 4) {
        for (const k of ALIAS_WORDS) {
          if (!k.startsWith(stem) || k.length - stem.length > 2) continue;
          [].concat(ALIASES[k]).forEach((id, i) => { const r = byId.get(id); if (r && !hits.has(r)) hits.set(r, 120 - i); });
        }
      }
    }
    return hits;
  }

  /** Очки всех предметов для одного варианта запроса */
  function scoreVariant(query, opt, { strictOnly = false } = {}) {
    let q = norm(query);
    const filter = { category: opt.category, type: opt.type };
    // слова-типы: «меч», «аксессуары» → фильтр, сами слова из запроса убираем
    const words = q.split(' ');
    const rest = [];
    const kindEn = []; // «кольцо волка» — фильтр «аксессуар», но Wolf Ring должен быть выше Wolf Paw
    for (const w of words) {
      const k = KIND_WORDS.find(([re]) => re.test(w));
      // и одно слово-тип («кольцо», «талисман»): среди всех аксессуаров выше те, где это слово в названии (Ring, Talisman)
      if (k) { const en = ruToEn(w); if (en && en !== w) kindEn.push(en); }
      if (k) Object.assign(filter, k[1]);
      else rest.push(w);
    }
    // если вся фраза — сокращение («necron chest»), ищем её целиком, без фильтров по словам
    const whole = shortcutHits(q);
    if (whole.size) { q = norm(query); rest.length = 0; rest.push(...q.split(' ')); filter.category = opt.category; filter.type = opt.type; kindEn.length = 0; }
    else q = rest.join(' ');
    const hits = whole.size ? whole : shortcutHits(q);
    // «питомец дракон» → дополнительно ищем по английскому слову «dragon»
    const enQ = rest.map(ruToEn).filter(Boolean).join(' ');
    // Нашлось сокращение — нечёткие совпадения по «скелету» только мешают («аотд» ≠ «Отдача»).
    // Русское слово из словаря («рыбалка» → fishing) — тоже: это не английское название русскими буквами,
    // а по звучанию «рыб» похоже на Rabbit, и вместо удочек выпадали шесть питомцев Rabbit
    const known = rest.some(w => /[а-яё]/.test(w) && ruToEn(w) !== w);
    const fuzzy = !strictOnly && !hits.size && !known;
    const skQ = q ? skeleton(q) : '';
    const latQ = translit(q);
    const out = new Map();
    for (const r of rows) {
      if (filter.category && r.it.category !== filter.category) continue;
      if (filter.type && r.it.type !== filter.type && !(filter.type === 'BOW' && r.it.type === 'SHORTBOW')) continue;
      let s = 0;
      if (!q) s = 10 + (RARITY_RANK[r.it.rarity] || 0) * 2;
      else if (r.id === q.replace(/ /g, '_') || r.en === q || r.ru === q) s = 100;
      else if (r.en.startsWith(q) || r.ru.startsWith(q)) s = 80;
      else if (r.en.includes(q) || r.ru.includes(q) || r.id.includes(q.replace(/ /g, '_'))) s = 65;
      else if (enQ && (enQ !== q || enQ.includes(' ')) && (r.en.includes(enQ) || enQ.split(' ').every(w => r.en.includes(w)))) s = 62;
      else if (latQ !== q && r.en === latQ) s = 90; // «терминатор» → Terminator
      else if (latQ !== q && r.en.includes(latQ)) s = 60;
      else if (fuzzy && skQ.length >= 3 && [r.skEn, r.skRu].some(x => (' ' + x).includes(' ' + skQ))) s = 55 - Math.min(15, Math.abs(r.skEn.length - skQ.length));
      else if (fuzzy && q.length >= 4) {
        const sim = Math.max(similarity(skQ, r.skEn), similarity(skQ, r.skRu), similarity(q, r.ru));
        if (sim >= 0.45) s = Math.round(sim * 50);
      }
      if (hits.has(r)) s = Math.max(s, hits.get(r));
      if (!s) continue;
      if (kindEn.some(w => r.en.includes(w))) s += q ? 6 : 20;
      s += CATEGORY_WEIGHT[r.it.category] || 0;
      s -= Math.min(10, r.en.length / 8);
      if (r.it.petTier != null) s += r.it.petTier; // для питомцев выше старшие редкости
      out.set(r.it.id, [s, r.it]);
    }
    return out;
  }

  /**
   * @param {string} query
   * @param {{ limit?: number, category?: string, type?: string, scores?: boolean }} [opt]
   * @returns {import('./build-db.js').ItemRu[]}
   */
  return function searchItems(query, opt = {}) {
    const limit = opt.limit ?? 20;
    const q = norm(query);
    if (!q) return [];
    // Не та раскладка: «фщеу» → aote, «рнзукшщт» → hyperion. Берём только точные совпадения, чуть ниже оригинала.
    // Только если исходная строка сама ничего толком не нашла и не содержит русских слов-типов («лук» ≠ «ker»).
    let best = scoreVariant(q, opt);
    const swapped = swapLayout(q);
    const strongOrig = [...best.values()].some(([s]) => s >= 60);
    const hasKind = q.split(' ').some(w => KIND_WORDS.some(([re]) => re.test(w)));
    // исходная строка вообще ничего толком не нашла («nthvbyfnjh» = «терминатор») — в другой раскладке берём
    // и транслит/жаргон (60+), а не только точные названия
    const weakOrig = ![...best.values()].some(([s]) => s >= 40);
    const alt = swapped && swapped !== q && !strongOrig && !hasKind
      ? [...scoreVariant(swapped, opt, { strictOnly: !weakOrig })].filter(([, [s]]) => s >= (weakOrig ? 58 : 72)) : [];
    // в другой раскладке нашлось точное название или сокращение — нечёткий мусор по исходной строке не нужен
    if (alt.some(([, [s]]) => s >= 90)) best = scoreVariant(q, opt, { strictOnly: true });
    for (const [id, [s, it]] of alt) {
      const cur = best.get(id);
      if (!cur || cur[0] < s - 2) best.set(id, [s - 2, it]);
    }
    // Цифры уровней: в названиях римские (Sharpness VI, Wheat Minion XI, Ultimate Wise V), а пишут «sharpness 6»,
    // «ult wise 5», «t5», «лвл 11» — ищем ещё и вариант с римскими, его совпадения чуть выше
    const roman = withRoman(q);
    if (roman) {
      for (const [id, [s, it]] of scoreVariant(roman, opt)) {
        const cur = best.get(id);
        if (!cur || cur[0] < s + 3) best.set(id, [s + 3, it]);
      }
    }
    const scored = [...best.values()];
    scored.sort((a, b) => b[0] - a[0] || a[1].nameEn.length - b[1].nameEn.length);
    // opt.scores — вместе с очками: поиску в шапке надо знать, совпало ли название по-настоящему (≥ 60) или только похоже
    if (opt.scores) return scored.slice(0, limit).map(([sc, it]) => ({ ...it, score: Math.round(sc) }));
    return scored.slice(0, limit).map(x => x[1]);
  };
}
