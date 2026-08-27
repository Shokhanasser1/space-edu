import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getRadius, getWorld } from '../positions';
import { sceneBridge } from './bridge';

/**
 * Names next to bodies, drawn as DOM at a fixed size.
 *
 * The old labels were `<Html distanceFactor>` — 4 px tall from the overview,
 * 70 px tall up close, and each one re-rendered through React every frame.
 * These are plain buttons positioned by hand once per animation frame from
 * outside the Canvas (React DOM cannot portal out of the three.js tree):
 * constant size, hidden when they would overlap a nearer one, hidden for
 * moons until their planet is close enough to matter, and the selected body
 * always wins.
 */

const v = new THREE.Vector3();
const MOON_PARENT_MIN_PX = 26;

function layout(entries, refs, selectedId, visible, rects) {
  const camera = sceneBridge.camera;
  if (!camera || !sceneBridge.height) return;
  rects.length = 0;
  const halfH = sceneBridge.height / 2;
  const halfW = sceneBridge.width / 2;
  const focal = halfH / Math.tan((camera.fov * Math.PI) / 360);
  const items = [];
  for (const entry of entries) {
    const el = refs.get(entry.id);
    if (!el) continue;
    const p = getWorld(entry.id);
    if (!p || !visible) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      continue;
    }
    v.copy(p).project(camera);
    const dist = camera.position.distanceTo(p);
    const px = getRadius(entry.id) * (focal / Math.max(dist, 1e-6));
    let parentPx = Infinity;
    if (entry.parent) {
      const pp = getWorld(entry.parent);
      parentPx = pp ? getRadius(entry.parent) * (focal / Math.max(camera.position.distanceTo(pp), 1e-6)) : 0;
    }
    items.push({ entry, el, dist, behind: v.z > 1, px, parentPx, x: v.x * halfW + halfW, y: -v.y * halfH + halfH });
  }
  items.sort((a, b) => (a.entry.id === selectedId ? -1 : b.entry.id === selectedId ? 1 : a.dist - b.dist));
  for (const it of items) {
    const isSelected = it.entry.id === selectedId;
    let show = !it.behind;
    if (show && it.entry.parent && !isSelected && it.parentPx < MOON_PARENT_MIN_PX) show = false;
    if (show && it.entry.kind === 'satellite' && !isSelected && it.parentPx < 60) show = false;
    const w = it.el.offsetWidth || 60;
    const h = it.el.offsetHeight || 18;
    const y = it.y - Math.max(it.px, 4) - 6;
    const rect = { l: it.x - w / 2, r: it.x + w / 2, t: y - h, b: y };
    if (show && !isSelected) {
      for (const o of rects) {
        if (rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t) {
          show = false;
          break;
        }
      }
    }
    if (show) rects.push(rect);
    it.el.style.opacity = show ? (isSelected ? '1' : '0.78') : '0';
    it.el.style.pointerEvents = show ? 'auto' : 'none';
    it.el.style.transform = `translate(-50%, -100%) translate(${it.x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

export default function LabelLayer({ entries, names, selectedId, onSelect, visible }) {
  const refs = useRef(new Map());
  const latest = useRef({ entries, selectedId, visible });
  latest.current = { entries, selectedId, visible };

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return undefined;
    const rects = [];
    let handle = 0;
    const tick = () => {
      const { entries: e, selectedId: s, visible: vis } = latest.current;
      layout(e, refs.current, s, vis, rects);
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] select-none" aria-hidden="true">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          ref={(el) => {
            if (el) refs.current.set(entry.id, el);
            else refs.current.delete(entry.id);
          }}
          onClick={() => onSelect?.(entry.id)}
          className={`absolute left-0 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide transition-opacity duration-200 ${
            entry.id === selectedId ? 'bg-white/15 text-white ring-1 ring-white/30' : 'text-white/85 hover:bg-white/10'
          } ${entry.kind === 'moon' || entry.kind === 'satellite' ? 'text-[10px] font-medium' : ''}`}
          style={{ opacity: 0, pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: entry.color }} />
          {names[entry.id] || entry.id}
        </button>
      ))}
    </div>
  );
}
