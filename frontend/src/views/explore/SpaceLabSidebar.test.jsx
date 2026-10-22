/**
 * The Laboratory's sidebar folds to an icon rail and stays folded.
 *
 * Thirteen modules made the list taller than the module beside it, and it ran
 * down over the footer. The list scrolls inside its own column now and folds
 * away with one button; these tests hold the button to what it promises — it
 * says what it will do, the names survive for screen readers, and a reader who
 * folded the list does not find it open again on the next visit.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUserStore } from '@/store/useUserStore';
import en from '@/locales/en.json';
import SpaceLabView from './SpaceLabView';

// An SVG module, so nothing here needs WebGL.
const renderLab = () =>
  render(
    <MemoryRouter initialEntries={['/lab/exoplanet']}>
      <Routes>
        <Route path="/lab/:moduleId" element={<SpaceLabView />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useUserStore.setState({ language: 'ENG' });
  localStorage.clear();
});

describe('the module sidebar', () => {
  it('opens unfolded and says it can be hidden', () => {
    renderLab();
    const toggle = screen.getByRole('button', { name: en.lab.collapseModules });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('folds to icons without losing the names', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.collapseModules }));
    const toggle = screen.getByRole('button', { name: en.lab.expandModules });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // Visually hidden, still the button's accessible name, and a tooltip.
    const crater = screen.getByRole('button', { name: en.lab.craterTitle });
    expect(crater.getAttribute('title')).toBe(en.lab.craterTitle);
  });

  it('stays folded on the next visit', () => {
    const first = renderLab();
    fireEvent.click(screen.getByRole('button', { name: en.lab.collapseModules }));
    first.unmount();
    renderLab();
    expect(screen.getByRole('button', { name: en.lab.expandModules })).toBeTruthy();
  });
});
