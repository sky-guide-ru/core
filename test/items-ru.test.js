// node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDatabase, agreeAdj } from '../src/items-ru/lib/build-db.js';
import { translateLore } from '../src/items-ru/lib/lore.js';
import { createSearch, skeleton, ruToEn } from '../src/items-ru/lib/search.js';
import * as api from '../src/items-ru/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/neu-mini.json'), 'utf8'));
const vanillaRu = { Diamond: 'Алмаз', Wheat: 'Пшеница', Carrot: 'Морковь', 'Sugar Cane': 'Сахарный тростник' };
const { items } = buildDatabase(fx.items, { constants: fx.constants, vanillaRu });

test('карточка предмета соответствует контракту', () => {
  const h = items.HYPERION;
  for (const k of ['id', 'nameRu', 'nameEn', 'descriptionRu', 'category', 'whereToGet', 'wikiUrl']) assert.ok(k in h, k);
  assert.equal(h.nameEn, 'Hyperion');
  assert.equal(h.nameRu, 'Hyperion', 'имена собственные остаются на английском');
  assert.equal(h.category, 'weapon');
  assert.equal(h.rarity, 'LEGENDARY');
  assert.equal(h.dungeon, true);
  assert.equal(h.stats.Strength, 150);
  assert.match(h.descriptionRu, /^Legendary Dungeon Sword\./);
  assert.match(h.descriptionRu, /The Catacombs, Floor VII/);
  const craft = h.whereToGet.find(w => w.kind === 'craft');
  assert.deepEqual(craft.cost, [{ id: 'GIANT_FRAGMENT_LASER', count: 8 }, { id: 'NECRON_BLADE', count: 1 }]);
  for (const w of h.whereToGet) assert.ok(['craft', 'npc', 'drop', 'forge', 'shop', 'other'].includes(w.kind));
});

test('дроп с босса, NPC-магазин, кузница, Kat', () => {
  const drop = items.NECRON_HANDLE.whereToGet.find(w => w.kind === 'drop');
  assert.equal(drop.source, 'NECRON_BOSS');
  assert.match(drop.textRu, /^Выпадает с Necron/);
  const npc = items.WHEAT.whereToGet.find(w => w.kind === 'npc');
  assert.match(npc.textRu, /^Купить у NPC Farm Merchant \(Hub\) за 30 монет/);
  const forge = items.PERFECT_JADE_GEM.whereToGet[0];
  assert.equal(forge.kind, 'forge');
  assert.match(forge.textRu, /Кузница \(Forge\).*20 ч/);
  const kat = items['ENDER_DRAGON;4'].whereToGet.find(w => w.subkind === 'kat');
  assert.match(kat.textRu, /Kat.*400 млн монет/);
});

test('русские названия: ванильные, «Зачарованный», книги, питомцы, миньоны', () => {
  assert.equal(items.DIAMOND.nameRu, 'Алмаз');
  assert.equal(items.ENCHANTED_DIAMOND.nameRu, 'Зачарованный алмаз');
  assert.equal(items.ENCHANTED_CARROT.nameRu, 'Зачарованная морковь');
  assert.equal(items['SHARPNESS;7'].nameRu, 'Книга: Острота VII');
  assert.equal(items['ENDER_DRAGON;4'].nameRu, 'Питомец Ender Dragon (легендарный)');
  assert.equal(items.WHEAT_GENERATOR_1.nameRu, 'Миньон «Пшеница» I');
});

test('линейки улучшений', () => {
  assert.deepEqual(items.SPEED_TALISMAN.upgradesTo.slice(0, 1), ['SPEED_RING']);
  assert.ok(items.NECRON_BLADE.upgradesTo.includes('HYPERION'));
  assert.ok(items['SHARPNESS;7'].upgradesFrom.includes('SHARPNESS;6'));
  assert.ok(items.WHEAT_GENERATOR_1.upgradesTo.includes('WHEAT_GENERATOR_2'));
});

test('текстуры: голова со скином и обычный предмет', () => {
  assert.equal(items.WHEAT_GENERATOR_1.texture.kind, 'head');
  assert.match(items.WHEAT_GENERATOR_1.texture.hash, /^[a-f0-9]{40,}$/);
  assert.equal(items.HYPERION.texture.kind, 'item');
  assert.equal(items.HYPERION.texture.mcId, 'iron_sword');
});

