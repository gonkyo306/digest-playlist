import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewPlayer } from '../js/preview-player.js';

// 実際の<audio>要素の代わりに使う、テスト用の偽物のaudio要素。
class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.src = '';
    this.crossOrigin = null;
    this.playCalled = false;
    this.pauseCalled = false;
  }
  play() {
    this.playCalled = true;
  }
  pause() {
    this.pauseCalled = true;
  }
  // テストから「再生終了」を発火させるためのヘルパー
  fireEnded() {
    this.dispatchEvent(new Event('ended'));
  }
}

function createPlayer(onStop) {
  const created = [];
  const player = new PreviewPlayer({
    createAudio: () => {
      const a = new FakeAudio();
      created.push(a);
      return a;
    },
    onStop,
  });
  return { player, created };
}

test('play: 曲を再生すると再生中状態になる (FR-1.5)', () => {
  const { player, created } = createPlayer();
  player.play({ id: 't1', previewUrl: 'a.m4a' });
  assert.equal(player.isPlaying, true);
  assert.equal(player.currentTrackId, 't1');
  assert.equal(created[0].playCalled, true);
  assert.equal(created[0].src, 'a.m4a');
});

test('stop: 再生を止めると停止状態になり、onStopが呼ばれる', () => {
  let stoppedId = null;
  const { player } = createPlayer((id) => (stoppedId = id));
  player.play({ id: 't1', previewUrl: 'a.m4a' });
  player.stop();
  assert.equal(player.isPlaying, false);
  assert.equal(player.currentTrackId, null);
  assert.equal(stoppedId, 't1');
});

test('stop: 再生していない状態でstopを呼んでも何も起きない', () => {
  let stopCalled = false;
  const { player } = createPlayer(() => (stopCalled = true));
  player.stop();
  assert.equal(stopCalled, false);
});

test('play: 再生中に別の曲を再生すると、前の曲は自動的に停止する（同時に1曲のみ）', () => {
  const { player, created } = createPlayer();
  player.play({ id: 't1', previewUrl: 'a.m4a' });
  player.play({ id: 't2', previewUrl: 'b.m4a' });
  assert.equal(player.currentTrackId, 't2');
  assert.equal(created[0].pauseCalled, true, '前の曲は停止されている');
});

test('再生終了(ended)イベントで、再生中状態が解除される', () => {
  const { player, created } = createPlayer();
  player.play({ id: 't1', previewUrl: 'a.m4a' });
  created[0].fireEnded();
  assert.equal(player.isPlaying, false);
  assert.equal(player.currentTrackId, null);
});

test('別の曲に切り替わった後で、古い曲のendedイベントが来ても状態に影響しない', () => {
  const { player, created } = createPlayer();
  player.play({ id: 't1', previewUrl: 'a.m4a' });
  player.play({ id: 't2', previewUrl: 'b.m4a' });
  created[0].fireEnded(); // 古い(t1)のendedが遅れて発火
  assert.equal(player.isPlaying, true);
  assert.equal(player.currentTrackId, 't2');
});
