/**
 * Worlds in Action, as a reader meets it.
 *
 * The physics is tested in `lib/worldPhenomena.test.js`. This file holds the
 * panel to the rest: every string exists in all three languages on all three
 * worlds, the readouts move with the controls, and each mission ticks for the
 * thing it asks for — and not before the reader has done it.
 *
 * jsdom has no WebGL, so the canvas is stubbed out.
 */
import { fireEvent, render, screen } from '@testing-library/react';
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
import { PlanetaryProcessesLab } from './PlanetaryModule';

const L = en.lab;
const world = (key) => screen.getByRole('button', { name: new RegExp(L[key]) });
const missionsDone = () => useGamificationStore.getState().labMissions;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('every string it shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, on all three worlds', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<PlanetaryProcessesLab />);
    for (const button of screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))) {
      fireEvent.click(button);
      expect(container.textContent).not.toMatch(/lab\.\w+/);
    }
  });
});

describe('Earth', () => {
  it('finds the fastest shower', () => {
    render(<PlanetaryProcessesLab />);
    fireEvent.click(screen.getByRole('button', { name: L.planetShowerLeonids }));
    expect(screen.getByText(L.planetSpeedValue.replace('{value}', '71'))).toBeTruthy();
    expect(missionsDone()).toContain('lab_planet_fastest');
  });

  it('counts the next shower only once the reader picks it', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 1));
    render(<PlanetaryProcessesLab />);
    // The Perseids are both the default and, on 1 July, the next shower.
    expect(missionsDone()).not.toContain('lab_planet_next');
    fireEvent.click(screen.getByRole('button', { name: L.planetShowerPerseids }));
    expect(missionsDone()).toContain('lab_planet_next');
  });
});

describe('Mars', () => {
  it('recreates the 2018 storm', () => {
    render(<PlanetaryProcessesLab />);
    fireEvent.click(world('planetWorldMars'));
    fireEvent.click(screen.getByRole('button', { name: L.planetTauStorm }));
    expect(screen.getByRole('slider', { name: L.planetTau }).value).toBe('10.8');
    expect(missionsDone()).toContain('lab_planet_storm');
  });
});

describe('Io', () => {
  it('builds a Pele-sized plume and compares it with Earth', () => {
    render(<PlanetaryProcessesLab />);
    fireEvent.click(world('planetWorldIo'));
    fireEvent.change(screen.getByRole('slider', { name: L.planetVent }), { target: { value: '1050' } });
    expect(screen.getByText(L.planetKmValue.replace('{value}', '307'))).toBeTruthy();
    expect(missionsDone()).toContain('lab_planet_pele');
  });

  it('counts a visit to every world', () => {
    render(<PlanetaryProcessesLab />);
    fireEvent.click(world('planetWorldMars'));
    expect(missionsDone()).not.toContain('lab_planet_visitAll');
    fireEvent.click(world('planetWorldIo'));
    expect(missionsDone()).toContain('lab_planet_visitAll');
  });
});
