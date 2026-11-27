// Снаряжение, аксессуары, Magical Power, оценка стоимости
import { isGuiItem } from '../lib/gui-items.js';
import { neu, allAccessories, itemName } from '../neu.js';
import { priceOf, petPriceOf, prices } from '../prices.js';
import { craftValue } from './craft-value.js';
import { PET_TIERS } from '../nbt.js';
import { buildUpgrades, nextUpgrade, NO_RECOMB } from '../lib/acc-upgrades.js';
import { tx } from '../../i18n/msg.js';
import { canSellCopy } from '../lib/item-props.js';
import { statOf, howOf, reqOf, tierOf, accSteps } from './acc-meta.js';

export const MP_BY_RARITY = { COMMON: 3, UNCOMMON: 5, RARE: 8, EPIC: 12, LEGENDARY: 16, MYTHIC: 22, DIVINE: 22, SPECIAL: 3, 'VERY SPECIAL': 5 };
const RARITY_ORDER = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL', 'VERY SPECIAL'];

// Числятся в NEU как аксессуары, но в сумку не кладутся
const NOT_IN_BAG = new Set(['RIFT_PRISM']);

let upCache = null;
function upgradesMap() {
  const raw = neu.constants.misc?.talisman_upgrades;
  if (!upCache || upCache.raw !== raw) upCache = { raw, map: buildUpgrades(raw) };
  return upCache.map;
}

// Все предметы, которые "покрывает" данный аксессуар (его младшие версии)
function coveredBy(id, up) {
  const out = new Set();
  for (const [low, highs] of Object.entries(up)) if (highs.includes(id)) out.add(low);
  return out;
}

