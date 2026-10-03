// OS/ブラウザの「戻る」操作（画面左端からのスワイプ、Androidの
// 戻るボタン等。History APIのpopstate）で、アプリ内の画面・ダイアログ・編集モードを1段階ずつ
// 戻れるようにするための共通スタック。
//
// 「1段階の画面遷移」に相当するタイミング（検索のドリルダウン、プレイリスト詳細を開く、
// 編集モードに入る、ダイアログ・モーダルを開く等）でpushBackState()を呼び、history.pushStateで
// 履歴を1つ積むとともに、OSの戻る操作（popstate）が発火したときに実行する「1段階戻る」処理
// （onPop）を登録する。
//
// アプリ内の明示的な操作（画面の「戻る」ボタン、編集モードのキャンセル、ダイアログのボタン等）で
// 同じ1段階を戻る場合はpopBackState()を呼ぶ。この場合はonPopを実行せず、積んだ履歴だけを
// （history.back()で）消費する。呼び出し側が既に自分で状態遷移を行っているため、onPopの
// 二重実行を防ぐ必要がある（history.back()自体が発火させるpopstateは、直後の1回だけ無視する）。
//
// タブの切り替え自体はこのスタックの対象外（FR-6.3）。
// 各タブのトップ画面まで戻ったらそれ以上pushBackStateを呼ばないため、その状態でのOSの
// 戻る操作はブラウザ・OS標準の動作（ページ遷移・アプリを閉じる等）に委ねられる。
//
// Node環境（Unitテスト）ではwindow/historyが存在しないため、その場合は何もしない
// （pushBackStateは無視、popBackStateは常にfalseを返す）。

const hasHistoryApi = typeof window !== 'undefined' && typeof window.history !== 'undefined';

let stack = [];
let suppressNextPopstate = false;

if (hasHistoryApi) {
  window.addEventListener('popstate', () => {
    if (suppressNextPopstate) {
      suppressNextPopstate = false;
      return;
    }
    const onPop = stack.pop();
    if (onPop) onPop();
  });
}

/**
 * 「1段階の画面遷移」を開始する際に呼ぶ。
 * @param {() => void} onPop OSの戻る操作（popstate）が発火したときに実行する「1段階戻る」処理
 */
export function pushBackState(onPop) {
  if (!hasHistoryApi) return;
  stack.push(onPop);
  window.history.pushState({}, '');
}

/**
 * アプリ内の明示的な操作（戻るボタン・キャンセル・ダイアログのボタン等）で1段階戻る際に呼ぶ。
 * 対応する履歴が積まれていれば、登録したonPopは実行せずに履歴だけ1つ消費する。
 * @returns {boolean} 履歴を消費できたらtrue。何も積まれていなければfalse
 */
export function popBackState() {
  if (!hasHistoryApi || stack.length === 0) return false;
  stack.pop();
  suppressNextPopstate = true;
  window.history.back();
  return true;
}
