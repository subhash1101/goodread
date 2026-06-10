import django.contrib.auth.models
import django.contrib.auth.validators
import django.contrib.postgres.indexes
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False, help_text="Designates that this user has all permissions without explicitly assigning them.", verbose_name="superuser status")),
                ("username", models.CharField(error_messages={"unique": "A user with that username already exists."}, help_text="Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.", max_length=150, unique=True, validators=[django.contrib.auth.validators.UnicodeUsernameValidator()], verbose_name="username")),
                ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")),
                ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
                ("email", models.EmailField(blank=True, max_length=254, verbose_name="email address")),
                ("is_staff", models.BooleanField(default=False, help_text="Designates whether the user can log into this admin site.", verbose_name="staff status")),
                ("is_active", models.BooleanField(default=True, help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.", verbose_name="active")),
                ("date_joined", models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined")),
                ("followers", models.ManyToManyField(blank=True, related_name="following", to=settings.AUTH_USER_MODEL)),
                ("groups", models.ManyToManyField(blank=True, help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.", related_name="user_set", related_query_name="user", to="auth.group", verbose_name="groups")),
                ("user_permissions", models.ManyToManyField(blank=True, help_text="Specific permissions for this user.", related_name="user_set", related_query_name="user", to="auth.permission", verbose_name="user permissions")),
            ],
            options={"verbose_name": "user", "verbose_name_plural": "users", "abstract": False},
            managers=[("objects", django.contrib.auth.models.UserManager())],
        ),
        migrations.CreateModel(
            name="Book",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("work_id", models.BigIntegerField(db_index=True, unique=True)),
                ("isbn", models.CharField(blank=True, max_length=32)),
                ("isbn13", models.CharField(blank=True, max_length=32)),
                ("title", models.CharField(db_index=True, max_length=512)),
                ("author", models.CharField(db_index=True, max_length=512)),
                ("original_publication_year", models.IntegerField(blank=True, null=True)),
                ("num_pages", models.IntegerField(blank=True, null=True)),
                ("description", models.TextField(blank=True)),
                ("genres", models.JSONField(blank=True, default=list)),
                ("image_url", models.URLField(blank=True, max_length=1000)),
                ("avg_rating", models.DecimalField(decimal_places=2, default=0, max_digits=4)),
                ("ratings_count", models.PositiveIntegerField(default=0)),
                ("one_star_ratings", models.PositiveIntegerField(default=0)),
                ("two_star_ratings", models.PositiveIntegerField(default=0)),
                ("three_star_ratings", models.PositiveIntegerField(default=0)),
                ("four_star_ratings", models.PositiveIntegerField(default=0)),
                ("five_star_ratings", models.PositiveIntegerField(default=0)),
                ("reviews_count", models.PositiveIntegerField(default=0)),
                ("text_reviews_count", models.PositiveIntegerField(default=0)),
                ("similar_books", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["title"],
                "indexes": [
                    models.Index(fields=["work_id"], name="goodreads_b_work_id_0bfe35_idx"),
                    models.Index(fields=["author"], name="goodreads_b_author_4fc47c_idx"),
                    django.contrib.postgres.indexes.GinIndex(fields=["genres"], name="book_genres_gin"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("review_id", models.CharField(blank=True, max_length=128, null=True, unique=True)),
                ("rating", models.PositiveSmallIntegerField()),
                ("review_text", models.TextField(blank=True)),
                ("likes_count", models.PositiveIntegerField(default=0)),
                ("comments_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("book", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="reviews", to="goodreads.book")),
                ("liked_by", models.ManyToManyField(blank=True, related_name="liked_reviews", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["user", "book"], name="goodreads_r_user_id_93b0fb_idx"),
                    models.Index(fields=["book", "-created_at"], name="goodreads_r_book_id_48efb3_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ReviewComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("review", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="goodreads.review")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="review_comments", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.CreateModel(
            name="Shelf",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("want_to_read", "Want to Read"), ("reading", "Currently Reading"), ("read", "Read")], max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("book", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="shelves", to="goodreads.book")),
                ("user", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="shelves", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-updated_at"],
                "indexes": [
                    models.Index(fields=["user", "book"], name="goodreads_s_user_id_ddff25_idx"),
                    models.Index(fields=["user", "status"], name="goodreads_s_user_id_b4c85d_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="FeedEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[("ADD_SHELF", "Added to shelf"), ("RATE", "Rated book"), ("REVIEW", "Reviewed book")], max_length=24)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("book", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feed_events", to="goodreads.book")),
                ("review", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to="goodreads.review")),
                ("shelf", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to="goodreads.shelf")),
                ("user", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="feed_events", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"], "indexes": [models.Index(fields=["user", "-created_at"], name="goodreads_f_user_id_ffe5b4_idx")]},
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[("FOLLOW", "Follow"), ("LIKE", "Like"), ("COMMENT", "Comment")], max_length=24)),
                ("entity_id", models.CharField(blank=True, max_length=128)),
                ("read_status", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sent_notifications", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"], "indexes": [models.Index(fields=["user", "read_status", "-created_at"], name="goodreads_n_user_id_9bb158_idx")]},
        ),
        migrations.AddConstraint(
            model_name="review",
            constraint=models.UniqueConstraint(fields=("user", "book"), name="unique_review_per_user_book"),
        ),
        migrations.AddConstraint(
            model_name="review",
            constraint=models.CheckConstraint(condition=models.Q(("rating__gte", 0), ("rating__lte", 5)), name="rating_between_0_and_5"),
        ),
        migrations.AddConstraint(
            model_name="shelf",
            constraint=models.UniqueConstraint(fields=("user", "book"), name="unique_book_per_user_shelf"),
        ),
    ]
