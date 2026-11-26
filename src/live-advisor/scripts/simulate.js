#!/usr/bin/env node
// Тестовый прогон «живого советчика» на симуляции: профиль OwnerCat прокачивается, цены прыгают,
// раз в «минуту» ядро присылает обновление. Показывает, когда сторож зовёт ИИ, что тот советует и сколько это стоит.
//
//   node scripts/simulate.js            — без ключа, поддельный клиент (токены оцениваются приблизительно)
//   node scripts/simulate.js --live     — настоящий Claude через ANTHROPIC_API_KEY (стоит ~1 цент)
//   node scripts/simulate.js --minutes 480 --out ./test-run
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLiveAdvisor, createMockClient } from '../index.js';
import { fmtCoins, fmtTime } from '../lib/util.js';
import { tx } from '../../../i18n/msg.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const LIVE = flag('--live');
const MINUTES = Number(val('--minutes', 240));
const OUT = path.resolve(val('--out', path.join(here, '..', 'test-run')));
const ADVISOR = path.resolve(val('--advisor', path.join(here, '..', '..', 'advisor')));

const { advise } = await import(path.join(ADVISOR, 'index.js'));
// фикстура профиля: в папке модулей лежит у advisor, в репозитории трекера — в server/test/fixtures
const FIXTURE = val('--fixture', [path.join(ADVISOR, 'test', 'fixtures', 'ownercat.js'), path.join(here, '..', '..', '..', 'test', 'fixtures', 'ownercat.js')].find(f => fs.existsSync(f)));
const { ownercatMember, PRICES } = await import(FIXTURE);

// ---------- симулированный мир ----------
let now = Date.UTC(2026, 10, 22, 14, 0); // 19:00 по Екатеринбургу
const clock = () => now;
const m = ownercatMember();
const prices = { ...PRICES, KISMET_FEATHER: 1_900_000, FIRST_MASTER_STAR: 9_000_000, KUUDRA_TEETH: 9_000, ESSENCE_CRIMSON: 1_400 };
const NAMES = { FIREDUST_DAGGER: 'Firedust Dagger', MAWDUST_DAGGER: 'Twilight Dagger', TERMINATOR: 'Terminator', KISMET_FEATHER: 'Kismet Feather', FIRST_MASTER_STAR: 'First Master Star', RECOMBOBULATOR_3000: 'Recombobulator 3000', KUUDRA_TEETH: 'Kuudra Teeth' };
const methods = [
  { title: 'Фарм в Garden (Nether Wart)', available: true, coinsPerHour: 18_000_000, tag: 'live' },
  { title: 'Kuudra Hot', available: true, coinsPerHour: 9_000_000, tag: 'estimate' },
  { title: 'Флипы Bazaar', available: true, coinsPerHour: 4_000_000, tag: 'live' },
];
const analyze = () => ({ ...advise(m, null, null, { price: id => prices[id] || 0, itemName: id => NAMES[id] || id, now }), methods });

// Сценарий: что происходит в игре на N-й минуте
const SCRIPT = {
  20: ['Начал Inferno Demonlord: слеер блейза 0 → 1', () => { Object.assign(m.slayers.blaze, { level: 1, xp: 10 }); }],
  45: ['Блейз-слеер 1 → 2', () => { Object.assign(m.slayers.blaze, { level: 2, xp: 30 }); }],
  70: ['Первое прохождение M1', () => { m.dungeons.masterFloors = { 1: 1 }; }],
  100: ['Firedust Dagger подешевел на 30% на аукционе', () => { prices.FIREDUST_DAGGER = 1_400_000; }],
  130: ['Продал предмет: +120M в Bank', () => { m.bank += 120_000_000; }],
  160: ['Купил аксессуары: MP 1009 → 1031', () => { m.magicalPower = 1031; }],
  200: ['Catacombs 27 → 28', () => { m.dungeons.catacombs.level = 28; m.dungeons.catacombs.progress = 0.02; }],
};
const QUESTIONS = {
  50: ['Что мне делать с блейз-слеером дальше и какое оружие брать?', false],
  210: ['Стоит ли мне копить на Terminator или сначала вкачать что-то другое?', true],
};

// ---------- советчик ----------
let client;
if (LIVE) {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('Нужен ANTHROPIC_API_KEY в окружении (или node --env-file=.env …)'); process.exit(1); }
} else client = createMockClient({ clock });

