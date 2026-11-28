// Enchanting и Experimentation Table: какие ставки открыты, сколько дают, как играть в Superpairs, Chronomatron и
// Ultrasequencer, Metaphysical Serum, RNG Meter, как качать Enchanting и какие зачарования ставить.
// Сверено 28.11.2026: hypixelskyblock.minecraft.wiki (Experiments, Experimentation_Table, Metaphysical_Serum,
// Enchanting, Enchantment_Table, Experience_Bottle, Titanic_Experience_Bottle).
// Bookshelf Power убран из игры в 0.26.1 (22.07.2026): стол зачарования больше не зависит от полок.
import { fmt, short, plural, cell, topNext, bestPet } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = n => {
  const t = ['', 'X', 'XX', 'XXX', 'XL', 'L', 'LX'];
  return t[Math.floor(n / 10)] + ROMAN[n % 10];
};

// Ставки по индексу из API (attempts_N): 0 Beginner … 5 Metaphysical
export const STAKES = ['Beginner', 'High', 'Grand', 'Supreme', 'Transcendent', 'Metaphysical'];

// Superpairs (главный эксперимент): ставка, Enchanting, поле, клики, XP за прохождение, XP с пар, награды, цена в уровнях опыта
export const SUPERPAIRS = [
  { i: 0, lvl: 10, grid: '7×2', clicks: 10, xp: 50_000, pairs: '3,5–50 тыс.', loot: 'Experience Bottle, Guardian', cost: 25 },
  { i: 1, lvl: 20, grid: '5×4', clicks: 12, xp: 75_000, pairs: '5–60 тыс.', loot: 'Grand и 1 Titanic Experience Bottle, Guardian', cost: 50 },
  { i: 2, lvl: 25, grid: '5×4', clicks: 12, xp: 100_000, pairs: '5–90 тыс.', loot: 'книги III–VI, Titanic, Metaphysical Serum', cost: 75 },
  { i: 3, lvl: 30, grid: '7×4', clicks: 14, xp: 200_000, pairs: '5–120 тыс.', loot: 'книги III–VI (изредка VII), Titanic, Serum', cost: 100 },
  { i: 4, lvl: 40, grid: '7×4', clicks: 16, xp: 300_000, pairs: '25–130 тыс.', loot: 'книги III–VI и VII, 1–2 Titanic, Serum', cost: 200 },
  { i: 5, lvl: 50, grid: '7×4', clicks: 12, xp: 400_000, pairs: '25–150 тыс.', loot: 'всё выше и Experiment the Fish, клики доп. игр ×2', cost: 350 },
];

// Chronomatron: цвета на поле, XP за ноту (до цепочки 15), клики за цепочку 5/9(/12), цена повтора в уровнях опыта
export const CHRONOMATRON = [
  { i: 1, lvl: 20, colors: 3, perNote: 1_500, clicks: '5 → +1, 9 → +2', retry: 5 },
  { i: 2, lvl: 25, colors: 5, perNote: 2_500, clicks: '5 → +1, 9 → +2', retry: 10 },
  { i: 3, lvl: 30, colors: 7, perNote: 3_500, clicks: '5 → +1, 9 → +2', retry: 15 },
  { i: 4, lvl: 35, colors: 8, perNote: 4_500, clicks: '5 → +1, 9 → +2', retry: 20 },
  { i: 5, lvl: 40, colors: 10, perNote: 6_000, clicks: '5 → +1, 9 → +2, 12 → +3', retry: 40 },
];
const CHRONO_CAP = 15;

// Ultrasequencer: поле, XP за число (до последовательности 20), клики за 5/7(/9)
export const ULTRASEQUENCER = [
  { i: 3, lvl: 25, grid: '7×3', perNum: 3_500, clicks: '5 → +1, 7 → +2', retry: 15 },
  { i: 4, lvl: 30, grid: '7×4', perNum: 5_000, clicks: '5 → +1, 7 → +2', retry: 20 },
  { i: 5, lvl: 40, grid: '9×4', perNum: 7_000, clicks: '5 → +1, 7 → +2, 9 → +3', retry: 40 },
];
const ULTRA_CAP = 20;

