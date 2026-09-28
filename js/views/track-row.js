// 検索結果で共通して使う行テンプレート（FR-1.2, FR-1.5, FR-1.12, FR-1.13）。
// 統合検索結果（曲・アーティスト・アルバム混在、CR-017）・アルバム収録曲一覧のいずれからも使う。
// CR-011：追加・削除ボタンはアイコンのみ（テキストラベルなし）。
// CR-021/024：カート機能は廃止し、チェックボックスはその場での複数選択（一括追加）用として使う。
// CR-026：行の種別（曲／アーティスト／アルバム）をアイコンで示す。
// フェーズ21（CR-033）：曲の試聴は、行タップ（＋ボタン部分を除く）で開始／停止する。
// 試聴専用のアイコンは表示しない。
// フェーズ23（実機確認フィードバック）：チェックボックスは廃止し、行の一番右に小さめの丸い
// ＋アイコンボタン（白＝未選択／赤＝選択済みのトグル）を置く。ボタンはジャケット・曲名の
// カードと同じ背景の中に収め、カードの右端までを1つの塊として囲む（見た目上は内側だが、
// タップ領域は行本体とは独立しており、＋ボタンをタップしても試聴は始まらない）。

import { typeIcon, iconOnly } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 曲1件分の行（チェックボックスで複数選択→一括追加。行タップで試聴の開始／停止）。
 * @param {{id, title, artist, album, artwork}} track
 * @param {number} index
 * @param {{checked?: boolean}} [options]
 */
export function trackRowHtml(track, index, options = {}) {
  const { checked = false } = options;
  return `
    <li class="list-item track-item" data-index="${index}">
      <button type="button" class="list-item-main track-play" data-index="${index}" aria-label="試聴">
        ${typeIcon('track')}
        <img src="${escapeHtml(track.artwork)}" alt="" class="artwork-sm">
        <div class="item-main">
          <div class="item-name">${escapeHtml(track.title)}</div>
          <div class="item-sub">${escapeHtml(track.artist)}${track.album ? ` / ${escapeHtml(track.album)}` : ''}</div>
        </div>
      </button>
      <button type="button" class="toggle-add-btn${checked ? ' is-selected' : ''}" data-index="${index}"
        aria-pressed="${checked}" aria-label="追加候補への登録・解除を切り替え">
        ${iconOnly('add')}
      </button>
    </li>
  `;
}

/**
 * 段階検索のアルバム曲一覧で使う、番号＋曲名だけの簡易行（CR-013）。
 * ジャケット・アーティスト名・アルバム名は、一覧の外側（アルバム情報欄）に1回だけ表示する前提で省く。
 * @param {{id, title}} track
 * @param {number} index
 * @param {{checked?: boolean}} [options]
 */
export function compactTrackRowHtml(track, index, options = {}) {
  const { checked = false } = options;
  return `
    <li class="list-item track-item track-item-compact" data-index="${index}">
      <button type="button" class="list-item-main track-play" data-index="${index}" aria-label="試聴">
        <span class="track-number">${index + 1}.</span>
        <div class="item-main">
          <div class="item-name">${escapeHtml(track.title)}</div>
        </div>
      </button>
      <button type="button" class="toggle-add-btn${checked ? ' is-selected' : ''}" data-index="${index}"
        aria-pressed="${checked}" aria-label="追加候補への登録・解除を切り替え">
        ${iconOnly('add')}
      </button>
    </li>
  `;
}

/**
 * アーティスト1件分の行（CR-017：タップでそのアーティストのアルバム一覧へドリルダウン）。
 * @param {{id, name}} artist
 * @param {number} index
 */
export function artistRowHtml(artist, index) {
  return `
    <li class="list-item" data-index="${index}">
      <button type="button" class="list-item-main result-artist-open" data-index="${index}">
        ${typeIcon('artist')}
        <span class="item-name">${escapeHtml(artist.name)}</span>
      </button>
    </li>
  `;
}

/**
 * アルバム1件分の行（CR-017：タップでそのアルバムの収録曲一覧へドリルダウン）。
 * @param {{id, name, artist, artwork}} album
 * @param {number} index
 * @param {{showTypeIcon?: boolean}} [options] アーティストのアルバム一覧（全行がアルバムで種別が自明な画面）
 *   ではshowTypeIcon:falseを指定し、種別アイコンを省略する（CR-031）
 */
export function albumRowHtml(album, index, options = {}) {
  const { showTypeIcon = true } = options;
  return `
    <li class="list-item" data-index="${index}">
      <button type="button" class="list-item-main result-album-open" data-index="${index}">
        ${showTypeIcon ? typeIcon('album') : ''}
        <img src="${escapeHtml(album.artwork)}" alt="" class="artwork-sm">
        <div class="item-main">
          <div class="item-name">${escapeHtml(album.name)}</div>
          <div class="item-sub">${escapeHtml(album.artist)}</div>
        </div>
      </button>
    </li>
  `;
}

/**
 * トラック行のイベント（試聴の開始／停止・＋ボタンでの選択切り替え）を結びつける。
 * 行タップ（＋ボタン部分を除く）で、その曲の試聴を開始／停止する（CR-033）。
 * @param {HTMLElement} listEl trackRowHtml/compactTrackRowHtmlをmapしたulなどの要素
 * @param {Array<object>} tracks
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer, onCheckToggle: Function}} handlers
 */
export function bindTrackRowEvents(listEl, tracks, { previewPlayer, onCheckToggle }) {
  listEl.querySelectorAll('.track-play').forEach((btn) => {
    const track = tracks[Number(btn.dataset.index)];
    btn.addEventListener('click', () => {
      if (previewPlayer.isPlaying && previewPlayer.currentTrackId === track.id) {
        previewPlayer.stop();
      } else {
        previewPlayer.play(track);
      }
    });
  });

  listEl.querySelectorAll('.toggle-add-btn').forEach((btn) => {
    const track = tracks[Number(btn.dataset.index)];
    btn.addEventListener('click', () => {
      // チェックボックス（自身の見た目を自律的に切り替える）と同様、ボタン自身の見た目も
      // ここで直接切り替える。呼び出し側（search-view.js）はヘッダーの「追加」ボタンの
      // 件数表示を更新するだけでよく、行一覧全体の再描画は不要。
      const nextChecked = !btn.classList.contains('is-selected');
      btn.classList.toggle('is-selected', nextChecked);
      btn.setAttribute('aria-pressed', String(nextChecked));
      onCheckToggle(track, nextChecked);
    });
  });
}

/**
 * アーティスト行のドリルダウンイベントを結びつける。
 * @param {HTMLElement} listEl
 * @param {Array<object>} artists
 * @param {(artist: object) => void} onOpen
 */
export function bindArtistRowEvents(listEl, artists, onOpen) {
  listEl.querySelectorAll('.result-artist-open').forEach((btn) => {
    const artist = artists[Number(btn.dataset.index)];
    btn.addEventListener('click', () => onOpen(artist));
  });
}

/**
 * アルバム行のドリルダウンイベントを結びつける。
 * @param {HTMLElement} listEl
 * @param {Array<object>} albums
 * @param {(album: object) => void} onOpen
 */
export function bindAlbumRowEvents(listEl, albums, onOpen) {
  listEl.querySelectorAll('.result-album-open').forEach((btn) => {
    const album = albums[Number(btn.dataset.index)];
    btn.addEventListener('click', () => onOpen(album));
  });
}
