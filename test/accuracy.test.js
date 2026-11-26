// Проверки игровой точности: требования контента, powder, MP-семейства, лента изменений плана.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotmPowderRemaining } from '../src/advisor/lib/hotm.js';
import { buildRoadmap } from '../src/advisor/index.js';
import { METHODS } from '../src/market/methods.js';
import { adviceFeed } from '../src/state.js';
import { ownercatMember } from './fixtures/ownercat.js';

const LAYOUT = { hotm: { perks: {
  mining_speed: { maxLevel: 50, powder: 'MITHRIL', cost: '(pow (+ level 2) 3)' },
  professional: { maxLevel: 140, powder: 'GEMSTONE', cost: '(pow (+ level 2) 2.3)' },
  pickobulus: { maxLevel: 1, powder: 'MITHRIL', cost: '' },
  core_of_the_mountain: { maxLevel: 10, powder: '(if (lt level 4) MITHRIL (if (lt level 8) GEMSTONE GLACITE))',
    cost: '(list.at (list.new 0 50000 100000 200000 300000 400000 600000 750000 1000000 1250000 0) level)' },
} } };

test('HotM: остаток powder до максимума перков', () => {
  const maxed = hotmPowderRemaining({ mining_speed: 50, professional: 140, pickobulus: 1, special_0: 10 }, LAYOUT);
  assert.deepEqual(maxed, { MITHRIL: 0, GEMSTONE: 0, GLACITE: 0 });
  const core = hotmPowderRemaining({ mining_speed: 50, professional: 140, special_0: 7 }, LAYOUT);
  assert.equal(core.GLACITE, 1000000 + 1250000);
  assert.equal(core.GEMSTONE, 750000);
  assert.equal(core.MITHRIL, 0);
  const fresh = hotmPowderRemaining({}, LAYOUT);
  assert.ok(fresh.MITHRIL > 1_700_000 && fresh.GEMSTONE > 0);
  assert.equal(hotmPowderRemaining({}, null), null);
});

test('HotM: не советуем тратить powder, если все перки на максимуме', () => {
  const m = ownercatMember();
  m.mining = { ...m.mining, nodes: { mining_speed: 50, professional: 140, pickobulus: 1, special_0: 10 },
    powder: { ...m.mining.powder, mithrilAvail: 9e6, gemstoneAvail: 28e6, glaciteAvail: 0 } };
  const steps = buildRoadmap(m, null, null, { constants: { hotmlayout: LAYOUT } });
  assert.ok(!steps.some(s => s.id === 'hotm-powder'), 'powder некуда тратить');
  m.mining.nodes = { mining_speed: 10, professional: 140, pickobulus: 1, special_0: 10 };
  const s2 = buildRoadmap(m, null, null, { constants: { hotmlayout: LAYOUT } }).find(s => s.id === 'hotm-powder');
  assert.ok(s2, 'есть недокачанный Mining Speed');
  assert.match(s2.why, /перкам до максимума нужно только/);
});

const req = (id, m) => METHODS.find(x => x.id === id).req(m, {});
test('требования методов совпадают с игрой: M7 — Catacombs 36, Kuudra — репутация', () => {
  const m7 = req('dungeon-m7', { dungeons: { catacombs: { level: 36 }, masterFloors: { 6: 1 } } });
  assert.ok(m7[0].ok && /36/.test(m7[0].text));
  const burning = req('kuudra-burning', { crimson: { mageRep: 3100, barbarianRep: 0, kuudra: { hot: 1 } } });
  assert.ok(burning[0].ok && burning[1].ok, 'репутация магов тоже открывает тиры');
  const noRep = req('kuudra-burning', { crimson: { barbarianRep: 2000, kuudra: { hot: 25 } } });
  assert.equal(noRep[0].ok, false, 'без 3000 репутации Burning закрыт, сколько Hot ни пройди');
  for (const d of METHODS) assert.doesNotMatch(d.desc, /У тебя/, `${d.id}: описание не должно содержать застывших данных профиля`);
});