export function analyzeAccessories(member) {
  // Accessory Bag не виден (выключен Inventory API): план «купить всё с нуля» был бы неправдой
  if (member.inv?.apiDisabled) {
    return { hidden: true, calculatedMp: 0, highestMp: member.magicalPower, count: 0, list: [], missing: [], cheapestNext: [], notRecombCount: 0, recombPrice: priceOf('RECOMBOBULATOR_3000'), enrichPrice: 0, steps: [], recombGain: 0 };
  }
  const up = upgradesMap();
  const ignored = new Set(neu.constants.misc?.ignored_talisman || []);
  const items = (member.inv.talismans || []).filter(Boolean).filter(i => i.id);
  // Аксессуары в инвентаре/эндерсундуке тоже учитываются игрой только в сумке — показываем отдельно
  const owned = new Map();
  for (const it of items) {
    const prev = owned.get(it.id);
    if (!prev || RARITY_ORDER.indexOf(it.rarity) > RARITY_ORDER.indexOf(prev.rarity)) owned.set(it.id, it);
  }
  const covered = new Set();
  for (const id of owned.keys()) for (const c of coveredBy(id, up)) covered.add(c);

  // Mythic и выше рекомб не поднимает по MP, Special/Very Special — отдельная шкала
  const recombable = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  // Enrichment ставится только на Legendary и выше
  const enrichable = ['LEGENDARY', 'MYTHIC', 'DIVINE'];
  let mp = 0;
  const list = [];
  for (const it of owned.values()) {
    const active = !covered.has(it.id) && !ignored.has(it.id);
    let gain = active ? (MP_BY_RARITY[it.rarity] || 0) : 0;
    if (it.id === 'HEGEMONY_ARTIFACT') gain *= 2;
    mp += gain;
    // Пробелы для фильтров «Мои аксессуары»: следующий tier, рекомб, enrichment
    const next = active ? nextUpgrade(it.id, up) : null;
    list.push({
      id: it.id, name: it.name, rarity: it.rarity, recomb: it.recomb, reforge: it.reforge,
      enrichment: it.enrichment || it.attributes?.enrichment || null, mp: gain, active, value: priceOf(it.id),
      sellable: canSellCopy(it), // сданный в Museum (одолжен обратно) или Soulbound — «можно продать» не пишем
      next: next ? { id: next, name: itemName(next), rarity: neu.items.get(next)?.rarity || null } : null,
      canRecomb: active && !it.recomb && recombable.includes(it.rarity) && !NO_RECOMB.has(it.id),
      canEnrich: enrichable.includes(it.rarity),
      tier: tierOf(it.id, up, coveredBy), stat: statOf(neu.items.get(it.id)), how: howOf(it.id),
    });
  }
  if (member.riftPrism) mp += 11;

  // Недостающие и апгрейды: сколько монет за 1 MP
  const recs = [];
  const all = allAccessories();
  for (const acc of all) {
    // Rift Prism — не аксессуар для сумки: его употребляют один раз (+11 MP), для него свой шаг mp-rift-prism
    if (owned.has(acc.id) || covered.has(acc.id) || ignored.has(acc.id) || NOT_IN_BAG.has(acc.id)) continue;
    const accMp = MP_BY_RARITY[acc.rarity] || 0;
    if (!accMp) continue;
    // если владеем младшей версией — считаем прирост
    const lower = [...owned.keys()].find(o => (up[o] || []).includes(acc.id));
    const lowerMp = lower ? (MP_BY_RARITY[owned.get(lower).rarity] || 0) : 0;
    // если существует старшая версия, которую мы не покрыли — тоже ок, рекомендуем по цене
    const gain = accMp - lowerMp;
    if (gain <= 0) continue;
    const price = priceOf(acc.id);
    // апгрейд обычно крафтится из младшей версии или её можно продать — считаем доплату
    // (младшую из Museum или Soulbound не продать — тогда полная цена)
    const lowerValue = lower && canSellCopy(owned.get(lower)) ? priceOf(lower) : 0;
    const net = price ? Math.max(price - lowerValue, price * 0.1) : 0;
    recs.push({
      id: acc.id, name: acc.name, rarity: acc.rarity, gain, price: net || price, fullPrice: price,
      perMp: net ? net / gain : null, upgradeFrom: lower ? owned.get(lower).name : null,
      // семейство (младшие и старшие версии): из одного семейства в сумке работает только один аксессуар
      family: [...new Set([acc.id, ...coveredBy(acc.id, up), ...(up[acc.id] || [])])],
      tier: tierOf(acc.id, up, coveredBy), stat: statOf(acc), how: howOf(acc.id), req: reqOf(acc.id, member),
    });
  }
  // Убираем дубли семейств: если есть и X и его апгрейд Y в рекомендациях — оставляем оба, но сортируем по цене за MP
  recs.sort((a, b) => (a.perMp ?? Infinity) - (b.perMp ?? Infinity));

  const notRecomb = list.filter(a => a.canRecomb);
  const recombPrice = priceOf('RECOMBOBULATOR_3000');
  // План «что сделать дальше»: все шаги (купить, tier, Recombobulator, Enrichment) по цене за 1 MP
  const { steps, enrichPrice } = accSteps({ list, missing: recs, mpBy: MP_BY_RARITY });

  return {
    calculatedMp: mp,
    highestMp: member.magicalPower,
    count: owned.size,
    list: list.sort((a, b) => b.mp - a.mp),
    missing: recs,
    cheapestNext: recs.filter(r => r.perMp).slice(0, 40),
    notRecombCount: notRecomb.length,
    recombPrice,
    enrichPrice,
    steps,
    // Рекомб повышает редкость на 1 — прирост MP зависит от редкости
    recombGain: notRecomb.reduce((s, a) => {
      const i = RARITY_ORDER.indexOf(a.rarity);
      const next = RARITY_ORDER[Math.min(i + 1, 5)];
      return s + ((MP_BY_RARITY[next] || 0) - (MP_BY_RARITY[a.rarity] || 0));
    }, 0),
  };
}

const WEAPON_TYPES = /SWORD|BOW|WAND|LONGSWORD|STAFF|DEPLOYABLE|FISHING WEAPON|GAUNTLET/;
const TOOL_TYPES = /PICKAXE|DRILL|HOE|AXE|SHOVEL|FISHING ROD|GAUNTLET|CHISEL/;
const ARMOR_TYPES = /HELMET|CHESTPLATE|LEGGINGS|BOOTS/;
const EQUIP_TYPES = /NECKLACE|CLOAK|BELT|GLOVES|BRACELET/;

function itemType(it) {
  const n = neu.items.get(it.id);
  if (n?.type) return n.type;
  const last = (it.lore?.[it.lore.length - 1] || '').replace(/§./g, '');
  return last.replace(/^(?:a )?(VERY SPECIAL|COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL)\s*/, '').replace(/^DUNGEON\s+/, '');
}

