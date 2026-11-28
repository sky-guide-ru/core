// Dungeons: загадки (Puzzle Rooms), секреты, счёт S+, Blood Room и The Watcher, блессинги.
// Сверено с fandom-вики 28.11.2026: Catacombs Puzzle Rooms, Dungeon Puzzle Rooms, Dungeon Secrets, Dungeon Score,
// Dungeon Blessing, The Watcher, Mimic, Crypt Undead (Princes), Wither Key, Blood Key, Architect's First Draft.
// Где страницы расходятся (Higher or Lower: «2+» в таблице и «3+» в истории патча 0.20.5), верим истории патчей.
import { num } from './combat/util.js';
import { tx } from '../../i18n/msg.js';

const n = v => Number(v || 0);

/** Доля секретов этажа, которая даёт полные 40 очков Explore (F1–F7; Master Mode — 100%). */
export const SECRET_REQ = { 0: 30, 1: 30, 2: 40, 3: 50, 4: 60, 5: 70, 6: 85, 7: 100 };
/** Минут без штрафа к Speed: обычные этажи и Master Mode. */
export const SPEED_MIN = { 0: 10, 1: 10, 2: 10, 3: 10, 4: 12, 5: 10, 6: 12, 7: 14 };
export const SPEED_MIN_M = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 10, 7: 14 };

/** Буква оценки по счёту (Dungeon Score: S от 269.5, S+ от 300). */
export function rankOf(score) {
  const s = n(score);
  if (!s) return null;
  if (s >= 300) return 'S+';
  if (s >= 269.5) return 'S';
  if (s >= 230) return 'A';
  if (s >= 160) return 'B';
  if (s >= 100) return 'C';
  return 'D';
}

/**
 * Загадки. floor — с какого этажа встречается (0 — на всех), fail — можно ли провалить (−14 очков Skill),
 * secret — секрет в комнате, text — что делать, solve — решение коротко, more — подробности (раскрываются).
 */
