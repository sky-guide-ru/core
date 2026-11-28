// Снаряжение: лестницы брони/оружия/инструментов под этап и доводка надетого (рекомб, книги, звёзды).
import LADDERS from '../../data/ladders.json' with { type: 'json' };
import { fmtCoins, setPieces, plural } from '../util.js';
import { planItemUpgrades, classify } from '../../../analysis/item-upgrades.js';
import { gemPlan, gemCandidates } from '../../../calc/gems.js';
import { ownKuudraSet, kuudraUpgradePlan, kuudraSetName } from './kuudra-upgrade.js';
import { witherFamily, witherOwned, dungeonLoadout } from '../loadouts.js';
import { ru } from '../../../../i18n/msg.js';
import { tx } from '../../../../i18n/msg.js';

// Первая буква заглавная — одной вставкой, чтобы английская версия нашла заметку в словаре целиком
const capFirst = s => s[0].toUpperCase() + s.slice(1);

const KUUDRA_REP = [0, 1000, 3000, 7000, 12000];
const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
// Сеты для сбора ресурсов: их не качают книгами Hot Potato (дают только здоровье и защиту)
const GATHERING_ARMOR = /^(FERMENTO|HELIANTHUS|SQUASH|CROPIE|MELON|FARM_SUIT|FARM_ARMOR|RANCHERS|PUMPKIN|MINERAL|GLACITE|DIVAN|SORROW|LAPIS_ARMOR|MINER_OUTFIT|ARMOR_OF_YOG|HARDENED_DIAMOND|SPONGE|ANGLER|SHARK_SCALE|DIVER|THUNDER|MAGMA_LORD|BIOHAZARD|SALMON|LUMBERJACK|FIG|ARMOR_OF_THE_RESISTANCE)/;
const MASTER_STARS = ['FIRST_MASTER_STAR', 'SECOND_MASTER_STAR', 'THIRD_MASTER_STAR', 'FOURTH_MASTER_STAR', 'FIFTH_MASTER_STAR'];

/** Актуальна ли лестница для этого профиля. */
function relevant(ctx, l) {
  const m = ctx.m;
  const cls = m.dungeons?.selectedClass;
  const cata = m.dungeons?.catacombs?.level || 0;
  const sk = k => m.skills?.[k]?.level || 0;
  switch (l.id) {
    case 'dungeon-archer-weapon':
    case 'dungeon-mage-weapon':
      return cata >= 15 && (!cls || l.classes.includes(cls));
    case 'dungeon-melee-weapon': return cata >= 15 && l.classes.includes(cls);
    case 'dungeon-armor': return cata >= 15;
    case 'ender-slayer-weapon': return (m.slayers?.enderman?.level || 0) >= 1;
    // Final Destination — броня для прокачки Voidgloom; на максимальном 9 уровне её уже не советуем
    case 'ender-slayer-armor': { const lv = m.slayers?.enderman?.level || 0; return lv >= 1 && lv < 9; }
    case 'zombie-slayer-weapon': return (m.slayers?.zombie?.level || 0) >= 3;
    // До 2 уровня кинжалы ещё нельзя взять в руки: путь к ним описывает шаг «Начни Inferno Demonlord»
    case 'blaze-slayer-weapon': return (m.slayers?.blaze?.level || 0) >= 2;
    case 'kuudra-armor': return !!m.crimson?.faction;
    case 'mining-drill':
    case 'mining-armor': return sk('mining') >= 30;
    case 'farming-armor': return sk('farming') >= 30;
    case 'fishing-armor':
    case 'fishing-rod': return sk('fishing') >= 20;
    default: return true;
  }
}

/** Шаг плана, который открывает тир с таким требованием (уровень слеера, скилла, HotM); null — требование другого вида. */
export function lockStepId(req) {
  if (!req) return null;
  if (req.slayer) return tx`slayer-${req.slayer}`;
  if (req.skill) return tx`skill-${req.skill}`;
  if (req.hotm) return 'hotm';
  return null;
}

