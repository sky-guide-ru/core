// Сборка русской базы предметов из данных NEU. Чистая функция: на вход — предметы NEU
// (сырые JSON из репозитория или уже разобранные ядром в server/neu.js), константы NEU и
// словарь ванильных названий Minecraft (en → ru). На выход — объект { items: {id: ItemRu}, lore: {id: string[]} }.

import {
  RARITY, ITEM_TYPES, CATEGORIES, STATS, SLAYER_REQ, ISLANDS, ENCHANTS_RU,
  WEAPON_TYPES, ARMOR_TYPES, EQUIPMENT_TYPES, TOOL_TYPES, fmtCoins, fmtDuration, intToRoman,
} from './glossary.js';
import { wikiDropAmount } from '../../analysis/obtain.js';
import { stripColor, normalizeGlyphs, translateLore, translateLoreLine } from './lore.js';
import { TYPE_GENDER, agreeAdj, RARITY_WORDS_RU } from './glossary.js';
import { tx } from '../../../i18n/msg.js';
export { agreeAdj };

/**
 * @typedef {{ kind: 'craft'|'npc'|'drop'|'forge'|'shop'|'other', textRu: string, source: string|null,
 *   subkind?: string, cost?: {id: string, count: number}[], chance?: string, island?: string, coords?: number[],
 *   duration?: number, coins?: number, requirementRu?: string }} WhereToGet
 * @typedef {{ id: string, nameEn: string, nameRu: string, rarity: string|null, rarityRu: string, type: string|null,
 *   typeRu: string, dungeon: boolean, category: string, categoryRu: string, descriptionRu: string,
 *   stats: Record<string, number>, requirementsRu: string[], abilities: {name: string, trigger: string|null}[],
 *   whereToGet: WhereToGet[], usedIn: string[], upgradesTo: string[], upgradesFrom: string[],
 *   wikiUrl: string|null, texture: object, untranslatedLines: number }} ItemRu
 */

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL', 'VERY SPECIAL', 'ULTIMATE', 'ADMIN'];
const PET_TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

// «Зачарованный» + существительное: род определяем по главному слову русского названия
const FEM_SOFT = new Set(['морковь', 'кость', 'нить', 'пыль', 'соль', 'медь', 'сталь', 'ветвь', 'печь', 'дверь', 'тыква', 'плоть']);
const PLURAL_WORDS = new Set(['семена', 'ягоды', 'бобы', 'какао-бобы', 'кирпичи', 'ножницы']);
function nounGender(word) {
  const w = word.toLowerCase();
  if (PLURAL_WORDS.has(w) || /(ы|и)$/.test(w) && !/(ий)$/.test(w)) return 'pl';
  if (FEM_SOFT.has(w) || /(а|я)$/.test(w)) return 'f';
  if (/(о|е|ё)$/.test(w) && !/(ье)$/.test(w) || /ье$/.test(w)) return 'n';
  return 'm';
}
function headNoun(ru) {
  const words = ru.split(/\s+/);
  return words.find(w => !/(ый|ий|ой|ая|яя|ое|ее|ые|ие)$/.test(w.toLowerCase())) || words[words.length - 1];
}
function enchantedRu(baseRu) {
  const g = nounGender(headNoun(baseRu));
  const adj = agreeAdj('Зачарованный', g);
  return `${adj} ${baseRu[0].toLowerCase()}${baseRu.slice(1)}`;
}

// ── нормализация входа (сырой JSON NEU или Item ядра) ──
function normalize(j) {
  if (j.internalname) {
    return {
      id: j.internalname, rawName: j.displayname || j.internalname, mcId: j.itemid || '', damage: j.damage || 0,
      nbt: j.nbttag || '', lore: j.lore || [], recipe: j.recipe || null, recipes: j.recipes || [], info: j.info || [],
      infoType: j.infoType || '', crafttext: j.crafttext || '', vanilla: !!j.vanilla, island: j.island || null,
      coords: j.x != null ? [j.x, j.y, j.z] : null, slayerReq: j.slayer_req || null,
    };
  }
  return {
    id: j.id, rawName: j.rawName || j.name || j.id, mcId: j.mcId || '', damage: j.damage || 0, nbt: j.rawNbt || '',
    lore: j.lore || [], recipe: j.recipe || null, recipes: j.recipes || [], info: j.info || [], infoType: j.infoType || '',
    crafttext: j.crafttext || '', vanilla: !!j.vanilla, island: j.island || null,
    coords: j.x != null ? [j.x, j.y, j.z] : null, slayerReq: j.slayer_req || j.slayerReq || null,
  };
}

