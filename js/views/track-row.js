// 検索結果で共通して使う行テンプレート（FR-1.2, FR-1.5, FR-1.12, FR-1.13）。
// 統合検索結果（曲・アーティスト・アルバム混在、CR-017）・アルバム収録曲一覧のいずれからも使う。
// CR-011：試聴・追加ボタンはアイコンのみ（テキストラベルなし）。
// CR-021/024：カート機能は廃止し、チェックボックスはその場での複数選択（一括追加）用として使う。
// CR-026：行の種別（曲／アーティスト／アルバム）をアイコンで示す。

import { iconOnly, typeIcon } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 曲1件分の行（チェックボックスで複数選択→一括追加、試聴ボタン付き）。
 * @param {{id, title, artist, album, artwork}} track
 * @param {number} index
 * @param {{checked?: boolean, showPreview?: boolean}} [options]
 */
export function trackRowHtml(track, index, options = {}) {
  const { checked = false, showPreview = true } = options;
  return `
    <li class="list-item track-item" data-index="${index}">
      <input type="checkbox" class="track-checkbox" data-index="${index}"
        ${checked ? 'checked' : ''}
        aria-label="一括追加する曲として選択">
      ${typeIcon('track')}
      <img src="${escapeHtml(track.artwork)}" alt="" class="artwork-sm">
      <div class="item-main">
        <div class="item-name">${escapeHtml(track.title)}</div>
        <div class="item-sub">${escapeHtml(track.artist)}${track.album ? ` / ${escapeHtml(track.album)}` : ''}</div>
      </div>
      ${showPreview
        ? `<button type="button" class="icon-btn preview-btn" data-index="${index}" aria-label="試聴">${iconOnly('play')}</button>`
        : ''}
    </li>
  `;
}

/**
 * 段階検索のアルバム曲一覧で使う、番号＋曲名だけの簡易行（CR-013）。
 * ジャケット・アーティスト名・アルバム名は、一覧の外側（アルバム情報欄）に1回だけ表示する前提で省く。
 * @param {{id, title}} track
 * @param {number} index
 * @param {{checked?: boolean}} [options]
 */
export function compactTrackRowHtml(track, index, options = {}) {
  const { checked = false } = options;
  return `
    <li class="list-item track-item track-item-compact" data-index="${index}">
      <input type="checkbox" class="track-checkbox" data-index="${index}"
        ${checked ? 'checked' : ''} aria-label="一括追加する曲として選択">
      <span class="track-number">${index + 1}.</span>
      <div class="item-main">
        <div class="item-name">${escapeHtml(track.title)}</div>
      </div>
      <button type="button" class="icon-btn preview-btn" data-index="${index}" aria-label="試聴">${iconOnly('play')}</button>
    </li>
  `;
}

/**
 * アーティスト1件分の行（CR-017：タップでそのアーティストのアルバム一覧へドリルダウン）。
 * @param {{id, name}} artist
 * @param {number} index
 */
export function artistRowHtml(artist, index) {
  return `
    <li class="list-item" data-index="${index}">
      <button type="button" class="list-item-main result-artist-open" data-index="${index}">
        ${typeIcon('artist')}
        <span class="item-name">${escapeHtml(artist.name)}</span>
      </button>
    </li>
  `;
}

/**
 * アルバム1件分の行（CR-017：タップでそのアルバムの収録曲一覧へドリルダウン）。
 * @param {{id, name, artist, artwork}} album
 * @param {number} index
 */
export function albumRowHtml(album, index) {
  return `
    <li class="list-item" data-index="${index}">
      <button type="button" class="list-item-main result-album-open" data-index="${index}">
        ${typeIcon('album')}
        <img src="${escapeHtml(album.artwork)}" alt="" class="artwork-sm">
        <div class="item-main">
          <div class="item-name">${escapeHtml(album.name)}</div>
          <div class="item-sub">${escapeHtml(album.artist)}</div>
        </div>
      </button>
    </li>
  `;
}

/**
 * トラック行のイベント（試聴・チェック切り替え）を結びつける。
 * @param {HTMLElement} listEl trackRowHtml/compactTrackRowHtmlをmapしたulなどの要素
 * @param {Array<object>} tracks
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer, onCheckToggle: Function}} handlers
 */
export function bindTrackRowEvents(listEl, tracks, { previewPlayer, onCheckToggle }) {
  function setPreviewIcon(btn, playing) {
    btn.innerHTML = iconOnly(playing ? 'pause' : 'play');
    btn.setAttribute('aria-label', playing ? '停止' : '試聴');
  }

  listEl.querySelectorAll('.preview-btn').forEach((btn) => {
    const track = tracks[Number(btn.dataset.index)];
    btn.addEventListener('click', () => {
      if (previewPlayer.isPlaying && previewPlayer.currentTrackId === track.id) {
        previewPlayer.stop();
        setPreviewIcon(btn, false);
        return;
      }
      listEl.querySelectorAll('.preview-btn').forEach((b) => setPreviewIcon(b, false));
      previewPlayer.play(track);
      setPreviewIcon(btn, true);
    });
  });

  listEl.querySelectorAll('.track-checkbox').forEach((checkbox) => {
    const track = tracks[Number(checkbox.dataset.index)];
    checkbox.addEventListener('change', () => onCheckToggle(track, checkbox.checked));
  });
}

/**
 * アーティスト行のドリルダウンイベントを結びつける。
 * @param {HTMLElement} listEl
 * @param {Array<object>} artists
 * @param {(artist: object) => void} onOpen
 */
export function bindArtistRowEvents(listEl, artists, onOpen) {
  listEl.querySelectorAll('.result-artist-open').forEach((btn) => {
    const artist = artists[Number(btn.dataset.index)];
    btn.addEventListener('click', () => onOpen(artist));
  });
}

/**
 * アルバム行のドリルダウンイベントを結びつける。
 * @param {HTMLElement} listEl
 * @param {Array<object>} albums
 * @param {(album: object) => void} onOpen
 */
export function bindAlbumRowEvents(listEl, albums, onOpen) {
  listEl.querySelectorAll('.result-album-open').forEach((btn) => {
    const album = albums[Number(btn.dataset.index)];
    btn.addEventListener('click', () => onOpen(album));
  });
}
