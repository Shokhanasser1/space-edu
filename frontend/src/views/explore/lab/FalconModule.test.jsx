/**
 * Falcon 9: the column beside the prebuilt viewer.
 *
 * The viewer is an iframe and is not tested here. What is: every string is
 * translated, the quiz says whether an answer is right and only a right one
 * ticks its mission, and the button to the Live page takes the reader there
 * and remembers that it did.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { FalconTrackerLab } from './FalconModule';

const renderLab = () =>
  render(
    <MemoryRouter initialEntries={['/lab/falcon']}>
      <Routes>
        <Route path="/lab/falcon" element={<FalconTrackerLab />} />
        <Route path="/live" element={<p>live page</p>} />
      </Routes>
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
    expect(container.textContent).not.toMatch(/lab\.\w+/);
    expect(container.querySelector('iframe').getAttribute('title')).not.toMatch(/^lab\./);
  });
});

describe('the viewer', () => {
  it('is still the prebuilt application', () => {
    const { container } = renderLab();
    expect(container.querySelector('iframe').getAttribute('src')).toBe('/falcon9-simulator/index.html');
  });
});

describe('the quiz', () => {
  it('says why a wrong answer is wrong, and does not tick the mission', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.falconQ1b }));
    expect(screen.getByText(en.lab.falconQ1Wrong)).toBeTruthy();
    expect(finished()).not.toContain('lab_falcon_quiz_reuse');
  });

  it('ticks the mission for a right answer', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.falconQ1a }));
    expect(screen.getByText(en.lab.falconQ1Right)).toBeTruthy();
    expect(finished()).toContain('lab_falcon_quiz_reuse');
  });
});

describe('the way to the real thing', () => {
  it('opens the Live page and remembers the mission', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.falconOpenLive }));
    expect(screen.getByText('live page')).toBeTruthy();
    expect(finished()).toContain('lab_falcon_live');
  });
});
