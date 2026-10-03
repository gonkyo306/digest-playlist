// プレイリストの自動再生（本アプリの中心）
// 曲順決定（playback-order.js）・履歴（playback-history.js）・連続失敗判定（failure-tracker.js）を
// それぞれ独立したモジュールに切り出し、Audio要素・AudioContextの生成を差し替え可能にすることで
// Unitテストできる形にしている。
//
// 対応基準:
//   FR-4.2, FR-4.3（ランダム再生・一巡まで重複なし） → playback-order.js
//   FR-4.4（一巡したら自動停止する。再シャッフルして続けることはしない）
//   FR-4.5, FR-4.6（自動再生・終了時に次の曲へ）
//   FR-4.7（クロスフェード。crossfadeSeconds=0で無効化できる）
//   FR-4.8, FR-4.9（一時停止・再開・次へ）
//   FR-4.13（オフライン検知で一時停止、復帰で再開可能に）
//   FR-4.14（0曲・1曲の扱い）
//   FR-4.15（3曲連続失敗で停止） → failure-tracker.js
//   FR-4.11（再生中の曲情報を表示に反映）→ onTrackChange コールバック
//   FR-4.12（ロック画面/通知からの操作）→ Media Session APIのセットアップ
//   FR-2.15, FR-2.16（プレイリスト詳細のシャッフルON/OFF切り替え）→ options.shuffle
//   FR-4.16（曲の切り替え時にミニプレイヤーが消えない）→ 再生の開始待ち（audio.play()の完了前）の曲も
//   currentTrack()が返す
//   FR-4.8（端末側の都合の停止を表示に反映）→ 他アプリの音声・通話・イヤホン切断等でaudio要素が
//   止まった／音声のエラーが起きた／AudioContextが中断された場合も、再生状態の表示に反映する

import {
  buildInitialOrder, buildOrderStartingAt,
  buildSequentialOrder, buildSequentialOrderStartingAt,
} from './playback-order.js';
import { PlaybackHistory } from './playback-history.js';
import { ConsecutiveFailureTracker } from './failure-tracker.js';

const DEFAULT_CROSSFADE_SECONDS = 2;
const DEFAULT_FAILURE_THRESHOLD = 3;

export class PlaylistPlayer {
  /**
   * @param {Array<{id, title, artist, artwork, previewUrl}>} tracks
   * @param {object} [options]
   * @param {number} [options.crossfadeSeconds] 0を指定するとクロスフェードを無効化（FR-4.7）
   * @param {() => HTMLAudioElement} [options.createAudio]
   * @param {() => AudioContext} [options.createAudioContext]
   * @param {(track: object|null) => void} [options.onTrackChange] 再生中の曲が変わるたびに呼ばれる（FR-4.11）
   * @param {(playing: boolean) => void} [options.onPlayStateChange]
   * @param {() => void} [options.onFailureStop] 3曲連続失敗で停止したときに呼ばれる（FR-4.15）
   * @param {() => void} [options.onPlaybackComplete] 全曲を一巡して自動停止したときに呼ばれる
   *   （FR-4.4）。再シャッフルして再生を続けることはしない
   * @param {number} [options.failureThreshold]
   * @param {boolean} [options.shuffle] falseを指定すると、渡されたtracksの並び順のまま再生する
   *   （シャッフルしない。FR-2.16）。省略時はtrue（FR-4.2の「毎回ランダム」が既定）
   */
  constructor(tracks, options = {}) {
    this.tracks = tracks || [];
    this.shuffle = options.shuffle !== false;
    this.crossfadeSeconds = options.crossfadeSeconds ?? DEFAULT_CROSSFADE_SECONDS;
    this._createAudio = options.createAudio || (() => new Audio());
    this._createAudioContext = options.createAudioContext
      || (() => new (window.AudioContext || window.webkitAudioContext)());
    this._onTrackChange = options.onTrackChange || (() => {});
    this._onPlayStateChange = options.onPlayStateChange || (() => {});
    this._onFailureStop = options.onFailureStop || (() => {});
    this._onPlaybackComplete = options.onPlaybackComplete || (() => {});
    this._failureTracker = new ConsecutiveFailureTracker(options.failureThreshold || DEFAULT_FAILURE_THRESHOLD);

    this.order = this.tracks.length
      ? (this.shuffle ? buildInitialOrder(this.tracks.length) : buildSequentialOrder(this.tracks.length))
      : [];
    this.pos = -1;
    this.history = new PlaybackHistory();
    this.playing = false;
    this.stopped = false; // 連続失敗で停止した場合true（FR-4.15）
    this.finished = false; // 全曲を一巡して自動停止した場合true（FR-4.4）
    this._crossfadeTriggered = false;
    this._pausedByOffline = false;
    this._pausedByPreview = false;
    this._loadingIndex = null; // audio.play()の完了待ちの曲（tracks配列でのインデックス）。待っていなければnull

    if (this.tracks.length > 0) {
      this._setupAudio();
    }
  }

