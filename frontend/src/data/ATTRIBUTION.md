# Where the sky data comes from

`skyCatalog.json` is generated, never edited by hand. `npm run sky:build` runs
`scripts/build-sky-catalog.mjs`, which fetches the four sources below and writes
the file. Nothing in it is typed in from memory, and nothing is interpolated:
the script's two hard rules are that a constellation line is drawn between two
catalogue stars or it is not drawn, and a distance is written only where the
parallax it comes from was measured to better than 20%.

That last rule is why Betelgeuse has no distance in this file. Its Hipparcos
parallax is 7.63 ± 1.64 mas — a 21% error, which is 500 to 700 light years
depending on which end you believe. A number that vague is not a fact, and a
ten-year-old reading "548 light years" off a screen has no way to know that.

**Nothing here is fetched at runtime.** The build script runs on a developer's
machine; the browser only ever reads the committed JSON. This is the same rule
the Earth textures follow — see `public/textures/ATTRIBUTION.md` for what
happened the last time a view reached out to somebody else's host.

## The four sources

| What | From | Licence |
|---|---|---|
| Positions (J2000), visual magnitudes, B−V colours, spectral types | **Bright Star Catalogue, 5th Revised Ed.** — Hoffleit D. & Warren Jr W.H., 1991. VizieR `V/50`, queried over the CDS TAP service | Public catalogue, CDS |
| Parallaxes, from which distance in light years is computed | **The Hipparcos and Tycho Catalogues** — ESA, 1997. VizieR `I/239/hip_main`, joined to the BSC on Henry Draper number | Public catalogue, CDS |
| Proper names — "Sirius", "Vega", "Aldebaran" | **IAU Catalog of Star Names (IAU-CSN)** — IAU Division C Working Group on Star Names | CC-BY: free to use as long as the source is named. This is that naming. |
| Constellation stick figures | **d3-celestial**, `data/constellations.lines.json` — Olaf Frohn | BSD-3-Clause, notice below |

## What is a measurement and what is a convention

Worth being precise about, because they are drawn on the same screen:

- **Star positions, magnitudes, colours and distances are measurements.** They
  come from the catalogues above and can be checked against them.
- **Constellation lines are a drawing convention.** There is no line in the sky
  between Betelgeuse and Bellatrix. Which stars a culture joins up, and in what
  order, is a cultural choice — the IAU standardises constellation *boundaries*,
  not the stick figures inside them. The figures here are the common Western
  ones. Every endpoint is a real star matched back to the BSC by position to
  within 0.05°, and the 11 links whose endpoints did not resolve to a catalogue
  star at this magnitude limit were dropped rather than drawn to a made-up point.

The sky view says this to the child too, in all three languages — it is a better
astronomy lesson than pretending the lines are out there.

## Magnitude limit

5.3, which is about what a child sees from a dark site outside a Uzbek city.
It is also where the figures stop losing corners: at magnitude 4.6 only 44 of
the 89 figures have all their stars, at 5.3 it is 88. Going deeper buys three
more figures for another 900 stars, which is the worse trade.

2319 stars, 147 KB, 60 KB over the wire, in a lazily-loaded route chunk.

## BSD-3-Clause notice for the constellation lines

```
Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
