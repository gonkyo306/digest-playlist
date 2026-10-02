// フェーズ39：曲名・プレイリスト名が横幅に収まらないときの自動スクロール（マーキー）。
// 対象要素は `.marquee > .marquee-track > .marquee-text` の構造を前提とする。
// 収まる場合は何もしない（元の静止表示のまま）。再描画のたびに呼び直してよいよう、
// 複製したテキスト・.scrollingクラスは毎回リセットしてから判定し直す。

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
  requestAnimationFrame(() => {
    if (!track.isConnected) return; // 判定前に再描画・画面遷移していれば何もしない
    if (el.scrollWidth > el.clientWidth + 1) {
      const clone = original.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
      el.classList.add('scrolling');
    }
  });
}
