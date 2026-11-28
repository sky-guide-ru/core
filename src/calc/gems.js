import { tx, ru } from '../../i18n/msg.js';
// Gemstones в снаряжении: какие слоты есть у вещей игрока, что в них стоит, какой камень и какого качества
// поставить под роль вещи, сколько стоит открыть слот и что выгоднее за монету.
// Слоты и цена открытия — constants/gemstonecosts NEU (у свободных слотов список пуст), вставленные камни — NBT предмета.
// Статы камней — таблица официальной вики (hypixelskyblock.minecraft.wiki «Gemstone/Stats», сверено 28.11.2026):
// Aquamarine с 0.22 даёт Fishing Speed, Citrine удвоен в 0.23.3. Слоты Chisel дают перки Fossil Excavator, а не статы — их не считаем.
// Чистые функции: цены, роль и запасы передаются снаружи.

export const QUALITIES = ['ROUGH', 'FLAWED', 'FINE', 'FLAWLESS', 'PERFECT'];
const RARITY_IDX = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5, DIVINE: 6 };

/** Стат камня по качеству и редкости вещи: [Common, Uncommon, Rare, Epic, Legendary, Mythic, Divine]; null — так не бывает */
export const GEM_STATS = {
  RUBY: { ROUGH: [1, 2, 3, 4, 5, 7, null], FLAWED: [3, 4, 5, 6, 8, 10, null], FINE: [4, 5, 6, 8, 10, 14, null], FLAWLESS: [5, 7, 10, 14, 18, 22, null], PERFECT: [6, 9, 13, 18, 24, 30, null] },
  AMETHYST: { ROUGH: [1, 2, 3, 4, 5, 7, null], FLAWED: [3, 4, 5, 6, 8, 10, null], FINE: [4, 5, 6, 8, 10, 14, null], FLAWLESS: [5, 7, 10, 14, 18, 22, null], PERFECT: [6, 9, 13, 18, 24, 30, null] },
  JADE: { ROUGH: [2, 4, 6, 8, 10, 12, 14], FLAWED: [3, 5, 7, 10, 14, 18, 22], FINE: [5, 7, 10, 15, 20, 25, 30], FLAWLESS: [7, 10, 15, 20, 27, 35, 44], PERFECT: [10, 14, 20, 30, 40, 50, 60] },
  SAPPHIRE: { ROUGH: [2, 3, 4, 5, 6, 7, null], FLAWED: [5, 5, 6, 8, 10, 10, null], FINE: [7, 8, 9, 10, 11, 12, null], FLAWLESS: [10, 11, 12, 14, 17, 20, null], PERFECT: [12, 14, 17, 20, 24, 30, null] },
  AMBER: { ROUGH: [4, 8, 12, 16, 20, 24, 28], FLAWED: [6, 10, 14, 18, 24, 30, 36], FINE: [10, 14, 20, 28, 36, 45, 54], FLAWLESS: [14, 20, 30, 44, 58, 75, 92], PERFECT: [20, 28, 40, 60, 80, 100, 120] },
  TOPAZ: { ROUGH: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.5], FLAWED: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.9], FINE: [1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.3], FLAWLESS: [1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.8], PERFECT: [2, 2, 2, 2, 2, 2, 2.2] },
  JASPER: { ROUGH: [1, 1, 1, 2, 3, 4, null], FLAWED: [2, 2, 3, 4, 4, 5, null], FINE: [3, 3, 4, 5, 6, 7, null], FLAWLESS: [5, 6, 7, 8, 10, 12, null], PERFECT: [6, 7, 9, 11, 13, 16, null] },
  OPAL: { ROUGH: [1, 1, 1, 2, 2, 3, null], FLAWED: [2, 2, 2, 3, 3, 4, null], FINE: [3, 3, 3, 4, 4, 5, null], FLAWLESS: [4, 4, 5, 6, 8, 9, null], PERFECT: [5, 6, 7, 9, 11, 13, null] },
  ONYX: { ROUGH: [1, 1, 2, 2, 3, 4, null], FLAWED: [2, 2, 3, 3, 4, 6, null], FINE: [3, 3, 4, 5, 6, 8, null], FLAWLESS: [4, 5, 6, 7, 8, 10, null], PERFECT: [5, 6, 7, 8, 10, 12, null] },
  AQUAMARINE: { ROUGH: [0.5, 0.5, 1, 1, 1.5, 2, null], FLAWED: [1, 1, 1.5, 1.5, 2, 2.5, null], FINE: [1.5, 1.5, 2, 2, 2.5, 3, null], FLAWLESS: [2, 2, 2.5, 3, 3.5, 4, null], PERFECT: [2.5, 2.5, 3.5, 4, 4.5, 5, null] },
  CITRINE: { ROUGH: [1, 1, 2, 2, 3, 4, null], FLAWED: [3, 3, 4, 5, 6, 8, null], FINE: [4, 4, 6, 8, 10, 12, null], FLAWLESS: [6, 6, 8, 10, 12, 16, null], PERFECT: [6, 8, 10, 12, 16, 20, null] },
  PERIDOT: { ROUGH: [0.5, 1, 1.5, 2, 2.5, 3, null], FLAWED: [1, 1.5, 2, 2.5, 3, 4, null], FINE: [1.5, 2, 3, 4, 5, 6, null], FLAWLESS: [2, 3, 4, 5, 6, 8, null], PERFECT: [3, 4, 5, 6, 8, 10, null] },
};

