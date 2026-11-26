// «Сторож»: сжимает профиль в снимок, сравнивает снимки и решает, стоит ли звать ИИ.
// Работает бесплатно (без API) при каждом обновлении профиля или цен.
import { fmtCoins, fmtPct, pct, MIN } from './util.js';
import { tx } from '../../../i18n/msg.js';

const SLAYER_RU = { zombie: 'Revenant (зомби)', spider: 'Tarantula (паук)', wolf: 'Sven (волк)', enderman: 'Voidgloom (эндермен)', blaze: 'Inferno Demonlord (блейз)', vampire: 'Riftstalker (вампир)' };
const CLASS_RU = { healer: 'Healer', mage: 'Mage', berserk: 'Berserk', archer: 'Archer', tank: 'Tank' };
const SKILL_RU = { farming: 'Farming', mining: 'Mining', combat: 'Combat', foraging: 'Foraging', fishing: 'Fishing', enchanting: 'Enchanting', alchemy: 'Alchemy', carpentry: 'Carpentry', runecrafting: 'Runecrafting', taming: 'Taming', social: 'Общение', hunting: 'Охота' };

/**
 * @typedef {Object} Snapshot
 * @property {number} t
 * @property {number} sb
 * @property {number} coins           кошелёк + Bank
 * @property {number|null} networth
 * @property {number} mp
 * @property {Object<string, number>} skills   уровень с дробной частью
 * @property {Object<string, {level:number, xp:number}>} slayers
 * @property {number} cata
 * @property {Object<string, number>} classes
 * @property {Object<string, number>} floors    F-этажи
 * @property {Object<string, number>} master    M-этажи
 * @property {Object<string, number>} kuudra
 * @property {number} fairy
 * @property {number} enigma
 * @property {string[]} top           id первых 5 шагов roadmap
 * @property {Object<string, {title:string, priority:number, cost?:number}>} steps
 * @property {{stepId:string, title:string, cost:number, affordableNow:boolean}[]} plan
 * @property {Object<string, number>} prices  цены «наблюдаемых» предметов
 * @property {string|null} [mayor]   мэр (+ министр), если данные выборов есть
 * @property {Object<string, string>} [events]  крупные события, идущие сейчас: id → название
 */

/**
 * Снимок ключевых показателей.
 * @param {Object} member   Member из server/parse/profile.js
 * @param {Object} [analysis] state.analysis ядра: { roadmap, plan?, gear? }
 * @param {{ priceOf?: (id:string)=>number, now?: number, watch?: string[], calendar?: Object }} [opt]  calendar — calendarBrief()
 * @returns {Snapshot}
 */
export function makeSnapshot(member, analysis = {}, opt = {}) {
  const m = member || {};
  const roadmap = (analysis.roadmap || []).filter(s => s.priority > 0 && !s.done);
  const plan = (analysis.plan || []).slice(0, 6).map(p => ({ stepId: p.stepId, title: p.title, cost: p.cost || 0, affordableNow: !!p.affordableNow }));
  const lvl = s => +((s?.level || 0) + (s?.level >= s?.maxLevel ? 0 : (s?.progress || 0))).toFixed(3);
  const watch = new Set(opt.watch || []);
  for (const s of roadmap.slice(0, 8)) for (const id of s.items || []) watch.add(id);
  // и предметы из плана покупок: падение их цены — повод пересчитать, на что копить
  const byId = new Map(roadmap.map(s => [s.id, s]));
  for (const p of plan) for (const id of byId.get(p.stepId)?.items || []) watch.add(id);
  const prices = {};
  if (opt.priceOf) for (const id of [...watch].sort()) { const p = opt.priceOf(id); if (p > 0) prices[id] = p; }
  const steps = {};
  for (const s of roadmap.slice(0, 15)) steps[s.id] = { title: s.title, priority: s.priority, ...(s.cost ? { cost: s.cost } : {}) };
  return {
    t: opt.now ?? Date.now(),
    sb: m.sbLevel || 0,
    coins: Math.round((m.purse || 0) + (m.bank || 0) + (m.personalBank || 0)),
    networth: analysis.gear?.networth?.total != null ? Math.round(analysis.gear.networth.total) : null,
    mp: m.magicalPower || 0,
    skills: Object.fromEntries(Object.entries(m.skills || {}).filter(([, s]) => !s.apiMissing).map(([k, s]) => [k, lvl(s)])),
    slayers: Object.fromEntries(Object.entries(m.slayers || {}).map(([k, s]) => [k, { level: s.level || 0, xp: s.xp || 0 }])),
    cata: lvl(m.dungeons?.catacombs),
    classes: Object.fromEntries(Object.entries(m.dungeons?.classes || {}).map(([k, c]) => [k, c.level || 0])),
    floors: { ...(m.dungeons?.floors || {}) },
    master: { ...(m.dungeons?.masterFloors || {}) },
    kuudra: { ...(m.crimson?.kuudra || {}) },
    fairy: m.fairySouls?.collected || 0,
    enigma: m.rift?.enigmaSouls || 0,
    top: roadmap.slice(0, 5).map(s => s.id),
    steps,
    plan,
    prices,
    ...calendarPart(opt.calendar),
  };
}

