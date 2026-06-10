from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Book, FeedEvent, Notification, Review, ReviewComment, Shelf, User


@admin.register(User)
class GoodreadsUserAdmin(UserAdmin):
    filter_horizontal = ("groups", "user_permissions", "followers")


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    search_fields = ("title", "author", "work_id")
    list_display = ("title", "author", "avg_rating", "ratings_count")
    list_filter = ("author",)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    search_fields = ("review_id", "user__username", "book__title")
    list_display = ("user", "book", "rating", "likes_count", "comments_count", "created_at")
    list_filter = ("rating",)


admin.site.register(Shelf)
admin.site.register(FeedEvent)
admin.site.register(Notification)
admin.site.register(ReviewComment)
