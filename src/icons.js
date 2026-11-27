// Иконки предметов: головы (скины из textures.minecraft.net) и ванильные текстуры Minecraft
import fs from 'node:fs';
import path from 'node:path';
import { neu } from './neu.js';
import { packTexture, forgetPackTexture, packVanillaTexture, clientJarTexture, firstFrame } from './packs.js';
import { config } from './config.js';
import { normalizeId } from './items-ru/index.js';
import { PNG } from 'pngjs';
import { getJson } from './http.js';

// raw.githubusercontent.com бывает недоступен (у части провайдеров), поэтому есть зеркало jsDelivr
const ASSET_HOSTS = [
  'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.4/',
  'https://cdn.jsdelivr.net/gh/PrismarineJS/minecraft-assets@master/data/1.21.4/',
];
const cacheDir = () => path.join(config.dataDir, 'icons');

// Наследие 1.8 → современные имена моделей (самые частые случаи)
const LEGACY = {
  skull: 'player_head', dye: 'ink_sac', wood_sword: 'wooden_sword', gold_sword: 'golden_sword', wood_axe: 'wooden_axe',
  gold_axe: 'golden_axe', wood_pickaxe: 'wooden_pickaxe', gold_pickaxe: 'golden_pickaxe', wood_hoe: 'wooden_hoe', gold_hoe: 'golden_hoe',
  gold_helmet: 'golden_helmet', gold_chestplate: 'golden_chestplate', gold_leggings: 'golden_leggings', gold_boots: 'golden_boots',
  wood_spade: 'wooden_shovel', iron_spade: 'iron_shovel', diamond_spade: 'diamond_shovel', gold_spade: 'golden_shovel', stone_spade: 'stone_shovel',
  carrot_item: 'carrot', potato_item: 'potato', nether_stalk: 'nether_wart', sulphur: 'gunpowder', raw_fish: 'cod', cooked_fish: 'cooked_cod',
  ink_sack: 'ink_sac', red_rose: 'poppy', yellow_flower: 'dandelion', double_plant: 'sunflower', log: 'oak_log', log_2: 'acacia_log',
  watch: 'clock', fireball: 'fire_charge', firework: 'firework_rocket', book_and_quill: 'writable_book', exp_bottle: 'experience_bottle',
  speckled_melon: 'glistering_melon_slice', melon: 'melon_slice', melon_block: 'melon', raw_chicken: 'chicken', pork: 'porkchop',
  grilled_pork: 'cooked_porkchop', raw_beef: 'beef', mushroom_soup: 'mushroom_stew', water_lily: 'lily_pad', web: 'cobweb',
  stained_clay: 'white_terracotta', hard_clay: 'terracotta', stained_glass: 'white_stained_glass', stained_glass_pane: 'white_stained_glass_pane',
  wool: 'white_wool', carpet: 'white_carpet', leaves: 'oak_leaves', sapling: 'oak_sapling', ender_stone: 'end_stone', mycel: 'mycelium',
  quartz_ore: 'nether_quartz_ore', snow_ball: 'snowball', golden_carrot: 'golden_carrot', reeds: 'sugar_cane', sugar_cane: 'sugar_cane',
  nether_brick_item: 'nether_brick', redstone_torch_on: 'redstone_torch', iron_fence: 'iron_bars', thin_glass: 'glass_pane',
  enchanted_book: 'enchanted_book', boat: 'oak_boat', wood_door: 'oak_door', sign: 'oak_sign', bed: 'red_bed', banner: 'white_banner',
  prismarine_shard: 'prismarine_shard', monster_egg: 'infested_stone', mob_spawner: 'spawner', skull_item: 'player_head', leash: 'lead',
  wood: 'oak_planks', fence: 'oak_fence', huge_mushroom_1: 'brown_mushroom_block', huge_mushroom_2: 'red_mushroom_block',
  cocoa: 'cocoa_beans', cactus: 'cactus', pumpkin: 'carved_pumpkin', deadbush: 'dead_bush', red_flower: 'poppy',
};
const BANNER_COLORS = ['black', 'red', 'green', 'brown', 'blue', 'purple', 'cyan', 'light_gray', 'gray', 'pink', 'lime', 'yellow', 'light_blue', 'magenta', 'orange', 'white'];
const DYE_BY_DAMAGE = { 3: 'cocoa_beans', 4: 'lapis_lazuli', 15: 'bone_meal', 1: 'red_dye', 2: 'green_dye', 10: 'lime_dye', 11: 'yellow_dye', 0: 'ink_sac' };

