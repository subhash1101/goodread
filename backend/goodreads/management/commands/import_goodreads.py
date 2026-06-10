import ast
import csv
import json
from datetime import datetime
from pathlib import Path

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from goodreads.models import Book, Review

User = get_user_model()


def as_int(value, default=0):
    if value in (None, ""):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def as_decimal(value, default=0):
    if value in (None, ""):
        return default
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return default


def parse_list(value):
    if not value:
        return []
    if isinstance(value, list):
        return value
    text = str(value).strip()
    if not text:
        return []
    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(text)
            if isinstance(parsed, list):
                return [clean_item(item) for item in parsed if clean_item(item)]
        except (ValueError, SyntaxError, TypeError):
            pass
    separators = ["|", ";", ","]
    for separator in separators:
        if separator in text:
            return [clean_item(item) for item in text.split(separator) if clean_item(item)]
    return [text]


def clean_item(value):
    return str(value).strip().strip("\"'")


def parse_datetime(value):
    if not value:
        return timezone.now()
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%B %d, %Y"):
        try:
            return timezone.make_aware(datetime.strptime(text, fmt))
        except ValueError:
            pass
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)
    except ValueError:
        return timezone.now()


class Command(BaseCommand):
    help = "Import Goodreads works and reviews CSV files into normalized database tables."

    def add_arguments(self, parser):
        parser.add_argument(
            "--data-dir",
            default="data",
            help="Directory containing goodreads_works.csv and goodreads_reviews.csv.",
        )
        parser.add_argument("--works", default="goodreads_works.csv")
        parser.add_argument("--reviews", default=None)
        parser.add_argument("--limit", type=int, default=None)
        parser.add_argument("--batch-size", type=int, default=5000)

    def handle(self, *args, **options):
        data_dir = Path(options["data_dir"])
        works_path = data_dir / options["works"]
        reviews_name = options["reviews"] or self.find_reviews_file(data_dir)
        reviews_path = data_dir / reviews_name

        if not works_path.exists():
            raise CommandError(f"Missing works CSV: {works_path}")
        if not reviews_path.exists():
            raise CommandError(f"Missing reviews CSV: {reviews_path}")

        batch_size = options["batch_size"]
        books_count = self.import_books(works_path, options["limit"], batch_size)
        reviews_count, users_count = self.import_reviews(reviews_path, options["limit"], batch_size)
        self.stdout.write(self.style.SUCCESS(f"Processed {books_count} book rows and {reviews_count} review rows."))
        self.stdout.write(self.style.SUCCESS(f"Ensured {users_count} imported users exist."))

    def find_reviews_file(self, data_dir):
        for name in ("goodreads_review.csv", "goodreads_reviews.csv"):
            if (data_dir / name).exists():
                return name
        return "goodreads_review.csv"

    def import_books(self, path, limit=None, batch_size=5000):
        count = 0
        batch = []
        with path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if limit and count >= limit:
                    break
                work_id = as_int(row.get("work_id"), default=None)
                if not work_id:
                    continue
                batch.append(
                    Book(
                        work_id=work_id,
                        isbn=row.get("isbn", "") or "",
                        isbn13=row.get("isbn13", "") or "",
                        title=row.get("original_title", "") or "Untitled",
                        author=row.get("author", "") or "Unknown",
                        original_publication_year=as_int(row.get("original_publication_year"), None),
                        num_pages=as_int(row.get("num_pages"), None),
                        description=row.get("description", "") or "",
                        genres=parse_list(row.get("genres")),
                        image_url=row.get("image_url", "") or "",
                        avg_rating=as_decimal(row.get("avg_rating")),
                        ratings_count=as_int(row.get("ratings_count")),
                        one_star_ratings=as_int(row.get("1_star_ratings")),
                        two_star_ratings=as_int(row.get("2_star_ratings")),
                        three_star_ratings=as_int(row.get("3_star_ratings")),
                        four_star_ratings=as_int(row.get("4_star_ratings")),
                        five_star_ratings=as_int(row.get("5_star_ratings")),
                        reviews_count=as_int(row.get("reviews_count")),
                        text_reviews_count=as_int(row.get("text_reviews_count")),
                        similar_books=parse_list(row.get("similar_books")),
                    )
                )
                count += 1
                if len(batch) >= batch_size:
                    self.upsert_books(batch, batch_size)
                    batch = []
                if count % 10000 == 0:
                    self.stdout.write(f"Imported {count} books...")
        if batch:
            self.upsert_books(batch, batch_size)
        return count

    def upsert_books(self, batch, batch_size):
        Book.objects.bulk_create(
            batch,
            batch_size=batch_size,
            update_conflicts=True,
            unique_fields=["work_id"],
            update_fields=[
                "isbn",
                "isbn13",
                "title",
                "author",
                "original_publication_year",
                "num_pages",
                "description",
                "genres",
                "image_url",
                "avg_rating",
                "ratings_count",
                "one_star_ratings",
                "two_star_ratings",
                "three_star_ratings",
                "four_star_ratings",
                "five_star_ratings",
                "reviews_count",
                "text_reviews_count",
                "similar_books",
            ],
        )

    def import_reviews(self, path, limit=None, batch_size=5000):
        count = 0
        skipped = 0
        ensured_users = 0
        batch = []
        unusable_password = make_password(None)
        with path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if limit and count >= limit:
                    break
                user_id = clean_item(row.get("user_id"))
                work_id = as_int(row.get("work_id"), default=None)
                if not user_id or not work_id:
                    skipped += 1
                    continue
                batch.append(row)
                count += 1
                if len(batch) >= batch_size:
                    imported, users = self.flush_reviews(batch, batch_size, unusable_password)
                    skipped += len(batch) - imported
                    ensured_users += users
                    batch = []
                if count % 50000 == 0:
                    self.stdout.write(f"Processed {count} review rows...")
        if batch:
            imported, users = self.flush_reviews(batch, batch_size, unusable_password)
            skipped += len(batch) - imported
            ensured_users += users
        if skipped:
            self.stdout.write(self.style.WARNING(f"Skipped {skipped} malformed or unmatched review rows."))
        return count, ensured_users

    def flush_reviews(self, rows, batch_size, unusable_password):
        work_ids = {as_int(row.get("work_id"), default=None) for row in rows}
        work_ids.discard(None)
        book_ids = dict(Book.objects.filter(work_id__in=work_ids).values_list("work_id", "id"))

        usernames = {self.import_username(row.get("user_id")) for row in rows}
        usernames.discard("")
        existing_usernames = set(
            User.objects.filter(username__in=usernames).values_list("username", flat=True)
        )
        missing_usernames = sorted(usernames - existing_usernames)
        if missing_usernames:
            User.objects.bulk_create(
                [
                    User(
                        username=username,
                        email=f"{username}@import.local",
                        password=unusable_password,
                    )
                    for username in missing_usernames
                ],
                batch_size=batch_size,
                ignore_conflicts=True,
            )

        user_ids = dict(User.objects.filter(username__in=usernames).values_list("username", "id"))
        reviews = []
        for row in rows:
            username = self.import_username(row.get("user_id"))
            work_id = as_int(row.get("work_id"), default=None)
            book_id = book_ids.get(work_id)
            user_pk = user_ids.get(username)
            if not book_id or not user_pk:
                continue
            created_at = parse_datetime(row.get("date_added") or row.get("read_at") or row.get("started_at"))
            reviews.append(
                Review(
                    user_id=user_pk,
                    book_id=book_id,
                    review_id=clean_item(row.get("review_id")) or None,
                    rating=as_int(row.get("rating")),
                    review_text=row.get("review_text", "") or "",
                    likes_count=as_int(row.get("n_votes")),
                    comments_count=as_int(row.get("n_comments")),
                    created_at=created_at,
                )
            )
        if reviews:
            Review.objects.bulk_create(reviews, batch_size=batch_size, ignore_conflicts=True)
        return len(reviews), len(missing_usernames)

    def import_username(self, raw_user_id):
        raw_user_id = clean_item(raw_user_id)
        return f"user_{raw_user_id}"[:150] if raw_user_id else ""
