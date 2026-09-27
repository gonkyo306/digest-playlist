// フェーズ7：アプリ全体の「メドレー」「検索」タブ（FR-6.1）。
// この切替はFR-1.8の検索モード内タブとは別の、画面全体のタブ構成。

/**
 * @param {HTMLElement} container タブバー専用のコンテナ
 * @param {'medley'|'search'} activeTab
 * @param {(tab: 'medley'|'search') => void} onSelect
 */
export function renderTabBar(container, activeTab, onSelect) {
  container.innerHTML = `
    <nav class="tab-bar">
      <button type="button" class="tab-btn ${activeTab === 'medley' ? 'active' : ''}" data-tab="medley">メドレー</button>
      <button type="button" class="tab-btn ${activeTab === 'search' ? 'active' : ''}" data-tab="search">検索</button>
    </nav>
  `;
  container.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.tab));
  });
}
