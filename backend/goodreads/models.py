from django.contrib.auth.models import AbstractUser
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import Avg, Count
from django.utils import timezone


class User(AbstractUser):
    followers = models.ManyToManyField(
        "self",
        symmetrical=False,
        related_name="following",
        blank=True,
    )

    def __str__(self):
        return self.username


class Book(models.Model):
    work_id = models.BigIntegerField(unique=True, db_index=True)
    isbn = models.CharField(max_length=32, blank=True)
    isbn13 = models.CharField(max_length=32, blank=True)
    title = models.CharField(max_length=512, db_index=True)
    author = models.CharField(max_length=512, db_index=True)
    original_publication_year = models.IntegerField(null=True, blank=True)
    num_pages = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    genres = models.JSONField(default=list, blank=True)
    image_url = models.URLField(max_length=1000, blank=True)
    avg_rating = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    ratings_count = models.PositiveIntegerField(default=0)
    one_star_ratings = models.PositiveIntegerField(default=0)
    two_star_ratings = models.PositiveIntegerField(default=0)
    three_star_ratings = models.PositiveIntegerField(default=0)
    four_star_ratings = models.PositiveIntegerField(default=0)
    five_star_ratings = models.PositiveIntegerField(default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    text_reviews_count = models.PositiveIntegerField(default=0)
    similar_books = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["work_id"]),
            models.Index(fields=["author"]),
            GinIndex(fields=["genres"], name="book_genres_gin"),
        ]
        ordering = ["title"]

    def __str__(self):
        return f"{self.title} by {self.author}"

    @property
    def rating_distribution(self):
        return {
            "1": self.one_star_ratings,
            "2": self.two_star_ratings,
            "3": self.three_star_ratings,
            "4": self.four_star_ratings,
            "5": self.five_star_ratings,
        }

    def recalculate_rating(self):
        aggregate = self.reviews.filter(rating__gte=1).aggregate(
            average=Avg("rating"),
            count=Count("id"),
        )
        if aggregate["count"]:
            self.avg_rating = round(aggregate["average"], 2)
            self.ratings_count = aggregate["count"]
            self.save(update_fields=["avg_rating", "ratings_count", "updated_at"])


class Review(models.Model):
    review_id = models.CharField(max_length=128, unique=True, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews", db_index=True)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reviews", db_index=True)
    rating = models.PositiveSmallIntegerField()
    review_text = models.TextField(blank=True)
    likes_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    liked_by = models.ManyToManyField(User, related_name="liked_reviews", blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="unique_review_per_user_book"),
            models.CheckConstraint(
                check=models.Q(rating__gte=0) & models.Q(rating__lte=5),
                name="rating_between_0_and_5",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "book"]),
            models.Index(fields=["book", "-created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} rated {self.book} {self.rating}"


class ReviewComment(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="review_comments")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class Shelf(models.Model):
    WANT_TO_READ = "want_to_read"
    READING = "reading"
    READ = "read"
    STATUS_CHOICES = [
        (WANT_TO_READ, "Want to Read"),
        (READING, "Currently Reading"),
        (READ, "Read"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shelves", db_index=True)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="shelves", db_index=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="unique_book_per_user_shelf")
        ]
        indexes = [models.Index(fields=["user", "book"]), models.Index(fields=["user", "status"])]
        ordering = ["-updated_at"]


class FeedEvent(models.Model):
    ADD_SHELF = "ADD_SHELF"
    RATE = "RATE"
    REVIEW = "REVIEW"
    EVENT_TYPES = [
        (ADD_SHELF, "Added to shelf"),
        (RATE, "Rated book"),
        (REVIEW, "Reviewed book"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="feed_events", db_index=True)
    type = models.CharField(max_length=24, choices=EVENT_TYPES)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="feed_events")
    review = models.ForeignKey(Review, on_delete=models.CASCADE, null=True, blank=True)
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]
        ordering = ["-created_at"]


class Notification(models.Model):
    FOLLOW = "FOLLOW"
    LIKE = "LIKE"
    COMMENT = "COMMENT"
    TYPE_CHOICES = [(FOLLOW, "Follow"), (LIKE, "Like"), (COMMENT, "Comment")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_notifications")
    type = models.CharField(max_length=24, choices=TYPE_CHOICES)
    entity_id = models.CharField(max_length=128, blank=True)
    read_status = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "read_status", "-created_at"])]
        ordering = ["-created_at"]
