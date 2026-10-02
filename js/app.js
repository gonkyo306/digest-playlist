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
  setPlaylistImage,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from './models.js';
import { fetchTrackInfoByIds } from './track-api.js';
import { fetchSearchResults } from './search-api.js';
import {
  fetchArtistsLimited, fetchAlbumsByTerm, fetchArtistAlbums, fetchAlbumTracks,
} from './staged-search-api.js';
import { orderAlbumTracks } from './album-playback.js';
import { sortTracksByArtist } from './playlist-sort.js';
import { resolvePlaylistArtwork, resolvePlaylistsArtwork } from './playlist-artwork.js';
import { PreviewPlayer } from './preview-player.js';
import { PlaylistPlayer } from './playlist-player.js';
import { renderPlaylistList } from './views/playlist-list-view.js';
import { renderPlaylistDetail } from './views/playlist-detail-view.js';
import { openPlaylistCreateSheet } from './views/playlist-create-view.js';
import { renderSearchView } from './views/search-view.js';
import { renderTabBar } from './views/tab-bar-view.js';
import { renderMiniPlayer } from './views/mini-player-view.js';
import { pushBackState, popBackState } from './back-stack.js';

const playlistPaneEl = document.getElementById('playlist-pane');
const searchPaneEl = document.getElementById('search-pane');
const tabBarEl = document.getElementById('tab-bar');
const miniPlayerEl = document.getElementById('mini-player');

