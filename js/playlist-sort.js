// プレイリスト詳細画面の曲一覧の並び順（FR-2.11）。
// 表示専用の並び替えであり、保存データ（trackIdsの順序）・再生順（ランダム再生）には影響しない。
// CR-064：同一アーティスト内は、さらに同一アルバムの曲をまとめ、アルバム内は収録順
// （トラック番号順）に並べる。アルバムが異なる曲同士、またはトラック番号を持たない曲は、
// 従来通り曲を追加した順で並べる。

/**
 * 曲一覧をアーティスト名順に並び替える。同一アーティスト内は、同一アルバムの曲をまとめ、
 * アルバム内は収録順（トラック番号順）に並べる（CR-064）。アルバムが異なる曲同士、または
 * アルバム名・トラック番号を持たない曲は、渡された配列の順序（＝曲を追加した順）のまま扱う。
 * @param {Array<{artist: string, album?: string, trackNumber?: number|null}>} tracks
 * @returns {Array} 並び替えた新しい配列（引数の配列は変更しない）
 */
export function sortTracksByArtist(tracks) {
  const indexed = tracks.map((track, addedOrder) => ({ track, addedOrder }));
  // Array.prototype.sortは安定ソートのため、同一アーティスト内は元の追加順を保ったまま並ぶ
  indexed.sort((a, b) => (a.track.artist || '').localeCompare(b.track.artist || ''));

  const result = [];
  let start = 0;
  while (start < indexed.length) {
    let end = start + 1;
    while (end < indexed.length && (indexed[end].track.artist || '') === (indexed[start].track.artist || '')) {
      end++;
    }
    result.push(...groupByAlbum(indexed.slice(start, end)));
    start = end;
  }
  return result.map((entry) => entry.track);
}

/**
 * 同一アーティスト内（追加順で渡される）を、同一アルバムの曲でまとめ、アルバム内は
 * トラック番号順に並べ替える。アルバムのまとまり自体は、そのアルバムから最初に
 * 追加した曲の位置に置く（CR-064）。アルバムを持たない曲は、他の曲との相対位置を変えない。
 */
function groupByAlbum(entries) {
  const albumFirstPos = new Map();
  entries.forEach(({ track }, pos) => {
    if (track.album && !albumFirstPos.has(track.album)) albumFirstPos.set(track.album, pos);
  });

  const decorated = entries.map((entry, pos) => {
    const { album, trackNumber } = entry.track;
    const clusterPos = album ? albumFirstPos.get(album) : pos;
    const hasTrackNumber = !!album && typeof trackNumber === 'number';
    return { entry, clusterPos, sortKey: hasTrackNumber ? trackNumber : Infinity, pos };
  });
  decorated.sort((a, b) => a.clusterPos - b.clusterPos || a.sortKey - b.sortKey || a.pos - b.pos);
  return decorated.map((d) => d.entry);
}
