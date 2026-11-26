// Модуль live-advisor: «живой советчик».
// Бесплатный слой (сторож) следит за профилем и ценами постоянно; Claude зовётся только при важных
// изменениях или по вопросу в чате. Дневной лимит денег, счётчик расходов, кэш промпта.
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { makeSnapshot, diffSnapshots, shouldCall, DEFAULT_TRIGGER } from './lib/watcher.js';
import { buildDigest, buildDelta } from './lib/digest.js';
import { requestAdvice, askChat, explainError } from './lib/llm.js';
import { makeToolHandlers } from './lib/tools.js';
import { Budget, costOf, PRICING } from './lib/budget.js';
import { MIN, dayKey } from './lib/util.js';
import { linkItems } from './lib/links.js';
import { timeUse, timeUseLines } from './lib/insights.js';
import { normalizeGoal, goalProgress, goalLines } from './lib/goals.js';
import { tx } from '../../i18n/msg.js';

export { makeSnapshot, diffSnapshots, shouldCall, buildDigest, buildDelta, Budget, costOf, PRICING };
export { createMockClient } from './lib/mock-client.js';
export { timeUse, normalizeGoal, goalProgress };

// «Диагноз аккаунта» — вывод о профиле целиком, а не реакция на каждую мелочь. Цены, мэр и шаги плана видны
// в «Живой ленте» и в плане, поэтому повод для нового разбора — только прогресс самого игрока.
const DIAG_KINDS = new Set(['start', 'level', 'slayer', 'dungeon', 'coins', 'mp']);
export const DIAG_TRIGGER = { minScore: 4, minIntervalMs: 3 * 60 * MIN, urgentScore: 10, urgentIntervalMs: 60 * MIN };
// Раз в сутки разбор обновляется и без крупных событий, если хоть что-то сдвинулось
const DIAG_STALE_MS = 24 * 60 * MIN;

/**
 * @typedef {Object} LiveAdvisorOptions
 * @property {string} [apiKey]        ANTHROPIC_API_KEY (только из .env)
 * @property {Object} [client]        готовый клиент (тесты/симуляция); иначе создаётся из apiKey
 * @property {string} [model]         по умолчанию claude-haiku-5-5
 * @property {string} [deepModel]     для «подробнее», по умолчанию claude-sonnet-5-5
 * @property {number} [dailyUsd]      дневной лимит, по умолчанию 0.20
 * @property {string} [tz]            часовой пояс для дат и суток бюджета
 * @property {string} [dataDir]       куда сохранять состояние (live-advisor.json)
 * @property {number} [friendDailyUsd] дневной лимит на чат для каждого друга (внутри общего), по умолчанию 0.05
 * @property {Partial<import('./lib/watcher.js').TriggerSettings>} [trigger]
 * @property {() => number} [clock]
 * @property {{ priceOf?, priceTrend?, priceInfo?, itemName?, getItemRu?, searchItems?, pricesRaw? }} [deps]
 */

/** @param {LiveAdvisorOptions} opts */
// Счётчики по нику: ники вроде «constructor» или «__proto__» не должны читать унаследованные свойства объекта
const own = (o, k) => (o && Object.hasOwn(o, k) ? o[k] : undefined);
const num = v => (Number.isFinite(v) ? v : 0);
/** { день: { ник: число } } без прототипа, в том числе при загрузке из файла */
function dayMap(src) {
  const out = Object.create(null);
  for (const [d, v] of Object.entries(src && typeof src === 'object' ? src : {})) {
    if (!v || typeof v !== 'object') continue;
    const day = Object.create(null);
    for (const [k, n] of Object.entries(v)) if (Number.isFinite(n)) day[k] = n;
    out[d] = day;
  }
  return out;
}

