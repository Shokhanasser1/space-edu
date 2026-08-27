import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Texture loading that cannot take the page down, in two tiers.
 *
 * Rules from the audit: a missing file degrades to a plain colour, never to
 * the crash screen (`useLoader` throws), and colour maps are tagged sRGB —
 * drei's `useTexture` does not do that, and three ≥ r152 then treats a JPEG
 * as linear, which is why the old Earth looked bleached.
 *
 * Tiers: a 4k map is 45 MB of GPU memory once decoded, whatever its file
 * size; twenty of them would sink a school laptop with an integrated GPU.
 * So every body loads its 2k map (11 MB) and only the selected body is
 * upgraded to 4k, which is released again when the selection moves on.
 * Candidate lists name the 4k file first; `hiRes: false` skips it.
 */

const cache = new Map();
const loader = new THREE.TextureLoader();

export const isHiRes = (url) => /\/4k_/.test(url);

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

/** Drop a texture from the cache and the GPU; the browser cache keeps the file. */
export function releaseTexture(url, srgb) {
  const key = `${url}|${srgb ? 's' : 'l'}`;
  const pending = cache.get(key);
  if (!pending) return;
  cache.delete(key);
  pending.then((texture) => texture?.dispose());
}

export async function loadFirst(candidates, srgb) {
  for (const url of candidates || []) {
    const texture = await loadOne(url, srgb);
    if (texture) return { url, texture };
  }
  return null;
}

/** Which slots hold colour (sRGB) rather than data (linear). */
const SRGB_SLOTS = new Set(['map', 'clouds', 'night', 'ring']);

/**
 * @param {Record<string, string[]>} spec — slot → candidate URLs
 * @param {{ hiRes?: boolean }} options — load the 4k candidates too
 * @returns {Record<string, THREE.Texture|null>} textures loaded so far
 */
export function useSolarTextures(spec, { hiRes = false } = {}) {
  const [textures, setTextures] = useState({});
  const signature = JSON.stringify(spec || {});

  // Base tier: everything except 4k files, kept for the life of the page.
  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(spec || {});
    if (!entries.length) return undefined;
    entries.forEach(([slot, candidates]) => {
      loadFirst(candidates.filter((c) => !isHiRes(c)), SRGB_SLOTS.has(slot)).then((hit) => {
        if (!cancelled && hit) setTextures((prev) => (isHiRes(prev[`${slot}:url`] || '') ? prev : { ...prev, [slot]: hit.texture, [`${slot}:url`]: hit.url }));
      });
    });
    return () => {
      cancelled = true;
    };
    // The spec is data from the catalogue; its identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Hi-res tier: only while asked for, released afterwards.
  useEffect(() => {
    if (!hiRes) return undefined;
    let cancelled = false;
    const loaded = [];
    const entries = Object.entries(spec || {});
    entries.forEach(([slot, candidates]) => {
      const hi = candidates.filter(isHiRes);
      if (!hi.length) return;
      const srgb = SRGB_SLOTS.has(slot);
      loadFirst(hi, srgb).then((hit) => {
        if (!hit) return;
        if (cancelled) {
          releaseTexture(hit.url, srgb);
          return;
        }
        loaded.push([hit.url, srgb, slot]);
        setTextures((prev) => ({ ...prev, [slot]: hit.texture, [`${slot}:url`]: hit.url }));
      });
    });
    return () => {
      cancelled = true;
      // Fall back to the base tier before the 4k texture is disposed.
      setTextures((prev) => {
        const next = { ...prev };
        for (const [, , slot] of loaded) {
          delete next[slot];
          delete next[`${slot}:url`];
        }
        return next;
      });
      for (const [url, srgb] of loaded) releaseTexture(url, srgb);
      // Re-run the base tier for the slots we just emptied.
      entries.forEach(([slot, candidates]) => {
        if (!candidates.some(isHiRes)) return;
        loadFirst(candidates.filter((c) => !isHiRes(c)), SRGB_SLOTS.has(slot)).then((hit) => {
          if (hit) setTextures((prev) => (prev[slot] ? prev : { ...prev, [slot]: hit.texture, [`${slot}:url`]: hit.url }));
        });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, hiRes]);

  return textures;
}
