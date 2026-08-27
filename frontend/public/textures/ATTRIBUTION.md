# Textures

Everything in this directory is served from our own origin. Until 24 August
2026 the eight Earth textures used by `SpaceLabView` were fetched at runtime
from `unpkg.com` and `raw.githubusercontent.com`. GitHub rate-limits raw file
access and does not support it for production traffic, so the page broke on the
day a whole class opened it at once, and it broke every day on a school network
that blocks either host.

## The eight Earth textures

| File | From | Changed how |
|---|---|---|
| `earth_color_2048.jpg` | `three-globe`, `example/img/earth-blue-marble.jpg` | 4096×2048 → 2048×1024, JPEG q88. The globe is a few hundred pixels on screen; 4096 was four times what it can show. 1428 KB → 373 KB |
| `earth_topology_2048.jpg` | `three-globe`, `example/img/earth-topology.png` | PNG → greyscale JPEG q88. It is a bump map, which does not need lossless. 369 KB → 111 KB |
| `earth_water_1600.png` | `three-globe`, `example/img/earth-water.png` | RGB → single channel, still PNG. It is a two-tone coastline mask and JPEG would soften the edge. 420 KB → 195 KB |
| `earth_atmos_2048.jpg` | three.js, `examples/textures/planets/` | unchanged, already here |
| `earth_normal_2048.jpg` | three.js, `examples/textures/planets/` | unchanged, already here |
| `earth_specular_2048.jpg` | three.js, `examples/textures/planets/` | unchanged, already here |
| `earth_clouds_1024.png` | three.js, `examples/textures/planets/` | unchanged, already here |
| `earth_lights_2048.png` | three.js, `examples/textures/planets/` | quantised to a 256-colour palette. Night lights are sparse warm points on black, so JPEG rings around every city. 401 KB → 320 KB |

Four of the eight were already in this directory. Only the view had not been
told.

Two more views were fetching five of the same files from
`raw.githubusercontent.com` and were missed on 24 August: the home page's
`Earth3D` (which also loaded Three.js itself from cdnjs, so the planet was a
black circle wherever that host is slow or blocked) and `LiveSpaceView`'s
`RealEarth`. Both read from here since 26 August 2026. A test in
`RouteErrorBoundary.test.jsx` fails if any of the three files names an outside
host again.

**Provenance.** Both sets are NASA imagery — Blue Marble and the associated
elevation, water, cloud and night-lights layers — redistributed in the
`three-globe` and three.js repositories. NASA imagery is not copyrighted.

**Budget.** CI counts tracked files over 2 MB against a fixed large-asset budget
(`.github/workflows/ci.yml`). Every file here is well under that, so this cost
the budget nothing. Keep it that way: resize before adding, not after.

## The other planets

`jupitermap.jpg`, `marsmap1k.jpg`, `moon_1024.jpg` and the rest predate this
note. If you touch one, record where it came from here.
