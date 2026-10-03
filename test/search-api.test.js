import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchUrl,
  filterPreviewableTracks,
  formatTrackForDisplay,
} from '../js/search-api.js';

test('buildSearchUrl: キーワード・日本のストアフロント・music/songが正しく組み立てられる (FR-1.1, FR-1.3)', () => {
  const url = buildSearchUrl('YOASOBI');
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://itunes.apple.com/search');
  assert.equal(parsed.searchParams.get('term'), 'YOASOBI');
  assert.equal(parsed.searchParams.get('country'), 'jp');
  assert.equal(parsed.searchParams.get('media'), 'music');
  assert.equal(parsed.searchParams.get('entity'), 'song');
});

test('buildSearchUrl: 空のキーワードはエラーになる', () => {
  assert.throws(() => buildSearchUrl(''));
  assert.throws(() => buildSearchUrl('   '));
});

test('filterPreviewableTracks: 試聴音源がない曲は除外される (FR-1.4)', () => {
  const results = [
    { wrapperType: 'track', kind: 'song', trackId: 1, previewUrl: 'a.m4a' },
    { wrapperType: 'track', kind: 'song', trackId: 2, previewUrl: null },
    { wrapperType: 'track', kind: 'song', trackId: 3 },
  ];
  const filtered = filterPreviewableTracks(results);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].trackId, 1);
});

test('filterPreviewableTracks: 曲以外（アーティスト等）の結果も除外される', () => {
  const results = [
    { wrapperType: 'artist', trackId: 1, previewUrl: 'a.m4a' },
    { wrapperType: 'track', kind: 'song', trackId: 2, previewUrl: 'b.m4a' },
  ];
  const filtered = filterPreviewableTracks(results);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].trackId, 2);
});

test('formatTrackForDisplay: 表示用データの各フィールドが揃う (FR-1.2)', () => {
  const track = {
    trackId: 111,
    trackName: '曲A',
    artistName: 'アーティストA',
    collectionName: 'アルバムA',
    artworkUrl100: 'a.jpg',
    previewUrl: 'a.m4a',
  };
  const formatted = formatTrackForDisplay(track);
  assert.deepEqual(formatted, {
    id: 111,
    title: '曲A',
    artist: 'アーティストA',
    album: 'アルバムA',
    artwork: 'a.jpg',
    previewUrl: 'a.m4a',
  });
});

test('formatTrackForDisplay: アルバム名が無い場合は空文字になる', () => {
  const formatted = formatTrackForDisplay({
    trackId: 1,
    trackName: '曲A',
    artistName: 'アーティストA',
    artworkUrl100: 'a.jpg',
    previewUrl: 'a.m4a',
  });
  assert.equal(formatted.album, '');
});

test('buildSearchUrl: offsetを指定すると、その値がクエリに反映される (FR-1.10)', () => {
  const url = buildSearchUrl('YOASOBI', 'jp', 50, 25);
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('limit'), '50');
  assert.equal(parsed.searchParams.get('offset'), '25');
});

test('buildSearchUrl: offsetを省略すると0になる', () => {
  const url = buildSearchUrl('YOASOBI');
  assert.equal(new URL(url).searchParams.get('offset'), '0');
});

