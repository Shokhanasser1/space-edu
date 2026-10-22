/**
 * The shared Laboratory kit: missions, explanations, facts and presets.
 *
 * Every module is built out of these, so their promises are tested once here:
 * a mission pays once and stays ticked, the formula hides until asked for,
 * facts step through with their sources, and a preset says which one is on.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import { useGamificationStore, LAB_MISSION_XP } from '@/store/useGamificationStore';
import en from '@/locales/en.json';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('LabMissions', () => {
  const missions = (done) => [
    { id: 'one', title: 'Reach orbit', done },
    { id: 'two', title: 'Go polar', done: false },
  ];

  it('pays a finished mission once and keeps it ticked', () => {
    const { rerender } = render(<LabMissions prefix="lab_test_" missions={missions(true)} />);
    expect(useGamificationStore.getState().labMissions).toEqual(['lab_test_one']);
    expect(useGamificationStore.getState().xp).toBe(LAB_MISSION_XP);
    // The reader moves away from the goal: still done, not paid again.
    rerender(<LabMissions prefix="lab_test_" missions={missions(false)} />);
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(useGamificationStore.getState().xp).toBe(LAB_MISSION_XP);
  });

  it('says so when every mission is done', () => {
    render(<LabMissions prefix="lab_test_" missions={[{ id: 'a', title: 'A', done: true }]} />);
    expect(screen.getByText(en.lab.kitAllDone)).toBeTruthy();
  });
});

describe('LabExplain', () => {
  it('shows the plain words and keeps the formula behind a toggle', () => {
    render(<LabExplain simple="Plain words" formula="E = mc^2" details="More" />);
    expect(screen.getByText('Plain words')).toBeTruthy();
    expect(screen.queryByText('E = mc^2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.lab.kitShowFormula }));
    expect(screen.getByText('E = mc^2')).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
  });
});

describe('LabFacts', () => {
  it('steps through the facts with their sources', () => {
    render(<LabFacts facts={[{ text: 'First', source: 'NASA' }, { text: 'Second' }]} />);
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText(`${en.lab.kitSource}: NASA`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.lab.kitNextFact }));
    expect(screen.getByText('Second')).toBeTruthy();
  });
});

describe('LabPresets', () => {
  it('marks the active preset and reports a pick', () => {
    let picked = null;
    render(
      <LabPresets
        presets={[{ id: 'iss', label: 'ISS' }, { id: 'geo', label: 'GEO' }]}
        activeId="iss"
        onPick={(id) => { picked = id; }}
      />,
    );
    expect(screen.getByRole('button', { name: 'ISS' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'GEO' }));
    expect(picked).toBe('geo');
  });
});
