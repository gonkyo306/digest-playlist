// 常時表示のミニプレイヤー（FR-4.16, FR-4.17）。
// 再生が始まったら、再生中は常に画面下部のミニプレイヤーで操作する（再生・一時停止、次へをアイコンのみで表示）。
// 検索タブでの試聴もミニプレイヤーに表示する。試聴中は次へを無効化し、
// タップしても画面遷移しない。試聴が終わるとミニプレイヤーごと消える（本編再生の自動再開はしない）。
// 曲名・アーティスト名の表示領域には、前へボタンが無い分の幅を充てる。
// 全曲を一巡して自動停止した場合（finished）は、一時停止の表示にし、次への操作を非活性化する。
// 曲が切り替わるたびに中身を丸ごと作り直すと、ジャケット画像が毎回読み込み直しになり
// 一瞬空白（灰色の枠）が見えてしまうため、DOMは最初の1回だけ作り、以降は変更のあった部分
// （ジャケット・曲名・アーティスト名・再生/一時停止アイコン・非活性状態）だけを更新する。

import { iconOnly } from './icons.js';
import { setupMarquee } from '../marquee.js';

// 操作のコールバックは描画のたびに差し替わるため、DOMには最新のものを参照させる
const latestActions = new WeakMap();

function buildMiniPlayer(container) {
  container.innerHTML = `
    <button type="button" class="mini-player-tap">
      <img src="" alt="" class="artwork-sm">
      <div class="item-main">
        <div class="item-name marquee"><span class="marquee-track"><span class="marquee-text"></span></span></div>
        <div class="item-sub"></div>
      </div>
    </button>
    <div class="mini-player-controls">
      <button type="button" class="icon-btn mini-playpause"></button>
      <button type="button" class="icon-btn mini-next" aria-label="次へ">${iconOnly('next')}</button>
    </div>
  `;
  container.querySelector('.mini-player-tap').addEventListener('click', () => {
    const a = latestActions.get(container);
    if (a && !container.classList.contains('mini-player-preview') && a.onTap) a.onTap();
  });
  container.querySelector('.mini-playpause').addEventListener('click', (e) => {
    e.stopPropagation();
    const a = latestActions.get(container);
    if (a && !container.querySelector('.mini-playpause').disabled && a.onTogglePlayPause) a.onTogglePlayPause();
  });
  container.querySelector('.mini-next').addEventListener('click', (e) => {
    e.stopPropagation();
    const a = latestActions.get(container);
    if (a && !container.querySelector('.mini-next').disabled && a.onNext) a.onNext();
  });
}

/**
 * @param {HTMLElement} container ミニプレイヤー専用のコンテナ（アプリ全体で共通の1箇所）
 * @param {{track: object|null, playing: boolean, isPreview?: boolean, finished?: boolean}|null} state
 *   nullまたはtrackがnullなら非表示にする。isPreview=trueなら試聴中の表示（次へ無効、タップ無効）。
 *   finished=trueなら全曲一巡後の自動停止表示（一時停止表示＋次へ非活性化。FR-4.4）。
 * @param {{onTogglePlayPause?: Function, onNext?: Function, onTap?: Function}} actions
 */
export function renderMiniPlayer(container, state, actions) {
  if (!state || !state.track) {
    container.innerHTML = '';
    container.classList.remove('visible', 'mini-player-preview');
    return;
  }
  const isPreview = !!state.isPreview;
  const finished = !!state.finished;
  const wasVisible = container.classList.contains('visible');

  if (!container.querySelector('.mini-player-tap')) buildMiniPlayer(container);
  latestActions.set(container, actions || {});
  container.classList.add('visible');
  container.classList.toggle('mini-player-preview', isPreview);

  const tap = container.querySelector('.mini-player-tap');
  if (isPreview) {
    tap.setAttribute('aria-hidden', 'true');
    tap.tabIndex = -1;
  } else {
    tap.removeAttribute('aria-hidden');
    tap.tabIndex = 0;
  }

  // ジャケットは、画像が変わるときだけsrcを差し替える（読み込み完了までは直前の画像が残る）
  const img = container.querySelector('.artwork-sm');
  const artwork = state.track.artwork || '';
  if (img.getAttribute('src') !== artwork) img.setAttribute('src', artwork);

  // 曲名・アーティスト名は、変わったときだけ更新する。曲名が変わった（または非表示から再表示した）
  // 場合は、横幅に収まるかどうかの判定（自動スクロール）をやり直す
  const nameEl = container.querySelector('.marquee-text');
  const subEl = container.querySelector('.item-sub');
  const titleChanged = nameEl.textContent !== state.track.title;
  if (titleChanged) {
    nameEl.textContent = state.track.title;
  }
  if (subEl.textContent !== state.track.artist) subEl.textContent = state.track.artist;
  if (titleChanged || !wasVisible) setupMarquee(container.querySelector('.item-name'));

  const playPause = container.querySelector('.mini-playpause');
  const label = state.playing ? '一時停止' : '再生';
  if (playPause.getAttribute('aria-label') !== label) {
    playPause.setAttribute('aria-label', label);
    playPause.innerHTML = iconOnly(state.playing ? 'pause' : 'play');
  }
  playPause.disabled = finished;
  container.querySelector('.mini-next').disabled = isPreview || finished;
}
