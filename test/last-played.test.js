import test from 'node:test';
import assert from 'node:assert/strict';
import { getLastPlayedPlaylistId, setLastPlayedPlaylistId } from '../js/last-played.js';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

test('記憶したプレイリストIDを読み出せる。何も記憶していなければnull (FR-2.20)', () => {
  const s = fakeStorage();
  assert.equal(getLastPlayedPlaylistId(s), null);
  setLastPlayedPlaylistId('p1', s);
  assert.equal(getLastPlayedPlaylistId(s), 'p1');
  setLastPlayedPlaylistId('p2', s);
  assert.equal(getLastPlayedPlaylistId(s), 'p2', '上書きされる');
});

test('nullを渡すと記憶を消す', () => {
  const s = fakeStorage();
  setLastPlayedPlaylistId('p1', s);
  setLastPlayedPlaylistId(null, s);
  assert.equal(getLastPlayedPlaylistId(s), null);
});

test('localStorageが使えなくても例外にならない', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  assert.equal(getLastPlayedPlaylistId(broken), null);
  assert.doesNotThrow(() => setLastPlayedPlaylistId('p1', broken));
  assert.equal(getLastPlayedPlaylistId(null), null);
  assert.doesNotThrow(() => setLastPlayedPlaylistId('p1', null));
});
