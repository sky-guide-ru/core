import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { PNG } from 'pngjs';
import { loadPacks, packTexture, packVanillaTexture, packs, publicPackNames } from '../src/packs.js';

const png = (w, h, r) => { const p = new PNG({ width: w, height: h }); p.data.fill(r); return PNG.sync.write(p); };

test('приоритет паков и три формата', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-'));
  // Hypixel Plus: CIT
  const a = new AdmZip();
  a.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"Hypixel+"}}'));
  a.addFile('assets/minecraft/optifine/cit/weapons/hyperion.properties', Buffer.from('type=item\nitems=iron_sword\nnbt.ExtraAttributes.id=HYPERION\n'));
  a.addFile('assets/minecraft/optifine/cit/weapons/hyperion.png', png(16, 16, 10));
  a.addFile('assets/minecraft/optifine/cit/anim/aote.properties', Buffer.from('type=item\nnbt.ExtraAttributes.id=regex:ASPECT_OF_THE_(END|VOID)\ntexture=aote_tex\n'));
  a.addFile('assets/minecraft/optifine/cit/anim/aote_tex.png', png(16, 64, 20)); // анимация 4 кадра
  a.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  // FurfSky: Firmament (во вложенной папке)
  const b = new AdmZip();
  b.addFile('FSR/pack.mcmeta', Buffer.from('{"pack":{"description":"FSR"}}'));
  b.addFile('FSR/assets/firmskyblock/models/item/hyperion.json', Buffer.from('{"parent":"minecraft:item/handheld","textures":{"layer0":"firmskyblock:item/hyp"}}'));
  b.addFile('FSR/assets/firmskyblock/textures/item/hyp.png', png(16, 16, 99));
  b.addFile('FSR/assets/firmskyblock/models/item/terminator.json', Buffer.from('{"textures":{"layer0":"firmskyblock:item/term"}}'));
  b.addFile('FSR/assets/firmskyblock/textures/item/term.png', png(32, 32, 30));
  b.writeZip(path.join(dir, 'FurfSky Reborn v2.0-pre.4.zip'));
  // Официальный пак Hypixel: items → models → textures
  const c = new AdmZip();
  c.addFile('assets/hypixel_skyblock/items/item/uncategorized/divan.json', Buffer.from('{"model":{"type":"minecraft:model","model":"hypixel_skyblock:item/divan"}}'));
  c.addFile('assets/hypixel_skyblock/models/item/divan.json', Buffer.from('{"textures":{"layer0":"hypixel_skyblock:item/divan_tex"}}'));
  c.addFile('assets/hypixel_skyblock/textures/item/divan_tex.png', png(16, 16, 40));
  c.writeZip(path.join(dir, 'Hypixel SkyBlock 31-10-2026.zip'));

  const info = loadPacks(dir);
  assert.deepEqual(info.map(i => i.name), ['Hypixel Plus 0.23.4', 'FurfSky Reborn v2.0-pre.4', 'Hypixel SkyBlock 31-10-2026']);
  assert.equal(packTexture('HYPERION').pack, 'Hypixel Plus 0.23.4'); // приоритет у Hypixel Plus
  assert.equal(packTexture('TERMINATOR').pack, 'FurfSky Reborn v2.0-pre.4');
  const aote = packTexture('ASPECT_OF_THE_VOID');
  assert.equal(aote.pack, 'Hypixel Plus 0.23.4');
  assert.equal(PNG.sync.read(aote.buf).height, 16); // первый кадр анимации
  assert.equal(packTexture('DIVAN_DRILL', 'hypixel_skyblock:item/uncategorized/divan').pack, 'Hypixel SkyBlock 31-10-2026');
  assert.equal(packTexture('UNKNOWN_THING'), null);
  assert.ok(packs.list.length === 3);
});

