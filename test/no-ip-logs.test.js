// IP посетителей не попадает в журналы (решение владельца, 25.11.2026): ни в console.* сервера, ни в журнал Caddy
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function* jsFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'test' && e.name !== 'node_modules') yield* jsFiles(p); } else if (/\.m?js$/.test(e.name)) yield p;
  }
}

test('сервер не пишет IP и браузер посетителя в console', () => {
  const bad = [];
  for (const f of jsFiles(path.join(root, 'src'))) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\s\/\/ .*$/, '');
      if (/console\.(log|info|warn|error)\(/.test(code) && /\b(ip|clientIp|remoteAddress|x-forwarded-for|cf-connecting-ip|user-agent)\b/i.test(code)) bad.push(`${path.relative(root, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

