import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaylistPlayer } from '../js/playlist-player.js';

// 実際の<audio>要素・AudioContextの代わりに使う、テスト用の偽物。
class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.src = '';
    this.crossOrigin = null;
    this.currentTime = 0;
    this.duration = NaN;
    this.paused = true;
    this._playResult = null; // テストから設定。nullなら成功扱い
  }
  play() {
    if (this._playResult && this._playResult.reject) {
      return Promise.reject(new Error('play failed'));
    }
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  fireEnded() {
    this.dispatchEvent(new Event('ended'));
  }
  fireTimeUpdate() {
    this.dispatchEvent(new Event('timeupdate'));
  }
}

class FakeGainNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime(v) { this.value = v; },
      cancelScheduledValues() {},
    };
  }
  connect() {
    return this;
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
  }
  createGain() {
    return new FakeGainNode();
  }
  createMediaElementSource() {
    return { connect: (target) => target };
  }
  resume() {
    return Promise.resolve();
  }
}

function makeTracks(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    title: `曲${i}`,
    artist: 'アーティスト',
    artwork: '',
    previewUrl: `${i}.m4a`,
  }));
}

function createPlayer(tracks, overrides = {}) {
  const createdAudios = [];
  const changes = [];
  const player = new PlaylistPlayer(tracks, {
    crossfadeSeconds: 0,
    createAudio: () => {
      const a = new FakeAudio();
      createdAudios.push(a);
      return a;
    },
    createAudioContext: () => new FakeAudioContext(),
    onTrackChange: (t) => changes.push(t),
    ...overrides,
  });
  return { player, createdAudios, changes };
}

test('start: 0曲のプレイリストは再生できない (FR-4.14)', async () => {
  const { player, changes } = createPlayer([]);
  assert.equal(player.isEmpty, true);
  await player.start();
  assert.equal(changes.length, 0);
});

test('start: 1曲目が再生され、履歴・表示反映(onTrackChange)が行われる (FR-4.5, FR-4.11)', async () => {
  const tracks = makeTracks(3);
  const { player, changes } = createPlayer(tracks);
  await player.start();
  assert.equal(player.playing, true);
  assert.equal(changes.length, 1);
  assert.equal(player.currentTrack().id, changes[0].id);
});

test('start(startTrackIndex): 指定した曲から再生が始まる (CR-032, FR-2.13)', async () => {
  const tracks = makeTracks(5);
  const { player, changes } = createPlayer(tracks);
  await player.start(3);
  assert.equal(player.playing, true);
  assert.equal(changes.length, 1);
  assert.equal(player.currentTrack().id, tracks[3].id);
});

