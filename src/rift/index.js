// Анализ прогресса в Рифте по данным профиля (member.rift, member.inv.rift, member.slayers.vampire).
// Чистые функции без сети: справочник в ./data.js.
import { AREAS, SOULS, AMBIGUOUS_SOUL_CODES, TIMECHARMS, EYES, CATS, SHOP, SOUL_PURCHASES, VAMPIRE_XP } from './data.js';
import { tx } from '../../i18n/msg.js';

export { AREAS, SOULS, TIMECHARMS, EYES, CATS, SHOP };

export const TOTAL_SOULS = SOULS.length; // 52
const AREA = Object.fromEntries(AREAS.map((a, i) => [a.id, { ...a, order: i }]));
export const areaName = id => AREA[id]?.name || id;

const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const CODE_TO_SOUL = new Map(SOULS.flatMap(s => s.api.map(c => [norm(c), s.id])));
const AMBIG = new Set(AMBIGUOUS_SOUL_CODES.map(norm));

/** Предметы, которые лежат в Рифте (инвентарь, броня, снаряжение, эндер-сундук Рифта). */
export function riftItems(m) {
  const r = m?.inv?.rift || {};
  const ids = new Set();
  for (const k of ['inventory', 'armor', 'equipment', 'enderChest']) for (const it of r[k] || []) if (it?.id) ids.add(it.id);
  return ids;
}

/**
 * Статус каждой Enigma Soul.
 * Hypixel хранит найденные души внутренними кодами (RIFT_1, WOODS_WATER_SOUL…), список кодов не опубликован.
 * Коды, проверенные на реальном профиле, дают точный статус 'found'. Остальные найденные коды
 * (неизвестные или неоднозначные) распределяются как «возможно найдена» среди душ без подтверждённого кода
 * в зонах, где игрок уже был. marks — ручные отметки игрока { soulId: true|false }.
 */
export function soulStatus(rift = {}, marks = {}) {
  const found = new Set();
  const unknownCodes = [];
  for (const code of rift.foundSouls || []) {
    const id = CODE_TO_SOUL.get(norm(code));
    if (id) found.add(id); else unknownCodes.push(code);
  }
  const visited = visitedAreas(rift);
  const list = SOULS.map(s => {
    let status = found.has(s.id) ? 'found' : 'missing';
    if (marks[s.id] === true) status = 'found';
    else if (marks[s.id] === false && status !== 'found') status = 'missing';
    return { ...s, areaName: areaName(s.area), status, marked: s.id in marks };
  });
  // Неподтверждённые находки: сколько их не объяснено ручными отметками
  const manualFound = list.filter(s => s.status === 'found' && !found.has(s.id)).length;
  const unexplained = Math.max(0, unknownCodes.length - manualFound);
  const candidates = list.filter(s => s.status === 'missing' && !s.api.length && !s.marked && visited.has(s.area));
  if (unexplained > 0) for (const s of candidates) s.status = 'maybe';
  const total = (rift.foundSouls || []).length;
  return {
    list,
    found: Math.max(total, list.filter(s => s.status === 'found').length),
    total: TOTAL_SOULS,
    confirmed: list.filter(s => s.status === 'found').length,
    unexplained,                       // найдено, но неизвестно какие
    maybe: unexplained > 0 ? candidates.length : 0,
    unknownCodes: unknownCodes.filter(c => !AMBIG.has(norm(c))),
  };
}

/** Зоны, где игрок уже побывал: купленные границы, ключи зон в профиле, найденные души/глаза/части. */
export function visitedAreas(rift = {}) {
  const v = new Set(['wyld_woods']);
  for (const b of rift.boundaries || []) if (AREA[b]) v.add(b);
  const alias = { castle: 'stillgore_chateau', mountain: 'mountaintop', mountaintop: 'mountaintop' };
  for (const k of rift.areasSeen || []) { const a = AREA[k] ? k : alias[k]; if (a) v.add(a); }
  for (const code of rift.foundSouls || []) { const id = CODE_TO_SOUL.get(norm(code)); const s = id && SOULS.find(x => x.id === id); if (s) v.add(s.area); }
  for (const e of eyeStatus(rift)) if (e.done) v.add(e.area);
  for (const c of catStatus(rift)) if (c.done) v.add(c.area);
  return v;
}

