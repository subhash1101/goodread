from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BookViewSet,
    FeedViewSet,
    NotificationViewSet,
    ReviewViewSet,
    ShelfViewSet,
    UserViewSet,
    register,
)

router = DefaultRouter()
router.register("books", BookViewSet, basename="book")
router.register("reviews", ReviewViewSet, basename="review")
router.register("shelves", ShelfViewSet, basename="shelf")
router.register("users", UserViewSet, basename="user")
router.register("feed", FeedViewSet, basename="feed")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("auth/register/", register, name="register"),
    path("", include(router.urls)),
]
