// Заработок: флипы Bazaar/NPC/крафт/Forge, фарм культур, методы с проверкой требований и план.
// Замена server/analysis/money.js ядра: прежние экспорты (bazaarFlips, craftFlips, cropProfits, moneyMethods, npcPrices, fmtCoins) сохранены.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { prices } from '../prices.js';
import { neu, itemName } from '../neu.js';
import { getElection, getFireSales } from '../hypixel.js';
import { setElection, setFireSales, activePerks } from '../calendar/index.js';
import { fmtCoins } from '../../i18n/ru.js';
import * as mk from '../market/index.js';
import { displayName, itemCategory } from '../names.js';
import { tx } from '../../i18n/msg.js';

/** Пороги коллекций Hypixel по названию (для проверки «Requires: Nether Wart XI»). Заполняет ядро. */
export let craftCollections = null;
export function setCraftCollections(resp) { craftCollections = mk.collectionsByName(resp); }

export const npcPrices = new Map(); // id -> цена продажи NPC (заполняет ядро из /resources/skyblock/items)

// ---------- настройки и личные сессии (data/money.json) ----------
const FILE = () => path.join(config.dataDir, 'money.json');
export const moneyState = { settings: { farmingFortune: null, bps: 19.5, tax: 0.01125, forgeSlots: null, quickForge: null, mayor: null, mayorAuto: null }, sessions: [] };
try {
  const d = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  Object.assign(moneyState.settings, d.settings || {});
  moneyState.sessions = d.sessions || [];
} catch {}
function save() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(FILE() + '.tmp', JSON.stringify(moneyState, null, 1));
  fs.renameSync(FILE() + '.tmp', FILE());
}

const ALLOWED = ['farmingFortune', 'bps', 'tax', 'forgeSlots', 'quickForge', 'mayor'];
/** Обновить настройки расчёта (Farming Fortune, налог Bazaar и т.д.). */
export function setMoneySettings(patch = {}) {
  for (const k of ALLOWED) if (k in patch) moneyState.settings[k] = patch[k] === '' ? null : patch[k];
  save();
  return moneyState.settings;
}

/** Записать свою сессию заработка (для личного дохода в час). */
export function addSession(s) {
  const session = mk.makeSession(s);
  moneyState.sessions.push(session);
  if (moneyState.sessions.length > 500) moneyState.sessions.splice(0, moneyState.sessions.length - 500);
  save();
  return session;
}

/** Обновить текущего мэра и выборы (Diana в «Заработке», календарь событий). Вызывать раз в 20 минут. */
export async function refreshMayor() {
  const d = await getElection();
  setElection(d); // календарь событий и советчик (server/calendar)
  getFireSales().then(r => setFireSales(r, itemName)).catch(() => {}); // Fire Sales в календарь: публичный запрос, лимит ключа не тратит
  // Mythological Ritual бывает и у министра Diana: тогда метод «Diana» в «Заработке» тоже доступен
  const name = d?.mayor?.name || null;
  const ritual = activePerks(d).includes('Mythological Ritual') && !/diana/i.test(name || '');
  moneyState.settings.mayorAuto = name ? (ritual ? tx`${name} (министр Diana)` : name) : null;
  return moneyState.settings.mayorAuto;
}

