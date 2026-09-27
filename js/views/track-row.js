// 検索結果・カートで共通して使う「曲1件分」の行（FR-1.2, FR-1.5, FR-1.12）。
// フリーワード検索・段階検索・カート表示のいずれからも使う共通部品。

import { iconLabel } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {{id, title, artist, album, artwork}} track
 * @param {number} index
 * @param {{checked?: boolean, disabledCheckbox?: boolean, addLabel?: string, addDisabled?: boolean}} [options]
 */
export function trackRowHtml(track, index, options = {}) {
  const { checked = false, disabledCheckbox = false, addLabel = '追加', addDisabled = false } = options;
  return `
    <li class="list-item track-item" data-index="${index}">
      <input type="checkbox" class="track-checkbox" data-index="${index}"
        ${checked ? 'checked' : ''} ${disabledCheckbox ? 'disabled' : ''}
        aria-label="カートに追加する曲として選択">
      <img src="${escapeHtml(track.artwork)}" alt="" class="artwork-sm">
      <div class="item-main">
        <div class="item-name">${escapeHtml(track.title)}</div>
        <div class="item-sub">${escapeHtml(track.artist)}${track.album ? ` / ${escapeHtml(track.album)}` : ''}</div>
      </div>
      <button type="button" class="icon-btn preview-btn" data-index="${index}">${iconLabel('play', '試聴')}</button>
      <button type="button" class="icon-btn add-btn" data-index="${index}" ${addDisabled ? 'disabled' : ''}>
        ${iconLabel(addDisabled ? 'added' : 'add', addLabel)}
      </button>
    </li>
  `;
}

/**
 * トラック行のイベント（試聴・追加・カートのチェック切り替え）を結びつける。
 * @param {HTMLElement} listEl trackRowHtmlをmapしたulなどの要素
 * @param {Array<object>} tracks
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer, onAdd: Function, onCheckToggle: Function}} handlers
 */
export function bindTrackRowEvents(listEl, tracks, { previewPlayer, onAdd, onCheckToggle }) {
  listEl.querySelectorAll('.preview-btn').forEach((btn) => {
    const track = tracks[Number(btn.dataset.index)];
    btn.addEventListener('click', () => {
      if (previewPlayer.isPlaying && previewPlayer.currentTrackId === track.id) {
        previewPlayer.stop();
        btn.innerHTML = btn.innerHTML.replace('停止', '試聴');
        return;
      }
      listEl.querySelectorAll('.preview-btn').forEach((b) => {
        b.innerHTML = b.innerHTML.replace('■ 停止', '試聴');
      });
      previewPlayer.play(track);
      btn.innerHTML = btn.innerHTML.replace('試聴', '■ 停止');
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