  /** 0曲の場合、再生操作自体を無効化する（呼び出し側のUIで使う） FR-4.14 */
  get isEmpty() {
    return this.tracks.length === 0;
  }

  /** 1曲のみかどうか。1曲のみの場合も、その1回の再生後に自動停止する（繰り返さない）。FR-4.14 */
  get isSingleTrack() {
    return this.tracks.length === 1;
  }

  get useCrossfade() {
    return this.crossfadeSeconds > 0;
  }

  get pausedByOffline() {
    return this._pausedByOffline;
  }

  /** 曲の再生開始待ち（audio.play()の完了前）かどうか。待ち中も画面にはその曲を再生中として表示する */
  get loading() {
    return this._loadingIndex !== null;
  }

  currentTrack() {
    // 再生開始待ちの曲があれば、それを現在の曲として返す（切り替えのたびに表示が空になるのを防ぐ）
    if (this._loadingIndex !== null) return this.tracks[this._loadingIndex];
    const idx = this.history.current();
    return idx === null ? null : this.tracks[idx];
  }

  _setupAudio() {
    this.audioA = this._createAudio();
    this.audioB = this._createAudio();
    this.audioA.crossOrigin = 'anonymous';
    this.audioB.crossOrigin = 'anonymous';
    this.active = this.audioA;
    this.standby = this.audioB;

    if (this.useCrossfade) {
      this.ctx = this._createAudioContext();
      this.gainA = this.ctx.createGain();
      this.gainB = this.ctx.createGain();
      const srcA = this.ctx.createMediaElementSource(this.audioA);
      const srcB = this.ctx.createMediaElementSource(this.audioB);
      srcA.connect(this.gainA).connect(this.ctx.destination);
      srcB.connect(this.gainB).connect(this.ctx.destination);
      this.activeGain = this.gainA;
      this.standbyGain = this.gainB;
    }

    if (this.ctx) {
      // 他アプリの音声・画面ロック等でAudioContextが中断されると、audio要素は「再生中」のまま無音になる。
      // その場合は一時停止として扱い、再生ボタンでAudioContextごと再開できるようにする
      this.ctx.onstatechange = () => {
        if (this.ctx.state !== 'running') this._syncPaused(this.active);
      };
    }

    [this.audioA, this.audioB].forEach((a) => {
      a.addEventListener('timeupdate', () => this._onTimeUpdate(a));
      a.addEventListener('ended', () => this._onEnded(a));
      a.addEventListener('pause', () => this._syncPaused(a));
      a.addEventListener('play', () => this._syncPlaying(a));
      a.addEventListener('error', () => this._onAudioError(a));
    });
  }

  /** 端末側でaudio要素が止まった場合（アプリ側の操作によるものは既にplaying=falseのため何もしない） */
  _syncPaused(audioEl) {
    if (audioEl !== this.active || audioEl.ended || this._loadingIndex !== null) return;
    if (!this.playing) return;
    this.playing = false;
    this._onPlayStateChange(false);
  }

