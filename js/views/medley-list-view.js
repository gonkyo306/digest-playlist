// フェーズ3：メドレー一覧画面（起動後の最初の画面、FR-2.8）
// メドレーの新規作成・名前変更・削除の導線もここに置く（FR-2.1, FR-2.2, FR-2.3）。

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {Array<object>} medleys
 * @param {{onOpen, onCreate, onRename, onDelete}} actions
 */
export function renderMedleyList(container, medleys, actions) {
  container.innerHTML = `
    <h1>メドレー一覧</h1>
    <form id="create-form" class="inline-form">
      <input type="text" id="new-medley-name" placeholder="新しいメドレー名" required maxlength="50">
      <button type="submit">作成</button>
    </form>
    <ul class="list">
      ${medleys.length === 0
        ? '<li class="empty">メドレーがまだありません。上のフォームから作成してください。</li>'
        : medleys.map((m) => `
          <li class="list-item" data-id="${escapeHtml(m.id)}">
            <button class="list-item-main medley-open" data-id="${escapeHtml(m.id)}">
              <span class="item-name">${escapeHtml(m.name)}</span>
              <span class="item-sub">${m.trackIds.length}曲</span>
            </button>
            <button class="icon-btn medley-rename" data-id="${escapeHtml(m.id)}" title="名前を変更">改名</button>
            <button class="icon-btn danger medley-delete" data-id="${escapeHtml(m.id)}" title="削除">削除</button>
          </li>
        `).join('')}
    </ul>
  `;

  container.querySelector('#create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = container.querySelector('#new-medley-name');
    const name = input.value.trim();
    if (!name) return;
    actions.onCreate(name);
  });

  container.querySelectorAll('.medley-open').forEach((btn) => {
    btn.addEventListener('click', () => actions.onOpen(btn.dataset.id));
  });
  container.querySelectorAll('.medley-rename').forEach((btn) => {
    btn.addEventListener('click', () => {
      const medley = medleys.find((m) => m.id === btn.dataset.id);
      const newName = prompt('新しい名前を入力してください', medley ? medley.name : '');
      if (newName && newName.trim()) actions.onRename(btn.dataset.id, newName.trim());
    });
  });
  container.querySelectorAll('.medley-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const medley = medleys.find((m) => m.id === btn.dataset.id);
      const label = medley ? `「${medley.name}」` : 'このメドレー';
      if (confirm(`${label}を削除しますか？この操作は取り消せません。`)) {
        actions.onDelete(btn.dataset.id);
      }
    });
  });
}
