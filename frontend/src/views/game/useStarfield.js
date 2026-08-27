/**
 * useStarfield.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The drifting star field behind the Space Run title screen.
 *
 * It lives outside the view because of the bug it was written for. The canvas is
 * `inset-0` inside a `flex-1 min-h-0` column, so on the commit that mounts the
 * intro it measures 1280×0. Sizing the backing store once, there and then, left
 * it 0px tall: 220 stars went on animating every frame into a surface no pixel
 * could land on, and the title screen showed an empty sky. Watching the element
 * catches the height the moment layout settles.
 *
 * jsdom does no layout, so the sizing is driven through a ResizeObserver the
 * test can call by hand — which is the other reason this is not inline.
 */
import { useEffect } from 'react';

/** Stars are placed in unit space and scaled to the canvas at draw time. */
function makeStars(count = 220) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.8 + 0.3,
    speed: Math.random() * 0.4 + 0.15,
    phase: Math.random() * Math.PI * 2,
    hue: Math.random() > 0.7 ? 200 + Math.random() * 60 : 0,
    sat: Math.random() > 0.7 ? 60 : 0,
  }));
}

/**
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @param {boolean} active — false once the run starts and the intro is gone
 */
export function useStarfield(canvasRef, active) {
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = makeStars();
    let raf;

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      // Nothing to size to yet. Writing 0 here is the original bug: it is not a
      // harmless no-op, it makes every later frame draw into an empty surface.
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      // Assigning width/height resets the context, so this does not accumulate.
      ctx.scale(dpr, dpr);
    };

    // Fires once on observe, then on every layout change — including the ones a
    // window `resize` listener never saw, like the pane being dragged wider.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (t) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const alpha = 0.35 + 0.65 * ((Math.sin(t * 0.001 * s.speed + s.phase) + 1) / 2);
        ctx.fillStyle = s.hue
          ? `hsla(${s.hue}, ${s.sat}%, 85%, ${alpha})`
          : `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [canvasRef, active]);
}
