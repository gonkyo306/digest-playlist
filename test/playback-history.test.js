import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackHistory } from '../js/playback-history.js';

test('push: 再生するたびに履歴が積まれ、現在の曲が返る', () => {
  const h = new PlaybackHistory();
  assert.equal(h.current(), null, '何も再生していなければnull');
  h.push(0);
  h.push(2);
  h.push(1);
  assert.equal(h.current(), 1);
});
