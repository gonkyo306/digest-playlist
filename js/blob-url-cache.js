// プレイリストのカスタム画像（Blob）を<img src>で表示するためのオブジェクトURLを
// キャッシュする。同じキー（プレイリストIDなど）に対して、参照が変わった（画像を差し替えた）
// ときだけ古いURLをrevokeして作り直し、メモリリークを防ぐ。

const cache = new Map();

/**
 * @param {string} key キャッシュのキー（プレイリストIDなど）
 * @param {Blob} blob
 * @returns {string} object URL
 */
export function blobToUrl(key, blob) {
  const cached = cache.get(key);
  if (cached && cached.blob === blob) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(blob);
  cache.set(key, { blob, url });
  return url;
}