export function skinHashFromNbt(str) {
  const m = /Value:\\?"([A-Za-z0-9+/=]+)\\?"/.exec(str || '');
  if (!m) return null;
  try {
    const j = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
    const url = j.textures?.SKIN?.url || '';
    return url.split('/').pop() || null;
  } catch { return null; }
}

// ID с Bazaar и из подсказок не всегда совпадает с ID в NEU: книги зачарований на Bazaar — ENCHANTMENT_REJUVENATE_5,
// в NEU — REJUVENATE;5; осколки — SHARD_X против ATTRIBUTE_SHARD_…;1; INK_SACK:3 против INK_SACK-3.
// Без этого иконка не находилась и вместо текстуры показывался барьер (красный знак «запрещено»).
const BOOK_RE = /^ENCHANTMENT_(.+)_(\d+)$/;
// Ванильные/старые названия, которыми предмет зовут подсказки и гайды, → ID в NEU
const NEU_ALIAS = { ENCHANTED_GOLDEN_APPLE: 'GOLDEN_APPLE-1', NECRON_CHESTPLATE: 'POWER_WITHER_CHESTPLATE', TWILIGHT_DAGGER: 'MAWDUST_DAGGER', SPACE_HELMET: 'DCTR_SPACE_HELM', ROD_OF_CHAMPIONS: 'CHAMP_ROD', COCOA_BEANS: 'INK_SACK-3', NETHER_WART: 'NETHER_STALK', JUNGLE_SAPLING: 'SAPLING-3', SPRUCE_SAPLING: 'SAPLING-1', BIRCH_SAPLING: 'SAPLING-2', ACACIA_SAPLING: 'SAPLING-4', DARK_OAK_SAPLING: 'SAPLING-5', OAK_SAPLING: 'SAPLING', WISP_POTION: 'POTION_WISP_ICE;1' };
export function neuIconId(id) {
  if (!id || neu.items.has(id)) return id;
  if (NEU_ALIAS[id] && neu.items.has(NEU_ALIAS[id])) return NEU_ALIAS[id];
  const bz = BOOK_RE.exec(id);
  if (bz && neu.items.has(`${bz[1]};${bz[2]}`)) return `${bz[1]};${bz[2]}`;
  if (id.includes(':') && neu.items.has(id.replace(':', '-'))) return id.replace(':', '-');
  let n = null;
  try { n = normalizeId(id); } catch { /* база items-ru не загружена */ }
  return n && neu.items.has(n) ? n : id;
}

