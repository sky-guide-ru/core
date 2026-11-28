// Гайд по рыбалке: уровень, удочки и броня, Sea Creatures, Trophy Fish, события, заработок и что делать дальше.
import { petLadderSection, petNextStep } from './pets.js';
import {
  RODS, ROD_PARTS, ARMOR, armorIds, EQUIPMENT, CREATURES, ZONES, TROPHY_FISH, TIERS, TIER_RU, TROPHY_RANKS,
  DROPS, FISHING_PETS, COLLECTIONS, trophyTierCounts,
} from './fishing-data.js';
import { fmtCoins, fmtNum } from '../advisor/lib/util.js';
import { tx } from '../../i18n/msg.js';

// ---------- календарь SkyBlock ----------
// Год 1 начался 11.06.2019 17:55 UTC; день = 20 минут, месяц = 31 день, год = 12 месяцев.
const SB_EPOCH = 1560275700000, DAY = 20 * 60_000, MONTH = 31 * DAY, YEAR = 12 * MONTH;
const MONTHS = ['Early Spring', 'Spring', 'Late Spring', 'Early Summer', 'Summer', 'Late Summer', 'Early Autumn', 'Autumn', 'Late Autumn', 'Early Winter', 'Winter', 'Late Winter'];

/** Дата SkyBlock: { year, month (0..11), day (1..31) } */
export function sbDate(t = Date.now()) {
  const d = t - SB_EPOCH;
  return { year: Math.floor(d / YEAR) + 1, month: Math.floor((d % YEAR) / MONTH), day: Math.floor((d % MONTH) / DAY) + 1 };
}
/** Начало дня SkyBlock (мс) */
const sbTime = (year, month, day) => SB_EPOCH + (year - 1) * YEAR + month * MONTH + (day - 1) * DAY;

/** Ближайшее окно события: { active, start, end } */
function nextWindow(t, month, fromDay, toDay) {
  const { year } = sbDate(t);
  for (const y of [year, year + 1]) {
    const start = sbTime(y, month, fromDay), end = sbTime(y, month, toDay) + DAY;
    if (t < end) return { active: t >= start, start, end };
  }
  return null;
}

function inHours(ms) {
  const h = ms / 3600_000;
  if (h < 1) return tx`через ${Math.max(1, Math.round(h * 60))} мин`;
  if (h < 48) return tx`через ${Math.round(h)} ч`;
  return tx`через ${Math.round(h / 24)} дн.`;
}

// ---------- разбор профиля ----------
function trophyState(tf = {}) {
  const fish = TROPHY_FISH.map(f => {
    const tiers = Object.fromEntries(TIERS.map(t => [t, Number(tf[tx`${f.key}_${t}`] || 0)]));
    const total = Number(tf[f.key] || 0) || TIERS.reduce((s, t) => s + tiers[t], 0);
    // «Серебро или выше» — есть хоть одна рыба этого тира или старше
    const atLeast = Object.fromEntries(TIERS.map((t, i) => [t, TIERS.slice(i).some(x => tiers[x] > 0)]));
    const best = [...TIERS].reverse().find(t => tiers[t] > 0) || null;
    return { ...f, tiers, total, atLeast, best };
  });
  const count = t => fish.filter(f => f.atLeast[t]).length;
  const rewards = Array.isArray(tf.rewards) ? tf.rewards.map(Number) : null; // null — API не отдал поле
  const ranks = TROPHY_RANKS.map(r => {
    const have = r.need === 'diamond' ? fish.filter(f => TIERS.every(t => f.tiers[t] > 0)).length : count(r.need);
    const claimed = rewards ? rewards.includes(r.n) : null;
    return { ...r, have, ready: have >= r.count, claimed };
  });
  return { fish, ranks, total: Number(tf.total_caught || 0) || fish.reduce((s, f) => s + f.total, 0), lastCaught: tf.last_caught || null, rewardsKnown: !!rewards };
}

const killsOf = (c, kills) => c.keys.reduce((s, k) => s + Number(kills?.[k] || 0), 0);

function ownedRod(ctx) {
  return RODS.filter(r => ctx.has(r.id));
}
function armorOwned(ctx, a) {
  return armorIds(a).filter(id => ctx.has(id)).length;
}

