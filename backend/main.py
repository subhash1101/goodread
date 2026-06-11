import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "db.sqlite3"

# Use same env-var names as Django so .env keeps working
SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key"))
ALGORITHM = "HS256"
PAGE_SIZE = 20

app = FastAPI(title="Goodreads Clone API")
security = HTTPBearer(auto_error=False)


@app.on_event("startup")
def _ensure_tables():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS direct_messages (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id   INTEGER NOT NULL REFERENCES goodreads_user(id) ON DELETE CASCADE,
            receiver_id INTEGER NOT NULL REFERENCES goodreads_user(id) ON DELETE CASCADE,
            text        TEXT    NOT NULL,
            created_at  TEXT    NOT NULL,
            read_at     TEXT
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS dm_pair ON direct_messages(sender_id, receiver_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS dm_receiver ON direct_messages(receiver_id, created_at)")
    conn.commit()
    conn.close()

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

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    email: Optional[str] = ""
    password: str = Field(min_length=8)


class ReviewCreatePayload(BaseModel):
    book_id: int
    rating: int = Field(ge=1, le=5)
    review_text: str = ""


class ReviewUpdatePayload(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: str = ""


class ShelfPayload(BaseModel):
    book_id: int
    status: str


class ShelfUpdatePayload(BaseModel):
    status: str


class CommentPayload(BaseModel):
    text: str


class RefreshPayload(BaseModel):
    refresh: str


class MessagePayload(BaseModel):
    text: str = Field(min_length=1)


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------


def create_access_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=60)
    # Use 'user_id' (not 'sub') so the frontend parseJwtUserId() works unchanged
    return jwt.encode({"user_id": user_id, "token_type": "access", "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"user_id": user_id, "token_type": "refresh", "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    conn=Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = conn.execute("SELECT * FROM goodreads_user WHERE id = ?", (int(user_id),)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    conn=Depends(get_db),
):
    if not credentials:
        return None
    try:
        payload = _decode_token(credentials.credentials)
    except HTTPException:
        return None
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        return None
    return conn.execute("SELECT * FROM goodreads_user WHERE id = ?", (int(user_id),)).fetchone()


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------


def verify_password(password: str, encoded: str) -> bool:
    if not encoded or encoded.startswith("!"):
        return False
    try:
        algorithm, iterations, salt, stored = encoded.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    import base64
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
    return secrets.compare_digest(stored, base64.b64encode(digest).decode().strip())


def make_password(password: str) -> str:
    import base64
    salt = secrets.token_urlsafe(12)[:12]
    iterations = 870000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${base64.b64encode(digest).decode().strip()}"


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def decode_json(value, default):
    if value in (None, ""):
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def paginate(rows, count=None, page=1):
    count = len(rows) if count is None else count
    return {"count": count, "next": None, "previous": None, "results": rows}


def require_row(row, detail: str = "Not found"):
    if row is None:
        raise HTTPException(status_code=404, detail=detail)
    return row


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


def serialize_user(conn, user, request_user=None) -> dict:
    uid = user["id"]
    followers_count = conn.execute(
        "SELECT COUNT(*) FROM goodreads_user_followers WHERE to_user_id = ?", (uid,)
    ).fetchone()[0]
    following_count = conn.execute(
        "SELECT COUNT(*) FROM goodreads_user_followers WHERE from_user_id = ?", (uid,)
    ).fetchone()[0]
    is_following = False
    if request_user:
        is_following = bool(
            conn.execute(
                "SELECT 1 FROM goodreads_user_followers WHERE from_user_id = ? AND to_user_id = ?",
                (request_user["id"], uid),
            ).fetchone()
        )
    return {
        "id": uid,
        "username": user["username"],
        "email": user["email"],
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
    }


def serialize_book(row, detail: bool = False) -> dict:
    data = {
        "id": row["id"],
        "work_id": row["work_id"],
        "title": row["title"],
        "author": row["author"],
        "genres": decode_json(row["genres"], []),
        "image_url": row["image_url"] or "",
        "avg_rating": str(row["avg_rating"]),
        "ratings_count": row["ratings_count"],
        "original_publication_year": row["original_publication_year"],
    }
    if detail:
        data.update(
            {
                "isbn": row["isbn"] or "",
                "isbn13": row["isbn13"] or "",
                "num_pages": row["num_pages"],
                "description": row["description"] or "",
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


def _get_book(conn, book_id: int):
    return require_row(
        conn.execute("SELECT * FROM goodreads_book WHERE id = ?", (book_id,)).fetchone(),
        f"Book {book_id} not found",
    )


def _get_review(conn, review_id: int):
    return require_row(
        conn.execute("SELECT * FROM goodreads_review WHERE id = ?", (review_id,)).fetchone(),
        f"Review {review_id} not found",
    )


def _get_user(conn, user_id: int):
    return require_row(
        conn.execute("SELECT * FROM goodreads_user WHERE id = ?", (user_id,)).fetchone(),
        f"User {user_id} not found",
    )


def serialize_comment(conn, comment) -> dict:
    return {
        "id": comment["id"],
        "user": serialize_user(conn, _get_user(conn, comment["user_id"])),
        "text": comment["text"],
        "created_at": comment["created_at"],
    }


def serialize_review(conn, review, request_user=None) -> dict:
    comments = conn.execute(
        "SELECT * FROM goodreads_reviewcomment WHERE review_id = ? ORDER BY created_at",
        (review["id"],),
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
        "user": serialize_user(conn, _get_user(conn, review["user_id"]), request_user),
        "book": serialize_book(_get_book(conn, review["book_id"])),
        "book_id": review["book_id"],
        "rating": review["rating"],
        "review_text": review["review_text"] or "",
        "likes_count": review["likes_count"],
        "comments_count": review["comments_count"],
        "liked": liked,
        "comments": [serialize_comment(conn, c) for c in comments],
        "created_at": review["created_at"],
        "updated_at": review["updated_at"],
    }


def serialize_shelf(conn, shelf) -> dict:
    return {
        "id": shelf["id"],
        "book": serialize_book(_get_book(conn, shelf["book_id"])),
        "book_id": shelf["book_id"],
        "status": shelf["status"],
        "created_at": shelf["created_at"],
        "updated_at": shelf["updated_at"],
    }


def serialize_notification(conn, row, request_user=None) -> dict:
    actor = conn.execute("SELECT * FROM goodreads_user WHERE id = ?", (row["actor_id"],)).fetchone()
    return {
        "id": row["id"],
        "actor": serialize_user(conn, actor, request_user) if actor else None,
        "type": row["type"],
        "entity_id": row["entity_id"] or "",
        "read_status": bool(row["read_status"]),
        "created_at": row["created_at"],
    }


# ---------------------------------------------------------------------------
# DB helper: create feed event
# ---------------------------------------------------------------------------


def _create_feed_event(conn, user_id: int, event_type: str, book_id: int, review_id=None, shelf_id=None):
    conn.execute(
        "INSERT INTO goodreads_feedevent (type, created_at, book_id, review_id, shelf_id, user_id) VALUES (?,?,?,?,?,?)",
        (event_type, now_iso(), book_id, review_id, shelf_id, user_id),
    )


def _recalculate_rating(conn, book_id: int):
    row = conn.execute(
        "SELECT AVG(CAST(rating AS REAL)) AS avg, COUNT(*) AS cnt FROM goodreads_review WHERE book_id = ? AND rating >= 1",
        (book_id,),
    ).fetchone()
    if row["cnt"]:
        conn.execute(
            "UPDATE goodreads_book SET avg_rating = ?, ratings_count = ?, updated_at = ? WHERE id = ?",
            (round(row["avg"], 2), row["cnt"], now_iso(), book_id),
        )


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health/")
def health():
    return {"ok": True}


@app.post("/api/auth/login/")
def login(payload: LoginPayload, conn=Depends(get_db)):
    user = conn.execute(
        "SELECT * FROM goodreads_user WHERE username = ?", (payload.username,)
    ).fetchone()
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="No active account found with the given credentials")
    return {
        "access": create_access_token(user["id"]),
        "refresh": create_refresh_token(user["id"]),
    }


@app.post("/api/auth/refresh/")
def refresh_token(payload: RefreshPayload, conn=Depends(get_db)):
    data = _decode_token(payload.refresh)
    if data.get("token_type") != "refresh":
        raise HTTPException(status_code=400, detail="Not a refresh token")
    user_id = data.get("user_id") or data.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = conn.execute("SELECT id FROM goodreads_user WHERE id = ?", (int(user_id),)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"access": create_access_token(int(user_id))}


@app.post("/api/auth/register/", status_code=201)
def register(payload: RegisterPayload, conn=Depends(get_db)):
    exists = conn.execute(
        "SELECT 1 FROM goodreads_user WHERE username = ?", (payload.username,)
    ).fetchone()
    if exists:
        raise HTTPException(status_code=400, detail="Username already exists")
    timestamp = now_iso()
    cursor = conn.execute(
        """
        INSERT INTO goodreads_user
        (password, last_login, is_superuser, username, first_name, last_name,
         email, is_staff, is_active, date_joined)
        VALUES (?, NULL, 0, ?, '', '', ?, 0, 1, ?)
        """,
        (make_password(payload.password), payload.username, payload.email or "", timestamp),
    )
    conn.commit()
    return serialize_user(conn, _get_user(conn, cursor.lastrowid))


# ---------------------------------------------------------------------------
# Book endpoints
# ---------------------------------------------------------------------------


@app.get("/api/books/recommendations/")
def recommendations(user=Depends(current_user), conn=Depends(get_db)):
    rows = conn.execute(
        """
        SELECT * FROM goodreads_book
        WHERE id NOT IN (
            SELECT book_id FROM goodreads_shelf WHERE user_id = ?
        )
        ORDER BY avg_rating DESC, ratings_count DESC
        LIMIT 20
        """,
        (user["id"],),
    ).fetchall()
    return [serialize_book(r) for r in rows]


@app.get("/api/books/popular/")
def popular_books(conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT * FROM goodreads_book ORDER BY ratings_count DESC, avg_rating DESC LIMIT 20"
    ).fetchall()
    return [serialize_book(r) for r in rows]


@app.get("/api/books/")
def list_books(
    search: str = "",
    genre: str = "",
    page: int = Query(1, ge=1),
    conn=Depends(get_db),
):
    where: list[str] = []
    args: list = []
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
    return paginate([serialize_book(r) for r in rows], count=count, page=page)


@app.get("/api/books/{book_id}/similar/")
def similar_books(book_id: int, conn=Depends(get_db)):
    book = _get_book(conn, book_id)
    work_ids = [int(x) for x in decode_json(book["similar_books"], []) if str(x).isdigit()]
    if not work_ids:
        return []
    placeholders = ",".join("?" * len(work_ids[:20]))
    rows = conn.execute(
        f"SELECT * FROM goodreads_book WHERE work_id IN ({placeholders}) LIMIT 20", work_ids[:20]
    ).fetchall()
    return [serialize_book(r) for r in rows]


@app.get("/api/books/{book_id}/")
def book_detail(book_id: int, conn=Depends(get_db)):
    return serialize_book(_get_book(conn, book_id), detail=True)


# ---------------------------------------------------------------------------
# Review endpoints
# ---------------------------------------------------------------------------


@app.get("/api/reviews/")
def list_reviews(
    book: Optional[int] = None,
    user: Optional[int] = Query(None, alias="user"),
    mine: bool = False,
    page: int = Query(1, ge=1),
    request_user=Depends(optional_user),
    conn=Depends(get_db),
):
    where: list[str] = []
    args: list = []
    if book:
        where.append("book_id = ?")
        args.append(book)
    if user:
        where.append("user_id = ?")
        args.append(user)
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
    return paginate([serialize_review(conn, r, request_user) for r in rows], count=count, page=page)


@app.get("/api/reviews/{review_id}/")
def get_review(review_id: int, request_user=Depends(optional_user), conn=Depends(get_db)):
    return serialize_review(conn, _get_review(conn, review_id), request_user)


@app.post("/api/reviews/", status_code=201)
def create_review(payload: ReviewCreatePayload, user=Depends(current_user), conn=Depends(get_db)):
    _get_book(conn, payload.book_id)  # 404 if not found
    timestamp = now_iso()
    existing = conn.execute(
        "SELECT * FROM goodreads_review WHERE user_id = ? AND book_id = ?",
        (user["id"], payload.book_id),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE goodreads_review SET rating = ?, review_text = ?, updated_at = ? WHERE id = ?",
            (payload.rating, payload.review_text, timestamp, existing["id"]),
        )
        review_id = existing["id"]
    else:
        rid = f"user-{user['id']}-book-{payload.book_id}"
        cursor = conn.execute(
            """
            INSERT INTO goodreads_review
            (review_id, rating, review_text, likes_count, comments_count,
             created_at, updated_at, book_id, user_id)
            VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
            """,
            (rid, payload.rating, payload.review_text, timestamp, timestamp, payload.book_id, user["id"]),
        )
        review_id = cursor.lastrowid
    _recalculate_rating(conn, payload.book_id)
    event_type = "REVIEW" if payload.review_text.strip() else "RATE"
    _create_feed_event(conn, user["id"], event_type, payload.book_id, review_id=review_id)
    conn.commit()
    return serialize_review(conn, _get_review(conn, review_id), user)


@app.put("/api/reviews/{review_id}/")
def update_review(review_id: int, payload: ReviewUpdatePayload, user=Depends(current_user), conn=Depends(get_db)):
    review = _get_review(conn, review_id)
    if review["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    timestamp = now_iso()
    conn.execute(
        "UPDATE goodreads_review SET rating = ?, review_text = ?, updated_at = ? WHERE id = ?",
        (payload.rating, payload.review_text, timestamp, review_id),
    )
    _recalculate_rating(conn, review["book_id"])
    event_type = "REVIEW" if payload.review_text.strip() else "RATE"
    _create_feed_event(conn, user["id"], event_type, review["book_id"], review_id=review_id)
    conn.commit()
    return serialize_review(conn, _get_review(conn, review_id), user)


@app.patch("/api/reviews/{review_id}/")
def patch_review(review_id: int, payload: ReviewUpdatePayload, user=Depends(current_user), conn=Depends(get_db)):
    return update_review(review_id, payload, user, conn)


@app.delete("/api/reviews/{review_id}/", status_code=204)
def delete_review(review_id: int, user=Depends(current_user), conn=Depends(get_db)):
    review = _get_review(conn, review_id)
    if review["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    conn.execute("DELETE FROM goodreads_review WHERE id = ?", (review_id,))
    _recalculate_rating(conn, review["book_id"])
    conn.commit()
    return Response(status_code=204)


@app.post("/api/reviews/{review_id}/like/")
def like_review(review_id: int, user=Depends(current_user), conn=Depends(get_db)):
    review = _get_review(conn, review_id)
    already = conn.execute(
        "SELECT id FROM goodreads_review_liked_by WHERE review_id = ? AND user_id = ?",
        (review_id, user["id"]),
    ).fetchone()
    if already:
        conn.execute("DELETE FROM goodreads_review_liked_by WHERE id = ?", (already["id"],))
        delta = -1
    else:
        conn.execute(
            "INSERT INTO goodreads_review_liked_by (review_id, user_id) VALUES (?, ?)",
            (review_id, user["id"]),
        )
        delta = 1
        if review["user_id"] != user["id"]:
            conn.execute(
                """
                INSERT INTO goodreads_notification (type, entity_id, read_status, created_at, actor_id, user_id)
                VALUES ('LIKE', ?, 0, ?, ?, ?)
                """,
                (str(review_id), now_iso(), user["id"], review["user_id"]),
            )
    conn.execute(
        "UPDATE goodreads_review SET likes_count = MAX(0, likes_count + ?) WHERE id = ?",
        (delta, review_id),
    )
    conn.commit()
    return serialize_review(conn, _get_review(conn, review_id), user)


@app.post("/api/reviews/{review_id}/comment/", status_code=201)
def comment_review(review_id: int, payload: CommentPayload, user=Depends(current_user), conn=Depends(get_db)):
    review = _get_review(conn, review_id)
    cursor = conn.execute(
        "INSERT INTO goodreads_reviewcomment (text, created_at, review_id, user_id) VALUES (?, ?, ?, ?)",
        (payload.text, now_iso(), review_id, user["id"]),
    )
    comment_id = cursor.lastrowid
    conn.execute(
        """
        UPDATE goodreads_review
        SET comments_count = (SELECT COUNT(*) FROM goodreads_reviewcomment WHERE review_id = ?)
        WHERE id = ?
        """,
        (review_id, review_id),
    )
    if review["user_id"] != user["id"]:
        conn.execute(
            """
            INSERT INTO goodreads_notification (type, entity_id, read_status, created_at, actor_id, user_id)
            VALUES ('COMMENT', ?, 0, ?, ?, ?)
            """,
            (str(comment_id), now_iso(), user["id"], review["user_id"]),
        )
    conn.commit()
    comment = conn.execute(
        "SELECT * FROM goodreads_reviewcomment WHERE id = ?", (comment_id,)
    ).fetchone()
    return serialize_comment(conn, comment)


# ---------------------------------------------------------------------------
# Shelf endpoints
# ---------------------------------------------------------------------------


@app.get("/api/shelves/")
def list_shelves(
    status: str = "",
    book: Optional[int] = None,
    page: int = Query(1, ge=1),
    user=Depends(current_user),
    conn=Depends(get_db),
):
    where = ["user_id = ?"]
    args: list = [user["id"]]
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
    return paginate([serialize_shelf(conn, r) for r in rows], count=count, page=page)


@app.post("/api/shelves/", status_code=201)
def create_shelf(payload: ShelfPayload, user=Depends(current_user), conn=Depends(get_db)):
    _get_book(conn, payload.book_id)  # 404 if not found
    timestamp = now_iso()
    existing = conn.execute(
        "SELECT * FROM goodreads_shelf WHERE user_id = ? AND book_id = ?",
        (user["id"], payload.book_id),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE goodreads_shelf SET status = ?, updated_at = ? WHERE id = ?",
            (payload.status, timestamp, existing["id"]),
        )
        shelf_id = existing["id"]
    else:
        cursor = conn.execute(
            "INSERT INTO goodreads_shelf (status, created_at, updated_at, book_id, user_id) VALUES (?,?,?,?,?)",
            (payload.status, timestamp, timestamp, payload.book_id, user["id"]),
        )
        shelf_id = cursor.lastrowid
    _create_feed_event(conn, user["id"], "ADD_SHELF", payload.book_id, shelf_id=shelf_id)
    conn.commit()
    return serialize_shelf(conn, conn.execute("SELECT * FROM goodreads_shelf WHERE id = ?", (shelf_id,)).fetchone())


@app.put("/api/shelves/{shelf_id}/")
def update_shelf(shelf_id: int, payload: ShelfUpdatePayload, user=Depends(current_user), conn=Depends(get_db)):
    shelf = require_row(
        conn.execute("SELECT * FROM goodreads_shelf WHERE id = ?", (shelf_id,)).fetchone(),
        "Shelf not found",
    )
    if shelf["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    conn.execute(
        "UPDATE goodreads_shelf SET status = ?, updated_at = ? WHERE id = ?",
        (payload.status, now_iso(), shelf_id),
    )
    _create_feed_event(conn, user["id"], "ADD_SHELF", shelf["book_id"], shelf_id=shelf_id)
    conn.commit()
    return serialize_shelf(conn, conn.execute("SELECT * FROM goodreads_shelf WHERE id = ?", (shelf_id,)).fetchone())


@app.patch("/api/shelves/{shelf_id}/")
def patch_shelf(shelf_id: int, payload: ShelfUpdatePayload, user=Depends(current_user), conn=Depends(get_db)):
    return update_shelf(shelf_id, payload, user, conn)


@app.delete("/api/shelves/{shelf_id}/", status_code=204)
def delete_shelf(shelf_id: int, user=Depends(current_user), conn=Depends(get_db)):
    shelf = require_row(
        conn.execute("SELECT * FROM goodreads_shelf WHERE id = ?", (shelf_id,)).fetchone(),
        "Shelf not found",
    )
    if shelf["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    conn.execute("DELETE FROM goodreads_shelf WHERE id = ?", (shelf_id,))
    conn.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# User endpoints
# ---------------------------------------------------------------------------


@app.get("/api/users/me/")
def get_me(user=Depends(current_user), conn=Depends(get_db)):
    return serialize_user(conn, user, user)


@app.get("/api/users/")
def list_users(
    search: str = "",
    page: int = Query(1, ge=1),
    request_user=Depends(optional_user),
    conn=Depends(get_db),
):
    where = ""
    args: list = []
    if search:
        where = "WHERE username LIKE ? OR email LIKE ?"
        args = [f"%{search}%", f"%{search}%"]
    count = conn.execute(f"SELECT COUNT(*) FROM goodreads_user {where}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM goodreads_user {where} ORDER BY username LIMIT ? OFFSET ?",
        [*args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ).fetchall()
    return paginate([serialize_user(conn, r, request_user) for r in rows], count=count, page=page)


@app.get("/api/users/{user_id}/followers/")
def user_followers(
    user_id: int,
    page: int = Query(1, ge=1),
    request_user=Depends(optional_user),
    conn=Depends(get_db),
):
    _get_user(conn, user_id)  # 404 if not found
    count = conn.execute(
        "SELECT COUNT(*) FROM goodreads_user_followers WHERE to_user_id = ?", (user_id,)
    ).fetchone()[0]
    rows = conn.execute(
        """
        SELECT u.* FROM goodreads_user u
        INNER JOIN goodreads_user_followers f ON u.id = f.from_user_id
        WHERE f.to_user_id = ?
        ORDER BY u.username
        LIMIT ? OFFSET ?
        """,
        (user_id, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    return paginate([serialize_user(conn, r, request_user) for r in rows], count=count, page=page)


@app.get("/api/users/{user_id}/following/")
def user_following(
    user_id: int,
    page: int = Query(1, ge=1),
    request_user=Depends(optional_user),
    conn=Depends(get_db),
):
    _get_user(conn, user_id)  # 404 if not found
    count = conn.execute(
        "SELECT COUNT(*) FROM goodreads_user_followers WHERE from_user_id = ?", (user_id,)
    ).fetchone()[0]
    rows = conn.execute(
        """
        SELECT u.* FROM goodreads_user u
        INNER JOIN goodreads_user_followers f ON u.id = f.to_user_id
        WHERE f.from_user_id = ?
        ORDER BY u.username
        LIMIT ? OFFSET ?
        """,
        (user_id, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    return paginate([serialize_user(conn, r, request_user) for r in rows], count=count, page=page)


@app.get("/api/users/{user_id}/")
def get_user(user_id: int, request_user=Depends(optional_user), conn=Depends(get_db)):
    return serialize_user(conn, _get_user(conn, user_id), request_user)


@app.post("/api/users/{user_id}/follow/")
def follow_user(user_id: int, user=Depends(current_user), conn=Depends(get_db)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot follow yourself.")
    target = _get_user(conn, user_id)
    already = conn.execute(
        "SELECT 1 FROM goodreads_user_followers WHERE from_user_id = ? AND to_user_id = ?",
        (user["id"], user_id),
    ).fetchone()
    if not already:
        conn.execute(
            "INSERT INTO goodreads_user_followers (from_user_id, to_user_id) VALUES (?, ?)",
            (user["id"], user_id),
        )
        # Notify the followed user
        conn.execute(
            """
            INSERT INTO goodreads_notification (type, entity_id, read_status, created_at, actor_id, user_id)
            VALUES ('FOLLOW', '', 0, ?, ?, ?)
            """,
            (now_iso(), user["id"], user_id),
        )
        conn.commit()
    return serialize_user(conn, target, user)


@app.post("/api/users/{user_id}/unfollow/")
def unfollow_user(user_id: int, user=Depends(current_user), conn=Depends(get_db)):
    target = _get_user(conn, user_id)
    conn.execute(
        "DELETE FROM goodreads_user_followers WHERE from_user_id = ? AND to_user_id = ?",
        (user["id"], user_id),
    )
    conn.commit()
    return serialize_user(conn, target, user)


# ---------------------------------------------------------------------------
# Feed endpoints
# ---------------------------------------------------------------------------


@app.get("/api/feed/")
def feed(
    page: int = Query(1, ge=1),
    user=Depends(current_user),
    conn=Depends(get_db),
):
    count = conn.execute(
        """
        SELECT COUNT(*) FROM goodreads_feedevent
        WHERE user_id IN (SELECT to_user_id FROM goodreads_user_followers WHERE from_user_id = ?)
        """,
        (user["id"],),
    ).fetchone()[0]
    rows = conn.execute(
        """
        SELECT f.* FROM goodreads_feedevent f
        WHERE f.user_id IN (
            SELECT to_user_id FROM goodreads_user_followers WHERE from_user_id = ?
        )
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
        """,
        (user["id"], PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    events = []
    for row in rows:
        review = None
        if row["review_id"]:
            rv = conn.execute("SELECT * FROM goodreads_review WHERE id = ?", (row["review_id"],)).fetchone()
            if rv:
                review = serialize_review(conn, rv, user)
        shelf_status = None
        if row["shelf_id"]:
            sh = conn.execute("SELECT status FROM goodreads_shelf WHERE id = ?", (row["shelf_id"],)).fetchone()
            if sh:
                shelf_status = sh["status"]
        actor = conn.execute("SELECT * FROM goodreads_user WHERE id = ?", (row["user_id"],)).fetchone()
        events.append(
            {
                "id": row["id"],
                "user": serialize_user(conn, actor, user) if actor else None,
                "type": row["type"],
                "book": serialize_book(_get_book(conn, row["book_id"])),
                "review": review,
                "shelf_status": shelf_status,
                "created_at": row["created_at"],
            }
        )
    return paginate(events, count=count, page=page)


# ---------------------------------------------------------------------------
# Notification endpoints
# ---------------------------------------------------------------------------


@app.get("/api/notifications/")
def list_notifications(
    page: int = Query(1, ge=1),
    user=Depends(current_user),
    conn=Depends(get_db),
):
    count = conn.execute(
        "SELECT COUNT(*) FROM goodreads_notification WHERE user_id = ?", (user["id"],)
    ).fetchone()[0]
    rows = conn.execute(
        "SELECT * FROM goodreads_notification WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (user["id"], PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    return paginate([serialize_notification(conn, r, user) for r in rows], count=count, page=page)


@app.post("/api/notifications/{notification_id}/mark_read/")
def mark_read(notification_id: int, user=Depends(current_user), conn=Depends(get_db)):
    conn.execute(
        "UPDATE goodreads_notification SET read_status = 1 WHERE id = ? AND user_id = ?",
        (notification_id, user["id"]),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM goodreads_notification WHERE id = ?", (notification_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return serialize_notification(conn, row, user)


# ---------------------------------------------------------------------------
# Direct message endpoints
# ---------------------------------------------------------------------------

def _is_mutual(conn, a_id: int, b_id: int) -> bool:
    """Return True only if both users follow each other."""
    a_follows_b = conn.execute(
        "SELECT 1 FROM goodreads_user_followers WHERE from_user_id = ? AND to_user_id = ?",
        (a_id, b_id),
    ).fetchone()
    b_follows_a = conn.execute(
        "SELECT 1 FROM goodreads_user_followers WHERE from_user_id = ? AND to_user_id = ?",
        (b_id, a_id),
    ).fetchone()
    return bool(a_follows_b and b_follows_a)


def _serialize_message(msg, me_id: int) -> dict:
    return {
        "id": msg["id"],
        "sender_id": msg["sender_id"],
        "receiver_id": msg["receiver_id"],
        "text": msg["text"],
        "from_me": msg["sender_id"] == me_id,
        "created_at": msg["created_at"],
        "read_at": msg["read_at"],
    }


@app.get("/api/messages/friends/")
def message_friends(user=Depends(current_user), conn=Depends(get_db)):
    """
    Return all users who mutually follow the current user —
    these are the people the current user can chat with.
    """
    rows = conn.execute(
        """
        SELECT u.* FROM goodreads_user u
        WHERE u.id IN (
            SELECT from_user_id FROM goodreads_user_followers WHERE to_user_id = ?
        )
        AND u.id IN (
            SELECT to_user_id FROM goodreads_user_followers WHERE from_user_id = ?
        )
        ORDER BY u.username
        """,
        (user["id"], user["id"]),
    ).fetchall()

    friends = []
    for r in rows:
        # Attach the last message between the two and unread count
        last = conn.execute(
            """
            SELECT * FROM direct_messages
            WHERE (sender_id = ? AND receiver_id = ?)
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at DESC LIMIT 1
            """,
            (user["id"], r["id"], r["id"], user["id"]),
        ).fetchone()
        unread = conn.execute(
            "SELECT COUNT(*) FROM direct_messages WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL",
            (r["id"], user["id"]),
        ).fetchone()[0]
        friends.append(
            {
                **serialize_user(conn, r, user),
                "last_message": last["text"] if last else None,
                "last_message_at": last["created_at"] if last else None,
                "unread_count": unread,
            }
        )
    return friends


@app.get("/api/messages/{other_user_id}/")
def get_conversation(
    other_user_id: int,
    page: int = Query(1, ge=1),
    user=Depends(current_user),
    conn=Depends(get_db),
):
    """Return the conversation (oldest-first) between current user and other_user_id."""
    _get_user(conn, other_user_id)
    if not _is_mutual(conn, user["id"], other_user_id):
        raise HTTPException(status_code=403, detail="You can only message mutual followers.")

    # Mark incoming messages as read
    conn.execute(
        "UPDATE direct_messages SET read_at = ? WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL",
        (now_iso(), other_user_id, user["id"]),
    )
    conn.commit()

    count = conn.execute(
        """
        SELECT COUNT(*) FROM direct_messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        """,
        (user["id"], other_user_id, other_user_id, user["id"]),
    ).fetchone()[0]

    rows = conn.execute(
        """
        SELECT * FROM direct_messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
        """,
        (user["id"], other_user_id, other_user_id, user["id"],
         PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()

    return paginate([_serialize_message(r, user["id"]) for r in rows], count=count, page=page)


@app.post("/api/messages/{other_user_id}/", status_code=201)
def send_message(
    other_user_id: int,
    payload: MessagePayload,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    """Send a direct message to other_user_id (must be a mutual follower)."""
    _get_user(conn, other_user_id)
    if user["id"] == other_user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself.")
    if not _is_mutual(conn, user["id"], other_user_id):
        raise HTTPException(status_code=403, detail="You can only message mutual followers.")

    timestamp = now_iso()
    cursor = conn.execute(
        "INSERT INTO direct_messages (sender_id, receiver_id, text, created_at) VALUES (?, ?, ?, ?)",
        (user["id"], other_user_id, payload.text.strip(), timestamp),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM direct_messages WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return _serialize_message(row, user["id"])