// Дополнительные заходы за Bits (сбрасываются в полночь GMT): уровни опыта и Bits
export const RESETS = [{ xp: 50, bits: 150 }, { xp: 100, bits: 300 }, { xp: 200, bits: 500 }];

// Главные зачарования по слотам и уровень Enchanting, с которого они открываются (вики: Enchanting → Leveling Rewards).
// 0 — доступно сразу.
export const ENCHANTS = [
  { slot: 'Оружие', name: 'Sharpness', lvl: 0, why: 'основной урон' },
  { slot: 'Оружие', name: 'Critical', lvl: 9, why: 'Crit Damage' },
  { slot: 'Оружие', name: 'Giant Killer', lvl: 8, why: 'урон по мобам с большим запасом здоровья' },
  { slot: 'Оружие', name: 'Ender Slayer', lvl: 11, why: 'урон по Ender-мобам и Voidgloom Seraph' },
  { slot: 'Оружие', name: 'Execute', lvl: 14, why: 'урон по раненым целям' },
  { slot: 'Оружие', name: 'Prosecute', lvl: 25, why: 'урон по целям с большим здоровьем' },
  { slot: 'Оружие', name: 'Life Steal', lvl: 5, why: 'лечение от ударов' },
  { slot: 'Оружие', name: 'Looting', lvl: 3, why: 'больше дропа' },
  { slot: 'Оружие', name: 'Scavenger', lvl: 1, why: 'монеты с мобов' },
  { slot: 'Оружие', name: 'Ultimate Wise', lvl: 20, why: 'меньше маны на способность (маги)' },
  { slot: 'Оружие', name: 'Soul Eater', lvl: 36, why: 'Ultimate: урон после убийства' },
  { slot: 'Оружие', name: 'One For All', lvl: 38, why: 'Ultimate: +500% урона, но снимает остальные чары' },
  { slot: 'Броня', name: 'Protection', lvl: 0, why: 'Defense' },
  { slot: 'Броня', name: 'Growth', lvl: 5, why: 'Health' },
  { slot: 'Броня', name: 'Rejuvenate', lvl: 10, why: 'восстановление здоровья' },
  { slot: 'Броня', name: 'True Protection', lvl: 15, why: 'True Defense (только нагрудник)' },
  { slot: 'Броня', name: 'Strong Mana', lvl: 22, why: 'Strength от Intelligence (маги)' },
  { slot: 'Броня', name: 'Ultimate Wisdom', lvl: 27, why: 'Ultimate: Intelligence' },
  { slot: 'Броня', name: 'Last Stand', lvl: 30, why: 'Ultimate: Defense при низком здоровье' },
  { slot: 'Броня', name: 'Ultimate Legion', lvl: 34, why: 'Ultimate: все статы за игроков рядом' },
  { slot: 'Ботинки', name: 'Sugar Rush', lvl: 7, why: 'Speed' },
  { slot: 'Инструменты', name: 'Efficiency', lvl: 0, why: 'быстрее ломает блоки' },
  { slot: 'Инструменты', name: 'Dedication', lvl: 12, why: 'Farming Fortune от Milestones культуры' },
  { slot: 'Инструменты', name: 'Green Thumb', lvl: 24, why: 'Farming Fortune от уникальных Visitors' },
];

// Уровни Enchanting, на которых открывается новое на столе
const MILESTONES = [
  { lvl: 10, text: 'рецепт Experimentation Table и Superpairs Beginner' },
  { lvl: 20, text: 'Chronomatron и Superpairs High: первые Titanic Experience Bottle' },
  { lvl: 25, text: 'Ultrasequencer и Superpairs Grand: книги и Metaphysical Serum' },
  { lvl: 30, text: 'Supreme во всех трёх играх: Superpairs даёт 200 тыс. XP' },
  { lvl: 35, text: 'Chronomatron Transcendent' },
  { lvl: 40, text: 'Superpairs Transcendent и Metaphysical в доп. играх' },
  { lvl: 50, text: 'Superpairs Metaphysical: 400 тыс. XP и Experiment the Fish' },
];

