// フェーズ7：「追加先のプレイリストを選ぶ」モーダル（FR-2.4）。
// dialog.js と同じ、Promiseベースの独自オーバーレイ方式（ブラウザ標準confirmの代わり）。
// CR-028：dialog.jsのenqueueDialogを経由し、他のダイアログと同様に多重表示を防ぐ。
// フェーズ22（仕様見直し）：CR-025で導入した「前回と同じ／他を選ぶ」の2択ダイアログは廃止し、
// 常に全プレイリストの一覧を1画面で表示する。前回追加したプレイリストがあれば、小さな
// 「前回追加」ラベルを付けて目立たせる（選ぶ操作自体は他の行と同じ1タップ）。
// フェーズ23（実機確認フィードバック）：一覧の並び順を先頭に並べ替える方式は、追加先を探しに
// くいとの指摘を受けて廃止。並び順は変えず、ラベルは該当する行の一番右に表示する。
// フェーズ28（CR-047）：常時表示の追加先（FR-1.19）を変更するためのモーダルに位置づけを変更し、
// 各行にそのプレイリストの代表画像（FR-2.10と同じ優先順位で解決済みのもの）を表示する。
// 一覧自体は既存の縦並びリスト（.picker-list、スクロール可能）のデザインを踏襲する。
// CR-069：オーバーレイ／ボックスの組み立てとスライドアニメーションはdialog.jsのbuildOverlay/
// closeOverlayを共通利用する。
// フェーズ39（CR-061、復活）：showAddDestinationPickerで開いた場合のみ、モーダル右上に
// その場で新しいプレイリストを作成できる＋ボタンを表示する。タップするとCREATE_NEWを返して
// 閉じる（実際のプレイリスト作成画面への遷移は呼び出し側のsearch-view.jsが行う）。

import { enqueueDialog, buildOverlay, closeOverlay } from './dialog.js';
import { blobToUrl } from '../blob-url-cache.js';
import { iconOnly } from './icons.js';
import { pushBackState, popBackState } from '../back-stack.js';
import { marqueeHtml, setupMarquees } from '../marquee.js';

/** showAddDestinationPickerの＋ボタンがタップされたことを示す戻り値（CR-061） */
export const CREATE_NEW = '__create_new__';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * プレイリストの代表画像（resolvePlaylistArtworkの結果。無ければ省略可）を、行内の
 * ジャケット画像として表示するHTMLを組み立てる。
 * @param {object} playlist
 * @param {{source: 'custom'|'track'|'none', blob?: Blob, url?: string}} [artwork]
 */
function pickerRowArtworkHtml(playlist, artwork) {
  if (artwork?.source === 'custom' && artwork.blob) {
    return `<img src="${escapeHtml(blobToUrl(playlist.id, artwork.blob))}" alt="" class="artwork-sm">`;
  }
  if (artwork?.source === 'track' && artwork.url) {
    return `<img src="${escapeHtml(artwork.url)}" alt="" class="artwork-sm">`;
  }
  return `<div class="artwork-sm hero-artwork-placeholder">${iconOnly('disc')}</div>`;
}

/**
 * プレイリスト一覧から選ぶモーダル本体（enqueueDialogの外側。showPlaylistPicker/showAddDestinationPickerの共通実装）。
 * @param {Array<{id: string, name: string, trackIds: Array, artwork?: object}>} playlists
 * @param {string|null} lastUsedPlaylistId 指定があれば、その playlist の行の右端にラベルを付ける（並び順は変えない）
 * @param {boolean} showCreateButton trueなら右上に＋ボタンを表示する（CR-061、showAddDestinationPickerのみ）
 */
function openPickerList(playlists, lastUsedPlaylistId = null, showCreateButton = false) {
  return new Promise((resolve) => {
    const overlay = buildOverlay(`
      <div class="dialog-title-row">
        <h2 class="dialog-title">追加先のプレイリストを選ぶ</h2>
        ${showCreateButton ? `<button type="button" class="icon-btn picker-create-btn" aria-label="プレイリストを作成">${iconOnly('add')}</button>` : ''}
      </div>
      ${playlists.length === 0
        ? '<p class="dialog-message">プレイリストがまだありません。</p>'
        : `<ul class="list picker-list">
            ${playlists.map((m) => `
              <li class="list-item">
                <button type="button" class="list-item-main playlist-picker-item" data-id="${escapeHtml(m.id)}">
                  ${pickerRowArtworkHtml(m, m.artwork)}
                  <span class="item-main">
                    ${marqueeHtml(m.name)}
                    <div class="item-sub">${m.trackIds.length}曲</div>
                  </span>
                  ${m.id === lastUsedPlaylistId ? '<span class="picker-last-used-badge">前回追加</span>' : ''}
                </button>
              </li>
            `).join('')}
          </ul>`}
      <div class="dialog-actions">
        <button type="button" class="dialog-btn dialog-cancel">キャンセル</button>
      </div>
    `);

    // フェーズ42：プレイリスト名が1行に収まらないときは自動スクロールする
    setupMarquees(overlay);

    const finish = async (id) => {
      await closeOverlay(overlay); // CR-069：下へスライドして消えるアニメーションを待つ
      resolve(id);
    };
    // CR-053（FR-6.3）：OSの戻る操作ではキャンセル相当の扱いにする
    pushBackState(() => finish(null));
    overlay.querySelectorAll('.playlist-picker-item').forEach((btn) => {
      btn.addEventListener('click', () => { popBackState(); finish(btn.dataset.id); });
    });
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => { popBackState(); finish(null); });
    overlay.querySelector('.picker-create-btn')?.addEventListener('click', () => { popBackState(); finish(CREATE_NEW); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { popBackState(); finish(null); }
    });
  });
}

/**
 * @param {Array<{id: string, name: string, trackIds: Array}>} playlists
 * @returns {Promise<string|null>} 選んだプレイリストID。キャンセル、またはプレイリストが0件の場合はnull
 */
export function showPlaylistPicker(playlists) {
  return enqueueDialog(() => openPickerList(playlists));
}

/**
 * 追加先を選ぶ（FR-2.4）。全プレイリストを一覧表示し、各行にジャケット画像を表示する。
 * 前回追加したプレイリストがあれば、並び順はそのままに、その行の右端に「前回追加」ラベルを付ける。
 * 右上の＋ボタン（CR-061）をタップした場合はCREATE_NEWを返す（曲の自動追加は行わない。
 * 呼び出し側でプレイリスト作成画面（FR-2.17）への遷移を行う）。
 * @param {Array<{id: string, name: string, trackIds: Array, artwork?: object}>} playlists
 * @param {{lastUsedPlaylistId?: string|null}} [options]
 * @returns {Promise<string|null>}
 */
export function showAddDestinationPicker(playlists, options = {}) {
  const { lastUsedPlaylistId = null } = options;
  return enqueueDialog(() => openPickerList(playlists, lastUsedPlaylistId, true));
}
