// フェーズ0：技術検証用スクリプト
// 目的：
//  (1) iTunes Search APIから曲・試聴音源を取得できるか（CORS込み）
//  (2) 曲間のクロスフェード（2秒）
//  (3) 画面オフ・バックグラウンドでも連続再生とクロスフェードが続くか
//  (4) Media Session APIでロック画面から操作できるか
// を確認するための、最小限の実装です。本番のUI・データ保存はまだ実装していません。

const CROSSFADE_SEC = 2;
const SEARCH_TERM = 'YOASOBI'; // 検証用に固定。テスト時に検索語を変えたい場合はここを書き換える
const TRACK_COUNT = 5;

const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');
const artworkEl = document.getElementById('artwork');
const btnPlayPause = document.getElementById('btn-playpause');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');

function log(msg) {
  const t = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  const line = `[${t}] ${msg}`;
  console.log(line);
  logEl.textContent = line + '\n' + logEl.textContent;
  try {
    const stored = JSON.parse(localStorage.getItem('digest_log') || '[]');
    stored.unshift(line);
    localStorage.setItem('digest_log', JSON.stringify(stored.slice(0, 200)));
  } catch (e) { /* ignore */ }
}

// 前回セッションのログがあれば表示（バックグラウンドで何が起きたか、再読み込み後も追えるように）
try {
  const stored = JSON.parse(localStorage.getItem('digest_log') || '[]');
  if (stored.length) {
    logEl.textContent = stored.join('\n');
    log('--- ここまでが前回セッションの記録。ここから今回のセッション ---');
  }
} catch (e) { /* ignore */ }

document.addEventListener('visibilitychange', () => {
  log(`visibilitychange: ${document.visibilityState}`);
});
window.addEventListener('pagehide', () => log('pagehide'));
window.addEventListener('freeze', () => log('freeze（バックグラウンドでJSが凍結された可能性）'));
window.addEventListener('resume', () => log('resume'));

// ---- 曲データの取得 ----
async function fetchTracks() {
  log(`検索開始: term=${SEARCH_TERM}`);
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(SEARCH_TERM)}&country=jp&media=music&limit=${TRACK_COUNT}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`検索API失敗: ${res.status}`);
  const data = await res.json();
  const tracks = data.results
    .filter(t => t.previewUrl)
    .map(t => ({
      id: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      artwork: t.artworkUrl100,
      previewUrl: t.previewUrl,
    }));
  log(`検索成功: ${tracks.length}件の試聴音源を取得`);
  return tracks;
}

// ---- 再生エンジン（2つのaudio要素を使ったクロスフェード） ----
class CrossfadePlayer {
  constructor(tracks) {
    this.tracks = tracks;
    this.order = this.shuffle([...tracks.keys()]);
    this.pos = -1; // orderの中の現在位置
    this.history = []; // 実際に再生したtrack indexの履歴（「前へ戻る」用）
    this.historyPos = -1;
    this.consecutiveFailures = 0;

    this.audioA = new Audio();
    this.audioB = new Audio();
    this.audioA.crossOrigin = 'anonymous';
    this.audioB.crossOrigin = 'anonymous';
    this.active = this.audioA;
    this.standby = this.audioB;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainA = this.ctx.createGain();
    this.gainB = this.ctx.createGain();
    this.srcA = this.ctx.createMediaElementSource(this.audioA);
    this.srcB = this.ctx.createMediaElementSource(this.audioB);
    this.srcA.connect(this.gainA).connect(this.ctx.destination);
    this.srcB.connect(this.gainB).connect(this.ctx.destination);
    this.activeGain = this.gainA;
    this.standbyGain = this.gainB;

    this.crossfadeTriggered = false;
    this.playing = false;

    [this.audioA, this.audioB].forEach(a => {
      a.addEventListener('timeupdate', () => this.onTimeUpdate(a));
      a.addEventListener('ended', () => this.onEnded(a));
      a.addEventListener('error', () => this.onError(a));
    });

    this.setupMediaSession();
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  currentTrack() {
    if (this.historyPos < 0 || this.historyPos >= this.history.length) return null;
    return this.tracks[this.history[this.historyPos]];
  }

  async start() {
    if (this.tracks.length === 0) {
      log('曲が0件のため再生できません');
      return;
    }
    this.pos = 0;
    await this.playAt(this.active, this.activeGain, this.order[this.pos], true);
  }

  // fromHistory: true の場合、履歴には追加せず、既存の履歴上の位置を再生するだけ（「前へ戻る」用）
  async playAt(audioEl, gainNode, trackIndex, isFirst, fromHistory) {
    const track = this.tracks[trackIndex];
    log(`再生開始: ${track.title} / ${track.artist}`);
    audioEl.src = track.previewUrl;
    gainNode.gain.value = isFirst ? 1 : 0;
    this.crossfadeTriggered = false;
    try {
      await this.ctx.resume();
      await audioEl.play();
      this.playing = true;
      if (!isFirst) {
        this.rampGain(gainNode, 0, 1, CROSSFADE_SEC);
      }
      this.consecutiveFailures = 0;
    } catch (e) {
      log(`再生失敗: ${track.title} (${e})`);
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 3) {
        log('3曲連続で取得に失敗したため、再生を停止します（FR-4.15相当）');
        statusEl.textContent = 'エラー：曲を連続して取得できませんでした。';
        this.playing = false;
        return;
      }
      // このトラックをスキップして次へ（FR-3.3相当）
      this.advance(1);
      return;
    }
    if (!fromHistory) {
      this.history = this.history.slice(0, this.historyPos + 1);
      this.history.push(trackIndex);
      this.historyPos = this.history.length - 1;
    }
    this.updateUI(track);
  }