const metaCache = new Map();
export function iconMeta(id) {
  if (metaCache.has(id)) return metaCache.get(id);
  const it = neu.items.get(neuIconId(id));
  // Книга зачарования, которой нет в NEU (новая или Bazaar-only) — всё равно зачарованная книга, а не барьер
  // Чертежи (Blueprint), которых ещё нет в NEU, в игре — бумага
  let meta = BOOK_RE.test(id) ? { kind: 'item', name: 'enchanted_book', glint: true }
    : /_BLUEPRINT$/.test(id) ? { kind: 'item', name: 'paper', glint: true }
    // Осколок, которого ещё нет в NEU (новый моб): общий вид осколка вместо барьера
    : /^SHARD_/.test(id) ? { kind: 'item', name: 'prismarine_shard', glint: true }
    : /COOKIE$/.test(id) ? { kind: 'item', name: 'cookie', glint: true }
    : { kind: 'item', name: 'barrier' };
  if (it) {
    const raw = it.rawNbt || '';
    const model = (/ItemModel:"minecraft:([a-z0-9_]+)"/.exec(raw) || [])[1];
    const hash = skinHashFromNbt(raw);
    const legacy = (it.mcId || '').replace('minecraft:', '');
    const glint = /ench:\[/.test(raw) || /Enchanted/.test(it.name);
    const color = (/color:(\d+)/.exec(raw) || [])[1];
    if (hash) meta = { kind: 'head', hash };
    else {
      let name = model || LEGACY[legacy] || legacy;
      if (legacy === 'dye' && !model) name = DYE_BY_DAMAGE[it.damage] || 'ink_sac';
      if (legacy === 'banner' && !model) name = `${BANNER_COLORS[it.damage] || 'white'}_banner`; // в 1.8 цвет флага — damage
      meta = { kind: 'item', name };
    }
    meta.glint = glint;
    if (color) meta.color = Number(color);
  }
  // Пока база NEU грузится (первые секунды после старта), барьер не запоминаем — иначе он остался бы до перезапуска
  if (it || neu.loadedAt) metaCache.set(id, meta);
  return meta;
}

async function cached(file, url) {
  fs.mkdirSync(cacheDir(), { recursive: true });
  const p = path.join(cacheDir(), file);
  if (fs.existsSync(p)) return fs.readFileSync(p);
  const r = await fetch(url, { headers: { 'User-Agent': config.userAgent }, signal: AbortSignal.timeout(8000) }); // без таймаута картинка висела, пока хост не ответит
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(p, buf);
  return buf;
}

export async function getSkin(hash) {
  if (!/^[a-f0-9]{20,80}$/.test(hash)) return null;
  return cached(`skin_${hash}.png`, `https://textures.minecraft.net/texture/${hash}`);
}

// Ванильная текстура по имени (nether_star, gold_ingot…): иконки меню и статов.
// Порядок: ресурс-паки → кэш на диске → установленный Minecraft → db/icons → интернет (GitHub, затем jsDelivr).
// Неудачу помним 10 минут, чтобы не долбить недоступный хост на каждую картинку.
const texMiss = new Map();
// scope 'public' (Visitors и друзья): без текстур паков, не разрешённых для всех, и без db/icons (рендеры Coflnet)
// Анимированные текстуры (command_block, magma, prismarine…) лежат полосой кадров 16×64 — отдаём только первый кадр,
// иначе в квадратной иконке видна сплющенная «развёртка».
export async function getTexture(name, opts = {}) {
  const buf = await findTexture(name, opts);
  return buf ? firstFrame(buf) : null;
}
// Модели, у которых картинка предмета — не та, что находится по имени первой (у big_dripleaf под именем — почти пустой бок)
const TEX_RENAME = { big_dripleaf: 'big_dripleaf_top' };
async function findTexture(name, { scope = 'all' } = {}) {
  if (!/^[a-z0-9_]+$/.test(name)) return null;
  if (TEX_RENAME[name]) return findTexture(TEX_RENAME[name], { scope });
  const fromPack = packVanillaTexture(name, scope);
  if (fromPack) return fromPack;
  const files = [`item_${name}.png`, `block_${name}.png`, `block_${name}_side.png`];
  for (const f of files) {
    const buf = readPng(path.join(cacheDir(), f), true); // только наш кэш, не db/ пользователя
    if (buf) return buf;
  }
  const local = clientJarTexture(name);
  if (local) return local;
  if (scope === 'all' || rendersPublic()) {
    const buf = readPng(path.join(config.iconsDir, name.toUpperCase() + '.png'));
    if (buf) return buf;
  }
  // Блоки без своей картинки предмета (ступени, заборы, стёкла-панели, ковры…) — сразу текстура материала,
  // до запросов в интернет: своей картинки у них нет нигде, а недоступный хост стоил бы секунды на каждую иконку
  const alt = blockAlt(name);
  if (alt && alt !== name) { const buf = await findTexture(alt, { scope }); if (buf) return buf; }
  if (Date.now() - (texMiss.get(name) || 0) < 10 * 60e3) return null;
  const rel = [`items/${name}.png`, `blocks/${name}.png`, `blocks/${name}_side.png`];
  if (TEX_FILE[name]) { rel.unshift(TEX_FILE[name] + '.png'); files.unshift(`item_${name}.png`); }
  for (const host of ASSET_HOSTS) {
    for (let i = 0; i < rel.length; i++) {
      const buf = await fetchTo(files[i], host + rel[i]);
      if (buf) return buf;
    }
  }
  const drawn = await drawTexture(name);
  if (drawn) return drawn;
  texMiss.set(name, Date.now());
  return null;
}

// У ступеней, плит, заборов, калиток, стен, панелей, ковров, флагов, кнопок и плит давления в игре объёмная модель,
// а отдельной плоской картинки нет: показываем текстуру материала (ступени из дуба → доски дуба).
const WOODS = /^(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak|bamboo|crimson|warped)$/;
const BASE_BLOCK = { brick: 'bricks', nether_brick: 'nether_bricks', stone_brick: 'stone_bricks', mossy_stone_brick: 'mossy_stone_bricks', quartz: 'quartz_block_side', smooth_stone: 'smooth_stone', purpur: 'purpur_block', prismarine_brick: 'prismarine_bricks', end_stone_brick: 'end_stone_bricks', smooth_quartz: 'quartz_block_bottom', smooth_sandstone: 'sandstone_top', smooth_red_sandstone: 'red_sandstone_top', sandstone: 'sandstone', red_sandstone: 'red_sandstone' };
const ALT = {
  glass_pane: 'glass', sticky_piston: 'piston_top_sticky', piston: 'piston_top', crafter: 'crafter_north', firework_charge: 'firework_star',
  noteblock: 'note_block', stained_hardened_clay: 'white_terracotta', infested_stone: 'stone', big_dripleaf: 'big_dripleaf_top',
  red_bed: 'red_wool', small_dripleaf: 'small_dripleaf_top',
};
export function blockAlt(name) {
  if (ALT[name]) return ALT[name];
  let m;
  if ((m = /^(.+)_stained_glass_pane$/.exec(name))) return `${m[1]}_stained_glass`;
  if ((m = /^(.+)_(carpet|banner|bed)$/.exec(name))) return `${m[1]}_wool`;
  if ((m = /^stripped_(.+)_wood$/.exec(name))) return `stripped_${m[1]}_log`;
  if ((m = /^(.+)_(stairs|slab|fence_gate|fence|wall|pressure_plate|button)$/.exec(name))) {
    const base = m[1];
    if (WOODS.test(base)) return `${base}_planks`;
    if (base === 'wood' || base === 'wooden') return 'oak_planks';
    return BASE_BLOCK[base] || base;
  }
  return null;
}

// Предметы, у которых картинка лежит не под своим именем (часы анимированы, цветы двойные, у раздатчика — лицевая сторона)
const TEX_FILE = {
  clock: 'items/clock_00', compass: 'items/compass_00', recovery_compass: 'items/recovery_compass_00',
  rose_bush: 'blocks/rose_bush_top', sunflower: 'blocks/sunflower_front', lilac: 'blocks/lilac_top', peony: 'blocks/peony_top',
  tall_grass: 'blocks/tall_grass_top', large_fern: 'blocks/large_fern_top',
  dropper: 'blocks/dropper_front', dispenser: 'blocks/dispenser_front', furnace: 'blocks/furnace_front', observer: 'blocks/observer_front',
  pumpkin: 'blocks/pumpkin_side', carved_pumpkin: 'blocks/carved_pumpkin', jack_o_lantern: 'blocks/jack_o_lantern',
  snow_block: 'blocks/snow', heavy_weighted_pressure_plate: 'blocks/iron_block', light_weighted_pressure_plate: 'blocks/gold_block',
  cactus_flower: '../1.21.5/blocks/cactus_flower', // появился в 1.21.5, в наборе 1.21.4 его нет
};
// Головы, сундук и яйца призыва в игре рисуются моделью, отдельной картинки у них нет — собираем из текстуры моба/сундука
const SKULL_SKIN = {
  player_head: 'entity/player/wide/steve', skeleton_skull: 'entity/skeleton/skeleton', wither_skeleton_skull: 'entity/skeleton/wither_skeleton',
  zombie_head: 'entity/zombie/zombie', creeper_head: 'entity/creeper/creeper', piglin_head: 'entity/piglin/piglin',
};
// Цвета яйца призыва: основа и пятна (как в игре)
const EGG_COLORS = { villager_spawn_egg: [0x563c33, 0xbd8b72], rabbit_spawn_egg: [0x995f40, 0x734831], frog_spawn_egg: [0xd07444, 0xffc77c], witch_spawn_egg: [0x340000, 0x51a03e], iron_golem_spawn_egg: [0xdbcdc2, 0x74a332], mooshroom_spawn_egg: [0xa00f10, 0xb7b7b7], cow_spawn_egg: [0x443626, 0xa1a1a1], zombie_spawn_egg: [0x00afaf, 0x799c65], skeleton_spawn_egg: [0xc1c1c1, 0x494949], spider_spawn_egg: [0x342d27, 0xa80e0e], wolf_spawn_egg: [0xd7d3d3, 0xceaf96], enderman_spawn_egg: [0x161616, 0x000000], blaze_spawn_egg: [0xf6b201, 0xfff87e], polar_bear_spawn_egg: [0xeeeeeb, 0xd5d6cd], ghast_spawn_egg: [0xf9f9f9, 0xbcbcbc] };

async function assetPng(rel) {
  const file = 'asset_' + rel.replace(/\//g, '_') + '.png';
  const own = readPng(path.join(cacheDir(), file), true);
  if (own) return PNG.sync.read(own);
  for (const host of ASSET_HOSTS) {
    const buf = await fetchTo(file, host + rel + '.png');
    if (buf) return PNG.sync.read(buf);
  }
  return null;
}
// Вырезать прямоугольник src → dst (с учётом прозрачности верхнего слоя)
function blit(src, dst, sx, sy, w, h, dx, dy, tint) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((sy + y) * src.width + sx + x) * 4, di = ((dy + y) * dst.width + dx + x) * 4;
    const a = src.data[si + 3] / 255;
    if (!a) continue;
    for (let c = 0; c < 3; c++) {
      const v = tint ? src.data[si + c] * ((tint >> (16 - 8 * c)) & 255) / 255 : src.data[si + c];
      dst.data[di + c] = Math.round(v * a + dst.data[di + c] * (1 - a));
    }
    dst.data[di + 3] = Math.max(dst.data[di + 3], src.data[si + 3]);
  }
}
async function drawTexture(name) {
  try {
    let out = null;
    if (SKULL_SKIN[name]) {
      const skin = await assetPng(SKULL_SKIN[name]);
      if (!skin) return null;
      out = new PNG({ width: 8, height: 8 });
      blit(skin, out, 8, 8, 8, 8, 0, 0);
      if (skin.height >= 64 || name === 'player_head') blit(skin, out, 40, 8, 8, 8, 0, 0); // слой шляпы
    } else if (name === 'chest' || name === 'trapped_chest' || name === 'ender_chest') {
      const t = await assetPng(`entity/chest/${{ chest: 'normal', trapped_chest: 'trapped', ender_chest: 'ender' }[name]}`);
      if (!t) return null;
      // Вид спереди: крышка (14×5) над корпусом (14×10) и замок (2×4).
      const tmp = new PNG({ width: 14, height: 15 });
      blit(t, tmp, 14, 14, 14, 5, 0, 0);
      blit(t, tmp, 14, 33, 14, 10, 0, 5);
      out = new PNG({ width: 16, height: 16 });
      for (let y = 0; y < 15; y++) for (let x = 0; x < 14; x++) {
        const si = (y * 14 + x) * 4, di = ((y + 1) * 16 + x + 1) * 4;
        for (let c = 0; c < 4; c++) out.data[di + c] = tmp.data[si + c];
      }
      const lock = new PNG({ width: 2, height: 4 });
      blit(t, lock, 1, 1, 2, 4, 0, 0);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
        const si = (y * 2 + x) * 4, di = ((y + 4) * 16 + x + 7) * 4;
        for (let c = 0; c < 4; c++) out.data[di + c] = lock.data[si + c];
      }
    } else if (EGG_COLORS[name]) {
      const [base, over] = [await assetPng('items/spawn_egg'), await assetPng('items/spawn_egg_overlay')];
      if (!base || !over) return null;
      out = new PNG({ width: base.width, height: base.height });
      blit(base, out, 0, 0, base.width, base.height, 0, 0, EGG_COLORS[name][0]);
      blit(over, out, 0, 0, over.width, over.height, 0, 0, EGG_COLORS[name][1]);
    }
    if (!out) return null;
    const buf = PNG.sync.write(out);
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(path.join(cacheDir(), `item_${name}.png`), buf);
    return buf;
  } catch { return null; }
}

