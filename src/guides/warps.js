// Телепорты /warp и Travel Scrolls: что нужно игроку, чтобы команда сработала.
//
// Правила (вики, страница Travel Scrolls: hypixelskyblock.minecraft.wiki и fandom, сверено 28.11.2026):
// - /warp и меню Fast Travel доступны всем, ранг для самой команды не нужен.
// - Hub и Private Island открыты всегда; остальные места открываются Travel Scroll (свиток съедается, варп — навсегда).
// - RARE-свитки может использовать любой игрок, EPIC — только MVP+ и выше. VIP, VIP+ и MVP для телепортов ничего не меняют.
// - Bingo: все свитки открыты независимо от ранга.
// Hypixel API не сообщает, какие свитки открыты, поэтому отметки ставит сам игрок (сайт хранит их у себя).
//
// warpTable(constants) → { [warp]: { warp, place, rarity: 'free'|'RARE'|'EPIC', scroll?, how?, via?: { warp, dist }, route? } }
// Сайт получает таблицу вместе с общим словарём (GET /api/refs/lexicon → warps) и сам решает, как показать /warp.
import { WARPS_SNAPSHOT } from '../collectibles/data.js';

// Свитки: warp → [место, редкость, откуда свиток]. Источники — таблица на странице Travel Scrolls.
const SCROLLS = {
  museum: ['Museum', 'RARE', 'Крафт, рецепт открывает Museum'],
  wizard: ['Wizard Tower', 'RARE', 'Grumblefoot, 11 111 coins'],
  rift: ['The Rift', 'RARE', 'Roger в The Rift, 5 000 Motes'],
  barn: ['The Barn', 'RARE', 'Крафт, коллекция Potato VI'],
  desert: ['Mushroom Desert', 'RARE', 'Крафт, коллекция Cocoa Beans V'],
  trapper: ['Trapper\'s Den', 'RARE', 'Talbot, 100 Pelts'],
  park: ['The Park', 'RARE', 'Награда за квест Charlie'],
  murkwater: ['Murkwater Loch', 'RARE', 'Крафт, коллекция Mangrove Log I'],
  gold: ['Gold Mine', 'RARE', 'Крафт, коллекция Coal VI'],
  deep: ['Deep Caverns', 'RARE', 'Крафт, коллекция Redstone VII'],
  mines: ['Dwarven Mines', 'RARE', 'Награда Commission Milestone IV'],
  forge: ['The Forge', 'RARE', 'Куётся в The Forge'],
  crystals: ['Crystal Nucleus', 'RARE', 'Награда Commission Milestone VI'],
  spider: ['Spider\'s Den', 'RARE', 'Крафт, коллекция Gravel VIII'],
  end: ['The End', 'RARE', 'Крафт, коллекция End Stone VIII'],
  nether: ['Crimson Isle', 'RARE', 'Крафт, коллекция Glowstone Dust IV'],
  basecamp: ['Dwarven Base Camp', 'RARE', 'Куётся в The Forge'],
  bayou: ['Backwater Bayou', 'RARE', 'Junker Joel, нужен Fishing V'],
  castle: ['Hub Castle', 'EPIC', 'Lonely Philosopher, 150 000 coins'],
  da: ['Dark Auction', 'EPIC', 'Sirius на Dark Auction, по лучшей ставке'],
  crypts: ['Hub Crypts', 'EPIC', 'Крафт, нужен Zombie Slayer IV'],
  jungle: ['Jungle Island', 'EPIC', 'Joyful Viking, 70 000 coins'],
  howl: ['Howling Cave', 'EPIC', 'Редкий дроп с Soul of the Alpha и Howling Spirit'],
  nest: ['Top of Nest', 'EPIC', 'Редкий дроп с Broodmother и Spider Jockey'],
  arachne: ['Arachne\'s Sanctuary', 'EPIC', 'Spider Tamer, 5 000 Spider Essence'],
  drag: ['Dragon\'s Nest', 'EPIC', 'Дроп Unstable Dragon, нужно 250+ Dragon Weight'],
  void: ['Void Sepulture', 'EPIC', 'Крафт, нужен Enderman Slayer IV'],
  smold: ['Smoldering Tomb', 'EPIC', 'Крафт, нужен Blaze Slayer IV'],
  kuudra: ['Forgotten Skull', 'EPIC', 'Дроп с Kuudra'],
  scarleton: ['Scarleton', 'EPIC', null],
  dragontail: ['Dragontail', 'EPIC', null],
};

