import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendNoMember, loadMember } from '../src/lib/view-error.js';

const mkRes = () => {
  const r = { locals: {}, headers: {}, code: 200, body: null };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.set = (k, v) => { r.headers[k] = v; return r; };
  return r;
};

test('сайт только что запустился — 503 STARTING с Retry-After, без записи в журнал', () => {
  const res = mkRes();
  sendNoMember(res, { view: { owner: true, status: 'starting', member: null } });
  assert.equal(res.code, 503);
  assert.equal(res.body.errorCode, 'STARTING');
  assert.equal(res.headers['Retry-After'], '10');
  assert.equal(res.locals.sbExpected, true);
});

test('Hypixel не ответил — 502 с причиной, без записи в журнал', () => {
  const res = mkRes();
  sendNoMember(res, { err: Object.assign(new Error('fetch failed'), { code: 'NETWORK' }) });
  assert.equal(res.code, 502);
  assert.match(res.body.error, /Hypixel/);
  assert.equal(res.locals.sbExpected, true);
});

test('гость без ника и неизвестный игрок — 4xx с настоящим текстом', () => {
  let res = mkRes();
  sendNoMember(res, { err: Object.assign(new Error('Введи ник игрока'), { code: 'NO_PLAYER' }) });
  assert.equal(res.code, 400); assert.equal(res.body.error, 'Введи ник игрока');
  res = mkRes();
  sendNoMember(res, { err: Object.assign(new Error('Игрок X не найден'), { code: 'NOT_FOUND' }) });
  assert.equal(res.code, 404);
});

test('loadMember: профиль, отказ и пустой вид', async () => {
  let out = {};
  assert.deepEqual(await loadMember({ sbView: async () => ({ member: { a: 1 } }) }, out), { a: 1 });
  out = {};
  assert.equal(await loadMember({ sbView: async () => { throw new Error('x'); } }, out), null);
  assert.equal(out.err.message, 'x');
  out = {};
  assert.equal(await loadMember({ sbView: async () => ({ status: 'starting', member: null }) }, out), null);
  assert.equal(out.view.status, 'starting');
});