const MAX_QUESTION = 500;
// Советы по чужим профилям: сколько хранить, как часто обновлять сами и сколько автосоветов в день на всех
const VIEW_KEEP = 12;
const VIEW_STALE_MS = 3 * 60 * 60_000;
const VIEW_RETRY_MS = 30 * 60_000;
const VIEW_AUTO_PER_DAY = 30;
/** Ключ открытого профиля: у кооп-соседей один остров, но советы разные */
export const viewKeyOf = v => (v?.member ? `${v.member.uuid || v.name}:${v.member.profileId || v.profile || ''}` : null);
const whoOf = v => (v ? `${v.name}${v.profile ? ` (${v.profile})` : ''}` : null);
/** Пояснение для ИИ, чей это профиль: совет пишется самому игроку, а не владельцу сайта */
export function viewPreface(v) {
  const who = whoOf(v);
  if (v.self) return tx`Это профиль игрока ${who}, совет читает он сам. Пиши ему про его профиль, на «ты».`;
  return tx`Это профиль игрока ${who}${v.coopMate ? ', соседа пользователя по кооп-острову' : ''}. Совет — про ${v.name} и по его данным (его скиллы, снаряжение, аксессуары, кошелёк), пиши так, будто обращаешься к ${v.name} на «ты».`;
}
const COOLDOWN_MS = 5000;
const REFUSAL = 'Я помогаю только с Hypixel SkyBlock и не меняю свои правила. Спроси про свой профиль, снаряжение, заработок или прогресс.';
// Явные попытки подменить правила или вытащить служебный текст. Остальное (посторонние темы) отсекает сама модель по промпту.
const INJECTION = [
  /(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|your)\s+(instructions|rules|prompt)/i,
  /(system|developer)\s*(prompt|message|instructions)/i,
  /(игнорир|забудь|забыть|отмени|сбрось)\S*\s+(все\s+|свои\s+|прошл\S*\s+|предыдущ\S*\s+)*(инструкц|правил|ограничен|промпт)/i,
  /(системн\S*|служебн\S*)\s+(промпт|инструкц|сообщени)/i,
  /(покажи|выведи|напиши|раскрой|повтори)\s+(свой\s+|свои\s+|весь\s+|мне\s+)*(промпт|инструкц|prompt)/i,
  /\b(jailbreak|DAN mode|developer mode)\b|режим\s+(разработчика|без\s+ограничений)/i,
  /ты\s+(теперь|больше\s+не)\s+(не\s+)?(советчик|ассистент|бот|ии)/i,
];
export const isInjection = q => INJECTION.some(re => re.test(q));