test('Hypixel Plus 1.21: custom_data в assets/minecraft/items и оверлей', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs2-'));
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"H+"}}'));
  const def = { model: { type: 'minecraft:condition', property: 'minecraft:component', predicate: 'minecraft:custom_data', value: { id: 'HYPERION' },
    on_true: { type: 'minecraft:model', model: 'hplus:skyblock/weapons/swords/hyperion' },
    on_false: { type: 'minecraft:select', property: 'minecraft:component', component: 'minecraft:custom_data',
      cases: [{ when: '{id:"GIANTS_SWORD"}', model: { type: 'minecraft:model', model: 'hplus:skyblock/weapons/swords/giant' } }],
      fallback: { type: 'minecraft:model', model: 'minecraft:item/iron_sword' } } } };
  z.addFile('assets/minecraft/items/iron_sword.json', Buffer.from(JSON.stringify(def)));
  z.addFile('assets/hplus/models/skyblock/weapons/swords/hyperion.json', Buffer.from('{"parent":"item/handheld","textures":{"layer0":"hplus:skyblock/weapons/swords/hyperion"}}'));
  z.addFile('assets/hplus/textures/skyblock/weapons/swords/hyperion.png', png(16, 16, 7));
  z.addFile('assets/hplus/models/skyblock/weapons/swords/giant.json', Buffer.from('{"textures":{"layer0":"hplus:skyblock/weapons/swords/giant"}}'));
  z.addFile('assets/hplus/textures/skyblock/weapons/swords/giant.png', png(16, 16, 8));
  z.addFile('1_21_5/assets/minecraft/items/stone.json', Buffer.from('{"model":{"type":"minecraft:model","model":"minecraft:item/stone"}}'));
  z.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  const info = loadPacks(dir);
  assert.equal(info[0].components, 2);
  assert.equal(packTexture('HYPERION').pack, 'Hypixel Plus 0.23.4');
  assert.equal(packTexture('GIANTS_SWORD').pack, 'Hypixel Plus 0.23.4');
});

test('вложенные условия (is_shiny, using_item) дают текстуру «в покое»', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs3-'));
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"H+"}}'));
  const m = n => ({ type: 'minecraft:model', model: `hplus:w/${n}` });
  const cd = { property: 'minecraft:component', predicate: 'minecraft:custom_data' };
  const def = { model: { type: 'minecraft:condition', ...cd, value: { id: 'HYPERION' },
    on_true: { type: 'minecraft:condition', ...cd, value: { is_shiny: 1 }, on_true: m('shiny_hyperion'), on_false: m('hyperion') },
    on_false: { type: 'minecraft:condition', ...cd, value: { id: 'TERMINATOR' },
      on_true: { type: 'minecraft:condition', property: 'minecraft:using_item',
        on_true: { type: 'minecraft:range_dispatch', property: 'minecraft:use_duration', entries: [{ threshold: 0.5, model: m('terminator_pulling_1') }], fallback: m('terminator_pulling_0') },
        on_false: m('terminator') },
      on_false: m('iron_sword') } } };
  z.addFile('assets/minecraft/items/iron_sword.json', Buffer.from(JSON.stringify(def)));
  const tex = { shiny_hyperion: 1, hyperion: 2, terminator_pulling_0: 3, terminator_pulling_1: 4, terminator: 5, iron_sword: 6 };
  for (const [n, c] of Object.entries(tex)) {
    z.addFile(`assets/hplus/models/w/${n}.json`, Buffer.from(`{"textures":{"layer0":"hplus:w/${n}"}}`));
    z.addFile(`assets/hplus/textures/w/${n}.png`, png(16, 16, c));
  }
  z.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  loadPacks(dir);
  assert.equal(PNG.sync.read(packTexture('HYPERION').buf).data[0], 2);
  assert.equal(PNG.sync.read(packTexture('TERMINATOR').buf).data[0], 5);
});

test('текстуры паков: PACKS_PUBLIC=none — только владельцу, список — разрешённым', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-lic-'));
  const z = new AdmZip();
  z.addFile('assets/minecraft/optifine/cit/hyp.properties', Buffer.from('type=item\nnbt.ExtraAttributes.id=HYPERION\ntexture=hyp\n'));
  z.addFile('assets/minecraft/optifine/cit/hyp.png', png(16, 16, 10));
  z.addFile('assets/minecraft/textures/item/diamond.png', png(16, 16, 11));
  z.writeZip(path.join(dir, 'FurfSky Reborn.zip'));
  const before = process.env.PACKS_PUBLIC;
  try {
    process.env.PACKS_PUBLIC = 'none';
    const info = loadPacks(dir);
    assert.equal(info[0].public, false);
    assert.equal(packTexture('HYPERION').pack, 'FurfSky Reborn', 'владельцу — из пака');
    assert.equal(packTexture('HYPERION', undefined, 'public'), null, 'гостю — нет');
    assert.ok(packVanillaTexture('diamond'));
    assert.equal(packVanillaTexture('diamond', 'public'), null);
    process.env.PACKS_PUBLIC = 'hypixel plus, furfsky';
    loadPacks(dir);
    assert.equal(packTexture('HYPERION', undefined, 'public').pack, 'FurfSky Reborn', 'после разрешения — всем');
  } finally {
    if (before === undefined) delete process.env.PACKS_PUBLIC; else process.env.PACKS_PUBLIC = before;
  }
});

