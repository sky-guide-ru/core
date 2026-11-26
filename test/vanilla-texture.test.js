import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { PNG } from 'pngjs';
import { loadPacks, packVanillaTexture, findClientJar, minecraftDirs } from '../src/packs.js';

const png = (w, h, r) => { const p = new PNG({ width: w, height: h }); p.data.fill(r); return PNG.sync.write(p); };

test('ванильная иконка берётся из ресурс-пака (первый кадр анимации)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanilla-'));
  const z = new AdmZip();
  z.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"x"}}'));
  z.addFile('assets/minecraft/textures/item/nether_star.png', png(16, 48, 30));
  z.addFile('assets/minecraft/textures/block/gold_block.png', png(16, 16, 40));
  z.writeZip(path.join(dir, 'Hypixel Plus.zip'));
  loadPacks(dir);
  const star = PNG.sync.read(packVanillaTexture('nether_star'));
  assert.equal(star.width, 16); assert.equal(star.height, 16);
  assert.ok(packVanillaTexture('gold_block'));
  assert.equal(packVanillaTexture('emerald'), null);
  loadPacks(fs.mkdtempSync(path.join(os.tmpdir(), 'empty-')));
});

test('находит самый свежий client.jar в .minecraft/versions', () => {
  const mc = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-'));
  const mk = (v, size, t) => {
    fs.mkdirSync(path.join(mc, 'versions', v), { recursive: true });
    const f = path.join(mc, 'versions', v, `${v}.jar`);
    fs.writeFileSync(f, Buffer.alloc(size));
    fs.utimesSync(f, t, t);
  };
  mk('1.8.9', 6e6, 1000);
  mk('1.21.5', 6e6, 2000);
  mk('fabric-loader', 1e5, 3000); // маленький jar лаунчера-обёртки не считается
  assert.equal(findClientJar([mc]), path.join(mc, 'versions', '1.21.5', '1.21.5.jar'));
  assert.equal(findClientJar([path.join(mc, 'nope')]), null);
});

test('места .minecraft: MINECRAFT_DIR, APPDATA, домашняя папка', () => {
  const d = minecraftDirs({ MINECRAFT_DIR: 'X:/mc', APPDATA: 'C:/Users/u/AppData/Roaming' }, '/home/u');
  assert.equal(d[0], 'X:/mc');
  assert.ok(d[1].endsWith('.minecraft'));
  assert.ok(d.some(p => p.endsWith(path.join('/home/u', '.minecraft'))));
});
