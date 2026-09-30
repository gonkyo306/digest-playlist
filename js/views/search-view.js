// フェーズ7・9・16：検索タブ（FR-6.1）。
// CR-017：フリーワード検索と段階検索を1本の検索に統合する。1回のキーワード検索で
// 曲・アーティスト・アルバムをまとめて取得し、アーティスト行→アルバム一覧、
// アルバム行→収録曲一覧へドリルダウンできる。「戻る」は1段階ずつ戻る。
// CR-018：件数表示を削除し、続きがある合図は視認できる下矢印のガイド表示にする。
// CR-019：この関数はapp.js側で1回だけ呼び出され、タブ切替ではDOMを再生成しない前提
// （検索結果・ドリルダウンの位置は、このモジュール内のクロージャ変数として保持され続ける）。
// CR-020/023：試聴はミニプレイヤーに表示される（previewPlayer経由。app.js側で連携）。
// CR-026：行の種別アイコン（曲／アーティスト／アルバム）はtrack-row.js側で付与する。
// フェーズ28（CR-046）：検索ボタンを廃止し、入力を始めた時点で動的に検索する（300msデバウンス）。
// フェーズ28（CR-047）：曲の複数選択→一括追加の方式を廃止。画面右上に、現在の追加先プレイリストを
// ジャケット＋名前で常時表示し（FR-1.19）、＋ボタンのタップで即座にその曲を1曲だけ追加する
// （FR-1.12）。この常時表示をタップすると、追加先を変更するモーダル（FR-2.4）が開く。
// プレイリストが1件も無い場合は、常時表示の位置にプレイリスト作成を促すガイドを表示する
// （FR-1.19、FR-5.4の例外）。

