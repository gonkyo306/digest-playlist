// プレイリスト詳細画面（曲一覧の表示。FR-2.9, FR-2.5）
// 曲の追加は検索タブから行う（FR-2.4）。曲一覧はアーティスト名順で表示（FR-2.11）。
// 操作ボタンはアイコンのみ（テキストラベルなし。FR-5.3）。
// 再生中の操作（一時停止・次へ）は、画面下部のミニプレイヤーに集約する（js/app.js側）。
// 曲の行をタップすると、その曲から再生を始める（FR-2.13。専用アイコンは付けない）。
// ヘッダーはApple Music風（大きめジャケット・名前・シャッフルボタンとピル型再生ボタンを縦並び。FR-2.10）。
//   プレイリスト自体に画像（coverImage）が設定されていればそれを、無ければ先頭の曲のジャケットを
//   代表画像として使う。
// シャッフルは、アルバム詳細と同じ丸いON/OFF切り替えボタン。既定はON（FR-4.2の「毎回ランダム」）。
//   OFFにすると、曲一覧の表示順（アーティスト名順）で、再生ボタンなら先頭から、行タップなら
//   その曲の次から順に連続再生する（FR-2.15、FR-2.16）。
// シャッフル・再生ボタンは、このプレイリストの再生中も常に表示する（曲数「N曲」は表示しない）。
// 右上の「編集」ボタン（隣に「削除」ボタン）を押すと編集モードに入る（FR-2.14）。編集モード中は、
//   名前は通常時と同じ見出し（h1）のまま直接編集でき（背景・枠線のボックスは無い）、各曲の右に
//   赤いマイナスボタンが表示される（タップすると行がフェードアウトして一覧から消えるが、削除は確定しない）。
//   ヒーロー画像もタップして変更でき（カメラアイコンを重ねて表示。FR-2.19）、変更は保存/キャンセルの
//   対象に含まれる。「保存」で名前・曲一覧・画像をまとめて確定し、「キャンセル」で編集前の状態に戻す。
//   「キャンセル」「保存」は、プレイリスト作成画面（FR-2.17）と同じ×／チェックのアイコンのみボタン。
//   編集モード中もシャッフル・再生ボタンの場所は残し、薄く表示して操作できない状態にする
//   （名前より下の位置・曲一覧の位置・各行の高さを通常画面と同じに保つ）。
//   プレイリスト自体の削除ボタンは編集モードに含めず、通常時から独立して常に操作できる（FR-2.3）。

import { showConfirm } from './dialog.js';
import { sortTracksByArtist } from '../playlist-sort.js';
import { iconOnly } from './icons.js';
import { largeArtworkUrl } from '../artwork-url.js';
import { resizeImageToJpeg } from '../image-resize.js';
import { blobToUrl } from '../blob-url-cache.js';
import { pushBackState, popBackState } from '../back-stack.js';
import { marqueeHtml, setupMarquees } from '../marquee.js';

// 編集モードで曲を削除するときのフェードアウトの長さ（css/style.cssの.track-item.removingと揃える）
const TRACK_FADE_MS = 280;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{playlist: object, tracks: Array<object>, fetchError?: string}} data
 *   tracksは取得済みの順序(playlist.trackIdsの順、取得できなかった曲を除く)のまま渡すこと。
 *   代表画像は、playlist.coverImageがあればそれを、無ければ先頭の曲(tracks[0])のジャケットを使う(FR-2.10)。
 * @param {{onBack, onDelete,
 *   onStartPlayback: (shuffleOn: boolean) => void,
 *   onTrackTap: (trackId: string|number, shuffleOn: boolean) => void,
 *   onSaveEdit: (newName: string, remainingTrackIds: string[], newImageBlob?: Blob|null) => (void|Promise<void>)}} actions
 *   onSaveEditは、編集モードで保存をタップした際に1回だけ呼ばれる(名前・曲一覧・画像の変更をまとめて確定)。
 *   newImageBlobは、画像を変更しなかった場合はundefined、変更した場合はBlob(削除相当の場合はnull)。
 *   onStartPlayback/onTrackTapには、現在のシャッフルON/OFFの状態を渡す。
 */
