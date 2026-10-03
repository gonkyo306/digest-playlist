// プレイリスト作成画面（FR-2.17）。
// 画像（任意、リサイズ・圧縮してから保持。NFR-3.6）とプレイリスト名（必須、50文字まで）を設定する。
// 左上に×アイコンのみのキャンセルボタン、右上にチェックアイコンのみの保存ボタン
// （名前が空の間は無効）を配置する。
// 画面全体を入れ替える表示をやめ、他のポップアップ（追加先の選択など）と同じく、
// 画面下からスライドして現れるシートとして表示する（dialog.jsのbuildOverlay/closeOverlayを共用）。
// 一覧画面・検索画面（追加先選択モーダルの＋ボタンから開く場合）は、シートの下にそのまま残る。

import { iconOnly } from './icons.js';
import { buildOverlay, closeOverlay, enqueueDialog } from './dialog.js';
import { resizeImageToJpeg } from '../image-resize.js';
import { pushBackState, popBackState } from '../back-stack.js';

/**
 * プレイリスト作成シートを開く。保存・キャンセルのあとシートが閉じる（アニメーション終了）まで待つ。
 * @param {{onCancel: Function, onSave: (name: string, imageBlob: Blob|null) => (void|Promise<void>)}} actions
 *   onSaveの処理（保存・一覧の更新等）が終わってからシートを閉じる
 * @returns {Promise<void>} シートが閉じたら解決する
 */
export function openPlaylistCreateSheet(actions) {
  return enqueueDialog(() => new Promise((resolve) => {
    let imageBlob = null;
    let imageObjectUrl = null;
    let name = '';
    let saving = false;
    let closing = false;

    const overlay = buildOverlay(`
      <div class="create-sheet-grab" aria-hidden="true"></div>
      <div class="create-screen-topbar">
        <button type="button" id="create-cancel-btn" class="icon-btn" aria-label="キャンセル">${iconOnly('close')}</button>
        <button type="button" id="create-save-btn" class="icon-btn confirm-icon-btn" aria-label="保存" disabled>${iconOnly('check')}</button>
      </div>
      <button type="button" id="image-picker-btn" class="image-picker" aria-label="画像を選ぶ">${iconOnly('camera')}</button>
      <input type="file" id="image-file-input" accept="image/*" hidden>
      <input type="text" id="create-name-input" class="create-name-input" placeholder="プレイリスト名" maxlength="50" aria-label="プレイリスト名">
    `);
    overlay.querySelector('.dialog-box').classList.add('create-sheet');
    const saveBtn = overlay.querySelector('#create-save-btn');
    const pickerBtn = overlay.querySelector('#image-picker-btn');

    function releaseImage() {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
      imageObjectUrl = null;
    }

    // シートを閉じる（下へスライドして消えるアニメーションを待つ）
    async function close() {
      if (closing) return;
      closing = true;
      await closeOverlay(overlay);
      releaseImage();
      resolve();
    }

    // FR-6.3：OSの戻る操作でもキャンセルと同じ扱いで閉じられるようにする
    function cancel() {
      actions.onCancel();
      close();
    }
    pushBackState(cancel);

    overlay.querySelector('#create-cancel-btn').addEventListener('click', () => {
      popBackState();
      cancel();
    });
    saveBtn.addEventListener('click', async () => {
      if (!name.trim() || saving) return;
      popBackState();
      saving = true;
      saveBtn.disabled = true;
      try {
        await actions.onSave(name.trim(), imageBlob);
      } finally {
        close();
      }
    });
    pickerBtn.addEventListener('click', () => {
      overlay.querySelector('#image-file-input').click();
    });
    overlay.querySelector('#image-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      imageBlob = await resizeImageToJpeg(file);
      releaseImage();
      imageObjectUrl = URL.createObjectURL(imageBlob);
      pickerBtn.innerHTML = `<img src="${imageObjectUrl}" alt="">`;
    });
    overlay.querySelector('#create-name-input').addEventListener('input', (e) => {
      name = e.target.value;
      saveBtn.disabled = !name.trim() || saving;
    });
  }));
}