fs.mkdirSync(OUT, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(OUT, '.state-'));
const live = createLiveAdvisor({
  client, apiKey: LIVE ? process.env.ANTHROPIC_API_KEY : undefined, clock, dataDir, tz: 'Europe/Moscow',
  deps: { priceOf: id => prices[id] || 0, itemName: id => NAMES[id] || id },
});

const log = [];
const L = s => { log.push(s); console.log(s); };
L(tx`# Тестовый прогон живого советчика (${LIVE ? 'настоящий Claude' : 'симуляция без ключа'})`);
L(tx`Модель: ${live.settings.model}, лимит $${live.getState().budget.dailyUsd}/день, симулируем ${MINUTES} мин, обновление каждую минуту.\n`);

let checks = 0, calls = 0, skipped = 0;
for (let t = 0; t < MINUTES; t++) {
  now += 60_000;
  // фоновая прокачка: бой и деньги с фарма
  m.skills.combat.progress = Math.min(0.999, m.skills.combat.progress + 0.004);
  m.bank += 300_000;
  if (SCRIPT[t]) { L(tx`\n**${fmtTime(now)} [мин ${t}] В игре:** ${SCRIPT[t][0]}`); SCRIPT[t][1](); }

  const { check, advice } = await live.update({ member: m, analysis: analyze() });
  checks++;
  if (advice && check.call) {
    calls++;
    const a = live.getState().advice;
    L(tx`\n### ${fmtTime(now)} [мин ${t}] Вызван ИИ: ${check.reason}`);
    L(tx`Изменения: ${check.events.map(e => e.text).join('; ')}`);
    L(`> **${a.headline}**`);
    for (const f of a.facts || []) L(`> • ${f}`);
    if (a.goal) L(tx`> Цель: ${a.goal}`);
    L(tx`Стоимость: $${a.usd.toFixed(5)}`);
  } else {
    skipped++;
    if (check.events.length && t % 15 === 0) L(tx`- ${fmtTime(now)} [мин ${t}] сторож: ${check.reason}`);
  }

  if (QUESTIONS[t]) {
    const [q, deep] = QUESTIONS[t];
    const e = await live.ask(q, { deep });
    L(tx`\n### ${fmtTime(now)} [мин ${t}] Вопрос в чате${deep ? ' (подробно, ' + live.settings.deepModel + ')' : ''}: «${q}»`);
    L(tx`Инструменты: ${e.tools.join(', ') || 'нет'}`);
    L(`> ${e.a.replace(/\n/g, '\n> ')}`);
    L(tx`Стоимость: $${e.usd.toFixed(5)}`);
  }
}

const b = live.getState().budget;
const days = JSON.parse(fs.readFileSync(path.join(dataDir, 'live-advisor.json'), 'utf8')).budget.days;
const tot = Object.values(days).reduce((a, d) => { for (const k of ['usd', 'input', 'output', 'cacheRead', 'cacheWrite']) a[k] = (a[k] || 0) + d[k]; return a; }, {});
L(`\n## Итог`);
L(tx`Проверок сторожем: ${checks} (бесплатно). Вызовов ИИ для автосоветов: ${calls}, пропущено: ${skipped}. Вопросов в чате: ${Object.keys(QUESTIONS).length}.`);
L(tx`Токены: вход ${tot.input}, из кэша ${tot.cacheRead}, запись в кэш ${tot.cacheWrite}, выход ${tot.output}.`);
L(tx`Потрачено за ${MINUTES / 60} ч: $${tot.usd.toFixed(4)}${LIVE ? '' : ' (оценка: токены посчитаны приблизительно)'}.`);
L(tx`Если играть так 6 часов в день: ~$${(tot.usd / (MINUTES / 60) * 6).toFixed(3)} в день, ~$${(tot.usd / (MINUTES / 60) * 6 * 30).toFixed(2)} в месяц.`);

fs.writeFileSync(path.join(OUT, LIVE ? 'report-live.md' : 'report.md'), log.join('\n') + '\n');
if (client?.log) {
  // Пример реального запроса, который ушёл бы в API (для проверки размера сводки)
  const first = client.log.find(x => x.params.output_config?.format);
  if (first) fs.writeFileSync(path.join(OUT, 'sample-request.json'), JSON.stringify(first.params, null, 2));
}
fs.rmSync(dataDir, { recursive: true, force: true });
console.log(`\nОтчёт: ${path.join(OUT, LIVE ? 'report-live.md' : 'report.md')}`);
