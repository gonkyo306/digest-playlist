// カートの永続化（NFR-3.4）。ローカルストレージに、曲IDの配列をJSONで保存する。
// プレイリスト本体（storage.js、IndexedDB）とは別の、単純な1キーの保存先として扱う。
// storage引数を渡せるようにしてあるのは、Unitテストで実ブラウザのlocalStorageに
// 依存せず検証できるようにするため（playlist-player.jsのaudio差し替えと同じ方針）。

const STORAGE_KEY = 'digest-playlist:cart';

function resolveStorage(storage) {
  if (storage) return storage;
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/** 保存されているカートの中身（曲IDの配列）を読み込む */
export function loadCart(storage) {
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** カートの中身を保存する */
export function persistCart(cart, storage) {
  const store = resolveStorage(storage);
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify(cart));
}
