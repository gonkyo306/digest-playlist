// フェーズ3：プレイリスト一覧画面（起動後の最初の画面、FR-2.8）
// プレイリストの新規作成の導線をここに置く（FR-2.1）。
// CR-029：プレイリストが0件のとき、新規作成の入力欄に自動でフォーカスする（FR-2.12）
// フェーズ21（CR-035）：名前変更・削除は、この一覧の各行からは行わず、詳細画面の右上で行う
// （FR-2.2, FR-2.3）。この画面の各行は、プレイリストを開くタップ操作のみを持つ（FR-2.9）。
// フェーズ22（仕様見直し・2026-09-28）：見出しをscreen-headerクラスで囲み、検索画面の見出しと
// 高さを揃えることで、直下の入力欄（新規作成／検索語）の表示位置がタブ間でずれないようにする。

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {Array<object>} playlists
 * @param {{onOpen, onCreate}} actions
 */
export function renderPlaylistList(container, playlists, actions) {
  container.innerHTML = `
    <div class="screen-header">
      <h1>プレイリスト一覧</h1>
    </div>
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
          </li>
        `).join('')}
    </ul>
  `;

  if (playlists.length === 0) {
    container.querySelector('#new-playlist-name').focus();
  }

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
}
