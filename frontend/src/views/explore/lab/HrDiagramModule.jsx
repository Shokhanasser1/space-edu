import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartScatter, Check, HelpCircle, RotateCcw } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions } from './LabKit';
import {
  AXES,
  CLASS_MARKS,
  QUESTIONS,
  STARS,
  STAR_GROUPS,
  SUN_PATH,
  backgroundStars,
  fractionToLum,
  fractionToTemp,
  judgePlacement,
  lightBandKey,
  lumToFraction,
  mainSequenceLogL,
  peakWavelengthNm,
  starColour,
  starGroup,
  starRadiusPx,
  tempToFraction,
} from '@/lib/hrDiagram';

/**
 * The H-R diagram, built by the reader one star at a time.
 *
 * Every other version of this diagram a pupil meets is a finished picture:
 * the main sequence is already a band, the giants already a clump, and the
 * point — that stars sort themselves into groups once you plot two numbers
 * against each other — is given away before it can be noticed. Here the
 * diagram starts with only faint background stars. The reader picks a named
 * star, reads its temperature and luminosity off its card, and taps where it
 * goes; thirteen taps later the Sun, Sirius and Proxima are on the band,
 * Arcturus and Aldebaran in the giants, Rigel and Betelgeuse across the top,
 * and the two white dwarfs at the bottom left.
 *
 * Each card is also a small story — what the star is, how far it is, where it
 * is in Uzbekistan's sky — because a ten-year-old remembers "the red shoulder
 * of Orion, bigger than Mars's orbit" long after "3600 K". The card says what
 * colour of light the star shines brightest in, which is the temperature read
 * the other way round, and three quick questions send the reader back to the
 * cards to compare them.
 *
 * Reading a backwards, logarithmic axis is the skill being taught, so a wrong
 * tap is answered with which way to move ("hotter — further left") rather
 * than with the answer. Tap-to-place rather than drag, because a drag on a
 * phone scrolls the page; arrow keys and Enter do the same for a keyboard.
 *
 * SVG, no WebGL: it is a chart. Figures and sources are in `lib/hrDiagram.js`.
 */

const VIEW_W = 800;
const VIEW_H = 760;
const PLOT = { x0: 104, x1: 772, y0: 30, y1: 612 };
const fxToX = (fx) => PLOT.x0 + fx * (PLOT.x1 - PLOT.x0);
const fyToY = (fy) => PLOT.y0 + fy * (PLOT.y1 - PLOT.y0);
const tToX = (teffK) => fxToX(Math.max(0, tempToFraction(teffK)));
const lToY = (lum) => fyToY(lumToFraction(lum));

const TEMP_TICKS = [40000, 20000, 10000, 5000, 2500];
const LUM_EXPONENTS = [6, 4, 2, 0, -2, -4];
const FACT_COUNT = 6;

/** 5772 -> "5 772". */
const grouped = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** A luminosity or radius at the precision the catalogue was rounded to. */
function formatQuantity(value) {
  if (value >= 100) return grouped(value);
  if (value >= 10) return value.toFixed(0);
  if (value >= 1) return String(Number(value.toFixed(2)));
  return String(Number(value.toPrecision(2)));
}

/** Light-years at the precision the catalogue quotes them. */
const formatDistance = (ly) => (ly >= 100 ? grouped(ly) : String(Number(ly.toFixed(2))));