test('согласование прилагательных', () => {
  assert.equal(agreeAdj('Редкий', 'f'), 'Редкая');
  assert.equal(agreeAdj('Эпический', 'pl'), 'Эпические');
  assert.equal(agreeAdj('Легендарный', 'n'), 'Легендарное');
  assert.equal(agreeAdj('Обычный', 'pl'), 'Обычные');
});

test('перевод строк лора', () => {
  assert.equal(api.translateLoreLine('§7Strength: §c+150'), '§7Strength: §c+150');
  assert.equal(api.translateLoreLine('§8This item can be reforged!'), '§8Этот предмет можно перековать!');
  assert.match(api.translateLoreLine('§4☠ §cRequires §5Enderman Slayer 5§c.'), /Требуется Enderman Slayer 5/);
  assert.match(api.translateLoreLine('§6§lLEGENDARY DUNGEON SWORD'), /LEGENDARY DUNGEON SWORD/);
  const r = translateLore(fx.items.find(i => i.internalname === 'ASPECT_OF_THE_END').lore);
  const text = r.lines.join('\n').replace(/§./g, '');
  assert.match(text, /Способность: Instant Transmission \(ПКМ\)/);
  assert.match(text, /Телепортирует на 8 блоков вперёд/);
});

test('перевод характеристик', () => {
  assert.equal(api.translateStat('Crit Damage'), 'Crit Damage');
  assert.equal(api.translateStat('crit_damage'), 'Crit Damage');
  assert.equal(api.translateStat('Unknown Stat'), 'Unknown Stat');
});

test('поиск по фикстуре: русский, транслит, жаргон', () => {
  const s = createSearch(items);
  assert.equal(s('гиперион')[0].id, 'HYPERION');
  assert.equal(s('аоте')[0].id, 'ASPECT_OF_THE_END');
  assert.equal(s('зачарованный алмаз')[0].id, 'ENCHANTED_DIAMOND');
  assert.equal(s('Hyperion')[0].id, 'HYPERION');
  assert.equal(s('джуджу')[0].id, 'JUJU_SHORTBOW');
  assert.ok(s('меч').every(i => i.type === 'SWORD'));
  assert.equal(skeleton('гиперион'), skeleton('hyperion'));
});

test('поиск: падежи, английские сокращения, слова в любом порядке', () => {
  const s = createSearch(items);
  assert.equal(ruToEn('кости'), 'bone');
  assert.equal(ruToEn('волка'), 'wolf');
  assert.equal(ruToEn('звезды'), 'star');
  assert.equal(ruToEn('драконьи'), 'dragon');
  assert.equal(ruToEn('гиперион'), 'гиперион'); // незнакомое слово не трогаем
  assert.equal(s('ench diamond')[0].id, 'ENCHANTED_DIAMOND');
  assert.equal(s('diamond enchanted')[0].id, 'ENCHANTED_DIAMOND');
  assert.equal(s('кольцо скорости')[0].id, 'SPEED_RING');
  assert.equal(s('талисман скорости')[0].id, 'SPEED_TALISMAN');
});

test('публичный API на собранной базе data/', { skip: !fs.existsSync(path.join(here, '../src/items-ru/data/items-ru.json')) }, () => {
  const it = api.getItemRu('ENCHANTMENT_SHARPNESS_7');
  assert.equal(it.id, 'SHARPNESS;7');
  assert.equal(api.searchItems('терминатор')[0].id, 'TERMINATOR');
  assert.equal(api.searchItems('питомец дракон', { limit: 10 }).some(i => i.id === 'ENDER_DRAGON;4'), true);
  const withPrices = api.getItemRu('HYPERION', { prices: { bin: new Map([['HYPERION', { price: 1.2e9, count: 14 }]]) } });
  assert.match(withPrices.whereToGet[0].textRu, /аукционе.*1,2 млрд/);
  for (const [alias, ids] of Object.entries(api.ALIASES)) for (const id of [].concat(ids)) assert.ok(api.getItemRu(id), `алиас ${alias} → ${id}`);
  assert.ok(api.getLoreRu('HYPERION').some(l => l.startsWith('Strength:'))); // статы как в игре, по-английски (24.11.2026)
});

