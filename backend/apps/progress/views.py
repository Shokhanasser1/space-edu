from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import Topic, TopicLesson
from apps.gamification.services import check_and_award_badges

from .models import UserLessonProgress, UserTopicEnrollment
from .serializers import (
    LessonCompleteSerializer, LessonProgressSerializer, TopicEnrollmentSerializer,
)


MASTERY_PERCENT = 70


def record_lesson_test(user, lesson_id, percentage):
    """A graded lesson test, written onto the pupil's progress for that lesson.

    Keeps the best result. Only a lesson the pupil has finished has a row to
    write to: creating one here would count as finishing it, and the lesson's
    own XP is paid by LessonCompleteView when it creates the row.
    """
    progress = UserLessonProgress.objects.filter(user=user, lesson_id=lesson_id).first()
    if progress is None or percentage <= progress.score:
        return
    progress.score = percentage
    progress.is_mastered = percentage >= MASTERY_PERCENT
    progress.save(update_fields=['score', 'is_mastered'])


def leaf_lessons(topic):
    """Group nodes are headings, not lessons — they must not count towards a
    topic being finished, or a topic with sub-lessons could never complete."""
    return TopicLesson.objects.filter(topic=topic, children__isnull=True)


class UserProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lessons = (
            UserLessonProgress.objects
            .filter(user=request.user)
            .select_related('lesson', 'lesson__topic')
        )
        enrollments = (
            UserTopicEnrollment.objects.filter(user=request.user).select_related('topic')
        )
        return Response({
            'lessons': LessonProgressSerializer(lessons, many=True).data,
            'enrollments': TopicEnrollmentSerializer(enrollments, many=True).data,
        })


class LessonCompleteView(APIView):
    """POST /progress/lessons/<slug>/complete/

    The server decides the reward — the removed `gamification/grant/` let the
    client decide, and one request produced level 101. XP is paid on the first
    completion only; a re-run raises the attempt count and pays nothing.

    `score` is still accepted, and validated, so old clients keep working, but
    nothing reads it. It decided `is_mastered`, so `{"score": 100}` mastered any
    lesson with no question answered. Score and mastery come from the lesson's
    test, graded in apps/challenges (`record_lesson_test`).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_slug):
        serializer = LessonCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            lesson = TopicLesson.objects.select_related('topic').get(slug=lesson_slug)
        except TopicLesson.DoesNotExist:
            return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        if lesson.children.exists():
            return Response(
                {'detail': 'This lesson is a group heading; complete one of its parts instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            progress, created = UserLessonProgress.objects.get_or_create(
                user=request.user, lesson=lesson, defaults={'attempts': 1},
            )
            if not created:
                progress.attempts += 1
                progress.save(update_fields=['attempts'])

        profile = request.user.gamification
        old_level = profile.level
        xp_earned = lesson.xp_reward if created else 0
        fuel_earned = lesson.fuel_reward if created else 0

        if xp_earned:
            profile.add_xp(xp_earned)
        if fuel_earned:
            profile.add_fuel(fuel_earned)

        fuel_earned += self._maybe_finish_topic(request.user, lesson.topic, profile)

        total_lessons = UserLessonProgress.objects.filter(user=request.user).count()
        new_badges = check_and_award_badges(request.user, profile, total_lessons)

        return Response({
            'xp_earned': xp_earned,
            'fuel_earned': fuel_earned,
            'new_level': profile.level,
            'leveled_up': profile.level > old_level,
            'new_badges': new_badges,
            'is_mastered': progress.is_mastered,
            'score': progress.score,
        })

    def _maybe_finish_topic(self, user, topic, profile):
        """Pay the topic bonus once, the first time every leaf is done."""
        leaves = leaf_lessons(topic)
        done = UserLessonProgress.objects.filter(user=user, lesson__in=leaves).count()
        if done < leaves.count():
            return 0

        enrollment, _ = UserTopicEnrollment.objects.get_or_create(user=user, topic=topic)
        if enrollment.completed_at:
            return 0

        enrollment.completed_at = timezone.now()
        enrollment.save(update_fields=['completed_at'])
        profile.add_fuel(topic.fuel_reward)
        return topic.fuel_reward


class TopicProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, topic_slug):
        try:
            topic = Topic.objects.get(slug=topic_slug)
        except Topic.DoesNotExist:
            return Response({'detail': 'Topic not found.'}, status=status.HTTP_404_NOT_FOUND)

        leaves = leaf_lessons(topic)
        lessons_progress = (
            UserLessonProgress.objects
            .filter(user=request.user, lesson__topic=topic)
            .select_related('lesson', 'lesson__topic')
        )
        enrollment = UserTopicEnrollment.objects.filter(user=request.user, topic=topic).first()

        return Response({
            'topic_slug': topic_slug,
            'total_lessons': leaves.count(),
            'completed_lessons': lessons_progress.count(),
            'is_enrolled': enrollment is not None,
            'completed_at': enrollment.completed_at if enrollment else None,
            'lessons': LessonProgressSerializer(lessons_progress, many=True).data,
        })


class TopicEnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, topic_slug):
        try:
            topic = Topic.objects.get(slug=topic_slug)
        except Topic.DoesNotExist:
            return Response({'detail': 'Topic not found.'}, status=status.HTTP_404_NOT_FOUND)

        enrollment, created = UserTopicEnrollment.objects.get_or_create(
            user=request.user, topic=topic,
        )
        return Response(
            TopicEnrollmentSerializer(enrollment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
