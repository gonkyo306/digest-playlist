// フェーズ1：データの土台
// メドレー・曲のデータ構造と、それに対する純粋なロジック（DOM・保存処理には依存しない）。
// 対応基準: FR-2.1, FR-2.6, FR-2.7, FR-3.2

/**
 * 新しいメドレーを作る。
 * 保存する内容は曲の識別情報（trackId）のみ（FR-3.2）。曲名・ジャケット等は保存しない。
 * @param {string} name
 * @returns {object} medley
 */
export function createMedley(name) {
  const now = Date.now();
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `medley_${now}_${Math.random().toString(36).slice(2)}`,
    name,
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** メドレーの名前を変更した新しいオブジェクトを返す（FR-2.2） */
export function renameMedley(medley, newName) {
  return { ...medley, name: newName, updatedAt: Date.now() };
}

/**
 * 曲IDが、すでにメドレーに含まれているか判定する。
 * 重複の判定は曲IDが同じ場合のみ。別収録版（別ID）は重複とみなさない（FR-2.6 / 9-2）。
 */
export function isDuplicateTrack(medley, trackId) {
  return medley.trackIds.includes(trackId);
}

/**
 * メドレーに曲を追加する。重複（同一ID）の場合は変更せず、そのまま返す（FR-2.6）。
 * 曲数の上限は設けない（FR-2.7）。
 * @returns {{medley: object, added: boolean}}
 */
export function addTrackToMedley(medley, trackId) {
  if (isDuplicateTrack(medley, trackId)) {
    return { medley, added: false };
  }
  return {
    medley: { ...medley, trackIds: [...medley.trackIds, trackId], updatedAt: Date.now() },
    added: true,
  };
}

/** メドレーから曲を削除する（FR-2.5） */
export function removeTrackFromMedley(medley, trackId) {
  return {
    ...medley,
    trackIds: medley.trackIds.filter((id) => id !== trackId),
    updatedAt: Date.now(),
  };
}

/** 保存用にシリアライズ可能な形かどうかを検証する（storage.js から利用） */
export function isValidMedley(obj) {
  return !!obj
    && typeof obj.id === 'string'
    && typeof obj.name === 'string'
    && Array.isArray(obj.trackIds)
    && obj.trackIds.every((t) => typeof t === 'string' || typeof t === 'number');
}
