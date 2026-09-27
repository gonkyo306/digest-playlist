// 検索で見つけたアルバムの全曲一時再生の並び順（FR-1.11）。
// メドレーへの追加を伴わない、その場限りの一時再生であり、再生自体はMedleyPlayerをそのまま流用する。

/**
 * アルバムの全曲再生順を決める。シャッフルなしの場合はアルバムの収録順のまま、
 * シャッフルありの場合はランダムな順序（Fisher–Yatesシャッフル）にする。
 * @param {Array} tracks アルバムの収録曲（表示用に整形済み）
 * @param {boolean} shuffle
 * @param {() => number} [randomFn] テスト用に差し替え可能な乱数関数（既定: Math.random）
 * @returns {Array} 再生順に並んだ新しい配列（引数の配列は変更しない）
 */
export function orderAlbumTracks(tracks, shuffle, randomFn = Math.random) {
  if (!shuffle) return [...tracks];
  const arr = [...tracks];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
