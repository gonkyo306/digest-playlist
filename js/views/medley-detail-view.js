// フェーズ3：メドレー詳細画面（曲一覧の表示、「曲を追加」導線。FR-2.9, FR-2.4, FR-2.5）

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{medley: object, tracks: Array<object>, unavailableIds: Array}} data
 * @param {{onBack, onAddTrack, onRemoveTrack}} actions
 */
export function renderMedleyDetail(container, { medley, tracks, unavailableIds }, actions) {
  container.innerHTML = `
    <button id="back-btn" class="link-btn">← 一覧へ戻る</button>
    <h1>${escapeHtml(medley.name)}</h1>
    <p class="note">
      ${medley.trackIds.length}曲
      ${unavailableIds.length ? `（うち${unavailableIds.length}曲は取得できませんでした）` : ''}
    </p>
    <button id="add-track-btn" class="primary">＋ 曲を追加</button>
    <ul class="list">
      ${tracks.length === 0
        ? '<li class="empty">曲がまだ追加されていません。「曲を追加」から検索してください。</li>'
        : tracks.map((t) => `
          <li class="list-item track-item">
            <img src="${escapeHtml(t.artwork)}" alt="" class="artwork-sm">
            <div class="item-main">
              <div class="item-name">${escapeHtml(t.title)}</div>
              <div class="item-sub">${escapeHtml(t.artist)}</div>
            </div>
            <button class="icon-btn danger track-remove" title="削除">削除</button>
          </li>
        `).join('')}
    </ul>
  `;

  container.querySelector('#back-btn').addEventListener('click', actions.onBack);
  container.querySelector('#add-track-btn').addEventListener('click', actions.onAddTrack);

  container.querySelectorAll('.track-item').forEach((li, i) => {
    const track = tracks[i];
    li.querySelector('.track-remove').addEventListener('click', () => {
      if (confirm(`「${track.title}」をメドレーから削除しますか？`)) {
        actions.onRemoveTrack(track.id);
      }
    });
  });
}