/** Мэр и крупные события (Jacob и Dark Auction идут каждый час — их не считаем). */
function calendarPart(b) {
  if (!b) return {};
  const mayor = b.mayor ? `${b.mayor.name}${b.minister ? tx` / министр ${b.minister.name}` : ''}` : null;
  const events = {};
  for (const e of b.active || []) if (e.tier === 'big') events[e.id] = e.name;
  return { mayor, events };
}

/**
 * @typedef {Object} WatchEvent
 * @property {string} kind    'level'|'slayer'|'dungeon'|'coins'|'mp'|'roadmap'|'plan'|'price'|'progress'|'event'
 * @property {string} text    по-русски, одна строка
 * @property {number} weight  важность: 0.5 мелочь, 2 заметно, 3-4 важно
 */

/**
 * Что изменилось между двумя снимками. prev — снимок на момент ПОСЛЕДНЕГО вызова ИИ
 * (а не прошлой минуты), поэтому мелкие изменения копятся, пока не наберут вес.
 * @param {Snapshot|null} prev
 * @param {Snapshot} cur
 * @param {{ priceThreshold?: number, itemName?: (id:string)=>string }} [opt]
 * @returns {{ events: WatchEvent[], score: number }}
 */
export function diffSnapshots(prev, cur, opt = {}) {
  if (!prev) return { events: [{ kind: 'start', text: 'Первый запуск советчика: полный разбор профиля', weight: 10 }], score: 10 };
  const ev = [];
  const add = (kind, text, weight) => ev.push({ kind, text, weight });
  const name = opt.itemName || (id => id);
  const pth = opt.priceThreshold ?? 0.10;

  if (Math.floor(cur.sb) > Math.floor(prev.sb)) add('level', tx`Уровень SkyBlock: ${Math.floor(prev.sb)} → ${Math.floor(cur.sb)}`, 1.5);

  let xpGain = 0;
  for (const [k, v] of Object.entries(cur.skills)) {
    const p = prev.skills[k] ?? v;
    if (Math.floor(v) > Math.floor(p)) add('level', tx`${SKILL_RU[k] || k}: уровень ${Math.floor(p)} → ${Math.floor(v)}`, 3);
    else if (v > p) xpGain += v - p;
  }
  if (xpGain >= 0.5) add('progress', tx`Прогресс скиллов внутри уровней: +${xpGain.toFixed(1)} уровня суммарно`, 1);

  for (const [k, s] of Object.entries(cur.slayers)) {
    const p = prev.slayers[k] || { level: 0, xp: 0 };
    if (s.level > p.level) add('slayer', tx`Slayer ${SLAYER_RU[k] || k}: уровень ${p.level} → ${s.level}`, p.level === 0 ? 4 : 3);
    else if (s.xp > p.xp && p.xp === 0) add('slayer', tx`Начат слеер ${SLAYER_RU[k] || k}`, 3);
  }

  if (Math.floor(cur.cata) > Math.floor(prev.cata)) add('dungeon', `Catacombs: ${Math.floor(prev.cata)} → ${Math.floor(cur.cata)}`, 3);
  for (const [k, l] of Object.entries(cur.classes)) {
    const p = prev.classes[k] ?? l;
    if (l > p) add('dungeon', tx`Класс ${CLASS_RU[k] || k}: ${p} → ${l}`, 1);
  }
  for (const [f, n] of Object.entries(cur.master)) {
    const p = prev.master[f] || 0;
    if (n > 0 && p === 0) add('dungeon', tx`Первое прохождение M${f}!`, 4);
  }
  for (const [t, n] of Object.entries(cur.kuudra)) {
    const p = prev.kuudra[t] || 0;
    if (n > p) add('dungeon', tx`Kuudra ${t}: +${n - p} заход(а)`, p === 0 ? 3 : 1);
  }

  const dc = cur.coins - prev.coins;
  const rel = prev.coins ? Math.abs(dc) / prev.coins : 1;
  if (Math.abs(dc) >= 20_000_000 || (Math.abs(dc) >= 2_000_000 && rel >= 0.10)) {
    add('coins', tx`Монеты (кошелёк+Bank): ${fmtCoins(prev.coins)} → ${fmtCoins(cur.coins)} (${dc > 0 ? '+' : ''}${fmtCoins(dc)})`, rel >= 0.5 ? 3 : 2);
  }
  if (cur.mp !== prev.mp) add('mp', `Magical Power: ${prev.mp} → ${cur.mp}`, Math.abs(cur.mp - prev.mp) >= 20 ? 3 : Math.abs(cur.mp - prev.mp) >= 10 ? 2 : 1);
  if (cur.fairy > prev.fairy) add('progress', `Fairy Souls: +${cur.fairy - prev.fairy}`, 0.5);
  if (cur.enigma > prev.enigma) add('progress', `Enigma Souls: +${cur.enigma - prev.enigma}`, 0.5);

  // План: главный шаг сменился, шаги выполнены или появились
  if (cur.top[0] && cur.top[0] !== prev.top[0]) {
    add('roadmap', tx`Главный шаг сменился: «${prev.steps[prev.top[0]]?.title || prev.top[0] || '—'}» → «${cur.steps[cur.top[0]]?.title || cur.top[0]}»`, 4);
  }
  for (const id of Object.keys(prev.steps)) {
    if (!cur.steps[id] && prev.top.includes(id)) add('roadmap', tx`Шаг выполнен или больше не актуален: «${prev.steps[id].title}»`, 3);
  }
  for (const id of cur.top) {
    if (!prev.steps[id]) add('roadmap', tx`Новый шаг в топе: «${cur.steps[id]?.title || id}»`, 2);
  }
  const prevAff = new Set(prev.plan.filter(p => p.affordableNow).map(p => p.stepId));
  for (const p of cur.plan) {
    if (p.affordableNow && !prevAff.has(p.stepId)) add('plan', tx`Теперь хватает денег: «${p.title}» (${fmtCoins(p.cost)})`, 4);
  }

  // Цены наблюдаемых предметов
  for (const [id, now] of Object.entries(cur.prices)) {
    const was = prev.prices[id];
    if (!was) continue;
    const d = pct(was, now);
    if (Math.abs(d) >= pth) add('price', `${name(id)}: ${fmtCoins(was)} → ${fmtCoins(now)} (${fmtPct(d)})`, Math.abs(d) >= 0.25 ? 3 : 2);
  }

  // Мэр и события: новый мэр меняет выгодность заработка, старт ивента — повод сказать «сейчас иди туда».
  // Старые снимки без этих полей (до обновления) ничего не сравнивают
  if (prev.mayor !== undefined && cur.mayor && prev.mayor && cur.mayor !== prev.mayor) add('event', tx`Новый мэр: ${prev.mayor} → ${cur.mayor}`, 4);
  if (prev.events && cur.events) {
    for (const [id, n] of Object.entries(cur.events)) if (!prev.events[id]) add('event', tx`Начался ивент: ${n}`, 3);
    for (const [id, n] of Object.entries(prev.events)) if (!cur.events[id]) add('event', tx`Закончился ивент: ${n}`, 1);
  }

  const score = ev.reduce((a, e) => a + e.weight, 0);
  return { events: ev, score };
}