// Камень перековки по имени модификатора (ea.modifier) — из constants/reforgestones NEU
let stoneByModifier = null;
function reforgeStone(mod) {
  if (!mod) return null;
  if (!stoneByModifier) {
    stoneByModifier = new Map();
    for (const [id, r] of Object.entries(neu.constants?.reforgestones || {})) {
      stoneByModifier.set(String(r.nbtModifier || r.reforgeName || '').toLowerCase().replace(/\s+/g, '_'), id);
    }
    if (!stoneByModifier.size) { stoneByModifier = null; return null; }
  }
  return stoneByModifier.get(String(mod).toLowerCase()) || null;
}

const enchPrice = (name, lvl) => priceOf(tx`ENCHANTMENT_${String(name).toUpperCase()}_${lvl}`);

// Зачарования, которые на предмете стоят заметно меньше книги (как в SkyHelper-Networth): по умолчанию ×0,85
const ENCH_MULT = { COUNTER_STRIKE: 0.2, BIG_BRAIN: 0.35, ULTIMATE_INFERNO: 0.35, OVERLOAD: 0.35, ULTIMATE_SOUL_EATER: 0.35, ULTIMATE_FATAL_TEMPO: 0.65 };
// Накопительные (Expertise, Compact…): уровень растёт сам, платится только книга I
const STACKING = new Set(['EXPERTISE', 'COMPACT', 'ABSORB', 'CULTIVATING', 'CHAMPION', 'HECATOMB', 'TOXOPHILITE']);
// Слоты гемов, открытые за гемы и монеты: у Divan — Gemstone Chamber (×0,9), у брони Kuudra — ×0,6
const KUUDRA_ARMOR = /^((HOT|FIERY|BURNING|INFERNAL)_)?(AURORA|CRIMSON|TERROR|HOLLOW|FERVOR)_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/;
const DIVAN = /^DIVAN_(HELMET|CHESTPLATE|LEGGINGS|BOOTS|PENDANT)$/;
const COSMETIC_KINDS = new Set(['dye', 'skin']);

function slotUnlockValue(it) {
  const mult = DIVAN.test(it.id) ? 0.9 : KUUDRA_ARMOR.test(it.id) ? 0.6 : 0;
  const costs = mult && neu.constants?.gemstonecosts?.[it.id];
  if (!costs) return 0;
  let v = 0;
  for (const slot of it.gems?.unlocked_slots || []) {
    for (const c of costs[slot] || []) {
      const [id, n] = String(c).split(':');
      v += (id === 'SKYBLOCK_COIN' ? 1 : priceOf(id)) * (Number(n) || 1);
    }
  }
  return v * mult;
}

/** Косметика по описанию NEU (последняя строка «… COSMETIC») или по id: скины питомцев, краски */
export function isCosmeticId(id) {
  if (!id) return false;
  if (/^(PET_SKIN_|DYE_)/.test(id)) return true;
  const lore = neu.items.get(id)?.lore;
  return !!lore?.length && /COSMETIC/.test(String(lore[lore.length - 1]).replace(/§./g, ''));
}

// Цена крафта для вещей без рынка; кэш живёт, пока не обновились цены
let craftMemo = { key: '', map: new Map() };
function craftPrice(id) {
  const key = tx`${prices.bazaarAt}|${prices.binAt}`;
  if (craftMemo.key !== key) craftMemo = { key, map: new Map() };
  return craftValue(id, priceOf, neu.items, craftMemo.map);
}