// ---------- сам гайд ----------
export default {
  id: 'fishing', title: 'Fishing', icon: 'FISHING_ROD', group: 'fishing',
  build(m, ctx) {
    const sk = m.skills?.fishing || { level: 0, maxLevel: 50, progress: 0 };
    const lvl = sk.level || 0;
    const f = m.fishing || {};
    const kills = f.kills || {};
    const tf = trophyState(f.trophyFish || m.crimson?.trophyFish || {});
    const now = ctx.now || Date.now();
    const price = id => ctx.price(id);
    const name = id => ctx.name(id);

    // Удочки
    const rods = ownedRod(ctx);
    const bestWater = [...RODS].reverse().find(r => r.kind === 'water' && ctx.has(r.id));
    const bestLava = [...RODS].reverse().find(r => r.kind === 'lava' && ctx.has(r.id));
    const nextLava = RODS.find(r => r.kind === 'lava' && r.lvl > (bestLava?.lvl ?? -1) && !ctx.has(r.id));
    const nextWater = RODS.find(r => r.kind === 'water' && r.lvl > (bestWater?.lvl ?? -1) && !ctx.has(r.id));

    // Броня
    const armor = ARMOR.map(a => ({ ...a, owned: armorOwned(ctx, a) }));
    const bestLavaArmor = [...armor].reverse().find(a => a.kind === 'lava' && a.owned >= 2);
    const nextLavaArmor = armor.find(a => a.kind === 'lava' && a.lvl > (bestLavaArmor?.lvl ?? -1) && a.owned < 4);

    // Существа, которых можно ловить сейчас, и ближайшие разблокировки
    const unlockNext = CREATURES.filter(c => c.lvl && c.lvl > lvl).sort((a, b) => a.lvl - b.lvl);

    // События
    const spooky = nextWindow(now, 7, 29, 31);      // Autumn 29–31
    const jerry = nextWindow(now, 11, 1, 31);       // Late Winter: Jerry's Workshop открыт
    const sb = sbDate(now);

    // ---------- что делать дальше ----------
    const next = [];
    const novice = tf.ranks[0], adept = tf.ranks[1], expert = tf.ranks[2];
    for (const r of tf.ranks) {
      if (r.ready && r.claimed === false) next.push({ title: tx`Забери награду «${r.name}» у Odger`, why: tx`Условие выполнено (${r.have}/${r.count}). Награда: ${r.reward}.`, priority: 95 });
    }
    if (!tf.rewardsKnown && novice.ready) {
      next.push({ title: 'Проверь награды Trophy Fisher у Odger', why: tx`Для Novice хватает (${novice.have} видов на бронзу+), а API не показал, забрана ли награда. Без неё не ловится Thunder.`, priority: 70 });
    }
    if (lvl >= 35 && !ctx.has('HELLFIRE_ROD')) {
      next.push({ title: 'Улучши удочку до Hellfire Rod', why: tx`Fishing ${lvl} ≥ 35. Hellfire Rod: +20% Sea Creature Chance и +25 Trophy Chance против +15%/+20 у Inferno Rod.${price('HELLFIRE_ROD') ? tx` Цена сейчас около ${fmtCoins(price('HELLFIRE_ROD'))}.` : ''}`, priority: 85 });
    } else if (nextLava && lvl >= nextLava.lvl) {
      next.push({ title: tx`Возьми ${name(nextLava.id)} для лавы`, why: tx`Требует Fishing ${nextLava.lvl}, у тебя ${lvl}. ${nextLava.note}.`, priority: 80 });
    }
    if (nextLavaArmor && lvl >= nextLavaArmor.lvl) {
      const thunder = nextLavaArmor.set === 'THUNDER';
      next.push({
        title: tx`Собери ${nextLavaArmor.name} (${nextLavaArmor.owned}/4)`,
        why: thunder ? tx`Fishing ${lvl} уже открывает Thunder: лови его в лаве Crimson Isle, Thunder Fragment идёт на крафт сета (+4% SCC за часть против 3% у лавовых частей).` : nextLavaArmor.note || '',
        priority: 80,
      });
    }
    const missBronze = tf.fish.filter(x => !x.atLeast.bronze);
    if (missBronze.length) {
      const names = missBronze.map(x => x.name);
      next.push({ title: tx`Поймай ${names.length > 3 ? tx`ещё ${names.length} видов трофеев` : tx`недостающие трофеи: ${names.join(', ')}`}`, why: missBronze.map(x => tx`${x.name} — ${x.how}`).join('; ') + '.', priority: 75 });
    }
    if (novice.ready && !adept.ready) {
      const miss = tf.fish.filter(x => !x.atLeast.silver).map(x => x.name);
      next.push({ title: tx`Adept Trophy Fisher: серебро ещё у ${miss.length} видов`, why: tx`Нужно серебро или выше у всех 18. Не хватает: ${miss.join(', ')}. Награда открывает Lord Jawbus.`, priority: 65 });
    } else if (adept.ready && !expert.ready) {
      const miss = tf.fish.filter(x => !x.atLeast.gold).map(x => x.name);
      next.push({ title: tx`Expert Trophy Fisher: золото ещё у ${miss.length} видов`, why: tx`Не хватает: ${miss.join(', ')}.`, priority: 50 });
    }
    if (lvl < 45) {
      const u = unlockNext[0];
      next.push({ title: `Качай Fishing до 45`, why: tx`Сейчас ${lvl}. ${u ? tx`Следующее существо: ${u.name} на ${u.lvl}. ` : ''}На 45 открываются Lord Jawbus и Magma Lord Armor. ${lvl >= 27 ? 'Основной опыт — лава Crimson Isle.' : 'До 27 — вода: Backwater Bayou, Moonglade Marsh на Galatea и Хотспоты; с 27 — лава Crimson Isle.'}`, priority: 60 });
    } else if (lvl < sk.maxLevel) {
      next.push({ title: tx`Качай Fishing до ${sk.maxLevel}`, why: 'Уровни Fishing дают здоровье и Treasure Chance, а также опыт SkyBlock.', priority: 30 });
    }
    if (spooky?.active) next.push({ title: 'Идёт Spooky Festival — лови Spooky существ', why: 'Phantom Fisher и Grim Reaper ловятся только сейчас; Spooky Bait и Spooky Hook повышают шанс.', priority: 90 });
    if (jerry?.active) next.push({ title: "Открыт Jerry's Workshop — зимняя рыбалка", why: 'Yeti и Reindrake ловятся только в Late Winter. Ice/Frozen Bait работают только там.', priority: 88 });
    const petStep = petNextStep(ctx, 'fishing', FISHING_PETS.some(t => m.pets?.some(p => p.type === t)) ? 30 : 55);
    if (petStep) next.push(petStep);
    next.sort((a, b) => b.priority - a.priority);

    // ---------- секции ----------
    const sections = [];
    const fished = f.itemsFished || {};
    sections.push({
      kind: 'table', title: 'Твоя рыбалка в цифрах', columns: ['Показатель', 'Значение'],
      rows: [
        ['Уровень Fishing', tx`${lvl} из ${sk.maxLevel}${lvl < sk.maxLevel ? tx` (${Math.round((sk.progress || 0) * 100)}% до ${lvl + 1})` : ''}`],
        ['Всего выловлено', fmtNum(fished.total)],
        ['Сокровища (обычные / крупные / outstanding)', tx`${fmtNum(fished.treasure)} / ${fmtNum(fished.large_treasure)} / ${fmtNum(fished.outstanding)}`],
        ['Убито Sea Creatures', fmtNum(f.seaCreatureKills)],
        ['Trophy Fish поймано', fmtNum(tf.total)],
        ['Лучшая удочка для воды', bestWater ? { text: name(bestWater.id), item: bestWater.id } : { text: 'нет', tone: 'warn' }],
        ['Лучшая удочка для лавы', bestLava ? { text: name(bestLava.id), item: bestLava.id } : { text: 'нет', tone: 'warn' }],
      ],
    });

    // Прогрессия по уровням: шаги
    const stage = (from, to) => lvl >= to ? 'done' : lvl >= from ? 'current' : '';
    const st = (from, to, title, text, items) => { const s = stage(from, to); return { title, text, items, done: s === 'done', current: s === 'current' }; };
    sections.push({
      kind: 'steps', title: 'Путь по уровням',
      note: 'Отмечено по твоему уровню Fishing. Клик по значку открывает рецепт и цену.',
      items: [
        st(0, 10, '1–10: вода, первые существа', 'Любая вода у Fisherman’s Hut в Hub или в Backwater Bayou. Challenging Rod с 5 уровня, Backwater Armor с 5.', ['CHALLENGE_ROD', 'BACKWATER_CHESTPLATE']),
        st(10, 20, '10–20: Rod of Champions и Sponge/Salmon', 'Sea Witch, Sea Archer, Rider of the Deep, Catfish. Rod of Champions с 15, Salmon Armor с 13, Sponge Armor с 17. Fishing Festival: акулы с 5 уровня.', ['CHAMP_ROD', 'SPONGE_CHESTPLATE']),
        st(20, 27, '20–27: Rod of the Sea, Shark Scale, Spooky', 'The Loch Emperor на 20 (Moonglade Marsh, Galatea), Diver’s Armor, Rod of Legends → Rod of the Sea (24). Shark Scale Armor (24) из чешуи Great White Shark. На Spooky Festival: Phantom Fisher (21), Grim Reaper (26).', ['ROD_OF_THE_SEA', 'SHARK_SCALE_CHESTPLATE']),
        st(27, 36, '27–36: лава Crimson Isle', 'Magma Rod (27) → Inferno Rod (30) → Hellfire Rod (35). Броню собираешь по частям с лавовых существ: Slug Boots, Moogma Leggings, Flaming Chestplate, Taurus Helmet. Параллельно Trophy Fish у Odger.', ['MAGMA_ROD', 'INFERNO_ROD', 'HELLFIRE_ROD']),
        st(36, 45, '36–45: Thunder и Thunder Armor', 'Thunder ловится после награды Novice Trophy Fisher. Из Thunder Fragment — Thunder Armor (36). Цель — 45 и награда Adept, чтобы открыть Lord Jawbus.', ['THUNDER_CHESTPLATE', 'THUNDER_SHARDS']),
        st(45, 50, '45–50: Lord Jawbus и Magma Lord', 'Magma Lord Armor (45) из Magma Lord Fragment. Radioactive Vial — самый дорогой дроп. Дальше бестиарий и Expert/Master Trophy Fisher.', ['MAGMA_LORD_CHESTPLATE', 'MAGMA_LORD_FRAGMENT']),
      ],
    });

    // Удочки
    sections.push({
      kind: 'table', title: 'Удочки', columns: ['Удочка', 'Где', 'Fishing', 'Чем хороша', 'Цена', 'У тебя'],
      note: 'Детали удочки (крючок, леска, грузило) ставит Roddy в Backwater Bayou.',
      rows: RODS.map(r => [
        { text: name(r.id), item: r.id },
        r.kind === 'lava' ? 'лава' : 'вода',
        { text: String(r.lvl), tone: lvl >= r.lvl ? 'good' : 'bad' },
        r.note,
        price(r.id) ? fmtCoins(price(r.id)) : '—',
        ctx.has(r.id) ? { text: 'есть', tone: 'good' } : { text: 'нет', tone: 'muted' },
      ]),
      current: RODS.findIndex(r => r === (nextLava || nextWater)),
    });

    sections.push({
      kind: 'table', title: 'Детали удочки (Roddy)', columns: ['Деталь', 'Слот', 'Fishing', 'Эффект', 'Цена'],
      rows: ROD_PARTS.map(p => [
        { text: name(p.id), item: p.id }, p.slot, { text: String(p.lvl), tone: lvl >= p.lvl ? 'good' : 'bad' }, p.text, price(p.id) ? fmtCoins(price(p.id)) : '—',
      ]),
      note: lvl >= 30 ? 'Тебе уже доступна Titan Line (+2 Double Hook Chance): двойной улов существ = вдвое больше опыта и дропа.' : undefined,
    });

    // Броня
    sections.push({
      kind: 'table', title: 'Броня', columns: ['Сет', 'Где', 'Fishing', 'Откуда', 'Частей у тебя'],
      rows: armor.map(a => [
        { text: a.name, item: armorIds(a)[1] },
        a.kind === 'lava' ? 'лава' : 'вода',
        { text: String(a.lvl || '—'), tone: lvl >= a.lvl ? 'good' : 'bad' },
        a.note || '—',
        { text: `${a.owned}/4`, tone: a.owned >= 4 ? 'good' : a.owned ? 'warn' : 'muted' },
      ]),
      current: nextLavaArmor ? armor.indexOf(nextLavaArmor) : undefined,
    });

    sections.push({
      kind: 'checklist', title: 'Снаряжение',
      items: [
        ...EQUIPMENT.map(e => ({ text: tx`${e.tier} Cloak/Belt/Gloves (+${e.fs} Fishing Speed за часть)`, done: ctx.has(e.id) || ctx.has(e.id.replace('CLOAK', 'BELT')), item: e.id })),
      ],
    });
    sections.push(petLadderSection(ctx, 'fishing'));

    // Trophy Fish
    sections.push({
      kind: 'table', title: tx`Trophy Fish (${tf.fish.filter(x => x.atLeast.bronze).length}/18 видов)`,
      note: 'Ловится удочкой для лавы в Crimson Isle. Сдавай Odger на вершине Blazing Volcano. Точные условия, шансы, гарантия на 100-й/600-й улов и личный план до алмаза — в гайде «Trophy Fish».',
      columns: ['Рыба', 'Как поймать', 'Бронза', 'Серебро', 'Золото', 'Алмаз', 'Всего'],
      rows: tf.fish.map(x => [
        { text: x.name, item: tx`${x.key.toUpperCase()}_${(x.best || 'bronze').toUpperCase()}` },
        x.how,
        ...TIERS.map(t => x.tiers[t] ? { text: fmtNum(x.tiers[t]), tone: 'good' } : { text: '—', tone: 'muted' }),
        x.total ? fmtNum(x.total) : { text: 'не поймана', tone: 'bad' },
      ]),
    });
    sections.push({
      kind: 'checklist', title: 'Награды Odger (Trophy Fisher)',
      note: tf.rewardsKnown ? undefined : 'API не показал, какие награды уже забраны: отметки ниже — по выполненным условиям.',
      items: tf.ranks.map(r => ({
        text: tx`${r.name}: ${r.need === 'bronze' ? tx`${r.count} видов на бронзу или выше` : r.need === 'diamond' ? 'все тиры у всех 18 видов' : tx`${TIER_RU[r.need]} или выше у всех 18`}`,
        done: r.claimed ?? r.ready,
        hint: tx`${r.have}/${r.count} · ${r.reward}${r.ready && r.claimed === false ? ' · можно забрать!' : ''}`,
        item: tx`${r.armor}_CHESTPLATE`,
      })),
    });

    // Sea Creatures
    const zoneRows = Object.keys(ZONES).flatMap(z => CREATURES.filter(c => c.zone === z).map(c => {
      const k = killsOf(c, kills);
      return [
        ZONES[z],
        c.name,
        c.lvl ? { text: String(c.lvl), tone: lvl >= c.lvl ? 'good' : 'bad' } : { text: '—', tone: 'muted' },
        c.where,
        c.cap ? { text: tx`${fmtNum(k)} / ${fmtNum(c.cap)}`, tone: k >= c.cap ? 'good' : k ? undefined : 'muted' } : fmtNum(k),
      ];
    }));
    sections.push({
      kind: 'table', title: 'Sea Creatures и бестиарий', columns: ['Зона', 'Существо', 'Fishing', 'Где и когда', 'Убито / макс. бестиарий'],
      note: 'Уровни — по вики; «—» — требование пока нигде не описано (новые существа). Убийства — из бестиария профиля.',
      rows: zoneRows,
    });

    // События
    const ev = (w, title) => w ? (w.active ? tx`${title}: идёт сейчас, закончится ${inHours(w.end - now)}` : tx`${title}: начнётся ${inHours(w.start - now)}`) : null;
    sections.push({
      kind: 'text', title: 'События',
      note: tx`Сейчас в SkyBlock: ${sb.day} ${MONTHS[sb.month]}, год ${sb.year}.`,
      text: [
        ev(spooky, 'Spooky Festival (Autumn 29–31)') + '. Scarecrow (9), Nightmare (14), Werewolf (17), Phantom Fisher (21), Grim Reaper (26) — в любой воде. Бери Spooky Bait и Spooky Hook.',
        ev(jerry, "Jerry's Workshop (Late Winter)") + '. Frozen Steve, Frosty, Grinch, Yeti (25), Reindrake (35). Ice Bait и Frozen Bait работают только там.',
        'Fishing Festival — первые 3 дня каждого месяца SkyBlock, когда мэр Marina. Акулы: Nurse (5), Blue (10), Tiger (18), Great White (24); Shark Bait +20% к шансу акул.',
        'Хотспоты — светящиеся места на воде и лаве: в них свои существа и бонусы. Hotspot Bait, Hotspot Hook и Hotspot Sinker усиливают.',
      ],
    });

    // Заработок
    const dropRows = DROPS.map(d => [{ text: name(d.id), item: d.id }, d.from, price(d.id) ? fmtCoins(price(d.id)) : '—', d.note || '']);
    const magma = price('MAGMA_FISH');
    const filletValue = magma ? tf.fish.reduce((s, x) => s + TIERS.reduce((a, t, i) => a + x.tiers[t] * x.fillet[i], 0), 0) * magma : 0;
    const methods = (ctx.analysis?.methods || []).filter(x => x.tag === 'Fishing');
    sections.push({
      kind: 'table', title: 'Заработок: что продаётся', columns: ['Предмет', 'С кого', 'Цена сейчас', 'Зачем'],
      note: 'Цены живые (Bazaar / мин. BIN). Доход в час на рыбалке держится на редких дропах, поэтому сильно скачет.',
      rows: dropRows,
    });
    const moneyText = [
      'Лава Crimson Isle (с Fishing 36 и 45): Thunder → Thunder Fragment, Lord Jawbus → Magma Lord Fragment и редкий Radioactive Vial. Двойной крючок (Titan Line, Double Hook Chance) удваивает дроп.',
      tx`Trophy Fishing: трофеи разделывают у Odger на Magmafish.${filletValue ? tx` Все твои пойманные трофеи по сегодняшней цене Magmafish стоили бы около ${fmtCoins(filletValue)} (если бы их разделали).` : ''}`,
      'Spooky Festival: дропы Phantom Fisher и Grim Reaper; Fishing Festival: зубы и плавники акул, особенно Great White Shark Tooth.',
      ...methods.map(x => tx`${x.title}: ${x.coinsPerHour ? tx`около ${fmtCoins(x.coinsPerHour)} в час` : 'доход зависит от удачи'} (${x.sourceText})${x.ready ? '' : tx`; не хватает: ${(x.missing || []).join(', ')}`}.`),
    ];
    sections.push({ kind: 'text', title: 'Заработок: как', text: moneyText });

    // Коллекции
    const col = m.collections || {};
    sections.push({
      kind: 'table', title: 'Коллекции рыбалки', columns: ['Коллекция', 'Собрано'],
      rows: COLLECTIONS.map(([id, n]) => [{ text: n, item: id }, fmtNum(col[id] || 0)]),
    });

    const tiers = f.trophyTiers || trophyTierCounts(f.trophyFish || {});
    const summary = tx`Fishing ${lvl}/${sk.maxLevel} · трофеи: видов ${tiers.species}/18, алмаз ${tiers.tiers.diamond.exact}/18 · удочка для лавы: ${bestLava ? name(bestLava.id) : 'нет'}`;
    return {
      summary,
      status: lvl >= sk.maxLevel && tf.ranks[3].ready ? 'done' : lvl > 0 ? 'progress' : 'start',
      level: { label: 'Fishing', value: lvl, max: sk.maxLevel || 50 },
      next: next.slice(0, 7),
      sections,
      // Для своего компонента страницы
      extra: { tierCounts: tiers, trophy: tf.fish.map(x => ({ key: x.key, name: x.name, rarity: x.rarity, tiers: x.tiers, how: x.how })), ranks: tf.ranks, rods: rods.map(r => r.id) },
    };
  },
};
