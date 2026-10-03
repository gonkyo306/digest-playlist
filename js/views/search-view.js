// 検索タブ（FR-6.1）。
// 1回のキーワード検索で曲・アーティスト・アルバムをまとめて取得し、アーティスト行→アルバム一覧、
// アルバム行→収録曲一覧へドリルダウンできる（FR-1.1, FR-1.9）。「戻る」は1段階ずつ戻る。
// 件数は表示せず、続きがある合図は視認できる下矢印のガイド表示にする（FR-1.10）。
// この関数はapp.js側で1回だけ呼び出され、タブ切替ではDOMを再生成しない前提
// （検索結果・ドリルダウンの位置は、このモジュール内のクロージャ変数として保持され続ける）。
// 試聴はミニプレイヤーに表示される（previewPlayer経由。app.js側で連携）。
// 行の種別アイコン（曲／アーティスト／アルバム）はtrack-row.js側で付与する。
// 検索ボタンは無く、入力を始めた時点で動的に検索する（300msデバウンス。FR-1.1）。
// 画面右上に、現在の追加先プレイリストをジャケット＋名前で常時表示し（FR-1.19）、
// ＋ボタンのタップで即座にその曲を1曲だけ追加する（FR-1.12）。この常時表示をタップすると、
// 追加先を変更するモーダル（FR-2.4）が開く。
// 画面が表示された時点で既に追加済みだった曲（FR-1.20、静的な「追加済」バッジ）と、
// その場（今回の＋タップ）で追加した曲（FR-1.21、取り消しバッジ付きチェックアイコン）を区別する。
// 後者はこのモジュール内のjustAddedIds（クロージャ変数）で管理し、追加先プレイリストの変更・
// ドリルダウンでの画面遷移・タブの切り替えと復帰・ポップアップ（追加先選択モーダル）を開いて
// 戻ったときのいずれでもリセットし、「追加済」の確定表示にする。
// プレイリストが1件も無い場合、右上の常時表示には何も出さず、曲の＋ボタンは常に表示する。
// ＋ボタンをタップした時点でプレイリストが無ければ、その場で作成するダイアログ
// （showCreatePlaylistPrompt、dialog.js）を表示し、作成すると新しいプレイリストが追加先になり、
// タップした曲がそのまま追加される（FR-1.23）。

