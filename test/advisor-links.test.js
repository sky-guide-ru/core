import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkItems } from '../src/live-advisor/lib/links.js';
import { getItemRu, searchItems } from '../src/items-ru/index.js';

const deps = { getItemRu, searchItems };

test('ссылки на предметы: верный ID остаётся, неверный ищется по названию, неизвестный — жирным', () => {
  assert.equal(linkItems('Бери [[HYPERION|Hyperion]]', deps), 'Бери [[HYPERION|Hyperion]]');
  assert.equal(linkItems('Бери [[HYPE|Terminator]]', deps), 'Бери [[TERMINATOR|Terminator]]');
  assert.equal(linkItems('Иди к [[MADDOX|Maddox]]', deps), 'Иди к **Maddox**'); // NPC — не предмет, и не «Maddox Badphone»
  assert.equal(linkItems('[[hyperion]]', deps), '[[HYPERION|Hyperion]]');
});

test('жирное точное название предмета становится ссылкой, остальное не трогаем', () => {
  assert.equal(linkItems('Копи на **Terminator**, это **42M**', deps), 'Копи на [[TERMINATOR|Terminator]], это **42M**');
  assert.equal(linkItems('Без ссылок', deps), 'Без ссылок');
  assert.equal(linkItems('[[HYPERION|Hyp]]', {}), '**Hyp**'); // без базы — просто жирный текст
});

// Маленькая база NEU с настоящими названиями из ответа советчика (скриншот OwnerCat, 23.11)
const neu = new Map(Object.entries({
  GIANT_FRAGMENT_LASER: { name: "§5L.A.S.R.'s Eye" },
  NECRON_BLADE: { name: "§6Necron's Blade (Unrefined)" },
  WITHER_SHIELD_SCROLL: { name: '§5Wither Shield' },
  IMPLOSION_SCROLL: { name: '§5Implosion' },
  SHADOW_WARP_SCROLL: { name: '§5Shadow Warp' },
  HYPERION: { name: '§6Hyperion' },
  STARRED_HYPERION: { name: '§6Hyperion' },
  TERMINATOR: { name: '§6Terminator' },
  POWER_WITHER_CHESTPLATE: { name: "§6Necron's Chestplate" },
  'GOLDEN_DRAGON;3': { name: '§7[Lvl {LVL}] Golden Dragon' },
  'GOLDEN_DRAGON;4': { name: '§7[Lvl {LVL}] Golden Dragon' },
  MADDOX_NPC: { name: 'Maddox the Slayer (NPC)' },
  SPEED_ITEM: { name: 'Speed' },
  HOT_POTATO_BOOK: { name: '§5Hot Potato Book' },
}));
const real = { neuItems: () => neu };

test('реальный ответ: все предметы становятся ссылками, даже без [[…]] от модели', () => {
  const a = "**Крафт:** 8× L.A.S.R.'s Eye и Necron's Blade (Unrefined), плюс свитки Implosion, Shadow Warp и Wither Shield, без которых меч почти бесполезен. Hyperion даёт больше интеллекта.";
  const out = linkItems(a, real);
  assert.match(out, /8× \[\[GIANT_FRAGMENT_LASER\|L\.A\.S\.R\.'s Eye\]\]/);
  assert.match(out, /\[\[NECRON_BLADE\|Necron's Blade \(Unrefined\)\]\]/);
  for (const id of ['IMPLOSION_SCROLL', 'SHADOW_WARP_SCROLL', 'WITHER_SHIELD_SCROLL']) assert.match(out, new RegExp(`\\[\\[${id}\\|`));
  assert.match(out, /\[\[HYPERION\|Hyperion\]\] даёт/, 'обычный Hyperion, а не звёздный');
});

test('названия: кривой апостроф, множественное число, без скобок, питомец высшей редкости', () => {
  assert.equal(linkItems('Копи на Necron’s Chestplate', real), 'Копи на [[POWER_WITHER_CHESTPLATE|Necron’s Chestplate]]');
  assert.equal(linkItems('Добавь 10 Hot Potato Books', real), 'Добавь 10 [[HOT_POTATO_BOOK|Hot Potato Books]]');
  assert.equal(linkItems("Скрафти Necron's Blade", real), "Скрафти [[NECRON_BLADE|Necron's Blade]]");
  assert.equal(linkItems('Возьми Golden Dragon', real), 'Возьми [[GOLDEN_DRAGON;4|Golden Dragon]]');
});

test('не предметы и уже готовое не трогаем', () => {
  assert.equal(linkItems('Иди к Maddox the Slayer', real), 'Иди к Maddox the Slayer', 'NPC — подсказкой гайдов, не карточкой');
  assert.equal(linkItems('Speed важнее', real), 'Speed важнее', 'стата, а не предмет');
  assert.equal(linkItems('бери hyperion', real), 'бери hyperion', 'одно слово — только с заглавной');
  assert.equal(linkItems('Бери [[TERMINATOR|Терму]] и `Hyperion`', real), 'Бери [[TERMINATOR|Терму]] и `Hyperion`');
  assert.equal(linkItems('**Hyperion** сильнее', real), '[[HYPERION|Hyperion]] сильнее');
  assert.equal(linkItems('HyperionX и XHyperion', real), 'HyperionX и XHyperion');
});
