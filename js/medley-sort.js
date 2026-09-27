// メドレー詳細画面の曲一覧の並び順（FR-2.11）。
// 表示専用の並び替えであり、保存データ（trackIdsの順序）・再生順（ランダム再生）には影響しない。

/**
 * 曲一覧をアーティスト名順に並び替える。同一アーティスト内は、渡された配列の順序
 * （＝曲を追加した順）を保つ（Array.prototype.sortは安定ソートであることを利用）。
 * @param {Array<{artist: string}>} tracks
 * @returns {Array} 並び替えた新しい配列（引数の配列は変更しない）
 */
export function sortTracksByArtist(tracks) {
  return [...tracks].sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
}
