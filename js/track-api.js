// データの土台
// 保存済みの曲ID（trackId）から、最新の曲情報（曲名・アーティスト・ジャケット・試聴音源URL）を
// 取得する処理。検索とは別に、プレイリスト詳細画面で使う（FR-3.2）。
// プレイリストはtrackIdのみを保存し、表示のたびに本APIで最新情報を取得し直す設計のため、
// album・trackNumber（FR-2.11のアルバム・収録順まとめ、NFR-3.7）も、保存データの
// マイグレーションなしに既存プレイリストへそのまま反映される。
//
// iTunes Lookup API（https://itunes.apple.com/lookup?id=...）を使う。
// 検索API（/search）とは別のエンドポイントで、IDを指定して曲情報をまとめて取得できる。
//
// URLの組み立てとレスポンスの解釈（純粋な関数）と、実際の通信（fetch）を分けてあるので、
// 純粋な部分だけをUnitテストで検証できる。

const LOOKUP_BASE = 'https://itunes.apple.com/lookup';

/**
 * Lookup APIのURLを組み立てる。
 * @param {Array<string|number>} ids
 * @param {string} country ストアフロント（既定: 日本）
 */
export function buildLookupUrl(ids, country = 'jp') {
  if (!ids || ids.length === 0) throw new Error('idsは1件以上指定してください');
  const idParam = ids.join(',');
  return `${LOOKUP_BASE}?id=${encodeURIComponent(idParam)}&country=${encodeURIComponent(country)}`;
}

/**
 * Lookup APIのレスポンスを、要求したID一覧と突き合わせて解釈する。
 * 返ってこなかったID（配信終了・試聴音源なし等）は unavailable として扱う（FR-3.3）。
 * @param {{results: Array<object>}} json APIレスポンス
 * @param {Array<string|number>} requestedIds 要求したID一覧（順序を維持するため）
 * @returns {{available: Array<object>, unavailableIds: Array<string|number>}}
 */
export function parseLookupResponse(json, requestedIds) {
  const results = (json && json.results) || [];
  const byId = new Map();
  for (const r of results) {
    // wrapperType: 'track' のみが曲情報。試聴音源(previewUrl)がない場合も未取得扱いとする。
    if (r.wrapperType === 'track' && r.previewUrl) {
      byId.set(String(r.trackId), {
        id: r.trackId,
        title: r.trackName,
        artist: r.artistName,
        album: r.collectionName || '',
        trackNumber: typeof r.trackNumber === 'number' ? r.trackNumber : null,
        artwork: r.artworkUrl100,
        previewUrl: r.previewUrl,
      });
    }
  }
  const available = [];
  const unavailableIds = [];
  for (const id of requestedIds) {
    const found = byId.get(String(id));
    if (found) available.push(found);
    else unavailableIds.push(id);
  }
  return { available, unavailableIds };
}

/** 1回のLookup API呼び出しに含める曲IDの上限。IDを全部URLに載せると、数百曲のプレイリストでURLが長すぎて通信に失敗するため */
export const LOOKUP_BATCH_SIZE = 100;
/** 同時に呼び出すLookup APIの数 */
const LOOKUP_CONCURRENCY = 4;

/**
 * 配列を指定件数ずつに分ける。
 * @template T
 * @param {Array<T>} items
 * @param {number} size
 * @returns {Array<Array<T>>}
 */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * 実際にAPIを呼び出して、曲情報を取得する。曲数が多い場合は、LOOKUP_BATCH_SIZE件ずつに分けて
 * 複数回呼び出し、結果をIDの順序のまま1つにまとめる。いずれかの呼び出しが失敗したら例外を投げる。
 * @param {Array<string|number>} ids
 * @param {string} [country]
 * @returns {Promise<{available: Array<object>, unavailableIds: Array<string|number>}>}
 */
export async function fetchTrackInfoByIds(ids, country = 'jp') {
  if (!ids || ids.length === 0) return { available: [], unavailableIds: [] };
  const batches = chunk(ids, LOOKUP_BATCH_SIZE);
  const parts = new Array(batches.length);
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const i = next++;
      const res = await fetch(buildLookupUrl(batches[i], country));
      if (!res.ok) throw new Error(`曲情報の取得に失敗しました (status: ${res.status})`);
      parts[i] = parseLookupResponse(await res.json(), batches[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(LOOKUP_CONCURRENCY, batches.length) }, worker));
  return {
    available: parts.flatMap((p) => p.available),
    unavailableIds: parts.flatMap((p) => p.unavailableIds),
  };
}
