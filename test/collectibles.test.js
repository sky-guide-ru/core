import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../src/config.js';
import { parseAbiphone, parseHarp } from '../src/parse/profile.js';
import { analyzeFairy, analyzeAbiphone, analyzeHarp, direction, placeHint, fairyId } from '../src/collectibles/index.js';
import { requirementRu } from '../src/collectibles/data.js';
import { getCollectMarks, setCollectMarks, _resetCollectMarks } from '../src/collectibles/marks.js';
import { buildGuide } from '../src/guides/index.js';
import { summarizeForCompare } from '../src/compare.js';
import { ownercatMember } from './fixtures/ownercat.js';

config.dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-collect-'));
_resetCollectMarks();

test('арфа: поля читаются и из quests.harp_quest, и из foraging.songs.harp', () => {
  const h = parseHarp({
    quests: { harp_quest: { song_hymn_joy_best_completion: 1, song_hymn_joy_completions: 2, song_hymn_joy_perfect_completions: 1, claimed_talisman: false } },
    foraging: { songs: { harp: { selected_song: 'brahms', song_brahms_best_completion: 0.62, song_frere_jacques_completions: 1 } } },
  });
  assert.deepEqual(h.songs.hymn_joy, { best: 1, completions: 2, perfect: 1 });
  assert.equal(h.songs.brahms.best, 0.62);
  assert.equal(h.songs.frere_jacques.completions, 1);
  assert.equal(h.selected, 'brahms');
  assert.equal(parseHarp({}), null);
});

test('арфа: пройденные песни, Intelligence и следующая песня по порядку', () => {
  const r = analyzeHarp({ harp: { songs: { hymn_joy: { best: 1, completions: 1, perfect: 0 }, frere_jacques: { best: 1, completions: 1, perfect: 1 }, amazing_grace: { best: 0.4, completions: 0, perfect: 0 }, new_song: { best: 1, completions: 1, perfect: 0 } } } });
  assert.equal(r.done, 2);
  assert.equal(r.intGot, 2);
  assert.equal(r.intMax, 26);
  assert.equal(r.next.id, 'amazing_grace');
  assert.equal(r.songs.find(s => s.id === 'amazing_grace').best, 40);
  assert.ok(r.songs.some(s => s.id === 'new_song' && s.unknown), 'неизвестная песня из API тоже показывается');
  assert.equal(analyzeHarp({}).available, false);
});

test('Abiphone: контакты сопоставляются по имени, id и callNames, неизвестные — отдельно', () => {
  const m = { abiphone: parseAbiphone({ nether_island_player_data: { abiphone: { active_contacts: ['dean', 'fearmongerer', 'pesthunter_phillip', 'maddox', 'mystery_guy'], contact_data: { dean: {}, kat: {} } } } }) };
  const a = analyzeAbiphone(m);
  const have = a.contacts.filter(c => c.status === 'have').map(c => c.name).sort();
  assert.deepEqual(have, ['Dean', 'Fear Mongerer', 'Maddox the Slayer', 'Phillip']);
  assert.deepEqual(a.other, ['mysteryguy']);
  assert.ok(a.contacts.find(c => c.name === 'Kat').talked);
  assert.equal(a.total, 87);
  // Бесплатные недостающие — первыми
  assert.ok(a.contacts[0].free && a.contacts[0].status === 'missing');
  assert.equal(analyzeAbiphone({}).available, false);
});

test('Abiphone: ключи API с другим именем (Kat, Jax, Nyx…) и без ложных совпадений', () => {
  const keys = ['pet_sitter', 'arrow_forger', 'forge_foreman', 'trevor_the_trapper', 'queen', 'jake_lab', 'kuudra_gatekeeper', 'st_jerry', 'plumber', 'feast_chef_ted'];
  const a = analyzeAbiphone({ abiphone: { active: keys, known: [] } });
  const have = a.contacts.filter(c => c.status === 'have').map(c => c.name).sort();
  assert.deepEqual(have, ['Crag', 'Fred', 'Jake', 'Jax', 'Kat', 'Plumber Joe', 'Queen Nyx', 'St. Jerry', 'Ted', 'Trevor']);
  assert.deepEqual(a.other, []);
  // plumber — это Plumber Joe, а не Lumber Merchant; kuudra_gatekeeper — Crag, а не Mort; shady_bartender — не Bartender
  const b = analyzeAbiphone({ abiphone: { active: ['plumber', 'kuudra_gatekeeper', 'shady_bartender'], known: [] } });
  for (const n of ['Lumber Merchant', 'Mort', 'Bartender']) assert.equal(b.contacts.find(c => c.name === n).status, 'missing', n);
  assert.deepEqual(b.other, ['shadybartender']);
});

test('условия Abiphone переводятся на русский', () => {
  assert.deepEqual(requirementRu(['§7- No Requirement.']), ['просто поговори с NPC']);
  assert.deepEqual(requirementRu(['§6- 64x Mutant Nether Wart.']), ['принести 64× Mutant Nether Wart']);
  assert.deepEqual(requirementRu(['- 10,000,000 Coins or', '- Clear Target Practice IV']), ['заплатить 10 000 000 монет или', 'пройди Target Practice IV']);
  assert.deepEqual(requirementRu(['- 12,000ቾ Mage Reputation']), ['12 000 репутации Mages']);
  assert.match(requirementRu(['- 1x Enchanted Sulphur Cube. (Must be Sulphur VII Collection or higher.)'])[0], /нужна коллекция Sulphur VII/);
});