const isPng = buf => buf?.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
// Файл из кэша, только если это настоящий PNG. Раньше в кэш мог попасть ответ-заглушка вместо картинки —
// такой файл в нашем кэше удаляем, чтобы текстура скачалась заново. Файлы пользователя (db/) не трогаем.
function readPng(p, dropBad = false) {
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  if (isPng(buf)) return buf;
  if (dropBad) try { fs.unlinkSync(p); } catch { /* занят — попробуем в следующий раз */ }
  return null;
}

// Скачать с таймаутом и положить в кэш; null — нет файла или хост не ответил
async function fetchTo(file, url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': config.userAgent }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!isPng(buf)) return null; // не PNG (страница-заглушка провайдера и т. п.)
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(path.join(cacheDir(), file), buf);
    return buf;
  } catch { return null; }
}

// Готовый рендер иконки предмета: локальная папка db/icons, иначе скачиваем с Coflnet и кэшируем
const failed = new Set();
// Ванильные названия, под которыми предмет иногда ищут гайды, → SkyBlock ID
const ID_ALIAS = { RAW_SALMON: 'RAW_FISH:1', CLOWNFISH: 'RAW_FISH:2', PUFFERFISH: 'RAW_FISH:3', TROPICAL_FISH: 'RAW_FISH:2', COD: 'RAW_FISH', SALMON: 'RAW_FISH:1' };

