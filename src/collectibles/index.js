// «Души и коллекции»: Fairy Souls по островам (с ручными отметками), Enigma Souls (сводка из Рифта),
// контакты Abiphone и песни арфы Melody. Чистые функции без сети: справочник в ./data.js.
import { tr, isEn } from '../../i18n/lang.js';
import { FAIRY_SNAPSHOT, ABIPHONE_SNAPSHOT, WARPS_SNAPSHOT, ISLANDS, islandName, HARP_SONGS, requirementRu } from './data.js';
import { tx } from '../../i18n/msg.js';

const DIRS = ['севернее', 'северо-восточнее', 'восточнее', 'юго-восточнее', 'южнее', 'юго-западнее', 'западнее', 'северо-западнее'];
const strip = s => String(s || '').replace(/§./g, '').trim();
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Направление от (x0,z0) к (x,z) в Minecraft: север — это −Z, восток — +X. */
export function direction(x0, z0, x, z) {
  const dx = x - x0, dz = z - z0;
  if (Math.hypot(dx, dz) < 4) return tr('прямо здесь');
  const ang = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360; // 0 = север, по часовой
  return tr(DIRS[Math.round(ang / 45) % 8]);
}

/** Ориентиры острова: варпы (+ точка появления в Hub) и NPC из базы NEU. */
function landmarks(island, { warps, items }) {
  const out = (warps || []).filter(w => w.mode === island).map(w => ({ kind: 'warp', name: tx`/warp ${w.warp}`, x: w.x, y: w.y, z: w.z }));
  if (items) {
    for (const it of items.values()) {
      if (it.island === island && it.x != null && it.z != null && /_NPC$/.test(it.id || '') && !/RIFT/.test(it.id)) {
        out.push({ kind: 'npc', name: strip(it.name).replace(/\s*\(NPC\)$/, ''), x: it.x, y: it.y, z: it.z });
      }
    }
  }
  return out;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Подсказка «как дойти» к точке: от ближайшего варпа, высота и ближайший NPC. */
export function placeHint(p, marks) {
  const warps = marks.filter(l => l.kind === 'warp');
  const npcs = marks.filter(l => l.kind === 'npc');
  const near = list => list.reduce((b, l) => (!b || dist(l, p) < dist(b, p) ? l : b), null);
  const w = near(warps), n = near(npcs);
  const parts = [];
  if (w) {
    const d = Math.round(dist(w, p));
    parts.push(d < 4 ? (isEn() ? tx`at ${w.name}` : tx`у ${w.name}`) : tx`от ${w.name} — ${d} бл. ${direction(w.x, w.z, p.x, p.z)}`);
    const dy = p.y - (w.y ?? p.y);
    if (dy >= 25) parts.push(tx`высоко, на ${dy} бл. выше варпа (y ${p.y}): крыша, дерево или скала`);
    else if (dy <= -15) parts.push(tx`внизу, на ${-dy} бл. ниже варпа (y ${p.y}): пещера, подвал или под водой`);
    else parts.push(tx`y ${p.y}`);
  } else parts.push(tx`y ${p.y}`);
  if (n && dist(n, p) <= 40) parts.push(tx`рядом NPC ${n.name} (${Math.round(dist(n, p))} бл.)`);
  else if (n && w && dist(w, p) > 100 && dist(n, p) < dist(w, p) / 2) {
    // Варп далеко (на Crimson Isle их мало) — ориентир по ближайшему NPC
    parts.push(tx`ориентир: NPC ${n.name}, от него ${Math.round(dist(n, p))} бл. ${direction(n.x, n.z, p.x, p.z)}`);
  }
  // куски склеиваем уже переведёнными: целую фразу словарь не узнает
  return parts.map(tr).join(', ');
}

/** Порядок обхода: жадно от главного варпа к ближайшей следующей душе. */
function route(list, start) {
  const left = [...list];
  const out = [];
  let cur = start || left[0];
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (Math.hypot(left[i].x - cur.x, left[i].y - cur.y, left[i].z - cur.z) < Math.hypot(left[bi].x - cur.x, left[bi].y - cur.y, left[bi].z - cur.z)) bi = i;
    cur = left.splice(bi, 1)[0];
    out.push(cur);
  }
  return out;
}

