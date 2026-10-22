/**
 * Seasons and day length, as a reader meets it.
 *
 * The arithmetic is tested in `lib/seasons.test.js`. This file holds the
 * module to what that test cannot see: every string it shows exists in all
 * three locales (a missing key renders as `lab.seasonSomething`, which is what
 * a child would read), the sliders and the cities reach the readouts, the
 * question says whether the answer was right, and the missions tick when the
 * reader gets there.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';
import { SeasonsLab } from './SeasonsModule';

const LOCALES = { ENG: en, RUS: ru, UZB: uz };

const JUNE_21 = '172';
const DEC_21 = '355';

const setDate = (value) =>
  fireEvent.change(screen.getByRole('slider', { name: en.lab.seasonDateLabel }), { target: { value } });
const pickCity = (name) => fireEvent.click(screen.getByRole('button', { name }));
const finished = () => useGamificationStore.getState().labMissions;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, in every city and both solstices', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<SeasonsLab />);
    const lab = LOCALES[language].lab;
    expect(container.textContent).not.toMatch(/lab\.season/);
    // The far cities reach the strings Tashkent never shows: polar day and
    // night, the equator, a southern winter.
    for (const id of ['Murmansk', 'Quito', 'CapeTown']) {
      fireEvent.click(screen.getByRole('button', { name: lab[`seasonCity${id}`] }));
      for (const day of [JUNE_21, DEC_21]) {
        fireEvent.change(screen.getByRole('slider', { name: lab.seasonDateLabel }), { target: { value: day } });
        expect(container.textContent).not.toMatch(/lab\.season/);
      }
    }
  });
});

describe('the sliders reach the readouts', () => {
  it('puts the noon Sun 72 degrees up over Tashkent on the June solstice', () => {
    render(<SeasonsLab />);
    setDate(JUNE_21);
    expect(screen.getByText('72.1°', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByText(en.lab.seasonSummer)).toBeTruthy();
  });

  it('drops the noon Sun to 25 degrees on the December solstice', () => {
    render(<SeasonsLab />);
    setDate(DEC_21);
    expect(screen.getByText('25.3°', { selector: 'dd' })).toBeTruthy();
    // Winter begins at the solstice itself, at 15:50 UT on 21 December 2026 —
    // after the noon this date stands for — so a January date is safely winter.
    setDate('20');
    expect(screen.getByText(en.lab.seasonWinter)).toBeTruthy();
  });

  it('takes the seasons away with the tilt', () => {
    render(<SeasonsLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.seasonTiltZero }));
    expect(screen.getByText(en.lab.seasonNone)).toBeTruthy();
  });

  it('gives Tashkent its June sunrise and sunset on the city clock', () => {
    render(<SeasonsLab />);
    setDate(JUNE_21);
    expect(screen.getByText('04:50', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByText('20:00', { selector: 'dd' })).toBeTruthy();
  });
});

describe('the cities', () => {
  it('turn June into winter in Cape Town', () => {
    render(<SeasonsLab />);
    setDate(JUNE_21);
    pickCity(en.lab.seasonCityCapeTown);
    expect(screen.getByText(en.lab.seasonWinter)).toBeTruthy();
  });

  it('give Murmansk a polar night in December', () => {
    render(<SeasonsLab />);
    setDate(DEC_21);
    pickCity(en.lab.seasonCityMurmansk);
    expect(screen.getByText(en.lab.seasonPolarNight)).toBeTruthy();
    expect(screen.getAllByText(en.lab.seasonNoSunrise).length).toBe(2);
  });
});

describe('the question', () => {
  it('says so when the answer is distance, and why not', () => {
    render(<SeasonsLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.seasonAnswerDistance }));
    expect(screen.getByText(en.lab.seasonAnswerWrong)).toBeTruthy();
  });

  it('says so when the answer is the tilt', () => {
    render(<SeasonsLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.seasonAnswerTilt }));
    expect(screen.getByText(en.lab.seasonAnswerRight)).toBeTruthy();
  });
});

describe('the missions', () => {
  it('tick the longest day in Tashkent', () => {
    render(<SeasonsLab />);
    setDate(JUNE_21);
    expect(finished()).toContain('lab_seasons_longest');
  });

  it('tick Navruz at the March equinox', () => {
    render(<SeasonsLab />);
    setDate('80');
    expect(finished()).toContain('lab_seasons_navruz');
  });

  it('tick an Earth without seasons, a polar night and the right answer', () => {
    render(<SeasonsLab />);
    setDate(DEC_21);
    pickCity(en.lab.seasonCityMurmansk);
    fireEvent.click(screen.getByRole('button', { name: en.lab.seasonAnswerTilt }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.seasonTiltZero }));
    expect(finished()).toEqual(expect.arrayContaining(['lab_seasons_polar', 'lab_seasons_why', 'lab_seasons_flat']));
  });

  it('do not count the longest day for another city', () => {
    render(<SeasonsLab />);
    pickCity(en.lab.seasonCitySamarkand);
    setDate(JUNE_21);
    expect(finished()).not.toContain('lab_seasons_longest');
  });
});
