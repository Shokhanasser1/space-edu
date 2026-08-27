/**
 * The Space Run title screen showed an empty sky.
 *
 * The star field canvas is `inset-0` inside a `flex-1 min-h-0` column, so on the
 * commit that mounts the intro it measures 1280 wide and 0 tall. The old code
 * read those numbers once and wrote them straight into the backing store, then
 * listened only for window `resize` — which never fires when the surrounding
 * layout is what settled. Measured in a real browser, the canvas sat at
 * 2560 × 0 device pixels for the whole intro while 220 stars animated into it.
 *
 * These tests drive the ResizeObserver by hand, because jsdom performs no
 * layout and would report 0 × 0 forever.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { useStarfield } from './useStarfield';

/** A ResizeObserver whose callback the test fires itself. */
let observers;
class FakeResizeObserver {
  constructor(cb) {
    this.cb = cb;
    this.observed = [];
    observers.push(this);
  }
  observe(el) {
    this.observed.push(el);
    this.cb([{ target: el }], this); // the real one fires once on observe
  }
  disconnect() {
    this.disconnected = true;
  }
}

/** A canvas whose CSS box the test controls, since jsdom lays nothing out. */
function makeCanvas({ offsetWidth, offsetHeight }) {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'offsetWidth', { get: () => offsetWidth, configurable: true });
  Object.defineProperty(canvas, 'offsetHeight', { get: () => offsetHeight, configurable: true });
  return canvas;
}

function resizeTo(canvas, width, height) {
  Object.defineProperty(canvas, 'offsetWidth', { get: () => width, configurable: true });
  Object.defineProperty(canvas, 'offsetHeight', { get: () => height, configurable: true });
  observers.forEach((o) => o.cb([{ target: canvas }], o));
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the intro star field', () => {
  it('leaves the backing store alone while the element has no height yet', () => {
    const canvas = makeCanvas({ offsetWidth: 1280, offsetHeight: 0 });
    renderHook(() => useStarfield({ current: canvas }, true));

    // The defect was writing 1280 × 2 by 0 × 2 here and never revisiting it.
    expect(canvas.height).not.toBe(0);
    expect(canvas.width).toBe(300); // untouched jsdom default
    expect(canvas.height).toBe(150);
  });

  it('sizes to device pixels once layout gives the element a height', () => {
    const canvas = makeCanvas({ offsetWidth: 1280, offsetHeight: 0 });
    renderHook(() => useStarfield({ current: canvas }, true));

    resizeTo(canvas, 1280, 510);

    expect(canvas.width).toBe(2560);
    expect(canvas.height).toBe(1020);
  });

  it('follows a later layout change, not just a window resize', () => {
    const canvas = makeCanvas({ offsetWidth: 1280, offsetHeight: 510 });
    renderHook(() => useStarfield({ current: canvas }, true));
    expect(canvas.height).toBe(1020);

    resizeTo(canvas, 900, 400); // pane dragged narrower — no window resize event

    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(800);
  });

  it('watches the canvas it was given', () => {
    const canvas = makeCanvas({ offsetWidth: 1280, offsetHeight: 510 });
    renderHook(() => useStarfield({ current: canvas }, true));

    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([canvas]);
  });

  it('stops observing and animating when the intro goes away', () => {
    const canvas = makeCanvas({ offsetWidth: 1280, offsetHeight: 510 });
    const { unmount } = renderHook(() => useStarfield({ current: canvas }, true));

    unmount();

    expect(observers[0].disconnected).toBe(true);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('does nothing at all once the run has started', () => {
    const canvas = makeCanvas({ offsetWidth: 1280, offsetHeight: 510 });
    renderHook(() => useStarfield({ current: canvas }, false));

    expect(observers).toHaveLength(0);
    expect(canvas.height).toBe(150);
  });
});
