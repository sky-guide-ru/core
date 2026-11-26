import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrichGuide, findPhrases, lexicon } from '../src/guides/refs.js';
import { GLOSSARY } from '../src/guides/glossary.js';
import { HOWTO } from '../src/guides/howto.js';
import { buildGuides, GUIDES } from '../src/guides/index.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

// Маленькая «база NEU»: предметы, сет, питомец, NPC с магазином, моб с дропом
const items = new Map(Object.entries({
  THUNDER_CHESTPLATE: { id: 'THUNDER_CHESTPLATE', name: 'Thunder Chestplate', rarity: 'EPIC', recipe: { A1: 'THUNDER_SHARDS:1', A3: 'THUNDER_SHARDS:1', B1: 'THUNDER_SHARDS:1', B2: 'THUNDER_SHARDS:1', B3: 'THUNDER_SHARDS:1', C1: 'THUNDER_SHARDS:1', C2: 'THUNDER_SHARDS:1', C3: 'THUNDER_SHARDS:1' } },
  THUNDER_SHARDS: { id: 'THUNDER_SHARDS', name: 'Thunder Fragment', rarity: 'EPIC' },
  HOTSPOT_HOOK: { id: 'HOTSPOT_HOOK', name: 'Hotspot Hook', rarity: 'RARE' },
  ANGLER_CHESTPLATE: { id: 'ANGLER_CHESTPLATE', name: 'Angler Chestplate', rarity: 'COMMON' },
  BUCKET: { id: 'BUCKET', name: 'Bucket', rarity: 'COMMON' },
  'WOLF;4': { id: 'WOLF;4', name: '[Lvl {LVL}] Wolf', rarity: 'LEGENDARY' },
  'FLYING_FISH;4': { id: 'FLYING_FISH;4', name: '[Lvl {LVL}] Flying Fish', rarity: 'LEGENDARY' },
  FISHING_MERCHANT_NPC: { id: 'FISHING_MERCHANT_NPC', name: 'Fishing Merchant (NPC)', island: 'hub', x: 112, y: 70, z: -10,
    recipes: [{ type: 'npc_shop', result: 'ANGLER_CHESTPLATE', cost: ['SKYBLOCK_COIN:100'] }] },
  THUNDER_SC: { id: 'THUNDER_SC', name: 'Thunder (Sea Creature)', lore: ['§7Fished up in the §cCrimson Isle§7.'],
    recipes: [{ type: 'drops', name: 'Thunder', drops: [{ id: 'THUNDER_SHARDS:1', chance: '5%' }] }] },
}));

test('ссылки: длинная фраза побеждает короткую, механики и предметы различаются', () => {
  const lex = lexicon(items);
  const hits = findPhrases('Hotspot Hook даёт шанс существ Хотспота, а Thunder Armor крафтится из Thunder Fragment', lex);
  const map = Object.fromEntries(hits.map(h => [h.phrase, h.ref]));
  assert.equal(map['Hotspot Hook'], 'i:HOTSPOT_HOOK');
  assert.equal(map['Хотспота'], 't:hotspot');
  assert.equal(map['Thunder Armor'], 'i:THUNDER_CHESTPLATE', 'сет «X Armor» ведёт на нагрудник');
  assert.equal(map['Thunder Fragment'], 'i:THUNDER_SHARDS');
  assert.equal(map['существ'], 't:sea_creature');
});

test('ссылки: обычные слова и однословные питомцы не подчёркиваются, многословные — да', () => {
  const lex = lexicon(items);
  const refs = findPhrases('Wolf Slayer 3, Bucket и питомец Flying Fish', lex).map(h => h.ref);
  assert.ok(!refs.includes('i:WOLF;4'));
  assert.ok(!refs.includes('i:BUCKET'));
  assert.ok(refs.includes('i:FLYING_FISH;4'));
});

test('ссылки: апостроф ’ и \' — одно и то же', () => {
  const lex = lexicon(items);
  assert.equal(findPhrases('Jerry’s Workshop', lex)[0]?.ref, 't:jerry_workshop');
  assert.equal(findPhrases("Jerry's Workshop", lex)[0]?.ref, 't:jerry_workshop');
});

test('enrichGuide: пустое «Откуда» заполняется, «Что делать» получает предмет и способ получения, словарь подсказок', () => {
  const g = {
    id: 't', summary: 'Лови Thunder в лаве',
    next: [{ title: 'Собери Thunder Armor (0/4)', why: 'Нужен Double Hook' }],
    sections: [{ kind: 'table', title: 'Броня', columns: ['Сет', 'Откуда'], rows: [[{ text: 'Angler Armor', item: 'ANGLER_CHESTPLATE' }, null], [{ text: 'Thunder Armor', item: 'THUNDER_CHESTPLATE' }, 'с Thunder']] }],
  };
  enrichGuide(g, { items });
  assert.match(g.sections[0].rows[0][1].text, /Fishing Merchant.*100 монет/);
  assert.equal(g.sections[0].rows[1][1], 'с Thunder', 'заполненное не трогаем');
  assert.equal(g.next[0].item, 'THUNDER_CHESTPLATE');
  assert.match(g.next[0].how, /Крафт: 8× Thunder Fragment/);
  const { phrases, data } = g.refs;
  assert.equal(phrases['Thunder'], 'c:Thunder', 'морское существо из гайда рыбалки: уровень, место и дроп из NEU');
  assert.deepEqual(data['c:Thunder'].items, ['THUNDER_SHARDS']);
  assert.match(data['c:Thunder'].text, /Fishing 36/);
  assert.equal(data['t:double_hook'].kind, 'stat');
  assert.equal(data['i:ANGLER_CHESTPLATE'].kind, 'item', 'предметы ячеек тоже получают подсказку');
  for (const ref of Object.values(phrases)) assert.ok(data[ref], `нет данных для ${ref}`);
});

test('enrichGuide без базы NEU: остаются только подсказки к механикам', () => {
  const g = { id: 't', summary: 'Ferocity и Хотспот', sections: [] };
  enrichGuide(g, {});
  assert.deepEqual(Object.values(g.refs.phrases).sort(), ['t:ferocity', 't:hotspot']);
});

test('словарь механик и «как делать»: у каждой записи есть имя и текст, каждый гайд получает инструкцию', () => {
  for (const [k, v] of Object.entries(GLOSSARY)) {
    assert.ok(v.names?.length && v.text && v.kind, `glossary ${k}`);
  }
  for (const g of GUIDES) assert.ok(HOWTO[g.id]?.length >= 3, `нет «как делать» у ${g.id}`);
  const all = buildGuides(ownercatMember(), {}, { priceOf: id => PRICES[id] || 0 });
  for (const g of all) assert.equal(g.sections[0].title, 'Как это делать — пошагово', g.id);
});
