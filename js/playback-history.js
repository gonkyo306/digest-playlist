// 実際に再生した曲の順序を管理する。
// シャッフル順（playback-order.js）とは別に、再生した曲のインデックスを積み、現在の曲を返す。

export class PlaybackHistory {
  constructor() {
    this._items = [];
    this._pos = -1;
  }

  /** 現在再生中の曲（インデックス）。何も再生していなければ null */
  current() {
    return this._pos >= 0 && this._pos < this._items.length ? this._items[this._pos] : null;
  }

  /** 新しく再生した曲を履歴に積む */
  push(trackIndex) {
    this._items = this._items.slice(0, this._pos + 1);
    this._items.push(trackIndex);
    this._pos = this._items.length - 1;
  }
}
