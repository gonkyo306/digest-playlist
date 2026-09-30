// フェーズ5：確認・入力ダイアログ（ブラウザ標準のconfirm/promptの代わりに、
// アプリのデザインに合わせた独自の見た目のダイアログを表示する）
//
// confirm()と違い非同期（Promiseベース）。呼び出し側は await で結果を待つ。
// CR-028（NFR-5.3）：連続タップ等で複数のオーバーレイが同時に開いてしまわないよう、
// 全てのダイアログ（このファイルのshowConfirm/showMessage、および
// playlist-picker-dialog.jsのshowPlaylistPicker）を1つのキューで直列化する。
// 既に1つ開いている間の新しい呼び出しは、先のダイアログが閉じられるまで待ってから開く。
// フェーズ23（CR-037）：プレイリスト名の変更は、名前変更ダイアログ（showPrompt）ではなく、
// 詳細画面の編集モード内でその場編集する方式に変更したため、showPromptは廃止した。
// CR-069：ポップアップは画面下端からスライドして現れる／消えるアニメーションで表示する。
// buildOverlay/closeOverlayはplaylist-picker-dialog.jsからも共通利用する。

import { pushBackState, popBackState } from '../back-stack.js';

// CR-069：.dialog-boxのtransition時間（css/style.css）と合わせる
const DIALOG_CLOSE_ANIMATION_MS = 320;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let dialogQueue = Promise.resolve();

/**
 * ダイアログを表す非同期処理（factory）を、既存のダイアログが閉じるまで待ってから実行する。
 * すべてのダイアログ系関数（showConfirm/showMessage/showPlaylistPicker等）が
 * これを経由することで、複数のオーバーレイが同時に開くことを防ぐ（CR-028）。
 * @param {() => Promise<any>} factory ダイアログを開いて結果のPromiseを返す関数
 * @returns {Promise<any>}
 */
export function enqueueDialog(factory) {
  const result = dialogQueue.then(factory);
  dialogQueue = result.then(() => {}, () => {});
  return result;
}

/**
 * ダイアログのオーバーレイ＋ボックスを組み立ててbodyに追加し、下からスライドして
 * 現れるアニメーションを開始する（CR-069）。
 * @param {string} innerHtml .dialog-box内に入れるHTML
 * @returns {HTMLElement} 追加したoverlay要素
 */
export function buildOverlay(innerHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `<div class="dialog-box" role="dialog" aria-modal="true">${innerHtml}</div>`;
  document.body.appendChild(overlay);
  // 追加直後にクラスを付けると、ブラウザが初期状態（transform: translateY(100%)）を
  // 1フレーム描画してからtransitionを発火するため、アニメーションが正しく再生される
  requestAnimationFrame(() => overlay.classList.add('open'));
  return overlay;
}

/**
 * ダイアログを、下へスライドして消えるアニメーションのあとDOMから取り除く（CR-069）。
 * @param {HTMLElement} overlay
 * @returns {Promise<void>} アニメーション終了後に解決する
 */
export function closeOverlay(overlay) {
  return new Promise((resolve) => {
    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.remove();
      resolve();
    }, DIALOG_CLOSE_ANIMATION_MS);
  });
}

/**
 * 確認ダイアログ（OK/キャンセル）。confirm()の代わり。
 * @param {{title?: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean}} options
 * @returns {Promise<boolean>} OKならtrue、キャンセルならfalse
 */
export function showConfirm({ title, message, confirmLabel = 'OK', cancelLabel = 'キャンセル', danger = false }) {
  return enqueueDialog(() => new Promise((resolve) => {
    const overlay = buildOverlay(`
      ${title ? `<h2 class="dialog-title">${escapeHtml(title)}</h2>` : ''}
      <p class="dialog-message">${escapeHtml(message)}</p>
      <div class="dialog-actions">
        <button type="button" class="dialog-btn dialog-cancel">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="dialog-btn dialog-confirm ${danger ? 'danger' : ''}">${escapeHtml(confirmLabel)}</button>
      </div>
    `);
    const finish = async (result) => {
      await closeOverlay(overlay); // CR-069：下へスライドして消えるアニメーションを待つ
      resolve(result);
    };
    // CR-053（FR-6.3）：OSの戻る操作ではキャンセル相当の扱いにする
    pushBackState(() => finish(false));
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => { popBackState(); finish(false); });
    overlay.querySelector('.dialog-confirm').addEventListener('click', () => { popBackState(); finish(true); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { popBackState(); finish(false); }
    });
  }));
}

/**
 * 通知メッセージ（OKのみ）。処理結果を伝えるための単純な通知（FR-2.4, FR-1.13）。
 * @param {{title?: string, message: string, okLabel?: string}} options
 * @returns {Promise<void>}
 */
export function showMessage({ title, message, okLabel = 'OK' }) {
  return enqueueDialog(() => new Promise((resolve) => {
    const overlay = buildOverlay(`
      ${title ? `<h2 class="dialog-title">${escapeHtml(title)}</h2>` : ''}
      <p class="dialog-message">${escapeHtml(message)}</p>
      <div class="dialog-actions">
        <button type="button" class="dialog-btn dialog-confirm">${escapeHtml(okLabel)}</button>
      </div>
    `);
    const finish = async () => {
      await closeOverlay(overlay); // CR-069：下へスライドして消えるアニメーションを待つ
      resolve();
    };
    // CR-053（FR-6.3）：OSの戻る操作でも閉じられるようにする
    pushBackState(finish);
    overlay.querySelector('.dialog-confirm').addEventListener('click', () => { popBackState(); finish(); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { popBackState(); finish(); }
    });
  }));
}
