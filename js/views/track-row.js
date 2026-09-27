// 検索結果・カートで共通して使う「曲1件分」の行（FR-1.2, FR-1.5, FR-1.12）。
// フリーワード検索・段階検索・カート表示のいずれからも使う共通部品。
// CR-011：試聴・追加（削除）ボタンはアイコンのみ（テキストラベルなし）。

import { iconOnly } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {{id, title, artist, album, artwork}} track
 * @param {number} index
 * @param {{
 *   checked?: boolean, disabledCheckbox?: boolean, showPreview?: boolean,
 *   actionIcon?: string, actionAriaLabel?: string, actionDisabled?: boolean,
 * }} [options]
 */
export function trackRowHtml(track, index, options = {}) {
  const {
    checked = false,
    disabledCheckbox = false,
    showPreview = true,
    actionIcon = 'add',
    actionAriaLabel = '追加',
    actionDisabled = false,
  } = options;
  return `
    <li class="list-item track-item" data-index="${index}">
      <input type="checkbox" class="track-checkbox" data-index="${index}"
        ${checked ? 'checked' : ''} ${disabledCheckbox ? 'disabled' : ''}
        aria-label="追加楽曲リストに追加する曲として選択">
      <img src="${escapeHtml(track.artwork)}" alt="" class="artwork-sm">
      <div class="item-main">
        <div class="item-name">${escapeHtml(track.title)}</div>
        <div class="item-sub">${escapeHtml(track.artist)}${track.album ? ` / ${escapeHtml(track.album)}` : ''}</div>
      </div>
      ${showPreview
        ? `<button type="button" class="icon-btn preview-btn" data-index="${index}" aria-label="試聴">${iconOnly('play')}</button>`
        : ''}
      <button type="button" class="icon-btn add-btn" data-index="${index}"
        aria-label="${actionDisabled ? '追加済み' : actionAriaLabel}" ${actionDisabled ? 'disabled' : ''}>
        ${iconOnly(actionDisabled ? 'added' : actionIcon)}
      </button>
    </li>
  `;
}

/**
 * 段階検索のアルバム曲一覧で使う、番号＋曲名だけの簡易行（CR-013）。
 * ジャケット・アーティスト名・アルバム名は、一覧の外側（アルバム情報欄）に1回だけ表示する前提で省く。
 * @param {{id, title}} track
 * @param {number} index
 * @param {{checked?: boolean, actionDisabled?: boolean}} [options]
 */
export function compactTrackRowHtml(track, index, options = {}) {
  const { checked = false, actionDisabled = false } = options;
  return `
    <li class="list-item track-item track-item-compact" data-index="${index}">
      <input type="checkbox" class="track-checkbox" data-index="${index}"
        ${checked ? 'checked' : ''} aria-label="追加楽曲リストに追加する曲として選択">
      <span class="track-number">${index + 1}.</span>
      <div class="item-main">
        <div class="item-name">${escapeHtml(track.title)}</div>
      </div>
      <button type="button" class="icon-btn preview-btn" data-index="${index}" aria-label="試聴">${iconOnly('play')}</button>
      <button type="button" class="icon-btn add-btn" data-index="${index}"
        aria-label="${actionDisabled ? '追加済み' : '追加'}" ${actionDisabled ? 'disabled' : ''}>
        ${iconOnly(actionDisabled ? 'added' : 'add')}
      </button>
    </li>
  `;
}

/**
 * トラック行のイベント（試聴・追加/削除・チェック切り替え）を結びつける。
 * @param {HTMLElement} listEl trackRowHtmlをmapしたulなどの要素
 * @param {Array<object>} tracks
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer, onAdd: Function, onCheckToggle: Function}} handlers
 */
export function bindTrackRowEvents(listEl, tracks, { previewPlayer, onAdd, onCheckToggle }) {
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

  listEl.querySelectorAll('.add-btn').forEach((btn) => {
    if (btn.disabled) return;
    const track = tracks[Number(btn.dataset.index)];
    btn.addEventListener('click', () => onAdd(track));
  });

  listEl.querySelectorAll('.track-checkbox').forEach((checkbox) => {
    if (checkbox.disabled) return;
    const track = tracks[Number(checkbox.dataset.index)];
    checkbox.addEventListener('change', () => onCheckToggle(track, checkbox.checked));
  });
}