export function createLiveAdvisor(opts = {}) {
  const clock = opts.clock || (() => Date.now());
  const deps = opts.deps || {};
  const bus = new EventEmitter();
  const file = opts.dataDir ? path.join(opts.dataDir, 'live-advisor.json') : null;

  const saved = (() => { try { return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; } catch { return {}; } })();
  const settings = {
    enabled: true,
    model: opts.model || 'claude-haiku-5-5',
    deepModel: opts.deepModel || 'claude-sonnet-5-5',
    ...(saved.settings || {}),
    // Пороги прежнего советчика (каждые 15 минут) из файла не берём: у диагноза свои
    trigger: { ...DIAG_TRIGGER, ...(opts.trigger || {}) },
  };
  const budget = new Budget({ ...(saved.budget || {}), dailyUsd: saved.budget?.dailyUsd ?? opts.dailyUsd ?? 0.20, tz: opts.tz });
  // Друзья с аккаунтами: у каждого свой маленький дневной лимит на чат внутри общего, свой чат, автосоветы — только владельцу
  const friendDailyUsd = opts.friendDailyUsd ?? 0.05;
  const userSpend = dayMap(saved.userSpend); // { 'YYYY-MM-DD': { ник: usd } }
  // Сколько вопросов в день: у друга LIVE_FRIEND_DAILY_QUESTIONS (20), у владельца LIVE_OWNER_DAILY_QUESTIONS (100)
  const askLimits = { friend: opts.friendDailyQuestions ?? 20, owner: opts.ownerDailyQuestions ?? 100 };
  const userAsks = dayMap(saved.userAsks); // { 'YYYY-MM-DD': { ник | '@owner': n } }
  const lastAskAt = new Map();
  const pendingAsks = new Set();         // вопросы, ответ на которые ещё идёт: { uk, gone }           // пауза между вопросами одного человека (в памяти)
  const askKey = k => k || '@owner';
  const asksBy = (k, now) => num(own(own(userAsks, dayOf(now)), askKey(k)));
  function countAsk(k, now) {
    const d = dayOf(now);
    const day = own(userAsks, d) || (userAsks[d] = Object.create(null));
    day[askKey(k)] = num(own(day, askKey(k))) + 1;
    for (const old of Object.keys(userAsks).sort().slice(0, -14)) Reflect.deleteProperty(userAsks, old);
  }
  const ukey = u => (u && !u.owner ? String(u.name).toLowerCase() : null);
  const dayOf = now => dayKey(now, opts.tz);
  const spentBy = (k, now) => num(own(own(userSpend, dayOf(now)), k));
  const limitOf = u => (u?.dailyUsd ?? friendDailyUsd);
  function recordUser(k, usd, now) {
    if (!k || !usd) return;
    const d = dayOf(now);
    const day = own(userSpend, d) || (userSpend[d] = Object.create(null));
    day[k] = num(own(day, k)) + usd;
    for (const old of Object.keys(userSpend).sort().slice(0, -60)) Reflect.deleteProperty(userSpend, old);
  }

  const st = {
    baseline: saved.baseline || null,     // снимок на момент последнего вызова ИИ
    lastCallAt: saved.lastCallAt || 0,
    advice: saved.advice || null,
    adviceHistory: saved.adviceHistory || [],
    chat: saved.chat || [],
    lastCheck: null,
    member: null, analysis: null, dataAt: 0,
    digest: null,                         // { text, at, dataAt }
    inFlight: null,
    chatInFlight: new Set(),              // один вопрос за раз на каждого: иначе параллельные запросы обходят дневной лимит
    error: null,
    // Советы для чужих открытых профилей (кооп-соседи, друзья): у каждого свой, по его данным
    viewAdvice: new Map(Object.entries(saved.viewAdvice || {})), // `${uuid}:${profileId}` → совет
    viewBusy: new Map(),                  // ключ → идущий запрос
    viewTried: new Map(),                 // ключ → когда последний раз пробовали (в памяти)
    viewErrors: new Map(),
    goals: saved.goals && typeof saved.goals === 'object' ? { ...saved.goals } : {}, // ключ профиля → цель игрока
  };
  const ownKey = () => viewKeyOf({ member: st.member });
  /** Цель игрока по ключу профиля */
  const goalOf = key => (key && Object.hasOwn(st.goals, key) ? st.goals[key] : null);
  /** Поставить цель (инструмент set_goal) — только для своего профиля */
  const goalSetter = (key, member) => input => {
    if (!key) return { error: 'Профиль ещё не загружен' };
    const r = normalizeGoal(input, member, clock());
    if (r.error) return { error: r.error };
    st.goals[key] = r.goal;
    save();
    bus.emit('advice', { at: clock() }); // карточка на главной покажет цель сразу
    const gp = goalProgress(r.goal, member);
    return { ok: true, saved: gp.title, progress: gp.targets.map(t => `${t.label}: ${t.text}`) };
  };
  /** Факты для диагноза: куда ушло время (только по своему профилю — история есть у него) и цель */
  function diagnosisExtra(member, key, { history = true } = {}) {
    const L = [];
    if (history) {
      let pts = null;
      try { pts = deps.history?.() || null; } catch { /* истории нет */ }
      if (pts) L.push('', '# Куда ушло время (по почасовой истории профиля, последние 7 дней)', ...timeUseLines(timeUse(pts, member, { now: clock(), days: 7 })));
    }
    const gp = goalProgress(goalOf(key), member);
    if (gp) L.push('', '# Цель игрока', ...goalLines(gp));
    return L.join('\n');
  }

  let client = opts.client || null;
  let Anthropic = null;
  async function getClient() {
    if (client) return client;
    if (!opts.apiKey) return null;
    const mod = await import('@anthropic-ai/sdk');
    Anthropic = mod.default;
    client = new Anthropic({ apiKey: opts.apiKey });
    return client;
  }
  const hasAi = () => !!(opts.client || opts.apiKey);

  const handlers = makeToolHandlers({ ...deps, getAnalysis: () => st.analysis, getMember: () => st.member });
  // Владелец про свой профиль может ставить цель; друг без открытого профиля — нет (иначе поставил бы цель владельцу)
  const ownerHandlers = makeToolHandlers({ ...deps, getAnalysis: () => st.analysis, getMember: () => st.member, setGoal: input => goalSetter(ownKey(), st.member)(input) });
  const goalBlock = (key, member) => { const gp = goalProgress(goalOf(key), member); return gp ? tx`\n\n# Цель игрока\n${goalLines(gp).join('\n')}` : ''; };
  const calendar = () => { try { return deps.calendar?.() || null; } catch { return null; } }; // мэр и события (server/calendar)
  const snapOpt = () => ({ priceOf: deps.priceOf, now: clock(), calendar: calendar() });
  const digestOpt = (extra = {}) => ({ ...extra, now: clock(), tz: opts.tz, priceOf: deps.priceOf, priceTrend: deps.priceTrend, itemName: deps.itemName, calendar: calendar() });

  function save() {
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({
        settings, budget: budget.toJSON(), baseline: st.baseline, lastCallAt: st.lastCallAt,
        advice: st.advice, adviceHistory: st.adviceHistory.slice(0, 30), chat: st.chat.slice(-90), userSpend, userAsks,
        goals: st.goals,
        viewAdvice: Object.fromEntries([...st.viewAdvice.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, VIEW_KEEP)),
      }));
    } catch (e) { console.error('[live-advisor] не удалось сохранить:', e.message); }
  }

  function freshDigest(maxAgeMs = 10 * MIN) {
    const now = clock();
    if (!st.digest || (st.dataAt > st.digest.dataAt && now - st.digest.at >= maxAgeMs)) {
      st.digest = { text: buildDigest(st.member, st.analysis, digestOpt()), at: now, dataAt: st.dataAt };
    }
    return st.digest.text;
  }

  /** Бесплатная проверка: что изменилось с последнего совета и пора ли звать ИИ */
  function check() {
    if (!st.member) return null;
    const now = clock();
    const cur = makeSnapshot(st.member, st.analysis, snapOpt());
    const all = diffSnapshots(st.baseline, cur, { itemName: deps.itemName });
    const events = all.events.filter(e => DIAG_KINDS.has(e.kind));
    const score = events.reduce((a, e) => a + e.weight, 0);
    let decision = shouldCall({ score, lastCallAt: st.lastCallAt, now }, settings.trigger);
    // Сутки без нового разбора, а игрок что-то делал — обновляем цифры
    if (!decision.call && score > 0 && st.lastCallAt && now - st.lastCallAt >= DIAG_STALE_MS) decision = { call: true, reason: 'прошли сутки с прошлого разбора' };
    if (decision.call && !settings.enabled) decision = { call: false, reason: 'советчик выключен в настройках' };
    if (decision.call && !hasAi()) decision = { call: false, reason: 'нет ключа ANTHROPIC_API_KEY: работает только бесплатный слой' };
    if (decision.call && !budget.canSpend('auto', now)) decision = { call: false, reason: 'дневной лимит на автосоветы исчерпан (остаток оставлен для чата)' };
    st.lastCheck = { at: now, score, events, ...decision, snapshot: cur };
    bus.emit('check', st.lastCheck);
    return st.lastCheck;
  }

  async function runAdvice(chk, { force = false } = {}) {
    if (st.inFlight) return st.inFlight;
    st.inFlight = (async () => {
      const now = clock();
      const c = await getClient();
      if (!c) throw new Error('Нет ключа ANTHROPIC_API_KEY');
      const autoDigest = buildDigest(st.member, st.analysis, digestOpt({ auto: true }));
      const extra = diagnosisExtra(st.member, ownKey());
      const delta = buildDelta(chk.events, { reason: force ? 'игрок попросил обновить совет' : chk.reason, prevAdvice: st.advice });
      const r = await requestAdvice(c, { model: settings.model, digest: autoDigest + '\n' + extra, delta });
      const usd = budget.record('auto', r.usage, settings.model, now);
      st.lastCallAt = now;
      st.baseline = chk.snapshot;
      if (r.advice) {
        st.advice = { ...r.advice, at: now, model: r.model, usd, events: chk.events.map(e => e.text), reason: force ? 'по запросу' : chk.reason };
        st.adviceHistory.unshift(st.advice);
        st.adviceHistory = st.adviceHistory.slice(0, 30);
        st.error = null;
        bus.emit('advice', st.advice);
      } else {
        st.error = r.error;
      }
      save();
      return st.advice;
    })().catch(e => { st.error = explainError(e, Anthropic); console.error('[live-advisor]', st.error); return null; })
      .finally(() => { st.inFlight = null; });
    return st.inFlight;
  }

  /** Совет для открытого чужого профиля. kind: 'auto' — сами при открытии, 'chat' — по кнопке */
  function runViewAdvice(view, { user, kind = 'auto', lang = 'ru' } = {}) {
    const key = viewKeyOf(view);
    if (st.viewBusy.has(key)) return st.viewBusy.get(key);
    const uk = ukey(user);
    const now = clock();
    st.viewTried.set(key, now);
    const p = (async () => {
      const c = await getClient();
      if (!c) throw new Error('Нет ключа ANTHROPIC_API_KEY');
      const prev = st.viewAdvice.get(key) || null;
      const digest = `${viewPreface(view)}\n${buildDigest(view.member, view.analysis, digestOpt({ auto: true }))}\n${diagnosisExtra(view.member, key, { history: false })}`;
      const delta = buildDelta([], { reason: kind === 'auto' ? tx`открыт профиль ${whoOf(view)}` : 'попросили обновить совет', prevAdvice: prev });
      const r = await requestAdvice(c, { model: settings.model, digest, delta, lang });
      const usd = budget.record(kind, r.usage, settings.model, now);
      recordUser(uk, usd, now);
      if (kind === 'auto') countViewAuto(now);
      if (!r.advice) { st.viewErrors.set(key, r.error || 'Пустой ответ'); save(); return prev; }
      const advice = { ...r.advice, at: now, model: r.model, usd, events: [], reason: kind === 'auto' ? 'открыт профиль' : 'по запросу', who: whoOf(view), dataAt: view.updatedAt || now, lang };
      st.viewAdvice.set(key, advice);
      st.viewErrors.delete(key);
      if (st.viewAdvice.size > VIEW_KEEP) {
        const oldest = [...st.viewAdvice.entries()].sort((a, b) => a[1].at - b[1].at)[0][0];
        st.viewAdvice.delete(oldest);
      }
      bus.emit('advice', advice);
      save();
      return advice;
    })().catch(e => { st.viewErrors.set(key, explainError(e, Anthropic)); console.error('[live-advisor] совет по профилю:', st.viewErrors.get(key)); return null; })
      .finally(() => { st.viewBusy.delete(key); bus.emit('view', { key, at: clock() }); });
    st.viewBusy.set(key, p);
    return p;
  }
  const viewAutoDay = { day: '', n: 0 };
  function countViewAuto(now) { const d = dayOf(now); if (viewAutoDay.day !== d) Object.assign(viewAutoDay, { day: d, n: 0 }); viewAutoDay.n++; }
  /** Можно ли самим (без кнопки) сделать совет для открытого профиля: нет совета или он старый, лимиты позволяют */
  function viewAutoReason(view, user, lang = 'ru') {
    const key = viewKeyOf(view);
    if (!key) return 'нет профиля';
    if (!hasAi()) return 'нет ключа ANTHROPIC_API_KEY';
    if (!settings.enabled) return 'советчик выключен';
    const now = clock();
    const prev = st.viewAdvice.get(key);
    if (prev && now - prev.at < VIEW_STALE_MS && (prev.en || (prev.lang || 'ru') === lang)) return 'совет свежий';
    if (st.viewBusy.has(key)) return 'совет уже готовится';
    if (now - (st.viewTried.get(key) || 0) < VIEW_RETRY_MS) return 'недавно пробовали';
    if ((viewAutoDay.day === dayOf(now) ? viewAutoDay.n : 0) >= VIEW_AUTO_PER_DAY) return 'на сегодня автосоветов по чужим профилям хватит';
    if (!budget.canSpend('auto', now)) return 'дневной лимит на автосоветы исчерпан';
    const uk = ukey(user);
    if (uk && spentBy(uk, now) >= limitOf(user)) return 'личный лимит на сегодня исчерпан';
    return null;
  }

  return {
    bus,
    settings,
    /** Расход за сутки и месяц — для тревог и сводки владельцу (server/monitor). null — ИИ не подключён */
    budgetSummary() { return hasAi() ? budget.summary(clock()) : null; },

    /** Открыт чужой профиль (или друг смотрит свой): совет по его данным, если его нет или он устарел. Не ждёт ответа ИИ */
    ensureViewAdvice(view, user, lang = 'ru') {
      if (viewAutoReason(view, user, lang)) return false;
      runViewAdvice(view, { user, kind: 'auto', lang });
      return true;
    },

    /** Кнопка «Обновить совет» на чужом профиле */
    async refreshViewAdvice(view, user, lang = 'ru') {
      if (!view?.member) throw new Error('Профиль ещё не загружен');
      if (!hasAi()) throw new Error('Нет ключа ANTHROPIC_API_KEY в .env');
      const now = clock();
      if (!budget.canSpend('chat', now)) throw new Error('Дневной лимит исчерпан');
      const uk = ukey(user);
      if (uk && spentBy(uk, now) >= limitOf(user)) throw new Error('Твой дневной лимит советчика на сегодня исчерпан');
      const prev = st.viewAdvice.get(viewKeyOf(view));
      if (prev && now - prev.at < 60_000 && (prev.en || (prev.lang || 'ru') === lang)) return prev; // двойной клик не тратит деньги дважды
      return runViewAdvice(view, { user, kind: 'chat', lang });
    },

    /**
     * Ядро вызывает после каждого обновления профиля или цен.
     * @param {{ member: Object, analysis: Object }} data
     * @returns {Promise<{ check: Object, advice: Object|null }>}
     */
    async update({ member, analysis }) {
      st.member = member; st.analysis = analysis; st.dataAt = clock();
      const chk = check();
      if (!chk?.call) return { check: chk, advice: null };
      return { check: chk, advice: await runAdvice(chk) };
    },

    /** Кнопка «Обновить совет» (тратит токены, но в пределах лимита) */
    async refreshAdvice() {
      if (!st.member) throw new Error('Профиль ещё не загружен');
      if (!budget.canSpend('chat', clock())) throw new Error('Дневной лимит исчерпан');
      const chk = check();
      return runAdvice({ ...chk, snapshot: chk.snapshot }, { force: true });
    },

    /**
     * Вопрос в чате.
     * @param {string} question
     * @param {{ deep?: boolean, view?: Object, user?: { name, owner, dailyUsd } }} [o]  deep — ответ модели посильнее (Sonnet 5.5);
     *   user — кто спрашивает (друг: свой лимит и своя история чата)
     */
    async ask(question, o = {}) {
      // Вопрос: без управляющих символов и не длиннее 500 знаков (длинные «вопросы» — это обычно попытка подсунуть инструкции)
      const q = String(question || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();
      if (!q) throw new Error('Пустой вопрос');
      if (q.length > MAX_QUESTION) throw new Error(tx`Слишком длинный вопрос: до ${MAX_QUESTION} знаков, сейчас ${q.length}`);
      const view = o.view?.member ? o.view : null;
      if (!st.member && !view) throw new Error('Профиль ещё не загружен');
      const now = clock();
      let uk = ukey(o.user);
      if (!budget.canSpend('chat', now)) throw new Error(uk ? 'Советчик на сегодня устал: общий дневной лимит исчерпан, завтра снова заработает' : tx`Дневной лимит $${budget.dailyUsd} исчерпан. Его можно поднять в настройках советчика.`);
      if (uk && spentBy(uk, now) >= limitOf(o.user)) throw new Error(`Твой дневной лимит советчика на сегодня исчерпан. Завтра снова можно спрашивать; поднять лимит может владелец сайта.`);
      const lock = uk || '';
      if (st.chatInFlight.has(lock)) throw new Error('Подожди ответа на прошлый вопрос');
      const limitQ = uk ? (o.user?.dailyQuestions ?? askLimits.friend) : askLimits.owner;
      if (asksBy(uk, now) >= limitQ) throw new Error(tx`На сегодня вопросы закончились (${limitQ} в день). Завтра снова можно спрашивать.`);
      const wait = COOLDOWN_MS - (now - (lastAskAt.get(lock) || 0));
      if (wait > 0) throw new Error(tx`Не так быстро: следующий вопрос через ${Math.ceil(wait / 1000)} с`);
      if (!hasAi()) throw new Error('Нет ключа ANTHROPIC_API_KEY в .env');
      const model = o.deep ? settings.deepModel : settings.model;
      st.chatInFlight.add(lock); // ставим до первого await, чтобы второй запрос сразу увидел занятость
      // Вопрос засчитывается и пауза ставится только после ответа: ошибка API не съедает лимит
      const done = () => { lastAskAt.set(uk || '', clock()); countAsk(uk, now); };
      try {
        // Явная попытка подменить правила или вытащить промпт: отвечаем сами, без вызова ИИ и без расходов
        if (isInjection(q)) {
          const entry = { at: now, q, a: REFUSAL, model: 'local', usd: 0, ms: 0, tools: [], blocked: true, ...(view ? { who: `${view.name}${view.profile ? ` (${view.profile})` : ''}` } : {}), ...(uk ? { user: uk } : {}) };
          done();
          st.chat.push(entry);
          st.chat = st.chat.slice(-90);
          save();
          bus.emit('chat', entry);
          return entry;
        }
        const c = await getClient();
        // Вопрос про чужой профиль: своя сводка и свои инструменты, история чата только про этого игрока
        const who = view ? `${view.name}${view.profile ? ` (${view.profile})` : ''}` : null;
        const digest = view
          ? (view.self
            ? tx`Это профиль игрока ${who}, вопрос задаёт он сам. Отвечай ему про его профиль.\n${buildDigest(view.member, view.analysis, digestOpt())}`
            : tx`Это НЕ профиль пользователя, а профиль его друга ${who}. Отвечай про этого игрока.\n${buildDigest(view.member, view.analysis, digestOpt())}`)
          : freshDigest();
        const vkey = view ? viewKeyOf(view) : ownKey();
        const digestG = digest + goalBlock(vkey, view ? view.member : st.member);
        const h = view
          ? makeToolHandlers({ ...deps, getAnalysis: () => view.analysis, getMember: () => view.member, ...(view.self ? { setGoal: goalSetter(vkey, view.member) } : {}) })
          : (uk ? handlers : ownerHandlers);
        const history = st.chat.filter(e => (e.who || null) === who && (e.user || null) === uk);
        const t0 = Date.now();
        // Haiku думает мало (effort low) и делает не больше 2 раундов инструментов: ответ за секунды. «Подробнее» глубже.
        // Пока идёт ответ, владелец может удалить или переименовать друга: запись должна пойти за ником
        const rec = { uk, gone: false };
        pendingAsks.add(rec);
        let r;
        try { r = await askChat(c, { model, digest: digestG, history, question: q, handlers: h, effort: o.deep ? 'medium' : 'low', maxToolRounds: o.deep ? 3 : 2, maxTokens: o.deep ? 2000 : 1200, onEvent: o.onEvent, lang: o.lang === 'en' ? 'en' : 'ru' }); } finally { pendingAsks.delete(rec); }
        const ms = Date.now() - t0;
        const usd = budget.record('chat', r.usage, model, now);
        if (rec.gone) {
          // Аккаунт удалили во время ответа: ответ отдаём, но в историю и счётчики удалённого ника не пишем
          save();
          return { at: now, q, a: linkItems(r.answer, deps), model: r.model, usd, ms, tools: r.toolCalls.map(t => t.name) };
        }
        uk = rec.uk;
        recordUser(uk, usd, now);
        // Ответа так и не получилось: деньги учтены, но вопрос не засчитан и в историю не пишется — можно повторить
        if (r.empty) { save(); const err = new Error(r.error); err.retry = true; err.empty = true; throw err; }
        done();
        console.log(`[live-advisor] чат: ${r.model}, ${(ms / 1000).toFixed(1)} с, инструменты: ${r.toolCalls.map(t => t.name).join(', ') || 'нет'}, $${Number(usd || 0).toFixed(4)}`);
        const entry = { at: now, q, a: linkItems(r.answer, deps), model: r.model, usd, ms, tools: r.toolCalls.map(t => t.name), ...(who ? { who } : {}), ...(uk ? { user: uk } : {}), ...(r.error ? { error: r.error } : {}) };
        st.chat.push(entry);
        st.chat = st.chat.slice(-90);
        save();
        bus.emit('chat', entry);
        return entry;
      } catch (e) {
        if (e?.empty) throw e;
        if (e?.usage && Object.keys(e.usage).length) { recordUser(uk, budget.record('chat', e.usage, model, now), now); save(); }
        throw new Error(explainError(e, Anthropic));
      } finally {
        st.chatInFlight.delete(lock);
      }
    },

    /** Аккаунт друга удалён: стираем его чат и счётчики (новый человек с тем же ником начнёт с чистого листа) */
    forgetUser(name) {
      const uk = String(name || '').toLowerCase();
      if (!uk) return 0;
      const before = st.chat.length;
      st.chat = st.chat.filter(e => e.user !== uk);
      for (const m of [userSpend, userAsks]) for (const d of Object.keys(m)) Reflect.deleteProperty(m[d], uk);
      lastAskAt.delete(uk);
      for (const rec of pendingAsks) if (rec.uk === uk) rec.gone = true;
      save();
      return before - st.chat.length;
    },
    /** Владелец исправил ник друга: чат и счётчики переезжают на новый ник */
    renameUser(oldName, newName) {
      const a = String(oldName || '').toLowerCase(), b = String(newName || '').toLowerCase();
      if (!a || !b || a === b) return;
      for (const e of st.chat) if (e.user === a) e.user = b;
      for (const rec of pendingAsks) if (rec.uk === a) rec.uk = b;
      for (const m of [userSpend, userAsks]) for (const d of Object.keys(m)) {
        if (Object.hasOwn(m[d], a)) { m[d][b] = (m[d][b] || 0) + m[d][a]; Reflect.deleteProperty(m[d], a); }
      }
      save();
    },

    /** Убрать цель: владелец — со своего профиля, друг — со своего (view.self) */
    clearGoal(user, view) {
      const key = view ? (view.self ? viewKeyOf(view) : null) : (ukey(user) ? null : ownKey());
      if (!key) throw new Error('Цель можно убрать только со своего профиля');
      Reflect.deleteProperty(st.goals, key);
      save();
      return true;
    },

    /** Очистить свой чат (друг чистит только свои вопросы) */
    clearChat(user) { const uk = ukey(user); st.chat = st.chat.filter(e => (e.user || null) !== uk); save(); },

    /** Часть состояния про открытый чужой профиль: его совет, готовится ли новый, почему не делается сам */
    viewState(view, user) {
      const key = viewKeyOf(view);
      const advice = st.viewAdvice.get(key) || null;
      return {
        advice, adviceHistory: [], adviceFor: whoOf(view), viewSelf: !!view.self, coopMate: !!view.coopMate,
        goal: goalProgress(goalOf(key), view.member), canGoal: !!view.self,
        busy: st.viewBusy.has(key), error: st.viewErrors.get(key) || null,
        autoNote: st.viewBusy.has(key) ? null : viewAutoReason(view, user),
      };
    },

    /** Настройки с сайта: { enabled, dailyUsd, model, deepModel, minIntervalMin, minScore } */
    setSettings(p = {}) {
      if (typeof p.enabled === 'boolean') settings.enabled = p.enabled;
      if (p.dailyUsd != null) budget.dailyUsd = Math.max(0, Math.min(10, Number(p.dailyUsd) || 0));
      if (p.model && PRICING[p.model]) settings.model = p.model;
      if (p.deepModel && PRICING[p.deepModel]) settings.deepModel = p.deepModel;
      if (p.minIntervalMin != null) settings.trigger.minIntervalMs = Math.max(1, Number(p.minIntervalMin)) * MIN;
      if (p.minScore != null) settings.trigger.minScore = Math.max(0.5, Number(p.minScore));
      save();
      return this.getState();
    },

    /** Всё для экрана советчика на сайте. user — друг: только его чат и его лимит, без автосоветов владельца */
    getState(user, view) {
      const lc = st.lastCheck;
      const uk = ukey(user);
      const vs = view?.member ? this.viewState(view, user) : null;
      if (vs && !uk) {
        // Владелец смотрит чужой профиль: совет и чат про этого игрока, бюджет и настройки — свои
        const base = this.getState();
        return { ...base, ...vs, pending: null, chat: st.chat.filter(e => !e.user && e.who === vs.adviceFor).slice(-20) };
      }
      if (uk) {
        const now = clock();
        const month = dayOf(now).slice(0, 7);
        const spent = spentBy(uk, now), limit = limitOf(user);
        const limitQ = user?.dailyQuestions ?? askLimits.friend;
        return {
          mode: !hasAi() ? 'free' : settings.enabled ? 'live' : 'off', friend: true,
          questions: { limit: limitQ, left: Math.max(0, limitQ - asksBy(uk, now)) },
          model: settings.model, deepModel: settings.deepModel,
          advice: null, adviceHistory: [], pending: null,
          chat: st.chat.filter(e => e.user === uk).slice(-20),
          budget: { dailyUsd: limit, today: { usd: +spent.toFixed(5) }, leftUsd: +Math.max(0, Math.min(limit - spent, budget.summary(now).leftUsd)).toFixed(5),
            monthUsd: +Object.entries(userSpend).filter(([k]) => k.slice(0, 7) === month).reduce((a, [, v]) => a + num(own(v, uk)), 0).toFixed(4), autoPaused: true },
          busy: false, error: null,
          ...(vs || {}), // друг видит совет по открытому профилю (своему или чужому), оплачен из его лимита
        };
      }
      return {
        mode: !hasAi() ? 'free' : settings.enabled ? 'live' : 'off',
        model: settings.model, deepModel: settings.deepModel,
        trigger: { minScore: settings.trigger.minScore, minIntervalMin: Math.round(settings.trigger.minIntervalMs / MIN) },
        advice: st.advice,
        goal: st.member ? goalProgress(goalOf(ownKey()), st.member) : null, canGoal: true,
        adviceHistory: st.adviceHistory.slice(0, 10).map(a => ({ at: a.at, headline: a.headline, usd: a.usd, ...(a.en?.headline ? { en: { headline: a.en.headline } } : {}) })),
        pending: lc ? { at: lc.at, score: +lc.score.toFixed(1), reason: lc.reason, events: lc.events.map(e => e.text) } : null,
        chat: st.chat.filter(e => !e.user).slice(-20),
        budget: budget.summary(clock()),
        busy: !!st.inFlight,
        error: st.error,
      };
    },
  };
}
