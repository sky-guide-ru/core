// Культуры конкурсов Jacob. В API Hypixel расписания нет, поэтому берём открытое расписание elitebot.dev
// (то же, что в игре в /calendar): один запрос на год SkyBlock (~5 суток), повтор не чаще раза в час, пока
// расписание года неполное. Не ответил — объявления просто выходят без культур.
import { getJson } from '../http.js';

export const CONTESTS_URL = 'https://api.elitebot.dev/contests/at/now';

const CROPS = ['Wheat', 'Carrot', 'Potato', 'Pumpkin', 'Melon', 'Mushroom', 'Cactus', 'Sugar Cane', 'Nether Wart', 'Cocoa Beans', 'Sunflower', 'Moonflower', 'Wild Rose'];
const CROP_BY_KEY = new Map(CROPS.map(c => [c.toLowerCase().replace(/[^a-z]/g, ''), c]));
// Названия, которые встречаются в ответах вместо игровых
for (const [k, v] of [['melonslice', 'Melon'], ['cocoa', 'Cocoa Beans'], ['cane', 'Sugar Cane'], ['netherstalk', 'Nether Wart'], ['inksack', 'Cocoa Beans'], ['mushroomcollection', 'Mushroom']]) CROP_BY_KEY.set(k, v);

/** «SUGAR_CANE», «Sugar Cane», «sugarcane» → «Sugar Cane»; незнакомое — как пришло. */
export function cropName(s) {
  const raw = String(s ?? '').trim();
  return CROP_BY_KEY.get(raw.toLowerCase().replace(/[^a-z]/g, '')) || raw;
}

/**
 * Ответ { year, complete, contests: { "<unix-секунды>": ["Wheat", ...] } } → Map(начало в мс → культуры).
 * Ключи в миллисекундах тоже понимает.
 */
export function parseContests(raw) {
  const out = new Map();
  const list = raw?.contests;
  if (!list || typeof list !== 'object') return out;
  for (const [k, v] of Object.entries(list)) {
    let t = Number(k);
    if (!Number.isFinite(t) || t <= 0 || !Array.isArray(v)) continue;
    if (t < 1e12) t *= 1000;
    const crops = v.map(cropName).filter(Boolean).slice(0, 3);
    if (crops.length) out.set(t, crops);
  }
  return out;
}

/**
 * @param {{ fetchJson?: (url: string) => Promise<any>, now?: () => number, url?: string }} o
 * @returns {{ refresh: () => Promise<boolean>, cropsAt: (start: number) => string[]|null }}
 */
export function createJacobCrops(o = {}) {
  const fetchJson = o.fetchJson || (url => getJson(url, { timeout: 15_000, retries: 1 }));
  const now = o.now || (() => Date.now());
  const url = o.url || CONTESTS_URL;
  let map = new Map(), complete = false, triedAt = 0;

  const cropsAt = start => map.get(start) || null;
  const lastStart = () => Math.max(0, ...map.keys());

  /** Обновить, если расписание неполное или кончается в ближайшие 2 часа. true — что-то новое пришло. */
  async function refresh() {
    const t = now();
    const stale = !complete || lastStart() < t + 2 * 3600_000;
    if (!stale || t - triedAt < 3600_000) return false;
    triedAt = t;
    try {
      const raw = await fetchJson(url);
      const next = parseContests(raw);
      if (!next.size) return false;
      map = next; complete = raw?.complete !== false;
      return true;
    } catch { return false; }
  }

  return { refresh, cropsAt };
}
