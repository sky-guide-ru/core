// Готовая замена server/analysis/roadmap.js в ядре.
// Модуль advisor копируется в server/advisor/, этот файл — в server/analysis/roadmap.js.
// Сигнатура buildRoadmap(member, acc, gear) не меняется, state.js править не нужно.
import { priceOf, buyPriceOf } from '../prices.js';
import { neu, itemName } from '../neu.js';
import { moneyMethods } from './money.js';
import * as advisor from '../advisor/index.js';
import { activePerks } from '../calendar/index.js';
import { obtainHint } from '../lib/npc-shop.js';

let collectionTiers = null;
/** Ядро может один раз передать пороги коллекций из /v2/resources/skyblock/collections. */
export function setCollectionsResource(resp) { collectionTiers = advisor.collectionTiersFromResources(resp); }

// methods — уже посчитанные способы заработка (analyzeMember считает их с оценкой богатства): второй расчёт
// без неё занимал до трети разбора профиля и давал плану другой бюджет, чем у раздела «Заработок»
function opts(member, methods = null) {
  if (!methods) { methods = []; try { methods = moneyMethods(member); } catch {} }
  return {
    price: priceOf,
    // Цена покупки (Instant Buy): для шагов, где советуем купить на Bazaar (гемы)
    buyPrice: buyPriceOf,
    // itemName убирает шаблон «[Lvl {LVL}]» из названий питомцев NEU
    itemName: id => itemName(id)?.replace(/§./g, ''),
    constants: neu.constants,
    moneyMethods: methods,
    collectionTiers,
    // Ironman, Stranded, Bingo: где добыть или у какого NPC купить
    obtain: id => obtainHint(neu.items, id),
    // Перки мэра и министра сейчас (Aatrox и т. п.)
    mayorPerks: (() => { try { return activePerks(); } catch { return []; } })(),
  };
}

export function buildRoadmap(member, acc, gear) {
  return advisor.buildRoadmap(member, acc, gear, opts(member));
}

export function buildProgressMap(member, acc, gear) {
  return advisor.buildProgressMap(member, acc, gear, opts(member));
}

export function advise(member, acc, gear, methods = null) {
  return advisor.advise(member, acc, gear, opts(member, methods));
}

export const diffRoadmaps = advisor.diffRoadmaps;
