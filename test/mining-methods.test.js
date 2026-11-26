// Методы заработка на майнинге (server/market/methods/mining.js): расчёт по таблицам дропа, спрос, требования HotM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyMethods } from '../src/market/methods.js';
import { METHOD_DETAILS } from '../src/market/method-details.js';
import { MINING_METHODS, valueOf, lootIncome, NUCLEUS_ROLL, GEM_STRENGTH } from '../src/market/methods/mining.js';

const NOW = 1_800_000_000_000;
const M = 1_000_000;
// Примерные цены ноября 2026 (порядок величин, не точные): sell — лучший ордер на покупку, buy — на продажу.
const bz = (sell, weekVol = 1e6) => ({ sell, buy: sell * 1.03, sellWeek: weekVol, buyWeek: weekVol });
const BAZAAR = {
  MITHRIL_ORE: bz(9, 5e8), ENCHANTED_MITHRIL: bz(1500, 3e6), TITANIUM_ORE: bz(900, 2e6), ENCHANTED_TITANIUM: bz(150_000, 2e4),
  UMBER: bz(30, 1e8), ENCHANTED_UMBER: bz(5500, 1e6), TUNGSTEN: bz(35, 1e8), ENCHANTED_TUNGSTEN: bz(6000, 1e6), GLACITE: bz(20, 1e8), ENCHANTED_GLACITE: bz(3500, 1e6),
  UMBER_KEY: bz(60_000, 5e4), TUNGSTEN_KEY: bz(60_000, 5e4), JUNGLE_KEY: bz(150_000, 3e4),
  SUSPICIOUS_SCRAP: bz(25_000, 1e5), GLACITE_JEWEL: bz(40_000, 3e4), REFINED_UMBER: bz(1_500_000, 2e3), OPAL_CRYSTAL: bz(800_000, 2e3),
  FROZEN_SCUTE: bz(8 * M, 200), DWARVEN_OS_METALLIC_MINIS: bz(400_000, 1e3),
  GOBLIN_EGG: bz(3000, 5e5), GOBLIN_EGG_GREEN: bz(12_000, 1e5), GOBLIN_EGG_RED: bz(12_000, 1e5), GOBLIN_EGG_YELLOW: bz(12_000, 1e5), GOBLIN_EGG_BLUE: bz(1_200_000, 3e3), SULPHUR: bz(10, 1e7),
  SYNTHETIC_HEART: bz(220_000, 2e4), CONTROL_SWITCH: bz(180_000, 2e4), SUPERLITE_MOTOR: bz(200_000, 2e4), ROBOTRON_REFLECTOR: bz(190_000, 2e4), FTX_3070: bz(210_000, 2e4), ELECTRON_TRANSMITTER: bz(200_000, 2e4),
  DIVAN_FRAGMENT: bz(2_500_000, 1e4), PREHISTORIC_EGG: bz(120_000, 5e3), OIL_BARREL: bz(20_000, 1e4), HELIX: bz(500_000, 1e3), BOB_OMB: bz(3000, 1e5),
  JADERALD: bz(4 * M, 2e3), GEMSTONE_MIXTURE: bz(3 * M, 2e3), TREASURITE: bz(20_000, 3e4), RUBY_CRYSTAL: bz(1.5 * M, 500), JASPER_CRYSTAL: bz(1.5 * M, 500),
  WORM_MEMBRANE: bz(1500, 1e6), DWARVEN_OS_BLOCK_BRAN: bz(30_000, 5e3),
  SORROW: bz(2 * M, 3e4), PLASMA: bz(3 * M, 2e4), VOLTA: bz(150_000, 5e4),
};
for (const [g, flawless] of Object.entries({ RUBY: 2.5 * M, AMBER: 2.2 * M, SAPPHIRE: 2.4 * M, JADE: 3.5 * M, AMETHYST: 2.3 * M, TOPAZ: 2.2 * M, JASPER: 3 * M, OPAL: 2.5 * M, ONYX: 2.6 * M, AQUAMARINE: 2.6 * M, CITRINE: 2.4 * M, PERIDOT: 3.2 * M })) {
  BAZAAR[`FLAWLESS_${g}_GEM`] = bz(flawless, 2e4);
  BAZAAR[`FINE_${g}_GEM`] = bz(flawless / 85, 3e5);
  BAZAAR[`FLAWED_${g}_GEM`] = bz(flawless / 7000, 3e6);
  BAZAAR[`ROUGH_${g}_GEM`] = bz(flawless / 600_000, 1e8);
}
const ctxOf = (extra = {}) => ({
  bazaar: new Map(Object.entries(BAZAAR)),
  bin: new Map([['GHOST_BOOTS', { price: 40 * M, count: 5 }], ['SCATHA;2', { price: 4 * M, count: 10 }], ['SCATHA;3', { price: 25 * M, count: 10 }], ['SCATHA;4', { price: 150 * M, count: 10 }], ['PICKONIMBUS', { price: 150_000, count: 50 }]]),
  npc: new Map([['ROUGH_RUBY_GEM', 5], ['MITHRIL_ORE', 1]]),
  name: id => id.split(/[_;]/).map(w => w[0] + w.slice(1).toLowerCase()).join(' '),
  now: NOW, tax: 0.01125, ...extra,
});
const member = (hotmLvl, extra = {}) => ({ purse: 5 * M, bank: 0, skills: { mining: { level: 50 }, combat: { level: 40 } }, slayers: {}, dungeons: {}, mining: { hotm: { level: hotmLvl }, mineshafts: 3, nucleusRuns: 0 }, inv: {}, pets: [], ...extra });
const by = (list, id) => list.find(x => x.id === id);

