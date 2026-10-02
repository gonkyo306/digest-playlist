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
  // フェーズ41：丸みのある2本の線が交差し、右向きの矢印へ伸びる形に変更（線の端は丸く、矢じりは塗りつぶし）
  shuffle: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 6.5H7C10.5 6.5 13 17.5 16.5 17.5H17.5"/><path d="M3 17.5H7C10.5 17.5 13 6.5 16.5 6.5H17.5"/></g><g fill="currentColor"><polygon points="16.5,2.8 22,6.5 16.5,10.2"/><polygon points="16.5,13.8 22,17.5 16.5,21.2"/></g></svg>',
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
  // フェーズ41（CR-072再修正6）：プレイリストタブ用アイコン。複数のプレイリストが後ろに連なっている
  // 様子を、右上へずらした2枚の影（.tab-icon-peek1/2）で表現する。ずらし幅をフェーズ40の約2倍に
  // 広げ、各層の間にタブバーの背景色の細い区切り線（stroke）を入れて、層の境目が分かるようにした。
  // 手前の枠はひと回り小さく、2連符も同じ比率（約0.9倍）で収めている。枠・影の色は
  // currentColorに追従する（非選択＝薄いグレー／選択中＝青）。2連符はテーマに応じて黒／白
  // （--tab-icon-note-color）。連桁は緩やかな右肩上がりで、2本の縦棒はほぼ同じ長さにしてある
  playlistTab: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect class="tab-icon-peek2" x="6.3" y="0.7" width="17" height="17" rx="5.4"/><rect class="tab-icon-peek1" x="3.9" y="3.1" width="17" height="17" rx="5.4"/><rect class="tab-icon-frame" x="1.5" y="5.5" width="17" height="17" rx="5.4"/><g class="tab-icon-notes" transform="translate(10,14) scale(.895) translate(-12,-12)"><polygon points="7.4,11.0 7.4,8.4 16.6,6.8 16.6,9.4"/><rect x="7.4" y="8.4" width="1.4" height="8.0"/><rect x="15.2" y="7.05" width="1.4" height="8.0"/><ellipse cx="7.1" cy="16.4" rx="2.1" ry="1.6" transform="rotate(-15 7.1 16.4)"/><ellipse cx="14.9" cy="15.05" rx="2.1" ry="1.6" transform="rotate(-10 14.9 15.05)"/></g></svg>',
  // フェーズ37（再修正2）：追加直後の取り消し操作（CR-073）のアイコンを、×から反時計回りの
  // 巻き戻しアイコンに変更。フェーズ39（再修正3）：隙間を約40度→約60度に拡大し、
  // 円が閉じていないことをより分かりやすくした
  rewind: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M5.07 16A8 8 0 1 0 5.07 8"/><path fill="currentColor" d="M2.57 12.33L7.67 9.5 2.47 6.5Z"/></svg>',
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
