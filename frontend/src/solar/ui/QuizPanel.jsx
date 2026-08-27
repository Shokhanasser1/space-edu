import { useCallback, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { simClock } from '../clock';
import { makeQuiz, readBest, writeBest } from '../quiz';

/**
 * "Check yourself": five questions generated from the sky as it is right now.
 * The answers change with the date, so the way to get them right is to look
 * at the scene — which is the point.
 */

function optionLabel(q, option, names, t) {
  if (q.answerType === 'body') return names[option] || option;
  if (q.answerType === 'minutes') return `${option} ${t('units.min')}`;
  if (q.answerType === 'days') return t('quiz.unitsDays').replace('{n}', String(option));
  return String(option);
}

export default function QuizPanel({ t, names, onSelectBody }) {
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest());

  const start = useCallback(() => {
    setQuiz(makeQuiz(simClock.ms));
    setIndex(0);
    setPicked(null);
    setScore(0);
  }, []);

  if (!quiz) {
    return (
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/45">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
          {t('quiz.title')}
        </div>
        <p className="mb-2 text-[12px] leading-snug text-white/70">{t('quiz.intro')}</p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={start} className="rounded-md bg-neon-purple/80 px-3 py-1 text-[12px] font-bold text-white transition-colors hover:bg-neon-purple">
            {t('quiz.start')}
          </button>
          {best > 0 && <span className="font-mono text-[11px] tabular-nums text-white/50">{t('quiz.best').replace('{best}', String(best))}</span>}
        </div>
      </div>
    );
  }

  const finished = index >= quiz.length;
  if (finished) {
    return (
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/45">{t('quiz.title')}</div>
        <p className="mb-2 text-[13px] font-semibold text-white">
          {t('quiz.score').replace('{score}', String(score)).replace('{n}', String(quiz.length))}
        </p>
        <p className="mb-2 text-[11px] text-white/50">{t('quiz.noXp')}</p>
        <button type="button" onClick={start} className="rounded-md bg-white/10 px-3 py-1 text-[12px] font-bold text-white transition-colors hover:bg-white/20">
          {t('quiz.again')}
        </button>
      </div>
    );
  }

  const q = quiz[index];
  const question = t(`quiz.q.${q.kind}`).replace('{body}', names[q.params?.body] || '');
  const answer = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answerIndex) setScore((s) => s + 1);
    if (index === quiz.length - 1) {
      const final = score + (i === q.answerIndex ? 1 : 0);
      writeBest(final);
      setBest((b) => Math.max(b, final));
    }
  };
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/45">
        <span>{t('quiz.title')}</span>
        <span className="font-mono tabular-nums">{t('quiz.question').replace('{i}', String(index + 1)).replace('{n}', String(quiz.length))}</span>
      </div>
      <p className="mb-2 text-[13px] leading-snug text-white">{question}</p>
      <div className="grid grid-cols-2 gap-1">
        {q.options.map((option, i) => {
          const isAnswer = i === q.answerIndex;
          const state = picked === null ? 'idle' : isAnswer ? 'right' : i === picked ? 'wrong' : 'dim';
          const cls = {
            idle: 'bg-white/5 text-white/85 hover:bg-white/15',
            right: 'bg-neon-green/30 text-white ring-1 ring-neon-green/60',
            wrong: 'bg-red-500/30 text-white ring-1 ring-red-400/60',
            dim: 'bg-white/5 text-white/40',
          }[state];
          return (
            <button key={`${q.kind}-${option}`} type="button" onClick={() => answer(i)} className={`rounded-md px-2 py-1 text-left text-[12px] transition-colors ${cls}`}>
              {optionLabel(q, option, names, t)}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/70">
            {picked === q.answerIndex ? t('quiz.correct') : t('quiz.wrong').replace('{answer}', optionLabel(q, q.options[q.answerIndex], names, t))}
            {q.answerType === 'body' && onSelectBody && (
              <button type="button" className="ml-1 underline decoration-white/30 underline-offset-2" onClick={() => onSelectBody(q.options[q.answerIndex])}>
                {t('quiz.show')}
              </button>
            )}
          </span>
          <button type="button" onClick={next} className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-bold text-white transition-colors hover:bg-white/20">
            {index === quiz.length - 1 ? t('quiz.finish') : t('quiz.next')}
          </button>
        </div>
      )}
    </div>
  );
}