export const PUZZLES = [
  {
    id: 'tic_tac_toe', name: 'Tic Tac Toe', floor: 0, fail: true, secret: 1,
    text: 'Сыграй вничью с компьютером. Он всегда ходит первым: на ранних этажах в центр, на поздних — в центр или в угол.',
    solve: ['Компьютер в центре — ставь в любой угол. Компьютер в углу — ставь в центр.', 'Дальше просто закрывай каждую линию, где у него уже два знака.'],
    more: ['Секрет: поднимись по лестнице в глубине комнаты и дёрни рычаг. Стена с листвой слева от доски откроется, за ней сундук.'],
  },
  {
    id: 'three_weirdos', name: 'Three Weirdos', floor: 0, fail: true,
    text: 'Три NPC и три сундука. Каждый что-то говорит про награду, кто-то врёт. Открыть можно только один сундук.',
    solve: ['Кликни по каждому NPC и открой сундук того, кто сказал одну из фраз ниже.'],
    moreTitle: 'Фразы того, у кого награда',
    more: [
      '«The reward is not in my chest!»',
      '«At least one of them is lying, and the reward is not in …\'s chest.»',
      '«My chest doesn\'t have the reward. We are all telling the truth.»',
      '«My chest has the reward and I\'m telling the truth!»',
      '«The reward isn\'t in any of our chests.»',
      '«Both of them are telling the truth. Also, … has the reward in their chest.»',
    ],
  },
  {
    id: 'creeper_beams', name: 'Creeper Beams', floor: 0, fail: false,
    text: 'На стенах и потолке висят Sea Lantern. Выстрел из лука соединяет два фонаря лучом.',
    solve: ['Соедини 4 пары фонарей так, чтобы все 4 луча прошли через Creeper в центре.', 'Пара всегда на противоположных сторонах комнаты: смотри через Creeper.'],
    more: ['Когда все 4 луча готовы, Creeper взрывается и открывает сундук с Blessing V.'],
  },
  {
    id: 'water_board', name: 'Water Board', floor: 0, fail: false,
    text: 'Пять дверей к сундуку, три закрыты. Вода, попавшая в отверстие цвета двери, переключает эту дверь.',
    solve: ['Шесть цветных рычагов двигают блоки в лабиринте, рычаг в глубине комнаты пускает и перекрывает воду.', 'Сначала выставь блоки, потом пускай воду: нужно, чтобы все 5 дверей были открыты одновременно.'],
    more: ['Вода в отверстии уже открытой двери закроет её, и можно оказаться запертым. Выход — Spirit Leap к напарнику или помощь снаружи.', 'Моды с решателем показывают нужный порядок рычагов.'],
  },
  {
    id: 'teleport_maze', name: 'Teleport Maze', floor: 0, fail: false,
    text: 'Семь комнат по четыре телепорта. Нужно попасть в центральную комнату с сундуком.',
    solve: ['После каждого телепорта ты смотришь на пад, который ведёт в центр, но обычно он в другой комнате.', 'Иди на пад по диагонали от того, на котором появился. Когда окажешься лицом к паду в той же комнате — он ведёт в центр.'],
  },
  {
    id: 'higher_lower', name: 'Higher or Lower', alias: 'Blaze', floor: 3, fail: true, secret: 1,
    text: 'Высокая комната с 10 Blaze, у каждого своё HP. Убить их нужно строго по порядку.',
    solve: ['Сундук внизу — бей от меньшего HP к большему. Сундук наверху — от большего к меньшему.', 'Blaze не по порядку — загадка провалена.'],
    more: ['Не бери Runaan\'s Bow и Hurricane Bow: лишние стрелы задевают чужих Blaze.', 'Лучнику (Archer) лучше удочка или меч: его стрелы отскакивают.', 'Секрет — за водопадом перед верхом лестницы, на bedrock.'],
  },
  {
    id: 'boulder', name: 'Boulder', floor: 3, fail: true,
    text: 'Комната заставлена ящиками 3×3 с кнопками. Пройти по ящикам нельзя: под ногами появляется стекло.',
    solve: ['Кнопка толкает ящик в противоположную от неё сторону. Ящик у задней стены от нажатия исчезает.', 'Обычно хватает сдвинуть пару ящиков по краям и открыть проход к сундуку.'],
    more: ['Ящик, упёртый в другой ящик, назад не сдвинуть: пазл можно запереть. Думай перед каждым нажатием.'],
  },
  {
    id: 'ice_path', name: 'Ice Path', floor: 3, fail: true,
    text: 'Silverfish с TNT на голове стоит на скользком полу. Её нужно довести до ворот.',
    solve: ['Ударь silverfish: она скользит по прямой, куда ты смотришь, до первой стенки.', 'Продумай маршрут от ворот назад, к silverfish.'],
    more: ['Trap ставить нельзя: попытка остановить silverfish ловушкой проваливает загадку.'],
  },
  {
    id: 'quiz', name: 'Quiz', floor: 4, fail: true,
    text: 'Статуя Oruo the Omniscient задаёт три вопроса про SkyBlock. Ответ — клик по варианту в чате.',
    solve: ['Все три ответа верны — команда получает Blessing of Time: Health, Defense, Strength и Intelligence.', 'Ещё Oruo заполняет Training Weights и добавляет час к Bottle of Jyrre и Dark Cacao Truffle.'],
    moreTitle: 'Ответы на частые вопросы',
    more: [
      'Status: The Watcher — Stalker; Bonzo — New Necromancer; Scarf — Apprentice Necromancer.',
      'Status: The Professor — Professor; Thorn — Shaman Necromancer; Livid — Master Necromancer.',
      'Status: Sadan — Necromancer Lord; Maxor, Storm, Goldor, Necron — The Wither Lords.',
      'Брат на Spider\'s Den — Rick, брат Rick — Pat. Продавец стекла в Hub — Wool Weaver.',
      'Улучшает питомцев — Kat. Lady of the Nether — Elle. Rogue Sword в деревне даёт Jamie.',
      'Вопросы про число Fairy Souls и минионов меняются с патчами: сверяйся с игрой.',
    ],
  },
  {
    id: 'ice_fill', name: 'Ice Fill', floor: 7, fail: false,
    text: 'Три уровня льда. Каждый блок льда нужно пройти ровно один раз, чтобы он стал Packed Ice.',
    solve: ['Не прыгай, не ходи по диагонали и не наступай дважды на один блок: лёд треснет, уровень придётся пройти заново.', 'Иди медленно: на бегу игра может засчитать шаг по диагонали.'],
    more: ['Награда — сразу два блессинга.'],
  },
];

