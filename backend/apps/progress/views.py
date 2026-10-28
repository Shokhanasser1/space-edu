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

    Keeps the best result. A passed test on a lesson not yet marked complete
    completes it, and pays its reward, as the button would have: the "Test"
    button is on every lesson row, and a pass taken first used to be thrown
    away for want of a row to write to (audit, 28 October 2026). A failed
    test on an unfinished lesson writes nothing.
    """
    progress = UserLessonProgress.objects.filter(user=user, lesson_id=lesson_id).first()
    if progress is None:
        if percentage < MASTERY_PERCENT:
            return
        lesson = TopicLesson.objects.select_related('topic').get(pk=lesson_id)
        result = complete_lesson(user, lesson)
        if result is None:
            return
        progress = result['progress']
    if percentage <= progress.score:
        return
    progress.score = percentage
    fields = ['score', 'is_mastered']
    progress.is_mastered = percentage >= MASTERY_PERCENT
    if progress.is_mastered and progress.mastered_at is None:
        progress.mastered_at = timezone.now()
        fields.append('mastered_at')
    progress.save(update_fields=fields)


def finish_topic_if_done(user, topic, profile):
    """Pay the topic bonus once, the first time every leaf is done.

    The flag is set with a conditional UPDATE: two lessons finished at the same
    moment both used to see the topic unfinished and both paid the bonus.
    """
    leaves = leaf_lessons(topic)
    done = UserLessonProgress.objects.filter(user=user, lesson__in=leaves).count()
    if done < leaves.count():
        return 0

    enrollment, _ = UserTopicEnrollment.objects.get_or_create(user=user, topic=topic)
    claimed = UserTopicEnrollment.objects.filter(
        pk=enrollment.pk, completed_at__isnull=True,
    ).update(completed_at=timezone.now())
    if not claimed:
        return 0
    profile.add_fuel(topic.fuel_reward)
    return topic.fuel_reward


def complete_lesson(user, lesson):
    """Mark a lesson done and pay for it the first time. Used by the complete
    button and by a lesson test passed before the button was pressed.

    None for a group node: a heading, not a lesson, and every caller has to
    get that rule, not only the one that thought to check.
    """
    from apps.gamification.models import UserGamificationProfile

    if lesson.children.exists():
        return None

    with transaction.atomic():
        progress, created = UserLessonProgress.objects.get_or_create(
            user=user, lesson=lesson, defaults={'attempts': 1},
        )
        if not created:
            progress.attempts += 1
            progress.save(update_fields=['attempts'])

    # get_or_create: an account older than profile-on-sign-up has none, and
    # `user.gamification` raised here after the row above was written -- a
    # 500, and the retry, finding the row, paid nothing.
    profile, _ = UserGamificationProfile.objects.get_or_create(user=user)
    old_level = profile.level
    xp_earned = lesson.xp_reward if created else 0
    fuel_earned = lesson.fuel_reward if created else 0

    if xp_earned:
        profile.add_xp(xp_earned)
    if fuel_earned:
        profile.add_fuel(fuel_earned)

    fuel_earned += finish_topic_if_done(user, lesson.topic, profile)

    # A day with a lesson in it is a day of the streak. Before the badge
    # check, so a streak badge earned today is awarded today.
    profile.claim_daily_streak()
    new_badges = check_and_award_badges(user, profile)

    return {
        'progress': progress,
        'xp_earned': xp_earned,
        'fuel_earned': fuel_earned,
        'new_level': profile.level,
        'leveled_up': profile.level > old_level,
        'new_badges': new_badges,
    }


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

        result = complete_lesson(request.user, lesson)
        progress = result.pop('progress')
        return Response({
            **result,
            'is_mastered': progress.is_mastered,
            'score': progress.score,
        })


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
