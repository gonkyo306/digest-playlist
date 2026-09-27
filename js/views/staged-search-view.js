// フェーズ9・10：段階検索（アーティスト→アルバム→曲、FR-1.8, FR-1.9）。
// アルバムの曲一覧では、全曲一時再生（FR-1.11）も行える。

import { trackRowHtml, bindTrackRowEvents } from './track-row.js';
import { iconLabel } from './icons.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {HTMLElement} container
 * @param {{previewPlayer: import('../preview-player.js').PreviewPlayer}} deps
 * @param {{
 *   onSearchArtists: Function, onArtistAlbums: Function, onAlbumTracks: Function,
 *   onAdd: Function, isInCart: Function, onToggleCart: Function,
 *   onPlayAlbum: Function
 * }} actions
 */
export function renderStagedSearch(container, { previewPlayer }, actions) {
  let artists = [];
  let selectedArtist = null;
  let albums = [];
  let selectedAlbum = null;
  let tracks = [];

  function renderArtistStep() {
    previewPlayer.stop();
    container.innerHTML = `
      <form id="artist-form" class="inline-form">
        <input type="text" id="artist-term" placeholder="アーティスト名" required>
        <button type="submit">検索</button>
      </form>
      <div id="staged-status" class="note"></div>
      <ul class="list" id="artist-results"></ul>
    `;
    const statusEl = container.querySelector('#staged-status');
    container.querySelector('#artist-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const term = container.querySelector('#artist-term').value.trim();
      if (!term) return;
      statusEl.textContent = '検索中…';
      container.querySelector('#artist-results').innerHTML = '';
      try {
        artists = await actions.onSearchArtists(term);
        if (artists.length === 0) {
          statusEl.textContent = '該当するアーティストが見つかりませんでした。';
          return;
        }
        statusEl.textContent = `${artists.length}件見つかりました`;
        renderArtistResults();
      } catch (err) {
        statusEl.textContent = `検索に失敗しました: ${err.message}`;
      }
    });
  }

  function renderArtistResults() {
    const listEl = container.querySelector('#artist-results');
    listEl.innerHTML = artists
      .map(
        (a, i) => `
      <li class="list-item">
        <button type="button" class="list-item-main artist-open" data-index="${i}">
          <span class="item-name">${escapeHtml(a.name)}</span>
        </button>
      </li>
    `
      )
      .join('');
    listEl.querySelectorAll('.artist-open').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedArtist = artists[Number(btn.dataset.index)];
        loadAlbums();
      });
    });
  }

  async function loadAlbums() {
    container.innerHTML = '<div class="note">アルバムを取得中…</div>';
    try {
      albums = await actions.onArtistAlbums(selectedArtist.id);
      renderAlbumsStep();
    } catch (err) {
      container.innerHTML = `
        <button type="button" id="back-to-artists" class="link-btn">← アーティスト検索へ戻る</button>
        <p class="error-banner">アルバムの取得に失敗しました（${escapeHtml(err.message)}）</p>
      `;
      container.querySelector('#back-to-artists').addEventListener('click', renderArtistStep);
    }
  }

  function renderAlbumsStep() {
    container.innerHTML = `
      <button type="button" id="back-to-artists" class="link-btn">← アーティスト検索へ戻る</button>
      <h2>${escapeHtml(selectedArtist.name)}のアルバム</h2>
      <ul class="list" id="album-results">
        ${
          albums.length === 0
            ? '<li class="empty">アルバムが見つかりませんでした。</li>'
            : albums
                .map(
                  (a, i) => `
          <li class="list-item">
            <img src="${escapeHtml(a.artwork)}" alt="" class="artwork-sm">
            <button type="button" class="list-item-main album-open" data-index="${i}">
              <span class="item-name">${escapeHtml(a.name)}</span>
            </button>
          </li>
        `
                )
                .join('')
        }
      </ul>
    `;
    container.querySelector('#back-to-artists').addEventListener('click', renderArtistStep);
    container.querySelectorAll('.album-open').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedAlbum = albums[Number(btn.dataset.index)];
        loadAlbumTracks();
      });
    });
  }

  async function loadAlbumTracks() {
    container.innerHTML = '<div class="note">収録曲を取得中…</div>';
    try {
      tracks = await actions.onAlbumTracks(selectedAlbum.id);
      renderTracksStep();
    } catch (err) {
      container.innerHTML = `
        <button type="button" id="back-to-albums" class="link-btn">← アルバム一覧へ戻る</button>
        <p class="error-banner">収録曲の取得に失敗しました（${escapeHtml(err.message)}）</p>
      `;
      container.querySelector('#back-to-albums').addEventListener('click', renderAlbumsStep);
    }
  }

  function renderTracksStep() {
    const canPlayAlbum = tracks.length > 0;
    container.innerHTML = `
      <button type="button" id="back-to-albums" class="link-btn">← アルバム一覧へ戻る</button>
      <h2>${escapeHtml(selectedAlbum.name)}</h2>
      ${
        canPlayAlbum
          ? `
        <div class="album-play-bar">
          <label class="shuffle-toggle">
            <input type="checkbox" id="album-shuffle">
            ${iconLabel('shuffle', 'シャッフル')}
          </label>
          <button type="button" id="album-play-btn" class="primary">${iconLabel('play', 'アルバムを全曲再生')}</button>
        </div>
      `
          : ''
      }
      <ul class="list" id="album-track-results"></ul>
    `;
    container.querySelector('#back-to-albums').addEventListener('click', renderAlbumsStep);

    if (canPlayAlbum) {
      container.querySelector('#album-play-btn').addEventListener('click', () => {
        const shuffle = container.querySelector('#album-shuffle').checked;
        actions.onPlayAlbum(tracks, { shuffle, albumName: selectedAlbum.name });
      });
    }

    const listEl = container.querySelector('#album-track-results');
    listEl.innerHTML = tracks
      .map((t, i) => trackRowHtml(t, i, { checked: actions.isInCart(t.id) }))
      .join('');
    bindTrackRowEvents(listEl, tracks, {
      previewPlayer,
      onAdd: (track) => actions.onAdd(track),
      onCheckToggle: (track, checked) => actions.onToggleCart(track, checked),
    });
  }

  renderArtistStep();
}
