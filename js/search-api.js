// 曲の検索
// iTunes Search API（https://itunes.apple.com/search?...）を使った曲名・アーティスト名検索。
// URLの組み立て・結果の絞り込み・表示用整形（純粋な関数）と、実際の通信（fetch）を分けてあるので、
// 純粋な部分だけをUnitテストで検証できる（track-api.jsと同じ方針）。

const SEARCH_BASE = 'https://itunes.apple.com/search';

/**
 * 検索APIのURLを組み立てる（日本のストアフロント指定、FR-1.1・FR-1.3）。
 * offsetを指定すると、その件数分をスキップして取得する（FR-1.10の無限スクロール用）。
 * @param {string} term 検索キーワード（曲名・アーティスト名）
 * @param {string} country ストアフロント（既定: 日本）
 * @param {number} limit 取得件数の上限
 * @param {number} offset 取得を開始する位置（既定: 0）
 */
export function buildSearchUrl(term, country = 'jp', limit = 25, offset = 0) {
  const trimmed = (term || '').trim();
  if (!trimmed) throw new Error('検索キーワードを入力してください');
  const params = new URLSearchParams({
    term: trimmed,
    country,
    media: 'music',
    entity: 'song',
    limit: String(limit),
    offset: String(offset),
  });
  return `${SEARCH_BASE}?${params.toString()}`;
}

/**
 * 検索結果から、試聴音源(previewUrl)がない曲を除外する（FR-1.4）。
 * @param {Array<object>} results APIレスポンスのresults配列
 */
export function filterPreviewableTracks(results) {
  return (results || []).filter((r) => r.wrapperType === 'track' && r.kind === 'song' && !!r.previewUrl);
}

/**
 * APIの生データを、表示用のデータ（ジャケット・曲名・アーティスト・アルバム）に整形する（FR-1.2）。
 * @param {object} track filterPreviewableTracksを通した曲データ
 */
export function formatTrackForDisplay(track) {
  return {
    id: track.trackId,
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName || '',
    artwork: track.artworkUrl100 || '',
    previewUrl: track.previewUrl,
  };
}

/**
 * 実際に検索APIを呼び出し、表示用に整形した曲一覧を返す（フリーワード検索、FR-1.1）。
 * 25件を超える分は、offsetを指定して呼び直すことで追加読み込みできる（FR-1.10）。
 * @param {string} term
 * @param {string} [country]
 * @param {number} [offset] 追加読み込み時に指定する開始位置（既定: 0）
 * @param {number} [limit] 1回あたりの取得件数（初回25件、追加読み込みは50件を想定）
 * @returns {Promise<Array<object>>}
 */
export async function fetchSearchResults(term, country = 'jp', offset = 0, limit = 25) {
  const url = buildSearchUrl(term, country, limit, offset);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`検索に失敗しました (status: ${res.status})`);
  const json = await res.json();
  const previewable = filterPreviewableTracks(json.results);
  // 注意：クライアント側で曲名・アーティスト名・アルバム名の部分一致による絞り込みはしない。
  // iTunes Search APIは、termに対して既にサーバー側で関連性のある結果（アルバム名の一致を含む）を
  // 返してくるため、絞り込むと、APIが返した正当な結果まで誤って除外してしまう（FR-1.1）。
  return previewable.map(formatTrackForDisplay);
}