import {
  trackRowHtml, compactTrackRowHtml, artistRowHtml, albumRowHtml,
  bindTrackRowEvents, bindArtistRowEvents, bindAlbumRowEvents,
} from './track-row.js';
import { iconOnly } from './icons.js';
import { largeArtworkUrl } from '../artwork-url.js';
import { blobToUrl } from '../blob-url-cache.js';
import { showAddDestinationPicker } from './playlist-picker-dialog.js';
import { renderPlaylistCreate } from './playlist-create-view.js';
import { pushBackState, popBackState } from '../back-stack.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PAGE_SIZE_FIRST = 25;
const PAGE_SIZE_MORE = 50;
const SEARCH_DEBOUNCE_MS = 300; // CR-046：ネットワーク通信を伴う曲検索は、入力が止まってから実行する

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
 *   onGetPlaylists: () => Promise<Array<object>>,
 *   onGetLastUsedPlaylistId: () => (string|null),
 *   onResolveArtwork: (playlist: object) => Promise<object>,
 *   onResolveArtworkForAll: (playlists: Array<object>) => Promise<Map<string, object>>,
 *   onAddTrack: (playlistId: string, trackId: (string|number)) => Promise<{added: boolean}>,
 *   onCreatePlaylist: (name: string, imageBlob: (Blob|null)) => Promise<object>,
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
  let searchDebounceTimer = null;

  let selectedArtist = null;
  let drillAlbums = [];
  let selectedAlbum = null;
  let albumTracks = [];
  let shuffleOn = false;
  let previousModeForTracks = 'results'; // 'albums'から来たか'results'から来たかを覚えておく（戻る先の判定用）

  // --- CR-047：現在の追加先プレイリスト（FR-1.19）。検索タブが再マウントされるまで保持する ---
  let currentDestination = null; // { id, name, trackIds, artwork } | null（プレイリストが1件も無い場合）
  let destinationLoaded = false;

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ------- 追加先プレイリスト（FR-1.19）の常時表示 -------

  async function ensureDestinationLoaded() {
    if (destinationLoaded) return;
    const playlists = await actions.onGetPlaylists();
    if (playlists.length === 0) {
      currentDestination = null;
    } else {
      const lastId = actions.onGetLastUsedPlaylistId();
      const chosen = playlists.find((p) => p.id === lastId) || playlists[0];
      const artwork = await actions.onResolveArtwork(chosen);
      currentDestination = { ...chosen, artwork };
    }
    destinationLoaded = true;
  }

  function destinationArtworkImgHtml(artwork, id) {
    if (artwork?.source === 'custom' && artwork.blob) {
      return `<img src="${escapeHtml(blobToUrl(id, artwork.blob))}" alt="" class="artwork-sm">`;
    }
    if (artwork?.source === 'track' && artwork.url) {
      return `<img src="${escapeHtml(artwork.url)}" alt="" class="artwork-sm">`;
    }
    return `<div class="artwork-sm hero-artwork-placeholder">${iconOnly('disc')}</div>`;
  }

  function destinationHeaderHtml() {
    if (!currentDestination) {
      // FR-1.19：プレイリストが1件も無い場合のガイド表示（FR-5.4の明示的な例外）
      return `
        <button type="button" id="dest-guide-btn" class="dest-header-guide" aria-label="プレイリストを作成">
          ${iconOnly('add')}<span>プレイリストを作成</span>
        </button>
      `;
    }
    return `
      <button type="button" id="dest-header-btn" class="dest-header" aria-label="追加先プレイリストを変更">
        ${destinationArtworkImgHtml(currentDestination.artwork, currentDestination.id)}
        <span class="dest-header-name">${escapeHtml(currentDestination.name)}</span>
      </button>
    `;
  }

  /** 追加先ヘッダーの開閉・遷移イベントを結びつける。destinationが変わったらonChangedを呼ぶ */
  function bindDestinationHeaderEvents(slot, onChanged) {
    const guideBtn = slot.querySelector('#dest-guide-btn');
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        renderPlaylistCreate(container, {}, {
          onCancel: () => onChanged(),
          onSave: async (name, imageBlob) => {
            const created = await actions.onCreatePlaylist(name, imageBlob);
            currentDestination = {
              ...created,
              artwork: imageBlob ? { source: 'custom', blob: imageBlob } : { source: 'none' },
            };
            onChanged();
          },
        });
      });
      return;
    }
    const headerBtn = slot.querySelector('#dest-header-btn');
    if (!headerBtn) return;
    headerBtn.addEventListener('click', async () => {
      const playlists = await actions.onGetPlaylists();
      const artworkMap = await actions.onResolveArtworkForAll(playlists);
      const withArtwork = playlists.map((p) => ({ ...p, artwork: artworkMap.get(p.id) }));
      const chosenId = await showAddDestinationPicker(withArtwork, {
        lastUsedPlaylistId: actions.onGetLastUsedPlaylistId(),
      });
      if (chosenId && (!currentDestination || chosenId !== currentDestination.id)) {
        currentDestination = withArtwork.find((p) => p.id === chosenId) || currentDestination;
        onChanged();
      }
    });
  }

  /**
   * 各ステップ（results/albums/tracks）の.screen-header内にある#dest-header-slotへ、
   * 追加先プレイリストの常時表示（FR-1.19）を描画する。初回解決時（destinationLoadedが
   * falseだった場合）は、＋ボタン・追加済みバッジの表示を最新化するためonFirstLoadを呼ぶ。
   * @param {() => void} rerenderStep 追加先を変更した後に、現在のステップを再描画する関数
   * @param {() => void} [onFirstLoad] 初回解決後に一覧の追加済み表示を更新するための再描画関数
   */
  async function mountDestinationHeader(rerenderStep, onFirstLoad) {
    const wasLoaded = destinationLoaded;
    await ensureDestinationLoaded();
    const slot = container.querySelector('#dest-header-slot');
    if (!slot) return; // 描画中に画面遷移済み
    slot.innerHTML = destinationHeaderHtml();
    bindDestinationHeaderEvents(slot, rerenderStep);
    if (!wasLoaded && onFirstLoad) onFirstLoad();
  }

  /** ＋ボタンのタップで、現在の追加先へ即座に1曲追加する（CR-047） */
  async function handleInstantAdd(track) {
    if (!currentDestination) return { added: false };
    const result = await actions.onAddTrack(currentDestination.id, track.id);
    if (result.added) {
      currentDestination = { ...currentDestination, trackIds: [...currentDestination.trackIds, track.id] };
    }
    return result;
  }

  function rerenderCurrentStep() {
    if (mode === 'albums') renderAlbumsStep();
    else if (mode === 'tracks') renderAlbumTracksStep();
    else renderResultsStep();
  }

  // ------- 検索結果ステップ（曲・アーティスト・アルバム混在） -------

  function renderResultsStep() {
    mode = 'results';
    container.innerHTML = `
      <div class="screen-header">
        <h1>曲を検索</h1>
        <div id="dest-header-slot"></div>
      </div>
      <form id="search-form" class="inline-form">
        <input type="text" id="search-term" placeholder="曲名・アーティスト名・アルバム名" value="${escapeHtml(term)}">
      </form>
      <div id="search-status" class="note"></div>
      <ul class="list" id="search-results"></ul>
    `;
    // CR-046：検索ボタンを廃止したため、モバイルキーボードのEnter等でのフォーム送信は無視する
    container.querySelector('#search-form').addEventListener('submit', (e) => e.preventDefault());

    const statusEl = container.querySelector('#search-status');

    function renderResultsList() {
      const resultsEl = container.querySelector('#search-results');
      if (!resultsEl) return; // mountDestinationHeaderの解決待ち中に画面遷移済み
      const addedIds = currentDestination ? new Set(currentDestination.trackIds) : new Set();
      resultsEl.innerHTML = [
        ...artists.map((a, i) => artistRowHtml(a, i)),
        ...albums.map((a, i) => albumRowHtml(a, i)),
        ...tracks.map((t, i) => trackRowHtml(t, i, { added: addedIds.has(t.id), hideAddControl: !currentDestination })),
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
      // bindTrackRowEventsは.toggle-add-btn/.track-playのクラスセレクタだけで曲行を拾うため、
      // 同じresultsEl内にアーティスト/アルバム行が混在していてもindexはtracks配列とずれない。
      bindTrackRowEvents(resultsEl, tracks, {
        previewPlayer,
        onAdd: (track) => handleInstantAdd(track),
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

    // CR-046：文字を入力し始めた時点で、入力が止まってから（デバウンス）動的に検索する
    container.querySelector('#search-term').addEventListener('input', (e) => {
      const newTerm = e.target.value.trim();
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      if (!newTerm) {
        term = '';
        tracks = [];
        artists = [];
        albums = [];
        hasMore = false;
        teardownObserver();
        statusEl.textContent = '';
        container.querySelector('#search-results').innerHTML = '';
        return;
      }
      searchDebounceTimer = setTimeout(() => runSearch(newTerm), SEARCH_DEBOUNCE_MS);
    });

    // 既に検索済みの結果があれば（タブ切替からの復帰、CR-019）そのまま再表示する
    if (tracks.length || artists.length || albums.length) {
      renderResultsList();
    } else if (term) {
      runSearch(term);
    }

    mountDestinationHeader(rerenderCurrentStep, renderResultsList);
  }

  // ------- アルバム一覧ステップ（アーティストからのドリルダウン） -------

  function backButtonHtml(id, ariaLabel) {
    return `<button type="button" id="${id}" class="icon-btn" aria-label="${ariaLabel}">${iconOnly('back')}</button>`;
  }

  async function loadArtistAlbums() {
    mode = 'albums';
    container.innerHTML = `<div class="note">アルバムを取得中…</div>`;
    // CR-053（FR-6.3）：アーティストのアルバム一覧へのドリルダウンを1段階の遷移として履歴に積む
    pushBackState(renderResultsStep);
    try {
      drillAlbums = await actions.onArtistAlbums(selectedArtist.id);
      renderAlbumsStep();
    } catch (err) {
      container.innerHTML = `
        ${backButtonHtml('back-to-results', '検索結果へ戻る')}
        <p class="error-banner">アルバムの取得に失敗しました（${escapeHtml(err.message)}）</p>
      `;
      container.querySelector('#back-to-results').addEventListener('click', () => { popBackState(); renderResultsStep(); });
    }
  }

  function renderAlbumsStep() {
    mode = 'albums';
    container.innerHTML = `
      <div class="screen-header">
        ${backButtonHtml('back-to-results', '検索結果へ戻る')}
        <div id="dest-header-slot"></div>
      </div>
      <h2>${escapeHtml(selectedArtist.name)}のアルバム</h2>
      <ul class="list" id="album-results">
        ${
          drillAlbums.length === 0
            ? '<li class="empty">アルバムが見つかりませんでした。</li>'
            : drillAlbums.map((a, i) => albumRowHtml(a, i, { showTypeIcon: false })).join('')
        }
      </ul>
    `;
    container.querySelector('#back-to-results').addEventListener('click', () => { popBackState(); renderResultsStep(); });
    const listEl = container.querySelector('#album-results');
    bindAlbumRowEvents(listEl, drillAlbums, (album) => {
      selectedAlbum = album;
      previousModeForTracks = 'albums';
      loadAlbumTracksFromResults();
    });

    mountDestinationHeader(rerenderCurrentStep);
  }

  // ------- アルバム収録曲一覧ステップ -------

  async function loadAlbumTracksFromResults() {
    mode = 'tracks';
    container.innerHTML = `<div class="note">収録曲を取得中…</div>`;
    // CR-053（FR-6.3）：収録曲一覧へのドリルダウンを1段階の遷移として履歴に積む。
    // 戻り先はこの時点のprevious ModeForTracks（albums/results）で決まる
    const backTarget = previousModeForTracks === 'albums' ? renderAlbumsStep : renderResultsStep;
    pushBackState(backTarget);
    try {
      albumTracks = await actions.onAlbumTracks(selectedAlbum.id);
      shuffleOn = false;
      renderAlbumTracksStep();
    } catch (err) {
      const backLabel = previousModeForTracks === 'albums' ? 'アルバム一覧へ戻る' : '検索結果へ戻る';
      container.innerHTML = `
        ${backButtonHtml('back-from-tracks-error', backLabel)}
        <p class="error-banner">収録曲の取得に失敗しました（${escapeHtml(err.message)}）</p>
      `;
      container.querySelector('#back-from-tracks-error').addEventListener('click', () => { popBackState(); backTarget(); });
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
        <div id="dest-header-slot"></div>
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
    container.querySelector('#back-from-tracks').addEventListener('click', () => { popBackState(); backTarget(); });

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

    function renderTrackList() {
      const listEl = container.querySelector('#album-track-results');
      if (!listEl) return; // mountDestinationHeaderの解決待ち中に画面遷移済み
      const addedIds = currentDestination ? new Set(currentDestination.trackIds) : new Set();
      listEl.innerHTML = albumTracks
        .map((t, i) => compactTrackRowHtml(t, i, { added: addedIds.has(t.id), hideAddControl: !currentDestination }))
        .join('');
      bindTrackRowEvents(listEl, albumTracks, {
        previewPlayer,
        onAdd: (track) => handleInstantAdd(track),
      });
    }
    renderTrackList();

    mountDestinationHeader(rerenderCurrentStep, renderTrackList);
  }

  renderResultsStep();

  return {
    /**
     * 検索タブが（再マウントではなく）表示状態に切り替わった際に呼ぶ。プレイリストタブ側で
     * 作成・削除された内容を反映するため、追加先プレイリストの常時表示（FR-1.19）を
     * 再解決してから、現在のステップを再描画する（ネットワークの再検索は行わない）。
     */
    onTabActivated() {
      destinationLoaded = false;
      rerenderCurrentStep();
    },
  };
}
