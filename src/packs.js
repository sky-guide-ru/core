// Ресурс-паки (как в SkyCrypt): Hypixel Plus, FurfSky Reborn, официальный пак Hypixel SkyBlock.
// Паки НЕ входят в репозиторий: положи zip-архивы (или распакованные папки) в папку packs/.
// Порядок приоритета — packs/order.json (["Hypixel Plus", "FurfSky", "Hypixel SkyBlock"]) или по умолчанию как ниже.
//
// Поддерживаемые форматы текстур по SkyBlock ID:
//  1) Firmament: assets/firmskyblock/models/item/<id>.json (FurfSky / Hypixel Plus для 1.21+)
//  2) OptiFine / CIT Resewn: assets/minecraft/optifine/cit/**.properties с nbt.ExtraAttributes.id=<ID>
//  3) Официальный пак Hypixel: assets/hypixel_skyblock/items/... по полю ItemModel из базы NEU
import fs from 'node:fs';
import path from 'node:path';
import { openZip } from './lib/zip-lazy.js';
import { PNG } from 'pngjs';
import { config } from './config.js';

const DEFAULT_ORDER = ['hypixel plus', 'hypixelplus', 'furfsky', 'fsr', 'hypixel skyblock', 'hypixel_skyblock', 'skyblock'];

class PackSource {
  constructor(file) {
    this.file = file;
    this.name = path.basename(file).replace(/\.zip$/i, '');
    if (fs.statSync(file).isDirectory()) {
      this.dir = file;
      this.files = new Map();
      const walk = (d, rel = '') => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const r = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) walk(path.join(d, e.name), r);
          else this.files.set(r.toLowerCase(), path.join(d, e.name));
        }
      };
      walk(file);
    } else {
      // Только оглавление: сами текстуры читаются с диска, когда понадобятся (весь архив в памяти — это сотни МБ)
      this.zip = openZip(file, { key: s => s.toLowerCase() });
      this.files = this.zip.entries;
    }
    // Если в архиве всё лежит во вложенной папке — убираем префикс
    // (оверлеи вида 1_21_5/assets/... не считаем префиксом, если есть корневой assets/)
    const keys = [...this.files.keys()];
    const withAssets = keys.some(k => k.startsWith('assets/')) ? null : keys.find(k => /(^|\/)assets\//.test(k));
    const prefix = withAssets ? withAssets.slice(0, withAssets.indexOf('assets/')) : '';
    if (prefix) {
      const m = new Map();
      for (const [k, v] of this.files) if (k.startsWith(prefix)) m.set(k.slice(prefix.length), v);
      this.files = m;
    }
    this.meta = this.readJson('pack.mcmeta')?.pack || {};
  }
  has(p) { return this.files.has(p.toLowerCase()); }
  read(p) {
    const e = this.files.get(p.toLowerCase());
    if (!e) return null;
    return typeof e === 'string' ? fs.readFileSync(e) : this.zip.read(e);
  }
  close() { this.zip?.close(); }
  readJson(p) { try { const b = this.read(p); return b ? JSON.parse(b.toString('utf8').replace(/^﻿/, '')) : null; } catch { return null; } }
  list(prefix) { return [...this.files.keys()].filter(k => k.startsWith(prefix)); }
}

// "namespace:path" → путь в паке
function resPath(ref, kind, ext) {
  let [ns, p] = ref.includes(':') ? ref.split(':') : ['minecraft', ref];
  if (p.startsWith(`${kind}/`)) p = p.slice(kind.length + 1);
  return `assets/${ns}/${kind}/${p}${p.endsWith(ext) ? '' : ext}`;
}

// Иконка на сайте не бывает больше ~64 CSS-пикселей (на телефоне с плотным экраном это 192 точки).
// Текстуры паков в высоком разрешении (128–512 px) ужимаем до 128 соседними пикселями: пиксель-арт не мылится,
// а картинка весит в разы меньше. Это заметно на телефоне через туннель: на странице бывают сотни иконок.
export const ICON_MAX = 128;
// Первый кадр анимированной текстуры (высокая полоса кадров) → квадрат, большие — уменьшить до ICON_MAX
export function firstFrame(buf) {
  try {
    buf = trimPng(buf);
    const png = PNG.sync.read(buf);
    const w = png.width;
    if (png.height <= w && w <= ICON_MAX) return buf;
    const step = w > ICON_MAX ? Math.ceil(w / ICON_MAX) : 1;
    const size = Math.floor(w / step);
    const out = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const from = ((y * step) * w + x * step) * 4, to = (y * size + x) * 4;
        png.data.copy(out.data, to, from, from + 4);
      }
    }
    return PNG.sync.write(out, { deflateLevel: 9 });
  } catch { return buf; }
}

