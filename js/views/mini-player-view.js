// フェーズ8：常時表示のミニプレイヤー（FR-4.16, FR-4.17）。
// プレイリスト詳細画面から離れて（一覧に戻る・検索タブに切り替える等）も再生が続くときと、
// アルバムの一時再生（FR-1.11）から離れたときの両方に表示する。

import { iconLabel } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container ミニプレイヤー専用のコンテナ（アプリ全体で共通の1箇所）
 * @param {{track: object|null, playing: boolean}|null} state nullまたはtrackがnullなら非表示にする
 * @param {{onTogglePlayPause: Function, onNext: Function, onTap: Function}} actions
 */
export function renderMiniPlayer(container, state, actions) {
  if (!state || !state.track) {
    container.innerHTML = '';
    container.classList.remove('visible');
    return;
  }
  container.classList.add('visible');
  container.innerHTML = `
    <button type="button" class="mini-player-tap">
      <img src="${escapeHtml(state.track.artwork || '')}" alt="" class="artwork-sm">
      <div class="item-main">
        <div class="item-name">${escapeHtml(state.track.title)}</div>
        <div class="item-sub">${escapeHtml(state.track.artist)}</div>
      </div>
    </button>
    <div class="mini-player-controls">
      <button type="button" class="icon-btn mini-playpause">${iconLabel(state.playing ? 'pause' : 'play', state.playing ? '一時停止' : '再生')}</button>
      <button type="button" class="icon-btn mini-next">${iconLabel('next', '次へ')}</button>
    </div>
  `;
  container.querySelector('.mini-player-tap').addEventListener('click', actions.onTap);
  container.querySelector('.mini-playpause').addEventListener('click', (e) => {
    e.stopPropagation();
    actions.onTogglePlayPause();
  });
  container.querySelector('.mini-next').addEventListener('click', (e) => {
    e.stopPropagation();
    actions.onNext();
  });
}
