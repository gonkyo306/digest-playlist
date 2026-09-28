// フェーズ5：確認・入力ダイアログ（ブラウザ標準のconfirm/promptの代わりに、
// アプリのデザインに合わせた独自の見た目のダイアログを表示する）
//
// confirm()/prompt()と違い非同期（Promiseベース）。呼び出し側は await で結果を待つ。
// CR-028（NFR-5.3）：連続タップ等で複数のオーバーレイが同時に開いてしまわないよう、
// 全てのダイアログ（このファイルのshowConfirm/showMessage/showPrompt、および
// playlist-picker-dialog.jsのshowPlaylistPicker）を1つのキューで直列化する。
// 既に1つ開いている間の新しい呼び出しは、先のダイアログが閉じられるまで待ってから開く。

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let dialogQueue = Promise.resolve();

/**
 * ダイアログを表す非同期処理（factory）を、既存のダイアログが閉じるまで待ってから実行する。
 * すべてのダイアログ系関数（showConfirm/showMessage/showPrompt/showPlaylistPicker）が
 * これを経由することで、複数のオーバーレイが同時に開くことを防ぐ（CR-028）。
 * @param {() => Promise<any>} factory ダイアログを開いて結果のPromiseを返す関数
 * @returns {Promise<any>}
 */
export function enqueueDialog(factory) {
  const result = dialogQueue.then(factory);
  dialogQueue = result.then(() => {}, () => {});
  return result;
}

function buildOverlay(innerHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `<div class="dialog-box" role="dialog" aria-modal="true">${innerHtml}</div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function closeOverlay(overlay) {
  overlay.remove();
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
    const finish = (result) => {
      closeOverlay(overlay);
      resolve(result);
    };
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => finish(false));
    overlay.querySelector('.dialog-confirm').addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
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
    const finish = () => {
      closeOverlay(overlay);
      resolve();
    };
    overlay.querySelector('.dialog-confirm').addEventListener('click', finish);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish();
    });
  }));
}

/**
 * 入力ダイアログ（テキスト入力＋OK/キャンセル）。prompt()の代わり。
 * @param {{title?: string, message?: string, defaultValue?: string, confirmLabel?: string, cancelLabel?: string}} options
 * @returns {Promise<string|null>} OK時は入力文字列、キャンセル時はnull
 */
export function showPrompt({ title, message, defaultValue = '', confirmLabel = 'OK', cancelLabel = 'キャンセル' }) {
  return enqueueDialog(() => new Promise((resolve) => {
    const overlay = buildOverlay(`
      ${title ? `<h2 class="dialog-title">${escapeHtml(title)}</h2>` : ''}
      ${message ? `<p class="dialog-message">${escapeHtml(message)}</p>` : ''}
      <input type="text" class="dialog-input" value="${escapeHtml(defaultValue)}" maxlength="50">
      <div class="dialog-actions">
        <button type="button" class="dialog-btn dialog-cancel">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="dialog-btn dialog-confirm">${escapeHtml(confirmLabel)}</button>
      </div>
    `);
    const input = overlay.querySelector('.dialog-input');
    input.focus();
    input.select();

    const finish = (result) => {
      closeOverlay(overlay);
      resolve(result);
    };
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => finish(null));
    overlay.querySelector('.dialog-confirm').addEventListener('click', () => finish(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value);
      if (e.key === 'Escape') finish(null);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
  }));
}