export function eyeStatus(rift = {}) {
  const got = (rift.eyes || []).map(x => String(x).toLowerCase());
  const used = new Set();
  return EYES.map(e => {
    let hit = got.find(x => x === e.key && !used.has(x)) || got.find(x => e.match.test(x) && !used.has(x));
    if (hit) used.add(hit);
    return { ...e, areaName: areaName(e.area), done: !!hit };
  });
}

export function catStatus(rift = {}) {
  const got = new Set((rift.cats || []).map(x => String(x).toLowerCase()));
  return CATS.map((c, i) => ({ ...c, n: i + 1, areaName: areaName(c.area), done: got.has(c.key) }));
}

export function timecharmStatus(rift = {}, items = new Set()) {
  const got = new Set((rift.trophies || []).map(x => String(x).toLowerCase()));
  return TIMECHARMS.map(t => ({
    ...t, areaName: areaName(t.area),
    secured: got.has(t.type),
    inBag: !got.has(t.type) && items.has(t.id), // скрафчен, но не отнесён в галерею Elise
  }));
}

export function vampireStatus(m) {
  const v = m?.slayers?.vampire || {};
  const xp = v.xp || 0;
  const level = v.level ?? VAMPIRE_XP.filter(x => xp >= x).length;
  const next = VAMPIRE_XP[level];
  return { level, max: VAMPIRE_XP.length, xp, nextXp: next ?? null };
}

