// 確認・入力ダイアログ（ブラウザ標準のconfirm/promptの代わりに、
// アプリのデザインに合わせた独自の見た目のダイアログを表示する）
//
// confirm()と違い非同期（Promiseベース）。呼び出し側は await で結果を待つ。
// 連続タップ等で複数のオーバーレイが同時に開いてしまわないよう（NFR-5.3）、
// 全てのダイアログ（このファイルのshowConfirm等、およびplaylist-picker-dialog.jsの
// showAddDestinationPicker）を1つのキューで直列化する。
// 既に1つ開いている間の新しい呼び出しは、先のダイアログが閉じられるまで待ってから開く。
// プレイリスト名の変更は、ダイアログではなく、詳細画面の編集モード内でその場編集する（FR-2.14）。
// ポップアップは画面下端からスライドして現れる／消えるアニメーションで表示する（NFR-5.10）。
// buildOverlay/closeOverlayはplaylist-picker-dialog.jsからも共通利用する。

import { pushBackState, popBackState } from '../back-stack.js';

// .dialog-boxのtransition時間（css/style.css）と合わせる
const DIALOG_CLOSE_ANIMATION_MS = 320;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let dialogQueue = Promise.resolve();

/**
 * ダイアログを表す非同期処理（factory）を、既存のダイアログが閉じるまで待ってから実行する。
 * すべてのダイアログ系関数（showConfirm等）が
 * これを経由することで、複数のオーバーレイが同時に開くことを防ぐ。
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
 * 現れるアニメーションを開始する。
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
 * ダイアログを、下へスライドして消えるアニメーションのあとDOMから取り除く。
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
      await closeOverlay(overlay); // 下へスライドして消えるアニメーションを待つ
      resolve(result);
    };
    // FR-6.3：OSの戻る操作ではキャンセル相当の扱いにする
    pushBackState(() => finish(false));
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => { popBackState(); finish(false); });
    overlay.querySelector('.dialog-confirm').addEventListener('click', () => { popBackState(); finish(true); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { popBackState(); finish(false); }
    });
  }));
}

/**
 * プレイリストが1件も無い状態で曲の＋ボタンをタップしたときに表示する、その場でプレイリストを
 * 作成するための名前入力ダイアログ。作成すると、タップした曲がそのまま追加される
 * （呼び出し側で行う）。
 * @param {{subject?: string}} [options] 作成後に追加されるものの呼び方（既定は「この曲」。
 *   アルバムの全曲追加では「このアルバムの全曲」）
 * @returns {Promise<string|null>} 作成するプレイリスト名（空でない、前後の空白を除いた文字列）。
 *   キャンセル時はnull
 */
export function showCreatePlaylistPrompt({ subject = 'この曲' } = {}) {
  return enqueueDialog(() => new Promise((resolve) => {
    const message = `曲を追加するには、まずプレイリストを作成してください。\n作成すると、${subject}がそのまま追加されます。`;
    const overlay = buildOverlay(`
      <h2 class="dialog-title">プレイリストがまだありません</h2>
      <p class="dialog-message">${escapeHtml(message)}</p>
      <input type="text" class="create-name-input" placeholder="プレイリスト名" aria-label="プレイリスト名">
      <div class="dialog-actions">
        <button type="button" class="dialog-btn dialog-cancel">キャンセル</button>
        <button type="button" class="dialog-btn dialog-confirm" disabled>作成して追加</button>
      </div>
    `);
    const input = overlay.querySelector('.create-name-input');
    const confirmBtn = overlay.querySelector('.dialog-confirm');
    const finish = async (result) => {
      await closeOverlay(overlay); // 下へスライドして消えるアニメーションを待つ
      resolve(result);
    };
    const currentName = () => input.value.trim();
    input.addEventListener('input', () => { confirmBtn.disabled = !currentName(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && currentName()) { e.preventDefault(); popBackState(); finish(currentName()); }
    });
    // FR-6.3：OSの戻る操作ではキャンセル相当の扱いにする
    pushBackState(() => finish(null));
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => { popBackState(); finish(null); });
    confirmBtn.addEventListener('click', () => { if (currentName()) { popBackState(); finish(currentName()); } });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { popBackState(); finish(null); }
    });
    requestAnimationFrame(() => input.focus());
  }));
}
