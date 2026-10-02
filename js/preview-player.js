// フェーズ2：検索結果の試聴（再生・停止）
// プレイリスト本編の再生（フェーズ4）とは別の、検索結果を1曲だけ試聴するための単純なプレーヤー（FR-1.5）。
// 同時に鳴らすのは1曲のみとし、別の曲を再生すると前の曲は自動で止まる。
//
// フェーズ41：試聴の音声が読み込めない・再生できない・端末側で止められた場合も、画面（ミニプレイヤー）に
// 「試聴中」の表示だけが残らないよう、試聴の状態を止める。
//
// 実際の<audio>要素をテストで使うことはできないため、audio要素を生成する関数（createAudio）を
// 差し替え可能にしてある。ブラウザでは既定で `() => new Audio()` を使い、
// テストでは play/pause/addEventListener などを備えた偽物のaudio要素を注入する。

export class PreviewPlayer {
  /**
   * @param {{createAudio?: () => HTMLAudioElement, onStop?: (trackId: string|number) => void}} [options]
   */
  constructor(options = {}) {
    this._createAudio = options.createAudio || (() => new Audio());
    this._onStop = options.onStop || (() => {});
    this._audio = null;
    this._playingTrackId = null;
  }

  get isPlaying() {
    return this._playingTrackId !== null;
  }

  get currentTrackId() {
    return this._playingTrackId;
  }

  /**
   * 指定した曲を試聴再生する。既に別の曲を再生中なら、先にそれを停止する（FR-1.5）。
   * @param {{id: string|number, previewUrl: string}} track
   */
  play(track) {
    if (this.isPlaying) {
      this.stop();
    }
    const audio = this._createAudio();
    audio.src = track.previewUrl;
    audio.crossOrigin = 'anonymous';
    audio.addEventListener('ended', () => this._handleEnded(track.id));
    // 読み込み失敗・端末側の都合（他アプリの音声・通話等）による一時停止でも、試聴中の表示を残さない
    audio.addEventListener('error', () => this._handleInterrupted(audio));
    audio.addEventListener('pause', () => {
      if (!audio.ended) this._handleInterrupted(audio);
    });
    this._audio = audio;
    this._playingTrackId = track.id;
    // 再生を開始できなかった場合（自動再生の制限・音声の取得失敗等）も、同様に試聴を止める
    Promise.resolve(audio.play()).catch(() => this._handleInterrupted(audio));
  }

  /** 再生中の試聴を止める。再生していなければ何もしない */
  stop() {
    if (!this.isPlaying) return;
    const stoppedId = this._playingTrackId;
    const audio = this._audio;
    this._audio = null;
    this._playingTrackId = null;
    if (audio) {
      audio.pause();
    }
    this._onStop(stoppedId);
  }

  /** 試聴中のaudio要素が、アプリの操作以外の理由で止まった・失敗した場合 */
  _handleInterrupted(audio) {
    // 既に別の曲へ切り替わっている、またはアプリ自身がstop()した後（_audioがnull）なら何もしない
    if (this._audio !== audio) return;
    this.stop();
  }

  _handleEnded(trackId) {
    // 再生終了時、まだこの曲を再生中だった場合のみ状態をクリアする
    // （既に別の曲へ切り替わっていた場合は何もしない）
    if (this._playingTrackId === trackId) {
      this._playingTrackId = null;
      this._audio = null;
      this._onStop(trackId);
    }
  }
}
