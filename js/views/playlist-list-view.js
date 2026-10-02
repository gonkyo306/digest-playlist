// フェーズ3：プレイリスト一覧画面（起動後の最初の画面、FR-2.8）
// フェーズ21（CR-035）：名前変更・削除は、この一覧の各行からは行わず、詳細画面の右上で行う
// （FR-2.2, FR-2.3）。この画面の各行は、プレイリストを開くタップ操作のみを持つ（FR-2.9）。
// フェーズ22（仕様見直し・2026-09-28）：見出しをscreen-headerクラスで囲み、検索画面の見出しと
// 高さを揃えることで、直下の入力欄（検索語）の表示位置がタブ間でずれないようにする。
// フェーズ28（CR-043/045）：新規作成は右上の＋ボタンから専用画面（FR-2.17）へ遷移する方式に一本化。
// これまでの新規作成用インライン入力欄は、プレイリスト名で一覧を絞り込む検索ボックス（FR-2.18）に
// 転用した（検索ボタンは設置せず、入力するたびに動的に絞り込む。CR-046と対になる方針）。
// フェーズ39：曲名・曲数をインライン要素（span）で組んでいたため2行に積み上がらず、検索結果の行
// （div、2行積み）とタイトルの表示位置がずれる不具合を修正した。

import { iconOnly } from './icons.js';
import { blobToUrl } from '../blob-url-cache.js';
import { marqueeHtml, setupMarquees } from '../marquee.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * プレイリストの代表画像（FR-2.10と同じ優先順位で解決済みのもの）を、一覧行のジャケット画像として
 * 表示するHTMLを組み立てる（CR-055）。
 * @param {object} playlist
 * @param {{source: 'custom'|'track'|'none', blob?: Blob, url?: string}} [artwork]
 */
function playlistArtworkHtml(playlist, artwork) {
  if (artwork?.source === 'custom' && artwork.blob) {
    return `<img src="${escapeHtml(blobToUrl(playlist.id, artwork.blob))}" alt="" class="artwork-sm">`;
  }
  if (artwork?.source === 'track' && artwork.url) {
    return `<img src="${escapeHtml(artwork.url)}" alt="" class="artwork-sm">`;
  }
  return `<div class="artwork-sm hero-artwork-placeholder">${iconOnly('disc')}</div>`;
}

/**
 * @param {HTMLElement} container
 * @param {Array<object>} playlists 各要素はartwork（FR-2.10の優先順位で解決済み）を含む
 * @param {{onOpen: Function, onCreateNew: Function}} actions
 */
export function renderPlaylistList(container, playlists, actions) {
  let filterTerm = '';

  function matchingPlaylists() {
    const q = filterTerm.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }

  function renderList() {
    const shown = matchingPlaylists();
    const listEl = container.querySelector('#playlist-list');
    listEl.innerHTML = playlists.length === 0
      ? '<li class="empty">プレイリストがまだありません。</li>'
      : shown.length === 0
        ? '<li class="empty">該当するプレイリストがありません。</li>'
        : shown.map((m) => `
          <li class="list-item" data-id="${escapeHtml(m.id)}">
            <button class="list-item-main playlist-open" data-id="${escapeHtml(m.id)}">
              ${playlistArtworkHtml(m, m.artwork)}
              <div class="item-main">
                ${marqueeHtml(m.name)}
                <div class="item-sub">${m.trackIds.length}曲</div>
              </div>
            </button>
          </li>
        `).join('');
    // フェーズ42：プレイリスト名が1行に収まらないときは自動スクロールする
    setupMarquees(listEl);
    listEl.querySelectorAll('.playlist-open').forEach((btn) => {
      btn.addEventListener('click', () => actions.onOpen(btn.dataset.id));
    });
  }

  container.innerHTML = `
    <div class="screen-header">
      <h1>プレイリスト一覧</h1>
      <button type="button" id="create-playlist-btn" class="icon-btn" aria-label="プレイリストを作成">${iconOnly('add')}</button>
    </div>
    <div class="inline-form">
      <input type="text" id="playlist-search-term" placeholder="プレイリスト名で検索">
    </div>
    <ul class="list" id="playlist-list"></ul>
  `;

  container.querySelector('#create-playlist-btn').addEventListener('click', () => actions.onCreateNew());
  container.querySelector('#playlist-search-term').addEventListener('input', (e) => {
    filterTerm = e.target.value;
    renderList();
  });

  renderList();
}