test('start(startTrackIndex): 2曲目以降は残りの曲がすべて含まれる (CR-032, FR-2.13)', async () => {
  const tracks = makeTracks(5);
  const { player } = createPlayer(tracks);
  await player.start(3);
  assert.deepEqual([...player.order].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test('クロスフェード無効時、ended イベントで次の曲へ進む (FR-4.6)', async () => {
  const tracks = makeTracks(3);
  const { player, createdAudios, changes } = createPlayer(tracks, { crossfadeSeconds: 0 });
  await player.start();
  const firstTrackId = player.currentTrack().id;
  createdAudios[0].fireEnded();
  // _advanceForwardは非同期のplay()を含むため、マイクロタスクを1つ待つ
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(changes.length, 2);
  assert.notEqual(player.currentTrack().id, firstTrackId);
});

test('曲が2曲以上のとき、クロスフェード有効ならtimeupdateで次の曲へのクロスフェードが始まる (FR-4.7)', async () => {
  const tracks = makeTracks(3);
  const { player, createdAudios, changes } = createPlayer(tracks, { crossfadeSeconds: 2 });
  await player.start();
  const activeAudio = createdAudios[0];
  activeAudio.duration = 10;
  activeAudio.currentTime = 8.5; // 残り1.5秒 <= 2秒
  activeAudio.fireTimeUpdate();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(changes.length, 2, 'クロスフェードで次の曲に切り替わっている');
});

test('next: 次の曲へ手動で進める (FR-4.9)', async () => {
  const tracks = makeTracks(3);
  const { player, changes } = createPlayer(tracks);
  await player.start();
  const firstId = player.currentTrack().id;
  player.next();
  await Promise.resolve();
  await Promise.resolve();
  assert.notEqual(player.currentTrack().id, firstId);
  assert.equal(changes.length, 2);
});

test('prev: 履歴の先頭では前へ戻れない (FR-4.10)', async () => {
  const tracks = makeTracks(3);
  const { player, changes } = createPlayer(tracks);
  await player.start();
  player.prev();
  await Promise.resolve();
  assert.equal(changes.length, 1, '履歴の先頭なので状態が変わらない');
});

test('prev: 次へ進んだ後は、前へ戻って同じ曲に戻れる', async () => {
  const tracks = makeTracks(3);
  const { player } = createPlayer(tracks);
  await player.start();
  const firstId = player.currentTrack().id;
  player.next();
  await Promise.resolve();
  await Promise.resolve();
  player.prev();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(player.currentTrack().id, firstId);
});

test('togglePlayPause: 再生中に呼ぶと一時停止し、もう一度呼ぶと再開する (FR-4.8)', async () => {
  const tracks = makeTracks(2);
  const { player } = createPlayer(tracks);
  await player.start();
  assert.equal(player.playing, true);
  player.togglePlayPause();
  assert.equal(player.playing, false);
  player.togglePlayPause();
  assert.equal(player.playing, true);
});

test('1曲のみのプレイリストは、一巡後も同じ曲を繰り返す (FR-4.14)', async () => {
  const tracks = makeTracks(1);
  const { player, createdAudios, changes } = createPlayer(tracks);
  assert.equal(player.isSingleTrack, true);
  await player.start();
  createdAudios[0].fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(changes.length, 2);
  assert.equal(changes[1].id, tracks[0].id);
});

test('3曲連続で再生に失敗すると停止し、onFailureStopが呼ばれる (FR-4.15)', async () => {
  const tracks = makeTracks(5);
  let stopped = false;
  const createdAudios = [];
  const player = new PlaylistPlayer(tracks, {
    crossfadeSeconds: 0,
    createAudio: () => {
      const a = new FakeAudio();
      a._playResult = { reject: true }; // 常に再生失敗させる
      createdAudios.push(a);
      return a;
    },
    createAudioContext: () => new FakeAudioContext(),
    onFailureStop: () => (stopped = true),
  });
  await player.start();
  // start()内の失敗で_advanceForwardが連鎖的に呼ばれ、3回目で停止するまで待つ
  for (let i = 0; i < 5 && !stopped; i++) {
    await Promise.resolve();
  }
  assert.equal(stopped, true);
  assert.equal(player.stopped, true);
});

test('handleOffline: 再生中にオフラインになると一時停止する (FR-4.13)', async () => {
  const tracks = makeTracks(2);
  const { player } = createPlayer(tracks);
  await player.start();
  player.handleOffline();
  assert.equal(player.playing, false);
});

test('pauseForPreview: 検索結果の試聴時に、再生中のプレイリストが一時停止する (FR-1.6)', async () => {
  const tracks = makeTracks(2);
  const { player } = createPlayer(tracks);
  await player.start();
  player.pauseForPreview();
  assert.equal(player.playing, false);
});

// --- CR-038（FR-2.15, FR-2.16）：プレイリスト詳細のシャッフルON/OFF切り替え ---

test('shuffle:false を指定すると、渡した順番のまま先頭から再生される (CR-038)', async () => {
  const tracks = makeTracks(5);
  const { player } = createPlayer(tracks, { shuffle: false });
  await player.start();
  assert.deepEqual(player.order, [0, 1, 2, 3, 4]);
  assert.equal(player.currentTrack().id, tracks[0].id);
});

test('shuffle:false + start(startIndex): 指定した曲から表示順のまま一巡する (CR-038)', async () => {
  const tracks = makeTracks(5);
  const { player } = createPlayer(tracks, { shuffle: false });
  await player.start(2);
  assert.deepEqual(player.order, [2, 3, 4, 0, 1]);
  assert.equal(player.currentTrack().id, tracks[2].id);
});

test('shuffle:false で一巡すると、同じ並び順のまま先頭から繰り返す（再シャッフルしない） (CR-038)', async () => {
  const tracks = makeTracks(3);
  const { player, createdAudios } = createPlayer(tracks, { shuffle: false, crossfadeSeconds: 0 });
  await player.start();
  // クロスフェード無効時はactiveが固定される（createdAudios[0]のまま）。3曲分ended通知を送り、
  // 一巡後に先頭へ戻ることを確認する
  for (let i = 0; i < 3; i++) {
    createdAudios[0].fireEnded();
    await Promise.resolve();
    await Promise.resolve();
  }
  assert.deepEqual(player.order, [0, 1, 2]);
  assert.equal(player.currentTrack().id, tracks[0].id);
});

test('shuffle省略時（既定）は、これまで通りランダムな初期順序になる (FR-4.2)', async () => {
  const tracks = makeTracks(20);
  const { player } = createPlayer(tracks);
  await player.start();
  assert.deepEqual([...player.order].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i));
  // 20曲であれば、常に[0,1,2,...]の並びになることはまず無い
  assert.notDeepEqual(player.order, Array.from({ length: 20 }, (_, i) => i));
});
