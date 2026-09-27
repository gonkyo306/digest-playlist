// 再生操作・追加/削除操作を、アイコン（テキストラベル併記）で表示するための最小限のSVGアイコン集
// （FR-5.3）。外部のアイコンフォント・CDNには依存せず、インラインSVGのみを使う。

const ICONS = {
  play: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 5l10 7-10 7V5zM18 5h2v14h-2z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M18 5L8 12l10 7V5zM4 5h2v14H4z"/></svg>',
  add: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  added: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  remove: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM17 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.2 15h9.6c.75 0 1.41-.41 1.75-1.03L21.7 6H6.2l-.94-2H2v2h2l3.6 7.6-1.35 2.45C5.52 16.37 6.48 17 7.2 15z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M14.83 13.41L13.42 14.82L16.55 17.95L14.5 20H20V14.5L17.96 16.54L14.83 13.41M14.5 4L16.54 6.04L4 18.59L5.41 20L17.96 7.46L20 9.5V4M10.59 9.17L5.41 4L4 5.41L9.17 10.58L10.59 9.17Z"/></svg>',
};

/**
 * アイコン＋テキストラベルのHTMLを組み立てる。ボタンのinnerHTMLとして使う。
 * @param {keyof typeof ICONS} name
 * @param {string} label ボタンに併記するテキストラベル
 */
export function iconLabel(name, label) {
  const svg = ICONS[name] || '';
  return `<span class="icon-label">${svg}<span class="icon-label-text">${label}</span></span>`;
}
