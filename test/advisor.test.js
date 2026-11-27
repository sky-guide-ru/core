import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadmap, buildProgressMap, advise, diffRoadmaps, collectionTiersFromResources } from '../src/advisor/index.js';
import { ownercatMember, PRICES } from './fixtures/ownercat.js';

const price = id => PRICES[id] || 0;
const ACC = { highestMp: 1009, cheapestNext: [{ id: 'X_RING', name: 'X Ring', gain: 8, price: 400_000, perMp: 50_000 }], notRecombCount: 3, recombPrice: 6.5e6, recombGain: 15 };
const GEAR = { topItems: [{ name: 'Old Sword', where: 'Рюкзак 2', value: 30e6 }] };
const byId = steps => new Map(steps.map(s => [s.id, s]));

test('шаги корректной формы, отсортированы, на русском и без мусора', () => {
  const steps = buildRoadmap(ownercatMember(), ACC, GEAR, { price });
  assert.ok(steps.length > 20);
  const ids = new Set();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    for (const k of ['id', 'cat', 'priority', 'effort', 'title', 'why', 'how']) assert.ok(s[k] !== undefined, `${s.id}: нет ${k}`);
    assert.ok(Array.isArray(s.how));
    assert.ok(s.priority >= 0 && s.priority <= 100);
    assert.ok(!ids.has(s.id), `дубль ${s.id}`); ids.add(s.id);
    if (i) assert.ok(steps[i - 1].priority >= s.priority, 'не отсортировано');
    const text = [s.title, s.why, ...s.how].join(' ');
    assert.match(text, /[а-яё]/i, `${s.id}: нет русского текста`);
    assert.doesNotMatch(text, /undefined|NaN|\[object/, `${s.id}: мусор в тексте: ${text}`);
    assert.notEqual(s.cat, 'Служебное', `правило упало: ${s.why}`);
  }
});

test('ключевые дыры профиля OwnerCat попадают в roadmap', () => {
  const s = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { price }));
  for (const id of ['dungeon-master', 'dungeon-cata', 'slayer-blaze', 'slayer-vampire', 'kuudra', 'pets-taming-cap', 'hotf', 'skill-foraging', 'rift-souls', 'fairy-collect', 'mp-cheap', 'gear-equipment', 'money-idle']) {
    assert.ok(s.has(id), `нет шага ${id}`);
  }
  // M2 открывается только после победы на M1, даже при Catacombs 26+
  assert.match(s.get('dungeon-master').title, /Начни Master Mode с M1$/);
  assert.match(s.get('fairy-collect').title, /44 из 289/);
  assert.match(s.get('pets-taming-cap').title, /50 → 60/);
  assert.ok(s.get('slayer-blaze').priority > s.get('slayer-wolf').priority, 'блейз важнее волка 7→8');
  assert.ok(!s.has('fairy-exchange'), 'нечего обменивать');
  assert.ok(!s.has('cookie'), 'куки активна');
});

test('Master Mode: следующий этаж открывается победой на предыдущем', () => {
  const m = ownercatMember();
  m.dungeons.masterFloors = { 1: 3 };
  const s = byId(buildRoadmap(m, ACC, GEAR, { price }));
  assert.match(s.get('dungeon-master').title, /Пройди M2/);
  assert.match(s.get('dungeon-cata').how[0], /M2/);
});

test('Master Mode не советуется без F7, обмен фей — при 5+ несданных', () => {
  const m = ownercatMember();
  m.dungeons.floors['7'] = 0;
  m.fairySouls.unspent = 12;
  const s = byId(buildRoadmap(m, ACC, GEAR, { price }));
  assert.ok(!s.has('dungeon-master'));
  assert.match(s.get('fairy-exchange').title, /2 обмена/);
  assert.match(s.get('fairy-exchange').why, /12/);
});

test('лестницы: цель — самый высокий тир с выполненными требованиями', () => {
  const s = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { price }));
  assert.match(s.get('gear-ender-slayer-weapon').title, /Atomsplit Katana/);
  // Лук и ближний бой — разные стили: при Juju меч против слеера не обязателен, а кинжалы Blaze — обязательны
  assert.match(s.get('gear-zombie-slayer-weapon').how.at(-1), /лук — свой стиль игры/);
  assert.match(s.get('gear-dungeon-archer-weapon').title, /Juju Shortbow .* → Terminator/);
  assert.match(s.get('gear-kuudra-armor').title, /(→|начни с) Hot /, 'броня Kuudra под открытый тир');
  assert.match(s.get('gear-farming-armor').title, /Fermento Armor → Helianthus Armor/, 'после Fermento — Helianthus');
  assert.ok(!s.has('gear-mining-drill'), "Divan's Drill уже есть");
});

