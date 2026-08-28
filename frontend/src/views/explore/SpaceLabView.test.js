/**
 * The Laboratory: is every model reachable, is every GPU resource given back,
 * and is every number it prints one we can point at a source for.
 *
 * Source-shape tests, in the style of `SpaceRunScene.leaks.test.js`, and for
 * the same reason: jsdom has no WebGL, so the scenes cannot be rendered here,
 * and the defects that matter are structural anyway — a module nobody can
 * open, a material nobody disposes, a figure nobody can defend.
 *
 * Ticket 12 (Laboratory). Each `describe` below is one thing found on the page
 * on 28 August 2026; the comment says what it looked like to a reader.
 */
import { describe, expect, it } from 'vitest';

import labSource from './SpaceLabView.jsx?raw';

/** Every source file the Laboratory is made of, keyed by path. */
const LAB_SOURCES = {
  './SpaceLabView.jsx': labSource,
  ...Object.fromEntries(
    Object.entries(
      import.meta.glob('./lab/*.{js,jsx}', { query: '?raw', import: 'default', eager: true }),
    ).filter(([path]) => !path.endsWith('.test.js') && !path.endsWith('.test.jsx')),
  ),
};

/** Source with comments removed — for checks that are about code, not prose. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('every module the Laboratory contains can be opened', () => {
  // `RocketEngineeringLab` — the one place in the lab where a rocket came
  // apart, with a capsule payload and a "show internals" toggle — was 130
  // lines of dead code. It was never added to `modules`, so there was no way
  // in, while `lab.rocketEngineering` sat translated in all three locale
  // files. Nothing failed; it simply was not there.
  //
  // A module is a top-level component whose name ends in Lab, Simulator or
  // Module — declared as `const X = (` inside this file, as the first version
  // did, or exported from `lab/` as `export const X = (` or `export function
  // X(`, as they are since the split on 28 Aug 2026. The first regex counted
  // only the inline form, so moving the last three modules out left it with
  // one and failed for the wrong reason.
  const MODULE_COMPONENT =
    /^(?:export\s+)?(?:const\s+(\w+(?:Lab|Simulator|Module))\s*=\s*\(|function\s+(\w+(?:Lab|Simulator|Module))\s*\()/gm;

  const declared = Object.entries(LAB_SOURCES).flatMap(([path, source]) =>
    [...source.matchAll(MODULE_COMPONENT)].map((m) => ({ name: m[1] || m[2], path })),
  );

  const allSource = Object.values(LAB_SOURCES).join('\n');

  it('the lab really is built out of module components', () => {
    expect(declared.length).toBeGreaterThan(3);
  });

  it('every module component is rendered somewhere', () => {
    const orphans = declared.filter(
      ({ name }) => !new RegExp(String.raw`<${name}[\s/>]`).test(allSource),
    );
    expect(
      orphans.map((o) => `${o.name} (${o.path})`),
      'declared but never rendered — a module with no way in',
    ).toEqual([]);
  });

  it('every id in the sidebar has something to render', () => {
    // The sidebar list only. Several modules keep their own `{ id: ... }`
    // lists for parts and stages, and those are not routes.
    const list = /const\s+modules\s*=\s*\[([\s\S]*?)\n\s*\];/.exec(labSource);
    expect(list, 'the sidebar is still built from a `modules` array').not.toBeNull();
    const ids = [...list[1].matchAll(/\bid:\s*'([\w-]+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(3);
    const unhandled = ids.filter(
      (id) => !new RegExp(String.raw`activeModule === '${id}'`).test(labSource),
    );
    expect(unhandled, 'listed in the sidebar with no branch that renders it').toEqual([]);
  });
});

describe('no user-facing text is built into the source', () => {
  // Three buttons in the Planetary Processes panel read
  // "Meteor Shower в „nëŲ", "Volcanic Eruption pµHЬ<" and "Dust Storm pµHЬЄпёŲ",
  // and the inclination readout said "51.6В°". Emoji and a degree sign had been
  // written to the file as UTF-8 and read back as Windows-1251, once, by some
  // editor; the mojibake was then committed and shown to children in all three
  // languages. House rule: UI strings come from the locale files, so the only
  // characters this source needs outside ASCII are typographic.
  const ALLOWED_NON_ASCII = new Set(['—', '’', '×', '·', '°']);

  it.each(Object.keys(LAB_SOURCES))('%s is ASCII apart from typography', (path) => {
    const offenders = [];
    LAB_SOURCES[path].split('\n').forEach((line, index) => {
      for (const character of line) {
        if (character.codePointAt(0) < 127) continue;
        if (ALLOWED_NON_ASCII.has(character)) continue;
        const point = `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
        offenders.push(`line ${index + 1}: ${JSON.stringify(character)} ${point}`);
      }
    });
    expect([...new Set(offenders)]).toEqual([]);
  });
});

describe('the lab gives its GPU resources back', () => {
  // The page already logs `THREE.WebGLRenderer: Context Lost` after four
  // module switches: every module owns its own <Canvas>, and three.js does not
  // release a WebGL context when React drops the canvas — the browser evicts
  // the oldest instead, which is what that message is. Every canvas in the lab
  // has to hand its context back on unmount.
  // Comments stripped: this file's own documentation says "<Canvas>" while
  // declaring none.
  const canvases = (source) => [...code(source).matchAll(/<Canvas[\s>]/g)].length;

  it('there is a component whose job is releasing the context', () => {
    const allSource = Object.values(LAB_SOURCES).join('\n');
    expect(allSource).toMatch(/forceContextLoss\(\)/);
  });

  it.each(Object.keys(LAB_SOURCES).filter((p) => canvases(LAB_SOURCES[p]) > 0))(
    'every <Canvas> in %s releases its context',
    (path) => {
      const source = LAB_SOURCES[path];
      const releases = [...source.matchAll(/<ReleaseContextOnUnmount\s*\/>/g)].length;
      expect(releases, 'one per <Canvas>').toBe(canvases(source));
    },
  );

  it('nothing built in useMemo is left undisposed', () => {
    // The same rule the game is held to (ticket F3). A material or geometry
    // built in useMemo outlives every unmount unless something disposes it.
    // A constructor call, not the mere word: `useTextures(PLANET_TEXTURES)`
    // appearing further down the window is not a resource this memo owns.
    const GPU = /new\s+(?:THREE\.)?\w*(?:Geometry|Material|Texture)\b/;
    const leaked = [];
    for (const [path, source] of Object.entries(LAB_SOURCES)) {
      const built = [...source.matchAll(/const\s+(\w+)\s*=\s*useMemo\(\s*\(\)\s*=>\s*([\s\S]{0,200})/g)]
        .filter((m) => GPU.test(m[2]))
        .map((m) => m[1]);
      const disposed = new Set(
        [...source.matchAll(/(\w+)\s*\??\.\s*dispose\s*(?:\?\.)?\s*\(/g)].map((m) => m[1]),
      );
      // A collection is disposed by iterating it; credit the collection too.
      const iterated = new Set(
        [...source.matchAll(/of\s+Object\.values\((\w+)\)/g)].map((m) => m[1]),
      );
      for (const name of built) {
        if (!disposed.has(name) && !iterated.has(name)) leaked.push(`${name} (${path})`);
      }
    }
    expect(leaked, 'created in useMemo but never disposed').toEqual([]);
  });
});

describe('a timer the reader can walk away from', () => {
  // The launch countdown was a bare `setInterval` inside the click handler with
  // no reference kept. Leaving the module between "3" and "0" left it ticking
  // and calling setState on an unmounted component for the rest of the visit.
  it('every setInterval in the lab is cleared', () => {
    for (const [path, source] of Object.entries(LAB_SOURCES)) {
      const starts = [...code(source).matchAll(/setInterval\(/g)].length;
      if (!starts) continue;
      const clears = [...code(source).matchAll(/clearInterval\(/g)].length;
      expect(clears, `${path} starts ${starts} interval(s)`).toBeGreaterThanOrEqual(starts);
    }
  });

  it('the countdown is owned by an effect, not by a click handler', () => {
    const allSource = Object.values(LAB_SOURCES).join('\n');
    // An interval started in a handler has nothing to clean it up; one started
    // in an effect is cleaned up by React when the module closes.
    expect(allSource).not.toMatch(/const\s+handle\w*\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,400}?setInterval\(/);
  });
});

describe('no texture comes from somebody else’s host', () => {
  // Held for the whole lab folder rather than one file, so that moving a
  // module into `lab/` cannot quietly move it out of this check. The original
  // is in RouteErrorBoundary.test.jsx and covered SpaceLabView.jsx alone.
  it.each(Object.keys(LAB_SOURCES))('%s loads its textures from this site', (path) => {
    expect(code(LAB_SOURCES[path])).not.toMatch(/https?:\/\//);
  });
});
