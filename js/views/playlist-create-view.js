// フェーズ28（CR-043）：プレイリスト作成画面（FR-2.17）。
// 一覧画面右上の＋ボタンから遷移する専用画面。画像（任意、リサイズ・圧縮してから保持。NFR-3.6）と
// プレイリスト名（必須、50文字まで）を設定する。左上に×アイコンのみのキャンセルボタン、
// 右上にチェックアイコンのみの保存ボタン（名前が空の間は無効）を配置する。
// 検索タブの追加先0件時のガイド（FR-1.19）からも、同じ関数がsearch-view.js側のコンテナへ
// 直接マウントされる形で再利用される。

import { iconOnly } from './icons.js';
import { resizeImageToJpeg } from '../image-resize.js';
import { pushBackState, popBackState } from '../back-stack.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{}} data 予約（現状未使用）
 * @param {{onCancel: Function, onSave: (name: string, imageBlob: Blob|null) => (void|Promise<void>)}} actions
 */
export function renderPlaylistCreate(container, data, actions) {
  let imageBlob = null;
  let imageObjectUrl = null;
  let name = '';
  let saving = false;

  // CR-053（FR-6.3）：OSの戻る操作でもキャンセルと同じ扱いで画面を戻れるようにする
  function doCancel() {
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    actions.onCancel();
  }

  function render() {
    const canSave = !!name.trim() && !saving;
    container.innerHTML = `
      <div class="create-screen-topbar">
        <button type="button" id="create-cancel-btn" class="icon-btn" aria-label="キャンセル">${iconOnly('close')}</button>
        <button type="button" id="create-save-btn" class="icon-btn confirm-icon-btn" aria-label="保存" ${canSave ? '' : 'disabled'}>${iconOnly('check')}</button>
      </div>
      <button type="button" id="image-picker-btn" class="image-picker" aria-label="画像を選ぶ">
        ${imageObjectUrl ? `<img src="${imageObjectUrl}" alt="">` : iconOnly('camera')}
      </button>
      <input type="file" id="image-file-input" accept="image/*" hidden>
      <input type="text" id="create-name-input" class="create-name-input" placeholder="プレイリスト名" maxlength="50" value="${escapeHtml(name)}">
    `;

    container.querySelector('#create-cancel-btn').addEventListener('click', () => {
      popBackState();
      doCancel();
    });
    container.querySelector('#create-save-btn').addEventListener('click', () => {
      if (!name.trim() || saving) return;
      popBackState();
      saving = true;
      render();
      Promise.resolve(actions.onSave(name.trim(), imageBlob)).finally(() => {
        if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
      });
    });
    container.querySelector('#image-picker-btn').addEventListener('click', () => {
      container.querySelector('#image-file-input').click();
    });
    container.querySelector('#image-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      imageBlob = await resizeImageToJpeg(file);
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
      imageObjectUrl = URL.createObjectURL(imageBlob);
      render();
    });
    container.querySelector('#create-name-input').addEventListener('input', (e) => {
      name = e.target.value;
      container.querySelector('#create-save-btn').disabled = !name.trim();
    });
  }

  render();
  // CR-053（FR-6.3）：この画面を開いたことを1段階の遷移として履歴に積む
  pushBackState(doCancel);
}