const bestOpen = (list, lvl) => list.filter(t => t.lvl <= lvl).pop() || null;

/** Сколько Enchanting XP даёт один полный заход на лучших открытых ставках (без пар Superpairs и бонусов). */
export function runXp(lvl) {
  const sp = bestOpen(SUPERPAIRS, lvl), ch = bestOpen(CHRONOMATRON, lvl), us = bestOpen(ULTRASEQUENCER, lvl);
  return {
    superpairs: sp?.xp || 0,
    chronomatron: ch ? ch.perNote * CHRONO_CAP : 0,
    ultrasequencer: us ? us.perNum * ULTRA_CAP : 0,
    get total() { return this.superpairs + this.chronomatron + this.ultrasequencer; },
  };
}

export function build(m, ctx) {
  const sk = m.skills?.enchanting || {};
  const lvl = sk.level || 0;
  const x = m.extras?.experiments || {};
  const top = x.top || {};
  const serums = Math.min(3, x.serums || 0);
  const sp = bestOpen(SUPERPAIRS, lvl), ch = bestOpen(CHRONOMATRON, lvl), us = bestOpen(ULTRASEQUENCER, lvl);
  const nextMs = MILESTONES.find(s => s.lvl > lvl);
  const guardian = bestPet(ctx, 'GUARDIAN');
  const runs = runXp(lvl);
  const p = id => ctx.price(id) || 0;
  const titanic = p('TITANIC_EXP_BOTTLE');
  const sections = [];
  const next = [];

  // ── Где ты сейчас
  const daily = m.daily?.experiments || [];
  const lastSp = daily[0] || 0;
  const today = lastSp && Date.now() - lastSp < 24 * 3600_000;
  sections.push({
    kind: 'checklist', title: 'Твой прогресс', news: 'progress',
    note: lvl < 10 ? 'Стол открывается с Enchanting 10.' : tx`Enchanting ${lvl}: открыты ставки до ${STAKES[sp.i]} в Superpairs.`,
    items: [
      { text: tx`Enchanting ${lvl} из 60`, done: lvl >= 60, hint: sk.xpForNext ? tx`До ${lvl + 1}: ${fmt(sk.xpForNext - (sk.xpCurrent || 0))} XP` : undefined },
      { text: 'Experimentation Table открыт (Enchanting 10)', done: lvl >= 10, item: 'EXPERIMENTATION_TABLE' },
      { text: tx`Superpairs: лучшая ставка, на которой играл — ${top.superpairs >= 0 ? STAKES[top.superpairs] : 'ещё не играл'}`, done: !!sp && top.superpairs >= sp.i,
        hint: sp && !(top.superpairs >= sp.i) ? tx`Открыта ${STAKES[sp.i]}: она даёт больше XP и наград.` : undefined },
      { text: tx`Metaphysical Serum выпито: ${serums} из 3`, done: serums >= 3, item: 'METAPHYSICAL_SERUM',
        hint: serums < 3 ? 'Каждая сыворотка упрощает доп. игры, три дают ещё +2 клика в Superpairs.' : undefined },
      { text: guardian ? tx`Питомец Guardian: ${guardian.tier} ${guardian.level || ''}`.trim() : 'Питомец Guardian для Enchanting Wisdom', done: !!guardian && ['EPIC', 'LEGENDARY', 'MYTHIC'].includes(guardian.tier), item: 'GUARDIAN;3',
        hint: guardian ? undefined : 'Даёт до 30 Enchanting Wisdom с Epic. Выпадает в Superpairs.' },
      ...(lvl >= 10 ? [{ text: today ? 'Superpairs сегодня пройден' : 'Superpairs сегодня ещё не пройден', done: !!today }] : []),
    ],
  });

  // ── Как работает стол
  sections.push({
    kind: 'text', title: 'Как устроен Experimentation Table', news: 'table',
    text: [
      'На Private Island может стоять только один стол. Один заход: сначала две доп. игры (Chronomatron и Ultrasequencer), они дают XP и лишние клики, потом главная — Superpairs.',
      'У стола 3 заряда, каждый Superpairs тратит один. Заряды возвращаются через 24 часа после последнего.',
      tx`Ещё до 3 заходов в день покупаются за Bits и уровни опыта: ${RESETS.map(r => tx`${r.bits} Bits + ${r.xp} ур.`).join(', ')}. Сброс покупок в полночь GMT.`,
      'Experiments — самый быстрый способ качать Enchanting: стол зачарования и наковальня дают не больше 500 тыс. XP в день, а Experiments считаются отдельно.',
    ],
  });

  // ── Ставки Superpairs
  sections.push({
    kind: 'table', title: 'Superpairs: ставки', news: 'superpairs',
    note: 'XP — за прохождение плюс случайная награда с пар. Цена — уровни опыта Minecraft за заход.',
    columns: ['Ставка', 'Enchanting', 'Поле', 'Клики', 'XP', 'С пар', 'Награды', 'Цена'],
    rows: SUPERPAIRS.map(t => [
      cell(STAKES[t.i], { tone: t.lvl <= lvl ? 'good' : 'muted' }), roman(t.lvl), t.grid, String(t.clicks), short(t.xp), t.pairs, t.loot, tx`${t.cost} ур.`,
    ]),
    current: sp ? SUPERPAIRS.indexOf(sp) : undefined,
  });

  // ── Доп. игры
  sections.push({
    kind: 'table', title: 'Chronomatron: ставки',
    note: tx`XP за каждую ноту самой длинной цепочки, считается до ${CHRONO_CAP} нот. Клики — бонус в Superpairs за длину цепочки.`,
    columns: ['Ставка', 'Enchanting', 'Цветов', 'XP за ноту', 'Максимум XP', 'Клики', 'Повтор'],
    rows: CHRONOMATRON.map(t => [
      cell(STAKES[t.i], { tone: t.lvl <= lvl ? 'good' : 'muted' }), roman(t.lvl), String(t.colors), fmt(t.perNote), short(t.perNote * CHRONO_CAP), t.clicks, tx`${t.retry} ур.`,
    ]),
    current: ch ? CHRONOMATRON.indexOf(ch) : undefined,
  });
  sections.push({
    kind: 'table', title: 'Ultrasequencer: ставки',
    note: tx`XP за каждое число самой длинной последовательности, считается до ${ULTRA_CAP}.`,
    columns: ['Ставка', 'Enchanting', 'Поле', 'XP за число', 'Максимум XP', 'Клики', 'Повтор'],
    rows: ULTRASEQUENCER.map(t => [
      cell(STAKES[t.i], { tone: t.lvl <= lvl ? 'good' : 'muted' }), roman(t.lvl), t.grid, fmt(t.perNum), short(t.perNum * ULTRA_CAP), t.clicks, tx`${t.retry} ур.`,
    ]),
    current: us ? ULTRASEQUENCER.indexOf(us) : undefined,
  });

  // ── Как играть
  sections.push({
    kind: 'steps', title: 'Как играть', news: 'howplay',
    items: [
      { title: 'Chronomatron', text: 'Поле проигрывает цепочку цветных «нот», повтори её кликами. Каждый раунд добавляет одну ноту. Проговаривай цвета вслух или записывай: после 15 нот XP уже не растёт, можно остановиться.' },
      { title: 'Ultrasequencer', text: 'На поле на секунду появляются числа, потом прячутся: кликай клетки по порядку 1, 2, 3… Цвет числа всегда идёт по кругу: белый, голубой, синий, фиолетовый, пурпурный, розовый, красный, оранжевый, жёлтый, лайм, зелёный, бирюзовый. Достаточно запомнить, где какой цвет.' },
      { title: 'Superpairs', text: 'Открывай по две клетки: одинаковая пара забирает награду. Сначала открывай новые клетки и запоминай, пары собирай, когда уверен. Бонусы на поле: +1 клик и XP, +3 клика, Instant Find (следующий клик сразу находит пару).' },
      { title: 'Не торопись принимать результат', text: 'После доп. игры результат можно отклонить и сыграть ещё раз, но повтор стоит уровни опыта. Если сервер перезагружается, подожди: прогресс доп. игры при перезагрузке пропадает.' },
      { title: 'Моды', text: 'Skyblocker и SkyHanni подсвечивают ходы в доп. играх. Включай подсветку только в одном моде, иначе клики задваиваются и игра проваливается.' },
    ],
  });

  // ── Выгода
  const lootRows = [
    ['TITANIC_EXP_BOTTLE', 'High и выше, 1–2 за заход'],
    ['GRAND_EXP_BOTTLE', 'High и выше, 5–20 за пару'],
    ['METAPHYSICAL_SERUM', 'Grand и выше, ~1% за заход'],
    ['EXPERIMENT_THE_FISH', 'только Metaphysical'],
  ];
  sections.push({
    kind: 'table', title: 'Что продаётся', news: 'loot',
    note: 'Цена — мгновенная продажа сейчас. Книги VI и VII стоят от сотен тысяч до сотен миллионов монет, но выпадают редко.',
    columns: ['Награда', 'Где', 'Цена'],
    rows: lootRows.map(([id, where]) => [cell(ctx.name(id) || id, { item: id }), where, p(id) ? short(p(id)) : '—']),
  });
  sections.push({
    kind: 'text', title: 'Сколько это даёт',
    text: [
      lvl >= 10
        ? tx`На твоих ставках один полный заход даёт до ${short(runs.total)} Enchanting XP без пар: Superpairs ${short(runs.superpairs)}${runs.chronomatron ? tx`, Chronomatron ${short(runs.chronomatron)}` : ''}${runs.ultrasequencer ? tx`, Ultrasequencer ${short(runs.ultrasequencer)}` : ''}.`
        : 'После Enchanting 10 один заход Beginner даёт около 50 тыс. Enchanting XP, этого хватает на несколько уровней сразу.',
      titanic && lvl >= 20 ? tx`Titanic Experience Bottle сейчас стоит ${short(titanic)}: одна бутылка за заход окупает его с запасом, три захода в день — около ${short(titanic * 3)}.` : 'Деньги начинаются с High (Enchanting 20): там выпадает Titanic Experience Bottle.',
      'Ultra-Rare книги и Endcap Upgrades выпадают с Supreme и выше: базовый шанс 1% на заход на Metaphysical. Mythic Guardian добавляет 7%, Enderman Slayer 8 — 15%.',
    ],
  });

  // ── Serum и RNG Meter
  sections.push({
    kind: 'text', title: 'Metaphysical Serum и RNG Meter', news: 'serum',
    text: [
      tx`Metaphysical Serum можно выпить 3 раза: каждая сокращает нужную цепочку в доп. играх на 1 и даёт +5 SkyBlock XP, после третьей Superpairs даёт +2 клика навсегда. У тебя выпито ${serums} из 3.`,
      'Сыворотку нельзя выставить на аукцион, но она продаётся на Bazaar: если все 3 выпиты, лишние продавай.',
      'В RNG Meter стола можно выбрать любую награду: каждые 1 000 Enchanting XP из Superpairs дают 1 очко. Titanic Experience Bottle — 15 тыс. очков, Metaphysical Serum — 50 тыс., книги VI — 150 тыс., книги VII — 500 тыс.',
    ],
  });

  // ── Как качать Enchanting
  sections.push({
    kind: 'table', title: 'Уровни Enchanting: что открывается', news: 'levels',
    columns: ['Уровень', 'Что открывается'],
    rows: MILESTONES.map(s => [cell(roman(s.lvl), { tone: s.lvl <= lvl ? 'good' : undefined }), s.text]),
    current: Math.max(0, MILESTONES.filter(s => s.lvl <= lvl).length - 1),
  });
  sections.push({
    kind: 'text', title: 'Как качать Enchanting',
    text: [
      'До 10: зачаровывай вещи на Enchantment Table (/et с Booster Cookie) или ставь книги на наковальне. XP растёт от потраченных уровней опыта; Experience Bottle продаёт Librarian в Hub по 30 монет.',
      'С 10: Experiments каждый день — основной источник. Не пропускай заряды, при лишних Bits докупай заходы.',
      'Питомец Guardian даёт до 30 Enchanting Wisdom, Grand и Titanic Experience Bottle, пойманные удочкой, тоже дают немного XP.',
      'Каждый уровень Enchanting даёт Conjurer: +5% опыта Minecraft отовсюду. Поэтому бутылки с высоким Enchanting дают больше уровней.',
      'Стол зачарования больше не зависит от книжных полок: Bookshelf Power убрали из игры летом 2026.',
    ],
  });

  // ── Какие чары ставить
  sections.push({
    kind: 'table', title: 'Какие зачарования ставить', news: 'enchants',
    note: 'Главное по слотам и уровень Enchanting, с которого чары появляются на столе. Чего не хватает на твоих вещах — в разделе «Снаряжение» у каждого предмета.',
    columns: ['Слот', 'Зачарование', 'Enchanting', 'Зачем'],
    rows: ENCHANTS.map(e => [e.slot, cell(e.name, { tone: e.lvl <= lvl ? 'good' : 'muted' }), e.lvl ? roman(e.lvl) : 'сразу', e.why]),
  });

  // ── Что дальше
  if (lvl < 10) {
    next.push({ title: 'Подними Enchanting до 10', priority: 70, why: tx`Откроется Experimentation Table. Осталось ${fmt(Math.max(0, 9925 - (sk.xp || 0)))} XP: зачаровывай вещи на Enchantment Table.` });
  } else {
    if (!today) next.push({ title: 'Пройди Experiments сегодня', priority: 60, item: 'EXPERIMENTATION_TABLE', why: tx`Две доп. игры и Superpairs: до ${short(runs.total)} Enchanting XP${lvl >= 20 && titanic ? tx` и Titanic Experience Bottle (${short(titanic)})` : ''}.` });
    if (sp && !(top.superpairs >= sp.i)) next.push({ title: tx`Играй Superpairs на ставке ${STAKES[sp.i]}`, priority: 55, why: tx`Она уже открыта: ${short(sp.xp)} XP за прохождение вместо меньших ставок.` });
    if (nextMs) next.push({ title: tx`Enchanting ${nextMs.lvl}`, priority: 35, why: tx`Откроется ${nextMs.text}.` });
    if (serums < 3 && lvl >= 25) next.push({ title: 'Выпей Metaphysical Serum', priority: 30, item: 'METAPHYSICAL_SERUM', why: tx`Выпито ${serums} из 3. Доп. игры станут короче, после третьей — +2 клика в Superpairs.` });
  }
  if (!guardian && lvl >= 10) next.push({ title: 'Найди питомца Guardian', priority: 25, item: 'GUARDIAN;3', why: 'До 30 Enchanting Wisdom. Выпадает в Superpairs или покупается на аукционе.' });

  const status = lvl >= 50 ? 'done' : lvl >= 10 ? 'progress' : 'start';
  const summary = lvl < 10
    ? tx`Enchanting ${lvl}: до стола экспериментов ${10 - lvl} ${plural(10 - lvl, 'уровень', 'уровня', 'уровней')}.`
    : tx`Enchanting ${lvl}, Superpairs до ${STAKES[sp.i]}. Serum: ${serums}/3.`;
  return { summary, status, level: { label: 'Enchanting', value: lvl, max: 60 }, next: topNext(next), sections };
}

export default {
  id: 'enchanting', title: 'Enchanting и Experiments', icon: 'EXPERIMENTATION_TABLE', group: 'skills',
  build,
};
