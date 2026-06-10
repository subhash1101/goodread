import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "db.sqlite3"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key"))
ALGORITHM = "HS256"
PAGE_SIZE = 20

app = FastAPI(title="Goodreads Clone API")
security = HTTPBearer(auto_error=False)

origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    email: Optional[str] = ""
    password: str = Field(min_length=8)


class ReviewPayload(BaseModel):
    book_id: int
    rating: int
    review_text: str = ""


class ShelfPayload(BaseModel):
    book_id: int
    status: str


class CommentPayload(BaseModel):
    text: str


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        yield conn
    finally:
        conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def decode_json(value, default):
    if value in (None, ""):
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def paginate(request: Request, rows, count=None, page=1, page_size=PAGE_SIZE):
    count = len(rows) if count is None else count
    return {
        "count": count,
        "next": None,
        "previous": None,
        "results": rows,
    }


def create_token(user_id: int, token_type: str, minutes: int):
    expires = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": str(user_id), "type": token_type, "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_id(conn, user_id):
    return conn.execute("SELECT * FROM goodreads_user WHERE id = ?", (user_id,)).fetchone()


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    conn=Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = get_user_by_id(conn, int(payload.get("sub", 0)))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


def optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    conn=Depends(get_db),
):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return get_user_by_id(conn, int(payload.get("sub", 0)))


def verify_password(password, encoded):
    if not encoded or encoded.startswith("!"):
        return False
    try:
        algorithm, iterations, salt, stored = encoded.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
    return secrets.compare_digest(stored, __import__("base64").b64encode(digest).decode().strip())


def make_password(password):
    salt = secrets.token_urlsafe(12)[:12]
    iterations = 870000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    encoded = __import__("base64").b64encode(digest).decode().strip()
    return f"pbkdf2_sha256${iterations}${salt}${encoded}"


def serialize_user(conn, user, request_user=None):
    followers_count = conn.execute(
        "SELECT COUNT(*) FROM goodreads_user_followers WHERE to_user_id = ?", (user["id"],)
    ).fetchone()[0]
    following_count = conn.execute(
        "SELECT COUNT(*) FROM goodreads_user_followers WHERE from_user_id = ?", (user["id"],)
    ).fetchone()[0]
    is_following = False
    if request_user:
        is_following = bool(
            conn.execute(
                "SELECT 1 FROM goodreads_user_followers WHERE from_user_id = ? AND to_user_id = ?",
                (request_user["id"], user["id"]),
            ).fetchone()
        )
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
    }


def serialize_book(row, detail=False):
    data = {
        "id": row["id"],
        "work_id": row["work_id"],
        "title": row["title"],
        "author": row["author"],
        "genres": decode_json(row["genres"], []),
        "image_url": row["image_url"],
        "avg_rating": str(row["avg_rating"]),
        "ratings_count": row["ratings_count"],
    }
    if detail:
        data.update(
            {
                "isbn": row["isbn"],
                "isbn13": row["isbn13"],
                "original_publication_year": row["original_publication_year"],
                "num_pages": row["num_pages"],
                "description": row["description"],
                "reviews_count": row["reviews_count"],
                "text_reviews_count": row["text_reviews_count"],
                "similar_books": decode_json(row["similar_books"], []),
                "rating_distribution": {
                    "1": row["one_star_ratings"],
                    "2": row["two_star_ratings"],
                    "3": row["three_star_ratings"],
                    "4": row["four_star_ratings"],
                    "5": row["five_star_ratings"],
                },
            }
        )
    return data


def get_book(conn, book_id):
    book = conn.execute("SELECT * FROM goodreads_book WHERE id = ?", (book_id,)).fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def get_review(conn, review_id):
    review = conn.execute("SELECT * FROM goodreads_review WHERE id = ?", (review_id,)).fetchone()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


def serialize_comment(conn, comment):
    user = get_user_by_id(conn, comment["user_id"])
    return {
        "id": comment["id"],
        "user": serialize_user(conn, user),
        "text": comment["text"],
        "created_at": comment["created_at"],
    }