export const packs = { list: [], byId: new Map(), cit: [], loadedAt: 0 };

// Лицензии паков: Hypixel Plus — CC BY-NC-ND 4.0 (только некоммерческое использование), FurfSky Reborn — «все права
// защищены». Пока на сайте нет рекламы, текстуры паков видят все (решение владельца, 23.11.2026). Как только в .env
// появляется блок РСЯ (YANDEX_RTB_BOTTOM / YANDEX_RTB_LANDING), сайт становится коммерческим и текстуры паков
// автоматически остаются только владельцу (с этого ПК или после входа), остальным — головы из скинов и ванильные
// текстуры. Вручную: PACKS_PUBLIC=all (всем всегда) | none (только владельцу) | список частей имени файла через
// запятую (паки, на которые есть письменное разрешение автора).
export function publicPackNames(env = process.env) {
  const raw = String(env.PACKS_PUBLIC ?? '').trim().toLowerCase();
  if (raw === 'all' || raw === '*') return ['*'];
  if (raw === 'none' || raw === '0') return [];
  if (raw) return raw.split(',').map(s => s.trim()).filter(Boolean);
  return adsEnabled(env) ? [] : ['*']; // авто: без рекламы — всем
}
export const adsEnabled = (env = process.env) => /^R-A-\d{4,12}-\d{1,6}$/.test(String(env.YANDEX_RTB_BOTTOM || '').trim()) || /^R-A-\d{4,12}-\d{1,6}$/.test(String(env.YANDEX_RTB_LANDING || '').trim());
export const isPublicPack = (p, env = process.env) => { const l = p.name.toLowerCase(); return publicPackNames(env).some(n => n === '*' || l.includes(n)); };
const packsFor = scope => (scope === 'public' ? packs.list.filter(p => isPublicPack(p)) : packs.list);

