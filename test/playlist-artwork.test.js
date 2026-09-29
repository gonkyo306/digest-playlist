import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlaylistArtwork, resolvePlaylistsArtwork } from '../js/playlist-artwork.js';

// fetchTrackInfoは依存注入（実際の通信はfetchTrackInfoByIds自体のUnitテスト対象外という
// 既存の方針と同様、track-api.jsのfetchはここでは呼ばない）。

test('resolvePlaylistArtwork: coverImageがあれば最優先でcustomを返す (FR-2.10)', async () => {
  const blob = new Blob(['x'], { type: 'image/jpeg' });
  const playlist = { coverImage: blob, trackIds: ['t1'] };
  const result = await resolvePlaylistArtwork(playlist, async () => ({ available: [{ artwork: 'x.jpg' }] }));
  assert.deepEqual(result, { source: 'custom', blob });
});

test('resolvePlaylistArtwork: coverImage未設定なら先頭曲のジャケットを返す（先頭曲IDのみ要求する）', async () => {
  const playlist = { coverImage: null, trackIds: ['t1', 't2'] };
  let requestedIds;
  const fetchTrackInfo = async (ids) => {
    requestedIds = ids;
    return { available: [{ artwork: 'first.jpg' }] };
  };
  const result = await resolvePlaylistArtwork(playlist, fetchTrackInfo);
  assert.deepEqual(requestedIds, ['t1']);
  assert.deepEqual(result, { source: 'track', url: 'first.jpg' });
});

test('resolvePlaylistArtwork: 曲が0件ならnoneを返す（プレースホルダー表示用）', async () => {
  const result = await resolvePlaylistArtwork({ coverImage: null, trackIds: [] }, async () => ({ available: [] }));
  assert.deepEqual(result, { source: 'none' });
});

test('resolvePlaylistArtwork: 先頭曲が取得できなければnoneを返す', async () => {
  const result = await resolvePlaylistArtwork({ coverImage: null, trackIds: ['t1'] }, async () => ({ available: [] }));
  assert.deepEqual(result, { source: 'none' });
});

test('resolvePlaylistArtwork: 取得中にエラーが起きてもnoneを返す（画面全体は壊さない）', async () => {
  const result = await resolvePlaylistArtwork(
    { coverImage: null, trackIds: ['t1'] },
    async () => { throw new Error('network error'); }
  );
  assert.deepEqual(result, { source: 'none' });
});

test('resolvePlaylistsArtwork: 複数プレイリストをまとめて解決できる', async () => {
  const playlists = [
    { id: 'a', coverImage: new Blob(['x']), trackIds: [] },
    { id: 'b', coverImage: null, trackIds: [] },
    { id: 'c', coverImage: null, trackIds: ['t1'] },
  ];
  const map = await resolvePlaylistsArtwork(playlists, async () => ({ available: [{ artwork: 'c.jpg' }] }));
  assert.equal(map.get('a').source, 'custom');
  assert.equal(map.get('b').source, 'none');
  assert.deepEqual(map.get('c'), { source: 'track', url: 'c.jpg' });
});