test('лента: выполненные шаги и новые советы, без шума от цен', () => {
  const prev = [{ id: 'fairy-exchange', priority: 96, title: 'Обменяй феи' }, { id: 'money-best', priority: 68, title: 'A' }, { id: 'x', priority: 60, title: 'X' }];
  const next = [{ id: 'x', priority: 60, title: 'X' }, { id: 'money-other', priority: 70, title: 'B' }, { id: 'new', priority: 55, title: 'Новый' }, { id: 'low', priority: 10, title: 'мелочь' }];
  const ev = adviceFeed(prev, next, 1);
  assert.deepEqual(ev.map(e => e.text), ['Выполнено: Обменяй феи', 'Новый совет: Новый']);
  assert.deepEqual(adviceFeed(null, next), []);
});

import { checkCrafttext, roman } from '../src/market/requirements.js';
test('крафт-флипы: рецепт закрыт, если не открыта коллекция / HotM / слеер', () => {
  assert.equal(roman('XI'), 11); assert.equal(roman('IV'), 4);
  const m = { mining: { hotm: { level: 7 } }, slayers: { zombie: { level: 8 } }, unlockedCollTiers: ['NETHER_STALK_9', 'INK_SACK:3_5'] };
  const c = new Map([['nether wart', { id: 'NETHER_STALK', tiers: [] }], ['cocoa beans', { id: 'INK_SACK:3', tiers: [] }]]);
  assert.deepEqual(checkCrafttext('Requires: Nether Wart XI', m, c), { ok: false, missing: ['Nether Wart XI'] });
  assert.equal(checkCrafttext('Requires: Nether Wart IV', m, c).ok, true);
  assert.equal(checkCrafttext('Requires: HotM 8', m, c).ok, false);
  assert.equal(checkCrafttext('Requires: Zombie Slayer 7', m, c).ok, true);
  assert.equal(checkCrafttext('Requires: Cocoa Beans V', m, c).ok, true);
  assert.equal(checkCrafttext('Requires: Неизвестно 3', m, c).ok, null, 'неизвестное требование не блокирует');
  assert.equal(checkCrafttext('', m, c).ok, true);
});

import { translateLoreLine } from '../src/items-ru/index.js';
test('строка редкости остаётся как в игре: «UNCOMMON ORE», «LEGENDARY DUNGEON SWORD»', () => {
  const t = l => translateLoreLine(l).replace(/§./g, '');
  assert.equal(t('§a§lUNCOMMON ORE'), 'UNCOMMON ORE');
  assert.equal(t('§6§lLEGENDARY GLOVES'), 'LEGENDARY GLOVES');
  assert.equal(t('§5§lEPIC NECKLACE'), 'EPIC NECKLACE');
  assert.equal(t('§6§lLEGENDARY DUNGEON SWORD'), 'LEGENDARY DUNGEON SWORD');
  assert.match(t('§c☠ Requires Master Mode The Catacombs Floor IV'), /Master Mode, Floor IV/);
});

test('доводка снаряжения: фермерской броне не советуем книги Hot Potato', () => {
  const m = ownercatMember();
  const farm = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(s => ({ id: `FERMENTO_${s}`, name: `Fermento ${s}`, rarity: 'LEGENDARY', hpb: 0 }));
  const sa = m.inv.armor;
  m.inv.armor = farm;
  m.inv.wardrobe = [...(m.inv.wardrobe || []), ...sa];
  const s = buildRoadmap(m, null, null, {}).find(x => x.id === 'gear-upgrades');
  assert.ok(s, 'шаг доводки есть');
  assert.ok(!s.how.some(l => /Fermento/.test(l)), s.how.join('\n'));
  assert.ok(s.how.some(l => /Shadow Assassin/.test(l)), 'берётся боевой сет из гардероба');
});

