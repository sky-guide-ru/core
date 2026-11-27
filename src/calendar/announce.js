// Объявления событий SkyBlock для канала Discord: что и когда объявить. Сама отправка — в api (discord-events.js).
// Берём только то, что календарь уже знает: расписание считается по часам SkyBlock, выборы и Fire Sales —
// из ответов, которые refreshMayor и так получает раз в 20 минут. Своих запросов к Hypixel здесь нет.
//
// Объявление: { key, role, at, until, start, end, emoji, title, ru, en?, color, crops?, perks?, minister?, sale? }
//   key   — уникален: по нему не повторяем после перезапуска
//   role  — роль-подписка, которую пингуем: jacob | darkauction | mayor | firesale | events
//   at    — с какого момента пора отправить; until — после него уже поздно (старое не догоняем)
import { hourlyNext, yearlyIn, perkEvents, electionWindow, nextTermChange } from './events.js';
import { sbDate, YEAR } from './time.js';
import { electionRaw, activePerks, fireSalesList } from './index.js';
import { mayorView, perkTitle, PERKS, stripCodes } from './mayors.js';

export const ROLES = ['jacob', 'darkauction', 'mayor', 'firesale', 'events'];
const MIN = 60_000;
export const LEAD = { jacob: 5 * MIN, darkauction: 5 * MIN, events: 10 * MIN };

const EMOJI = {
  jacob: '🌾', darkauction: '🕶️', mayor: '🗳️', firesale: '🔥',
  hoppity: '🐰', 'zoo-summer': '🦁', 'zoo-winter': '🦁', spooky: '🎃', workshop: '❄️', jerry: '🎁', newyear: '🎂', fishfest: '🦈',
};
const hex = c => parseInt(String(c || '#9aa4b2').replace('#', ''), 16);

/** Объявления, которые пора отправить в момент now (в порядке начала). */
export function dueAnnouncements(now = Date.now(), { cropsAt = () => null, election = electionRaw(), sales = fireSalesList(), perks = null } = {}) {
  const out = [];
  const timed = (e, role, lead, until) => {
    const at = e.start - lead;
    if (now < at || now >= until) return;
    out.push({ key: `${e.id}:${e.start}`, role, at, until, start: e.start, end: e.end, emoji: EMOJI[e.id] || '📅',
      title: e.en || e.name, ru: e.what, color: hex(e.color) });
  };

  // Jacob и Dark Auction: каждый час, за 5 минут до начала; после старта уже не шлём
  for (const e of hourlyNext(now - 10 * MIN, 2)) {
    const role = e.id === 'jacob' ? 'jacob' : 'darkauction';
    const before = out.length;
    timed(e, role, LEAD[role], e.start);
    if (role === 'jacob' && out.length > before) {
      const crops = cropsAt(e.start);
      if (crops?.length) out[out.length - 1].crops = crops;
    }
  }

  // Большие события года и Fishing Festival от перка: за 10 минут, а если сервер перезапустился — ещё полчаса после старта
  const { year } = sbDate(now);
  const big = [...yearlyIn(year), ...yearlyIn(year + 1)];
  if (election?.mayor) {
    const termEnd = nextTermChange(now);
    big.push(...perkEvents(perks || activePerks(election), termEnd - YEAR, termEnd).filter(e => !e.whole && !e.approx));
  }
  for (const e of big) timed(e, 'events', LEAD.events, Math.min(e.end, e.start + 30 * MIN));

  // Открытие выборов (голосование у Election Booth в Hub)
  const w = electionWindow(now);
  if (now >= w.opens && now < w.opens + 3 * 3600_000) {
    out.push({ key: `election-open:${w.opens}`, role: 'mayor', at: w.opens, until: w.opens + 3 * 3600_000, start: w.opens, end: w.closes,
      emoji: EMOJI.mayor, title: 'Mayor Election', ru: 'Выборы открыты: голосовать можно у Election Booth в Hub.', en: 'Voting is open at the Election Booth in the Hub.', color: 0xc3a6ff });
  }

  // Новый мэр: как только в ответе выборов сменился мэр. Срок — год SkyBlock, до следующей смены
  const m = election?.mayor ? mayorView(election.mayor) : null;
  if (m) {
    const termEnd = nextTermChange(now);
    const mi = election.mayor.minister;
    out.push({
      key: `mayor:${election.mayor.election?.year ?? sbDate(termEnd - YEAR).year}:${m.key}`, role: 'mayor', at: 0, until: termEnd, start: termEnd - YEAR, end: termEnd,
      emoji: EMOJI.mayor, title: `Mayor ${m.name}`, ru: m.tip || '', color: hex(m.color),
      perks: m.perks.map(p => ({ name: p.name, ru: p.ru || null, en: p.en || null })),
      minister: mi?.name ? { name: mi.name, perk: mi.perk?.name ? { name: mi.perk.name, ru: PERKS[mi.perk.name] || null, en: stripCodes(mi.perk.description) || null, title: perkTitle(mi.perk.name) } : null } : null,
    });
  }

  // Fire Sales: как только Hypixel объявил распродажу (обычно за несколько дней), и пока она не кончилась
  for (const s of sales || []) {
    const start = Number(s.start), end = Number(s.end);
    if (!(end > now)) continue;
    out.push({ key: `firesale:${s.item_id}:${start}`, role: 'firesale', at: 0, until: end, start, end, emoji: EMOJI.firesale,
      title: `Fire Sale: ${s.name || s.item_id}`, ru: 'Ограниченная косметика за SkyBlock Gems: Community Center → Elizabeth → Fire Sales.',
      en: 'Limited cosmetic for SkyBlock Gems: Community Center → Elizabeth → Fire Sales.', color: 0xff7a45,
      sale: { item: s.item_id, amount: Number(s.amount) || 0, price: Number(s.price) || 0 } });
  }

  return out.sort((a, b) => a.start - b.start);
}