export function renderPlaylistDetail(container, { playlist, tracks: rawTracks, fetchError }, actions) {
  const canPlay = rawTracks.length > 0; // FR-4.14: 0曲は再生操作を無効化
  // 表示順のみアーティスト名順に並び替える(FR-2.11)。再生順(順序はtrackIds/rawTracks側)には影響しない。
  const tracks = sortTracksByArtist(rawTracks);

  let editMode = false;
  let editName = playlist.name;
  let removedIds = new Set();
  let shuffleOn = true; // 画面を開いた直後の初期状態はON（FR-2.16）
  // FR-2.19：編集モード中に選び直した画像（undefined=未変更、Blob=変更あり）
  let pendingImageBlob;
  let pendingImageObjectUrl = null;
  // 曲削除のフェードアウト待ちの間に、キャンセル・保存などで編集が終わった場合に、
  // 古い削除予約が次の編集に紛れ込まないよう、編集の世代を数える
  let editSeq = 0;

  // FR-6.3：OSの戻る操作でも、編集モードのキャンセルと同じ扱いで抜けられるようにする
  function cancelEdit() {
    editMode = false;
    editSeq++;
    editName = playlist.name;
    removedIds = new Set();
    pendingImageBlob = undefined;
    if (pendingImageObjectUrl) {
      URL.revokeObjectURL(pendingImageObjectUrl);
      pendingImageObjectUrl = null;
    }
    render();
  }

  function currentHeroArtworkUrl() {
    // 優先順位（FR-2.10）：(1) 編集中に選び直した画像 (2) プレイリストのカスタム画像
    // (3) 先頭の曲のジャケット (4) 無し（プレースホルダー）
    if (pendingImageObjectUrl) return pendingImageObjectUrl;
    if (pendingImageBlob === null) return ''; // 明示的に未設定へ戻した場合（現状のUIからは到達しない）
    if (playlist.coverImage) return blobToUrl(playlist.id, playlist.coverImage);
    return rawTracks[0]?.artwork ? largeArtworkUrl(rawTracks[0].artwork) : '';
  }

  function render() {
    // removedIdsはdata-id属性(常に文字列)経由で集めるため、比較はString(t.id)に揃える
    // (t.idはiTunes APIの数値trackIdをそのまま持つ場合があり、型が一致しないと素通りしてしまう)。
    const shownTracks = editMode ? tracks.filter((t) => !removedIds.has(String(t.id))) : tracks;
    const heroArtworkUrl = currentHeroArtworkUrl();

    container.innerHTML = `
      <div class="detail-topbar">
        ${editMode
          ? `<button id="cancel-edit-btn" class="icon-btn" aria-label="キャンセル">${iconOnly('close')}</button>`
          : `<button id="back-btn" class="icon-btn" aria-label="一覧へ戻る">${iconOnly('back')}</button>`}
        <div class="detail-topbar-actions">
          ${editMode ? `
            <button id="save-edit-btn" class="icon-btn confirm-icon-btn" aria-label="保存">${iconOnly('check')}</button>
          ` : `
            <button id="edit-btn" class="icon-btn" aria-label="編集">${iconOnly('edit')}</button>
            <button id="delete-btn" class="icon-btn" aria-label="削除">${iconOnly('remove')}</button>
          `}
        </div>
      </div>

      <div class="hero">
        ${editMode ? `
          <button type="button" id="hero-image-picker-btn" class="hero-image-picker-btn" aria-label="画像を変更">
            ${heroArtworkUrl
              ? `<img src="${escapeHtml(heroArtworkUrl)}" alt="" class="hero-artwork">`
              : `<div class="hero-artwork hero-artwork-placeholder">${iconOnly('disc')}</div>`}
            <span class="hero-camera-badge" aria-hidden="true">${iconOnly('camera')}</span>
          </button>
          <input type="file" id="hero-image-file-input" accept="image/*" hidden>
        ` : (heroArtworkUrl
          ? `<img src="${escapeHtml(heroArtworkUrl)}" alt="" class="hero-artwork">`
          : `<div class="hero-artwork hero-artwork-placeholder">${iconOnly('disc')}</div>`)}
        ${editMode
          ? `<h1 id="edit-name-input" class="hero-name hero-name-input" contenteditable="plaintext-only" role="textbox" spellcheck="false" aria-label="プレイリスト名">${escapeHtml(editName)}</h1>`
          : `<h1 class="hero-name">${escapeHtml(playlist.name)}</h1>`}
        <div class="hero-actions${editMode ? ' is-disabled' : ''}"${editMode ? ' aria-hidden="true"' : ''}>
          <button id="shuffle-btn" class="icon-btn shuffle-btn${shuffleOn ? ' active' : ''}" aria-label="シャッフル" aria-pressed="${shuffleOn}"${canPlay && !editMode ? '' : ' disabled'}>${iconOnly('shuffle')}</button>
          <button id="play-start-btn" class="pill-play-btn" aria-label="再生"${canPlay && !editMode ? '' : ' disabled'}>${iconOnly('play')}<span>再生</span></button>
        </div>
      </div>

      ${fetchError
        ? `<p class="error-banner">通信エラー：曲情報を取得できませんでした(${escapeHtml(fetchError)})。電波の良い場所で再度お試しください。</p>`
        : ''}

      <ul class="list">
        ${shownTracks.length === 0
          ? '<li class="empty">曲がまだ追加されていません。</li>'
          : shownTracks.map((t) => `
            <li class="list-item track-item" data-id="${escapeHtml(t.id)}">
              <button type="button" class="list-item-main track-play"${editMode ? ' disabled' : ''}>
                <img src="${escapeHtml(t.artwork)}" alt="" class="artwork-sm">
                <div class="item-main">
                  ${marqueeHtml(t.title)}
                  <div class="item-sub">${escapeHtml(t.artist)}</div>
                </div>
              </button>
              ${editMode ? `
                <button type="button" class="toggle-add-btn track-remove-btn" data-id="${escapeHtml(t.id)}" aria-label="この曲を削除">${iconOnly('minus')}</button>
              ` : ''}
            </li>
          `).join('')}
      </ul>
    `;

    // 曲名が1行に収まらないときは自動スクロールする
    setupMarquees(container);

    if (editMode) {
      container.querySelector('#cancel-edit-btn').addEventListener('click', () => {
        popBackState();
        cancelEdit();
      });
      // 名前の編集欄は<input>ではなく、通常時と同じ見出し（h1）を直接編集できるようにして、
      // 端末のフォントによる文字位置のずれ（入力欄だけ数px下がる）が出ないようにする。改行は入力させない
      const nameEl = container.querySelector('#edit-name-input');
      nameEl.addEventListener('input', () => {
        editName = nameEl.textContent;
      });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameEl.blur();
        }
      });
      container.querySelector('#hero-image-picker-btn').addEventListener('click', () => {
        container.querySelector('#hero-image-file-input').click();
      });
      container.querySelector('#hero-image-file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        pendingImageBlob = await resizeImageToJpeg(file);
        if (pendingImageObjectUrl) URL.revokeObjectURL(pendingImageObjectUrl);
        pendingImageObjectUrl = URL.createObjectURL(pendingImageBlob);
        render();
      });
      container.querySelector('#save-edit-btn').addEventListener('click', () => {
        popBackState();
        const finalName = editName.trim() || playlist.name;
        const remainingTrackIds = playlist.trackIds.filter((id) => !removedIds.has(String(id)));
        actions.onSaveEdit(finalName, remainingTrackIds, pendingImageBlob);
      });
      container.querySelectorAll('.track-remove-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          // 行をフェードアウトさせてから、一覧から取り除く
          const row = btn.closest('.track-item');
          if (!row || row.classList.contains('removing')) return;
          row.classList.add('removing');
          const seq = editSeq;
          setTimeout(() => {
            if (!editMode || seq !== editSeq) return;
            removedIds.add(btn.dataset.id);
            render();
          }, TRACK_FADE_MS);
        });
      });
    } else {
      container.querySelector('#back-btn').addEventListener('click', () => {
        popBackState();
        actions.onBack();
      });
      container.querySelector('#edit-btn').addEventListener('click', () => {
        editMode = true;
        editSeq++;
        render();
        // FR-6.3：編集モードに入ったことを1段階の遷移として履歴に積む
        pushBackState(cancelEdit);
      });
      container.querySelector('#delete-btn').addEventListener('click', async () => {
        const ok = await showConfirm({
          title: 'プレイリストを削除',
          // 2文目を改行して見やすくする（.dialog-messageのwhite-space:pre-lineで反映）
          message: `「${playlist.name}」を削除しますか？\nこの操作は取り消せません。`,
          confirmLabel: '削除する',
          danger: true,
        });
        if (ok) actions.onDelete();
      });

      // 通常モードではshownTracks === tracksなので、liの並び順とtracks配列のindexは一致する
      container.querySelectorAll('.track-item').forEach((li, i) => {
        const track = tracks[i];
        li.querySelector('.track-play').addEventListener('click', () => actions.onTrackTap(track.id, shuffleOn));
      });

      if (canPlay) {
        const shuffleBtn = container.querySelector('#shuffle-btn');
        shuffleBtn.addEventListener('click', () => {
          shuffleOn = !shuffleOn;
          shuffleBtn.classList.toggle('active', shuffleOn);
          shuffleBtn.setAttribute('aria-pressed', String(shuffleOn));
        });
        container.querySelector('#play-start-btn').addEventListener('click', () => actions.onStartPlayback(shuffleOn));
      }
    }
  }

  render();
}
