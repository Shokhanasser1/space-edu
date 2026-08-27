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

## The Solar System scene (28 August 2026)

The rebuilt `/3d-solar-system` reads every planet map from this directory
through a candidate list (`src/solar/catalog.js`): the first file that exists
wins. The lists name Solar System Scope's `2k_*.jpg` files first and the older
maps second, so upgrading a planet is: download the 2k map from
https://www.solarsystemscope.com/textures/ (CC BY 4.0 — add the credit here),
resize if it is over 2 MB, drop it in, done. Nothing else changes. The files
that would be picked up: `2k_sun.jpg`, `2k_mercury.jpg`, `2k_venus_atmosphere.jpg`,
`2k_earth_daymap.jpg`, `2k_earth_nightmap.jpg`, `2k_earth_clouds.jpg`,
`2k_mars.jpg`, `2k_jupiter.jpg`, `2k_saturn.jpg`, `2k_saturn_ring_alpha.png`,
`2k_uranus.jpg`, `2k_neptune.jpg`, `2k_moon.jpg`, and the `2k_*_fictional.jpg`
maps for Ceres, Eris, Haumea and Makemake. NASA's CGI Moon Kit
(https://svs.gsfc.nasa.gov/4720, public domain) is the better Moon.

Neither host could be reached from the machine that did the rebuild, so the
scene ships with the maps that were already here.

## `public/data/`

| File | From | Licence |
|---|---|---|
| `stars-bsc5.json` | Yale Bright Star Catalogue, 5th ed. (Hoffleit & Warren 1991), via `tdc-www.harvard.edu/catalogs/bsc5.dat.gz`; 9 096 stars with J2000 RA/Dec, V and B−V | public domain |
| `small-bodies.json` | NASA/JPL Small-Body Database Query API: 2 500 main-belt asteroids and 1 119 trans-Neptunian objects, osculating elements at JD 2461200.5 | public domain (US Government work) |

## Solar System Scope maps (added 28 August 2026)

`4k_sun.webp`, `4k_mercury.webp`, `4k_venus_atmosphere.webp`,
`4k_earth_daymap.webp`, `4k_earth_nightmap.webp`, `2k_earth_clouds.webp`,
`2k_earth_specular.webp`, `4k_mars.webp`, `4k_jupiter.webp`, `4k_saturn.webp`,
`2k_saturn_ring_alpha.png`, `2k_uranus.webp`, `2k_neptune.webp`, `4k_moon.webp`,
`2k_{ceres,eris,haumea,makemake}_fictional.webp`, `4k_stars_milky_way.webp`
— **Solar System Scope**, https://www.solarsystemscope.com/textures/, licensed
**CC BY 4.0**. Downloaded as the 8k/4k/2k JPEG/PNG/TIFF originals and re-encoded
to WebP at 4096×2048 or 2048×1024 (quality 72–86) to sit under the 2 MB
per-file CI budget; the cloud map's luminance became its alpha channel; the ring
strip was resized to 2048 wide. The four dwarf-planet maps are the artist's
"fictional" ones — nobody has imaged Eris, Haumea or Makemake at that detail.
The Milky Way panorama is in galactic coordinates (centre at the middle of
the image, longitude increasing to the left), which `SkyDome.jsx` relies on.

## `public/models/probes/`

`voyager.glb`, `new_horizons.glb`, `parker.glb`, `juno.glb` — NASA
Visualization Technology Applications and Development (VTAD), from
https://science.nasa.gov/3d-resources/ (public domain, NASA). Reduced with
gltf-transform (Draco) and 512 px WebP textures from 3–9 MB to 0.1–0.3 MB each.
JWST has no model on that site; it stays a marker.
