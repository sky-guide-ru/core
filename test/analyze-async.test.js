// Разбор профиля кусками: тот же результат, что и подряд, и между кусками сервер отвечает другим
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMember, analyzeMemberAsync } from '../src/state.js';
import { ownercatMember } from './fixtures/ownercat.js';

const strip = a => JSON.parse(JSON.stringify(a, (k, v) => (k === 'generatedAt' || k === 'now' ? undefined : v)));

test('analyzeMemberAsync: тот же разбор, что analyzeMember', async () => {
  const m = ownercatMember();
  const steps = [];
  const a = await analyzeMemberAsync(m, { onStep: (step, ms) => steps.push({ step, ms }) });
  assert.deepEqual(strip(a), strip(analyzeMember(ownercatMember())));
  assert.ok(steps.length >= 6, 'расчёт разбит на куски');
  assert.ok(steps.every(s => typeof s.step === 'string' && s.ms >= 0));
});

test('analyzeMemberAsync: между кусками проходят другие задачи', async () => {
  let ticks = 0;
  const timer = setInterval(() => ticks++, 0);
  // setImmediate между кусками пропускает и таймеры, и ввод-вывод
  const seen = [];
  await analyzeMemberAsync(ownercatMember(), { onStep: () => seen.push(ticks) });
  clearInterval(timer);
  assert.ok(seen[seen.length - 1] > seen[0], `таймер срабатывал во время разбора: ${seen.join(',')}`);
});

test('reanalyze: одновременные вызовы — один разбор, результат в state', async () => {
  const { state, reanalyze, analyzeTimings } = await import('../src/state.js');
  state.member = ownercatMember();
  const p1 = reanalyze(), p2 = reanalyze();
  assert.equal(p1, p2, 'второй вызов ждёт тот же разбор');
  const gear = await p1;
  assert.equal(gear, state.analysis.gear);
  assert.ok(analyzeTimings.steps.length >= 6);
  // Профиль сменился во время разбора — устаревший результат в state не попадает
  const before = state.analysis;
  const p3 = reanalyze();
  state.member = null;
  await p3;
  assert.equal(state.analysis, before);
});