def serialize_review(conn, review, request_user=None):
    user = get_user_by_id(conn, review["user_id"])
    book = get_book(conn, review["book_id"])
    comments = conn.execute(
        "SELECT * FROM goodreads_reviewcomment WHERE review_id = ? ORDER BY created_at", (review["id"],)
    ).fetchall()
    liked = False
    if request_user:
        liked = bool(
            conn.execute(
                "SELECT 1 FROM goodreads_review_liked_by WHERE review_id = ? AND user_id = ?",
                (review["id"], request_user["id"]),
            ).fetchone()
        )
    return {
        "id": review["id"],
        "review_id": review["review_id"],
        "user": serialize_user(conn, user, request_user),
        "book": serialize_book(book),
        "book_id": review["book_id"],
        "rating": review["rating"],
        "review_text": review["review_text"],
        "likes_count": review["likes_count"],
        "comments_count": review["comments_count"],
        "liked": liked,
        "comments": [serialize_comment(conn, row) for row in comments],
        "created_at": review["created_at"],
        "updated_at": review["updated_at"],
    }


def serialize_shelf(conn, shelf):
    return {
        "id": shelf["id"],
        "book": serialize_book(get_book(conn, shelf["book_id"])),
        "book_id": shelf["book_id"],
        "status": shelf["status"],
        "created_at": shelf["created_at"],
        "updated_at": shelf["updated_at"],
    }


