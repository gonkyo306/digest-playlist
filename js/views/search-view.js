// フェーズ7・9・16：検索タブ（FR-6.1）。
// CR-017：フリーワード検索と段階検索を1本の検索に統合する。1回のキーワード検索で
// 曲・アーティスト・アルバムをまとめて取得し、アーティスト行→アルバム一覧、
// アルバム行→収録曲一覧へドリルダウンできる。「戻る」は1段階ずつ戻る。
// CR-018：件数表示を削除し、続きがある合図は視認できる下矢印のガイド表示にする。
// CR-019：この関数はapp.js側で1回だけ呼び出され、タブ切替ではDOMを再生成しない前提
// （検索結果・ドリルダウンの位置は、このモジュール内のクロージャ変数として保持され続ける）。
// CR-020/023：試聴はミニプレイヤーに表示される（previewPlayer経由。app.js側で連携）。
// CR-021/024：カートを廃止し、チェックボックスでその場複数選択→右上の「追加」ボタンで一括追加する。
// CR-026：行の種別アイコン（曲／アーティスト／アルバム）はtrack-row.js側で付与する。

import {
  trackRowHtml, compactTrackRowHtml, artistRowHtml, albumRowHtml,
  bindTrackRowEvents, bindArtistRowEvents, bindAlbumRowEvents,
} from './track-row.js';
import { iconLabel, iconOnly } from './icons.js';
import { largeArtworkUrl } from '../artwork-url.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PAGE_SIZE_FIRST = 25;
const PAGE_SIZE_MORE = 50;

function bulkAddButtonHtml(count) {
  if (count <= 0) return '';
  return `<button type="button" id="bulk-add-btn" class="primary bulk-add-btn">${iconLabel('add', `追加（${count}）`)}</button>`;
}

function loadMoreIndicatorHtml() {
  return `<li class="load-more-indicator" aria-hidden="true">${iconOnly('more')}</li>`;
}

/**
 * @param {HTMLElement} container
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer}} deps
 * @param {{
 *   onSearchTracks: (term, offset, limit) => Promise<Array>,
 *   onSearchArtists: (term) => Promise<Array>,
 *   onSearchAlbums: (term) => Promise<Array>,
 *   onArtistAlbums: (artistId) => Promise<Array>,
 *   onAlbumTracks: (albumId) => Promise<Array>,
 *   onPlayAlbum: Function,
 *   onBulkAdd: (trackIds: Array) => Promise<boolean>,
 * }} actions
 */