/** Оценка предмета по частям: { value, cosmetic } — cosmetic входит в value (скины, краски, сам предмет-косметика) */
export function itemValueParts(it) {
  if (!it?.id || isGuiItem(it)) return { value: 0, cosmetic: 0 };
  const count = it.count || 1;
  if (it.id === 'ENCHANTED_BOOK') {
    return { value: Object.entries(it.enchants || {}).reduce((s, [n, l]) => s + enchPrice(n, l), 0) * count, cosmetic: 0 };
  }
  const cosmeticItem = isCosmeticId(it.id);
  let base = priceOf(it.id);
  // Нет на рынке — цена крафта (только для обычных вещей: у редкой косметики рецепта нет, а гадать о цене не будем)
  if (!base && count === 1 && !cosmeticItem && !it.pet) base = craftPrice(it.id);
  let v = base * count;
  let cos = cosmeticItem ? v : 0;
  if (count > 1) return { value: v, cosmetic: cos }; // стаки — обычные материалы
  const parts = it.upgrades || [];
  if (!it.upgrades) { // старые снимки без списка улучшений
    if (it.recomb) parts.push({ id: 'RECOMBOBULATOR_3000', count: 1, mult: 0.8 });
    if (it.hpb > 10) parts.push({ id: 'FUMING_POTATO_BOOK', count: it.hpb - 10, mult: 0.6 });
  }
  const ess = neu.constants?.essencecosts?.[it.id];
  for (const p of parts) {
    // Мастер-звёзды бывают только у данжевых предметов (звёзды 6–10). У брони Kuudra звёзды 6–10 — обычные, за эссенцию
    if (p.kind === 'star' && ess?.['6']) continue;
    const pv = priceOf(p.id) * p.count * p.mult;
    v += pv;
    if (COSMETIC_KINDS.has(p.kind)) cos += pv;
  }
  // Звёзды за эссенцию: сумма стоимости уровней 1..N по constants/essencecosts NEU
  if (ess?.type && it.stars > 0) {
    let n = 0;
    for (let i = 1; i <= it.stars && ess[i]; i++) {
      n += ess[i];
      // кроме эссенции звезда может требовать предметы (Heavy Pearl у брони Kuudra); монеты не считаем
      for (const c of ess.items?.[i] || []) {
        const [id, k] = String(c).split(':');
        if (id !== 'SKYBLOCK_COIN') v += priceOf(id) * (Number(k) || 1);
      }
    }
    v += n * priceOf(tx`ESSENCE_${String(ess.type).toUpperCase()}`) * 0.75;
  }
  for (const [n, l] of Object.entries(it.enchants || {})) {
    const name = String(n).toUpperCase();
    const p = enchPrice(name, STACKING.has(name) ? 1 : l);
    if (p > 50_000) v += p * (ENCH_MULT[name] ?? 0.85); // дешёвые книги почти ничего не добавляют к цене
  }
  v += slotUnlockValue(it);
  const stone = reforgeStone(it.reforge);
  if (stone) v += priceOf(stone) * 0.5; // камень с предмета не снять, поэтому половина цены
  return { value: v, cosmetic: cos };
}

// Оценка предмета с улучшениями: базовая цена + зачарования + гемы, звёзды, свитки, части и т.п.
export function itemValue(it) {
  return itemValueParts(it).value;
}

export function allStoredItems(inv) {
  const groups = [
    ['Инвентарь', inv.inventory], ['Броня', inv.armor], ['Экипировка', inv.equipment], ['Wardrobe', inv.wardrobe], ['Wardrobe (Equipment)', inv.wardrobeEquipment], ['Backpacks', inv.backpackItems],
    ['Ender Chest', inv.enderChest], ['Personal Vault', inv.vault], ['Accessory Bag', inv.talismans], ['Quiver', inv.quiver], ['Potion Bag', inv.potions], ['Sack of Sacks', inv.sacksBag],
    ['Rift: инвентарь', inv.rift?.inventory], ['Rift: броня', inv.rift?.armor], ['Rift: экипировка', inv.rift?.equipment], ['Rift: Ender Chest', inv.rift?.enderChest],
    ...Object.entries(inv.backpacks || {}).map(([k, v]) => [tx`Backpack ${Number(k) + 1}`, v]),
  ];
  const out = [];
  for (const [where, list] of groups) for (const it of list || []) if (it?.id && !isGuiItem(it)) out.push({ ...it, where }); // служебные (меню SkyBlock) — не вещи
  return out;
}

