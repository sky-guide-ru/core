// Фикстуры: ответ Bazaar в формате Hypixel, мини-база NEU, профиль OwnerCat (Zucchini)
export function bazaarJson() {
  const p = (id, buy, sell, buyWeek, sellWeek, extra = {}) => ({
    product_id: id,
    sell_summary: sell ? [{ amount: 1000, pricePerUnit: sell, orders: 5 }] : [],
    buy_summary: buy ? [{ amount: 1000, pricePerUnit: buy, orders: 5 }] : [],
    quick_status: { productId: id, sellPrice: sell, buyPrice: buy, sellVolume: 500000, buyVolume: 400000, sellMovingWeek: sellWeek, buyMovingWeek: buyWeek, sellOrders: 40, buyOrders: 60, ...extra },
  });
  return {
    success: true, lastUpdated: 1_790_000_000_000,
    products: {
      SUGAR_CANE: p('SUGAR_CANE', 4.2, 3.9, 60_000_000, 70_000_000),
      ENCHANTED_SUGAR: p('ENCHANTED_SUGAR', 700, 640, 3_000_000, 3_500_000),
      ENCHANTED_SUGAR_CANE: p('ENCHANTED_SUGAR_CANE', 120_000, 112_000, 60_000, 70_000),
      NETHER_STALK: p('NETHER_STALK', 4, 3.6, 80_000_000, 90_000_000),
      ENCHANTED_NETHER_STALK: p('ENCHANTED_NETHER_STALK', 650, 600, 5_000_000, 5_500_000),
      ENCHANTED_MITHRIL: p('ENCHANTED_MITHRIL', 1500, 1400, 4_000_000, 4_000_000),
      REFINED_MITHRIL: p('REFINED_MITHRIL', 330_000, 300_000, 40_000, 40_000),
      // ходовой товар с хорошим спредом — флип
      ENCHANTED_DIAMOND: p('ENCHANTED_DIAMOND', 1500, 1350, 4_000_000, 4_200_000),
      // манипуляция: цена в 5 раз выше обычной
      MANIPULATED_ITEM: p('MANIPULATED_ITEM', 50_000, 20_000, 300_000, 300_000),
      // дешёвый на Bazaar, NPC платит больше
      CHEAP_NPC: p('CHEAP_NPC', 2, 1, 5_000_000, 5_000_000),
      'INK_SACK:3': p('INK_SACK:3', 3, 2.5, 30_000_000, 30_000_000),
    },
  };
}

const item = (id, name, extra = {}) => ({ id, name, rawName: name, mcId: 'minecraft:paper', lore: [], rarity: 'COMMON', recipe: null, recipes: [], crafttext: '', ...extra });
const grid = (ing, n, slots = ['A2', 'B1', 'B2', 'B3', 'C2']) => Object.fromEntries(slots.map(s => [s, `${ing}:${n}`]));

export function neuItems() {
  const list = [
    item('SUGAR_CANE', 'Sugar Cane'),
    item('ENCHANTED_SUGAR', 'Enchanted Sugar', { recipe: grid('SUGAR_CANE', 32), crafttext: 'Requires: Sugar Cane IV' }),
    item('ENCHANTED_SUGAR_CANE', 'Enchanted Sugar Cane', { recipe: grid('ENCHANTED_SUGAR', 32), crafttext: 'Requires: Sugar Cane IX' }),
    item('NETHER_STALK', 'Nether Wart'),
    item('ENCHANTED_NETHER_STALK', 'Enchanted Nether Wart', { recipe: grid('NETHER_STALK', 32) }),
    item('ENCHANTED_MITHRIL', 'Enchanted Mithril'),
    item('REFINED_MITHRIL', 'Refined Mithril', { recipes: [{ type: 'forge', inputs: ['ENCHANTED_MITHRIL:160'], count: 1, overrideOutputId: 'REFINED_MITHRIL', duration: 21600 }], crafttext: 'Requires: HotM 2' }),
    item('ENCHANTED_BOOK_TEST', 'Book'),
    item('ULTIMATE_LEGION;1', 'Legion I', { mcId: 'minecraft:enchanted_book' }),
    item('INK_SACK-3', 'Cocoa Beans'),
    item('ENCHANTED_COCOA', 'Enchanted Cocoa Bean', { recipe: grid('INK_SACK-3', 32) }),
  ];
  return new Map(list.map(i => [i.id, i]));
}

/** Почасовая история: 8 дней ровных цен */
export function flatHistory(buy, sell, now, hours = 8 * 24) {
  const out = [];
  const h0 = Math.floor(now / 3600_000) * 3600_000;
  for (let i = hours; i >= 1; i--) out.push([h0 - i * 3600_000, buy, sell]);
  return out;
}

export function memberOwnerCat() {
  const s = level => ({ level });
  return {
    uuid: '0123456789abcdef0123456789abcdef', profileName: 'Zucchini', sbLevel: 273.3, purse: 0, bank: 75_800_000,
    skills: { farming: s(60), mining: s(60), enchanting: s(60), taming: s(50), combat: s(47), fishing: s(36), foraging: s(24) },
    slayers: { zombie: s(8), spider: s(7), wolf: s(7), enderman: s(7), blaze: s(0), vampire: s(0) },
    dungeons: { catacombs: s(27), floors: { 7: 8 }, masterFloors: {} },
    mining: { hotm: s(7) },
    crimson: { faction: 'mage', kuudra: { basic: 3, hot: 1, burning: 0, fiery: 0, infernal: 0 } },
    garden: { cropUpgrades: { wheat: 9, sugar_cane: 9 } },
    magicalPower: 1009,
    pets: [{ type: 'ELEPHANT', tier: 'LEGENDARY' }],
    inv: {
      inventory: [{ id: 'HYPERION' }, { id: 'THEORETICAL_HOE_CANE_3' }],
      armor: [{ id: 'FERMENTO_HELMET' }, { id: 'FERMENTO_CHESTPLATE' }, { id: 'FERMENTO_LEGGINGS' }, { id: 'FERMENTO_BOOTS' }],
      wardrobe: [[{ id: 'HOT_AURORA_CHESTPLATE' }]],
      backpacks: { 0: [{ id: 'DIVAN_DRILL' }] },
    },
  };
}

export function ctxFrom({ now = 1_790_000_000_000, withHistory = true } = {}) {
  const { parseBazaar } = globalThis.__mk;
  const bazaar = parseBazaar(bazaarJson());
  const history = {};
  if (withHistory) {
    for (const [id, p] of bazaar) history[id] = flatHistory(p.buy, p.sell, now);
    history.MANIPULATED_ITEM = flatHistory(10_000, 4_000, now);
  }
  return {
    bazaar, history, binHistory: {}, now,
    bin: new Map([['HYPERION', { price: 900_000_000, count: 12, second: 905_000_000 }], ['CHEAP_SWORD', { price: 1_000_000, count: 9, second: 3_000_000 }]]),
    npc: new Map([['CHEAP_NPC', 4], ['SUGAR_CANE', 4], ['NETHER_STALK', 4], ['ENCHANTED_SUGAR', 640]]),
    items: neuItems(), tax: 0.01125,
  };
}
