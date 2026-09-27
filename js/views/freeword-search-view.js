// フェーズ9：フリーワード検索（曲名・アーティスト名・アルバム名、FR-1.1, FR-1.8）。
// 25件を超える分は、下端までスクロールすると自動で追加読み込みされる（FR-1.10）。

import { trackRowHtml, bindTrackRowEvents } from './track-row.js';

const PAGE_SIZE_FIRST = 25;
const PAGE_SIZE_MORE = 50;

/**
 * @param {HTMLElement} container
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer}} deps
 * @param {{onSearch: (term, offset, limit) => Promise<Array>, onAdd: Function, isInCart: Function, onToggleCart: Function}} actions
 */
export function renderFreewordSearch(container, { previewPlayer }, actions) {
  container.innerHTML = `
    <form id="freeword-form" class="inline-form">
      <input type="text" id="freeword-term" placeholder="曲名・アーティスト名・アルバム名" required>
      <button type="submit">検索</button>
    </form>
    <div id="freeword-status" class="note"></div>
    <ul class="list" id="freeword-results"></ul>
  `;

  const statusEl = container.querySelector('#freeword-status');
  const resultsEl = container.querySelector('#freeword-results');
  let tracks = [];
  let term = '';
  let hasMore = false;
  let loading = false;
  let observer = null;

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function renderList() {
    resultsEl.innerHTML = tracks
      .map((t, i) => trackRowHtml(t, i, { checked: actions.isInCart(t.id) }))
      .join('');
    bindTrackRowEvents(resultsEl, tracks, {
      previewPlayer,
      onAdd: (track) => actions.onAdd(track),
      onCheckToggle: (track, checked) => actions.onToggleCart(track, checked),
    });

    teardownObserver();
    if (hasMore && 'IntersectionObserver' in window) {
      const sentinel = document.createElement('li');
      sentinel.className = 'scroll-sentinel';
      resultsEl.appendChild(sentinel);
      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) loadMore();
      });
      observer.observe(sentinel);
    }
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    try {
      const more = await actions.onSearch(term, tracks.length, PAGE_SIZE_MORE);
      hasMore = more.length === PAGE_SIZE_MORE;
      tracks = tracks.concat(more);
      renderList();
    } catch {
      hasMore = false; // 追加読み込みに失敗しても、それまでの結果は表示し続ける
    } finally {
      loading = false;
    }
  }

  container.querySelector('#freeword-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    term = container.querySelector('#freeword-term').value.trim();
    if (!term) return;
    previewPlayer.stop();
    statusEl.textContent = '検索中…';
    resultsEl.innerHTML = '';
    teardownObserver();
    try {
      tracks = await actions.onSearch(term, 0, PAGE_SIZE_FIRST);
      hasMore = tracks.length === PAGE_SIZE_FIRST;
      if (tracks.length === 0) {
        statusEl.textContent = '該当する曲が見つかりませんでした。';
        return;
      }
      statusEl.textContent = `${tracks.length}件見つかりました`;
      renderList();
    } catch (err) {
      statusEl.textContent = `検索に失敗しました: ${err.message}`;
    }
  });
}
