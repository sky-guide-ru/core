// Выпуск версий (запускает .github/workflows/release.yml после слияния в main).
// Для каждой версии из CHANGELOG.md («## X.Y.Z»), у которой ещё нет тега vX.Y.Z:
// находит коммит, где package.json получил эту версию, ставит тег и создаёт GitHub Release с текстом раздела.
// Проверить без выпуска: node scripts/release.mjs --dry
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const dry = process.argv.includes('--dry');
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const sections = new Map();
for (const part of changelog.split(/^## /m).slice(1)) {
  const [head, ...body] = part.split('\n');
  const m = head.trim().match(/^(\d+\.\d+\.\d+)$/);
  if (m) sections.set(m[1], body.join('\n').trim());
}

const current = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
if (!sections.has(current)) {
  console.error(`В CHANGELOG.md нет раздела «## ${current}» для версии из package.json`);
  process.exit(1);
}

sh('git', ['fetch', '--tags', '--quiet']);
const tags = new Set(sh('git', ['tag', '--list', 'v*']).split('\n').filter(Boolean));

for (const [version, notes] of [...sections].reverse()) { // старые первыми
  const tag = `v${version}`;
  if (tags.has(tag)) continue;
  // Самый старый коммит main, где в package.json стоит эта версия
  const sha = sh('git', ['log', '--reverse', '--first-parent', '--format=%H', '-S', `"version": "${version}"`, 'HEAD', '--', 'package.json']).split('\n')[0];
  if (!sha) { console.log(`${tag}: версия ни разу не стояла в package.json, пропускаю`); continue; }
  console.log(`${tag} → ${sha.slice(0, 7)}`);
  if (dry) continue;
  const file = `.release-${version}.md`;
  fs.writeFileSync(file, notes || `Версия ${version}`);
  sh('gh', ['release', 'create', tag, '--target', sha, '--title', tag, '--notes-file', file, ...(version === current ? ['--latest'] : [])]);
  fs.unlinkSync(file);
}
