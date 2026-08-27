import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { explanationText, langCode, questionOptions, questionText } from '@/lib/questionText';
import { useGamificationStore } from '@/store/useGamificationStore';
import { Timer, Award, Zap, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

export default function DailyChallengeView() {
  const { t, language } = useTranslation();
  const lang = langCode(language);
  const { completeDailyChallenge, checkStreak } = useGamificationStore();

  /*
   * The questions come from `/challenges/today/` and the grading from
   * `/challenges/submit/`.
   *
   * They used to come from `generateDailyChallenge()` in `quizData.js`, which
   * shipped the correct answer for every question into the browser bundle, and
   * the score was computed here from that same key. The XP was never persisted
   * either — `completeDailyChallenge` only writes to the local store.
   *
   * The server does the marking, so there is no green/red flash per question.
   * What replaces it is the review at the end: every question, what the child
   * picked, what the answer was, and why — in their own language. Doc item 9
   * asks for each item to genuinely test the child, and a test nobody learns
   * anything from is only half of that.
   */
  const [questions, setQuestions] = useState([]);
  const [timeLimit, setTimeLimit] = useState(60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [result, setResult] = useState(null);
  const [review, setReview] = useState([]);
  // 'loading' | 'ready' | 'empty' | 'done'. `done` is the server's word for it,
  // out of the same response that carries the questions. It used to be
  // `dailyChallengeCompleted` from localStorage, so a child on a second device
  // — or one whose browser storage had been cleared — replayed all five
  // questions and collected a 400 at the end for their trouble.
  const [loadState, setLoadState] = useState('loading');
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkStreak();

    api.get('/challenges/today/')
      .then(({ data }) => {
        if (cancelled) return;
        const list = data.questions ?? [];
        setQuestions(list);
        setTimeLimit(data.time_limit || 60);
        if (data.already_completed) setLoadState('done');
        else setLoadState(list.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setLoadState('empty');
      });

    return () => {
      cancelled = true;
    };
  }, [checkStreak]);

  // Each question brings its own clock. Everything used to get a flat 15
  // seconds, including "the first half of the road at 60 km/h, the second at
  // 40 — find the average speed", which is two steps and a trap.
  const currentQ = questions[currentIndex];
  const questionSeconds = currentQ?.time_seconds || timeLimit;

  // Reset during render rather than in an effect. An effect commits first and
  // resets after, so the child saw the previous question's clock — or, on the
  // first paint, the whole-challenge default — for one frame before it jumped.
  const [clockSetFor, setClockSetFor] = useState(null);
  if (currentQ && clockSetFor !== currentQ.id) {
    setClockSetFor(currentQ.id);
    setTimeLeft(questionSeconds);
  }

  const record = useCallback((index) => {
    setSelectedAnswer(index);
    setIsAnswerChecked(true);
    // Recorded, not graded. The server holds the answer key.
    setAnswers((prev) => [
      ...prev,
      {
        question_id: questions[currentIndex].id,
        selected: index,
        time_spent: Math.max(0, questionSeconds - timeLeft),
      },
    ]);
  }, [questions, currentIndex, questionSeconds, timeLeft]);

  const handleCheckAnswer = (index) => {
    if (isAnswerChecked) return;
    record(index);
  };

  useEffect(() => {
    if (loadState !== 'ready' || isFinished || isAnswerChecked || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [loadState, isFinished, isAnswerChecked, timeLeft]);

  useEffect(() => {
    // Running out of time is an answer nobody gave. -1 is not one of the option
    // indices, so the server grades it wrong without needing a special case.
    // This is its own effect because the interval used to call a state setter
    // from inside another setter's updater, which React warns about and which
    // fires twice in StrictMode.
    if (loadState !== 'ready' || isFinished || isAnswerChecked) return;
    if (timeLeft === 0 && questions.length) record(-1);
  }, [timeLeft, loadState, isFinished, isAnswerChecked, questions.length, record]);

  const submittedRef = useRef(false);
  const submit = (collected) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    api.post('/challenges/submit/', {
      answers: collected,
      time_taken: collected.reduce((sum, a) => sum + a.time_spent, 0),
    })
      .then(({ data }) => {
        setResult(data.result ?? null);
        setReview(data.review ?? []);
        // The profile is the truth; pull it rather than guess locally.
        useGamificationStore.getState().pullFromServer();
        completeDailyChallenge(0);
      })
      .catch((err) => {
        // 400 means it was already completed today, which is not a failure the
        // student needs to see as one.
        if (err?.response?.status === 400) {
          completeDailyChallenge(0);
          setLoadState('done');
          return;
        }
        // They did finish it. Say the score did not save rather than invent a
        // number that their next page load will wipe.
        setSaveFailed(true);
      });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setIsAnswerChecked(false);
    } else {
      setIsFinished(true);
      submit(answers);
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen pt-32 text-center text-white/40 text-sm">
        {t('common', 'loading')}
      </div>
    );
  }

  if (loadState === 'done' && !isFinished) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="glass p-8 rounded-2xl text-center max-w-md w-full">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4">{t('daily', 'challengeCompleted')}</h2>
          <p className="text-gray-400 mb-8">{t('daily', 'alreadyCompleted')}</p>
          <Link to="/profile" className="px-8 py-3.5 bg-violet text-white font-[800] rounded-2xl hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all inline-block uppercase text-xs tracking-widest">
            {t('daily', 'viewProfile')}
          </Link>
        </div>
      </div>
    );
  }

  // A day with an empty pool used to render `null` — a blank page, with nothing
  // to tell the child whether the site was broken or they were simply early.
  if (loadState === 'empty' || questions.length === 0) {
    return (
      <div className="min-h-screen pt-32 px-4 text-center">
        <p className="text-white/60 max-w-md mx-auto">{t('daily', 'noQuestions')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {!isFinished ? (
        <motion.div
          key="quiz"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-3xl relative overflow-hidden"
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
            <motion.div
              className="h-full bg-violet"
              initial={{ width: `${(currentIndex / questions.length) * 100}%` }}
              animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          <div className="flex justify-between items-center mb-8 mt-4">
            <span className="text-neon-purple font-bold bg-neon-purple/10 px-4 py-1 rounded-full">
              {t('quiz', 'question')} {currentIndex + 1}/{questions.length}
            </span>
            <div className={`flex items-center gap-2 font-[800] text-xl ${timeLeft <= 5 ? 'text-red-400' : 'text-violet'}`}>
              <Timer className="w-5 h-5" />
              {timeLeft.toString().padStart(2, '0')}s
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold mb-8 leading-tight">
            {questionText(currentQ, lang)}
          </h2>

          <div className="space-y-4 mb-8">
            {questionOptions(currentQ, lang).map((option, idx) => {
              // No green and no red here. The browser has no answer key, so the
              // only honest thing it can show is which option was picked. It
              // used to paint every choice red, which told a child who had just
              // answered correctly that they were wrong.
              let btnClass = 'glass hover:bg-white/10 border-transparent';
              if (isAnswerChecked) {
                btnClass = idx === selectedAnswer
                  ? 'border-violet/60 bg-violet/10 text-violet-light'
                  : 'opacity-50 border-transparent';
              } else if (selectedAnswer === idx) {
                btnClass = 'border-violet/40 bg-violet/10 text-violet-light';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleCheckAnswer(idx)}
                  disabled={isAnswerChecked}
                  className={`w-full text-left p-5 rounded-xl border-2 transition-all text-lg font-medium flex justify-between items-center ${btnClass}`}
                >
                  {option}
                  {isAnswerChecked && idx === selectedAnswer && <CheckCircle className="w-5 h-5" />}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {isAnswerChecked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex justify-end"
              >
                <button
                  onClick={handleNext}
                  className="px-8 py-4 bg-violet text-white font-[800] rounded-2xl hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all flex items-center gap-2 uppercase text-xs tracking-widest"
                >
                  {currentIndex < questions.length - 1 ? t('daily', 'nextQuestion') : t('daily', 'finish')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          key="results"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-8 md:p-12 rounded-3xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-violet/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="text-center">
            <div className="w-24 h-24 mx-auto bg-white/[0.03] rounded-3xl flex items-center justify-center mb-8 border border-white/10 relative z-10 shadow-2xl">
              <Award className="w-12 h-12 text-violet" />
            </div>

            <h2 className="text-4xl font-bold mb-2">{t('daily', 'complete')}</h2>
            <p className="text-gray-400 text-lg mb-8">{t('daily', 'completeSub')}</p>
          </div>

          {saveFailed ? (
            <p className="text-sm text-rose-300/90 mb-8 text-center">{t('quiz', 'scoreNotSaved')}</p>
          ) : result ? (
            <div className="grid grid-cols-2 gap-4 mb-10 max-w-md mx-auto">
              <div className="glass p-6 rounded-2xl text-center">
                <div className="text-3xl font-bold text-white mb-1">{result.score}/{result.total}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">{t('quiz', 'score')}</div>
              </div>
              <div className="glass p-6 rounded-2xl text-center">
                {/* The number the server actually awarded. This used to be
                    `score * 50 + 100` computed here, which stopped being true
                    the moment anyone edited the rewards in the admin panel. */}
                <div className="text-3xl font-bold text-neon-purple mb-1 flex items-center justify-center gap-1">
                  <Zap className="w-6 h-6" />
                  {result.xp_earned}
                </div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">{t('daily', 'xpEarned')}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/30 mb-8 text-center">{t('quiz', 'savingScore')}</p>
          )}

          {review.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm text-white/50 uppercase tracking-widest mb-4">{t('daily', 'review')}</h3>
              <div className="space-y-4">
                {review.map((item) => {
                  const options = questionOptions(item, lang);
                  const explanation = explanationText(item, lang);
                  return (
                    <div key={item.id} className="glass p-5 rounded-2xl text-left">
                      <div className="flex items-start gap-3 mb-3">
                        {item.is_correct
                          ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                          : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                        <p className="font-semibold leading-snug">{questionText(item, lang)}</p>
                      </div>
                      <dl className="text-sm space-y-1 mb-3 pl-8">
                        <div className="flex gap-2">
                          <dt className="text-white/40">{t('daily', 'yourAnswer')}:</dt>
                          <dd className={item.is_correct ? 'text-green-300' : 'text-red-300'}>
                            {options[item.selected] ?? t('daily', 'noAnswer')}
                          </dd>
                        </div>
                        {!item.is_correct && (
                          <div className="flex gap-2">
                            <dt className="text-white/40">{t('daily', 'correctAnswer')}:</dt>
                            <dd className="text-green-300">{options[item.correct_answer]}</dd>
                          </div>
                        )}
                      </dl>
                      {explanation && (
                        <p className="text-sm text-white/60 leading-relaxed pl-8">{explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Link to="/profile" className="px-8 py-4 bg-violet text-white font-[800] rounded-2xl hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all uppercase text-xs tracking-widest">
              {t('daily', 'viewProfile')}
            </Link>
            <Link to="/leaderboard" className="px-8 py-4 glass text-white font-[800] rounded-2xl hover:bg-white/10 transition-all uppercase text-xs tracking-widest">
              {t('nav', 'leaderboard')}
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
