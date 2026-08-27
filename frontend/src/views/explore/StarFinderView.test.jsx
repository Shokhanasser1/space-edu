/**
 * The star finder, end to end through the DOM.
 *
 * The bug this guards against is the one the feature shipped with for months
 * and nothing caught, because it looked exactly like a working feature:
 *
 *   const baseAzimuth  = ((locIndex + 1) * (starIndex + 1) * 47) % 360;
 *   const baseAltitude = ((locIndex + 1) + (starIndex + 1) * 13) % 90;
 *
 * It printed two plausible numbers with degree signs after a one-second
 * spinner. You cannot tell it is wrong by looking at it. You can only tell by
 * asking it the same question twice — from two places, or at two times — and
 * noticing that the answer for a given star and city never changes with the
 * clock, and that reordering a dropdown moves the whole sky.
 *
 * So that is what these ask. If somebody reintroduces a lookup table, or
 * accidentally drops the time out of the calculation, these fail.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StarFinderView from './StarFinderView';
import { useUserStore } from '@/store/useUserStore';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  slowApi: { post: vi.fn() },
  setupApiAuth: vi.fn(),
}));

// ARCameraView asks for the camera; nothing here goes near that tab.
vi.mock('./ARCameraView', () => ({ default: () => <div data-testid="ar" /> }));

const renderFinder = () =>
  render(<MemoryRouter><StarFinderView /></MemoryRouter>);

/**
 * Set the datetime-local input. `userEvent.type` types one character at a time
 * into a segmented date field, which jsdom does not implement, so it silently
 * leaves the value alone -- and a test that cannot change the time passes
 * against a calculation that ignores it. Found exactly that way.
 */
const setWhen = (input, value) => fireEvent.change(input, { target: { value } });

/** Read the altitude the results panel is showing, as a number. */
const shownAltitude = () => {
  const label = screen.getByText(/^Altitude$/i);
  const panel = label.parentElement;
  const match = within(panel).getByText(/-?\d+°/).textContent.match(/(-?\d+)/);
  return Number(match[1]);
};

beforeEach(() => {
  localStorage.clear();
  useUserStore.setState({ language: 'ENG' });
});

describe('the star finder page', () => {
  it('mounts and puts a sky on the screen', async () => {
    renderFinder();
    await waitFor(() => {
      expect(screen.getByLabelText(/night sky over your chosen place/i)).toBeInTheDocument();
    });
  });

  it('offers the child a time to look at, and a way back to now', async () => {
    renderFinder();
    expect(await screen.findByLabelText(/date and time to show/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^now$/i })).toBeInTheDocument();
  });

  it('says out loud that the constellation lines are a drawing', async () => {
    // The honest half of the lesson, and the thing that makes the figures
    // teaching rather than decoration.
    renderFinder();
    expect(await screen.findByText(/lines between them are a drawing/i)).toBeInTheDocument();
  });

  it('gives a different answer at a different time, for the same star and city', async () => {
    // The one the old code could not pass at all: it never read the clock.
    //
    // Sirius rather than the default, and the reason is worth knowing: the
    // default star is Polaris, which is the one star in the sky that genuinely
    // does not move. Writing this test against it passed a broken calculation
    // and a correct one alike -- see the test below, which is the same fact
    // used the right way round.
    const user = userEvent.setup();
    renderFinder();

    await user.click(await screen.findByRole('button', { name: /Polaris .*Ursa Minor/ }));
    await user.click(await screen.findByRole('button', { name: /Sirius \(Canis Major\)/ }));

    const when = await screen.findByLabelText(/date and time to show/i);
    setWhen(when, '2026-01-15T20:00');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    const evening = shownAltitude();

    setWhen(when, '2026-01-16T04:00');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    const smallHours = shownAltitude();

    expect(smallHours).not.toBe(evening);
  });

  it('gives a different answer from a different place, at the same time', async () => {
    const user = userEvent.setup();
    renderFinder();

    const when = await screen.findByLabelText(/date and time to show/i);
    setWhen(when, '2026-01-15T20:00');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    const fromTashkent = shownAltitude();

    // The location control is a custom listbox, not a <select>.
    await user.click(screen.getByRole('button', { name: /Uzbekistan – Tashkent/ }));
    await user.click(await screen.findByRole('button', { name: /Sydney, Australia/ }));
    await user.click(screen.getByRole('button', { name: /calculate/i }));

    expect(shownAltitude()).not.toBe(fromTashkent);
  });

  it('knows Polaris is not in the Australian sky', async () => {
    // Sydney is at -33.9; Polaris sits at declination +89.3 and is simply not
    // visible from there, ever. A finder that cheerfully points a child in
    // Sydney at the pole star is the failure this feature existed to fix.
    const user = userEvent.setup();
    renderFinder();

    await user.click(await screen.findByRole('button', { name: /Uzbekistan – Tashkent/ }));
    await user.click(await screen.findByRole('button', { name: /Sydney, Australia/ }));
    await user.click(screen.getByRole('button', { name: /calculate/i }));

    expect(shownAltitude()).toBeLessThan(0);
  });

  it('keeps Polaris at the same height all night, because it does not move', async () => {
    // The pole star is the axis the rest of the sky turns around. Six hours
    // must change every other star's altitude and must not change this one's.
    const user = userEvent.setup();
    renderFinder();

    const when = await screen.findByLabelText(/date and time to show/i);
    setWhen(when, '2026-01-15T20:00');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    const evening = shownAltitude();

    setWhen(when, '2026-01-16T02:00');
    await user.click(screen.getByRole('button', { name: /calculate/i }));

    expect(Math.abs(shownAltitude() - evening)).toBeLessThanOrEqual(1);
  });

  it('puts Polaris about as high as Tashkent is far north', async () => {
    // 41.3 degrees north, so the pole star sits at about 41 degrees up, all
    // night, every night. Nothing about this depends on the clock, and it is
    // the check a child can make themselves with a protractor.
    const user = userEvent.setup();
    renderFinder();
    await user.click(await screen.findByRole('button', { name: /calculate/i }));
    expect(Math.abs(shownAltitude() - 41)).toBeLessThanOrEqual(2);
  });
});
