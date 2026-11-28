// Fossil Excavator (Fossil Research Center, Dwarven Base Camp): как открывать Suspicious Scrap,
// формы окаменелостей с подсказкой по проценту, выгода «открыть или продать» и Chisel игрока.
// Сверено 28.11.2026: hypixelskyblock.minecraft.wiki (Fossil_Excavator, Fossils, Chisels, Dr._Stone, Suspicious_Scrap);
// формы фигур — из решателя SkyHanni (FossilType.kt), процент = 1 / число клеток, как пишет игра.
import { fmt, short, plural, hasItem, ladderPos, cell } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

// cells — [x, y] в исходной ориентации (повороты по SkyHanni: Spine/Footprint/Ugly — 4 поворота, Tusk — 8, Webbed — прямо и вверх ногами, Clubbed — 4 горизонтальных); pct — строка «Fossil Excavation Progress» после первой клетки
export const FOSSILS = [
  { id: 'TUSK_FOSSIL', key: 'TUSK', name: 'Tusk', pct: '12.5', pet: 'MAMMOTH', gem: 'Flawless Onyx',
    cells: [[0, 2], [0, 3], [0, 4], [1, 1], [2, 0], [3, 1], [3, 3], [4, 2]] },
  { id: 'WEBBED_FOSSIL', key: 'WEBBED', name: 'Webbed', pct: '10', pet: 'PENGUIN', gem: 'Flawless Aquamarine',
    cells: [[0, 2], [1, 1], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [4, 0], [5, 1], [6, 2]] },
  { id: 'CLUBBED_FOSSIL', key: 'CLUBBED', name: 'Clubbed', pct: '9.1', pet: 'ANKYLOSAURUS', gem: 'Flawless Opal',
    cells: [[0, 2], [0, 3], [1, 2], [1, 3], [2, 1], [3, 0], [4, 0], [5, 0], [6, 0], [6, 2], [7, 1]] },
  { id: 'SPINE_FOSSIL', key: 'SPINE', name: 'Spine', pct: '8.3', pet: 'SPINOSAURUS', gem: 'Flawless Aquamarine',
    cells: [[0, 2], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 0], [3, 1], [3, 2], [4, 1], [4, 2], [5, 2]] },
  { id: 'FOOTPRINT_FOSSIL', key: 'FOOTPRINT', name: 'Footprint', pct: '7.7', pet: 'TYRANNOSAURUS', gem: 'Flawless Onyx',
    cells: [[0, 2], [1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 0], [3, 2], [3, 4], [4, 0], [4, 2], [4, 4]] },
  { id: 'UGLY_FOSSIL', key: 'UGLY', name: 'Ugly', pct: '6.2', pet: 'GOBLIN', gem: 'Flawless Amber',
    cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [4, 0], [4, 1], [4, 2], [5, 1]] },
];
// Только из Crystal Nucleus, но Dr. Stone их тоже принимает (в счёт «все 8»)
const NUCLEUS_FOSSILS = [{ id: 'HELIX', key: 'HELIX', name: 'Helix', pet: 'AMMONITE' }, { id: 'CLAW_FOSSIL', key: 'CLAW', name: 'Claw', pet: 'MOLE' }];

export const CHISELS = [
  { id: 'CHISEL', charges: 16, hotm: 0, how: 'Dr. Stone или 5 Fossil Essence у Researcher Beryl' },
  { id: 'REINFORCED_CHISEL', charges: 18, hotm: 8, how: '2 Refined Tungsten, 2 Refined Umber' },
  { id: 'GLACITE_CHISEL', charges: 20, hotm: 9, how: '8 Glacite Amalgamation, Mithril Plate' },
  { id: 'PERFECT_CHISEL', charges: 22, hotm: 10, how: 'Perfect Plate' },
];

