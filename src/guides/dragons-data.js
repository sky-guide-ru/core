// Факты для гайда «Драконы и Zealots» (The End). Сверено 28.11.2026 по fandom-вики:
// «Ender Dragon» (таблицы вариантов, Dragon Weight, Major Loot — правка весов 2025/Sep 2), «Summoning Eye», «Zealot»,
// «Dragon's Nest», «Remnant of the Eye», «Dragon Armor», «Draconic Altar», «Tutorial:Dragon Fights Guide», «Ender Dragon Pet».
// Названия и id предметов — NEU-REPO. Ключи боёв в API — как у SkyCrypt (player_stats.end_island.dragon_fight, kills.<тип>_dragon).

// Варианты дракона: HP, особенность, шанс появления, предмет только с этого дракона
export const DRAGONS = [
  { key: 'protector', name: 'Protector', hp: 9_000_000, note: 'получает меньше урона', chance: 0.16, set: 'PROTECTOR_DRAGON', bonus: 'Defense растёт, когда мало HP' },
  { key: 'old', name: 'Old', hp: 15_000_000, note: 'больше всех HP, самый медленный', chance: 0.16, set: 'OLD_DRAGON', bonus: 'усиливает Growth, Protection и др. чары брони' },
  { key: 'wise', name: 'Wise', hp: 9_000_000, note: 'чаще Fireball и Lightning (+20% урона)', chance: 0.16, set: 'WISE_DRAGON', bonus: 'способности на 1/3 дешевле по мане' },
  { key: 'unstable', name: 'Unstable', hp: 9_000_000, note: 'бьёт молнией рядом, может взорваться при смерти', chance: 0.16, set: 'UNSTABLE_DRAGON', bonus: 'иногда бьёт мобов молнией', only: 'DRAGON_NEST_TRAVEL_SCROLL' },
  { key: 'young', name: 'Young', hp: 7_500_000, note: 'меньше всех HP, самый быстрый', chance: 0.16, set: 'YOUNG_DRAGON', bonus: '+70% Speed выше половины HP', only: 'DRAGON_SCALE' },
  { key: 'strong', name: 'Strong', hp: 9_000_000, note: 'Rush и касание +20% урона', chance: 0.16, set: 'STRONG_DRAGON', bonus: 'усиливает Aspect of the End' },
  { key: 'superior', name: 'Superior', hp: 12_000_000, note: 'все умения сразу, самый редкий', chance: 0.04, set: 'SUPERIOR_DRAGON', bonus: '+5% к статам и +50% урона Aspect of the Dragons', only: 'DRAGON_HORN' },
];

export const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
// Сколько фрагментов на часть брони (крафт без требований коллекции)
export const FRAGS_PER = { HELMET: 50, CHESTPLATE: 80, LEGGINGS: 70, BOOTS: 40 };

// Вклад (Dragon Weight) за место по урону; 100 за каждый свой глаз и до 100 за долю урона от лидера
export const PLACE_WEIGHT = [
  { place: '1 место', w: 300, share: 100 }, { place: '2 место', w: 250, share: 60 }, { place: '3 место', w: 200, share: 45 },
  { place: '4 место', w: 125, share: 30 }, { place: '5 место', w: 110, share: 25 }, { place: '6–8 место', w: 100, share: 20 },
  { place: '9–10 место', w: 90, share: 15 }, { place: '11–12 место', w: 80, share: 10 },
  { place: '13–25 место и ниже (урон больше 1)', w: 70, share: 5 }, { place: 'урона нет', w: 10, share: 0 },
];
// share — примерная добавка за долю урона от лидера (100 × твой урон / урон первого места) для калькулятора

// Главный дроп: проверяется по порядку, от самого высокого порога. Получил одну вещь — остальные уже не выпадут,
// а из вклада вычитается её порог. chance(eyes, type) — базовый шанс; Magic Find множит его (×(1 + MF/100)), у питомца ещё и Pet Luck.
export const MAJOR = [
  { id: 'ENDER_DRAGON;4', label: 'Ender Dragon (Legendary)', pet: true, req: 450, chance: e => e * 0.0001, text: '0,01% за каждый свой глаз' },
  { id: 'ENDER_DRAGON;3', label: 'Ender Dragon (Epic)', pet: true, req: 449, chance: e => e * 0.0005, text: '0,05% за каждый свой глаз' },
  { id: 'DRAGON_HORN', req: 448, chance: (e, t) => (t === 'superior' ? 0.3 : 0), text: '30%, только Superior' },
  { id: 'ASPECT_OF_THE_DRAGON', req: 447, chance: (e, t) => (t === 'superior' ? 0 : e * 0.03), text: '3% за каждый свой глаз, кроме Superior' },
  { id: 'DRAGON_CLAW', req: 446, chance: e => e * 0.02, text: '2% за каждый свой глаз' },
  { slot: 'CHESTPLATE', req: 410, chance: () => 0.3, text: '30%' },
  { slot: 'LEGGINGS', req: 360, chance: () => 0.3, text: '30%' },
  { id: 'DRAGON_SCALE', req: 296, chance: (e, t) => (t === 'young' ? 0.3 : 0), text: '30%, только Young' },
  { slot: 'HELMET', req: 295, chance: () => 0.3, text: '30%' },
  { slot: 'BOOTS', req: 290, chance: () => 0.3, text: '30%' },
  { id: 'DRAGON_NEST_TRAVEL_SCROLL', req: 250, chance: (e, t) => (t === 'unstable' ? 0.35 : 0), text: '35%, только Unstable' },
];
export const FRAG_WEIGHT = 22; // остаток вклада → фрагменты (22), Enchanted Ender Pearl (15), Ender Pearl (5)
export const FRAG_MAX = 32;    // по вики за бой выпадает 3–32 фрагмента

// Special Zealot: базовый шанс и что его повышает (вики «Zealot», «Summoning Eye»)
export const ZEALOT = {
  base: 420, bruiser: 380,
  boosts: [
    ['Zealot убит не с одного удара', '×1,111 (1 из 378)'],
    ['420 Zealot подряд без Special', '×2 (1 из 210), дальше ×3 и ×4'],
    ['Enderman Legendary 100 уровня', '×1,25 (1 из 336)'],
    ['Перк Zealuck (Dragon Essence) I–V', '+2…10%'],
    ['Tracking', '+1% за каждое очко'],
  ],
};

// Другие источники Summoning Eye
export const EYE_SOURCES = [
  ['Special Zealot', '100% с каждого', 'появляется после убийства Zealot: 1 из 420, с Zealot Bruiser 1 из 380'],
  ['Voidgloom Seraph II / III / IV', '0,67% / 0,6% / 0,56%', 'нужен Enderman Slayer 1'],
  ['Voidling Extremist', '0,04%', 'в Void Sepulture'],
  ['Draconic Altar (Void Slate)', '4,82% за часть Dragon Armor', '4,71% за Aspect of the Dragons, 1% за броню Ender'],
];
