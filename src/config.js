import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Папка пакета core (его собственные данные). Рабочие папки сервера — от папки, где запущен процесс (api)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cwd = process.cwd();

export const config = {
  root,
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(cwd, 'data'),
  // Ресурс-паки и собранный сайт (web/dist): в Docker их подключает deploy, при разработке — соседние папки
  packsDir: process.env.PACKS_DIR ? path.resolve(process.env.PACKS_DIR) : path.join(cwd, 'packs'),
  webDist: process.env.WEB_DIST ? path.resolve(process.env.WEB_DIST) : path.resolve(cwd, '..', 'web', 'dist'),
  apiKey: (process.env.HYPIXEL_API_KEY || '').trim(),
  player: (process.env.PLAYER || 'Steve').trim(),
  profileName: (process.env.PROFILE || '').trim(),
  port: Number(process.env.PORT || 3000),
  profileRefresh: Math.max(30, Number(process.env.PROFILE_REFRESH || 60)) * 1000,
  bazaarRefresh: 60_000,
  // Как часто брать цены Bazaar для свечей «Рынка» (Hypixel обновляет их примерно раз в 20 с). Пересчёт советов — по-прежнему раз в минуту
  bazaarTick: Math.max(10, Number(process.env.BAZAAR_TICK || 20)) * 1000,
  auctionRefresh: 180_000,
  neuRefresh: 6 * 3600_000,
  // Папка с готовыми рендерами иконок (ID.png). По умолчанию db/icons рядом с проектом
  iconsDir: process.env.ICONS_DIR || path.join(cwd, 'db', 'icons'),
  userAgent: 'skyblock-tracker/0.1 (personal use)',
};