test('поиск: сокращения игроков, не та раскладка, транслит — сокращение первым, без мусора', { skip: !fs.existsSync(path.join(here, '../src/items-ru/data/items-ru.json')) }, () => {
  const top = (q, n = 1) => api.searchItems(q, { limit: n }).map(i => i.id);
  // «аотд» раньше выдавал ещё и книги Knockback (нечёткое совпадение с «Отдача»)
  assert.deepEqual(top('аотд', 10), ['ASPECT_OF_THE_DRAGON']);
  assert.deepEqual(top('aotd'), ['ASPECT_OF_THE_DRAGON']);
  assert.deepEqual(top('фщеу'), ['ASPECT_OF_THE_END']); // aote в русской раскладке
  assert.deepEqual(top('фщем'), ['ASPECT_OF_THE_VOID']);
  assert.deepEqual(top('рнзукшщт'), ['HYPERION']); // hyperion в русской раскладке
  assert.deepEqual(top('ubgf'), ['HYPERION']); // «гипа» в английской
  for (const [q, id] of [['hype', 'HYPERION'], ['term', 'TERMINATOR'], ['juju', 'JUJU_SHORTBOW'], ['gs', 'GIANTS_SWORD'], ['ld', 'LIVID_DAGGER'],
    ['necron chest', 'POWER_WITHER_CHESTPLATE'], ['ss', 'BAT_WAND'], ['fot', 'FLOWER_OF_TRUTH'], ['жужу', 'JUJU_SHORTBOW'], ['гс', 'GIANTS_SWORD']]) {
    assert.deepEqual(top(q), [id], q);
  }
  assert.deepEqual(top('sa', 4).sort(), ['SHADOW_ASSASSIN_BOOTS', 'SHADOW_ASSASSIN_CHESTPLATE', 'SHADOW_ASSASSIN_HELMET', 'SHADOW_ASSASSIN_LEGGINGS']);
  // автоматические аббревиатуры из названий, в том числе транслитом
  assert.equal(top('aotj')[0], 'ASPECT_OF_THE_JERRY');
  // русские слова не принимаются за латиницу в чужой раскладке
  assert.equal(api.searchItems('лук', { limit: 5 }).every(i => /BOW/.test(i.type)), true);
  assert.equal(top('меч')[0] !== undefined, true);
});

test('поиск с телефона: длинное слово не в той раскладке и одно слово-тип', { skip: !fs.existsSync(path.join(here, '../src/items-ru/data/items-ru.json')) }, () => {
  const top = (q, n = 1) => api.searchItems(q, { limit: n }).map(i => i.id);
  // «терминатор», набранный в английской раскладке: точного названия нет, но транслит находит
  assert.equal(top('nthvbyfnjh')[0], 'TERMINATOR');
  assert.equal(top('kbdbl')[0], 'LIVID_DAGGER'); // «ливид»
  // абракадабра в чужой раскладке по-прежнему ничего не находит
  assert.deepEqual(top('ghbdtn', 3), []);
  // «кольцо», «талисман», «талик» — сначала аксессуары с этим словом в названии, а не самые редкие подряд
  for (const [q, w] of [['кольцо', 'Ring'], ['кольца', 'Ring'], ['талисман', 'Talisman'], ['талик', 'Talisman'], ['артефакт', 'Artifact']]) {
    const names = api.searchItems(q, { limit: 3 }).map(i => i.nameEn);
    assert.equal(names.length, 3, q);
    assert.ok(names.every(n => n.includes(w)), `${q}: ${names}`);
  }
  // уровни арабскими цифрами → римские в названиях: чары, книги, миньоны, «лвл/t»
  const nm = q => api.searchItems(q, { limit: 1 })[0]?.nameEn;
  for (const [q, n] of [['sharpness 6', 'Sharpness VI'], ['шарпнес 5', 'Sharpness V'], ['ult wise 5', 'Ultimate Wise V'], ['protection 7', 'Protection VII'],
    ['wheat minion 11', 'Wheat Minion XI'], ['миньон пшеницы 11', 'Wheat Minion XI'], ['lvl 5 sharpness', 'Sharpness V'], ['power 7', 'Power VII']]) assert.equal(nm(q), n, q);
  assert.equal(nm('рекомб 3000'), 'Recombobulator 3000'); // числа вне 1–20 не трогаем
  // «кольцо волка» по-прежнему Wolf Ring первым
  assert.equal(top('кольцо волка')[0], 'WOLF_RING');
});

// ── Словарь абзацев (data/lore-dict) ─────────────────────────────────────────
import { toKey, lookup } from '../src/items-ru/lib/dict.js';
import { recolorWrap } from '../src/items-ru/lib/lore.js';

