import { Link } from 'react-router-dom';
import { MailWarning } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * "Confirm your address to write here."
 *
 * Rendered where it is relevant — above the chat composer — and not site-wide.
 * A strip that follows a child through lessons and games, nagging about
 * something none of those need, is the kind of thing people learn to stop
 * seeing, and then it is not there when it matters.
 */
export default function EmailVerificationBanner({ className = '' }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { t } = useTranslation();

  if (!isAuthenticated || !user || user.email_verified) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 ${className}`}
    >
      <MailWarning className="w-4 h-4 text-amber-300 shrink-0" />
      <p className="text-amber-100/80 text-xs font-[600] flex-1 min-w-[12rem]">
        {t('verifyEmail', 'bannerText')}
      </p>
      <Link
        to="/verify-email"
        className="text-[10px] font-[800] uppercase tracking-[0.2em] text-amber-200 hover:text-white transition-colors"
      >
        {t('verifyEmail', 'bannerAction')}
      </Link>
    </div>
  );
}
