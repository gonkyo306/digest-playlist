// フェーズ10：カート（追加候補リスト）の表示（FR-1.12, FR-1.13）。
// 検索結果でチェックを入れた曲を一時的に保持し、選んだメドレーへ一括追加する。

import { trackRowHtml, bindTrackRowEvents } from './track-row.js';

/**
 * @param {HTMLElement} container
 * @param {Array<object>} cartTracks 表示用に整形済みのカート内の曲（表示できないIDは呼び出し側で除いておく）
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer}} deps
 * @param {{onRemove: Function, onAddSelected: Function}} actions
 */
export function renderCartView(container, cartTracks, { previewPlayer }, actions) {
  if (cartTracks.length === 0) {
    container.innerHTML = '<p class="empty">カートに曲がありません。検索結果のチェックボックスで曲を選ぶと、ここにたまります。</p>';
    return;
  }

  container.innerHTML = `
    <p class="note">カートの内容はブラウザに保存され、アプリを閉じても残ります。</p>
    <ul class="list" id="cart-results"></ul>
    <button type="button" id="cart-add-btn" class="primary">選んだ曲をメドレーへ追加</button>
  `;

  const listEl = container.querySelector('#cart-results');
  const checkedIds = new Set(cartTracks.map((t) => t.id));

  listEl.innerHTML = cartTracks
    .map((t, i) => trackRowHtml(t, i, { checked: true, addLabel: '削除' }))
    .join('');

  bindTrackRowEvents(listEl, cartTracks, {
    previewPlayer,
    onAdd: (track) => actions.onRemove(track.id),
    onCheckToggle: (track, checked) => {
      if (checked) checkedIds.add(track.id);
      else checkedIds.delete(track.id);
    },
  });

  container.querySelector('#cart-add-btn').addEventListener('click', () => {
    actions.onAddSelected([...checkedIds]);
  });
}
