// Гайд по добыче: Heart of the Mountain, Powder, Crystal Hollows, Glacite Tunnels и Mineshafts, снаряжение, заработок.
import { treePerks } from '../advisor/lib/hotm.js';
import { hotmTreeSection } from './trees/index.js';
import { fmt, short, plural, hasItem, bestPet, ladderPos, howText, constants, cell, tone, topNext, lc } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';
import { fossilSections } from './fossil.js';

const POWDER = { MITHRIL: 'Mithril', GEMSTONE: 'Gemstone', GLACITE: 'Glacite' };

// Ключевые перки и зачем они нужны (остальные показываем в общей таблице)
const KEY_PERKS = {
  mining_speed: 'Mining Speed везде: основа всего дерева',
  mining_fortune: 'Mining Fortune везде',
  quick_forge: 'Forge работает до 30% быстрее: больше крафтов в сутки',
  professional: 'Скорость при добыче гемов',
  gem_lover: 'Gemstone Fortune',
  great_explorer: 'Больше сундуков в Crystal Hollows и меньше замков на них',
  powder_buff: '+% ко всему Powder',
  speedy_mineman: 'Mining Speed везде',
  fortunate_mineman: 'Mining Fortune везде',
  front_loaded: 'Первые 2 500 гемов за день: ×3 Gemstone Powder, Fortune и скорость',
  daily_powder: 'Ежедневный бонус Powder за первую руду',
  daily_grind: 'Ежедневный бонус Powder за первое задание на каждом острове',
  strong_arm: 'Скорость по Dwarven Metals (Mithril, Titanium, Umber и др.)',
  metal_head: 'Dwarven Metal Fortune',
  steady_hand: 'Gemstone Spread в Mineshafts',
  mining_master: 'Pristine: чаще выпадают Flawless-гемы',
  gifts_from_the_departed: 'Шанс на лишний предмет с Frozen Corpse',
  dead_mans_chest: 'Шанс на лишний Frozen Corpse в Mineshaft',
  surveyor: 'Mineshaft попадается чаще',
  core_of_the_mountain: 'Core of the Mountain: слоты Forge, токены и бонусы ко всем видам Powder',
  sky_mall: 'Случайный бафф добычи каждый день',
};

// Кристаллы для Crystal Nucleus и где их искать
const NUCLEUS = [
  ['jade', 'Jade', 'Mines of Divan: найди Metal Detector’ом 4 потерянных инструмента и отдай их Keeper’ам'],
  ['amber', 'Amber', 'Goblin Holdout: Goblin Queen в её логове'],
  ['amethyst', 'Amethyst', 'Jungle: Jungle Temple, пройди храм ключом Jungle Key'],
  ['sapphire', 'Sapphire', 'Precursor Remnants: Lost Precursor City, Professor Robot (собери 6 деталей)'],
  ['topaz', 'Topaz', 'Magma Fields: убей босса Bal в Khazad-dûm'],
];

const DRILLS = ['MITHRIL_PICKAXE', 'REFINED_MITHRIL_PICKAXE', 'TITANIUM_PICKAXE', 'REFINED_TITANIUM_PICKAXE', 'MITHRIL_DRILL_1', 'MITHRIL_DRILL_2', 'TITANIUM_DRILL_1', 'TITANIUM_DRILL_2', 'TITANIUM_DRILL_3', 'TITANIUM_DRILL_4', 'DIVAN_DRILL'];
const GEM_DRILLS = ['GEMSTONE_DRILL_1', 'GEMSTONE_DRILL_2', 'GEMSTONE_DRILL_3', 'GEMSTONE_DRILL_4'];
const ARMOR = [
  { base: 'MINERAL', name: 'Mineral', why: 'стартовый сет для Hard Stone' },
  { base: 'GLOSSY_MINERAL', name: 'Glossy Mineral', why: 'Block Fortune для Hard Stone' },
  { base: 'SORROW', name: 'Sorrow', why: 'скорость и Fortune, крафт из Sorrow (дроп Ghost в Dwarven Mines)' },
  { base: 'DIVAN', name: 'Divan', why: 'лучший сет для гемов, делается в Forge из Divan Fragment', ids: ['DIVAN_HELMET', 'DIVAN_CHESTPLATE', 'DIVAN_LEGGINGS', 'DIVAN_BOOTS'] },
];
const EQUIP = ['TITANIUM_NECKLACE', 'TITANIUM_CLOAK', 'TITANIUM_BELT', 'DWARVEN_HANDWARMERS'];
const PETS = [
  ['GLACITE_GOLEM', 'Glacite Tunnels и Mineshafts: больше Glacite Powder, Fortune и Pristine в Mineshaft'],
  ['MITHRIL_GOLEM', 'Dwarven Mines: скорость по Mithril и больше Mithril Powder'],
  ['SCATHA', 'Гемы в Crystal Hollows: Gemstone Fortune на бурах и больше Gemstone Powder'],
  ['BAL', 'Crystal Hollows: Pristine в Magma Fields, снижает жару'],
  ['MOLE', 'Mines of Divan и Crystal Nucleus: лишний предмет с Nucleus'],
];

