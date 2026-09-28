// iTunesの画像URLは、パス末尾に解像度指定（例：.../100x100bb.jpg）が含まれており、
// この数値部分を書き換えるだけで、同じ曲・同じAPI呼び出し回数のまま、より高解像度の
// 画像を取得できる。プレイリスト詳細・アルバム詳細の大きなジャケット表示（CR-034）で、
// 100x100のサムネイルを拡大表示すると画質が粗くなる問題の改善に使う。

/**
 * iTunesの画像URLの解像度指定部分を、指定したサイズに置き換える。
 * 該当するパターン（数字x数字）が見つからない場合は、元のURLをそのまま返す。
 * @param {string} url
 * @param {number} [size] 一辺のピクセル数（既定: 600）
 */
export function largeArtworkUrl(url, size = 600) {
  if (!url) return url;
  return url.replace(/\d+x\d+/, `${size}x${size}`);
}