export function HrDiagramLab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState(STARS[0].id);
  const [placed, setPlaced] = useState({});
  const [attempt, setAttempt] = useState(null);
  const [lastPlaced, setLastPlaced] = useState(null);
  const [showPath, setShowPath] = useState(false);
  const [pathSeen, setPathSeen] = useState(false);
  const [cursor, setCursor] = useState({ fx: 0.5, fy: 0.5 });
  const [focused, setFocused] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answered, setAnswered] = useState({});
  const svgRef = useRef(null);

  const background = useMemo(() => backgroundStars(), []);
  const selected = STARS.find((s) => s.id === selectedId) ?? null;
  const placedCount = Object.keys(placed).length;
  const groupsPlaced = new Set(STARS.filter((s) => placed[s.id]).map(starGroup));
  const question = QUESTIONS[questionIndex % QUESTIONS.length];

  const place = (fx, fy) => {
    if (!selected || placed[selected.id]) return;
    const verdict = judgePlacement(selected, fractionToTemp(fx), fractionToLum(fy));
    setAttempt({ fx, fy, starId: selected.id, ...verdict });
    if (!verdict.correct) return;
    const next = { ...placed, [selected.id]: true };
    setPlaced(next);
    setLastPlaced(selected.id);
    // Move straight on to the next star, so the reader is never left
    // wondering whether they have to pick one.
    const remaining = STARS.find((s) => !next[s.id]);
    setSelectedId(remaining ? remaining.id : null);
  };

  const onDiagramClick = (event) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!ctm) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const { x, y } = point.matrixTransform(ctm.inverse());
    const fx = (x - PLOT.x0) / (PLOT.x1 - PLOT.x0);
    const fy = (y - PLOT.y0) / (PLOT.y1 - PLOT.y0);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    setCursor({ fx, fy });
    place(fx, fy);
  };

  const onDiagramKey = (event) => {
    const step = event.shiftKey ? 0.05 : 0.015;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      setCursor((c) => ({ fx: Math.min(1, Math.max(0, c.fx + dx)), fy: Math.min(1, Math.max(0, c.fy + dy)) }));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      place(cursor.fx, cursor.fy);
    }
  };

  const reset = () => {
    setPlaced({});
    setAttempt(null);
    setLastPlaced(null);
    setSelectedId(STARS[0].id);
  };

  const togglePath = () => {
    setShowPath((v) => !v);
    setPathSeen(true);
  };

  const answer = (starId) => {
    setPicked(starId);
    if (starId === question.answer) setAnswered((a) => ({ ...a, [question.id]: true }));
  };

  const nextQuestion = () => {
    setQuestionIndex((i) => i + 1);
    setPicked(null);
  };

  const attemptStar = attempt ? STARS.find((s) => s.id === attempt.starId) : null;
  const feedback = attempt
    ? attempt.correct
      ? t('lab', 'hrCorrect', { name: t('lab', attemptStar.nameKey), type: t('lab', attemptStar.typeKey) })
      : [t('lab', 'hrWrong'), ...attempt.hints.map((key) => t('lab', key))].join(' ')
    : null;

  // The main-sequence label lies along the band, at the band's own slope.
  const msA = { x: tToX(10 ** 4.25), y: lToY(10 ** mainSequenceLogL(4.25)) };
  const msB = { x: tToX(10 ** 4.0), y: lToY(10 ** mainSequenceLogL(4.0)) };
  const msAngle = (Math.atan2(msB.y - msA.y, msB.x - msA.x) * 180) / Math.PI;
  const msLabel = { x: tToX(10 ** 4.13) - 14, y: lToY(10 ** (mainSequenceLogL(4.13) - 0.75)) };

  const sunPath = SUN_PATH.map((p) => `${tToX(p.teffK).toFixed(1)},${lToY(p.lum).toFixed(1)}`).join(' ');
  const sunMarks = SUN_PATH.filter((p) => p.mark);

  // Colour bar stops at the temperatures of the class letters.
  const barStops = [AXES.hotK, ...CLASS_MARKS.map((m) => m.teffK), AXES.coolK];

  const approx = selected?.approx ? '~' : '';
  const peakNm = selected ? peakWavelengthNm(selected.teffK) : 0;
  const readouts = selected
    ? [
        { label: t('lab', 'hrTemp'), value: t('lab', 'hrTempValue', { value: `${approx}${grouped(selected.teffK)}` }) },
        { label: t('lab', 'hrLum'), value: t('lab', 'hrLumValue', { value: `${approx}${formatQuantity(selected.lum)}` }) },
        { label: t('lab', 'hrRadius'), value: t('lab', 'hrRadiusValue', { value: `${approx}${formatQuantity(selected.radius)}` }) },
        { label: t('lab', 'hrClass'), value: selected.spectral },
        {
          label: t('lab', 'hrDistance'),
          value:
            selected.id === 'sun'
              ? t('lab', 'hrDistanceSun')
              : t('lab', 'hrDistanceValue', { value: `${approx}${formatDistance(selected.distanceLy)}` }),
        },
        {
          label: t('lab', 'hrPeak'),
          value: t('lab', 'hrPeakValue', { nm: Math.round(peakNm), band: t('lab', lightBandKey(peakNm)) }),
        },
      ]
    : [];

  const missions = [
    { id: 'path', title: t('lab', 'hrMissionPath'), done: pathSeen },
    {
      id: 'groups',
      title: t('lab', 'hrMissionGroups'),
      hint: t('lab', 'hrMissionGroupsHint', { n: groupsPlaced.size }),
      done: STAR_GROUPS.every((g) => groupsPlaced.has(g)),
    },
    { id: 'biggest', title: t('lab', 'hrMissionBiggest'), done: Boolean(answered.biggest) },
    { id: 'hottest', title: t('lab', 'hrMissionHottest'), done: Boolean(answered.hottest) },
    {
      id: 'all',
      title: t('lab', 'hrMissionAll'),
      hint: t('lab', 'hrMissionAllHint', { n: placedCount, total: STARS.length }),
      done: placedCount === STARS.length,
    },
  ];

  const facts = Array.from({ length: FACT_COUNT }, (_, i) => ({
    text: t('lab', `hrFact${i + 1}`),
    source: t('lab', `hrFactSrc${i + 1}`),
  }));

  const rightAnswer = picked && picked === question.answer;
  // A wrong pick is answered with that star's own number, so the reader sees
  // why it is not the one rather than only that it is not.
  const pickedStar = picked ? STARS.find((s) => s.id === picked) : null;
  const pickedValue = pickedStar
    ? `${pickedStar.approx ? '~' : ''}${
        question.measure === 'teffK'
          ? grouped(pickedStar.teffK)
          : question.measure === 'distanceLy'
            ? formatDistance(pickedStar.distanceLy)
            : formatQuantity(pickedStar.radius)
      }`
    : '';

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <ChartScatter className="text-pink-400" /> {t('lab', 'hrTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'hrSubtitle')}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('lab', 'hrCardsTitle')}</p>
            <div className="flex flex-wrap gap-2">
              {STARS.map((star) => {
                const done = Boolean(placed[star.id]);
                const active = star.id === selectedId;
                return (
                  <button
                    key={star.id}
                    onClick={() => !done && setSelectedId(star.id)}
                    aria-pressed={active}
                    disabled={done}
                    className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] md:min-h-[32px] rounded-full text-xs border transition-colors ${
                      done
                        ? 'bg-green-500/10 border-green-400/40 text-green-300'
                        : active
                          ? 'bg-orange-500/20 border-orange-400 text-white shadow-[0_0_14px_rgba(251,146,60,0.4)]'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: starColour(star.teffK) }}
                      aria-hidden="true"
                    />
                    {t('lab', star.nameKey)}
                    {done ? <Check className="inline w-3 h-3 -mt-0.5" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">{t('lab', 'hrInstructions')}</p>
          </div>

          {selected ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'hrSelectedTitle')}</p>
              <p className="flex items-center gap-2">
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ background: starColour(selected.teffK), boxShadow: `0 0 10px ${starColour(selected.teffK)}` }}
                  aria-hidden="true"
                />
                <span>
                  <span className="text-lg font-bold text-orange-300">{t('lab', selected.nameKey)}</span>
                  <span className="text-sm text-gray-400"> · {t('lab', selected.typeKey)}</span>
                </span>
              </p>
              <p className="text-sm leading-relaxed text-gray-200">{t('lab', selected.storyKey)}</p>
              <dl className="grid grid-cols-2 gap-2">
                {readouts.map((readout) => (
                  <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                    <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                    <dd className="font-mono text-xs text-cyan-300">{readout.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="rounded-2xl border border-green-400/40 bg-green-500/10 p-4 text-sm leading-relaxed text-green-100">
              {t('lab', 'hrAllPlaced')}
            </div>
          )}

          {feedback ? (
            <p
              role="status"
              className={`rounded-xl border p-3 text-sm leading-relaxed ${
                attempt.correct
                  ? 'border-green-400/40 bg-green-500/10 text-green-100'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              {feedback}
            </p>
          ) : null}

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{t('lab', 'hrProgress')}</span>
              <span className="font-mono text-white">
                {placedCount} / {STARS.length}
              </span>
            </div>
            <div className="h-2 bg-space-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-cyan-400 transition-all"
                style={{ width: `${(placedCount / STARS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* The whole row is the switch, so a thumb does not have to find a
              24-pixel track on a phone. */}
          <button
            onClick={togglePath}
            aria-pressed={showPath}
            className="w-full flex items-center justify-between gap-3 min-h-[44px] pt-4 border-t border-white/10 text-left"
          >
            <span className="text-sm text-gray-300">{t('lab', 'hrSunPath')}</span>
            <span
              className={`w-12 h-6 shrink-0 rounded-full transition-colors relative ${showPath ? 'bg-amber-400' : 'bg-space-700'}`}
              aria-hidden="true"
            >
              <span
                className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                  showPath ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </span>
          </button>

          <section className="rounded-2xl border border-pink-400/25 bg-pink-500/[0.05] p-4">
            <h4 className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-pink-300">
              <HelpCircle className="w-3.5 h-3.5" /> {t('lab', 'hrQuizTitle')}
            </h4>
            <p className="text-sm text-white mb-3">{t('lab', question.questionKey)}</p>
            <div className="flex flex-wrap gap-2">
              {question.options.map((id) => {
                const option = STARS.find((s) => s.id === id);
                const isPicked = picked === id;
                return (
                  <button
                    key={id}
                    onClick={() => answer(id)}
                    aria-pressed={isPicked}
                    className={`px-3 py-1.5 min-h-[40px] md:min-h-[32px] rounded-full text-xs border transition-colors ${
                      isPicked
                        ? id === question.answer
                          ? 'bg-green-500/20 border-green-400 text-green-100'
                          : 'bg-amber-500/20 border-amber-400 text-amber-100'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {t('lab', option.nameKey)}
                  </button>
                );
              })}
            </div>
            {picked ? (
              <p aria-live="polite" className={`mt-3 text-xs leading-relaxed ${rightAnswer ? 'text-green-300' : 'text-amber-200'}`}>
                {rightAnswer
                  ? t('lab', question.whyKey)
                  : t('lab', question.wrongKey, { name: t('lab', pickedStar.nameKey), value: pickedValue })}
              </p>
            ) : null}
            <button
              onClick={nextQuestion}
              className="mt-2 inline-flex items-center min-h-[40px] md:min-h-[32px] text-xs text-pink-200 hover:text-white"
            >
              {t('lab', 'hrQuizNext')}
            </button>
          </section>

          <LabMissions prefix="lab_hr_" missions={missions} />

          <LabExplain
            simple={t('lab', 'hrExplainSimple')}
            formula={[t('lab', 'hrExplainFormula1'), t('lab', 'hrExplainFormula2')]}
            details={t('lab', 'hrExplainDetails')}
          />

          <LabFacts facts={facts} />

          <button
            onClick={() => navigate('/lab/universe')}
            className="text-left min-h-[40px] md:min-h-0 text-xs text-cyan-300 hover:text-cyan-200"
          >
            {t('lab', 'hrToUniverse')}
          </button>

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4" /> {t('lab', 'hrReset')}
          </button>

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'hrModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={t('lab', 'hrHint')}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
          {t('lab', 'hrViewChip')}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)] outline-none"
          role="application"
          aria-label={t('lab', 'hrChartLabel')}
          tabIndex={0}
          onClick={onDiagramClick}
          onKeyDown={onDiagramKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ cursor: selected ? 'crosshair' : 'default' }}
        >
          <defs>
            <linearGradient id="hr-bg" x1="0" x2="1">
              <stop offset="0" stopColor="#9bb0ff" stopOpacity="0.12" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.03" />
              <stop offset="1" stopColor="#ff6040" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="hr-classes" x1="0" x2="1">
              {barStops.map((teffK) => (
                <stop key={teffK} offset={Math.max(0, tempToFraction(teffK))} stopColor={starColour(teffK)} />
              ))}
            </linearGradient>
            <marker id="hr-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0L10 5L0 10z" fill="#fbbf24" />
            </marker>
          </defs>

          <rect
            x={PLOT.x0}
            y={PLOT.y0}
            width={PLOT.x1 - PLOT.x0}
            height={PLOT.y1 - PLOT.y0}
            fill="url(#hr-bg)"
            stroke="#ffffff"
            strokeOpacity="0.12"
          />
          {LUM_EXPONENTS.map((exp) => (
            <g key={exp}>
              <line x1={PLOT.x0} x2={PLOT.x1} y1={lToY(10 ** exp)} y2={lToY(10 ** exp)} stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="3 5" />
              <text x={PLOT.x0 - 10} y={lToY(10 ** exp) + 6} textAnchor="end" className="fill-gray-400" fontSize="16">
                {exp === 0 ? '1' : '10'}
                {exp === 0 ? null : (
                  <tspan dy="-9" fontSize="12">
                    {exp}
                  </tspan>
                )}
              </text>
            </g>
          ))}
          {TEMP_TICKS.map((teffK) => (
            <g key={teffK}>
              <line x1={tToX(teffK)} x2={tToX(teffK)} y1={PLOT.y0} y2={PLOT.y1} stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="3 5" />
              <text x={tToX(teffK)} y={PLOT.y1 + 24} textAnchor="middle" className="fill-gray-400" fontSize="15">
                {grouped(teffK)}
              </text>
            </g>
          ))}
          <text x={(PLOT.x0 + PLOT.x1) / 2} y={PLOT.y1 + 50} textAnchor="middle" className="fill-gray-300" fontSize="16">
            {t('lab', 'hrTempAxis')}
          </text>
          <text
            x="26"
            y={(PLOT.y0 + PLOT.y1) / 2}
            textAnchor="middle"
            className="fill-gray-300"
            fontSize="16"
            transform={`rotate(-90 26 ${(PLOT.y0 + PLOT.y1) / 2})`}
          >
            {t('lab', 'hrLumAxis')}
          </text>
          <rect x={PLOT.x0} y={PLOT.y1 + 66} width={PLOT.x1 - PLOT.x0} height="10" rx="5" fill="url(#hr-classes)" opacity="0.85" />
          {CLASS_MARKS.map((mark) => (
            <text
              key={mark.letter}
              x={tToX(mark.teffK)}
              y={PLOT.y1 + 100}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize="17"
              fontWeight="700"
            >
              {mark.letter}
            </text>
          ))}
          <text x={(PLOT.x0 + PLOT.x1) / 2} y={PLOT.y1 + 124} textAnchor="middle" className="fill-gray-500" fontSize="14">
            {t('lab', 'hrSpectralClasses')}
          </text>
          {/* Dot sizes grow with radius on a log scale; to scale, Betelgeuse
              would cover the page. Said on the chart, not only in the note. */}
          <text x={PLOT.x1 - 8} y={PLOT.y1 - 10} textAnchor="end" className="fill-gray-500" fontSize="13">
            {t('lab', 'hrNotToScale')}
          </text>

          {background.map((star, i) => (
            <circle
              key={i}
              cx={tToX(star.teffK)}
              cy={lToY(star.lum)}
              r="2.4"
              fill={starColour(star.teffK)}
              opacity={star.alpha}
            />
          ))}

          <g className="fill-white" fontSize="17" fontWeight="700" opacity="0.7">
            <text x={msLabel.x} y={msLabel.y} textAnchor="middle" transform={`rotate(${msAngle} ${msLabel.x} ${msLabel.y})`}>
              {t('lab', 'hrRegionMain')}
            </text>
            <text x={tToX(5000)} y={lToY(10 ** 5.6)} textAnchor="middle">
              {t('lab', 'hrRegionSupergiants')}
            </text>
            <text x={tToX(3300)} y={lToY(1000)} textAnchor="middle">
              {t('lab', 'hrRegionGiants')}
            </text>
            <text x={tToX(10 ** 4.25)} y={lToY(10 ** -3.75)} textAnchor="middle">
              {t('lab', 'hrRegionWhiteDwarfs')}
            </text>
          </g>

          {showPath ? (
            <g>
              <polyline
                points={sunPath}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="7 5"
                strokeLinejoin="round"
                markerEnd="url(#hr-arrow)"
                opacity="0.9"
              />
              {sunMarks.map((p) => (
                <g key={p.mark}>
                  <circle cx={tToX(p.teffK)} cy={lToY(p.lum)} r="5" fill="#fbbf24" />
                  <text
                    x={tToX(p.teffK) + (p.mark === 'giant' ? -10 : 10)}
                    y={lToY(p.lum) + (p.mark === 'now' ? 22 : -10)}
                    textAnchor={p.mark === 'giant' ? 'end' : 'start'}
                    className="fill-amber-300"
                    fontSize="15"
                    fontWeight="700"
                  >
                    {t('lab', p.mark === 'now' ? 'hrSunPathNow' : p.mark === 'giant' ? 'hrSunPathGiant' : 'hrSunPathDwarf')}
                  </text>
                </g>
              ))}
            </g>
          ) : null}

          {STARS.filter((star) => placed[star.id]).map((star) => {
            const x = tToX(star.teffK);
            const y = lToY(star.lum);
            const r = starRadiusPx(star.radius);
            const left = star.labelSide === 'left';
            const colour = starColour(star.teffK);
            return (
              <g key={star.id}>
                {/* A ring that opens once when the star lands. */}
                {star.id === lastPlaced ? (
                  <circle cx={x} cy={y} r={r} fill="none" stroke={colour} strokeWidth="3" opacity="0">
                    <animate attributeName="r" from={r} to={r + 30} dur="0.9s" fill="freeze" />
                    <animate attributeName="opacity" from="0.9" to="0" dur="0.9s" fill="freeze" />
                  </circle>
                ) : null}
                <circle cx={x} cy={y} r={r + 5} fill={colour} opacity="0.2" />
                <circle cx={x} cy={y} r={r} fill={colour} stroke="#ffffff" strokeOpacity="0.5" />
                <text
                  x={x + (left ? -(r + 8) : r + 8)}
                  y={y + 5}
                  textAnchor={left ? 'end' : 'start'}
                  className="fill-white"
                  fontSize="15"
                  fontWeight="600"
                >
                  {t('lab', star.nameKey)}
                </text>
              </g>
            );
          })}

          {attempt && !attempt.correct ? (
            <g stroke="#f87171" strokeWidth="3" strokeLinecap="round">
              <line x1={fxToX(attempt.fx) - 9} y1={fyToY(attempt.fy) - 9} x2={fxToX(attempt.fx) + 9} y2={fyToY(attempt.fy) + 9} />
              <line x1={fxToX(attempt.fx) + 9} y1={fyToY(attempt.fy) - 9} x2={fxToX(attempt.fx) - 9} y2={fyToY(attempt.fy) + 9} />
            </g>
          ) : null}

          {focused ? (
            <g stroke="#22d3ee" strokeOpacity="0.8">
              <line x1={fxToX(cursor.fx)} x2={fxToX(cursor.fx)} y1={PLOT.y0} y2={PLOT.y1} strokeDasharray="4 4" />
              <line x1={PLOT.x0} x2={PLOT.x1} y1={fyToY(cursor.fy)} y2={fyToY(cursor.fy)} strokeDasharray="4 4" />
              <circle cx={fxToX(cursor.fx)} cy={fyToY(cursor.fy)} r="8" fill="none" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
      </LabViewport>
    </div>
  );
}
