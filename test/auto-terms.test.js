import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrichGuide, findPhrases, lexicon, lexiconPhrases, refsData } from '../src/guides/refs.js';
import { buildTerms } from '../src/guides/terms.js';

// Мини-база NEU: книга чар, питомец из одного слова, обычный предмет
const items = new Map(Object.entries({
  'SHARPNESS;5': { id: 'SHARPNESS;5', name: 'Enchanted Book', rarity: 'UNCOMMON', lore: ['§8Combinable in Anvil', '', '§9Sharpness V', '§7Increases melee damage'], recipes: [] },
  'SHARPNESS;6': { id: 'SHARPNESS;6', name: 'Enchanted Book', rarity: 'RARE', lore: ['', '§9Sharpness VI'], recipes: [] },
  'WOLF;4': { id: 'WOLF;4', name: '[Lvl {LVL}] Wolf', rarity: 'LEGENDARY', lore: [], recipes: [] },
  ENCHANTED_CARROT: { id: 'ENCHANTED_CARROT', name: 'Enchanted Carrot', rarity: 'UNCOMMON', lore: [], recipes: [] },
}));
const constants = {
  leveling: { leveling_caps: { farming: 50, taming: 50, catacombs: 50 } },
  islands: { area_names: { hub: 'Hub', garden: 'The Garden', foraging_3: 'Torrhus Canyon' }, island_warps: [] },
  reforges: { a: { reforgeName: 'Fabled', itemTypes: 'SWORD', reforgeStats: { LEGENDARY: { strength: 30, crit_damage: 20 } } }, b: { reforgeName: 'Fast', itemTypes: 'BOW' } },
};
const NEWS = 'Скиллы, статы, острова и разделы игры: Farming, Dungeons, Slayers, Garden, Strength, Magical Power. Предметы, питомцы и книги: Enchanted Carrot, Sharpness V.';

test('термины из новости получают подсказки (статы, разделы, книги чар)', () => {
  const r = enrichGuide({ status: 'ok', sections: [{ kind: 'text', text: NEWS }] }, { items, constants }).refs;
  for (const p of ['Farming', 'Dungeons', 'Slayers', 'Garden', 'Strength', 'Magical Power', 'Enchanted Carrot', 'Sharpness V']) assert.ok(r.phrases[p], `нет подсказки: ${p}`);
  assert.equal(r.phrases['Sharpness V'], 'i:SHARPNESS;5');
  assert.equal(r.data['i:SHARPNESS;5'].name, 'Sharpness V', 'книга называется по чаре, а не «Enchanted Book»');
  assert.equal(r.data['t:stat.Strength'].kind, 'stat');
});

test('автотермины: скиллы из NEU, reforges со статами, этажи, мэры, питомец «Wolf Pet»', () => {
  const t = buildTerms(constants);
  assert.ok(t.get('skill.taming')?.text.includes('50'));
  assert.match(t.get('reforge.Fabled').text, /\+30 Strength/);
  assert.ok(!t.has('reforge.Fast'), 'reforge-обычное слово не подсвечивается');
  const lex = lexicon(items, constants);
  const hits = findPhrases('Пройди F7 и M7, мэр Paul, Fabled на меч, Wolf Pet, просто Sharpness, Torrhus Canyon', lex).map(h => h.ref);
  assert.deepEqual(hits, ['t:floor.f7', 't:floor.m7', 't:mayor.paul', 't:reforge.Fabled', 'i:WOLF;4', 'i:SHARPNESS;6', 't:isle.foraging_3']);
});

test('обычные слова не путаются с терминами', () => {
  const lex = lexicon(items, constants);
  assert.deepEqual(findPhrases('Wolf бегает быстро. Fast and fine. Rich Light Pure.', lex).map(h => h.phrase), []);
  const all = lexiconPhrases(items, constants);
  assert.ok(!all['гости'] && !all['существа'], 'русские слова гайдов, которые значат обычное, не идут в общий словарь');
  assert.equal(all.Dungeons, 't:menu.dungeons');
});

test('refsData отдаёт подсказки по ref и пропускает неизвестные', () => {
  const d = refsData(['t:menu.dungeons', 'i:SHARPNESS;5', 'i:NOPE', 't:nope', 'x:bad'], { items, constants });
  assert.deepEqual(Object.keys(d).sort(), ['i:SHARPNESS;5', 't:menu.dungeons']);
  assert.ok(d['t:menu.dungeons'].how.length >= 2);
});
