// iOS Safari ignores "user-scalable=no": a double tap or a pinch still zooms
// the page, and since the game catches every touch, the player could not get
// out again. This blocks those gestures and snaps back to 100 % if the page
// was zoomed anyway (e.g. by focusing a text field).

export function blockZoom() {
  const stop = (e) => e.preventDefault();
  const opts = { passive: false };

  // pinch (Safari's own gesture events)
  document.addEventListener('gesturestart', stop, opts);
  document.addEventListener('gesturechange', stop, opts);
  document.addEventListener('gestureend', stop, opts);

  // two fingers moving outside the game controls
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 && e.scale !== undefined && e.scale !== 1) e.preventDefault();
  }, opts);

  // double tap: the second tap of a quick pair must not become a zoom
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = e.timeStamp;
    // buttons are protected by CSS (touch-action: manipulation) and must keep
    // their clicks, so fast taps on "+" etc. all count
    const el = e.target && e.target.closest ? e.target : null;
    const control = el && el.closest('button, .btn, [data-act], input, textarea, select');
    if (!control && now - lastEnd < 350) e.preventDefault();
    lastEnd = now;
  }, opts);
  document.addEventListener('dblclick', stop, opts);

  // zoomed anyway: write the viewport again, which makes Safari reset the scale
  const meta = document.querySelector('meta[name=viewport]');
  const content = meta ? meta.getAttribute('content') : '';
  const reset = () => {
    const vv = window.visualViewport;
    if (!meta || !vv || vv.scale <= 1.01) return;
    meta.setAttribute('content', content + ', minimum-scale=1');
    requestAnimationFrame(() => meta.setAttribute('content', content));
  };
  if (window.visualViewport) window.visualViewport.addEventListener('resize', reset);
  document.addEventListener('focusout', () => setTimeout(reset, 50));
}
