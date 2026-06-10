from django.contrib.auth import get_user_model
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.core.cache import cache
from django.db import connection, transaction
from django.db.models import Q
from django.db.models import TextField
from django.db.models.functions import Cast
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import Book, FeedEvent, Notification, Review, ReviewComment, Shelf
from .serializers import (
    BookDetailSerializer,
    BookListSerializer,
    FeedEventSerializer,
    NotificationSerializer,
    RegisterSerializer,
    ReviewCommentSerializer,
    ReviewSerializer,
    ShelfSerializer,
    UserSerializer,
)
from .services import FEED_TTL_SECONDS, create_feed_event, feed_cache_key

User = get_user_model()


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user


class BookViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookListSerializer
    ordering_fields = ("avg_rating", "ratings_count", "title", "original_publication_year")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return BookDetailSerializer
        return BookListSerializer

    def get_queryset(self):
        queryset = Book.objects.all()
        query = self.request.query_params.get("search")
        genre = self.request.query_params.get("genre")

        if genre:
            queryset = queryset.annotate(genres_text=Cast("genres", TextField())).filter(
                genres_text__icontains=genre
            )

        if query:
            if connection.vendor == "postgresql":
                vector = SearchVector("title", weight="A") + SearchVector("author", weight="B") + SearchVector("description", weight="C")
                search_query = SearchQuery(query)
                queryset = (
                    queryset.annotate(rank=SearchRank(vector, search_query))
                    .annotate(genres_text=Cast("genres", TextField()))
                    .filter(Q(rank__gte=0.05) | Q(genres_text__icontains=query))
                    .order_by("-rank", "-ratings_count")
                )
            else:
                queryset = queryset.annotate(genres_text=Cast("genres", TextField())).filter(
                    Q(title__icontains=query)
                    | Q(author__icontains=query)
                    | Q(genres_text__icontains=query)
                )
        return queryset

    @action(detail=False, methods=["get"])
    def popular(self, request):
        cache_key = "books:popular"
        try:
            cached = cache.get(cache_key)
            if cached:
                return Response(cached)
        except Exception:
            cached = None

        books = Book.objects.order_by("-ratings_count", "-avg_rating")[:20]
        data = BookListSerializer(books, many=True, context={"request": request}).data
        try:
            cache.set(cache_key, data, timeout=300)
        except Exception:
            pass
        return Response(data)

    @action(detail=True, methods=["get"])
    def similar(self, request, pk=None):
        book = self.get_object()
        work_ids = [int(work_id) for work_id in book.similar_books if str(work_id).isdigit()]
        books = Book.objects.filter(work_id__in=work_ids)[:20]
        return Response(BookListSerializer(books, many=True, context={"request": request}).data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def recommendations(self, request):
        user_books = Book.objects.filter(
            Q(shelves__user=request.user) | Q(reviews__user=request.user)
        ).distinct()
        genres = set()
        similar_work_ids = set()
        for book in user_books[:200]:
            genres.update(str(genre).strip() for genre in book.genres if str(genre).strip())
            similar_work_ids.update(str(work_id) for work_id in book.similar_books)

        queryset = Book.objects.exclude(id__in=user_books.values("id"))
        if similar_work_ids:
            queryset = queryset.filter(work_id__in=[int(w) for w in similar_work_ids if w.isdigit()])
        elif genres:
            genre_query = Q()
            for genre in list(genres)[:8]:
                genre_query |= Q(genres_text__icontains=genre)
            queryset = queryset.annotate(genres_text=Cast("genres", TextField())).filter(genre_query)
        else:
            queryset = queryset.order_by("-avg_rating", "-ratings_count")

        return Response(BookListSerializer(queryset[:20], many=True, context={"request": request}).data)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = Review.objects.select_related("user", "book").prefetch_related("comments", "liked_by")
        book_id = self.request.query_params.get("book")
        user_id = self.request.query_params.get("user")
        mine = self.request.query_params.get("mine")
        if book_id:
            queryset = queryset.filter(book_id=book_id)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if mine and self.request.user.is_authenticated:
            queryset = queryset.filter(user=self.request.user)
        return queryset

    def perform_create(self, serializer):
        with transaction.atomic():
            review = serializer.save(user=self.request.user)
            event_type = FeedEvent.REVIEW if review.review_text.strip() else FeedEvent.RATE
            create_feed_event(self.request.user, event_type, review.book, review=review)

    def perform_update(self, serializer):
        review = serializer.save()
        review.book.recalculate_rating()
        event_type = FeedEvent.REVIEW if review.review_text.strip() else FeedEvent.RATE
        create_feed_event(self.request.user, event_type, review.book, review=review)

    def perform_destroy(self, instance):
        book = instance.book
        instance.delete()
        book.recalculate_rating()

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        review = self.get_object()
        if review.liked_by.filter(id=request.user.id).exists():
            review.liked_by.remove(request.user)
            delta = -1
        else:
            review.liked_by.add(request.user)
            delta = 1
            if review.user != request.user:
                Notification.objects.create(
                    user=review.user,
                    actor=request.user,
                    type=Notification.LIKE,
                    entity_id=str(review.id),
                )
        review.likes_count = max(0, review.likes_count + delta)
        review.save(update_fields=["likes_count"])
        return Response(ReviewSerializer(review, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def comment(self, request, pk=None):
        review = self.get_object()
        serializer = ReviewCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(user=request.user, review=review)
        review.comments_count = review.comments.count()
        review.save(update_fields=["comments_count"])
        if review.user != request.user:
            Notification.objects.create(
                user=review.user,
                actor=request.user,
                type=Notification.COMMENT,
                entity_id=str(comment.id),
            )
        return Response(ReviewCommentSerializer(comment, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ShelfViewSet(viewsets.ModelViewSet):
    serializer_class = ShelfSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Shelf.objects.filter(user=self.request.user).select_related("book")
        shelf_status = self.request.query_params.get("status")
        book_id = self.request.query_params.get("book")
        if shelf_status:
            queryset = queryset.filter(status=shelf_status)
        if book_id:
            queryset = queryset.filter(book_id=book_id)
        return queryset

    def perform_create(self, serializer):
        shelf = serializer.save(user=self.request.user)
        create_feed_event(self.request.user, FeedEvent.ADD_SHELF, shelf.book, shelf=shelf)

    def perform_update(self, serializer):
        shelf = serializer.save(user=self.request.user)
        create_feed_event(self.request.user, FeedEvent.ADD_SHELF, shelf.book, shelf=shelf)


class UserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    search_fields = ("username", "email")

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get("search")
        if query:
            queryset = queryset.filter(Q(username__icontains=query) | Q(email__icontains=query))
        return queryset

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, pk=None):
        target = self.get_object()
        if target == request.user:
            return Response({"detail": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)
        target.followers.add(request.user)
        Notification.objects.create(user=target, actor=request.user, type=Notification.FOLLOW)
        return Response(UserSerializer(target, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, pk=None):
        target = self.get_object()
        target.followers.remove(request.user)
        return Response(UserSerializer(target, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def followers(self, request, pk=None):
        users = self.paginate_queryset(self.get_object().followers.all())
        return self.get_paginated_response(UserSerializer(users, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def following(self, request, pk=None):
        users = self.paginate_queryset(self.get_object().following.all())
        return self.get_paginated_response(UserSerializer(users, many=True, context={"request": request}).data)


class FeedViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FeedEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        following_ids = self.request.user.following.values_list("id", flat=True)
        return FeedEvent.objects.filter(user_id__in=following_ids).select_related(
            "user", "book", "review", "shelf"
        )

    def list(self, request, *args, **kwargs):
        page_number = request.query_params.get("page", "1")
        if page_number == "1":
            key = feed_cache_key(request.user.id)
            try:
                cached = cache.get(key)
                if cached:
                    return Response(cached)
            except Exception:
                pass

        response = super().list(request, *args, **kwargs)
        if page_number == "1":
            try:
                cache.set(feed_cache_key(request.user.id), response.data, timeout=FEED_TTL_SECONDS)
            except Exception:
                pass
        return response


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).select_related("actor")

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.read_status = True
        notification.save(update_fields=["read_status"])
        return Response(NotificationSerializer(notification, context={"request": request}).data)
