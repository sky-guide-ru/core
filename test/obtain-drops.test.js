// Количество дропа в «Как получить»: «×N–M · шанс X%», доход одного захода по цене рынка,
// русские пояснения к кнопкам Bazaar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObtainGuide, costTree, dropAmount, dropLabel } from '../src/analysis/obtain.js';

// ---------- количество дропа ----------

test('dropAmount: из «Drop Count: x20-35» и из суффикса id', () => {
  assert.deepEqual(dropAmount({ id: 'PORK', extra: ['§eDrop Count: §7x20-35'] }), { min: 20, max: 35 });
  assert.deepEqual(dropAmount({ id: 'ESSENCE_CRIMSON:25' }), { min: 25, max: 25 });
  assert.equal(dropAmount({ id: 'FLAMING_FIST' }), null);
  assert.equal(dropLabel({ min: 20, max: 35 }, '100%'), '×20–35 · шанс 100%');
  assert.equal(dropLabel(null, '2%'), 'шанс 2%');
});

test('карточка: «×25 · шанс 100%», сколько даёт заход по цене Bazaar, русская кнопка Bazaar', () => {
  const items2 = new Map(Object.entries({
    BARBARIAN_DUKE_X_MINIBOSS: { id: 'BARBARIAN_DUKE_X_MINIBOSS', name: 'Barbarian Duke X', recipes: [
      { type: 'drops', name: '§8§lBarbarian Duke X', level: 486, panorama: 'crimson_isle', drops: [
        { id: 'ESSENCE_CRIMSON:25', chance: '100%' }, { id: 'PORK', chance: '100%', extra: ['§eDrop Count: §7x20-35'] }] },
    ] },
    ESSENCE_CRIMSON: { id: 'ESSENCE_CRIMSON', name: 'Crimson Essence', recipes: [] },
    PORK: { id: 'PORK', name: 'Raw Porkchop', recipes: [] },
  }));
  const c = { items: items2, constants: {}, buy: id => id === 'ESSENCE_CRIMSON' ? { price: 1100, order: 1050, market: 'bazaar' } : null };
  const g = buildObtainGuide('ESSENCE_CRIMSON', c);
  const drop = g.methods.find(m => m.kind === 'drop');
  assert.equal(drop.amountRu, '×25');
  const text = drop.steps.map(s => s.text).join(' ');
  assert.match(text, /падает по 25 шт\., шанс 100%/);
  assert.match(text, /~25 шт\. — это ~27,5 тыс\. монет по цене Bazaar/);
  const bz = g.methods.find(m => m.kind === 'market').steps.map(s => s.text).join(' ');
  assert.match(bz, /купи сразу \(кнопка «Buy Instantly»\)/);
  assert.match(bz, /заявку на покупку \(кнопка «Create Buy Order»\)/);
  const pork = buildObtainGuide('PORK', c).methods.find(m => m.kind === 'drop');
  assert.equal(pork.amountRu, '×20–35');
  // дерево ингредиентов тоже пишет количество
  assert.match(costTree('PORK', 1, c).viaRu, /\(×20–35 · шанс 100%\)/);
});

test('количество с вики, когда в NEU его нет (страница моба из info, перенаправления)', async () => {
  const { wikiDropAmount } = await import('../src/analysis/obtain.js');
  const nurse = { id: 'NURSE_SHARK_SC', info: ['https://hypixelskyblock.minecraft.wiki/w/Nurse_Shark'] };
  assert.deepEqual(wikiDropAmount(nurse, 'Shark Fin'), { min: 1, max: 2, src: 'wiki' });
  assert.deepEqual(wikiDropAmount(nurse, 'Nurse Shark Tooth'), { min: 1, max: 1, src: 'wiki' });
  assert.equal(wikiDropAmount(nurse, 'Unknown Thing'), null);
  // «Goblin Flamethrower» на вики — раздел общей страницы Goblins
  assert.deepEqual(wikiDropAmount({ info: ['https://hypixelskyblock.minecraft.wiki/w/Goblin_Flamethrower'] }, 'Goblin Egg'), { min: 1, max: 1, src: 'wiki' });
  const items = new Map(Object.entries({
    NURSE_SHARK_SC: { ...nurse, name: 'Nurse Shark', recipes: [{ type: 'drops', name: 'Nurse Shark', panorama: 'hub', drops: [{ id: 'SHARK_FIN', chance: '100%' }] }] },
    SHARK_FIN: { id: 'SHARK_FIN', name: 'Shark Fin', recipes: [] },
  }));
  const m = buildObtainGuide('SHARK_FIN', { items, constants: {}, buy: () => null }).methods.find(x => x.kind === 'drop');
  assert.equal(m.amountRu, '×1–2');
});
