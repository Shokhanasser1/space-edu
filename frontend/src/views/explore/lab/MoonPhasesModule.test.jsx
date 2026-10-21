/**
 * Moon phases and eclipses, as a reader meets it.
 *
 * The arithmetic and the eclipse dates are tested in `lib/moonPhases.test.js`.
 * This file holds the module to what that test cannot see: every string it
 * shows exists in all three locales, the phase buttons move every view to the
 * same Moon, the tilt switch shows what a flat orbit would mean, and the quiz
 * answers the reader instead of ignoring them.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { MoonPhasesLab } from './MoonPhasesModule';

const renderLab = () =>
  render(
    <MemoryRouter>
      <MoonPhasesLab />
    </MemoryRouter>,
  );

const finished = () => useGamificationStore.getState().labMissions;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s', (language) => {
    useUserStore.setState({ language });
    const { container } = renderLab();
    expect(container.textContent).not.toMatch(/lab\.moon/);
    // Aria labels are read aloud, so they count too.
    const labels = [...container.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label'));
    expect(labels.filter((label) => /lab\.moon/.test(label))).toEqual([]);
  });
});

describe('the phase buttons', () => {
  // The quiz draws its options at random and they carry the same phase names,
  // so "the button called Full moon" is sometimes two buttons. The strip's
  // buttons are the toggles: they are the ones with aria-pressed.
  const phaseButton = (name) =>
    screen.getAllByRole('button', { name }).find((b) => b.hasAttribute('aria-pressed'));

  it('turn every view to a full moon', () => {
    renderLab();
    fireEvent.click(phaseButton(en.lab.moonPhaseFull));
    expect(screen.getByText('100 %')).toBeTruthy();
    expect(screen.getAllByText(en.lab.moonPhaseFull).length).toBeGreaterThan(1);
  });

  it('turn every view to a new moon', () => {
    renderLab();
    fireEvent.click(phaseButton(en.lab.moonPhaseNew));
    expect(screen.getByText('0 %')).toBeTruthy();
  });
});

describe('the tilt', () => {
  it('switched off, makes every month an eclipse month', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.moonTilt }));
    expect(screen.getByText(en.lab.moonMonthSolarYes)).toBeTruthy();
    expect(screen.getByText(en.lab.moonMonthLunarYes)).toBeTruthy();
  });
});

describe('the real dates', () => {
  it('jump to the total lunar eclipse of 7 September 2025 and call it an eclipse', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: /2025-09-07/ }));
    expect(screen.getByText(en.lab.moonEclipseLunar)).toBeTruthy();
    expect(screen.getAllByText(en.lab.moonPhaseFull).length).toBeGreaterThan(1);
    expect(finished()).toContain('lab_moon_eclipse');
  });

  it('offer the next solar eclipse, and show it as one', () => {
    renderLab();
    const solar = screen.getAllByRole('button').find((b) => b.textContent.startsWith('Solar eclipse ('));
    expect(solar).toBeTruthy();
    fireEvent.click(solar);
    expect(screen.getByText(en.lab.moonEclipseSolar)).toBeTruthy();
  });

  it('say when the Moon can be seen', () => {
    renderLab();
    fireEvent.click(phaseButtonFor(en.lab.moonPhaseFull));
    expect(screen.getAllByText(en.lab.moonSeeAllNight).length).toBeGreaterThan(0);
  });
});

describe('the missions', () => {
  it('tick a full Moon', () => {
    renderLab();
    fireEvent.click(phaseButtonFor(en.lab.moonPhaseFull));
    expect(finished()).toContain('lab_moon_full');
  });

  it('tick coming back to tonight only after the Moon was moved away', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.moonToday }));
    expect(finished()).not.toContain('lab_moon_today');
    fireEvent.click(phaseButtonFor(en.lab.moonPhaseNew));
    fireEvent.click(screen.getByRole('button', { name: en.lab.moonToday }));
    expect(finished()).toContain('lab_moon_today');
  });

  it('do not count a flat orbit, which has both eclipses every month, as finding one', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.moonTilt }));
    // Flat orbit: both eclipses every month, but that is not the mission.
    expect(finished()).not.toContain('lab_moon_both');
  });

  it('say why a full moon in an ordinary month is not an eclipse', () => {
    renderLab();
    // Step the eclipse season until the full moon misses, then look at it.
    fireEvent.click(phaseButtonFor(en.lab.moonPhaseFull));
    for (let i = 0; i < 6 && screen.queryByText(en.lab.moonEclipseLunar); i += 1) {
      fireEvent.click(screen.getByRole('button', { name: en.lab.moonNextMonth }));
      fireEvent.click(phaseButtonFor(en.lab.moonPhaseFull));
    }
    const why = [en.lab.moonWhyNoEclipseAbove, en.lab.moonWhyNoEclipseBelow].map((s) => s.split('{')[0]);
    expect(screen.getAllByText((text) => why.some((start) => text.startsWith(start))).length).toBeGreaterThan(0);
  });
});

/** The phase strip's button for a phase (the quiz's options share the names). */
function phaseButtonFor(name) {
  return screen.getAllByRole('button', { name }).find((b) => b.hasAttribute('aria-pressed'));
}

describe('the quiz', () => {
  it('answers the first pick and ignores a second', () => {
    renderLab();
    const options = PHASE_NAMES().filter((name) => screen.queryAllByRole('button', { name }).length > 1);
    // Each option name also labels a phase-strip button, so a quiz option is
    // a name with two buttons; take the quiz one, which comes second.
    const first = screen.getAllByRole('button', { name: options[0] })[1];
    fireEvent.click(first);
    const status = screen.getByRole('status').textContent;
    expect(status.startsWith(en.lab.moonQuizRight) || status.startsWith(en.lab.moonQuizWrong.split('{')[0])).toBe(true);
    // Right or wrong, the answer comes with the clue for telling that phase.
    const clues = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => en.lab[`moonQuizClue${i}`]);
    expect(clues.some((clue) => status.endsWith(clue))).toBe(true);
    const second = screen.getAllByRole('button', { name: options[1] })[1];
    fireEvent.click(second);
    expect(screen.getByRole('status').textContent).toBe(status);
  });
});

function PHASE_NAMES() {
  return [
    en.lab.moonPhaseNew, en.lab.moonPhaseWaxingCrescent, en.lab.moonPhaseFirstQuarter, en.lab.moonPhaseWaxingGibbous,
    en.lab.moonPhaseFull, en.lab.moonPhaseWaningGibbous, en.lab.moonPhaseLastQuarter, en.lab.moonPhaseWaningCrescent,
  ];
}
