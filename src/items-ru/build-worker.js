// Сборка русской базы предметов в отдельном потоке (worker_threads): на ~9000 предметах NEU она занимает 1,5–2 с
// чистого CPU, и раньше всё это время сервер не отвечал ни на один запрос — при каждом запуске и раз в 6 часов.
// Поток получает сырые предметы NEU, собирает базу и отдаёт её основному вместе со строками для английской версии.
import { parentPort, workerData } from 'node:worker_threads';
import { buildDatabase } from './lib/build-db.js';
import { collectMessages, allPairs } from '../../i18n/msg.js';

const { items, constants, vanillaRu, curated } = workerData;
const t0 = Date.now();
const { result: db, messages } = collectMessages(() => buildDatabase(items, { constants, vanillaRu, curated }));
parentPort.postMessage({ items: db.items, lore: db.lore, messages: [...messages], pairs: allPairs(), ms: Date.now() - t0 });