// Модель предмета → картинка иконки. Модель собираем по цепочке parent (текстуры ребёнка важнее родителя).
//  - плоская модель (layer0, layer1…): слои накладываются друг на друга. Слой из ванильного Minecraft
//    («item/diamond»), которого нет в паке, берём через opts.vanilla; нет и там — запоминаем в opts.needs;
//  - объёмная модель (elements: блок, голова, 3D-предмет): её текстура — развёртка граней, целиком её показывать нельзя.
//    Берём лицевую грань (north, иначе south…) самого крупного элемента — как предмет видно в инвентаре спереди.
// particle — только частицы при разрушении, для иконки не годится (у Hypixel Plus это пустая item/achoo).
const BASIC_PARENT = /^(minecraft:)?(item|block)\/(generated|handheld|handheld_rod)$|^builtin\//;
function resolveModel(pack, modelRef) {
  const textures = {};
  let elements = null;
  let ref = modelRef;
  for (let depth = 0; ref && depth <= 6; depth++) {
    if (BASIC_PARENT.test(ref)) break;
    const model = pack.readJson(resPath(ref, 'models', '.json'));
    if (!model) { if (depth === 0) return null; break; }
    for (const [k, v] of Object.entries(model.textures || {})) if (!(k in textures)) textures[k] = v;
    if (!elements && Array.isArray(model.elements) && model.elements.length) elements = model.elements;
    ref = model.parent;
  }
  const deref = v => { for (let i = 0; i < 8 && typeof v === 'string' && v.startsWith('#'); i++) v = textures[v.slice(1)]; return typeof v === 'string' && !v.startsWith('#') ? v : null; };
  return { textures, elements, deref };
}
// Часть PNG в паках с мусором после конца файла (IEND): браузеру всё равно, а pngjs такие не читает — обрезаем хвост
export function trimPng(buf) {
  const i = buf?.lastIndexOf?.('IEND');
  return i > 0 && buf.length > i + 8 ? buf.subarray(0, i + 8) : buf;
}
const pngOf = buf => { try { return PNG.sync.read(trimPng(buf)); } catch { return null; } };
const isEmptyPng = png => { for (let i = 3; i < png.data.length; i += 4) if (png.data[i]) return false; return true; };
function readTex(pack, ref, opts) {
  const buf = pack.read(resPath(ref, 'textures', '.png'));
  if (buf) return buf;
  const [ns, p] = ref.includes(':') ? ref.split(':') : ['minecraft', ref];
  if (ns !== 'minecraft') return null;
  const name = p.replace(/^(item|block)\//, '');
  const v = opts?.vanilla?.(name);
  if (v) return v;
  opts?.needs?.add(name);
  return null;
}
// Пиксель поверх пикселя (source-over) в PNG без премультипликации: полупрозрачное не темнеет,
// а два полупрозрачных слоя дают более плотный цвет (128 + 128 → ~192)
function blend(dst, di, rgb, alpha) {
  const a = alpha / 255;
  if (!a) return;
  const da = dst[di + 3] / 255;
  const oa = a + da * (1 - a);
  for (let c = 0; c < 3; c++) dst[di + c] = Math.round((rgb[c] * a + dst[di + c] * da * (1 - a)) / oa);
  dst[di + 3] = Math.round(oa * 255);
}
// Наложить слои (уже первые кадры) один на другой; tint — цвет крашеной кожи для layer0
function composeLayers(bufs, tint) {
  if (bufs.length === 1 && tint == null) return bufs[0];
  const pngs = bufs.map(pngOf).filter(Boolean);
  if (!pngs.length) return null;
  const size = Math.max(...pngs.map(p => p.width));
  const out = new PNG({ width: size, height: size });
  pngs.forEach((src, li) => {
    const k = size / src.width;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const si = (Math.floor(y / k) * src.width + Math.floor(x / k)) * 4, di = (y * size + x) * 4;
      const rgb = [0, 1, 2].map(c => (li === 0 && tint != null ? src.data[si + c] * ((tint >> (16 - 8 * c)) & 255) / 255 : src.data[si + c]));
      blend(out.data, di, rgb, src.data[si + 3]);
    }
  });
  return PNG.sync.write(out, { deflateLevel: 9 });
}
// Объёмная модель «спереди»: каждый элемент рисуем его гранью north (или south) в свою область по from/to,
// ближние элементы поверх дальних. Так 3D-меч из многих кубиков, голова или блок видны целиком, а не развёрткой.
// Поворот элементов и граней не учитываем — для иконки 16×16 этого хватает.
function frontView(pack, m, opts, side) {
  const els = m.elements.filter(e => Array.isArray(e.from) && Array.isArray(e.to) && e.faces?.[side]);
  if (!els.length) return null;
  const texs = new Map();
  const tex = ref => {
    if (!texs.has(ref)) { const raw = readTex(pack, ref, opts); texs.set(ref, raw ? pngOf(firstFrame(raw)) : null); }
    return texs.get(ref);
  };
  // Масштаб: сколько точек текстуры на единицу модели (16 единиц uv = ширина текстуры), не больше ICON_MAX на всю иконку
  let k = 1;
  for (const e of els) { const t = tex(m.deref(e.faces[side].texture) || ''); if (t) k = Math.max(k, t.width / 16); }
  k = Math.min(k, ICON_MAX / 16);
  const size = Math.round(16 * k);
  const out = new PNG({ width: size, height: size });
  // north смотрит в сторону −z: ближе к зрителю меньший z, и ось x видна зеркально
  const depth = e => side === 'north' ? -Math.min(e.from[2], e.to[2]) : Math.max(e.from[2], e.to[2]);
  for (const e of els.slice().sort((a, b) => depth(a) - depth(b))) {
    const f = e.faces[side];
    const t = tex(m.deref(f.texture) || '');
    if (!t) continue;
    const [fx1, fx2] = [Math.min(e.from[0], e.to[0]), Math.max(e.from[0], e.to[0])];
    const [fy1, fy2] = [Math.min(e.from[1], e.to[1]), Math.max(e.from[1], e.to[1])];
    const dx1 = side === 'north' ? 16 - fx2 : fx1, dx2 = side === 'north' ? 16 - fx1 : fx2;
    const uv = f.uv || [dx1, 16 - fy2, dx2, 16 - fy1];
    const tk = t.width / 16;
    const X0 = Math.round(dx1 * k), X1 = Math.round(dx2 * k), Y0 = Math.round((16 - fy2) * k), Y1 = Math.round((16 - fy1) * k);
    for (let y = Math.max(0, Y0); y < Math.min(size, Y1); y++) {
      for (let x = Math.max(0, X0); x < Math.min(size, X1); x++) {
        const u = uv[0] + (uv[2] - uv[0]) * ((x - X0 + 0.5) / Math.max(1, X1 - X0));
        const v = uv[1] + (uv[3] - uv[1]) * ((y - Y0 + 0.5) / Math.max(1, Y1 - Y0));
        const sx = Math.min(t.width - 1, Math.max(0, Math.floor(u * tk))), sy = Math.min(t.height - 1, Math.max(0, Math.floor(v * tk)));
        const si = (sy * t.width + sx) * 4, di = (y * size + x) * 4;
        blend(out.data, di, [t.data[si], t.data[si + 1], t.data[si + 2]], t.data[si + 3]);
      }
    }
  }
  return isEmptyPng(out) ? null : out;
}
const opaqueCount = png => { let n = 0; for (let i = 3; i < png.data.length; i += 4) if (png.data[i]) n++; return n; };
function frontFace(pack, m, opts) {
  // Обычно лицо у north; если спереди почти пусто (лицевая грань у модели на south) — берём south
  const views = ['north', 'south'].map(side => frontView(pack, m, opts, side)).filter(Boolean);
  if (!views.length) return null;
  const best = views.reduce((a, b) => (opaqueCount(b) > opaqueCount(a) * 1.5 ? b : a));
  return PNG.sync.write(best, { deflateLevel: 9 });
}
function textureFromModel(pack, modelRef, opts) {
  if (!modelRef) return null;
  const m = resolveModel(pack, modelRef);
  if (!m) return null;
  // Есть elements — модель объёмная, даже если текстура названа layer0 (шлемы FurfSky: развёртка головы в layer0)
  if (m.elements) return frontFace(pack, m, opts);
  const layers = [];
  for (let i = 0; i < 8; i++) { const r = m.deref(m.textures[`layer${i}`]); if (r) layers.push(r); else if (i > 0) break; }
  if (layers.length) {
    const bufs = layers.map(r => readTex(pack, r, opts));
    if (!bufs[0]) return null; // без основы один верхний слой (блёстки, ободок) выглядит пустым или чужим
    const tint = /leather_/.test(layers[0]) ? (opts?.color ?? 0xa06540) : null;
    return composeLayers(bufs.filter(Boolean).map(firstFrame), tint);
  }
  const one = ['all', 'texture', 'front', 'side'].map(k => m.deref(m.textures[k])).find(Boolean)
    || Object.entries(m.textures).filter(([k]) => k !== 'particle').map(([, v]) => m.deref(v)).find(Boolean);
  return one ? readTex(pack, one, opts) : null;
}

