from django.core.cache import cache

from .models import FeedEvent

FEED_TTL_SECONDS = 60
POPULAR_TTL_SECONDS = 300


def feed_cache_key(user_id):
    return f"feed:{user_id}"


def invalidate_feed_for_followers(actor):
    follower_ids = actor.followers.values_list("id", flat=True)
    for follower_id in follower_ids:
        try:
            cache.delete(feed_cache_key(follower_id))
        except Exception:
            pass


def create_feed_event(user, event_type, book, review=None, shelf=None):
    event = FeedEvent.objects.create(
        user=user,
        type=event_type,
        book=book,
        review=review,
        shelf=shelf,
    )
    invalidate_feed_for_followers(user)
    try:
        cache.delete(feed_cache_key(user.id))
    except Exception:
        pass
    return event
