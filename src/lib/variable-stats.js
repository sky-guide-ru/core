// Предметы, у которых статы меняются: от сезона SkyBlock, времени суток и т. п. В базе NEU записан лор,
// снятый в какой-то один момент (Magic 8 Ball с «Farming Fortune +50»), и описание из него выходит неверным.
// Здесь — правильное описание по вики (hypixelskyblock.minecraft.wiki, проверено 26.11.2026) и как узнать текущий бонус.
// Чистые данные и функции, без загрузки NEU.

const M8_OPTIONS = [
  { answer: 'It is certain.', stats: '+25 Farming Fortune, +1 Farming Wisdom' },
  { answer: 'Reply hazy, try again.', stats: '+25 Foraging Fortune, +1 Foraging Wisdom' },
  { answer: "Don't count on it.", stats: '+25 Mining Fortune, +1 Mining Wisdom' },
  { answer: 'As I see it, yes.', stats: '+25 Fishing Speed, +1 Fishing Wisdom' },
  { answer: 'My sources say no.', stats: '+25 Strength, +1 Combat Wisdom' },
];

/**
 * kind: season — бонус зависит от сезона SkyBlock; time — от дня и ночи.
 * text — описание вместо собранного из лора; options — варианты бонуса (для «текущий бонус крупно»).
 * obtain — источник, если в NEU его нет.
 */
export const VARIABLE_STATS = {
  MAGIC_8_BALL: {
    kind: 'season', random: true,
    text: 'Epic Accessory. Каждый сезон SkyBlock случайно даёт один бонус из пяти: +25 Farming Fortune, Foraging Fortune, Mining Fortune, Fishing Speed или Strength и +1 Wisdom того же направления.',
    options: M8_OPTIONS,
    obtain: 'Dark Auction (раунды 1, 3 и 4, ставка от 20 млн) или награда Raffle of the Century',
  },
  ATMOSPHERIC_FILTER: {
    kind: 'season',
    text: 'Rare Accessory. Работает только на Garden, бонус зависит от сезона: весной +25 Farming Fortune, летом +20 Farming Wisdom, осенью Pests появляются на 15% чаще, зимой Visitors дают на 5% больше Copper.',
    options: [
      { season: 'Spring', stats: '+25 Farming Fortune' }, { season: 'Summer', stats: '+20 Farming Wisdom' },
      { season: 'Autumn', stats: 'Pests на 15% чаще' }, { season: 'Winter', stats: '+5% Copper от Visitors' },
    ],
    obtain: 'редкий дроп с Mite на Garden (0,5%)',
  },
  DAY_CRYSTAL: { kind: 'time', text: 'Rare Accessory. Днём даёт +5 Strength и +5 Defense, ночью не работает.' },
  NIGHT_CRYSTAL: { kind: 'time', text: 'Rare Accessory. Ночью даёт +5 Strength и +5 Defense, днём не работает.' },
  SUNSHINE_CRYSTAL: { kind: 'time', text: 'Epic Accessory. Днём даёт +10 Strength и +10 Defense, ночью не работает.' },
  MOONLIGHT_CRYSTAL: { kind: 'time', text: 'Epic Accessory. Ночью даёт +10 Strength и +10 Defense, днём не работает.' },
};
for (const p of ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS']) {
  VARIABLE_STATS[`BAT_PERSON_${p}`] = { kind: 'time', note: 'Боевые статы этой части удваиваются ночью и утраиваются во время Spooky Festival.' };
}

/** Описание предмета с учётом меняющихся статов (или null — обычный предмет). */
export function variableInfo(id) {
  const v = VARIABLE_STATS[id];
  if (!v) return null;
  return { kind: v.kind, random: !!v.random, text: v.text || null, note: v.note || null, options: v.options || null, obtain: v.obtain || null };
}

const strip = s => String(s ?? '').replace(/§./g, '');

/**
 * Текущий бонус своего экземпляра по его лору. Magic 8 Ball отмечает выпавший ответ звёздочкой «✦»
 * (остальные — «✧»), а под ответом идут его статы.
 * @returns {{ answer?: string, stats: string } | null}
 */
export function currentBonus(id, lore = []) {
  const v = VARIABLE_STATS[id];
  if (!v?.options) return null;
  const lines = lore.map(strip);
  if (id === 'MAGIC_8_BALL') {
    const i = lines.findIndex(l => /^\s*✦/.test(l));
    if (i < 0) return null;
    const answer = lines[i].replace(/^\s*✦\s*/, '').trim();
    const opt = v.options.find(o => answer.startsWith(o.answer.replace(/\.$/, '')));
    return opt ? { answer: opt.answer, stats: opt.stats } : { answer, stats: lines.slice(i + 1, i + 3).join(', ') };
  }
  return null;
}

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

/**
 * Сезон SkyBlock сейчас и когда сменится (сезон — 3 месяца SkyBlock, ≈ 31 ч реального времени).
 * @param {number} now мс
 * @param {{ EPOCH: number, MONTH: number, YEAR: number }} t константы календаря (server/calendar/time.js)
 */
export function seasonNow(now, t) {
  const inYear = ((now - t.EPOCH) % t.YEAR + t.YEAR) % t.YEAR;
  const i = Math.floor(inYear / (3 * t.MONTH));
  const nextAt = now - inYear + (i + 1) * 3 * t.MONTH;
  return { now: SEASONS[i], next: SEASONS[(i + 1) % 4], nextAt };
}

/** Для карточки: описание + текущий и следующий сезон с их бонусами (у Magic 8 Ball следующий бонус случаен). */
export function variableView(id, now, t) {
  const v = variableInfo(id);
  if (!v) return null;
  if (v.kind !== 'season') return v;
  const s = seasonNow(now, t);
  const of = name => v.options?.find(o => o.season === name)?.stats || null;
  return { ...v, season: { ...s, nowStats: of(s.now), nextStats: of(s.next) } };
}
