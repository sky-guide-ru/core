// Гайд Hunting: атрибуты и осколки, Hunting Box, способы охоты, ловушки, соли, фьюжн,
// откуда каждый осколок и что качать первым — всё по профилю (attributes.stacks, shards.owned, player_stats).
// Данные — hunting-data.js (fandom) + база осколков NEU (items-ru): редкость, тип, ID, эффект на русском.
import { getLoreRu, getLoreEn, listByCategory, shardId } from '../items-ru/index.js';
import { isEn } from '../../i18n/lang.js';
import { LEVEL_SHARDS, SYPHON_LEVEL, HUNT_XP, RARITY_RU, CATEGORY_RU, TOOLS, SOURCES, RENAMED, sourceText, PRIORITY, PRIORITY_FOCUS_RU, DAVID_TRACKS } from './hunting-data.js';
import { fmt, short, plural, cell, hasItem } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

const RAR = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const key = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
const attrOf = id => String(id || '').replace(/^ATTRIBUTE_SHARD_/, '').replace(/;\d+$/, '');

/** Уровень атрибута по числу извлечённых осколков. */
export function attrLevel(n, rarity) {
  const steps = LEVEL_SHARDS[rarity] || LEVEL_SHARDS.COMMON;
  let lvl = 0, acc = 0;
  for (const s of steps) { if (n >= acc + s) { acc += s; lvl++; } else break; }
  const max = steps.reduce((a, b) => a + b, 0);
  return { level: lvl, max, left: Math.max(0, max - n), toNext: lvl < 10 ? acc + steps[lvl] - n : 0 };
}

// Каталог всех осколков из NEU (один раз на процесс)
// Отдельно для английской версии: там описание осколка — оригинал из игры
const CATALOG = { ru: null, en: null };
export function catalog() {
  const lang = isEn() ? 'en' : 'ru';
  if (CATALOG[lang]) return CATALOG[lang];
  const wikiByAttr = new Map();
  for (const [name, code] of Object.entries(SOURCES)) {
    const id = RENAMED[name] ? tx`ATTRIBUTE_SHARD_${RENAMED[name]};1` : shardId(key(name));
    if (id && !RENAMED[name]) wikiByAttr.set(id, sourceText(name, code));
  }
  const list = [];
  for (const it of listByCategory('shard') || []) {
    const m = /(\w+) SHARD \(ID (\w+)\)/.exec(it.type || '');
    if (!m || !it.id.startsWith('ATTRIBUTE_SHARD_')) continue;
    const en = lang === 'en' && getLoreEn(it.id);
    // английский оригинал: «Accessory Size I», дальше строки эффекта; русский: «Accessory Size I. Даёт …»
    const lore = en ? [tx`${(en[0] || '').trim()}. ${(en[1] || '').trim()}`, ...en.slice(2)] : getLoreRu(it.id) || [];
    const lm = /^(.+?)\s+I\.\s*(.*)$/.exec((lore[0] || '').trim());
    const effect = [lm?.[2] || ''];
    for (const l of lore.slice(1)) { if (!l.trim()) break; effect.push(l.trim()); }
    const neu = (it.whereToGet || []).map(w => w.textRu).filter(t => t && !/WIKI/i.test(t));
    list.push({
      id: it.id, attr: attrOf(it.id), shard: it.nameEn.replace(/\s+Shard$/i, ''), name: lm?.[1] || it.nameEn,
      rarity: it.rarity, category: m[1], code: m[2], effect: effect.join(' ').trim().replace(/(островах|острове) Foraging/g, '$1 Foraging'),
      source: wikiByAttr.get(it.id) || (neu.length ? neu.slice(0, 3).join(' · ') : null),
    });
  }
  list.sort((a, b) => RAR.indexOf(a.rarity) - RAR.indexOf(b.rarity) || a.code.localeCompare(b.code, 'en', { numeric: true }));
  CATALOG[lang] = { list, byId: new Map(list.map(s => [s.id, s])), byAttr: new Map(list.map(s => [s.attr, s])) };
  return CATALOG[lang];
}

