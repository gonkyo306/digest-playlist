// フェーズ5：確認・入力ダイアログ（ブラウザ標準のconfirm/promptの代わりに、
// アプリのデザインに合わせた独自の見た目のダイアログを表示する）
//
// confirm()/prompt()と違い非同期（Promiseベース）。呼び出し側は await で結果を待つ。

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  return new Promise((resolve) => {
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
  });
}

/**
 * 入力ダイアログ（テキスト入力＋OK/キャンセル）。prompt()の代わり。
 * @param {{title?: string, message?: string, defaultValue?: string, confirmLabel?: string, cancelLabel?: string}} options
 * @returns {Promise<string|null>} OK時は入力文字列、キャンセル時はnull
 */
export function showPrompt({ title, message, defaultValue = '', confirmLabel = 'OK', cancelLabel = 'キャンセル' }) {
  return new Promise((resolve) => {
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
  });
}