test('каждый метод майнинга имеет разбор и считается по живым ценам', () => {
  const list = moneyMethods(member(10), ctxOf());
  for (const def of MINING_METHODS) {
    const x = by(list, def.id);
    assert.ok(x, def.id);
    assert.ok(METHOD_DETAILS[def.id]?.steps?.length >= 2 && METHOD_DETAILS[def.id]?.risks?.length >= 1, `${def.id}: шаги и риски`);
    assert.equal(x.source, 'live', `${def.id}: расчёт по ценам, а не ориентир`);
    assert.ok(x.coinsPerHour > 100_000 && x.coinsPerHour < 60 * M, `${def.id}: правдоподобный доход ${x.coinsPerHour}`);
    assert.ok(x.coinsPerHourRange[0] <= x.coinsPerHour, `${def.id}: диапазон от осторожного`);
    assert.ok(x.detail && !/undefined|NaN/.test(x.detail), `${def.id}: текст без мусора: ${x.detail}`);
    assert.ok(!/[A-Z]{3,}_[A-Z_]{3,}/.test(x.detail), `${def.id}: в тексте нет сырых ID: ${x.detail}`);
  }
});

test('гемы: прочность после 0.27.3, гемы Glacite Tunnels только с HotM 7', () => {
  assert.equal(GEM_STRENGTH.RUBY, 2500);
  assert.equal(GEM_STRENGTH.PERIDOT, 4000);
  const low = by(moneyMethods(member(5), ctxOf()), 'gemstones');
  assert.ok(!low.top.some(t => /Peridot|Onyx/.test(t.name)), 'на HotM 5 нет гемов туннелей');
  assert.match(low.detail, /HotM 7/);
  const high = by(moneyMethods(member(7), ctxOf()), 'gemstones');
  assert.ok(high.top.some(t => /Peridot/.test(t.name)), 'на HotM 7 Peridot считается');
});

test('продаём не больше спроса: остаток уходит по цене NPC', () => {
  const ctx = ctxOf();
  // Flawless Ruby: 20 000 в неделю → 10% ≈ 286 в сутки ≈ 12 в час. 30 Flawless в час — уже больше спроса.
  ctx.bazaar = new Map([...ctx.bazaar].filter(([id]) => !/^(FINE|FLAWED|ROUGH)_RUBY/.test(id)));
  ctx.npc = new Map([['ROUGH_RUBY_GEM', 1]]);
  const v = valueOf(ctx, 'ROUGH_RUBY_GEM', 512_000 * 30);
  assert.equal(v.form, 'FLAWLESS_RUBY_GEM');
  assert.ok(v.capped, 'упёрлись в спрос');
  assert.ok(v.perHour < 30 * 2.5 * M * 0.9, 'дешевле, чем продать все 30');
  assert.ok(v.perHour > 11 * 2.5 * M * 0.98, 'но то, что берут, продаётся по рыночной');
});

test('Nucleus: таблица бросков складывается примерно в 100%, ран дороже деталей', () => {
  const total = NUCLEUS_ROLL.reduce((s, l) => s + l.p, 0);
  assert.ok(total > 0.97 && total < 1.03, `сумма шансов ${total}`);
  const x = by(moneyMethods(member(7), ctxOf()), 'crystal-nucleus');
  assert.match(x.detail, /Automaton/);
  assert.ok(x.coinsPerHour > 0);
  const withMole = by(moneyMethods(member(7, { pets: [{ type: 'MOLE' }] }), ctxOf()), 'crystal-nucleus');
  assert.ok(withMole.coinsPerHour > x.coinsPerHour, 'Mole даёт лишний бросок');
});

