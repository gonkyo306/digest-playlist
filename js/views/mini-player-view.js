// フェーズ8・14・15：常時表示のミニプレイヤー（FR-4.16, FR-4.17）。
// CR-016：プレイリスト本編の再生パネルを廃止し、再生が始まったら常にミニプレイヤーで操作する
// （表示画面を離れたときだけでなく、再生中は常時表示する）。前へ・次へ・再生/一時停止をアイコンのみで表示。
// CR-020/023：検索タブでの試聴もミニプレイヤーに表示する。試聴中は前へ/次へを無効化し、
// タップしても画面遷移しない。試聴が終わるとミニプレイヤーごと消える（本編再生の自動再開はしない）。

import { iconOnly } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container ミニプレイヤー専用のコンテナ（アプリ全体で共通の1箇所）
 * @param {{track: object|null, playing: boolean, isPreview?: boolean, canGoBack?: boolean}|null} state
 *   nullまたはtrackがnullなら非表示にする。isPreview=trueなら試聴中の表示（前へ/次へ無効、タップ無効）。
 * @param {{onTogglePlayPause?: Function, onNext?: Function, onPrev?: Function, onTap?: Function}} actions
 */
export function renderMiniPlayer(container, state, actions) {
  if (!state || !state.track) {
    container.innerHTML = '';
    container.classList.remove('visible');
    return;
  }
  container.classList.add('visible');
  container.classList.toggle('mini-player-preview', !!state.isPreview);
  const canGoBack = !!state.canGoBack;
  const isPreview = !!state.isPreview;

  container.innerHTML = `
    <button type="button" class="mini-player-tap" ${isPreview ? 'aria-hidden="true" tabindex="-1"' : ''}>
      <img src="${escapeHtml(state.track.artwork || '')}" alt="" class="artwork-sm">
      <div class="item-main">
        <div class="item-name">${escapeHtml(state.track.title)}</div>
        <div class="item-sub">${escapeHtml(state.track.artist)}</div>
      </div>
    </button>
    <div class="mini-player-controls">
      <button type="button" class="icon-btn mini-prev" aria-label="前へ" ${isPreview || !canGoBack ? 'disabled' : ''}>${iconOnly('prev')}</button>
      <button type="button" class="icon-btn mini-playpause" aria-label="${state.playing ? '一時停止' : '再生'}">${iconOnly(state.playing ? 'pause' : 'play')}</button>
      <button type="button" class="icon-btn mini-next" aria-label="次へ" ${isPreview ? 'disabled' : ''}>${iconOnly('next')}</button>
    </div>
  `;
  if (!isPreview) {
    container.querySelector('.mini-player-tap').addEventListener('click', actions.onTap);
  }
  container.querySelector('.mini-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPreview && canGoBack) actions.onPrev();
  });
  container.querySelector('.mini-playpause').addEventListener('click', (e) => {
    e.stopPropagation();
    actions.onTogglePlayPause();
  });
  container.querySelector('.mini-next').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPreview) actions.onNext();
  });
}
