// Данные профиля по разделам. /api/state приходит при каждом открытии сайта и раз в минуту (вместе с ценами),
// а до сервера во Франции у части игроков 5–20 КБ/с — 89 КБ профиля качались 15–20 секунд.
// Поэтому в /api/state остаётся то, что нужно шапке, «Обзору» и большинству страниц, а тяжёлые куски
// отдаются отдельно, когда открыт их раздел: GET /api/part/:name?v=<версия>.
//
// Версия куска — отпечаток его содержимого. Адрес с версией браузер кэширует надолго (тот же адрес = те же данные),
// поэтому повторный заход на раздел, пока данные не изменились, не идёт в сеть вообще.
import { createHash } from 'node:crypto';

/** Куски: имя → как достать из { member, analysis } выбранного игрока. */
export const PARTS = {
  gear: ({ analysis }) => analysis?.gear,          // «Снаряжение»: всё надетое, оружие, сеты, инструменты (~200 КБ)
  acc: ({ analysis }) => slimAcc(analysis?.acc),   // «Аксессуары»: список, недостающие, что купить (~55 КБ)
  extras: ({ member, analysis }) => (member?.extras ? { extras: member.extras, chocolate: analysis?.chocolate || null } : null), // нижние блоки «Прогресса»
  petScore: ({ analysis }) => analysis?.petScore,  // «Питомцы»: Pet Score и Taming
  map: ({ analysis }) => analysis?.map,            // «Что делать» → карта прогрессии
};

// У недостающих аксессуаров вместо массива всех расцветок семейства (~65 КБ повторов) — один ключ семейства fk,
// по нему страница убирает повторы. Пересчитываем один раз на разбор
const slimMemo = new WeakMap();
function slimAcc(acc) {
  if (!acc?.missing) return acc;
  let s = slimMemo.get(acc);
  if (!s) {
    s = { ...acc, missing: acc.missing.map(({ family, ...r }) => ({ ...r, fk: family?.length ? [...family].sort()[0] : r.id })) };
    slimMemo.set(acc, s);
  }
  return s;
}

// Отпечаток считаем один раз на объект: разбор профиля пересоздаётся при обновлении профиля или цен
const memo = new WeakMap();
const extrasMemo = new WeakMap();
function packed(obj) {
  let p = memo.get(obj);
  if (!p) {
    const json = JSON.stringify(obj);
    p = { json, v: createHash('sha1').update(json).digest('base64url').slice(0, 12) };
    memo.set(obj, p);
  }
  return p;
}

/** Кусок раздела: { v, json } или null, если его нет (профиль не загружен, игрок скрыл API). */
export function statePart(view, name) {
  const get = PARTS[name];
  if (!get) return null;
  const obj = get(view || {});
  if (obj == null) return null;
  // Составной кусок (extras) собирается заново на каждый запрос — кэшируем по разбору профиля
  if (name === 'extras') {
    const key = view.analysis || view.member;
    let byKey = extrasMemo.get(key);
    if (!byKey || byKey.member !== view.member) { byKey = { member: view.member, p: packed(obj) }; extrasMemo.set(key, byKey); }
    return byKey.p;
  }
  return typeof obj === 'object' ? packed(obj) : null;
}

/** Версии всех кусков выбранного игрока: { gear: 'abc…', … } (null — куска нет). */
export function partVersions(view) {
  const out = {};
  for (const name of Object.keys(PARTS)) out[name] = statePart(view, name)?.v || null;
  return out;
}

/** Лёгкий разбор для /api/state: тяжёлые куски заменены короткой сводкой для «Обзора», шапки и карточки. */
export function lightAnalysis(a) {
  if (!a) return a;
  const { gear, acc, chocolate, petScore, map, ...rest } = a;
  if (gear) rest.gear = { networth: gear.networth, itemCount: gear.itemCount, topItems: (gear.topItems || []).slice(0, 10) };
  if (acc) {
    const { missing, list, cheapestNext, steps, ...nums } = acc;
    rest.acc = nums; // count, notRecombCount, recombPrice, calculatedMp…
  }
  return rest;
}

/** Лёгкий участник для /api/state: без кусков раздела и без того, что сайт не показывает. */
export function lightMember(m) {
  if (!m) return m;
  const { extras, unlockedCollTiers, bankTransactions, ...rest } = m;
  rest.hasExtras = !!extras;
  return rest;
}
