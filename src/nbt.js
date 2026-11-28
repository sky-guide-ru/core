import nbt from 'prismarine-nbt';
import { upgradeParts } from './parse/upgrades.js';
import { gunzipSync, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gunzipAsync = promisify(gunzip);

// Декодирует base64 gzip NBT из Hypixel API в массив предметов
export async function decodeItems(b64) {
  if (!b64) return [];
  try {
    // Распаковка в пуле потоков Node (а не gunzipSync): между сундуками профиля сервер успевает ответить другим
    const buf = await gunzipAsync(Buffer.from(b64, 'base64'));
    const { parsed } = await nbt.parse(buf);
    const list = nbt.simplify(parsed).i || [];
    return list.map(normalizeItem);
  } catch {
    return [];
  }
}

export const PET_TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
const COLOR = /§[0-9a-fk-or]/gi;
export const stripColor = s => (s || '').replace(COLOR, '');

export function normalizeItem(raw) {
  if (!raw || !raw.tag) return null;
  const ea = raw.tag.ExtraAttributes || {};
  const display = raw.tag.display || {};
  const lore = display.Lore || [];
  const lastLore = stripColor(lore[lore.length - 1] || '');
  const rarity = (lastLore.match(/^(?:a )?(?:§.)*\s*(COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL|VERY SPECIAL|ULTIMATE|ADMIN)/) || [])[1] || null;
  let id = ea.id || null;
  let pet = null;
  if (id === 'PET' && ea.petInfo) {
    try { pet = JSON.parse(ea.petInfo); id = `${pet.type};${PET_TIERS.indexOf(pet.tier)}`; } catch {}
  }
  return {
    id,
    name: stripColor(display.Name || ''),
    rawName: display.Name || '',
    lore,
    count: raw.Count || 1,
    rarity,
    recomb: !!ea.rarity_upgrades,
    reforge: ea.modifier || null,
    stars: ea.upgrade_level ?? ea.dungeon_item_level ?? 0,
    hpb: ea.hot_potato_count || 0,
    enchants: ea.enchantments || {},
    gems: ea.gems || null,
    attributes: ea.attributes || null,
    enrichment: ea.talisman_enrichment || null, // Accessory Enrichment: +1 очко Tuning
    upgrades: pet ? [] : upgradeParts(ea.new_year_cake_bag_data ? { ...ea, cakeYears: cakeYears(ea.new_year_cake_bag_data) } : ea),
    uuid: ea.uuid || null,
    museum: !!ea.donated_museum, // пожертвован в музей (Co-op Soulbound): у игрока на руках — значит одолжен из музея
    pet,
    color: display.color ?? null,
    skin: skinHash(raw.tag.SkullOwner),
    glint: !!(raw.tag.ench && raw.tag.ench.length) || Object.keys(ea.enchantments || {}).length > 0,
  };
}

// New Year Cake Bag: внутри предмета лежит ещё один NBT (gzip) со списком тортов — нужны их годы
function cakeYears(data) {
  try {
    const bytes = Array.isArray(data) ? Buffer.from(data.map(b => b & 255)) : Buffer.from(String(data), 'base64');
    const list = nbt.simplify(nbt.parseUncompressed(gunzipSync(bytes))).i || [];
    return list.map(c => c?.tag?.ExtraAttributes?.new_years_cake).filter(y => y != null);
  } catch { return []; }
}

function skinHash(owner) {
  try {
    const v = owner?.Properties?.textures?.[0]?.Value;
    if (!v) return null;
    const j = JSON.parse(Buffer.from(v, 'base64').toString('utf8'));
    return (j.textures?.SKIN?.url || '').split('/').pop() || null;
  } catch { return null; }
}
