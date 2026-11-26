// Слежение за правками вики после сверки гайдов.
// Цифры гайдов сверены вручную по fandom-вики (hypixel-skyblock.fandom.com) — она открывается из России, в отличие от
// hypixelskyblock.minecraft.wiki, а официальная wiki.hypixel.net закрыта Hypixel в июле 2026. Раз в сутки сервер
// спрашивает у API fandom дату последней правки нужных страниц (только чтение, один запрос). Если страницу правили
// после сверки, гайд показывает короткую пометку: какие страницы изменились и когда. Числа сами не подменяются:
// разбирать вики-разметку автоматически ненадёжно, а неправильная цифра хуже честной пометки.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getJson } from '../http.js';
import { tx } from '../../i18n/msg.js';

export const WIKI_API = 'https://hypixel-skyblock.fandom.com/api.php';
export const WIKI_URL = 'https://hypixel-skyblock.fandom.com/wiki/';

/** Дата сверки и страницы вики, на которых держатся цифры каждого гайда. */
export const VERIFIED_AT = '2026-11-23';
export const GUIDE_PAGES = {
  trophy: ['Trophy Fish', 'Trophy Fish Chance', 'Odger', 'Essence Shops/Gold', 'Essence Shops/Diamond'],
  fishing: ['Sea Creatures'],
  crimson: ['Dojo', 'Kuudra Key', 'Faction', 'Black Belt'],
  essence: ['Essence', 'Essence Shops', 'Essence Shops/Undead', 'Essence Shops/Wither', 'Essence Shops/Dragon', 'Essence Shops/Spider',
    'Essence Shops/Crimson', 'Essence Shops/Ice', 'Essence Shops/Gold', 'Essence Shops/Diamond', 'Essence Shops/Forest'],
  collectibles: ['Harp', 'Personal Harp', "Melody's Hair"],
  diana: ['Mythological Ritual'],
  minions: ['Revenant Minion', 'Tarantula Minion', 'Voidling Minion'],
  hunting: ['Hunting', 'Attributes', 'Attributes/List/Common', 'Attributes/List/Uncommon', 'Attributes/List/Rare', 'Attributes/List/Epic',
    'Attributes/List/Legendary', 'Huntraps', 'Salts', 'Attribute Fusion'],
  chocolate: ['Chocolate Factory', "Hoppity's Hunt"],
};

const FILE = () => path.join(config.dataDir, 'wiki-revisions.json');
let state = { checkedAt: null, pages: {} };
try { state = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { /* первый запуск */ }

/** Для тестов: подменить состояние. */
export function setWikiState(s) { state = s || { checkedAt: null, pages: {} }; }

/** Все страницы, за которыми следим. */
export const allPages = () => [...new Set(Object.values(GUIDE_PAGES).flat())];

/** Разобрать ответ API (prop=revisions) в { title: ISO-время последней правки }. Учитывает нормализацию названий. */
export function parseRevisions(json) {
  const q = json?.query || {};
  const back = new Map();
  for (const n of q.normalized || []) back.set(n.to, n.from);
  for (const r of q.redirects || []) back.set(r.to, back.get(r.from) || r.from);
  const out = {};
  for (const p of Object.values(q.pages || {})) {
    const ts = p?.revisions?.[0]?.timestamp;
    if (!ts) continue;
    out[p.title] = ts;
    if (back.has(p.title)) out[back.get(p.title)] = ts;
  }
  return out;
}

/** Раз в сутки: последние правки всех страниц одним запросом (до 50 названий). */
export async function refreshWiki({ fetchJson = getJson, save = true } = {}) {
  const titles = allPages();
  const url = `${WIKI_API}?action=query&format=json&prop=revisions&rvprop=timestamp&redirects=1&titles=${encodeURIComponent(titles.join('|'))}`;
  const json = await fetchJson(url, { timeout: 20_000, retries: 1 });
  const pages = parseRevisions(json);
  if (!Object.keys(pages).length) throw new Error('вики не вернула ни одной страницы');
  state = { checkedAt: new Date().toISOString(), pages };
  if (save) try { fs.mkdirSync(config.dataDir, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(state, null, 1)); } catch { /* не критично */ }
  return state;
}

/** Страницы гайда, которые правили после сверки: [{ title, at, url }]. */
export function wikiChanges(guideId) {
  const since = Date.parse(`${VERIFIED_AT}T23:59:59Z`);
  return (GUIDE_PAGES[guideId] || [])
    .map(title => ({ title, at: state.pages?.[title] || null }))
    .filter(x => x.at && Date.parse(x.at) > since)
    .map(x => ({ ...x, url: WIKI_URL + encodeURIComponent(x.title.replace(/ /g, '_')) }));
}

const ruDate = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Секция-пометка для гайда или null, если правок после сверки нет. */
export function wikiNoticeSection(guideId) {
  const ch = wikiChanges(guideId);
  if (!ch.length) return null;
  return {
    kind: 'text', title: 'Вики обновилась после сверки',
    text: [
      tx`Цифры этого гайда сверены с fandom-вики ${ruDate(`${VERIFIED_AT}T12:00:00Z`)}. После этого на вики правили: ${ch.map(x => `${x.title} (${ruDate(x.at)})`).join(', ')}.`,
      'Правка могла быть мелкой, но если цифра в игре не сходится с гайдом, верь игре.',
    ],
  };
}
