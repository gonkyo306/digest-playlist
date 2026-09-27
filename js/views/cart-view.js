// フェーズ10：追加楽曲リスト（旧称：カート）の表示（FR-1.12, FR-1.13, CR-014）。
// 検索結果でチェックを入れた曲を一時的に保持し、選んだプレイリストへ一括追加する。
// CR-014：試聴は行わない。削除ボタンは「追加」とは異なるアイコンにする。

import { trackRowHtml, bindTrackRowEvents } from './track-row.js';

/**
 * @param {HTMLElement} container
 * @param {Array<object>} cartTracks 表示用に整形済みの追加楽曲リスト内の曲（表示できないIDは呼び出し側で除いておく）
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer}} deps
 * @param {{onRemove: Function, onAddSelected: Function}} actions
 */
export function renderCartView(container, cartTracks, { previewPlayer }, actions) {
  if (cartTracks.length === 0) {
    container.innerHTML = '<p class="empty">追加楽曲リストに曲がありません。</p>';
    return;
  }

  container.innerHTML = `
    <ul class="list" id="cart-results"></ul>
    <button type="button" id="cart-add-btn" class="primary">選んだ曲をプレイリストへ追加</button>
  `;

  const listEl = container.querySelector('#cart-results');
  const checkedIds = new Set(cartTracks.map((t) => t.id));

  listEl.innerHTML = cartTracks
    .map((t, i) => trackRowHtml(t, i, {
      checked: true,
      showPreview: false,
      actionIcon: 'remove',
      actionAriaLabel: '削除',
    }))
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
