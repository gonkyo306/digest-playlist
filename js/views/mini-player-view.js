// フェーズ8・14・15：常時表示のミニプレイヤー（FR-4.16, FR-4.17）。
// CR-016：プレイリスト本編の再生パネルを廃止し、再生が始まったら常にミニプレイヤーで操作する
// （表示画面を離れたときだけでなく、再生中は常時表示する）。次へ・再生/一時停止をアイコンのみで表示。
// CR-020/023：検索タブでの試聴もミニプレイヤーに表示する。試聴中は次へを無効化し、
// タップしても画面遷移しない。試聴が終わるとミニプレイヤーごと消える（本編再生の自動再開はしない）。
// CR-068：「前へ」ボタンを廃止（FR-4.10の「前の曲へ戻る」機能自体を廃止）し、空いた幅を
// 曲名・アーティスト名の表示領域に充てる。
// CR-063：全曲を一巡して自動停止した場合（finished）は、一時停止の表示にし、次への操作を非活性化する。

import { iconOnly } from './icons.js';
import { setupMarquee } from '../marquee.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container ミニプレイヤー専用のコンテナ（アプリ全体で共通の1箇所）
 * @param {{track: object|null, playing: boolean, isPreview?: boolean, finished?: boolean}|null} state
 *   nullまたはtrackがnullなら非表示にする。isPreview=trueなら試聴中の表示（次へ無効、タップ無効）。
 *   finished=trueなら全曲一巡後の自動停止表示（CR-063。一時停止表示＋次へ非活性化）。
 * @param {{onTogglePlayPause?: Function, onNext?: Function, onTap?: Function}} actions
 */
export function renderMiniPlayer(container, state, actions) {
  if (!state || !state.track) {
    container.innerHTML = '';
    container.classList.remove('visible');
    return;
  }
  container.classList.add('visible');
  container.classList.toggle('mini-player-preview', !!state.isPreview);
  const isPreview = !!state.isPreview;
  const finished = !!state.finished;

  container.innerHTML = `
    <button type="button" class="mini-player-tap" ${isPreview ? 'aria-hidden="true" tabindex="-1"' : ''}>
      <img src="${escapeHtml(state.track.artwork || '')}" alt="" class="artwork-sm">
      <div class="item-main">
        <div class="item-name marquee"><span class="marquee-track"><span class="marquee-text">${escapeHtml(state.track.title)}</span></span></div>
        <div class="item-sub">${escapeHtml(state.track.artist)}</div>
      </div>
    </button>
    <div class="mini-player-controls">
      <button type="button" class="icon-btn mini-playpause" aria-label="${state.playing ? '一時停止' : '再生'}" ${finished ? 'disabled' : ''}>${iconOnly(state.playing ? 'pause' : 'play')}</button>
      <button type="button" class="icon-btn mini-next" aria-label="次へ" ${isPreview || finished ? 'disabled' : ''}>${iconOnly('next')}</button>
    </div>
  `;
  // フェーズ39：曲名が横幅に収まらないときは自動スクロールする（ジャケット・操作ボタンの位置は動かさない）
  setupMarquee(container.querySelector('.item-name'));
  if (!isPreview) {
    container.querySelector('.mini-player-tap').addEventListener('click', actions.onTap);
  }
  container.querySelector('.mini-playpause').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!finished) actions.onTogglePlayPause();
  });
  container.querySelector('.mini-next').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPreview && !finished) actions.onNext();
  });
}
