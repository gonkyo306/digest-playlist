// アプリ本体のエントリポイント。
// フェーズ4までの内容：メドレー一覧・詳細・検索/試聴/追加・メドレー本編の再生を扱う。

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
import { PreviewPlayer } from './preview-player.js';
import { MedleyPlayer } from './medley-player.js';
import { renderMedleyList } from './views/medley-list-view.js';
import { renderMedleyDetail, updatePlaybackPanel } from './views/medley-detail-view.js';
import { renderSearchView } from './views/search-view.js';

const app = document.getElementById('app');
const previewPlayer = new PreviewPlayer();

/** @type {MedleyPlayer|null} */
let currentPlayer = null;
let currentPlayerMedleyId = null;

function disposeCurrentPlayer() {
  if (currentPlayer) {
    currentPlayer.dispose();
    currentPlayer = null;
    currentPlayerMedleyId = null;
  }
}

function reflectPlaybackPanel() {
  if (!currentPlayer) return;
  updatePlaybackPanel(app, {
    track: currentPlayer.currentTrack(),
    playing: currentPlayer.playing,
    canGoBack: currentPlayer.history.canGoBack(),
    stopped: currentPlayer.stopped,
    offlinePaused: currentPlayer.pausedByOffline,
  });
}

// --- 通信状態の検知（FR-4.13） ---
window.addEventListener('offline', () => currentPlayer && currentPlayer.handleOffline());
window.addEventListener('online', () => currentPlayer && currentPlayer.handleOnline());

// --- ロック画面・通知からの操作（FR-4.12） ---
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

async function showList() {
  disposeCurrentPlayer();
  previewPlayer.stop();
  const medleys = await getAllMedleys();
  medleys.sort((a, b) => b.updatedAt - a.updatedAt);
  renderMedleyList(app, medleys, {
    onOpen: (id) => showDetail(id),
    onCreate: async (name) => {
      await saveMedley(createMedley(name));
      showList();
    },
    onRename: async (id, newName) => {
      const medley = await getMedley(id);
      if (!medley) return showList();
      await saveMedley(renameMedley(medley, newName));
      showList();
    },
    onDelete: async (id) => {
      await deleteMedley(id);
      showList();
    },
  });
}

async function showDetail(medleyId) {
  previewPlayer.stop();
  const medley = await getMedley(medleyId);
  if (!medley) {
    disposeCurrentPlayer();
    showList();
    return;
  }
  // 通信エラー時も操作不能にならないよう、失敗してもアプリ全体は止めない（NFR-2.3）
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

  // 別のメドレーを再生中だった場合は、そちらを止める
  if (currentPlayerMedleyId && currentPlayerMedleyId !== medleyId) {
    disposeCurrentPlayer();
  }

  renderMedleyDetail(app, { medley, tracks: available, unavailableIds, fetchError }, {
    onBack: () => showList(),
    onAddTrack: () => showSearch(medleyId),
    onRemoveTrack: async (trackId) => {
      const updated = removeTrackFromMedley(medley, trackId);
      await saveMedley(updated);
      disposeCurrentPlayer();
      showDetail(medleyId);
    },
    onStartPlayback: () => {
      if (!currentPlayer || currentPlayerMedleyId !== medleyId) {
        currentPlayer = new MedleyPlayer(available, {
          onTrackChange: (track) => {
            updateMediaSessionMetadata(track);
            reflectPlaybackPanel();
          },
          onPlayStateChange: () => reflectPlaybackPanel(),
          onFailureStop: () => reflectPlaybackPanel(),
        });
        currentPlayerMedleyId = medleyId;
      }
      currentPlayer.start();
    },
    onTogglePlayPause: () => currentPlayer && currentPlayer.togglePlayPause(),
    onNext: () => currentPlayer && currentPlayer.next(),
    onPrev: () => currentPlayer && currentPlayer.prev(),
  });

  // 検索画面から戻ってきた直後など、既に再生中のプレーヤーがあれば状態を反映する（FR-1.6）
  if (currentPlayer && currentPlayerMedleyId === medleyId) {
    reflectPlaybackPanel();
  }
}

function showSearch(medleyId) {
  // 検索結果の試聴を始める前に、再生中のメドレーがあれば一時停止する（FR-1.6）。
  // 検索画面を出た後も自動では再開しない。
  if (currentPlayer && currentPlayerMedleyId === medleyId) {
    currentPlayer.pauseForPreview();
  }
  renderSearchView(app, { previewPlayer }, {
    onBack: () => showDetail(medleyId),
    onSearch: (term) => fetchSearchResults(term),
    onAdd: async (trackId) => {
      const medley = await getMedley(medleyId);
      if (!medley) return false;
      const { medley: updated, added } = addTrackToMedley(medley, trackId);
      if (added) await saveMedley(updated);
      return added;
    },
    isDuplicate: async (trackId) => {
      const medley = await getMedley(medleyId);
      return medley ? isDuplicateTrack(medley, trackId) : false;
    },
  });
}

showList();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // オフライン対応は必須要件ではないため、失敗しても致命的ではない
  });
}
