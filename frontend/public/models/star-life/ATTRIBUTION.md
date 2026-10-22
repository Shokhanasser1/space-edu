# Star life-cycle models

Data-based 3D models of a star-forming region, a young star, a planetary
nebula and two supernova remnants, for the star life-cycle scenes. All of
them were published by NASA or NASA's Chandra X-ray Center as free to use.

NASA content is generally not subject to copyright in the United States and
may be used for educational purposes, but it must be credited, and its use
does not imply endorsement by NASA. See
https://www.nasa.gov/nasa-brand-center/images-and-media/ . The DG Tau and
Helix models are hosted by NASA's Chandra X-ray Center as free to use, with
credit required.

| File | Object | Credit | Source | Licence |
|---|---|---|---|---|
| `crab-disc.glb` | Crab Nebula, pulsar wind torus | NASA/STScI/F. Summers et al.; NASA/Caltech-IPAC/R. Hurt; NASA/CXC/SAO/N. Wolk et al. | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/Crab%20Nebula/Crab%20Nebula%20(disc).stl | NASA, free to use with credit |
| `crab-jet1.glb` | Crab Nebula, jet 1 | NASA/STScI/F. Summers et al.; NASA/Caltech-IPAC/R. Hurt; NASA/CXC/SAO/N. Wolk et al. | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/Crab%20Nebula/Crab%20Nebula%20(jet%201).stl | NASA, free to use with credit |
| `crab-jet2.glb` | Crab Nebula, jet 2 | NASA/STScI/F. Summers et al.; NASA/Caltech-IPAC/R. Hurt; NASA/CXC/SAO/N. Wolk et al. | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/Crab%20Nebula/Crab%20Nebula%20(jet%202).stl | NASA, free to use with credit |
| `pillar-1a.glb` | Pillars of Creation (M16), pillar 1A | Model: L. Hustak & R. Crawford (STScI), NASA's Universe of Learning | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/Pillars%20of%20Creation/Pillars%20of%20Creation%20(pillar%201A).stl | NASA, free to use with credit |
| `pillar-1b.glb` | Pillars of Creation (M16), pillar 1B | Model: L. Hustak & R. Crawford (STScI), NASA's Universe of Learning | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/Pillars%20of%20Creation/Pillars%20of%20Creation%20(pillar%201B).stl | NASA, free to use with credit |
| `pillar-2.glb` | Pillars of Creation (M16), pillar 2 | Model: L. Hustak & R. Crawford (STScI), NASA's Universe of Learning | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/Pillars%20of%20Creation/Pillars%20of%20Creation%20(pillar%202).stl | NASA, free to use with credit |
| `pillar-3.glb` | Pillars of Creation (M16), pillar 3 | Model: L. Hustak & R. Crawford (STScI), NASA's Universe of Learning | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/Pillars%20of%20Creation/Pillars%20of%20Creation%20(pillar%203).stl | NASA, free to use with credit |
| `cas-a.glb` | Cassiopeia A supernova remnant | NASA/CXC/SAO; model NASA/T. Delaney | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Cassiopeia%20A%20Supernova/Cassiopeia%20A%20Supernova.glb | NASA, free to use with credit |
| `dg-tau-disc.glb`, `dg-tau-jets.glb` | DG Tau, young star with disc and jets | Model: INAF–Osservatorio Astronomico di Palermo / S. Orlando; NASA/CXC | https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing/DG%20Tau/DG%20Tau.stl | Hosted by NASA as free to use; credit required |
| `helix.glb` | Helix Nebula (NGC 7293), planetary nebula | Model: INAF–Osservatorio Astronomico di Palermo / S. Orlando; NASA/CXC | https://chandra.harvard.edu/deadstar/images/3d_files/helix.stl | Hosted by NASA/Chandra as free to use; credit required |

Repository: https://github.com/nasa/NASA-3D-Resources (folders `3D Printing/Crab Nebula`,
`3D Printing/Pillars of Creation`, `3D Printing/DG Tau`, `3D Models/Cassiopeia A Supernova`).

## Changes made

All files were downloaded on 22 October 2026 and converted with
`@gltf-transform/cli` 4.5.1 plus small conversion scripts.

**STL models (Crab, Pillars, DG Tau, Helix).** Each binary STL was converted
to glTF binary: duplicate vertices were welded (positions quantised to 1e-5
of the bounding-box diagonal), smooth area-weighted vertex normals were
computed, and a plain grey PBR material was added. The models' original
coordinates and units were kept, so the three Crab parts and the four
pillars stay aligned with each other. Each mesh was then decimated with
`gltf-transform simplify` (meshoptimizer, error limit 1% of the mesh radius)
and Draco-compressed with `gltf-transform draco` (default quantisation:
position 14 bits, normal 10 bits). Pillar 1B was not decimated. Decimation
dropped a few tiny detached specks of only a few triangles (in the Helix and
Crab jet 2). DG Tau was split into its two connected components: the disc
(`dg-tau-disc.glb`), and the two jets, which form one connected tube through
the disc (`dg-tau-jets.glb`).

| File | Source triangles | Output triangles | Source size | Output size |
|---|---|---|---|---|
| `crab-disc.glb` | 113,472 | 45,048 | 5.67 MB | 0.13 MB |
| `crab-jet1.glb` | 55,716 | 20,001 | 2.79 MB | 0.06 MB |
| `crab-jet2.glb` | 64,178 | 20,016 | 3.21 MB | 0.07 MB |
| `pillar-1a.glb` | 364,874 | 34,988 | 18.24 MB | 0.10 MB |
| `pillar-1b.glb` | 24,576 | 24,576 | 1.23 MB | 0.06 MB |
| `pillar-2.glb` | 136,150 | 34,990 | 6.81 MB | 0.09 MB |
| `pillar-3.glb` | 211,570 | 34,992 | 10.58 MB | 0.10 MB |
| `dg-tau-disc.glb` + `dg-tau-jets.glb` | 220,859 | 60,055 | 11.07 MB | 0.15 MB |
| `helix.glb` | 458,642 | 89,893 | 22.97 MB | 0.22 MB |
| `cas-a.glb` | 574,678 | 120,106 | 10.48 MB | 0.62 MB |

**Cassiopeia A.** The source GLB (one mesh, one material with a 2048 px
colour-coded texture atlas) was decimated from 574,678 to 120,106 triangles.
Its split custom normals were replaced by smooth normals first, because
they blocked decimation. UVs, the texture's colour-coding (the share of
surface in each colour is unchanged to within 0.2%) and the material
(double-sided, transmission 0.5, IOR 1.0, roughness 0.92) are unchanged.
The texture was resized to 1024 px and re-encoded as WebP, the unused PNG
copy of the texture was removed, and the geometry was Draco-compressed.

In the page the Cassiopeia A material's transmission is set to 0 and its
colour texture is also used as an emission map, so the colour-coded debris
glows; the colours themselves are NASA's. The grey STL models are drawn with
the site's own gas shaders (colours and motion added; shapes untouched).

The shapes are otherwise unchanged. Every file is under the repository's
2 MB per-file limit.
