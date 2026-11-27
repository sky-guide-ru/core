// Мэр, министр, выборы и календарь событий SkyBlock.
//   setElection(raw)        — ответ /v2/resources/skyblock/election (обновляется в money.js → refreshMayor)
//   setFireSales(raw)       — ответ /v2/skyblock/firesales (там же, раз в 20 минут; ключ не нужен)
//   calendarView(now, year) — всё для страницы «События»: мэр, выборы, что идёт, что скоро, сетка года
//   calendarBrief(now)      — коротко для советчика (что идёт сейчас и что скоро)
//   GET /api/calendar?year= — маршрут
import { sbDate, sbStart, MONTHS, DAY, MONTH, YEAR } from './time.js';
import { yearlyIn, cultIn, hourlyNext, nextTermChange, electionWindow, perkEvents, CULT, HOURLY, PERK_EVENTS } from './events.js';
import { mayorView, PERKS, perkTitle, stripCodes } from './mayors.js';
import { MAYOR_RULES } from '../market/mayor-boost.js';
import { tx } from '../../i18n/msg.js';

export { sbDate, MONTHS };

const state = { raw: null, at: 0 };

/** Сохранить свежий ответ API выборов. */
export function setElection(raw, at = Date.now()) {
  if (raw && (raw.mayor || raw.current)) { state.raw = raw; state.at = at; }
}
export const electionRaw = () => state.raw;

// Fire Sales: косметика за SkyBlock Gems в магазине (Community Center). { sales: [{ item_id, start, end, amount, price }] }
const fire = { sales: [] };
// nameOf — название предмета по id (из базы NEU; сам календарь её не грузит: он входит в публичный вход для браузера)
export function setFireSales(raw, nameOf = id => id) {
  if (raw && Array.isArray(raw.sales)) fire.sales = raw.sales.filter(s => s?.item_id && Number(s.end) > Number(s.start)).map(s => ({ ...s, name: nameOf(s.item_id) || s.item_id }));
}
export function fireSaleEvents(now = Date.now()) {
  return fire.sales.filter(s => Number(s.end) > now).map(s => {
    const name = s.name || s.item_id;
    return {
      id: tx`firesale-${s.item_id}`, name: tx`Fire Sale: ${name}`, icon: s.item_id, color: '#ff7a45', tier: 'big',
      start: Number(s.start), end: Number(s.end),
      what: tx`${Number(s.amount) || 0} шт. по ${Number(s.price) || 0} SkyBlock Gems`,
      tip: 'Ограниченная косметика за SkyBlock Gems: покупается в Community Center (Elizabeth → Fire Sales), пока не кончатся штуки.',
    };
  });
}

function ministerView(raw) {
  const mi = raw?.mayor?.minister;
  if (!mi?.name) return null;
  const v = mayorView({ key: mi.key, name: mi.name, perks: [] });
  const p = mi.perk || {};
  return { ...v, perk: p.name ? { name: p.name, title: perkTitle(p.name), ru: PERKS[p.name] || null, en: stripCodes(p.description) } : null };
}

/** Перки, действующие сейчас: все перки мэра + перк министра. */
export function activePerks(raw = state.raw) {
  const out = (raw?.mayor?.perks || []).map(p => p.name);
  if (raw?.mayor?.minister?.perk?.name) out.push(raw.mayor.minister.perk.name);
  return out;
}

function candidatesView(list) {
  const total = (list || []).reduce((s, c) => s + (c.votes || 0), 0);
  return (list || []).map(c => ({ ...mayorView(c), votes: c.votes || 0, pct: total ? Math.round((c.votes || 0) / total * 1000) / 10 : null }))
    .sort((a, b) => b.votes - a.votes);
}

const pub = e => ({ id: e.id, name: e.name, ...(e.en ? { en: e.en } : {}), icon: e.icon, color: e.color, tier: e.tier, what: e.what, tip: e.tip, start: e.start, end: e.end,
  ...(e.guide ? { guide: e.guide } : {}), ...(e.approx ? { approx: true } : {}), ...(e.perk ? { perk: e.perk } : {}) });

