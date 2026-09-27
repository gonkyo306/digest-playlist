// フェーズ3：メドレー詳細画面（曲一覧の表示、「曲を追加」導線。FR-2.9, FR-2.4, FR-2.5）
// フェーズ4：メドレー本編の再生パネルもここに追加（FR-4.5〜4.15, FR-4.11）
// フェーズ5：通信エラー時の表示（NFR-2.3）を追加

import { showConfirm } from './dialog.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{medley: object, tracks: Array<object>, unavailableIds: Array, fetchError?: string}} data
 * @param {{onBack, onAddTrack, onRemoveTrack, onStartPlayback, onTogglePlayPause, onNext, onPrev}} actions
 */
export function renderMedleyDetail(container, { medley, tracks, unavailableIds, fetchError }, actions) {
  const canPlay = tracks.length > 0; // FR-4.14: 0曲は再生操作を無効化

  container.innerHTML = `
    <button id="back-btn" class="link-btn">← 一覧へ戻る</button>
    <h1>${escapeHtml(medley.name)}</h1>
    ${fetchError
      ? `<p class="error-banner">通信エラー：曲情報を取得できませんでした（${escapeHtml(fetchError)}）。電波の良い場所で再度お試しください。</p>`
      : `<p class="note">
          ${medley.trackIds.length}曲
          ${unavailableIds.length ? `（うち${unavailableIds.length}曲は取得できませんでした）` : ''}
        </p>`}

    ${canPlay ? `
      <section id="playback-panel">
        <div class="now-playing">
          <img id="np-artwork" alt="" class="artwork-sm">
          <div class="item-main">
            <div id="np-title" class="item-name">（未再生）</div>
            <div id="np-artist" class="item-sub"></div>
          </div>
        </div>
        <div class="playback-controls">
          <button id="pb-prev" class="icon-btn" disabled>前へ</button>
          <button id="pb-playpause" class="primary">再生</button>
          <button id="pb-next" class="icon-btn">次へ</button>
        </div>
        <div id="pb-status" class="note"></div>
      </section>
    ` : ''}

    <button id="add-track-btn" class="primary">＋ 曲を追加</button>
    <ul class="list">
      ${tracks.length === 0
        ? '<li class="empty">曲がまだ追加されていません。「曲を追加」から検索してください。</li>'
        : tracks.map((t) => `
          <li class="list-item track-item">
            <img src="${escapeHtml(t.artwork)}" alt="" class="artwork-sm">
            <div class="item-main">
              <div class="item-name">${escapeHtml(t.title)}</div>
              <div class="item-sub">${escapeHtml(t.artist)}</div>
            </div>
            <button class="icon-btn danger track-remove" title="削除">削除</button>
          </li>
        `).join('')}
    </ul>
  `;

  container.querySelector('#back-btn').addEventListener('click', actions.onBack);
  container.querySelector('#add-track-btn').addEventListener('click', actions.onAddTrack);

  container.querySelectorAll('.track-item').forEach((li, i) => {
    const track = tracks[i];
    li.querySelector('.track-remove').addEventListener('click', async () => {
      const ok = await showConfirm({
        title: '曲を削除',
        message: `「${track.title}」をメドレーから削除しますか？`,
        confirmLabel: '削除する',
        danger: true,
      });
      if (ok) actions.onRemoveTrack(track.id);
    });
  });

  if (canPlay) {
    let started = false;
    container.querySelector('#pb-playpause').addEventListener('click', () => {
      if (!started) {
        started = true;
        actions.onStartPlayback();
      } else {
        actions.onTogglePlayPause();
      }
    });
    container.querySelector('#pb-next').addEventListener('click', () => {
      started = true;
      actions.onNext();
    });
    container.querySelector('#pb-prev').addEventListener('click', () => actions.onPrev());
  }
}

/**
 * 再生パネルだけを更新する（曲が切り替わるたびに画面全体を再描画すると、
 * 通信のやり直し・ちらつきが発生するため、パネル部分のみDOMを更新する）。
 * @param {HTMLElement} container renderMedleyDetailを呼んだのと同じcontainer
 * @param {{track: object|null, playing: boolean, canGoBack: boolean, stopped: boolean}} state
 */
export function updatePlaybackPanel(container, state) {
  const panel = container.querySelector('#playback-panel');
  if (!panel) return; // 0曲などでパネル自体が無い

  const titleEl = panel.querySelector('#np-title');
  const artistEl = panel.querySelector('#np-artist');
  const artworkEl = panel.querySelector('#np-artwork');
  const playPauseBtn = panel.querySelector('#pb-playpause');
  const prevBtn = panel.querySelector('#pb-prev');
  const statusEl = panel.querySelector('#pb-status');

  if (state.track) {
    titleEl.textContent = state.track.title;
    artistEl.textContent = state.track.artist;
    artworkEl.src = state.track.artwork || '';
  }
  playPauseBtn.textContent = state.playing ? '一時停止' : '再生';
  prevBtn.disabled = !state.canGoBack;

  if (state.stopped) {
    statusEl.textContent = 'エラー：曲の再生に連続して失敗したため、停止しました。';
  } else if (state.offlinePaused) {
    statusEl.textContent = '通信が切れたため一時停止しました。復帰後、再生ボタンで再開できます。';
  } else {
    statusEl.textContent = '';
  }
}
