// テスト専用の最小限のIndexedDB代替実装。
//
// 本来は npm の fake-indexeddb を使う想定だったが、このサンドボックス環境では
// npm レジストリへの通信がネットワークポリシーでブロックされており
// （host_not_allowed）、依存パッケージを追加インストールできなかった。
// アプリ本体は「素のJavaScript・ビルド不要」の方針のため、テストのみで使う
// 最小限のインメモリ代替をここに用意する。storage.js が実際に使っている
// API（open/onupgradeneeded、transaction、objectStore の put/get/getAll/delete）
// だけをサポートする、あくまでテスト用のスタブ。
//
// 実機（Chromeブラウザ）では本物のIndexedDBが使われるため、この代替は
// storage.js のロジック（保存・取得・削除・バリデーション連携）の検証にのみ使う。

class FakeRequest extends EventTarget {
  constructor() {
    super();
    this.result = undefined;
    this.error = undefined;
    this.onsuccess = null;
    this.onerror = null;
  }
  _succeed(result) {
    this.result = result;
    queueMicrotask(() => {
      if (this.onsuccess) this.onsuccess({ target: this });
    });
  }
  _fail(error) {
    this.error = error;
    queueMicrotask(() => {
      if (this.onerror) this.onerror({ target: this });
    });
  }
}

class FakeObjectStore {
  constructor(map, keyPath) {
    this._map = map;
    this._keyPath = keyPath;
  }
  put(value) {
    const req = new FakeRequest();
    const key = value[this._keyPath];
    this._map.set(key, structuredCloneLike(value));
    req._succeed(key);
    return req;
  }
  get(key) {
    const req = new FakeRequest();
    req._succeed(structuredCloneLike(this._map.get(key)));
    return req;
  }
  getAll() {
    const req = new FakeRequest();
    req._succeed(Array.from(this._map.values()).map(structuredCloneLike));
    return req;
  }
  delete(key) {
    const req = new FakeRequest();
    this._map.delete(key);
    req._succeed(undefined);
    return req;
  }
}

// 本物のIndexedDBは構造化複製アルゴリズムで値を複製する（JSONシリアライズではない）。
// CR-043でプレイリストにBlob（coverImage）を持たせるようになり、Blobを含むオブジェクトを
// JSON.stringifyすると空オブジェクト{}になって壊れてしまうため、Node組み込みのstructuredClone
// （Blobのクローンに対応）を使う。これは実際のIndexedDBの挙動により忠実でもある。
function structuredCloneLike(v) {
  return v === undefined ? undefined : structuredClone(v);
}

class FakeTransaction extends EventTarget {
  constructor(db, storeName) {
    super();
    this._db = db;
    this._storeName = storeName;
    this.oncomplete = null;
    this.onerror = null;
    queueMicrotask(() => {
      if (this.oncomplete) this.oncomplete({ target: this });
    });
  }
  objectStore(name) {
    const store = this._db._stores.get(name);
    if (!store) throw new Error(`no such object store: ${name}`);
    return new FakeObjectStore(store.map, store.keyPath);
  }
}

class FakeDB {
  constructor() {
    this._stores = new Map(); // name -> { map, keyPath }
    this.version = 0;
    this.objectStoreNames = {
      contains: (name) => this._stores.has(name),
    };
  }
  createObjectStore(name, options) {
    this._stores.set(name, { map: new Map(), keyPath: options.keyPath });
  }
  deleteObjectStore(name) {
    this._stores.delete(name);
  }
  transaction(storeName) {
    return new FakeTransaction(this, storeName);
  }
}

const databases = new Map(); // name -> FakeDB

export const fakeIndexedDB = {
  open(name, version = 1) {
    const req = new FakeRequest();
    let db = databases.get(name);
    const oldVersion = db ? db.version : 0;
    if (!db) {
      db = new FakeDB();
      databases.set(name, db);
    }
    const needsUpgrade = version > oldVersion;
    queueMicrotask(() => {
      req.result = db;
      if (needsUpgrade) {
        db.version = version;
        req.transaction = new FakeTransaction(db, null);
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: req, oldVersion, newVersion: version });
        }
      }
      req._succeed(db);
    });
    return req;
  },
  /** テスト間の独立性のため、全データベースを空にする */
  _reset() {
    databases.clear();
  },
};
