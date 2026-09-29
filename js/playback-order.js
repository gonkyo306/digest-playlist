// フェーズ4：再生順の決定（曲順のランダム化・一巡後の再シャッフル）
// DOM・Audioに依存しない純粋なロジックなので、Unitテストで直接検証できる。
// 対応基準: FR-4.2（ランダム再生）, FR-4.3（一巡するまで重複なし）, FR-4.4（再シャッフル時、直前の曲を先頭にしない）
// フェーズ24（CR-038）：プレイリスト詳細画面にシャッフルON/OFF切り替えを追加するにあたり、
// シャッフルしない場合（曲一覧の表示順のまま再生する場合）の並び順もここに追加する（FR-2.16）。

/** Fisher–Yatesシャッフル。元の配列は変更しない */
export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 曲数から、初回の再生順（曲のインデックスの配列）を作る。
 * 一巡するまで重複しない（FR-4.3）。
 * @param {number} trackCount
 */
export function buildInitialOrder(trackCount) {
  const indices = Array.from({ length: trackCount }, (_, i) => i);
  return shuffle(indices);
}

/**
 * 指定した曲を先頭にした再生順を作る（CR-032：曲一覧の行タップで、その曲から再生を始める）。
 * 2曲目以降は、残りの曲をシャッフルした順になる。
 * @param {number} trackCount
 * @param {number} startIndex 先頭に置く曲のインデックス
 */
export function buildOrderStartingAt(trackCount, startIndex) {
  const rest = Array.from({ length: trackCount }, (_, i) => i).filter((i) => i !== startIndex);
  return [startIndex, ...shuffle(rest)];
}

/**
 * 一巡した後の再シャッフルを行う。曲が2曲以上ある場合、直前に再生した曲を
 * 新しい順番の先頭に置かない（FR-4.4）。1曲のみの場合はそのまま返す。
 * @param {number} trackCount
 * @param {number} lastTrackIndex 直前に再生した曲のインデックス
 */
export function reshuffleAvoidingRepeat(trackCount, lastTrackIndex) {
  const indices = Array.from({ length: trackCount }, (_, i) => i);
  if (trackCount <= 1) return indices;
  let order;
  do {
    order = shuffle(indices);
  } while (order[0] === lastTrackIndex);
  return order;
}

/**
 * シャッフルしない場合の再生順（曲のインデックスをそのまま並べただけの配列）を作る（CR-038、FR-2.16）。
 * @param {number} trackCount
 */
export function buildSequentialOrder(trackCount) {
  return Array.from({ length: trackCount }, (_, i) => i);
}

/**
 * シャッフルしない場合に、指定した曲を先頭にした再生順を作る（CR-038、FR-2.16）。
 * 曲一覧の表示順のまま、指定した曲から順に、末尾まで行ったら先頭（指定した曲の手前）へ戻る。
 * @param {number} trackCount
 * @param {number} startIndex 先頭に置く曲のインデックス
 */
export function buildSequentialOrderStartingAt(trackCount, startIndex) {
  const seq = buildSequentialOrder(trackCount);
  return [...seq.slice(startIndex), ...seq.slice(0, startIndex)];
}
