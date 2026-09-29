// CR-043/047：プレイリストの代表画像を解決する（FR-2.10）。優先順位：
// (1) カスタム画像（coverImage、FR-2.17/FR-2.19で設定） (2) 先頭の曲のジャケット (3) 無し（プレースホルダー）
//
// 検索タブの追加先プレイリスト常時表示（FR-1.19）・追加先選択モーダル（FR-2.4）で、
// 曲情報を保存していない各プレイリスト（FR-3.2）の代表画像を都度解決するために使う。
// 通信（fetchTrackInfo）を伴うため、依存注入でUnitテスト可能にしてある。

/**
 * @param {{coverImage?: Blob|null, trackIds: Array<string|number>}} playlist
 * @param {(ids: Array<string|number>) => Promise<{available: Array<{artwork: string}>}>} fetchTrackInfo
 * @returns {Promise<{source: 'custom', blob: Blob}|{source: 'track', url: string}|{source: 'none'}>}
 */
export async function resolvePlaylistArtwork(playlist, fetchTrackInfo) {
  if (playlist.coverImage) {
    return { source: 'custom', blob: playlist.coverImage };
  }
  if (!playlist.trackIds.length) {
    return { source: 'none' };
  }
  try {
    const { available } = await fetchTrackInfo([playlist.trackIds[0]]);
    if (available[0]) {
      return { source: 'track', url: available[0].artwork };
    }
  } catch {
    // 取得失敗時はプレースホルダー扱いにする（画面全体は壊さない）
  }
  return { source: 'none' };
}

/**
 * 複数プレイリストの代表画像を並行して解決する。
 * @param {Array<object>} playlists
 * @param {Function} fetchTrackInfo
 * @returns {Promise<Map<string, object>>} playlist.id → 代表画像情報
 */
export async function resolvePlaylistsArtwork(playlists, fetchTrackInfo) {
  const entries = await Promise.all(
    playlists.map(async (p) => [p.id, await resolvePlaylistArtwork(p, fetchTrackInfo)])
  );
  return new Map(entries);
}
