// Боссы слееров для расчёта готовности: HP, урон в секунду, особые механики.
// Источник — вики hypixel-skyblock.fandom.com (страницы боссов, ?action=raw), сверено 25.11.2026.
// hp — сколько всего урона нужно нанести за бой (у Inferno Demonlord вместе с демонами Quazii и Typhoeus).
// dps — обычный урон босса в секунду (режется Defense), trueDps — true damage в секунду (режется True Defense),
// truePct — доля твоего максимального Health в секунду как true damage (у Blaze, среднее по фазам боя).
// shieldHits — удары по Hitshield у Voidgloom (по ~3 щита за бой, урон в это время не идёт).
// dagger — урон проходит только кинжалами Blaze-слеера с нужной Attunement (Hellion Shield −99%), Ferocity не работает.

export const SLAYER_BOSSES = {
  zombie: {
    name: 'Revenant Horror', types: ['undead'],
    tiers: [
      { hp: 500, dps: 15 },
      { hp: 20_000, dps: 25 },
      { hp: 400_000, dps: 120 },
      { hp: 1_500_000, dps: 400 },
      { hp: 10_000_000, dps: 2400 },
    ],
  },
  spider: {
    name: 'Tarantula Broodfather', types: ['arthropod'],
    tiers: [
      { hp: 750, dps: 35 },
      { hp: 30_000, dps: 55 },
      { hp: 900_000, dps: 260 },
      { hp: 2_400_000, dps: 530 },
      // T5: 10M, затем Conjoined Brood 20M, урон 3 500 → 7 000 в секунду
      { hp: 30_000_000, dps: 5250 },
    ],
  },
  wolf: {
    name: 'Sven Packmaster', types: ['animal'],
    tiers: [
      { hp: 2000, dps: 60 },
      { hp: 40_000, dps: 80, trueDps: 10 },
      { hp: 750_000, dps: 180, trueDps: 50 },
      { hp: 2_000_000, dps: 440, trueDps: 200 },
    ],
  },
  enderman: {
    name: 'Voidgloom Seraph', types: ['ender'],
    tiers: [
      { hp: 300_000, dps: 1200, shieldHits: 15 },
      { hp: 12_000_000, dps: 5000, shieldHits: 30 },
      { hp: 50_000_000, dps: 12_000, shieldHits: 60 },
      { hp: 210_000_000, dps: 21_000, shieldHits: 100 },
    ],
  },
  blaze: {
    name: 'Inferno Demonlord', types: ['infernal'],
    tiers: [
      // босс 2,5M + демоны 2 × 500k; true damage 100 + 5/8/12% Health в секунду, демоны бьют по 2 500
      { hp: 3_500_000, dps: 2500, trueDps: 100, truePct: 0.08 },
      { hp: 13_500_000, dps: 8000, trueDps: 100, truePct: 0.10, dagger: true },
      { hp: 65_000_000, dps: 15_000, trueDps: 100, truePct: 0.10, dagger: true },
      { hp: 190_000_000, dps: 30_000, trueDps: 100, truePct: 0.25, dagger: true },
    ],
  },
};

/** Кинжалы Blaze-слеера и их Attunement (вики, страницы кинжалов) */
export const BLAZE_DAGGERS = {
  FIREDUST_DAGGER: ['Ashen', 'Auric'], BURSTFIRE_DAGGER: ['Ashen', 'Auric'], HEARTFIRE_DAGGER: ['Ashen', 'Auric'],
  MAWDUST_DAGGER: ['Spirit', 'Crystal'], BURSTMAW_DAGGER: ['Spirit', 'Crystal'], HEARTMAW_DAGGER: ['Spirit', 'Crystal'],
};

/** Требования тиров кроме «пройди предыдущий»: уровень этого слеера (вики, Spawning) */
export const TIER_REQ = { zombie: { 5: 7 }, spider: { 5: 7 } };

/** Цена квеста за тир (вики): у Blaze свои цены, у остальных общие */
export const QUEST_COST = {
  default: [2000, 7500, 20_000, 50_000, 100_000],
  blaze: [10_000, 25_000, 60_000, 150_000],
};