// Новый формат 1.21.4+: items/<x>.json → { model: { type, model } } (с условиями/диспетчерами — берём первую модель)
// Состояние «в покое»: условия (is_shiny, using_item, selected…) → on_false,
// select/range_dispatch → fallback (иначе первый вариант), composite → первая модель.
function firstModelRef(node, depth = 0) {
  if (!node || depth > 12) return null;
  if (typeof node === 'string') return node;
  const type = String(node.type || '').replace('minecraft:', '');
  if (type === 'model' || (type.endsWith('model') && typeof node.model === 'string')) return typeof node.model === 'string' ? node.model : null;
  const order = type === 'condition' ? ['on_false', 'on_true']
    : (type === 'select' || type === 'range_dispatch') ? ['fallback'] : ['model', 'fallback', 'on_false', 'on_true'];
  for (const k of order) { const r = firstModelRef(node[k], depth + 1); if (r) return r; }
  for (const k of ['cases', 'entries', 'models']) {
    for (const c of node[k] || []) { const r = firstModelRef(c.model || c, depth + 1); if (r) return r; }
  }
  return null;
}

function itemDefTexture(pack, ns, name, opts) {
  const def = pack.readJson(`assets/${ns}/items/${name}.json`);
  const ref = def ? firstModelRef(def.model) : null;
  return ref ? textureFromModel(pack, ref, opts) : null;
}