export function renderSearchView(container, { previewPlayer }, actions) {
  let mode = 'results'; // 'results' | 'albums' | 'tracks'
  let term = '';
  let tracks = [];
  let artists = [];
  let albums = [];
  let hasMore = false;
  let loadingMore = false;
  let observer = null;
  let selectedIds = new Set(); // 結果一覧トップの曲の選択（CR-024）

  let selectedArtist = null;
  let drillAlbums = [];
  let selectedAlbum = null;
  let albumTracks = [];
  let albumTrackSelectedIds = new Set(); // アルバム収録曲一覧内の選択（CR-021）
  let shuffleOn = false;
  let previousModeForTracks = 'results'; // 'albums'から来たか'results'から来たかを覚えておく（戻る先の判定用）

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  async function handleBulkAdd(ids, selectedSet, rerender) {
    if (ids.length === 0) return;
    const added = await actions.onBulkAdd(ids);
    if (added) {
      selectedSet.clear();
      rerender();
    }
  }

  // ------- 検索結果ステップ（曲・アーティスト・アルバム混在） -------

  function renderResultsStep() {
    mode = 'results';
    container.innerHTML = `
      <div class="screen-header">
        <h1>曲を検索</h1>
        ${bulkAddButtonHtml(selectedIds.size)}
      </div>
      <form id="search-form" class="inline-form">
        <input type="text" id="search-term" placeholder="曲名・アーティスト名・アルバム名" required value="${escapeHtml(term)}">
        <button type="submit">検索</button>
      </form>
      <div id="search-status" class="note"></div>
      <ul class="list" id="search-results"></ul>
    `;

    const statusEl = container.querySelector('#search-status');

    function bindBulkAddButton() {
      const btn = container.querySelector('#bulk-add-btn');
      if (btn) {
        btn.addEventListener('click', () => handleBulkAdd([...selectedIds], selectedIds, renderResultsList));
      }
    }
    bindBulkAddButton();

    function renderResultsList() {
      const headerEl = container.querySelector('.screen-header');
      headerEl.innerHTML = `<h1>曲を検索</h1>${bulkAddButtonHtml(selectedIds.size)}`;
      bindBulkAddButton();

      const resultsEl = container.querySelector('#search-results');
      resultsEl.innerHTML = [
        ...artists.map((a, i) => artistRowHtml(a, i)),
        ...albums.map((a, i) => albumRowHtml(a, i)),
        ...tracks.map((t, i) => trackRowHtml(t, i, { checked: selectedIds.has(t.id) })),
      ].join('');

      bindArtistRowEvents(resultsEl, artists, (artist) => {
        selectedArtist = artist;
        loadArtistAlbums();
      });
      bindAlbumRowEvents(resultsEl, albums, (album) => {
        selectedAlbum = album;
        previousModeForTracks = 'results';
        loadAlbumTracksFromResults();
      });
      // bindTrackRowEventsは.track-checkbox/.preview-btnのクラスセレクタだけで曲行を拾うため、
      // 同じresultsEl内にアーティスト/アルバム行が混在していてもindexはtracks配列とずれない。
      bindTrackRowEvents(resultsEl, tracks, {
        previewPlayer,
        onCheckToggle: (track, checked) => {
          if (checked) selectedIds.add(track.id);
          else selectedIds.delete(track.id);
          const headerEl2 = container.querySelector('.screen-header');
          headerEl2.innerHTML = `<h1>曲を検索</h1>${bulkAddButtonHtml(selectedIds.size)}`;
          bindBulkAddButton();
        },
      });

      teardownObserver();
      if (hasMore && 'IntersectionObserver' in window) {
        resultsEl.insertAdjacentHTML('beforeend', loadMoreIndicatorHtml());
        const sentinel = resultsEl.querySelector('.load-more-indicator');
        observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) loadMore();
        });
        observer.observe(sentinel);
      }
    }

    async function loadMore() {
      if (loadingMore || !hasMore) return;
      loadingMore = true;
      try {
        const more = await actions.onSearchTracks(term, tracks.length, PAGE_SIZE_MORE);
        hasMore = more.length === PAGE_SIZE_MORE;
        tracks = tracks.concat(more);
        renderResultsList();
      } catch {
        hasMore = false; // 追加読み込みに失敗しても、それまでの結果は表示し続ける
      } finally {
        loadingMore = false;
      }
    }

    async function runSearch(newTerm) {
      term = newTerm;
      previewPlayer.stop();
      selectedIds.clear();
      statusEl.textContent = '検索中…';
      container.querySelector('#search-results').innerHTML = '';
      teardownObserver();
      try {
        const [trackResults, artistResults, albumResults] = await Promise.all([
          actions.onSearchTracks(term, 0, PAGE_SIZE_FIRST),
          actions.onSearchArtists(term),
          actions.onSearchAlbums(term),
        ]);
        tracks = trackResults;
        artists = artistResults;
        albums = albumResults;
        hasMore = tracks.length === PAGE_SIZE_FIRST;
        if (tracks.length === 0 && artists.length === 0 && albums.length === 0) {
          statusEl.textContent = '該当する曲が見つかりませんでした。';
          return;
        }
        statusEl.textContent = '';
        renderResultsList();
      } catch (err) {
        statusEl.textContent = `検索に失敗しました: ${err.message}`;
      }
    }

    container.querySelector('#search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const newTerm = container.querySelector('#search-term').value.trim();
      if (!newTerm) return;
      runSearch(newTerm);
    });

    // 既に検索済みの結果があれば（タブ切替からの復帰、CR-019）そのまま再表示する
    if (tracks.length || artists.length || albums.length) {
      renderResultsList();
    } else if (term) {
      runSearch(term);
    }
  }

  // ------- アルバム一覧ステップ（アーティストからのドリルダウン） -------

  function backButtonHtml(id, ariaLabel) {
    return `<button type="button" id="${id}" class="icon-btn" aria-label="${ariaLabel}">${iconOnly('back')}</button>`;
  }

  async function loadArtistAlbums() {
    mode = 'albums';
    container.innerHTML = `<div class="note">アルバムを取得中…</div>`;
    try {
      drillAlbums = await actions.onArtistAlbums(selectedArtist.id);
      renderAlbumsStep();
    } catch (err) {
      container.innerHTML = `
        ${backButtonHtml('back-to-results', '検索結果へ戻る')}
        <p class="error-banner">アルバムの取得に失敗しました（${escapeHtml(err.message)}）</p>
      `;
      container.querySelector('#back-to-results').addEventListener('click', renderResultsStep);
    }
  }

  function renderAlbumsStep() {
    mode = 'albums';
    container.innerHTML = `
      ${backButtonHtml('back-to-results', '検索結果へ戻る')}
      <h2>${escapeHtml(selectedArtist.name)}のアルバム</h2>
      <ul class="list" id="album-results">
        ${
          drillAlbums.length === 0
            ? '<li class="empty">アルバムが見つかりませんでした。</li>'
            : drillAlbums.map((a, i) => albumRowHtml(a, i, { showTypeIcon: false })).join('')
        }
      </ul>
    `;
    container.querySelector('#back-to-results').addEventListener('click', renderResultsStep);
    const listEl = container.querySelector('#album-results');
    bindAlbumRowEvents(listEl, drillAlbums, (album) => {
      selectedAlbum = album;
      previousModeForTracks = 'albums';
      loadAlbumTracksFromResults();
    });
  }

  // ------- アルバム収録曲一覧ステップ -------

  async function loadAlbumTracksFromResults() {
    mode = 'tracks';
    container.innerHTML = `<div class="note">収録曲を取得中…</div>`;
    try {
      albumTracks = await actions.onAlbumTracks(selectedAlbum.id);
      albumTrackSelectedIds.clear();
      shuffleOn = false;
      renderAlbumTracksStep();
    } catch (err) {
      const backTarget = previousModeForTracks === 'albums' ? renderAlbumsStep : renderResultsStep;
      const backLabel = previousModeForTracks === 'albums' ? 'アルバム一覧へ戻る' : '検索結果へ戻る';
      container.innerHTML = `
        ${backButtonHtml('back-from-tracks-error', backLabel)}
        <p class="error-banner">収録曲の取得に失敗しました（${escapeHtml(err.message)}）</p>
      `;
      container.querySelector('#back-from-tracks-error').addEventListener('click', backTarget);
    }
  }

  function renderAlbumTracksStep() {
    mode = 'tracks';
    const canPlayAlbum = albumTracks.length > 0;
    const backTarget = previousModeForTracks === 'albums' ? renderAlbumsStep : renderResultsStep;
    const backLabel = previousModeForTracks === 'albums' ? 'アルバム一覧へ戻る' : '検索結果へ戻る';

    container.innerHTML = `
      <div class="screen-header">
        ${backButtonHtml('back-from-tracks', backLabel)}
        ${bulkAddButtonHtml(albumTrackSelectedIds.size)}
      </div>
      <div class="hero">
        <img src="${escapeHtml(largeArtworkUrl(selectedAlbum.artwork))}" alt="" class="hero-artwork">
        <h2 class="hero-name">${escapeHtml(selectedAlbum.name)}</h2>
        <div class="item-sub">${escapeHtml(selectedAlbum.artist)}</div>
        ${
          canPlayAlbum
            ? `
          <div class="hero-actions">
            <button type="button" id="album-shuffle-btn" class="icon-btn shuffle-btn" aria-label="シャッフル" aria-pressed="false">${iconOnly('shuffle')}</button>
            <button type="button" id="album-play-btn" class="pill-play-btn" aria-label="アルバムを全曲再生">${iconOnly('play')}<span>再生</span></button>
          </div>
        `
            : ''
        }
      </div>
      <ul class="list" id="album-track-results"></ul>
    `;
    container.querySelector('#back-from-tracks').addEventListener('click', backTarget);

    function bindBulkAddButton() {
      const btn = container.querySelector('#bulk-add-btn');
      if (btn) {
        btn.addEventListener('click', () => handleBulkAdd([...albumTrackSelectedIds], albumTrackSelectedIds, renderAlbumTracksStep));
      }
    }
    bindBulkAddButton();

    if (canPlayAlbum) {
      const shuffleBtn = container.querySelector('#album-shuffle-btn');
      shuffleBtn.classList.toggle('active', shuffleOn);
      shuffleBtn.setAttribute('aria-pressed', String(shuffleOn));
      shuffleBtn.addEventListener('click', () => {
        shuffleOn = !shuffleOn;
        shuffleBtn.classList.toggle('active', shuffleOn);
        shuffleBtn.setAttribute('aria-pressed', String(shuffleOn));
      });
      container.querySelector('#album-play-btn').addEventListener('click', () => {
        actions.onPlayAlbum(albumTracks, { shuffle: shuffleOn, albumName: selectedAlbum.name });
      });
    }

    const listEl = container.querySelector('#album-track-results');
    listEl.innerHTML = albumTracks
      .map((t, i) => compactTrackRowHtml(t, i, { checked: albumTrackSelectedIds.has(t.id) }))
      .join('');
    bindTrackRowEvents(listEl, albumTracks, {
      previewPlayer,
      onCheckToggle: (track, checked) => {
        if (checked) albumTrackSelectedIds.add(track.id);
        else albumTrackSelectedIds.delete(track.id);
        const headerEl = container.querySelector('.screen-header');
        headerEl.innerHTML = `${backButtonHtml('back-from-tracks', backLabel)}${bulkAddButtonHtml(albumTrackSelectedIds.size)}`;
        container.querySelector('#back-from-tracks').addEventListener('click', backTarget);
        bindBulkAddButton();
      },
    });
  }

  renderResultsStep();
}