test('текстуры паков: авто — всем, пока нет рекламы РСЯ; с рекламой — только владельцу', () => {
  assert.deepEqual(publicPackNames({}), ['*'], 'без рекламы — всем');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'R-A-1234567-1' }), [], 'с рекламой — никому');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_LANDING: 'R-A-1234567-2' }), []);
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'мусор' }), ['*'], 'неверный id блока рекламу не включает');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'R-A-1234567-1', PACKS_PUBLIC: 'all' }), ['*'], 'ручное all сильнее');
  assert.deepEqual(publicPackNames({ PACKS_PUBLIC: 'none' }), [], 'ручное none сильнее');
  assert.deepEqual(publicPackNames({ YANDEX_RTB_BOTTOM: 'R-A-1234567-1', PACKS_PUBLIC: 'FurfSky' }), ['furfsky']);
});

test('большие текстуры паков ужимаются до ICON_MAX, кадр анимации — квадрат', async () => {
  const { firstFrame, ICON_MAX } = await import('../src/packs.js');
  const big = PNG.sync.read(firstFrame(png(512, 512, 7)));
  assert.equal(big.width, ICON_MAX); assert.equal(big.height, ICON_MAX); assert.equal(big.data[0], 7);
  const anim = PNG.sync.read(firstFrame(png(256, 1024, 9)));
  assert.equal(anim.width, ICON_MAX); assert.equal(anim.height, ICON_MAX);
  const small = png(16, 16, 3);
  assert.equal(firstFrame(small), small); // маленькую не трогаем вовсе
});

