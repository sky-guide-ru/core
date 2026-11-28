// Гайды по направлениям игры (данжи, слееры, Kuudra, Рифт, рыбалка…), подстроенные под профиль.
// Каждый гайд — отдельный файл server/guides/<id>.js с default-экспортом
//   { id, title, icon, group, build(member, ctx) }
// и одна строка в массиве GUIDES ниже. Формат результата build() описан в README.md рядом.
import { makeCtx } from '../advisor/lib/util.js';
import { enrichGuide } from './refs.js';
import { sendNoMember, loadMember } from '../lib/view-error.js';
import { howtoSection } from './howto.js';
import { finalizeGuide } from './after.js';
import { wikiNoticeSection } from '../wiki/watch.js';
import { sourcesSection } from './sources.js';
import dungeons from './dungeons.js';
import slayers from './slayers.js';
import kuudra from './kuudra.js';
import crimson from './crimson.js';
import rift from './rift.js';
import fishing from './fishing.js';
import trophy from './trophy.js';
import mining from './mining.js';
import forge from './forge.js';
import farming from './farming.js';
import foraging from './foraging.js';
import minions from './minions.js';
import museum from './museum.js';
import essence from './essence.js';
import collectibles from './collectibles.js';
import diana from './diana.js';
import hunting from './hunting.js';
import chocolate from './chocolate.js';
import enchanting from './enchanting.js';
import taming from './taming.js';
import { tx } from '../../i18n/msg.js';

export const GUIDES = [
  // ↓ по одной строке на гайд (импорт сверху файла)
  dungeons,
  ...slayers,
  kuudra,
  crimson,
  rift,
  fishing,
  trophy,
  mining,
  forge,
  farming,
  foraging,
  hunting,
  minions,
  museum,
  essence,
  collectibles,
  diana,
  chocolate,
  enchanting,
  taming,
];

export const GROUPS = {
  combat: 'Combat', rift: 'Rift', fishing: 'Fishing', mining: 'Mining', farming: 'Farming', foraging: 'Foraging', hunting: 'Hunting', skills: 'Навыки', other: 'Разное',
  events: 'События',
};

/**
 * Контекст для build(): профиль, анализ, цены и помощники advisor.
 * @param {Object} member  state.member
 * @param {Object} analysis  state.analysis ({ acc, gear, roadmap, map, plan, summary, methods })
 * @param {Object} deps  { priceOf, priceInfo, itemName, constants }
 */
export function guideCtx(member, analysis = {}, deps = {}) {
  const adv = makeCtx(member, analysis?.acc, analysis?.gear, { price: deps.priceOf, itemName: deps.itemName, constants: deps.constants });
  return {
    m: member,
    analysis: analysis || {},
    inv: member?.inv || {},
    price: adv.price,                       // id → монеты (0, если цены нет)
    priceInfo: deps.priceInfo || (() => null), // id → { bazaar, bin, … } как в /api/item
    name: adv.name,                         // id → английское имя предмета
    owned: adv.owned,                       // Map id → [{ ...item, where }]
    has: id => adv.owned.has(id),
    adv,                                    // полный контекст advisor (data.slayerXp и т. п.)
    constants: deps.constants || null,      // константы NEU (fairy_souls, abiphone, islands…)
    items: deps.items || null,              // Map id → предмет NEU (координаты NPC для подсказок)
    market: deps.market || null,            // MarketCtx (цены Bazaar/AH для гайда The Forge); без него — только цены priceOf
    collections: deps.collections || null,  // пороги коллекций для «Requires: Mithril X»
  };
}

function safeBuild(g, member, ctx) {
  try {
    const r = g.build(member, ctx) || {};
    const out = { id: g.id, title: g.title, icon: g.icon, group: g.group, sections: [], ...r };
    const how = howtoSection(g.id);
    if (how) out.sections = [how, ...out.sections];
    const wiki = wikiNoticeSection(g.id); // страницы вики правили после сверки — честная пометка в конце
    if (wiki) out.sections = [...out.sections, wiki];
    out.sections = [...out.sections, sourcesSection(g.id)]; // откуда данные и видеогайды — всегда последним
    return finalizeGuide(out); // «почти готово» и «что дальше» для пройденного (after.js)
  } catch (e) {
    return { id: g.id, title: g.title, icon: g.icon, group: g.group, status: 'error', summary: tx`Гайд не собрался: ${e?.message || e}`, sections: [] };
  }
}

/** Все гайды целиком. */
export function buildGuides(member, analysis, deps, list = GUIDES) {
  if (!member) return [];
  const ctx = guideCtx(member, analysis, deps);
  return list.map(g => safeBuild(g, member, ctx));
}

/** Один гайд по id (или null). */
export function buildGuide(id, member, analysis, deps, list = GUIDES) {
  const g = list.find(x => x.id === id);
  if (!g || !member) return null;
  return safeBuild(g, member, guideCtx(member, analysis, deps));
}

export const forGuest = g => ({ ...g, guest: true, status: null, almost: false, level: null, summary: null });
export const brief = g => ({ id: g.id, title: g.title, icon: g.icon, group: g.group, summary: g.summary, status: g.status, almost: !!g.almost, level: g.level, nextCount: g.next?.length || 0, next: (g.next || []).slice(0, 1) });

/**
 * GET /api/guides — список с кратким итогом, GET /api/guides/:id — гайд целиком.
 * getView(req) → { member, analysis } выбранного игрока (свой профиль или друг); иначе getMember()/getAnalysis().
 */

