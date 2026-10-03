// 前回再生したプレイリストのIDを、端末内（localStorage）に記憶する（FR-2.20）。
// プレイリスト一覧の先頭に「前回のプレイリスト」カードを出すために使う。
// localStorageが使えない（無効・容量超過等）場合は、記憶しないだけで、アプリの動作には影響しない。

const KEY = 'digest-playlist:last-played-playlist-id';

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

/** @returns {string|null} */
export function getLastPlayedPlaylistId(storage = defaultStorage()) {
  try {
    return storage?.getItem(KEY) || null;
  } catch {
    return null;
  }
}

/** @param {string|null} playlistId nullで記憶を消す */
export function setLastPlayedPlaylistId(playlistId, storage = defaultStorage()) {
  try {
    if (!storage) return;
    if (playlistId) storage.setItem(KEY, playlistId);
    else storage.removeItem(KEY);
  } catch {
    // 記憶できなくても致命的ではない
  }
}