/** Все известные события вокруг now: годовые (этот и следующий год), от перков (до смены мэра), Cult, ежечасные, выборы. */
function allEvents(now) {
  const { year, month } = sbDate(now);
  const termEnd = nextTermChange(now);
  const ev = [...yearlyIn(year), ...yearlyIn(year + 1)];
  if (state.raw?.mayor) ev.push(...perkEvents(activePerks(), termEnd - YEAR, termEnd));
  for (let i = 0; i < 2; i++) { const mm = (month + i) % 12, yy = year + Math.floor((month + i) / 12); ev.push(...cultIn(yy, mm)); }
  ev.push(...hourlyNext(now, 3));
  ev.push(...fireSaleEvents(now));
  const w = electionWindow(now);
  ev.push({ id: 'term', name: 'Смена мэра', icon: 'PAPER', color: '#c3a6ff', tier: 'big', start: termEnd, end: termEnd + DAY,
    what: 'Итоги выборов: новый мэр и министр.', tip: 'Победитель выборов становится мэром на год SkyBlock, второй по голосам — министром с одним перком.' });
  if (!w.open) ev.push({ id: 'election-open', name: 'Открытие выборов', icon: 'PAPER', color: '#c3a6ff', tier: 'big', start: w.opens, end: w.opens + DAY,
    what: 'Election Booth в Hub: можно голосовать за мэра.', tip: 'Голосуй у Election Booth в Hub.' });
  // убираем повтор «открытия выборов» из годового списка, если оно уже есть
  const seen = new Set();
  return ev.filter(e => { const k = `${e.id}|${e.start}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Что идёт сейчас и что скоро. Повторяющиеся события (Jacob, Dark Auction, Fishing Festival) — только ближайшее вхождение. */
export function nowAndNext(now = Date.now(), { limit = 14 } = {}) {
  const ev = allEvents(now).filter(e => e.end > now).sort((a, b) => a.start - b.start);
  const active = ev.filter(e => e.start <= now);
  const seen = new Set(active.map(e => e.id));
  const upcoming = [];
  for (const e of ev) {
    if (e.start <= now || seen.has(e.id)) continue;
    seen.add(e.id);
    upcoming.push(e);
    if (upcoming.length >= limit) break;
  }
  return { active: active.map(pub), upcoming: upcoming.map(pub) };
}

/** Кусок [start, end) реального времени → отрезки по месяцам года year: [[месяц, первый день, последний день]] */
export function spansInYear(start, end, year) {
  const y0 = sbStart(year, 0, 1), y1 = y0 + YEAR;
  const s = Math.max(start, y0), e = Math.min(end, y1);
  if (e <= s) return [];
  const out = [];
  for (let m = 0; m < 12; m++) {
    const ms = y0 + m * MONTH, me = ms + MONTH;
    const a = Math.max(s, ms), b = Math.min(e, me);
    if (b <= a) continue;
    out.push([m, Math.floor((a - ms) / DAY) + 1, Math.ceil((b - ms) / DAY)]);
  }
  return out;
}

/** Сетка года: месяцы с реальным временем начала и события по дням.
 *  Выборы и ивенты на весь срок мэра в клетки не рисуем (они заливали бы весь год), а отдаём списком wholeTerm. */
export function yearGrid(year, now = Date.now()) {
  const termEnd = nextTermChange(now);
  const bars = [];
  const add = (e, start, end) => { const spans = spansInYear(start, end, year); if (spans.length) bars.push({ id: e.id, name: e.name, en: e.en, icon: e.icon, color: e.color, what: e.what, tip: e.tip, start, end, spans, ...(e.guide ? { guide: e.guide } : {}) }); };
  for (const e of yearlyIn(year)) add(e, e.start, e.end);
  const wholeTerm = [];
  if (state.raw?.mayor) for (const e of perkEvents(activePerks(), termEnd - YEAR, termEnd)) {
    if (e.whole) { if (spansInYear(e.start, e.end, year).length) wholeTerm.push({ id: e.id, name: e.name, color: e.color, until: e.end, ...(e.guide ? { guide: e.guide } : {}) }); }
    else add(e, e.start, e.end);
  }
  const months = MONTHS.map((x, i) => ({ i, en: x.en, ru: x.ru, start: sbStart(year, i, 1) }));
  const cur = sbDate(now);
  return {
    year, months, bars, wholeTerm,
    today: cur.year === year ? { m: cur.month, d: cur.day } : null,
    termEnd,
    termChange: spansInYear(termEnd, termEnd + DAY, year)[0] || null, // [месяц, день] смены мэра в этом году
    knownUntil: state.raw?.mayor ? termEnd : null, // после смены мэра перки (Diana, Marina…) ещё неизвестны
  };
}

/** Всё для страницы «События». */
export function calendarView(now = Date.now(), { year } = {}) {
  const raw = state.raw;
  const sb = sbDate(now);
  const w = electionWindow(now);
  const mayor = raw?.mayor ? mayorView(raw.mayor) : null;
  const minister = ministerView(raw);
  const cands = raw?.current?.candidates?.length ? candidatesView(raw.current.candidates) : null;
  const y = Number.isInteger(year) && year >= sb.year - 1 && year <= sb.year + 3 ? year : sb.year;
  return {
    now, sb, updatedAt: state.at || null,
    mayor, minister,
    termEnd: nextTermChange(now),
    election: { open: w.open && !!cands, opens: w.opens, closes: w.closes, year: raw?.current?.year ?? null, candidates: cands },
    ...nowAndNext(now),
    grid: yearGrid(y, now),
    money: moneyHints(activePerks(raw)),
    notes: {
      jacob: HOURLY[0].tip, darkauction: HOURLY[1].tip, cult: CULT.tip,
      perks: Object.keys(PERK_EVENTS),
    },
  };
}

const fmtLeft = ms => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return tx`${m} мин`;
  const h = Math.floor(m / 60), r = m % 60;
  return h < 24 ? tx`${h} ч${r ? tx` ${r} мин` : ''}` : tx`${Math.floor(h / 24)} дн ${h % 24} ч`;
};

/** Коротко для советчика: мэр, перки, что идёт, что начнётся в ближайшие 12 часов. */
export function calendarBrief(now = Date.now()) {
  const raw = state.raw;
  const { active, upcoming } = nowAndNext(now, { limit: 30 });
  const mayor = raw?.mayor ? mayorView(raw.mayor) : null;
  const minister = ministerView(raw);
  const cands = raw?.current?.candidates?.length ? candidatesView(raw.current.candidates) : null;
  return {
    sb: sbDate(now),
    mayor: mayor ? { name: mayor.name, role: mayor.role, perks: mayor.perks.map(p => p.name) } : null,
    minister: minister ? { name: minister.name, perk: minister.perk?.name || null } : null,
    termLeft: fmtLeft(nextTermChange(now) - now),
    leader: cands?.[0] ? { name: cands[0].name, pct: cands[0].pct } : null,
    active: active.map(e => ({ id: e.id, name: e.name, en: e.en, tier: e.tier, left: fmtLeft(e.end - now) })),
    soon: upcoming.filter(e => e.start - now <= 12 * 3600_000).map(e => ({ id: e.id, name: e.name, en: e.en, tier: e.tier, in: fmtLeft(e.start - now) })),
  };
}

/** Строки для сводки ИИ (раздел «Сейчас в игре»). */
export function briefLines(b) {
  if (!b) return [];
  const L = [];
  const perkRu = n => (PERKS[n] ? `${n} (${PERKS[n].replace(/\.$/, '')})` : n);
  L.push(tx`Дата SkyBlock: ${b.sb.day} ${b.sb.monthEn} (${b.sb.monthRu}), год ${b.sb.year}.`);
  if (b.mayor) L.push(tx`Мэр: ${b.mayor.name}${b.mayor.role ? ` (${b.mayor.role})` : ''}, перки: ${b.mayor.perks.map(perkRu).join('; ') || '—'}. До смены мэра ${b.termLeft}.`);
  else L.push('Мэр: неизвестен (данные выборов ещё не загружены).');
  if (b.minister) L.push(tx`Министр: ${b.minister.name}${b.minister.perk ? tx`, перк ${perkRu(b.minister.perk)}` : ''}.`);
  if (b.leader) L.push(tx`Идут выборы, лидирует ${b.leader.name}${b.leader.pct != null ? ` (${b.leader.pct}%)` : ''}.`);
  const nm = e => (e.en ? `${e.name} (${e.en})` : e.name);
  const act = b.active.map(e => tx`${nm(e)}, ещё ${e.left}`);
  if (act.length) L.push(tx`Идёт сейчас: ${act.join(', ')}.`);
  const soon = b.soon.map(e => tx`${nm(e)} через ${e.in}`);
  if (soon.length) L.push(tx`Скоро: ${soon.slice(0, 6).join(', ')}.`);
  return L;
}

/**
 * Что действующие перки значат для заработка (те же правила, что множители во вкладке «Заработок»):
 * [{ mayor, perk, title, note, pct }] — pct: на сколько процентов меняется доход затронутых методов (0 — подсказка).
 */
export function moneyHints(perks) {
  const set = new Set(perks || []);
  return MAYOR_RULES.filter(r => set.has(r.perk)).map(r => ({
    mayor: r.mayor, perk: r.perk, title: perkTitle(r.perk) || r.perk, note: r.note, pct: Math.round((r.factor - 1) * 100),
  }));
}

/** Маршрут /api/calendar (общий для всех: не зависит от профиля). refs — «подсказки по тексту» для блока про заработок. */

