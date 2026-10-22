/**
 * Life of a Star, as a reader meets it.
 *
 * The lifetimes and fates are tested in `lib/stellarEvolution.test.js`. This
 * file holds the panel to what that test cannot see: every string exists in
 * all three languages, the Sun really ends as a white dwarf here (the old
 * module walked every star to a black hole), a heavy star does reach the
 * supernova, and the missions tick when the reader gets there.
 *
 * jsdom has no WebGL, so the canvas is stubbed out; the scene is not what
 * these tests look at.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => null,
  useFrame: () => {},
  useThree: () => ({}),
}));
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null, Stars: () => null, Html: () => null }));
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: () => null,
  Bloom: () => null,
  Vignette: () => null,
}));

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { UniverseChangesSimulator } from './UniverseModule';

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

const renderLab = () =>
  render(
    <MemoryRouter initialEntries={['/lab/universe']}>
      <Routes>
        <Route path="/lab/universe" element={<UniverseChangesSimulator />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const L = en.lab;
const preset = (key) => screen.getByRole('button', { name: L[key] });
const missionsDone = () => useGamificationStore.getState().labMissions;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('every string it shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, for every kind of star', (language) => {
    useUserStore.setState({ language });
    const { container } = renderLab();
    for (const button of screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))) {
      fireEvent.click(button);
      expect(container.textContent).not.toMatch(/lab\.\w+/);
    }
  });
});

describe('mass decides the ending', () => {
  it('walks the Sun to a white dwarf, never a black hole', () => {
    renderLab();
    fireEvent.click(preset('uniPresetSun'));
    expect(screen.getByText(L.uniFateWhiteDwarf)).toBeTruthy();
    expect(screen.getByText(L.uniStagePlanetaryNebula)).toBeTruthy();
    expect(screen.queryByText(L.uniStageBlackHole)).toBeNull();
    expect(screen.queryByText(L.uniStageSupernova)).toBeNull();
  });

  it('sends a very massive star through a supernova to a black hole', () => {
    renderLab();
    fireEvent.click(preset('uniPresetVeryMassive'));
    expect(screen.getByText(L.uniFateBlackHole)).toBeTruthy();
    expect(screen.getByText(L.uniStageSupernova)).toBeTruthy();
  });

  it('says no red dwarf has died yet', () => {
    renderLab();
    fireEvent.click(preset('uniPresetRedDwarf'));
    expect(screen.getByText(L.uniOutlives)).toBeTruthy();
    expect(missionsDone()).toContain('lab_universe_outlive');
  });
});

describe('the missions', () => {
  it('tick when the Sun reaches its white dwarf', () => {
    renderLab();
    fireEvent.click(preset('uniPresetSun'));
    const next = screen.getByRole('button', { name: L.uniNextStage });
    for (let i = 0; i < 4; i += 1) fireEvent.click(next);
    expect(screen.getByText(L.uniStageWhiteDwarfDesc)).toBeTruthy();
    expect(missionsDone()).toContain('lab_universe_sunFuture');
  });

  it('tick for a short-lived heavy star', () => {
    renderLab();
    fireEvent.click(preset('uniPresetVeryMassive'));
    expect(missionsDone()).toContain('lab_universe_shortLife');
  });
});

describe('birth, and the way to fusion', () => {
  it('starts the life at the Pillars of Creation, and credits the models', () => {
    renderLab();
    expect(screen.getByText(L.uniStageNebulaDesc)).toBeTruthy();
    expect(screen.getByText(L.uniNebulaPillars)).toBeTruthy();
    expect(screen.getByText(L.uniModelCredits)).toBeTruthy();
  });

  it('sends the reader to the fusion lab from the main sequence', () => {
    renderLab();
    fireEvent.click(preset('uniPresetSun'));
    fireEvent.click(screen.getByRole('button', { name: L.uniNextStage }));
    fireEvent.click(screen.getByRole('button', { name: L.uniToFusion }));
    expect(screen.getByTestId('where').textContent).toBe('/lab/fusion');
  });
});

describe('the way to the H-R diagram', () => {
  it('opens the H-R module', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(L.uniToHr) }));
    expect(screen.getByTestId('where').textContent).toBe('/lab/hr');
  });
});
