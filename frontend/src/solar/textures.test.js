import { describe, expect, it } from 'vitest';
import { isHiRes, maxTier, pickTier, tierOf } from './textures';

const CANDIDATES = ['/textures/8k_mars.webp', '/textures/4k_mars.webp', '/textures/2k_mars.webp', '/textures/marsmap1k.jpg'];

describe('texture tiers', () => {
  it('reads the tier off the file name', () => {
    expect(tierOf('/textures/8k_mars.webp')).toBe(8);
    expect(tierOf('https://cdn.example/textures/8k_moon.webp')).toBe(8);
    expect(tierOf('/textures/4k_mars.webp')).toBe(4);
    expect(tierOf('/textures/2k_mars.webp')).toBe(0);
    expect(tierOf('/textures/marsmap1k.jpg')).toBe(0);
    expect(isHiRes('/textures/2k_mars.webp')).toBe(false);
  });

  it('never loads more than 2k for an unselected body', () => {
    expect(maxTier({ hiRes: false, quality: 'high', maxTextureSize: 16384 })).toBe(0);
    expect(pickTier(CANDIDATES, 0)).toEqual(['/textures/2k_mars.webp', '/textures/marsmap1k.jpg']);
  });

  it('gives a selected body 4k, and 8k only with a capable GPU on the high preset', () => {
    expect(maxTier({ hiRes: true, quality: 'high', maxTextureSize: 4096 })).toBe(4);
    expect(maxTier({ hiRes: true, quality: 'low', maxTextureSize: 16384 })).toBe(4);
    expect(maxTier({ hiRes: true, quality: 'high', maxTextureSize: 8192 })).toBe(8);
    expect(pickTier(CANDIDATES, 8)[0]).toBe('/textures/8k_mars.webp');
    expect(pickTier(CANDIDATES, 4)[0]).toBe('/textures/4k_mars.webp');
  });
});
