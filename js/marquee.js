// フェーズ39：曲名・プレイリスト名が横幅に収まらないときの自動スクロール（マーキー）。
// 対象要素は `.marquee > .marquee-track > .marquee-text` の構造を前提とする。
// 収まる場合は何もしない（元の静止表示のまま）。再描画のたびに呼び直してよいよう、
// 複製したテキスト・.scrollingクラスは毎回リセットしてから判定し直す。
// フェーズ42：一覧の行（プレイリスト一覧・プレイリスト詳細・検索結果・アルバム収録曲・追加先選択）の
// タイトルにも共通で使えるよう、HTML生成（marqueeHtml）と、領域内の全マーキーの一括設定（setupMarquees）を
// 追加した。同じ要素に対して1フレーム内に複数回呼ばれても、複製が重なって増えないようにした
// （複製が3つ以上になるとループの繰り返し位置がずれる）。流れる速さは、長いタイトルほど
// 速くなりすぎないよう、テキストの長さに応じて決める。
// フェーズ43：スクロールは初期表示から1秒後に開始する。また、末尾まで全て
// 流し終わる前に先頭の文字が右端から再び現れないよう、複製との間隔（.marquee-textの右余白）を
// 表示領域の幅と同じにする（収まるかの判定も、右余白を含まないテキスト自体の幅で行う）。
// フェーズ44：2周目以降も、初期位置に戻してから1秒静止して流し直すよう、CSSのanimationを
// やめて、静止区間を含むキーフレームをWeb Animations APIで組み立てる。

const SCROLL_PX_PER_SECOND = 40;
const MIN_SCROLL_SECONDS = 8;
// フェーズ44：スクロール開始前（初期表示の直後、および1周するごとに初期位置へ戻したあと）に静止する時間
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
    while (track.children.length > 1) track.removeChild(track.lastChild);
    el.style.removeProperty('--marquee-gap');
    const viewWidth = el.clientWidth;
    const textWidth = original.offsetWidth; // 右余白を除いた、テキスト自体の幅
    if (textWidth > viewWidth + 1) {
      const clone = original.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
      el.style.setProperty('--marquee-gap', `${viewWidth}px`);
      // 1周 = 初期位置で1秒静止 → 複製が初期位置に来るまで左へ流す。繰り返しのたびに初期位置から
      // 同じ待ち時間を置いてから流し直す（複製が初期位置に重なるため、戻る瞬間は見た目が変わらない）
      const distance = textWidth + viewWidth;
      const scrollSeconds = Math.max(MIN_SCROLL_SECONDS, distance / SCROLL_PX_PER_SECOND);
      const totalSeconds = HOLD_SECONDS + scrollSeconds;
      el.style.setProperty('--marquee-duration', `${totalSeconds.toFixed(1)}s`);
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
