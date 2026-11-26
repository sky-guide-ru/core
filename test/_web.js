// Где лежат исходники сайта (репо web) для сверочных тестов: WEB_DIR или соседняя папка ../web.
// Нет папки — сверка пропускается (в GitHub Actions web выкачивается рядом).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(process.env.WEB_DIR || path.join(here, '..', '..', 'web'));
export const WEB_SRC = path.join(WEB_DIR, 'src');
export const hasWeb = fs.existsSync(path.join(WEB_SRC, 'App.jsx'));
export const skipNoWeb = hasWeb ? false : 'нет исходников сайта (WEB_DIR)';
