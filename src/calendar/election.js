// Выборы мэра: живые голоса, шанс победы, ближайшие мэры и история прошлых выборов.
//   addElection(data, raw)   — снимок голосов и итог прошлых выборов (хранит election-store.js)
//   electionView(raw, data)  — всё для блока «Выборы», ленты «Ближайшие мэры», строки на главной, всплывашки и гайдов
//   GET /v1/election         — маршрут в api (electionNow из election-store.js)
// Здесь только расчёт без диска и сети: модуль входит в публичный вход.
//
// Откуда шанс. Пока идут выборы, всё решают голоса: отрыв, тренд за последние часы и сколько осталось до итогов.
// Итог каждого кандидата прикидываем как «доля сейчас + тренд, приглушённый к концу», разброс растёт с корнем из
// оставшихся часов; шанс — вероятность оказаться первым при таком разбросе. Множитель разброса (sigmaK) сверяется
// с прошлыми выборами, у которых сохранились снимки: берём тот, при котором прогнозы лучше всего угадывали победителя.
// Пока кандидатов нет, есть только история: как часто мэр побеждал, когда выдвигался.
import { MAYORS, mayorView } from './mayors.js';
import { nextTermChange, electionWindow } from './events.js';
import { MONTH, YEAR } from './time.js';
import { tx } from '../../i18n/msg.js';

const HOUR = 3600_000;

/** Перки, которые резко меняют игру: с ними кандидат обычно набирает больше голосов. */
export const STRONG_PERKS = new Set(['MOAR SKILLZ!!!', 'TURBO MINIONS!!!', 'Statspocalypse', 'Perkpocalypse', 'Darker Auctions', 'Bribe', 'Mythological Ritual', 'EZPZ', 'Mining Fiesta', 'Fishing Festival', 'Extra Event']);

/** Гайд → мэр, у которого «его» перки (строка в гайде). Mining нет: там своя строка про Mining Fiesta (calendar/mining.js). */
export const GUIDE_MAYOR = { diana: 'diana', fishing: 'marina', trophy: 'marina', farming: 'finnegan', slayers: 'aatrox', dungeons: 'paul', taming: 'diana' };

export const keyOf = name => {
  const n = String(name || '').toLowerCase().trim();
  return Object.keys(MAYORS).find(k => MAYORS[k].name.toLowerCase() === n) || n;
};

const total = votes => Object.values(votes).reduce((s, v) => s + (v || 0), 0);