function parseProps(text) {
  const o = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([^#=][^=]*?)\s*=\s*(.*)$/.exec(line);
    if (m) o[m[1].trim()] = m[2].trim();
  }
  return o;
}

function citMatcher(v) {
  if (!v) return null;
  if (v.startsWith('regex:')) { const r = new RegExp(`^(?:${v.slice(6)})$`); return id => r.test(id); }
  if (v.startsWith('iregex:')) { const r = new RegExp(`^(?:${v.slice(7)})$`, 'i'); return id => r.test(id); }
  if (v.startsWith('pattern:') || v.startsWith('ipattern:')) {
    const ci = v.startsWith('i');
    const r = new RegExp('^' + v.slice(ci ? 9 : 8).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ci ? 'i' : '');
    return id => r.test(id);
  }
  const exact = v.replace(/^"|"$/g, '');
  return id => id === exact;
}

function indexCit(pack) {
  const rules = [];
  for (const key of pack.list('assets/minecraft/optifine/cit/').concat(pack.list('assets/minecraft/mcpatcher/cit/'))) {
    if (!key.endsWith('.properties')) continue;
    const props = parseProps(pack.read(key).toString('utf8'));
    if (props.type && props.type !== 'item') continue;
    const idVal = props['nbt.ExtraAttributes.id'] || props['components.custom_data.id'] || props['nbt.extraattributes.id'];
    if (!idVal) continue;
    // Только правила без дополнительных условий по NBT (кроме id) — это «базовая» текстура предмета
    const extra = Object.keys(props).filter(k => (k.startsWith('nbt.') || k.startsWith('components.')) && !/\.id$/i.test(k));
    const dir = key.slice(0, key.lastIndexOf('/') + 1);
    const base = key.slice(dir.length, -'.properties'.length);
    const texRef = props.texture || props['texture.bow_standby'] || null;
    const modelRef = props.model || null;
    rules.push({ match: citMatcher(idVal), extra: extra.length, dir, base, texRef, modelRef, weight: Number(props.weight || 0) });
  }
  // Сначала без доп. условий, потом по весу
  return rules.sort((a, b) => a.extra - b.extra || b.weight - a.weight);
}

function citTexture(pack, rule) {
  const tryPng = p => pack.read(p.endsWith('.png') ? p : p + '.png');
  if (rule.texRef) {
    const r = rule.texRef.replace(/^\.\//, '');
    return tryPng(r.includes('/') && !r.startsWith('.') ? (r.startsWith('assets/') ? r : rule.dir + r) : rule.dir + r) || tryPng(`assets/minecraft/${r}`);
  }
  if (rule.modelRef) {
    const r = rule.modelRef.replace(/^\.\//, '');
    const model = pack.readJson((r.startsWith('assets/') ? r : rule.dir + r) + (r.endsWith('.json') ? '' : '.json'));
    const tex = model?.textures?.layer0 || model?.textures?.all || (model?.textures && Object.values(model.textures)[0]);
    if (tex) return tryPng(rule.dir + tex.replace(/^\.\//, '')) || pack.read(resPath(tex, 'textures', '.png'));
    return null;
  }
  return tryPng(rule.dir + rule.base);
}

// Определения предметов 1.21.4+ (assets/<ns>/items/*.json): условие по компоненту custom_data с id предмета
// → модель. Так устроен Hypixel Plus для 1.21.x.
function idsFromValue(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(idsFromValue);
  if (typeof v === 'object') return v.id ? [String(v.id)] : (v.ExtraAttributes?.id ? [String(v.ExtraAttributes.id)] : []);
  const m = String(v).match(/\bid\s*:\s*"?([A-Za-z0-9_:;\-]+)"?/); // SNBT-строка
  return m ? [m[1]] : [];
}
const isCustomData = n => /(^|:)custom_data$/.test(n?.predicate || n?.component || '');
function walkItemDef(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 40) return;
  const type = String(node.type || '').replace('minecraft:', '');
  if (type === 'condition' && /component$/.test(node.property || '') && isCustomData(node)) {
    const ref = firstModelRef(node.on_true);
    if (ref) for (const id of idsFromValue(node.value)) if (!out.has(id)) out.set(id, ref);
  }
  if (type === 'select' && /component$/.test(node.property || '') && isCustomData(node)) {
    for (const c of node.cases || []) {
      const ref = firstModelRef(c.model);
      if (ref) for (const id of idsFromValue(c.when)) if (!out.has(id)) out.set(id, ref);
    }
  }
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach(x => walkItemDef(x, out, depth + 1));
    else if (v && typeof v === 'object') walkItemDef(v, out, depth + 1);
  }
}
function indexComponents(pack) {
  const out = new Map();
  for (const key of pack.list('assets/')) {
    if (!/^assets\/[^/]+\/items\/.+\.json$/.test(key)) continue;
    const j = pack.readJson(key);
    if (j) walkItemDef(j.model || j, out);
  }
  return out;
}

export function loadPacks(dir = config.packsDir) {
  fs.mkdirSync(dir, { recursive: true });
  let order = DEFAULT_ORDER;
  try { order = JSON.parse(fs.readFileSync(path.join(dir, 'order.json'), 'utf8')).map(s => String(s).toLowerCase()); } catch {}
  const entries = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.zip') || fs.statSync(path.join(dir, f)).isDirectory());
  const rank = n => { const l = n.toLowerCase(); const i = order.findIndex(o => l.includes(o)); return i < 0 ? 99 : i; };
  entries.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  for (const old of packs.list) old.close?.(); // перезагрузка паков: закрыть старые архивы
  packs.list = [];
  for (const e of entries) {
    try {
      const p = new PackSource(path.join(dir, e));
      p.cit = indexCit(p);
      p.components = indexComponents(p);
      p.hasFirm = p.list('assets/firmskyblock/').length > 0;
      p.hasHypixel = p.list('assets/hypixel_skyblock/').length > 0;
      packs.list.push(p);
      console.log(`[паки] ${p.name}: CIT-правил ${p.cit.length}, предметов по custom_data ${p.components.size}${p.hasFirm ? ', Firmament' : ''}${p.hasHypixel ? ', модели Hypixel' : ''}`);
    } catch (err) { console.warn(`[паки] не удалось открыть ${e}: ${err.message}`); }
  }
  packs.byId.clear();
  vanillaCache.clear();
  packs.loadedAt = Date.now();
  return packs.list.map(p => ({ name: p.name, description: typeof p.meta.description === 'string' ? p.meta.description : '', cit: p.cit.length, components: p.components.size, firmament: p.hasFirm, hypixel: p.hasHypixel, public: isPublicPack(p) }));
}

// itemModel — значение ItemModel из базы NEU, напр. "hypixel_skyblock:item/uncategorized/hyperion"
// scope: 'all' — все паки (владелец), 'public' — только разрешённые для всех (PACKS_PUBLIC)
// opts.vanilla(name) — ванильная текстура для слоя модели, которого нет в паке («item/diamond» под блёстками);
// opts.color — цвет крашеной кожи. Если ванильного слоя не нашлось, его имя попадает в result.needs (или
// в packTexture.lastNeeds при null): icons.js скачает текстуру и спросит ещё раз (forgetPackTexture).
export function packTexture(id, itemModel, scope = 'all', opts = {}) {
  const key = `${scope}|${id}`;
  if (packs.byId.has(key)) return packs.byId.get(key);
  let found = null;
  const needs = new Set();
  const o = { ...opts, needs };
  const low = id.toLowerCase().replace(/[;:]/g, '_');
  // Пустая картинка (все пиксели прозрачные) — не текстура: ищем дальше, в следующем паке
  const usable = b => { const f = b && firstFrame(b); const png = f && pngOf(f); return png && !isEmptyPng(png) ? f : null; };
  for (const p of packsFor(scope)) {
    let buf = null;
    const compRef = p.components?.get(id);
    if (compRef) buf = usable(textureFromModel(p, compRef, o));
    if (!buf && p.hasFirm) buf = usable(textureFromModel(p, `firmskyblock:item/${low}`, o)) || usable(itemDefTexture(p, 'firmskyblock', low, o));
    if (!buf && p.cit.length) {
      const rule = p.cit.find(r => r.match(id));
      if (rule) buf = usable(citTexture(p, rule));
    }
    if (!buf && p.hasHypixel && itemModel?.startsWith('hypixel_skyblock:')) {
      const name = itemModel.split(':')[1];
      buf = usable(itemDefTexture(p, 'hypixel_skyblock', name, o)) || usable(textureFromModel(p, itemModel, o));
    }
    if (buf) { found = { pack: p.name, buf }; break; }
  }
  packTexture.lastNeeds = [...needs];
  if (needs.size) { if (found) found.needs = [...needs]; else return null; } // не кэшируем: после скачивания слоя спросим снова
  packs.byId.set(key, found);
  return found;
}
export const forgetPackTexture = (id, scope = 'all') => packs.byId.delete(`${scope}|${id}`);

// ---------- Ванильные текстуры (иконки меню, статов) без интернета ----------
// Сначала из ресурс-паков (тогда иконки в стиле пака), потом из установленного у пользователя Minecraft (client.jar).
const VANILLA_PATHS = name => [`assets/minecraft/textures/item/${name}.png`, `assets/minecraft/textures/block/${name}.png`, `assets/minecraft/textures/block/${name}_side.png`];

function readVanilla(src, name) {
  for (const p of VANILLA_PATHS(name)) {
    const buf = src.read(p);
    if (buf) return firstFrame(buf);
  }
  return null;
}

// Кэш: иконки меню запрашиваются на каждой странице, а чтение из zip и разбор PNG — работа процессора на ПК
const vanillaCache = new Map();
export function packVanillaTexture(name, scope = 'all') {
  const key = `${scope}|${name}`;
  if (vanillaCache.has(key)) return vanillaCache.get(key);
  let found = null;
  for (const p of packsFor(scope)) {
    found = readVanilla(p, name);
    if (found) break;
  }
  if (vanillaCache.size > 4000) vanillaCache.clear();
  vanillaCache.set(key, found);
  return found;
}

// Папка .minecraft: MINECRAFT_DIR из .env, иначе стандартные места Windows / macOS / Linux
export function minecraftDirs(env = process.env, home = process.env.HOME || process.env.USERPROFILE || '') {
  const out = [];
  if (env.MINECRAFT_DIR) out.push(env.MINECRAFT_DIR);
  if (env.APPDATA) out.push(path.join(env.APPDATA, '.minecraft'));
  if (home) out.push(path.join(home, 'Library', 'Application Support', 'minecraft'), path.join(home, '.minecraft'));
  return out;
}

// Самый свежий client.jar из versions/<версия>/<версия>.jar (версии 1.13+ — там нужные пути item/ и block/)
export function findClientJar(dirs = minecraftDirs()) {
  let best = null;
  for (const d of dirs) {
    const vdir = path.join(d, 'versions');
    let names = [];
    try { names = fs.readdirSync(vdir); } catch { continue; }
    for (const v of names) {
      const jar = path.join(vdir, v, `${v}.jar`);
      try {
        const st = fs.statSync(jar);
        if (st.size > 5e6 && (!best || st.mtimeMs > best.mtime)) best = { file: jar, mtime: st.mtimeMs };
      } catch { /* нет jar у этой версии */ }
    }
  }
  return best?.file || null;
}

let clientJar; // undefined — ещё не искали, null — не нашли
export function clientJarTexture(name) {
  if (clientJar === undefined) {
    clientJar = null;
    const file = findClientJar();
    if (file) {
      try { clientJar = new PackSource(file); console.log(`[текстуры] ванильные иконки из ${file}`); }
      catch (e) { console.warn(`[текстуры] не удалось открыть ${file}: ${e.message}`); }
    }
  }
  return clientJar ? readVanilla(clientJar, name) : null;
}