  rampGain(gainNode, from, to, seconds) {
    const now = this.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(from, now);
    gainNode.gain.linearRampToValueAtTime(to, now + seconds);
  }

  onTimeUpdate(audioEl) {
    if (audioEl !== this.active || this.crossfadeTriggered) return;
    const remaining = audioEl.duration - audioEl.currentTime;
    if (isFinite(remaining) && remaining <= CROSSFADE_SEC && remaining > 0) {
      this.crossfadeTriggered = true;
      log(`クロスフェード開始（残り${remaining.toFixed(1)}秒）`);
      this.beginCrossfadeToNext();
    }
  }

  async beginCrossfadeToNext() {
    this.rampGain(this.activeGain, 1, 0, CROSSFADE_SEC);
    const nextIndex = this.nextOrderIndex();
    const nextTrackIndex = this.order[nextIndex];
    // active/standbyを入れ替える
    const oldActive = this.active, oldActiveGain = this.activeGain;
    this.active = this.standby; this.activeGain = this.standbyGain;
    this.standby = oldActive; this.standbyGain = oldActiveGain;
    this.pos = nextIndex;
    await this.playAt(this.active, this.activeGain, nextTrackIndex, false);
  }

  onEnded(audioEl) {
    // クロスフェードが正常に動いていれば、ここに来る前に次の曲が始まっているはず。
    // 保険として、まだ次の曲が始まっていなければここで進める。
    if (audioEl === this.active && !this.crossfadeTriggered) {
      log('ended イベント（クロスフェードなしで曲が終了）→ 次の曲へ');
      this.advance(1);
    }
  }

  onError(audioEl) {
    log(`audioエラー: ${audioEl.src}`);
  }

  nextOrderIndex() {
    let next = this.pos + 1;
    if (next >= this.order.length) {
      log('一巡しました。再シャッフルします');
      const last = this.order[this.pos];
      let newOrder;
      do {
        newOrder = this.shuffle([...this.tracks.keys()]);
      } while (this.tracks.length > 1 && newOrder[0] === last);
      this.order = newOrder;
      next = 0;
    }
    return next;
  }

  advance(dir) {
    if (dir > 0) {
      const nextIndex = this.nextOrderIndex();
      this.pos = nextIndex;
      this.playAt(this.active, this.activeGain, this.order[nextIndex], true, false);
    } else {
      if (this.historyPos <= 0) {
        log('履歴の先頭のため、前へ戻れません（FR-4.10）');
        return;
      }
      this.historyPos--;
      const trackIndex = this.history[this.historyPos];
      this.playAt(this.active, this.activeGain, trackIndex, true, true);
    }
  }

  togglePlayPause() {
    if (this.active.paused) {
      this.active.play();
      this.playing = true;
      log('再開');
    } else {
      this.active.pause();
      this.playing = false;
      log('一時停止');
    }
  }

  updateUI(track) {
    titleEl.textContent = track.title;
    artistEl.textContent = track.artist;
    artworkEl.src = track.artwork;
    this.updateMediaSessionMetadata(track);
  }

  setupMediaSession() {
    if (!('mediaSession' in navigator)) {
      log('Media Session API が利用できません');
      return;
    }
    navigator.mediaSession.setActionHandler('play', () => this.togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => this.togglePlayPause());
    navigator.mediaSession.setActionHandler('nexttrack', () => { log('ロック画面/通知から: 次へ'); this.advance(1); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { log('ロック画面/通知から: 前へ'); this.advance(-1); });
  }

  updateMediaSessionMetadata(track) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: [{ src: track.artwork, sizes: '100x100', type: 'image/jpeg' }],
    });
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => log(`Service Worker登録失敗: ${e}`));
}

let player = null;

async function init() {
  statusEl.textContent = '曲を検索中…';
  try {
    const tracks = await fetchTracks();
    statusEl.textContent = `${tracks.length}曲を取得しました。「再生」を押してください。`;
    player = new CrossfadePlayer(tracks);
  } catch (e) {
    statusEl.textContent = `エラー: ${e}`;
    log(`初期化エラー: ${e}`);
  }
}

btnPlayPause.addEventListener('click', () => {
  if (!player) return;
  if (!player.playing && player.history.length === 0) {
    player.start();
  } else {
    player.togglePlayPause();
  }
});
btnNext.addEventListener('click', () => player && player.advance(1));
btnPrev.addEventListener('click', () => player && player.advance(-1));

init();
