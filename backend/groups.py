"""
Groups & Community module — fully self-contained.

Does NOT import from main.py (avoids circular import).
main.py imports groups_router from this file at the bottom — one-way only.
"""

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Constants — mirrors main.py exactly
# ---------------------------------------------------------------------------

BASE_DIR   = Path(__file__).resolve().parents[1]
DB_PATH    = BASE_DIR / "db.sqlite3"
PAGE_SIZE  = 20
SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key"))
ALGORITHM  = "HS256"

_security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Table bootstrap
# ---------------------------------------------------------------------------


def _bootstrap() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS groups (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL UNIQUE,
            description TEXT    NOT NULL DEFAULT '',
            privacy     TEXT    NOT NULL DEFAULT 'public',
            created_at  TEXT    NOT NULL,
            created_by  INTEGER NOT NULL REFERENCES goodreads_user(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS group_memberships (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            user_id   INTEGER NOT NULL REFERENCES goodreads_user(id) ON DELETE CASCADE,
            role      TEXT    NOT NULL DEFAULT 'member',
            state     TEXT    NOT NULL DEFAULT 'active',
            joined_at TEXT    NOT NULL,
            UNIQUE(group_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS group_discussions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            user_id    INTEGER NOT NULL REFERENCES goodreads_user(id) ON DELETE CASCADE,
            title      TEXT    NOT NULL,
            body       TEXT    NOT NULL DEFAULT '',
            is_pinned  INTEGER NOT NULL DEFAULT 0,
            created_at TEXT    NOT NULL,
            updated_at TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS group_comments (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            discussion_id     INTEGER NOT NULL REFERENCES group_discussions(id) ON DELETE CASCADE,
            user_id           INTEGER NOT NULL REFERENCES goodreads_user(id) ON DELETE CASCADE,
            parent_comment_id INTEGER     NULL REFERENCES group_comments(id) ON DELETE CASCADE,
            body              TEXT    NOT NULL,
            created_at        TEXT    NOT NULL,
            updated_at        TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS group_activity (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            user_id       INTEGER NOT NULL REFERENCES goodreads_user(id) ON DELETE CASCADE,
            event_type    TEXT    NOT NULL,
            discussion_id INTEGER     NULL REFERENCES group_discussions(id) ON DELETE SET NULL,
            comment_id    INTEGER     NULL REFERENCES group_comments(id)    ON DELETE SET NULL,
            created_at    TEXT    NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_gm_group      ON group_memberships(group_id);
        CREATE INDEX IF NOT EXISTS idx_gm_user       ON group_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_gd_group      ON group_discussions(group_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_gc_discussion ON group_comments(discussion_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_ga_group      ON group_activity(group_id, created_at);
        """
    )
    conn.commit()
    conn.close()


_bootstrap()

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class GroupCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    privacy: str = "public"


class DiscussionCreatePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


class DiscussionUpdatePayload(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None


class GroupCommentPayload(BaseModel):
    body: str = Field(min_length=1)
    parent_comment_id: Optional[int] = None


class MemberRolePayload(BaseModel):
    role: str


# ---------------------------------------------------------------------------
# Shared DB / auth utilities (self-contained, same logic as main.py)
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


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    conn=Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = conn.execute(
        "SELECT * FROM goodreads_user WHERE id = ?", (int(user_id),)
    ).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
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
    return conn.execute(
        "SELECT * FROM goodreads_user WHERE id = ?", (int(user_id),)
    ).fetchone()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def paginate(rows, count=None, page=1):
    count = len(rows) if count is None else count
    return {"count": count, "next": None, "previous": None, "results": rows}


def require_row(row, detail: str = "Not found"):
    if row is None:
        raise HTTPException(status_code=404, detail=detail)
    return row


def _get_user(conn, user_id: int):
    return require_row(
        conn.execute(
            "SELECT * FROM goodreads_user WHERE id = ?", (user_id,)
        ).fetchone(),
        f"User {user_id} not found",
    )


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


# ---------------------------------------------------------------------------
# DB getters
# ---------------------------------------------------------------------------


def _get_group(conn, group_id: int):
    return require_row(
        conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone(),
        f"Group {group_id} not found",
    )


def _get_discussion(conn, discussion_id: int):
    return require_row(
        conn.execute(
            "SELECT * FROM group_discussions WHERE id = ?", (discussion_id,)
        ).fetchone(),
        f"Discussion {discussion_id} not found",
    )


def _get_group_comment(conn, comment_id: int):
    return require_row(
        conn.execute(
            "SELECT * FROM group_comments WHERE id = ?", (comment_id,)
        ).fetchone(),
        f"Comment {comment_id} not found",
    )


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------


def _get_membership(conn, group_id: int, user_id: int):
    return conn.execute(
        "SELECT * FROM group_memberships WHERE group_id = ? AND user_id = ?",
        (group_id, user_id),
    ).fetchone()


def _is_banned(conn, group_id: int, user_id: int) -> bool:
    m = _get_membership(conn, group_id, user_id)
    return bool(m and m["state"] == "banned")


def _require_active_member(conn, group_id: int, user_id: int):
    m = _get_membership(conn, group_id, user_id)
    if not m or m["state"] != "active":
        raise HTTPException(
            status_code=403, detail="You must be an active member of this group."
        )
    return m


def _require_admin_or_mod(conn, group_id: int, user_id: int):
    m = _require_active_member(conn, group_id, user_id)
    if m["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Admin or moderator access required.")
    return m


def _require_admin(conn, group_id: int, user_id: int):
    m = _require_active_member(conn, group_id, user_id)
    if m["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return m


# ---------------------------------------------------------------------------
# Internal utilities
# ---------------------------------------------------------------------------


def _notify(conn, *, user_id: int, actor_id: int, ntype: str, entity_id: str = "") -> None:
    conn.execute(
        """
        INSERT INTO goodreads_notification
            (type, entity_id, read_status, created_at, actor_id, user_id)
        VALUES (?, ?, 0, ?, ?, ?)
        """,
        (ntype, entity_id, now_iso(), actor_id, user_id),
    )


def _log_activity(
    conn,
    *,
    group_id: int,
    user_id: int,
    event_type: str,
    discussion_id: Optional[int] = None,
    comment_id: Optional[int] = None,
) -> None:
    conn.execute(
        """
        INSERT INTO group_activity
            (group_id, user_id, event_type, discussion_id, comment_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (group_id, user_id, event_type, discussion_id, comment_id, now_iso()),
    )


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


def _serialize_group(conn, group, user=None) -> dict:
    member_count = conn.execute(
        "SELECT COUNT(*) FROM group_memberships WHERE group_id = ? AND state = 'active'",
        (group["id"],),
    ).fetchone()[0]
    membership = None
    if user:
        m = _get_membership(conn, group["id"], user["id"])
        if m:
            membership = {"role": m["role"], "state": m["state"]}
    creator_row = conn.execute(
        "SELECT * FROM goodreads_user WHERE id = ?", (group["created_by"],)
    ).fetchone()
    return {
        "id": group["id"],
        "name": group["name"],
        "description": group["description"],
        "privacy": group["privacy"],
        "member_count": member_count,
        "created_at": group["created_at"],
        "created_by": serialize_user(conn, creator_row) if creator_row else None,
        "membership": membership,
    }


def _serialize_discussion(conn, disc) -> dict:
    comment_count = conn.execute(
        "SELECT COUNT(*) FROM group_comments WHERE discussion_id = ?", (disc["id"],)
    ).fetchone()[0]
    author_row = conn.execute(
        "SELECT * FROM goodreads_user WHERE id = ?", (disc["user_id"],)
    ).fetchone()
    return {
        "id": disc["id"],
        "group_id": disc["group_id"],
        "title": disc["title"],
        "body": disc["body"],
        "is_pinned": bool(disc["is_pinned"]),
        "comment_count": comment_count,
        "created_at": disc["created_at"],
        "updated_at": disc["updated_at"],
        "author": serialize_user(conn, author_row) if author_row else None,
    }


def _build_comment_tree(conn, flat: list, parent_id: Optional[int] = None) -> list:
    """Build nested comment tree from a flat pre-fetched list — no per-node queries."""
    result = []
    for c in flat:
        if c["parent_comment_id"] == parent_id:
            author_row = conn.execute(
                "SELECT * FROM goodreads_user WHERE id = ?", (c["user_id"],)
            ).fetchone()
            result.append(
                {
                    "id": c["id"],
                    "discussion_id": c["discussion_id"],
                    "parent_comment_id": c["parent_comment_id"],
                    "body": c["body"],
                    "created_at": c["created_at"],
                    "updated_at": c["updated_at"],
                    "author": serialize_user(conn, author_row) if author_row else None,
                    "replies": _build_comment_tree(conn, flat, c["id"]),
                }
            )
    return result


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

groups_router = APIRouter(tags=["groups"])


# ── Groups CRUD ──────────────────────────────────────────────────────────────


@groups_router.post("/groups/", status_code=201)
def create_group(
    payload: GroupCreatePayload,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    if payload.privacy not in ("public", "private"):
        raise HTTPException(status_code=400, detail="privacy must be 'public' or 'private'.")
    if conn.execute("SELECT 1 FROM groups WHERE name = ?", (payload.name,)).fetchone():
        raise HTTPException(status_code=400, detail="A group with this name already exists.")
    ts = now_iso()
    cur = conn.execute(
        "INSERT INTO groups (name, description, privacy, created_at, created_by) VALUES (?, ?, ?, ?, ?)",
        (payload.name, payload.description, payload.privacy, ts, user["id"]),
    )
    group_id = cur.lastrowid
    conn.execute(
        "INSERT INTO group_memberships (group_id, user_id, role, state, joined_at) VALUES (?, ?, 'admin', 'active', ?)",
        (group_id, user["id"], ts),
    )
    conn.commit()
    return _serialize_group(
        conn,
        conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone(),
        user,
    )


@groups_router.get("/groups/")
def list_groups(
    search: str = "",
    page: int = Query(1, ge=1),
    user=Depends(optional_user),
    conn=Depends(get_db),
):
    if search:
        clause = "WHERE name LIKE ? OR description LIKE ?"
        args: tuple = (f"%{search}%", f"%{search}%")
    else:
        clause, args = "", ()
    count = conn.execute(f"SELECT COUNT(*) FROM groups {clause}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT * FROM groups {clause} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (*args, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    return paginate([_serialize_group(conn, r, user) for r in rows], count=count, page=page)


@groups_router.get("/groups/{group_id}/")
def get_group(
    group_id: int,
    user=Depends(optional_user),
    conn=Depends(get_db),
):
    return _serialize_group(conn, _get_group(conn, group_id), user)


@groups_router.delete("/groups/{group_id}/", status_code=204)
def delete_group(
    group_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    _require_admin(conn, group_id, user["id"])
    conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    conn.commit()
    return Response(status_code=204)


# ── Membership ───────────────────────────────────────────────────────────────


@groups_router.post("/groups/{group_id}/join/")
def join_group(
    group_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    group = _get_group(conn, group_id)
    if _is_banned(conn, group_id, user["id"]):
        raise HTTPException(status_code=403, detail="You are banned from this group.")
    existing = _get_membership(conn, group_id, user["id"])
    if existing:
        if existing["state"] == "active":
            raise HTTPException(status_code=400, detail="Already a member.")
        if existing["state"] == "pending":
            raise HTTPException(status_code=400, detail="Join request already pending.")
    state = "pending" if group["privacy"] == "private" else "active"
    ts = now_iso()
    if existing:
        conn.execute(
            "UPDATE group_memberships SET state = ?, role = 'member', joined_at = ? WHERE group_id = ? AND user_id = ?",
            (state, ts, group_id, user["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO group_memberships (group_id, user_id, role, state, joined_at) VALUES (?, ?, 'member', ?, ?)",
            (group_id, user["id"], state, ts),
        )
    if state == "active":
        _log_activity(conn, group_id=group_id, user_id=user["id"], event_type="GROUP_JOIN")
    conn.commit()
    return {
        "status": state,
        "message": "Joined group." if state == "active" else "Join request submitted, awaiting approval.",
    }


@groups_router.post("/groups/{group_id}/leave/")
def leave_group(
    group_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    m = _get_membership(conn, group_id, user["id"])
    if not m or m["state"] not in ("active", "pending"):
        raise HTTPException(status_code=400, detail="You are not a member of this group.")
    if m["role"] == "admin" and m["state"] == "active":
        next_admin = conn.execute(
            """
            SELECT * FROM group_memberships
            WHERE group_id = ? AND user_id != ? AND state = 'active'
            ORDER BY CASE role WHEN 'moderator' THEN 0 ELSE 1 END, joined_at ASC
            LIMIT 1
            """,
            (group_id, user["id"]),
        ).fetchone()
        if next_admin:
            conn.execute(
                "UPDATE group_memberships SET role = 'admin' WHERE id = ?",
                (next_admin["id"],),
            )
        else:
            conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
            conn.commit()
            return {"status": "group_deleted", "message": "Group deleted — you were the last member."}
    conn.execute(
        "DELETE FROM group_memberships WHERE group_id = ? AND user_id = ?",
        (group_id, user["id"]),
    )
    conn.commit()
    return {"status": "left", "message": "You have left the group."}


@groups_router.get("/groups/{group_id}/members/")
def list_members(
    group_id: int,
    state: str = "active",
    page: int = Query(1, ge=1),
    user=Depends(optional_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    count = conn.execute(
        "SELECT COUNT(*) FROM group_memberships WHERE group_id = ? AND state = ?",
        (group_id, state),
    ).fetchone()[0]
    rows = conn.execute(
        """
        SELECT * FROM group_memberships
        WHERE group_id = ? AND state = ?
        ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, joined_at
        LIMIT ? OFFSET ?
        """,
        (group_id, state, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    results = []
    for row in rows:
        u = conn.execute(
            "SELECT * FROM goodreads_user WHERE id = ?", (row["user_id"],)
        ).fetchone()
        if u:
            results.append(
                {
                    **serialize_user(conn, u, user),
                    "role": row["role"],
                    "state": row["state"],
                    "joined_at": row["joined_at"],
                }
            )
    return paginate(results, count=count, page=page)


@groups_router.post("/groups/{group_id}/members/{target_user_id}/approve/")
def approve_member(
    group_id: int,
    target_user_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    _require_admin_or_mod(conn, group_id, user["id"])
    m = _get_membership(conn, group_id, target_user_id)
    if not m or m["state"] != "pending":
        raise HTTPException(status_code=400, detail="No pending join request for this user.")
    conn.execute(
        "UPDATE group_memberships SET state = 'active', joined_at = ? WHERE group_id = ? AND user_id = ?",
        (now_iso(), group_id, target_user_id),
    )
    _notify(conn, user_id=target_user_id, actor_id=user["id"],
            ntype="GROUP_JOIN_APPROVED", entity_id=str(group_id))
    _log_activity(conn, group_id=group_id, user_id=target_user_id, event_type="GROUP_JOIN")
    conn.commit()
    return {"status": "approved"}


@groups_router.post("/groups/{group_id}/members/{target_user_id}/reject/")
def reject_member(
    group_id: int,
    target_user_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    _require_admin_or_mod(conn, group_id, user["id"])
    m = _get_membership(conn, group_id, target_user_id)
    if not m or m["state"] != "pending":
        raise HTTPException(status_code=400, detail="No pending join request for this user.")
    conn.execute(
        "DELETE FROM group_memberships WHERE group_id = ? AND user_id = ?",
        (group_id, target_user_id),
    )
    _notify(conn, user_id=target_user_id, actor_id=user["id"],
            ntype="GROUP_JOIN_REJECTED", entity_id=str(group_id))
    conn.commit()
    return {"status": "rejected"}


@groups_router.post("/groups/{group_id}/members/{target_user_id}/role/")
def change_member_role(
    group_id: int,
    target_user_id: int,
    payload: MemberRolePayload,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    if payload.role not in ("admin", "moderator", "member"):
        raise HTTPException(status_code=400, detail="role must be 'admin', 'moderator', or 'member'.")
    _get_group(conn, group_id)
    _require_admin(conn, group_id, user["id"])
    if target_user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Use /leave to transfer ownership instead.")
    target_m = _get_membership(conn, group_id, target_user_id)
    if not target_m or target_m["state"] != "active":
        raise HTTPException(status_code=404, detail="Active member not found.")
    conn.execute(
        "UPDATE group_memberships SET role = ? WHERE group_id = ? AND user_id = ?",
        (payload.role, group_id, target_user_id),
    )
    conn.commit()
    return {"status": "updated", "role": payload.role}


@groups_router.post("/groups/{group_id}/members/{target_user_id}/ban/")
def ban_member(
    group_id: int,
    target_user_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    _require_admin_or_mod(conn, group_id, user["id"])
    m = _get_membership(conn, group_id, target_user_id)
    if not m:
        raise HTTPException(status_code=404, detail="Member not found.")
    if m["role"] == "admin":
        raise HTTPException(status_code=403, detail="Cannot ban the group admin.")
    new_state = "active" if m["state"] == "banned" else "banned"
    conn.execute(
        "UPDATE group_memberships SET state = ? WHERE group_id = ? AND user_id = ?",
        (new_state, group_id, target_user_id),
    )
    conn.commit()
    return {"status": new_state}


# ── Discussions ───────────────────────────────────────────────────────────────


@groups_router.post("/groups/{group_id}/discussions/", status_code=201)
def create_discussion(
    group_id: int,
    payload: DiscussionCreatePayload,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    _require_active_member(conn, group_id, user["id"])
    ts = now_iso()
    cur = conn.execute(
        "INSERT INTO group_discussions (group_id, user_id, title, body, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
        (group_id, user["id"], payload.title, payload.body, ts, ts),
    )
    disc_id = cur.lastrowid
    _log_activity(conn, group_id=group_id, user_id=user["id"],
                  event_type="DISCUSSION_CREATED", discussion_id=disc_id)
    conn.commit()
    return _serialize_discussion(
        conn,
        conn.execute("SELECT * FROM group_discussions WHERE id = ?", (disc_id,)).fetchone(),
    )


@groups_router.get("/groups/{group_id}/discussions/")
def list_discussions(
    group_id: int,
    page: int = Query(1, ge=1),
    user=Depends(optional_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    count = conn.execute(
        "SELECT COUNT(*) FROM group_discussions WHERE group_id = ?", (group_id,)
    ).fetchone()[0]
    rows = conn.execute(
        "SELECT * FROM group_discussions WHERE group_id = ? ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?",
        (group_id, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    return paginate([_serialize_discussion(conn, r) for r in rows], count=count, page=page)


@groups_router.get("/discussions/{discussion_id}/")
def get_discussion(
    discussion_id: int,
    user=Depends(optional_user),
    conn=Depends(get_db),
):
    disc = _get_discussion(conn, discussion_id)
    flat = conn.execute(
        "SELECT * FROM group_comments WHERE discussion_id = ? ORDER BY created_at ASC",
        (discussion_id,),
    ).fetchall()
    return {
        **_serialize_discussion(conn, disc),
        "comments": _build_comment_tree(conn, flat, parent_id=None),
    }


@groups_router.patch("/discussions/{discussion_id}/")
def update_discussion(
    discussion_id: int,
    payload: DiscussionUpdatePayload,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    disc = _get_discussion(conn, discussion_id)
    m = _get_membership(conn, disc["group_id"], user["id"])
    if not m or m["state"] != "active":
        raise HTTPException(status_code=403, detail="Active membership required.")
    if disc["user_id"] != user["id"] and m["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Only the author, a moderator, or admin can edit this.")
    new_title = payload.title if payload.title is not None else disc["title"]
    new_body  = payload.body  if payload.body  is not None else disc["body"]
    conn.execute(
        "UPDATE group_discussions SET title = ?, body = ?, updated_at = ? WHERE id = ?",
        (new_title, new_body, now_iso(), discussion_id),
    )
    conn.commit()
    return _serialize_discussion(
        conn,
        conn.execute("SELECT * FROM group_discussions WHERE id = ?", (discussion_id,)).fetchone(),
    )


@groups_router.delete("/discussions/{discussion_id}/", status_code=204)
def delete_discussion(
    discussion_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    disc = _get_discussion(conn, discussion_id)
    m = _get_membership(conn, disc["group_id"], user["id"])
    if not m or m["state"] != "active":
        raise HTTPException(status_code=403, detail="Active membership required.")
    if disc["user_id"] != user["id"] and m["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Only the author, a moderator, or admin can delete this.")
    conn.execute("DELETE FROM group_discussions WHERE id = ?", (discussion_id,))
    conn.commit()
    return Response(status_code=204)


@groups_router.post("/discussions/{discussion_id}/pin/")
def pin_discussion(
    discussion_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    disc = _get_discussion(conn, discussion_id)
    _require_admin_or_mod(conn, disc["group_id"], user["id"])
    new_val = 0 if disc["is_pinned"] else 1
    conn.execute(
        "UPDATE group_discussions SET is_pinned = ? WHERE id = ?", (new_val, discussion_id)
    )
    conn.commit()
    return {"is_pinned": bool(new_val)}


# ── Comments ──────────────────────────────────────────────────────────────────


@groups_router.post("/discussions/{discussion_id}/comments/", status_code=201)
def add_comment(
    discussion_id: int,
    payload: GroupCommentPayload,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    disc = _get_discussion(conn, discussion_id)
    _require_active_member(conn, disc["group_id"], user["id"])
    if payload.parent_comment_id is not None:
        parent = conn.execute(
            "SELECT * FROM group_comments WHERE id = ? AND discussion_id = ?",
            (payload.parent_comment_id, discussion_id),
        ).fetchone()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent comment not found in this discussion.")
    ts = now_iso()
    cur = conn.execute(
        "INSERT INTO group_comments (discussion_id, user_id, parent_comment_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (discussion_id, user["id"], payload.parent_comment_id, payload.body, ts, ts),
    )
    comment_id = cur.lastrowid
    _log_activity(conn, group_id=disc["group_id"], user_id=user["id"],
                  event_type="COMMENT_ADDED", discussion_id=discussion_id, comment_id=comment_id)
    if disc["user_id"] != user["id"]:
        _notify(conn, user_id=disc["user_id"], actor_id=user["id"],
                ntype="DISCUSSION_REPLY", entity_id=str(discussion_id))
    if payload.parent_comment_id:
        pc = conn.execute(
            "SELECT user_id FROM group_comments WHERE id = ?", (payload.parent_comment_id,)
        ).fetchone()
        if pc and pc["user_id"] not in (user["id"], disc["user_id"]):
            _notify(conn, user_id=pc["user_id"], actor_id=user["id"],
                    ntype="COMMENT_REPLY", entity_id=str(discussion_id))
    conn.commit()
    author_row = conn.execute(
        "SELECT * FROM goodreads_user WHERE id = ?", (user["id"],)
    ).fetchone()
    return {
        "id": comment_id,
        "discussion_id": discussion_id,
        "parent_comment_id": payload.parent_comment_id,
        "body": payload.body,
        "created_at": ts,
        "updated_at": ts,
        "author": serialize_user(conn, author_row),
        "replies": [],
    }


@groups_router.delete("/group-comments/{comment_id}/", status_code=204)
def delete_comment(
    comment_id: int,
    user=Depends(current_user),
    conn=Depends(get_db),
):
    comment = _get_group_comment(conn, comment_id)
    disc = _get_discussion(conn, comment["discussion_id"])
    m = _get_membership(conn, disc["group_id"], user["id"])
    if not m or m["state"] != "active":
        raise HTTPException(status_code=403, detail="Active membership required.")
    if comment["user_id"] != user["id"] and m["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Only the author, a moderator, or admin can delete this.")
    conn.execute("DELETE FROM group_comments WHERE id = ?", (comment_id,))
    conn.commit()
    return Response(status_code=204)


# ── Group Activity Feed ───────────────────────────────────────────────────────


@groups_router.get("/groups/{group_id}/activity/")
def group_activity_feed(
    group_id: int,
    page: int = Query(1, ge=1),
    user=Depends(optional_user),
    conn=Depends(get_db),
):
    _get_group(conn, group_id)
    count = conn.execute(
        "SELECT COUNT(*) FROM group_activity WHERE group_id = ?", (group_id,)
    ).fetchone()[0]
    rows = conn.execute(
        "SELECT * FROM group_activity WHERE group_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (group_id, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    events = []
    for row in rows:
        actor = conn.execute(
            "SELECT * FROM goodreads_user WHERE id = ?", (row["user_id"],)
        ).fetchone()
        discussion = None
        if row["discussion_id"]:
            d = conn.execute(
                "SELECT id, title FROM group_discussions WHERE id = ?", (row["discussion_id"],)
            ).fetchone()
            if d:
                discussion = {"id": d["id"], "title": d["title"]}
        events.append(
            {
                "id": row["id"],
                "event_type": row["event_type"],
                "actor": serialize_user(conn, actor, user) if actor else None,
                "discussion": discussion,
                "created_at": row["created_at"],
            }
        )
    return paginate(events, count=count, page=page)
