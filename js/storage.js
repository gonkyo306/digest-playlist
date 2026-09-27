// フェーズ1：データの土台
// プレイリストのローカル保存（IndexedDB）。ログインなしで利用できる（FR-3.1）。
// 保存するのは曲の識別情報のみ（models.js の isValidPlaylist 参照、FR-3.2）。
//
// 重要：ブラウザの「永続保存」（navigator.storage.persist）は要求しない（NFR-3.3 / 10-1のB）。
// 空き容量が少ないときにブラウザが保存データを自動削除する可能性は、許容済みのリスクとして扱う。

import { isValidPlaylist } from './models.js';

const DB_NAME = 'digest-playlist';
const DB_VERSION = 2; // v1→v2：CR-009「メドレー」→「プレイリスト」の呼称統一に伴うストア名変更
const STORE = 'playlists';
const LEGACY_STORE = 'medleys'; // v1で使っていたストア名（既存データの移行用。削除しないこと）

/** @returns {Promise<IDBDatabase>} */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      // v1（ストア名: medleys）から既にデータがある端末では、呼称変更で中身が消えないよう、
      // 新ストアへコピーしてから旧ストアを削除する（実機で作成済みのプレイリストを保護する）。
      if (event.oldVersion < 2 && db.objectStoreNames.contains(LEGACY_STORE)) {
        const tx = req.transaction;
        const legacyStore = tx.objectStore(LEGACY_STORE);
        const newStore = tx.objectStore(STORE);
        legacyStore.getAll().onsuccess = (e) => {
          for (const item of e.target.result) {
            newStore.put(item);
          }
        };
        db.deleteObjectStore(LEGACY_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const result = fn(store);
        tx.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
        tx.onerror = () => reject(tx.error);
      })
  );
}

/** プレイリストを保存（新規・更新どちらも可） */
export async function savePlaylist(playlist) {
  if (!isValidPlaylist(playlist)) {
    throw new Error('invalid playlist: 保存する内容は id/name/trackIds のみです');
  }
  return withStore('readwrite', (store) => {
    store.put(playlist);
  });
}

/** idを指定して1件取得する。存在しなければ undefined */
export async function getPlaylist(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 保存されているプレイリストを全件取得する */
export async function getAllPlaylists() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** プレイリストを削除する（FR-2.3） */
export async function deletePlaylist(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}
