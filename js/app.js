// アプリ本体のエントリポイント。
// フェーズ7〜11：「プレイリスト」「検索」の2タブ構成（FR-6.1）、再生の永続化・ミニプレイヤー
// （FR-4.16, FR-4.17）、検索の拡張（FR-1.1, 1.8〜1.13）、アーティスト順ソート（FR-2.11）を統合する。

import { getAllPlaylists, getPlaylist, savePlaylist, deletePlaylist } from './storage.js';
import {
  createPlaylist,
  renamePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
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
  partitionCartForPlaylist,
} from './cart-model.js';
import { loadCart, persistCart } from './cart-storage.js';
import { PreviewPlayer } from './preview-player.js';
import { PlaylistPlayer } from './playlist-player.js';
import { renderPlaylistList } from './views/playlist-list-view.js';
import { renderPlaylistDetail, updatePlaybackPanel } from './views/playlist-detail-view.js';
import { renderSearchView } from './views/search-view.js';
import { renderTabBar } from './views/tab-bar-view.js';
import { renderMiniPlayer } from './views/mini-player-view.js';
import { showPlaylistPicker } from './views/playlist-picker-dialog.js';
import { showMessage } from './views/dialog.js';

const mainContent = document.getElementById('main-content');
const tabBarEl = document.getElementById('tab-bar');
const miniPlayerEl = document.getElementById('mini-player');

const realPreviewPlayer = new PreviewPlayer();
// FR-1.6: 試聴が始まったら、再生中のプレイリスト／アルバム一時再生を一時停止する。
// （検索がプレイリストから独立したので、「試聴の開始」そのものをフックする）
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
let activeTab = 'playlist'; // 'playlist' | 'search'
let playlistView = { screen: 'list' }; // { screen: 'list' } | { screen: 'detail', playlistId }

// --- 再生の永続化（FR-4.16）：画面遷移では破棄しない。新しい再生を始めるときだけ入れ替える ---
/** @type {PlaylistPlayer|null} */
let currentPlayer = null;
/** @type {{type: 'playlist', playlistId: string}|{type: 'album', albumName: string}|null} */
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

/** 今、プレイリスト詳細画面またはアルバム一時再生の「再生元」を見ているか（＝インライン表示で足りるか） */
function isViewingCurrentPlayback() {
  if (!currentPlayer || !playbackContext) return false;
  if (playbackContext.type === 'playlist') {
    return activeTab === 'playlist'
      && playlistView.screen === 'detail'
      && playlistView.playlistId === playbackContext.playlistId;
  }
  // アルバムの一時再生（FR-1.11）：検索タブを表示していれば、再生元相当とみなす
  return activeTab === 'search';
}