const floorLabel = f => (f ? tx`с F${f}` : 'все этажи');

/** Секция «Загадки»: карточки с решением. Встречается на этаже игрока — подсвечено. */
export function puzzlesSection(top) {
  return {
    kind: 'cards', news: 'puzzles', title: 'Загадки (Puzzle Rooms)',
    note: 'В каждом данже минимум две загадки — фиолетовые комнаты на Magical Map, без повторов. Решённая даёт команде Blessing V, проваленная — −14 очков. Проваленную можно сбросить Architect\'s First Draft из секретных сундуков.',
    items: PUZZLES.map(p => ({
      name: p.alias ? tx`${p.name} (${p.alias})` : p.name,
      tags: [
        { text: floorLabel(p.floor), tone: top != null && p.floor > top ? 'muted' : null },
        p.fail ? { text: 'можно провалить', tone: 'warn' } : { text: 'без провала', tone: 'good' },
        ...(p.secret ? [{ text: tx`секрет: ${p.secret}` }] : []),
      ],
      text: p.text,
      lines: p.solve,
      more: p.more ? { title: p.moreTitle || 'Подробнее', lines: p.more } : null,
      dim: top != null && p.floor > top,
    })),
  };
}

const mmss = ms => {
  const s = Math.round(n(ms) / 1000);
  return s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null;
};

/** Таблица «Твой счёт по этажам»: лучший счёт, оценка, сколько нужно секретов, лимит времени, рекорд S+. */
export function scoreTable(d) {
  const floors = d.floors || {}, mf = d.masterFloors || {};
  const best = d.bestScore || {}, mbest = d.masterBestScore || {};
  const rows = [];
  const cell = (score, done) => {
    if (!done) return [{ text: '—', tone: 'muted' }, { text: '—', tone: 'muted' }];
    const r = rankOf(score);
    const tone = r === 'S+' ? 'good' : r === 'S' ? 'warn' : 'bad';
    return [score ? { text: String(Math.round(score)), tone } : '—', r ? { text: r, tone } : '—'];
  };
  for (let f = 1; f <= 7; f++) {
    const done = n(floors[f]) > 0;
    rows.push([tx`F${f}`, ...cell(best[f], done), tx`${SECRET_REQ[f]}%`, tx`${SPEED_MIN[f]} мин`, mmss(d.fastestSPlus?.[f]) || '—']);
  }
  for (let f = 1; f <= 7; f++) {
    const done = n(mf[f]) > 0;
    if (!done) continue;
    rows.push([tx`M${f}`, ...cell(mbest[f], done), '100%', tx`${SPEED_MIN_M[f]} мин`, mmss(d.masterFastestSPlus?.[f]) || '—']);
  }
  return {
    kind: 'table', news: 'score', title: 'Твой счёт по этажам',
    note: 'Секреты — какая доля секретов этажа даёт полные 40 очков Explore. Время — сколько можно идти без потери очков Speed.',
    columns: ['Этаж', 'Лучший счёт', 'Оценка', 'Секреты', 'Время', 'Рекорд S+'],
    rows,
  };
}

/** Из чего складываются 300 очков S+. */
export const SCORE_ROWS = [
  ['Skill', '100', 'Смерть −2 (первая с Legendary Spirit — −1), проваленная загадка −14. Босс не убит — весь счёт −30%.'],
  ['Explore', '100', '60 — за долю зачищенных комнат (все мобы со звездой), 40 — за секреты по норме этажа.'],
  ['Speed', '100', 'Полные 100, пока укладываешься в лимит этажа. Дальше по очку за каждые 12–40 секунд.'],
  ['Bonus', 'до 5', 'Crypts: по очку за каждый взорванный склеп с Crypt Undead (Superboom TNT), максимум 5.'],
  ['Mimic', '+2', 'С F6 в каждом данже один секретный сундук — Mimic. Убей его.'],
  ['Prince', '+1', 'Шанс от атрибута Reborn (Prince Shard) при убийстве Prince — усиленного Crypt Undead.'],
  ['Paul', '+10', 'Когда мэр Paul с перком EZPZ.'],
];

