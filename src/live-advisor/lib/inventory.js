// Данные снаряжения и инвентаря для инструментов советчика: компактно, по запросу, с итоговыми статами из лора.
// Лор предмета от Hypixel уже содержит итоговые цифры с учётом перековки, книг, звёзд и камней,
// поэтому статы берём из него, а не пересчитываем.
import { fmtCoins } from './util.js';
import { isGuiItem } from '../../lib/gui-items.js';
import { tx } from '../../../i18n/msg.js';

const COLOR = /§[0-9a-fk-or]/gi;
const strip = s => String(s || '').replace(COLOR, '');

/** Значки звёзд в названиях (✪ — обычные, ➊–➎ — мастер-звёзды) плохо отображаются: убираем и считаем числом */
const MASTER = { '➊': 1, '➋': 2, '➌': 3, '➍': 4, '➎': 5 };
export function cleanName(name) {
  const s = strip(name);
  const stars = (s.match(/✪/g) || []).length;
  const m = s.match(/[➊➋➌➍➎]/);
  const clean = s.replace(/[✪➊➋➌➍➎⚚✦✿❂☘◆❁❈❤⸕✎☠]/g, '').replace(/\s+/g, ' ').trim();
  return { clean, stars, master: m ? MASTER[m[0]] : 0 };
}

/** Приставки перековки (Withered, Heroic, Hasty…): по ним игрок называет предмет, но в базе их нет */
const REFORGE_WORDS = `Gentle Odd Fast Fair Epic Sharp Heroic Spicy Legendary Dirty Fabled Suspicious Gilded Warped Withered Bulky
Fanged Deadly Fine Grand Hasty Neat Rapid Unreal Awkward Rich Precise Spiritual Headstrong Clean Fierce Heavy Light Mythic Pure
Smart Titanic Wise Perfect Necrotic Ancient Spiked Renowned Cubic Reinforced Loving Ridiculous Empowered Giant Submerged Jaded
Bizarre Itchy Ominous Pleasant Pretty Shiny Simple Strange Vivid Godly Demonic Forceful Hurtful Keen Strong Superior Unpleasant
Zealous Silky Bloody Shaded Sweet Fruitful Magnetic Refined Blessed Stellar Mithraic Auspicious Fleet Heated Ambered Lustrous
Glistening Strengthened Waxed Fortified Rooted Blooming Snowy Toil Coldfused Moil Dimensional Undead Salty Treacherous Lucky Stiff
Chomp Pitchin Earthy Great Rugged Lush Robust Zooming Unyielding Excellent Sturdy Fortunate Bustling Mossy Festive Glacial Squeaky
Groovy Calcified Hyper Royal Bountiful Beady Mythical Jerry's Lumberjack's Peasant's Prospector's Blood-Soaked Green`.split(/\s+/);
const REFORGES = new Set(REFORGE_WORDS.map(w => w.toLowerCase()));

/** «Withered Giant's Sword» → «Giant's Sword»; «Heroic Aspect of the Void ✪✪✪» → «Aspect of the Void» */
export function stripReforge(query, extra = []) {
  const { clean } = cleanName(query);
  const words = clean.split(' ');
  const set = extra.length ? new Set([...REFORGES, ...extra.map(x => String(x).toLowerCase().replace(/_/g, ' '))]) : REFORGES;
  if (words.length > 1 && set.has(words[0].toLowerCase())) return words.slice(1).join(' ');
  return clean;
}