export function reqMet(ctx, req) {
  if (!req) return { ok: true };
  const m = ctx.m;
  if (req.slayer) {
    const lvl = m.slayers?.[req.slayer]?.level || 0;
    const floorOk = req.orFloor != null && Number(m.dungeons?.floors?.[String(req.orFloor)] || 0) > 0;
    if (lvl >= req.level || floorOk) return { ok: true };
    return { ok: false, text: ru`нужен ${m.slayers?.[req.slayer]?.name || req.slayer} ${req.level} (у тебя ${lvl})` };
  }
  // Данжевая броня надевается только после прохождения этажа, с которого она падает (Shadow Assassin — F5, Wither — F7)
  if (req.floor != null) {
    const done = Number(m.dungeons?.floors?.[String(req.floor)] || 0) > 0;
    const best = Object.entries(m.dungeons?.floors || {}).filter(([, n]) => Number(n) > 0).map(([f]) => Number(f)).filter(Number.isFinite);
    return done ? { ok: true } : { ok: false, text: ru`пройди F${req.floor} (${best.length ? ru`у тебя пройден F${Math.max(...best)}` : 'этажи ещё не пройдены'})` };
  }
  if (req.masterFloor != null) {
    const done = Number(m.dungeons?.masterFloors?.[String(req.masterFloor)] || 0) > 0;
    return done ? { ok: true } : { ok: false, text: ru`пройди M${req.masterFloor}` };
  }
  if (req.hotm) {
    const lvl = m.mining?.hotm?.level || 0;
    return lvl >= req.hotm ? { ok: true } : { ok: false, text: ru`нужен HotM ${req.hotm} (у тебя ${lvl})` };
  }
  if (req.skill) {
    const lvl = m.skills?.[req.skill]?.level || 0;
    return lvl >= req.level ? { ok: true } : { ok: false, text: ru`нужен ${m.skills?.[req.skill]?.name || req.skill} ${req.level} (у тебя ${lvl})` };
  }
  return { ok: true };
}

const KUUDRA_RU = { '': '', HOT_: 'Hot ', BURNING_: 'Burning ', FIERY_: 'Fiery ', INFERNAL_: 'Infernal ' };
/** Тир с понятным именем (для брони Kuudra имя собирается из семейств). */
export function tierLabel(l, i) {
  const t = l.tiers[i];
  if (l.kind !== 'kuudra-armor') return t;
  // Пять семейств в каждом названии читались как каша — семейство пишем один раз, в скобках
  return { ...t, name: ru`${t.prefix ? KUUDRA_RU[t.prefix].trim() : 'Базовый тир'} (любое: Crimson, Aurora, Terror, Fervor, Hollow)` };
}

/** Индекс лучшего полученного тира (−1 если ничего) и цена тира. */
export function ladderState(ctx, l) {
  const tierOwned = t => {
    if (l.kind === 'kuudra-armor') return l.families.some(f => setPieces(ctx, tx`${t.prefix}${f}`) >= 3);
    // Броня Wither смешивается: Necron + Maxor + Storm… — это один сет с общим бонусом Witherborn
    if (t.set && witherFamily(tx`${t.set}_HELMET`)) return witherOwned(ctx.owned).slotsCovered >= 3 || (dungeonLoadout(ctx.m)?.wither || 0) >= 3;
    if (t.set) return [t.set, ...(t.altSets || [])].some(s => setPieces(ctx, s) >= 3);
    return (t.ids || []).some(id => ctx.owned.has(id));
  };
  const tierPrice = t => {
    if (l.kind === 'kuudra-armor') {
      const per = l.families.map(f => SLOTS.reduce((s, sl) => s + ctx.price(tx`${t.prefix}${f}_${sl}`), 0)).filter(Boolean);
      return per.length ? Math.min(...per) : 0;
    }
    if (t.set) {
      const per = [t.set, ...(t.altSets || [])].map(s => SLOTS.reduce((sum, sl) => sum + ctx.price(tx`${s}_${sl}`), 0)).filter(Boolean);
      return per.length ? Math.min(...per) : 0;
    }
    const ps = (t.ids || []).map(id => ctx.price(id)).filter(Boolean);
    return ps.length ? Math.min(...ps) : 0;
  };
  let best = -1;
  l.tiers.forEach((t, i) => { if (tierOwned(t)) best = i; });
  return { best, tierPrice, tierOwned };
}

/** Лучший лук игрока из лестницы лучника: { idx, name } или null. Лук — отдельный стиль игры, не замена мечу */
function ownedBow(ctx) {
  const l = LADDERS.ladders.find(x => x.style === 'bow');
  if (!l) return null;
  const { best } = ladderState(ctx, l);
  if (best < 0) return null;
  const id = (l.tiers[best].ids || []).find(x => ctx.owned.has(x));
  return { idx: best, name: id ? ctx.name(id) : l.tiers[best].name, top: best >= 1 };
}