// Варианты ванильных предметов по damage (RAW_FISH:1 и т.п.) — у паков и рендеров одна картинка на все, берём ванильную
const DAMAGE_TEXTURE = { 'RAW_FISH:1': 'salmon', 'RAW_FISH:2': 'tropical_fish', 'RAW_FISH:3': 'pufferfish' };

// Готовые рендеры Coflnet (и папка db/icons, собранная из них) распространять без разрешения Coflnet нельзя:
// Visitors их не отдаём, пока в .env нет RENDERS_PUBLIC=1 (вписать только после разрешения). Тогда сайт
// у гостя рисует голову из скина (textures.minecraft.net) или ванильную текстуру — как в «чистом» SkyCrypt.
export const rendersPublic = (env = process.env) => env.RENDERS_PUBLIC === '1';

export async function getRender(id, { scope = 'all' } = {}) {
  if (!/^[A-Za-z0-9_;:\-]+$/.test(id)) return null;
  // Питомцы NEU «ТИП;редкость» (ENDER_DRAGON;4): у Coflnet и в db/icons они называются PET_ТИП
  const pet = /^([A-Z0-9_]+);[0-5]$/.exec(id);
  const ids = pet ? [id, 'PET_' + pet[1]] : [id];
  if (ID_ALIAS[id]) ids.push(ID_ALIAS[id]);
  // Паки и рендеры знают предмет по ID из NEU (REJUVENATE;5), а спрашивают по ID с Bazaar (ENCHANTMENT_REJUVENATE_5)
  const nid = neuIconId(id);
  if (nid !== id) ids.push(nid);
  const vanilla = DAMAGE_TEXTURE[ID_ALIAS[id] || id];
  if (vanilla) { const t = await getTexture(vanilla, { scope }); if (t) return t; }
  for (const cand of ids) {
    const buf = await renderOne(cand, scope);
    if (buf) return buf;
  }
  return null;
}