// 24.11.2026: развёртки вместо предметов, пустые иконки (Diamond Spreading, Magma Bucket), анимированные блоки
test('модели паков: слои с ванильной основой, 3D-модель спереди, пустые и битые картинки', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-models-'));
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"H+"}}'));
  const cd = { property: 'minecraft:component', predicate: 'minecraft:custom_data' };
  const cases = ['DIAMOND_SPREADING', 'SUPER_COMPACTOR_3000', 'EMPTY_THING', 'NUTCRACKER_HELMET', 'TRAILING'].map(id => ({ when: `{id:"${id}"}`, model: { type: 'minecraft:model', model: `hplus:m/${id.toLowerCase()}` } }));
  z.addFile('assets/minecraft/items/paper.json', Buffer.from(JSON.stringify({ model: { type: 'minecraft:select', ...cd, component: 'minecraft:custom_data', cases, fallback: { type: 'minecraft:model', model: 'minecraft:item/paper' } } })));
  // У «generated» Hypixel Plus только particle — пустая картинка: её брать нельзя
  z.addFile('assets/hplus/models/item/generated.json', Buffer.from('{"parent":"builtin/generated","textures":{"particle":"item/achoo"}}'));
  z.addFile('assets/minecraft/textures/item/achoo.png', png(16, 16, 0));
  // Блёстки поверх ванильного алмаза (его в паке нет)
  z.addFile('assets/hplus/models/m/diamond_spreading.json', Buffer.from('{"parent":"hplus:item/generated","textures":{"layer0":"item/diamond","layer1":"hplus:m/sparkle"}}'));
  const sparkle = new PNG({ width: 16, height: 16 }); sparkle.data[3] = 255; sparkle.data[0] = 200; // одна точка в углу
  z.addFile('assets/hplus/textures/m/sparkle.png', PNG.sync.write(sparkle));
  // Блок: текстура 64×64 — развёртка граней, лицо (north) в uv [0,0,4,4]
  const atlas = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4; atlas.data[i + 3] = 255; atlas.data[i] = x < 16 && y < 16 ? 50 : 150; }
  z.addFile('assets/hplus/textures/m/compactor.png', PNG.sync.write(atlas));
  const faces = Object.fromEntries(['north', 'south', 'east', 'west', 'up', 'down'].map((f, i) => [f, { texture: '#0', uv: f === 'north' ? [0, 0, 4, 4] : [4, 4, 8, 8] }]));
  z.addFile('assets/hplus/models/item/block.json', Buffer.from(JSON.stringify({ elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces }], textures: { particle: 'item/achoo' } })));
  z.addFile('assets/hplus/models/m/super_compactor_3000.json', Buffer.from('{"parent":"hplus:item/block","textures":{"0":"hplus:m/compactor"}}'));
  // Шлем FurfSky: развёртка названа layer0, но у родителя elements — значит, модель объёмная
  z.addFile('assets/hplus/models/m/head.json', Buffer.from(JSON.stringify({ elements: [{ from: [4, 0, 4], to: [12, 8, 12], faces: { north: { texture: '#layer0', uv: [2, 2, 4, 4] } } }] })));
  z.addFile('assets/hplus/models/m/nutcracker_helmet.json', Buffer.from('{"parent":"hplus:m/head","textures":{"layer0":"hplus:m/compactor"}}'));
  z.addFile('assets/hplus/models/m/empty_thing.json', Buffer.from('{"textures":{"layer0":"hplus:m/empty"}}'));
  z.addFile('assets/hplus/textures/m/empty.png', png(16, 16, 0));
  z.addFile('assets/hplus/models/m/trailing.json', Buffer.from('{"textures":{"layer0":"hplus:m/trailing"}}'));
  z.addFile('assets/hplus/textures/m/trailing.png', Buffer.concat([png(16, 16, 77), Buffer.from('garbage')]));
  z.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  loadPacks(dir);

  // Без ванильного алмаза одни блёстки не показываем — сервер должен докачать слой (needs)
  assert.equal(packTexture('DIAMOND_SPREADING', undefined, 'all', { vanilla: () => null }), null);
  assert.deepEqual(packTexture.lastNeeds, ['diamond']);
  const diamond = new PNG({ width: 16, height: 16 }); for (let i = 0; i < diamond.data.length; i += 4) { diamond.data[i + 2] = 255; diamond.data[i + 3] = 255; }
  const ds = PNG.sync.read(packTexture('DIAMOND_SPREADING', undefined, 'all', { vanilla: n => (n === 'diamond' ? PNG.sync.write(diamond) : null) }).buf);
  assert.deepEqual([...ds.data.subarray(0, 4)], [200, 0, 0, 255], 'блёстки поверх');
  assert.deepEqual([...ds.data.subarray(4, 8)], [0, 0, 255, 255], 'под ними алмаз');

  const sc = PNG.sync.read(packTexture('SUPER_COMPACTOR_3000').buf);
  assert.equal(sc.width, sc.height);
  assert.ok([...Array(sc.width * sc.height).keys()].every(i => sc.data[i * 4] === 50), 'только лицевая грань, без развёртки');

  const nc = PNG.sync.read(packTexture('NUTCRACKER_HELMET').buf);
  assert.equal(nc.width, nc.height);
  assert.ok(nc.data.some((v, i) => i % 4 === 3 && v === 0), 'голова 8×8 в квадрате 16×16 с прозрачными краями');

  assert.equal(packTexture('EMPTY_THING'), null, 'полностью прозрачная картинка — не иконка');
  assert.equal(PNG.sync.read(packTexture('TRAILING').buf).data[0], 77, 'хвост после IEND не мешает');
});

test('наложение слоёв не темнит полупрозрачные пиксели', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packs-alpha-'));
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"H+"}}'));
  const half = new PNG({ width: 16, height: 16 });
  for (let i = 0; i < half.data.length; i += 4) half.data.set([255, 255, 255, 128], i);
  z.addFile('assets/hplus/textures/a.png', PNG.sync.write(half));
  z.addFile('assets/hplus/textures/b.png', PNG.sync.write(half));
  z.addFile('assets/hplus/models/two.json', Buffer.from('{"textures":{"layer0":"hplus:a","layer1":"hplus:b"}}'));
  z.addFile('assets/minecraft/items/paper.json', Buffer.from(JSON.stringify({ model: { type: 'minecraft:condition', property: 'minecraft:component', predicate: 'minecraft:custom_data', value: { id: 'TWO' }, on_true: { type: 'minecraft:model', model: 'hplus:two' }, on_false: { type: 'minecraft:model', model: 'minecraft:item/paper' } } })));
  z.writeZip(path.join(dir, 'Hypixel Plus 0.23.4.zip'));
  loadPacks(dir);
  const px = PNG.sync.read(packTexture('TWO').buf).data;
  assert.deepEqual([px[0], px[1], px[2]], [255, 255, 255], 'белый остаётся белым');
  assert.ok(px[3] >= 190 && px[3] <= 193, `два слоя по 128 → ~192, а не ${px[3]}`);
});
