import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Circle, Lightbulb, Sparkles, Target } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';

/**
 * The parts every Laboratory module shares, so thirteen modules read as one
 * product and a reader who has learned one knows where to look in the next.
 *
 * Each piece answers a different reader, and the lab is for both of them — a
 * ten-year-old who wants something to do and an adult who wants to know why:
 *
 * - `LabMissions` gives the first one goals. A mission is ticked the moment
 *   the module says it is done and stays ticked (the store remembers it), and
 *   each pays XP once through `completeLabMission`.
 * - `LabExplain` says the idea in plain words first — an analogy a child can
 *   hold — and keeps the formula behind a toggle for the reader who wants it.
 * - `LabFacts` is "did you know?", one fact at a time, each with its source on
 *   the page, because a number shown to a child is a claim we are making.
 * - `LabPresets` jumps to real objects: the ISS, a hot Jupiter, Meteor Crater.
 *
 * Text arrives already translated. The kit translates only its own labels, so
 * a module's strings stay under the module's own locale keys.
 *
 * Its buttons are at least 40 px tall below `md`: most readers are on phones,
 * and WCAG 2.2 advises 44 px for a target a thumb has to hit.
 */

/**
 * Goals for this module. `missions` is `[{ id, title, hint?, done }]`, where
 * `done` is the module's live judgement; `prefix` namespaces the ids in the
 * store (e.g. `lab_satellite_`).
 */
export function LabMissions({ missions, prefix }) {
  const { t } = useTranslation();
  const completeLabMission = useGamificationStore((s) => s.completeLabMission);
  const finished = useGamificationStore((s) => s.labMissions);

  // A mission reached once stays reached: "put it in geostationary orbit" is
  // still done after the reader drags the slider somewhere else.
  useEffect(() => {
    for (const mission of missions) {
      if (mission.done) completeLabMission(`${prefix}${mission.id}`);
    }
  }, [missions, prefix, completeLabMission]);

  const isDone = (mission) => mission.done || finished.includes(`${prefix}${mission.id}`);
  const count = missions.filter(isDone).length;
  const allDone = count === missions.length && missions.length > 0;

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.04] p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
          <Target className="w-3.5 h-3.5" /> {t('lab', 'kitMissions')}
        </h4>
        <span className="font-mono text-xs text-amber-200">
          {count} / {missions.length}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
          style={{ width: `${missions.length ? (count / missions.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="space-y-2">
        {missions.map((mission) => {
          const done = isDone(mission);
          return (
            <li key={mission.id} className="flex items-start gap-2 text-sm">
              {done ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-400" aria-hidden="true" />
              ) : (
                <Circle className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
              )}
              <span className={`flex-1 ${done ? 'text-gray-400 line-through decoration-green-400/40' : 'text-gray-200'}`}>
                {mission.title}
                {mission.hint && !done ? (
                  <span className="block text-xs text-gray-500 no-underline">{mission.hint}</span>
                ) : null}
              </span>
              {done ? (
                <span className="sr-only">{t('lab', 'kitMissionDone')}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {allDone ? <p className="mt-3 text-xs text-green-300">{t('lab', 'kitAllDone')}</p> : null}
    </section>
  );
}

/**
 * The idea behind the module. `simple` is the plain-words version everyone
 * sees; `formula` (a string or a list) and `details` sit behind a toggle.
 */
export function LabExplain({ simple, formula, details }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const formulas = (Array.isArray(formula) ? formula : [formula]).filter(Boolean);
  const hasMore = formulas.length > 0 || Boolean(details);

  return (
    <section className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-4">
      <h4 className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
        <BookOpen className="w-3.5 h-3.5" /> {t('lab', 'kitHowItWorks')}
      </h4>
      <p className="text-sm leading-relaxed text-gray-200">{simple}</p>
      {hasMore ? (
        <>
          <button
            onClick={() => setOpen((was) => !was)}
            aria-expanded={open}
            className="mt-2 flex items-center gap-1.5 min-h-[40px] md:min-h-[32px] text-xs text-violet-200 hover:text-white transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            {t('lab', open ? 'kitHideFormula' : 'kitShowFormula')}
          </button>
          {open ? (
            <div className="mt-3 space-y-2">
              {formulas.map((text) => (
                <p
                  key={text}
                  className="font-mono text-sm text-white bg-black/30 border border-white/10 rounded-lg px-3 py-2 overflow-x-auto"
                >
                  {text}
                </p>
              ))}
              {details ? <p className="text-xs leading-relaxed text-gray-400">{details}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** "Did you know?" — `facts` is `[{ text, source? }]`, shown one at a time. */
export function LabFacts({ facts }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  if (!facts.length) return null;
  const at = index % facts.length;
  const fact = facts[at];

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
          <Lightbulb className="w-3.5 h-3.5" /> {t('lab', 'kitDidYouKnow')}
        </h4>
        {facts.length > 1 ? (
          <button
            onClick={() => setIndex((i) => i + 1)}
            aria-label={t('lab', 'kitNextFact')}
            title={t('lab', 'kitNextFact')}
            className="flex items-center gap-1 min-h-[40px] md:min-h-[28px] rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-mono text-cyan-200 hover:bg-white/10"
          >
            {at + 1} / {facts.length} <ChevronRight className="w-3 h-3" />
          </button>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-gray-200">{fact.text}</p>
      {fact.source ? (
        <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
          {t('lab', 'kitSource')}: {fact.source}
        </p>
      ) : null}
    </section>
  );
}

/** Real objects to jump to. `presets` is `[{ id, label }]`. */
export function LabPresets({ presets, activeId, onPick, label }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-gray-400">
        <Sparkles className="w-3.5 h-3.5" /> {label ?? t('lab', 'kitPresets')}
      </p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onPick(preset.id)}
            aria-pressed={activeId === preset.id}
            className={`px-3 py-1.5 min-h-[40px] md:min-h-[32px] rounded-full text-xs border transition-colors ${
              activeId === preset.id
                ? 'bg-cyan-400/15 border-cyan-400/60 text-cyan-100'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
