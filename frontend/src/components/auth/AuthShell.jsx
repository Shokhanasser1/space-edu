import { motion, useReducedMotion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import PartnerLogos from '@/components/brand/PartnerLogos';

const EASE = [0.16, 1, 0.3, 1];

/**
 * The frame every sign-in screen sits in: the warm graphite ground
 * (`.auth-theme` in index.css), the two partner names, a heading, one card,
 * one line of footer. The screens themselves only supply the form.
 */
export default function AuthShell({ title, highlight, subtitle, footer, width = 440, children }) {
  const reduce = useReducedMotion();
  const rise = (delay = 0) => (reduce
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE } });

  return (
    <div className="auth-theme relative min-h-screen flex items-center justify-center px-4 py-14 overflow-hidden">
      <div className="w-full relative z-10" style={{ maxWidth: width }}>
        <motion.div {...rise(0)}>
          <PartnerLogos className="mb-8" />
        </motion.div>

        <motion.div {...rise(0.08)} className="text-center mb-8">
          <h1 className="text-[34px] sm:text-[40px] font-[900] tracking-tight leading-[1.1]">
            {title}
            {highlight ? <> <span style={{ color: 'var(--auth-accent-light)' }}>{highlight}</span></> : null}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[15px] font-[500]" style={{ color: 'var(--auth-text-muted)' }}>{subtitle}</p>
          )}
        </motion.div>

        <motion.div {...rise(0.16)} className="auth-card p-7 sm:p-9">
          {children}
        </motion.div>

        {footer && (
          <motion.div
            {...rise(0.24)}
            className="mt-10 flex items-center justify-center gap-2 uppercase text-[10px] font-[800] tracking-[0.32em]"
            style={{ color: 'var(--auth-text-faint)' }}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> {footer}
          </motion.div>
        )}
      </div>
    </div>
  );
}
