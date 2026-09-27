// フェーズ7・9：検索タブ（FR-6.1）。
// 「フリーワード検索」「段階検索」の2モードを、検索タブ内のタブで切り替える（FR-1.8）。
// カート（FR-1.12, FR-1.13）の表示・切替もここでまとめて扱う。

import { renderFreewordSearch } from './freeword-search-view.js';
import { renderStagedSearch } from './staged-search-view.js';
import { renderCartView } from './cart-view.js';

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
  let showCart = false;

  container.innerHTML = `
    <h1>曲を検索</h1>
    <div class="search-mode-tabs">
      <button type="button" class="tab-btn search-mode-btn" data-mode="freeword">フリーワード検索</button>
      <button type="button" class="tab-btn search-mode-btn" data-mode="staged">段階検索</button>
      <button type="button" class="tab-btn cart-toggle-btn" id="cart-toggle">カート (<span id="cart-count">0</span>)</button>
    </div>
    <div id="search-body"></div>
  `;

  const bodyEl = container.querySelector('#search-body');
  const cartCountEl = container.querySelector('#cart-count');

  function updateCartCount() {
    cartCountEl.textContent = String(actions.cartCount());
  }

  function updateModeButtons() {
    container.querySelectorAll('.search-mode-btn').forEach((btn) => {
      btn.classList.toggle('active', !showCart && btn.dataset.mode === mode);
    });
    container.querySelector('#cart-toggle').classList.toggle('active', showCart);
  }

  async function renderBody() {
    updateModeButtons();
    updateCartCount();
    if (showCart) {
      bodyEl.innerHTML = '<p class="note">読み込み中…</p>';
      const cartTracks = await actions.getCartTracks();
      renderCartView(bodyEl, cartTracks, deps, {
        onRemove: (trackId) => {
          actions.onRemoveFromCart(trackId);
          renderBody();
        },
        onAddSelected: async (trackIds) => {
          await actions.onAddSelectedFromCart(trackIds);
          renderBody();
        },
      });
      return;
    }
    if (mode === 'freeword') {
      renderFreewordSearch(bodyEl, deps, {
        onSearch: actions.onSearchFreeword,
        onAdd: (track) => actions.onAddTrack(track),
        isInCart: actions.isInCart,
        onToggleCart: (track, checked) => {
          actions.onToggleCart(track, checked);
          updateCartCount();
        },
      });
    } else {
      renderStagedSearch(bodyEl, deps, {
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

  container.querySelectorAll('.search-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      showCart = false;
      renderBody();
    });
  });
  container.querySelector('#cart-toggle').addEventListener('click', () => {
    showCart = !showCart;
    renderBody();
  });

  renderBody();
}