// Лут кроме окаменелости: вес и количество (вики, Fossil Excavator → Other Drops). Сумма весов 6 475.
const GEMS = ['AQUAMARINE', 'PERIDOT', 'CITRINE', 'ONYX'];
export const EXCAVATOR_DROPS = [
  ...GEMS.flatMap(g => [
    { id: `FLAWED_${g}_GEM`, w: 450, n: 20, group: 'gems' }, { id: `FLAWED_${g}_GEM`, w: 300, n: 40, group: 'gems' },
    { id: `FINE_${g}_GEM`, w: 150, n: 1, group: 'gems' }, { id: `FINE_${g}_GEM`, w: 75, n: 2, group: 'gems' },
  ]),
  { id: 'ESSENCE_FOSSIL', w: 400, n: 10, group: 'essence' }, { id: 'ESSENCE_FOSSIL', w: 200, n: 20, group: 'essence' }, { id: 'ESSENCE_FOSSIL', w: 100, n: 40, group: 'essence' },
  ...['ENCHANTED_UMBER', 'ENCHANTED_TUNGSTEN', 'ENCHANTED_GLACITE'].flatMap(id => [
    { id, w: 250, n: 2, group: 'metals' }, { id, w: 125, n: 4, group: 'metals' }, { id, w: 50, n: 8, group: 'metals' },
  ]),
  { powder: 1500, w: 250 }, { powder: 2500, w: 125 }, { powder: 3500, w: 100 }, { powder: 5000, w: 40 }, { powder: 8500, w: 20 },
  { id: 'ENCHANTMENT_PALEONTOLOGIST_1', w: 50, n: 1, group: 'other' }, { id: 'FOSSIL_THE_FISH', w: 15, n: 1, group: 'other' },
];
const ROLLS = 11.5;          // сокровищ на поле: 10–14 (30/25/20/15/10%)
const TILES = 54;            // поле 9×6
const FOSSIL_CHANCE = 0.1;   // окаменелость в 10% скрапов, все шесть одинаково
const FOSSIL_NPC = 10_000;   // продажа NPC
const AVG_CELLS = FOSSILS.reduce((s, f) => s + f.cells.length, 0) / FOSSILS.length;
// Гем в слоте Chisel: бонус по огранке одинаков для всех типов (вики; Fine Onyx ×3 = +150%, Perfect Citrine ×3 = +300% в лоре у игроков)
export const CHISEL_GEM_BONUS = { ROUGH: 0.3, FLAWED: 0.4, FINE: 0.5, FLAWLESS: 0.6, PERFECT: 1 };
// Шанс открыть окаменелость целиком решателем SkyHanni: ≤16 кликов 361/404, ≤17 396/404, 18 — все
const fossilSolved = c => (c >= 18 ? 1 : c >= 17 ? 0.98 : c >= 16 ? 0.89 : 0.75);

/** Гемы в слотах Chisel → { ONYX, CITRINE, PERIDOT, AQUAMARINE } в долях (1 = +100%). */
export function chiselGems(item) {
  const out = { ONYX: 0, CITRINE: 0, PERIDOT: 0, AQUAMARINE: 0 };
  const g = item?.gems || {};
  for (const [k, type] of Object.entries(g)) {
    const slot = /^(.+)_gem$/.exec(k)?.[1];
    if (!slot || out[type] == null) continue;
    const q = typeof g[slot] === 'object' ? g[slot]?.quality : g[slot];
    out[type] += CHISEL_GEM_BONUS[String(q || '').toUpperCase()] || 0;
  }
  return out;
}

/**
 * Средняя выгода одного Suspicious Scrap по ценам продажи.
 * Сокровища забираются только те, до которых докопался: зарядов мало, поле 9×6. Подсвеченные Citrine берутся
 * одним кликом, остальные находятся наугад; при окаменелости часть кликов уходит на её клетки.
 * @param {(id: string) => number} price  цена продажи сейчас (0, если нет)
 * @param {{ charges?: number, gems?: Object }} o  заряды Chisel и гемы (chiselGems)
 */
export function excavatorValue(price, o = {}) {
  const gems = { ONYX: 0, CITRINE: 0, PERIDOT: 0, AQUAMARINE: 0, ...(o.gems || {}) };
  const charges = (o.charges || 16) + Math.min(gems.AQUAMARINE, 1);
  const onField = ROLLS + gems.ONYX;
  const lit = Math.min(gems.CITRINE, onField);
  const free = Math.max(0, charges - lit - FOSSIL_CHANCE * AVG_CELLS);
  const found = Math.min(onField, lit + free * (onField - lit) / (TILES - lit - FOSSIL_CHANCE * AVG_CELLS));

  const W = EXCAVATOR_DROPS.reduce((s, d) => s + d.w, 0);
  const groups = { gems: 0, metals: 0, essence: 0, other: 0 };
  let powder = 0;
  for (const d of EXCAVATOR_DROPS) {
    const k = d.w / W * found;
    if (d.powder) powder += k * d.powder;
    else groups[d.group] += k * d.n * (price(d.id) || 0) * (d.group === 'essence' ? 1 + gems.PERIDOT : 1);
  }
  const fossilAvg = FOSSILS.reduce((s, f) => s + Math.max(price(f.id) || 0, FOSSIL_NPC), 0) / FOSSILS.length;
  const fossil = FOSSIL_CHANCE * fossilSolved(charges) * fossilAvg;
  const total = groups.gems + groups.metals + groups.essence + groups.other + fossil;
  return { groups, fossil, fossilAvg, total, powder, found, onField, charges, scrap: price('SUSPICIOUS_SCRAP') || 0 };
}