test('Master Stars обещаются только с M3: на M1–M2 их нет', () => {
  const m = ownercatMember();
  let st = byId(buildRoadmap(m, ACC, GEAR, { price })).get('dungeon-master');
  assert.match(st.title, /M1$/);
  assert.doesNotMatch(st.why, /лут: Master Stars/);
  assert.match(st.why, /Master Stars падают начиная с M3/);
  assert.ok(!st.items.includes('FIRST_MASTER_STAR'));
  m.dungeons.catacombs.level = 30;
  m.dungeons.masterFloors = { 1: 2, 2: 1 };
  st = byId(buildRoadmap(m, ACC, GEAR, { price })).get('dungeon-master');
  assert.match(st.title, /M3/);
  assert.match(st.why, /First Master Star/);
  assert.ok(st.items.includes('FIRST_MASTER_STAR'));
});

test('оружие следующего тира не советуется до нужного уровня слеера', () => {
  const m = ownercatMember();
  m.slayers.zombie = { ...(m.slayers.zombie || {}), level: 7, name: 'Revenant Horror' };
  const own = { id: 'REAPER_SWORD', name: 'Reaper Falchion', count: 1 };
  m.inv = { ...(m.inv || {}), inventory: [...(m.inv?.inventory || []), own] };
  const steps = buildRoadmap(m, ACC, GEAR, { price });
  const s = byId(steps);
  assert.ok(!s.has('gear-zombie-slayer-weapon'), s.get('gear-zombie-slayer-weapon')?.title);
  const node = buildProgressMap(m, ACC, GEAR, { price }).branches.flatMap(b => b.nodes).find(n => n.id === 'ladder:zombie-slayer-weapon');
  if (node) assert.equal(node.stepId, 'slayer-zombie');
  m.slayers.zombie.level = 8;
  assert.match(byId(buildRoadmap(m, ACC, GEAR, { price })).get('gear-zombie-slayer-weapon').title, /Halberd of the Shredded/);
});

test('цены: дорогие шаги помечаются needsSaving и опускаются', () => {
  const withP = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { price }));
  const noP = byId(buildRoadmap(ownercatMember(), ACC, GEAR));
  const t = withP.get('gear-dungeon-archer-weapon');
  assert.equal(t.cost, PRICES.TERMINATOR);
  assert.equal(t.needsSaving, true);
  assert.ok(t.priority < noP.get('gear-dungeon-archer-weapon').priority);
  assert.equal(noP.get('gear-dungeon-archer-weapon').cost, undefined);
  const rich = ownercatMember(); rich.bank = 3e9;
  assert.ok(!byId(buildRoadmap(rich, ACC, GEAR, { price })).get('gear-dungeon-archer-weapon').needsSaving);
});

test('методы заработка из модуля prices и план покупок', () => {
  const r = advise(ownercatMember(), ACC, GEAR, { price, moneyMethods: [
    { id: 'a', title: 'Фарм', available: true, coinsPerHour: 20e6, desc: 'Сад' },
    { id: 'b', title: 'Kuudra Infernal', available: false, coinsPerHour: 90e6 },
  ] });
  const best = r.roadmap.find(s => s.id === 'money-best');
  assert.match(best.title, /Фарм/);
  assert.ok(r.plan.length > 0);
  assert.ok(r.plan.every((p, i) => !i || p.cumulative >= r.plan[i - 1].cumulative));
  const term = r.plan.find(p => p.stepId === 'gear-dungeon-archer-weapon');
  assert.equal(term.affordableNow, false);
  assert.ok(term.hoursOfFarming > 0);
});

