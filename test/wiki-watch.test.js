import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRevisions, refreshWiki, wikiChanges, wikiNoticeSection, setWikiState, allPages, GUIDE_PAGES } from '../src/wiki/watch.js';

test('вики: разбор ответа API учитывает нормализацию названий', () => {
  const r = parseRevisions({ query: {
    normalized: [{ from: 'Trophy_Fish', to: 'Trophy Fish' }],
    pages: { 1: { title: 'Trophy Fish', revisions: [{ timestamp: '2026-02-25T22:17:30Z' }] }, '-1': { title: 'Nope', missing: '' } },
  } });
  assert.equal(r['Trophy Fish'], '2026-02-25T22:17:30Z');
  assert.equal(r.Trophy_Fish, '2026-02-25T22:17:30Z');
  assert.equal(r.Nope, undefined);
});

test('вики: пометка появляется только для страниц, правленных после сверки', async () => {
  setWikiState({ checkedAt: null, pages: {} });
  assert.equal(wikiNoticeSection('trophy'), null);
  let asked = '';
  await refreshWiki({ save: false, fetchJson: async url => { asked = url; return { query: { pages: {
    1: { title: 'Trophy Fish', revisions: [{ timestamp: '2026-02-25T22:17:30Z' }] },
    2: { title: 'Odger', revisions: [{ timestamp: '2026-12-01T10:00:00Z' }] },
  } } }; } });
  assert.ok(asked.includes('fandom.com/api.php') && asked.includes('Odger'));
  assert.ok(allPages().length <= 50, 'один запрос API — до 50 страниц');
  assert.deepEqual(wikiChanges('trophy').map(x => x.title), ['Odger']);
  const s = wikiNoticeSection('trophy');
  assert.match(s.text[0], /Odger \(1 декабря 2026/);
  assert.equal(wikiNoticeSection('crimson'), null);
  assert.ok(GUIDE_PAGES.essence.length > 5);
  setWikiState(null);
});
