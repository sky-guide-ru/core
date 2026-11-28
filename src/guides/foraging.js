// Гайд по Foraging: Galatea, Heart of the Forest, Tree Gifts, топоры и их улучшения, Fortune и Sweep,
// осколки Hunting, Agatha и Starlyn Contests, заработок по живым ценам и путь скилла.
// Данные (NEU-REPO, патч 0.27.x) — в foraging-data.js.
import { treePerks } from '../advisor/lib/hotm.js';
import { getItemRu } from '../items-ru/index.js';
import { petLadderSection } from './pets.js';
import { fmt, short, hasItem, bestPet, ladderPos, howText, constants, cell, tone, topNext, lc } from './gathering-util.js';
import { AXES, SIDE_AXES, ARMOR, EQUIP, PETS, BOOSTS, SHARDS, AGATHA_SHOP, MIRIA_SHOP, GIFT_DROPS, SKILL_GATES, LOGS } from './foraging-data.js';
import { tx } from '../../i18n/msg.js';

// Интерактивное дерево HotF делает общий модуль деревьев (server/guides/trees). Пока его нет в ветке —
// показываем запасную таблицу перков.
const trees = await import('./trees/index.js').catch(() => null);

const HOTF_FALLBACK = [0, 3000, 9000, 25000, 60000, 100000, 150000, 200000];
const WHISPER = { FOREST_WHISPERS: 'Forest Whispers', DESERT_WHISPERS: 'Desert Whispers' };
const SKILL_CAP = 50; // NEU leveling_caps.foraging

const KEY_PERKS = {
  sweep: 'Sweep: сколько брёвен ломается за удар',
  foraging_fortune: 'Foraging Fortune: +3 за уровень, больше брёвен',
  luck_of_the_forest: 'Больше лута из Tree Gifts',
  collector: 'Двойные ягоды и ресурсы острова',
  center_of_the_forest: 'Центр дерева: уровень способности топора, +5% Sweep, больше Whispers',
  foraging_madness: '+10 Sweep и +50 Foraging Fortune',
  early_bird: 'Первые 250 деревьев за день: +20 Sweep и +100 Fortune',
  '250_gifts': 'Первые 250 Tree Gifts за день: больше лута и Whispers',
  daily_wishes: 'Whispers за первый вид брёвен за день',
  efficient_forager: 'Foraging Wisdom: быстрее растёт скилл',
  two_for_one: 'Шанс срубить дерево целиком',
  timber: 'Timber',
  forest_strength: 'Foraging Fortune и Sweep от силы',
  forest_speed: 'Foraging Fortune и Sweep от скорости',
  tree_whisperer: '+200 Whispers с каждого Tree Gift',
  starlyn_supreme: 'Больше очков в Starlyn Contests',
};

// В NEU (leveling.HOTF) — опыт на каждый уровень, не накопленный: уровень 1 с нуля, дальше суммируем.
export function hotfLevel(xp, t) {
  let lvl = 0, acc = 0;
  for (const need of t) { if (xp >= acc + need) { acc += need; lvl++; } else break; }
  const nx = t[lvl];
  return { level: lvl, max: t.length, toNext: nx != null ? acc + nx - xp : 0 };
}

const stat = (id, key) => Number(getItemRu(id)?.stats?.[key] || 0);
const ownedItem = (ctx, id) => ctx.owned?.get?.(id)?.[0] || null;
const lvlOf = s => (s ? s.level : 0);

/** Цена шарда: на Bazaar шарды лежат как SHARD_<ИМЯ>, в базе предметов — ATTRIBUTE_SHARD_<АТРИБУТ>;1 */
const shardPrice = (ctx, s) => ctx.price(tx`SHARD_${s.shard.toUpperCase()}`) || ctx.price(tx`ATTRIBUTE_SHARD_${s.attr.toUpperCase()};1`);

