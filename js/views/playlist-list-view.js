// フェーズ3：プレイリスト一覧画面（起動後の最初の画面、FR-2.8）
// プレイリストの新規作成・名前変更・削除の導線もここに置く（FR-2.1, FR-2.2, FR-2.3）。
// CR-011：改名・削除ボタンはアイコンのみ（テキストラベルなし）に変更

import { showConfirm, showPrompt } from './dialog.js';
import { iconOnly } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {Array<object>} playlists
 * @param {{onOpen, onCreate, onRename, onDelete}} actions
 */
export function renderPlaylistList(container, playlists, actions) {
  container.innerHTML = `
    <h1>プレイリスト一覧</h1>
    <form id="create-form" class="inline-form">
      <input type="text" id="new-playlist-name" placeholder="新しいプレイリスト名" required maxlength="50">
      <button type="submit">作成</button>
    </form>
    <ul class="list">
      ${playlists.length === 0
        ? '<li class="empty">プレイリストがまだありません。</li>'
        : playlists.map((m) => `
          <li class="list-item" data-id="${escapeHtml(m.id)}">
            <button class="list-item-main playlist-open" data-id="${escapeHtml(m.id)}">
              <span class="item-name">${escapeHtml(m.name)}</span>
              <span class="item-sub">${m.trackIds.length}曲</span>
            </button>
            <button class="icon-btn playlist-rename" data-id="${escapeHtml(m.id)}" aria-label="名前を変更">${iconOnly('edit')}</button>
            <button class="icon-btn danger playlist-delete" data-id="${escapeHtml(m.id)}" aria-label="削除">${iconOnly('remove')}</button>
          </li>
        `).join('')}
    </ul>
  `;

  container.querySelector('#create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = container.querySelector('#new-playlist-name');
    const name = input.value.trim();
    if (!name) return;
    actions.onCreate(name);
  });

  container.querySelectorAll('.playlist-open').forEach((btn) => {
    btn.addEventListener('click', () => actions.onOpen(btn.dataset.id));
  });
  container.querySelectorAll('.playlist-rename').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const playlist = playlists.find((m) => m.id === btn.dataset.id);
      const newName = await showPrompt({
        title: '名前を変更',
        defaultValue: playlist ? playlist.name : '',
        confirmLabel: '変更する',
      });
      if (newName !== null && newName.trim()) actions.onRename(btn.dataset.id, newName.trim());
    });
  });
  container.querySelectorAll('.playlist-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const playlist = playlists.find((m) => m.id === btn.dataset.id);
      const label = playlist ? `「${playlist.name}」` : 'このプレイリスト';
      const ok = await showConfirm({
        title: 'プレイリストを削除',
        message: `${label}を削除しますか？この操作は取り消せません。`,
        confirmLabel: '削除する',
        danger: true,
      });
      if (ok) actions.onDelete(btn.dataset.id);
    });
  });
}
