import { useRef, useState } from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';

import { LAB_CSS } from './ui';

/**
 * The frame every lesson simulator sits in - the card of the chosen design
 * (variant A): an icon, a small eyebrow line and the lesson title, a row of
 * tabs when the lesson has more than one idea to try, the active
 * simulator, and a short glossary of the lesson's terms at the foot.
 *
 *   <SimCard
 *     eyebrow="Virtual laboratoriya · Kinematika"
 *     title="To'g'ri chiziqli tekis harakat"
 *     tabsLabel="Tajribalar"
 *     tabs={[{ id: 'move', label: 'Tekis harakat', sub: 'x = x₀ + vt', icon: Car, render: () => <MoveSim /> }]}
 *     facts={{ title: 'Eslab qoling', items: [{ term: 'Tezlik', text: '...' }] }}
 *   />
 *
 * A single tab hides the tab row. Arrow keys move between tabs.
 */
export default function SimCard({ eyebrow, title, tabsLabel, tabs, facts, icon: Icon = FlaskConical, idPrefix = 'sim' }) {
  const [tab, setTab] = useState(tabs[0]?.id);
  const tabRefs = useRef({});
  const current = tabs.find((x) => x.id === tab) ?? tabs[0];

  const onTabKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const cols = tabs.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <section
      className="glass rounded-3xl p-3 sm:p-5 lg:p-6 text-gray-100 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
      aria-labelledby={`${idPrefix}-title`}
    >
      <style>{LAB_CSS}</style>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 border border-white/10">
            <Icon size={22} className="text-cyan-300" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-300/90">{eyebrow}</p>
            <h2 id={`${idPrefix}-title`} className="text-lg sm:text-xl font-bold leading-tight">
              {title}
            </h2>
          </div>
        </div>

        {tabs.length > 1 && (
          <div role="tablist" aria-label={tabsLabel} className={`grid ${cols} gap-1 rounded-2xl border border-white/10 bg-black/30 p-1`}>
            {tabs.map((tb, i) => {
              const TabIcon = tb.icon;
              const on = current.id === tb.id;
              return (
                <button
                  key={tb.id}
                  ref={(el) => {
                    tabRefs.current[tb.id] = el;
                  }}
                  role="tab"
                  id={`${idPrefix}-tab-${tb.id}`}
                  aria-selected={on}
                  aria-controls={`${idPrefix}-panel-${tb.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTab(tb.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-center transition-colors sm:flex-row sm:gap-2 sm:px-3.5 sm:text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                    on ? 'bg-white/[0.12] text-white shadow-inner' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.05]'
                  }`}
                >
                  {TabIcon && <TabIcon size={17} className={on ? 'text-cyan-300' : ''} aria-hidden="true" />}
                  <span className="leading-tight">
                    <span className="block text-xs sm:text-sm font-semibold">{tb.label}</span>
                    {tb.sub && <span className="hidden sm:block text-[11px] text-gray-500">{tb.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div
        className="mt-4 sm:mt-5"
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        id={`${idPrefix}-panel-${current.id}`}
        aria-labelledby={tabs.length > 1 ? `${idPrefix}-tab-${current.id}` : undefined}
      >
        {current.render()}
      </div>

      {facts?.items?.length > 0 && (
        <footer className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
            <BookOpen size={14} aria-hidden="true" /> {facts.title}
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {facts.items.map((f) => (
              <div key={f.term} className="text-sm leading-snug">
                <dt className="inline font-semibold text-white">{f.term}</dt> <dd className="inline text-gray-400">— {f.text}</dd>
              </div>
            ))}
          </dl>
        </footer>
      )}
    </section>
  );
}