/**
 * @typedef {Object} TriggerSettings
 * @property {number} minScore       сколько «веса» нужно накопить (по умолчанию 3)
 * @property {number} minIntervalMs  не чаще (по умолчанию 15 мин)
 * @property {number} urgentScore    при таком весе ждём только urgentIntervalMs (по умолчанию 8)
 * @property {number} urgentIntervalMs  (по умолчанию 5 мин)
 */
export const DEFAULT_TRIGGER = { minScore: 3, minIntervalMs: 15 * MIN, urgentScore: 8, urgentIntervalMs: 5 * MIN };

/**
 * Решение: звать ли ИИ сейчас.
 * @returns {{ call: boolean, reason: string }}
 */
export function shouldCall({ score, lastCallAt, now }, settings = DEFAULT_TRIGGER) {
  const s = { ...DEFAULT_TRIGGER, ...settings };
  const since = lastCallAt ? now - lastCallAt : Infinity;
  if (score < s.minScore) return { call: false, reason: tx`мало изменений (вес ${score.toFixed(1)} из ${s.minScore})` };
  if (score >= s.urgentScore && since >= s.urgentIntervalMs) return { call: true, reason: tx`важные изменения (вес ${score.toFixed(1)})` };
  if (since >= s.minIntervalMs) return { call: true, reason: tx`накопились изменения (вес ${score.toFixed(1)})` };
  return { call: false, reason: tx`ждём паузу: прошло ${Math.round(since / MIN)} мин из ${Math.round(s.minIntervalMs / MIN)}` };
}