function parseRarityType(lore) {
  // §k — «шифрованные» символы вокруг SPECIAL («a SPECIAL a»): убираем их до разбора
  const last = normalizeGlyphs(stripColor(String(lore[lore.length - 1] || '').replace(/§k[^§]*/g, ''))).trim();
  const m = /^(?:a )?(VERY SPECIAL|COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL|ULTIMATE|ADMIN)(?:\s+(.*))?$/.exec(last);
  if (!m) return { rarity: null, type: null, dungeon: false };
  let type = (m[2] || '').trim();
  const dungeon = /^DUNGEON\b/.test(type);
  type = type.replace(/^DUNGEON\s*/, '') || (dungeon ? 'DUNGEON ITEM' : '');
  return { rarity: m[1], type: type || null, dungeon };
}

const parseCount = s => {
  const [id, n] = String(s).split(/:(?=[\d.]+$)/);
  return { id, count: n ? Number(n) : 1 };
};

function textureOf(it) {
  const raw = it.nbt;
  const m = /Value:\\?"([A-Za-z0-9+/=]+)\\?"/.exec(raw);
  if (m) {
    try {
      const j = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
      const url = j.textures?.SKIN?.url || '';
      const hash = url.split('/').pop();
      if (hash) return { kind: 'head', hash, url: `https://textures.minecraft.net/texture/${hash}` };
    } catch { /* битый base64 — падаем на обычную текстуру */ }
  }
  const model = (/ItemModel:"([a-z0-9_:/.-]+)"/.exec(raw) || [])[1] || null;
  const color = (/color:(\d+)/.exec(raw) || [])[1];
  const t = { kind: 'item', mcId: it.mcId.replace('minecraft:', ''), damage: it.damage, model };
  if (color) t.color = Number(color);
  if (/ench:\[/.test(raw)) t.glint = true;
  return t;
}

/**
 * Один и тот же дроп с разновидностей моба (7 драконов Ender Dragon с шансом 3%) — одной строкой:
 * «Выпадает с Ender Dragon (Old, Protector, …), шанс 3% за каждый Summoning Eye».
 */
export function mergeMobVariants(list) {
  const groups = new Map();
  for (const w of list) {
    if (w.kind !== 'drop' || !w.mob) continue;
    if (/\(/.test(w.mob)) continue;
    // тиры босса: «Voidgloom Seraph II/III/IV»; разновидности: «Old/Young … Ender Dragon»
    const t = /^(.+?)\s+([IVX]+)$/.exec(w.mob);
    const m = t ? null : /^(.+?)\s+(\S+(?:\s+\S+)?)$/.exec(w.mob);
    if (!t && !m) continue;
    const base = t ? t[1] : m[2], prefix = t ? t[2] : m[1];
    const key = `${t ? 'T' : 'V'}|${base}|${w.chance || ''}`;
    if (!groups.has(key)) groups.set(key, { tiers: !!t, list: [] });
    groups.get(key).list.push({ w, prefix, base });
  }
  const drop = new Set();
  const merged = new Map();
  for (const { tiers, list: g } of groups.values()) {
    if (g.length < (tiers ? 2 : 3)) continue;
    const first = g[0].w;
    const chance = first.textRu.match(/, шанс .+$/)?.[0] || '';
    const levels = [...new Set(g.flatMap(x => x.w.levels || []))].sort((a, b) => a - b);
    const lv = levels.length ? tx`, ур. ${levels[0]}${levels.length > 1 ? `–${levels[levels.length - 1]}` : ''}` : '';
    merged.set(first, { ...first, mob: g[0].base, mobs: g.map(x => x.w.mob), levels,
      textRu: tx`Выпадает с ${g[0].base} (${tiers ? 'тир ' : ''}${g.map(x => x.prefix).join(', ')})${lv}${chance}` });
    for (const x of g.slice(1)) drop.add(x.w);
  }
  return list.filter(w => !drop.has(w)).map(w => merged.get(w) || w);
}

// Осколки охоты (Galatea): «FOREST SHARD (ID R34)» → «Forest Shard, ID R34» — как в игре
function typeRuOf(type) {
  const sh = /^(\w+) SHARD \(ID (\w+)\)$/.exec(type);
  if (sh) return `${sh[1][0]}${sh[1].slice(1).toLowerCase()} Shard, ID ${sh[2]}`;
  return ITEM_TYPES[type] || type;
}

function categoryOf(it, type, isBook) {
  const id = it.id;
  if (isBook) return 'enchant_book';
  if (/_NPC$/.test(id)) return 'npc';
  if (/_(MONSTER|MOB|BOSS|MINIBOSS|SC)$/.test(id)) return 'mob';
  if (/_GENERATOR_\d+$/.test(id)) return 'minion';
  if (type === 'PET') return 'pet';
  if (/^ATTRIBUTE_SHARD|^SHARD_/.test(id) || type === 'SHARD' || / SHARD \(ID \w+\)$/.test(type || '')) return 'shard';
  if (/_RUNE;\d+$|^RUNE_/.test(id)) return 'rune';
  if (!type) return 'material';
  if (WEAPON_TYPES.has(type)) return 'weapon';
  if (ARMOR_TYPES.has(type)) return 'armor';
  if (EQUIPMENT_TYPES.has(type)) return 'equipment';
  if (type === 'ACCESSORY' || type === 'HATCESSORY') return 'accessory';
  if (type === 'PET ITEM') return 'pet_item';
  if (TOOL_TYPES.has(type)) return 'tool';
  if (type === 'REFORGE STONE') return 'reforge_stone';
  if (type === 'POWER STONE') return 'power_stone';
  if (type === 'GEMSTONE') return 'gemstone';
  if (type === 'SACK') return 'sack';
  if (['COSMETIC', 'DYE', 'CARNIVAL MASK'].includes(type)) return 'cosmetic';
  if (['ORE', 'BLOCK', 'DWARVEN METAL', 'MUTATION', 'SALT'].includes(type)) return 'material';
  if (['BAIT', 'BOOSTER', 'TRAVEL SCROLL', 'CONSUMABLE', 'ARROW', 'ARROW POISON'].includes(type)) return 'consumable';
  return 'misc';
}

/**
 * @param {Iterable<object>} rawItems предметы NEU
 * @param {{ constants?: object, vanillaRu?: Record<string,string>, curated?: Record<string, object> }} [opts]
 */
export function buildDatabase(rawItems, { constants = {}, vanillaRu = {}, curated = {} } = {}) {
  const src = new Map();
  for (const j of rawItems) { const it = normalize(j); if (it.id) src.set(it.id, it); }
  const areaNames = constants.islands?.area_names || {};
  const islandRu = k => (k ? (ISLANDS[k] || areaNames[k] || k) : null);

  // ── проход 1: имена ──
  const names = new Map();
  const baseName = it => {
    let n = normalizeGlyphs(stripColor(it.rawName)).replace(/^\[Lvl \{LVL\}\]\s*/, '').trim();
    if (n === 'Enchanted Book') {
      const l = it.lore.map(x => normalizeGlyphs(stripColor(x)).trim()).filter(Boolean);
      const cand = l.find(x => /\s[IVX]+$/.test(x) && !/^-/.test(x));
      if (cand) n = cand;
    }
    return n.replace(/\s*\((NPC|Monster|BOSS|Miniboss|Sea Creature)\)$/i, '').replace(/^[^A-Za-z0-9'"\[(]+\s*/, '').trim() || n;
  };
  for (const it of src.values()) names.set(it.id, baseName(it));
  const nameOf = id => names.get(id) || names.get(id.split(':')[0]) ||
    id.split(';')[0].toLowerCase().split('_').map(w => w && w[0].toUpperCase() + w.slice(1)).join(' ');

  // ── проход 2: обратные индексы источников ──
  /** @type {Map<string, WhereToGet[]>} */
  const where = new Map();
  const usedIn = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const costText = arr => arr.map(c => {
    if (c.id === 'SKYBLOCK_COIN') return tx`${fmtCoins(c.count)} монет`;
    if (/^SKYBLOCK_(PELT|BITS|COPPER|NORTH_STAR|MOTE|GEMS)/.test(c.id)) {
      const cur = { SKYBLOCK_PELT: 'пушнины (Pelts)', SKYBLOCK_BIT: 'Bits', SKYBLOCK_BITS: 'Bits', SKYBLOCK_COPPER: 'меди (Copper)',
        SKYBLOCK_NORTH_STAR: 'North Stars', SKYBLOCK_MOTE: 'Motes', SKYBLOCK_GEMS: 'SkyBlock Gems' }[c.id] || c.id;
      return `${fmtCoins(c.count)} ${cur}`;
    }
    return `${c.count}× ${nameOf(c.id)}`;
  }).join(' + ');

  const gridInputs = r => {
    const cnt = new Map();
    for (const k of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']) {
      if (!r[k]) continue;
      const c = parseCount(r[k]);
      cnt.set(c.id, (cnt.get(c.id) || 0) + c.count);
    }
    return [...cnt].map(([id, count]) => ({ id, count }));
  };

  const reqFromCrafttext = (t, slayerReq) => {
    if (slayerReq && !t) {
      const m = /^([A-Z]+)_(\d+)$/.exec(slayerReq);
      if (m && SLAYER_REQ[m[1]]) return `${SLAYER_REQ[m[1]]} Slayer ${m[2]}`;
    }
    if (!t) return null;
    return t.replace(/^Requires:?\s*/, '').split(/\s*&\s*/).map(s => {
      let m;
      if ((m = /^HotM (\d+)$/.exec(s))) return `Heart of the Mountain ${m[1]}`;
      if ((m = /^HotF (\d+)$/.exec(s))) return `Heart of the Forest ${m[1]}`;
      if ((m = /^Bingo Rank ([IVX]+)$/.exec(s))) return tx`ранг Bingo ${m[1]}`;
      if ((m = /^(.+) ([IVX]+)$/.exec(s))) return tx`коллекция ${m[1]} ${m[2]}`;
      return s;
    }).join(' и ');
  };

  for (const it of src.values()) {
    const npcName = nameOf(it.id);
    const isNpc = /_NPC$/.test(it.id);
    const isMob = /_(MONSTER|MOB|BOSS|MINIBOSS|SC)$/.test(it.id);
    // крафт на верстаке (поле recipe)
    if (it.recipe) {
      const inputs = gridInputs(it.recipe);
      const out = it.recipe.overrideOutputId || it.id;
      const req = reqFromCrafttext(it.crafttext, it.slayerReq);
      push(where, out, { kind: 'craft', source: null, cost: inputs, requirementRu: req || undefined,
        textRu: tx`Крафт: ${costText(inputs)}${it.recipe.count > 1 ? tx` (выход ${it.recipe.count} шт.)` : ''}${req ? tx`. Нужно: ${req}` : ''}` });
      for (const c of inputs) push(usedIn, c.id, out);
    }
    for (const r of it.recipes) {
      switch (r.type) {
        case 'crafting': {
          const inputs = gridInputs(r);
          const out = r.overrideOutputId || it.id;
          if (it.recipe && out === (it.recipe.overrideOutputId || it.id) && JSON.stringify(inputs) === JSON.stringify(gridInputs(it.recipe))) break;
          push(where, out, { kind: 'craft', source: null, cost: inputs,
            textRu: tx`Крафт: ${costText(inputs)}${r.count > 1 ? tx` (выход ${r.count} шт.)` : ''}` });
          for (const c of inputs) push(usedIn, c.id, out);
          break;
        }
        case 'forge': {
          const inputs = (r.inputs || []).map(parseCount);
          const out = r.overrideOutputId || it.id;
          push(where, out, { kind: 'forge', source: 'FORGE', cost: inputs, duration: r.duration,
            textRu: tx`Кузница (Forge) в Dwarven Mines: ${costText(inputs)}${r.duration ? `, ${fmtDuration(r.duration)}` : ''}` });
          for (const c of inputs) push(usedIn, c.id, out);
          break;
        }
        case 'npc_shop': {
          const res = parseCount(r.result);
          const cost = (r.cost || []).map(parseCount);
          const isl = islandRu(it.island);
          push(where, res.id, { kind: 'npc', source: it.id, cost, island: it.island || undefined, coords: it.coords || undefined,
            textRu: tx`Купить у NPC ${npcName}${isl ? ` (${isl})` : ''} за ${costText(cost)}${res.count > 1 ? tx` — ${res.count} шт.` : ''}` });
          break;
        }
        case 'trade': {
          const res = parseCount(r.result);
          const cost = [parseCount(r.cost)];
          const isl = islandRu(it.island);
          // Рецепт «trade» в самом предмете — это обмен у торговцев режима Stranded (за изумруды и т.п.),
          // на обычном профиле так не получить
          if (isNpc) {
            push(where, res.id, { kind: 'npc', subkind: 'trade', source: it.id, cost, island: it.island || undefined,
              textRu: tx`Обменять у NPC ${npcName}${isl ? ` (${isl})` : ''} на ${costText(cost)}` });
          } else {
            push(where, res.id, { kind: 'npc', subkind: 'trade', stranded: true, source: null, cost,
              textRu: tx`Только в режиме Stranded: обмен у торговца на ${costText(cost)}` });
          }
          break;
        }
        case 'drops': {
          // «×20–35»: сколько штук падает за раз (подпись NEU «Drop Count» или «ID:25»)
          const dropAmountRu = d => {
            for (const e of d.extra || []) { const m = /Drop Count:\s*x?\s*([\d.,]+)(?:\s*[-–]\s*([\d.,]+))?/i.exec(stripColor(e)); if (m) return `×${m[2] && m[2] !== m[1] ? `${m[1]}–${m[2]}` : m[1]}`; }
            const m = /:(\d+(?:\.\d+)?)$/.exec(String(d.id || ''));
            return m && Number(m[1]) > 1 ? `×${m[1]}` : '';
          };
          const mob = stripColor(r.name || '') || npcName;
          const lvl = r.level ? tx`, ур. ${r.level}` : '';
          for (const d of r.drops || []) {
            const id = parseCount(d.id).id;
            const chance = d.chance ? String(d.chance).replace(/^\./, '0.').replace(/ per (.+)$/, (_, x) => tx` за каждый ${x}`) : '';
            const amt = dropAmountRu(d) || (w => w ? `×${w.min === w.max ? w.min : `${w.min}–${w.max}`}` : '')(wikiDropAmount(it, nameOf(id)));
            const ch = `${amt ? `, ${amt}` : ''}${chance ? tx`, шанс ${chance}` : ''}`;
            const prev = (where.get(id) || []).find(w => w.kind === 'drop' && w.source === it.id && w.mob === mob && w.chance === (d.chance || undefined));
            if (prev) {
              if (r.level && !prev.levels.includes(r.level)) {
                prev.levels.push(r.level);
                prev.textRu = tx`Выпадает с ${mob}, ур. ${prev.levels.join('/')}${ch}`;
              }
              continue;
            }
            push(where, id, { kind: 'drop', source: it.id, mob, levels: r.level ? [r.level] : [], chance: d.chance || undefined,
              textRu: tx`Выпадает с ${mob}${lvl}${ch}` });
          }
          break;
        }
        case 'katgrade': {
          const items = (r.items || []).map(parseCount);
          const from = parseCount(r.input).id;
          const tier = PET_TIERS[Number(from.split(';')[1])] || '';
          const cost = [{ id: 'SKYBLOCK_COIN', count: r.coins || 0 }, ...items];
          push(where, r.output, { kind: 'other', subkind: 'kat', source: 'KAT_NPC', cost, duration: r.time,
            textRu: tx`Улучшение у Kat (Хаб) из редкости «${RARITY[tier] || tier}»: ${costText(cost)}${r.time ? tx`, ждать ${fmtDuration(r.time)}` : ''}` });
          break;
        }
        default: break;
      }
    }
    void isMob;
  }

  // ── линейки улучшений ──
  // misc.talisman_upgrades: аксессуар → все его старшие версии (первая — ближайшая).
  // parents.json — это группы «одной линейки» без надёжного порядка, поэтому даём их как family.
  const upTo = new Map(), upFrom = new Map(), family = new Map();
  const addUp = (a, b) => { push(upTo, a, b); push(upFrom, b, a); };
  for (const [a, list] of Object.entries(constants.misc?.talisman_upgrades || {})) for (const b of list) addUp(a, b);
  for (const [p, kids] of Object.entries(constants.parents || {})) {
    const fam = [p, ...kids];
    for (const id of fam) family.set(id, fam.filter(x => x !== id));
  }
  for (const id of src.keys()) {
    let m;
    if ((m = /^(.+);(\d+)$/.exec(id)) && src.has(`${m[1]};${+m[2] + 1}`)) addUp(id, `${m[1]};${+m[2] + 1}`);
    if ((m = /^(.+_GENERATOR)_(\d+)$/.exec(id)) && src.has(`${m[1]}_${+m[2] + 1}`)) addUp(id, `${m[1]}_${+m[2] + 1}`);
  }
  // крафт «предмет → его улучшенная версия»: ингредиент и результат — одного вида снаряжения
  const GEAR = new Set(['weapon', 'armor', 'equipment', 'accessory', 'tool', 'sack', 'pet_item']);
  const catOf = id => { const it = src.get(id); if (!it) return null; const t = parseRarityType(it.lore); return categoryOf(it, t.type, false); };
  for (const [ing, outs] of usedIn) {
    const c = catOf(ing);
    if (!GEAR.has(c)) continue;
    for (const o of new Set(outs)) if (o !== ing && catOf(o) === c) addUp(ing, o);
  }

  // ── проход 3: записи ──
  const items = {};
  const lore = {};
  for (const it of src.values()) {
    const { rarity: r0, type, dungeon } = parseRarityType(it.lore);
    const isBook = it.mcId === 'minecraft:enchanted_book' && /;\d+$/.test(it.id);
    let rarity = r0;
    const petTier = /;(\d)$/.test(it.id) && !isBook ? PET_TIERS[Number(it.id.split(';')[1])] : null;
    if (!rarity && petTier) rarity = petTier;
    const category = categoryOf(it, type, isBook);
    const nameEn = names.get(it.id);
    const cur = curated[it.id] || {};

    // русское название
    let nameRu = cur.nameRu || nameEn;
    if (!cur.nameRu) {
      if (vanillaRu[nameEn] && (it.vanilla || !/[A-Z]{2}/.test(it.id.replace(/_/g, '')))) nameRu = vanillaRu[nameEn];
      const em = /^Enchanted (.+)$/.exec(nameEn);
      if (em && vanillaRu[em[1]]) nameRu = enchantedRu(vanillaRu[em[1]]);
      if (category === 'pet') nameRu = tx`Питомец ${nameEn}${rarity ? ` (${(RARITY_WORDS_RU[rarity] || rarity).toLowerCase()})` : ''}`;
      if (category === 'npc') nameRu = `NPC ${nameEn}`;
      if (isBook) {
        const bm = /^(.+?) ([IVX]+)$/.exec(nameEn);
        const key = it.id.split(';')[0].toLowerCase();
        nameRu = tx`Книга: ${(ENCHANTS_RU[key] || (bm ? bm[1] : nameEn))}${bm ? ' ' + bm[2] : ''}`;
      }
      const mm = /^(.+) Minion ([IVX]+)$/.exec(nameEn);
      if (mm) nameRu = tx`Миньон «${vanillaRu[mm[1]] || mm[1]}» ${mm[2]}`;
    }

    // характеристики
    const stats = {};
    const units = {};
    const abilities = [];
    const requirementsRu = [];
    for (const raw of it.lore) {
      const l = normalizeGlyphs(stripColor(raw)).trim();
      const sm = /^([A-Z][A-Za-z ]+): \+?(-?[\d,.]+)(%|s)?/.exec(l);
      if (sm && STATS[sm[1]] && !['Gear Score', 'Max Storage', 'Time Between Actions', 'Resources Generated', 'Capacity'].includes(sm[1])) {
        stats[sm[1]] = Number(sm[2].replace(/,/g, ''));
        if (sm[3]) units[sm[1]] = sm[3] === 's' ? ' с' : '%';
      }
      const am = /^(?:Ability|Item Ability): (.+?)(?:\s{2,}|\s+)(RIGHT CLICK|LEFT CLICK|SNEAK RIGHT CLICK|SNEAK|DOUBLE RIGHT CLICK)?$/.exec(l);
      if (am) abilities.push({ name: am[1].trim(), trigger: am[2] || null });
      const fs = /^(Full Set Bonus|Piece Bonus|Dungeon Bonus): (.+?)(?:\s+\(\d\/\d\))?$/.exec(l);
      if (fs) abilities.push({ name: fs[2].trim(), trigger: fs[1] });
      if (/^[❣☠✖]\s*Requires/.test(l)) requirementsRu.push(stripColor(translateLoreLine(raw)).replace(/^[❣☠✖]\s*/, ''));
    }

    // где взять
    let wtg = mergeMobVariants((where.get(it.id) || []).slice());
    if (isBook) {
      // «Sources:» в лоре книги
      let inSrc = false;
      for (const raw of it.lore) {
        const l = stripColor(raw).trim();
        if (/^Sources?:$/.test(l)) { inSrc = true; continue; }
        if (!l) { inSrc = false; continue; }
        if (inSrc) wtg.push({ kind: /Bazaar/.test(l) ? 'shop' : 'other', source: null, textRu: tx`Источник: ${stripColor(translateLoreLine(raw)).replace(/^\s*-\s*/, '')}` });
      }
    }
    if (cur.whereToGet) wtg = [...cur.whereToGet, ...wtg];
    const wikiFirst = it.infoType === 'WIKI_URL' ? (it.info.find(u => /minecraft\.wiki|wiki\.hypixel\.net/.test(u)) || it.info[0] || null) : null;
    if (!wtg.length && !['npc', 'mob'].includes(category)) wtg.push({ kind: 'other', subkind: 'unknown', source: wikiFirst ? 'WIKI' : null, textRu: 'Способ получения не указан в базе NEU — подробности на вики' + (wikiFirst ? '' : ' Hypixel SkyBlock') });
    // дубликаты и шум: дропы сортируем по шансу (сначала самые вероятные)
    const seen = new Set();
    wtg = wtg.filter(w => (seen.has(w.textRu) ? false : seen.add(w.textRu)));
    const order = { craft: 0, forge: 1, npc: 2, shop: 3, other: 4, drop: 5 };
    const chanceNum = w => parseFloat(String(w.chance || '').replace(',', '.')) || 0;
    wtg.sort((a, b) => order[a.kind] - order[b.kind] || chanceNum(b) - chanceNum(a));

    const wikiUrl = it.infoType === 'WIKI_URL' ? (it.info.find(u => /minecraft\.wiki|wiki\.hypixel\.net/.test(u)) || it.info[0] || null) : null;

    // описание
    const g = TYPE_GENDER[type] || 'm';
    const typeRu = type ? typeRuOf(type) : (CATEGORIES[category] || '');
    const parts = [];
    {
      let head;
      if (category === 'pet') head = rarity ? tx`Питомец, ${RARITY[rarity] || rarity}` : 'Питомец';
      else if (isBook) head = 'Зачарованная книга';
      else if (category === 'minion') head = 'Миньон';
      else if (category === 'npc') head = `NPC${it.island ? tx`, локация: ${islandRu(it.island)}` : ''}`;
      else if (category === 'mob') head = 'Моб';
      else if (rarity && type) head = `${RARITY[rarity] || rarity} ${dungeon ? 'Dungeon ' : ''}${typeRu}`;
      else if (rarity) head = `${CATEGORIES[category] || 'Предмет'}, ${RARITY[rarity] || rarity}`;
      else head = CATEGORIES[category] || 'Предмет';
      parts.push(head[0].toUpperCase() + head.slice(1) + '.');
      const st = Object.entries(stats).filter(([k]) => !['Accessory Power', 'Mana Cost', 'Cooldown', 'Soulflow Cost'].includes(k));
      if (st.length) parts.push(tx`Характеристики: ${st.map(([k, v]) => `${STATS[k] || k} ${v > 0 && units[k] !== ' с' ? '+' : ''}${v.toLocaleString('ru-RU')}${units[k] || ''}`).join(', ')}.`);
      for (const a of abilities) {
        const trig = { 'RIGHT CLICK': 'ПКМ', 'LEFT CLICK': 'ЛКМ', SNEAK: 'присесть', 'SNEAK RIGHT CLICK': 'Shift+ПКМ', 'DOUBLE RIGHT CLICK': 'двойной ПКМ',
          'Full Set Bonus': 'Full Set Bonus', 'Piece Bonus': 'Piece Bonus', 'Dungeon Bonus': 'Dungeon Bonus' }[a.trigger];
        parts.push(`${/Bonus/.test(a.trigger || '') ? 'Бонус' : 'Способность'} «${a.name}»${trig ? ` (${trig})` : ''}.`);
      }
      if (requirementsRu.length) parts.push(requirementsRu.join(' '));
    }
    if (cur.descriptionRu) parts.push(cur.descriptionRu);
    const first = wtg.find(w => !w.stranded) || wtg[0];
    if (first) {
      // требование уже названо выше — не повторяем «Нужно: …» в способе получения
      const how = requirementsRu.length ? first.textRu.replace(/\.?\s*Нужно: [^.]+\.?$/, '') : first.textRu;
      parts.push(tx`Как получить: ${how[0].toLowerCase()}${how.slice(1)}${/[.!]$/.test(how) ? '' : '.'}`);
    }
    if (cur.tipRu) parts.push(cur.tipRu);

    const tl = translateLore(it.lore);
    lore[it.id] = tl.lines.map(s => stripColor(s));

    items[it.id] = {
      id: it.id, nameEn, nameRu, rarity, rarityRu: rarity ? (RARITY[rarity] || rarity) : '', type, typeRu, dungeon,
      category, categoryRu: CATEGORIES[category], descriptionRu: parts.join(' '), stats, statUnits: units, requirementsRu, abilities,
      whereToGet: wtg.slice(0, 25),
      usedIn: [...new Set(usedIn.get(it.id) || [])].slice(0, 40),
      upgradesTo: [...new Set(upTo.get(it.id) || [])], upgradesFrom: [...new Set(upFrom.get(it.id) || [])], family: family.get(it.id) || [],
      wikiUrl, texture: textureOf(it), untranslatedLines: tl.untranslated,
      ...(petTier ? { petTier: Number(it.id.split(';')[1]) } : {}),
      ...(isBook ? { enchant: it.id.split(';')[0].toLowerCase(), level: Number(it.id.split(';')[1]), levelRoman: intToRoman(Number(it.id.split(';')[1])) } : {}),
      ...(it.island ? { island: it.island, islandRu: islandRu(it.island) } : {}),
      ...(it.coords ? { coords: it.coords } : {}),
    };
  }
  return { items, lore };
}
