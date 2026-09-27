// アプリ本体のエントリポイント。
// フェーズ3までの内容：メドレー一覧・詳細・検索/試聴/追加の画面遷移を扱う。
// 再生機能（フェーズ4）は未実装（メドレー詳細に「再生」導線はまだない）。

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
import { renderMedleyList } from './views/medley-list-view.js';
import { renderMedleyDetail } from './views/medley-detail-view.js';
import { renderSearchView } from './views/search-view.js';

const app = document.getElementById('app');
const previewPlayer = new PreviewPlayer();

async function showList() {
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
    showList();
    return;
  }
  const { available, unavailableIds } = medley.trackIds.length
    ? await fetchTrackInfoByIds(medley.trackIds)
    : { available: [], unavailableIds: [] };

  renderMedleyDetail(app, { medley, tracks: available, unavailableIds }, {
    onBack: () => showList(),
    onAddTrack: () => showSearch(medleyId),
    onRemoveTrack: async (trackId) => {
      const updated = removeTrackFromMedley(medley, trackId);
      await saveMedley(updated);
      showDetail(medleyId);
    },
  });
}

function showSearch(medleyId) {
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