test('карта прогрессии', () => {
  const map = buildProgressMap(ownercatMember(), ACC, GEAR, { price });
  const b = Object.fromEntries(map.branches.map(x => [x.id, x]));
  for (const id of ['dungeons', 'slayers', 'kuudra', 'accessories', 'gear', 'skills', 'pets', 'minions', 'mining', 'foraging', 'rift', 'general']) assert.ok(b[id], `нет ветки ${id}`);
  const st = new Set(['done', 'current', 'available', 'locked']);
  for (const br of map.branches) for (const n of br.nodes) {
    assert.ok(st.has(n.status), `${n.id}: ${n.status}`);
    assert.ok(n.progress === undefined || (n.progress >= 0 && n.progress <= 1), `${n.id}: progress ${n.progress}`);
  }
  const node = id => map.branches.flatMap(x => x.nodes).find(n => n.id === id);
  assert.equal(node('dungeon:f7').status, 'done');
  assert.equal(node('dungeon:m1').status, 'current');
  assert.equal(node('dungeon:m3').status, 'locked');
  assert.equal(node('kuudra:hot').status, 'done');
  assert.equal(node('kuudra:burning').status, 'locked');
  assert.equal(node('mp:1100').status, 'current');
  assert.equal(node('hotf:4').status, 'current');
  assert.ok(map.overall.progress > 0 && map.overall.progress < 1);
  // stepId на карте ссылаются на существующие шаги (там, где шаг есть)
  const ids = new Set(buildRoadmap(ownercatMember(), ACC, GEAR, { price }).map(s => s.id));
  assert.ok(ids.has(node('dungeon:m1').stepId));
});

test('пустой/неполный профиль не роняет движок', () => {
  const steps = buildRoadmap({ skills: {}, pets: [], inv: {} });
  assert.ok(Array.isArray(steps));
  assert.ok(!steps.some(s => s.cat === 'Служебное'), 'ни одно правило не должно падать');
  const map = buildProgressMap({ skills: {}, pets: [], inv: {} });
  assert.ok(Array.isArray(map.branches));
});

test('diffRoadmaps и collectionTiersFromResources', () => {
  const a = [{ id: 'x', priority: 10 }, { id: 'y', priority: 10 }];
  const b = [{ id: 'y', priority: 10 }, { id: 'z', priority: 5 }];
  const d = diffRoadmaps(a, b);
  assert.deepEqual(d.completed.map(s => s.id), ['x']);
  assert.deepEqual(d.added.map(s => s.id), ['z']);
  const tiers = collectionTiersFromResources({ collections: { FARMING: { items: { WHEAT: { tiers: [{ tier: 2, amountRequired: 100 }, { tier: 1, amountRequired: 50 }] } } } } });
  assert.deepEqual(tiers, { WHEAT: [50, 100] });
  const s = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { collectionTiers: { LOG: [100, 50_000, 100_000] } }));
  assert.match(s.get('collections-near').how[0], /до тира 2 из 3/);
});

test('в советах нет сырых id: питомцы и миньоны названы по-человечески', () => {
  const m = ownercatMember();
  m.minions = ['WHEAT_1', 'WHEAT_2', 'CAVESPIDER_1'];
  const steps = buildRoadmap(m, ACC, GEAR, { price });
  const text = steps.flatMap(s => [s.title, s.why, ...(s.how || [])]).join('\n');
  assert.doesNotMatch(text, /\b[A-Z]{3,}_[A-Z_]{3,}\b/, 'сырой id вида GOLDEN_DRAGON');
  { const bad = text.split('\n').find(l => /\b(GOLDEN DRAGON|BLACK CAT|GRIFFIN)\b/.test(l)); assert.ok(!bad, 'имя питомца капсом: ' + bad); }
  assert.doesNotMatch(text, /\bcavespider\b|шаг\(ов\)/);
});

test('план для игрока без F7 и Master Mode: не советует Necron и не пишет «после Master Mode»', async () => {
  const { ownercatMember: mkm } = await import('./fixtures/ownercat.js');
  const m = mkm();
  m.dungeons.catacombs.level = 15;
  m.dungeons.floors = { 0: 3, 1: 5, 2: 4, 3: 2, 4: 1 };
  m.dungeons.masterFloors = {};
  m.slayers.blaze = { ...(m.slayers.blaze || {}), level: 0, xp: 0, kills: {} };
  const { advise: adv } = await import('../src/advisor/index.js');
  const r = adv(m, null, null, { price: () => 1000 });
  const armor = r.roadmap.find(s => s.id === 'gear-dungeon-armor');
  // Necron советуется только с пометкой, что сначала нужен F7 (у фикстуры уже есть Shadow Assassin)
  if (armor && /Necron/.test(armor.title)) assert.match(armor.why, /пройди F7/);
  const blaze = r.roadmap.find(s => s.id === 'slayer-blaze');
  assert.ok(blaze, 'шаг блейза есть');
  assert.ok(!/после Master Mode/.test(blaze.why), blaze.why);
});