export function scoreSection() {
  return {
    kind: 'table', title: 'Как набрать 300 очков',
    note: 'Оценки: S+ — 300 и больше, S — от 270, A — от 230, B — от 160, C — от 100. Если остальное по максимуму, S+ выдерживает до 2 смертей на F1–F5 и до 3 на F6–F7.',
    columns: ['Часть счёта', 'Очки', 'Как получить'],
    rows: SCORE_ROWS.map(([a, b, c]) => [{ text: a }, b, c]),
  };
}

/** Секреты: что это, виды, что дают и сколько нашёл игрок. */
export function secretsSection(d) {
  const total = n(d.secrets);
  return {
    kind: 'text', news: 'secrets', title: 'Секреты',
    text: [
      total ? tx`Всего найдено секретов: ${num(total)}.` : 'Секретов пока нет: они в бурых и оранжевых комнатах и в некоторых загадках.',
      'Виды: сундук (двойной считается за два), предмет на земле, летучая мышь (убить своей рукой) и Wither Essence (клик правой кнопкой). Journal Entry — не секрет.',
      'Каждый секрет даёт очки Explore: до 40 за норму этажа. На F7 и в Master Mode нужны все секреты, на F1 — только 30%.',
      'Из секретов падают Spirit Leap, Decoy, Trap, Inflatable Jerry, Defuse Kit, Architect\'s First Draft, а с F4 — Dungeon Chest Key и Treasure Talisman.',
      'Комната со всеми найденными секретами отмечается зелёной галочкой на Magical Map, счётчик секретов комнаты — над хотбаром.',
      'Часть секретов спрятана за стенами под Superboom TNT, за рычагами и в высоких местах: пригодятся Aspect of the Void и Grappling Hook.',
    ],
  };
}

/** Blood Room и The Watcher. */
export function bloodSection(d) {
  const kills = n(d.watcherKills);
  return {
    kind: 'steps', news: 'blood', title: 'Blood Room и The Watcher',
    note: kills ? tx`The Watcher побеждён: ${num(kills)}.` : 'Порядок прохождения от входа до босса.',
    items: [
      { title: 'Чёрные Wither Door — Wither Key', text: 'Ключ падает с минибосса (Lost Adventurer, Angry Archaeologist и других) или когда в комнате убиты все мобы со звездой. Им может открыть дверь любой игрок.' },
      { title: 'Красная Blood Door — Blood Key', text: 'Падает так же. За дверью — Blood Room. Обычно один игрок сразу ищет ключ и открывает её (blood rush), пока остальные чистят комнаты.' },
      { title: 'Убей всех Undead, The Watcher неуязвим', text: ['Watcher призывает мертвецов из витрин на стенах. Победа — когда убиты все. По нему не бей: он отвечает лазером.', 'Фраза «That will be enough for now.» значит, что призывов больше не будет. Умерший игрок становится Wandering Soul: убей её — он оживёт (если нет Healer).'] },
      { title: 'Что меняется по этажам', text: ['F3 — призывает Bonzo. F4 — Watchful Eyes бьют тех, кто стоит на колоннах, и может прийти Scarf.', 'F5 — мобы с модификатором. Boomer при смерти роняет TNT с True Damage: отойди. Ещё приходит Spirit Bear.', 'F6 — модификатор не объявляют, приходит Livid. F7 — колонн нет, первым идёт один из гигантов Sadan.'] },
      { title: 'Портал к боссу', text: 'После победы над Watcher открывается портал к боссу этажа. Перед входом дочисть комнаты и собери секреты: из комнаты босса обратно в данж не попасть.' },
    ],
  };
}

/** Блессинги. */
export const BLESSINGS = [
  ['Blessing of Life', 'Health, Health Regen', 'мобы, минибоссы, сундуки, летучие мыши'],
  ['Blessing of Power', 'Strength, Crit Damage', 'мобы, минибоссы, сундуки, летучие мыши'],
  ['Blessing of Stone', 'Defense, Damage', 'мобы, минибоссы, сундуки, летучие мыши'],
  ['Blessing of Wisdom', 'Intelligence, Speed', 'то же и Wizard\'s Crystal'],
  ['Blessing of Time', 'Health, Defense, Strength, Intelligence', 'только загадка Quiz (с F4)'],
];

