/**
 * Second-pass finding, 22 Aug 2026.
 *
 * The only error boundary was the root one in `main.jsx`, which replaces the
 * whole application with a full-page crash screen. The audit found one way in
 * (the `/store` ReferenceError) and left a test saying so. There was a second,
 * quieter one: `SpaceLabView` loaded eight textures from `unpkg.com` and
 * `raw.githubusercontent.com` through `useLoader`, which throws when a load
 * fails — so a school network that blocks either host, or a GitHub rate limit,
 * took the entire site down rather than one screen.
 *
 * The textures are served from this site now (24 Aug 2026). The boundary and
 * the non-throwing loader both stay: a local path can still be wrong, and the
 * failure mode being fixed here is "one broken thing takes the site with it",
 * which is not specific to who is hosting the file.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RouteErrorBoundary from './RouteErrorBoundary';

function Boom() {
  throw new Error('texture host unreachable');
}

function Fine() {
  return <p>the page rendered</p>;
}

function Chrome({ children }) {
  const location = useLocation();
  return (
    <div>
      <nav>navigation</nav>
      <main>{children}</main>
      <footer>at {location.pathname}</footer>
    </div>
  );
}

function renderApp(initial = '/broken') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Chrome>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/broken" element={<Boom />} />
            <Route path="/fine" element={<Fine />} />
          </Routes>
        </RouteErrorBoundary>
      </Chrome>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // React logs the caught error; that is expected here.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

describe('a screen that throws', () => {
  it('does not take the rest of the page with it', () => {
    renderApp();
    expect(screen.getByText('navigation')).toBeInTheDocument();
    expect(screen.getByText(/at \/broken/)).toBeInTheDocument();
  });

  it('says so, in place of the screen', () => {
    renderApp();
    expect(screen.getByText(/this page could not load/i)).toBeInTheDocument();
    expect(screen.getByText(/the rest of the site still works/i)).toBeInTheDocument();
  });

  it('offers a way out', () => {
    renderApp();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('records what broke, and where', () => {
    renderApp();
    const crash = JSON.parse(localStorage.getItem('space-edu-last-crash'));
    expect(crash.message).toBe('texture host unreachable');
    expect(crash.route).toBe('/broken');
  });

  it('does not stay broken after navigating away', async () => {
    // Error boundaries do not reset themselves. Without a reset key, a student
    // who hit one broken page would see the error on every page afterwards.
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <Chrome>
          <RouteErrorBoundary>
            <Routes>
              <Route path="/broken" element={<Boom />} />
              <Route path="/fine" element={<Fine />} />
            </Routes>
          </RouteErrorBoundary>
        </Chrome>
      </MemoryRouter>,
    );
    expect(screen.getByText(/this page could not load/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go home/i }));
    // '/' matches no route here, so the boundary should simply have cleared.
    expect(screen.queryByText(/this page could not load/i)).not.toBeInTheDocument();
  });

  it('a healthy screen is untouched', () => {
    renderApp('/fine');
    expect(screen.getByText('the page rendered')).toBeInTheDocument();
    expect(screen.queryByText(/this page could not load/i)).not.toBeInTheDocument();
  });
});

describe('the app wires it in', () => {
  it('App.jsx wraps its routes', async () => {
    const source = await import('@/App.jsx?raw').then((m) => m.default);
    expect(source).toMatch(/<RouteErrorBoundary>/);
    // Still inside the chrome, not around it — otherwise a crash takes the
    // navigation with it again.
    expect(source.indexOf('<main')).toBeLessThan(source.indexOf('<RouteErrorBoundary>'));
  });
});

/**
 * Every source file the Laboratory is made of. The modules moved out of
 * `SpaceLabView.jsx` into `lab/` on 28 Aug 2026, and the textures with them,
 * so a check that reads only the shell file reads nothing that loads one.
 */
async function labSources() {
  const shell = await import('@/views/explore/SpaceLabView.jsx?raw').then((m) => m.default);
  const modules = import.meta.glob('../views/explore/lab/*.{js,jsx}', {
    query: '?raw', import: 'default', eager: true,
  });
  return {
    'SpaceLabView.jsx': shell,
    ...Object.fromEntries(
      Object.entries(modules).filter(([path]) => !/\.test\.jsx?$/.test(path)),
    ),
  };
}

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('textures', () => {
  it('the Laboratory no longer throws its way out of a failed load', async () => {
    const sources = Object.values(await labSources());
    // `useLoader` throws on error; the replacement returns null per texture.
    for (const source of sources) expect(source).not.toMatch(/useLoader\s*\(/);
    expect(sources.some((source) => /useTextures/.test(source))).toBe(true);
  });

  it('the loader hands back null rather than raising', async () => {
    const source = await import('@/hooks/useTextures.js?raw').then((m) => m.default);
    // Third argument to TextureLoader.load is onProgress, fourth is onError.
    expect(source).toMatch(/undefined,\s*\n\s*settle,/);
    expect(source).toMatch(/texture\?\.dispose\?\.\(\)/);
  });

  it('no texture comes from somebody else’s host', async () => {
    // The comment above a list may name the old hosts, to explain why. Code
    // may not: this is the check that stops one being pasted back in. Only
    // the files that load textures are held to it — `labFacts.js` cites its
    // sources by URL, which is the point of that file.
    const loaders = Object.entries(await labSources())
      .map(([path, source]) => [path, stripComments(source)])
      .filter(([, code]) => /'\/textures\//.test(code));
    expect(loaders.map(([path]) => path), 'nothing in the Laboratory loads a texture').not.toEqual([]);
    for (const [path, code] of loaders) {
      expect(code, path).not.toMatch(/https?:\/\//);
    }
  });

  it('nor does any other Earth on the site', async () => {
    // The home page's Earth3D and the Live page's RealEarth were fetching the
    // same five files from raw.githubusercontent.com until 26 Aug 2026 — the
    // home page one on top of Three.js itself from cdnjs.
    //
    // The Live page's Earth moved from LiveSpaceView into OrbitGlobe when that
    // file reached the 800-line ceiling and was split; this follows it there.
    // LiveSpaceView no longer holds an Earth, and no longer names Celestrak or
    // NASA either — its data comes through apps.space now — so it is checked
    // below for the absence rather than for the texture paths.
    const files = {
      Earth3D: () => import('@/components/3d/Earth3D.jsx?raw'),
      OrbitGlobe: () => import('@/components/live/OrbitGlobe.jsx?raw'),
    };
    for (const [name, load] of Object.entries(files)) {
      const source = await load().then((m) => m.default);
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, name).not.toMatch(/https?:\/\//);
      expect(code, name).toMatch(/'\/textures\//);
    }

    const view = await import('@/views/community/LiveSpaceView.jsx?raw')
      .then((m) => m.default)
      .then((src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
    expect(view).not.toMatch(/raw\.githubusercontent\.com|unpkg\.com|cdnjs\.cloudflare\.com/);
    expect(view).not.toMatch(/celestrak\.org/);
  });
});
