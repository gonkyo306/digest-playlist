// 検索結果で共通して使う行テンプレート（FR-1.2, FR-1.5, FR-1.12, FR-1.20, FR-1.21）。
// 統合検索結果（曲・アーティスト・アルバム混在）・アルバム収録曲一覧のいずれからも使う。
// 操作ボタンはアイコンのみ（テキストラベルなし）。行の種別（曲／アーティスト／アルバム）はアイコンで示す。
// 曲の試聴は、行タップ（＋ボタン部分を除く）で開始／停止する。試聴専用のアイコンは表示しない。
// ＋ボタンをタップすると、即座に現在の追加先プレイリストへ1曲だけ追加する。追加と同時に、＋アイコンは
// チェックアイコンへ余韻を残すアニメーションを伴って変化し、その後「取り消し可能」な表示
// （チェックアイコン（直線のみ）の右上に、巻き戻しアイコンの取り消しバッジを重ねる。FR-1.21）に
// 置き換わる。取り消しバッジをタップして取り消すと、フェードアウトした後、＋ボタンにフェードインで戻る
// （search-view.js側のjustAddedIdsが、ドリルダウン等で画面が変わると確定〈added扱い〉にリセットされる）。
// 表示された時点で既に追加先に含まれている曲は、最初から静的な「追加済」バッジを表示する
// （FR-1.20、取り消し不可）。追加先プレイリストが1件も無い場合でも＋ボタンは常に表示する
// （search-view.js側で、＋タップ時にその場で作成して追加するダイアログを出す）。
// アルバム収録曲一覧の番号は数字のみ（末尾のピリオドなし）。

import { typeIcon, iconOnly } from './icons.js';
import { marqueeHtml, setupMarquees } from '../marquee.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * ＋ボタン、静的な「追加済」バッジ（FR-1.20）、または取り消し可能な表示（FR-1.21。
 * チェックアイコン＋右上の巻き戻しアイコン）のHTMLを組み立てる。
 * @param {number|string} index
 * @param {boolean} added 画面が表示された時点で既に追加先に含まれていたか（FR-1.20。取り消し不可）
 * @param {boolean} justAdded その場（今回の＋タップ）で追加した曲か（FR-1.21。取り消し可能）
 */
function addControlHtml(index, added, justAdded) {
  if (justAdded) {
    return `<span class="added-check-wrap" data-index="${index}">
      <span class="added-check-icon" aria-hidden="true">${iconOnly('check')}</span>
      <button type="button" class="added-undo-x" data-index="${index}" aria-label="追加を取り消す">${iconOnly('rewind')}</button>
    </span>`;
  }
  if (added) {
    return '<span class="added-badge" aria-label="追加済み">追加済</span>';
  }
  return `<button type="button" class="toggle-add-btn" data-index="${index}" aria-label="追加先に追加">${iconOnly('add')}</button>`;
}

/**
 * 曲1件分の行（＋ボタンのタップで、現在の追加先プレイリストへ即座に追加する。行タップで試聴の開始／停止）。
 * @param {{id, title, artist, album, artwork}} track
 * @param {number} index
 * @param {{added?: boolean, justAdded?: boolean}} [options] addedは、表示された時点で既に
 *   追加先プレイリストに含まれているか（FR-1.20）。justAddedは、その場で追加した曲か（FR-1.21）
 */
export function trackRowHtml(track, index, options = {}) {
  const { added = false, justAdded = false } = options;
  return `
    <li class="list-item track-item" data-index="${index}">
      <button type="button" class="list-item-main track-play" data-index="${index}" aria-label="試聴">
        ${typeIcon('track')}
        <img src="${escapeHtml(track.artwork)}" alt="" class="artwork-sm">
        <div class="item-main">
          ${marqueeHtml(track.title)}
          <div class="item-sub">${escapeHtml(track.artist)}${track.album ? ` / ${escapeHtml(track.album)}` : ''}</div>
        </div>
      </button>
      ${addControlHtml(index, added, justAdded)}
    </li>
  `;
}

/**
 * アルバムの収録曲一覧で使う、番号＋曲名だけの簡易行。
 * ジャケット・アーティスト名・アルバム名は、一覧の外側（アルバム情報欄）に1回だけ表示する前提で省く。
 * 番号は数字のみを表示し、末尾にピリオドは付けない。
 * @param {{id, title}} track
 * @param {number} index
 * @param {{added?: boolean, justAdded?: boolean}} [options]
 */
export function compactTrackRowHtml(track, index, options = {}) {
  const { added = false, justAdded = false } = options;
  return `
    <li class="list-item track-item track-item-compact" data-index="${index}">
      <button type="button" class="list-item-main track-play" data-index="${index}" aria-label="試聴">
        <span class="track-number">${index + 1}</span>
        <div class="item-main">
          ${marqueeHtml(track.title)}
        </div>
      </button>
      ${addControlHtml(index, added, justAdded)}
    </li>
  `;
}

/**
 * アーティスト1件分の行（タップでそのアーティストのアルバム一覧へドリルダウン）。
 * @param {{id, name}} artist
 * @param {number} index
 */
export function artistRowHtml(artist, index) {
  return `
    <li class="list-item" data-index="${index}">
      <button type="button" class="list-item-main result-artist-open" data-index="${index}">
        ${typeIcon('artist')}
        <div class="item-main">${marqueeHtml(artist.name)}</div>
      </button>
    </li>
  `;
}