// ---------- контекст рынка ----------
// Цены Bazaar приходят раз в 20 с (ради свечей «Рынка»), продажи AH — раз в минуту. Пересчитывать «Заработок»
// на каждый такой тик — лишняя нагрузка на один поток сервера: расчёт обновляется не чаще раза в 2 минуты
const EPOCH_MS = 120_000;
const epoch = t => Math.floor((t || 0) / EPOCH_MS);
const marketEpoch = () => tx`${epoch(prices.bazaarAt)}|${prices.binAt}|${epoch(prices.soldAt)}`;
let cache = { key: '', ctx: null };
export function marketCtx() {
  const key = tx`${marketEpoch()}|${neu.loadedAt}|${npcPrices.size}|${moneyState.settings.tax}`;
  if (cache.key !== key) {
    cache = {
      key,
      ctx: {
        bazaar: prices.bazaar, bin: prices.bin, binVar: prices.binVar, constants: neu.constants, sold: prices.sold, history: prices.history, binHistory: prices.binHistory,
        npc: npcPrices, items: neu.items, name: id => displayName(id, neu.items), kind: itemCategory, tax: Number(moneyState.settings.tax ?? 0.01125), now: Date.now(),
      },
      memo: new Map(),
    };
  }
  return cache.ctx;
}
// результаты тяжёлых расчётов кэшируются до следующего обновления цен
function memo(name, opts, fn) {
  marketCtx();
  const k = name + JSON.stringify(opts || {});
  if (!cache.memo.has(k)) cache.memo.set(k, fn());
  return cache.memo.get(k);
}

/**
 * Чей профиль у владельца сайта: его ползунок Farming Fortune, слоты Forge и личные сессии заработка
 * относятся только к нему. Для кооп-соседа и друзей Fortune оценивается по их снаряжению, сессий нет.
 */
let ownerUuid = null;
export const setMoneyOwner = uuid => { ownerUuid = uuid || null; };
const isOwnerMember = m => !ownerUuid || !m?.uuid || m.uuid === ownerUuid;

function methodOpts(extra = {}, member = null) {
  const s = moneyState.settings;
  const mine = isOwnerMember(member);
  return {
    farmingFortune: mine ? s.farmingFortune ?? undefined : undefined, bps: s.bps ?? undefined,
    forgeSlots: mine ? s.forgeSlots ?? undefined : undefined, quickForge: mine ? s.quickForge ?? undefined : undefined,
    mayor: s.mayor || s.mayorAuto || undefined,
    // перки мэра и министра для множителей дохода; если мэра задали вручную, живые перки не подставляем
    perks: s.mayor ? [] : activePerks(), sessions: mine ? moneyState.sessions : [], collections: craftCollections || undefined, ...extra,
  };
}

// ---------- публичные функции (контракт) ----------
export const bazaarFlips = (opts = {}) => memo('bz', opts, () => mk.bazaarFlips(marketCtx(), opts));
export const npcFlips = (opts = {}) => memo('npc', opts, () => mk.npcFlips(marketCtx(), opts));
export const craftFlips = (opts = {}) => memo('craft', opts, () => mk.craftFlips(marketCtx(), opts));
export const forgeFlips = (opts = {}) => memo('forge', opts, () => mk.forgeFlips(marketCtx(), opts));
export const binSnipes = (opts = {}) => memo('snipe', opts, () => mk.binSnipes(marketCtx(), opts));
export const topMovers = (opts = {}) => memo('movers', opts, () => mk.topMovers(marketCtx(), opts));
export function cropProfits(fortune, bps) {
  const ff = fortune ?? moneyState.settings.farmingFortune ?? 1500;
  return mk.cropProfits(marketCtx(), ff, { bps: bps ?? moneyState.settings.bps ?? 19.5 });
}
// Расчёт всех способов заработка — самое долгое на странице «Заработок» (~1–2 с на профиль).
// Держим последний результат на профиль, пока не обновились профиль (новый объект member), цены и настройки.
const methodsMemo = new WeakMap();
export function moneyMethods(member, extra) {
  const opts = methodOpts(extra, member);
  if (!member || typeof member !== 'object') return mk.moneyMethods(member, marketCtx(), opts);
  const key = JSON.stringify([marketEpoch(), moneyState.settings, extra || null, opts.perks]);
  const hit = methodsMemo.get(member);
  if (hit && hit.key === key) return hit.value;
  const value = mk.moneyMethods(member, marketCtx(), opts);
  methodsMemo.set(member, { key, value });
  return value;
}
export function moneyPlan(member, extra, list) {
  return mk.moneyPlan(member, marketCtx(), { ...methodOpts(extra, member), list: list || moneyMethods(member, extra) });
}

export { fmtCoins };
