// フェーズ7：「追加先のプレイリストを選ぶ」モーダル（FR-2.4, FR-1.13）。
// dialog.js と同じ、Promiseベースの独自オーバーレイ方式（ブラウザ標準confirmの代わり）。
// CR-028：dialog.jsのenqueueDialogを経由し、他のダイアログと同様に多重表示を防ぐ。
// フェーズ22（仕様見直し）：CR-025で導入した「前回と同じ／他を選ぶ」の2択ダイアログは廃止し、
// 常に全プレイリストの一覧を1画面で表示する。前回追加したプレイリストがあれば、一覧の先頭に
// 並べ替え、小さな「前回追加」ラベルを付けて目立たせる（選ぶ操作自体は他の行と同じ1タップ）。

import { enqueueDialog } from './dialog.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * プレイリスト一覧から選ぶモーダル本体（enqueueDialogの外側。showPlaylistPicker/showAddDestinationPickerの共通実装）。
 * @param {Array<{id: string, name: string, trackIds: Array}>} playlists
 * @param {string|null} lastUsedPlaylistId 指定があれば、その playlist を一覧の先頭へ並べ替えてラベルを付ける
 */
function openPickerList(playlists, lastUsedPlaylistId = null) {
  const ordered = lastUsedPlaylistId != null && playlists.some((m) => m.id === lastUsedPlaylistId)
    ? [
        playlists.find((m) => m.id === lastUsedPlaylistId),
        ...playlists.filter((m) => m.id !== lastUsedPlaylistId),
      ]
    : playlists;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true">
        <h2 class="dialog-title">追加先のプレイリストを選ぶ</h2>
        ${ordered.length === 0
          ? '<p class="dialog-message">プレイリストがまだありません。</p>'
          : `<ul class="list picker-list">
              ${ordered.map((m) => `
                <li class="list-item">
                  <button type="button" class="list-item-main playlist-picker-item" data-id="${escapeHtml(m.id)}">
                    ${m.id === lastUsedPlaylistId ? '<span class="picker-last-used-badge">前回追加</span>' : ''}
                    <span class="item-name">${escapeHtml(m.name)}</span>
                    <span class="item-sub">${m.trackIds.length}曲</span>
                  </button>
                </li>
              `).join('')}
            </ul>`}
        <div class="dialog-actions">
          <button type="button" class="dialog-btn dialog-cancel">キャンセル</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const finish = (id) => {
      overlay.remove();
      resolve(id);
    };
    overlay.querySelectorAll('.playlist-picker-item').forEach((btn) => {
      btn.addEventListener('click', () => finish(btn.dataset.id));
    });
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => finish(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
  });
}

/**
 * @param {Array<{id: string, name: string, trackIds: Array}>} playlists
 * @returns {Promise<string|null>} 選んだプレイリストID。キャンセル、またはプレイリストが0件の場合はnull
 */
export function showPlaylistPicker(playlists) {
  return enqueueDialog(() => openPickerList(playlists));
}

/**
 * 追加先を選ぶ（FR-2.4）。全プレイリストを一覧表示し、前回追加したプレイリストがあれば
 * 一覧の先頭に「前回追加」ラベル付きで表示する。
 * @param {Array<{id: string, name: string, trackIds: Array}>} playlists
 * @param {{lastUsedPlaylistId?: string|null}} [options]
 * @returns {Promise<string|null>}
 */
export function showAddDestinationPicker(playlists, options = {}) {
  const { lastUsedPlaylistId = null } = options;
  return enqueueDialog(() => openPickerList(playlists, lastUsedPlaylistId));
}
