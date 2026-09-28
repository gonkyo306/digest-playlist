// フェーズ3：プレイリスト詳細画面（曲一覧の表示。FR-2.9, FR-2.5）
// フェーズ7：「＋曲を追加」導線は廃止（検索タブから追加する。FR-2.4）
// フェーズ11：曲一覧はアーティスト名順で表示（FR-2.11）。操作ボタンはアイコン表示（FR-5.3）
// CR-011：削除・戻るボタンはアイコンのみ（テキストラベルなし）に変更
// フェーズ14（CR-016）：インライン再生パネルを廃止。再生前は「再生」ボタンのみを表示し、
// 再生後の操作（一時停止・前へ・次へ）はミニプレイヤーに集約する（js/app.js側）。
// フェーズ14（CR-022）：現在再生中の曲の行を強調表示する（updateNowPlayingTrack）。

import { showConfirm } from './dialog.js';
import { sortTracksByArtist } from '../playlist-sort.js';
import { iconOnly } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 曲一覧の1行が「現在再生中」として強調表示の対象かどうかを判定する（CR-022）。
 * IDの型（文字列/数値）が揺れても一致判定できるよう、文字列化して比較する。
 * @param {{id: string|number}} track
 * @param {string|number|null} nowPlayingTrackId
 */
export function isNowPlayingRow(track, nowPlayingTrackId) {
  if (nowPlayingTrackId == null || !track) return false;
  return String(track.id) === String(nowPlayingTrackId);
}

/**
 * @param {HTMLElement} container
 * @param {{playlist: object, tracks: Array<object>, unavailableIds: Array, fetchError?: string,
 *   isCurrentlyPlaying?: boolean, nowPlayingTrackId?: string|number|null}} data
 * @param {{onBack, onRemoveTrack, onStartPlayback}} actions
 */
export function renderPlaylistDetail(container, {
  playlist, tracks: rawTracks, unavailableIds, fetchError, isCurrentlyPlaying = false, nowPlayingTrackId = null,
}, actions) {
  const canPlay = rawTracks.length > 0; // FR-4.14: 0曲は再生操作を無効化
  // 表示順のみアーティスト名順に並び替える（FR-2.11）。再生順（順序はtrackIds/rawTracks側）には影響しない。
  const tracks = sortTracksByArtist(rawTracks);
  // このプレイリストが今まさに再生中なら、以降の操作はミニプレイヤーに任せ「再生」ボタンは表示しない
  const showPlayButton = canPlay && !isCurrentlyPlaying;

  container.innerHTML = `
    <button id="back-btn" class="icon-btn" aria-label="一覧へ戻る">${iconOnly('back')}</button>
    <h1>${escapeHtml(playlist.name)}</h1>
    ${fetchError
      ? `<p class="error-banner">通信エラー：曲情報を取得できませんでした（${escapeHtml(fetchError)}）。電波の良い場所で再度お試しください。</p>`
      : `<p class="note">
          ${playlist.trackIds.length}曲
          ${unavailableIds.length ? `（うち${unavailableIds.length}曲は取得できませんでした）` : ''}
        </p>`}

    ${showPlayButton ? `
      <button id="play-start-btn" class="icon-btn primary" aria-label="再生">${iconOnly('play')}</button>
    ` : ''}

    <ul class="list">
      ${tracks.length === 0
        ? '<li class="empty">曲がまだ追加されていません。</li>'
        : tracks.map((t) => `
          <li class="list-item track-item${isNowPlayingRow(t, nowPlayingTrackId) ? ' now-playing' : ''}" data-track-id="${escapeHtml(String(t.id))}">
            <img src="${escapeHtml(t.artwork)}" alt="" class="artwork-sm">
            <div class="item-main">
              <div class="item-name">${escapeHtml(t.title)}</div>
              <div class="item-sub">${escapeHtml(t.artist)}</div>
            </div>
            <button class="icon-btn danger track-remove" aria-label="削除">${iconOnly('remove')}</button>
          </li>
        `).join('')}
    </ul>
  `;

  container.querySelector('#back-btn').addEventListener('click', actions.onBack);

  container.querySelectorAll('.track-item').forEach((li, i) => {
    const track = tracks[i];
    li.querySelector('.track-remove').addEventListener('click', async () => {
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

/**
 * 曲一覧の「現在再生中」行の強調表示だけを更新する（CR-022）。
 * 画面全体を再描画するとちらつきが発生するため、行のクラス付け替えのみ行う。
 * @param {HTMLElement} container renderPlaylistDetailを呼んだのと同じcontainer
 * @param {string|number|null} trackId 再生中の曲ID（再生していなければnull）
 */
export function updateNowPlayingTrack(container, trackId) {
  container.querySelectorAll('.track-item.now-playing').forEach((el) => el.classList.remove('now-playing'));
  if (trackId == null) return;
  const target = String(trackId);
  container.querySelectorAll('.track-item[data-track-id]').forEach((el) => {
    if (el.dataset.trackId === target) el.classList.add('now-playing');
  });
}