export function blessingSection() {
  return {
    kind: 'table', title: 'Блессинги',
    note: 'Усиление всей команды до конца захода. Загадки и мобы дают уровень V, секреты — I–II, одинаковые складываются. Сила растёт с этажом, в Master Mode — как на том же обычном этаже.',
    columns: ['Блессинг', 'Статы', 'Откуда'],
    rows: BLESSINGS.map(([a, b, c]) => [{ text: a }, b, c]),
  };
}

/** Шаги «Что делать» по счёту: S+ на лучшем открытом этаже. */
export function scoreNext(d) {
  const next = [];
  const floors = d.floors || {}, mf = d.masterFloors || {};
  const topM = [7, 6, 5, 4, 3, 2, 1].find(f => n(mf[f]) > 0);
  const topF = [7, 6, 5, 4, 3, 2, 1].find(f => n(floors[f]) > 0);
  const [label, score, req] = topM
    ? [tx`M${topM}`, n(d.masterBestScore?.[topM]), 100]
    : topF ? [tx`F${topF}`, n(d.bestScore?.[topF]), SECRET_REQ[topF]] : [null, 0, 0];
  if (label && score > 0 && score < 300) {
    next.push({ priority: 62, title: tx`Добейся S+ на ${label}: лучший счёт ${Math.round(score)}`,
      why: tx`S+ даёт больше опыта Catacombs и лучший лут. Чаще всего не хватает секретов (на ${label} нужно ${req}%), Crypts (5 штук) или кто-то проваливает загадки.` });
  }
  return next;
}

// ---------- Интерактивные помощники (считает сайт по этим данным) ----------

/**
 * Калькулятор счёта (Dungeon Score, fandom). offset — сколько секунд вычесть из времени захода перед формулой Speed
 * (Speed = 100, пока T < 480 с), secretReq — % секретов для полных 40 очков, mimic — есть ли Mimic.
 */
export const SCORE_FLOORS = [
  ...[1, 2, 3, 4, 5, 6, 7].map(f => ({ id: `F${f}`, secretReq: SECRET_REQ[f], offset: f === 7 ? 360 : f === 4 || f === 6 ? 240 : 120, mimic: f >= 6 })),
  ...[1, 2, 3, 4, 5, 6, 7].map(f => ({ id: `M${f}`, secretReq: 100, offset: f === 7 ? 360 : f === 6 ? 120 : 0, mimic: f >= 6 })),
];

/** Счёт захода по формулам вики. Тот же расчёт повторяет калькулятор на сайте (web/src/guides/DungeonTools.jsx). */
export function dungeonScore({ floor = 'F7', deaths = 0, spirit = false, failed = 0, rooms = 100, secrets = 100, seconds = 0, crypts = 0, mimic = false, paul = false } = {}) {
  const fl = SCORE_FLOORS.find(x => x.id === floor) || SCORE_FLOORS[6];
  const dead = Math.max(0, deaths);
  const skill = Math.max(0, Math.floor(100 - dead * 2 + (spirit && dead > 0 ? 1 : 0) - failed * 14));
  const explore = Math.floor(60 * Math.min(100, rooms) / 100) + Math.floor(Math.min(40, 40 * secrets / fl.secretReq));
  const t = seconds - fl.offset;
  const speed = t < 480 ? 100 : t < 600 ? Math.ceil(140 - t / 12) : t < 840 ? Math.ceil(115 - t / 24) : t < 1140 ? Math.ceil(108 - t / 30) : t < 3940 ? Math.ceil(98.5 - t / 40) : 0;
  const bonus = Math.min(5, crypts) + (mimic && fl.mimic ? 2 : 0) + (paul ? 10 : 0);
  const total = skill + explore + speed + bonus;
  return { skill, explore, speed, bonus, total, rank: rankOf(total) || 'D' };
}

export function scoreCalcSection(d) {
  const mf = d.masterFloors || {}, floors = d.floors || {};
  const topM = [7, 6, 5, 4, 3, 2, 1].find(f => n(mf[f]) > 0);
  const topF = [7, 6, 5, 4, 3, 2, 1].find(f => n(floors[f]) > 0);
  return {
    kind: 'tool', tool: 'dungeon-score', news: 'calc', title: 'Калькулятор счёта',
    note: 'Подставь цифры из таблицы Tab во время захода: найденные секреты (%), зачищенные комнаты (%), время. Калькулятор покажет счёт и чего не хватает до S+.',
    floors: SCORE_FLOORS,
    floor: topM ? `M${topM}` : topF ? `F${topF}` : 'F1',
  };
}