test('«Без дела лежит» не предлагает продать рабочее снаряжение и учитывает сданных питомцев', () => {
  const gear = { topItems: [
    { id: 'TERMINATOR', name: 'Terminator', where: 'Рюкзак 1', value: 1e9 },
    { id: 'POWER_WITHER_CHESTPLATE', name: 'Necron Chestplate', where: 'Эндер-сундук', value: 90e6 },
    { id: 'OLD_DRAGON_HELMET', name: 'Old Dragon Helmet', where: 'Рюкзак 2', value: 8e6 },
  ] };
  const m = ownercatMember();
  m.tamingCap = 52; m.tamingSacrificedTypes = ['SLUG', 'BAL'];
  const prices = { 'SLUG;3': 10, 'BAL;3': 10, 'ROCK;3': 20, 'JELLYFISH;3': 30 };
  const steps = buildRoadmap(m, null, gear, { price: id => prices[id] || 0, constants: { pets: { pet_types: { BEE: 'x', SQUID: 'x', ROCK: 'x' } } } });
  const idle = steps.find(s => s.id === 'money-idle');
  assert.ok(idle && idle.how.length === 1 && /Old Dragon/.test(idle.how[0]), idle?.how.join('\n'));
  const tc = steps.find(s => s.id === 'pets-taming-cap');
  // Кап Taming — только список George: Rock там нет, сданные Slug и Bal не повторяем
  const need = tc.how.filter(l => l.startsWith('Нужен:')).join('\n');
  assert.ok(/Jellyfish \(Epic или выше\), ~30/.test(need) && !/Rock|Slug|Bal\b/.test(need), need);
});

import { craftFlips } from '../src/market/flips.js';
test('крафт-флип: доход в час ограничен объёмом покупки ингредиентов', () => {
  const items = new Map([['OUT', { id: 'OUT', name: 'Out', recipe: { A1: 'ING:160' } }], ['ING', { id: 'ING', name: 'Ing' }]]);
  const bazaar = new Map([
    ['OUT', { buy: 200_000, sell: 190_000, buyWeek: 10_000_000, sellWeek: 10_000_000 }],
    ['ING', { buy: 500, sell: 490, buyWeek: 168 * 160 * 20, sellWeek: 1e9 }], // 20 крафтов/ч при доле 100%
  ]);
  const [f] = craftFlips({ items, bazaar, bin: new Map(), tax: 0.01125 }, { includeForge: false, share: 0.05 });
  assert.ok(f, 'флип найден');
  assert.ok(Math.abs(f.craftsPerHour - 1) < 1e-9, `при доле 5% от 20 крафтов/ч — 1 крафт/ч, получили ${f.craftsPerHour}`);
  assert.ok(Math.abs(f.perHour - f.profit) < 1e-6);
});

import { trend } from '../src/market/history.js';
test('тренд за неделю не выдумывается по истории в пару часов', () => {
  const now = 1_800_000_000_000, H = 3600_000;
  const short = [[now - 3 * H, 100], [now - 2 * H, 150]];
  assert.equal(trend(short, 200, 1, now).d7, null);
  const threeDays = [[now - 72 * H, 100], [now - H, 150]];
  assert.equal(trend(threeDays, 200, 1, now).d7.pct, 100);
});

import { moneyPlan } from '../src/market/methods.js';
test('план заработка: ближайшая цель раньше далёкой, ивент с неизвестным мэром — не цель', () => {
  const m = ownercatMember();
  m.crimson = { ...m.crimson, mageRep: 0, barbarianRep: 3500, kuudra: { basic: 50, hot: 30, burning: 0, fiery: 0, infernal: 0 } };
  const ctx = { items: new Map(), bazaar: new Map(), bin: new Map(), tax: 0.01125, now: Date.now() };
  const plan = moneyPlan(m, ctx, {});
  const ids = plan.next.map(x => x.id);
  assert.ok(!ids.includes('diana'), 'Diana без известного мэра не предлагаем как цель');
  for (let i = 1; i < plan.next.length; i++) assert.ok(plan.next[i - 1].missingHard <= plan.next[i].missingHard, ids.join(','));
  const bi = ids.indexOf('kuudra-burning'), ii = ids.indexOf('kuudra-infernal');
  if (bi >= 0 && ii >= 0) assert.ok(bi < ii, 'Burning (почти открыт) раньше Infernal');
});

