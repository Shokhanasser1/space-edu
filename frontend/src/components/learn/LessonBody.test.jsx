/**
 * Fifth-pass finding, 24 Aug 2026: a lesson had no text.
 *
 * `TopicLesson.content` has existed since ADR 0001, calls itself "Lesson
 * text/markdown content" in the model, is editable in the admin panel and is
 * sent by the API. Nothing rendered it. The adapter in `learnContent.js` dropped
 * it, and `UniversalLessonView` read only the title and the video URL — so an
 * administrator could write a lesson, save it, open the page, and find their
 * work nowhere on it. Exactly the defect ADR 0001 was written to close, left
 * behind when the tree was fixed.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LessonBody from './LessonBody';

describe('a lesson written in markdown', () => {
  it('renders the structure rather than the punctuation', () => {
    render(<LessonBody markdown={'## Tezlanish\n\nJism tezligining **o‘zgarish** tezligi.\n\n- birinchi\n- ikkinchi'} />);

    expect(screen.getByRole('heading', { name: 'Tezlanish' })).toBeInTheDocument();
    expect(screen.getByText('o‘zgarish').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    // The markers themselves must not survive into the page.
    expect(screen.queryByText(/^##/)).not.toBeInTheDocument();
  });

  it('sends links somewhere safe', () => {
    render(<LessonBody markdown={'[NASA](https://nasa.gov)'} />);

    const link = screen.getByRole('link', { name: 'NASA' });
    expect(link).toHaveAttribute('href', 'https://nasa.gov');
    expect(link).toHaveAttribute('target', '_blank');
    // Without noopener the opened page can reach back through window.opener.
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });
});

describe('what a lesson may not contain', () => {
  it('does not run HTML that was typed into the panel', () => {
    // Lesson text is written by administrators and read by children. One
    // mistaken paste, or one borrowed admin account, must not put a script on
    // every pupil's screen. react-markdown ignores HTML nodes unless rehype-raw
    // is added, and it is deliberately not added.
    const { container } = render(
      <LessonBody markdown={'Before\n\n<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>\n\nAfter'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    // No live element carries the handler. What react-markdown does with HTML
    // it will not render is show it as escaped text — inert, and visibly wrong
    // to whoever wrote it, which is the right way round.
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.textContent).toContain('<img');
    // and the real text around it still arrives
    expect(screen.getByText(/Before/)).toBeInTheDocument();
    expect(screen.getByText(/After/)).toBeInTheDocument();
  });

  it('does not widen the page with a table', () => {
    const { container } = render(
      <LessonBody markdown={'| a | b |\n| - | - |\n| 1 | 2 |'} />,
    );
    const table = container.querySelector('table');
    if (table) {
      expect(table.parentElement.className).toContain('overflow-x-auto');
    }
  });
});

describe('a lesson with nothing written in it yet', () => {
  it('renders nothing at all, so the view can fall back', () => {
    // Most of the 144 physics lessons are still a title and a video. The view
    // shows its generic line when this returns null; an empty box would be worse
    // than the sentence it replaced.
    expect(render(<LessonBody markdown="" />).container.firstChild).toBeNull();
    expect(render(<LessonBody markdown={'   \n  '} />).container.firstChild).toBeNull();
    expect(render(<LessonBody markdown={undefined} />).container.firstChild).toBeNull();
    expect(render(<LessonBody markdown={null} />).container.firstChild).toBeNull();
  });
});
