import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLookupUrl, parseLookupResponse } from '../js/track-api.js';

// 通信そのもの（fetch）はUnitテストの対象外とし、URLの組み立てとレスポンス解釈のみを検証する。

test('buildLookupUrl: 複数IDをカンマ区切りで、日本のストアフロント指定で組み立てる (2-4)', () => {
  const url = buildLookupUrl(['111', '222']);
  assert.match(url, /^https:\/\/itunes\.apple\.com\/lookup\?id=111%2C222&country=jp$/);
});

test('buildLookupUrl: idsが空ならエラー', () => {
  assert.throws(() => buildLookupUrl([]));
});

test('parseLookupResponse: 取得できた曲はavailableに入る', () => {
  const json = {
    results: [
      { wrapperType: 'track', trackId: 111, trackName: '曲A', artistName: 'アーティストA', artworkUrl100: 'a.jpg', previewUrl: 'a.m4a' },
    ],
  };
  const { available, unavailableIds } = parseLookupResponse(json, ['111']);
  assert.equal(available.length, 1);
  assert.equal(available[0].title, '曲A');
  assert.deepEqual(unavailableIds, []);
});

test('parseLookupResponse: 返ってこなかったIDはunavailableIdsに入る (FR-3.3)', () => {
  const json = { results: [] };
  const { available, unavailableIds } = parseLookupResponse(json, ['999']);
  assert.deepEqual(available, []);
  assert.deepEqual(unavailableIds, ['999']);
});

test('parseLookupResponse: 試聴音源(previewUrl)が無い結果は取得できなかった扱いにする (2-5)', () => {
  const json = {
    results: [
      { wrapperType: 'track', trackId: 111, trackName: '曲A', artistName: 'アーティストA', artworkUrl100: 'a.jpg', previewUrl: null },
    ],
  };
  const { available, unavailableIds } = parseLookupResponse(json, ['111']);
  assert.deepEqual(available, []);
  assert.deepEqual(unavailableIds, ['111']);
});

test('parseLookupResponse: 一部だけ取得できた場合、要求した順序でavailable/unavailableに振り分けられる', () => {
  const json = {
    results: [
      { wrapperType: 'track', trackId: 222, trackName: '曲B', artistName: 'B', artworkUrl100: 'b.jpg', previewUrl: 'b.m4a' },
    ],
  };
  const { available, unavailableIds } = parseLookupResponse(json, ['111', '222', '333']);
  assert.equal(available.length, 1);
  assert.equal(available[0].id, 222);
  assert.deepEqual(unavailableIds, ['111', '333']);
});

test('parseLookupResponse: album（collectionName）・trackNumberを保持する (CR-064)', () => {
  const json = {
    results: [
      {
        wrapperType: 'track', trackId: 111, trackName: '曲A', artistName: 'アーティストA',
        collectionName: 'アルバムX', trackNumber: 3, artworkUrl100: 'a.jpg', previewUrl: 'a.m4a',
      },
    ],
  };
  const { available } = parseLookupResponse(json, ['111']);
  assert.equal(available[0].album, 'アルバムX');
  assert.equal(available[0].trackNumber, 3);
});

test('parseLookupResponse: collectionName・trackNumberが無い場合は空文字・nullになる (CR-064)', () => {
  const json = {
    results: [
      { wrapperType: 'track', trackId: 111, trackName: '曲A', artistName: 'アーティストA', artworkUrl100: 'a.jpg', previewUrl: 'a.m4a' },
    ],
  };
  const { available } = parseLookupResponse(json, ['111']);
  assert.equal(available[0].album, '');
  assert.equal(available[0].trackNumber, null);
});
