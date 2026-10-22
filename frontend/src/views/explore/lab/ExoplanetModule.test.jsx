/**
 * Exoplanet Hunter, as a reader meets it.
 *
 * The arithmetic is tested in `lib/transits.test.js`. This file holds the
 * module to the things that test cannot see: every string it shows exists
 * in all three locales (a missing key renders as `lab.exoSomething`, which is
 * what a child would read), the two flows answer the reader — the prediction
 * says whether it was right, and the mystery star says what is wrong with an
 * empty set of marks rather than doing nothing — and the star and the real
 * planets change what the page shows, and tick the missions they promise.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { ExoplanetHunterLab } from './ExoplanetModule';

const finished = () => useGamificationStore.getState().labMissions;

/** The number in the "Dip" readout, in per cent. */
const dipPercent = () => {
  const label = screen.getByText(en.lab.exoDepth);
  return parseFloat(label.nextElementSibling.textContent);
};

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, in both modes', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<ExoplanetHunterLab />);
    expect(container.textContent).not.toMatch(/lab\.exo/);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(container.textContent).not.toMatch(/lab\.exo/);
  });
});

describe('the prediction', () => {
  it('says so when the guess is wrong, and why', () => {
    render(<ExoplanetHunterLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPredictX2 }));
    expect(screen.getByText(en.lab.exoPredictWrong)).toBeTruthy();
    expect(finished()).not.toContain('lab_exoplanet_predict');
  });

  it('says so when the guess is right, and ticks the mission', () => {
    render(<ExoplanetHunterLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPredictX4 }));
    expect(screen.getByText(en.lab.exoPredictRight)).toBeTruthy();
    expect(finished()).toContain('lab_exoplanet_predict');
  });
});

describe('the host star', () => {
  it('makes the same planet a deeper dip round a smaller star', () => {
    render(<ExoplanetHunterLab />);
    const aroundSun = dipPercent();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.lab.exoStarMdwarf.replace(/[()]/g, '\\$&')) }));
    expect(dipPercent()).toBeGreaterThan(aroundSun * 5);
  });
});

describe('the real planets', () => {
  it('set the star, the size and the year from the published values', () => {
    render(<ExoplanetHunterLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPresetTrappist1e }));
    // On the slider and in the readout.
    expect(screen.getAllByText('6.10 days').length).toBeGreaterThan(0);
    expect(screen.getByText(en.lab.exoTypeEarth)).toBeTruthy();
    expect(dipPercent()).toBeGreaterThan(0.45);
    expect(dipPercent()).toBeLessThan(0.55);
    // An Earth-sized planet standing out of the noise: that mission is done.
    expect(finished()).toContain('lab_exoplanet_earth');
  });

  it('tick the mission after three different ones', () => {
    render(<ExoplanetHunterLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPresetHd209458b }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPresetHd209458b }));
    expect(finished()).not.toContain('lab_exoplanet_real');
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPresetHd189733b }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPreset55Cnce }));
    expect(finished()).toContain('lab_exoplanet_real');
  });

  it('warn that 55 Cancri e is lost in the noise', () => {
    render(<ExoplanetHunterLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoPreset55Cnce }));
    expect(screen.getByText(en.lab.exoNoiseWarning)).toBeTruthy();
  });
});

describe('the mystery star', () => {
  it('hides the planet and the readouts until it is found, but says how big the star is', () => {
    render(<ExoplanetHunterLab />);
    fireEvent.click(screen.getByRole('tab', { name: en.lab.exoModeHunt }));
    expect(screen.getByText(en.lab.exoHiddenPlanet)).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.getByText(/R☉ — /)).toBeTruthy();
  });

  it('asks for a mark rather than doing nothing when there is none', () => {
    render(<ExoplanetHunterLab />);
    fireEvent.click(screen.getByRole('tab', { name: en.lab.exoModeHunt }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.exoCheck }));
    expect(screen.getByRole('status').textContent).toContain(en.lab.exoResultEmpty);
  });
});
