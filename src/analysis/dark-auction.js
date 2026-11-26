// Что бывает на Dark Auction (вики «Dark Auction», проверено 26.11.2026). API у Dark Auction нет: ни текущих лотов, ни цен
// сайт не получит, поэтому здесь только список предметов и минимальная ставка — для способа «Как получить».
//   darker: true — только при мэре Scorpius (перк Darker Auctions: 8 лотов вместо 5).
// Каждый лот выпадает случайно: в один аукцион выходит 5 предметов из списка.

const M = 1_000_000;
const ITEMS = {
  ENDER_ARTIFACT: { minBid: 20 * M }, WITHER_ARTIFACT: { minBid: 10 * M }, NETHER_ARTIFACT: { minBid: 10 * M },
  MIDAS_SWORD: { minBid: 100_000 }, MAGIC_8_BALL: { minBid: 20 * M }, SIRIUS_PERSONAL_PHONE_NUMBER: { minBid: M },
  HOCUS_POCUS_CIPHER: { minBid: 10 * M }, HUB_DA_TRAVEL_SCROLL: { minBid: M }, ECCENTRIC_PAINTING_BUNDLE: { minBid: 20 * M },
  DYE_DARK_PURPLE: { minBid: 20 * M, rare: true }, FLOWER_GENERATOR_1: { minBid: 2.5 * M },
  'TURTLE;3': { minBid: 500_000 }, 'PARROT;3': { minBid: M }, 'JELLYFISH;3': { minBid: 10 * M },
  'TURTLE;4': { minBid: M }, 'PARROT;4': { minBid: M }, 'JELLYFISH;4': { minBid: 10 * M },
  'EXECUTE;6': { minBid: 500_000 }, 'GIANT_KILLER;6': { minBid: 500_000 }, 'POWER;6': { minBid: 500_000 },
  'PROSECUTE;6': { minBid: 500_000 }, 'PROTECTION;6': { minBid: 500_000 }, 'VICIOUS;5': { minBid: 10 * M },
  // Darker Auctions (мэр Scorpius)
  MIDAS_STAFF: { minBid: 100_000, darker: true }, HEGEMONY_ARTIFACT: { minBid: 100 * M, darker: true }, PLASMA_NUCLEUS: { minBid: 20 * M, darker: true },
  ENCHANTED_BOOK_BUNDLE_VICIOUS: { minBid: 10 * M, darker: true }, ENCHANTED_BOOK_BUNDLE_BIG_BRAIN: { minBid: 10 * M, darker: true },
  'COUNTER_STRIKE;5': { minBid: 10 * M, darker: true }, 'GIANT_KILLER;7': { minBid: 10 * M, darker: true }, 'GROWTH;7': { minBid: 10 * M, darker: true },
  'POWER;7': { minBid: 10 * M, darker: true }, 'PROTECTION;7': { minBid: 10 * M, darker: true }, 'SHARPNESS;7': { minBid: 10 * M, darker: true },
};

/** Бывает ли предмет на Dark Auction: { minBid, darker, rare } или null. Принимает и Bazaar-ID книги (ENCHANTMENT_POWER_6). */
export function darkAuctionOf(id) {
  const s = String(id || '');
  const b = /^ENCHANTMENT_(.+)_(\d+)$/.exec(s);
  return ITEMS[b ? `${b[1]};${b[2]}` : s] || null;
}

export const DARK_AUCTION_IDS = Object.keys(ITEMS);
