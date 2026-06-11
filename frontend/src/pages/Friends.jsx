import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

export default function Friends() {
  const { userId, isAuthenticated } = useAuth();
  const [tab, setTab] = useState("following");
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      // Authenticated but userId still resolving — keep spinner
      if (!isAuthenticated) setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([
      api(`/users/${userId}/followers/`),
      api(`/users/${userId}/following/`),
    ])
      .then(([frsPayload, fngPayload]) => {
        setFollowers(unwrap(frsPayload));
        setFollowing(unwrap(fngPayload));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId, isAuthenticated]);

  async function unfollow(targetId) {
    try {
      await api(`/users/${targetId}/unfollow/`, { method: "POST" });
      setFollowing((prev) => prev.filter((u) => u.id !== targetId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function followBack(targetUser) {
    try {
      await api(`/users/${targetUser.id}/follow/`, { method: "POST" });
      setFollowing((prev) =>
        prev.find((u) => u.id === targetUser.id) ? prev : [...prev, targetUser]
      );
    } catch (err) {
      setError(err.message);
    }
  }

  const followingIds = new Set(following.map((u) => u.id));
  const list = tab === "following" ? following : followers;

  return (
    <section className="content-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Friends</h1>
        <Link to="/add-friends" className="primary-button" style={{ fontSize: "0.85rem" }}>
          + Find Friends
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button
          className={tab === "following" ? "primary-button" : ""}
          onClick={() => setTab("following")}
        >
          Following ({following.length})
        </button>
        <button
          className={tab === "followers" ? "primary-button" : ""}
          onClick={() => setTab("followers")}
        >
          Followers ({followers.length})
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && list.length === 0 && (
        <p className="muted">
          {tab === "following" ? (
            <>
              You have no friends yet!{" "}
              <Link to="/add-friends" style={{ color: "#6b5e4e", fontWeight: 600 }}>
                Add some »
              </Link>
            </>
          ) : (
            "No followers yet."
          )}
        </p>
      )}

      {!loading && list.length > 0 && (
        <div className="review-list">
          {list.map((user) => (
            <article key={user.id} className="review-row">
              <div>
                <strong>{user.username}</strong>
                <p className="muted" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0" }}>
                  {user.followers_count} follower{user.followers_count !== 1 ? "s" : ""} ·{" "}
                  {user.following_count} following
                </p>
              </div>
              {tab === "following" ? (
                <button onClick={() => unfollow(user.id)}>Unfollow</button>
              ) : (
                <button
                  className={followingIds.has(user.id) ? "" : "primary-button"}
                  onClick={() =>
                    followingIds.has(user.id) ? unfollow(user.id) : followBack(user)
                  }
                >
                  {followingIds.has(user.id) ? "Unfollow" : "Follow back"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