test('«Главное сейчас» — не покупка, на которую нужно копить: сначала дешёвый прогресс', () => {
  const m = ownercatMember();
  const L = (level, maxLevel, name) => ({ ...m.skills.fishing, level, maxLevel, name, xpForNext: 1e6, xpCurrent: 3e5 });
  Object.assign(m.skills, { fishing: L(20, 50, 'Fishing'), foraging: L(26, 54, 'Foraging'), farming: L(28, 60, 'Farming') });
  m.skillAverage = 44.5; m.bank = 2.91e9;
  m.museum = { status: 'ok', keys: ['FANCY_SWORD'], borrowing: [], special: [], value: 0, appraisal: false };
  m.inv.inventory = [...(m.inv.inventory || []), { id: 'ROGUE_SWORD' }];
  const acc = { highestMp: 1948, cheapestNext: [
    ['BURSTSTOPPER_TALISMAN', 8, 46.3e6], ['COIN_ARTIFACT', 3, 84.9e6], ['BINGO_RING', 5, 410e6], ['ARTIFACT_OF_CONTROL', 16, 1.98e9], ['RIFT_PRISM', 8, 1.5e9],
  ].map(([id, gain, p]) => ({ id, name: id, gain, price: p, perMp: p / gain })) };
  const cheapPrice = id => ({ ROGUE_SWORD: 5000, ZOMBIE_PICKAXE: 3, SWORD_OF_BAD_HEALTH: 50_000, ICY_SINKER: 30_000 })[id] || 20_000;
  const r = advise(m, acc, null, { price: cheapPrice });
  const s = byId(r.roadmap);
  // Дорогие аксессуары — отдельным шагом в конце плана, выгодные — наверху
  assert.deepEqual(s.get('mp-cheap').items, ['BURSTSTOPPER_TALISMAN']);
  assert.ok(s.get('mp-expensive').needsSaving && s.get('mp-expensive').items.includes('ARTIFACT_OF_CONTROL'));
  assert.ok(!r.roadmap[0].needsSaving, `первым стоит шаг, на который надо копить: ${r.roadmap[0].title}`);
  const p = id => s.get(id).priority;
  for (const id of ['skill-fishing', 'skill-foraging', 'slayer-vampire', 'hotf', 'museum-cheap']) {
    assert.ok(p(id) > p('mp-expensive'), `${id} ниже дорогих аксессуаров`);
    assert.ok(p(id) > p('museum-donate-owned'), `${id} ниже «пожертвуй, что есть»`);
  }
  assert.match(s.get('skill-fishing').why, /отстаёт/);
});

test('дорогие покупки не попадают в «Быстрые победы»: Rift Prism, пустой и развитый профиль', () => {
  const P = { ...PRICES, RIFT_PRISM: 1.35e9, BOOSTER_COOKIE: 4e6, PET_ITEM_ALL_SKILLS_BOOST_COMMON: 60e3, MOLTEN_BELT: 3e6 };
  const pr = id => P[id] || 0;
  const fresh = {
    uuid: 'x', skills: {}, slayers: {}, dungeons: { catacombs: { level: 0 }, floors: {}, masterFloors: {} }, purse: 0, bank: 0,
    fairySouls: { collected: 0 }, cookie: false, riftPrism: false, magicalPower: 0,
    pets: [{ type: 'BEE', tier: 'COMMON', active: true, exp: 0 }], inv: { equipment: [] }, rift: {}, garden: {}, museum: {},
  };
  const cases = [
    ['новый профиль', fresh, { highestMp: 0, cheapestNext: [] }],
    ['развитый без призмы', { ...ownercatMember(), riftPrism: false }, ACC],
  ];
  for (const [name, m, acc] of cases) {
    const st = buildRoadmap(m, acc, GEAR, { price: pr });
    const liquid = (m.purse || 0) + (m.bank || 0) + (m.personalBank || 0);
    for (const s of st) {
      if (s.cat === 'Быстрые победы') assert.ok(!(s.cost > liquid * 0.5), `${name}: «${s.title}» стоит ${s.cost} при ${liquid}`);
      if (s.needsSaving) assert.doesNotMatch(s.effort, /минут/, `${name}: «${s.title}» — «минуты», а надо копить`);
    }
    assert.ok(!st.some(s => s.id === 'mp-rift-prism'), `${name}: Rift Prism за 1,35 млрд советуется`);
  }
  // Новый профиль: печенье за 4 млн при 0 монет — уже не «быстрая победа»
  const cookie = buildRoadmap(fresh, { highestMp: 0, cheapestNext: [] }, GEAR, { price: pr }).find(s => s.id === 'cookie');
  assert.equal(cookie.cat, 'Покупки');
  // Богатый игрок: призма — дорогой шаг про аксессуары, а не «минуты»
  const rich = byId(buildRoadmap({ ...ownercatMember(), riftPrism: false, purse: 3e9 }, ACC, GEAR, { price: pr }));
  assert.equal(rich.get('mp-rift-prism').cat, 'Аксессуары и Magical Power');
  assert.equal(rich.get('mp-rift-prism').cost, 1.35e9);
  assert.ok(rich.get('mp-rift-prism').priority < 50);
  // Призма уже лежит в инвентаре — тогда это быстрая победа
  const has = ownercatMember();
  has.riftPrism = false; has.inv.inventory = [...(has.inv.inventory || []), { id: 'RIFT_PRISM', name: 'Rift Prism' }];
  assert.equal(byId(buildRoadmap(has, ACC, GEAR, { price: pr })).get('mp-rift-prism').cat, 'Быстрые победы');
});

