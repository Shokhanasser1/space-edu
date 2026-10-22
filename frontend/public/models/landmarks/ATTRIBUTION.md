# Landmark models

Both models stand beside the Saturn V in the Laboratory's Apollo module
(`src/views/explore/lab/LandmarkModels.jsx`), scaled to their true heights.
Both are licensed under Creative Commons Attribution 4.0 (CC BY 4.0):
https://creativecommons.org/licenses/by/4.0/

| File | Model | Author | Source |
|---|---|---|---|
| `statue-of-liberty.glb` | "Statue Of Liberty" | gravityjack | https://sketchfab.com/3d-models/84094e8d5e724b5c882cf576ca12e44e |
| `tashkent-tv-tower.glb` | "Tashkent TV Tower" | qsardor57913 | https://sketchfab.com/3d-models/9cd52aa5c2914733ac748a80873e037f |

## Changes made

Downloaded as glTF binary from Sketchfab on 22 October 2026 and optimised
with `@gltf-transform/cli optimize --compress draco --texture-compress webp
--texture-size 1024`: Draco-compressed geometry, textures re-encoded as WebP
at no more than 1024 px. The statue went from 13.1 MB to 0.74 MB and the
tower from 4.6 MB to 0.14 MB, which keeps both under the repository's 2 MB
per-file limit. Shapes and materials are otherwise unchanged.

The statue model is the figure alone; the pedestal and Fort Wood beneath it
in the lab are drawn in code.
