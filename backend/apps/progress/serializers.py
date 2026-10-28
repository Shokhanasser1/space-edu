from rest_framework import serializers

from .models import UserLessonProgress, UserTopicEnrollment


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_slug = serializers.CharField(source='lesson.slug', read_only=True)
    topic_slug = serializers.CharField(source='lesson.topic.slug', read_only=True)
    # The profile listed raw slugs ("kin-one"): nothing here had a name to show.
    lesson_name = serializers.CharField(source='lesson.name', read_only=True)
    lesson_name_en = serializers.CharField(source='lesson.name_en', read_only=True)
    lesson_name_ru = serializers.CharField(source='lesson.name_ru', read_only=True)

    class Meta:
        model = UserLessonProgress
        fields = ('lesson_slug', 'topic_slug', 'lesson_name', 'lesson_name_en', 'lesson_name_ru',
                  'score', 'attempts', 'is_mastered', 'completed_at')


class TopicEnrollmentSerializer(serializers.ModelSerializer):
    topic_slug = serializers.CharField(source='topic.slug', read_only=True)

    class Meta:
        model = UserTopicEnrollment
        fields = ('topic_slug', 'enrolled_at', 'completed_at')


class LessonCompleteSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=0, max_value=100)
