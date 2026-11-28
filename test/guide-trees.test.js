import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calc, describe as perkText, hotmTokens, buildTree, spendPlan, hotmTreeSection, hotfTreeSection, purchaseOrder, connected } from '../src/guides/trees/index.js';
import { TREES } from '../src/guides/trees/data.js';
import { BUILDS } from '../src/guides/trees/builds.js';

// Дерево HotM профиля Zucchini по снимку API 2026-11-23
const ZUCCHINI_NODES = { core_of_the_mountain: 10, blockhead: 20, eager_adventurer: 55, efficient_miner: 100, fortunate_mineman: 21, gem_lover: 20, great_explorer: 20, keep_it_cool: 50, lonesome_miner: 37, mining_fortune: 50, mining_speed: 48, mole: 200, old_school: 20, powder_buff: 50, professional: 140, quick_forge: 20, seasoned_mineman: 1, sheer_force: 1, sky_mall: 1, speedy_mineman: 50, subterranean_fisher: 40, surveyor: 11, vanguard_seeker: 1, dead_mans_chest: 1, mining_master: 3 };
const zucchini = () => ({
  mining: { hotm: { level: 10 }, nodes: ZUCCHINI_NODES, potm: 10, tokensSpent: 24, ability: 'sheer_force', powder: { mithrilAvail: 8_749_860, gemstoneAvail: 27_946_599, glaciteAvail: 680_743 } },
  hotfXp: 28_080, hotfNodes: {}, gather: { tokensForest: 0, whispers: { forest: { total: 250_122, available: null } } },
});

test('деревья: формулы NEU (lisp) считаются', () => {
  assert.equal(calc('(+ 1 (* level 2))', { level: 3 }), 7);
  assert.equal(calc('(floor (pow (+ level 2) 3))', { level: 1 }), 27);
  assert.equal(calc('(if (lt level 5) 10 20)', { level: 7 }), 20);
  assert.equal(calc('"MITHRIL"', {}), 'MITHRIL');
  assert.equal(calc('(oops', {}), null);
});

