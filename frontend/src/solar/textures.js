import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Texture loading that cannot take the page down.
 *
 * Two rules from the audit: a missing file degrades to a plain colour, never
 * to the crash screen (`useLoader` throws), and colour maps are tagged sRGB —
 * drei's `useTexture` does not do that, and three ≥ r152 then treats a JPEG as
 * linear, which is why the old Earth looked bleached.
 *
 * Each slot is a list of candidates tried in order. That is how the team can
 * upgrade a planet: drop `2k_mars.jpg` from Solar System Scope (CC BY 4.0)
 * into `public/textures/`, list it first, and the old file becomes the
 * fallback for whoever has not pulled the asset yet.
 */

const cache = new Map();
const loader = new THREE.TextureLoader();

function loadOne(url, srgb) {
  const key = `${url}|${srgb ? 's' : 'l'}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      new Promise((resolve) => {
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            texture.anisotropy = 8;
            resolve(texture);
          },
          undefined,
          () => resolve(null),
        );
      }),
    );
  }
  return cache.get(key);
}

export async function loadFirst(candidates, srgb) {
  for (const url of candidates || []) {
    const texture = await loadOne(url, srgb);
    if (texture) return texture;
  }
  return null;
}

/** Which slots hold colour (sRGB) rather than data (linear). */
const SRGB_SLOTS = new Set(['map', 'clouds', 'night', 'ring']);

/**
 * @param {Record<string, string[]>} spec — slot → candidate URLs
 * @returns {Record<string, THREE.Texture|null>} textures loaded so far
 */
export function useSolarTextures(spec) {
  const [textures, setTextures] = useState({});
  const signature = JSON.stringify(spec || {});

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(spec || {});
    if (!entries.length) return undefined;
    entries.forEach(([slot, candidates]) => {
      loadFirst(candidates, SRGB_SLOTS.has(slot)).then((texture) => {
        if (!cancelled && texture) setTextures((prev) => ({ ...prev, [slot]: texture }));
      });
    });
    return () => {
      cancelled = true;
    };
    // The spec is data from the catalogue; its identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return textures;
}
