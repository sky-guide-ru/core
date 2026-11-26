// Тип профиля SkyBlock (game_mode из API) и что в нём доступно.
// Ironman, Stranded и Bingo не могут пользоваться Bazaar, аукционом и обменом с игроками —
// советы «купи на аукционе» и флипы им не подходят, всё добывается и крафтится самому.
export const MODES = {
  normal: { label: 'Обычный', market: true },
  ironman: { label: 'Ironman', market: false, note: 'нет Bazaar, аукциона и обмена: всё добываешь и крафтишь сам, продаёшь только NPC' },
  island: { label: 'Stranded', market: false, note: 'ты на своём острове: нет Bazaar, аукциона и обмена, всё добываешь сам' },
  bingo: { label: 'Bingo', market: false, note: 'временный профиль Bingo: нет Bazaar, аукциона и обмена' },
};

/** @returns {{ id: string, label: string, market: boolean, note?: string }} */
export function profileMode(gameMode) {
  const id = MODES[gameMode] ? gameMode : 'normal';
  return { id, ...MODES[id] };
}

// Skills, у которых кап по умолчанию ниже настоящего максимума, и как его поднять
export const CAP_RAISE = {
  farming: { max: 60, how: 'у NPC Anita (рядом с Jacob) за медали Jacob\'s Farming Contest' },
  taming: { max: 60, how: 'сдавая питомцев новых типов в Pet Care (каждый тип +1 к капу)' },
};

// Платные ранги Hypixel из /player: что показать. На геймплей SkyBlock ранг почти не влияет
// (косметика, чат), а вот Booster Cookie влияет сильно — его учитываем отдельно.
export function rankOf(player) {
  if (!player) return null;
  if (player.rank && !['NORMAL', 'NONE'].includes(player.rank)) return { id: player.rank, label: { ADMIN: 'ADMIN', GAME_MASTER: 'GM', YOUTUBER: 'YOUTUBE', MODERATOR: 'MOD', HELPER: 'HELPER', STAFF: 'STAFF' }[player.rank] || player.rank };
  if (player.monthlyPackageRank === 'SUPERSTAR') return { id: 'MVP_PLUS_PLUS', label: 'MVP++' };
  const r = (player.newPackageRank && player.newPackageRank !== 'NONE' ? player.newPackageRank : null) || (player.packageRank && player.packageRank !== 'NONE' ? player.packageRank : null);
  const L = { VIP: 'VIP', VIP_PLUS: 'VIP+', MVP: 'MVP', MVP_PLUS: 'MVP+' };
  return r && L[r] ? { id: r, label: L[r] } : { id: 'NONE', label: 'без ранга' };
}