test('деревья: у каждого перка русское описание без пустых подстановок', () => {
  for (const [kind, perks] of Object.entries(TREES)) {
    for (const [id, p] of Object.entries(perks)) {
      assert.ok(p.ru && (/[а-яё]/i.test(p.ru) || /^\+\{stat\} [A-Z][\w ]+\.$/.test(p.ru)), `${kind}/${id}: нет русского описания`); // чистые статы оставляем как в игре
      const t = perkText(p, p.max, { potm: 10, hotm: 10 });
      assert.ok(!/\{stat/.test(t) && !/NaN|undefined/.test(t), `${kind}/${id}: ${t}`);
    }
  }
});

test('деревья: сборки ссылаются только на существующие перки', () => {
  for (const [kind, list] of Object.entries(BUILDS)) {
    for (const b of list) {
      for (const id of [...b.perks, ...(b.order || []), ...(b.optional || [])]) assert.ok(TREES[kind][id], `${kind}/${b.id}: нет перка ${id}`);
      assert.ok(b.pros.length && b.cons.length, `${kind}/${b.id}: нужны плюсы и минусы`);
    }
  }
});

test('HotM: токены за уровни и Core of the Mountain', () => {
  assert.equal(hotmTokens(10, 10), 24);
  assert.equal(hotmTokens(1, 0), 1);
  assert.equal(hotmTokens(7, 7), 16);
});

test('HotM: дерево Zucchini — уровни, состояния и план вложения Powder', () => {
  const t = buildTree('hotm', ZUCCHINI_NODES, { level: 10, potm: 10 });
  const by = Object.fromEntries(t.perks.map(p => [p.id, p]));
  assert.equal(t.rows, 10);
  assert.equal(by.mining_speed.state, 'partial');
  assert.equal(by.mining_speed.tier, 1);
  assert.equal(by.mole.state, 'max');
  assert.equal(by.front_loaded.state, 'open');
  assert.ok(by.mining_speed.costNext > 0 && by.mining_speed.now && by.mining_speed.next);

  const s = hotmTreeSection(zucchini(), {});
  assert.equal(s.kind, 'tree');
  assert.deepEqual(s.tokens, { total: 24, spent: 24, free: 0 });
  assert.equal(s.recommended, 'gems');
  const plan = Object.fromEntries(s.plan.map(x => [x.id, x]));
  assert.equal(plan.mining_speed.to, 50);
  assert.equal(plan.mining_speed.powder, 'MITHRIL');
  assert.equal(plan.fortunate_mineman.powder, 'GEMSTONE');
  assert.equal(new Set(s.plan.map(x => x.id)).size, s.plan.length, 'перки в плане не повторяются');
  for (const k of ['MITHRIL', 'GEMSTONE', 'GLACITE']) assert.ok(s.leftover[k] >= 0);
  const gems = s.builds.find(b => b.id === 'gems');
  assert.ok(gems.missing.includes('front_loaded'));
  assert.ok(gems.extra.includes('dead_mans_chest'));
});

test('HotM: план не тратит больше, чем есть', () => {
  const t = buildTree('hotm', { mining_speed: 1 }, { level: 1 });
  const { plan, left } = spendPlan(t, ['mining_speed'], { MITHRIL: 100 });
  assert.ok(left.MITHRIL >= 0);
  assert.equal(plan.reduce((s, x) => s + x.cost, 0) + left.MITHRIL, 100);
});

test('HotF: уровень по поуровневой таблице, Whispers без свободного остатка', () => {
  const s = hotfTreeSection(zucchini(), {});
  assert.equal(s.level, 3);
  assert.equal(s.tokens.spent, 0);
  assert.equal(s.resources[0].total, 250_122);
  assert.equal(s.resources[0].avail, null);
  assert.ok(s.perks.find(p => p.id === 'sweep'));
});

test('HotM: Core of the Mountain через смену Powder — отдельные шаги со своей ценой', () => {
  const t = buildTree('hotm', { core_of_the_mountain: 3 }, { level: 10, potm: 3 });
  const { plan } = spendPlan(t, ['core_of_the_mountain'], { MITHRIL: 1e6, GEMSTONE: 2e6, GLACITE: 0 });
  assert.deepEqual(plan.map(x => [x.from, x.to, x.powder, x.cost]), [[3, 4, 'MITHRIL', 200000], [4, 7, 'GEMSTONE', 1300000]]);
});

test('сборки: короткий план шагов и цель по каждому перку', () => {
  const s = hotmTreeSection(zucchini(), {});
  const gems = s.builds.find(b => b.id === 'gems');
  assert.ok(gems.steps.length >= 1 && gems.steps.length <= 5);
  const swap = gems.steps.find(x => x.kind === 'swap');
  assert.ok(swap, 'без свободных токенов предлагается переставить');
  assert.equal(swap.add.length, swap.remove.length);
  // после сброса и перестановки дерево остаётся связанным: всё можно купить по цепочке
  const owned = s.perks.filter(p => p.level > 0).map(p => p.id);
  assert.ok(connected(s, owned), 'дерево Zucchini связано');
  assert.ok(connected(s, owned.filter(id => !swap.remove.includes(id)).concat(swap.add)));
  for (const x of gems.steps.filter(x => x.kind === 'up')) assert.ok(gems.perks.includes(x.id), `докачивать только перки сборки: ${x.id}`);
  assert.deepEqual(gems.targets.mining_speed, { target: 50, status: 'up' });
  // Mole в основе любой сборки, цель ~70 (SkyKings 2026); у Zucchini 200 — готово
  assert.deepEqual(gems.targets.mole, { target: 70, status: 'done' });
  assert.equal(gems.targets.subterranean_fisher.status, 'opt');
  // Sheer Force — способность для гемов, её не снимаем; цепочка до неё — «оставить для прохода»
  assert.equal(gems.targets.sheer_force.status, 'done');
  assert.equal(gems.targets.vanguard_seeker.status, 'bridge');
  for (const id of swap.remove) assert.equal(gems.targets[id].status, 'remove', `шаг плана и цель совпадают: ${id}`);
  assert.deepEqual(swap.add.sort(), ['daily_powder', 'front_loaded']);
  // в сборке Glacite основа не снимается
  const gl = s.builds.find(b => b.id === 'glacite');
  for (const id of ['professional', 'mole', 'great_explorer']) assert.equal(gl.targets[id].status, 'done', id);
  assert.equal(gl.targets.strong_arm.target, 1, 'уровни Strong Arm источники не дают — только взять');
  assert.equal(gems.targets.front_loaded.status, 'add');
  assert.equal(gems.targets.speedy_mineman.status, 'done');

  const f = hotfTreeSection(zucchini(), {}).builds.find(b => b.id === 'logs');
  assert.equal(f.steps[0].kind, 'take');
  assert.equal(f.steps[0].add[0], 'sweep');
  assert.ok(Object.values(f.targets).some(t => t.status === 'later'));
});

test('порядок покупки учитывает связи перков, а пустой план не выдаётся за готовую сборку', () => {
  const t = buildTree('hotm', {}, { level: 5 });
  const order = purchaseOrder(t, ['professional', 'gem_lover'], []);
  assert.equal(order[0], 'mining_speed', 'в пустом дереве начинаем с нижнего ряда');
  for (let i = 1; i <= order.length; i++) assert.ok(connected(t, order.slice(0, i)), `шаг ${i}: ${order[i - 1]} не соединён`);
  assert.ok(order.includes('professional') && order.includes('gem_lover'));

  const empty = hotmTreeSection({ mining: { hotm: { level: 5 }, nodes: {}, tokensSpent: 0, powder: {} } }, {});
  const take = empty.builds.find(b => b.id === 'gems').steps[0];
  for (let i = 1; i <= take.add.length; i++) assert.ok(connected(empty, take.add.slice(0, i)));

  const stuck = hotmTreeSection({ mining: { hotm: { level: 1 }, nodes: { mining_speed: 1 }, tokensSpent: 1, powder: {} } }, {});
  const g = stuck.builds.find(b => b.id === 'gems');
  assert.equal(g.steps.length, 0);
  assert.equal(g.targets.mining_speed.status, 'up', 'цели остаются, клиент пишет «сейчас нечего», а не «всё сделано»');
});

test('перестановка подбирает замену, если выбранный к снятию перк нужен как проход', () => {
  const t = buildTree('hotm', {}, { level: 10 });
  const com = BUILDS.hotm.find(b => b.id === 'commissions');
  const owned = purchaseOrder(t, [...com.perks.filter(id => id !== 'speedy_mineman'), 'no_stone_unturned', 'mining_speed_boost'], []);
  assert.ok(connected(t, owned));
  const nodes = Object.fromEntries(owned.map(id => [id, 1]));
  const s = hotmTreeSection({ mining: { hotm: { level: 10 }, nodes, tokensSpent: owned.length, powder: {} } }, {});
  const b = s.builds.find(x => x.id === 'commissions');
  assert.deepEqual(b.missing, ['speedy_mineman']);
  const swap = b.steps.find(x => x.kind === 'swap');
  assert.ok(swap, 'есть лишний перк — перестановка должна найтись');
  assert.deepEqual(swap.add, ['speedy_mineman']);
  assert.ok(connected(s, owned.filter(id => !swap.remove.includes(id)).concat(swap.add)));
});

test('сборка Mithril и Titanium: металлы сверху дерева, Sky Mall остаётся', () => {
  const s = hotmTreeSection(zucchini(), {});
  const b = s.builds.find(x => x.id === 'mithril');
  assert.ok(b, 'есть вкладка Mithril и Titanium');
  // Mithril и Titanium — Dwarven Metals: Strong Arm и Metal Head в сборке, Titanium Insanium — шанс Titanium
  for (const id of ['titanium_insanium', 'strong_arm', 'metal_head']) assert.equal(b.targets[id].status, 'add', id);
  assert.equal(b.targets.titanium_insanium.target, 50);
  const swap = b.steps.find(x => x.kind === 'swap');
  assert.ok(swap && swap.add.includes('titanium_insanium') && swap.add.includes('metal_head'));
  assert.ok(swap.bridge.includes('no_stone_unturned'), 'Metal Head достаётся через No Stone Unturned');
  // снимаются лишние перки сверху, а не Sky Mall «по желанию»
  assert.ok(!swap.remove.includes('sky_mall'), swap.remove.join());
  assert.ok(connected(s, s.perks.filter(p => p.level > 0).map(p => p.id).filter(id => !swap.remove.includes(id)).concat(swap.add)));
  // гемовые перки на Mithril не работают, но держат дерево — «оставить для прохода», а не «сделано»
  assert.equal(b.targets.professional.status, 'bridge');
  assert.equal(b.targets.mole.status, 'bridge');
});
