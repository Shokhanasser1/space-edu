/**
 * 26 August 2026: "where did the planet on the home page go?"
 *
 * It had gone wherever cdnjs.cloudflare.com goes on that network. `Earth3D`
 * loaded Three.js r128 with a `<script>` tag and never resolved if the script
 * did not arrive, so the hero opened on an empty black circle. `three` was in
 * package.json the whole time. These tests keep the planet inside the bundle
 * and give it a still image when there is no WebGL to draw it with.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Earth3D, { FALLBACK_IMAGE } from './Earth3D';

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('where the Earth comes from', () => {
  it('is the bundled three, not a script from a CDN', async () => {
    const source = await import('./Earth3D.jsx?raw').then((m) => m.default);
    const code = stripComments(source);
    expect(code).toMatch(/from 'three'/);
    expect(code).not.toMatch(/createElement\(\s*'script'\s*\)/);
    expect(code).not.toMatch(/window\.THREE/);
  });

  it('serves every texture from this site', async () => {
    const source = await import('./Earth3D.jsx?raw').then((m) => m.default);
    const code = stripComments(source);
    // The comment at the top may name the old hosts, to explain why. Code may
    // not: this is the check that stops one being pasted back in.
    expect(code).not.toMatch(/https?:\/\//);
    const local = code.match(/'\/textures\/[^']+'/g) ?? [];
    expect(local).toHaveLength(5);
  });
});

describe('without WebGL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a still Earth instead of an empty circle, and does not throw', () => {
    // jsdom has no WebGL; vitest.setup stubs getContext to return null for it.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Earth3D size={300} />);
    const image = screen.getByTestId('earth-fallback').querySelector('img');
    expect(image).toHaveAttribute('src', FALLBACK_IMAGE);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('never grows wider than the screen it is on', () => {
    render(<Earth3D size={520} />);
    const box = screen.getByTestId('earth-fallback');
    // jsdom mangles the separator when it re-serialises min(); the two bounds
    // are what matter.
    expect(box.style.width).toMatch(/^min\(520px/);
    expect(box.style.width).toContain('calc(100vw - 2rem)');
  });

  it('unmounts cleanly', () => {
    const { unmount } = render(<Earth3D />);
    expect(() => unmount()).not.toThrow();
  });
});