// Ванильный слой для модели пака («item/diamond» под блёстками Diamond Spreading): из паков, с диска или из Minecraft
const vanillaLayer = scope => name => {
  const fromPack = packVanillaTexture(name, scope);
  if (fromPack) return fromPack;
  for (const f of [`item_${name}.png`, `block_${name}.png`]) { const b = readPng(path.join(cacheDir(), f)); if (b) return b; }
  return clientJarTexture(name);
};
const layerMiss = new Map(); // id → когда не удалось скачать слой: не пробуем снова 10 минут
async function packIcon(id, model, scope, color) {
  const opts = { vanilla: vanillaLayer(scope), color };
  let r = packTexture(id, model, scope, opts);
  const needs = r ? r.needs : packTexture.lastNeeds;
  if (needs?.length && Date.now() - (layerMiss.get(id) || 0) > 10 * 60e3) {
    // Слоя ещё нет на диске: скачиваем (GitHub/jsDelivr) и собираем иконку заново
    await Promise.all(needs.map(n => getTexture(n, { scope: 'public' }).catch(() => null)));
    forgetPackTexture(id, scope);
    r = packTexture(id, model, scope, opts);
    if (r ? r.needs : packTexture.lastNeeds.length) layerMiss.set(id, Date.now());
  }
  return r;
}

