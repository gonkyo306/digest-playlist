// フェーズ3：プレイリスト詳細画面(曲一覧の表示。FR-2.9, FR-2.5)
// フェーズ7：「＋曲を追加」導線は廃止(検索タブから追加する。FR-2.4)
// フェーズ11：曲一覧はアーティスト名順で表示(FR-2.11)。操作ボタンはアイコン表示(FR-5.3)
// CR-011：削除・戻るボタンはアイコンのみ(テキストラベルなし)に変更
// フェーズ14(CR-016)：インライン再生パネルを廃止。再生前は「再生」ボタンのみを表示し、
// 再生後の操作(一時停止・前へ・次へ)はミニプレイヤーに集約する(js/app.js側)。
// フェーズ21(CR-032)：曲の行をタップすると、その曲から再生を始める(専用アイコンは追加しない)。
// フェーズ21(CR-034)：ヘッダーをApple Music風(大きめジャケット・名前・ピル型再生ボタンを縦並び)に変更。
//   プレイリスト自体に画像が設定されていなければ、先頭の曲のジャケットを代表画像として使う。
// フェーズ21(CR-035)：名前変更・削除ボタンを、一覧画面の各行からこの画面の右上に移設。
// フェーズ22(仕様見直し・2026-09-28)：再生中の曲のハイライト表示(CR-022)を廃止。
//   ミニプレイヤーで再生中の曲を確認できるため、曲一覧側の強調表示は不要と判断。
// フェーズ23(CR-037)：曲の削除は、右上の「編集」ボタン(従来の名前変更ボタンを置き換え)を
//   押したときの編集モード内でのみ行える。編集モード中は、名前がその場で編集できる入力欄になり、
//   各曲の右に赤いマイナスボタンが表示される(タップすると一覧から消えるが、削除は確定しない)。
//   「保存」で名前・曲一覧をまとめて確定し、「キャンセル」で編集前の状態に戻す。
//   プレイリスト自体の削除ボタンは編集モードに含めず、通常時から独立して常に操作できる。
// フェーズ24(CR-038)：ヒーローエリアの「再生」ボタンの隣に、アルバム詳細と同じ丸いシャッフル
//   ON/OFF切り替えボタンを追加する。既定はON(FR-4.2の「毎回ランダム」を維持)。OFFにすると、
//   曲一覧の表示順(アーティスト名順)で、再生ボタンなら先頭から、行タップならその曲の次から
//   順に連続再生する(FR-2.15、FR-2.16)。
// フェーズ28(CR-043)：プレイリスト自体に画像（coverImage）が設定されていれば、それを先頭曲の
//   ジャケットより優先して代表画像に使う(FR-2.10)。
// フェーズ28(CR-044/FR-2.19)：編集モード中はヒーロー画像もタップして変更でき、変更は保存/
//   キャンセルの対象に含まれる。
// フェーズ28(CR-049)：編集モードの「キャンセル」「保存」は、プレイリスト作成画面(FR-2.17)と
//   同じ×／チェックのアイコンのみボタンに統一した(既存の文字ラベル付きボタンはFR-5.3に反していた)。
//   プレイリスト名の編集欄も、背景・枠線のボックス表示をやめ、見出しと同じプレーンな表示にした。

import { showConfirm } from './dialog.js';
import { sortTracksByArtist } from '../playlist-sort.js';
import { iconOnly } from './icons.js';
import { largeArtworkUrl } from '../artwork-url.js';
import { resizeImageToJpeg } from '../image-resize.js';
import { blobToUrl } from '../blob-url-cache.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{playlist: object, tracks: Array<object>, unavailableIds: Array, fetchError?: string,
 *   isCurrentlyPlaying?: boolean}} data
 *   tracksは取得済みの順序(playlist.trackIdsの順、取得できなかった曲を除く)のまま渡すこと。
 *   代表画像は、playlist.coverImageがあればそれを、無ければ先頭の曲(tracks[0])のジャケットを使う(FR-2.10)。
 * @param {{onBack, onDelete,
 *   onStartPlayback: (shuffleOn: boolean) => void,
 *   onTrackTap: (trackId: string|number, shuffleOn: boolean) => void,
 *   onSaveEdit: (newName: string, remainingTrackIds: string[], newImageBlob?: Blob|null) => (void|Promise<void>)}} actions
 *   onSaveEditは、編集モードで保存をタップした際に1回だけ呼ばれる(名前・曲一覧・画像の変更をまとめて確定)。
 *   newImageBlobは、画像を変更しなかった場合はundefined、変更した場合はBlob(削除相当の場合はnull)。
 *   onStartPlayback/onTrackTapには、現在のシャッフルON/OFFの状態を渡す(CR-038)。
 */