const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
const norm = s => String(s || '').toUpperCase().replace(/_FOSSIL$/, '');

/** Секции блока Fossil Excavator для гайда Mining. */
export function fossilSections(m, ctx) {
  const mi = m.mining || {};
  const lvl = mi.hotm?.level || 0;
  const donated = new Set((m.gather?.fossils || []).map(norm));
  const scrapsOwned = Number(m.inv?.sacks?.SUSPICIOUS_SCRAP || 0) + (ctx.owned?.get('SUSPICIOUS_SCRAP') || []).reduce((s, it) => s + (it.count || 1), 0);
  const essence = Number(m.essence?.FOSSIL || 0);
  const chisel = ladderPos(ctx, CHISELS.map(c => c.id));
  const haveChisel = CHISELS[chisel.best] || null;
  const chiselItem = haveChisel ? (ctx.owned?.get(haveChisel.id) || [])[0] : null;
  const gems = chiselGems(chiselItem);
  const price = id => ctx.price(id);
  const v = excavatorValue(price, { charges: haveChisel?.charges || 16, gems });
  const best = excavatorValue(price, { charges: 22, gems: { CITRINE: 3 } }); // Perfect Chisel + 3 Perfect Citrine (совет вики)
  const next = [];
  const sections = [];

  const doneAll = [...FOSSILS, ...NUCLEUS_FOSSILS].filter(f => donated.has(f.key)).length;

  sections.push({
    kind: 'steps', title: 'Fossil Excavator: как открыть Suspicious Scrap', news: 'fossil',
    items: [
      { title: 'Где', text: 'Dwarven Base Camp → Fossil Research Center. Первый Chisel даёт Dr. Stone при первом разговоре, запасной стоит 5 Fossil Essence у Researcher Beryl.', done: !!haveChisel, items: ['CHISEL'] },
      { title: 'Откуда скрап', text: 'Копание в Glacite Mineshafts (первый с шансом 0,5%, каждый следующий за шахту вдвое реже) и Frozen Corpse. Ещё 100 Fossil Essence у Researcher Beryl.', items: ['SUSPICIOUS_SCRAP'] },
      { title: 'Игра', text: 'Поле 9×6 под грязью. Клик открывает одну клетку и тратит заряд Chisel, сокровище под ней забирается сразу. Зарядов 16–22, так что всё поле не открыть, а окаменелость засчитывается, только если открыть все её клетки.' },
      { title: 'Подсказка', text: 'Первая найденная клетка окаменелости пишет «Fossil Excavation Progress» в процентах: по нему видно фигуру (таблица ниже). Дальше кликай только по клеткам, где она может лежать.' },
    ],
  });

  sections.push({
    kind: 'shapes', title: tx`Окаменелости: форма и процент · сдано ${doneAll} из 8`,
    note: 'Spine, Footprint и Ugly лежат в любом из четырёх поворотов, Tusk — ещё и зеркально. Webbed бывает только как на рисунке или вверх ногами, Clubbed — только лёжа. Окаменелость есть в 10% скрапов, все шесть одинаково частые. Helix и Claw выпадают только из Crystal Nucleus.',
    items: FOSSILS.map(f => ({
      item: f.id, name: tx`${f.name} Fossil`, badge: tx`${f.pct}%`, cells: f.cells, done: donated.has(f.key),
      text: tx`${f.cells.length} ${plural(f.cells.length, 'клетка', 'клетки', 'клеток')} · питомец ${ctx.name(`${f.pet};4`)?.replace(/^\[Lvl \{LVL\}\] /, '') || f.pet}`,
      hint: donated.has(f.key) ? 'сдан Dr. Stone' : 'не сдан: +25 000 Glacite Powder у Dr. Stone',
    })),
  });

  const pct = n => (v.total ? Math.round(n / v.total * 100) : 0);
  const priced = v.scrap > 0 && v.total > v.fossil;
  const gain = priced ? v.total - v.scrap : 0;
  const gemText = Object.entries(gems).filter(([, x]) => x > 0).map(([g, x]) => tx`${g[0] + g.slice(1).toLowerCase()} +${Math.round(x * 100)}%`).join(', ');
  sections.push({
    kind: 'table', title: 'Открыть скрап или продать?',
    note: !priced ? 'Цены Bazaar ещё не загрузились.'
      : tx`Сокровища забираются только те, до которых хватило зарядов: с ${haveChisel ? ctx.name(haveChisel.id) : 'Chisel'}${gemText ? tx` (${gemText})` : ''} в среднем ~${fmt1(v.found)} из ~${fmt1(v.onField)}. ${gain > 0
        ? tx`Открывать выгоднее на ${short(gain)} с каждого скрапа.`
        : tx`Продать скрап выгоднее: +${short(-gain)} с каждого. Открывать стоит ради окаменелостей: первая каждого вида у Dr. Stone даёт 25 000 Glacite Powder, а из окаменелости в Forge делается питомец.`}`,
    columns: ['Средний доход с одного скрапа', 'Монет'],
    rows: [
      ['Гемы Flawed и Fine (Aquamarine, Peridot, Citrine, Onyx)', tx`${short(v.groups.gems)} · ${pct(v.groups.gems)}%`],
      ['Enchanted Umber, Tungsten, Glacite', tx`${short(v.groups.metals)} · ${pct(v.groups.metals)}%`],
      ['Fossil Essence', tx`${short(v.groups.essence)} · ${pct(v.groups.essence)}%`],
      [tx`Окаменелость: 10% × ${short(v.fossilAvg)}`, short(v.fossil)],
      [cell('Итого, если открыть', { tone: gain > 0 ? 'good' : undefined }), cell(short(v.total), { tone: gain > 0 ? 'good' : undefined })],
      [cell('Продать скрап на Bazaar', { item: 'SUSPICIOUS_SCRAP', tone: priced && gain <= 0 ? 'good' : undefined }), cell(short(v.scrap), { tone: priced && gain <= 0 ? 'good' : undefined })],
      ...(priced && (chisel.best < 3 || gems.CITRINE < 3) ? [[cell('Для сравнения: Perfect Chisel и 3 Perfect Citrine', { tone: 'muted' }), cell(tx`${short(best.total)} · ~${fmt1(best.found)} сокровищ`, { tone: 'muted' })]] : []),
    ],
  });

  sections.push({
    kind: 'table', title: 'Chisel',
    note: tx`${haveChisel ? tx`Сейчас: ${ctx.name(haveChisel.id)}, ${haveChisel.charges} зарядов. ` : 'Chisel не нашёлся в инвентаре и сундуках. '}С 18 зарядами решатель (например, в моде SkyHanni) находит любую фигуру. Гемы в слотах: Aquamarine — шанс лишнего заряда, Citrine — подсветка сокровища, Onyx — лишнее сокровище, Peridot — больше Fossil Essence.${scrapsOwned ? tx` Скрапов в запасе: ${fmt(scrapsOwned)}.` : ''}${essence ? tx` Fossil Essence: ${fmt(essence)}.` : ''}`,
    columns: ['Chisel', 'Зарядов', 'Как получить'],
    current: chisel.best >= 0 ? chisel.best : undefined,
    rows: CHISELS.map((c, i) => [
      cell(ctx.name(c.id) || c.id, { item: c.id }), String(c.charges),
      i === 0 ? c.how : tx`Forge, HotM ${c.hotm}${lvl < c.hotm ? tx` (сейчас ${lvl})` : ''}: прошлый Chisel, Bejeweled Handle, ${c.how}`,
    ]),
  });

  // Шаги «Что делать»
  if (lvl >= 7 || (m.mining?.mineshafts || 0) > 0) {
    if (scrapsOwned > 0 && priced) {
      next.push(gain > 0
        ? { title: tx`Открой ${fmt(scrapsOwned)} Suspicious Scrap в Fossil Excavator`, priority: 46, item: 'SUSPICIOUS_SCRAP',
          why: tx`В среднем ${short(v.total)} с каждого против ${short(v.scrap)} при продаже. Fossil Research Center в Dwarven Base Camp.` }
        : { title: tx`Suspicious Scrap: ${fmt(scrapsOwned)} шт. выгоднее продать`, priority: 40, item: 'SUSPICIOUS_SCRAP',
          why: tx`На Bazaar ~${short(v.scrap * scrapsOwned)}, а раскопка с твоим Chisel даёт в среднем ${short(v.total)} за штуку. Открывай, только если нужны окаменелости для Dr. Stone или питомцев.` });
    }
    const holding = FOSSILS.filter(f => !donated.has(f.key) && hasItem(ctx, f.id));
    if (holding.length) {
      next.push({ title: tx`Сдай Dr. Stone: ${holding.map(f => f.name).join(', ')}`, priority: 44,
        why: 'Каждая новая окаменелость даёт 25 000 Glacite Powder, 25 000 Mining XP, 100 Fossil Essence и рецепт питомца в Forge. Сама окаменелость останется у Dr. Stone.' });
    }
    if (haveChisel && chisel.best < 1 && lvl >= 8 && scrapsOwned > 0) {
      next.push({ title: tx`Улучши Chisel до ${ctx.name('REINFORCED_CHISEL')}`, priority: 30, item: 'REINFORCED_CHISEL',
        why: '18 зарядов вместо 16: с ними решатель гарантированно открывает любую окаменелость.' });
    }
  }
  return { sections, next };
}