import { buildDatabase as buildItemsDb } from '../src/items-ru/lib/build-db.js';
test('типы предметов: слеер-мечи — оружие, осколки охоты и SPECIAL разбираются', () => {
  const mk = (id, last, name = id) => ({ itemid: 'minecraft:stone', displayname: name, nbttag: '{}', lore: ['§7x', '', last], internalname: id });
  const { items } = buildItemsDb([
    mk('FIREDUST_DAGGER', '§9§lRARE SLAYER SWORD'),
    mk('ATTRIBUTE_SHARD_X;1', '§a§lUNCOMMON FOREST SHARD (ID U46)'),
    mk('SKYBLOCK_BIT', '§c§l§ka§r §c§lSPECIAL §c§l§ka'),
    mk('GARDEN_CHIP_X', '§5§lEPIC GARDEN CHIP'),
  ]);
  const get = id => (Array.isArray(items) ? items.find(i => i.id === id) : items[id] || items.get?.(id));
  assert.equal(get('FIREDUST_DAGGER').category, 'weapon');
  assert.equal(get('FIREDUST_DAGGER').typeRu, 'Slayer Sword');
  const sh = get('ATTRIBUTE_SHARD_X;1');
  assert.equal(sh.category, 'shard');
  assert.match(sh.descriptionRu, /Forest Shard, ID U46/);
  assert.equal(get('SKYBLOCK_BIT').type, null);
  assert.match(get('GARDEN_CHIP_X').descriptionRu, /^Epic Garden Chip\./);
});

import { mergeMobVariants } from '../src/items-ru/lib/build-db.js';
test('где взять: разновидности одного моба с тем же шансом — одной строкой', () => {
  const d = (mob, lvl, chance, text) => ({ kind: 'drop', mob, levels: [lvl], chance, textRu: `Выпадает с ${mob}, ур. ${lvl}, шанс ${text}` });
  const out = mergeMobVariants([
    d('Old Ender Dragon', 358, '3% per Summoning Eye', '3% за каждый Summoning Eye'),
    d('Young Ender Dragon', 325, '3% per Summoning Eye', '3% за каждый Summoning Eye'),
    d('Wise Ender Dragon', 367, '3% per Summoning Eye', '3% за каждый Summoning Eye'),
    d('Voidgloom Seraph II', 393, '1%', '1%'), d('Voidgloom Seraph IV', 655, '1%', '1%'),
    d('Special Zealot', 73, '100%', '100%'),
  ]);
  assert.deepEqual(out.map(w => w.textRu), [
    'Выпадает с Ender Dragon (Old, Young, Wise), ур. 325–367, шанс 3% за каждый Summoning Eye',
    'Выпадает с Voidgloom Seraph (тир II, IV), ур. 393–655, шанс 1%',
    'Выпадает с Special Zealot, ур. 73, шанс 100%',
  ]);
});

import { translateLore } from '../src/items-ru/index.js';
test('лор: пункты Booster Cookie и строки Terminator переведены', () => {
  const cookie = translateLore(['§7Consume to gain the §6Cookie Buff', '§7for §a4 §7days:', '', '§6‣ §7Ability to gain §bBits§7!', '§6‣ §7Keep §6coins §7on death',
    '§6‣ §7Quick access to some menus using their', '§7respective commands:', '§7  /ah, /bazaar, and /deletor']);
  const t = cookie.lines.map(l => l.replace(/§./g, '')).join(' ').replace(/[ \n]+/g, ' ');
  assert.match(t, /Cookie Buff на 4\u00a0дн\./);
  assert.match(t, /‣ Начисляются Bits!/);
  assert.match(t, /‣ Монеты не теряются при смерти/);
  assert.match(t, /‣ Быстрый доступ к меню командами: \/ah, \/bazaar, \/deletor/);
  assert.equal(cookie.untranslated, 0);
  const term = translateLore(['§7Shoots §b3 §7arrows at once.', '§7Can damage endermen.', '', '§cDivides your §9☣ Crit Chance §cby 4!']);
  assert.equal(term.untranslated, 0, term.lines.join('|'));
});