export const fairyId = (island, x, y, z) => tx`${island}:${x},${y},${z}`;

/**
 * Fairy Souls. Hypixel отдаёт только общее число собранных, какие именно — не известно.
 * Поэтому по каждой душе статус: 'found' (отмечена игроком), иначе 'unknown'. Если собраны все — все 'found'.
 * marks — { [fairyId]: true }.
 */
export function analyzeFairy(m, { marks = {}, constants, items } = {}) {
  const src = constants?.fairy_souls && Object.keys(constants.fairy_souls).length > 3 ? constants.fairy_souls : FAIRY_SNAPSHOT;
  const warps = constants?.islands?.island_warps || WARPS_SNAPSHOT;
  const max = Number(src['Max Souls']) || 0;
  const collected = m?.fairySouls?.collected || 0;
  const all = collected >= max && max > 0;
  const islands = [];
  for (const [island, coords] of Object.entries(src)) {
    if (!Array.isArray(coords)) continue;
    const lm = landmarks(island, { warps, items });
    const pts = coords.map(c => String(c).split(',').map(Number)).filter(a => a.length === 3 && a.every(Number.isFinite))
      .map(([x, y, z]) => ({ x, y, z }));
    const start = lm.find(l => l.kind === 'warp');
    const souls = route(pts, start).map((p, i) => {
      const id = fairyId(island, p.x, p.y, p.z);
      return { id, n: i + 1, island, x: p.x, y: p.y, z: p.z, hint: placeHint(p, lm), status: all || marks[id] ? 'found' : 'unknown', marked: !!marks[id] };
    });
    const found = souls.filter(s => s.status === 'found').length;
    islands.push({ id: island, name: ISLANDS[island]?.name || island, ru: '', tip: ISLANDS[island]?.tip || '', total: souls.length, found, souls });
  }
  const listed = islands.reduce((a, i) => a + i.total, 0);
  const marked = islands.reduce((a, i) => a + i.souls.filter(s => s.marked).length, 0);
  return {
    collected, max, left: Math.max(0, max - collected), listed, marked,
    unmarkedFound: all ? 0 : Math.max(0, collected - marked), // собрано, но не отмечено, где именно
    unspent: m?.fairySouls?.unspent || 0, exchanges: m?.fairySouls?.exchanges || 0,
    islands,
  };
}

// Ключи Hypixel в active_contacts, которые не совпадают с именем контакта в справочнике NEU
// (сверено со списком BetterPV). null — контакт известен, но в справочнике его нет: уходит в «прочие».
export const ABIPHONE_API_ALIASES = {
  pet_sitter: 'Kat', arrow_forger: 'Jax', forge_foreman: 'Fred', plumber: 'Plumber Joe',
  trevor_the_trapper: 'Trevor', queen: 'Queen Nyx', jake_lab: 'Jake', kuudra_gatekeeper: 'Crag',
  shady_bartender: null,
};

/** Ключ контакта из API → имя контакта в справочнике (или null). Один ключ — не больше одного контакта. */
export function abiphoneResolver(src) {
  const index = new Map();
  for (const [name, c] of Object.entries(src)) {
    for (const k of [name, (c.id || '').replace(/_NPC$/, ''), ...(c.callNames || [])].map(norm).filter(Boolean)) {
      if (!index.has(k)) index.set(k, name);
    }
  }
  return raw => {
    const k = String(raw || '').toLowerCase();
    if (Object.hasOwn(ABIPHONE_API_ALIASES, k)) return src[ABIPHONE_API_ALIASES[k]] ? ABIPHONE_API_ALIASES[k] : null;
    if (index.has(norm(k))) return index.get(norm(k));
    // «pesthunter_phillip» → Phillip: хвост ключа по границе «_», а не по буквам (иначе plumber → Lumber Merchant)
    const parts = k.split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      const tail = parts.slice(i).join('');
      if (tail.length > 2 && index.has(tail)) return index.get(tail);
    }
    return null;
  };
}

