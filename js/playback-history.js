// フェーズ4：実際に再生した曲の履歴（「前へ戻る」用。FR-4.10）
// シャッフル順（playback-order.js）とは別に、実際に再生した順序をスタックで管理する。
// 履歴の先頭では「前へ」を無効化する。

export class PlaybackHistory {
  constructor() {
    this._items = [];
    this._pos = -1;
  }

  /** 現在再生中の曲（インデックス）。何も再生していなければ null */
  current() {
    return this._pos >= 0 && this._pos < this._items.length ? this._items[this._pos] : null;
  }

  /**
   * 新しく再生した曲を履歴に積む。
   * 「前へ戻った」状態から新しい曲を再生した場合、それより先（進むはずだった側）の履歴は破棄する。
   */
  push(trackIndex) {
    this._items = this._items.slice(0, this._pos + 1);
    this._items.push(trackIndex);
    this._pos = this._items.length - 1;
  }

  /** 履歴の先頭でなければ「前へ」戻れる（FR-4.10） */
  canGoBack() {
    return this._pos > 0;
  }

  /** 1つ前の曲へ戻る。戻れない場合は null を返し、状態は変えない */
  goBack() {
    if (!this.canGoBack()) return null;
    this._pos--;
    return this._items[this._pos];
  }

  reset() {
    this._items = [];
    this._pos = -1;
  }
}
