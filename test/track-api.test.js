import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLookupUrl, parseLookupResponse, fetchTrackInfoByIds, chunk, LOOKUP_BATCH_SIZE } from '../js/track-api.js';

// 通信そのもの（fetch）はUnitテストの対象外とし、URLの組み立てとレスポンス解釈のみを検証する。

test('buildLookupUrl: 複数IDをカンマ区切りで、日本のストアフロント指定で組み立てる (FR-1.3)', () => {
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

test('parseLookupResponse: 試聴音源(previewUrl)が無い結果は取得できなかった扱いにする (FR-1.4)', () => {
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

test('parseLookupResponse: album（collectionName）・trackNumberを保持する', () => {
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

test('parseLookupResponse: collectionName・trackNumberが無い場合は空文字・nullになる', () => {
  const json = {
    results: [
      { wrapperType: 'track', trackId: 111, trackName: '曲A', artistName: 'アーティストA', artworkUrl100: 'a.jpg', previewUrl: 'a.m4a' },
    ],
  };
  const { available } = parseLookupResponse(json, ['111']);
  assert.equal(available[0].album, '');
  assert.equal(available[0].trackNumber, null);
});

test('chunk: 指定件数ずつに分け、余りも残す', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});

/** fetchを差し替えて、Lookup APIの呼び出しを記録する（IDごとに曲を返す） */
async function withFakeFetch(handler, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const ids = new URL(url).searchParams.get('id').split(',');
    calls.push(ids);
    return handler(ids);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}
const okResponse = (ids, skip = () => false) => ({
  ok: true,
  json: async () => ({
    results: ids.filter((id) => !skip(id)).map((id) => ({
      wrapperType: 'track', trackId: Number(id), trackName: `曲${id}`, artistName: 'A', previewUrl: `http://x/${id}`, artworkUrl100: 'a',
    })),
  }),
});

test('fetchTrackInfoByIds: 700曲でも、分割して取得し、IDの順序のまま1つにまとめる（FR-2.7）', async () => {
  const ids = Array.from({ length: 700 }, (_, i) => String(1000 + i));
  await withFakeFetch((req) => okResponse(req, (id) => id === '1005'), async (calls) => {
    const { available, unavailableIds } = await fetchTrackInfoByIds(ids);
    assert.ok(calls.length >= 7 && calls.every((c) => c.length <= LOOKUP_BATCH_SIZE), '1回あたりの件数が上限以内');
    assert.equal(available.length, 699);
    assert.deepEqual(available.map((t) => String(t.id)), ids.filter((id) => id !== '1005'), '元の順序を保つ');
    assert.deepEqual(unavailableIds, ['1005']);
  });
});

test('fetchTrackInfoByIds: 分割した呼び出しのどれかが失敗したら、例外を投げる', async () => {
  let n = 0;
  await withFakeFetch((req) => (++n === 2 ? { ok: false, status: 503 } : okResponse(req)), async () => {
    await assert.rejects(fetchTrackInfoByIds(Array.from({ length: 350 }, (_, i) => String(i + 1))), /503/);
  });
});