/** Abiphone: какие контакты уже в телефоне, а каких нет — с условием и местом. */
export function analyzeAbiphone(m, { constants, warps, owned, items } = {}) {
  const src = constants?.abiphone && Object.keys(constants.abiphone).length > 20 ? constants.abiphone : ABIPHONE_SNAPSHOT;
  const wl = constants?.islands?.island_warps || warps || WARPS_SNAPSHOT;
  const data = m?.abiphone || null;
  const resolve = abiphoneResolver(src);
  const toNames = keys => new Set((keys || []).map(resolve).filter(Boolean));
  const inPhoneSet = toNames(data?.active);
  const talkedSet = toNames(data?.known);
  const contacts = Object.entries(src).map(([name, c]) => {
    const inPhone = inPhoneSet.has(name);
    const talked = talkedSet.has(name);
    const p = c.x != null ? { x: c.x, y: c.y, z: c.z } : null;
    return {
      name, id: c.id || null, island: c.island || null, islandName: c.island ? islandName(c.island) : null,
      pos: p, where: p && c.island ? placeHint(p, landmarks(c.island, { warps: wl, items }).filter(l => l.kind === 'warp' || dist(l, p) > 3)) : null,
      requirement: requirementRu(c.requirement), free: (c.requirement || []).some(r => /No Requirement/i.test(strip(r))),
      status: inPhone ? 'have' : 'missing', talked,
    };
  });
  const order = c => (c.status === 'have' ? 2 : c.free ? 0 : 1);
  contacts.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  return {
    available: !!data,
    have: contacts.filter(c => c.status === 'have').length,
    total: contacts.length,
    contacts,
    other: [...new Set((data?.active || []).filter(k => !resolve(k)).map(norm))], // контакты из API, которых нет в справочнике
    phone: phoneInfo(owned, items),
  };
}

// Телефон игрока: любой предмет ABIPHONE_* среди его вещей; вместимость — из лора NEU «Maximum Contacts: N»
function phoneInfo(owned, items) {
  if (!owned) return null;
  const ids = [...(owned.keys?.() || owned)].filter(id => /^ABIPHONE_/.test(id));
  let best = null;
  for (const id of ids) {
    const line = (items?.get(id)?.lore || []).map(strip).find(l => /Maximum Contacts:/i.test(l));
    const max = line ? Number(line.replace(/\D+/g, '')) || null : null;
    if (!best || (max || 0) > (best.max || 0)) best = { id, name: strip(items?.get(id)?.name) || id, max };
  }
  return best;
}

/** Арфа Melody: какие песни пройдены, сколько Intelligence получено и что дальше. */
export function analyzeHarp(m, { has } = {}) {
  const h = m?.harp || null;
  const got = h?.songs || {};
  const known = new Set(HARP_SONGS.map(s => s.id));
  const pachKey = Object.keys(got).find(k => /pachel/i.test(k)); // id Pachelbel в API не сверен: ловим любое написание
  const extra = Object.keys(got).filter(id => !known.has(id) && id !== 'through_the_campfire' && id !== pachKey)
    .map(id => ({ id, name: id.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' '), tier: '?', int: 0, unknown: true }));
  const songs = [...HARP_SONGS, ...extra].map(s => {
    const r = got[s.id] || (s.id === 'fire_and_flames' ? got.through_the_campfire : null) || (s.id === 'pachelbel' && pachKey ? got[pachKey] : null) || { best: 0, completions: 0, perfect: 0 };
    const done = r.completions > 0 || r.best >= 1;
    return { ...s, best: Math.round(Math.min(1, r.best) * 100), completions: r.completions, perfect: r.perfect, done, perfectDone: r.perfect > 0 };
  });
  const main = songs.filter(s => !s.extra && !s.unknown);
  const intGot = main.filter(s => s.done).reduce((a, s) => a + s.int, 0);
  const intMax = main.reduce((a, s) => a + s.int, 0);
  const hair = !!h?.claimedHair || !!has?.('MELODY_HAIR');
  return {
    available: !!h,
    songs, done: main.filter(s => s.done).length, total: main.length, intGot, intMax,
    next: main.find(s => !s.done) || null,
    hair, selected: h?.selected || null,
  };
}