// Открыты без свитка: точка появления, свой остров, места, которые открываются первым визитом или по сезону
const FREE = {
  hub: 'Hub', home: 'Private Island', garden: 'Garden', dungeon_hub: 'Dungeon Hub', galatea: 'Galatea', winter: 'Jerry\'s Workshop',
};

// Главный варп острова: от него идут пешком, если до нужного места свитка нет
const ISLAND_BASE = {
  hub: 'hub', crimson_isle: 'nether', combat_3: 'end', combat_1: 'spider', foraging_1: 'park', farming_1: 'barn',
  mining_3: 'mines', foraging_2: 'galatea',
};

// Как попасть на остров без его свитка (только проверенные дороги)
const ROUTE = {
  nether: 'Лаунчпад в глубине Spider\'s Den ведёт на Crimson Isle.',
  deep: 'Из Gold Mine спустись вниз в Deep Caverns.',
  mines: 'Из Deep Caverns спустись на самое дно: там проход в Dwarven Mines.',
  crystals: 'Войди в Crystal Hollows из Dwarven Mines (нужен Crystal Hollows Pass) и иди к центру.',
  rift: 'В The Rift ведёт портал в Wizard Tower в Hub.',
};

const SCARLETON_DRAGONTAIL = new Set(['scarleton', 'dragontail']);

export function warpTable(constants) {
  const list = constants?.islands?.island_warps || WARPS_SNAPSHOT;
  const pos = new Map(list.map(w => [w.warp, w]));
  const out = {};
  for (const [warp, place] of Object.entries(FREE)) out[warp] = { warp, place, rarity: 'free' };
  for (const [warp, [place, rarity, how]] of Object.entries(SCROLLS)) {
    const e = { warp, place, rarity, scroll: `Travel Scroll to ${place}` };
    if (how) e.how = how;
    const p = pos.get(warp);
    const base = p && ISLAND_BASE[p.mode];
    if (base && base !== warp) {
      const b = base === 'hub' ? { x: -3, z: -70 } : pos.get(base);
      e.via = { warp: base };
      if (b) e.via.dist = Math.round(Math.hypot(p.x - b.x, p.z - b.z) / 5) * 5;
    } else if (SCARLETON_DRAGONTAIL.has(warp)) e.via = { warp: 'nether' };
    if (ROUTE[warp]) e.route = ROUTE[warp];
    out[warp] = e;
  }
  // Синонимы команд (/warp crypt = /warp crypts) ведут на ту же запись
  for (const w of list) for (const a of w.aliases || []) if (out[w.warp] && !out[a]) out[a] = out[w.warp];
  return out;
}

// Ранги, которым доступны EPIC-свитки: MVP+, MVP++ и служебные ранги Hypixel
const MVP_PLUS = new Set(['MVP_PLUS', 'MVP_PLUS_PLUS', 'ADMIN', 'GAME_MASTER', 'YOUTUBER', 'MODERATOR', 'HELPER', 'STAFF', 'OWNER']);
export const hasMvpPlus = rankId => (rankId ? MVP_PLUS.has(rankId) : null);

/**
 * Можно ли игроку телепортироваться: 'ok' | 'scroll' (свиток не отмечен) | 'rank' (нужен MVP+) | 'plain' (неизвестный варп).
 * rankId — member.rank.id или null (ранг неизвестен: про MVP+ не судим); marks — { warp: true } отмеченные свитки.
 */
export function warpStatus(entry, { rankId = null, marks = {}, bingo = false } = {}) {
  if (!entry) return 'plain';
  if (entry.rarity === 'free' || bingo) return 'ok';
  if (entry.rarity === 'EPIC' && hasMvpPlus(rankId) === false) return 'rank';
  return marks[entry.warp] ? 'ok' : 'scroll';
}
