"""NASA glTF -> a few hundred kilobytes: Draco geometry, 512 px WebP textures.

Usage:
    python scripts/shrink-models.py <in.glb> [<in2.glb> ...] [--size 512] [--out public/models/probes]

Needs Node (npx @gltf-transform/cli is fetched on first run) and Pillow.
gltf-transform's own texture step goes through sharp, which rejects the
NASA VTAD PNGs ("colourspace: parameter space not set"), so textures are
resized and WebP-encoded with Pillow between two gltf-transform runs.
Models from https://science.nasa.gov/3d-resources/ (public domain).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

NPX = shutil.which('npx') or 'npx'


def run(*args):
    r = subprocess.run([NPX, '-y', '@gltf-transform/cli', *args], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-800:], r.stderr[-800:])
        raise SystemExit(f'gltf-transform failed: {args}')


def shrink(src, out_dir, size, quality=80):
    name = os.path.splitext(os.path.basename(src))[0].lower().replace(' ', '_')
    work = tempfile.mkdtemp(prefix='shrink_')
    try:
        run('copy', src, os.path.join(work, 'model.gltf'))
        with open(os.path.join(work, 'model.gltf'), encoding='utf-8') as f:
            gltf = json.load(f)
        for img in gltf.get('images', []):
            uri = img.get('uri')
            if not uri:
                continue
            path = os.path.join(work, uri)
            with Image.open(path) as im:
                im = im.convert('RGBA') if 'A' in im.getbands() else im.convert('RGB')
                if max(im.size) > size:
                    im.thumbnail((size, size), Image.LANCZOS)
                out = os.path.splitext(uri)[0] + '.webp'
                im.save(os.path.join(work, out), 'WEBP', quality=quality, method=6)
            os.remove(path)
            img['uri'] = out
            img['mimeType'] = 'image/webp'
        for key in ('extensionsUsed', 'extensionsRequired'):
            gltf.setdefault(key, [])
            if 'EXT_texture_webp' not in gltf[key]:
                gltf[key].append('EXT_texture_webp')
        for tex in gltf.get('textures', []):
            if 'source' in tex:
                tex.setdefault('extensions', {})['EXT_texture_webp'] = {'source': tex['source']}
        with open(os.path.join(work, 'model.gltf'), 'w', encoding='utf-8') as f:
            json.dump(gltf, f)
        os.makedirs(out_dir, exist_ok=True)
        final = os.path.join(out_dir, name + '.glb')
        run('optimize', os.path.join(work, 'model.gltf'), final, '--compress', 'draco', '--texture-compress', 'false')
        print(f'{os.path.getsize(final) / 1024:8.0f} KB  {final}')
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main(argv):
    files = [a for a in argv[1:] if a.endswith('.glb') or a.endswith('.gltf')]
    if not files:
        print(__doc__)
        return 2
    size = int(argv[argv.index('--size') + 1]) if '--size' in argv else 512
    out_dir = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join('public', 'models', 'probes')
    for f in files:
        shrink(f, out_dir, size)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
