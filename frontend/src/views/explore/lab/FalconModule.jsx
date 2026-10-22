import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Rocket, Satellite, XCircle } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import { LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions } from './LabKit';

/**
 * Falcon 9: the prebuilt 3D viewer, with a column that explains what the
 * reader is looking at.
 *
 * The viewer is a separate application served from `public/falcon9-simulator/`
 * and shown in an iframe; it is not edited here. On its own it was a rocket
 * floating in a black frame under a sidebar entry that called it a "live
 * satellite tracker" — which is what the Live page is, not this. The sidebar
 * now names it for what it is, and the column beside it gives a reader of any
 * age something to read and to do:
 *
 * - the vehicle's headline numbers, from SpaceX's own published figures;
 * - how a first stage comes back and lands, in plain words, with the rocket
 *   equation for the reader who wants to know why landing costs payload;
 * - a three-question quiz whose answers are the missions;
 * - a way to the real thing: the Live page tracks satellites in orbit now.
 *
 * It is 2.9 MB of assets, and the strongest candidate in the lab for removal
 * or replacement; that decision is still a deliberate one to take, not a side
 * effect of tidying.
 */

/**
 * SpaceX's published figures for Falcon 9 (spacex.com/vehicles/falcon-9):
 * 70 m tall, 3.7 m across, 549 054 kg at lift-off, nine Merlin engines on the
 * first stage and one Merlin Vacuum on the second.
 */
const SPECS = [
  { valueKey: 'falconSpecHeightValue', labelKey: 'falconSpecHeight' },
  { valueKey: 'falconSpecDiameterValue', labelKey: 'falconSpecDiameter' },
  { valueKey: 'falconSpecMassValue', labelKey: 'falconSpecMass' },
  { valueKey: 'falconSpecEnginesValue', labelKey: 'falconSpecEngines' },
];

/** Three questions; the correct option is not always in the same place. */
export const QUIZ = [
  { id: 'reuse', questionKey: 'falconQ1', options: ['falconQ1a', 'falconQ1b', 'falconQ1c'], answer: 'falconQ1a' },
  { id: 'name', questionKey: 'falconQ2', options: ['falconQ2a', 'falconQ2b', 'falconQ2c'], answer: 'falconQ2b' },
  { id: 'landing', questionKey: 'falconQ3', options: ['falconQ3a', 'falconQ3b', 'falconQ3c'], answer: 'falconQ3c' },
];

const LIVE_MISSION = 'lab_falcon_live';

export function FalconTrackerLab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const completeLabMission = useGamificationStore((s) => s.completeLabMission);
  const [picked, setPicked] = useState({});

  const missions = [
    ...QUIZ.map((q) => ({
      id: `quiz_${q.id}`,
      title: t('lab', `falconMissionQuiz_${q.id}`),
      done: picked[q.id] === q.answer,
    })),
    // Done by the click that leaves this page; the store remembers it.
    { id: 'live', title: t('lab', 'falconMissionLive'), done: false },
  ];

  const facts = [1, 2, 3, 4, 5, 6].map((n) => ({
    text: t('lab', `falconFact${n}`),
    source: t('lab', `falconFact${n}Source`),
  }));

  const openLive = () => {
    completeLabMission(LIVE_MISSION);
    navigate('/live');
  };

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Rocket className="text-cyan-400" /> {t('lab', 'falconTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'falconSubtitle')}</p>
          </div>

          <dl className="grid grid-cols-2 gap-2">
            {SPECS.map((spec) => (
              <div key={spec.labelKey} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <dd className="text-lg font-bold text-white">{t('lab', spec.valueKey)}</dd>
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', spec.labelKey)}</dt>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed text-gray-400">{t('lab', 'falconScale')}</p>

          <button
            onClick={openLive}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-600 to-blue-600 shadow-[0_0_22px_rgba(8,145,178,0.4)] hover:brightness-110"
          >
            <Satellite className="w-4 h-4" /> {t('lab', 'falconOpenLive')}
          </button>

          <section className="space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t('lab', 'falconQuizTitle')}</h4>
            {QUIZ.map((q) => {
              const choice = picked[q.id];
              return (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm text-white">{t('lab', q.questionKey)}</p>
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((option) => {
                      const chosen = choice === option;
                      const right = option === q.answer;
                      return (
                        <button
                          key={option}
                          onClick={() => setPicked((p) => ({ ...p, [q.id]: option }))}
                          aria-pressed={chosen}
                          className={`text-left px-3 py-2 min-h-[40px] md:min-h-[32px] rounded-lg text-xs border transition-colors ${
                            chosen
                              ? right
                                ? 'bg-green-500/15 border-green-400/60 text-green-100'
                                : 'bg-amber-500/15 border-amber-400/60 text-amber-100'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          {t('lab', option)}
                        </button>
                      );
                    })}
                  </div>
                  {choice ? (
                    <p
                      role="status"
                      className={`flex items-start gap-1.5 text-xs leading-relaxed ${
                        choice === q.answer ? 'text-green-300' : 'text-amber-200'
                      }`}
                    >
                      {choice === q.answer ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      )}
                      {t('lab', choice === q.answer ? `${q.questionKey}Right` : `${q.questionKey}Wrong`)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>

          <LabMissions prefix="lab_falcon_" missions={missions} />

          <LabExplain
            simple={t('lab', 'falconExplainSimple')}
            formula={[t('lab', 'falconFormula'), t('lab', 'falconFormulaConstants')]}
            details={t('lab', 'falconExplainDetails')}
          />

          <LabFacts facts={facts} />

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'falconViewerNote')}</p>
        </div>
      </div>

      <LabViewport hint={null}>
        <iframe
          src="/falcon9-simulator/index.html"
          className="absolute inset-0 w-full h-full border-0"
          allow="camera; microphone; fullscreen"
          title={t('lab', 'falconTitle')}
        />
      </LabViewport>
    </div>
  );
}
