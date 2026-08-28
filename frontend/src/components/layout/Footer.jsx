import { Link } from 'react-router-dom';
import { Mail, Phone, Rocket, Send } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The bottom of the page: who we are, how to reach us, and the legal names.
 *
 * It used to be 187 lines and three columns of navigation — seventeen links,
 * every one of which is also in the top bar. That bar is `position: fixed`
 * (Navigation.jsx), so it is on screen at the moment you are reading this
 * footer; the second copy was not a second way to get anywhere, it was the
 * reason the footer took a screen and a half on a phone. Three of the
 * seventeen ("Learn", "Features", "Cosmos") were the same page, /learn, under
 * three names, and two more went to pages behind ProtectedRoute, so a
 * signed-out child clicking "Profile" landed on the sign-in form.
 *
 * What is left is what a footer is actually for, and what item 6 of the
 * requirements asked for: the contacts.
 *
 * On the contacts, and why they are blank
 * ---------------------------------------
 * Nobody has published a support address, a telephone number or a channel for
 * this project, and this file is not the place to guess one. A made-up contact
 * on a site used by 10-to-18-year-olds does not fail politely — it sends a
 * child or a parent nowhere, or to a real stranger who never agreed to answer.
 *
 * So `value: null` below means "we have not been given this", and it renders
 * as a translated "not published yet" rather than being hidden. Hiding it
 * would suggest there was nothing to know. This is the same rule, for the same
 * reason, that FeaturedSatellites.jsx follows for Samarkand-2028's missing
 * orbital elements.
 *
 * To fill one in: set `value` to what a reader should see and `href` to where
 * it goes (`mailto:`, `tel:`, or an https URL). Nothing else here changes.
 * Fill them in from something you can point at, not from memory.
 */
const CONTACTS = [
  { id: 'telegram', icon: Send, labelKey: 'telegram', value: null, href: null },
  { id: 'email', icon: Mail, labelKey: 'email', value: null, href: null },
  { id: 'phone', icon: Phone, labelKey: 'phone', value: null, href: null },
];

/**
 * One contact, or an honest note that we do not have it yet.
 *
 * An outside link gets target/rel; `mailto:` and `tel:` must not, or the
 * browser leaves a blank tab behind next to the mail client.
 */
function Contact({ icon: Icon, label, value, href, missingLabel }) {
  const outside = Boolean(href) && href.startsWith('http');

  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          {label}
        </div>
        {value && href ? (
          <a
            href={href}
            {...(outside ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            className="break-words text-sm text-white/75 transition-colors hover:text-violet-300"
          >
            {value}
          </a>
        ) : (
          <div data-contact-missing="" className="text-sm italic text-white/30">
            {missingLabel}
          </div>
        )}
      </div>
    </div>
  );
}

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const notPublished = t('footer', 'notPublishedYet');

  return (
    <footer className="relative overflow-hidden border-t border-violet-500/20 bg-[#030208] px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <div className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-30" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          {/* Who this is */}
          <div>
            <Link to="/" className="group mb-4 inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-transform group-hover:scale-110">
                <Rocket className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <span className="text-xl font-black tracking-tighter text-white">
                Space <span className="text-violet-400">Edu</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-white/50">
              {t('footer', 'description')}
            </p>
          </div>

          {/* How to reach us */}
          <div>
            <h2 className="mb-5 border-l-2 border-violet-500 pl-3 text-sm font-bold uppercase tracking-widest text-white">
              {t('footer', 'contact')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
              {CONTACTS.map((contact) => (
                <Contact
                  key={contact.id}
                  icon={contact.icon}
                  label={t('footer', contact.labelKey)}
                  value={contact.value}
                  href={contact.href}
                  missingLabel={notPublished}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/5 pt-6 text-[11px] font-bold uppercase tracking-wide text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} {t('footer', 'allRightsReserved')}</p>

          {/* Privacy Policy and Terms of Use are labels, not links, and have
              been since 38b428c: they were <Link to="#">, which React Router
              resolves relatively, so each one rendered an href back to the page
              you were already on. Neither page has been written. On a product
              that collects data from 10-to-18-year-olds a "Privacy Policy" that
              behaves like a working link and leads nowhere is worse than no
              link — it implies there is a policy there to read. Make each one a
              <Link to="/privacy"> as its page lands.
              Sitemap is a real link because public/sitemap.xml is a real file.
              "Contact Us" and "Accessibility" are gone: the first is what the
              contact block above is, and nobody is writing the second. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>{t('footer', 'privacyPolicy')}</span>
            <span>{t('footer', 'termsOfUse')}</span>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-violet-300"
            >
              {t('footer', 'sitemap')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
