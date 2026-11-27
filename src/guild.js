// Гильдия игрока Hypixel: один запрос /guild раз в час на игрока. Гильдия меняется редко,
// а лимит ключа нужен профилям. Ошибка запроса не мешает профилю: гильдию просто не покажем.
// Ответы хранятся на диске (data/guild-cache.json): перезапуск сайта не тратит запросы заново.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { getGuild } from './hypixel.js';

const TTL = 3600_000, RETRY = 10 * 60_000, MAX = 3000;

// Опыт до следующего уровня гильдии (как в игре): первые 15 уровней по таблице, дальше по 3 млн
const EXP_NEEDED = [100e3, 150e3, 250e3, 500e3, 750e3, 1e6, 1.25e6, 1.5e6, 2e6, 2.5e6, 2.5e6, 2.5e6, 2.5e6, 2.5e6, 3e6];
export function guildLevel(exp) {
  let left = Math.max(0, Number(exp) || 0), level = 0;
  for (let i = 0; level < 1000; i++) {
    const need = EXP_NEEDED[Math.min(i, EXP_NEEDED.length - 1)];
    if (left < need) break;
    left -= need; level++;
  }
  return level;
}

const RANK = { GUILDMASTER: 'Guild Master' };
/** Только то, что показывает сайт: без списка участников и их uuid */
export function parseGuild(g, uuid) {
  if (!g?.name) return null;
  const id = String(uuid || '').replace(/-/g, '').toLowerCase();
  const me = (g.members || []).find(x => String(x.uuid || '').replace(/-/g, '').toLowerCase() === id);
  return {
    name: String(g.name),
    tag: g.tag ? String(g.tag) : null,
    tagColor: g.tagColor ? String(g.tagColor) : null,
    rank: me?.rank ? RANK[me.rank] || String(me.rank) : null,
    joined: Number(me?.joined) || null,
    members: (g.members || []).length,
    level: guildLevel(g.exp),
  };
}

export function createGuilds({ fetcher = getGuild, now = () => Date.now(), file = null } = {}) {
  const cache = new Map(); // uuid → { guild, at, ok, promise }
  if (file) {
    try {
      const at = now();
      for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) if (v?.at && at - v.at < TTL * 24) cache.set(k, { guild: v.guild || null, at: v.at, ok: true });
    } catch { /* кэша ещё нет */ }
  }
  let saveTimer = null;
  function save() {
    if (!file || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const out = {};
      for (const [k, v] of [...cache].filter(([, v]) => v.ok).slice(-MAX)) out[k] = { guild: v.guild, at: v.at };
      fs.promises.mkdir(path.dirname(file), { recursive: true })
        .then(() => fs.promises.writeFile(`${file}.tmp`, JSON.stringify(out)))
        .then(() => fs.promises.rename(`${file}.tmp`, file))
        .catch(() => { /* не записали — спросим ещё раз после перезапуска */ });
    }, 5000);
    saveTimer.unref?.();
  }

  /**
   * Гильдия игрока или null. allowFetch: false — только из кэша (лимит ключа на исходе),
   * тогда отдаём и устаревшую запись: гильдия меняется редко.
   */
  async function guildFor(uuid, { allowFetch = true } = {}) {
    const id = String(uuid || '').replace(/-/g, '').toLowerCase();
    if (!id) return null;
    let c = cache.get(id);
    if (c?.promise) return c.promise;
    if (c && now() - c.at < (c.ok ? TTL : RETRY)) return c.guild;
    if (!allowFetch) return c?.guild ?? null;
    c = c || { guild: null, at: 0, ok: false };
    cache.delete(id); cache.set(id, c); // свежие — в конец: при записи на диск отрезаются самые старые
    while (cache.size > MAX) cache.delete(cache.keys().next().value);
    c.promise = (async () => {
      try {
        const r = await fetcher(id);
        c.guild = parseGuild(r?.guild, id);
        c.ok = true;
      } catch { c.ok = false; /* без гильдии; прошлый ответ остаётся */ }
      c.at = now();
      c.promise = null;
      if (c.ok) save();
      return c.guild;
    })();
    return c.promise;
  }

  return { guildFor, _cache: cache };
}

const shared = createGuilds({ file: process.env.NODE_TEST_CONTEXT ? null : path.join(config.dataDir, 'guild-cache.json') });
export const guildFor = shared.guildFor;