/** Полный разбор прогресса Рифта + приоритетный список «что делать дальше». */
export function analyzeRift(m, { marks = {}, petLevel } = {}) {
  const rift = m?.rift || {};
  const items = riftItems(m);
  const souls = soulStatus(rift, marks);
  const eyes = eyeStatus(rift);
  const cats = catStatus(rift);
  const charms = timecharmStatus(rift, items);
  const vamp = vampireStatus(m);
  const visited = visitedAreas(rift);
  const motes = rift.motes || 0;
  const mont = rift.montezuma;
  const montLv = mont && petLevel ? petLevel(mont.type, mont.tier, mont.exp || 0) : null;

  const areas = AREAS.map(a => {
    const s = souls.list.filter(x => x.area === a.id);
    return {
      ...a, visited: visited.has(a.id),
      souls: { found: s.filter(x => x.status === 'found').length, maybe: s.filter(x => x.status === 'maybe').length, total: s.length },
      eyes: eyes.filter(e => e.area === a.id).map(e => ({ name: e.name, done: e.done })),
      cats: cats.filter(c => c.area === a.id).map(c => ({ n: c.n, done: c.done })),
      charms: charms.filter(c => c.area === a.id).map(c => ({ name: c.name, secured: c.secured })),
    };
  });
  // Текущая зона — первая по порядку, где ещё есть что делать
  const current = areas.find(a => a.souls.found + a.souls.maybe < a.souls.total || a.charms.some(c => !c.secured) || a.eyes.some(e => !e.done) || a.cats.some(c => !c.done));

  const next = [];
  const add = (priority, title, why) => next.push({ priority, title, why });
  if (!rift.boughtCloak) add(95, 'Купи Enigma Cloak у Enigma за 100 Motes', 'Enigma стоит у подножия Wizard Tower в Рифте. Каждая найденная Enigma Soul добавляет плащу +20 с Rift Time.');
  for (const c of charms.filter(c => c.inBag)) add(92, tx`Отнеси ${c.name} в галерею Elise`, 'Таймчарм уже у тебя, но засчитывается только после того, как его поставят в Rift Gallery.');
  // Призму советуем, только если она уже у игрока: на аукционе она стоит больше миллиарда
  if (!m?.riftPrism && m?.inv && hasAnywhere(m, 'RIFT_PRISM')) add(90, 'Употреби Rift Prism', 'Призма уже у тебя: навсегда +11 Magical Power и бесплатный вход в Рифт.');
  // Души в текущих доступных зонах
  const easy = souls.list.filter(s => s.status !== 'found' && visited.has(s.area));
  const left = easy.length - (souls.unexplained ? Math.min(souls.unexplained, easy.filter(s => s.status === 'maybe').length) : 0);
  if (left > 0) {
    const byArea = groupBy(easy, s => s.areaName);
    const first = Object.entries(byArea)[0];
    add(80, tx`Собери Enigma Souls в открытых зонах: ${left === easy.length ? left : tx`ещё ${left}`}`, tx`Начни с ${first[0]}: ${first[1].slice(0, 3).map(s => s.name).join(', ')}. Каждая душа даёт +20 с Rift Time.`);
  }
  if (souls.unexplained) add(70, souls.unexplained === 1 ? 'Отметь, какая душа найдена' : tx`Отметь, какие ${souls.unexplained} ${souls.unexplained < 5 ? 'души' : 'душ'} найдены`, 'Hypixel хранит часть душ кодами, которые не удаётся сопоставить. Отметь их на странице, и список недостающих станет точным.');
  const nextCharm = charms.find(c => !c.secured && !c.inBag);
  if (nextCharm) add(75, tx`Следующий таймчарм: ${nextCharm.name} (${nextCharm.areaName})`, nextCharm.how);
  const nextArea = AREAS.find(a => !visited.has(a.id));
  if (nextArea) add(65, tx`Открой следующую зону: ${nextArea.name}`, tx`${nextArea.gate || ''} ${nextArea.about}`.trim());
  const eyeLeft = eyes.filter(e => !e.done && visited.has(e.area));
  if (eyeLeft.length) add(60, tx`Глаза Porhtal: ${eyeLeft.map(e => e.name).join(', ')}`, tx`${eyeLeft[0].hint} Каждый глаз даёт +40 с Rift Time.`);
  const catLeft = cats.filter(c => !c.done);
  if (catLeft.length && cats.some(c => c.done)) add(55, tx`Части Montezuma: осталось ${catLeft.length} из 9`, tx`Следующая: ${catLeft[0].hint} Каждая часть +15 с Rift Time. Ищи с Dead Cat Detector (ПКМ пингует ближайшую часть).`);
  const globulate = charms.find(c => c.type === 'slime')?.secured;
  if (vamp.level < vamp.max && globulate) add(50, tx`Vampire Slayer ${vamp.level} → ${vamp.level + 1}`, tx`Квест у Maddox в замке Stillgore стоит ${[2000, 4000, 5000, 7000, 10000][vamp.level].toLocaleString('ru-RU')} Motes. Уровни дают Rift Time, на 3-м открывается Vampiric Timecharm.`);
  for (const p of SOUL_PURCHASES) {
    const s = souls.list.find(x => x.id === p.soul);
    if (s && s.status === 'missing' && visited.has(s.area)) add(motes >= p.motes ? 58 : 40, tx`Купи душу у ${p.npc}: ${p.motes.toLocaleString('ru-RU')} Motes`, tx`Плюс ${p.extra}. ${motes >= p.motes ? 'Motes уже хватает.' : tx`Не хватает ${(p.motes - motes).toLocaleString('ru-RU')} Motes.`}`);
  }
  next.sort((a, b) => b.priority - a.priority);

  const shop = SHOP.map(s => ({ ...s, areaName: s.area ? areaName(s.area) : null, owned: items.has(s.id) || !!m?.inv && hasAnywhere(m, s.id), affordable: motes >= s.motes }));

  return {
    motes, souls, eyes, cats, charms, vamp, areas, current: current?.id || null, next, shop,
    montezuma: mont ? { tier: mont.tier, level: montLv?.level ?? null, maxLevel: montLv?.maxLevel ?? 100, active: !!mont.active } : null,
    catDetector: !!rift.catDetector, boughtCloak: !!rift.boughtCloak, prism: !!m?.riftPrism,
    riftTimeFromSouls: souls.found * 20,
  };
}

function hasAnywhere(m, id) {
  const inv = m.inv || {};
  for (const k of ['inventory', 'armor', 'equipment', 'wardrobe', 'enderChest', 'vault', 'talismans']) if ((inv[k] || []).some(i => i?.id === id)) return true;
  for (const l of Object.values(inv.backpacks || {})) if ((l || []).some(i => i?.id === id)) return true;
  return false;
}

function groupBy(arr, f) {
  const o = {};
  for (const x of arr) (o[f(x)] ||= []).push(x);
  return o;
}
