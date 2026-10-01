// フェーズ7：アプリ全体の「プレイリスト」「検索」タブ（FR-6.1）。
// この切替はFR-1.8の検索モード内タブとは別の、画面全体のタブ構成。
// フェーズ37（CR-072）：日本語ラベルの上にアイコンを添える（カード等の背景は付けず、
// アイコン単体で表示する）。ラベルの文言自体は変更しない。

import { iconOnly } from './icons.js';

/**
 * @param {HTMLElement} container タブバー専用のコンテナ
 * @param {'playlist'|'search'} activeTab
 * @param {(tab: 'playlist'|'search') => void} onSelect
 */
export function renderTabBar(container, activeTab, onSelect) {
  container.innerHTML = `
    <nav class="tab-bar">
      <button type="button" class="tab-btn ${activeTab === 'playlist' ? 'active' : ''}" data-tab="playlist">${iconOnly('note')}<span>プレイリスト</span></button>
      <button type="button" class="tab-btn ${activeTab === 'search' ? 'active' : ''}" data-tab="search">${iconOnly('search')}<span>検索</span></button>
    </nav>
  `;
  container.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.tab));
  });
}
