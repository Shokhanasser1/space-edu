/**
 * Crater Lab, as a reader meets it.
 *
 * The scaling law is tested in `lib/impacts.test.js`. This file holds the
 * module to what that test cannot see: every string exists in all three
 * locales, the crater stays hidden until the reader has guessed and pressed
 * the button, and the verdict compares the guess with the model honestly.
 *
 * Reduced motion is switched on here so "Impact!" lands at once instead of
 * after a two-second animation; the module takes that path for readers who
 * ask for it too.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { METEOR_CRATER, simulateImpact } from '@/lib/impacts';
import { CraterImpactLab } from './CraterModule';

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ trackedEvents: [] });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

const crater = () => screen.getByText(en.lab.craterCrater).nextSibling.textContent;

describe('every string the module shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s, before and after the impact', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<CraterImpactLab />);
    expect(container.textContent).not.toMatch(/lab\.crater/);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('from-violet-600')));
    expect(container.textContent).not.toMatch(/lab\.crater/);
  });
});

describe('predict, then impact', () => {
  it('keeps the crater hidden until the impact', () => {
    render(<CraterImpactLab />);
    expect(crater()).toBe('—');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reveals the model crater and judges a far-off guess', () => {
    render(<CraterImpactLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.craterImpact }));
    // The default is the Meteor Crater case and the default guess is 300 m.
    expect(crater()).toMatch(/km/);
    expect(screen.getByRole('status').textContent).toMatch(/times bigger than your guess/);
  });

  it('rewards a guess within a factor of 1.5', () => {
    render(<CraterImpactLab />);
    const model = simulateImpact(METEOR_CRATER).diameterM;
    fireEvent.change(screen.getByRole('slider', { name: en.lab.craterGuess }), {
      target: { value: String(Math.log10(model)) },
    });
    fireEvent.click(screen.getByRole('button', { name: en.lab.craterImpact }));
    expect(screen.getByRole('status').textContent).toContain(en.lab.craterResultClose);
    // A lab mission, not a calendar event towards the astronomy badge.
    expect(useGamificationStore.getState().labMissions).toContain('lab_crater_prediction');
    expect(useGamificationStore.getState().trackedEvents).not.toContain('lab_crater_prediction');
  });

  it('hides the crater again when an input changes', () => {
    render(<CraterImpactLab />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.craterImpact }));
    fireEvent.click(screen.getByRole('tab', { name: en.lab.craterMoon }));
    expect(crater()).toBe('—');
  });
});

describe('the Meteor Crater comparison', () => {
  it('prints the model figure, not the real one dressed up as it', () => {
    const { container } = render(<CraterImpactLab />);
    expect(container.textContent).toMatch(/this model gives 1\.55 km/);
  });
});
