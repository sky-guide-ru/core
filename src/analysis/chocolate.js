// Chocolate Factory (Hoppity): что качать дальше и что не забыть.
// Источники чисел:
//  - fandom «Chocolate Factory» (2026-11-23): требования и множители престижей, кап сотрудников 120…220,
//    прибавка сотрудников (+1…+7 Chocolate/с за уровень), базовые цены, Time Tower, Rabbit Shrine, Coach Jackrabbit;
//  - SkyHanni-REPO constants/HoppityEggLocations.json: всего кроликов, вехи фабрики и магазина,
//    кролики-резиденты по островам, места яиц, цены слотов Rabbit Hitman (data/chocolate.json).
import DATA from './data/chocolate.json' with { type: 'json' };
import { tx } from '../../i18n/msg.js';

export const CF = DATA;
// Цена улучшения сотрудника (fandom): первые 10 уровней Rabbit Bro — (30 + 20·CF)·множитель,
// дальше base = (216 + 144·CF)·i², цена уровня L → L+1 = base·1,05^L (i — номер сотрудника с 1).
const BRO_FIRST = [1, 2, 4, 6, 8, 9, 9.5, 10, 10.5, 11];
export function employeeCost(i, level, cf) {
  if (i === 1 && level < 10) return (30 + 20 * cf) * BRO_FIRST[level];
  return (216 + 144 * cf) * i * i * Math.pow(1.05, level);
}
/** Сколько Chocolate до уровня to (без скидки Zeta −1%). */
export function employeeCostTo(i, from, to, cf) {
  let s = 0;
  for (let L = from; L < to; L++) s += employeeCost(i, L, cf);
  return s;
}
// Time Tower: цена уровня = (4,5 млн + 0,5 млн·CF)·множитель уровня
export const TOWER_MULT = [0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 30, 40];
export const towerCost = (nextLevel, cf) => (4.5e6 + 0.5e6 * cf) * (TOWER_MULT[nextLevel - 1] || 0);
// Престиж: [требуется Chocolate с прошлого престижа, множитель, кап сотрудников, предел Chocolate на фабрике]
export const PRESTIGES = {
  1: { need: 0, mult: 1, cap: 120, maxChocolate: 500e6 },
  2: { need: 150e6, mult: 1.1, cap: 140, maxChocolate: 1.2e9 },
  3: { need: 1e9, mult: 1.25, cap: 160, maxChocolate: 4e9 },
  4: { need: 4e9, mult: 1.5, cap: 180, maxChocolate: 10e9 },
  5: { need: 10e9, mult: 2, cap: 200, maxChocolate: 25e9 },
  6: { need: 30e9, mult: 2.5, cap: 220, maxChocolate: 60e9 },
};
export const EMPLOYEES = [
  { key: 'rabbit_bro', name: 'Rabbit Bro', cps: 1 },
  { key: 'rabbit_cousin', name: 'Rabbit Cousin', cps: 2 },
  { key: 'rabbit_sis', name: 'Rabbit Sis', cps: 3 },
  { key: 'rabbit_father', name: 'Rabbit Daddy', cps: 4 },
  { key: 'rabbit_grandma', name: 'Rabbit Granny', cps: 5 },
  { key: 'rabbit_uncle', name: 'Rabbit Uncle', cps: 6 },
  { key: 'rabbit_dog', name: 'Rabbit Dog', cps: 7 },
];
export const TIME_TOWER_MAX = 15;
export const HITMAN_SLOTS = 28; // fandom: всего 28 слотов за 291 611 000 монет
export const SHRINE_COSTS = [10, 20, 30, 40, 60, 80, 100, 120, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700].map(x => x * 1e6);
export const COACH_COSTS = [2.2, 3.9, 5.3, 7.2, 9.7, 13, 18, 24, 32, 43, 59, 79, 110, 140, 190, 260, 350, 480, 650, 870].map(x => x * 1e6);

