import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMedley,
  renameMedley,
  addTrackToMedley,
  removeTrackFromMedley,
  isDuplicateTrack,
  isValidMedley,
} from '../js/models.js';

test('createMedley: 名前を付けて作成すると、曲0件のメドレーができる (FR-2.1)', () => {
  const m = createMedley('通勤用');
  assert.equal(m.name, '通勤用');
  assert.deepEqual(m.trackIds, []);
  assert.ok(m.id);
});

test('renameMedley: 名前を変更できる (FR-2.2)', () => {
  const m = createMedley('元の名前');
  const renamed = renameMedley(m, '新しい名前');
  assert.equal(renamed.name, '新しい名前');
  assert.equal(renamed.id, m.id, 'idは変わらない');
});

test('addTrackToMedley: 曲を追加できる (FR-2.4)', () => {
  const m = createMedley('メドレー');
  const { medley, added } = addTrackToMedley(m, 't1');
  assert.equal(added, true);
  assert.deepEqual(medley.trackIds, ['t1']);
});

test('addTrackToMedley: 同じ曲ID（重複）は追加できない (FR-2.6)', () => {
  let m = createMedley('メドレー');
  m = addTrackToMedley(m, 't1').medley;
  const { medley, added } = addTrackToMedley(m, 't1');
  assert.equal(added, false, '重複時はadded=falseになる');
  assert.deepEqual(medley.trackIds, ['t1'], '曲は増えない');
});

test('addTrackToMedley: 別収録版（別ID）は重複とみなさない (9-2)', () => {
  let m = createMedley('メドレー');
  m = addTrackToMedley(m, 'single-version-id').medley;
  const { medley, added } = addTrackToMedley(m, 'album-version-id');
  assert.equal(added, true);
  assert.deepEqual(medley.trackIds, ['single-version-id', 'album-version-id']);
});

test('isDuplicateTrack: 追加済みの曲IDならtrue、未追加ならfalse', () => {
  let m = createMedley('メドレー');
  m = addTrackToMedley(m, 't1').medley;
  assert.equal(isDuplicateTrack(m, 't1'), true);
  assert.equal(isDuplicateTrack(m, 't2'), false);
});

test('addTrackToMedley: 曲数の上限を設けない。100曲追加できる (FR-2.7)', () => {
  let m = createMedley('大きなメドレー');
  for (let i = 0; i < 100; i++) {
    m = addTrackToMedley(m, `track-${i}`).medley;
  }
  assert.equal(m.trackIds.length, 100);
});

test('removeTrackFromMedley: 指定した曲だけを削除し、他の順序は変わらない (FR-2.5)', () => {
  let m = createMedley('メドレー');
  m = addTrackToMedley(m, 'a').medley;
  m = addTrackToMedley(m, 'b').medley;
  m = addTrackToMedley(m, 'c').medley;
  const result = removeTrackFromMedley(m, 'b');
  assert.deepEqual(result.trackIds, ['a', 'c']);
});

test('isValidMedley: id/name/trackIdsが揃っていればtrue', () => {
  const m = createMedley('メドレー');
  assert.equal(isValidMedley(m), true);
});

test('isValidMedley: 曲名やジャケットなど、識別情報以外を持たせても検証はtrackIdsの形だけを見る (FR-3.2)', () => {
  assert.equal(isValidMedley({ id: '1', name: 'x', trackIds: ['a', 'b'] }), true);
  assert.equal(isValidMedley({ id: '1', name: 'x', trackIds: [{ title: '曲名も保存してしまっている' }] }), false);
});

test('isValidMedley: idが無い、trackIdsが配列でない等は無効', () => {
  assert.equal(isValidMedley(null), false);
  assert.equal(isValidMedley({ name: 'x', trackIds: [] }), false);
  assert.equal(isValidMedley({ id: '1', name: 'x', trackIds: 'not-an-array' }), false);
});
