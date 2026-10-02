// フェーズ39：曲名・プレイリスト名が横幅に収まらないときの自動スクロール（マーキー）。
// 対象要素は `.marquee > .marquee-track > .marquee-text` の構造を前提とする。
// 収まる場合は何もしない（元の静止表示のまま）。再描画のたびに呼び直してよいよう、
// 複製したテキスト・.scrollingクラスは毎回リセットしてから判定し直す。
// フェーズ42：一覧の行（プレイリスト一覧・プレイリスト詳細・検索結果・アルバム収録曲・追加先選択）の
// タイトルにも共通で使えるよう、HTML生成（marqueeHtml）と、領域内の全マーキーの一括設定（setupMarquees）を
// 追加した。同じ要素に対して1フレーム内に複数回呼ばれても、複製が重なって増えないようにした
// （複製が3つ以上になるとループの繰り返し位置がずれる）。流れる速さは、長いタイトルほど
// 速くなりすぎないよう、テキストの長さに応じて決める。
// フェーズ43：スクロールは初期表示から1秒後に開始する（CSSのanimation-delay）。また、末尾まで全て
// 流し終わる前に先頭の文字が右端から再び現れないよう、複製との間隔（.marquee-textの右余白）を
// 表示領域の幅と同じにする（収まるかの判定も、右余白を含まないテキスト自体の幅で行う）。

const SCROLL_PX_PER_SECOND = 40;
const MIN_LOOP_SECONDS = 8;

// 要素ごとに、判定待ちのrequestAnimationFrameを1つだけ保持する
const pendingFrames = new WeakMap();

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
      const loopSeconds = Math.max(MIN_LOOP_SECONDS, (textWidth + viewWidth) / SCROLL_PX_PER_SECOND);
      el.style.setProperty('--marquee-duration', `${loopSeconds.toFixed(1)}s`);
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