  /** 端末側（イヤホンのボタン・OSの再生操作等）でaudio要素が再開された場合 */
  _syncPlaying(audioEl) {
    if (audioEl !== this.active || this._loadingIndex !== null) return;
    if (this.playing || this.finished || this.stopped) return;
    this.playing = true;
    this._pausedByOffline = false;
    this._pausedByPreview = false;
    this._onPlayStateChange(true);
  }

  /** 再生が始まったあとに音声のエラー（通信切れ等）が起きた場合は、その曲を失敗として次の曲へ進む */
  _onAudioError(audioEl) {
    if (audioEl !== this.active || this._loadingIndex !== null || !this.playing) return;
    this._handlePlayFailure();
  }

  /** 曲の再生失敗の共通処理（FR-4.15）。連続失敗が上限に達したら停止し、そうでなければ次の曲へ進む */
  _handlePlayFailure() {
    const exhausted = this._failureTracker.recordFailure();
    if (exhausted) {
      this.stopped = true;
      this.playing = false;
      this._loadingIndex = null;
      this._onPlayStateChange(false);
      this._onFailureStop();
      return;
    }
    // この曲だけスキップして次へ（FR-3.3相当。fetchTrackInfoByIdsで既に除外された曲以外の、
    // 再生時点でのエラーに対する保険）
    this._advanceForward();
  }

  /**
   * 再生を開始する。0曲の場合は何もしない（FR-4.14）。
   * @param {number} [startTrackIndex] 指定すると、その曲（tracks配列でのインデックス）を1曲目にして
   *   再生を始める。シャッフル有効なら2曲目以降は残りの曲をシャッフルした順、無効なら
   *   tracksの並び順のまま指定した曲の次から順になる。省略時は先頭から始まる（従来通り）
   */
  async start(startTrackIndex) {
    if (this.isEmpty) return;
    this.stopped = false;
    if (startTrackIndex != null) {
      this.order = this.shuffle
        ? buildOrderStartingAt(this.tracks.length, startTrackIndex)
        : buildSequentialOrderStartingAt(this.tracks.length, startTrackIndex);
    }
    this.pos = 0;
    await this._playAt(this.order[this.pos], { isFirst: true, fromHistory: false });
  }

  async _playAt(trackIndex, { isFirst, fromHistory }) {
    const track = this.tracks[trackIndex];
    const audioEl = this.active;
    const gainNode = this.useCrossfade ? this.activeGain : null;

    this._loadingIndex = trackIndex;
    audioEl.src = track.previewUrl;
    if (gainNode) gainNode.gain.value = isFirst ? 1 : 0;
    this._crossfadeTriggered = false;

    try {
      if (this.useCrossfade) {
        await this.ctx.resume();
      }
      await audioEl.play();
      this.playing = true;
      this._onPlayStateChange(true);
      if (gainNode && !isFirst) {
        this._rampGain(gainNode, 0, 1, this.crossfadeSeconds);
      }
      this._failureTracker.recordSuccess();
    } catch (err) {
      // 待ち中に別の曲へ切り替わっていた場合は、この曲の失敗として扱わない
      if (this._loadingIndex === trackIndex) this._handlePlayFailure();
      return;
    }

    if (this._loadingIndex === trackIndex) this._loadingIndex = null;
    if (!fromHistory) {
      this.history.push(trackIndex);
    }
    this._onTrackChange(track);
  }

  _rampGain(gainNode, from, to, seconds) {
    const now = this.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(from, now);
    gainNode.gain.linearRampToValueAtTime(to, now + seconds);
  }

  _onTimeUpdate(audioEl) {
    if (!this.useCrossfade) return;
    if (audioEl !== this.active || this._crossfadeTriggered) return;
    // 最後の曲はクロスフェードせず、自然に終わらせて一巡後に自動停止する
    if (this._nextOrderPos() === null) return;
    const remaining = audioEl.duration - audioEl.currentTime;
    if (Number.isFinite(remaining) && remaining <= this.crossfadeSeconds && remaining > 0) {
      this._crossfadeTriggered = true;
      this._beginCrossfadeToNext();
    }
  }