async function renderOne(id, scope = 'all') {
  const file = id.replace(/[;:]/g, '_') + '.png';
  // 1) ресурс-паки по приоритету (Hypixel Plus → FurfSky → Hypixel SkyBlock)
  const raw = neu.items.get(id)?.rawNbt || '';
  const model = (/ItemModel:"([^"]+)"/.exec(raw) || [])[1];
  const color = (/color:(\d+)/.exec(raw) || [])[1];
  const fromPack = await packIcon(id, model, scope, color != null ? Number(color) : undefined);
  if (fromPack) return fromPack.buf;
  // Голова со скином: готовые рендеры Coflnet для многих голов — голова Стива (Krampus Helmet и др.),
  // а сайт и так рисует голову из настоящего скина предмета. Рендеры берём только для не-голов.
  if (neu.items.has(id) && iconMeta(id).kind === 'head') return null;
  if (scope !== 'all' && !rendersPublic()) return null;
  // 2) готовые рендеры в db/icons, 3) Coflnet
  for (const p of [path.join(config.iconsDir, id + '.png'), path.join(config.iconsDir, file)]) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  if (failed.has(id) || id.includes(';')) return null;
  const buf = await cached(`render_${file}`, `https://sky.coflnet.com/static/icon/${encodeURIComponent(id)}`).catch(() => null);
  if (!buf || buf.slice(0, 4).toString('hex') !== '89504e47') {
    failed.add(id);
    try { fs.unlinkSync(path.join(cacheDir(), `render_${file}`)); } catch {}
    return null;
  }
  return buf;
}

// Аватарка игрока (голова из скина). Сервер рисует её сам из настоящего скина Mojang и кэширует на 6 часов,
// браузер обращается только к нам. Раньше картинку отдавал mc-heads.net, а он под нагрузкой иногда присылал
// голову Стива вместо настоящей — и она держалась в кэше. Теперь mc-heads — только запасной путь, и его ответ
// хранится 10 минут.
const AVATAR_TTL = 6 * 3600e3;
const AVATAR_FALLBACK_TTL = 10 * 60e3;
const AVATAR_SIZES = [16, 24, 32, 48, 64, 96, 128];
const avatarMiss = new Map();
const skinHashes = new Map(); // uuid → { hash, at }

