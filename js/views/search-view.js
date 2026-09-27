// フェーズ7・9：検索タブ（FR-6.1）。
// 「フリーワード検索」「段階検索」の2モードを、検索タブ内のタブで切り替える（FR-1.8）。
// 追加楽曲リスト（旧称：カート、FR-1.12, FR-1.13, CR-014）は、検索モードのタブとは独立させ、
// 右上のボタンから開くオーバーレイパネルとして表示する。
// CR-015：追加楽曲リストを開いても、検索モードの表示（結果一覧・段階検索の状態）のDOMは
// 破棄しない（別々のコンテナに分けて、パネルの開閉ではモード側を再描画しない）ため、
// 追加楽曲リストから戻っても検索状態が保持される。

import { renderFreewordSearch } from './freeword-search-view.js';
import { renderStagedSearch } from './staged-search-view.js';
import { renderCartView } from './cart-view.js';
import { iconOnly } from './icons.js';

/**
 * @param {HTMLElement} container
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer}} deps
 * @param {{
 *   onSearchFreeword, onSearchArtists, onArtistAlbums, onAlbumTracks,
 *   onAddTrack, isInCart, onToggleCart, onPlayAlbum,
 *   getCartTracks: () => Promise<Array>, onRemoveFromCart, onAddSelectedFromCart,
 *   cartCount: () => number,
 * }} actions
 */
export function renderSearchView(container, deps, actions) {
  let mode = 'freeword'; // 'freeword' | 'staged'

  container.innerHTML = `
    <div class="search-header">
      <h1>曲を検索</h1>
      <button type="button" class="cart-fab" id="cart-toggle" aria-label="追加楽曲リストを開く">
        ${iconOnly('cart')}<span id="cart-count" class="cart-fab-count">0</span>
      </button>
    </div>
    <div class="search-mode-tabs">
      <button type="button" class="tab-btn search-mode-btn" data-mode="freeword">フリーワード検索</button>
      <button type="button" class="tab-btn search-mode-btn" data-mode="staged">段階検索</button>
    </div>
    <div id="search-mode-body"></div>
    <div id="cart-panel" class="cart-panel">
      <div class="cart-panel-header">
        <h2>追加楽曲リスト</h2>
        <button type="button" class="icon-btn" id="cart-close" aria-label="閉じる">${iconOnly('back')}</button>
      </div>
      <div id="cart-panel-body"></div>
    </div>
  `;

  const modeBodyEl = container.querySelector('#search-mode-body');
  const cartPanelEl = container.querySelector('#cart-panel');
  const cartPanelBodyEl = container.querySelector('#cart-panel-body');
  const cartCountEl = container.querySelector('#cart-count');

  function updateCartCount() {
    cartCountEl.textContent = String(actions.cartCount());
  }

  function updateModeButtons() {
    container.querySelectorAll('.search-mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  function renderModeBody() {
    updateModeButtons();
    if (mode === 'freeword') {
      renderFreewordSearch(modeBodyEl, deps, {
        onSearch: actions.onSearchFreeword,
        onAdd: (track) => actions.onAddTrack(track),
        isInCart: actions.isInCart,
        onToggleCart: (track, checked) => {
          actions.onToggleCart(track, checked);
          updateCartCount();
        },
      });
    } else {
      renderStagedSearch(modeBodyEl, deps, {
        onSearchArtists: actions.onSearchArtists,
        onArtistAlbums: actions.onArtistAlbums,
        onAlbumTracks: actions.onAlbumTracks,
        onAdd: (track) => actions.onAddTrack(track),
        isInCart: actions.isInCart,
        onToggleCart: (track, checked) => {
          actions.onToggleCart(track, checked);
          updateCartCount();
        },
        onPlayAlbum: actions.onPlayAlbum,
      });
    }
  }

  async function renderCartPanel() {
    updateCartCount();
    cartPanelBodyEl.innerHTML = '<p class="note">読み込み中…</p>';
    const cartTracks = await actions.getCartTracks();
    renderCartView(cartPanelBodyEl, cartTracks, deps, {
      onRemove: (trackId) => {
        actions.onRemoveFromCart(trackId);
        renderCartPanel();
      },
      onAddSelected: async (trackIds) => {
        await actions.onAddSelectedFromCart(trackIds);
        renderCartPanel();
      },
    });
  }

  container.querySelectorAll('.search-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === mode) return;
      mode = btn.dataset.mode;
      renderModeBody();
    });
  });

  container.querySelector('#cart-toggle').addEventListener('click', () => {
    cartPanelEl.classList.add('open');
    renderCartPanel();
  });
  container.querySelector('#cart-close').addEventListener('click', () => {
    cartPanelEl.classList.remove('open');
  });

  updateCartCount();
  renderModeBody();
}