export function ladderRules(ctx, add) {
  const bow = ownedBow(ctx);
  for (const l of LADDERS.ladders) {
    if (!relevant(ctx, l)) continue;
    const { best, tierPrice } = ladderState(ctx, l);
    if (best >= l.tiers.length - 1) continue;
    // Цель — самый высокий тир, требования к которому уже выполнены (нет смысла советить Voidwalker при Enderman 7)
    let targetIdx = best + 1;
    for (let i = l.tiers.length - 1; i > best; i--) if (reqMet(ctx, l.tiers[i].req).ok) { targetIdx = i; break; }
    if (l.kind === 'kuudra-armor') {
      // Броня Kuudra — под тот тир Kuudra, который открыт репутацией
      const rep = Math.max(ctx.m.crimson?.barbarianRep || 0, ctx.m.crimson?.mageRep || 0);
      const open = KUUDRA_REP.filter(r => rep >= r).length - 1;
      targetIdx = Math.max(best + 1, Math.min(open, l.tiers.length - 1));
    }
    // Своя броня Kuudra: не «купи», а как улучшить именно её (престиж у кузнеца), с ценой и сравнением с покупкой
    const own = l.kind === 'kuudra-armor' ? ownKuudraSet(ctx, l.families) : null;
    if (own && own.tier === best) {
      const plan = kuudraUpgradePlan(ctx, own, targetIdx);
      const from = kuudraSetName(own.fam, own.tier), to = kuudraSetName(own.fam, targetIdx);
      const cost = !ctx.market ? 0 : plan.cheaper === 'buy' ? plan.buyNet : plan.upgradeCost || plan.buyNet;
      add({
        id: tx`gear-${l.id}`, cat: l.cat, priority: 62 + 8, effort: 'монеты',
        title: plan.cheaper === 'buy' ? ru`Броня Kuudra: ${from} → ${to} (выгоднее купить готовую)` : ru`Улучши свою броню Kuudra: ${from} → ${to}`,
        why: ru`${capFirst(tierLabel(l, targetIdx).note)}. Свой сет не надо менять: каждую часть можно поднять на следующий тир у кузнеца.${cost ? ru` Выйдет ~${fmtCoins(cost)}.` : ''}`,
        how: plan.lines,
        items: [...['ESSENCE_CRIMSON', 'KUUDRA_TEETH'], ...(plan.totals.pearls ? ['HEAVY_PEARL'] : []), ...plan.pieces.map(p => p.id || p.buyId).filter(Boolean)],
        cost: cost || undefined,
        payoff: ru`${to}: больше статов и сильнее бонус сета`,
        link: 'gear',
        mapNode: tx`ladder:${l.id}:${targetIdx}`,
      });
      continue;
    }
    const next = tierLabel(l, targetIdx);
    const req = reqMet(ctx, next.req);
    // Своё оружие/броня уже есть, а следующий тир закрыт уровнем слеера, скилла или HotM — покупать его рано.
    // К нему ведёт свой шаг («Revenant Horror 7 → 8 … Откроет: Halberd of the Shredded»), отдельный «Купить» не показываем.
    // Первый тир ветки (best < 0) остаётся целью: с ним понятно, зачем вообще качать слеера.
    if (best >= 0 && !req.ok && lockStepId(next.req)) continue;
    const cost = tierPrice(next);
    const have = best >= 0 ? tierLabel(l, best).name : null;
    // Самые важные ветки для текущего этапа среднего профиля — данжи и Kuudra
    const base = ({ 'Dungeons': 70, 'Crimson Isle и Kuudra': 62, 'Slayers': 46, 'Mining': 36, 'Garden': 34, 'Fishing': 30 }[l.cat] ?? 40) - (best < 0 && l.kind !== 'kuudra-armor' && l.cat !== 'Dungeons' ? 6 : 0);
    const items = next.ids || (next.set ? SLOTS.map(s => tx`${next.set}_${s}`) : l.families ? SLOTS.map(s => tx`${next.prefix}${l.families[0]}_${s}`) : []);
    // Меч против слеера при сильном луке (Juju, Terminator): лук и ближний бой — разные стили, меч не обязателен.
    // Кинжалы Inferno Demonlord исключение: без нужной Attunement урон по щиту босса режется на 99%
    const bowAlt = l.style === 'melee' && l.cat === 'Slayers' && l.id !== 'blaze-slayer-weapon' && bow?.top;
    add({
      id: tx`gear-${l.id}`, cat: l.cat, priority: base + (req.ok ? 8 : -12) - (bowAlt ? 15 : 0), effort: cost ? 'монеты' : 'часы',
      title: best >= 0 ? tx`${l.titleRu}: ${have} → ${next.name}` : ru`${l.titleRu}: начни с ${next.name}`,
      why: tx`${capFirst(next.note)}.${req.ok ? '' : ru` Сначала ${req.text}.`}${cost ? ru` Цена сейчас ~${fmtCoins(cost)}.` : ''}`,
      how: [
        // Без рынка: где добыть (по первой части сета — у частей один источник), или у какого NPC купить
        !ctx.market && items.length ? (() => { const h = ctx.obtain(items[0]); return h?.kind === 'npc' ? ru`Купить у NPC ${h.npcName}: ${next.name}` : ru`Добыть: ${next.name} — ${h?.text || 'добыть самому'}`; })()
          : cost ? ru`Купить: ${next.name} — ~${fmtCoins(cost)} на Auction House` : ru`Получить: ${next.name}`,
        ...(l.kind === 'kuudra-armor' && ctx.market ? ['Следующий тир можно получить и престижем: часть с 10 звёздами улучшается у кузнеца (Blacksmith) за эссенцию Crimson, Kuudra Teeth и монеты — часто дешевле, чем покупать готовый сет'] : []),
        ...(best >= 0 ? [ctx.market ? ru`Старое снаряжение (${tierLabel(l, best).name}) можно продать, когда перейдёшь на новое` : ru`Старое снаряжение (${tierLabel(l, best).name}) можно продать NPC, когда перейдёшь на новое`] : []),
        ...(bowAlt ? [ru`У тебя есть ${bow.name}: лук — свой стиль игры. Если ходишь на этого босса с луком, меч можно не брать; он нужен для ближнего боя`] : []),
      ],
      items,
      cost: cost || undefined,
      payoff: next.note,
      link: 'gear',
      mapNode: tx`ladder:${l.id}:${targetIdx}`,
    });
  }
}

