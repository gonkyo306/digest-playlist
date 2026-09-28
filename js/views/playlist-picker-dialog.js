// フェーズ7：「追加先のプレイリストを選ぶ」モーダル（FR-2.4, FR-1.13）。
// dialog.js と同じ、Promiseベースの独自オーバーレイ方式（ブラウザ標準confirmの代わり）。
// CR-028：dialog.jsのenqueueDialogを経由し、他のダイアログと同様に多重表示を防ぐ。
// CR-025：直前に追加した先のプレイリストがあれば、モーダルを開かずに「前回と同じ」へ
// 追加できるショートカットを先に提示する（別のプレイリストを選びたい場合は、通常の一覧を開ける）。

import { enqueueDialog } from './dialog.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** プレイリスト一覧から選ぶモーダル本体（enqueueDialogの外側。内部からの再利用のためexportしない） */
function openPickerList(playlists) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true">
        <h2 class="dialog-title">追加先のプレイリストを選ぶ</h2>
        ${playlists.length === 0
          ? '<p class="dialog-message">プレイリストがまだありません。</p>'
          : `<ul class="list picker-list">
              ${playlists.map((m) => `
                <li class="list-item">
                  <button type="button" class="list-item-main playlist-picker-item" data-id="${escapeHtml(m.id)}">
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
 * 追加先の選び方（CR-025）：前回追加したプレイリストがあれば、まず「前回と同じ」ショートカットを
 * 提示し、別のプレイリストを選びたい場合のみ通常の一覧モーダルを開く。
 * 前回の追加先がない、またはそのプレイリストが既に削除されている場合は、通常の一覧を直接開く。
 * @param {Array<{id: string, name: string, trackIds: Array}>} playlists
 * @param {{lastUsedPlaylistId?: string|null}} [options]
 * @returns {Promise<string|null>}
 */
export function showAddDestinationPicker(playlists, options = {}) {
  const { lastUsedPlaylistId = null } = options;
  const lastUsed = lastUsedPlaylistId != null
    ? playlists.find((m) => m.id === lastUsedPlaylistId)
    : null;

  if (!lastUsed) {
    return enqueueDialog(() => openPickerList(playlists));
  }

  return enqueueDialog(() => new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true">
        <h2 class="dialog-title">追加先を選ぶ</h2>
        <button type="button" class="playlist-picker-shortcut" id="shortcut-btn">前回と同じ「${escapeHtml(lastUsed.name)}」へ追加</button>
        <button type="button" class="dialog-btn" id="other-btn">他のプレイリストを選ぶ</button>
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
    overlay.querySelector('#shortcut-btn').addEventListener('click', () => finish(lastUsed.id));
    overlay.querySelector('#other-btn').addEventListener('click', () => {
      overlay.remove();
      // 既にenqueueDialogのキュー内なので、ここでは直接openPickerListを呼ぶ（再度キューに並べない）
      openPickerList(playlists).then(resolve);
    });
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => finish(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
  }));
}
