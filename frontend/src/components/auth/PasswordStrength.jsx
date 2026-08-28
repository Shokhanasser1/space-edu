import { useTranslation } from '@/hooks/useTranslation';
import { scorePassword } from '@/lib/authValidation';

const COLORS = ['transparent', '#f87171', '#fbbf24', '#a78bfa', '#4ade80'];

/** Four segments under the password box; fills as the password improves. */
export default function PasswordStrength({ value }) {
  const { t } = useTranslation();
  const score = scorePassword(value);

  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= score ? COLORS[score] : 'var(--auth-border)' }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-[600]" style={{ color: 'var(--auth-text-faint)' }}>
        <span>{t('registerPage', 'strengthLabel')}</span>
        {score > 0 && <span style={{ color: COLORS[score] }}>{t('registerPage', `strength${score}`)}</span>}
      </div>
    </div>
  );
}