/**
 * アルバム1件分の行（タップでそのアルバムの収録曲一覧へドリルダウン）。
 * @param {{id, name, artist, artwork}} album
 * @param {number} index
 * @param {{showTypeIcon?: boolean}} [options] アーティストのアルバム一覧（全行がアルバムで種別が自明な画面）
 *   ではshowTypeIcon:falseを指定し、種別アイコンを省略する
 */
export function albumRowHtml(album, index, options = {}) {
  const { showTypeIcon = true } = options;
  return `
    <li class="list-item" data-index="${index}">
      <button type="button" class="list-item-main result-album-open" data-index="${index}">
        ${showTypeIcon ? typeIcon('album') : ''}
        <img src="${escapeHtml(album.artwork)}" alt="" class="artwork-sm">
        <div class="item-main">
          ${marqueeHtml(album.name)}
          <div class="item-sub">${escapeHtml(album.artist)}</div>
        </div>
      </button>
    </li>
  `;
}

/**
 * トラック行のイベント（試聴の開始／停止・＋ボタンでの即時追加・×バッジでの取消）を
 * 結びつける。行タップ（＋ボタン部分を除く）で、その曲の試聴を開始／停止する。
 * ＋ボタンをタップすると、即座にonAddを呼んで追加する。追加が成立したら、＋アイコンを
 * 一瞬チェックアイコンに変化させてから（余韻）、チェックアイコン＋右上の×バッジの表示に
 * 置き換える（FR-1.21）。取り消しバッジをタップするとonRemoveを呼び、
 * 成立したらフェードアウト→フェードインで＋ボタンの表示に戻す。
 * @param {HTMLElement} listEl trackRowHtml/compactTrackRowHtmlをmapしたulなどの要素
 * @param {Array<object>} tracks
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer,
 *   onAdd: (track: object) => Promise<{added: boolean}>,
 *   onRemove: (track: object) => Promise<{removed: boolean}>}} handlers
 */
export function bindTrackRowEvents(listEl, tracks, { previewPlayer, onAdd, onRemove }) {
  // 曲名が1行に収まらないときは自動スクロールする
  setupMarquees(listEl);
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

  /** チェックアイコン右上の取り消しバッジをタップして取り消す。成立したらフェードアウト→
   * フェードインで＋ボタンに戻す */
  function bindUndoX(wrapEl, track, index) {
    const xBtn = wrapEl.querySelector('.added-undo-x');
    xBtn.addEventListener('click', async () => {
      xBtn.disabled = true;
      // タップした瞬間、巻き戻しアイコン自体を反時計回りに1周回転させる
      // （チェックアイコンは回転させない）
      xBtn.classList.add('spin-once');
      let result;
      try {
        result = await onRemove(track);
      } catch {
        result = { removed: false };
      }
      if (!wrapEl.isConnected) return; // 待っている間に画面が切り替わっていれば何もしない
      if (!result || !result.removed) {
        xBtn.disabled = false;
        xBtn.classList.remove('spin-once');
        return;
      }
      // 回転（500ms）が終わったあと、一呼吸（150ms）おいてからフェードアウトを始める
      setTimeout(() => {
        if (!wrapEl.isConnected) return;
        wrapEl.classList.add('fading-out');
        setTimeout(() => {
          if (!wrapEl.isConnected) return;
          const wrapper = document.createElement('div');
          wrapper.innerHTML = addControlHtml(index, false, false);
          const plusBtn = wrapper.firstElementChild;
          plusBtn.classList.add('fading-in');
          wrapEl.replaceWith(plusBtn);
          // 次のフレームでクラスを外し、フェードインのtransitionを発火させる
          requestAnimationFrame(() => plusBtn.classList.remove('fading-in'));
          bindAddButton(plusBtn, track, index);
        }, 280);
      }, 650);
    });
  }

  function bindAddButton(btn, track, index) {
    btn.addEventListener('click', async () => {
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
        wrapper.innerHTML = addControlHtml(index, false, true);
        const wrapEl = wrapper.firstElementChild;
        btn.replaceWith(wrapEl);
        bindUndoX(wrapEl, track, index);
      }, 650);
    });
  }

  listEl.querySelectorAll('.toggle-add-btn').forEach((btn) => {
    const track = tracks[Number(btn.dataset.index)];
    bindAddButton(btn, track, btn.dataset.index);
  });

  listEl.querySelectorAll('.added-check-wrap').forEach((wrapEl) => {
    const track = tracks[Number(wrapEl.dataset.index)];
    bindUndoX(wrapEl, track, wrapEl.dataset.index);
  });
}

/**
 * アーティスト行のドリルダウンイベントを結びつける。
 * @param {HTMLElement} listEl
 * @param {Array<object>} artists
 * @param {(artist: object) => void} onOpen
 */
export function bindArtistRowEvents(listEl, artists, onOpen) {
  setupMarquees(listEl);
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
  setupMarquees(listEl);
  listEl.querySelectorAll('.result-album-open').forEach((btn) => {
    const album = albums[Number(btn.dataset.index)];
    btn.addEventListener('click', () => onOpen(album));
  });
}
