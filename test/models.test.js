import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlaylist,
  renamePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  isDuplicateTrack,
  isValidPlaylist,
} from '../js/models.js';

test('createPlaylist: 名前を付けて作成すると、曲0件のプレイリストができる (FR-2.1)', () => {
  const m = createPlaylist('通勤用');
  assert.equal(m.name, '通勤用');
  assert.deepEqual(m.trackIds, []);
  assert.ok(m.id);
});

test('renamePlaylist: 名前を変更できる (FR-2.2)', () => {
  const m = createPlaylist('元の名前');
  const renamed = renamePlaylist(m, '新しい名前');
  assert.equal(renamed.name, '新しい名前');
  assert.equal(renamed.id, m.id, 'idは変わらない');
});

test('addTrackToPlaylist: 曲を追加できる (FR-2.4)', () => {
  const m = createPlaylist('プレイリスト');
  const { playlist, added } = addTrackToPlaylist(m, 't1');
  assert.equal(added, true);
  assert.deepEqual(playlist.trackIds, ['t1']);
});

test('addTrackToPlaylist: 同じ曲ID（重複）は追加できない (FR-2.6)', () => {
  let m = createPlaylist('プレイリスト');
  m = addTrackToPlaylist(m, 't1').playlist;
  const { playlist, added } = addTrackToPlaylist(m, 't1');
  assert.equal(added, false, '重複時はadded=falseになる');
  assert.deepEqual(playlist.trackIds, ['t1'], '曲は増えない');
});

test('addTrackToPlaylist: 別収録版（別ID）は重複とみなさない (9-2)', () => {
  let m = createPlaylist('プレイリスト');
  m = addTrackToPlaylist(m, 'single-version-id').playlist;
  const { playlist, added } = addTrackToPlaylist(m, 'album-version-id');
  assert.equal(added, true);
  assert.deepEqual(playlist.trackIds, ['single-version-id', 'album-version-id']);
});

test('isDuplicateTrack: 追加済みの曲IDならtrue、未追加ならfalse', () => {
  let m = createPlaylist('プレイリスト');
  m = addTrackToPlaylist(m, 't1').playlist;
  assert.equal(isDuplicateTrack(m, 't1'), true);
  assert.equal(isDuplicateTrack(m, 't2'), false);
});

test('addTrackToPlaylist: 曲数の上限を設けない。100曲追加できる (FR-2.7)', () => {
  let m = createPlaylist('大きなプレイリスト');
  for (let i = 0; i < 100; i++) {
    m = addTrackToPlaylist(m, `track-${i}`).playlist;
  }
  assert.equal(m.trackIds.length, 100);
});

test('removeTrackFromPlaylist: 指定した曲だけを削除し、他の順序は変わらない (FR-2.5)', () => {
  let m = createPlaylist('プレイリスト');
  m = addTrackToPlaylist(m, 'a').playlist;
  m = addTrackToPlaylist(m, 'b').playlist;
  m = addTrackToPlaylist(m, 'c').playlist;
  const result = removeTrackFromPlaylist(m, 'b');
  assert.deepEqual(result.trackIds, ['a', 'c']);
});

test('isValidPlaylist: id/name/trackIdsが揃っていればtrue', () => {
  const m = createPlaylist('プレイリスト');
  assert.equal(isValidPlaylist(m), true);
});

test('isValidPlaylist: 曲名やジャケットなど、識別情報以外を持たせても検証はtrackIdsの形だけを見る (FR-3.2)', () => {
  assert.equal(isValidPlaylist({ id: '1', name: 'x', trackIds: ['a', 'b'] }), true);
  assert.equal(isValidPlaylist({ id: '1', name: 'x', trackIds: [{ title: '曲名も保存してしまっている' }] }), false);
});

test('isValidPlaylist: idが無い、trackIdsが配列でない等は無効', () => {
  assert.equal(isValidPlaylist(null), false);
  assert.equal(isValidPlaylist({ name: 'x', trackIds: [] }), false);
  assert.equal(isValidPlaylist({ id: '1', name: 'x', trackIds: 'not-an-array' }), false);
});
