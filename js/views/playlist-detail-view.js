// フェーズ3：プレイリスト詳細画面（曲一覧の表示。FR-2.9, FR-2.5）
// フェーズ7：「＋曲を追加」導線は廃止（検索タブから追加する。FR-2.4）
// フェーズ11：曲一覧はアーティスト名順で表示（FR-2.11）。操作ボタンはアイコン表示（FR-5.3）
// CR-011：削除・戻るボタンはアイコンのみ（テキストラベルなし）に変更
// フェーズ14（CR-016）：インライン再生パネルを廃止。再生前は「再生」ボタンのみを表示し、
// 再生後の操作（一時停止・前へ・次へ）はミニプレイヤーに集約する（js/app.js側）。
// フェーズ21（CR-032）：曲の行をタップすると、その曲から再生を始める（専用アイコンは追加しない）。
// フェーズ21（CR-034）：ヘッダーをApple Music風（大きめジャケット・名前・ピル型再生ボタンを縦並び）に変更。
//   プレイリスト自体にはジャケットが無いため、先頭の曲のジャケットを代表画像として使う。
// フェーズ21（CR-035）：名前変更・削除ボタンを、一覧画面の各行からこの画面の右上に移設。
// フェーズ22（仕様見直し・2026-09-28）：再生中の曲のハイライト表示（CR-022）を廃止。
//   ミニプレイヤーで再生中の曲を確認できるため、曲一覧側の強調表示は不要と判断。

import { showConfirm, showPrompt } from './dialog.js';
import { sortTracksByArtist } from '../playlist-sort.js';
import { iconOnly } from './icons.js';
import { largeArtworkUrl } from '../artwork-url.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{playlist: object, tracks: Array<object>, unavailableIds: Array, fetchError?: string,
 *   isCurrentlyPlaying?: boolean}} data
 *   tracksは取得済みの順序（playlist.trackIdsの順、取得できなかった曲を除く）のまま渡すこと。
 *   先頭の曲（tracks[0]）のジャケットを、代表画像として使う（CR-034）。
 * @param {{onBack, onRemoveTrack, onStartPlayback, onTrackTap, onRename, onDelete}} actions
 */
export function renderPlaylistDetail(container, {
  playlist, tracks: rawTracks, unavailableIds, fetchError, isCurrentlyPlaying = false,
}, actions) {
  const canPlay = rawTracks.length > 0; // FR-4.14: 0曲は再生操作を無効化
  // 表示順のみアーティスト名順に並び替える（FR-2.11）。再生順（順序はtrackIds/rawTracks側）には影響しない。
  const tracks = sortTracksByArtist(rawTracks);
  // このプレイリストが今まさに再生中なら、以降の操作はミニプレイヤーに任せ「再生」ボタンは表示しない
  const showPlayButton = canPlay && !isCurrentlyPlaying;
  const heroArtwork = rawTracks[0]?.artwork || '';

  container.innerHTML = `
    <div class="detail-topbar">
      <button id="back-btn" class="icon-btn" aria-label="一覧へ戻る">${iconOnly('back')}</button>
      <div class="detail-topbar-actions">
        <button id="rename-btn" class="icon-btn" aria-label="名前を変更">${iconOnly('edit')}</button>
        <button id="delete-btn" class="icon-btn danger" aria-label="削除">${iconOnly('remove')}</button>
      </div>
    </div>

    <div class="hero">
      ${heroArtwork
        ? `<img src="${escapeHtml(largeArtworkUrl(heroArtwork))}" alt="" class="hero-artwork">`
        : `<div class="hero-artwork hero-artwork-placeholder">${iconOnly('disc')}</div>`}
      <h1 class="hero-name">${escapeHtml(playlist.name)}</h1>
      ${showPlayButton ? `
        <button id="play-start-btn" class="pill-play-btn" aria-label="再生">${iconOnly('play')}<span>再生</span></button>
      ` : ''}
    </div>

    ${fetchError
      ? `<p class="error-banner">通信エラー：曲情報を取得できませんでした（${escapeHtml(fetchError)}）。電波の良い場所で再度お試しください。</p>`
      : `<p class="note">
          ${playlist.trackIds.length}曲
          ${unavailableIds.length ? `（うち${unavailableIds.length}曲は取得できませんでした）` : ''}
        </p>`}

    <ul class="list">
      ${tracks.length === 0
        ? '<li class="empty">曲がまだ追加されていません。</li>'
        : tracks.map((t) => `
          <li class="list-item track-item">
            <button type="button" class="list-item-main track-play">
              <img src="${escapeHtml(t.artwork)}" alt="" class="artwork-sm">
              <div class="item-main">
                <div class="item-name">${escapeHtml(t.title)}</div>
                <div class="item-sub">${escapeHtml(t.artist)}</div>
              </div>
            </button>
            <button class="icon-btn danger track-remove" aria-label="削除">${iconOnly('remove')}</button>
          </li>
        `).join('')}
    </ul>
  `;

  container.querySelector('#back-btn').addEventListener('click', actions.onBack);

  container.querySelector('#rename-btn').addEventListener('click', async () => {
    const newName = await showPrompt({
      title: '名前を変更',
      defaultValue: playlist.name,
      confirmLabel: '変更する',
    });
    if (newName !== null && newName.trim()) actions.onRename(newName.trim());
  });
  container.querySelector('#delete-btn').addEventListener('click', async () => {
    const ok = await showConfirm({
      title: 'プレイリストを削除',
      message: `「${playlist.name}」を削除しますか？この操作は取り消せません。`,
      confirmLabel: '削除する',
      danger: true,
    });
    if (ok) actions.onDelete();
  });

  container.querySelectorAll('.track-item').forEach((li, i) => {
    const track = tracks[i];
    li.querySelector('.track-play').addEventListener('click', () => actions.onTrackTap(track.id));
    li.querySelector('.track-remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await showConfirm({
        title: '曲を削除',
        message: `「${track.title}」をプレイリストから削除しますか？`,
        confirmLabel: '削除する',
        danger: true,
      });
      if (ok) actions.onRemoveTrack(track.id);
    });
  });

  if (showPlayButton) {
    container.querySelector('#play-start-btn').addEventListener('click', actions.onStartPlayback);
  }
}
