// CR-043（NFR-3.6）：アップロードした画像は、端末のストレージ消費を抑えるため、保存前に
// 長辺800pxを上限にリサイズし、JPEG形式に圧縮する（元画像そのものは保持しない）。
// DOM（createImageBitmap・canvas）に依存するため、Unitテストの対象外（Playwrightで確認する）。

/**
 * 画像ファイルを、長辺が指定サイズ以下になるようリサイズし、JPEGに圧縮したBlobを返す。
 * @param {File|Blob} file
 * @param {{maxSize?: number, quality?: number}} [options]
 * @returns {Promise<Blob>}
 */
export async function resizeImageToJpeg(file, { maxSize = 800, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === 'function') bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('画像の変換に失敗しました'));
    }, 'image/jpeg', quality);
  });
}
