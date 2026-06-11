from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import Book, FeedEvent, Notification, Review, ReviewComment, Shelf

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(source="followers.count", read_only=True)
    following_count = serializers.IntegerField(source="following.count", read_only=True)
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "followers_count", "following_count", "is_following")
        read_only_fields = ("email",)

    def get_is_following(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.followers.filter(id=request.user.id).exists()


class BookListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = (
            "id",
            "work_id",
            "title",
            "author",
            "genres",
            "image_url",
            "avg_rating",
            "ratings_count",
            "original_publication_year",
        )


class BookDetailSerializer(BookListSerializer):
    rating_distribution = serializers.DictField(read_only=True)

    class Meta(BookListSerializer.Meta):
        fields = BookListSerializer.Meta.fields + (
            "isbn",
            "isbn13",
            "original_publication_year",
            "num_pages",
            "description",
            "reviews_count",
            "text_reviews_count",
            "similar_books",
            "rating_distribution",
        )


class ReviewCommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ReviewComment
        fields = ("id", "user", "text", "created_at")
        read_only_fields = ("user", "created_at")


class ReviewSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    book = BookListSerializer(read_only=True)
    book_id = serializers.PrimaryKeyRelatedField(
        source="book", queryset=Book.objects.all(), write_only=True
    )
    comments = ReviewCommentSerializer(many=True, read_only=True)
    liked = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "review_id",
            "user",
            "book",
            "book_id",
            "rating",
            "review_text",
            "likes_count",
            "comments_count",
            "liked",
            "comments",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "review_id",
            "user",
            "likes_count",
            "comments_count",
            "created_at",
            "updated_at",
        )

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def get_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.liked_by.filter(id=request.user.id).exists()

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        review, _created = Review.objects.update_or_create(
            user=user,
            book=validated_data["book"],
            defaults={
                "rating": validated_data["rating"],
                "review_text": validated_data.get("review_text", ""),
            },
        )
        review.book.recalculate_rating()
        return review


class ShelfSerializer(serializers.ModelSerializer):
    book = BookListSerializer(read_only=True)
    book_id = serializers.PrimaryKeyRelatedField(
        source="book", queryset=Book.objects.all(), write_only=True
    )

    class Meta:
        model = Shelf
        fields = ("id", "book", "book_id", "status", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        shelf, _created = Shelf.objects.update_or_create(
            user=user,
            book=validated_data["book"],
            defaults={"status": validated_data["status"]},
        )
        return shelf


class FeedEventSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    book = BookListSerializer(read_only=True)
    review = ReviewSerializer(read_only=True)
    shelf_status = serializers.CharField(source="shelf.status", read_only=True)

    class Meta:
        model = FeedEvent
        fields = ("id", "user", "type", "book", "review", "shelf_status", "created_at")


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ("id", "actor", "type", "entity_id", "read_status", "created_at")
