// Границы ядра: core не знает про HTTP, а публичный вход (src/index.js) — чистые расчёты без диска, сети,
// process.env и таймеров. Если тест упал, значит в чистый модуль попал импорт серверного слоя:
// передай нужное параметром или оставь функцию в серверном слое (docs/architecture.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = f => path.relative(root, f).split(path.sep).join('/');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'data', 'test-run', 'en', 'todo'].includes(e.name)) walk(p, out); }
    else if (/\.m?js$/.test(e.name)) out.push(p);
  }
  return out;
}
const SOURCES = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'i18n'))];

// Что делает модуль серверным: диск, потоки, сеть, окружение, таймеры, загрузка настроек
const SERVER = [
  [/from\s+['"]node:(fs|fs\/promises|worker_threads|child_process|net|http|https|async_hooks|os)['"]/, 'модуль Node'],
  [/\bfetch\(/, 'сеть (fetch)'],
  [/process\.env/, 'process.env'],
  [/\bset(Interval|Timeout)\(/, 'таймер'],
];
const SERVER_FILES = new Set(['src/config.js', 'src/http.js', 'src/hypixel.js', 'src/neu.js', 'src/prices.js', 'src/state.js']);

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const cache = new Map();
function info(file) {
  if (cache.has(file)) return cache.get(file);
  const src = strip(fs.readFileSync(file, 'utf8'));
  const deps = [];
  for (const m of src.matchAll(/(?:\bfrom|\bimport\s*\(|^\s*import)\s*['"](\.[^'"]+)['"]/gm)) {
    const p = path.resolve(path.dirname(file), m[1]);
    if (fs.existsSync(p)) deps.push(p);
  }
  const why = SERVER.filter(([re]) => re.test(src)).map(([, w]) => w);
  if (SERVER_FILES.has(rel(file))) why.push('серверный модуль');
  const r = { deps, why };
  cache.set(file, r);
  return r;
}
function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const d of info(file).deps) closure(d, seen);
  return seen;
}

test('публичный вход src/index.js не тянет диск, сеть, process.env и таймеры', () => {
  const bad = [...closure(path.join(root, 'src/index.js'))]
    .filter(f => info(f).why.length)
    .map(f => `${rel(f)}: ${info(f).why.join(', ')}`);
  assert.deepEqual(bad, [], `в чистый слой попал серверный код:\n${bad.join('\n')}`);
});

test('публичный вход загружается и отдаёт непустые разделы', async () => {
  const core = await import('../src/index.js');
  const empty = Object.entries(core).filter(([, ns]) => !Object.keys(ns).length).map(([k]) => k);
  assert.ok(Object.keys(core).length > 20);
  assert.deepEqual(empty, []);
  assert.equal(typeof core.calendar.calendarView, 'function');
  assert.equal(typeof core.flips.bazaarFlips, 'function');
});

test('core не знает про HTTP: нет express и регистрации маршрутов', () => {
  const bad = SOURCES.filter(f => {
    const s = strip(fs.readFileSync(f, 'utf8'));
    return /from\s+['"]express['"]|require\(['"]express['"]\)|\b(app|router)\.(get|post|put|delete|use)\(|\bmount[A-Z]\w*Routes\b/.test(s);
  }).map(rel);
  assert.deepEqual(bad, []);
});

test('в зависимостях нет серверных пакетов', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  const server = deps.filter(d => /^(express|dotenv|@anthropic-ai\/sdk|mmdb-lib|nodemailer)$/.test(d));
  assert.deepEqual(server, [], 'серверный пакет ставит api, а core получает готовое параметром');
  assert.equal(pkg.exports['.'], './src/index.js');
});

test('публичный вход собирается для браузера без модулей Node', async t => {
  let rolldown;
  try { ({ rolldown } = await import('rolldown')); } catch { return t.skip('rolldown не установлен'); }
  const warnings = [];
  const bundle = await rolldown({ input: path.join(root, 'src/index.js'), platform: 'browser', onLog: (lvl, log) => warnings.push(log.message) });
  const { output } = await bundle.generate({ format: 'esm' });
  await bundle.close?.();
  const unresolved = warnings.filter(w => /resolve/i.test(w));
  assert.deepEqual(unresolved, []);
  assert.ok(!/from\s*['"]node:/.test(output[0].code));
});
