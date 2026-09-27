// フェーズ1：データの土台
// メドレーのローカル保存（IndexedDB）。ログインなしで利用できる（FR-3.1）。
// 保存するのは曲の識別情報のみ（models.js の isValidMedley 参照、FR-3.2）。
//
// 重要：ブラウザの「永続保存」（navigator.storage.persist）は要求しない（NFR-3.3 / 10-1のB）。
// 空き容量が少ないときにブラウザが保存データを自動削除する可能性は、許容済みのリスクとして扱う。

import { isValidMedley } from './models.js';

const DB_NAME = 'digest-playlist';
const DB_VERSION = 1;
const STORE = 'medleys';

/** @returns {Promise<IDBDatabase>} */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
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

/** メドレーを保存（新規・更新どちらも可） */
export async function saveMedley(medley) {
  if (!isValidMedley(medley)) {
    throw new Error('invalid medley: 保存する内容は id/name/trackIds のみです');
  }
  return withStore('readwrite', (store) => {
    store.put(medley);
  });
}

/** idを指定して1件取得する。存在しなければ undefined */
export async function getMedley(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 保存されているメドレーを全件取得する */
export async function getAllMedleys() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** メドレーを削除する（FR-2.3） */
export async function deleteMedley(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}
