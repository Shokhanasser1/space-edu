/**
 * The H-R diagram lab, as a reader meets it.
 *
 * The arithmetic is tested in `lib/hrDiagram.test.js`. This file holds the
 * module to what that cannot see: every string it shows exists in all three
 * locales (a missing key renders as `lab.hrSomething`), a wrong placement says
 * which way to move instead of failing silently, and a right one moves the
 * reader on to the next star. Placement is driven by the keyboard here —
 * jsdom has no layout, so a tap has no coordinates — which also proves the
 * keyboard route works.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { HrDiagramLab } from './HrDiagramModule';

const renderLab = () =>
  render(
    <MemoryRouter>
      <HrDiagramLab />
    </MemoryRouter>,
  );

/** Press a key on the diagram `times` times. */
function press(diagram, key, times = 1) {
  for (let i = 0; i < times; i += 1) fireEvent.keyDown(diagram, { key });
}

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s', (language) => {
    useUserStore.setState({ language });
    const { container } = renderLab();
    expect(container.textContent).not.toMatch(/lab\.hr/);
  });
});

describe('placing a star', () => {
  it('starts with the Sun selected and its figures on the card', () => {
    renderLab();
    expect(screen.getByRole('button', { name: en.lab.hrStarSun, pressed: true })).toBeTruthy();
    expect(screen.getByText('5 772 K')).toBeTruthy();
  });

  it('says which way to move after a wrong placement', () => {
    renderLab();
    const diagram = screen.getByRole('application');
    // The cursor starts mid-diagram: 10 000 K and 10 Lsun, hotter and
    // brighter than the Sun.
    press(diagram, 'Enter');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain(en.lab.hrWrong);
    expect(status).toContain(en.lab.hrHintCooler);
    expect(status).toContain(en.lab.hrHintDimmer);
  });

  it('accepts the right spot and moves on to the next star', () => {
    renderLab();
    const diagram = screen.getByRole('application');
    // From (0.5, 0.5) to the Sun at about (0.70, 0.60), 0.015 a press.
    press(diagram, 'ArrowRight', 13);
    press(diagram, 'ArrowDown', 7);
    press(diagram, 'Enter');
    expect(screen.getByRole('status').textContent).toContain(en.lab.hrStarSun);
    expect(screen.getByText(/1 \/ 13/)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.lab.hrStarSiriusA, pressed: true })).toBeTruthy();
  });

  it('starts again from nothing', () => {
    renderLab();
    const diagram = screen.getByRole('application');
    press(diagram, 'ArrowRight', 13);
    press(diagram, 'ArrowDown', 7);
    press(diagram, 'Enter');
    fireEvent.click(screen.getByRole('button', { name: en.lab.hrReset }));
    expect(screen.getByText(/0 \/ 13/)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('the star cards tell a story', () => {
  it('shows the selected star’s story, distance and brightest light', () => {
    renderLab();
    expect(screen.getByText(en.lab.hrStorySun)).toBeTruthy();
    expect(screen.getByText(en.lab.hrDistanceSun)).toBeTruthy();
    // The Sun peaks at 502 nm, in visible light.
    expect(screen.getByText(`502 nm · ${en.lab.hrBandVisible}`)).toBeTruthy();
  });
});

describe('the quick question', () => {
  const quiz = () => within(screen.getByText(en.lab.hrQuizTitle).closest('section'));

  it('answers a wrong pick with that star’s own number', () => {
    renderLab();
    fireEvent.click(quiz().getByRole('button', { name: en.lab.hrStarRigel }));
    const why = screen.getByText(en.lab.hrQuizTitle).closest('section').querySelector('[aria-live]');
    expect(why.textContent).toContain(en.lab.hrStarRigel);
    expect(why.textContent).toContain('79');
    expect(useGamificationStore.getState().labMissions).not.toContain('lab_hr_biggest');
  });

  it('ticks the mission on the right answer and explains it', () => {
    renderLab();
    fireEvent.click(quiz().getByRole('button', { name: en.lab.hrStarBetelgeuse }));
    expect(quiz().getByText(en.lab.hrQuizBiggestWhy)).toBeTruthy();
    expect(useGamificationStore.getState().labMissions).toContain('lab_hr_biggest');
  });

  it('moves on to the next question', () => {
    renderLab();
    fireEvent.click(quiz().getByRole('button', { name: new RegExp(en.lab.hrQuizNext) }));
    expect(quiz().getByText(en.lab.hrQuizHottest)).toBeTruthy();
  });
});

describe('the missions', () => {
  it('tick when the Sun’s future path is opened', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.hrSunPath }));
    expect(useGamificationStore.getState().labMissions).toContain('lab_hr_path');
  });
});