/** Статы из лора: { Damage: 310, Strength: 50, 'Crit Damage': 250, ... } — первая цифра строки, это итог со всеми бонусами */
export function loreStats(lore = []) {
  const out = {};
  for (const line of lore) {
    const m = strip(line).match(/^([A-Z][A-Za-z' ]{1,30}): ([+-]?[\d,]+(?:\.\d+)?)(%?)(?:\s|$)/);
    if (!m) continue;
    const key = m[1].trim();
    if (/^(Requires|Cost|Kills|Cooldown|Mana Cost|Soulflow Cost|Item Ability|Ability|Combat Lv|Slayer)/i.test(key)) continue;
    if (out[key] == null) out[key] = Number(m[2].replace(/,/g, ''));
  }
  return out;
}

const LOC = {
  inventory: 'инвентарь', armor: 'надето', equipment: 'экипировка (надето)', wardrobe: 'гардероб', enderChest: 'эндер-сундук',
  vault: 'личное хранилище', talismans: 'Accessory Bag', quiver: 'колчан', potions: 'Potion Bag', fishingBag: 'Fishing Bag',
  sacksBag: 'сумка мешков', wardrobeEquipment: 'наборы экипировки', backpackItems: 'рюкзаки (сами)',
};

/** Все предметы игрока с пометкой, где лежат */
export function allItems(member) {
  const inv = member?.inv || {};
  const out = [];
  const push = (list, where) => { for (const it of list || []) if (it?.id && !isGuiItem(it)) out.push({ ...it, where }); };
  const sets = (inv.wardrobeSets || []).filter(st => !st.worn);
  for (const [k, label] of Object.entries(LOC)) if (!(k === 'wardrobe' && sets.length)) push(inv[k], label);
  // гардероб: номер слота как в игре и название набора — «какой сет в слоте 5» модель видит сразу
  for (const st of sets) push(st.items, tx`гардероб, слот ${st.slot}${st.names?.[0] ? ` «${st.names[0]}»` : ''}`);
  for (const [k, v] of Object.entries(inv.backpacks || {})) push(v, tx`рюкзак ${Number(k) + 1}`);
  for (const [k, v] of Object.entries(inv.rift || {})) if (Array.isArray(v)) push(v, `Rift: ${k}`);
  return out;
}

const shortEnch = ench => Object.entries(ench || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace(/^ultimate_/, 'ult ')} ${v}`).join(', ');

const KUUDRA_ARMOR = /^(HOT_|BURNING_|FIERY_|INFERNAL_)?(CRIMSON|AURORA|TERROR|HOLLOW|FERVOR)_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/;

/**
 * Компактное описание предмета для модели.
 * @param {Object} it  предмет из normalizeItem
 * @param {{ value?: (it)=>number, lore?: boolean }} [o]
 */
export function compactItem(it, o = {}) {
  const { clean, stars, master } = cleanName(it.name || it.id);
  // У брони Kuudra звёзды 6–10 обычные (за эссенцию) и в названии рисуются тем же ✪, мастер-звёзды (➊–➎) только у данжевых предметов
  const kuudra = KUUDRA_ARMOR.test(it.id || '');
  const lvl = it.stars || 0;
  const totalStars = Math.max(stars, kuudra ? Math.min(10, lvl) : Math.min(5, lvl));
  const masterStars = kuudra ? 0 : master || (stars ? 0 : Math.max(0, lvl - 5));
  const hpb = it.hpb || 0;
  const out = {
    name: clean, id: it.id, where: it.where, rarity: it.rarity,
    reforge: it.reforge || undefined,
    stars: totalStars ? `${totalStars}★${masterStars ? tx` + ${masterStars} мастер` : ''}` : undefined,
    potatoBooks: hpb ? `${Math.min(hpb, 10)} HPB${hpb > 10 ? ` + ${hpb - 10} FPB` : ''}` : undefined,
    recomb: it.recomb || undefined,
    enchants: shortEnch(it.enchants) || undefined,
    gems: gemsText(it.gems),
    attributes: it.attributes && Object.keys(it.attributes).length ? Object.entries(it.attributes).filter(([k]) => k !== 'enrichment').map(([k, v]) => `${k} ${v}`).join(', ') || undefined : undefined,
    upgrades: (it.upgrades || []).filter(u => u.kind === 'upgrade' || u.kind === 'scroll').map(u => u.id).join(', ') || undefined,
    stats: Object.keys(loreStats(it.lore)).length ? loreStats(it.lore) : undefined,
    count: it.count > 1 ? it.count : undefined,
    value: o.value ? fmtCoins(o.value(it)) : undefined,
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

function gemsText(g) {
  if (!g) return undefined;
  const parts = [];
  for (const [slot, val] of Object.entries(g)) {
    if (slot === 'unlocked_slots' || slot.endsWith('_gem')) continue;
    const q = typeof val === 'string' ? val : val?.quality;
    if (!q) continue;
    const base = slot.replace(/_\d+$/, '');
    const type = g[`${slot}_gem`] || base;
    parts.push(`${q.toLowerCase()} ${String(type).toLowerCase()}`);
  }
  return parts.join(', ') || undefined;
}

const SUM_KEYS = ['Damage', 'Strength', 'Crit Chance', 'Crit Damage', 'Bonus Attack Speed', 'Ferocity', 'Health', 'Defense', 'Intelligence', 'Speed', 'Ability Damage', 'True Defense', 'Magic Find'];

/** Сумма статов надетой брони и экипировки */
export function wornStats(member) {
  const sum = {};
  for (const it of [...(member?.inv?.armor || []), ...(member?.inv?.equipment || [])]) {
    if (!it) continue;
    const s = loreStats(it.lore);
    for (const k of SUM_KEYS) if (s[k]) sum[k] = (sum[k] || 0) + s[k];
  }
  return sum;
}

const isWeapon = it => {
  const last = strip(it.lore?.[it.lore.length - 1] || '');
  return /\b(SWORD|BOW|LONGSWORD|WAND|STAFF|DAGGER|FISHING WEAPON|GAUNTLET)\b/.test(last);
};

/**
 * Сравнение оружия: итоговые статы из лора + оценка урона за удар вместе со статами надетой брони и экипировки.
 * Формула SkyBlock без учёта скиллов, питомца, силы аксессуаров и множителей способностей:
 * обычный удар = (5 + Damage) × (1 + Strength/100), крит = обычный × (1 + Crit Damage/100).
 */
export function compareWeapons(member, { value } = {}) {
  const worn = wornStats(member);
  const seen = new Set();
  const list = [];
  for (const it of allItems(member)) {
    if (!isWeapon(it)) continue;
    const key = it.uuid || `${it.id}:${it.where}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = loreStats(it.lore);
    const dmg = s.Damage || 0, str = (s.Strength || 0) + (worn.Strength || 0), cd = (s['Crit Damage'] || 0) + (worn['Crit Damage'] || 0);
    const hit = (5 + dmg) * (1 + str / 100);
    list.push({
      ...compactItem(it, { value }),
      estimate: { hit: Math.round(hit), crit: Math.round(hit * (1 + cd / 100)), withStrength: str, withCritDamage: cd, critChance: (s['Crit Chance'] || 0) + (worn['Crit Chance'] || 0) },
    });
  }
  list.sort((a, b) => b.estimate.crit - a.estimate.crit);
  return { wornStats: worn, weapons: list.slice(0, 12), note: 'Оценка урона по статам оружия + надетой брони и экипировки. Без скиллов, питомца, силы аксессуаров, зелий и способностей (у Terminator/Hyperion урон способностей считается иначе). Подходит для сравнения оружия между собой.' };
}
