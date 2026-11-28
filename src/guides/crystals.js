// Gemstone Crystals из меню HotM. Источник: вики, страница Gemstone Crystals (после v0.20, апрель 2024).
// Кристалл — не предмет, а отметка в профиле (mining_core.crystals.<gem>_crystal.state): FOUND / NOT_FOUND.
// Пять кристаллов ставят в Crystal Nucleus, остальные семь уходят в Forge на Perfect-гем (5 Flawless + 1 Crystal, 20 ч).

/** [ключ, имя, где искать] — пять кристаллов Crystal Nucleus */
export const NUCLEUS_CRYSTALS = [
  ['jade', 'Jade', 'Mines of Divan: найди Metal Detector’ом 4 потерянных инструмента и отдай их Keeper’ам'],
  ['amber', 'Amber', 'Goblin Holdout: Goblin Queen в её логове'],
  ['amethyst', 'Amethyst', 'Jungle: Jungle Temple, пройди храм ключом Jungle Key'],
  ['sapphire', 'Sapphire', 'Precursor Remnants: Lost Precursor City, Professor Robot (собери 6 деталей)'],
  ['topaz', 'Topaz', 'Magma Fields: убей босса Bal в Khazad-dûm'],
];

/** [ключ, имя, где искать] — остальные кристаллы, по одному на каждый Perfect-гем */
export const OTHER_CRYSTALS = [
  ['jasper', 'Jasper', 'Fairy Grotto в Crystal Hollows: 0.1% с Butterfly и сундуков; ещё сундук Crystal Nucleus и Jasper Mineshaft'],
  ['ruby', 'Ruby', '0.002% с добычи Ruby, сундук Crystal Nucleus (~0.8%) или Ruby Mineshaft'],
  ['opal', 'Opal', 'Opal Mineshaft; редко с Frozen Corpse, которым нужен ключ'],
  ['aquamarine', 'Aquamarine', 'Aquamarine Mineshaft; редко с Frozen Corpse, которым нужен ключ'],
  ['peridot', 'Peridot', 'Peridot Mineshaft; редко с Frozen Corpse, которым нужен ключ'],
  ['onyx', 'Onyx', 'Onyx Mineshaft; редко с Frozen Corpse, которым нужен ключ'],
  ['citrine', 'Citrine', 'Citrine Mineshaft; редко с Frozen Corpse, которым нужен ключ'],
];

const BY_ID = new Map([...NUCLEUS_CRYSTALS.map(c => [c, true]), ...OTHER_CRYSTALS.map(c => [c, false])]
  .map(([[key, name, where], nucleus]) => [`${key.toUpperCase()}_CRYSTAL`, { key, name, where, nucleus }]));

/** JASPER_CRYSTAL → { key, name, where, nucleus } или null */
export const gemCrystal = id => BY_ID.get(id) || null;

/** Найден ли кристалл у игрока: true / false, null — профиля нет или поле не пришло */
export function crystalFound(member, key) {
  const cr = member?.mining?.crystals;
  if (!cr) return null;
  const c = cr[key];
  if (!c) return false;
  return c.state === 'FOUND' || c.state === 'PLACED';
}