test('Mineshaft: ключ не покупаем, если труп его не окупает', () => {
  const cheap = by(moneyMethods(member(7), ctxOf()), 'glacite-mineshaft').coinsPerHour;
  const ctx = ctxOf();
  // купить ключ дорого (продать его — по-прежнему дёшево)
  ctx.bazaar.set('UMBER_KEY', { ...bz(60_000, 5e4), buy: 50 * M });
  ctx.bazaar.set('TUNGSTEN_KEY', { ...bz(60_000, 5e4), buy: 50 * M });
  const pricey = by(moneyMethods(member(7), ctx), 'glacite-mineshaft').coinsPerHour;
  assert.ok(pricey > 0 && pricey < cheap, 'с дорогими ключами открываем только Lapis');
});

test('требования: Glacite и Crystal Hollows закрыты на низком HotM', () => {
  const list = moneyMethods(member(2), ctxOf());
  assert.equal(by(list, 'glacite-metals').available, false);
  assert.equal(by(list, 'glacite-mineshaft').available, false);
  assert.equal(by(list, 'scatha').available, false);
  assert.equal(by(list, 'mining-mithril').available, true);
  const hq = by(list, 'crystal-nucleus').reqs.find(r => r.text.startsWith('HotM'));
  assert.match(hq.have, /Gwendolyn/);
});

test('без цен метод не выдумывает доход', () => {
  const empty = { bazaar: new Map(), bin: new Map(), npc: new Map(), now: NOW };
  for (const x of moneyMethods(member(10), empty).filter(x => MINING_METHODS.some(d => d.id === x.id))) {
    assert.equal(x.coinsPerHour, null, x.id);
  }
  assert.equal(lootIncome(empty, [{ id: 'SORROW', p: 0.01 }], 100).priced, 0);
});

test('покупку без цены не считаем бесплатной (замечание ревью)', () => {
  const ctx = ctxOf();
  ctx.bazaar.delete('SYNTHETIC_HEART');
  assert.equal(by(moneyMethods(member(7), ctx), 'crystal-nucleus').coinsPerHour, null, 'нет цены детали — нет расчёта рана с покупкой');
  const full = by(moneyMethods(member(7), ctxOf()), 'glacite-mineshaft').coinsPerHour;
  const ctx2 = ctxOf();
  ctx2.bazaar.delete('UMBER_KEY');
  ctx2.bazaar.delete('TUNGSTEN_KEY');
  const noKeys = by(moneyMethods(member(7), ctx2), 'glacite-mineshaft');
  assert.ok(noKeys.coinsPerHour < full, 'без ключей в продаже открываем только Lapis');
  assert.match(noKeys.detail, /нет в продаже/);
});

test('спрос считается на час, а не на каждый ран (замечание ревью)', () => {
  const ctx = ctxOf();
  // Divan Fragment почти не продают: за час уйдёт меньше, чем выпадет за 2,5 рана
  ctx.bazaar.set('DIVAN_FRAGMENT', bz(50 * M, 50));
  const x = by(moneyMethods(member(7), ctx), 'crystal-nucleus');
  const perHourDemand = 50 / 7 * 0.1 / 24; // штук в час
  // сверху: всё остальное + Divan Fragment не больше спроса за час
  const base = by(moneyMethods(member(7), ctxOf({})), 'crystal-nucleus');
  assert.ok(x.coinsPerHour < base.coinsPerHour + perHourDemand * 50 * M * 1.01 + 1, `${x.coinsPerHour}`);
});

test('редкий дорогой дроп не режется лимитом продаж и виден отдельно (Divan\'s Alloy)', () => {
  const ctx = ctxOf();
  // аукцион почти без продаж, цена 1 млрд
  ctx.bin.set('DIVAN_ALLOY', { price: 1_000_000_000, count: 2 });
  const x = by(moneyMethods(member(7), ctx), 'crystal-nucleus');
  const alloy = x.breakdown.find(b => b.id === 'DIVAN_ALLOY');
  assert.ok(alloy, 'Divan\'s Alloy в разборе');
  assert.ok(alloy.rare, 'помечен редким');
  // 17 бросков × 0,0059% ≈ 0,1% за ран; при 2,5 рана в час ≈ раз в 400 часов
  assert.ok(alloy.chance > 0.0009 && alloy.chance < 0.0011, `шанс за ран ${alloy.chance}`);
  assert.ok(alloy.everyHours > 300 && alloy.everyHours < 500, `раз в ${alloy.everyHours} ч`);
  // вклад в час: шанс × цена × ранов в час, без обрезки спросом (на аукционе 0 продаж за сутки, цена лота ×0,7 нет — берём sellValue)
  assert.ok(alloy.perHour > 1_500_000, `вклад ${alloy.perHour}`);
  assert.equal(x.breakdownUnit, 'ран');
});

