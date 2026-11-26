// Английская версия сайта: словарь, переводчик готовых строк, перевод HTML и выбор языка запроса
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator, enNumbers, fill, pieces } from '../i18n/runtime.js';
import { loadDict } from '../i18n/dict.js';
import { translateHtml, langOf, inLang, isEn, tr, preferredLang } from '../i18n/lang.js';
import { ru, tx, both, messageOf, pairOf, keyOf, remember } from '../i18n/msg.js';
import { scan, keysOf } from '../i18n/scan.js';
import { WEB_SRC, skipNoWeb } from './_web.js';

const t = createTranslator({
  'Новости': 'News',
  'Осталось {0} шт.': '{0} left',
  'Крафт: {0}': 'Craft: {0}',
  '. Нужно: {0}': '. Requires: {0}',
  'Garden открыт': 'Garden unlocked',
  'Лучший сейчас: {0}.': 'Best now: {0}.',
  'Сокровища в каждом улове.': 'Treasure in every catch.',
  'убить с солью': 'kill with salt',
}, { messageOf, pairOf });

test('словарь: у перевода те же вставки {N}, что у русского текста', () => {
  const dict = loadDict();
  const bad = [];
  for (const [ru, en] of Object.entries(dict)) {
    if (typeof en !== 'string' || !en) continue;
    const a = pieces(ru).filter(p => typeof p === 'number').sort().join(',');
    const b = pieces(en).filter(p => typeof p === 'number').sort().join(',');
    if (a !== b) bad.push(`${ru} → ${en}`);
  }
  assert.deepEqual(bad.slice(0, 10), [], `вставки не совпадают (${bad.length})`);
  assert.ok(Object.keys(dict).length > 5000, 'словарь загружен');
});

test('переводчик: точное совпадение и сообщение по ключу', () => {
  assert.equal(t.tr('Новости'), 'News');
  assert.equal(t.tr('  Новости '), '  News ');
  assert.equal(t.tr(ru`Осталось ${5} шт.`), '5 left');
  assert.equal(t.tr('Hyperion'), 'Hyperion', 'без кириллицы — как есть');
  assert.equal(t.tr('Неизвестный текст'), 'Неизвестный текст', 'нет перевода — русский остаётся');
  assert.equal(fill('{1} и {0} {{x}}', ['a', 'b']), 'b и a {x}');
});

test('переводчик не угадывает: строка не из словаря и не собранная tx`…` остаётся как есть', () => {
  assert.equal(t.tr('Осталось шесть шт.'), 'Осталось шесть шт.', 'похожа на ключ, но собрана не по нему');
  assert.equal(t.tr('Hyperion за крафт'), 'Hyperion за крафт');
});

test('переводчик: склейки готовых строк, значки, точка в конце', () => {
  const s = tx`Крафт: ${'5× Enchanted Sulphur + 1× Stick'}` + tx`. Нужно: ${'Blaze Slayer 2'}`;
  assert.equal(t.tr(s), 'Craft: 5× Enchanted Sulphur + 1× Stick. Requires: Blaze Slayer 2');
  assert.equal(t.tr('✅ Garden открыт'), '✅ Garden unlocked');
  assert.equal(t.tr('Garden открыт.'), 'Garden unlocked.');
  assert.equal(t.tr(`${tx`Лучший сейчас: ${'Ruby'}.`} Сокровища в каждом улове.`), 'Best now: Ruby. Treasure in every catch.');
  assert.equal(t.tr(['Lasso', 'убить с солью', 'Garden открыт'].join(' · ')), 'Lasso · kill with salt · Garden unlocked');
});

test('переводчик: шаблон без русского текста — подставляются переведённые значения', () => {
  assert.equal(t.tr(tx`${'Garden открыт'} → ${'Новости'}`), 'Garden unlocked → News');
  const inner = tx`Осталось ${2} шт.`;
  assert.equal(t.tr(tx`${inner}${''}`), '2 left', '«${a}${пусто}» не затирает ключ строки a');
});

test('both: две готовые версии текста', () => {
  assert.equal(both('Требуется: Sugar Cane IV', 'Requires: Sugar Cane IV'), 'Требуется: Sugar Cane IV');
  assert.equal(t.tr('Требуется: Sugar Cane IV'), 'Requires: Sugar Cane IV');
});

