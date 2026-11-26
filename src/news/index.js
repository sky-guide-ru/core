// Раздел «Новости» (журнал изменений сайта). Записи — в entries.js, самая новая первой.
// GET /api/news        → { latest, entries: [{ id, date, kind, kindRu, title, items }], refs }
// GET /api/news/latest → { latest, ids, top, refs } — лёгкий запрос: число непрочитанных на кнопке меню
//   и окошко «Что нового» при заходе (top — самая свежая запись, refs — подсказки только к ней)
import { NEWS, KIND_RU } from './entries.js';
import { plainNews } from './links.js';

export function newsView(list = NEWS) {
  return {
    latest: list[0]?.id || null,
    entries: list.map(e => ({ ...e, kindRu: KIND_RU[e.kind] || '' })),
  };
}

