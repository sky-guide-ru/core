import { tx } from '../../i18n/msg.js';
// Почему у запроса нет профиля игрока — и какой ответ отдать вместо безликого «Профиль ещё не загружен».
// Раньше любая причина (сервер только что запустился, Hypixel не ответил, гость не ввёл ник) превращалась в 503,
// а журнал ошибок записывал её как сбой сервера.
//
// Ответы со sbExpected=true журнал не считает ошибками сервера (см. monitor.track5xx): это перезапуск при выкладке
// или сбой внешнего API, о котором и так тревожит проверка «Hypixel молчит».

const CODES = {
  NO_PLAYER: 400, BAD_NAME: 400, NOT_FOUND: 404, NO_PROFILE: 404, HIDDEN: 404, RATE: 429, PASSIVE: 409, // PASSIVE — вкладка в фоне, профиль не загружали ради неё
};

/** Ответ, когда профиля нет. err — исключение из req.sbView(), view — то, что он вернул (если вернул) */
export function sendNoMember(res, { err = null, view = null } = {}) {
  const code = err?.code || view?.errorCode || null;
  const known = code && CODES[code];
  if (known) return res.status(known).json({ error: err?.message || view?.error || 'Профиль недоступен', errorCode: code });
  res.locals.sbExpected = true;
  // Свой профиль владельца ещё грузится: первые полминуты-минуту после перезапуска сервера
  if (!err && (!view?.status || view.status === 'starting')) {
    res.set('Retry-After', '10');
    return res.status(503).json({ error: 'Сайт только что обновился и ещё загружает профиль. Подожди несколько секунд', errorCode: 'STARTING' });
  }
  const msg = err?.message || view?.error || '';
  return res.status(502).json({ error: tx`Hypixel сейчас не ответил${msg ? `: ${msg}` : ''}. Попробуй чуть позже`, errorCode: code || 'NETWORK' });
}

/** Профиль из req.sbView() или null; отказ записывает в out.err, сам вид — в out.view */
export async function loadMember(req, out = {}) {
  try { out.view = await req.sbView(); } catch (e) { out.err = e; return null; }
  return out.view?.member || null;
}