/** Какой стат даёт камень (названия статов — как в игре) */
export const GEM_STAT = {
  RUBY: 'Health', AMETHYST: 'Defense', JADE: 'Mining Fortune', SAPPHIRE: 'Intelligence', AMBER: 'Mining Speed', TOPAZ: 'Pristine',
  JASPER: 'Strength', OPAL: 'True Defense', ONYX: 'Crit Damage', AQUAMARINE: 'Fishing Speed', CITRINE: 'Foraging Fortune', PERIDOT: 'Farming Fortune',
};
const PCT = new Set(['ONYX']); // Crit Damage пишется в процентах

/** Какие камни подходят в слот (вики «Gemstone Slot»). Offensive и Chisel остались на старых вещах */
export const SLOT_GEMS = {
  COMBAT: ['JASPER', 'SAPPHIRE', 'RUBY', 'AMETHYST', 'ONYX', 'OPAL'],
  OFFENSIVE: ['JASPER', 'SAPPHIRE'],
  DEFENSIVE: ['RUBY', 'AMETHYST', 'OPAL'],
  MINING: ['JADE', 'AMBER', 'TOPAZ'],
  CHISEL: ['CITRINE', 'AQUAMARINE', 'PERIDOT', 'ONYX'],
  UNIVERSAL: Object.keys(GEM_STATS),
};

/** Снять камень у Gemstone Grinder (вики): сам камень возвращается */
export const REMOVE_COST = { ROUGH: 1, FLAWED: 100, FINE: 10_000, FLAWLESS: 100_000, PERFECT: 500_000 };

/** Какой камень нужен роли — по порядку предпочтения */
export const ROLE_GEMS = {
  melee: ['JASPER', 'ONYX', 'RUBY'], archer: ['JASPER', 'ONYX', 'RUBY'], mage: ['SAPPHIRE', 'RUBY'], tank: ['AMETHYST', 'RUBY', 'OPAL'],
  mining: ['JADE', 'AMBER', 'TOPAZ'], farming: ['PERIDOT'], fishing: ['AQUAMARINE'], foraging: ['CITRINE'],
};
const ROLE_RU = { melee: 'ближний бой', archer: 'лук', mage: 'маг', tank: 'танк', mining: 'Mining', farming: 'Farming', fishing: 'Fishing', foraging: 'Foraging' };

const title = s => String(s || '').toLowerCase().split('_').map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
export const gemId = (quality, gem) => tx`${quality}_${gem}_GEM`;
export const gemName = (quality, gem) => tx`${title(quality)} ${title(gem)} Gemstone`;

// На Talisman of Power и его улучшениях камни дают половину стата (вики «Gemstone Slot»)
const HALF = new Set(['POWER_TALISMAN', 'POWER_RING', 'POWER_ARTIFACT', 'POWER_RELIC']);

