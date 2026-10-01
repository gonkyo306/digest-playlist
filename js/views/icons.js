// 再生操作・追加/削除操作を、アイコン（テキストラベル併記）で表示するための最小限のSVGアイコン集
// （FR-5.3）。外部のアイコンフォント・CDNには依存せず、インラインSVGのみを使う。

const ICONS = {
  play: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 5l10 7-10 7V5zM18 5h2v14h-2z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M18 5L8 12l10 7V5zM4 5h2v14H4z"/></svg>',
  add: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  remove: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  minus: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M5 11h14v2H5z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M14.83 13.41L13.42 14.82L16.55 17.95L14.5 20H20V14.5L17.96 16.54L14.83 13.41M14.5 4L16.54 6.04L4 18.59L5.41 20L17.96 7.46L20 9.5V4M10.59 9.17L5.41 4L4 5.41L9.17 10.58L10.59 9.17Z"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z"/></svg>',
  disc: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 14a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z"/></svg>',
  // CR-043：プレイリスト作成画面の画像未設定時プレースホルダー（大きめに表示する。FR-2.17）
  camera: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9 3l-1.83 2H4a2 2 0 00-2 2v11a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2h-3.17L15 3H9zm3 15a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/></svg>',
  // CR-043/049：プレイリスト作成画面・編集モードのキャンセル（×のみ）ボタン
  close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.99 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  // CR-043/047/049：プレイリスト作成画面・編集モードの保存ボタン、＋タップ後の即時追加の合図（チェックのみ）
  check: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9 16.17L4.83 12l-1.41 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  // フェーズ37（CR-072）：タブバーの検索タブ用アイコン（虫眼鏡。カード等の背景は付けない）
  search: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M10.5 4a6.5 6.5 0 110 13 6.5 6.5 0 010-13z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.3 15.3L20.5 20.5"/></svg>',
};

/**
 * アイコン＋テキストラベルのHTMLを組み立てる。ボタンのinnerHTMLとして使う（主に再生・一時停止・
 * 前へ・次へ等、メインの再生操作に使う。CR-011以降、追加/試聴/削除/戻る等はiconOnlyを使う）。
 * @param {keyof typeof ICONS} name
 * @param {string} label ボタンに併記するテキストラベル
 */
export function iconLabel(name, label) {
  const svg = ICONS[name] || '';
  return `<span class="icon-label">${svg}<span class="icon-label-text">${label}</span></span>`;
}

/**
 * アイコンのみのHTMLを組み立てる（テキストラベルなし。FR-5.3/CR-011）。
 * 呼び出し側で、ボタン要素自体にaria-label属性を付けてアクセシビリティを担保すること。
 * @param {keyof typeof ICONS} name
 */
export function iconOnly(name) {
  return `<span class="icon-only">${ICONS[name] || ''}</span>`;
}

/**
 * 検索結果の種別アイコン（曲・アーティスト・アルバム。CR-026）。
 * iconOnlyとは別に、行内のインラインマーカーとして使う小さめのアイコン。
 * @param {'track'|'artist'|'album'} type
 */
export function typeIcon(type) {
  const name = type === 'artist' ? 'person' : type === 'album' ? 'disc' : 'note';
  const label = type === 'artist' ? 'アーティスト' : type === 'album' ? 'アルバム' : '曲';
  return `<span class="result-type-icon" aria-label="${label}" title="${label}">${ICONS[name] || ''}</span>`;
}
