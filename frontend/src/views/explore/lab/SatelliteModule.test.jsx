/**
 * Satellite Control, as a reader meets it.
 *
 * jsdom has no WebGL, so the 3D scene is stubbed out and these tests hold the
 * panel to what it promises: every string is translated, the real-orbit
 * presets land where their operators say, a preset cannot complete a mission
 * on its own, the missions do complete when the reader flies the orbit, and
 * the battery drains with the panels folded. The arithmetic itself is tested
 * in `lib/orbits.test.js`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({ Canvas: () => null, useFrame: () => {}, useThree: () => ({}) }));
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null, Stars: () => null }));
vi.mock('@react-three/postprocessing', () => ({ EffectComposer: () => null, Bloom: () => null, Vignette: () => null }));
vi.mock('@/hooks/useTextures', () => ({ useTextures: () => [] }));

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { GEO_ALTITUDE_KM, SIDEREAL_DAY_MINUTES, altitudeForPeriodMinutes } from '@/lib/orbits';
import {
  PRESETS,
  SatelliteControlSimulator,
  betaAngleDeg,
  missionFeedback,
  satelliteMissions,
} from './SatelliteModule';

const finished = () => useGamificationStore.getState().labMissions;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<SatelliteControlSimulator />);
    expect(container.textContent).not.toMatch(/lab\.\w+/);
    const labels = [...container.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label'));
    expect(labels.filter((l) => /^lab\./.test(l))).toEqual([]);
  });
});

describe('the real-orbit presets', () => {
  it('put GPS at 20 200 km in medium Earth orbit, on a satellite rather than a station', () => {
    render(<SatelliteControlSimulator />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.satPresetGps }));
    expect(screen.getByText('20 200 km')).toBeTruthy();
    expect(screen.getByText(en.lab.orbitMeo)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.lab.satModelSatellite }).getAttribute('aria-pressed')).toBe('true');
  });

  it('call the geostationary preset geostationary', () => {
    render(<SatelliteControlSimulator />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.satPresetGeo }));
    expect(screen.getByText('35 786 km')).toBeTruthy();
    expect(screen.getByText(en.lab.orbitGeo)).toBeTruthy();
  });

  it('do not complete a mission on their own', () => {
    render(<SatelliteControlSimulator />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.satPresetGeo }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.satPresetGps }));
    expect(finished()).toEqual([]);
  });
});

describe('the missions', () => {
  it('tick a polar orbit flown by hand', () => {
    render(<SatelliteControlSimulator />);
    fireEvent.change(screen.getByRole('slider', { name: en.lab.orbitalInclination }), { target: { value: '90' } });
    expect(finished()).toContain('lab_satellite_polar');
  });

  it('tick geostationary once the reader has touched the controls themselves', () => {
    render(<SatelliteControlSimulator />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.satPresetGeo }));
    expect(finished()).not.toContain('lab_satellite_geo');
    // Nudge up and back: a geostationary orbit flown by the reader.
    fireEvent.click(screen.getByRole('button', { name: en.lab.satNudge.replace('{value}', '+10') }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.satNudge.replace('{value}', '-10') }));
    expect(finished()).toContain('lab_satellite_geo');
  });

  it('know what each mission asks for', () => {
    const gps = altitudeForPeriodMinutes(SIDEREAL_DAY_MINUTES / 2);
    expect(satelliteMissions({ altitude: gps, inclination: 55, fromPreset: false }).gps).toBe(true);
    expect(satelliteMissions({ altitude: gps, inclination: 55, fromPreset: true }).gps).toBe(false);
    expect(satelliteMissions({ altitude: GEO_ALTITUDE_KM, inclination: 0, fromPreset: false }).geo).toBe(true);
    // Geosynchronous but inclined does not hover over one spot.
    expect(satelliteMissions({ altitude: GEO_ALTITUDE_KM, inclination: 20, fromPreset: false }).geo).toBe(false);
    expect(satelliteMissions({ altitude: 400, inclination: 51.6, fromPreset: false }).slow).toBe(false);
    expect(satelliteMissions({ altitude: 20000, inclination: 51.6, fromPreset: false }).slow).toBe(true);
  });
});

describe('the line that says why a mission has not ticked', () => {
  it('explains that a preset does not count', () => {
    expect(missionFeedback({ altitude: GEO_ALTITUDE_KM, inclination: 0, fromPreset: true })).toEqual({ key: 'satPresetNoCount' });
    render(<SatelliteControlSimulator />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.satPresetGeo }));
    expect(screen.getByText(en.lab.satPresetNoCount)).toBeTruthy();
  });

  it('says which way to go when the period is close', () => {
    const low = missionFeedback({ altitude: altitudeForPeriodMinutes(SIDEREAL_DAY_MINUTES - 30), inclination: 0, fromPreset: false });
    expect(low).toMatchObject({ key: 'satNearGeoPeriod', dirKey: 'satGoHigher' });
    const high = missionFeedback({ altitude: altitudeForPeriodMinutes(SIDEREAL_DAY_MINUTES + 30), inclination: 0, fromPreset: false });
    expect(high).toMatchObject({ key: 'satNearGeoPeriod', dirKey: 'satGoLower' });
  });

  it('names the tilt when only the tilt is wrong', () => {
    expect(missionFeedback({ altitude: GEO_ALTITUDE_KM, inclination: 20, fromPreset: false })).toEqual({ key: 'satNearGeoTilt' });
  });

  it('stays quiet when there is nothing near to say', () => {
    expect(missionFeedback({ altitude: 400, inclination: 51.6, fromPreset: false })).toBeNull();
  });
});

describe('the presets are the published figures', () => {
  it('have the ISS at 400 km and 51.6 degrees, GPS at 55 degrees, GEO over the equator', () => {
    const byId = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
    expect(byId.iss).toMatchObject({ altitude: 400, inclination: 51.6 });
    expect(byId.hubble.inclination).toBe(28.5);
    expect(byId.gps).toMatchObject({ altitude: 20200, inclination: 55 });
    expect(byId.geo).toMatchObject({ altitude: GEO_ALTITUDE_KM, inclination: 0 });
  });
});

describe('the scene geometry', () => {
  it('puts the Sun about 12 degrees out of an equatorial orbit plane', () => {
    expect(betaAngleDeg(0)).toBeGreaterThan(11);
    expect(betaAngleDeg(0)).toBeLessThan(14);
  });
});

describe('the battery', () => {
  it('drains with the solar panels folded', () => {
    vi.useFakeTimers();
    render(<SatelliteControlSimulator />);
    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.lab.solarPanels }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('100%')).toBeNull();
  });
});