test('направление и подсказка «от какого варпа идти»', () => {
  assert.equal(direction(0, 0, 0, -50), 'севернее');
  assert.equal(direction(0, 0, 50, 0), 'восточнее');
  assert.equal(direction(0, 0, -30, 30), 'юго-западнее');
  const lm = [{ kind: 'warp', name: '/warp hub', x: 0, y: 70, z: 0 }, { kind: 'npc', name: 'Tia the Fairy', x: 10, y: 70, z: -40 }];
  const h = placeHint({ x: 35, y: 110, z: -35 }, lm);
  assert.match(h, /от \/warp hub — 49 бл\. северо-восточнее/);
  assert.match(h, /высоко/);
  assert.match(h, /рядом NPC Tia the Fairy/);
  assert.match(placeHint({ x: 0, y: 40, z: 30 }, lm), /внизу.*y 40/);
  // Варп далеко — ориентир по NPC
  assert.match(placeHint({ x: 10, y: 70, z: -300 }, [lm[0], { kind: 'npc', name: 'Kaus', x: 10, y: 70, z: -240 }]), /ориентир: NPC Kaus, от него 60 бл\. севернее/);
});

test('Fairy Souls: острова из NEU, маршрут, отметки и «собраны все»', () => {
  const f = analyzeFairy({ fairySouls: { collected: 245, unspent: 0 } });
  assert.equal(f.max, 289);
  assert.equal(f.left, 44);
  assert.ok(f.listed >= 250);
  const hub = f.islands.find(i => i.id === 'hub');
  assert.equal(hub.total, hub.souls.length);
  assert.deepEqual(hub.souls.map(s => s.n).slice(0, 3), [1, 2, 3]);
  assert.ok(hub.souls.every(s => s.status === 'unknown' && s.hint));
  const id = hub.souls[0].id;
  const g = analyzeFairy({ fairySouls: { collected: 245 } }, { marks: { [id]: true } });
  assert.equal(g.islands.find(i => i.id === 'hub').found, 1);
  assert.equal(g.unmarkedFound, 244);
  const all = analyzeFairy({ fairySouls: { collected: 289 } });
  assert.ok(all.islands.every(i => i.found === i.total));
  assert.equal(fairyId('hub', 1, 2, -3), 'hub:1,2,-3');
});

test('отметки фей: у каждого игрока свои, остров целиком, проверка id', () => {
  setCollectMarks('u1', 'fairy', ['hub:1,2,3', 'hub:4,5,-6'], true);
  setCollectMarks('u2', 'fairy', 'combat_1:7,8,9', true);
  assert.deepEqual(Object.keys(getCollectMarks('u1').fairy).sort(), ['hub:1,2,3', 'hub:4,5,-6']);
  setCollectMarks('u1', 'fairy', ['hub:1,2,3'], null);
  assert.deepEqual(Object.keys(getCollectMarks('u1').fairy), ['hub:4,5,-6']);
  assert.deepEqual(Object.keys(getCollectMarks('u2').fairy), ['combat_1:7,8,9']);
  assert.throws(() => setCollectMarks('u1', 'fairy', ['../etc'], true), /Неверный id/);
  assert.throws(() => setCollectMarks('u1', 'museum', ['hub:1,2,3'], true), /Неизвестный/);
  assert.throws(() => setCollectMarks(null, 'fairy', ['hub:1,2,3'], true), /не загружен/);
  _resetCollectMarks();
  assert.deepEqual(Object.keys(getCollectMarks('u1').fairy), ['hub:4,5,-6'], 'отметки пережили перезапуск');
});

test('гайд «Души и коллекции» собирается и подсказывает следующие шаги', () => {
  const m = ownercatMember();
  m.abiphone = { active: ['dean'], known: ['dean'] };
  m.harp = { songs: { hymn_joy: { best: 1, completions: 1, perfect: 1 } }, claimedHair: false, selected: null };
  const g = buildGuide('collectibles', m, {}, {});
  assert.notEqual(g.status, 'error', g.summary);
  assert.match(g.summary, /Fairy Souls 245\/289/);
  assert.match(g.summary, /Enigma 18\/52/);
  assert.ok(g.next.some(n => /Fairy Souls: осталось 44/.test(n.title)));
  assert.ok(g.next.some(n => /Frère Jacques/.test(n.title)));
  assert.ok(g.next.some(n => /бесплатные контакты Abiphone/.test(n.title)));
  assert.equal(g.collect.abiphone.have, 1);
  assert.equal(g.collect.harp.done, 1);
  assert.ok(g.sections.some(s => s.kind === 'table' && /Недостающие контакты Abiphone: 86/.test(s.title)));
  // Без данных Abiphone и арфы гайд не падает
  const bare = buildGuide('collectibles', ownercatMember(), {}, {});
  assert.notEqual(bare.status, 'error', bare.summary);
  assert.match(bare.summary, /Abiphone —/);
});

test('сравнение: контакты Abiphone и песни арфы', () => {
  const m = ownercatMember();
  m.abiphone = { active: ['dean', 'elle'], known: [] };
  m.harp = { songs: { hymn_joy: { best: 1, completions: 1, perfect: 0 }, brahms: { best: 0.5, completions: 0, perfect: 0 } } };
  const s = summarizeForCompare({ member: m, analysis: {} });
  assert.equal(s.abiphone, 2);
  assert.equal(s.harp, 1);
});
