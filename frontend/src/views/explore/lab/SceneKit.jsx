import { createContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Small pieces the star scenes share: easing curves, a seeded random number
 * generator (so a cloud looks the same on every visit), the soft round dot
 * points are drawn with, and the halo round a glowing ball.
 */

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;
export const easeIn = (x) => clamp01(x) ** 2;

/** A small seeded generator, so the cloud looks the same on every visit. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rand) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
}

/** A soft round dot: points drawn with it read as glowing gas, not squares. */
export const DotContext = createContext(null);

export function DotProvider({ children }) {
  const dot = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.22, 'rgba(255,255,255,0.8)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.2)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => dot.dispose(), [dot]);
  return <DotContext.Provider value={dot}>{children}</DotContext.Provider>;
}

export function StarHalo({ colour, radius, opacity = 0.18 }) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial
        color={colour}
        transparent
        opacity={opacity}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Drawn radius of a main-sequence star of this mass. Not to scale. */
export function mainSequenceRadius(mass) {
  return Math.min(2.6, Math.max(0.85, 1.6 * mass ** 0.25));
}

/**
 * How visible the stage being drawn is, 0..1, while one stage morphs into the
 * next. Parts that animate their own opacity multiply by it and mark their
 * material `selfFade`; everything else is faded by the morph directly.
 */
export const FadeContext = createContext({ current: 1 });