test('рыбалка: шанс дропа отдельно от размера стопки (замечание ревью)', async () => {
  const { poolIncome } = await import('../src/market/methods/fishing.js');
  const ctx = ctxOf();
  ctx.bazaar.set('ENCHANTED_RAW_FISH', bz(1000, 1e7));
  const pool = [{ name: 'Yeti', w: 1, drops: [['ENCHANTED_RAW_FISH', 24, 1]], xp: 0 }, { name: 'Другое', w: 99, drops: [], xp: 0 }];
  const r = poolIncome(ctx, pool, 100);
  const d = r.drops.find(x => x.id === 'ENCHANTED_RAW_FISH');
  assert.ok(Math.abs(d.eventsPerHour - 1) < 1e-9, 'Yeti раз в час');
  assert.ok(Math.abs(d.perHourUnits - 24) < 1e-9, '24 штуки в час');
});

test('RNG-метр Nucleus: гарантия за 1000 ранов и рост шанса ускоряют Divan\'s Alloy', async () => {
  const { meterPerRun, nucleusMeterTargets } = await import('../src/market/methods/mining.js');
  const alloy = nucleusMeterTargets().find(t => t.id === 'DIVAN_ALLOY');
  assert.equal(alloy.xp, 1_000_000);
  assert.ok(alloy.known);
  const m = meterPerRun(alloy.p, 17, 1000);
  // без метра раз в ~1000 ранов, с метром — заметно чаще, но не реже чем раз в 1000 (гарантия)
  assert.ok(m.natural > 0.0009 && m.natural < 0.0011, String(m.natural));
  assert.ok(m.cycleRuns < 1000 && m.cycleRuns > 300, String(m.cycleRuns));
  assert.ok(m.perRun > m.natural * 1.5);
  // как в игре: при 3% шкалы шанс 0,0055% растёт до ~0,0058–0,0059%
  assert.ok(Math.abs(0.000055 * (1 + 2 * 0.03) - 0.0000583) < 1e-6);
  // почти полная шкала — до гарантии остаётся 1 ран
  assert.equal(Math.round(meterPerRun(alloy.p, 17, 1000, 999).cycleRuns), 1);
});

test('RNG-метр Nucleus в методе: цель Divan\'s Alloy, прибавка в доходе, прогресс из профиля', () => {
  const ctx = ctxOf();
  ctx.bin.set('DIVAN_ALLOY', { price: 1_500_000_000, count: 2 });
  const x = by(moneyMethods(member(7), ctx), 'crystal-nucleus');
  assert.ok(x.meter, 'есть блок метра');
  assert.equal(x.meter.best, 'DIVAN_ALLOY');
  const t = x.meter.targets.find(a => a.id === 'DIVAN_ALLOY');
  // метр примерно удваивает частоту Alloy: прибавка ≈ 0,1% × 1,5 млрд ≈ 1,3–1,6 млн за ран
  assert.ok(t.extraPerRun > 1_000_000 && t.extraPerRun < 2_000_000, String(t.extraPerRun));
  assert.match(x.detail, /RNG-метр/);
  const m = member(7);
  m.mining.nucleusMeter = { xp: 30_000, selected: 'DIVAN_ALLOY' };
  assert.deepEqual(by(moneyMethods(m, ctx), 'crystal-nucleus').meter.progress, { xp: 30_000, selected: 'DIVAN_ALLOY' });
});

test('Nucleus: ран в минус без Alloy, но в плюс с метром — метод не пропадает (замечание ревью)', () => {
  const ctx = ctxOf();
  ctx.bin.set('DIVAN_ALLOY', { price: 1_500_000_000, count: 2 });
  // детали Automaton дорогие: без метра ран убыточен (≈ стоимость рана без Alloy-гарантии), с метром — в плюс
  const PART = 650_000;
  for (const id of ['SYNTHETIC_HEART', 'CONTROL_SWITCH', 'SUPERLITE_MOTOR', 'ROBOTRON_REFLECTOR', 'FTX_3070', 'ELECTRON_TRANSMITTER']) ctx.bazaar.set(id, bz(PART, 2e4));
  const x = by(moneyMethods(member(7), ctx), 'crystal-nucleus');
  assert.ok(x.meter && x.coinsPerHour > 0, String(x.coinsPerHour));
});
