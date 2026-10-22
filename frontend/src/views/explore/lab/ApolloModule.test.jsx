/**
 * The Saturn V hologram's panel, as a reader meets it.
 *
 * jsdom has no WebGL, so the scene is stubbed out; everything tested here is
 * the column beside it. It holds the panel to three promises: every string it
 * shows exists in all three locales, the quiz answers the reader rather than
 * ignoring them, and each mission ticks when its goal is actually reached.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { SATURN_V_STACK } from './labFacts';
import { ApolloHologramModule } from './ApolloModule';

const finished = () => useGamificationStore.getState().labMissions;

/** A part's accordion button: its name, then its role, in one accessible name. */
const partButton = (part) =>
  screen.getByRole('button', { name: `${en.lab[part.nameKey]} ${en.lab[part.roleKey]}` });

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  useGamificationStore.setState({ xp: 0, level: 1, labMissions: [] }, false);
});

describe('every string the panel shows is translated', () => {
  it.each(['ENG', 'RUS', 'UZB'])('%s', (language) => {
    useUserStore.setState({ language });
    const { container } = render(<ApolloHologramModule />);
    expect(container.textContent).not.toMatch(/lab\.\w/);
  });
});

describe('the quiz', () => {
  it('says why a wrong part is wrong, and pays nothing for it', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloSicName }));
    const said = screen.getByRole('status').textContent;
    expect(said).toContain(en.lab.apolloQuizWrong);
    expect(said).toContain(en.lab.apolloQuizWhySic);
    expect(finished()).not.toContain('lab_apollo_home');
  });

  it('has a reason ready for every wrong part', () => {
    render(<ApolloHologramModule />);
    for (const part of SATURN_V_STACK.filter((p) => p.id !== 'spacecraft')) {
      fireEvent.click(screen.getByRole('button', { name: en.lab[part.nameKey] }));
      expect(screen.getByRole('status').textContent, part.id).not.toMatch(/lab\.\w/);
      expect(screen.getByRole('status').textContent.length, part.id).toBeGreaterThan(en.lab.apolloQuizWrong.length + 10);
    }
  });

  it('names the Command Module when the reader picks the spacecraft', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloSpacecraftName }));
    expect(screen.getByRole('status').textContent).toBe(en.lab.apolloQuizRight);
    expect(finished()).toContain('lab_apollo_home');
  });
});

describe('the missions', () => {
  it('tick once every part card has been opened', () => {
    render(<ApolloHologramModule />);
    for (const part of SATURN_V_STACK.slice(0, -1)) fireEvent.click(partButton(part));
    expect(finished()).not.toContain('lab_apollo_parts');
    fireEvent.click(partButton(SATURN_V_STACK[SATURN_V_STACK.length - 1]));
    expect(finished()).toContain('lab_apollo_parts');
  });

  it('tick when the stack is pulled fully apart', () => {
    render(<ApolloHologramModule />);
    fireEvent.change(screen.getByRole('slider', { name: en.lab.apolloExplode }), { target: { value: '1' } });
    expect(finished()).toContain('lab_apollo_explode');
  });

  it('tick when something is stood beside the rocket, and explain the comparison', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloCompareBuilding }));
    expect(screen.getByText(en.lab.apolloCompareNoteBuilding)).toBeTruthy();
    expect(finished()).toContain('lab_apollo_compare');
  });

  it('do not count "rocket only" as a comparison', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloCompareNone }));
    expect(finished()).not.toContain('lab_apollo_compare');
  });
});

describe('a selected part shows its own facts and source', () => {
  it('opens the third stage card with its engine and thrust', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(partButton(SATURN_V_STACK.find((p) => p.id === 's-ivb')));
    expect(screen.getByText('1 x Rocketdyne J-2')).toBeTruthy();
    expect(screen.getByText('890 kN (200,000 lbf)')).toBeTruthy();
  });
});

describe('a part up close', () => {
  it('flies to a part from its card, says which, and ticks the mission', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(partButton(SATURN_V_STACK[2]));
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloFocusButton }));
    expect(screen.getByText(en.lab.apolloFocusChip.replace('{name}', en.lab.apolloSivbName))).toBeTruthy();
    expect(screen.getByText(en.lab.apolloFocusHint)).toBeTruthy();
    expect(finished()).toContain('lab_apollo_closeup');
    // Looking close opens the stack, so the explode mission's slider moved too.
    expect(Number(screen.getByRole('slider', { name: en.lab.apolloExplode }).value)).toBeGreaterThanOrEqual(0.6);
  });

  it('can stop turning, and goes back to the whole rocket', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloFocusButton }));
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloFocusPause }));
    expect(screen.getByRole('button', { name: en.lab.apolloFocusSpin })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloFocusBack }));
    expect(screen.queryByRole('button', { name: en.lab.apolloFocusBack })).toBeNull();
  });

  it('ends when the stack is closed again', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloFocusButton }));
    fireEvent.change(screen.getByRole('slider', { name: en.lab.apolloExplode }), { target: { value: '0' } });
    expect(screen.queryByRole('button', { name: en.lab.apolloFocusBack })).toBeNull();
  });
});

describe('the artist-made landmark models', () => {
  it('credit their authors, as CC BY asks, whenever they are shown', () => {
    render(<ApolloHologramModule />);
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloCompareLiberty }));
    expect(screen.getByText(/by gravityjack \(Sketchfab\), CC BY 4\.0/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.lab.apolloCompareTower }));
    expect(screen.getByText(/by qsardor57913 \(Sketchfab\), CC BY 4\.0/)).toBeTruthy();
  });
});
