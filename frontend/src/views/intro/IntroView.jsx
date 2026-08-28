import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import PartnerLogos from '@/components/brand/PartnerLogos';
import IntroPoster from './IntroPoster';
import { canRender3D } from './capabilities';
import { markIntroSeen } from './introSeen';

// three.js and the scene arrive in their own chunk, after the buttons.
const IntroScene = lazy(() => import('./IntroScene'));

const EASE = [0.16, 1, 0.3, 1];

/** A scene that throws becomes the still, not a crash page. */
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The first screen a new visitor sees: the two partners, a title, Start and
 * Skip, over a slow flight past the Earth. Start leads to registration,
 * Skip to the site; both remember that the intro has been seen.
 *
 * The heading and both buttons render immediately, before any of the 3D
 * code has arrived, and the still is the first frame — nobody waits for a
 * canvas to be allowed in.
 */
export default function IntroView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [scene] = useState(() => canRender3D());
  const [sceneReady, setSceneReady] = useState(false);
  const startRef = useRef(null);

  const start = () => {
    markIntroSeen();
    navigate('/register');
  };
  const skip = () => {
    markIntroSeen();
    navigate('/');
  };

  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const onControl = e.target instanceof HTMLElement && e.target.closest('button, a, input');
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      } else if ((e.key === 'Enter' || e.key === ' ') && !onControl) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // start/skip only close over navigate, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rise = (delay) => (reduce
    ? {}
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } });

  return (
    <div className="auth-theme relative min-h-screen overflow-hidden text-white">
      {/* Sky: the still first, the scene fading in over it once it can draw. */}
      <IntroPoster />
      {scene && (
        <div
          className="absolute inset-0 transition-opacity duration-[1400ms] ease-out"
          style={{ opacity: sceneReady ? 1 : 0 }}
          aria-hidden="true"
        >
          <SceneBoundary>
            <Suspense fallback={null}>
              <IntroScene onReady={() => setSceneReady(true)} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
      {/* Legibility: the text sits over a darkened lower-left. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(8,6,12,0.82) 0%, rgba(8,6,12,0.55) 45%, rgba(8,6,12,0.05) 100%),'
            + 'linear-gradient(0deg, rgba(8,6,12,0.75) 0%, transparent 45%)',
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col px-6 sm:px-12 lg:px-20 py-8 sm:py-10">
        <motion.header {...rise(0)} className="flex justify-start">
          <PartnerLogos />
        </motion.header>

        <main className="flex-1 flex flex-col justify-center max-w-2xl py-12">
          <motion.p
            {...rise(0.1)}
            className="text-[11px] sm:text-xs font-[800] uppercase tracking-[0.3em] mb-6"
            style={{ color: 'var(--auth-warm-light)' }}
          >
            {t('intro', 'eyebrow')}
          </motion.p>
          <motion.h1
            {...rise(0.18)}
            className="text-[clamp(40px,7vw,84px)] font-[900] leading-[1.02] tracking-[-0.03em]"
          >
            {t('intro', 'title')}
            <br />
            <span style={{ color: 'var(--auth-accent-light)' }}>{t('intro', 'titleHighlight')}</span>
          </motion.h1>
          <motion.p
            {...rise(0.28)}
            className="mt-6 max-w-xl text-[15px] sm:text-lg leading-relaxed"
            style={{ color: 'var(--auth-text-muted)' }}
          >
            {t('intro', 'tagline')}
          </motion.p>

          <motion.div {...rise(0.38)} className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              ref={startRef}
              type="button"
              onClick={start}
              className="auth-btn-primary group sm:!w-auto sm:min-w-[220px] !text-[15px] !py-4 !px-10 !tracking-[0.08em]"
            >
              <span className="flex items-center justify-center gap-2.5">
                {t('intro', 'start')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button type="button" onClick={skip} className="auth-btn-ghost sm:!py-4">
              {t('intro', 'skip')}
            </button>
          </motion.div>

          <motion.p
            {...rise(0.5)}
            className="mt-5 hidden sm:block text-xs font-[600]"
            style={{ color: 'var(--auth-text-faint)' }}
          >
            {t('intro', 'hint')}
          </motion.p>
        </main>
      </div>
    </div>
  );
}
