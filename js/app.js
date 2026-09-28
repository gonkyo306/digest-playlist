// アプリ本体のエントリポイント。
// フェーズ7〜11：「プレイリスト」「検索」の2タブ構成（FR-6.1）、再生の永続化・ミニプレイヤー
// （FR-4.16, FR-4.17）、検索の拡張（FR-1.1, 1.8〜1.13）、アーティスト順ソート（FR-2.11）を統合する。
// フェーズ14〜19（CR-016〜029）：再生パネル廃止・ミニプレイヤー集約、試聴のミニプレイヤー統合、
// 検索の統合とドリルダウン、タブ間の状態保持、カート廃止とその場一括追加、
// 追加先プレイリストの記憶、細部の品質改善をまとめて反映する。

import { getAllPlaylists, getPlaylist, savePlaylist, deletePlaylist } from './storage.js';
import {
  createPlaylist,
  renamePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from './models.js';
import { fetchTrackInfoByIds } from './track-api.js';
import { fetchSearchResults } from './search-api.js';
import {
  fetchArtistsLimited, fetchAlbumsByTerm, fetchArtistAlbums, fetchAlbumTracks,
} from './staged-search-api.js';
import { orderAlbumTracks } from './album-playback.js';
import { PreviewPlayer } from './preview-player.js';
import { PlaylistPlayer } from './playlist-player.js';
import { renderPlaylistList } from './views/playlist-list-view.js';
import { renderPlaylistDetail, updateNowPlayingTrack } from './views/playlist-detail-view.js';
import { renderSearchView } from './views/search-view.js';
import { renderTabBar } from './views/tab-bar-view.js';
import { renderMiniPlayer } from './views/mini-player-view.js';
import { showAddDestinationPicker } from './views/playlist-picker-dialog.js';
import { showMessage } from './views/dialog.js';

const playlistPaneEl = document.getElementById('playlist-pane');
const searchPaneEl = document.getElementById('search-pane');
const tabBarEl = document.getElementById('tab-bar');
const miniPlayerEl = document.getElementById('mini-player');

// --- 試聴（FR-1.5）：CR-020/023でミニプレイヤーにも表示する ---
let previewTrack = null; // 試聴中の曲（表示用データ）。試聴していなければnull
const realPreviewPlayer = new PreviewPlayer({
  onStop: () => {
    previewTrack = null;
    renderMiniPlayerBar();
  },
});
// FR-1.6: 試聴が始まったら、再生中のプレイリスト／アルバム一時再生を一時停止する。
const previewPlayer = {
  get isPlaying() {
    return realPreviewPlayer.isPlaying;
  },
  get currentTrackId() {
    return realPreviewPlayer.currentTrackId;
  },
  play(track) {
    if (currentPlayer) currentPlayer.pauseForPreview();
    previewTrack = track;
    realPreviewPlayer.play(track);
    renderMiniPlayerBar();
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

// --- CR-025：直前に追加した先のプレイリストIDを記憶する（アプリのセッション内のみ） ---
let lastUsedPlaylistId = null;

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

/**
 * 再生中の曲一覧ハイライト（CR-022）・ミニプレイヤー（CR-016）へ、再生状態を反映する。
 * CR-016：再生パネルを廃止したため、詳細画面を見ているかどうかに関わらず、
 * 再生中は常にミニプレイヤーを表示する。
 */
function reflectPlaybackState() {
  if (playbackContext?.type === 'playlist'
    && playlistView.screen === 'detail'
    && playlistView.playlistId === playbackContext.playlistId) {
    updateNowPlayingTrack(playlistPaneEl, currentPlayer ? currentPlayer.currentTrack()?.id ?? null : null);
  }
  renderMiniPlayerBar();
}

/** ミニプレイヤーの表示を更新する（試聴中はCR-020/023、本編再生中はCR-016） */
function renderMiniPlayerBar() {
  if (previewTrack) {
    renderMiniPlayer(
      miniPlayerEl,
      { track: previewTrack, playing: true, isPreview: true },
      { onTogglePlayPause: () => previewPlayer.stop() }
    );
    return;
  }
  if (!currentPlayer || !playbackContext) {
    renderMiniPlayer(miniPlayerEl, null, {});
    return;
  }
  renderMiniPlayer(
    miniPlayerEl,
    {
      track: currentPlayer.currentTrack(),
      playing: currentPlayer.playing,
      canGoBack: currentPlayer.history.canGoBack(),
    },
    {
      onTogglePlayPause: () => currentPlayer.togglePlayPause(),
      onNext: () => currentPlayer.next(),
      onPrev: () => currentPlayer.prev(),
      onTap: () => {
        if (playbackContext.type === 'playlist') {
          activeTab = 'playlist';
          playlistView = { screen: 'detail', playlistId: playbackContext.playlistId };
          showPlaylistDetail(playlistView.playlistId);
        } else {
          activeTab = 'search';
        }
        applyTabVisibility();
      },
    }
  );
}

function renderTabBarUi() {
  renderTabBar(tabBarEl, activeTab, (tab) => {
    if (tab === activeTab) {
      // 既に表示中のタブの再タップ：そのタブのトップ画面へリセットする（CR-030、FR-6.2）
      if (tab === 'playlist') {
        showPlaylistList();
      } else {
        mountSearchTab(); // 検索ビューを作り直し、検索語・検索結果も含めて完全に空の状態に戻す（FR-1.18）
      }
      return;
    }
    activeTab = tab;
    applyTabVisibility();
  });
}

/** CR-019：タブ切替では検索・プレイリストどちらのDOMも再生成せず、表示/非表示だけ切り替える */
function applyTabVisibility() {
  renderTabBarUi();
  playlistPaneEl.classList.toggle('tab-pane-hidden', activeTab !== 'playlist');
  searchPaneEl.classList.toggle('tab-pane-hidden', activeTab !== 'search');
  renderMiniPlayerBar();
}

// --- プレイリストタブ ---

async function showPlaylistList() {
  playlistView = { screen: 'list' };
  const playlists = await getAllPlaylists();
  playlists.sort((a, b) => b.updatedAt - a.updatedAt);
  renderPlaylistList(playlistPaneEl, playlists, {
    onOpen: (id) => {
      playlistView = { screen: 'detail', playlistId: id };
      showPlaylistDetail(id);
    },
    onCreate: async (name) => {
      await savePlaylist(createPlaylist(name));
      showPlaylistList();
    },
  });
  renderMiniPlayerBar();
}

async function showPlaylistDetail(playlistId) {
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

  renderDetailScreen(playlist, available, unavailableIds, fetchError);
}

/**
 * プレイリスト詳細画面を描画する。曲情報の取得（ネットワーク通信）は伴わないため、
 * 再生開始直後など「取得済みのデータのまま、再生状態の表示だけを更新したい」場面でも使う。
 */
function renderDetailScreen(playlist, available, unavailableIds, fetchError) {
  const playlistId = playlist.id;
  const isCurrentlyPlaying = playbackContext?.type === 'playlist' && playbackContext.playlistId === playlistId;
  const nowPlayingTrackId = isCurrentlyPlaying && currentPlayer ? currentPlayer.currentTrack()?.id ?? null : null;

  renderPlaylistDetail(playlistPaneEl, {
    playlist, tracks: available, unavailableIds, fetchError, isCurrentlyPlaying, nowPlayingTrackId,
  }, {
    onBack: () => {
      playlistView = { screen: 'list' };
      showPlaylistList();
    },
    onRemoveTrack: async (trackId) => {
      const updated = removeTrackFromPlaylist(playlist, trackId);
      await savePlaylist(updated);
      if (playbackContext?.type === 'playlist' && playbackContext.playlistId === playlistId) disposeCurrentPlayer();
      showPlaylistDetail(playlistId);
    },
    onStartPlayback: () => {
      startPlaylistPlayback(playlistId, available);
      // 再生ボタンを非表示にし、ミニプレイヤーに操作を委ねるため、詳細画面を再描画する（CR-016）。
      // 曲情報は取得済みのため、再取得はしない。
      renderDetailScreen(playlist, available, unavailableIds, fetchError);
    },
    onTrackTap: (trackId) => {
      // タップした曲を1曲目にして再生を始める（CR-032、FR-2.13）
      const startIndex = available.findIndex((t) => t.id === trackId);
      startPlaylistPlayback(playlistId, available, startIndex === -1 ? undefined : startIndex);
      renderDetailScreen(playlist, available, unavailableIds, fetchError);
    },
    onRename: async (newName) => {
      await savePlaylist(renamePlaylist(playlist, newName));
      showPlaylistDetail(playlistId);
    },
    onDelete: async () => {
      if (playbackContext?.type === 'playlist' && playbackContext.playlistId === playlistId) disposeCurrentPlayer();
      await deletePlaylist(playlistId);
      playlistView = { screen: 'list' };
      showPlaylistList();
    },
  });
  renderMiniPlayerBar();
}

function startPlaylistPlayback(playlistId, tracks, startIndex) {
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
  currentPlayer.start(startIndex);
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

/**
 * 検索結果で選んだ曲（複数可）を、選んだプレイリストへその場で一括追加する（FR-1.13、CR-021/024）。
 * 既に追加先に含まれている曲は、追加後の完了メッセージで件数を知らせる（選択前のグレーアウトは、
 * 追加先が選択時点では未確定のため行わない。docs/plan-cr-implementation.md参照）。
 * @param {Array<string|number>} trackIds
 * @returns {Promise<boolean>} 実際に追加処理まで進んだ場合はtrue、キャンセルした場合はfalse
 */
async function handleBulkAdd(trackIds) {
  if (trackIds.length === 0) return false;
  const playlists = await getAllPlaylists();
  const targetId = await showAddDestinationPicker(playlists, { lastUsedPlaylistId });
  if (!targetId) return false;
  const playlist = await getPlaylist(targetId);
  if (!playlist) return false;

  let updated = playlist;
  let addedCount = 0;
  for (const id of trackIds) {
    const result = addTrackToPlaylist(updated, id);
    if (result.added) {
      updated = result.playlist;
      addedCount += 1;
    }
  }
  if (addedCount > 0) await savePlaylist(updated);
  lastUsedPlaylistId = targetId;

  const skippedCount = trackIds.length - addedCount;
  const summary = skippedCount > 0
    ? `${addedCount}曲を「${playlist.name}」に追加しました。（${skippedCount}曲は既に追加済みのため追加しませんでした）`
    : `${addedCount}曲を「${playlist.name}」に追加しました。`;
  await showMessage({ title: '追加しました', message: summary });

  if (playlistView.screen === 'detail' && playlistView.playlistId === targetId) {
    showPlaylistDetail(targetId);
  }
  return true;
}

function mountSearchTab() {
  renderSearchView(searchPaneEl, { previewPlayer }, {
    onSearchTracks: (term, offset, limit) => fetchSearchResults(term, 'jp', offset, limit),
    onSearchArtists: (term) => fetchArtistsLimited(term),
    onSearchAlbums: (term) => fetchAlbumsByTerm(term),
    onArtistAlbums: (artistId) => fetchArtistAlbums(artistId),
    onAlbumTracks: (collectionId) => fetchAlbumTracks(collectionId),
    onPlayAlbum: (tracks, opts) => startAlbumPlayback(tracks, opts),
    onBulkAdd: (trackIds) => handleBulkAdd(trackIds),
  });
}

// --- 起動 ---
showPlaylistList();
mountSearchTab();
applyTabVisibility();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // オフライン対応は必須要件ではないため、失敗しても致命的ではない
  });
}