/** Голова спереди из PNG скина: лицо (8,8) и второй слой (40,8), увеличенные без сглаживания до size×size */
export function headFromSkin(buf, size = 64) {
  const png = PNG.sync.read(buf);
  if (png.width !== 64 || (png.height !== 64 && png.height !== 32)) return null;
  const at = (x, y) => (y * png.width + x) * 4;
  // Старые скины 64×32: если второй слой головы целиком непрозрачный, игра его не рисует (иначе он закрывал бы лицо)
  let hat = true;
  if (png.height === 32) {
    hat = false;
    for (let y = 0; y < 16 && !hat; y++) for (let x = 32; x < 64; x++) if (png.data[at(x, y) + 3] < 128) { hat = true; break; }
  }
  const s = Math.max(8, Math.round(size / 8) * 8);
  const out = new PNG({ width: s, height: s });
  const k = s / 8;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const fx = Math.floor(x / k), fy = Math.floor(y / k);
    const f = at(8 + fx, 8 + fy), h = at(40 + fx, 8 + fy), o = (y * s + x) * 4;
    // Лицо в игре всегда непрозрачное (прозрачные пиксели становятся своим цветом без прозрачности)
    let r = png.data[f], g = png.data[f + 1], b = png.data[f + 2];
    const a = hat ? png.data[h + 3] / 255 : 0;
    if (a > 0) {
      r = Math.round(png.data[h] * a + r * (1 - a));
      g = Math.round(png.data[h + 1] * a + g * (1 - a));
      b = Math.round(png.data[h + 2] * a + b * (1 - a));
    }
    out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255;
  }
  return PNG.sync.write(out);
}

// Хэш текстуры скина по uuid (sessionserver Mojang); null — у игрока стандартный скин или Mojang не ответил
async function skinHashOf(uuid) {
  const hit = skinHashes.get(uuid);
  if (hit && Date.now() - hit.at < AVATAR_TTL) return hit.hash;
  const prof = await getJson(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 5000, retries: 1 });
  const raw = prof?.properties?.find(p => p.name === 'textures')?.value;
  const url = raw ? JSON.parse(Buffer.from(raw, 'base64').toString('utf8')).textures?.SKIN?.url : null;
  const hash = url ? url.split('/').pop() : null;
  skinHashes.set(uuid, { hash, at: Date.now() });
  return hash;
}

async function ownAvatar(id, size) {
  let uuid = /^[a-f0-9]{32}$/i.test(id) ? id.toLowerCase() : null;
  if (!uuid) {
    const d = await getJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(id)}`, { timeout: 5000, retries: 1 });
    uuid = String(d?.id || '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(uuid)) return null;
  }
  const hash = await skinHashOf(uuid);
  const skin = hash ? await getSkin(hash) : null;
  return skin ? headFromSkin(skin, size) : null;
}

export async function getAvatar(who, size = 64) {
  const id = String(who || '').replace(/-/g, '');
  if (!/^[A-Za-z0-9_]{1,16}$/.test(id) && !/^[a-f0-9]{32}$/i.test(id)) return null;
  const want = Number(size) || 64;
  const s = AVATAR_SIZES.find(x => x >= want) || 128;
  const name = `head_${id.toLowerCase()}_${s}.png`;
  const file = path.join(cacheDir(), name);
  try { if (Date.now() - fs.statSync(file).mtimeMs < AVATAR_TTL) return fs.readFileSync(file); } catch { /* нет в кэше */ }
  const key = `${id.toLowerCase()}_${s}`;
  if (Date.now() - (avatarMiss.get(key) || 0) < AVATAR_FALLBACK_TTL) return readPng(file); // недавно не вышло — отдаём старую, если есть
  const own = await ownAvatar(id, s).catch(() => null);
  if (own) {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(file, own);
    return own;
  }
  // Mojang не ответил или скин стандартный — голову рисует mc-heads (он знает стандартные скины Steve/Alex).
  // Такой ответ живёт в кэше 10 минут, а не 6 часов: вдруг это была заглушка
  const fresh = await fetchTo(name, `https://mc-heads.net/avatar/${encodeURIComponent(id)}/${s}`);
  if (fresh) {
    const old = new Date(Date.now() - AVATAR_TTL + AVATAR_FALLBACK_TTL);
    try { fs.utimesSync(file, old, old); } catch { /* не страшно */ }
    return fresh;
  }
  avatarMiss.set(key, Date.now());
  return readPng(file);
}
