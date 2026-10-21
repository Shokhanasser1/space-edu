/**
 * The Apollo 11 launch panel, as a reader meets it.
 *
 * jsdom has no WebGL, so the scene - and with it the frame loop that advances
 * the flight clock - is stubbed out. What is tested is the panel: every
 * string exists in all three locales, the flight log lists the whole real
 * ascent, the clock can run at real time, and launching counts as a mission.
 * The ascent itself (times, heights, speeds, stages) is held to its sources
 * in `labFacts.test.js`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="r3f-canvas" />,
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
import { APOLLO_11_ASCENT } from './labFacts';
import { ApolloLaunchSimulator } from './LaunchModule';

const finished = () => useGamificationStore.getState().labMissions;

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('every string the panel shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<ApolloLaunchSimulator />);
    expect(container.textContent).not.toMatch(/lab\.\w/);
  });
});

describe('the flight log', () => {
  it('lists the whole real ascent, liftoff to orbit, before launch', () => {
    render(<ApolloLaunchSimulator />);
    for (const event of APOLLO_11_ASCENT.events) {
      expect(screen.getAllByText(en.lab[event.labelKey]).length, event.id).toBeGreaterThan(0);
    }
    expect(screen.getByText('11:49')).toBeTruthy();
  });
});

describe('on the pad', () => {
  it('nothing is burning yet', () => {
    render(<ApolloLaunchSimulator />);
    expect(screen.getByText(en.lab.launchStagePad)).toBeTruthy();
    expect(screen.getByText('0 kN')).toBeTruthy();
  });
});

describe('the clock', () => {
  it('can run at real time, and says so', () => {
    render(<ApolloLaunchSimulator />);
    const realTime = screen.getByRole('button', { name: '1x' });
    fireEvent.click(realTime);
    expect(realTime.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(en.lab.launchRealTime)).toBeTruthy();
  });

  it('counts down, lifts off, and counts the launch as a mission', () => {
    vi.useFakeTimers();
    render(<ApolloLaunchSimulator />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.launch }));
    expect(finished()).not.toContain('lab_launch_liftoff');
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getAllByText('T+00:00').length).toBeGreaterThan(0);
    expect(finished()).toContain('lab_launch_liftoff');
  });
});
