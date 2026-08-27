"""Planet maps from their originals into the three tiers the scene loads.

Usage:
    python scripts/convert-textures.py <dir with Solar System Scope originals> [--only mars,moon]

Writes into public/textures/:
    2k_<name>.webp   2048x1024, committed, loaded for every body
    4k_<name>.webp   4096x2048, committed (each under the 2 MB CI limit),
                     loaded for the selected body
    8k_<name>.webp   8192x4096, NOT committed (.gitignore), served from the
                     deploy's static dir or VITE_ASSET_BASE; loaded for the
                     selected body on GPUs with maxTextureSize >= 8192

Why WebP and not KTX2: the repository caps tracked files at 2 MB; a 4k
UASTC KTX2 is ~5 MB, a 4k WebP is 0.3-1.7 MB. GPU memory is the same for
both once decoded (a 4k map is 45 MB, an 8k map 180 MB), which is why the
scene loads tiers rather than the best file for everything.

Originals: https://www.solarsystemscope.com/textures/ (CC BY 4.0). The
name mapping below is theirs; add a line to keep the naming scheme.
"""
import os
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, '..', 'public', 'textures')

# name -> (source file, quality by tier, tiers to write)
MAPS = {
    'sun': ('8k_sun.jpg', {8: 76, 4: 82, 2: 82}),
    'mercury': ('8k_mercury.jpg', {8: 72, 4: 74, 2: 82}),
    'venus_atmosphere': ('4k_venus_atmosphere.jpg', {4: 82, 2: 82}),
    'earth_daymap': ('8k_earth_daymap.jpg', {8: 80, 4: 86, 2: 86}),
    'earth_nightmap': ('8k_earth_nightmap.jpg', {8: 78, 4: 84, 2: 84}),
    'mars': ('8k_mars.jpg', {8: 76, 4: 84, 2: 84}),
    'jupiter': ('8k_jupiter.jpg', {8: 78, 4: 84, 2: 84}),
    'saturn': ('8k_saturn.jpg', {8: 78, 4: 84, 2: 84}),
    'uranus': ('2k_uranus.jpg', {2: 86}),
    'neptune': ('2k_neptune.jpg', {2: 86}),
    'moon': ('8k_moon.jpg', {8: 74, 4: 72, 2: 82}),
    'ceres_fictional': ('4k_ceres_fictional.jpg', {2: 84}),
    'haumea_fictional': ('4k_haumea_fictional.jpg', {2: 84}),
    'makemake_fictional': ('4k_makemake_fictional.jpg', {2: 84}),
    'eris_fictional': ('4k_eris_fictional.jpg', {2: 84}),
    'stars_milky_way': ('8k_stars_milky_way.jpg', {4: 80, 2: 80}),
}
WIDTH = {8: 8192, 4: 4096, 2: 2048}
LIMIT = 2 * 1024 * 1024


def convert(name, src_dir, only):
    if only and name not in only:
        return
    src, qualities = MAPS[name]
    path = os.path.join(src_dir, src)
    if not os.path.exists(path):
        print(f'   skip  {name}: {src} not found')
        return
    with Image.open(path) as im:
        rgb = im.convert('RGB')
        for tier, q in sorted(qualities.items(), reverse=True):
            w = WIDTH[tier]
            out = os.path.join(DST, f'{tier}k_{name}.webp')
            img = rgb if rgb.width == w else rgb.resize((w, w // 2), Image.LANCZOS)
            img.save(out, 'WEBP', quality=q, method=6)
            size = os.path.getsize(out)
            flag = '' if tier == 8 or size < LIMIT else '  <-- over the 2 MB CI limit, lower the quality'
            print(f'{size / 1024:8.0f} KB  {os.path.basename(out)}{flag}')


def clouds(src_dir, only):
    """White-on-black cloud map -> RGBA with luminance as alpha, 2k only."""
    if only and 'earth_clouds' not in only:
        return
    path = os.path.join(src_dir, '8k_earth_clouds.jpg')
    if not os.path.exists(path):
        return
    with Image.open(path) as im:
        lum = im.convert('L').resize((2048, 1024), Image.LANCZOS)
        white = Image.new('L', lum.size, 255)
        rgba = Image.merge('RGBA', (white, white, white, lum))
        out = os.path.join(DST, '2k_earth_clouds.webp')
        rgba.save(out, 'WEBP', quality=78, method=6)
        print(f'{os.path.getsize(out) / 1024:8.0f} KB  2k_earth_clouds.webp')


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    src_dir = argv[1]
    only = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
    for name in MAPS:
        convert(name, src_dir, only)
    clouds(src_dir, only)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
