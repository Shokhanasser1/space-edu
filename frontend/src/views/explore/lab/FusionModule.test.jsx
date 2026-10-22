/**
 * The fusion lab, as a reader meets it.
 *
 * jsdom has no WebGL, so the canvas is stubbed out and the animation clock
 * never runs; these tests hold the panel: every string in three languages,
 * the reaction and the inside of the star following the mass, the step list
 * and its controls, and the missions.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { FusionLab } from './FusionModule';

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

const renderLab = () =>
  render(
    <MemoryRouter initialEntries={['/lab/fusion']}>
      <Routes>
        <Route path="/lab/fusion" element={<FusionLab />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const L = en.lab;
const button = (name) => screen.getByRole('button', { name });
const missionsDone = () => useGamificationStore.getState().labMissions;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('every string it shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, in both views and for every star', (language) => {
    useUserStore.setState({ language });
    const { container } = renderLab();
    for (const view of [0, 1]) {
      fireEvent.click(screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))[view]);
      for (const b of screen.getAllByRole('button').filter((x) => x.hasAttribute('aria-pressed'))) {
        fireEvent.click(b);
        expect(container.textContent).not.toMatch(/lab\.\w+/);
      }
    }
  });
});

describe('the mass decides what happens inside', () => {
  it('runs the Sun on the proton–proton chain, radiative inside and convective outside', () => {
    renderLab();
    expect(screen.getAllByText(L.fusReactionPp).length).toBeGreaterThan(0);
    expect(screen.getByText(L.fusStructureRadiativeCore)).toBeTruthy();
    expect(screen.getByText(L.fusLayerRadiative)).toBeTruthy();
  });

  it('runs a massive star on the CNO cycle with a churning core', () => {
    renderLab();
    fireEvent.click(button(L.fusPresetMassive));
    expect(screen.getAllByText(L.fusReactionCno).length).toBeGreaterThan(0);
    expect(screen.getByText(L.fusStructureConvectiveCore)).toBeTruthy();
    expect(screen.getByText(L.fusLayerConvectiveCore)).toBeTruthy();
  });

  it('ticks the comparison when both kinds of insides have been seen', () => {
    renderLab();
    fireEvent.click(button(L.fusPresetRedDwarf));
    expect(screen.getByText(L.fusStructureFullyConvective)).toBeTruthy();
    expect(missionsDone()).not.toContain('lab_fusion_layers');
    fireEvent.click(button(L.fusPresetMassive));
    expect(missionsDone()).toContain('lab_fusion_layers');
  });
});

describe('the reactions', () => {
  it('lists the proton–proton steps and opens on the first', () => {
    renderLab();
    fireEvent.click(button(new RegExp(L.fusViewReactions)));
    expect(screen.getByText(L.fusPp1Desc)).toBeTruthy();
    expect(screen.getAllByText(L.fusPpNet).length).toBeGreaterThan(0);
  });

  it('steps forward and back through the chain', () => {
    renderLab();
    fireEvent.click(button(new RegExp(L.fusViewReactions)));
    fireEvent.click(button(L.fusNextStep));
    expect(screen.getByText(L.fusPp2Desc)).toBeTruthy();
    fireEvent.click(button(L.fusPrevStep));
    fireEvent.click(button(L.fusPrevStep));
    expect(screen.getByText(L.fusPpNetDesc)).toBeTruthy();
  });

  it('switches to the CNO cycle, where carbon comes back', () => {
    renderLab();
    fireEvent.click(button(new RegExp(L.fusViewReactions)));
    fireEvent.click(button(new RegExp(`^${L.fusReactionCno}`)));
    expect(screen.getByText(L.fusCno1Desc)).toBeTruthy();
    expect(screen.getAllByText(L.fusCno6).length).toBeGreaterThan(0);
  });

  it('pauses and changes speed', () => {
    renderLab();
    fireEvent.click(button(new RegExp(L.fusViewReactions)));
    fireEvent.click(button(new RegExp(L.fusPause)));
    expect(button(new RegExp(L.fusPlay))).toBeTruthy();
    const half = screen.getAllByRole('button').find((b) => b.textContent === '0.5×');
    fireEvent.click(half);
    expect(half.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the Sun counter', () => {
  it('counts hydrogen fused since the page opened', () => {
    vi.useFakeTimers();
    renderLab();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/1\.2B tonnes/)).toBeTruthy();
  });
});

describe('the way back', () => {
  it('opens Life of a Star', () => {
    renderLab();
    fireEvent.click(button(new RegExp(L.fusToLife)));
    expect(screen.getByTestId('where').textContent).toBe('/lab/universe');
  });
});
