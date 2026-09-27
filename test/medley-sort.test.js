import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTracksByArtist } from '../js/medley-sort.js';

test('sortTracksByArtist: アーティスト名順に並び替える (FR-2.11)', () => {
  const tracks = [
    { id: 1, artist: 'Bアーティスト' },
    { id: 2, artist: 'Aアーティスト' },
    { id: 3, artist: 'Cアーティスト' },
  ];
  const sorted = sortTracksByArtist(tracks);
  assert.deepEqual(sorted.map((t) => t.id), [2, 1, 3]);
});

test('sortTracksByArtist: 同一アーティスト内は、追加順（渡した配列の順序）を保つ (FR-2.11)', () => {
  const tracks = [
    { id: 1, artist: 'Aアーティスト' },
    { id: 2, artist: 'Bアーティスト' },
    { id: 3, artist: 'Aアーティスト' },
  ];
  const sorted = sortTracksByArtist(tracks);
  // Aアーティストの2曲（id 1, 3）は、追加順のまま1→3の順で並ぶ
  assert.deepEqual(sorted.map((t) => t.id), [1, 3, 2]);
});

test('sortTracksByArtist: 元の配列は変更しない（表示専用の並び替え）', () => {
  const tracks = [
    { id: 1, artist: 'Bアーティスト' },
    { id: 2, artist: 'Aアーティスト' },
  ];
  const original = [...tracks];
  sortTracksByArtist(tracks);
  assert.deepEqual(tracks, original);
});