/** Стат камня на вещи этой редкости; null — неизвестно. itemId — для вещей с половинным статом */
export function gemStat(gem, quality, rarity, itemId = null) {
  const row = GEM_STATS[gem]?.[quality];
  if (!row) return null;
  const i = RARITY_IDX[String(rarity || '').toUpperCase()] ?? 4; // Special и неизвестная редкость — как Legendary
  const v = row[i] ?? row[Math.min(i, 5)] ?? row.find(x => x != null) ?? null;
  return v != null && HALF.has(itemId) ? v / 2 : v;
}

/** «+13 Strength» / «+2 Pristine» */
export function statText(gem, v) {
  if (v == null) return '';
  return tx`+${String(v).replace('.', ',')}${PCT.has(gem) ? '%' : ''} ${GEM_STAT[gem] || gem}`;
}

/**
 * Камень для слота под роль вещи. stats { strength, crit_damage } — статы игрока: Onyx лучше Jasper,
 * только если Strength больше Crit Damage хотя бы на треть (совет вики «Gemstone Slot»)
 */
export function pickGem(base, role, stats = null) {
  const allowed = SLOT_GEMS[base] || [base];
  if (allowed.length === 1) return allowed[0];
  if ((role === 'melee' || role === 'archer') && allowed.includes('ONYX') && stats?.strength > 0 && stats.strength > (stats.crit_damage || 0) * 4 / 3) return 'ONYX';
  return (ROLE_GEMS[role] || []).find(g => allowed.includes(g)) || (base === 'DEFENSIVE' ? 'RUBY' : allowed[0]);
}

/** Что сейчас в слоте: { gem, quality } или null. Формат NBT: { JADE_0: 'PERFECT', COMBAT_0: 'FLAWLESS', COMBAT_0_gem: 'SAPPHIRE' } (качество бывает { quality }) */
export function slotContent(gems, slot) {
  const v = gems?.[slot];
  const quality = typeof v === 'string' ? v : v?.quality || null;
  if (!quality || !QUALITIES.includes(quality)) return null;
  const base = slot.replace(/_\d+$/, '');
  const gem = SLOT_GEMS[base] ? gems[tx`${slot}_gem`] || null : base;
  return gem ? { gem, quality } : null;
}

/**
 * Слоты одной вещи.
 * @param {any} it предмет (normalizeItem): id, rarity, gems
 * @param {{ costs: Record<string,string[]>, role?: string, price?: (id)=>number, sell?: (id)=>number, market?: boolean }} o
 */