test('переводчик: длинная склейка разбирается быстро', () => {
  const long = Array.from({ length: 40 }, (_, i) => `${tx`Лучший сейчас: ${'Gem' + i}.`} Сокровища в каждом улове.`).join(' ');
  const t0 = performance.now();
  const out = t.tr(long);
  assert.ok(performance.now() - t0 < 200);
  assert.ok(out.startsWith('Best now: Gem0. Treasure in every catch.'));
});

test('числа по-английски: млн, тыс., монеты, в час', () => {
  assert.equal(enNumbers('~14,06 млн/ч'), '~14.06M/h');
  assert.equal(enNumbers('500 млн монет'), '500M coins');
  assert.equal(enNumbers('600 тыс.–1,4 млн'), '600k–1.4M');
  assert.equal(enNumbers('5 083 опыта'), '5,083 опыта');
  assert.equal(enNumbers('(768 в час)'), '(768 per hour)');
  assert.equal(enNumbers('Titanoboa и Alligator'), 'Titanoboa and Alligator');
  assert.equal(enNumbers('8 → 9'), '8 → 9');
  assert.equal(t.tr(ru`Осталось ${2} шт.` + ', 1,2 млн монет').includes('1.2M coins'), true);
});

test('HTML: текст, подписи и строки в скриптах переводятся, разметка и язык страницы — английские', () => {
  const tt = createTranslator({ 'Новости': 'News', 'Войти': 'Log in', 'Ошибка входа': 'Login error' });
  const html = '<html lang="ru"><head><meta property="og:locale" content="ru_RU"><title>Новости</title></head>'
    + '<body><button title="Войти">Войти</button><script>alert("Ошибка входа")</script><style>.a{content:"Новости"}</style></body></html>';
  const out = translateHtml(html, tt);
  assert.match(out, /<html lang="en"/);
  assert.match(out, /content="en_US"/);
  assert.match(out, /<title>News<\/title>/);
  assert.match(out, /title="Log in">Log in</);
  assert.match(out, /alert\("Login error"\)/);
  assert.match(out, /<style>\.a\{content:"News"\}<\/style>/, 'в стилях меняются только строки');
});

test('язык запроса: заголовок, адрес /en/, ?lang=, cookie; по умолчанию русский', () => {
  const req = (o = {}) => ({ headers: o.headers || {}, path: o.path || '/', query: o.query || {}, get(h) { return this.headers[h.toLowerCase()]; } });
  assert.equal(langOf(req()), 'ru');
  assert.equal(langOf(req({ path: '/en/guides/fishing' })), 'en');
  assert.equal(langOf(req({ path: '/english' })), 'ru');
  assert.equal(langOf(req({ headers: { 'x-lang': 'en' } })), 'en');
  assert.equal(langOf(req({ query: { lang: 'en' } })), 'en');
  assert.equal(langOf(req({ headers: { cookie: 'a=1; sb-lang=en' } })), 'en');
  assert.equal(langOf(req({ path: '/en/', headers: { 'x-lang': 'ru' } })), 'ru', 'заголовок сайта важнее адреса');
});

test('язык внутри запроса: tr переводит только на английском', () => {
  assert.equal(isEn(), false);
  assert.equal(tr('Новости'), 'Новости');
  inLang('en', () => {
    assert.equal(isEn(), true);
    assert.equal(tr('Новости'), 'News');
    inLang('ru', () => assert.equal(tr('Новости'), 'Новости', 'общие кэши строим по-русски'));
  });
});

