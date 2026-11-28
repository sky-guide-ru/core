// Что показать из ответа /player (кроме ранга): уровень сети, Achievement Points, давность на сервере, ссылки
// и SkyBlock-достижения. Ответ уже приходит раз в 6 часов ради ранга (rank.js) — отдельных запросов не нужно.

/** Network Level из networkExp (формула Hypixel: (√(2·exp + 30625) / 50) − 2.5) */
export const networkLevel = exp => (exp > 0 ? Math.sqrt(2 * exp + 30625) / 50 - 2.5 : 1);

// SkyBlock-достижения с понятным счётчиком (по всем профилям игрока). label — подпись на сайте, icon — предмет для иконки
export const SB_ACHIEVEMENTS = [
  { key: 'skyblock_crystal_nucleus', label: 'Crystal Nucleus: заходов', icon: 'JADE_CRYSTAL' },
  { key: 'skyblock_treasure_hunter', label: 'Рыбалка: сокровищ', icon: 'FISHING_ROD' },
  { key: 'skyblock_unique_gifts', label: 'Подарки: разным игрокам', icon: 'WHITE_GIFT' },
];

// Ссылки, которые игрок сам указал в профиле Hypixel. Discord — только имя, остальное — адрес
const SOCIAL = ['DISCORD', 'YOUTUBE', 'TWITCH', 'TWITTER', 'TIKTOK', 'INSTAGRAM'];
const safeUrl = v => (/^https:\/\/[^\s"'<>]+$/i.test(String(v || '')) ? String(v) : null);

/** player (поле player из /player) → { networkLevel, achievementPoints, karma, firstLogin, socials, achievements } */
export function hypixelInfoOf(player) {
  if (!player || typeof player !== 'object') return null;
  const links = player.socialMedia?.links || {};
  const socials = SOCIAL.filter(k => links[k]).map(k => (k === 'DISCORD'
    ? { id: k, name: String(links[k]).slice(0, 40) }
    : { id: k, url: safeUrl(links[k]) })).filter(s => s.name || s.url);
  const ach = player.achievements || {};
  return {
    networkLevel: Math.floor(networkLevel(Number(player.networkExp) || 0) * 100) / 100,
    achievementPoints: Number(player.achievementPoints) || 0,
    karma: Number(player.karma) || 0,
    firstLogin: Number(player.firstLogin) || null,
    socials,
    achievements: SB_ACHIEVEMENTS.filter(a => Number(ach[a.key]) > 0).map(a => ({ ...a, value: Number(ach[a.key]) })),
  };
}
