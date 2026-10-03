// データの土台
// プレイリスト・曲のデータ構造と、それに対する純粋なロジック（DOM・保存処理には依存しない）。
// 対応基準: FR-2.1, FR-2.6, FR-2.7, FR-3.2

/**
 * 新しいプレイリストを作る。
 * 保存する内容は曲の識別情報（trackId）と、任意のカスタム画像（coverImage）のみ（FR-3.2）。
 * 曲名・ジャケットURL等は保存しない。
 * @param {string} name
 * @param {Blob|null} [coverImage] プレイリスト作成画面（FR-2.17）で設定した画像（リサイズ・圧縮済み）
 * @returns {object} playlist
 */
export function createPlaylist(name, coverImage = null) {
  const now = Date.now();
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `playlist_${now}_${Math.random().toString(36).slice(2)}`,
    name,
    trackIds: [],
    coverImage: coverImage || null,
    createdAt: now,
    updatedAt: now,
  };
}

/** プレイリストの名前を変更した新しいオブジェクトを返す（FR-2.2） */
export function renamePlaylist(playlist, newName) {
  return { ...playlist, name: newName, updatedAt: Date.now() };
}

/** プレイリストの画像を設定・変更した新しいオブジェクトを返す（FR-2.17・FR-2.19） */
export function setPlaylistImage(playlist, coverImage) {
  return { ...playlist, coverImage: coverImage || null, updatedAt: Date.now() };
}

/**
 * 曲IDが、すでにプレイリストに含まれているか判定する。
 * 重複の判定は曲IDが同じ場合のみ。別収録版（別ID）は重複とみなさない（FR-2.6 / 9-2）。
 */
export function isDuplicateTrack(playlist, trackId) {
  return playlist.trackIds.includes(trackId);
}

/**
 * プレイリストに曲を追加する。重複（同一ID）の場合は変更せず、そのまま返す（FR-2.6）。
 * 曲数の上限は設けない（FR-2.7）。
 * @returns {{playlist: object, added: boolean}}
 */
export function addTrackToPlaylist(playlist, trackId) {
  if (isDuplicateTrack(playlist, trackId)) {
    return { playlist, added: false };
  }
  return {
    playlist: { ...playlist, trackIds: [...playlist.trackIds, trackId], updatedAt: Date.now() },
    added: true,
  };
}

/**
 * プレイリストに複数の曲をまとめて追加する（アルバムの全曲追加。FR-1.24）。既にある曲（同一ID）は
 * 飛ばし、新しく追加した曲のIDを、渡された順に返す（FR-2.6）。
 * @param {object} playlist
 * @param {Array<string|number>} trackIds
 * @returns {{playlist: object, addedIds: Array<string|number>}}
 */
export function addTracksToPlaylist(playlist, trackIds) {
  const existing = new Set(playlist.trackIds);
  const addedIds = [];
  trackIds.forEach((id) => {
    if (existing.has(id)) return;
    existing.add(id);
    addedIds.push(id);
  });
  if (addedIds.length === 0) return { playlist, addedIds };
  return {
    playlist: { ...playlist, trackIds: [...playlist.trackIds, ...addedIds], updatedAt: Date.now() },
    addedIds,
  };
}

/** プレイリストから複数の曲をまとめて削除する（全曲追加の取り消し。FR-1.24） */
export function removeTracksFromPlaylist(playlist, trackIds) {
  const removing = new Set(trackIds);
  return {
    ...playlist,
    trackIds: playlist.trackIds.filter((id) => !removing.has(id)),
    updatedAt: Date.now(),
  };
}

/** プレイリストから曲を削除する（FR-2.5） */
export function removeTrackFromPlaylist(playlist, trackId) {
  return {
    ...playlist,
    trackIds: playlist.trackIds.filter((id) => id !== trackId),
    updatedAt: Date.now(),
  };
}

/**
 * 保存用にシリアライズ可能な形かどうかを検証する（storage.js から利用）。
 * coverImageは任意項目で、未設定（undefined）・null・Blobのいずれかであれば有効とする。
 */
export function isValidPlaylist(obj) {
  return !!obj
    && typeof obj.id === 'string'
    && typeof obj.name === 'string'
    && Array.isArray(obj.trackIds)
    && obj.trackIds.every((t) => typeof t === 'string' || typeof t === 'number')
    && (obj.coverImage === undefined || obj.coverImage === null || obj.coverImage instanceof Blob);
}