test('сообщения ru`…`: русская строка, перевод по ключу и вставкам, без угадывания', () => {
  const tt = createTranslator({
    'Купи {0} за {1}': 'Buy {0} for {1}', 'Осталось {0} {1}': '{0} {1} left', 'боссов': 'bosses',
    'Броня против эндерменов: начни с {0}': 'Armor against Endermen: start with {0}', '{0}: начни с {1}': '{0}: start with {1}',
  }, { messageOf });
  const n = 7;
  const s = ru`Осталось ${n} ${'боссов'}`;
  assert.equal(s, 'Осталось 7 боссов', 'в русской версии — обычная строка');
  assert.deepEqual(messageOf(s), { key: 'Осталось {0} {1}', vals: [7, 'боссов'] });
  assert.equal(tt.tr(s), '7 bosses left');
  // вложенное сообщение и число по-английски
  assert.equal(tt.tr(ru`Купи ${ru`Осталось ${2} ${'боссов'}`} за ${'1,5 млн'}`), 'Buy 2 bosses left for 1.5M');
  assert.equal(tt.tr(ru`${'Броня против эндерменов'}: начни с ${'Final Destination Armor'}`), 'Броня против эндерменов: start with Final Destination Armor', 'значения нет в словаре — оно остаётся, шаблон переводится');
  assert.equal(keyOf(['a {x} ', ' b']), 'a {{x}} {0} b');
});

test('сборщик словаря видит ru`…` с тем же ключом, что у обычного шаблона', () => {
  const keys = keysOf(scan('const a = ru`Осталось ${n} шт.`; const b = `Осталось ${n} шт.`; const c = foo`Не текст ${n}`;', 'x.js').sites).map(k => k.key);
  assert.deepEqual(keys, ['Осталось {0} шт.', 'Осталось {0} шт.']);
});

test('подписи в CSS (content: «…») с русским текстом переопределены для английской версии', { skip: skipNoWeb }, () => {
  const dir = WEB_SRC;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of css.matchAll(/(^|\})\s*([^{}]+)\{[^}]*content:\s*'[^']*[А-Яа-яЁё][^']*'/g)) {
      const sel = m[2].trim();
      if (sel.startsWith('html[lang="ru"]')) continue;
      assert.ok(css.includes(`html[lang="en"] ${sel}`), `${f}: нет английской подписи для ${sel}`);
    }
  }
});

test('язык первой страницы: выбранный раньше, иначе язык браузера; роботов не перекидываем', () => {
  const chrome = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
  const req = (h) => ({ headers: { 'user-agent': chrome, ...h } });
  assert.equal(preferredLang(req({ 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8' })), 'ru');
  assert.equal(preferredLang(req({ 'accept-language': 'uk-UA,uk;q=0.9' })), 'ru');
  assert.equal(preferredLang(req({ 'accept-language': 'en-US,en;q=0.9,ru;q=0.5' })), 'en');
  assert.equal(preferredLang(req({ 'accept-language': 'de-DE' })), 'en');
  assert.equal(preferredLang(req({ 'accept-language': 'ru-RU', cookie: 'a=1; sb-lang=en' })), 'en', 'выбор важнее языка браузера');
  assert.equal(preferredLang(req({})), null, 'нет языка браузера — открываем адрес как есть');
  assert.equal(preferredLang({ headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'accept-language': 'en' } }), null);
  assert.equal(preferredLang({ headers: { 'user-agent': 'Mozilla/5.0 (compatible; YandexBot/3.0)', cookie: 'sb-lang=en' } }), null);
});

test('HTML-шаблон tx: текстовые узлы со вставками переводятся по ключу', () => {
  const tt = createTranslator({ 'Выйти из {0}?': 'Log out of {0}?', 'Новый пароль (от {0} символов)': 'New password ({0}+ characters)' }, { messageOf, pairOf });
  const html = tx`<h1>Выход</h1><p>Выйти из ${'Steve&amp;Co'}?</p><a href="${'/x'}">Новый пароль (от ${8} символов)</a>`;
  const out = translateHtml(html, tt);
  assert.match(out, /Log out of Steve&amp;Co\?/);
  assert.match(out, /New password \(8\+ characters\)/);
});

test('строка с диска: сохранённый ключ восстанавливает перевод после перезапуска', () => {
  const tt = createTranslator({ 'Новый уровень SkyBlock: {0}!': 'New SkyBlock level: {0}!' }, { messageOf, pairOf });
  remember('Новый уровень SkyBlock: 321!', { key: 'Новый уровень SkyBlock: {0}!', vals: ['321'] });
  assert.equal(tt.tr('Новый уровень SkyBlock: 321!'), 'New SkyBlock level: 321!');
});
