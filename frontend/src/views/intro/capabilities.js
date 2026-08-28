/**
 * Should the intro draw its 3D sky, or show the still?
 *
 * The scene is decorative, so every doubt resolves to the still: no WebGL 2
 * (three r163+ needs it), a reader who asked for reduced motion, a phone on
 * a data-saver plan, or a device reporting under 2 GB of memory.
 */
export function canRender3D() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;
  } catch {
    /* no matchMedia: not a reason to refuse */
  }
  const nav = window.navigator || {};
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