const isDungeonItem = it => /DUNGEON/.test((it.lore?.[it.lore.length - 1] || '').replace(/§./g, ''));

/** Доводка основного снаряжения: надетая броня + лучшее оружие из лестниц. */
export function upgradeRules(ctx, add) {
  const m = ctx.m;
  const main = [];
  // Надетая броня может быть фермерской/шахтёрской — книги Hot Potato ей бесполезны.
  // Для доводки берём боевую броню: надетую, если она боевая, иначе лучший сет для данжей из хранилищ.
  for (const it of m.inv?.armor || []) if (it?.id && !GATHERING_ARMOR.test(it.id)) main.push(it);
  // Если надет не сет Wither, а он есть в гардеробе — качать надо его (смешанный сет тоже считается)
  const dlo = dungeonLoadout(m);
  if (dlo && !main.some(it => witherFamily(it.id)) && dlo.wither >= 3) {
    main.length = 0;
    for (const p of dlo.pieces) if (!GATHERING_ARMOR.test(p.item.id)) main.push(p.item);
  }
  if (!main.length) {
    const dl = LADDERS.ladders.find(x => x.kind === 'armor' && x.cat === 'Dungeons');
    const st = dl ? ladderState(ctx, dl) : { best: -1 };
    if (st.best >= 0) {
      const t = dl.tiers[st.best];
      const set = [t.set, ...(t.altSets || [])].find(x => setPieces(ctx, x) >= 3);
      for (const slot of SLOTS) { const it = ctx.owned.get(`${set}_${slot}`)?.[0]; if (it) main.push(it); }
    }
  }
  // лучшее оружие: верхний полученный тир лестниц оружия, актуальных для профиля
  for (const l of LADDERS.ladders.filter(x => x.kind === 'weapon' && relevant(ctx, x) && x.cat === 'Dungeons')) {
    const { best } = ladderState(ctx, l);
    if (best < 0) continue;
    const id = l.tiers[best].ids.find(i => ctx.owned.has(i));
    const it = ctx.owned.get(id)?.[0];
    if (it) main.push(it);
  }
  if (!main.length) return;

  const lines = [];
  let cost = 0;
  const items = new Set();
  const masterDone = Object.values(m.dungeons?.masterFloors || {}).some(v => v > 0);
  // Есть константы NEU — точный чек-лист из того же движка, что и в карточке предмета (с ценой каждого шага)
  const constants = ctx.opts?.constants;
  const engine = constants?.enchants && constants?.essencecosts;
  for (const it of main) {
    if (engine) {
      let plan = null;
      try { plan = planItemUpgrades(it, { constants, getItem: () => null, priceOf: ctx.price, petPriceOf: () => 0, member: ctx.m }); } catch { plan = null; }
      if (plan) {
        // Гемы — отдельным шагом «Гемы в снаряжении» (качество под бюджет), здесь не повторяем
        const top = plan.todo.filter(st => st.group !== 'gems' && !st.locked && st.cost != null && st.cost > 0).slice(0, 4);
        if (!top.length) continue;
        for (const st of top) { cost += st.cost; for (const p of st.parts || []) if (p.id && !p.id.startsWith('ESSENCE_')) items.add(p.id); }
        lines.push(ru`${it.name || ctx.name(it.id)} (прокачано на ${plan.score}%): ${top.map(st => tx`${st.title} ~${fmtCoins(st.cost)}`).join('; ')}${plan.todo.length > top.length ? ru` · ещё ${plan.todo.length - top.length} ${plural(plan.todo.length - top.length, 'шаг', 'шага', 'шагов')} в карточке предмета` : ''}`);
        continue;
      }
    }
    const fixes = [];
    if (!it.recomb && ['LEGENDARY', 'MYTHIC', 'EPIC'].includes(it.rarity)) {
      fixes.push('Recombobulator 3000'); cost += ctx.price('RECOMBOBULATOR_3000'); items.add('RECOMBOBULATOR_3000');
    }
    const hpb = it.hpb || 0;
    if (hpb < 10) { fixes.push(tx`Hot Potato Book ×${10 - hpb}`); cost += ctx.price('HOT_POTATO_BOOK') * (10 - hpb); items.add('HOT_POTATO_BOOK'); }
    if (hpb < 15) { const n = Math.min(5, 15 - Math.max(10, hpb)); fixes.push(tx`Fuming Potato Book ×${n}`); cost += ctx.price('FUMING_POTATO_BOOK') * n; items.add('FUMING_POTATO_BOOK'); }
    if (isDungeonItem(it)) {
      const stars = it.stars || 0;
      if (stars < 5) fixes.push(ru`звёзды ${stars}/5 за эссенцию (Wither/Undead/Dragon — смотри в меню улучшения)`);
      else if (stars < 10 && masterDone) {
        const need = MASTER_STARS.slice(stars - 5);
        fixes.push(tx`Master Stars ${stars - 5}/5`);
        for (const s of need) { cost += ctx.price(s); items.add(s); }
      }
    }
    const isWeapon = !/(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/.test(it.id);
    if (isWeapon && !Object.keys(it.enchants || {}).some(e => e.startsWith('ultimate_'))) fixes.push('ультимативное зачарование');
    if (fixes.length) lines.push(tx`${it.name || it.id}: ${fixes.join(', ')}`);
  }
  if (!lines.length) return;
  add({
    id: 'gear-upgrades', cat: 'Снаряжение', priority: 64, effort: 'монеты',
    title: ru`Доведи основное снаряжение до максимума (${lines.length} ${lines.length === 1 ? 'предмет' : lines.length < 5 ? 'предмета' : 'предметов'})`,
    why: ru`Улучшения уже имеющихся вещей почти всегда дешевле, чем следующий сет, а прибавка к урону и защите заметная.${cost ? ru` Всего ~${fmtCoins(cost)}.` : ''}`,
    how: lines,
    items: [...items],
    cost: cost || undefined,
    payoff: 'Больше урона и защиты без смены сета',
    link: 'gear',
  });
}

const MOLTEN = ['MOLTEN_NECKLACE', 'MOLTEN_CLOAK', 'MOLTEN_BELT', 'MOLTEN_BRACELET'];

export function equipmentRules(ctx, add) {
  const eq = ctx.m.inv?.equipment || [];
  const empty = 4 - eq.filter(i => i?.id).length;
  if (empty > 0 && !ctx.m.inv?.apiDisabled) {
    add({
      id: 'gear-equipment', cat: 'Снаряжение', priority: 70, effort: 'минуты, нужны монеты',
      title: ru`Заполни пустые слоты экипировки: ${empty} из 4`,
      why: 'Ожерелье, плащ, пояс и перчатки дают статы так же, как броня. Пустой слот — потерянные характеристики.',
      how: [
        'Ранний вариант: экипировка из Rift и Dojo (Black Belt), Crimson Isle — Molten-экипировка из Kuudra',
        'Для данжей стандарт — Molten-сет или его улучшения с атрибутами',
      ],
      items: MOLTEN,
      // Цена Molten-экипировки на пустые слоты: без неё шаг выглядел бесплатным и вставал наверх даже на пустом профиле
      cost: MOLTEN.map(id => ctx.price(id)).filter(Boolean).sort((a, b) => a - b).slice(0, empty).reduce((a, b) => a + b, 0) || undefined,
      link: 'gear',
    });
  }
}

/** План гемов: из разбора снаряжения (ядро считает его по ценам покупки) или здесь же по ценам плана */
export function gemsOf(ctx) {
  if (ctx.gear?.gems) return ctx.gear.gems;
  const costs = ctx.opts?.constants?.gemstonecosts;
  if (!costs || !ctx.gear) return null;
  try {
    return gemPlan(gemCandidates(ctx.gear, ctx.m, classify), { costs, price: ctx.price, sell: ctx.price, market: ctx.market, coins: ctx.liquid, stock: ctx.m.inv?.sacks });
  } catch { return null; }
}

/** Гемы: пустые и закрытые слоты, камень не под роль — самые выгодные шаги под бюджет игрока */
export function gemRules(ctx, add) {
  const g = gemsOf(ctx);
  if (!g?.moves?.length) return;
  const s = g.summary;
  if (ctx.market) {
    const top = g.moves.filter(m => m.cost != null).slice(0, 5);
    if (!top.length) return;
    const cost = top.reduce((n, m) => n + m.cost, 0);
    const holes = s.empty + s.locked;
    add({
      id: 'gear-gems', cat: 'Снаряжение', priority: s.empty ? 60 : 48, effort: 'минуты, нужны монеты',
      title: holes ? ru`Гемы: ${holes} ${plural(holes, 'пустой или закрытый слот', 'пустых или закрытых слота', 'пустых или закрытых слотов')} в снаряжении` : ru`Гемы: поднять качество камней в снаряжении`,
      why: ru`Камень в слоте даёт стат вещи навсегда. Самые выгодные ${top.length} ${plural(top.length, 'шаг', 'шага', 'шагов')} — ~${fmtCoins(cost)} на Bazaar. Качество подобрано под твои деньги.`,
      how: [
        ...top.map(m => tx`${m.item}, ${m.typeRu} слот: ${m.locked ? ru`открыть слот и вставить ` : m.current ? tx`${m.current} → ` : ru`вставить `}${m.name} (${m.text})${m.have ? ru` — камень уже есть` : ''}${m.cost ? tx` ~${fmtCoins(m.cost)}` : ''}`),
        'Вставить и снять камень — Gemstone Grinder рядом с Geo. Снять платно, камень возвращается',
      ],
      items: [...new Set(top.map(m => m.id))],
      cost,
      payoff: 'Больше статов на тех же вещах',
      link: 'gear',
    });
  } else {
    const top = g.moves.filter(m => !m.locked || !m.unlock?.items?.length).slice(0, 5);
    if (!top.length || !(s.empty + s.locked)) return;
    add({
      id: 'gear-gems', cat: 'Снаряжение', priority: 44, effort: 'нужно добыть',
      title: ru`Гемы: ${s.empty + s.locked} ${plural(s.empty + s.locked, 'пустой слот', 'пустых слота', 'пустых слотов')} в снаряжении`,
      why: 'Камни добываются в Crystal Hollows и крафтятся: 80 штук дают камень следующего качества. Fine — уже хорошая прибавка.',
      how: [
        ...top.map(m => tx`${m.item}, ${m.typeRu} слот: ${m.name} (${m.text})`),
        'Вставить камень — Gemstone Grinder рядом с Geo',
      ],
      items: [...new Set(top.map(m => m.id))],
      link: 'gear',
    });
  }
}