test('имена питомцев без шаблона «[Lvl {LVL}]»: у своих — уровень, у покупок — редкость', () => {
  const m = ownercatMember();
  m.pets = [...m.pets, { id: 'GOLEM_X;4', type: 'GOLEM_X', tier: 'LEGENDARY', level: 96, maxLevel: 100, exp: 0 }];
  const steps = buildRoadmap(m, ACC, GEAR, { price: id => price(id) || (id.includes(';') ? 1e5 : 0), itemName: id => (id.includes(';') ? `[Lvl {LVL}] ${id.split(';')[0]}` : null) });
  const ps = steps.find(s => s.id === 'pets-score');
  assert.ok(ps.how.some(h => /^Докачай GOLEM_X \(Lvl 96 → 100\)/.test(h)), ps.how.join(' | '));
  assert.ok(ps.how.some(h => /^Купить: \S+ \((Common|Uncommon|Rare|Epic|Legendary|Mythic)\) — /.test(h)), ps.how.join(' | '));
  assert.ok(!ps.how.some(h => /^Купить:.*Lvl/.test(h)), 'в покупках нет уровня');
  for (const s of steps) {
    const text = [s.title, s.why, ...s.how, ...Object.values(s.itemNames || {})].join(' ');
    assert.doesNotMatch(text, /\{LVL\}/, `${s.id}: ${text}`);
  }
});

test('Master Mode: не готов по снаряжению — шаг подготовки, а не «начни M1»', () => {
  const m = ownercatMember();
  m.magicalPower = 355;
  for (const it of m.inv.armor) it.stars = 0;
  const s = byId(buildRoadmap(m, { ...ACC, highestMp: 355 }, GEAR, { price }));
  assert.ok(!s.has('dungeon-master'), 'рано советовать M1');
  const prep = s.get('dungeon-master-prep');
  assert.match(prep.title, /Подготовься к M1/);
  assert.ok(prep.how.some(h => /Magical Power 355/.test(h)));
  assert.match(prep.why, /F7/);
  assert.ok(prep.priority < 86);
});

test('Master Mode: M1 честно описан как ступенька к M3', () => {
  const s = byId(buildRoadmap(ownercatMember(), ACC, GEAR, { price }));
  const st = s.get('dungeon-master');
  assert.match(st.why, /меньше опыта Catacombs, чем F7/);
  assert.doesNotMatch(st.why, /намного больше опыта/);
  assert.match(st.calc, /Готовность к M1/);
});

test('боевая сводка и расчёты у шагов', () => {
  const r = advise(ownercatMember(), ACC, GEAR, { price });
  assert.ok(r.power?.world?.health > 100, 'лист статов посчитан');
  assert.ok(r.power.ehp.world.normal >= r.power.world.health);
  const cheap = r.roadmap.find(x => x.id === 'mp-cheap');
  assert.match(cheap.calc, /Power Silky: удар мечом \+[\d,]+%/);
  for (const st of r.roadmap) if (st.calc) assert.doesNotMatch(st.calc, /undefined|NaN/);
});
