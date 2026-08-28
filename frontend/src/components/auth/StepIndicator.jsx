import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from '@/hooks/useTranslation';

/** "Step 1 of 2 · About you" and a bar per step that fills as you go. */
export default function StepIndicator({ step, total, labels }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <div className="mb-7">
      <div
        className="flex items-center justify-between text-[11px] font-[700] uppercase tracking-[0.14em]"
        style={{ color: 'var(--auth-text-muted)' }}
      >
        <span>{t('registerPage', 'stepOf').replace('{{n}}', step).replace('{{total}}', total)}</span>
        <span style={{ color: 'var(--auth-text)' }}>{labels[step - 1]}</span>
      </div>
      <div className="mt-2.5 flex gap-2" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--auth-border)' }}>
            <motion.span
              className="block h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--auth-accent), var(--auth-warm-light))' }}
              initial={false}
              animate={{ width: i < step ? '100%' : '0%' }}
              transition={{ duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
