// Словарь английской версии: все i18n/en/*.json одним объектом (русский текст → английский)
import fs from 'node:fs';
import path from 'node:path';

export const EN_DIR = path.join(import.meta.dirname, 'en');

export function loadDict(dir = EN_DIR) {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort(); } catch { return out; }
  for (const f of files) {
    try { Object.assign(out, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch (e) { console.warn(`[i18n] ${f}: ${e.message}`); }
  }
  return out;
}
