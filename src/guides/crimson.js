// Гайд «Crimson Isle»: фракция и репутация, ежедневные дела, Dojo по испытаниям, пояса, мини-боссы, Matriarch, ключи Kuudra.
// Kuudra целиком — в своём гайде (kuudra.js); здесь только то, что нужно для репутации и ключей.
import { petLadderSection } from './pets.js';
import { KUUDRA_TIERS } from './combat/data.js';
import { num, plural, sortNext } from './combat/util.js';
import { DOJO_TESTS, DOJO_RANKS, dojoState, BELTS, FACTIONS, FACTION_TITLES, KUUDRA_KEYS, QUEST_TYPES, MINIBOSSES } from './crimson-data.js';
import { tx } from '../../i18n/msg.js';

const RANK_TONE = { S: 'good', A: 'good', B: 'warn', C: 'warn', D: 'bad', F: 'bad' };
const HOUR = 3600_000;

/** Лучший пояс Dojo, который есть у игрока (индекс в BELTS или -1). */
export function bestBelt(ctx) {
  for (let i = BELTS.length - 1; i >= 0; i--) if (ctx.has(BELTS[i].id)) return i;
  return -1;
}

export function build(m, ctx) {
  const c = m.crimson || {};
  const f = FACTIONS[c.faction] || null;
  const rep = Math.max(c.barbarianRep || 0, c.mageRep || 0);
  const otherRep = c.faction === 'mages' ? c.barbarianRep || 0 : c.mageRep || 0;
  const k = c.kuudra || {};
  const combat = m.skills?.combat?.level || 0;
  const dojo = dojoState(c.dojo);
  const belt = bestBelt(ctx);
  const nextTier = KUUDRA_TIERS.find(t => rep < t.rep);
  const kuudraRuns = KUUDRA_TIERS.reduce((s, t) => s + (k[t.key] || 0), 0);
  const next = [];

  // ---------- что делать дальше ----------
  if (combat < 24) {
    next.push({ priority: 95, title: tx`Подними Combat до 24 (сейчас ${combat}): без него на Crimson Isle не пустят`,
      why: 'Вход на остров открывается с Combat 24. Быстрее всего — слееры и данжи.' });
  } else if (!f) {
    next.push({ priority: 92, title: 'Пройди начало квеста Elle и выбери фракцию',
      why: 'Без фракции нет ежедневных квестов, а значит и репутации: она открывает тиры Kuudra и магазин фракции.' });
  }
  if (f && nextTier) {
    next.push({ priority: 84, title: tx`Каждый день — 5 квестов фракции: ${num(rep)} → ${num(nextTier.rep)} реп. (Kuudra ${nextTier.name})`,
      why: tx`Не хватает ${num(nextTier.rep - rep)}. Квесты берутся на доске в Community Center, город ${f.town}. Сначала те, что делаются за минуты: мини-босс, принести предметы, Dojo.` });
  }
  const weak = dojo.tests.filter(t => t.points < 1000).sort((a, b) => a.points - b.points);
  if (combat >= 24 && dojo.tried < DOJO_TESTS.length) {
    const missing = dojo.tests.filter(t => !t.tried).map(t => t.name);
    next.push({ priority: 58, title: tx`Пройди испытания Dojo, которых ещё не было: ${missing.join(', ')}`,
      why: 'Каждое испытание идёт в общий счёт для пояса, а квесты фракции «Dojo» требуют минимальный ранг.' });
  } else if (weak.length) {
    const w = weak[0];
    next.push({ priority: 40, title: tx`Dojo: подтяни ${w.name} (${num(w.points)}, ранг ${w.rank}) до ${w.next ? tx`${w.next[0]} — ${num(w.next[1])}` : 'S'}`,
      why: tx`Самое слабое испытание даёт больше всего очков за попытку. Совет: ${w.tip}` });
  }
  if (belt < BELTS.length - 1 && dojo.tried === DOJO_TESTS.length) {
    const nb = BELTS[belt + 1];
    const ready = dojo.total >= nb.points;
    next.push({ priority: ready ? 60 : 34, title: belt < 0 ? 'Забери пояс у Master Tao в Dojo' : ready ? tx`Забери ${nb.name} Belt у Master Tao: очков уже хватает` : tx`Следующий пояс: ${nb.name} — ${num(nb.points)} очков (у тебя ${num(dojo.total)})`,
      why: tx`Пояс — отдельный слот экипировки: ${nb.stats}${nb.xp ? tx`, плюс ${num(nb.xp)} опыта Combat` : ''}. Чёрный пояс — 7000 очков, то есть S (1000+) во всех семи испытаниях.` });
  }
  if (f && rep >= 1000 && !kuudraRuns) {
    next.push({ priority: 70, title: 'Сходи на Kuudra: тир Hot уже открыт по репутации', why: 'Kuudra — главный источник эссенции Crimson и Kuudra Teeth. Подробности в гайде Kuudra.' });
  }

  // ---------- секции ----------
  const repRows = KUUDRA_TIERS.map(t => {
    const ok = rep >= t.rep;
    const title = FACTION_TITLES.find(x => x.rep === t.rep);
    return [{ text: tx`Kuudra ${t.name}`, item: t.keyId }, title ? tx`${title.name} · ${title.ru}${title.sbxp ? tx` (+${title.sbxp} SkyBlock XP)` : ''}` : '—', num(t.rep),
      ok ? { text: 'хватает', tone: 'good' } : { text: tx`ещё ${num(t.rep - rep)}`, tone: nextTier === t ? 'warn' : 'muted' }];
  });

  const dailies = [
    { title: '5 квестов фракции', text: f ? tx`Доска в Community Center, город ${f.town}. Типы квестов — в таблице ниже. Награда — репутация, монеты и предметы.` : 'Откроются после выбора фракции.' },
    { title: 'Мини-боссы', text: 'Пройди круг по пяти мини-боссам: это и квест «Miniboss», и шанс на Kuudra Key. Кто убит недавно — в таблице «Мини-боссы».' },
    { title: 'Matriarch — Heavy Pearl', text: 'Matriarch в глубине вулкана выделяет 3 Heavy Pearl в реальные сутки. Жемчуг нужен на звёзды 8–10 брони Kuudra.', items: ['HEAVY_PEARL'] },
    { title: 'Kuudra своего тира', text: 'Если в квестах есть «Kuudra» — сходи на заход. Платный сундук открывается Kuudra Key своего тира.', items: ['KUUDRA_TIER_KEY'] },
  ];

  const dojoRows = dojo.tests.map(t => [
    { text: tx`${t.name} · ${t.ru}`, item: t.icon },
    t.tried ? num(t.points) : { text: 'не пройдено', tone: 'muted' },
    t.tried ? { text: t.rank, tone: RANK_TONE[t.rank] } : '—',
    t.next ? tx`${t.next[0]}: ещё ${num(t.next[1] - t.points)}` : { text: 'максимум', tone: 'good' },
    t.what,
  ]);
  const weakestI = dojo.tests.indexOf(weak[0]);

  const beltRows = BELTS.map((b, i) => [
    { text: tx`${b.name} · ${b.ru}`, item: b.id },
    b.points ? tx`${num(b.points)}${dojo.total < b.points ? tx` (ещё ${num(b.points - dojo.total)})` : ''}` : 'сразу',
    b.stats, b.xp ? tx`+${num(b.xp)}` : '—',
    i <= belt ? { text: i === belt ? 'твой пояс' : 'пройден', tone: 'good' } : { text: 'нет', tone: 'muted' },
  ]);

  const killed = new Set((c.lastMinibosses || []).map(x => String(x).toUpperCase()));
  const bossRows = MINIBOSSES.map(b => [
    b.name, b.where, b.text,
    c.lastMinibosses?.length ? (killed.has(b.id) ? { text: 'убит недавно', tone: 'good' } : { text: 'давно не убит', tone: 'warn' }) : '—',
  ]);

  const matriarchText = ['Где: глубина Blazing Volcano. В сутки (реальные) — 3 Heavy Pearl, больше не выпадет.',
    'Heavy Pearl нужен на звёзды 8–10 брони Kuudra (2–5 штук на звезду): копи заранее, даже если броня пока на низких звёздах.'];
  if (c.matriarch?.lastAttempt) {
    const ago = Math.max(0, Math.round((Date.now() - c.matriarch.lastAttempt) / HOUR));
    matriarchText.push(ago < 24 ? tx`Ты был у неё ${ago} ${plural(ago, 'час', 'часа', 'часов')} назад.` : tx`Последний визит — ${Math.round(ago / 24)} ${plural(Math.round(ago / 24), 'день', 'дня', 'дней')} назад: жемчуг ждёт.`);
  }
  if (c.matriarch?.pearls != null) matriarchText.push(tx`Собрано жемчуга за всё время: ${num(c.matriarch.pearls)}.`);

  const summary = combat < 24 ? tx`Crimson Isle закрыт: нужен Combat 24, у тебя ${combat}.`
    : !f ? 'Фракция не выбрана: начни квест у Elle.'
    : tx`${f.name}, ${num(rep)} реп.${nextTier ? tx` До Kuudra ${nextTier.name} — ${num(nextTier.rep - rep)}.` : ' Все тиры Kuudra открыты.'} Dojo: ${num(dojo.total)} очков, S-рангов ${dojo.sRanks}/7.`;

  return {
    summary,
    status: combat < 24 ? 'locked' : !f ? 'start' : (!nextTier && dojo.sRanks === 7) ? 'done' : 'progress',
    level: { label: 'Репутация фракции', value: rep, max: 12000 },
    next: sortNext(next),
    sections: [
      { kind: 'table', title: 'Репутация и тиры Kuudra', note: tx`${f ? tx`Фракция ${f.name} (${f.ru}), город ${f.town}. ` : ''}Тиры открывает репутация любой фракции.${otherRep ? tx` У второй фракции ${num(otherRep)} реп.` : ''} Сменить фракцию можно у Elle, но вся текущая репутация сгорит.`,
        columns: ['Что откроет', 'Титул фракции', 'Репутация', 'У тебя'], rows: repRows, current: nextTier ? KUUDRA_TIERS.indexOf(nextTier) : undefined },
      petLadderSection(ctx, 'crimson', { title: 'Питомцы для Crimson Isle' }),
      { kind: 'steps', title: 'Каждый день на Crimson Isle', note: 'Порядок, в котором выгоднее всего: сначала квесты (их видно на доске), остальное — по пути.', items: dailies },
      { kind: 'table', title: 'Квесты фракции', note: 'До 5 в день. Тип квеста выпадает случайно; невыгодный можно не брать.',
        columns: ['Тип', 'Что сделать'], rows: QUEST_TYPES.map(q => [q.ru === q.name ? q.name : tx`${q.name} · ${q.ru}`, q.name === 'Rescue' && f ? tx`${q.text} Тебе — ${f.rescue}.` : q.text]) },
      { kind: 'table', title: 'Dojo: испытания', note: tx`Всего ${num(dojo.total)} очков. Ранги: ${DOJO_RANKS.slice(0, -1).map(([r, p]) => tx`${r} от ${p}`).join(', ')}. Вход — с пустым инвентарём и без питомца.`,
        columns: ['Испытание', 'Очки', 'Ранг', 'До следующего', 'Что делать'], rows: dojoRows, current: weakestI >= 0 ? weakestI : undefined },
      { kind: 'checklist', title: 'Dojo: советы по испытаниям', items: dojo.tests.map(t => ({ text: tx`${t.name}: ${t.tip}`, done: t.rank === 'S' })) },
      { kind: 'table', title: 'Пояса Dojo', note: tx`Пояса выдаёт Master Tao в Dojo за сумму лучших результатов всех семи испытаний (у тебя ${num(dojo.total)}). Белый дают сразу, чёрный — за 7000, то есть S во всех семи. Каждый новый пояс — ещё и опыт Combat.`,
        columns: ['Пояс', 'Очки', 'Статы', 'Опыт Combat', 'У тебя'], rows: beltRows, current: belt < BELTS.length - 1 ? belt + 1 : undefined },
      { kind: 'table', title: 'Мини-боссы', note: c.lastMinibosses?.length ? 'Последние убитые — по данным Hypixel.' : 'С каждого — материалы и шанс на Kuudra Key. Лут почти всегда Co-op Soulbound.',
        columns: ['Босс', 'Где', 'Кто это', 'Статус'], rows: bossRows },
      { kind: 'text', title: 'Matriarch и Heavy Pearl', text: matriarchText },
      { kind: 'table', title: 'Где брать Kuudra Key', note: tx`Ключ привязан к профилю (Co-op Soulbound): на аукционе его нет. Покупка у Emissary в городе фракции (${f ? tx`тебе — ${f.name === 'Mages' ? 'Mage Emissary, Enchanted Mycelium' : 'Barbarian Emissary, Enchanted Red Sand'}` : 'Barbarians платят Enchanted Red Sand, Mages — Enchanted Mycelium'}) открывается той же репутацией, что и тир. Ещё ключ можно скрафтить из 4 ключей тира ниже, выловить в лаве Crimson Isle как сокровище или выбить с мини-босса. Nether Star падает с Vanquisher: редкий иссушитель, который иногда появляется после убийства моба на острове.`,
        columns: ['Ключ', 'У Emissary', 'С мини-босса'],
        rows: KUUDRA_KEYS.map(k => { const t = KUUDRA_TIERS.find(x => x.key === k.tier); return [
          { text: tx`Kuudra ${t.name}`, item: t.keyId },
          tx`${k.mat} ${f?.name === 'Mages' ? 'Ench. Mycelium' : f?.name === 'Barbarians' ? 'Ench. Red Sand' : 'Ench. Red Sand / Mycelium'} + 2 Nether Star + ${num(k.coins)} монет`,
          k.drop || '—',
        ]; }) },
    ],
  };
}

export default { id: 'crimson', title: 'Crimson Isle', icon: 'HEAVY_PEARL', group: 'combat', build };
