import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArtistSearchUrl,
  formatArtistForDisplay,
  buildArtistAlbumsUrl,
  filterAlbums,
  formatAlbumForDisplay,
  buildAlbumTracksUrl,
  buildAlbumSearchUrl,
  buildArtistSearchUrlLimited,
} from '../js/staged-search-api.js';

test('buildArtistSearchUrl: アーティスト検索（entity=musicArtist）が組み立てられる (FR-1.9)', () => {
  const url = buildArtistSearchUrl('YOASOBI');
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://itunes.apple.com/search');
  assert.equal(parsed.searchParams.get('term'), 'YOASOBI');
  assert.equal(parsed.searchParams.get('entity'), 'musicArtist');
  assert.equal(parsed.searchParams.get('country'), 'jp');
});

test('buildArtistSearchUrl: 取得件数の上限は既定で50件 (FR-1.9)', () => {
  const url = buildArtistSearchUrl('YOASOBI');
  assert.equal(new URL(url).searchParams.get('limit'), '50');
});

test('buildArtistSearchUrl: 空のキーワードはエラーになる', () => {
  assert.throws(() => buildArtistSearchUrl(''));
});

test('formatArtistForDisplay: id・nameに整形される', () => {
  const formatted = formatArtistForDisplay({ artistId: 123, artistName: 'YOASOBI' });
  assert.deepEqual(formatted, { id: 123, name: 'YOASOBI' });
});

test('buildArtistAlbumsUrl: Lookup API（entity=album）が組み立てられる (FR-1.9)', () => {
  const url = buildArtistAlbumsUrl(123);
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://itunes.apple.com/lookup');
  assert.equal(parsed.searchParams.get('id'), '123');
  assert.equal(parsed.searchParams.get('entity'), 'album');
  assert.equal(parsed.searchParams.get('limit'), '50');
});

test('buildArtistAlbumsUrl: アーティストIDが無いとエラーになる', () => {
  assert.throws(() => buildArtistAlbumsUrl());
});

test('filterAlbums: コレクション種別がAlbumのものだけを残す', () => {
  const results = [
    { wrapperType: 'collection', collectionType: 'Album', collectionId: 1 },
    { wrapperType: 'artist', collectionId: 2 },
    { wrapperType: 'collection', collectionType: 'Compilation', collectionId: 3 },
  ];
  const albums = filterAlbums(results);
  assert.deepEqual(albums.map((a) => a.collectionId), [1]);
});

test('formatAlbumForDisplay: id・name・artist・artworkに整形される', () => {
  const formatted = formatAlbumForDisplay({
    collectionId: 1,
    collectionName: 'THE BOOK',
    artistName: 'YOASOBI',
    artworkUrl100: 'art.jpg',
  });
  assert.deepEqual(formatted, { id: 1, name: 'THE BOOK', artist: 'YOASOBI', artwork: 'art.jpg' });
});

test('buildAlbumTracksUrl: Lookup API（entity=song）が組み立てられる (FR-1.9)', () => {
  const url = buildAlbumTracksUrl(1);
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('id'), '1');
  assert.equal(parsed.searchParams.get('entity'), 'song');
  assert.equal(parsed.searchParams.get('limit'), '50');
});

test('buildAlbumTracksUrl: アルバムIDが無いとエラーになる', () => {
  assert.throws(() => buildAlbumTracksUrl());
});

test('buildAlbumSearchUrl: キーワードでのアルバム検索（entity=album）が組み立てられる', () => {
  const url = buildAlbumSearchUrl('YOASOBI');
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://itunes.apple.com/search');
  assert.equal(parsed.searchParams.get('term'), 'YOASOBI');
  assert.equal(parsed.searchParams.get('entity'), 'album');
  assert.equal(parsed.searchParams.get('media'), 'music');
});

test('buildAlbumSearchUrl: 統合検索の候補件数を絞るため既定のlimitは5件', () => {
  const url = buildAlbumSearchUrl('YOASOBI');
  assert.equal(new URL(url).searchParams.get('limit'), '5');
});

test('buildAlbumSearchUrl: limitを指定すればそれに従う', () => {
  const url = buildAlbumSearchUrl('YOASOBI', 'jp', 10);
  assert.equal(new URL(url).searchParams.get('limit'), '10');
});

test('buildAlbumSearchUrl: 空のキーワードはエラーになる', () => {
  assert.throws(() => buildAlbumSearchUrl(''));
});

test('buildArtistSearchUrlLimited: 統合検索の候補件数を絞るため既定のlimitは5件', () => {
  const url = buildArtistSearchUrlLimited('YOASOBI');
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('entity'), 'musicArtist');
  assert.equal(parsed.searchParams.get('limit'), '5');
});
