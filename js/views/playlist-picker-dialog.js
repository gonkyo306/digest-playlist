// フェーズ7：「追加先のプレイリストを選ぶ」モーダル（FR-2.4, FR-1.13）。
// dialog.js と同じ、Promiseベースの独自オーバーレイ方式（ブラウザ標準confirmの代わり）。

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {Array<{id: string, name: string, trackIds: Array}>} playlists
 * @returns {Promise<string|null>} 選んだプレイリストID。キャンセル、またはプレイリストが0件の場合はnull
 */
export function showPlaylistPicker(playlists) {
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
