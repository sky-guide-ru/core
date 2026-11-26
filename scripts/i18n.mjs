// Словарь английской версии: что ещё не переведено.
//   node scripts/i18n.mjs            — сводка: сколько строк переведено по файлам
//   node scripts/i18n.mjs todo [N]   — записать i18n/todo/*.json: непереведённые строки (по исходным файлам)
//   node scripts/i18n.mjs unused     — переводы, которых больше нет в исходниках
// Перевод кладётся в i18n/en/<файл>.json как { "русский текст": "English text" }.
import fs from 'node:fs';
import path from 'node:path';
import { scan, keysOf } from '../i18n/scan.js';
import { loadDict } from '../i18n/dict.js';
import { SOURCES, EXCLUDE, DATA, dataStrings, groupOf } from '../i18n/sources.js';

const root = path.resolve(import.meta.dirname, '..');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? (['test', 'node_modules', 'data'].includes(e.name) ? [] : walk(path.join(d, e.name))) : /\.(m?js|jsx)$/.test(e.name) ? [path.join(d, e.name)] : []));

export function collect() {
  const keys = new Map(); // key → { file, kind }
  for (const src of SOURCES.filter(s => fs.existsSync(path.join(root, s)))) for (const f of walk(path.join(root, src)).sort()) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (EXCLUDE.some(x => rel.startsWith(x))) continue;
    for (const k of keysOf(scan(fs.readFileSync(f, 'utf8'), f).sites)) if (!keys.has(k.key)) keys.set(k.key, { file: rel, kind: k.kind });
  }
  for (const rel of DATA) for (const s of dataStrings(JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')))) if (!keys.has(s)) keys.set(s, { file: rel.replace(/\.json$/, '.js'), kind: 'str' });
  return keys;
}

const cmd = process.argv[2] || 'stat';
const keys = collect();
const dict = loadDict();
if (cmd === 'stat') {
  const per = new Map();
  for (const [k, v] of keys) { const g = per.get(v.file) || { n: 0, done: 0, chars: 0 }; g.n++; if (dict[k]) g.done++; else g.chars += k.length; per.set(v.file, g); }
  let n = 0, done = 0, chars = 0;
  for (const [f, g] of [...per].sort((a, b) => b[1].chars - a[1].chars)) { n += g.n; done += g.done; chars += g.chars; if (g.done < g.n) console.log(`${String(g.n - g.done).padStart(5)} строк, ${String(g.chars).padStart(6)} зн.  ${f}`); }
  console.log(`\nПереведено ${done} из ${n} (${Math.round(done / n * 100)}%), осталось ${chars} знаков`);
} else if (cmd === 'todo') {
  const out = path.join(root, 'i18n', 'todo');
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const by = new Map();
  for (const [k, v] of keys) if (!dict[k]) { const g = groupOf(v.file); (by.get(g) || by.set(g, {}).get(g))[k] = ''; }
  // Для перевода: «номер<TAB>текст» (текст в JSON-кавычках, переносы как \n); ответ — тем же форматом в put
  for (const [g, o] of by) fs.writeFileSync(path.join(out, `${g}.txt`), Object.keys(o).map((k, i) => `${i + 1}\t${JSON.stringify(k)}`).join('\n') + '\n');
  console.log(`i18n/todo: ${by.size} файлов`);
} else if (cmd === 'put') {
  // node scripts/i18n.mjs put <файл> — дописать перевод в i18n/en/<группа>.json.
  // В файле: строка «@@ группа», затем строки «номер<TAB>перевод»; групп может быть несколько
  const file = process.argv[3];
  const sections = fs.readFileSync(file, 'utf8').split(/^@@ +/m).filter(x => x.trim());
  for (const sec of sections) {
    const nl = sec.indexOf('\n');
    putGroup(sec.slice(0, nl).trim(), sec.slice(nl + 1));
  }
}
function putGroup(g, text) {
  const todo = fs.readFileSync(path.join(root, 'i18n', 'todo', `${g}.txt`), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l.slice(l.indexOf('\t') + 1)));
  const dst = path.join(root, 'i18n', 'en', `${g}.json`);
  const cur = fs.existsSync(dst) ? JSON.parse(fs.readFileSync(dst, 'utf8')) : {};
  let n = 0, bad = 0;
  for (const line of text.split('\n')) {
    const m = /^(\d+)\t(.*)$/.exec(line);
    if (!m) continue;
    const ru = todo[+m[1] - 1];
    let en = m[2];
    if (/^".*"$/.test(en)) { try { en = JSON.parse(en); } catch { /* обычный текст в кавычках */ } }
    if (ru == null || !en) { bad++; continue; }
    const ph = s => (s.match(/\{\d+\}/g) || []).sort().join();
    if (ph(ru) !== ph(en)) { console.warn(`вставки не совпадают #${m[1]}: ${ru.slice(0, 60)} → ${en.slice(0, 60)}`); bad++; continue; }
    cur[ru] = en; n++;
  }
  fs.writeFileSync(dst, JSON.stringify(cur, null, 1) + '\n');
  console.log(`${g}: +${n}${bad ? `, пропущено ${bad}` : ''}, без перевода ${todo.filter(k => !cur[k]).length}`);
}
if (cmd === 'unused') {
  const extra = Object.keys(dict).filter(k => !keys.has(k));
  console.log(extra.length, 'лишних'); for (const k of extra.slice(0, 50)) console.log(' ', k.slice(0, 100));
}
