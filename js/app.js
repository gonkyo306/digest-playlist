// アプリ本体のエントリポイント。
// フェーズ7〜11：「メドレー」「検索」の2タブ構成（FR-6.1）、再生の永続化・ミニプレイヤー
// （FR-4.16, FR-4.17）、検索の拡張（FR-1.1, 1.8〜1.13）、アーティスト順ソート（FR-2.11）を統合する。

import { getAllMedleys, getMedley, saveMedley, deleteMedley } from './storage.js';
import {
  createMedley,
  renameMedley,
  addTrackToMedley,
  removeTrackFromMedley,
  isDuplicateTrack,
} from './models.js';
import { fetchTrackInfoByIds } from './track-api.js';
import { fetchSearchResults } from './search-api.js';
import { fetchArtists, fetchArtistAlbums, fetchAlbumTracks } from './staged-search-api.js';
import { orderAlbumTracks } from './album-playback.js';
import {
  addToCart as addToCartModel,
  removeFromCart as removeFromCartModel,
  removeManyFromCart,
  isInCart as isInCartModel,
  partitionCartForMedley,
} from './cart-model.js';
import { loadCart, persistCart } from './cart-storage.js';
import { PreviewPlayer } from './preview-player.js';
import { MedleyPlayer } from './medley-player.js';
import { renderMedleyList } from './views/medley-list-view.js';
import { renderMedleyDetail, updatePlaybackPanel } from './views/medley-detail-view.js';
import { renderSearchView } from './views/search-view.js';
import { renderTabBar } from './views/tab-bar-view.js';
import { renderMiniPlayer } from './views/mini-player-view.js';
import { showMedleyPicker } from './views/medley-picker-dialog.js';
import { showMessage } from './views/dialog.js';

const mainContent = document.getElementById('main-content');
const tabBarEl = document.getElementById('tab-bar');
const miniPlayerEl = document.getElementById('mini-player');

const realPreviewPlayer = new PreviewPlayer();
// FR-1.6: 試聴が始まったら、再生中のメドレー／アルバム一時再生を一時停止する。
// （検索がメドレーから独立したので、「試聴の開始」そのものをフックする）
const previewPlayer = {
  get isPlaying() {
    return realPreviewPlayer.isPlaying;
  },
  get currentTrackId() {
    return realPreviewPlayer.currentTrackId;
  },
  play(track) {
    if (currentPlayer) currentPlayer.pauseForPreview();
    realPreviewPlayer.play(track);
  },
  stop() {
    realPreviewPlayer.stop();
  },
};

// --- 画面全体のタブ状態（FR-6.1） ---
let activeTab = 'medley'; // 'medley' | 'search'
let medleyView = { screen: 'list' }; // { screen: 'list' } | { screen: 'detail', medleyId }

// --- 再生の永続化（FR-4.16）：画面遷移では破棄しない。新しい再生を始めるときだけ入れ替える ---
/** @type {MedleyPlayer|null} */
let currentPlayer = null;
/** @type {{type: 'medley', medleyId: string}|{type: 'album', albumName: string}|null} */
let playbackContext = null;

// --- カート（FR-1.12）：起動時にローカルストレージから読み込む（NFR-3.4） ---
let cart = loadCart();

function disposeCurrentPlayer() {
  if (currentPlayer) currentPlayer.dispose();
  currentPlayer = null;
  playbackContext = null;
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => currentPlayer && currentPlayer.togglePlayPause());
  navigator.mediaSession.setActionHandler('pause', () => currentPlayer && currentPlayer.togglePlayPause());
  navigator.mediaSession.setActionHandler('nexttrack', () => currentPlayer && currentPlayer.next());
  navigator.mediaSession.setActionHandler('previoustrack', () => currentPlayer && currentPlayer.prev());
}
setupMediaSession();

function updateMediaSessionMetadata(track) {
  if (!('mediaSession' in navigator) || !track) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    artwork: track.artwork ? [{ src: track.artwork, sizes: '100x100', type: 'image/jpeg' }] : [],
  });
}

window.addEventListener('offline', () => currentPlayer && currentPlayer.handleOffline());
window.addEventListener('online', () => currentPlayer && currentPlayer.handleOnline());

/** 今、メドレー詳細画面またはアルバム一時再生の「再生元」を見ているか（＝インライン表示で足りるか） */
function isViewingCurrentPlayback() {
  if (!currentPlayer || !playbackContext) return false;
  if (playbackContext.type === 'medley') {
    return activeTab === 'medley'
      && medleyView.screen === 'detail'
      && medleyView.medleyId === playbackContext.medleyId;
  }
  // アルバムの一時再生（FR-1.11）：検索タブを表示していれば、再生元相当とみなす
  return activeTab === 'search';
}

