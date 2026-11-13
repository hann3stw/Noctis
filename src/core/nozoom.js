// iOS Safari ignores "user-scalable=no": a double tap or two fingers (moving
// with the joystick while pressing attack) zoom the page, and since the game
// catches every touch, the player could not get out again.
//
// In the game (canvas, HUD, controls) every touch has its browser default
// blocked right when it starts: no zoom, no scroll, no double tap. The game
// itself uses pointer events, which still arrive. In menus one finger may
// scroll lists, but two fingers are blocked there too.

const MENUS = '#menu, #screens';

function inMenu(e) {
  const t = e.target;
  return !!(t && t.closest && t.closest(MENUS));
}

export function blockZoom() {
  const opts = { passive: false };
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };

  document.addEventListener('touchstart', (e) => {
    if (!inMenu(e) || e.touches.length > 1) stop(e);
  }, opts);
  document.addEventListener('touchmove', (e) => {
    if (!inMenu(e) || e.touches.length > 1) stop(e);
  }, opts);
  document.addEventListener('touchend', (e) => {
    if (!inMenu(e)) stop(e);
  }, opts);

  // Safari's own pinch events and double clicks
  document.addEventListener('gesturestart', stop, opts);
  document.addEventListener('gesturechange', stop, opts);
  document.addEventListener('gestureend', stop, opts);
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
