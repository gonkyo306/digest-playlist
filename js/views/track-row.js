// 検索結果で共通して使う行テンプレート（FR-1.2, FR-1.5, FR-1.12, FR-1.20）。
// 統合検索結果（曲・アーティスト・アルバム混在、CR-017）・アルバム収録曲一覧のいずれからも使う。
// CR-011：追加・削除ボタンはアイコンのみ（テキストラベルなし）。
// CR-026：行の種別（曲／アーティスト／アルバム）をアイコンで示す。
// フェーズ21（CR-033）：曲の試聴は、行タップ（＋ボタン部分を除く）で開始／停止する。
// 試聴専用のアイコンは表示しない。
// フェーズ28（CR-047）：複数選択→一括追加の方式を廃止し、＋ボタンをタップした時点で即座に
// 現在の追加先プレイリストへ1曲だけ追加する方式に変更した。追加と同時に、＋アイコンは
// チェックアイコンへ、余韻を残すアニメーションを伴って変化し、その後「追加済」バッジに置き換わる
// （FR-1.20）。表示された時点で既に追加先に含まれている曲は、最初から「追加済」バッジを表示する。
// フェーズ28（CR-048）：行の意匠はカードから横線区切りに変更（CSS側で対応）。アルバム収録曲一覧の
// 番号表示から末尾のピリオドを削除した（「1.」ではなく「1」）。

import { typeIcon, iconOnly } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** ＋ボタン、または「追加済」バッジのHTMLを組み立てる（FR-1.12・FR-1.20） */
function addControlHtml(index, added) {
  if (added) {
    return '<span class="added-badge" aria-label="追加済み">追加済</span>';
  }
  return `<button type="button" class="toggle-add-btn" data-index="${index}" aria-label="追加先に追加">${iconOnly('add')}</button>`;
}

/**
 * 曲1件分の行（＋ボタンのタップで、現在の追加先プレイリストへ即座に追加する。行タップで試聴の開始／停止）。
 * @param {{id, title, artist, album, artwork}} track
 * @param {number} index
 * @param {{added?: boolean}} [options] addedは、表示された時点で既に追加先プレイリストに含まれているか
 */
export function trackRowHtml(track, index, options = {}) {
  const { added = false } = options;
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
      ${addControlHtml(index, added)}
    </li>
  `;
}

/**
 * アルバムの収録曲一覧で使う、番号＋曲名だけの簡易行（CR-013）。
 * ジャケット・アーティスト名・アルバム名は、一覧の外側（アルバム情報欄）に1回だけ表示する前提で省く。
 * 番号は数字のみを表示し、末尾にピリオドは付けない（CR-048）。
 * @param {{id, title}} track
 * @param {number} index
 * @param {{added?: boolean}} [options]
 */
export function compactTrackRowHtml(track, index, options = {}) {
  const { added = false } = options;
  return `
    <li class="list-item track-item track-item-compact" data-index="${index}">
      <button type="button" class="list-item-main track-play" data-index="${index}" aria-label="試聴">
        <span class="track-number">${index + 1}</span>
        <div class="item-main">
          <div class="item-name">${escapeHtml(track.title)}</div>
        </div>
      </button>
      ${addControlHtml(index, added)}
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
 * トラック行のイベント（試聴の開始／停止・＋ボタンでの即時追加）を結びつける。
 * 行タップ（＋ボタン部分を除く）で、その曲の試聴を開始／停止する（CR-033）。
 * ＋ボタンをタップすると、即座にonAddを呼んで追加する。追加が成立したら、＋アイコンを
 * 一瞬チェックアイコンに変化させてから（余韻）、「追加済」バッジに置き換える（CR-047）。
 * @param {HTMLElement} listEl trackRowHtml/compactTrackRowHtmlをmapしたulなどの要素
 * @param {Array<object>} tracks
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer,
 *   onAdd: (track: object) => Promise<{added: boolean}>}} handlers
 */
export function bindTrackRowEvents(listEl, tracks, { previewPlayer, onAdd }) {
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
    btn.addEventListener('click', async () => {
      const index = btn.dataset.index;
      btn.disabled = true;
      btn.classList.add('add-btn-confirmed');
      btn.innerHTML = iconOnly('check');
      let result;
      try {
        result = await onAdd(track);
      } catch {
        result = { added: false };
      }
      if (!btn.isConnected) return; // 待っている間に画面が切り替わっていれば何もしない
      if (!result || !result.added) {
        // 想定外の失敗時は＋ボタンの見た目に戻す
        btn.disabled = false;
        btn.classList.remove('add-btn-confirmed');
        btn.innerHTML = iconOnly('add');
        return;
      }
      setTimeout(() => {
        if (!btn.isConnected) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = addControlHtml(index, true);
        btn.replaceWith(wrapper.firstElementChild);
      }, 650);
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