export default {
  id: 'foraging', title: 'Foraging: Galatea и Heart of the Forest', icon: 'HELIX_CHOPPER', group: 'foraging',
  build(m, ctx) {
    const C = constants(ctx);
    const skill = m.skills?.foraging;
    const sLvl = lvlOf(skill);
    const cap = skill?.maxLevel || SKILL_CAP;
    const xp = Number(m.hotfXp || 0);
    const hl = hotfLevel(xp, C.leveling?.HOTF || ctx.adv?.data?.hotf || HOTF_FALLBACK);
    const nodes = m.hotfNodes || {};
    const ga = m.gather || {};
    const perks = treePerks(nodes, C.hotflayout?.hotf);
    const taken = perks.filter(p => p.level > 0);
    const open = perks.filter(p => p.tier <= hl.level);
    const notTaken = open.filter(p => p.level === 0);
    const wh = ga.whispers || {};
    const gifts = ga.treeGifts || {};
    const giftMs = gifts.milestone_tier_claimed || {};
    const hina = ga.hina || {};
    const starlynPb = ga.starlyn?.personal_bests?.agatha || 0;
    const attrs = new Map((m.extras?.attributes || []).map(a => [String(a.id).toLowerCase(), a.n]));
    const next = [];
    const sections = [];

    // ---------- Снаряжение игрока ----------
    const axe = ladderPos(ctx, AXES.map(a => a.id));
    const axeInfo = axe.best >= 0 ? AXES[axe.best] : null;
    const axeNext = axe.best + 1 < AXES.length ? AXES[axe.best + 1] : null;
    const axeItem = axe.have ? ownedItem(ctx, axe.have) : null;
    const sideAxe = SIDE_AXES.filter(id => hasItem(ctx, id));
    const armor = ARMOR.map(a => ({ ...a, have: a.ids.map(id => hasItem(ctx, id)) })).map(a => ({ ...a, n: a.have.filter(Boolean).length }));
    const topArmor = armor.reduce((mx, a, i) => (a.n >= 2 ? i : mx), -1);
    const eq = EQUIP.map(e => ({ ...e, pos: ladderPos(ctx, e.ladder) }));
    const pets = PETS.map(p => ({ ...p, pet: bestPet(ctx, p.type) }));

    // Sweep и Fortune от снаряжения: топор + лучшая часть брони в каждом слоте + снаряжение
    let gearSweep = 0, gearFortune = 0;
    if (axe.have) { gearSweep += stat(axe.have, 'Sweep'); gearFortune += stat(axe.have, 'Foraging Fortune'); }
    for (let slot = 0; slot < 4; slot++) {
      const best = [...armor].reverse().find(a => a.have[slot]);
      if (best) { gearSweep += stat(best.ids[slot], 'Sweep'); gearFortune += stat(best.ids[slot], 'Foraging Fortune'); }
    }
    for (const e of eq) if (e.pos.have) { gearSweep += stat(e.pos.have, 'Sweep'); gearFortune += stat(e.pos.have, 'Foraging Fortune'); }

    // ================= Что делать =================
    if (hl.level > 0 && !taken.length) {
      next.push({
        title: 'Открой дерево Heart of the Forest: ни одного перка не взято', priority: 88,
        why: tx`У тебя HotF ${hl.level}, а токены ещё не потрачены. Начни с ${notTaken.filter(p => KEY_PERKS[p.id]).slice(0, 4).map(p => p.name).join(', ') || 'перков нижнего ряда'}: это сразу больше брёвен и Tree Gifts. Forest Whispers уже накоплено ${short(wh.forest?.total || 0)} за всё время — их хватит на первые уровни.`,
      });
    } else if (notTaken.length) {
      next.push({ title: tx`Не взято перков HotF: ${notTaken.length}`, priority: 60, why: notTaken.slice(0, 6).map(p => tx`${p.name}${KEY_PERKS[p.id] ? tx` (${lc(KEY_PERKS[p.id])})` : ''}`).join('; ') + '.' });
    }
    const unfinished = taken.filter(p => p.level < p.max);
    if (unfinished.length) {
      next.push({ title: tx`Вкладывай Whispers в перки HotF: ${unfinished.length} не на максимуме`, priority: 62, why: tx`${unfinished.slice(0, 5).map(p => tx`${p.name} ${p.level}/${p.max}`).join(', ')}. Forest Whispers — с Fig и Mangrove, Desert Whispers — с Helix.` });
    }
    if (hl.level < hl.max) {
      next.push({ title: tx`Подними Heart of the Forest: ${hl.level} → ${hl.max}`, priority: 70, why: tx`До следующего уровня ${fmt(hl.toNext)} опыта HotF. Опыт дают задания Hina, рубка деревьев на Galatea и Tree Gifts; каждый уровень — новый ряд перков и токен.` });
    }

    // Топор
    if (!axeInfo) {
      const a = AXES[0];
      next.push({
        title: sLvl >= a.req ? tx`Скрафти первый топор Galatea: ${ctx.name(a.id)}` : tx`Foraging ${sLvl} → ${a.req}, чтобы взять ${ctx.name(a.id)}`, priority: 80,
        why: tx`${sideAxe.length ? tx`Сейчас у тебя только ${sideAxe.map(id => ctx.name(id)).join(', ')} — без Frenzy и с малым Fortune. ` : ''}${ctx.name(a.id)}: +${a.sweep} Sweep, +${a.fortune} Foraging Fortune и Frenzy (+1 Sweep за каждые ${fmt(a.frenzy[0])} брёвен, до +${a.frenzy[1]}). ${howText(ctx, a.id)}.`,
        item: a.id,
      });
    } else if (axeNext) {
      const can = sLvl >= axeNext.req;
      next.push({
        title: can ? tx`Улучши топор: ${ctx.name(axe.have)} → ${ctx.name(axeNext.id)}` : tx`Foraging ${sLvl} → ${axeNext.req} для ${ctx.name(axeNext.id)}`, priority: can ? 64 : 50,
        why: tx`+${axeNext.sweep - axeInfo.sweep} Sweep и +${axeNext.fortune - axeInfo.fortune} Fortune к топору. ${howText(ctx, axeNext.id)}. Счётчик брёвен (Frenzy) при апгрейде начинается заново, так что не тяни.`,
        item: axeNext.id,
      });
    }
    if (axeItem) {
      const fix = [];
      if (axeItem.reforge !== 'moonglade') fix.push('перековка Moonglade (Moonglade Jewel у Agatha за 50 купонов)');
      if (!(axeItem.upgrades || []).some(u => u.id === 'WOOD_SINGULARITY')) fix.push(tx`Wood Singularity (+25 Fortune, ~${short(ctx.price('WOOD_SINGULARITY'))})`);
      if (fix.length) next.push({ title: tx`Докрути топор ${ctx.name(axe.have)}`, priority: 52, why: tx`Не хватает: ${fix.join('; ')}. Плюс бустеры Foraging Fortune или Sweep (Sawyer, 50 тыс.).`, item: axe.have });
    }

    // Броня
    if (topArmor < ARMOR.length - 1) {
      const nx = ARMOR[topArmor + 1];
      const can = sLvl >= nx.req;
      const cost = nx.mat ? nx.craft.reduce((s, n) => s + n, 0) * ctx.price(nx.mat) : nx.npcCoins;
      next.push({
        title: can ? tx`Броня Foraging: ${nx.name}` : tx`Foraging ${sLvl} → ${nx.req} для брони ${nx.name}`, priority: topArmor < 0 ? 58 : 46,
        why: tx`+${nx.sweep} Sweep${nx.fortune ? tx` и +${nx.fortune} Fortune` : ''} за каждую часть. ${nx.how[0].toUpperCase() + nx.how.slice(1)}${cost ? tx`, весь сет ~${short(cost)} монет` : ''}. Нужен Foraging ${nx.req}.`,
        item: nx.ids[1],
      });
    }
    const eqNext = eq.filter(e => e.pos.next);
    if (eqNext.length) next.push({ title: tx`Снаряжение Galatea: ${eqNext.map(e => ctx.name(e.pos.next)).join(', ')}`, priority: 40, why: eqNext.map(e => tx`${ctx.name(e.pos.next)}: ${howText(ctx, e.pos.next)}`).join(' • '), item: eqNext[0].pos.next });

    // Питомец
    const sloth = pets.find(p => p.type === 'SLOTH');
    if (!sloth.pet) next.push({ title: 'Возьми питомца Sloth', priority: 55, why: tx`Лучший питомец для Galatea: ${sloth.why}. Где взять: ${sloth.how}.`, item: 'SLOTH;4' });
    else if (sloth.pet.tier !== 'LEGENDARY') next.push({ title: tx`Подними редкость Sloth (${sloth.pet.tier.toLowerCase()})`, priority: 38, why: 'Kat в Hub повышает редкость за Sloth Claw — их продаёт Miria за купоны. Legendary открывает все способности.', item: 'GIANT_SLOTH_CLAW' });

    // Осколки
    const shardHave = SHARDS.filter(s => attrs.get(s.attr));
    if (shardHave.length < 2) {
      next.push({ title: 'Осколки Hunting для Foraging', priority: 34, why: tx`Атрибуты дают Sweep и Fortune по конкретным деревьям: ${SHARDS.slice(0, 3).map(s => tx`${s.shard} — ${lc(s.what)}`).join('; ')}. Первые два продаёт Agatha за купоны конкурсов.`, item: 'ATTRIBUTE_SHARD_FIG_SHARPENING;1' });
    }

    // Skill
    if (sLvl < cap) {
      const gate = SKILL_GATES.find(([lv]) => lv > sLvl);
      next.push({
        title: tx`Foraging ${sLvl} → ${gate ? gate[0] : cap}`, priority: sLvl < 25 ? 66 : 42,
        why: tx`${gate ? tx`На ${gate[0]} открывается: ${gate[1]}. ` : ''}${skill?.xpForNext ? tx`До следующего уровня ${short(skill.xpForNext - (skill.xpCurrent || 0))} опыта. ` : ''}Быстрее всего — рубить Fig и Mangrove с перком Efficient Forager, перековкой Moonglade и Ocelot.`,
      });
    }

    // Hina и контесты
    if ((hina.tier_claimed || 0) < 3) {
      next.push({ title: tx`Задания Hina: тир ${hina.tier_claimed || 0}, выполнено ${fmt(hina.completed_tasks_count || 0)}`, priority: 50, why: 'Hina в Moonglade Marsh — главный источник заданий на Galatea: её задачи открывают зоны и дают опыт HotF и Whispers. Забирай награды за тиры.' });
    }
    next.push({ title: starlynPb ? tx`Starlyn Contest у Agatha: побей рекорд ${fmt(starlynPb)}` : 'Сыграй Starlyn Contest у Agatha', priority: 36, why: 'Конкурс по рубке: очки за брёвна, награда — Agatha\'s Coupons (Frog, шарды Crow/Heron, Moonglade Jewel). Очки поднимают Sloth, Torrhus Belt (+10%) и перк Starlyn Supreme.' });

    // ================= Секции =================
    const hasTree = typeof trees?.hotfTreeSection === 'function';
    sections.push({
      kind: 'table', title: 'Где ты сейчас',
      columns: ['Что', 'Сейчас', 'Комментарий'],
      rows: [
        ['Foraging', cell(`${sLvl}/${cap}`, { tone: tone(sLvl >= cap, sLvl >= 25) }), sLvl < 25 ? 'Galatea-снаряжение требует 12–30' : sLvl < cap ? 'дальше — ради силы и SkyBlock XP' : 'максимум'],
        ['Heart of the Forest', cell(`${hl.level}/${hl.max}`, { tone: tone(hl.level >= hl.max, hl.level >= 4) }), hl.level < hl.max ? tx`до следующего ${fmt(hl.toNext)} опыта` : 'максимум'],
        ['Перки HotF', cell(taken.length ? tx`${taken.length} взято` : 'не взяты', { tone: taken.length ? 'good' : 'bad' }), tx`токенов потрачено: ${fmt(ga.tokensForest || 0)}`],
        ['Forest Whispers', short(wh.forest?.available ?? wh.forest?.total ?? 0), wh.forest?.available == null ? 'API отдаёт только сколько получено всего' : 'свободно'],
        ['Desert Whispers', short(wh.desert?.available ?? wh.desert?.total ?? 0), 'с деревьев Helix (Torrhus Canyon)'],
        ['Sweep от снаряжения', cell(fmt(gearSweep), { tone: gearSweep >= 100 ? 'good' : gearSweep ? 'warn' : 'bad' }), 'топор + броня + снаряжение, без перков и питомца'],
        ['Fortune от снаряжения', cell(fmt(gearFortune), { tone: gearFortune >= 200 ? 'good' : gearFortune ? 'warn' : 'bad' }), 'Foraging Fortune: шанс лишних брёвен'],
        ['Hina', tx`тир ${hina.tier_claimed ?? 0}`, tx`заданий выполнено: ${fmt(hina.completed_tasks_count || 0)}`],
        ['Starlyn (Agatha)', starlynPb ? tx`рекорд ${fmt(starlynPb)}` : 'не играл', 'рекорд очков в конкурсе'],
      ],
    });

    sections.push({
      kind: 'steps', title: 'Путь по Galatea',
      items: [
        { title: 'Задания Hina', text: 'Hina в Moonglade Marsh выдаёт задания острова: они открывают зоны и дают опыт Heart of the Forest.', done: (hina.tier_claimed || 0) >= 3, current: (hina.tier_claimed || 0) < 3 },
        { title: 'Fig Hew и Canopy (Foraging 12)', text: 'Первый топор — крафт из Enchanted Fig Log и Stretching Sticks (падают из Fig Tree Gifts). Броню Canopy продаёт Amaury.', done: axe.best >= 0 && armor[0].n + armor[1].n + armor[2].n >= 4, items: ['FIG_AXE', 'CANOPY_CHESTPLATE'] },
        { title: 'Heart of the Forest', text: 'Токены — на Sweep, Foraging Fortune и Luck of the Forest; Whispers — на уровни перков и Center of the Forest.', done: taken.length > 0 && hl.level >= hl.max, current: !taken.length },
        { title: 'Sloth и купоны контестов', text: 'Sloth — у Miria (Torrhus Canyon), Frog и шарды Crow/Heron — у Agatha. Купоны дают Starlyn Contests.', done: !!sloth.pet, items: ['SLOTH;4'] },
        { title: 'Figstone (Foraging 15)', text: 'Figstone Splitter и броня Fig: 160× Enchanted Fig Log = 1 Figstone (или дроп с Hewver).', done: axe.best >= 1 && topArmor >= 1, items: ['FIGSTONE_AXE', 'FIG_CHESTPLATE'] },
        { title: 'Helix (Foraging 20–25)', text: 'Helix Chopper и броня Helix из Helixis (160× Enchanted Helix Log). Деревья Helix дают Desert Whispers для верхних рядов HotF.', done: axe.best >= 2 && topArmor >= 2, items: ['HELIX_CHOPPER', 'HELIX_ARMOR_CHESTPLATE'] },
        { title: 'Эндгейм', text: 'Honeycomb Necklace и Veilshroom Bracelet (Foraging 30), атрибуты Hunting на максимум, Jade Dragon.', done: eq.every(e => !e.pos.next) },
      ],
    });

    if (hasTree) {
      try { const t = trees.hotfTreeSection(m, ctx); if (t) sections.push(t); } catch (e) { console.warn('[foraging] дерево HotF:', e.message); }
    } else if (perks.length) {
      sections.push({
        kind: 'table', title: 'Дерево Heart of the Forest',
        note: tx`HotF ${hl.level}/${hl.max}: открыты ряды 1–${hl.level}. Токенов потрачено: ${fmt(ga.tokensForest || 0)}. Зелёный — на максимуме, жёлтый — взят, красный — доступен, но не взят.`,
        columns: ['Перк', 'Ряд', 'Уровень', 'Ресурс', 'Зачем'],
        rows: perks.filter(p => p.tier <= Math.max(hl.level, 1) + 1).map(p => [
          cell(p.name, { tone: p.level >= p.max ? 'good' : p.level > 0 ? 'warn' : p.tier <= hl.level ? 'bad' : 'muted' }),
          p.tier, `${p.level}/${p.max}`, WHISPER[p.powder] || '—', KEY_PERKS[p.id] || '',
        ]),
      });
    }

    sections.push({
      kind: 'text', title: 'Sweep и Foraging Fortune — что это',
      text: [
        'Sweep — сколько брёвен ломается одним ударом. Это главный стат скорости: дерево Galatea падает за меньше ударов, а за каждое полностью срубленное дерево падает Tree Gift.',
        'Foraging Fortune — шанс получить лишние брёвна: 100 Fortune = в среднем вдвое больше брёвен. Есть и Fortune на конкретное дерево (Fig Fortune, Mangrove Fortune, Helix Fortune) от талисманов Moonglade и атрибутов-коллекционеров.',
        'Бросок топора (ПКМ) рубит дерево издалека, но со штрафом к Sweep. Перк Axe Toss на 10 с убирает штраф, Homing Axe делает бросок самонаводящимся, Ricochet — даёт отскок на соседнее дерево.',
      ],
    });

    sections.push({
      kind: 'table', title: 'Откуда брать Fortune и Sweep',
      note: 'Кроме топора, брони и перков HotF. Цены — Bazaar/аукцион сейчас.',
      columns: ['Что', 'Fortune', 'Sweep', 'Как получить', 'Цена'],
      rows: BOOSTS.map(b => [b.item ? cell(b.what, { item: b.item }) : b.what, b.fortune || '—', b.sweep || '—', b.how, b.item && ctx.price(b.item) ? short(ctx.price(b.item)) : '—']),
    });

    // Стоимость топора с нуля: рынок, а если лотов нет — сумма ингредиентов по цепочке крафта
    const axeCost = [];
    const parts = [30 * ctx.price('ENCHANTED_FIG_LOG') + 8 * ctx.price('STRETCHING_STICKS'), 4 * ctx.price('FIGSTONE'), 3 * ctx.price('HELIXIS') + 8 * ctx.price('FLEXBONE')];
    AXES.forEach((a, i) => { const craft = parts[i] && (i === 0 || axeCost[i - 1]) ? parts[i] + (axeCost[i - 1] || 0) : 0; axeCost[i] = ctx.price(a.id) || craft; });
    sections.push({
      kind: 'table', title: 'Топоры: лестница и улучшения',
      note: tx`Frenzy копит +1 Sweep за брёвна, срубленные на Galatea этим топором. Твой топор: ${axe.have ? ctx.name(axe.have) : 'нет топора Galatea'}${axeItem?.reforge ? tx`, перековка ${axeItem.reforge}` : ''}.`,
      columns: ['Топор', 'Нужен Foraging', 'Sweep / Fortune', 'Frenzy', 'Как получить', 'Стоимость с нуля'],
      current: axe.best >= 0 ? axe.best : undefined,
      rows: AXES.map((a, i) => [
        cell(ctx.name(a.id), { item: a.id, tone: i <= axe.best ? 'good' : 'muted' }),
        cell(a.req, { tone: sLvl >= a.req ? 'good' : 'bad' }),
        tx`+${a.sweep} / +${a.fortune}`,
        tx`+1 за ${fmt(a.frenzy[0])} брёвен, до +${a.frenzy[1]}`,
        a.recipe + (a.gems ? tx`; ${a.gems} слота под камни` : ''),
        axeCost[i] ? tx`~${short(axeCost[i])}` : '—',
      ]),
    });

    sections.push({
      kind: 'table', title: 'Броня и снаряжение',
      columns: ['Что', 'Есть', 'Статы', 'Следующий шаг'],
      rows: [
        ...armor.map(a => {
          const cost = a.mat ? a.craft.reduce((s, n) => s + n, 0) * ctx.price(a.mat) : a.npcCoins;
          return [cell(tx`Броня ${a.name} (Foraging ${a.req})`, { item: a.ids[1] }), cell(`${a.n}/4`, { tone: a.n === 4 ? 'good' : a.n ? 'warn' : 'muted' }), tx`+${a.sweep} Sweep${a.fortune ? tx`, +${a.fortune} Fortune` : ''} за часть`, a.n === 4 ? 'собрано' : tx`${a.how}${cost ? tx`, сет ~${short(cost)}` : ''}`];
        }),
        ...eq.map(e => [cell(e.slot, { item: e.pos.have || e.ladder[0] }), e.pos.have ? ctx.name(e.pos.have) : 'нет', e.ladder.map(id => tx`${ctx.name(id)}: +${stat(id, 'Sweep')}/+${stat(id, 'Foraging Fortune')}`).join(' → '), e.pos.next ? tx`${ctx.name(e.pos.next)}: ${howText(ctx, e.pos.next)}` : 'максимум']),
      ],
    });

    sections.push(petLadderSection(ctx, 'foraging'));

    sections.push({
      kind: 'table', title: 'Осколки Hunting для Foraging',
      note: tx`Осколок кладёшь в Hunting Box и прокачиваешь атрибут (до 10 уровней). У тебя Hunting ${lvlOf(m.skills?.hunting)}.`,
      columns: ['Осколок', 'Атрибут', 'Твой уровень', 'Где взять', 'Цена'],
      rows: SHARDS.map(s => {
        const n = attrs.get(s.attr) || 0;
        const p = shardPrice(ctx, s);
        return [cell(s.shard, { item: tx`ATTRIBUTE_SHARD_${s.attr.toUpperCase()};1` }), s.what, cell(n ? tx`${n} осколков` : 'нет', { tone: n ? 'good' : 'muted' }), s.how, p ? short(p) : '—'];
      }),
    });

    sections.push({
      kind: 'table', title: 'Agatha, Miria и Starlyn Contests',
      note: tx`Agatha (Moonglade Marsh) проводит Starlyn Contests — конкурсы по рубке на очки. Награда — Agatha's Coupons, за лучшие результаты — Agatha's Prize. Твой рекорд: ${starlynPb ? fmt(starlynPb) : 'нет'}. Очки поднимают Sloth, Torrhus Belt (+10%) и перк Starlyn Supreme. У Miria (Torrhus Canyon) свой магазин за Miria's Coupon.`,
      columns: ['Что', 'Цена', 'Зачем'],
      rows: [
        ...AGATHA_SHOP.map(([id, price, why]) => [cell(ctx.name(id).replace(/^\[Lvl \{LVL\}\] /, ''), { item: id }), tx`Agatha: ${price}`, why]),
        ...MIRIA_SHOP.map(([id, price, why]) => [cell(ctx.name(id).replace(/^\[Lvl \{LVL\}\] /, ''), { item: id }), tx`Miria: ${price}`, why]),
      ],
    });

    sections.push({
      kind: 'table', title: 'Tree Gifts: что падает',
      note: tx`Tree Gift падает за каждое полностью срубленное дерево: всегда Forest Essence и Whispers. Твои подарки: Fig ${fmt(gifts.FIG || 0)}${giftMs.FIG ? tx` (веха ${giftMs.FIG})` : ''}, Mangrove ${fmt(gifts.MANGROVE || 0)}${giftMs.MANGROVE ? tx` (веха ${giftMs.MANGROVE})` : ''}, Helix ${fmt(gifts.HELIX || 0)}${giftMs.HELIX ? tx` (веха ${giftMs.HELIX})` : ''}.`,
      columns: ['Предмет', 'Из какого дерева', 'Шанс', 'Цена'],
      rows: GIFT_DROPS.map(d => [cell(ctx.name(d.id), { item: d.id }), d.from, d.chance, ctx.price(d.id) ? short(ctx.price(d.id)) : '—']),
    });

    // Заработок: сколько стоят брёвна и выгодно ли перерабатывать
    const logRows = LOGS.map(l => {
      const e = ctx.price(l.ench), mat = ctx.price(l.mat);
      const per1k = e ? e / 160 * 1000 : ctx.price(l.id) * 1000;
      const craft = e && mat ? mat - 160 * e : null;
      return { l, e, mat, per1k, craft };
    });
    const bestLog = [...logRows].sort((a, b) => b.per1k - a.per1k)[0];
    if (bestLog?.per1k) {
      const crafty = logRows.filter(r => r.craft > 0).sort((a, b) => b.craft - a.craft)[0];
      next.push({ title: tx`Заработок: ${bestLog.l.name} сейчас дороже всех`, priority: 30, why: tx`1000 брёвен ${bestLog.l.name} ≈ ${short(bestLog.per1k)} монет на Bazaar.${crafty ? tx` ${ctx.name(crafty.l.mat)} выгоднее продавать, чем 160× ${ctx.name(crafty.l.ench)}: +${short(crafty.craft)} за штуку.` : ' Переработка в Figstone/Mangcore/Helixis сейчас не окупается — продавай Enchanted брёвна.'}`, item: bestLog.l.ench });
    }
    sections.push({
      kind: 'table', title: 'Заработок с Galatea',
      note: 'Цены Bazaar прямо сейчас (мгновенная продажа). «Переработка» — сколько добавляет крафт 160× Enchanted → материал: плюс — выгоднее продавать материал, минус — продавай Enchanted брёвна. Ещё деньги: редкий дроп Tree Gifts (таблица выше) и осколки Hunting.',
      columns: ['Брёвна', 'Enchanted', '1000 брёвен', 'Материал', 'Переработка'],
      rows: logRows.map(r => [
        cell(r.l.name, { item: r.l.ench }),
        r.e ? short(r.e) : 'нет данных',
        r.per1k ? short(r.per1k) : '—',
        cell(tx`${ctx.name(r.l.mat)}${r.mat ? ` ${short(r.mat)}` : ''}`, { item: r.l.mat }),
        r.craft == null ? '—' : cell(tx`${r.craft > 0 ? '+' : ''}${short(r.craft)}`, { tone: r.craft > 0 ? 'good' : 'bad' }),
      ]),
    });

    sections.push({
      kind: 'table', title: tx`Путь скилла Foraging до ${cap}`,
      note: tx`Кап Foraging — ${cap}. Каждый уровень даёт силу и SkyBlock XP. Опыт ускоряют: перк Efficient Forager (Foraging Wisdom), перековка Moonglade, бустер Foraging Wisdom, Ocelot, Foraging Exp Boost на питомце, Booster Cookie.`,
      columns: ['Уровень', 'Что открывает', 'Статус'],
      rows: SKILL_GATES.map(([lv, what]) => [lv, what, cell(sLvl >= lv ? 'открыто' : tx`нужно ещё ${lv - sLvl}`, { tone: sLvl >= lv ? 'good' : 'muted' })]),
    });

    const done = hl.level >= hl.max && axe.best >= 2 && topArmor >= 2;
    const status = done ? 'done' : sLvl ? 'progress' : 'start';
    return {
      summary: [skill ? tx`Foraging ${sLvl}` : null, tx`HotF ${hl.level}/${hl.max}`, taken.length ? tx`перков ${taken.length}` : 'перки HotF не взяты', axe.have ? ctx.name(axe.have) : 'нет топора Galatea'].filter(Boolean).join(' · '),
      status,
      level: { label: 'Heart of the Forest', value: hl.level, max: hl.max },
      next: topNext(next),
      sections,
    };
  },
};
