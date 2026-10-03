// 段階検索（アーティスト→アルバム→曲）（FR-1.8, FR-1.9）。
// フリーワード検索（search-api.js）とは別の検索モード。iTunes Search/Lookup APIを利用する。
// 各ステップの取得件数の上限は50件（FR-1.9）。

import { filterPreviewableTracks, formatTrackForDisplay } from './search-api.js';

const SEARCH_BASE = 'https://itunes.apple.com/search';
const LOOKUP_BASE = 'https://itunes.apple.com/lookup';
const STAGE_LIMIT = 50;

/** アーティスト検索のURLを組み立てる */
export function buildArtistSearchUrl(term, country = 'jp', limit = STAGE_LIMIT) {
  const trimmed = (term || '').trim();
  if (!trimmed) throw new Error('アーティスト名を入力してください');
  const params = new URLSearchParams({
    term: trimmed,
    country,
    media: 'music',
    entity: 'musicArtist',
    limit: String(limit),
  });
  return `${SEARCH_BASE}?${params.toString()}`;
}

/** アーティスト検索の結果を、表示用データに整形する */
export function formatArtistForDisplay(result) {
  return { id: result.artistId, name: result.artistName };
}

/** 指定したアーティストのアルバム一覧を取得するURLを組み立てる */
export function buildArtistAlbumsUrl(artistId, country = 'jp', limit = STAGE_LIMIT) {
  if (!artistId) throw new Error('アーティストIDが指定されていません');
  const params = new URLSearchParams({
    id: String(artistId),
    country,
    entity: 'album',
    limit: String(limit),
  });
  return `${LOOKUP_BASE}?${params.toString()}`;
}

/** Lookup APIの結果から、アルバム（コレクション）だけを取り出す */
export function filterAlbums(results) {
  return (results || []).filter((r) => r.wrapperType === 'collection' && r.collectionType === 'Album');
}

/** アルバムの結果を、表示用データに整形する */
export function formatAlbumForDisplay(result) {
  return {
    id: result.collectionId,
    name: result.collectionName,
    artist: result.artistName,
    artwork: result.artworkUrl100 || '',
  };
}

/** キーワードでアルバムを検索するURLを組み立てる（統合検索でのアルバム候補用） */
export function buildAlbumSearchUrl(term, country = 'jp', limit = 5) {
  const trimmed = (term || '').trim();
  if (!trimmed) throw new Error('検索キーワードを入力してください');
  const params = new URLSearchParams({
    term: trimmed,
    country,
    media: 'music',
    entity: 'album',
    limit: String(limit),
  });
  return `${SEARCH_BASE}?${params.toString()}`;
}

/** キーワードでアーティストを検索するURLを組み立てる（アーティスト候補件数を絞るためlimitを指定可能） */
export function buildArtistSearchUrlLimited(term, country = 'jp', limit = 5) {
  return buildArtistSearchUrl(term, country, limit);
}

/** 指定したアルバムの収録曲一覧を取得するURLを組み立てる */
export function buildAlbumTracksUrl(collectionId, country = 'jp', limit = STAGE_LIMIT) {
  if (!collectionId) throw new Error('アルバムIDが指定されていません');
  const params = new URLSearchParams({
    id: String(collectionId),
    country,
    entity: 'song',
    limit: String(limit),
  });
  return `${LOOKUP_BASE}?${params.toString()}`;
}

/**
 * キーワードでアルバムを検索し、表示用のアルバム一覧を返す（統合検索の上位候補）。
 * 件数は少数（既定5件）に絞る（一覧が長くなりすぎないようにするための実装上の判断）。
 */
export async function fetchAlbumsByTerm(term, country = 'jp', limit = 5) {
  const res = await fetch(buildAlbumSearchUrl(term, country, limit));
  if (!res.ok) throw new Error(`アルバム検索に失敗しました (status: ${res.status})`);
  const json = await res.json();
  return filterAlbums(json.results).map(formatAlbumForDisplay);
}

/**
 * キーワードでアーティストを検索し、件数を絞った表示用のアーティスト一覧を返す（統合検索の上位候補）。
 */
export async function fetchArtistsLimited(term, country = 'jp', limit = 5) {
  const res = await fetch(buildArtistSearchUrlLimited(term, country, limit));
  if (!res.ok) throw new Error(`アーティスト検索に失敗しました (status: ${res.status})`);
  const json = await res.json();
  return (json.results || [])
    .filter((r) => r.wrapperType === 'artist')
    .map(formatArtistForDisplay);
}

/** アーティストIDから、そのアーティストのアルバム一覧を返す */
export async function fetchArtistAlbums(artistId, country = 'jp') {
  const res = await fetch(buildArtistAlbumsUrl(artistId, country));
  if (!res.ok) throw new Error(`アルバム一覧の取得に失敗しました (status: ${res.status})`);
  const json = await res.json();
  return filterAlbums(json.results).map(formatAlbumForDisplay);
}

/** アルバムIDから、そのアルバムの収録曲一覧（試聴音源ありのみ）を返す */
export async function fetchAlbumTracks(collectionId, country = 'jp') {
  const res = await fetch(buildAlbumTracksUrl(collectionId, country));
  if (!res.ok) throw new Error(`収録曲の取得に失敗しました (status: ${res.status})`);
  const json = await res.json();
  const tracks = filterPreviewableTracks(json.results);
  return tracks.map(formatTrackForDisplay);
}
