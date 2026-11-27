// Inventory API выключен: Hypixel присылает inventory только с Sack of Sacks — сайт не должен считать сумку пустой
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';
import { parseMember } from '../src/parse/profile.js';
import { analyzeAccessories } from '../src/parse/gear.js';

const S = v => ({ type: 'string', value: v }), B = v => ({ type: 'byte', value: v }), SH = v => ({ type: 'short', value: v });
const it = (id, name) => ({ id: SH(397), Count: B(1), Damage: SH(0), tag: { type: 'compound', value: {
  ExtraAttributes: { type: 'compound', value: { id: S(id) } },
  display: { type: 'compound', value: { Name: S(name), Lore: { type: 'list', value: { type: 'string', value: ['§9§lRARE'] } } } },
} } });
const data = items => ({ type: 0, data: gzipSync(nbt.writeUncompressed({ type: 'compound', name: '', value: { i: { type: 'list', value: { type: 'compound', value: items } } } })).toString('base64') });

const member = async inventory => parseMember({ profile_id: 'p', cute_name: 'Banana', members: { u1: {
  player_data: {}, profile: {}, accessory_bag_storage: { highest_magical_power: 2026 }, ...(inventory ? { inventory } : {}),
} } }, 'u1', {});

test('только Sack of Sacks в inventory — Inventory API выключен, план аксессуаров не строится', async () => {
  const m = await member({ bag_contents: { sacks_bag: data([it('MEDIUM_DRAGON_SACK', '§9Medium Dragon Sack')]) } });
  assert.equal(m.inv.apiDisabled, true);
  const acc = analyzeAccessories(m);
  assert.equal(acc.hidden, true);
  assert.equal(acc.steps.length, 0);
  assert.equal(acc.missing.length, 0);
  assert.equal(acc.highestMp, 2026);
});

test('нет inventory совсем — тоже выключен; с Accessory Bag — включён', async () => {
  assert.equal((await member(null)).inv.apiDisabled, true);
  const on = await member({ bag_contents: { talisman_bag: data([it('SPEED_RING', '§aSpeed Ring')]) } });
  assert.equal(on.inv.apiDisabled, false);
  assert.notEqual(analyzeAccessories(on).hidden, true);
});
