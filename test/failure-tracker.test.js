import test from 'node:test';
import assert from 'node:assert/strict';
import { ConsecutiveFailureTracker } from '../js/failure-tracker.js';

test('2曲連続失敗では停止しない（3曲未満はスキップして継続、FR-4.15）', () => {
  const t = new ConsecutiveFailureTracker(3);
  assert.equal(t.recordFailure(), false);
  assert.equal(t.recordFailure(), false);
  assert.equal(t.isExhausted, false);
});

test('3曲連続失敗で停止判定になる (FR-4.15)', () => {
  const t = new ConsecutiveFailureTracker(3);
  t.recordFailure();
  t.recordFailure();
  const stoppedAtThird = t.recordFailure();
  assert.equal(stoppedAtThird, true);
  assert.equal(t.isExhausted, true);
});

test('成功を挟むとカウントがリセットされる', () => {
  const t = new ConsecutiveFailureTracker(3);
  t.recordFailure();
  t.recordFailure();
  t.recordSuccess();
  assert.equal(t.count, 0);
  assert.equal(t.recordFailure(), false);
  assert.equal(t.recordFailure(), false);
  assert.equal(t.isExhausted, false);
});

test('しきい値を超えて記録し続けても、isExhaustedはtrueのまま', () => {
  const t = new ConsecutiveFailureTracker(3);
  t.recordFailure(); t.recordFailure(); t.recordFailure(); t.recordFailure();
  assert.equal(t.isExhausted, true);
});

test('thresholdに0以下を指定するとエラーになる', () => {
  assert.throws(() => new ConsecutiveFailureTracker(0));
});