test('словарь: числа и римские уровни — заполнители, одна запись на все уровни', () => {
  assert.deepEqual(toKey('Sharpness VII Increases melee damage dealt by 35%.'),
    { key: 'Sharpness {R0} Increases melee damage dealt by {0}%.', nums: ['35'], romans: ['VII'] });
  // «I» в начале (уровень) — заполнитель, «I» внутри фразы — нет
  assert.equal(toKey('Turbo-Wheat I Grants +5☘ Wheat Fortune.').key, 'Turbo-Wheat {R0} Grants {0}☘ Wheat Fortune.');
  assert.equal(toKey('Sometimes I see 3rd F7').key, 'Sometimes I see 3rd F7');
  assert.equal(lookup('Sharpness III Increases melee damage dealt by 15%.'), 'Sharpness III. Увеличивает урон ближнего боя на 15%.');
  assert.match(lookup('Deal +300% damage to Endermen. Receive 12% less damage from Endermen when held. Gain +45☯ Combat Wisdom against Endermen.'),
    /^Наносит \+300% урона эндерменам\..*\+45☯ Мудрости боя против эндерменов\.$/);
});

test('перевод абзаца сохраняет цвета чисел и значков характеристик', () => {
  const lines = recolorWrap('Даёт +400⫽ Свирепости против эндерменов на 4 с', ['§7Gain §c+400⫽ Ferocity §7against Endermen for §a4s']);
  const text = lines.join(' ');
  assert.match(text, /§c\+400⫽ Свирепости §7против/);
  assert.match(text, /§a4 §7с/);
  assert.ok(lines.every(l => l.startsWith('§')), 'каждая строка начинается с цвета');
});

test('лор Atomsplit Katana переводится целиком, без английских абзацев', () => {
  const lore = ['§7Damage: §c+305', '', '§7Deal §a+300% §7damage to Endermen.', '§7Receive §a12% §7less damage from', '§7Endermen when held.',
    '§7Gain §3+45☯ Combat Wisdom§7 against', '§7Endermen.', '', '§6Ability: Soulcry §e§lRIGHT CLICK', '§7Gain §c+400⫽ Ferocity §7against Endermen for §a4s',
    '§8Soulflow Cost: §32', '', '§8This item can be reforged!', '§4☠ §cRequires §5Enderman Slayer 6§c.', '§6§lLEGENDARY SLAYER SWORD'];
  const r = translateLore(lore);
  assert.equal(r.untranslated, 0);
  const plain = r.lines.map(l => l.replace(/§./g, '')).join('\n');
  assert.doesNotMatch(plain, /\b(?:Deal|Receive|Gain|against|Endermen)\b/);
  assert.match(plain, /Наносит \+300% урона эндерменам/);
});

test('поиск: жаргон в падеже и русское слово, набранное в английской раскладке', () => {
  const s = createSearch(items);
  assert.equal(s('гиперионом')[0]?.id, 'HYPERION', 'падеж жаргона');
  assert.equal(s('джуджу')[0]?.id, 'JUJU_SHORTBOW');
  // «гиперион» в английской раскладке
  assert.equal(s('ubgthbjy')[0]?.id, 'HYPERION', 'не та раскладка');
});

test('поиск по настоящей базе: «печеньку», «рекомбом», «терминатор» в английской раскладке', () => {
  const real = JSON.parse(fs.readFileSync(path.join(here, '../src/items-ru/data/items-ru.json'), 'utf8'));
  const s = createSearch(real);
  assert.equal(s('печеньку')[0]?.id, 'BOOSTER_COOKIE');
  assert.equal(s('рекомбом')[0]?.id, 'RECOMBOBULATOR_3000');
  assert.equal(s('nthvbyfnjh')[0]?.id, 'TERMINATOR');
  assert.equal(s('терминатор')[0]?.id, 'TERMINATOR');
});

test('поиск: «рыбалка» — удочки, а не питомцы Rabbit; похожий ник помечен как неточное совпадение', { skip: !fs.existsSync(path.join(here, '../src/items-ru/data/items-ru.json')) }, () => {
  for (const q of ['рыбалка', 'рыбалку', 'рыба']) {
    const names = api.searchItems(q, { limit: 8 }).map(i => i.nameEn);
    assert.ok(names.length > 0, q);
    assert.ok(!names.some(n => /Rabbit/.test(n)), `${q}: ${names}`);
  }
  assert.ok(api.searchItems('рыбалка', { limit: 8 }).some(i => i.id === 'FISHING_ROD'));
  // ник Refraction: книги Reflection только похожи по написанию
  const ref = api.searchItems('Refraction', { limit: 5, scores: true });
  assert.ok(ref.length && ref.every(i => i.score < 60), ref.map(i => `${i.nameEn} ${i.score}`).join(', '));
  assert.ok(api.searchItems('hyperion', { limit: 1, scores: true })[0].score >= 60);
});