export function analyzeGear(member) {
  const items = allStoredItems(member.inv);
  const typed = items.map(it => { const vp = itemValueParts(it); return { ...it, type: itemType(it), value: vp.value, cosmetic: vp.cosmetic, basePrice: priceOf(it.id) }; });
  const weapons = typed.filter(i => WEAPON_TYPES.test(i.type || '')).sort((a, b) => b.value - a.value);
  const tools = typed.filter(i => TOOL_TYPES.test(i.type || '') && !WEAPON_TYPES.test(i.type || '')).sort((a, b) => b.value - a.value);
  const armorPieces = typed.filter(i => ARMOR_TYPES.test(i.type || '')).sort((a, b) => b.value - a.value);
  const equipment = typed.filter(i => EQUIP_TYPES.test(i.type || '')).sort((a, b) => b.value - a.value);
  const topItems = [...typed].sort((a, b) => b.value - a.value).slice(0, 30);
  const itemsValue = typed.reduce((s, i) => s + i.value, 0);

  // Сеты брони по префиксу id: по одной лучшей части на слот (дубликаты из разных хранилищ не складываем)
  const sets = {};
  for (const a of armorPieces) { // уже отсортированы по убыванию цены
    // слот — по типу предмета (у BIOHAZARD_SUIT, *_TUNIC и т.п. в id нет слова CHESTPLATE)
    const slot = (ARMOR_TYPES.exec(a.type || '') || /_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/.exec(a.id) || [a.id])[0].replace(/^_/, '');
    const base = a.id.replace(/_(HELMET|CHESTPLATE|LEGGINGS|BOOTS|SUIT|TUNIC|HOOD|CAP|MASK|SHIRT|VEST|PANTS|TROUSERS|SHOES|SANDALS|SLIPPERS)$/, '');
    const set = (sets[base] ||= { id: base, pieces: [], value: 0, copies: 0, slots: new Set() });
    set.copies++;
    if (set.slots.has(slot)) continue;
    set.slots.add(slot);
    set.pieces.push(a);
    set.value += a.value;
  }
  for (const set of Object.values(sets)) delete set.slots;

  const sacksValue = Object.entries(member.inv.sacks || {}).reduce((s, [id, n]) => s + priceOf(id) * n, 0);
  // питомец 100 уровня стоит заметно дороже первого — берём цену среди максимальных
  const petsValue = member.pets.reduce((s, p) => s + petValue(p), 0);
  // Предметы, сданные в музей, тоже принадлежат игроку (SkyCrypt учитывает их в networth)
  const museumValue = museumItemsValue(member.museum);
  const essenceValue = Object.entries(member.essence || {}).reduce((s, [k, n]) => s + priceOf(tx`ESSENCE_${k}`) * n, 0);
  const coins = (member.purse || 0) + (member.bank || 0) + (member.personalBank || 0);
  // Сколько из оценки — косметика (скины, краски): на редких скинах цены по разовым сделкам, поэтому показываем отдельно
  const cosmeticValue = typed.reduce((s, i) => s + (i.cosmetic || 0), 0)
    + member.pets.reduce((s, p) => s + petSkinValue(p), 0)
    + (member.museum?.decoded || []).reduce((s, it) => s + itemValueParts(it).cosmetic, 0);

  return {
    worn: { armor: member.inv.armor.map(i => i && { ...i, value: itemValue(i) }), equipment: member.inv.equipment.map(i => i && { ...i, value: itemValue(i) }) },
    weapons: weapons.slice(0, 25),
    tools: tools.slice(0, 25),
    armorSets: Object.values(sets).sort((a, b) => b.value - a.value).slice(0, 15),
    equipment: equipment.slice(0, 20),
    topItems,
    topPets: member.pets.map(p => ({ id: p.id, type: p.type, tier: p.tier, level: p.level, heldItem: p.heldItem, skin: p.skin, value: petValue(p) })).sort((a, b) => b.value - a.value).slice(0, 15),
    networth: {
      total: itemsValue + sacksValue + petsValue + essenceValue + coins + museumValue,
      items: itemsValue, sacks: sacksValue, pets: petsValue, essence: essenceValue, coins, museum: museumValue, cosmetic: cosmeticValue,
    },
    itemCount: typed.length,
  };
}

// Питомец: цена по уровню (100 уровень — отдельная цена на аукционе) + предмет в руках + скин
export function petValue(p) {
  let v = petPriceOf(tx`${p.type};${PET_TIERS.indexOf(p.tier)}`, p.level >= 100);
  if (p.heldItem) v += priceOf(p.heldItem);
  return v + petSkinValue(p);
}
const petSkinValue = p => (p.skin ? priceOf(tx`PET_SKIN_${p.skin}`) * 0.9 : 0);

// Музей: members[uuid].items[id].items.data (NBT) — разбирается в profile.js в museum.decoded
function museumItemsValue(museum) {
  return (museum?.decoded || []).reduce((s, it) => s + itemValue(it), 0);
}

export function petName(type) { return itemName(tx`${type};4`) || type; }
