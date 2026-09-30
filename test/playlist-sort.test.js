import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTracksByArtist } from '../js/playlist-sort.js';

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

// --- CR-064：同一アーティスト内のアルバム・収録順まとめ ---

test('sortTracksByArtist: 同一アーティスト・同一アルバムの曲は、追加順ではなく収録順（トラック番号順）にまとまる (CR-064)', () => {
  const tracks = [
    { id: 1, artist: 'A', album: 'アルバムX', trackNumber: 3 },
    { id: 2, artist: 'A', album: 'アルバムX', trackNumber: 1 },
    { id: 3, artist: 'A', album: 'アルバムX', trackNumber: 2 },
  ];
  const sorted = sortTracksByArtist(tracks);
  assert.deepEqual(sorted.map((t) => t.id), [2, 3, 1]);
});

test('sortTracksByArtist: 同一アーティストの異なる2枚のアルバムは、最初に追加した順でまとまりの位置が決まる (CR-064)', () => {
  const tracks = [
    { id: 1, artist: 'A', album: 'アルバムY', trackNumber: 1 },
    { id: 2, artist: 'A', album: 'アルバムX', trackNumber: 2 },
    { id: 3, artist: 'A', album: 'アルバムY', trackNumber: 2 },
    { id: 4, artist: 'A', album: 'アルバムX', trackNumber: 1 },
  ];
  const sorted = sortTracksByArtist(tracks);
  // アルバムYが先に追加されているため先に来る（アルバム内はトラック番号順）
  assert.deepEqual(sorted.map((t) => t.id), [1, 3, 4, 2]);
});

test('sortTracksByArtist: トラック番号を持たない曲は、同アルバム内では番号ありの後ろに追加順で並ぶ (CR-064)', () => {
  const tracks = [
    { id: 1, artist: 'A', album: 'アルバムX', trackNumber: null },
    { id: 2, artist: 'A', album: 'アルバムX', trackNumber: 2 },
    { id: 3, artist: 'A', album: 'アルバムX', trackNumber: 1 },
  ];
  const sorted = sortTracksByArtist(tracks);
  assert.deepEqual(sorted.map((t) => t.id), [3, 2, 1]);
});

test('sortTracksByArtist: アルバムが異なる曲同士・アルバムを持たない曲は、従来通り追加順で並ぶ (CR-064)', () => {
  const tracks = [
    { id: 1, artist: 'A', album: '' },
    { id: 2, artist: 'A', album: 'アルバムX', trackNumber: 1 },
    { id: 3, artist: 'A', album: '' },
  ];
  const sorted = sortTracksByArtist(tracks);
  assert.deepEqual(sorted.map((t) => t.id), [1, 2, 3]);
});
