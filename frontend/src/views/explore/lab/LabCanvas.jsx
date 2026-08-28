import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * The three things every Laboratory module was repeating, in one place.
 *
 * **The device-pixel-ratio cap.** None of the modules set `dpr`, so
 * react-three-fiber rendered at the display's own ratio — 3 on a modern phone,
 * which is nine times the pixels of a 1x screen, through a full-screen bloom
 * pass, on the device least able to afford it. Capping at 1.75 is invisible on
 * a phone and roughly triples the frame rate on one.
 *
 * **The viewer frame.** Five modules carried the same wrapper div and the same
 * "drag to rotate, scroll to zoom" caption, copied five times.
 *
 * **A boundary per module.** The whole of `/lab` used to go to
 * `RouteErrorBoundary` when any single module threw, so a broken planet took
 * the rocket, the satellite and the star with it. One module failing is now
 * one module failing.
 */

/** Cap the render resolution. `[min, max]`, as react-three-fiber wants it. */
export const LAB_DPR = [1, 1.75];

/** The framed viewer every module's canvas sits in. */
export function LabViewport({ hint, children }) {
  return (
    <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
      {children}
      {hint ? (
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Catches a throw from one module and keeps the rest of the Laboratory usable.
 *
 * A class component because that is the only thing React gives an error
 * boundary; `RouteErrorBoundary` is the same shape for the same reason.
 * `resetKey` changes when the reader picks a different module, which clears a
 * previous module's error rather than leaving the panel stuck on it.
 */
export class LabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  componentDidCatch(error, info) {
    // Handled, not swallowed: the reader gets the panel below, whoever is
    // looking at a console gets the stack.
    console.warn('A Laboratory module failed to render', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-8">
        <div className="flex max-w-sm items-start gap-3 text-left">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p className="text-sm leading-relaxed text-amber-100/75">{this.props.message}</p>
        </div>
      </div>
    );
  }
}
