import { Fragment } from 'react';

/**
 * The two names above every sign-in screen.
 *
 * Oxford International School's crest arrived on 28 Aug 2026 and lives in
 * public/brand/. UZ COSMOS still uses the site's own mark; when its own logo
 * file comes, put it beside the crest and set `src` below. A partner with no
 * `src` gets a monogram, so nothing else on the screens changes either way.
 */
export const PARTNERS = [
  { id: 'uzcosmos', name: 'UZ COSMOS', src: '/astra-logo.png' },
  { id: 'oxford', name: 'Oxford International School', src: '/brand/oxford.svg' },
];

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();

function Monogram({ name }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[11px] font-[900] tracking-wider"
      style={{
        color: 'var(--auth-warm-light, #e3b45c)',
        border: '1px solid var(--auth-warm, #c08a2e)',
        background: 'var(--auth-glow-warm, rgba(192,138,46,0.14))',
      }}
    >
      {initials(name)}
    </span>
  );
}

export default function PartnerLogos({ className = '' }) {
  return (
    <div
      role="group"
      aria-label={PARTNERS.map((p) => p.name).join(' and ')}
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-3 ${className}`}
    >
      {PARTNERS.map((partner, i) => (
        <Fragment key={partner.id}>
          {i > 0 && (
            <span
              aria-hidden="true"
              className="hidden sm:block h-8 w-px"
              style={{ background: 'linear-gradient(180deg, transparent, var(--auth-warm, #c08a2e), transparent)' }}
            />
          )}
          <span className="inline-flex items-center gap-2.5">
            {partner.src
              ? <img src={partner.src} alt={partner.name} className="h-10 w-10 rounded-lg object-contain" />
              : <Monogram name={partner.name} />}
            <span
              className="text-[11px] font-[800] uppercase tracking-[0.18em] whitespace-nowrap"
              style={{ color: 'var(--auth-text, rgba(255,255,255,0.9))' }}
            >
              {partner.name}
            </span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}
