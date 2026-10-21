/**
 * The observatory, as a reader meets it.
 *
 * The geometry is tested in `lib/earthMeasure.test.js`. This file holds the
 * module to what that test cannot see: every string it shows exists in all
 * three locales (a missing key renders as `lab.biruniSomething`), a careless
 * measurement is told it is careless and a good one is told it is good, and
 * each of the five missions is paid when — and only when — the reader has
 * earned it: a good sighting, a good one from a high peak, a good shadow
 * reading, Samarkand from two honest readings, and another city's latitude.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { dipAngleDeg, solsticeAltitudes } from '@/lib/earthMeasure';
import { BiruniObservatoryLab } from './BiruniModule';

/** The fixed part of a message with placeholders, for matching. */
const lead = (text) => text.split('{')[0].trim();
const finished = () => useGamificationStore.getState().labMissions;
const check = () => fireEvent.click(screen.getByRole('button', { name: en.lab.biruniCheck }));

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, on all three tabs', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<BiruniObservatoryLab />);
    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.click(tab);
      expect(container.textContent).not.toMatch(/lab\.(biruni|kit)/);
    }
  });
});

describe("Biruni's method", () => {
  const dip = () => screen.getByRole('slider', { name: en.lab.biruniDip });

  it('says the sighting is off, and why: too small an angle makes too big an Earth', () => {
    render(<BiruniObservatoryLab />);
    check();
    expect(screen.getByRole('status').textContent).toContain(lead(en.lab.biruniResultOffBig));
    expect(finished()).toEqual([]);
  });

  it('says why too large an angle gives too small an Earth', () => {
    render(<BiruniObservatoryLab />);
    fireEvent.change(dip(), { target: { value: '1.5' } });
    check();
    expect(screen.getByRole('status').textContent).toContain(lead(en.lab.biruniResultOffSmall));
  });

  it('explains that no dip at all means a flat, endless Earth', () => {
    render(<BiruniObservatoryLab />);
    fireEvent.change(dip(), { target: { value: '0' } });
    check();
    expect(screen.getByRole('status').textContent).toBe(en.lab.biruniResultNoDip);
  });

  it('accepts a sighting on the horizon and ticks the first mission', () => {
    render(<BiruniObservatoryLab />);
    // From the default 1 km mountain the horizon lies 1.015 degrees down.
    fireEvent.change(dip(), { target: { value: '1.015' } });
    check();
    expect(screen.getByRole('status').textContent).toContain(lead(en.lab.biruniResultOk));
    expect(finished()).toContain('lab_biruni_radius');
    expect(finished()).not.toContain('lab_biruni_peak');
  });

  it('stands the reader on Everest, and pays the peak mission for a close sighting there', () => {
    render(<BiruniObservatoryLab />);
    const everest = screen.getAllByRole('button').find((b) => b.textContent.startsWith(en.lab.biruniPlaceEverest));
    fireEvent.click(everest);
    expect(everest.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('8 849 m')).toBeTruthy();
    fireEvent.change(dip(), { target: { value: dipAngleDeg(8.849).toFixed(3) } });
    check();
    expect(finished()).toEqual(expect.arrayContaining(['lab_biruni_radius', 'lab_biruni_peak']));
  });

  it('shows how far away the horizon is', () => {
    render(<BiruniObservatoryLab />);
    expect(screen.getAllByText('113 km').length).toBeGreaterThan(0);
  });
});

describe('Eratosthenes', () => {
  const open = () => {
    render(<BiruniObservatoryLab />);
    fireEvent.click(screen.getByRole('tab', { name: en.lab.biruniTabEratosthenes }));
  };
  const shadow = () => screen.getByRole('slider', { name: en.lab.biruniShadowReading });

  it('asks for a shadow reading before it measures anything', () => {
    open();
    check();
    expect(screen.getByRole('status').textContent).toBe(en.lab.biruniEraNeedShadow);
  });

  it('gets the Earth from the middle of the shadow and the 157.5 m stadion', () => {
    open();
    fireEvent.change(shadow(), { target: { value: '12.63' } });
    check();
    expect(screen.getByRole('status').textContent).toContain(lead(en.lab.biruniEraOk));
    expect(finished()).toContain('lab_biruni_circumference');
  });

  it('blames the distance, not the shadow, with the Attic stadion', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: en.lab.biruniStadionAttic }));
    fireEvent.change(shadow(), { target: { value: '12.63' } });
    check();
    expect(screen.getByRole('status').textContent).toContain(lead(en.lab.biruniEraOffFar));
    expect(finished()).not.toContain('lab_biruni_circumference');
  });

  it('blames a shadow read too short', () => {
    open();
    fireEvent.change(shadow(), { target: { value: '10' } });
    check();
    expect(screen.getByRole('status').textContent).toContain(lead(en.lab.biruniEraOffShort));
  });
});

describe("Ulugh Beg's arc", () => {
  const openArc = () => {
    render(<BiruniObservatoryLab />);
    fireEvent.click(screen.getByRole('tab', { name: en.lab.biruniTabSextant }));
  };
  const readBoth = (summer, winter) => {
    const pointer = screen.getByRole('slider', { name: en.lab.biruniPointer });
    fireEvent.click(screen.getByRole('button', { name: en.lab.biruniSummer }));
    fireEvent.change(pointer, { target: { value: String(summer) } });
    fireEvent.click(screen.getByRole('button', { name: en.lab.biruniRecord }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.biruniWinter }));
    fireEvent.change(pointer, { target: { value: String(winter) } });
    fireEvent.click(screen.getByRole('button', { name: en.lab.biruniRecord }));
  };

  it('asks for both readings before it derives anything', () => {
    openArc();
    check();
    expect(screen.getByRole('status').textContent).toBe(en.lab.biruniSextantNeedBoth);
  });

  it('gives back the tilt and Samarkand from two good readings', () => {
    openArc();
    readBoth(73.8, 26.9);
    check();
    const status = screen.getByRole('status').textContent;
    expect(status).toContain(lead(en.lab.biruniSextantOk));
    expect(status).toContain('23.45');
    expect(status).toContain('39.65');
    expect(status).toContain(en.lab.biruniCitySamarkand);
    expect(finished()).toContain('lab_biruni_tilt');
    expect(finished()).not.toContain('lab_biruni_city');
  });

  it('names the reading that is off, and which way to move it', () => {
    openArc();
    readBoth(72.5, 26.9);
    check();
    expect(screen.getByRole('status').textContent).toContain(lead(en.lab.biruniSextantOffSummerLow));
    expect(finished()).not.toContain('lab_biruni_tilt');
  });

  it('measures another city once the instrument is carried there', () => {
    openArc();
    fireEvent.click(screen.getByRole('button', { name: en.lab.biruniCityNukus }));
    const { summer, winter } = solsticeAltitudes(42.45);
    readBoth(Math.round(summer * 20) / 20, Math.round(winter * 20) / 20);
    check();
    const status = screen.getByRole('status').textContent;
    expect(status).toContain(en.lab.biruniCityNukus);
    expect(finished()).toContain('lab_biruni_city');
    expect(finished()).not.toContain('lab_biruni_tilt');
  });
});