test('лор: детали бура и перезарядки в секундах', () => {
  const t = translateLore(['§7Fuel Tank: §cNot Installed', '§7Increases fuel capacity with part', '§7installed.', '', '§8Cooldown: §a30s']);
  assert.equal(t.untranslated, 0);
  const s = t.lines.map(l => l.replace(/§./g, '')).join('\n');
  assert.match(s, /Топливный бак: не установлен/);
  assert.match(s, /Cooldown: 30 с/);
});

test('лор: заряды брони Kuudra переведены целиком', () => {
  const t = translateLore(['§7Every §a1.5s§7, melee attacks grant §a1 §7stack of', '§6ᝐ Dominus§7. §8Lose 1 stack after 4s of not', '§8gaining a stack.', '',
    '§7Each stack grants §e+0.1 Swing Range', '§7and §c+1 Ferocity§7.', '', '§7Attacking a mob has a §a50% §7chance to direct', '§7aggro from §a3 §7mobs to you.']);
  assert.equal(t.untranslated, 0, t.lines.join('|'));
  const s = t.lines.map(l => l.replace(/§./g, '')).join(' ').replace(/[ \n]+/g, ' ');
  assert.match(s, /Каждые 1\.5 с удары ближнего боя дают 1 заряд ᝐ Dominus\. Теряется 1 заряд, если 4 с не получать новых\./);
  assert.match(s, /Ferocity/);
});

test('лор: кролики, топливо Inferno и Abiphone', () => {
  const t = translateLore(['§7Grants §6+1 Chocolate §7and §60.002x', '§6Chocolate §7per second to your', '§6Chocolate Factory§7.', '',
    '§7Can be used as minion fuel', '§7exclusively in the Inferno minion for', '§724 hours!', '', '§7Speed multiplier: §a10x', '§7Specialty: §bBlaze Rod', '',
    '§7Features:', ' §7Maximum Contacts: §b6', ' §a§lContacts Directory']);
  assert.equal(t.untranslated, 0, t.lines.join('|'));
});

test('лор: типы мобов списком, сундуки, Inferno-миньоны', () => {
  const a = translateLore(['§7Mob Types: §9 Aquatic§7, §a Animal']);
  assert.equal(a.lines.map(l => l.replace(/§./g, '')).join(''), 'Тип моба: водные, животные');
  const b = translateLore(['§7Each Inferno minion increases the', '§7speed of ALL Inferno minions by §a18%§7,', '§7up to §a180%§7.']);
  assert.equal(b.untranslated, 0, b.lines.join('|'));
});

test('лор: требование на двух строках и способности данжевого снаряжения', () => {
  const t = translateLore(['§7Instead of dying, gain §a+50✦ Speed', '§7and damage immunity for §a3 §7seconds.', '', '§8This item can be reforged!',
    '§4❣ §cRequires Master Mode The Catacombs Floor IV', '§cCompletion.', '§5§lEPIC DUNGEON HELMET']);
  assert.equal(t.untranslated, 0, t.lines.join('|'));
  assert.ok(t.lines.some(l => /Master Mode, Floor IV/.test(l.replace(/§./g, ''))));
  const k = translateLore(['§7Allows you to reroll a Dungeon', '§7or Kuudra reward chest.']);
  assert.equal(k.untranslated, 0);
});

test('лор: строка SPECIAL с §k и лавовая рыбалка', () => {
  const t = translateLore(['§7Damage taken from §cLava Sea', '§cCreatures§7 is reduced by §a15% §7and', '§7damage dealt is increased by §c1.3x§7.', '', '§c§l§ka§r §c§lSPECIAL §c§l§ka']);
  assert.equal(t.untranslated, 0, t.lines.join('|'));
  assert.equal(t.lines.at(-1).replace(/§./g, ''), 'SPECIAL');
});