export function renderPlaylistDetail(container, {
  playlist, tracks: rawTracks, unavailableIds, fetchError, isCurrentlyPlaying = false,
}, actions) {
  const canPlay = rawTracks.length > 0; // FR-4.14: 0曲は再生操作を無効化
  // 表示順のみアーティスト名順に並び替える(FR-2.11)。再生順(順序はtrackIds/rawTracks側)には影響しない。
  const tracks = sortTracksByArtist(rawTracks);
  // このプレイリストが今まさに再生中なら、以降の操作はミニプレイヤーに任せ「再生」ボタンは表示しない
  const showPlayButton = canPlay && !isCurrentlyPlaying;

  let editMode = false;
  let editName = playlist.name;
  let removedIds = new Set();
  let shuffleOn = true; // CR-038：画面を開いた直後の初期状態はON（FR-2.16）
  // CR-044（FR-2.19）：編集モード中に選び直した画像（undefined=未変更、Blob=変更あり）
  let pendingImageBlob;
  let pendingImageObjectUrl = null;

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
          </button>
          <input type="file" id="hero-image-file-input" accept="image/*" hidden>
        ` : (heroArtworkUrl
          ? `<img src="${escapeHtml(heroArtworkUrl)}" alt="" class="hero-artwork">`
          : `<div class="hero-artwork hero-artwork-placeholder">${iconOnly('disc')}</div>`)}
        ${editMode
          ? `<input type="text" id="edit-name-input" class="hero-name-input" value="${escapeHtml(editName)}" aria-label="プレイリスト名">`
          : `<h1 class="hero-name">${escapeHtml(playlist.name)}</h1>`}
        ${!editMode && showPlayButton ? `
          <div class="hero-actions">
            <button id="shuffle-btn" class="icon-btn shuffle-btn${shuffleOn ? ' active' : ''}" aria-label="シャッフル" aria-pressed="${shuffleOn}">${iconOnly('shuffle')}</button>
            <button id="play-start-btn" class="pill-play-btn" aria-label="再生">${iconOnly('play')}<span>再生</span></button>
          </div>
        ` : ''}
      </div>

      ${fetchError
        ? `<p class="error-banner">通信エラー：曲情報を取得できませんでした(${escapeHtml(fetchError)})。電波の良い場所で再度お試しください。</p>`
        : `<p class="note">
            ${shownTracks.length}曲
            ${!editMode && unavailableIds.length ? `(うち${unavailableIds.length}曲は取得できませんでした)` : ''}
          </p>`}

      <ul class="list">
        ${shownTracks.length === 0
          ? '<li class="empty">曲がまだ追加されていません。</li>'
          : shownTracks.map((t) => `
            <li class="list-item track-item" data-id="${escapeHtml(t.id)}">
              <button type="button" class="list-item-main track-play"${editMode ? ' disabled' : ''}>
                <img src="${escapeHtml(t.artwork)}" alt="" class="artwork-sm">
                <div class="item-main">
                  <div class="item-name">${escapeHtml(t.title)}</div>
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

    if (editMode) {
      container.querySelector('#cancel-edit-btn').addEventListener('click', () => {
        editMode = false;
        editName = playlist.name;
        removedIds = new Set();
        pendingImageBlob = undefined;
        if (pendingImageObjectUrl) {
          URL.revokeObjectURL(pendingImageObjectUrl);
          pendingImageObjectUrl = null;
        }
        render();
      });
      container.querySelector('#edit-name-input').addEventListener('input', (e) => {
        editName = e.target.value;
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
        const finalName = editName.trim() || playlist.name;
        const remainingTrackIds = playlist.trackIds.filter((id) => !removedIds.has(String(id)));
        actions.onSaveEdit(finalName, remainingTrackIds, pendingImageBlob);
      });
      container.querySelectorAll('.track-remove-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          removedIds.add(btn.dataset.id);
          render();
        });
      });
    } else {
      container.querySelector('#back-btn').addEventListener('click', actions.onBack);
      container.querySelector('#edit-btn').addEventListener('click', () => {
        editMode = true;
        render();
      });
      container.querySelector('#delete-btn').addEventListener('click', async () => {
        const ok = await showConfirm({
          title: 'プレイリストを削除',
          message: `「${playlist.name}」を削除しますか？この操作は取り消せません。`,
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

      if (showPlayButton) {
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