/** プレイリスト詳細画面のインラインパネル、またはミニプレイヤーへ、再生状態を反映する */
function reflectPlaybackState() {
  if (!currentPlayer) {
    renderMiniPlayerBar();
    return;
  }
  if (playbackContext?.type === 'playlist' && isViewingCurrentPlayback()) {
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
        if (playbackContext.type === 'playlist') {
          activeTab = 'playlist';
          playlistView = { screen: 'detail', playlistId: playbackContext.playlistId };
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
  if (activeTab === 'playlist') {
    if (playlistView.screen === 'detail') showPlaylistDetail(playlistView.playlistId);
    else showPlaylistList();
  } else {
    showSearchTab();
  }
  renderMiniPlayerBar();
}

// --- プレイリストタブ ---

async function showPlaylistList() {
  previewPlayer.stop();
  playlistView = { screen: 'list' };
  const playlists = await getAllPlaylists();
  playlists.sort((a, b) => b.updatedAt - a.updatedAt);
  renderPlaylistList(mainContent, playlists, {
    onOpen: (id) => {
      playlistView = { screen: 'detail', playlistId: id };
      renderMain();
    },
    onCreate: async (name) => {
      await savePlaylist(createPlaylist(name));
      showPlaylistList();
    },
    onRename: async (id, newName) => {
      const playlist = await getPlaylist(id);
      if (!playlist) return showPlaylistList();
      await savePlaylist(renamePlaylist(playlist, newName));
      showPlaylistList();
    },
    onDelete: async (id) => {
      if (playbackContext?.type === 'playlist' && playbackContext.playlistId === id) disposeCurrentPlayer();
      await deletePlaylist(id);
      showPlaylistList();
    },
  });
}

async function showPlaylistDetail(playlistId) {
  previewPlayer.stop();
  playlistView = { screen: 'detail', playlistId };
  const playlist = await getPlaylist(playlistId);
  if (!playlist) {
    playlistView = { screen: 'list' };
    return showPlaylistList();
  }

  let available = [];
  let unavailableIds = [];
  let fetchError = null;
  if (playlist.trackIds.length) {
    try {
      ({ available, unavailableIds } = await fetchTrackInfoByIds(playlist.trackIds));
    } catch (err) {
      fetchError = err.message || String(err);
    }
  }

  renderPlaylistDetail(mainContent, { playlist, tracks: available, unavailableIds, fetchError }, {
    onBack: () => {
      playlistView = { screen: 'list' };
      renderMain();
    },
    onRemoveTrack: async (trackId) => {
      const updated = removeTrackFromPlaylist(playlist, trackId);
      await savePlaylist(updated);
      if (playbackContext?.type === 'playlist' && playbackContext.playlistId === playlistId) disposeCurrentPlayer();
      showPlaylistDetail(playlistId);
    },
    onStartPlayback: () => startPlaylistPlayback(playlistId, available),
    onTogglePlayPause: () => currentPlayer && currentPlayer.togglePlayPause(),
    onNext: () => currentPlayer && currentPlayer.next(),
    onPrev: () => currentPlayer && currentPlayer.prev(),
  });

  if (playbackContext?.type === 'playlist' && playbackContext.playlistId === playlistId && currentPlayer) {
    reflectPlaybackState();
  }
}

function startPlaylistPlayback(playlistId, tracks) {
  disposeCurrentPlayer();
  currentPlayer = new PlaylistPlayer(tracks, {
    onTrackChange: (track) => {
      updateMediaSessionMetadata(track);
      reflectPlaybackState();
    },
    onPlayStateChange: () => reflectPlaybackState(),
    onFailureStop: () => reflectPlaybackState(),
  });
  playbackContext = { type: 'playlist', playlistId };
  currentPlayer.start();
}

// --- 検索タブ（FR-6.1） ---

function startAlbumPlayback(tracks, { shuffle, albumName }) {
  previewPlayer.stop();
  disposeCurrentPlayer();
  const ordered = orderAlbumTracks(tracks, shuffle);
  currentPlayer = new PlaylistPlayer(ordered, {
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

/** 検索結果1曲を、選んだプレイリストへ単体で追加する（FR-2.4） */
async function handleAddSingleTrack(track) {
  const playlists = await getAllPlaylists();
  const targetId = await showPlaylistPicker(playlists);
  if (!targetId) return;
  const playlist = await getPlaylist(targetId);
  if (!playlist) return;

  if (isDuplicateTrack(playlist, track.id)) {
    await showMessage({ title: '追加済み', message: `「${track.title}」は、すでに「${playlist.name}」に追加されています。` });
    return;
  }
  const { playlist: updated } = addTrackToPlaylist(playlist, track.id);
  await savePlaylist(updated);
  await showMessage({ title: '追加しました', message: `「${track.title}」を「${playlist.name}」に追加しました。` });
  if (activeTab === 'playlist' && playlistView.screen === 'detail' && playlistView.playlistId === targetId) {
    showPlaylistDetail(targetId);
  }
}

/** カートで選んだ曲を、選んだプレイリストへ一括追加する（FR-1.13） */
async function handleAddFromCart(trackIds) {
  if (trackIds.length === 0) return;
  const playlists = await getAllPlaylists();
  const targetId = await showPlaylistPicker(playlists);
  if (!targetId) return;
  const playlist = await getPlaylist(targetId);
  if (!playlist) return;

  const { toAdd, alreadyInPlaylist } = partitionCartForPlaylist(trackIds, playlist);
  let updated = playlist;
  for (const id of toAdd) {
    updated = addTrackToPlaylist(updated, id).playlist;
  }
  if (toAdd.length > 0) await savePlaylist(updated);

  cart = removeManyFromCart(cart, toAdd);
  persistCart(cart);

  const summary = alreadyInPlaylist.length > 0
    ? `${toAdd.length}曲を「${playlist.name}」に追加しました。（${alreadyInPlaylist.length}曲は既に追加済みのため追加しませんでした）`
    : `${toAdd.length}曲を「${playlist.name}」に追加しました。`;
  await showMessage({ title: '追加しました', message: summary });

  if (activeTab === 'playlist' && playlistView.screen === 'detail' && playlistView.playlistId === targetId) {
    showPlaylistDetail(targetId);
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
