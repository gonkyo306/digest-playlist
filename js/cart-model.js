// カート（追加候補リスト）の純粋なロジック（FR-1.12, FR-1.13）。
// 曲IDの配列として扱う。永続化はcart-storage.jsが担当する。

/** カートに曲IDを追加する。すでに入っていれば変更しない（重複追加なし） */
export function addToCart(cart, trackId) {
  if (cart.includes(trackId)) return cart;
  return [...cart, trackId];
}

/** カートから曲IDを1件削除する */
export function removeFromCart(cart, trackId) {
  return cart.filter((id) => id !== trackId);
}

/** カートから複数の曲IDをまとめて削除する（一括追加後に使う。FR-1.13） */
export function removeManyFromCart(cart, trackIds) {
  const removeSet = new Set(trackIds);
  return cart.filter((id) => !removeSet.has(id));
}

/** 曲IDがカートに入っているか判定する */
export function isInCart(cart, trackId) {
  return cart.includes(trackId);
}

/**
 * カートの曲を、指定したプレイリストへ追加する場合に、
 * 追加できる曲（まだそのプレイリストにない）と、すでに追加済みの曲を分ける（FR-1.13, FR-2.6）。
 * @param {Array<string|number>} cart カート内の曲ID配列
 * @param {{trackIds: Array<string|number>}} playlist 追加先プレイリスト
 */
export function partitionCartForPlaylist(cart, playlist) {
  const existing = new Set(playlist.trackIds);
  const toAdd = cart.filter((id) => !existing.has(id));
  const alreadyInPlaylist = cart.filter((id) => existing.has(id));
  return { toAdd, alreadyInPlaylist };
}
