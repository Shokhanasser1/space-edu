import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BODIES, MOONS, SKY_TEXTURE, SPACECRAFT } from './catalog';
import { tierOf } from './textures';

/**
 * Every texture and model the catalogue names first must be a file in
 * public/. A typo here is silent in the browser — the loader falls through
 * to the next candidate or to a flat colour — so this is where it fails.
 */
const PUBLIC = resolve(__dirname, '../../public');

function firstCandidates() {
  const out = [];
  for (const body of [...BODIES, ...MOONS]) {
    for (const [slot, candidates] of Object.entries(body.textures || {})) candidates.forEach((c) => out.push([`${body.id}.${slot}`, c]));
    for (const [slot, candidates] of Object.entries(body.rings?.textures || {})) candidates.forEach((c) => out.push([`${body.id}.rings.${slot}`, c]));
  }
  SKY_TEXTURE.forEach((c) => out.push(['sky', c]));
  for (const craft of SPACECRAFT) if (craft.model) out.push([`probe ${craft.name}`, craft.model]);
  // The 8k tier is generated and deployed, never committed (see .gitignore).
  return out.filter(([, url]) => tierOf(url) !== 8);
}

const eightK = () => {
  const out = [];
  for (const body of [...BODIES, ...MOONS]) {
    for (const candidates of Object.values(body.textures || {})) candidates.filter((c) => tierOf(c) === 8).forEach((c) => out.push(c));
  }
  return out;
};

describe('catalogue assets', () => {
  it.each(firstCandidates())('%s → %s exists', (_label, url) => {
    expect(existsSync(resolve(PUBLIC, `.${url}`))).toBe(true);
  });

  it('keeps every asset under the CI large-file limit (2 MB)', async () => {
    const { statSync } = await import('node:fs');
    for (const [, url] of firstCandidates()) {
      const size = statSync(resolve(PUBLIC, `.${url}`)).size;
      expect(size, url).toBeLessThan(2 * 1024 * 1024);
    }
  });

  it('names every 8k map after its 4k twin, under the textures path', () => {
    const all = eightK();
    expect(all.length).toBeGreaterThan(0);
    for (const url of all) {
      expect(url).toMatch(/\/textures\/8k_[a-z_]+\.webp$/);
      expect(existsSync(resolve(PUBLIC, `./textures/${url.split('/').pop().replace('8k_', '4k_')}`)), url).toBe(true);
    }
  });

  it('gives every body the numbers the panel shows', () => {
    for (const body of [...BODIES, ...MOONS]) {
      expect(body.radiusKm, body.id).toBeGreaterThan(0);
      expect(body.massKg, body.id).toBeGreaterThan(0);
      expect(typeof body.color, body.id).toBe('string');
    }
  });
});
