// フェーズ2：曲の検索画面（フェーズ3のメドレー詳細から「曲を追加」で遷移してくる）
// 検索（FR-1.1〜1.4, 1.7）・試聴（FR-1.5）・メドレーへの追加（FR-2.4, FR-2.6）をまとめて扱う。

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer}} deps
 * @param {{onBack, onSearch, onAdd, isDuplicate}} actions
 */
export function renderSearchView(container, { previewPlayer }, actions) {
  container.innerHTML = `
    <button id="back-btn" class="link-btn">← 戻る</button>
    <h1>曲を検索</h1>
    <form id="search-form" class="inline-form">
      <input type="text" id="search-term" placeholder="曲名・アーティスト名" required>
      <button type="submit">検索</button>
    </form>
    <div id="search-status" class="note"></div>
    <ul class="list" id="search-results"></ul>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    previewPlayer.stop();
    actions.onBack();
  });

  const statusEl = container.querySelector('#search-status');
  const resultsEl = container.querySelector('#search-results');

  container.querySelector('#search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const term = container.querySelector('#search-term').value.trim();
    if (!term) return;
    previewPlayer.stop();
    statusEl.textContent = '検索中…';
    resultsEl.innerHTML = '';
    try {
      const tracks = await actions.onSearch(term);
      if (tracks.length === 0) {
        statusEl.textContent = '該当する曲が見つかりませんでした。';
        return;
      }
      statusEl.textContent = `${tracks.length}件見つかりました`;
      await renderResults(tracks);
    } catch (err) {
      statusEl.textContent = `検索に失敗しました: ${err.message}`;
    }
  });

  async function renderResults(tracks) {
    const dupFlags = await Promise.all(tracks.map((t) => actions.isDuplicate(t.id)));
    resultsEl.innerHTML = tracks.map((t, i) => `
      <li class="list-item track-item" data-index="${i}">
        <img src="${escapeHtml(t.artwork)}" alt="" class="artwork-sm">
        <div class="item-main">
          <div class="item-name">${escapeHtml(t.title)}</div>
          <div class="item-sub">${escapeHtml(t.artist)}</div>
        </div>
        <button class="icon-btn preview-btn" data-index="${i}">試聴</button>
        <button class="icon-btn add-btn" data-index="${i}" ${dupFlags[i] ? 'disabled' : ''}>
          ${dupFlags[i] ? '追加済み' : '追加'}
        </button>
      </li>
    `).join('');

    resultsEl.querySelectorAll('.preview-btn').forEach((btn) => {
      const track = tracks[Number(btn.dataset.index)];
      btn.addEventListener('click', () => {
        if (previewPlayer.isPlaying && previewPlayer.currentTrackId === track.id) {
          previewPlayer.stop();
          btn.textContent = '試聴';
          return;
        }
        resultsEl.querySelectorAll('.preview-btn').forEach((b) => (b.textContent = '試聴'));
        previewPlayer.play(track);
        btn.textContent = '■ 停止';
      });
    });

    resultsEl.querySelectorAll('.add-btn').forEach((btn) => {
      const track = tracks[Number(btn.dataset.index)];
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const added = await actions.onAdd(track.id);
        btn.textContent = added ? '追加済み' : '追加済み';
      });
    });
  }
}
