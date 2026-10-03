// 曲名・プレイリスト名が横幅に収まらないときの自動スクロール（マーキー。NFR-5.12）。
// 対象要素は `.marquee > .marquee-track > .marquee-text` の構造を前提とする。
// 収まる場合は何もしない（元の静止表示のまま）。再描画のたびに呼び直してよいよう、
// 動作中のスクロール・.scrollingクラスは毎回リセットしてから判定し直す。
// HTML生成（marqueeHtml）と、領域内の全マーキーの一括設定（setupMarquees）を提供する。
// 同じ要素に対して1フレーム内に複数回呼ばれても、スクロールが重ならないようにしている
// （保留中のrequestAnimationFrameを取り消す）。
// 動き：初期表示で1秒静止 → テキスト全体が左に流れ切って何も見えなくなるまで流す → 初期表示へ戻す、
// を繰り返す（戻るたびに毎回1秒静止する）。静止区間を含むキーフレームをWeb Animations APIで
// 組み立てて実行する。流れる速さは1秒あたり約40pxで、テキストの長さに応じて1周の時間が決まる。

const SCROLL_PX_PER_SECOND = 40;
const MIN_SCROLL_SECONDS = 3;
// スクロール開始前（初期表示の直後、および1周するごとに初期位置へ戻したあと）に静止する時間
const HOLD_SECONDS = 1;

// 要素ごとに、判定待ちのrequestAnimationFrameを1つだけ保持する
const pendingFrames = new WeakMap();
// 要素ごとに、動作中のスクロール（Web Animations API）を1つだけ保持する
const runningAnimations = new WeakMap();

function stopAnimation(el) {
  const anim = runningAnimations.get(el);
  if (anim) anim.cancel();
  runningAnimations.delete(el);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 1行表示（収まらなければ自動スクロール）のタイトル要素のHTMLを返す。
 * 描画後に、setupMarquee／setupMarqueesで横幅の判定を行うこと。
 * @param {string} text
 * @param {{tag?: string, className?: string}} [options]
 */
export function marqueeHtml(text, { tag = 'div', className = 'item-name' } = {}) {
  return `<${tag} class="${className} marquee"><span class="marquee-track"><span class="marquee-text">${escapeHtml(text)}</span></span></${tag}>`;
}

/**
 * @param {HTMLElement|null} el `.marquee`要素（`.marquee-track > .marquee-text`を内包）
 */
export function setupMarquee(el) {
  if (!el) return;
  const track = el.querySelector('.marquee-track');
  const original = track?.querySelector('.marquee-text');
  if (!track || !original) return;
  while (track.children.length > 1) track.removeChild(track.lastChild);
  el.classList.remove('scrolling');
  stopAnimation(el);
  const pending = pendingFrames.get(el);
  if (pending) cancelAnimationFrame(pending);
  pendingFrames.set(el, requestAnimationFrame(() => {
    pendingFrames.delete(el);
    if (!track.isConnected) return; // 判定前に再描画・画面遷移していれば何もしない
    stopAnimation(el);
    const viewWidth = el.clientWidth;
    const textWidth = original.offsetWidth;
    if (textWidth > viewWidth + 1) {
      // 1周 = 初期表示で1秒静止 → テキスト全体が左へ流れ切って何も見えなくなるまで流す → 初期表示へ戻す。
      // 戻ったあとも毎回、同じ1秒の静止を置いてから流し直す
      const distance = textWidth;
      const scrollSeconds = Math.max(MIN_SCROLL_SECONDS, distance / SCROLL_PX_PER_SECOND);
      const totalSeconds = HOLD_SECONDS + scrollSeconds;
      const holdEnd = HOLD_SECONDS / totalSeconds;
      runningAnimations.set(el, track.animate([
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: holdEnd },
        { transform: `translateX(${-distance}px)`, offset: 1 },
      ], { duration: totalSeconds * 1000, iterations: Infinity, easing: 'linear' }));
      el.classList.add('scrolling');
    }
  }));
}

/**
 * 領域内の全ての`.marquee`要素について、横幅に収まるかの判定をやり直す。
 * 一覧を描画し直したとき、および非表示だった画面（幅が0で判定できない）を表示したときに呼ぶ。
 * @param {ParentNode|null} root
 */
export function setupMarquees(root) {
  if (!root) return;
  root.querySelectorAll('.marquee').forEach(setupMarquee);
}
