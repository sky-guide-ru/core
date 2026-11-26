// Линейки улучшений аксессуаров и аксессуары без рекомба. Чистые функции, без загрузки NEU.

// Линейки улучшений аксессуаров: { младший: [все старшие] }. В NEU (misc.talisman_upgrades) у новых линеек
// бывают дыры: например, PESTHUNTER_BADGE → [RING, ARTIFACT, RELIC], но ключа PESTHUNTER_ARTIFACT → [RELIC] нет,
// и Relic не «закрывал» Artifact. Поэтому достраиваем: список старших в строке идёт по возрастанию
// (каждый следующий старше предыдущего), плюс транзитивное замыкание. Списки «цветов» одного предмета
// (Abicase, шляпы) взаимные — их порядок не трогаем.
export function buildUpgrades(raw) {
  const direct = new Map();
  const edge = (a, b) => { if (a === b) return; if (!direct.has(a)) direct.set(a, new Set()); direct.get(a).add(b); };
  for (const [low, highs] of Object.entries(raw || {})) for (const h of highs || []) edge(low, h);
  const peer = id => [...(direct.get(id) || [])].some(h => direct.get(h)?.has(id));
  for (const [low, highs] of Object.entries(raw || {})) {
    const chain = [low, ...(highs || [])];
    if (chain.some(peer)) continue;
    for (let i = 1; i < chain.length; i++) for (let j = i + 1; j < chain.length; j++) edge(chain[i], chain[j]);
  }
  // транзитивное замыкание
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, hs] of direct) for (const b of [...hs]) for (const c of direct.get(b) || []) {
      if (c !== a && !hs.has(c)) { hs.add(c); changed = true; }
    }
  }
  return Object.fromEntries([...direct].map(([k, v]) => [k, [...v]]));
}

/** Ближайшая старшая версия аксессуара (или null). */
export function nextUpgrade(id, up) {
  const highs = up?.[id] || [];
  return highs.find(h => !highs.some(o => o !== h && (up[o] || []).includes(h))) || null;
}

// Аксессуары, на которые нельзя применить Recombobulator 3000: их редкость растёт сама (за прогресс).
// SkyCrypt (constants/accessories.js, allowsRecomb: false) + новые: Beastslayer's Codex и Voter's Badge; Runebook — по вики (25.11.2026).
export const NO_RECOMB = new Set([
  'PANDORAS_BOX', 'BOOK_OF_PROGRESSION', 'RIFT_PRISM', 'BEASTSLAYERS_CODEX',
  'VOTER_BADGE', 'VOTER_BADGE_VIP', 'VOTER_BADGE_ELITE', 'VOTER_BADGE_SUPREME', 'RUNEBOOK',
]);