/** メドレー詳細画面のインラインパネル、またはミニプレイヤーへ、再生状態を反映する */
function reflectPlaybackState() {
  if (!currentPlayer) {
    renderMiniPlayerBar();
    return;
  }
  if (playbackContext?.type === 'medley' && isViewingCurrentPlayback()) {
    updatePlaybackPanel(mainContent, {
      track: currentPlayer.currentTrack(),
      playing: currentPlayer.playing,
      canGoBack: currentPlayer.history.canGoBack(),
      stopped: currentPlayer.stopped,
      offlinePaused: currentPlayer.pausedByOffline,
    });
  }
  renderMiniPlayerBar();
}

function renderMiniPlayerBar() {
  const show = currentPlayer && playbackContext && !isViewingCurrentPlayback();
  if (!show) {
    renderMiniPlayer(miniPlayerEl, null, {});
    return;
  }
  renderMiniPlayer(
    miniPlayerEl,
    { track: currentPlayer.currentTrack(), playing: currentPlayer.playing },
    {
      onTogglePlayPause: () => {
        currentPlayer.togglePlayPause();
      },
      onNext: () => currentPlayer.next(),
      onTap: () => {
        if (playbackContext.type === 'medley') {
          activeTab = 'medley';
          medleyView = { screen: 'detail', medleyId: playbackContext.medleyId };
        } else {
          activeTab = 'search';
        }
        renderMain();
      },
    }
  );
}

function renderTabBarUi() {
  renderTabBar(tabBarEl, activeTab, (tab) => {
    if (tab === activeTab) return;
    activeTab = tab;
    renderMain();
  });
}

function renderMain() {
  renderTabBarUi();
  if (activeTab === 'medley') {
    if (medleyView.screen === 'detail') showMedleyDetail(medleyView.medleyId);
    else showMedleyList();
  } else {
    showSearchTab();
  }
  renderMiniPlayerBar();
}

// --- メドレータブ ---

async function showMedleyList() {
  previewPlayer.stop();
  medleyView = { screen: 'list' };
  const medleys = await getAllMedleys();
  medleys.sort((a, b) => b.updatedAt - a.updatedAt);
  renderMedleyList(mainContent, medleys, {
    onOpen: (id) => {
      medleyView = { screen: 'detail', medleyId: id };
      renderMain();
    },
    onCreate: async (name) => {
      await saveMedley(createMedley(name));
      showMedleyList();
    },
    onRename: async (id, newName) => {
      const medley = await getMedley(id);
      if (!medley) return showMedleyList();
      await saveMedley(renameMedley(medley, newName));
      showMedleyList();
    },
    onDelete: async (id) => {
      if (playbackContext?.type === 'medley' && playbackContext.medleyId === id) disposeCurrentPlayer();
      await deleteMedley(id);
      showMedleyList();
    },
  });
}

async function showMedleyDetail(medleyId) {
  previewPlayer.stop();
  medleyView = { screen: 'detail', medleyId };
  const medley = await getMedley(medleyId);
  if (!medley) {
    medleyView = { screen: 'list' };
    return showMedleyList();
  }

  let available = [];
  let unavailableIds = [];
  let fetchError = null;
  if (medley.trackIds.length) {
    try {
      ({ available, unavailableIds } = await fetchTrackInfoByIds(medley.trackIds));
    } catch (err) {
      fetchError = err.message || String(err);
    }
  }

  renderMedleyDetail(mainContent, { medley, tracks: available, unavailableIds, fetchError }, {
    onBack: () => {
      medleyView = { screen: 'list' };
      renderMain();
    },
    onRemoveTrack: async (trackId) => {
      const updated = removeTrackFromMedley(medley, trackId);
      await saveMedley(updated);
      if (playbackContext?.type === 'medley' && playbackContext.medleyId === medleyId) disposeCurrentPlayer();
      showMedleyDetail(medleyId);
    },
    onStartPlayback: () => startMedleyPlayback(medleyId, available),
    onTogglePlayPause: () => currentPlayer && currentPlayer.togglePlayPause(),
    onNext: () => currentPlayer && currentPlayer.next(),
    onPrev: () => currentPlayer && currentPlayer.prev(),
  });

  if (playbackContext?.type === 'medley' && playbackContext.medleyId === medleyId && currentPlayer) {
    reflectPlaybackState();
  }
}