// --- 試聴（FR-1.5）：CR-020/023でミニプレイヤーにも表示する ---
let previewTrack = null; // 試聴中の曲（表示用データ）。試聴していなければnull
const realPreviewPlayer = new PreviewPlayer({
  // 不具合修正：別の曲へ切り替える際、PreviewPlayer.play()は内部でstop()を呼び、
  // 直前の曲のonStopが同期的に発火する（新しい曲のpreviewTrackへの代入より後に実行される）。
  // ここでstoppedIdを見ずに一律previewTrack=nullとしていたため、切り替え後のpreviewTrackが
  // 消されてしまい、他の曲をタップしても再生されないように見える不具合があった。
  // 「いま止めようとしている曲」が、表示中のpreviewTrackと同じ場合だけクリアする。
  onStop: (stoppedId) => {
    if (previewTrack && previewTrack.id === stoppedId) {
      previewTrack = null;
      renderMiniPlayerBar();
    }
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
// { screen: 'list' } | { screen: 'detail', playlistId }（プレイリスト作成は下から現れるシート表示で、
// 一覧画面の上に重ねるため、ここでは別画面として扱わない。フェーズ41）
let playlistView = { screen: 'list' };

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
  // CR-068：前の曲へ戻る機能自体を廃止（FR-4.10改訂）したため、ロック画面/通知の「前へ」も無効化する
  navigator.mediaSession.setActionHandler('previoustrack', null);
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
 * ミニプレイヤー（CR-016）へ、再生状態を反映する。
 * CR-016：再生パネルを廃止したため、詳細画面を見ているかどうかに関わらず、
 * 再生中は常にミニプレイヤーを表示する。曲一覧側のハイライト表示（CR-022）は、
 * ミニプレイヤーで確認できるため廃止した（フェーズ22）。
 */
function reflectPlaybackState() {
  renderMiniPlayerBar();
  // フェーズ41：ロック画面・通知の再生/一時停止の表示も、画面（ミニプレイヤー）と同じ状態にそろえる
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = !currentPlayer ? 'none' : (currentPlayer.playing ? 'playing' : 'paused');
  }
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
      // 曲の読み込み待ち（再生が始まる直前）も再生中として表示し、切り替えのたびにアイコンが揺れないようにする
      playing: currentPlayer.playing || currentPlayer.loading,
      finished: currentPlayer.finished,
    },
    {
      onTogglePlayPause: () => currentPlayer.togglePlayPause(),
      onNext: () => currentPlayer.next(),
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
    // プレイリストタブ側での作成・削除を反映するため、検索タブへ切り替わるたびに
    // 追加先プレイリストの常時表示（FR-1.19）を再解決する（再マウントはしないため、
    // 検索語・ドリルダウン位置はFR-1.17の通り保持される）
    if (tab === 'search' && searchViewApi) searchViewApi.onTabActivated();
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

// CR-053（FR-6.3）：プレイリスト詳細を開いた際に、OSの戻る操作で一覧へ戻るための処理として
// history.pushStateとセットで使う
function goToPlaylistList() {
  playlistView = { screen: 'list' };
  showPlaylistList();
}

async function showPlaylistList() {
  playlistView = { screen: 'list' };
  const playlists = await getAllPlaylists();
  playlists.sort((a, b) => b.updatedAt - a.updatedAt);
  // CR-055（FR-2.9）：一覧の各行に代表画像を表示するため、表示前に解決しておく
  const artworkMap = await resolvePlaylistsArtwork(playlists, fetchTrackInfoByIds);
  const withArtwork = playlists.map((p) => ({ ...p, artwork: artworkMap.get(p.id) }));
  renderPlaylistList(playlistPaneEl, withArtwork, {
    onOpen: (id) => {
      playlistView = { screen: 'detail', playlistId: id };
      showPlaylistDetail(id);
      pushBackState(goToPlaylistList);
    },
    onCreateNew: () => showPlaylistCreate(),
  });
  renderMiniPlayerBar();
}

/**
 * プレイリスト作成画面（CR-043、FR-2.17）。フェーズ41：一覧画面の上に、画面下からスライドして
 * 現れるシートとして表示する（他のポップアップと同じ動き）。一覧画面自体は入れ替えない。
 */
function showPlaylistCreate() {
  openPlaylistCreateSheet({
    onCancel: () => {},
    onSave: async (name, imageBlob) => {
      await savePlaylist(createPlaylist(name, imageBlob));
      showPlaylistList();
    },
  });
}

async function showPlaylistDetail(playlistId) {
  playlistView = { screen: 'detail', playlistId };
  const playlist = await getPlaylist(playlistId);
  if (!playlist) {
    playlistView = { screen: 'list' };
    return showPlaylistList();
  }

  let available = [];
  let fetchError = null;
  if (playlist.trackIds.length) {
    try {
      ({ available } = await fetchTrackInfoByIds(playlist.trackIds));
    } catch (err) {
      fetchError = err.message || String(err);
    }
  }

  renderDetailScreen(playlist, available, fetchError);
}

/** プレイリスト詳細画面を描画する（フェーズ41：再生中も画面の内容は変わらないため、再生開始時の再描画はしない） */
function renderDetailScreen(playlist, available, fetchError) {
  const playlistId = playlist.id;

  renderPlaylistDetail(playlistPaneEl, { playlist, tracks: available, fetchError }, {
    onBack: () => {
      popBackState();
      goToPlaylistList();
    },
    onStartPlayback: (shuffleOn) => {
      // シャッフルOFF時は曲一覧の表示順（アーティスト名順）で再生する（CR-038、FR-2.16）
      const ordered = sortTracksByArtist(available);
      startPlaylistPlayback(playlistId, ordered, undefined, shuffleOn);
    },
    onTrackTap: (trackId, shuffleOn) => {
      // タップした曲を1曲目にして再生を始める（CR-032、FR-2.13）。シャッフルOFF時は表示順のまま
      // タップした曲の次から連続再生するため、表示順（アーティスト名順）で並べたtracksを使う（CR-038）
      const ordered = sortTracksByArtist(available);
      const startIndex = ordered.findIndex((t) => t.id === trackId);
      startPlaylistPlayback(playlistId, ordered, startIndex === -1 ? undefined : startIndex, shuffleOn);
    },
    onSaveEdit: async (newName, remainingTrackIds, newImageBlob) => {
      const removedIds = playlist.trackIds.filter((id) => !remainingTrackIds.includes(id));
      let updated = renamePlaylist(playlist, newName);
      removedIds.forEach((id) => { updated = removeTrackFromPlaylist(updated, id); });
      // CR-044（FR-2.19）：画像を変更した場合のみ確定する（undefinedのままなら変更なし）
      if (newImageBlob !== undefined) updated = setPlaylistImage(updated, newImageBlob);
      await savePlaylist(updated);
      if (removedIds.length && playbackContext?.type === 'playlist' && playbackContext.playlistId === playlistId) {
        disposeCurrentPlayer();
      }
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

function startPlaylistPlayback(playlistId, tracks, startIndex, shuffleOn = true) {
  // 不具合修正：試聴中に本編再生を始めても試聴の音声・ミニプレイヤー表示が残ってしまうため、
  // startAlbumPlaybackと同様、本編再生の開始前に試聴を止める（FR-1.6）
  previewPlayer.stop();
  disposeCurrentPlayer();
  currentPlayer = new PlaylistPlayer(tracks, {
    shuffle: shuffleOn,
    onTrackChange: (track) => {
      updateMediaSessionMetadata(track);
      reflectPlaybackState();
    },
    onPlayStateChange: () => reflectPlaybackState(),
    onFailureStop: () => reflectPlaybackState(),
    onPlaybackComplete: () => reflectPlaybackState(), // CR-063：一巡後の自動停止をミニプレイヤーに反映
  });
  playbackContext = { type: 'playlist', playlistId };
  currentPlayer.start(startIndex);
  // フェーズ41：再生の開始待ち（読み込み中）の曲からミニプレイヤーに表示する。曲を切り替えるときに
  // ミニプレイヤーが一瞬消えて、画面下部のレイアウトが上下に動いてしまうのを防ぐ
  reflectPlaybackState();
}

// --- 検索タブ（FR-6.1） ---

function startAlbumPlayback(tracks, { shuffle, albumName }) {
  previewPlayer.stop();
  disposeCurrentPlayer();
  const ordered = orderAlbumTracks(tracks, shuffle);
  currentPlayer = new PlaylistPlayer(ordered, {
    // orderAlbumTracksで既に並び順（収録順／シャッフル済み）を決定済みのため、
    // PlaylistPlayer側ではさらに並び替えず、orderedの並び順のまま再生する（不具合修正：
    // shuffle:falseを指定していないと、PlaylistPlayer自身が初期順序を毎回ランダムに
    // 組み直してしまい、シャッフルOFFでも実際には順不同で再生されていた）
    shuffle: false,
    onTrackChange: (track) => {
      updateMediaSessionMetadata(track);
      reflectPlaybackState();
    },
    onPlayStateChange: () => reflectPlaybackState(),
    onFailureStop: () => reflectPlaybackState(),
    onPlaybackComplete: () => reflectPlaybackState(), // CR-063：一巡後の自動停止をミニプレイヤーに反映
  });
  playbackContext = { type: 'album', albumName };
  currentPlayer.start();
  reflectPlaybackState();
}

/**
 * 検索結果の＋ボタンをタップした時点で、その1曲だけを現在の追加先プレイリストへ即座に
 * 追加する（FR-1.12、CR-047。複数選択→一括追加の方式は廃止した）。
 * @param {string} playlistId
 * @param {string|number} trackId
 * @returns {Promise<{added: boolean}>}
 */
async function handleInstantAdd(playlistId, trackId) {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) return { added: false };
  const result = addTrackToPlaylist(playlist, trackId);
  if (result.added) {
    await savePlaylist(result.playlist);
    lastUsedPlaylistId = playlistId;
    if (playlistView.screen === 'detail' && playlistView.playlistId === playlistId) {
      showPlaylistDetail(playlistId);
    } else if (playlistView.screen === 'list') {
      // 一覧画面の曲数表示が古いままにならないよう更新する（フェーズ22の不具合修正と同じ観点）
      showPlaylistList();
    }
  }
  return { added: result.added };
}

/**
 * その場（今回の＋タップ）で追加した曲の、取り消し可能なチップ（FR-1.21）をタップした時点で、
 * その1曲だけを追加先プレイリストから取り消す（フェーズ32、CR-056）。
 * @param {string} playlistId
 * @param {string|number} trackId
 * @returns {Promise<{removed: boolean}>}
 */
async function handleUndoRemove(playlistId, trackId) {
  const playlist = await getPlaylist(playlistId);
  if (!playlist) return { removed: false };
  const updated = removeTrackFromPlaylist(playlist, trackId);
  await savePlaylist(updated);
  if (playlistView.screen === 'detail' && playlistView.playlistId === playlistId) {
    showPlaylistDetail(playlistId);
  } else if (playlistView.screen === 'list') {
    showPlaylistList();
  }
  return { removed: true };
}

let searchViewApi = null;

function mountSearchTab() {
  searchViewApi = renderSearchView(searchPaneEl, { previewPlayer }, {
    onSearchTracks: (term, offset, limit) => fetchSearchResults(term, 'jp', offset, limit),
    onSearchArtists: (term) => fetchArtistsLimited(term),
    onSearchAlbums: (term) => fetchAlbumsByTerm(term),
    onArtistAlbums: (artistId) => fetchArtistAlbums(artistId),
    onAlbumTracks: (collectionId) => fetchAlbumTracks(collectionId),
    onPlayAlbum: (tracks, opts) => startAlbumPlayback(tracks, opts),
    onGetPlaylists: async () => {
      const playlists = await getAllPlaylists();
      playlists.sort((a, b) => b.updatedAt - a.updatedAt);
      return playlists;
    },
    onGetLastUsedPlaylistId: () => lastUsedPlaylistId,
    onResolveArtwork: (playlist) => resolvePlaylistArtwork(playlist, fetchTrackInfoByIds),
    onResolveArtworkForAll: (playlists) => resolvePlaylistsArtwork(playlists, fetchTrackInfoByIds),
    onAddTrack: (playlistId, trackId) => handleInstantAdd(playlistId, trackId),
    onRemoveTrack: (playlistId, trackId) => handleUndoRemove(playlistId, trackId),
    onCreatePlaylist: async (name, imageBlob) => {
      const created = createPlaylist(name, imageBlob);
      await savePlaylist(created);
      if (playlistView.screen === 'list') showPlaylistList();
      return created;
    },
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