const short = n => {
  const a = Math.abs(n);
  const f = (v, u) => tx`${(n / v).toLocaleString('ru-RU', { maximumFractionDigits: v >= 1e9 ? 2 : 1 })} ${u}`;
  if (a >= 1e12) return f(1e12, 'трлн');
  if (a >= 1e9) return f(1e9, 'млрд');
  if (a >= 1e6) return f(1e6, 'млн');
  if (a >= 1e3) return f(1e3, 'тыс.');
  return String(Math.round(n));
};
const snake = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const islandRu = k => ({
  HUB: 'Hub', THE_PARK: 'The Park', GOLD_MINES: 'Gold Mine', DEEP_CAVERNS: 'Deep Caverns', DWARVEN_MINES: 'Dwarven Mines',
  CRYSTAL_HOLLOWS: 'Crystal Hollows', THE_FARMING_ISLANDS: 'The Farming Islands', THE_END: 'The End', SPIDER_DEN: "Spider's Den",
  CRIMSON_ISLE: 'Crimson Isle', DUNGEON_HUB: 'Dungeon Hub', BACKWATER_BAYOU: 'Backwater Bayou', GALATEA: 'Galatea',
  LOTUS_ATOLL: 'Lotus Atoll', TORRHUS_CANYON: 'Torrhus Canyon',
}[k] || k.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '));

/** Кап уровня сотрудников: по престижу; Divine-кролики поднимают его на +1 каждый — тогда берём фактический максимум. */
export function employeeCap(prestige, employees = {}) {
  const base = (PRESTIGES[prestige] || PRESTIGES[1]).cap;
  const seen = Math.max(0, ...Object.values(employees).map(Number).filter(Number.isFinite));
  return Math.max(base, seen);
}

/**
 * Советы по фабрике. ch — member.extras.chocolate (parse/profile.js).
 * @returns {{ prestige, maxPrestige, cps, employees: Array, cap, rabbits, tips: Array<{id, prio, title, text, icon?}> }}
 */
export function chocolateAdvice(ch) {
  if (!ch) return null;
  const tips = [];
  const prestige = Math.max(1, ch.prestige || 1);
  const P = PRESTIGES[prestige] || PRESTIGES[1];
  const next = PRESTIGES[prestige + 1];
  const cap = employeeCap(prestige, ch.employees);

  // Сотрудники: сколько уровней до капа и сколько Chocolate/с это даст
  const employees = EMPLOYEES.map((e, i) => {
    const level = Number(ch.employees?.[e.key]) || 0;
    return { ...e, n: i + 1, level, cap, left: Math.max(0, cap - level), gain: Math.max(0, cap - level) * e.cps, hired: level > 0 };
  });
  const baseCps = employees.reduce((s, e) => s + e.level * e.cps, 0);
  const behind = employees.filter(e => e.left > 0);

  // 1. Заряды Time Tower копятся впустую
  if (ch.timeTowerCharges >= 3) {
    tips.push({ id: 'cf-tower-charges', prio: 95, title: 'Time Tower: 3 заряда из 3, запусти',
      text: 'Заряды больше не копятся, пока полная башня стоит. Включи её, пока играешь: час ускоренного производства.' });
  }
  // 2. Chocolate упёрся в предел фабрики
  if (P.maxChocolate && ch.chocolate >= P.maxChocolate * 0.9) {
    tips.push({ id: 'cf-full', prio: 90, title: tx`Chocolate почти под потолок: ${short(ch.chocolate)} из ${short(P.maxChocolate)}`,
      text: 'Сверх предела фабрика не копит. Потрать на улучшения ниже или в Chocolate Shop (траты там открывают кроликов-вех).' });
  }
  // 3. Сотрудники ниже капа
  if (behind.length) {
    const first = behind[0];
    tips.push({ id: 'cf-employees', prio: 80, title: tx`Сотрудники: до капа ${cap} не хватает ${behind.reduce((s, e) => s + e.left, 0)} ур.`,
      text: tx`Подними ${behind.map(e => tx`${e.name} (${e.level}→${cap})`).join(', ')}: это +${short(behind.reduce((s, e) => s + e.gain, 0))} Chocolate/с до множителей. `
        + tx`Всего до капа ≈${short(behind.reduce((s2, e) => s2 + employeeCostTo(e.n, e.level, cap, prestige), 0))} Chocolate. Начни с младших (${first.name}): при равном уровне у них +1 Chocolate/с дешевле.` });
  }
  // 4. Престиж
  if (next) {
    const since = ch.sincePrestige || 0;
    const ready = since >= next.need;
    tips.push({ id: 'cf-prestige', prio: ready ? 88 : 60, icon: 'PRESTIGE_CHOCOLATE_REALM',
      title: ready ? tx`Можно сделать престиж ${prestige + 1}` : tx`Престиж ${prestige + 1}: ${short(since)} из ${short(next.need)}`,
      text: tx`Множитель ${P.mult}× → ${next.mult}×, кап сотрудников ${P.cap} → ${next.cap}${prestige + 1 === 2 ? ', откроется Time Tower' : prestige + 1 === 3 ? ', откроется Rabbit Shrine' : prestige + 1 === 4 ? ', откроется Coach Jackrabbit' : prestige + 1 === 6 ? ', откроются Divine-кролики' : ''}. `
        + (ready ? 'Престиж сбрасывает Chocolate и сотрудников, найденные кролики и Rabbit Barn остаются. Что ещё обнулится, видно в подсказке кнопки престижа: потрать перед ним лишний Chocolate в Chocolate Shop (траты там открывают кроликов-вех).' : tx`Осталось ${short(next.need - since)} Chocolate с прошлого престижа.`) });
  }
  // 5. Апгрейды, которые не сбрасываются престижем
  if (prestige >= 2 && ch.timeTower < TIME_TOWER_MAX) {
    tips.push({ id: 'cf-tower', prio: 70, title: tx`Time Tower: ур. ${ch.timeTower} из ${TIME_TOWER_MAX}`,
      text: tx`Каждый уровень +0,1× к множителю на время работы башни (на ${TIME_TOWER_MAX} ур. +1,5×). Три заряда по 8 часов, каждый — час ускорения.` });
  }
  if (prestige >= 4 && ch.coach != null && ch.coach < COACH_COSTS.length) {
    tips.push({ id: 'cf-coach', prio: 68, title: tx`Coach Jackrabbit: ур. ${ch.coach} из ${COACH_COSTS.length}`,
      text: tx`Следующий уровень ${short(COACH_COSTS[ch.coach])} Chocolate: +0,01× к множителю навсегда (на 20 ур. +0,2×). Самые дешёвые уровни окупаются быстрее всего.` });
  }
  if (prestige >= 3 && ch.shrine != null && ch.shrine < SHRINE_COSTS.length) {
    tips.push({ id: 'cf-shrine', prio: 50, title: tx`Rabbit Shrine: ур. ${ch.shrine} из ${SHRINE_COSTS.length}`,
      text: tx`Следующий уровень ${short(SHRINE_COSTS[ch.shrine])} Chocolate: +2% к шансу более редкого кролика в Hoppity's Hunt. Бери, когда сотрудники и Coach уже на капе.` });
  }
  if (ch.hitmanSlots != null && ch.hitmanSlots < HITMAN_SLOTS) {
    const cost = CF.hitmanCosts[ch.hitmanSlots];
    tips.push({ id: 'cf-hitman', prio: 45, title: tx`Rabbit Hitman: слотов ${ch.hitmanSlots} из ${HITMAN_SLOTS}`,
      text: tx`${cost ? tx`Следующий слот ${short(cost)} монет. ` : ''}Слоты покупаются за монеты (все ${HITMAN_SLOTS} — около 292 млн), часть открывается только на высоком престиже. Hitman ловит пропущенные яйца Hoppity, пока тебя нет в игре.` });
  }

  // 6. Rabbits: вехи фабрики и магазина
  const nextFactory = CF.factoryMilestones.find(m => m.amount > (ch.total || 0));
  if (nextFactory) {
    tips.push({ id: 'cf-milestone', prio: 35, title: tx`Веха фабрики: кролик ${nextFactory.rabbit}`,
      text: tx`Откроется на ${short(nextFactory.amount)} Chocolate за всё время, у тебя ${short(ch.total || 0)}: осталось ${short(nextFactory.amount - (ch.total || 0))}.` });
  }
  if (ch.shopSpent != null) {
    const nextShop = CF.shopMilestones.find(m => m.amount > ch.shopSpent);
    if (nextShop) tips.push({ id: 'cf-shop', prio: 34, title: tx`Веха Chocolate Shop: кролик ${nextShop.rabbit}`,
      text: tx`Откроется, когда потратишь в Chocolate Shop ${short(nextShop.amount)} Chocolate (сейчас ${short(ch.shopSpent)}).` });
  }

  // 7. Rabbits-резиденты, которых ещё нет (каждый живёт в одном месте острова и ловится в любой момент)
  const found = new Set((ch.found || []).map(snake));
  const residents = [];
  const byIsland = [];
  let residentsFound = 0;
  for (const [isl, names] of Object.entries(CF.residents)) {
    const row = { island: isl, islandRu: islandRu(isl), found: [], missing: [] };
    for (const n of names) {
      if (found.has(snake(n))) { residentsFound++; row.found.push(n); } else { residents.push({ island: isl, islandRu: row.islandRu, name: n }); row.missing.push(n); }
    }
    byIsland.push(row);
  }
  byIsland.sort((a, b) => b.missing.length - a.missing.length || a.islandRu.localeCompare(b.islandRu));
  // Формат ключей API неизвестен наверняка: показываем, только если хоть один резидент совпал
  const residentsKnown = residentsFound > 0;
  if (residentsKnown && residents.length) {
    const full = byIsland.filter(r => r.missing.length === r.missing.length + r.found.length).length;
    tips.push({ id: 'cf-residents', prio: 55, title: tx`Rabbits-резиденты: найдено ${residentsFound} из ${residentsFound + residents.length}`,
      text: tx`Они живут на островах круглый год, каждый в своём месте: зайди на остров и кликни по кролику. Не тронуты ${full} ${full === 1 ? 'остров' : full < 5 ? 'острова' : 'островов'} целиком. Список по островам — ниже, места подсвечивает мод SkyHanni.` });
  }

  // 8. Яйца Hoppity по местам (collected_locations в API)
  const eggs = [];
  if (ch.locations && typeof ch.locations === 'object') {
    const got = {};
    for (const [k, v] of Object.entries(ch.locations)) got[String(k).toUpperCase()] = new Set(Array.isArray(v) ? v : []);
    for (const [isl, locs] of Object.entries(CF.eggLocations)) {
      const have = got[isl] || new Set();
      const miss = locs.filter(l => !have.has(l)).length;
      if (miss) eggs.push({ island: isl, islandRu: islandRu(isl), missing: miss, total: locs.length });
    }
    eggs.sort((a, b) => b.missing - a.missing);
  }

  tips.sort((a, b) => b.prio - a.prio);
  return {
    prestige, maxPrestige: CF.maxPrestige, mult: P.mult, cap, baseCps,
    employees, maxedEmployees: !behind.length,
    rabbits: { found: ch.rabbits || 0, total: CF.maxRabbits },
    residents: residentsKnown ? { missing: residents, found: residentsFound, total: residentsFound + residents.length, byIsland } : null,
    eggs: eggs.length ? eggs : null,
    tips,
  };
}
