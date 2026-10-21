/**
 * Habitable zone, as a reader meets it.
 *
 * The boundaries and temperatures are tested in `lib/habitableZone.test.js`.
 * This file holds the module to what that test cannot see: every string it
 * shows exists in all three locales, the prediction answers the reader, the
 * comparison waits for the prediction, moving the planet changes what the
 * panel says about its water and why, and the missions are earned by doing
 * the thing — letting go of a planet, visiting a real one — not by opening
 * the page.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';
import { HabitableZoneLab } from './HabitableZoneModule';

const LOCALES = { ENG: en, RUS: ru, UZB: uz };
const done = () => useGamificationStore.getState().labMissions;
const fill = (text, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text);

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ labMissions: [] }, false);
});

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, for every system, star and planet', (language) => {
    useUserStore.setState({ language });
    const lab = LOCALES[language].lab;
    const { container } = render(<HabitableZoneLab />);
    expect(container.textContent).not.toMatch(/lab\.(hz|kit)/);
    for (const key of ['hzSysSun', 'hzSysProxima', 'hzSysTrappist', 'hzSysKepler452', 'hzStarM', 'hzStarF']) {
      fireEvent.click(screen.getAllByRole('button', { name: lab[key] })[0]);
      for (const button of screen.getAllByRole('button')) fireEvent.click(button);
      expect(container.textContent).not.toMatch(/lab\.(hz|kit)/);
    }
  });
});

describe('the prediction', () => {
  it('says so when the guess is wrong, and holds the comparison back until then', () => {
    render(<HabitableZoneLab />);
    expect(screen.queryByText(en.lab.hzCompareTitle)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.lab.hzPredictFarther }));
    expect(screen.getByText(en.lab.hzPredictWrong)).toBeTruthy();
    expect(screen.getByText(en.lab.hzCompareTitle)).toBeTruthy();
  });

  it('says so when the guess is right', () => {
    render(<HabitableZoneLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.hzPredictCloser }));
    expect(screen.getByText(en.lab.hzPredictRight)).toBeTruthy();
  });
});

describe('moving the planet', () => {
  it('opens at Earth’s distance from the Sun, in the zone', () => {
    render(<HabitableZoneLab />);
    expect(screen.getAllByText(en.lab.hzResultLiquid).length).toBeGreaterThan(0);
  });

  it('boils the water close in and freezes it far out, and says why', () => {
    render(<HabitableZoneLab />);
    const slider = screen.getByRole('slider', { name: en.lab.hzDistance });
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(screen.getAllByText(en.lab.hzResultHot).length).toBeGreaterThan(0);
    expect(screen.getByText(fill(en.lab.hzWhyHot, { flux: '4.00' }))).toBeTruthy();
    fireEvent.change(slider, { target: { value: '2.3' } });
    expect(screen.getAllByText(en.lab.hzResultCold).length).toBeGreaterThan(0);
  });

  it('turns Earth’s orbit to ice round a red dwarf', () => {
    render(<HabitableZoneLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.hzStarM }));
    expect(screen.getAllByText(en.lab.hzResultCold).length).toBeGreaterThan(0);
  });

  it('labels the enlarged star and planets on the picture', () => {
    render(<HabitableZoneLab />);
    expect(screen.getByText(en.lab.hzScaleNote)).toBeTruthy();
  });
});

describe('real systems', () => {
  it('admits that TRAPPIST-1 is cooler than the fit was made for', () => {
    render(<HabitableZoneLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.hzSysTrappist }));
    expect(screen.getByText(fill(en.lab.hzExtrapolated, { name: 'TRAPPIST-1', teff: '2566' }))).toBeTruthy();
  });
});

describe('missions are earned, not handed out', () => {
  it('pays nothing for opening the page in the zone', () => {
    render(<HabitableZoneLab />);
    expect(done()).toEqual([]);
  });

  it('pays for boiling an ocean once the reader lets go of the slider', () => {
    render(<HabitableZoneLab />);
    const slider = screen.getByRole('slider', { name: en.lab.hzDistance });
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(done()).not.toContain('lab_habitable_boil');
    fireEvent.keyUp(slider);
    expect(done()).toContain('lab_habitable_boil');
  });

  it('pays for visiting Proxima b', () => {
    render(<HabitableZoneLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.hzSysProxima }));
    const name = fill(en.lab.hzPlanetName, { system: en.lab.hzSysProxima, key: 'b' });
    fireEvent.click(screen.getByRole('button', { name: fill(en.lab.hzVisitPlanet, { name }) }));
    expect(done()).toContain('lab_habitable_proxima');
    expect(done()).toContain('lab_habitable_zone');
  });

  it('pays for TRAPPIST-1 only once e, f and g have all been found', () => {
    render(<HabitableZoneLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.hzSysTrappist }));
    const visit = (key) => {
      const name = fill(en.lab.hzPlanetName, { system: en.lab.hzSysTrappist, key });
      fireEvent.click(screen.getByRole('button', { name: fill(en.lab.hzVisitPlanet, { name }) }));
    };
    ['b', 'c', 'd', 'e', 'f'].forEach(visit);
    expect(done()).not.toContain('lab_habitable_trappist');
    visit('g');
    expect(done()).toContain('lab_habitable_trappist');
  });

  it('counts each kind of star once towards the four', () => {
    render(<HabitableZoneLab />);
    const missions = screen.getByText(en.lab.kitMissions).closest('section');
    expect(within(missions).getByText(fill(en.lab.hzMissionTypesHint, { n: 0 }))).toBeTruthy();
    // The Sun counts as a G star: visit Earth.
    fireEvent.click(screen.getByRole('button', { name: fill(en.lab.hzVisitPlanet, { name: en.lab.hzEarth }) }));
    expect(within(missions).getByText(fill(en.lab.hzMissionTypesHint, { n: 1 }))).toBeTruthy();
  });
});
