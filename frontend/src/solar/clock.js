import { create } from 'zustand';

/**
 * Simulation time.
 *
 * The old view kept the date in React state and advanced it from a
 * requestAnimationFrame loop, so every frame re-rendered every planet, every
 * label and the control panel — one React commit per frame, sixty times a
 * second, which is what "the solar system freezes" turned out to mean.
 *
 * Now the clock is a plain object advanced inside the render loop
 * (`ClockDriver` in the scene) and read by `useFrame` callbacks with no React
 * in between. The store below is a mirror for the UI, refreshed ten times a
 * second, which is as fast as a date display needs to change.
 */

const DAY_MS = 86_400_000;

/** Ephemeris validity. astronomy-engine covers far more, but the dwarf planets
 *  and asteroids use osculating elements that drift outside a few centuries. */
export const MIN_MS = Date.UTC(1800, 0, 1);
export const MAX_MS = Date.UTC(2200, 11, 31, 23, 59, 59);

export const SPEEDS = [
  { key: 'live', daysPerSecond: 1 / 86400 },
  { key: 'hour', daysPerSecond: 1 / 24 },
  { key: 'day', daysPerSecond: 1 },
  { key: 'week', daysPerSecond: 7 },
  { key: 'month', daysPerSecond: 30 },
  { key: 'year', daysPerSecond: 365.25 },
];

export const simClock = {
  ms: Date.now(),
  daysPerSecond: SPEEDS[0].daysPerSecond,
  direction: 1,
  playing: true,
};

export function clampMs(ms) {
  return Math.min(MAX_MS, Math.max(MIN_MS, ms));
}

/**
 * Advance the clock by `dtSeconds` of wall time. Returns true when the clock
 * hit the edge of the ephemeris range (and stopped).
 */
export function advanceClock(dtSeconds) {
  if (!simClock.playing) return false;
  const next = simClock.ms + dtSeconds * simClock.daysPerSecond * DAY_MS * simClock.direction;
  const clamped = clampMs(next);
  simClock.ms = clamped;
  if (clamped !== next) {
    simClock.playing = false;
    return true;
  }
  return false;
}

export const useSolarStore = create((set, get) => ({
  epochMs: simClock.ms,
  playing: simClock.playing,
  speedKey: SPEEDS[0].key,
  direction: 1,
  atEdge: false,
  selectedId: null,
  scaleMode: 'visual',
  /** Bumped by the "overview" button; the camera rig flies home when it changes. */
  homeRequest: 0,
  satStatus: { state: 'idle', count: 0 },
  craftStatus: 'idle',
  layers: {
    orbits: true,
    labels: true,
    asteroids: true,
    stars: true,
    satellites: false,
    spacecraft: false,
  },
  /** Called by the scene at ~10 Hz. */
  tick: (ms, atEdge) => {
    const s = get();
    if (atEdge && !s.atEdge) set({ epochMs: ms, atEdge: true, playing: false });
    else if (ms !== s.epochMs) set({ epochMs: ms });
  },
  setPlaying: (playing) => {
    simClock.playing = playing;
    set({ playing, atEdge: false });
  },
  togglePlaying: () => get().setPlaying(!simClock.playing),
  setSpeed: (speedKey) => {
    const found = SPEEDS.find((s) => s.key === speedKey) ?? SPEEDS[0];
    simClock.daysPerSecond = found.daysPerSecond;
    set({ speedKey: found.key });
  },
  setDirection: (direction) => {
    simClock.direction = direction < 0 ? -1 : 1;
    set({ direction: simClock.direction, atEdge: false });
  },
  setDate: (ms) => {
    const clamped = clampMs(ms);
    simClock.ms = clamped;
    set({ epochMs: clamped, atEdge: false });
  },
  goLive: () => {
    simClock.ms = Date.now();
    simClock.daysPerSecond = SPEEDS[0].daysPerSecond;
    simClock.direction = 1;
    simClock.playing = true;
    set({ epochMs: simClock.ms, speedKey: 'live', direction: 1, playing: true, atEdge: false });
  },
  setSelected: (selectedId) => set({ selectedId }),
  requestHome: () => set({ selectedId: null, homeRequest: get().homeRequest + 1 }),
  setSatStatus: (satStatus) => set({ satStatus }),
  setCraftStatus: (craftStatus) => set({ craftStatus }),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  setLayer: (name, on) => set({ layers: { ...get().layers, [name]: on } }),
}));

/** Julian Date for a JS timestamp. */
export function msToJd(ms) {
  return ms / DAY_MS + 2440587.5;
}
