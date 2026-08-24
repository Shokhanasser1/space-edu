import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Load textures without betting the page on every one of them arriving.
 *
 * `SpaceLabView` used to fetch eight of these from `unpkg.com` and
 * `raw.githubusercontent.com` through `useLoader`. Two problems with that:
 *
 * 1. `useLoader` throws when a load fails, and there was no boundary between
 *    the view and the root one, so a blocked network, a rate limit, or an
 *    offline moment on a third-party host replaced the entire application with
 *    the crash screen.
 * 2. `raw.githubusercontent.com` is not an asset host. GitHub rate-limits it
 *    and does not support it for production traffic, so it was a dependency
 *    that fails on exactly the day a whole class opens the page at once.
 *
 * The eight files are served from `/textures/` now, so the second problem is
 * gone. This hook stays because the first one has not changed shape: a renamed
 * file, a typo in a path or a half-loaded response still has to degrade rather
 * than raise. It returns `null` per texture that did not load, and callers give
 * the material a plain colour instead — an untextured Earth rather than no page.
 */
export function useTextures(paths) {
  const [textures, setTextures] = useState(() => paths.map(() => null));

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const loaded = paths.map(() => null);
    let outstanding = paths.length;
    if (!outstanding) return undefined;

    const settle = () => {
      outstanding -= 1;
      if (outstanding === 0 && !cancelled) setTextures([...loaded]);
    };

    paths.forEach((path, index) => {
      loader.load(
        path,
        (texture) => {
          if (cancelled) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          loaded[index] = texture;
          settle();
        },
        undefined,
        settle,
      );
    });

    return () => {
      cancelled = true;
      // The game leaked a texture per unmount before ticket F3; do not add
      // another eight.
      for (const texture of loaded) texture?.dispose?.();
    };
    // The path list is a module-level constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return textures;
}
