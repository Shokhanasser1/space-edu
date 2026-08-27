import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BODIES, MOONS, SKY_TEXTURE, SPACECRAFT } from './catalog';

/**
 * Every texture and model the catalogue names first must be a file in
 * public/. A typo here is silent in the browser — the loader falls through
 * to the next candidate or to a flat colour — so this is where it fails.
 */
const PUBLIC = resolve(__dirname, '../../public');

function firstCandidates() {
  const out = [];
  for (const body of [...BODIES, ...MOONS]) {
    for (const [slot, candidates] of Object.entries(body.textures || {})) out.push([`${body.id}.${slot}`, candidates[0]]);
    for (const [slot, candidates] of Object.entries(body.rings?.textures || {})) out.push([`${body.id}.rings.${slot}`, candidates[0]]);
  }
  out.push(['sky', SKY_TEXTURE[0]]);
  for (const craft of SPACECRAFT) if (craft.model) out.push([`probe ${craft.name}`, craft.model]);
  return out;
}

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

  it('gives every body the numbers the panel shows', () => {
    for (const body of [...BODIES, ...MOONS]) {
      expect(body.radiusKm, body.id).toBeGreaterThan(0);
      expect(body.massKg, body.id).toBeGreaterThan(0);
      expect(typeof body.color, body.id).toBe('string');
    }
  });
});