def create_feed_event(conn, user_id, event_type, book_id, review_id=None, shelf_id=None):
    conn.execute(
        """
        INSERT INTO goodreads_feedevent (type, created_at, book_id, review_id, shelf_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (event_type, now_iso(), book_id, review_id, shelf_id, user_id),
    )


def recalculate_rating(conn, book_id):
    row = conn.execute(
        "SELECT AVG(rating) AS average, COUNT(*) AS count FROM goodreads_review WHERE book_id = ? AND rating >= 1",
        (book_id,),
    ).fetchone()
    if row["count"]:
        conn.execute(
            "UPDATE goodreads_book SET avg_rating = ?, ratings_count = ?, updated_at = ? WHERE id = ?",
            (round(row["average"], 2), row["count"], now_iso(), book_id),
        )


@app.get("/api/health/")
def health():
    return {"ok": True}


@app.post("/api/auth/login/")
def login(payload: LoginPayload, conn=Depends(get_db)):
    user = conn.execute("SELECT * FROM goodreads_user WHERE username = ?", (payload.username,)).fetchone()
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="No active account found with the given credentials")
    return {
        "access": create_token(user["id"], "access", 60),
        "refresh": create_token(user["id"], "refresh", 60 * 24 * 7),
    }


@app.post("/api/auth/register/", status_code=201)
def register(payload: RegisterPayload, conn=Depends(get_db)):
    exists = conn.execute("SELECT 1 FROM goodreads_user WHERE username = ?", (payload.username,)).fetchone()
    if exists:
        raise HTTPException(status_code=400, detail="Username already exists")
    timestamp = now_iso()
    cursor = conn.execute(
        """
        INSERT INTO goodreads_user
        (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined)
        VALUES (?, NULL, 0, ?, '', '', ?, 0, 1, ?)
        """,
        (make_password(payload.password), payload.username, payload.email or "", timestamp),
    )
    conn.commit()
    return serialize_user(conn, get_user_by_id(conn, cursor.lastrowid))


@app.get("/api/books/recommendations/")
def recommendations(request: Request, user=Depends(current_user), conn=Depends(get_db)):
    rows = conn.execute(
        """
        SELECT b.* FROM goodreads_book b
        WHERE b.id NOT IN (SELECT book_id FROM goodreads_shelf WHERE user_id = ?)
        ORDER BY b.avg_rating DESC, b.ratings_count DESC
        LIMIT 20
        """,
        (user["id"],),
    ).fetchall()
    return [serialize_book(row) for row in rows]


@app.get("/api/books/popular/")
def popular_books(conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT * FROM goodreads_book ORDER BY ratings_count DESC, avg_rating DESC LIMIT 20"
    ).fetchall()
    return [serialize_book(row) for row in rows]


@app.get("/api/books/")
def list_books(
    request: Request,
    search: str = "",
    genre: str = "",
    page: int = Query(1, ge=1),
    conn=Depends(get_db),
):
    where = []
    args = []
    if genre:
        where.append("genres LIKE ?")
        args.append(f"%{genre}%")
    if search:
        where.append("(title LIKE ? OR author LIKE ? OR description LIKE ? OR genres LIKE ?)")
        args.extend([f"%{search}%"] * 4)
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    count = conn.execute(f"SELECT COUNT(*) FROM goodreads_book {clause}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM goodreads_book {clause} ORDER BY title LIMIT ? OFFSET ?",
        [*args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ).fetchall()
    return paginate(request, [serialize_book(row) for row in rows], count=count, page=page)


@app.get("/api/books/{book_id}/similar/")
def similar_books(book_id: int, conn=Depends(get_db)):
    book = get_book(conn, book_id)
    work_ids = [int(item) for item in decode_json(book["similar_books"], []) if str(item).isdigit()]
    if not work_ids:
        return []
    placeholders = ",".join("?" for _ in work_ids[:20])
    rows = conn.execute(
        f"SELECT * FROM goodreads_book WHERE work_id IN ({placeholders}) LIMIT 20", work_ids[:20]
    ).fetchall()
    return [serialize_book(row) for row in rows]


@app.get("/api/books/{book_id}/")
def book_detail(book_id: int, conn=Depends(get_db)):
    return serialize_book(get_book(conn, book_id), detail=True)


@app.get("/api/reviews/")
def list_reviews(
    request: Request,
    book: Optional[int] = None,
    user_id: Optional[int] = Query(None, alias="user"),
    mine: Optional[bool] = False,
    page: int = Query(1, ge=1),
    request_user=Depends(optional_user),
    conn=Depends(get_db),
):
    where = []
    args = []
    if book:
        where.append("book_id = ?")
        args.append(book)
    if user_id:
        where.append("user_id = ?")
        args.append(user_id)
    if mine:
        if not request_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        where.append("user_id = ?")
        args.append(request_user["id"])
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    count = conn.execute(f"SELECT COUNT(*) FROM goodreads_review {clause}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM goodreads_review {clause} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [*args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ).fetchall()
    return paginate(request, [serialize_review(conn, row, request_user) for row in rows], count=count, page=page)


@app.post("/api/reviews/", status_code=201)
def create_review(payload: ReviewPayload, user=Depends(current_user), conn=Depends(get_db)):
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")
    timestamp = now_iso()
    existing = conn.execute(
        "SELECT * FROM goodreads_review WHERE user_id = ? AND book_id = ?", (user["id"], payload.book_id)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE goodreads_review SET rating = ?, review_text = ?, updated_at = ? WHERE id = ?",
            (payload.rating, payload.review_text, timestamp, existing["id"]),
        )
        review_id = existing["id"]
    else:
        cursor = conn.execute(
            """
            INSERT INTO goodreads_review
            (review_id, rating, review_text, likes_count, comments_count, created_at, updated_at, book_id, user_id)
            VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
            """,
            (f"user-{user['id']}-book-{payload.book_id}", payload.rating, payload.review_text, timestamp, timestamp, payload.book_id, user["id"]),
        )
        review_id = cursor.lastrowid
    recalculate_rating(conn, payload.book_id)
    create_feed_event(conn, user["id"], "REVIEW" if payload.review_text.strip() else "RATE", payload.book_id, review_id=review_id)
    conn.commit()
    return serialize_review(conn, get_review(conn, review_id), user)


@app.delete("/api/reviews/{review_id}/", status_code=204)
def delete_review(review_id: int, user=Depends(current_user), conn=Depends(get_db)):
    review = get_review(conn, review_id)
    if review["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    conn.execute("DELETE FROM goodreads_review WHERE id = ?", (review_id,))
    recalculate_rating(conn, review["book_id"])
    conn.commit()
    return Response(status_code=204)


@app.post("/api/reviews/{review_id}/like/")
def like_review(review_id: int, user=Depends(current_user), conn=Depends(get_db)):
    review = get_review(conn, review_id)
    liked = conn.execute(
        "SELECT id FROM goodreads_review_liked_by WHERE review_id = ? AND user_id = ?", (review_id, user["id"])
    ).fetchone()
    if liked:
        conn.execute("DELETE FROM goodreads_review_liked_by WHERE id = ?", (liked["id"],))
        delta = -1
    else:
        conn.execute(
            "INSERT INTO goodreads_review_liked_by (review_id, user_id) VALUES (?, ?)", (review_id, user["id"])
        )
        delta = 1
    conn.execute(
        "UPDATE goodreads_review SET likes_count = MAX(0, likes_count + ?) WHERE id = ?", (delta, review_id)
    )
    conn.commit()
    return serialize_review(conn, get_review(conn, review_id), user)


@app.post("/api/reviews/{review_id}/comment/", status_code=201)
def comment_review(review_id: int, payload: CommentPayload, user=Depends(current_user), conn=Depends(get_db)):
    get_review(conn, review_id)
    cursor = conn.execute(
        "INSERT INTO goodreads_reviewcomment (text, created_at, review_id, user_id) VALUES (?, ?, ?, ?)",
        (payload.text, now_iso(), review_id, user["id"]),
    )
    conn.execute(
        "UPDATE goodreads_review SET comments_count = (SELECT COUNT(*) FROM goodreads_reviewcomment WHERE review_id = ?) WHERE id = ?",
        (review_id, review_id),
    )
    conn.commit()
    comment = conn.execute("SELECT * FROM goodreads_reviewcomment WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return serialize_comment(conn, comment)


@app.get("/api/shelves/")
def list_shelves(
    request: Request,
    status: str = "",
    book: Optional[int] = None,
    page: int = Query(1, ge=1),
    user=Depends(current_user),
    conn=Depends(get_db),
):
    where = ["user_id = ?"]
    args = [user["id"]]
    if status:
        where.append("status = ?")
        args.append(status)
    if book:
        where.append("book_id = ?")
        args.append(book)
    clause = "WHERE " + " AND ".join(where)
    count = conn.execute(f"SELECT COUNT(*) FROM goodreads_shelf {clause}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM goodreads_shelf {clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        [*args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ).fetchall()
    return paginate(request, [serialize_shelf(conn, row) for row in rows], count=count, page=page)


@app.post("/api/shelves/", status_code=201)
def create_shelf(payload: ShelfPayload, user=Depends(current_user), conn=Depends(get_db)):
    timestamp = now_iso()
    existing = conn.execute(
        "SELECT * FROM goodreads_shelf WHERE user_id = ? AND book_id = ?", (user["id"], payload.book_id)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE goodreads_shelf SET status = ?, updated_at = ? WHERE id = ?",
            (payload.status, timestamp, existing["id"]),
        )
        shelf_id = existing["id"]
    else:
        cursor = conn.execute(
            "INSERT INTO goodreads_shelf (status, created_at, updated_at, book_id, user_id) VALUES (?, ?, ?, ?, ?)",
            (payload.status, timestamp, timestamp, payload.book_id, user["id"]),
        )
        shelf_id = cursor.lastrowid
    create_feed_event(conn, user["id"], "ADD_SHELF", payload.book_id, shelf_id=shelf_id)
    conn.commit()
    return serialize_shelf(conn, conn.execute("SELECT * FROM goodreads_shelf WHERE id = ?", (shelf_id,)).fetchone())


@app.delete("/api/shelves/{shelf_id}/", status_code=204)
def delete_shelf(shelf_id: int, user=Depends(current_user), conn=Depends(get_db)):
    shelf = conn.execute("SELECT * FROM goodreads_shelf WHERE id = ?", (shelf_id,)).fetchone()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    if shelf["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    conn.execute("DELETE FROM goodreads_shelf WHERE id = ?", (shelf_id,))
    conn.commit()
    return Response(status_code=204)


@app.get("/api/users/")
def list_users(
    request: Request,
    search: str = "",
    page: int = Query(1, ge=1),
    request_user=Depends(optional_user),
    conn=Depends(get_db),
):
    where = ""
    args = []
    if search:
        where = "WHERE username LIKE ? OR email LIKE ?"
        args = [f"%{search}%", f"%{search}%"]
    count = conn.execute(f"SELECT COUNT(*) FROM goodreads_user {where}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM goodreads_user {where} ORDER BY username LIMIT ? OFFSET ?",
        [*args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ).fetchall()
    return paginate(request, [serialize_user(conn, row, request_user) for row in rows], count=count, page=page)


@app.post("/api/users/{user_id}/follow/")
def follow_user(user_id: int, user=Depends(current_user), conn=Depends(get_db)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot follow yourself.")
    target = get_user_by_id(conn, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    conn.execute(
        "INSERT OR IGNORE INTO goodreads_user_followers (from_user_id, to_user_id) VALUES (?, ?)",
        (user["id"], user_id),
    )
    conn.commit()
    return serialize_user(conn, target, user)


@app.post("/api/users/{user_id}/unfollow/")
def unfollow_user(user_id: int, user=Depends(current_user), conn=Depends(get_db)):
    target = get_user_by_id(conn, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    conn.execute(
        "DELETE FROM goodreads_user_followers WHERE from_user_id = ? AND to_user_id = ?", (user["id"], user_id)
    )
    conn.commit()
    return serialize_user(conn, target, user)


@app.get("/api/feed/")
def feed(request: Request, page: int = Query(1, ge=1), user=Depends(current_user), conn=Depends(get_db)):
    rows = conn.execute(
        """
        SELECT f.* FROM goodreads_feedevent f
        WHERE f.user_id IN (SELECT to_user_id FROM goodreads_user_followers WHERE from_user_id = ?)
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
        """,
        (user["id"], PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    events = []
    for row in rows:
        review = get_review(conn, row["review_id"]) if row["review_id"] else None
        shelf = conn.execute("SELECT * FROM goodreads_shelf WHERE id = ?", (row["shelf_id"],)).fetchone() if row["shelf_id"] else None
        events.append(
            {
                "id": row["id"],
                "user": serialize_user(conn, get_user_by_id(conn, row["user_id"]), user),
                "type": row["type"],
                "book": serialize_book(get_book(conn, row["book_id"])),
                "review": serialize_review(conn, review, user) if review else None,
                "shelf_status": shelf["status"] if shelf else None,
                "created_at": row["created_at"],
            }
        )
    return paginate(request, events)


@app.get("/api/notifications/")
def notifications(request: Request, user=Depends(current_user), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT * FROM goodreads_notification WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", (user["id"],)
    ).fetchall()
    data = [
        {
            "id": row["id"],
            "actor": serialize_user(conn, get_user_by_id(conn, row["actor_id"]), user),
            "type": row["type"],
            "entity_id": row["entity_id"],
            "read_status": bool(row["read_status"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    return paginate(request, data)


@app.post("/api/notifications/{notification_id}/mark_read/")
def mark_notification_read(notification_id: int, user=Depends(current_user), conn=Depends(get_db)):
    conn.execute(
        "UPDATE goodreads_notification SET read_status = 1 WHERE id = ? AND user_id = ?",
        (notification_id, user["id"]),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM goodreads_notification WHERE id = ?", (notification_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {
        "id": row["id"],
        "actor": serialize_user(conn, get_user_by_id(conn, row["actor_id"]), user),
        "type": row["type"],
        "entity_id": row["entity_id"],
        "read_status": bool(row["read_status"]),
        "created_at": row["created_at"],
    }
