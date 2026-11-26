// Коллекции Рифта: где и как добываются их предметы. Это не обычные коллекции SkyBlock —
// они копятся только внутри Rift, а их предметы нельзя купить на Bazaar или аукционе.
// Источник: Hypixel SkyBlock Wiki (fandom), разделы «Obtaining», проверено 23.11.2026;
// пороги тиров — ресурс коллекций Hypixel (категория RIFT).
// Имена собственные (зоны, NPC, предметы) оставлены английскими, как в игре.

export const RIFT_COLLECTIONS = {
  METAL_HEART: {
    name: 'Living Metal Heart', area: 'Living Cave',
    short: 'только в Рифте: разбить Living Metal Snake в Living Cave',
    how: 'Добывается только в Рифте, в Living Cave. Найди Living Metal Snake (змею из живого металла), успокой её Frozen Water Pungi и разбей все её блоки киркой Self-Recursive Pickaxe (подходят и Anti-Sentient, Eon, Chrono). Сердце получает тот, кто сломал голову змеи, и все, кто играл на Pungi у её головы. Задумано на двоих: в одиночку дают 1 сердце за змею.',
    tools: 'Frozen Water Pungi крафтится из 8 Nullified Metal и 128 Frozen Water; Self-Recursive Pickaxe лучше всех ломает голову.',
  },
  WILTED_BERBERIS: {
    name: 'Wilted Berberis', area: 'Dreadfarm',
    short: 'только в Рифте: собирать на Dreadfarm жезлом Wand of Farming',
    how: 'Добывается только в Рифте, на Dreadfarm. Ищи сухие кусты (Dead Bush) с фиолетовыми частицами и срезай их жезлом Wand of Farming. После сбора частицы переходят на другой куст.',
    tools: 'Wand of Farming выдаёт Shania на Dreadfarm, если с ней поговорить.',
  },
  CADUCOUS_STEM: {
    name: 'Caducous Stem', area: 'Dreadfarm',
    short: 'только в Рифте: собирать розовые кусты на Dreadfarm',
    how: 'Добывается только в Рифте, на Dreadfarm: собирай розовые кусты (Rose Bush) жезлом Wand of Farming.',
    tools: 'Wand of Farming выдаёт Shania на Dreadfarm.',
  },
  AGARICUS_CAP: {
    name: 'Agaricus Cap', area: 'Dreadfarm',
    short: 'только в Рифте: грибы на Dreadfarm',
    how: 'Добывается только в Рифте, на Dreadfarm. Смотри на коричневый гриб около 3 секунд, пока он не станет красным, и сразу собери его жезлом Wand of Farming. Если держать кнопку зажатой, сбор идёт быстрее.',
    tools: 'Wand of Farming выдаёт Shania на Dreadfarm.',
  },
  HALF_EATEN_CARROT: {
    name: 'Half-Eaten Carrot', area: 'Village Plaza',
    short: 'только в Рифте: привести кролика к морковке в Half-Eaten Cave',
    how: 'Добывается только в Рифте, в Half-Eaten Cave на Village Plaza: приведи кролика к морковке, и он оставит надкусанную.',
    tools: null,
  },
  HEMOVIBE: {
    name: 'Hemovibe', area: 'Stillgore Château',
    short: 'только в Рифте: дроп с вампиров у Stillgore Château',
    how: 'Добывается только в Рифте, у Stillgore Château: падает с вампиров Thrall, Fledgling и Scion. Позже его дают и Vampire-миньоны.',
    tools: null,
  },
  TIMITE: {
    name: 'Timite', area: 'Mountaintop',
    short: 'только в Рифте: состарить Youngite из Time Gun на Mountaintop',
    how: 'Добывается только в Рифте, на Mountaintop. Выстрели из Time Gun в руду Youngite, чтобы она стала Timite, и сломай её киркой Eon Pickaxe или Chrono Pickaxe. С одной руды падает 1 Timite.',
    tools: 'Time Gun крафтится из 32 Youngite и Berberis Blowgun; Youngite добывается киркой Anti-Sentient Pickaxe.',
  },
};

const BY_NAME = new Map(Object.entries(RIFT_COLLECTIONS).map(([id, c]) => [c.name.toLowerCase(), { id, ...c }]));

/** Коллекция Рифта по английскому названию ("Living Metal Heart") или null */
export const riftCollectionByName = name => BY_NAME.get(String(name || '').trim().toLowerCase()) || null;

/**
 * Подписи «коллекция X III» в готовой русской карточке (items-ru собран заранее из crafttext NEU):
 * помечаем коллекции Рифта и подставляем тир, исправленный по ресурсу Hypixel (fixCrafttext).
 * @param {object} ru  запись items-ru (не меняется, возвращается копия)
 * @param {string} crafttext  исходный crafttext NEU
 * @param {string} fixed  crafttext после fixCrafttext
 */
export function patchReqLabels(ru, crafttext, fixed) {
  if (!ru || !crafttext) return ru;
  const parts = t => String(t || '').replace(/^Requires:?\s*/i, '').split(/\s*&\s*/);
  const a = parts(crafttext), b = parts(fixed || crafttext);
  const subs = [];
  a.forEach((p, i) => {
    const m = /^(.+) ([IVXLC]+)$/.exec(p), n = /^(.+) ([IVXLC]+)$/.exec(b[i] || p);
    if (!m || !n) return;
    const rift = !!riftCollectionByName(m[1]);
    if (!rift && m[2] === n[2]) return;
    subs.push([`коллекция ${m[1]} ${m[2]}`, `${rift ? 'коллекция Рифта' : 'коллекция'} ${n[1]} ${n[2]}`]);
  });
  if (!subs.length) return ru;
  let json = JSON.stringify(ru);
  for (const [from, to] of subs) json = json.split(from).join(to);
  return JSON.parse(json);
}
