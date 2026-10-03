// プレイリスト一覧画面（起動後の最初の画面、FR-2.8）
// 名前変更・削除は、この一覧の各行からは行わず、詳細画面の右上で行う（FR-2.2, FR-2.3）。
// 各行は、プレイリストを開くタップ操作と、行の右端の再生ボタン（詳細画面を開かずにシャッフル再生。
// FR-2.9）を持つ。再生ボタンは常に「再生」の表示で、再生中に押すと最初から再生し直す
// （一時停止はミニプレイヤーで行う）。先頭には、前回再生したプレイリストのカード（FR-2.20）を出す。
// 見出しをscreen-headerクラスで囲み、検索画面の見出しと高さを揃えることで、直下の入力欄（検索語）の
// 表示位置がタブ間でずれないようにする。
// 新規作成は右上の＋ボタンから専用画面（FR-2.17）へ遷移する。入力欄は、プレイリスト名で一覧を
// 絞り込む検索ボックス（FR-2.18。検索ボタンは無く、入力するたびに動的に絞り込む）。
// プレイリスト名・曲数は、検索結果の行（曲名・アーティスト名）と同じ、2行に積んだdivで組み、
// タイトルの表示位置を揃える。

import { iconOnly } from './icons.js';
import { blobToUrl } from '../blob-url-cache.js';
import { marqueeHtml, setupMarquees } from '../marquee.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * プレイリストの代表画像（FR-2.10と同じ優先順位で解決済みのもの）を、一覧行のジャケット画像として
 * 表示するHTMLを組み立てる。
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
 * 再生ボタン・カードの再生ボタンの有効／無効と、再生開始待ち中の表示を更新する。
 * 表示は常に「再生」で、再生中かどうかでは変えない。
 * @param {HTMLElement} container
 * @param {Array<object>} playlists
 * @param {Set<string>} busyIds 再生を開始する処理の待ち中のプレイリストID
 */
function applyPlayButtons(container, playlists, busyIds) {
  container.querySelectorAll('.play-btn').forEach((btn) => {
    const id = btn.dataset.id;
    const playlist = playlists.find((p) => p.id === id);
    if (!playlist) return;
    btn.classList.toggle('busy', busyIds.has(id));
    btn.disabled = playlist.trackIds.length === 0 || busyIds.has(id);
    btn.setAttribute('aria-label', `「${playlist.name}」をシャッフルで再生`);
    btn.innerHTML = btn.classList.contains('last-play-btn')
      ? `${iconOnly('play')}<span>再生</span>`
      : iconOnly('play');
  });
}

/**
 * @param {HTMLElement} container
 * @param {Array<object>} playlists 各要素はartwork（FR-2.10の優先順位で解決済み）を含む
 * @param {{onOpen: Function, onCreateNew: Function, onPlay: (playlistId: string) => Promise<void>}} actions
 *   onPlay：詳細画面を開かずに、そのプレイリストをシャッフルで最初から再生する（再生中でも最初から再生し直す）。
 *   失敗した場合は例外を投げる（メッセージを一覧の上部に表示する）
 * @param {{lastPlayedId?: (string|null)}} [state]
 */
export function renderPlaylistList(container, playlists, actions, state = {}) {
  let filterTerm = '';
  const busyIds = new Set();
  const lastPlayedId = state.lastPlayedId || null;
  let errorTimer = null;

  function matchingPlaylists() {
    const q = filterTerm.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }

  function showError(message) {
    const el = container.querySelector('#playlist-list-error');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  async function play(id) {
    if (busyIds.has(id)) return;
    busyIds.add(id);
    applyPlayButtons(container, playlists, busyIds);
    try {
      await actions.onPlay(id);
    } catch (err) {
      showError(`再生できませんでした（${err.message || err}）`);
    } finally {
      busyIds.delete(id);
      applyPlayButtons(container, playlists, busyIds);
    }
  }

  /** 前回のプレイリストのカード（FR-2.20）。前回の記憶が無い・曲が0件・名前で絞り込み中は表示しない */
  function renderLastPlayed() {
    const slot = container.querySelector('#last-played-slot');
    if (!slot) return;
    const m = playlists.find((p) => p.id === lastPlayedId);
    if (!m || m.trackIds.length === 0 || filterTerm.trim()) {
      slot.innerHTML = '';
      return;
    }
    slot.innerHTML = `
      <div class="last-played">
        <button type="button" class="last-played-open" data-id="${escapeHtml(m.id)}">
          ${playlistArtworkHtml(m, m.artwork)}
          <div class="item-main">
            <div class="last-played-label">前回のプレイリスト</div>
            ${marqueeHtml(m.name)}
          </div>
        </button>
        <button type="button" class="play-btn pill-play-btn last-play-btn" data-id="${escapeHtml(m.id)}"></button>
      </div>
    `;
    setupMarquees(slot);
    slot.querySelector('.last-played-open').addEventListener('click', () => actions.onOpen(m.id));
    slot.querySelector('.last-play-btn').addEventListener('click', () => play(m.id));
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
            <button type="button" class="play-btn row-play-btn" data-id="${escapeHtml(m.id)}"></button>
          </li>
        `).join('');
    // プレイリスト名が1行に収まらないときは自動スクロールする
    setupMarquees(listEl);
    listEl.querySelectorAll('.playlist-open').forEach((btn) => {
      btn.addEventListener('click', () => actions.onOpen(btn.dataset.id));
    });
    listEl.querySelectorAll('.row-play-btn').forEach((btn) => {
      btn.addEventListener('click', () => play(btn.dataset.id));
    });
    applyPlayButtons(container, playlists, busyIds);
  }

  container.innerHTML = `
    <div class="screen-header">
      <h1>プレイリスト一覧</h1>
      <button type="button" id="create-playlist-btn" class="icon-btn" aria-label="プレイリストを作成">${iconOnly('add')}</button>
    </div>
    <p id="playlist-list-error" class="error-banner" role="alert" hidden></p>
    <div id="last-played-slot"></div>
    <div class="inline-form">
      <input type="text" id="playlist-search-term" placeholder="プレイリスト名で検索">
    </div>
    <ul class="list" id="playlist-list"></ul>
  `;

  container.querySelector('#create-playlist-btn').addEventListener('click', () => actions.onCreateNew());
  container.querySelector('#playlist-search-term').addEventListener('input', (e) => {
    filterTerm = e.target.value;
    renderLastPlayed();
    renderList();
  });

  renderLastPlayed();
  renderList();
  applyPlayButtons(container, playlists, busyIds);
}
