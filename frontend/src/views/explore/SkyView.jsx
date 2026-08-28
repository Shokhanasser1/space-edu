import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, Sparkles, Waypoints, X } from 'lucide-react';

import { constellationName } from '@/data/constellationNames';
import { figures as catalogueFigures, stars as catalogueStars } from '@/data/skyCatalog';
import { useTranslation } from '@/hooks/useTranslation';
import { compassKey, localSiderealTimeDeg } from '@/lib/skyPosition';
import { drawSky, skyPositionsFor, starAt } from './skyRenderer';

/**
 * The sky over one place at one moment, drawn on a canvas you can drag.
 *
 * The view is a direction to look in (`centreAltitudeDeg`, `centreAzimuthDeg`)
 * and how much sky to fit on screen (`fieldOfViewDeg`). Dragging turns your
 * head; the wheel or a pinch changes how much you can see at once. That is the
 * whole model, and it is the one a child already has from being outside.
 *
 * Everything astronomical happens elsewhere — this component owns pixels,
 * pointers and React state, and nothing else.
 */

const MIN_FOV = 12;
const MAX_FOV = 180;
const DEFAULT_VIEW = { centreAltitudeDeg: 35, centreAzimuthDeg: 180, fieldOfViewDeg: 110 };

/** How dark it is where the child is standing, as a limiting magnitude. */
export const SKY_BRIGHTNESS = [
  { id: 'city', limitingMagnitude: 3.6 },
  { id: 'town', limitingMagnitude: 4.5 },
  { id: 'dark', limitingMagnitude: 5.3 },
];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export default function SkyView({
  latitude,
  longitude,
  when,
  selectedHr = null,
  onSelectStar,
}) {
  const { t, language } = useTranslation();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  const [view, setView] = useState(DEFAULT_VIEW);
  const [viewport, setViewport] = useState({ width: 800, height: 520 });
  const [showFigures, setShowFigures] = useState(true);
  const [brightness, setBrightness] = useState('town');
  const [inspected, setInspected] = useState(null);

  const limitingMagnitude =
    SKY_BRIGHTNESS.find((b) => b.id === brightness)?.limitingMagnitude ?? 4.5;

  /**
   * Positions only change when the clock or the place does. Recomputing 2319
   * of them on every drag frame is work nobody sees.
   */
  const positioned = useMemo(() => {
    const lst = localSiderealTimeDeg(when, longitude);
    return skyPositionsFor(catalogueStars, latitude, lst);
  }, [latitude, longitude, when]);

  const positionedByHr = useMemo(
    () => new Map(positioned.map((s) => [s.hr, s])),
    [positioned],
  );

  const figures = useMemo(
    () => catalogueFigures.map((figure) => ({
      abbreviation: figure.abbreviation,
      links: figure.links
        .map(([a, b]) => [positionedByHr.get(a.hr), positionedByHr.get(b.hr)])
        .filter(([a, b]) => a && b),
    })),
    [positionedByHr],
  );

  /**
   * A star's name in the reader's language. The catalogue holds the IAU name,
   * which is English-alphabet Latin; `skyView.starNames.*` carries the ones
   * that are written differently in Uzbek or Russian, and a star with no entry
   * keeps its IAU name rather than being left blank.
   */
  const labelFor = useCallback((star) => {
    if (!star.name) return null;
    const key = star.name.toLowerCase().replace(/\s+/g, '');
    const translated = t('skyView', `starNames.${key}`);
    return translated.startsWith('skyView.') ? star.name : translated;
  }, [t]);

  /**
   * Picking a star in the dropdown should point the sky at it, which is the
   * whole "find" in star finder. Keyed on the number rather than the object so
   * dragging away and coming back does not snap the view out from under the
   * child's finger.
   */
  useEffect(() => {
    if (selectedHr === null) return;
    const target = positionedByHr.get(selectedHr);
    if (!target || target.altitudeDeg < 0) return;
    setView((current) => ({
      ...current,
      centreAltitudeDeg: clamp(target.altitudeDeg, -20, 89),
      centreAzimuthDeg: target.azimuthDeg,
      fieldOfViewDeg: Math.min(current.fieldOfViewDeg, 70),
    }));
    // positionedByHr changes with the clock; re-centring on every tick would
    // fight the child for control of the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHr]);

  // Keep the canvas the size of its box, in real device pixels.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Paint.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // jsdom, and any browser that has run out of contexts, hands back null.
    // A sky that does not draw is better than a view that throws.
    if (!ctx) return;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = viewport.width * ratio;
    canvas.height = viewport.height * ratio;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    drawSky(ctx, {
      viewport,
      view,
      stars: positioned,
      figures,
      limitingMagnitude,
      showFigures,
      labelFor,
      highlightHr: selectedHr,
      cardinals: {
        n: t('skyView', 'compass.n'),
        e: t('skyView', 'compass.e'),
        s: t('skyView', 'compass.s'),
        w: t('skyView', 'compass.w'),
      },
    });
  }, [
    viewport, view, positioned, figures, limitingMagnitude, showFigures,
    labelFor, selectedHr, t, language,
  ]);

  const turn = useCallback((deltaX, deltaY) => {
    setView((current) => {
      // One screen width is one field of view, so dragging moves the sky by
      // as much as it looks like it should.
      const perPixel = current.fieldOfViewDeg / Math.max(1, viewport.width);
      const altitude = clamp(current.centreAltitudeDeg + deltaY * perPixel, -20, 89);
      const azimuth = (((current.centreAzimuthDeg - deltaX * perPixel) % 360) + 360) % 360;
      return { ...current, centreAltitudeDeg: altitude, centreAzimuthDeg: azimuth };
    });
  }, [viewport.width]);

  const zoomBy = useCallback((factor) => {
    setView((current) => ({
      ...current,
      fieldOfViewDeg: clamp(current.fieldOfViewDeg * factor, MIN_FOV, MAX_FOV),
    }));
  }, []);

  const pointFor = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      movedBy: 0,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.movedBy += Math.abs(deltaX) + Math.abs(deltaY);
    turn(deltaX, deltaY);
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.id !== event.pointerId) return;
    // Under a few pixels of travel it was a tap, not a drag. A finger never
    // holds perfectly still, so zero would mean nothing is ever tappable.
    if (drag.movedBy > 6) return;
    const { x, y } = pointFor(event);
    const hit = starAt(x, y, positioned, view, viewport);
    // Every star can be inspected; only the 25 with a written story mean
    // anything to the page around this one, so it hears about all of them and
    // decides for itself.
    setInspected(hit ?? null);
    if (hit) onSelectStar?.(hit);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? 1.12 : 1 / 1.12);
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 2) return;
    const [a, b] = event.touches;
    const spread = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinchRef.current) zoomBy(pinchRef.current / spread);
    pinchRef.current = spread;
  };

  const handleTouchEnd = () => { pinchRef.current = null; };

  /** Arrow keys and +/- so the view is reachable without a mouse. */
  const handleKeyDown = (event) => {
    const step = view.fieldOfViewDeg / 8;
    const moves = {
      ArrowLeft: () => turn(step * 4, 0),
      ArrowRight: () => turn(-step * 4, 0),
      ArrowUp: () => turn(0, step * 4),
      ArrowDown: () => turn(0, -step * 4),
      '+': () => zoomBy(1 / 1.2),
      '=': () => zoomBy(1 / 1.2),
      '-': () => zoomBy(1.2),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  const controlButton =
    'px-3 py-2 rounded-xl border border-white/10 bg-black/40 text-gray-300 ' +
    'hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 text-sm';

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapRef}
        className="relative w-full rounded-3xl overflow-hidden border border-white/10 bg-black"
        style={{ height: 'min(70vh, 560px)' }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t('skyView', 'canvasLabel')}
          tabIndex={0}
          className="w-full h-full touch-none cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-neon-purple/60"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={handleKeyDown}
        />
        <p className="absolute bottom-3 left-4 right-4 text-[11px] text-gray-500 pointer-events-none">
          {t('skyView', 'dragHint')}
        </p>

        {inspected && (
          <div className="absolute top-3 right-3 w-64 max-w-[calc(100%-1.5rem)] rounded-2xl border border-neon-purple/30 bg-[#0c0518]/95 backdrop-blur-md p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setInspected(null)}
              aria-label={t('skyView', 'close')}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-white font-bold text-lg pr-6 leading-tight">
              {labelFor(inspected) ?? t('skyView', 'unnamedStar')}
            </h4>
            {inspected.greek && (
              <p className="text-neon-purple text-sm">
                {inspected.greek} {constellationName(inspected.constellation, t)}
              </p>
            )}

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">{t('skyView', 'inConstellation')}</dt>
                <dd className="text-gray-200 text-right">
                  {constellationName(inspected.constellation, t)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">{t('skyView', 'magnitude')}</dt>
                <dd className="text-gray-200">{inspected.vmag.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">{t('skyView', 'distance')}</dt>
                {/* No number where the parallax could not carry one. The
                    catalogue refuses to guess and so does this. */}
                <dd className="text-gray-200 text-right">
                  {inspected.distanceLy === null
                    ? <span className="text-gray-500 text-xs">{t('skyView', 'distanceUnknown')}</span>
                    : `${inspected.distanceLy} ${t('skyView', 'lightYears')}`}
                </dd>
              </div>
              {inspected.spectralType && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">{t('skyView', 'spectralType')}</dt>
                  <dd className="text-gray-200">{inspected.spectralType}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">{t('skyView', 'altitude')}</dt>
                <dd className="text-gray-200">{Math.round(inspected.altitudeDeg)}°</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">{t('skyView', 'direction')}</dt>
                <dd className="text-gray-200">
                  {t('skyView', `compass.${compassKey(inspected.azimuthDeg)}`)}
                  {' '}{Math.round(inspected.azimuthDeg)}°
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFigures((on) => !on)}
          className={`${controlButton} ${showFigures ? 'text-neon-purple border-neon-purple/40' : ''}`}
          aria-pressed={showFigures}
        >
          <Waypoints className="w-4 h-4" /> {t('skyView', 'figures')}
        </button>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
          <Sparkles className="w-4 h-4 text-gray-500 ml-2 mr-1" />
          {SKY_BRIGHTNESS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setBrightness(option.id)}
              aria-pressed={brightness === option.id}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                brightness === option.id
                  ? 'bg-neon-purple text-black font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('skyView', `brightness.${option.id}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={() => zoomBy(1.25)} className={controlButton} aria-label={t('skyView', 'zoomOut')}>
            <Minus className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.25)} className={controlButton} aria-label={t('skyView', 'zoomIn')}>
            <Plus className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setView(DEFAULT_VIEW)} className={controlButton}>
            <RotateCcw className="w-4 h-4" /> {t('skyView', 'reset')}
          </button>
        </div>
      </div>
    </div>
  );
}