  async _beginCrossfadeToNext() {
    this._rampGain(this.activeGain, 1, 0, this.crossfadeSeconds);
    const nextOrderPos = this._nextOrderPos();
    const nextTrackIndex = this.order[nextOrderPos];

    const oldActive = this.active;
    const oldActiveGain = this.activeGain;
    this.active = this.standby;
    this.activeGain = this.standbyGain;
    this.standby = oldActive;
    this.standbyGain = oldActiveGain;
    this.pos = nextOrderPos;

    await this._playAt(nextTrackIndex, { isFirst: false, fromHistory: false });
  }

  _onEnded(audioEl) {
    // クロスフェードが有効なら、通常はここに来る前に次の曲が始まっている（保険として処理）。
    // クロスフェード無効時は、ここが「曲が終わったら次へ」の本処理になる（FR-4.6）。
    if (audioEl === this.active && !this._crossfadeTriggered) {
      this._advanceForward();
    }
  }

  /**
   * 次に再生すべきorder配列中の位置を返す。最後の曲まで再生し終えた場合はnullを返す
   * （一巡したら自動停止し、再シャッフルして続けることはしない）
   */
  _nextOrderPos() {
    const next = this.pos + 1;
    return next >= this.order.length ? null : next;
  }

  _advanceForward() {
    const nextPos = this._nextOrderPos();
    if (nextPos === null) {
      this._finishPlayback();
      return;
    }
    this.pos = nextPos;
    this._playAt(this.order[nextPos], { isFirst: true, fromHistory: false });
  }

  /** 全曲を一巡し終えたときの自動停止処理（FR-4.4） */
  _finishPlayback() {
    if (this.active) this.active.pause();
    if (this.standby) this.standby.pause();
    this.playing = false;
    this.finished = true;
    this._loadingIndex = null;
    this._onPlayStateChange(false);
    this._onPlaybackComplete();
  }

  /** 次へ（FR-4.9） */
  next() {
    if (this.isEmpty || this.stopped || this.finished) return;
    this._advanceForward();
  }

  /** 一時停止・再開の切り替え（FR-4.8） */
  togglePlayPause() {
    if (this.isEmpty || this.stopped || this.finished || !this.active) return;
    if (this.active.paused) {
      // 表示は即座に再生中へ切り替え、AudioContextの再開・再生の開始に失敗した場合は一時停止に戻す
      this.playing = true;
      this._pausedByOffline = false;
      this._pausedByPreview = false;
      if (this.useCrossfade) Promise.resolve(this.ctx.resume()).catch(() => {});
      Promise.resolve(this.active.play()).catch(() => {
        if (!this.playing) return;
        this.playing = false;
        this._onPlayStateChange(false);
      });
    } else {
      this.active.pause();
      this.playing = false;
    }
    this._onPlayStateChange(this.playing);
  }

  /** オフラインになったときに呼ぶ。再生中であれば一時停止する（FR-4.13） */
  handleOffline() {
    if (this.playing && this.active && !this.active.paused) {
      this.active.pause();
      this.playing = false;
      this._pausedByOffline = true;
      this._onPlayStateChange(false);
    }
  }

  /** オンラインに復帰したときに呼ぶ。オフラインで止めた場合のみ再開可能にする（FR-4.13） */
  handleOnline() {
    if (this._pausedByOffline) {
      this._pausedByOffline = false;
      // 自動再開はせず、再開可能な状態に戻すのみ（ユーザー操作で再開する）
    }
  }

  /**
   * 検索結果の試聴が始まったときに呼ぶ。再生中なら一時停止し、試聴終了後も自動では再開しない（FR-1.6）
   */
  pauseForPreview() {
    if (this.playing && this.active && !this.active.paused) {
      this.active.pause();
      this.playing = false;
      this._pausedByPreview = true;
      this._onPlayStateChange(false);
    }
  }

  /** 完全に停止し、後始末をする（画面を離れるときなどに呼ぶ） */
  dispose() {
    if (this.audioA) this.audioA.pause();
    if (this.audioB) this.audioB.pause();
    this.playing = false;
  }
}