import {
  trackRowHtml, compactTrackRowHtml, artistRowHtml, albumRowHtml,
  bindTrackRowEvents, bindArtistRowEvents, bindAlbumRowEvents,
} from './track-row.js';
import { iconOnly } from './icons.js';
import { largeArtworkUrl } from '../artwork-url.js';
import { blobToUrl } from '../blob-url-cache.js';
import { showAddDestinationPicker, CREATE_NEW } from './playlist-picker-dialog.js';
import { showCreatePlaylistPrompt } from './dialog.js';
import { openPlaylistCreateSheet } from './playlist-create-view.js';
import { setupMarquee } from '../marquee.js';
import { pushBackState, popBackState } from '../back-stack.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PAGE_SIZE_FIRST = 25;
const PAGE_SIZE_MORE = 50;
const SEARCH_DEBOUNCE_MS = 300; // ネットワーク通信を伴う曲検索は、入力が止まってから実行する

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
 *   onAddTracks: (playlistId: string, trackIds: Array<string|number>) => Promise<{addedIds: Array<string|number>}>,
 *   onRemoveTracks: (playlistId: string, trackIds: Array<string|number>) => Promise<void>,
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

  // --- 現在の追加先プレイリスト（FR-1.19）。検索タブが再マウントされるまで保持する ---
  let currentDestination = null; // { id, name, trackIds, artwork } | null（プレイリストが1件も無い場合）
  let destinationLoaded = false;
  // その場（今回の＋タップ）で追加した曲のtrackId集合。
  // 追加先プレイリストを変えたとき・ドリルダウンで画面が変わったとき・タブを
  // 切り替えて戻ってきたとき・ポップアップを開いて戻ってきたときのいずれでもリセットし、
  // 取り消し可能な表示を「追加済」の確定表示にする
  let justAddedIds = new Set();

  /** modeを実際に変更する場合のみjustAddedIdsをリセットする（同じステップの再描画では維持する） */
  function enterStep(newMode) {
    if (mode !== newMode) justAddedIds = new Set();
    mode = newMode;
    removeSnackbar();
  }

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ------- 追加先プレイリスト（FR-1.19）の常時表示 -------

  async function ensureDestinationLoaded() {
    if (destinationLoaded) return;
    const previousId = currentDestination?.id ?? null;
    const playlists = await actions.onGetPlaylists();
    if (playlists.length === 0) {
      currentDestination = null;
    } else {
      // 他のタブへ移動して戻ってきたときに、ピッカーで明示的に選んだ追加先が「前回追加」した
      // プレイリストへ勝手に戻らないよう、既に選んでいた追加先がまだ存在するなら、それを最優先で
      // 再解決する（無ければ前回追加→一覧の先頭の順で選ぶ）
      const preferredId = previousId || actions.onGetLastUsedPlaylistId();
      const chosen = playlists.find((p) => p.id === preferredId)
        || playlists.find((p) => p.id === actions.onGetLastUsedPlaylistId())
        || playlists[0];
      const artwork = await actions.onResolveArtwork(chosen);
      currentDestination = { ...chosen, artwork };
    }
    // 追加先が変わったら「その場で追加した」記憶をリセットする
    if ((currentDestination?.id ?? null) !== previousId) justAddedIds = new Set();
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
    // プレイリストが1件も無い場合、この位置には何も表示しない（曲の＋ボタンをタップした
    // 時点で、その場で作成するダイアログを出す方式に一本化したため）
    if (!currentDestination) return '';
    return `
      <button type="button" id="dest-header-btn" class="dest-header" aria-label="追加先プレイリストを変更">
        <span class="dest-header-label">追加先</span>
        ${destinationArtworkImgHtml(currentDestination.artwork, currentDestination.id)}
        <span class="dest-header-name marquee"><span class="marquee-track"><span class="marquee-text">${escapeHtml(currentDestination.name)}</span></span></span>
      </button>
    `;
  }

  /** プレイリスト作成画面（FR-2.17。下から現れるシート表示）を開き、作成完了／キャンセルを待つ（追加先選択モーダルの＋ボタン用） */
  function openFullCreateScreen() {
    return new Promise((resolve) => {
      openPlaylistCreateSheet({
        onCancel: () => resolve(null),
        onSave: async (name, imageBlob) => {
          const created = await actions.onCreatePlaylist(name, imageBlob);
          resolve({ ...created, artwork: imageBlob ? { source: 'custom', blob: imageBlob } : { source: 'none' } });
        },
      });
    });
  }

  /** 追加先ヘッダーの開閉・遷移イベントを結びつける。destinationが変わったらonChangedを呼ぶ */
  function bindDestinationHeaderEvents(slot, onChanged) {
    const headerBtn = slot.querySelector('#dest-header-btn');
    if (!headerBtn) return;
    // 曲名と同じく、長いプレイリスト名も横幅に収まらなければ自動スクロールする
    setupMarquee(headerBtn.querySelector('.dest-header-name'));
    headerBtn.addEventListener('click', async () => {
      const playlists = await actions.onGetPlaylists();
      const artworkMap = await actions.onResolveArtworkForAll(playlists);
      const withArtwork = playlists.map((p) => ({ ...p, artwork: artworkMap.get(p.id) }));
      const chosenId = await showAddDestinationPicker(withArtwork, {
        lastUsedPlaylistId: actions.onGetLastUsedPlaylistId(),
      });
      // モーダル右上の＋ボタンから、その場でプレイリストを作成する
      if (chosenId === CREATE_NEW) {
        const created = await openFullCreateScreen();
        if (created) {
          currentDestination = created;
          justAddedIds = new Set();
        }
        onChanged(); // 作成画面を閉じて、元のステップを再描画する（キャンセル時も同様）
        return;
      }
      // ポップアップ（追加先選択モーダル）を開いて戻ってくると、選択を変えたかどうかに
      // 関わらず、取り消し可能な表示を「追加済」の確定表示にする
      const changed = chosenId && (!currentDestination || chosenId !== currentDestination.id);
      if (changed) {
        currentDestination = withArtwork.find((p) => p.id === chosenId) || currentDestination;
      }
      justAddedIds = new Set();
      onChanged();
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

  /**
   * プレイリストが1件も無い状態で＋ボタンがタップされたとき、その場で作成するダイアログを
   * 表示する。キャンセルするとnullを返す。
   * @returns {Promise<object|null>} 新しい追加先（{id, name, trackIds, artwork}）。キャンセル時はnull
   */
  async function promptCreateDestination(subject) {
    const name = await showCreatePlaylistPrompt({ subject });
    if (!name) return null;
    const created = await actions.onCreatePlaylist(name, null);
    return { ...created, artwork: { source: 'none' } };
  }

  /**
   * ＋ボタンのタップで、現在の追加先へ即座に1曲追加する。追加先プレイリストが
   * 1件も無い場合は、その場で作成するダイアログを表示してから追加する。
   */
  async function handleInstantAdd(track) {
    let justCreated = false;
    if (!currentDestination) {
      const created = await promptCreateDestination();
      if (!created) return { added: false };
      currentDestination = created;
      justAddedIds = new Set(); // 新しい追加先には「その場で追加した」曲はまだ無い
      justCreated = true;
    }
    const result = await actions.onAddTrack(currentDestination.id, track.id);
    if (result.added) {
      currentDestination = { ...currentDestination, trackIds: [...currentDestination.trackIds, track.id] };
      // プレイリストが無い状態からその場で作成して追加した曲は、取り消し可能な
      // チップではなく、最初から「追加済」の確定表示にする（justAddedIdsには記憶しない）
      if (!justCreated) justAddedIds.add(track.id); // 取り消し可能なチップの対象として記憶する
      if (justCreated) {
        // 作成直後は曲がまだ無く代表画像が無いため、1曲追加した今、FR-2.10の
        // フォールバック（1曲目のジャケット）で代表画像を解決し直す（右上の表示に反映させる）
        currentDestination = { ...currentDestination, artwork: await actions.onResolveArtwork(currentDestination) };
      }
    }
    // 新しく追加先を作った場合は、右上の常時表示を新しいプレイリストで更新するため、
    // 現在のステップ全体を再描画する（追加先を変更した場合と同じ扱い）
    if (justCreated) rerenderCurrentStep();
    return result;
  }

  // ------- アルバムの全曲追加（FR-1.24） -------

  let snackTimer = null;

  function removeSnackbar() {
    clearTimeout(snackTimer);
    container.querySelector('#add-all-snackbar')?.remove();
  }

  /** 「N曲を『○○』に追加しました［取り消し］」を、画面下部（ミニプレイヤー・タブバーの上）に表示する */
  function showAddAllSnackbar(destination, addedIds, onUndo) {
    removeSnackbar();
    const bar = document.getElementById('bottom-bar');
    const snack = document.createElement('div');
    snack.id = 'add-all-snackbar';
    snack.className = 'snackbar';
    snack.setAttribute('role', 'status');
    snack.innerHTML = `
      <span class="snackbar-text">${addedIds.length}曲を「${escapeHtml(destination.name)}」に追加しました</span>
      <button type="button" class="snackbar-action">取り消し</button>
    `;
    snack.style.bottom = `${(bar ? bar.offsetHeight : 60) + 12}px`;
    container.appendChild(snack);
    snack.querySelector('.snackbar-action').addEventListener('click', async () => {
      removeSnackbar();
      await onUndo();
    });
    snackTimer = setTimeout(removeSnackbar, 6000);
  }

  /**
   * アルバムの全曲を、現在の追加先へまとめて追加する。既に追加先にある曲は飛ばす（FR-2.6）。
   * 追加先プレイリストが1件も無い場合は、その場で作成するダイアログを表示してから追加する。
   * @returns {Promise<Array<string|number>>} 新しく追加した曲のID（キャンセル・全曲追加済みなら空）
   */
  async function handleAddAll(albumTrackList, rerender) {
    let justCreated = false;
    if (!currentDestination) {
      const created = await promptCreateDestination('このアルバムの全曲');
      if (!created) return [];
      currentDestination = created;
      justAddedIds = new Set();
      justCreated = true;
    }
    const destination = currentDestination;
    const { addedIds } = await actions.onAddTracks(destination.id, albumTrackList.map((t) => t.id));
    if (addedIds.length === 0) return [];
    currentDestination = { ...destination, trackIds: [...destination.trackIds, ...addedIds] };
    if (justCreated) {
      currentDestination = { ...currentDestination, artwork: await actions.onResolveArtwork(currentDestination) };
      rerenderCurrentStep(); // 右上の追加先表示を新しいプレイリストで更新する
    } else {
      rerender();
    }
    showAddAllSnackbar(currentDestination, addedIds, async () => {
      if (!currentDestination || currentDestination.id !== destination.id) return;
      await actions.onRemoveTracks(destination.id, addedIds);
      const removing = new Set(addedIds);
      currentDestination = {
        ...currentDestination,
        trackIds: currentDestination.trackIds.filter((id) => !removing.has(id)),
      };
      rerenderCurrentStep();
    });
    return addedIds;
  }

  /** 取り消し可能なチップ（FR-1.21）のタップで、その場で追加した曲の追加を取り消す */
  async function handleInstantRemove(track) {
    if (!currentDestination) return { removed: false };
    const result = await actions.onRemoveTrack(currentDestination.id, track.id);
    if (result.removed) {
      currentDestination = {
        ...currentDestination,
        trackIds: currentDestination.trackIds.filter((id) => id !== track.id),
      };
      justAddedIds.delete(track.id);
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
    enterStep('results');
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
    // 検索ボタンを廃止したため、モバイルキーボードのEnter等でのフォーム送信は無視する
    container.querySelector('#search-form').addEventListener('submit', (e) => e.preventDefault());

    const statusEl = container.querySelector('#search-status');

    function renderResultsList() {
      const resultsEl = container.querySelector('#search-results');
      if (!resultsEl) return; // mountDestinationHeaderの解決待ち中に画面遷移済み
      const addedIds = currentDestination ? new Set(currentDestination.trackIds) : new Set();
      resultsEl.innerHTML = [
        ...artists.map((a, i) => artistRowHtml(a, i)),
        ...albums.map((a, i) => albumRowHtml(a, i)),
        ...tracks.map((t, i) => trackRowHtml(t, i, {
          // その場で追加した曲は静的なaddedバッジではなく、
          // 取り消し可能なjustAddedチップにする
          added: addedIds.has(t.id) && !justAddedIds.has(t.id),
          justAdded: justAddedIds.has(t.id),
        })),
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
        onRemove: (track) => handleInstantRemove(track),
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

    // 文字を入力し始めた時点で、入力が止まってから（デバウンス）動的に検索する
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

    // 既に検索済みの結果があれば（タブ切替からの復帰）そのまま再表示する
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
    enterStep('albums');
    container.innerHTML = `<div class="note">アルバムを取得中…</div>`;
    // FR-6.3：アーティストのアルバム一覧へのドリルダウンを1段階の遷移として履歴に積む
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
    enterStep('albums');
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
    enterStep('tracks');
    container.innerHTML = `<div class="note">収録曲を取得中…</div>`;
    // FR-6.3：収録曲一覧へのドリルダウンを1段階の遷移として履歴に積む。
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
    enterStep('tracks');
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
            <button type="button" id="album-add-all-btn" class="icon-btn add-all-btn"></button>
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

    /** 全曲追加ボタンの表示を、追加先に未追加の曲が残っているかに合わせる（FR-1.24） */
    function updateAddAllButton() {
      const btn = container.querySelector('#album-add-all-btn');
      if (!btn) return;
      const inDestination = new Set(currentDestination ? currentDestination.trackIds : []);
      const remaining = albumTracks.filter((t) => !inDestination.has(t.id)).length;
      const allAdded = currentDestination !== null && remaining === 0;
      btn.disabled = allAdded;
      btn.classList.toggle('all-added', allAdded);
      btn.innerHTML = iconOnly(allAdded ? 'check' : 'playlistAdd');
      btn.setAttribute('aria-label', allAdded
        ? '全曲が追加済みです'
        : `${currentDestination ? `残り${remaining}曲` : '全曲'}を${currentDestination ? `「${currentDestination.name}」に` : 'プレイリストに'}追加`);
    }
    const addAllBtn = container.querySelector('#album-add-all-btn');
    if (addAllBtn) {
      addAllBtn.addEventListener('click', async () => {
        addAllBtn.disabled = true; // 連打で二重に追加しない
        await handleAddAll(albumTracks, () => { renderTrackList(); updateAddAllButton(); });
        updateAddAllButton();
      });
    }

    function renderTrackList() {
      const listEl = container.querySelector('#album-track-results');
      if (!listEl) return; // mountDestinationHeaderの解決待ち中に画面遷移済み
      const addedIds = currentDestination ? new Set(currentDestination.trackIds) : new Set();
      listEl.innerHTML = albumTracks
        .map((t, i) => compactTrackRowHtml(t, i, {
          added: addedIds.has(t.id) && !justAddedIds.has(t.id),
          justAdded: justAddedIds.has(t.id),
        }))
        .join('');
      bindTrackRowEvents(listEl, albumTracks, {
        previewPlayer,
        onAdd: async (track) => {
          const result = await handleInstantAdd(track);
          updateAddAllButton();
          return result;
        },
        onRemove: async (track) => {
          const result = await handleInstantRemove(track);
          updateAddAllButton();
          return result;
        },
      });
    }
    renderTrackList();
    updateAddAllButton();

    mountDestinationHeader(rerenderCurrentStep, () => { renderTrackList(); updateAddAllButton(); });
  }

  renderResultsStep();

  return {
    /**
     * 検索タブが（再マウントではなく）表示状態に切り替わった際に呼ぶ。プレイリストタブ側で
     * 作成・削除された内容を反映するため、追加先プレイリストの常時表示（FR-1.19）を
     * 再解決してから、現在のステップを再描画する（ネットワークの再検索は行わない）。
     * 他のタブを開いて検索タブに戻ってきた場合も、取り消し可能な表示を
     * 「追加済」の確定表示にする
     */
    onTabActivated() {
      destinationLoaded = false;
      justAddedIds = new Set();
      rerenderCurrentStep();
    },
  };
}
