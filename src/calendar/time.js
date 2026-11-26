// Время SkyBlock. Календарь идёт от фиксированной точки: 1-й день Early Spring 1-го года = 11.06.2019 17:55 UTC.
// 1 день SkyBlock = 20 минут реального времени, месяц = 31 день (10 ч 20 мин), год = 12 месяцев (124 ч ≈ 5 суток 4 часа).
export const EPOCH = 1560275700000;
export const HOUR = 50_000;            // час SkyBlock в мс (20 мин / 24)
export const DAY = 20 * 60_000;
export const MONTH = 31 * DAY;
export const YEAR = 12 * MONTH;

export const MONTHS = [
  { en: 'Early Spring', ru: 'Ранняя весна' }, { en: 'Spring', ru: 'Весна' }, { en: 'Late Spring', ru: 'Поздняя весна' },
  { en: 'Early Summer', ru: 'Раннее лето' }, { en: 'Summer', ru: 'Лето' }, { en: 'Late Summer', ru: 'Позднее лето' },
  { en: 'Early Autumn', ru: 'Ранняя осень' }, { en: 'Autumn', ru: 'Осень' }, { en: 'Late Autumn', ru: 'Поздняя осень' },
  { en: 'Early Winter', ru: 'Ранняя зима' }, { en: 'Winter', ru: 'Зима' }, { en: 'Late Winter', ru: 'Поздняя зима' },
];

/** Дата SkyBlock для момента реального времени. month — 0..11, day — 1..31. */
export function sbDate(now = Date.now()) {
  const t = now - EPOCH;
  const year = Math.floor(t / YEAR) + 1;
  const inYear = t - (year - 1) * YEAR;
  const month = Math.floor(inYear / MONTH);
  const inMonth = inYear - month * MONTH;
  const day = Math.floor(inMonth / DAY) + 1;
  const inDay = inMonth - (day - 1) * DAY;
  const hour = Math.floor(inDay / HOUR);
  const minute = Math.floor((inDay - hour * HOUR) / (HOUR / 60));
  return { year, month, day, hour, minute, dayOfYear: month * 31 + day, monthEn: MONTHS[month].en, monthRu: MONTHS[month].ru };
}

/** Реальное время начала дня SkyBlock (год с 1, месяц 0..11, день 1..31). */
export const sbStart = (year, month, day = 1) => EPOCH + (year - 1) * YEAR + month * MONTH + (day - 1) * DAY;

/** «12 Поздней весны» → короткая подпись даты SkyBlock. */
export const sbLabel = (month, day) => `${day} ${MONTHS[month].en}`;
