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

test('start(startTrackIndex): 指定した曲から再生が始まる (FR-2.13)', async () => {
  const tracks = makeTracks(5);
  const { player, changes } = createPlayer(tracks);
  await player.start(3);
  assert.equal(player.playing, true);
  assert.equal(changes.length, 1);
  assert.equal(player.currentTrack().id, tracks[3].id);
});

test('start(startTrackIndex): 2曲目以降は残りの曲がすべて含まれる (FR-2.13)', async () => {
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

test('1曲のみのプレイリストは、再生が終わると自動停止する（繰り返さない） (FR-4.14)', async () => {
  const tracks = makeTracks(1);
  const { player, createdAudios, changes } = createPlayer(tracks);
  assert.equal(player.isSingleTrack, true);
  await player.start();
  createdAudios[0].fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(changes.length, 1, '同じ曲が再度流れることはない');
  assert.equal(player.finished, true);
  assert.equal(player.playing, false);
});

// --- 全曲を一巡すると自動停止する（無限ループを廃止） ---

test('複数曲のプレイリストは、全曲を一巡すると自動停止し、再シャッフルして続けない (FR-4.4)', async () => {
  const tracks = makeTracks(3);
  const { player, createdAudios, changes } = createPlayer(tracks, { shuffle: false, crossfadeSeconds: 0 });
  await player.start();
  assert.deepEqual(player.order, [0, 1, 2]);
  for (let i = 0; i < 3; i++) {
    createdAudios[0].fireEnded();
    await Promise.resolve();
    await Promise.resolve();
  }
  assert.equal(changes.length, 3, '3曲目までしか再生されず、4曲目（先頭の繰り返し）は流れない');
  assert.equal(player.finished, true);
  assert.equal(player.playing, false);
});

test('一巡して自動停止すると、onPlaybackCompleteが呼ばれる', async () => {
  const tracks = makeTracks(2);
  let completed = false;
  const player = new PlaylistPlayer(tracks, {
    crossfadeSeconds: 0,
    shuffle: false,
    createAudio: () => new FakeAudio(),
    createAudioContext: () => new FakeAudioContext(),
    onPlaybackComplete: () => { completed = true; },
  });
  await player.start();
  player.active.fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  player.active.fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(completed, true);
});

test('自動停止後は、next()・togglePlayPause()を呼んでも何も起きない', async () => {
  const tracks = makeTracks(2);
  const { player, createdAudios, changes } = createPlayer(tracks, { shuffle: false, crossfadeSeconds: 0 });
  await player.start();
  createdAudios[0].fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  createdAudios[0].fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(player.finished, true);
  player.next();
  player.togglePlayPause();
  await Promise.resolve();
  assert.equal(changes.length, 2, '自動停止後に曲は変わらない');
  assert.equal(player.playing, false);
});

test('クロスフェード有効でも、最後の曲ではクロスフェードせず自然に終わって自動停止する', async () => {
  const tracks = makeTracks(2);
  const { player, createdAudios, changes } = createPlayer(tracks, { shuffle: false, crossfadeSeconds: 2 });
  await player.start();
  // 1曲目→2曲目はクロスフェードで進む
  const first = createdAudios[0];
  first.duration = 10;
  first.currentTime = 8.5;
  first.fireTimeUpdate();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(changes.length, 2);
  // 2曲目（最後の曲）はクロスフェードを開始しない
  const second = player.active;
  second.duration = 10;
  second.currentTime = 8.5;
  second.fireTimeUpdate();
  await Promise.resolve();
  assert.equal(changes.length, 2, '最後の曲ではクロスフェードが始まらない');
  assert.equal(player.finished, false, 'まだ自然終了（ended）を迎えていない');
  // 自然に最後まで再生し終わるとendedが発火し、自動停止する
  second.fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(player.finished, true);
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

// --- FR-2.15, FR-2.16：プレイリスト詳細のシャッフルON/OFF切り替え ---

test('shuffle:false を指定すると、渡した順番のまま先頭から再生される', async () => {
  const tracks = makeTracks(5);
  const { player } = createPlayer(tracks, { shuffle: false });
  await player.start();
  assert.deepEqual(player.order, [0, 1, 2, 3, 4]);
  assert.equal(player.currentTrack().id, tracks[0].id);
});

test('shuffle:false + start(startIndex): 指定した曲から表示順のまま一巡する', async () => {
  const tracks = makeTracks(5);
  const { player } = createPlayer(tracks, { shuffle: false });
  await player.start(2);
  assert.deepEqual(player.order, [2, 3, 4, 0, 1]);
  assert.equal(player.currentTrack().id, tracks[2].id);
});

test('shuffle:false では、並び順は再生中ずっと固定される（再シャッフルしない）', async () => {
  const tracks = makeTracks(3);
  const { player, createdAudios } = createPlayer(tracks, { shuffle: false, crossfadeSeconds: 0 });
  await player.start();
  createdAudios[0].fireEnded();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(player.order, [0, 1, 2]);
  assert.equal(player.currentTrack().id, tracks[1].id);
});

test('shuffle省略時（既定）は、これまで通りランダムな初期順序になる (FR-4.2)', async () => {
  const tracks = makeTracks(20);
  const { player } = createPlayer(tracks);
  await player.start();
  assert.deepEqual([...player.order].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i));
  // 20曲であれば、常に[0,1,2,...]の並びになることはまず無い
  assert.notDeepEqual(player.order, Array.from({ length: 20 }, (_, i) => i));
});

// --- 端末側の都合による停止・再生開始待ちの扱い ---

test('端末側でaudio要素が一時停止されると、再生状態も一時停止に反映される', async () => {
  const states = [];
  const { player, createdAudios } = createPlayer(makeTracks(3), { onPlayStateChange: (p) => states.push(p) });
  await player.start();
  assert.equal(player.playing, true);
  // 他アプリの音声・通話・イヤホンの切断等で、アプリの操作とは無関係にaudio要素が止まる
  createdAudios[0].paused = true;
  createdAudios[0].dispatchEvent(new Event('pause'));
  assert.equal(player.playing, false);
  assert.equal(states.at(-1), false);
});

test('アプリ自身の一時停止操作では、pauseイベントが来ても状態通知が二重にならない', async () => {
  const states = [];
  const { player, createdAudios } = createPlayer(makeTracks(3), { onPlayStateChange: (p) => states.push(p) });
  await player.start();
  const before = states.length;
  player.togglePlayPause(); // 一時停止（通知1回）
  createdAudios[0].dispatchEvent(new Event('pause'));
  assert.equal(states.length, before + 1);
});

test('曲が自然に終わったときのpauseイベントでは、一時停止扱いにならない', async () => {
  const { player, createdAudios } = createPlayer(makeTracks(3));
  await player.start();
  createdAudios[0].ended = true;
  createdAudios[0].dispatchEvent(new Event('pause'));
  assert.equal(player.playing, true);
});

test('端末側でaudio要素が再開されると、再生状態も再生中に戻る', async () => {
  const { player, createdAudios } = createPlayer(makeTracks(3));
  await player.start();
  player.togglePlayPause(); // 一時停止
  assert.equal(player.playing, false);
  createdAudios[0].dispatchEvent(new Event('play')); // イヤホンの再生ボタン等で再開
  assert.equal(player.playing, true);
});

test('再生中の音声エラーでは、その曲を失敗として次の曲へ進む', async () => {
  const tracks = makeTracks(3);
  const { player, createdAudios } = createPlayer(tracks, { shuffle: false });
  await player.start();
  const firstId = player.currentTrack().id;
  createdAudios[0].dispatchEvent(new Event('error'));
  await Promise.resolve();
  await Promise.resolve();
  assert.notEqual(player.currentTrack().id, firstId);
  assert.equal(player.playing, true);
});

test('AudioContextが中断されると、一時停止として扱う', async () => {
  const ctxs = [];
  const { player } = createPlayer(makeTracks(3), {
    crossfadeSeconds: 2,
    createAudioContext: () => {
      const c = new FakeAudioContext();
      c.state = 'running';
      ctxs.push(c);
      return c;
    },
  });
  await player.start();
  assert.equal(player.playing, true);
  ctxs[0].state = 'suspended';
  ctxs[0].onstatechange();
  assert.equal(player.playing, false);
});

test('再生の開始待ち中も、currentTrack()はその曲を返し、loadingはtrueになる', async () => {
  const tracks = makeTracks(3);
  let release;
  const { player } = createPlayer(tracks, {
    createAudio: () => {
      const a = new FakeAudio();
      a.play = () => new Promise((resolve) => { release = () => { a.paused = false; resolve(); }; });
      return a;
    },
  });
  const started = player.start();
  assert.equal(player.loading, true);
  assert.ok(player.currentTrack(), '待ち中でも現在の曲が分かる');
  release();
  await started;
  assert.equal(player.loading, false);
  assert.equal(player.playing, true);
});

test('togglePlayPause: 再開に失敗したら一時停止の表示に戻る', async () => {
  const { player, createdAudios } = createPlayer(makeTracks(3));
  await player.start();
  player.togglePlayPause(); // 一時停止
  createdAudios[0].play = () => Promise.reject(new Error('blocked'));
  player.togglePlayPause(); // 再開を試みるが失敗する
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(player.playing, false);
});
