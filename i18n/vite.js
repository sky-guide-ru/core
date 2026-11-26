// Плагин сборки: русский текст в client/src → вызовы перевода (см. i18n/scan.js и client/src/i18n.js).
// Русская версия работает как прежде (функции возвращают тот же текст), английская берёт словарь virtual:i18n-en —
// отдельным куском, который скачивают только на /en/.
import fs from 'node:fs';
import path from 'node:path';
import { scan, keysOf } from './scan.js';
import { loadDict } from './dict.js';

// Исходники сайта: по умолчанию src/ в папке, где запущена сборка (репо web)
const CLIENT = path.resolve(process.env.I18N_CLIENT_SRC || path.join(process.cwd(), 'src'));
const RUNTIME = path.join(CLIENT, 'i18n.js');
const VIRTUAL = 'virtual:i18n-en', RESOLVED = '\0virtual:i18n-en';

/** Переписать исходник: каждое место — вызов перевода, вложенные места — внутри вставок */
export function rewrite(code, filename) {
  const { sites, error } = scan(code, filename);
  if (error) throw new Error(`[i18n] ${filename}: ${error}`);
  if (!sites.length) return null;
  const J = JSON.stringify;
  const slice = (start, end, inner) => {
    let out = '', at = start;
    for (const s of inner.filter(s => s.start >= start && s.end <= end).sort((a, b) => a.start - b.start)) {
      if (s.start < at) continue;
      out += code.slice(at, s.start) + render(s);
      at = s.end;
    }
    return out + code.slice(at, end);
  };
  const vals = s => `[${s.vals.map(v => slice(v.start, v.end, s.inner || [])).join(', ')}]`;
  function render(s) {
    switch (s.kind) {
      case 'str': return `__t(${J(s.key)})`;
      case 'attr': return `{__t(${J(s.key)})}`;
      case 'tpl': return `__tt(${J(s.key)}, ${vals(s)})`;
      case 'jsx': return s.stringOnly ? `{__tt(${J(s.key)}, ${vals(s)})}` : `{__tj(${J(s.key)}, ${vals(s)})}`;
    }
    return code.slice(s.start, s.end);
  }
  const body = slice(0, code.length, sites);
  return `import { __t, __tt, __tj } from ${J(RUNTIME.replace(/\\/g, '/'))};\n${body}`;
}

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|jsx)$/.test(e.name) ? [path.join(d, e.name)] : []));
export function clientKeys() {
  const keys = new Set();
  for (const f of walk(CLIENT)) { if (f === RUNTIME) continue; for (const k of keysOf(scan(fs.readFileSync(f, 'utf8'), f).sites)) keys.add(k.key); }
  return keys;
}

export default function i18nPlugin() {
  return {
    name: 'sb-i18n',
    enforce: 'pre',
    resolveId(id) { return id === VIRTUAL ? RESOLVED : null; },
    load(id) {
      if (id !== RESOLVED) return null;
      const dict = loadDict(), keys = clientKeys(), out = {};
      for (const k of keys) if (dict[k]) out[k] = dict[k];
      return `export default ${JSON.stringify(out)};`;
    },
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.startsWith(CLIENT) || file === RUNTIME || !/\.(js|jsx)$/.test(file)) return null;
      const out = rewrite(code, file);
      return out == null ? null : { code: out, map: null };
    },
  };
}
