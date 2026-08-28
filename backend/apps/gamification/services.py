from .models import Badge, UserBadge


def check_and_award_badges(user, profile, lesson_count):
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
            UserBadge.objects.create(user=user, badge=badge)
            new_badges.append(badge.slug)

    return new_badges
