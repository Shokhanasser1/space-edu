from .models import Badge, UserBadge


def check_and_award_badges(user, profile, lesson_count=None):
    """Award every badge the user now qualifies for.

    Called after anything that pays XP or advances the streak -- it used to run
    on lesson completion only, so XP from quizzes, the daily challenge and
    missions never earned an XP badge until the next lesson.
    """
    if lesson_count is None:
        from apps.progress.models import UserLessonProgress

        lesson_count = UserLessonProgress.objects.filter(user=user).count()
    profile.refresh_from_db(fields=['xp', 'streak', 'last_play_date'])
    existing_ids = set(UserBadge.objects.filter(user=user).values_list('badge_id', flat=True))
    candidates = Badge.objects.exclude(id__in=existing_ids)

    new_badges = []
    for badge in candidates:
        if badge.condition_type == 'xp_threshold' and profile.xp >= badge.condition_value:
            earned = True
        # `live_streak`, not the column: a badge is permanent, and "7-day
        # streak" was being handed out to a child whose seven days had ended
        # five days earlier and whose column nothing had lowered since.
        elif badge.condition_type == 'streak' and profile.live_streak >= badge.condition_value:
            earned = True
        elif badge.condition_type == 'lessons' and lesson_count >= badge.condition_value:
            earned = True
        else:
            earned = False

        if earned:
            # get_or_create: two requests finishing at once both found the badge
            # missing, and the second create was an IntegrityError -- a 500
            # after the XP had already been paid.
            _, created = UserBadge.objects.get_or_create(user=user, badge=badge)
            if created:
                new_badges.append(badge.slug)

    return new_badges