export function itemGems(it, o) {
  const costs = o.costs?.[it?.id];
  if (!costs || !Object.keys(costs).length) return null;
  const market = o.market !== false;
  const price = market ? o.price || (() => 0) : () => 0;
  const sell = market ? o.sell || price : () => 0;
  const gems = it.gems || {};
  const unlockedSet = new Set(gems.unlocked_slots || []);
  const slots = [];
  for (const [slot, cost] of Object.entries(costs)) {
    const base = slot.replace(/_\d+$/, '');
    if (base === 'CHISEL') continue; // перки Fossil Excavator, а не статы
    const cur = slotContent(gems, slot);
    const locked = !!(cost?.length) && !unlockedSet.has(slot) && !cur;
    let unlock = null;
    if (locked) {
      const items = []; let coins = 0;
      for (const c of cost) {
        const [id, n] = String(c).split(':');
        if (id === 'SKYBLOCK_COIN') coins += Number(n) || 0;
        else items.push({ id, count: Number(n) || 1, price: price(id) || 0 });
      }
      const itemsCost = items.reduce((s, x) => s + x.count * x.price, 0);
      unlock = { coins, items, cost: market ? (items.every(x => x.price) ? coins + itemsCost : null) : coins };
    }
    const pick = pickGem(base, o.role, o.stats);
    const curStat = cur ? gemStat(cur.gem, cur.quality, it.rarity, it.id) : 0;
    // Камень не под роль (Sapphire у мечника) — заменить даже на ту же редкость; подходящий (Onyx вместо Jasper) — только поднять качество
    const wrongType = !!cur && cur.gem !== pick && !!SLOT_GEMS[base] && !(ROLE_GEMS[o.role] || []).includes(cur.gem);
    const gem = cur && !wrongType ? cur.gem : pick;
    const perfect = gemStat(gem, 'PERFECT', it.rarity, it.id) || 0;
    const options = [];
    for (const q of ['FINE', 'FLAWLESS', 'PERFECT']) {
      const stat = gemStat(gem, q, it.rarity, it.id);
      if (stat == null) continue;
      const same = cur && cur.gem === gem;
      if (same && QUALITIES.indexOf(q) <= QUALITIES.indexOf(cur.quality)) continue;
      const p = price(gemId(q, gem)) || 0;
      // Замена: снять старый камень у Gemstone Grinder (платно) и продать его
      const back = cur ? (sell(gemId(cur.quality, cur.gem)) || 0) - REMOVE_COST[cur.quality] : 0;
      const gain = same ? stat - curStat : stat;
      const total = market ? (p ? Math.max(0, p - back) + (unlock?.cost ?? 0) : null) : null;
      options.push({ quality: q, id: gemId(q, gem), price: p || null, stat, gain, share: perfect ? gain / perfect : 0, cost: total, removeFee: cur ? REMOVE_COST[cur.quality] : 0 });
    }
    // Под бюджет: самое высокое качество, которое стоит не больше 1% денег игрока (у кого 4 млрд — Perfect, у кого 60 млн — Fine).
    // Если и самое дешёвое дороже — всё равно самое дешёвое: шаг просто окажется ниже в списке
    let best = null; let fits = false;
    const priced = options.filter(x => x.cost != null && x.gain > 0);
    if (priced.length) {
      const cap = Math.max(0, (o.coins || 0) * 0.01);
      const ok = priced.filter(x => x.cost <= cap);
      fits = ok.length > 0;
      best = ok.pop() || priced.reduce((a, b) => (b.cost < a.cost ? b : a));
    }
    const done = !!cur && !wrongType && cur.gem === gem && cur.quality === 'PERFECT';
    slots.push({
      slot, base, typeRu: SLOT_GEMS[base] ? tx`${title(base)}` : title(base), locked, unlock,
      current: cur ? { ...cur, id: gemId(cur.quality, cur.gem), name: gemName(cur.quality, cur.gem), stat: curStat, text: statText(cur.gem, curStat) } : null,
      gem, gemRu: title(gem), statName: GEM_STAT[gem], wrongType, done,
      options: options.map(x => ({ ...x, name: gemName(x.quality, gem), text: statText(gem, x.stat) })),
      best: best ? best.quality : null, bestFits: fits,
    });
  }
  if (!slots.length) return null;
  return { id: it.id, name: String(it.name || '').replace(/§./g, '').replace(/\s*[✪➊➋➌➍➎]+\s*/g, ' ').trim(), rarity: it.rarity, role: o.role || null, roleRu: ROLE_RU[o.role] || null, uuid: it.uuid || null, where: it.where || null, slots };
}

/**
 * Гемы во всём снаряжении: вещи со слотами, итоги и самые выгодные шаги.
 * @param {Array<{ item, role, group }>} list  вещи (уже без дубликатов), group: armor | equipment | weapon | tool
 * @param {{ costs, price, sell, market?: boolean, coins?: number, stock?: Record<string, number> }} o
 */