function startMedleyPlayback(medleyId, tracks) {
  disposeCurrentPlayer();
  currentPlayer = new MedleyPlayer(tracks, {
    onTrackChange: (track) => {
      updateMediaSessionMetadata(track);
      reflectPlaybackState();
    },
    onPlayStateChange: () => reflectPlaybackState(),
    onFailureStop: () => reflectPlaybackState(),
  });
  playbackContext = { type: 'medley', medleyId };
  currentPlayer.start();
}

// --- 検索タブ（FR-6.1） ---

function startAlbumPlayback(tracks, { shuffle, albumName }) {
  previewPlayer.stop();
  disposeCurrentPlayer();
  const ordered = orderAlbumTracks(tracks, shuffle);
  currentPlayer = new MedleyPlayer(ordered, {
    onTrackChange: (track) => {
      updateMediaSessionMetadata(track);
      reflectPlaybackState();
    },
    onPlayStateChange: () => reflectPlaybackState(),
    onFailureStop: () => reflectPlaybackState(),
  });
  playbackContext = { type: 'album', albumName };
  currentPlayer.start();
  reflectPlaybackState();
}

/** カート内の曲IDを、表示用データに解決する（カートの並び順を保つ） */
async function resolveCartTracks() {
  if (cart.length === 0) return [];
  try {
    const { available } = await fetchTrackInfoByIds(cart);
    const byId = new Map(available.map((t) => [String(t.id), t]));
    return cart.map((id) => byId.get(String(id))).filter(Boolean);
  } catch {
    return [];
  }
}

/** 検索結果1曲を、選んだメドレーへ単体で追加する（FR-2.4） */
async function handleAddSingleTrack(track) {
  const medleys = await getAllMedleys();
  const targetId = await showMedleyPicker(medleys);
  if (!targetId) return;
  const medley = await getMedley(targetId);
  if (!medley) return;

  if (isDuplicateTrack(medley, track.id)) {
    await showMessage({ title: '追加済み', message: `「${track.title}」は、すでに「${medley.name}」に追加されています。` });
    return;
  }
  const { medley: updated } = addTrackToMedley(medley, track.id);
  await saveMedley(updated);
  await showMessage({ title: '追加しました', message: `「${track.title}」を「${medley.name}」に追加しました。` });
  if (activeTab === 'medley' && medleyView.screen === 'detail' && medleyView.medleyId === targetId) {
    showMedleyDetail(targetId);
  }
}

/** カートで選んだ曲を、選んだメドレーへ一括追加する（FR-1.13） */
async function handleAddFromCart(trackIds) {
  if (trackIds.length === 0) return;
  const medleys = await getAllMedleys();
  const targetId = await showMedleyPicker(medleys);
  if (!targetId) return;
  const medley = await getMedley(targetId);
  if (!medley) return;

  const { toAdd, alreadyInMedley } = partitionCartForMedley(trackIds, medley);
  let updated = medley;
  for (const id of toAdd) {
    updated = addTrackToMedley(updated, id).medley;
  }
  if (toAdd.length > 0) await saveMedley(updated);

  cart = removeManyFromCart(cart, toAdd);
  persistCart(cart);

  const summary = alreadyInMedley.length > 0
    ? `${toAdd.length}曲を「${medley.name}」に追加しました。（${alreadyInMedley.length}曲は既に追加済みのため追加しませんでした）`
    : `${toAdd.length}曲を「${medley.name}」に追加しました。`;
  await showMessage({ title: '追加しました', message: summary });

  if (activeTab === 'medley' && medleyView.screen === 'detail' && medleyView.medleyId === targetId) {
    showMedleyDetail(targetId);
  }
}

function showSearchTab() {
  renderSearchView(mainContent, { previewPlayer }, {
    onSearchFreeword: (term, offset, limit) => fetchSearchResults(term, 'jp', offset, limit),
    onSearchArtists: (term) => fetchArtists(term),
    onArtistAlbums: (artistId) => fetchArtistAlbums(artistId),
    onAlbumTracks: (collectionId) => fetchAlbumTracks(collectionId),
    onAddTrack: (track) => handleAddSingleTrack(track),
    isInCart: (trackId) => isInCartModel(cart, trackId),
    onToggleCart: (track, checked) => {
      cart = checked ? addToCartModel(cart, track.id) : removeFromCartModel(cart, track.id);
      persistCart(cart);
    },
    onPlayAlbum: (tracks, opts) => startAlbumPlayback(tracks, opts),
    cartCount: () => cart.length,
    getCartTracks: () => resolveCartTracks(),
    onRemoveFromCart: (trackId) => {
      cart = removeFromCartModel(cart, trackId);
      persistCart(cart);
    },
    onAddSelectedFromCart: (trackIds) => handleAddFromCart(trackIds),
  });
}

renderMain();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // オフライン対応は必須要件ではないため、失敗しても致命的ではない
  });
}
