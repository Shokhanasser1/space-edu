import { Suspense } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ClipboardCheck } from 'lucide-react';

import SectionPageHeader from '@/components/layout/SectionPageHeader';
import { useLearnTopics } from '@/hooks/useLearnTopics';
import { lessonName, quizPath } from '@/lib/learnContent';
import { useTranslation } from '@/hooks/useTranslation';
import { lessonLab } from './sims/registry';

/**
 * A lesson's own laboratory: the simulators made for that lesson, opened from
 * the "Lab" button beside "Test" on the lesson row. A lesson with none yet
 * goes to the general laboratory instead.
 */
export default function LessonLabView() {
  const { t, i18n } = useTranslation();
  const { subject, topicId, lessonIdx } = useParams();
  const navigate = useNavigate();
  const { topics } = useLearnTopics(subject);
  const topic = topics?.[topicId] ?? null;
  const lesson = topic?.lessons?.[Number(lessonIdx)] ?? null;
  const Lab = lessonLab(lesson);

  if (!topic || !lesson) return <Navigate to={`/learn/${subject}`} replace />;
  if (!Lab) return <Navigate to="/lab" replace />;

  return (
    <div className="pt-24 pb-20 min-h-screen">
      <SectionPageHeader
        title={lessonName(lesson, i18n.language)}
        color={topic.color}
        backPath={`/learn/${subject}/${topicId}`}
      />
      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-widest text-cyan-300">{t('learnViews', 'lessonLabTitle')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/learn/${subject}/${topicId}/lesson/${lessonIdx}`)}
              className="flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-xs font-semibold border border-white/15 bg-white/5 hover:bg-white/10"
            >
              <BookOpen className="w-4 h-4" /> {t('learnViews', 'lessonLabRead')}
            </button>
            <button
              onClick={() => navigate(quizPath(subject, lesson))}
              className="flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-xs font-semibold border border-teal-300/40 bg-teal-400/10 text-teal-100 hover:bg-teal-400/20"
            >
              <ClipboardCheck className="w-4 h-4" /> {t('learnViews', 'testButton')}
            </button>
          </div>
        </div>
        <Suspense fallback={<div className="h-[560px] rounded-3xl border border-white/10 bg-white/5 animate-pulse" />}>
          <Lab />
        </Suspense>
      </div>
    </div>
  );
}