export function gemPlan(list, o = {}) {
  const market = o.market !== false;
  const items = [];
  for (const { item, role, group } of list) {
    const g = itemGems(item, { ...o, role });
    if (g) items.push({ ...g, group });
  }
  const all = items.flatMap(it => it.slots.map(s => ({ it, s })));
  const sum = { items: items.length, slots: all.length, empty: 0, locked: 0, perfect: 0, wrong: 0, toFine: 0, toFlawless: 0, toPerfect: 0, unpriced: 0 };
  const moves = [];
  for (const { it, s } of all) {
    if (s.locked) sum.locked++;
    else if (!s.current) sum.empty++;
    if (s.done) sum.perfect++;
    if (s.wrongType) sum.wrong++;
    for (const [k, q] of [['toFine', 'FINE'], ['toFlawless', 'FLAWLESS'], ['toPerfect', 'PERFECT']]) {
      // До качества: если в слоте уже не хуже — ничего
      const opt = s.options.find(x => x.quality === q);
      if (opt && opt.cost != null) sum[k] += opt.cost;
      else if (opt && market) sum.unpriced++;
    }
    const best = s.options.find(x => x.quality === s.best);
    if (best && !s.done) {
      moves.push({
        item: it.name, itemId: it.id, slot: s.slot, typeRu: s.typeRu, locked: s.locked, gem: s.gem, quality: best.quality, id: best.id, name: best.name, text: best.text,
        gain: best.gain, cost: best.cost, current: s.current?.name || null, replace: !!s.current, wrongType: s.wrongType, unlock: s.unlock,
        // Ценность: доля от Perfect-камня в этом слоте на 1 млн монет; стат не по роли вещи (Intelligence на мече) — втрое ниже
        value: best.share * (ROLE_GEMS[it.role]?.includes(s.gem) || (SLOT_GEMS[s.base] || [s.base]).length > 1 ? 1 : 0.3) / Math.max(0.01, (best.cost || 0) / 1e6),
      });
    } else if (!market && !s.done) {
      moves.push({ item: it.name, itemId: it.id, slot: s.slot, typeRu: s.typeRu, locked: s.locked, gem: s.gem, quality: 'FINE', id: gemId('FINE', s.gem), name: gemName('FINE', s.gem), text: statText(s.gem, gemStat(s.gem, 'FINE', it.rarity)), gain: 0, cost: null, current: s.current?.name || null, replace: !!s.current, wrongType: s.wrongType, unlock: s.unlock, value: s.current ? 0 : 1 });
    }
  }
  // Запасы камней (Gemstone Sack и хранилища) — сначала свои
  const stock = { ...(o.stock || {}) };
  for (const m of moves) {
    if (stock[m.id] > 0) { stock[m.id]--; m.have = true; if (m.cost != null) m.cost = Math.max(0, m.cost - (o.price?.(m.id) || 0)); m.value = 99; }
  }
  moves.sort((a, b) => (b.value - a.value) || ((a.cost ?? 1e15) - (b.cost ?? 1e15)));
  // Что взять на ~20% денег: самые выгодные шаги подряд, пока хватает
  const coins = o.coins || 0;
  let left = coins * 0.2; const pick = [];
  for (const m of moves) { if (m.cost == null || m.cost > left) continue; left -= m.cost; pick.push(m); }
  const budget = market ? { coins: Math.round(coins * 0.2), steps: pick.length, cost: pick.reduce((s, m) => s + m.cost, 0) } : null;
  return { items, summary: { ...sum, budget }, moves: moves.slice(0, 12), market };
}

/** Вещи для разбора: надетое, экипировка, сеты брони, оружие, инструменты — без дубликатов */
export function gemCandidates(gear, member, classify, neuItems) {
  const seen = new Set();
  const out = [];
  const push = (it, group) => {
    if (!it?.id) return;
    const key = it.uuid || tx`${it.id}|${it.where || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    let role = null;
    try { role = classify(it, neuItems?.get?.(it.id), member)?.role || null; } catch { role = null; }
    out.push({ item: it, role, group });
  };
  for (const it of gear?.worn?.armor || []) push(it, 'armor');
  for (const it of gear?.worn?.equipment || []) push(it, 'equipment');
  for (const s of (gear?.armorSets || []).slice(0, 6)) for (const p of s.pieces) push(p, 'armor');
  for (const it of (gear?.equipment || []).slice(0, 8)) push(it, 'equipment');
  for (const it of (gear?.weapons || []).slice(0, 8)) push(it, 'weapon');
  for (const it of (gear?.tools || []).slice(0, 8)) push(it, 'tool');
  return out;
}

const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

/** Короткая строка для «Что подтянуть» в наборе: пустые и слабые слоты на этих вещах */
export function kitGemHint(items, o) {
  const plan = gemPlan(items.map(it => ({ item: it, role: o.role || 'melee', group: 'armor' })), o);
  const empty = plan.summary.empty + plan.summary.locked;
  const top = plan.moves.filter(m => m.cost != null).slice(0, 3);
  if (!top.length) return null;
  const cost = top.reduce((s, m) => s + m.cost, 0);
  const fmt = o.fmt || (n => String(n));
  return empty
    ? ru`Гемы: ${empty} ${plural(empty, 'пустой слот', 'пустых слота', 'пустых слотов')}, выгоднее всего ${top[0].name} (${top[0].text}) — ~${fmt(cost)} за ${top.length} шт.`
    : ru`Гемы: заменить на ${top[0].name} (${top[0].text}) — ~${fmt(cost)} за ${top.length} шт.`;
}