/** Итоги без повторов по году: поздние списки важнее (вики, потом свои). */
export function mergeResults(...lists) {
  const byYear = new Map();
  for (const list of lists) for (const r of list || []) if (r?.year && r.winner) byYear.set(r.year, r);
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/**
 * Добавить ответ API выборов в данные: итог прошлых выборов (mayor.election) и снимок голосов текущих.
 * data = { results: [], polls: { [year]: [{ t, v: { key: votes }, end }] } } — меняется на месте. Возвращает true, если что-то добавилось.
 */
export function addElection(data, raw, at = Date.now()) {
  let changed = false;
  const e = raw?.mayor?.election;
  if (e?.year && Array.isArray(e.candidates) && e.candidates.length && !data.results.some(r => r.year === e.year)) {
    const cands = e.candidates.map(c => ({ name: c.name, votes: c.votes || 0 })).sort((a, b) => b.votes - a.votes);
    data.results.push({ year: e.year, winner: raw.mayor.name || cands[0].name, minister: raw.mayor.minister?.name || cands[1]?.name || null, candidates: cands });
    if (data.results.length > 600) data.results.splice(0, data.results.length - 600);
    changed = true;
  }
  const cur = raw?.current;
  if (cur?.year && Array.isArray(cur.candidates) && cur.candidates.length) {
    const votes = Object.fromEntries(cur.candidates.map(c => [keyOf(c.name), c.votes || 0]));
    const list = data.polls[cur.year] || (data.polls[cur.year] = []);
    const last = list[list.length - 1];
    // не чаще раза в 4 минуты и только если голоса изменились
    if (total(votes) > 0 && (!last || (at - last.t >= 4 * 60_000 && total(votes) !== total(last.v)))) {
      list.push({ t: at, v: votes, end: nextTermChange(at) });
      changed = true;
    }
    // прошлые годы — по снимку в час, не больше 40 лет
    for (const y of Object.keys(data.polls)) if (Number(y) !== cur.year) data.polls[y] = thin(data.polls[y]);
    const years = Object.keys(data.polls).map(Number).sort((a, b) => a - b);
    while (years.length > 40) delete data.polls[years.shift()];
  }
  return changed;
}

const thin = list => { const out = []; for (const p of list || []) if (!out.length || p.t - out[out.length - 1].t >= HOUR) out.push(p); return out; };

// ---------- шанс победы ----------
const erf = x => { // Abramowitz–Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496735) * t + 0.254829592) * t * Math.exp(-x * x));
};
const phi = x => 0.5 * (1 + erf(x / Math.SQRT2));

/** Доля (0..100) каждого кандидата в снимке. */
const shares = v => { const s = total(v); return Object.fromEntries(Object.entries(v).map(([k, n]) => [k, s ? n / s * 100 : 0])); };

/** Изменение доли за последние hours часов (п. п.) по снимкам: { key: delta } или null, если снимков мало. */
export function trendOf(points, hours = 3) {
  if (!points?.length) return null;
  const last = points[points.length - 1];
  const target = last.t - hours * HOUR;
  let base = null;
  for (const p of points) { if (p.t <= target) base = p; else break; }
  if (!base || last.t - base.t < hours * HOUR * 0.6) return null;
  const a = shares(base.v), b = shares(last.v);
  return Object.fromEntries(Object.keys(b).map(k => [k, b[k] - (a[k] || 0)]));
}

/**
 * Шанс победы каждого: { key: 0..1 }.
 * @param {Record<string, number>} share   доли сейчас, п. п.
 * @param {number} hoursLeft               до итогов
 * @param {Record<string, number>|null} trend  изменение доли за 3 ч
 * @param {number} k                       множитель разброса (сверка с прошлыми выборами)
 */
export function winChances(share, hoursLeft, trend = null, k = 1) {
  const keys = Object.keys(share);
  if (!keys.length) return {};
  const h = Math.max(0, hoursLeft);
  // тренд за 3 ч продолжается, но слабеет: учитываем не больше 12 часов вперёд и вполовину
  const proj = Object.fromEntries(keys.map(x => [x, share[x] + (trend?.[x] || 0) / 3 * Math.min(h, 12) * 0.5]));
  const sigma = k * (1 + 0.8 * Math.sqrt(h));
  const raw = Object.fromEntries(keys.map(i => [i, keys.reduce((p, j) => (j === i ? p : p * phi((proj[i] - proj[j]) / (sigma * Math.SQRT2))), 1)]));
  const sum = Object.values(raw).reduce((s, v) => s + v, 0) || 1;
  return Object.fromEntries(keys.map(x => [x, raw[x] / sum]));
}

/** Подбор множителя разброса по прошлым выборам со снимками: лучшая сумма log(шанс победителя). */
export function calibrate(results, polls, fallback = 1) {
  const res = new Map(results.map(r => [r.year, keyOf(r.winner)]));
  const sets = Object.entries(polls || {}).filter(([y, pts]) => res.has(Number(y)) && pts.length >= 6);
  if (sets.length < 2) return fallback;
  let best = fallback, bestLL = -Infinity;
  for (let k = 0.4; k <= 3.01; k += 0.1) {
    let ll = 0;
    for (const [y, pts] of sets) {
      const win = res.get(Number(y));
      for (let i = 0; i < pts.length; i += 3) {
        const p = pts[i];
        const c = winChances(shares(p.v), (p.end - p.t) / HOUR, trendOf(pts.slice(0, i + 1)), k);
        ll += Math.log(Math.max(1e-4, c[win] ?? 1e-4));
      }
    }
    if (ll > bestLL) { bestLL = ll; best = Math.round(k * 10) / 10; }
  }
  return best;
}

// ---------- история ----------
/** Как часто мэр побеждает, когда выдвигается (последние last выборов): { key: { runs, wins, rate, lastWin } } */
export function historyStats(results, last = 60) {
  const out = {};
  // годы с особым мэром и годы без голосов на вики не считаем: там обычные мэры проигрывают все или данных нет
  const usable = results.filter(r => (r.candidates || []).filter(c => c.votes > 0).length >= 3 && !(r.candidates || []).some(c => MAYORS[keyOf(c.name)]?.special));
  for (const r of usable.slice(-last)) {
    const w = keyOf(r.winner);
    for (const c of r.candidates || []) {
      const k = keyOf(c.name);
      const s = out[k] || (out[k] = { runs: 0, wins: 0, rate: 0, lastWin: null });
      s.runs++;
      if (k === w) { s.wins++; s.lastWin = r.year; }
    }
  }
  for (const s of Object.values(out)) s.rate = s.runs ? Math.round(s.wins / s.runs * 100) : 0;
  return out;
}

/** Выдвигается ли действующий мэр на следующих выборах (по истории: был ли победитель года Y в кандидатах Y+1). */
export function incumbentRuns(results) {
  const by = new Map(results.map(r => [r.year, r]));
  let seen = 0, ran = 0;
  for (const r of results) {
    const next = by.get(r.year + 1);
    if (!next?.candidates?.length) continue;
    seen++;
    if (next.candidates.some(c => keyOf(c.name) === keyOf(r.winner))) ran++;
  }
  return seen ? ran / seen > 0.2 : false;
}

/** Особые мэры по истории: { last, every, next, names } — год последних выборов с особым кандидатом и шаг. */
export function specialCycle(results) {
  const years = results.filter(r => (r.candidates || []).some(c => MAYORS[keyOf(c.name)]?.special)).map(r => r.year);
  if (!years.length) return null;
  const last = years[years.length - 1];
  const gaps = {};
  for (let i = 1; i < years.length; i++) { const g = years[i] - years[i - 1]; if (g > 1) gaps[g] = (gaps[g] || 0) + 1; }
  const every = Number(Object.entries(gaps).sort((a, b) => b[1] - a[1])[0]?.[0]) || null;
  const order = results.filter(r => years.includes(r.year)).map(r => keyOf((r.candidates || []).find(c => MAYORS[keyOf(c.name)]?.special)?.name));
  // особые мэры идут по кругу (Scorpius → Derpy → Jerry): следующий — тот, кто был три особых выборов назад
  const recent = order.slice(-3);
  const nextName = recent.length === 3 && new Set(recent).size === 3 ? MAYORS[recent[0]]?.name || null : null;
  return { last, every, next: every ? last + every : null, recent, nextName };
}

// ---------- вид для сайта ----------
const r1 = x => Math.round(x * 10) / 10;
const pctText = p => (p >= 0.995 ? '>99%' : p < 0.01 ? '<1%' : `~${Math.round(p * 100)}%`);

function whyOf(c, lead, second, trend, isNew) {
  const t = trend?.[c.key];
  if (isNew) return 'новый мэр: предсказать трудно, новых часто выбирают из интереса';
  if (c === lead && second && trend && (trend[second.key] || 0) - (t || 0) >= 1.5) return tx`впереди, но ${second.name} догоняет: +${r1(trend[second.key])}% за 3 ч`;
  if (c === lead && t != null && t >= 0.5) return 'впереди, отрыв растёт';
  if (c !== lead && t != null && t >= 1.5) return tx`догоняет: +${r1(t)}% за 3 ч`;
  return null;
}

/** Что даст победа: события срока (перки → ивенты) коротко. */
const IF_WIN = {
  'Mining Fiesta': 'Mining Fiesta весь срок: +25% Mining Fortune, Refined Mineral и Glossy Gemstone',
  'Mythological Ritual': 'норы грифонов в Hub весь срок (гайд «Diana»)',
  'Fishing Festival': 'акулы в первые 3 дня каждого месяца',
  'EZPZ': 'Dungeons с +10 к оценке весь срок',
  'Chivalrous Carnival': 'карнавал в Hub весь срок',
  'SLASHED Pricing': 'квесты Slayers вдвое дешевле',
  'GOATed': 'медали Jacob проще',
  'Shopping Spree': 'лимиты покупок у NPC ×10',
  'TURBO MINIONS!!!': 'миньоны вдвое быстрее',
  'Darker Auctions': 'Dark Auction богаче',
  'Perkpocalypse': 'перки других мэров по очереди',
};
const ifWin = perks => { const p = perks.find(x => IF_WIN[x.name]); return p ? IF_WIN[p.name] : null; };

/**
 * Всё про выборы на момент now.
 * raw — ответ API выборов (calendar/index.js хранит последний),
 * data — { results (все итоги: вики + свои), polls (снимки голосов), sigmaK } из election-store.js.
 */
export function electionView(raw, data, now = Date.now()) {
  const results = data?.results || [];
  const polls = data?.polls || {};
  const sigmaK = data?.sigmaK || 1;
  const stats = historyStats(results);
  const known = new Set(results.flatMap(r => (r.candidates || []).map(c => keyOf(c.name))));
  const w = electionWindow(now);
  const termEnd = nextTermChange(now);
  const mayor = raw?.mayor ? mayorView(raw.mayor) : null;
  const minister = raw?.mayor?.minister?.name ? mayorView({ name: raw.mayor.minister.name, perks: [] }) : null;
  const cur = raw?.current;
  const open = w.open && !!cur?.candidates?.length;
  const year = cur?.year ?? (raw?.mayor?.election?.year != null ? raw.mayor.election.year + 1 : null);
  const isNewMayor = k => results.length > 20 && !known.has(k) && !MAYORS[k];

  let candidates = null;
  if (open) {
    const votes = Object.fromEntries(cur.candidates.map(c => [keyOf(c.name), c.votes || 0]));
    const share = shares(votes);
    const pts = polls[cur.year] || [];
    const trend = trendOf(pts, 3);
    const hoursLeft = (w.closes - now) / HOUR;
    const chance = winChances(share, hoursLeft, trend, sigmaK);
    candidates = cur.candidates.map(c => {
      const v = mayorView(c), k = v.key;
      return { ...v, votes: c.votes || 0, pct: r1(share[k] || 0), trend: trend ? r1(trend[k] || 0) : null, chance: chance[k] ?? 0,
        chanceText: pctText(chance[k] ?? 0), isNew: isNewMayor(k), strong: v.perks.some(p => STRONG_PERKS.has(p.name)),
        ifWin: ifWin(v.perks), history: stats[k] || null };
    }).sort((a, b) => b.votes - a.votes);
    const [lead, second] = candidates;
    for (const c of candidates) c.why = whyOf(c, lead, second, trend, c.isNew);
  }

  // лента «Ближайшие мэры»
  const lead = candidates?.[0] || null;
  const incRuns = incumbentRuns(results);
  const nextOpen = w.open ? termEnd + YEAR - 9 * MONTH : w.opens;
  const spec = specialCycle(results);
  const timeline = [];
  if (mayor) timeline.push({ kind: 'now', key: mayor.key, name: mayor.name, color: mayor.color, icon: mayor.icon, role: mayor.role, until: termEnd, start: termEnd - YEAR });
  if (lead) timeline.push({ kind: 'next', key: lead.key, name: lead.name, color: lead.color, icon: lead.icon, role: lead.role, chance: lead.chance, chanceText: lead.chanceText,
    alt: candidates[1]?.name || null, minister: candidates[1]?.name || null, start: termEnd, until: termEnd + YEAR });
  else if (!w.open) timeline.push({ kind: 'election', start: w.opens, until: w.closes });
  if (w.open) timeline.push({ kind: 'election', start: nextOpen, until: termEnd + YEAR, skip: !incRuns && lead ? lead.name : null });
  let special = null;
  // особый мэр уже в нынешних выборах — он в строке «скорее всего»; ждём следующий цикл
  if (spec?.next && spec.every && year != null) while (spec.next <= year) spec.next += spec.every;
  if (spec?.next && year != null) {
    // выборы года Y решают мэра, который вступит на смене мэра через (Y - year) лет после ближайшей
    const at = termEnd + (spec.next - year) * YEAR;
    if (at > now) special = { year: spec.next, start: at, every: spec.every, recent: spec.recent, name: spec.nextName };
  }
  if (special) timeline.push({ kind: 'special', start: special.start, every: special.every, likely: special.name, names: Object.values(MAYORS).filter(m => m.special).map(m => m.name) });

  // «когда снова» — для каждого обычного мэра
  const nextFor = {};
  for (const k of Object.keys(MAYORS)) {
    const c = candidates?.find(x => x.key === k);
    if (c) nextFor[k] = { state: 'running', chance: c.chance, chanceText: c.chanceText, pct: c.pct, start: termEnd };
    // действующий мэр не выдвигается на выборах своего срока: следующий шанс — выборы при следующем мэре
    else if (mayor?.key === k) nextFor[k] = { state: 'mayor', until: termEnd, next: w.open ? nextOpen : (incRuns ? w.opens : w.opens + YEAR) };
    else if (MAYORS[k].special) nextFor[k] = { state: 'special', start: special?.start || null };
    else nextFor[k] = { state: 'later', next: w.open ? nextOpen : w.opens, rate: stats[k]?.rate ?? null };
  }

  const odds = Object.entries(stats).filter(([k, s]) => s.runs >= 3 && !MAYORS[k]?.special)
    .map(([k, s]) => ({ key: k, name: MAYORS[k]?.name || k, color: MAYORS[k]?.color || '#9aa4b2', ...s }))
    .sort((a, b) => b.rate - a.rate);

  return {
    now, year, open, opens: w.opens, closes: w.closes, termEnd,
    mayor: mayor && { key: mayor.key, name: mayor.name, color: mayor.color, icon: mayor.icon, role: mayor.role, tip: mayor.tip },
    minister: minister && { key: minister.key, name: minister.name },
    lastResult: raw?.mayor?.election?.year ? { year: raw.mayor.election.year, start: termEnd - YEAR } : null,
    candidates, timeline, nextFor, odds,
    history: { elections: results.length, from: results[0]?.year ?? null, to: results[results.length - 1]?.year ?? null, sigmaK, incumbentRuns: incRuns, special: spec },
    guideMayor: GUIDE_MAYOR,
  };
}
