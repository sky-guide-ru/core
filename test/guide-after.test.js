import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFTER, finalizeGuide } from '../src/guides/after.js';
import { GUIDES } from '../src/guides/index.js';

test('пройденный гайд не пустеет: итог, цели и связанные гайды; оставшиеся шаги считаются необязательными', () => {
  const g = finalizeGuide({ id: 'fishing', status: 'done', summary: 'Fishing 50/50', next: [{ title: 'Добей бестиарий' }], sections: [{ kind: 'text', title: 't', text: 'x' }] });
  assert.ok(g.complete.goals.length >= 2);
  assert.ok(g.complete.related.includes('trophy'));
  assert.equal(g.complete.optional, 1);
  assert.equal(g.sections.length, 1, 'справка остаётся');
  assert.equal(g.almost, false);
});

test('«почти готово»: от 85% полоски уровня, только для гайдов в процессе', () => {
  assert.equal(finalizeGuide({ id: 'x', status: 'progress', level: { value: 8, max: 9 } }).almost, true);
  assert.equal(finalizeGuide({ id: 'x', status: 'progress', level: { value: 7, max: 9 } }).almost, false);
  assert.equal(finalizeGuide({ id: 'x', status: 'start', level: { value: 9, max: 10 } }).almost, false);
  assert.equal(finalizeGuide({ id: 'x', status: 'progress', almost: true }).almost, true, 'гайд может решить сам');
  assert.ok(finalizeGuide({ id: 'unknown', status: 'done' }).complete.goals.length, 'запасной текст для гайда без записи');
});

test('у каждого гайда есть «что дальше», связанные гайды существуют', () => {
  const ids = new Set(GUIDES.map(g => g.id));
  for (const id of ids) {
    assert.ok(AFTER[id]?.goals?.length, `нет AFTER у ${id}`);
    for (const r of AFTER[id].related) assert.ok(ids.has(r) && r !== id, `${id}: связанный гайд ${r}`);
  }
});
