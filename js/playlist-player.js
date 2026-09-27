// フェーズ4：プレイリストの自動再生（本アプリの中心）
// フェーズ0で検証済みのロジック（js/verify.js の CrossfadePlayer）を土台に、
// 曲順決定（playback-order.js）・履歴（playback-history.js）・連続失敗判定（failure-tracker.js）を
// それぞれ独立したモジュールに切り出し、Audio要素・AudioContextの生成を差し替え可能にすることで
// Unitテストできる形に再設計したもの。
//
// 対応基準:
//   FR-4.2, FR-4.3（ランダム再生・一巡まで重複なし） → playback-order.js
//   FR-4.4（再シャッフル時に直前の曲を先頭にしない）   → playback-order.js
//   FR-4.5, FR-4.6（自動再生・終了時に次の曲へ）
//   FR-4.7（クロスフェード。crossfadeSeconds=0で無効化できる）
//   FR-4.8, FR-4.9, FR-4.10（一時停止・再開・次へ/前へ、履歴先頭で「前へ」無効）
//   FR-4.13（オフライン検知で一時停止、復帰で再開可能に）
//   FR-4.14（0曲・1曲の扱い）
//   FR-4.15（3曲連続失敗で停止） → failure-tracker.js
//   FR-4.11（再生中の曲情報を表示に反映）→ onTrackChange コールバック
//   FR-4.12（ロック画面/通知からの操作）→ Media Session APIのセットアップ

import { buildInitialOrder, reshuffleAvoidingRepeat } from './playback-order.js';
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
   * @param {number} [options.failureThreshold]
   */
  constructor(tracks, options = {}) {
    this.tracks = tracks || [];
    this.crossfadeSeconds = options.crossfadeSeconds ?? DEFAULT_CROSSFADE_SECONDS;
    this._createAudio = options.createAudio || (() => new Audio());
    this._createAudioContext = options.createAudioContext
      || (() => new (window.AudioContext || window.webkitAudioContext)());
    this._onTrackChange = options.onTrackChange || (() => {});
    this._onPlayStateChange = options.onPlayStateChange || (() => {});
    this._onFailureStop = options.onFailureStop || (() => {});
    this._failureTracker = new ConsecutiveFailureTracker(options.failureThreshold || DEFAULT_FAILURE_THRESHOLD);

    this.order = this.tracks.length ? buildInitialOrder(this.tracks.length) : [];
    this.pos = -1;
    this.history = new PlaybackHistory();
    this.playing = false;
    this.stopped = false; // 連続失敗で停止した場合true（FR-4.15）
    this._crossfadeTriggered = false;
    this._pausedByOffline = false;
    this._pausedByPreview = false;

    if (this.tracks.length > 0) {
      this._setupAudio();
    }
  }

  /** 0曲の場合、再生操作自体を無効化する（呼び出し側のUIで使う） FR-4.14 */
  get isEmpty() {
    return this.tracks.length === 0;
  }

  /** 1曲のみの場合、一巡後は同じ曲を繰り返す FR-4.14 */
  get isSingleTrack() {
    return this.tracks.length === 1;
  }

  get useCrossfade() {
    return this.crossfadeSeconds > 0;
  }

  get pausedByOffline() {
    return this._pausedByOffline;
  }

  currentTrack() {
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

    [this.audioA, this.audioB].forEach((a) => {
      a.addEventListener('timeupdate', () => this._onTimeUpdate(a));
      a.addEventListener('ended', () => this._onEnded(a));
    });
  }

  /** 最初の曲から再生を開始する。0曲の場合は何もしない（FR-4.14） */
  async start() {
    if (this.isEmpty) return;
    this.stopped = false;
    this.pos = 0;
    await this._playAt(this.order[this.pos], { isFirst: true, fromHistory: false });
  }

  async _playAt(trackIndex, { isFirst, fromHistory }) {
    const track = this.tracks[trackIndex];
    const audioEl = this.active;
    const gainNode = this.useCrossfade ? this.activeGain : null;

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
      const exhausted = this._failureTracker.recordFailure();
      if (exhausted) {
        this.stopped = true;
        this.playing = false;
        this._onPlayStateChange(false);
        this._onFailureStop();
        return;
      }
      // この曲だけスキップして次へ（FR-3.3相当。fetchTrackInfoByIdsで既に除外された曲以外の、
      // 再生時点でのエラーに対する保険）
      this._advanceForward();
      return;
    }

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

  _nextOrderPos() {
    let next = this.pos + 1;
    if (next >= this.order.length) {
      const lastTrackIndex = this.order[this.pos];
      this.order = reshuffleAvoidingRepeat(this.tracks.length, lastTrackIndex);
      next = 0;
    }
    return next;
  }

  _advanceForward() {
    const nextPos = this._nextOrderPos();
    this.pos = nextPos;
    this._playAt(this.order[nextPos], { isFirst: true, fromHistory: false });
  }

  /** 次へ（FR-4.9） */
  next() {
    if (this.isEmpty || this.stopped) return;
    this._advanceForward();
  }

  /** 前へ。履歴の先頭では何もしない（FR-4.10） */
  prev() {
    if (this.isEmpty || this.stopped) return;
    if (!this.history.canGoBack()) return;
    const trackIndex = this.history.goBack();
    this._playAt(trackIndex, { isFirst: true, fromHistory: true });
  }

  /** 一時停止・再開の切り替え（FR-4.8） */
  togglePlayPause() {
    if (this.isEmpty || this.stopped || !this.active) return;
    if (this.active.paused) {
      this.active.play();
      this.playing = true;
      this._pausedByOffline = false;
      this._pausedByPreview = false;
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