const shardOf = name => catalog().byId.get(shardId(key(name)));

function build(m, ctx) {
  const cat = catalog();
  const hunt = m.skills?.hunting || { level: 0 };
  const hl = hunt.level || 0;
  const x = m.extras || {};
  const hunts = x.shardHunts || {};
  const stacks = new Map((x.attributes || []).map(a => [String(a.id).toUpperCase(), a.n]));
  const mine = id => stacks.get(attrOf(id)) || 0;
  const box = (x.shards || []).filter(s => s.owned > 0).map(s => ({ ...s, sh: cat.byId.get(shardId(s.type)) })).filter(s => s.sh);
  const price = s => ctx.price(tx`SHARD_${key(s.shard)}`) || ctx.price(s.id);
  const lvlText = s => { const L = attrLevel(mine(s.id), s.rarity); return L.level >= 10 ? 'X ✓' : tx`${L.level} (${mine(s.id)}/${L.max})`; };
  const next = [];

  // Что делать: извлечь осколки, которые уже лежат в Hunting Box
  const canSyphon = box.filter(b => {
    const L = attrLevel(mine(b.sh.id), b.sh.rarity);
    return L.left > 0 && hl >= (SYPHON_LEVEL[b.sh.rarity] ?? 0);
  });
  if (canSyphon.length) {
    next.push({ priority: 92, title: tx`Извлеки осколки из Hunting Box: ${canSyphon.length} ${plural(canSyphon.length, 'вид', 'вида', 'видов')}`,
      why: canSyphon.slice(0, 4).map(b => tx`${b.sh.shard} ×${Math.min(b.owned, attrLevel(mine(b.sh.id), b.sh.rarity).left)} → ${b.sh.name}`).join(', ') + '. Открой /huntingbox и кликни по осколку (Syphon): атрибут сразу вырастет.',
      item: canSyphon[0].sh.id });
  }
  const locked = box.filter(b => attrLevel(mine(b.sh.id), b.sh.rarity).left > 0 && hl < (SYPHON_LEVEL[b.sh.rarity] ?? 0));
  if (locked.length) {
    const need = Math.min(...locked.map(b => SYPHON_LEVEL[b.sh.rarity]));
    next.push({ priority: 70, title: tx`Hunting ${hl} → ${need}: откроется извлечение ещё ${locked.length} ${plural(locked.length, 'осколка', 'осколков', 'осколков')}`,
      why: tx`${locked.slice(0, 3).map(b => b.sh.shard).join(', ')} лежат в коробке, но их редкость требует Hunting ${need}. Опыт: ${HUNT_XP.COMMON}–${HUNT_XP.LEGENDARY} за пойманный осколок, ещё за фьюжн и извлечение.` });
  }
  const spare = box.filter(b => attrLevel(mine(b.sh.id), b.sh.rarity).left === 0);
  if (spare.length) {
    const val = spare.reduce((s, b) => s + price(b.sh) * b.owned, 0);
    next.push({ priority: 45, title: tx`Лишние осколки: ${spare.reduce((s, b) => s + b.owned, 0)} шт. для атрибутов на максимуме`,
      why: tx`${spare.slice(0, 4).map(b => tx`${b.sh.shard} ×${b.owned}`).join(', ')}. Продай на Bazaar${val ? tx` (≈${short(val)})` : ''} или пусти в фьюжн у Fusion Machine в Tangleburg.` });
  }

  // Что качать первым: стиль игры по числу охот и навыкам
  const focus = new Set(['all', 'hunt']);
  if ((hunts.fishing || 0) >= 100 || (m.skills?.fishing?.level || 0) >= 30) focus.add('fishing');
  if ((hunts.combat || 0) >= 50 || (m.skills?.combat?.level || 0) >= 30) focus.add('combat');
  if ((hunts.forest || 0) >= 50 || ['farming', 'mining', 'foraging'].some(k => (m.skills?.[k]?.level || 0) >= 40)) focus.add('gathering');
  const prio = PRIORITY.map(p => ({ ...p, sh: shardOf(p.shard) })).filter(p => p.sh);
  const todo = prio.filter(p => focus.has(p.focus) && attrLevel(mine(p.sh.id), p.sh.rarity).left > 0);
  todo.slice(0, 3).forEach((p, i) => {
    const L = attrLevel(mine(p.sh.id), p.sh.rarity);
    next.push({ priority: 66 - i * 3, title: tx`Качай ${p.sh.name} (${p.sh.shard}): ур. ${L.level}/10, ещё ${L.left} ${plural(L.left, 'осколок', 'осколка', 'осколков')}`,
      why: tx`${p.why[0].toUpperCase()}${p.why.slice(1)}.`, how: p.sh.source || 'фьюжн или особый способ, подробности в меню атрибута в игре', item: p.sh.id });
  });
  if (!hunts.trap) {
    next.push({ priority: 40, title: 'Поставь ловушки (Huntrap)', why: 'Ловушка сама ловит осколок за 24 часа, пока ты занят другим. Первая — за коллекцию Tender Wood I, ставь в Galatea или под воду в Murkwater Depths.', item: 'RETIA_BASICA' });
  }

  const sections = [];
  sections.push({
    kind: 'text', title: 'Как устроен Hunting',
    link: { href: '#/guides/foraging', text: 'Осколки для Foraging (Sweep и Fortune по деревьям) — в гайде Foraging →' },
    text: [
      'Hunting — навык с острова Galatea (центр — Tangleburg). Ты ловишь мобов и получаешь их осколок (Shard). Все осколки попадают в Hunting Box (/huntingbox).',
      'Осколок «извлекают» (Syphon) — он прокачивает свой атрибут до X. Атрибут работает всегда, в меню атрибутов его можно выключить. Чем выше редкость, тем меньше осколков нужно: Common — 96, Uncommon — 64, Rare — 48, Epic — 32, Legendary — 24.',
      'Есть три типа осколков: лес, вода и бой. Лесные ловят Lasso, водные — Fishing Net, боевые — Huntaxe + Black Hole. Ещё есть ловушки, соли и фьюжн.',
      tx`Опыт Hunting даётся за пойманный осколок (${HUNT_XP.COMMON}–${HUNT_XP.LEGENDARY} по редкости), за фьюжн и извлечение. Каждый уровень даёт +1 Hunter Fortune и шанс «очаровать» осколок при убийстве любого моба (Charming).`,
    ],
  });

  sections.push({
    kind: 'steps', title: 'С чего начать: обучение в Tangleburg',
    note: 'NPC стоят в Tangleburg на Galatea. Каждый даёт первый инструмент и учит одному способу.',
    items: [
      { title: 'David Hunterborough', text: 'Знакомит с Hunting, ведёт вехи и выдаёт David\'s Cloak в конце обучения.', done: (hunts.combat || 0) > 0 },
      { title: 'Alan → Oden → Albert: боевая охота', text: 'Alan продаёт первый Huntaxe, Oden учит бить моба до 10% здоровья, Albert даёт Small Pocket Black Hole — она «засасывает» моба.', items: ['VENATOR_GENESIS', 'SMALL_POCKET_BLACK_HOLE'], done: (hunts.combat || 0) > 0 },
      { title: 'Jaeger (у Loch): водная охота', text: 'Даёт Basic Fishing Net. Сеть ловит водных существ, урон зависит от Pull.', items: ['BASIC_FISHING_NET'], done: (hunts.fishing || 0) > 0 },
      { title: 'Auryon (к югу от деревни): лесная охота', text: 'Даёт Abysmal Lasso. Брось на моба, держи взгляд, жми ПКМ, когда появится REEL.', items: ['ABYSMAL_LASSO'], done: (hunts.forest || 0) > 0 },
      { title: 'Kysha: фьюжн', text: 'Рядом с Fusion Machine. Объясняет, как из двух осколков сделать новый. Потом Kysha доступна по Abiphone.', done: (x.attributes || []).length > 5 },
    ],
  });

  sections.push({
    kind: 'table', title: 'Способы охоты',
    note: 'Сколько раз ты ловил осколки каждым способом — из статистики профиля.',
    columns: ['Способ', 'Чем', 'Как', 'У тебя'],
    rows: [
      [cell('Combat', { item: 'VENATOR_GENESIS' }), 'Huntaxe + Black Hole', 'Бей моба Huntaxe (он не добивает), ниже 10% здоровья ставь Black Hole. Huntaxe берёт до 25% статов вставленного оружия.', fmt(hunts.combat)],
      [cell('Вода', { item: 'BASIC_FISHING_NET' }), 'Fishing Net', 'Лови сетью водных существ. Часть ловится сразу, у части есть здоровье — урон зависит от Pull.', fmt(hunts.fishing)],
      [cell('Foraging', { item: 'ABYSMAL_LASSO' }), 'Lasso', 'Брось лассо, смотри на моба, пока не кончится выносливость, жми ПКМ на REEL. У некоторых несколько полосок.', fmt(hunts.forest)],
      [cell('Ловушка', { item: 'RETIA_BASICA' }), 'Huntrap', 'Поставь там, где водятся мобы с осколками: через ~24 часа в ней будет осколок.', fmt(hunts.trap)],
      [cell('Соль', { item: 'LUSHLILAC' }), 'Lushlilac и др.', 'Съешь соль (ЛКМ) и убивай мобов как обычно: маленький шанс получить их осколок. Время соли не идёт оффлайн.', fmt(hunts.salt)],
    ],
  });

  sections.push({
    kind: 'table', title: 'Инструменты и где их взять',
    note: 'Почти всё открывается коллекциями Galatea: Vinesap (Huntaxe, Lasso), Sea Lumies (сети), Tender Wood (ловушки), Lushlilac (соли).',
    columns: ['Инструмент', 'Где взять', 'Есть'],
    rows: Object.values(TOOLS).flatMap(t => t.items.map(([id, name, from]) => {
      const have = hasItem(ctx, id);
      return [cell(name, { item: id }), from, cell(have ? 'есть' : '—', { tone: have ? 'good' : 'muted' })];
    })),
  });

  // Мои атрибуты, которые ещё не на максимуме
  const myOpen = [...stacks.entries()].map(([a, n]) => ({ s: cat.byAttr.get(a), n })).filter(r => r.s && attrLevel(r.n, r.s.rarity).left > 0)
    .map(r => ({ ...r, L: attrLevel(r.n, r.s.rarity), inBox: box.find(b => b.sh.id === r.s.id)?.owned || 0 }))
    .sort((a, b) => a.L.left - b.L.left);
  const maxed = [...stacks.entries()].filter(([a, n]) => { const s = cat.byAttr.get(a); return s && attrLevel(n, s.rarity).left === 0; }).length;
  if (myOpen.length) {
    sections.push({
      kind: 'table', title: tx`Твои атрибуты не на максимуме: ${myOpen.length}`,
      note: tx`На максимуме уже ${maxed}. Сверху — те, где осталось меньше всего осколков. «В коробке» — уже лежат в Hunting Box, их можно извлечь.`,
      columns: ['Атрибут', 'Осколок', 'Уровень', 'Ещё осколков', 'В коробке', 'Где взять'],
      rows: myOpen.map(r => [
        r.s.name, cell(r.s.shard, { item: r.s.id }), `${r.L.level}/10`, fmt(r.L.left),
        r.inBox ? cell(tx`×${r.inBox}`, { tone: 'good' }) : '—',
        cell(r.s.source || 'фьюжн, подробности в игре', { tone: r.s.source ? undefined : 'muted' }),
      ]),
    });
  }

  sections.push({
    kind: 'table', title: 'Что качать первым',
    note: tx`Сначала то, что полезно всем и ускоряет саму охоту, потом — по стилю игры. Отмечены твои направления: ${[...focus].map(f => PRIORITY_FOCUS_RU[f]).join(', ')}.`,
    columns: ['Атрибут', 'Осколок', 'Зачем', 'Кому', 'У тебя', 'Где взять'],
    rows: prio.map(p => {
      const L = attrLevel(mine(p.sh.id), p.sh.rarity);
      return [p.sh.name, cell(p.sh.shard, { item: p.sh.id }), p.why, cell(PRIORITY_FOCUS_RU[p.focus], { tone: focus.has(p.focus) ? undefined : 'muted' }),
        cell(L.level >= 10 ? 'X ✓' : `${L.level}/10`, { tone: L.level >= 10 ? 'good' : L.level ? 'warn' : 'muted' }), p.sh.source || 'фьюжн'];
    }),
  });

  sections.push({
    kind: 'table', title: 'Сколько осколков на уровень',
    note: tx`Извлекать осколок можно только с нужным уровнем Hunting. У тебя Hunting ${hl}.`,
    columns: ['Редкость', 'Hunting', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'Всего'],
    rows: RAR.map(r => {
      const ok = hl >= SYPHON_LEVEL[r];
      return [RARITY_RU[r], cell(String(SYPHON_LEVEL[r]), { tone: ok ? 'good' : 'bad' }), ...LEVEL_SHARDS[r].map(n => String(n)), String(LEVEL_SHARDS[r].reduce((a, b) => a + b, 0))];
    }),
  });

  sections.push({
    kind: 'text', title: 'Фьюжн (Fusion Machine)',
    text: [
      'Fusion Machine — в Fusion House в Tangleburg или удалённо через Kysha по Abiphone. Кладёшь два вида осколков, выбираешь один из до трёх результатов.',
      'Обычно нужно 5 осколков каждого вида. Рептилии, амфибии и Elemental-осколки — по 2. Chameleon — 1, и он даёт следующие 3 ID второго осколка.',
      'Особые рецепты дают 2 осколка за раз. Осколки рептилий могут удвоить результат (атрибут Pure Reptile, 2–20%).',
      'Так добываются почти все Hunter Fortune-атрибуты (Newt → Salamander → Lizard King → Leviathan → Megalith) и Hideonring для слотов аксессуаров.',
    ],
  });

  sections.push({
    kind: 'table', title: 'Вехи David Hunterborough',
    note: 'В меню David копятся 30 вех по каждой ветке. Пороги вех Hypixel в API не отдаёт, поэтому показываем только твои счётчики.',
    columns: ['Ветка', 'У тебя', 'Что даёт'],
    rows: DAVID_TRACKS.map(t => [t.ru, fmt(hunts[t.key]), t.gives]),
  });

  // Все осколки: откуда каждый — три таблицы по типу
  for (const c of ['FOREST', 'WATER', 'COMBAT']) {
    const list = cat.list.filter(s => s.category === c);
    sections.push({
      kind: 'table', title: tx`Все осколки: ${CATEGORY_RU[c]} (${list.length})`,
      note: c === 'FOREST' ? 'Редкость, эффект на I уровне и где взять. «Фьюжн» — рецепт пишется как «семейство или тип + что добавить».' : undefined,
      columns: ['Осколок', 'Атрибут', 'Редкость', 'Эффект (I ур.)', 'У тебя', 'Где взять'],
      rows: list.map(s => [cell(s.shard, { item: s.id }), s.name, RARITY_RU[s.rarity] || s.rarity, s.effect || '—',
        mine(s.id) ? cell(lvlText(s), { tone: attrLevel(mine(s.id), s.rarity).left ? 'warn' : 'good' }) : '—',
        cell(s.source || 'нет данных', { tone: s.source ? undefined : 'muted' })]),
    });
  }

  next.sort((a, b) => b.priority - a.priority);
  const total = cat.list.length;
  return {
    summary: tx`Hunting ${hl}, атрибутов ${stacks.size} из ${total}, на максимуме ${maxed}. Осколков в коробке: ${box.reduce((s, b) => s + b.owned, 0)}.`,
    status: !stacks.size ? 'start' : maxed >= total ? 'done' : 'progress',
    level: { label: 'Hunting', value: hl, max: 50 },
    next,
    sections,
  };
}

export default { id: 'hunting', title: 'Hunting: атрибуты и осколки', icon: 'LEASH', group: 'hunting', build };
