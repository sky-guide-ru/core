// Загрузка базы предметов из репозитория NotEnoughUpdates (рецепты, где взять, вики-ссылки)
import fs from 'node:fs';
import path from 'node:path';
import { openZip } from './lib/zip-lazy.js';
import { config } from './config.js';
import { stripColor } from './nbt.js';
import { englishName } from './names.js';

const ZIP_URL = 'https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO/archive/refs/heads/master.zip';
const RAW = 'https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/';

export const neu = {
  items: new Map(),       // id -> item
  constants: {},          // leveling, misc, pets, ...
  loadedAt: 0,
  source: 'none',
};

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL', 'VERY SPECIAL', 'ULTIMATE', 'ADMIN'];

function parseItem(j) {
  const lore = j.lore || [];
  const last = stripColor(lore[lore.length - 1] || '');
  const rarity = RARITIES.slice().reverse().find(r => last.startsWith(r) || last.startsWith('a ' + r)) || null;
  const type = last.replace(/^(?:a )?(VERY SPECIAL|COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL|ULTIMATE|ADMIN)\s*/, '').replace(/^DUNGEON\s+/, '').trim() || null;
  return {
    id: j.internalname,
    name: stripColor(j.displayname || j.internalname).replace(/^[^\p{L}\p{N}\[(]+/u, '').trim(),
    rawName: j.displayname,
    mcId: j.itemid,
    damage: j.damage || 0,
    rawNbt: j.nbttag || '',
    lore,
    rarity,
    type,
    recipe: j.recipe || null,
    recipes: j.recipes || [],
    info: j.info || [],
    infoType: j.infoType || null,
    crafttext: j.crafttext || '',
    vanilla: !!j.vanilla,
    island: j.island || null, x: j.x ?? null, y: j.y ?? null, z: j.z ?? null, slayer_req: j.slayer_req || null,
  };
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': config.userAgent } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function loadFromZip(file) {
  // Читаем по одному файлу с диска, а не весь архив (22 МБ) в память разом
  const zip = openZip(file);
  const items = new Map();
  const constants = {};
  try {
    for (const [n, e] of zip.entries) {
      if (!n.endsWith('.json')) continue;
      if (/\/items\/[^/]+\.json$/.test(n)) {
        try { const it = parseItem(JSON.parse(zip.read(e).toString('utf8'))); if (it.id) items.set(it.id, it); } catch {}
      } else if (/\/constants\/[^/]+\.json$/.test(n)) {
        try { constants[path.basename(n, '.json')] = JSON.parse(zip.read(e).toString('utf8')); } catch {}
      }
    }
  } finally { zip.close(); }
  return { items, constants };
}

export async function loadNeu({ force = false } = {}) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const zipPath = path.join(config.dataDir, 'neu-repo.zip');
  const stale = !fs.existsSync(zipPath) || Date.now() - fs.statSync(zipPath).mtimeMs > config.neuRefresh;
  if (force || stale) {
    try {
      console.log('[NEU] скачиваю базу предметов…');
      await download(ZIP_URL, zipPath + '.tmp');
      fs.renameSync(zipPath + '.tmp', zipPath);
    } catch (e) {
      console.warn('[NEU] не удалось скачать архив:', e.message);
    }
  }
  if (fs.existsSync(zipPath)) {
    const { items, constants } = loadFromZip(zipPath);
    Object.assign(neu, { items, constants, loadedAt: Date.now(), source: 'zip' });
    console.log(`[NEU] загружено предметов: ${items.size}`);
    return;
  }
  // Запасной путь: хотя бы константы по одной
  for (const c of ['sacks', 'essenceshops', 'leveling', 'misc', 'pets', 'parents', 'essencecosts', 'museum', 'enchants', 'reforgestones', 'reforges', 'gemstonecosts', 'petnums', 'bonuses', 'bestiary']) {
    try {
      const r = await fetch(RAW + `constants/${c}.json`);
      if (r.ok) neu.constants[c] = await r.json();
    } catch {}
  }
  neu.source = 'raw';
}

export async function getItem(id) {
  if (neu.items.has(id)) return neu.items.get(id);
  // Ссылка, набранная руками: /api/item/hyperion → HYPERION
  const up = String(id || '').toUpperCase();
  if (up !== id && neu.items.has(up)) return neu.items.get(up);
  if (neu.source !== 'raw') return null;
  try {
    const r = await fetch(RAW + `items/${encodeURIComponent(id)}.json`);
    if (!r.ok) return null;
    const it = parseItem(await r.json());
    neu.items.set(id, it);
    return it;
  } catch { return null; }
}

export function itemName(id) {
  // Bazaar пишет «INK_SACK:3», NEU — «INK_SACK-3»
  const it = neu.items.get(id) || (String(id).includes(':') ? neu.items.get(String(id).replace(':', '-')) : null);
  // Питомцы в NEU называются «[Lvl {LVL}] Megalodon»: шаблон уровня в названии не показываем
  if (it) return String(it.name || '').replace(/^\[Lvl \{LVL\}\]\s*/, '') || it.name;
  // ENCHANTMENT_LAPIDARY_1, SHARD_SEA_EMPEROR и прочие Bazaar-ID — через базу items-ru, иначе собираем из ID
  return englishName(id);
}

// Аксессуары (для расчёта недостающих и Magical Power)
export function allAccessories() {
  const out = [];
  for (const it of neu.items.values()) {
    if (it.type && /^(ACCESSORY|HATCESSORY)$/.test(it.type) && !/;/.test(it.id)) out.push(it);
  }
  return out;
}
