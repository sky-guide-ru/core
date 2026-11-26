// Ответы Hypixel на диске (data/hypixel-cache/*.json.gz): после перезапуска сайта (каждая выкладка — перезапуск)
// профили берутся отсюда, а не спрашиваются у Hypixel заново. Узнать «изменился ли профиль» дешевле, чем
// скачать его, у Hypixel нельзя: любой запрос про игрока тратит лимит так же, как сам профиль.
// Поэтому храним последний ответ и спрашиваем новый, только когда сохранённый старше срока.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const safe = k => String(k).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);

export function createDiskCache({ dir, maxFiles = 40, clock = () => Date.now() } = {}) {
  const file = k => path.join(dir, `${safe(k)}.json.gz`);
  let writing = Promise.resolve();

  function prune() {
    let list;
    try { list = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })); } catch { return; }
    if (list.length <= maxFiles) return;
    list.sort((a, b) => a.t - b.t);
    for (const x of list.slice(0, list.length - maxFiles)) { try { fs.unlinkSync(path.join(dir, x.f)); } catch { /* не страшно */ } }
  }

  return {
    /** { data, at } или null, если нет или старше maxAgeMs */
    get(key, maxAgeMs = Infinity) {
      if (!dir || !safe(key)) return null;
      try {
        const v = JSON.parse(zlib.gunzipSync(fs.readFileSync(file(key))).toString('utf8'));
        return v && v.at && clock() - v.at <= maxAgeMs ? v : null;
      } catch { return null; }
    },
    /** Записать в фоне (по очереди, без блокировки цикла событий) */
    set(key, data, at = clock()) {
      if (!dir || !safe(key)) return writing;
      writing = writing.then(() => new Promise(resolve => {
        zlib.gzip(JSON.stringify({ at, data }), { level: 4 }, (err, buf) => {
          if (err) return resolve();
          fs.promises.mkdir(dir, { recursive: true })
            .then(() => fs.promises.writeFile(`${file(key)}.tmp`, buf))
            .then(() => fs.promises.rename(`${file(key)}.tmp`, file(key)))
            .then(prune).catch(() => {}).finally(resolve);
        });
      }));
      return writing;
    },
  };
}