const pieces = (ctx, a) => (a.ids || ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => tx`${a.base}_${s}`)).filter(id => hasItem(ctx, id)).length;

export default {
  id: 'mining', title: 'Mining', icon: 'DIVAN_DRILL', group: 'mining',
  build(m, ctx) {
    const mi = m.mining || {};
    const lvl = mi.hotm?.level || 0;
    const nodes = mi.nodes || {};
    const potm = Number(mi.potm || 0);
    const skill = m.skills?.mining;
    const layout = constants(ctx).hotmlayout?.hotm;
    const perks = treePerks(nodes, layout);
    const next = [];
    const sections = [];

    // ---- Powder: сколько есть и куда вложить ----
    const avail = { MITHRIL: mi.powder?.mithrilAvail || 0, GEMSTONE: mi.powder?.gemstoneAvail || 0, GLACITE: mi.powder?.glaciteAvail || 0 };
    const leftOpen = { MITHRIL: 0, GEMSTONE: 0, GLACITE: 0 };   // докачать уже открытые перки
    const leftAll = { MITHRIL: 0, GEMSTONE: 0, GLACITE: 0 };    // всё дерево до максимума
    for (const p of perks) {
      if (leftAll[p.powder] == null) continue;
      leftAll[p.powder] += p.left;
      if (p.level > 0 && p.tier <= lvl) leftOpen[p.powder] += p.left;
    }
    const locked = perks.filter(p => p.level === 0 && p.tier <= lvl);
    const unfinished = perks.filter(p => p.level > 0 && p.level < p.max && p.left > 0);

    if (lvl < 10) {
      next.push({
        title: tx`Подними Heart of the Mountain: ${lvl} → 10`, priority: 80,
        why: 'Каждый уровень открывает новый ряд перков и токен. Опыт HotM дают задания (commissions) в Dwarven Mines, Crystal Hollows и Glacite Tunnels; первое задание за день на каждом острове даёт больше.',
      });
    }
    for (const [k, n] of Object.entries(POWDER)) {
      const canSpend = Math.min(avail[k], leftOpen[k]);
      if (canSpend > 50_000) {
        const what = unfinished.filter(p => p.powder === k && p.tier <= lvl).sort((a, b) => (KEY_PERKS[b.id] ? 1 : 0) - (KEY_PERKS[a.id] ? 1 : 0) || a.left - b.left).slice(0, 4);
        next.push({
          title: tx`Вложи ${n} Powder: ${short(canSpend)} лежит без дела`, priority: 70 + Math.min(15, Math.round(canSpend / 2_000_000)),
          why: tx`Есть ${short(avail[k])}, а докачать открытые перки стоит ${short(leftOpen[k])}. Начни с: ${what.map(p => tx`${p.name} ${p.level}/${p.max}`).join(', ') || 'перков этого вида'}.`,
        });
      }
    }
    if (locked.length) {
      const keyLocked = locked.filter(p => KEY_PERKS[p.id]);
      next.push({
        title: tx`Не взято перков HotM: ${locked.length}`, priority: keyLocked.length ? 66 : 40,
        why: tx`${(keyLocked.length ? keyLocked : locked).slice(0, 6).map(p => tx`${p.name}${KEY_PERKS[p.id] ? tx` (${lc(KEY_PERKS[p.id])})` : ''}`).join('; ')}. Если свободных токенов нет, перераспредели дерево под свой способ добычи: сброс в меню HotM.`,
      });
    }
    if (layout && potm < 10) {
      next.push({ title: tx`Core of the Mountain: ${potm} → 10`, priority: 62, why: 'Даёт слоты Forge, токены HotM и бонусы к Powder. Уровни 1–3 стоят Mithril Powder, 4–7 Gemstone, 8–10 Glacite.' });
    }

    // ---- Crystal Hollows ----
    const cr = mi.crystals || {};
    const nucleusRuns = Math.min(...NUCLEUS.map(([k]) => cr[k]?.placed || 0));
    const missing = NUCLEUS.filter(([k]) => cr[k]?.state !== 'FOUND' && cr[k]?.state !== 'PLACED');
    if (nucleusRuns < 1) {
      next.push({ title: 'Пройди первый Crystal Nucleus', priority: 58, why: 'Собери 5 кристаллов и поставь их в Crystal Nucleus в центре Crystal Hollows: это открывает сундук с частями Divan, гемами и Powder. Где искать: в разделе «Crystal Hollows».' });
    }

    // ---- Glacite ----
    const corpses = mi.corpses || {};
    const shafts = Number(mi.mineshafts || 0);
    if (lvl >= 7 || skill?.level >= 30) {
      if (!(corpses.umber > 0) || !(corpses.vanguard > 0)) {
        next.push({
          title: tx`Фарми Glacite Mineshafts: ${fmt(shafts)} ${plural(shafts, 'вход', 'входа', 'входов')}, ${fmt(Object.values(corpses).reduce((s, v) => s + (Number(v) || 0), 0))} трупов`, priority: 52,
          why: tx`Frozen Corpse дают материалы для Dwarven Handwarmers, броню и Glacite Powder. Сейчас: Lapis ${fmt(corpses.lapis || 0)}, Umber ${fmt(corpses.umber || 0)}, Tungsten ${fmt(corpses.tungsten || 0)}, Vanguard ${fmt(corpses.vanguard || 0)}. Для Umber, Tungsten и Vanguard нужны ключи (Umber Key, Tungsten Key, Skeleton Key).`,
        });
      }
    }

    // ---- Снаряжение ----
    const drill = ladderPos(ctx, DRILLS);
    const gem = ladderPos(ctx, GEM_DRILLS);
    if (drill.next) {
      next.push({ title: tx`Следующий бур: ${ctx.name(drill.next)}`, priority: drill.best < 9 ? 60 : 48, why: tx`${drill.have ? tx`Сейчас лучший: ${ctx.name(drill.have)}. ` : ''}${howText(ctx, drill.next)}.` });
    }
    const armorRows = ARMOR.map(a => ({ ...a, n: pieces(ctx, a) }));
    const divan = armorRows.find(a => a.base === 'DIVAN');
    if (divan.n < 4 && lvl >= 6) {
      next.push({ title: tx`Броня Divan: ${divan.n}/4`, priority: 50, why: 'Лучший сет для гемов. Части делаются в Forge из Divan Fragment (сундуки Crystal Nucleus и Mines of Divan), Gemstone Mixture и Flawless Ruby.' });
    }
    const eqMissing = EQUIP.filter(id => !hasItem(ctx, id));
    if (eqMissing.length && lvl >= 3) {
      next.push({ title: tx`Снаряжение для добычи: не хватает ${eqMissing.length} из ${EQUIP.length}`, priority: 44, why: eqMissing.map(id => tx`${ctx.name(id)}: ${howText(ctx, id)}`).join(' • ') });
    }
    const petNotes = PETS.map(([t, why]) => ({ t, why, pet: bestPet(ctx, t) }));
    const noPet = petNotes.filter(p => !p.pet).slice(0, 2);
    if (noPet.length) next.push({ title: tx`Питомцы для добычи: ${noPet.map(p => ctx.name(p.t)).join(', ')}`, priority: 30, why: noPet.map(p => tx`${ctx.name(p.t)}: ${lc(p.why)}`).join('; ') + '.' });

    // ================= Секции =================
    sections.push({
      kind: 'steps', title: 'Порядок прокачки добычи',
      items: [
        { title: 'Dwarven Mines: HotM 1–3', text: 'Задания Royal Pigeon / Emissary, Mithril и Titanium. Первый бур Mithril Drill, затем Titanium Drill. Forge открывается с HotM 2.', done: lvl >= 3 },
        { title: 'Crystal Hollows: HotM 3–6', text: 'Пропуск в Crystal Hollows, задания и гемы. Собери 5 кристаллов и проходи Crystal Nucleus ради частей Divan и Gemstone Powder.', done: lvl >= 6 && nucleusRuns > 0, current: lvl >= 3 && lvl < 6 },
        { title: 'Glacite Tunnels: HotM 7–10', text: 'Dwarven Base Camp → Glacite Tunnels: Umber, Tungsten, Glacite и гемы Onyx, Aquamarine, Citrine, Peridot. Отсюда Glacite Powder и вход в Mineshafts.', done: lvl >= 10, current: lvl >= 7 && lvl < 10 },
        { title: 'Mineshafts и Divan', text: 'Frozen Corpse, Dwarven Handwarmers, Divan’s Drill и броня Divan. Дальше — фарм гемов и Glacite ради денег.', current: lvl >= 10 },
      ],
    });

    const tree = hotmTreeSection(m, ctx);
    if (tree) sections.push({ ...tree, news: 'hotm' });   // ссылка из новостей: guides/mining#hotm
    sections.push({
      kind: 'checklist', title: 'Crystal Hollows: кристаллы для Crystal Nucleus',
      note: tx`Nucleus пройден ${fmt(nucleusRuns)} ${plural(nucleusRuns, 'раз', 'раза', 'раз')}. Кристаллы сбрасываются после каждого прохождения, поэтому «найден» — это текущий заход.`,
      items: NUCLEUS.map(([k, n, where]) => ({
        text: tx`${n} Crystal${cr[k]?.placed ? tx` · поставлен ${fmt(cr[k].placed)} ${plural(cr[k].placed, 'раз', 'раза', 'раз')}` : ''}`,
        done: cr[k]?.state === 'FOUND' || cr[k]?.state === 'PLACED',
        hint: where,
      })),
    });
    if (missing.length && nucleusRuns > 0) sections[sections.length - 1].note += tx` Для следующего захода не хватает: ${missing.map(x => x[1]).join(', ')}.`;

    sections.push({
      kind: 'table', title: 'Glacite Tunnels и Mineshafts',
      note: tx`Входов в Mineshaft: ${fmt(shafts)}. Шанс найти Mineshaft растёт с перками Surveyor, а лишний труп даёт Dead Man’s Chest.`,
      columns: ['Frozen Corpse', 'Залутано', 'Нужен ключ'],
      rows: [['Lapis', 'lapis', 'не нужен'], ['Umber', 'umber', 'Umber Key'], ['Tungsten', 'tungsten', 'Tungsten Key'], ['Vanguard', 'vanguard', 'Skeleton Key']]
        .map(([n, k, key]) => [n, cell(fmt(corpses[k] || 0), { tone: corpses[k] ? 'good' : 'muted' }), key]),
    });

    // Fossil Excavator: открытие Suspicious Scrap, формы окаменелостей, выгода
    const fossil = fossilSections(m, ctx);
    sections.push(...fossil.sections);
    next.push(...fossil.next);

    const bestDrill = [drill.have, gem.have].filter(Boolean);
    sections.push({
      kind: 'table', title: 'Снаряжение майнера',
      columns: ['Что', 'Есть', 'Следующий шаг'],
      rows: [
        [cell('Бур', { item: drill.have || DRILLS[0] }), cell(drill.have ? ctx.name(drill.have) : 'нет', { tone: tone(drill.best >= 9, drill.best >= 5) }), drill.next ? tx`${ctx.name(drill.next)}: ${howText(ctx, drill.next)}` : 'Максимум. Дальше гемы в слоты, Perfect-гемы и реофордж Fleet/Auspicious'],
        [cell('Бур для гемов', { item: gem.have || GEM_DRILLS[0] }), gem.have ? ctx.name(gem.have) : 'нет', gem.next && !hasItem(ctx, 'DIVAN_DRILL') ? tx`${ctx.name(gem.next)}: ${howText(ctx, gem.next)}` : 'Не нужен, если есть Divan’s Drill'],
        ...armorRows.map(a => [cell(tx`Броня ${a.name}`, { item: (a.ids?.[1]) || tx`${a.base}_CHESTPLATE` }), cell(`${a.n}/4`, { tone: a.n === 4 ? 'good' : a.n ? 'warn' : 'muted' }), a.why]),
        ...EQUIP.map(id => [cell(ctx.name(id), { item: id }), cell(hasItem(ctx, id) ? 'есть' : 'нет', { tone: tone(hasItem(ctx, id)) }), hasItem(ctx, id) ? '—' : howText(ctx, id)]),
      ],
    });
    if (!bestDrill.length) sections[sections.length - 1].note = 'Буров не нашлось в инвентаре, сундуках и рюкзаках. Если бур лежит в Storage на острове, API его не видит.';

    sections.push({
      kind: 'table', title: 'Питомцы для добычи',
      columns: ['Питомец', 'Есть', 'Когда брать'],
      rows: petNotes.map(p => [cell(ctx.name(tx`${p.t};4`).replace(/^\[Lvl \{LVL\}\] /, '') || p.t, { item: tx`${p.t};4` }), cell(p.pet ? tx`${p.pet.tier[0] + p.pet.tier.slice(1).toLowerCase()}${p.pet.level ? tx`, ур. ${p.pet.level}` : ''}` : 'нет', { tone: p.pet ? 'good' : 'muted' }), p.why]),
    });

    // Заработок: методы из модуля цен с тегом «Добыча»
    const methods = (ctx.analysis?.methods || []).filter(x => x.tag === 'Mining' || /gem|forge|mining/i.test(x.id || ''));
    sections.push({
      kind: 'table', title: 'Заработок добычей',
      note: 'Доход по живым ценам Bazaar и аукциона, если модуль цен уже посчитал. Ориентиры — при хорошей экипировке.',
      columns: ['Способ', 'Монет в час', 'Как'],
      rows: [
        ...methods.map(x => [x.title, x.coinsPerHour ? short(x.coinsPerHour) : x.range ? tx`${x.range[0]}–${x.range[1]} млн` : '—', x.detail || x.desc || '']),
        ...(!methods.length ? [
          ['Гемы в Crystal Hollows', '5–12 млн', 'Divan’s Drill + броня Divan, жилы Jade/Amber/Topaz, продажа Flawless на Bazaar'],
          ['Forge', 'пассивно', 'Все слоты Forge заняты выгодным рецептом (см. «Заработок» → Forge)'],
        ] : []),
        ['Glacite и Umber/Tungsten', 'зависит от цен', 'Glacite Tunnels с Glacite Golem; продавай Enchanted-формы на Bazaar'],
        ['Mineshafts', 'зависит от цен', 'Frozen Corpse: материалы Handwarmers, Shattered Locket и т. п. продаются на аукционе'],
      ],
    });

    const status = lvl >= 10 && potm >= 10 && !locked.length && unfinished.length === 0 ? 'done' : lvl === 0 ? 'start' : 'progress';
    const sumParts = [tx`HotM ${lvl}/10`, tx`Core ${potm}/10`];
    if (skill) sumParts.unshift(tx`Mining ${skill.level}`);
    const free = avail.MITHRIL + avail.GEMSTONE + avail.GLACITE;
    if (free > 1_000_000) sumParts.push(tx`${short(free)} Powder не вложено`);
    return {
      summary: sumParts.join(' · '),
      status,
      level: { label: 'Heart of the Mountain', value: lvl, max: 10 },
      next: topNext(next),
      sections,
    };
  },
};