/** Three Weirdos: все фразы из вики. reward — у сказавшего эту фразу награда. … — имя другого NPC. */
export const WEIRDOS = [
  { text: 'The reward is not in my chest!', reward: true },
  { text: 'One of us is telling the truth!' },
  { text: 'They are both telling the truth. The reward isn\'t in …\'s chest.' },
  { text: 'We are all telling the truth!' },
  { text: 'At least one of them is lying, and the reward is not in …\'s chest.', reward: true },
  { text: '… is telling the truth and the reward is in his chest.' },
  { text: 'My chest doesn\'t have the reward. At least one of the others is telling the truth!' },
  { text: 'My chest doesn\'t have the reward. We are all telling the truth.', reward: true },
  { text: 'One of the others is lying.' },
  { text: 'My chest has the reward and I\'m telling the truth!', reward: true },
  { text: 'They are both telling the truth, the reward is in …\'s chest.' },
  { text: 'They are both lying, the reward is in my chest!' },
  { text: 'The reward isn\'t in any of our chests.', reward: true },
  { text: 'The reward is in my chest.' },
  { text: 'The reward is not in my chest. They are both lying.' },
  { text: '… is telling the truth.' },
  { text: 'My chest has the reward.' },
  { text: 'Both of them are telling the truth. Also, … has the reward in their chest.', reward: true },
];

/** Quiz: вопросы Oruo the Omniscient и ответы (вики). */
export const QUIZ = [
  ['What is the status of The Watcher?', 'Stalker'],
  ['What is the status of Bonzo?', 'New Necromancer'],
  ['What is the status of Scarf?', 'Apprentice Necromancer'],
  ['What is the status of The Professor?', 'Professor'],
  ['What is the status of Thorn?', 'Shaman Necromancer'],
  ['What is the status of Livid?', 'Master Necromancer'],
  ['What is the status of Sadan?', 'Necromancer Lord'],
  ['What is the status of Maxor, Storm, Goldor or Necron?', 'The Wither Lords'],
  ['Which brother is on the Spider\'s Den?', 'Rick'],
  ['What is the name of Rick\'s brother?', 'Pat'],
  ['What is the name of the vendor in the Hub who sells stained glass?', 'Wool Weaver'],
  ['What is the name of the person that upgrades pets?', 'Kat'],
  ['What is the name of the lady of the Nether?', 'Elle'],
  ['Which villager in the Village gives you a Rogue Sword?', 'Jamie'],
  ['How many unique minions are there?', '61'],
  ['How many total Fairy Souls are there?', '273'],
  ['How many Fairy Souls are there in Hub?', '80'],
  ['How many Fairy Souls are there in the Spider\'s Den?', '19'],
  ['How many Fairy Souls are there in The End?', '12'],
  ['How many Fairy Souls are there in The Farming Islands?', '20'],
  ['How many Fairy Souls are there in the Crimson Isle?', '29'],
  ['How many Fairy Souls are there in The Park?', '12'],
  ['How many Fairy Souls are there in Jerry\'s Workshop?', '5'],
  ['How many Fairy Souls are there in Deep Caverns?', '21'],
  ['How many Fairy Souls are there in Gold Mine?', '12'],
  ['How many Fairy Souls are there in Dungeon Hub?', '7'],
  ['Which of these enemies does not spawn in the Spider\'s Den?', 'тот, что есть среди вариантов: Zombie Spider, Cave Spider, Wither Skeleton, Dashing Spooder, Broodfather, Night Spider'],
  ['Which of these monsters only spawns at night?', 'тот, что есть среди вариантов: Zombie Villager, Ghast'],
  ['Which of these is not a dragon in The End?', 'тот, что есть среди вариантов: Zombie, Weak, Stonk, Holy, Boomer, Booger, Older, Elder, Professor Dragon'],
];

export function puzzleToolsSection() {
  return {
    kind: 'tool', tool: 'puzzle-helpers', news: 'helpers', title: 'Помощники для загадок',
    note: 'Держи открытым на втором экране или телефоне во время захода.',
    weirdos: WEIRDOS,
    quiz: QUIZ.map(([q, a]) => ({ q, a })),
  };
}
