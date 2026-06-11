import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

export default function AddFriends() {
  const { userId } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [followingIds, setFollowingIds] = useState(new Set());

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError("");
    setLoading(true);
    try {
      const payload = await api(`/users/?search=${encodeURIComponent(q)}`);
      // Exclude yourself from results
      const users = unwrap(payload).filter((u) => u.id !== userId);
      setResults(users);
      setSearched(true);
      setFollowingIds(new Set(users.filter((u) => u.is_following).map((u) => u.id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function follow(user) {
    try {
      await api(`/users/${user.id}/follow/`, { method: "POST" });
      setFollowingIds((prev) => new Set([...prev, user.id]));
    } catch (err) {
      setError(err.message);
    }
  }

  async function unfollow(user) {
    try {
      await api(`/users/${user.id}/unfollow/`, { method: "POST" });
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="content-panel">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link to="/friends" style={{ fontSize: "0.85rem", color: "#6b5e4e", textDecoration: "none" }}>
          ← Back to Friends
        </Link>
        <h1 style={{ margin: 0 }}>Find Friends</h1>
      </div>

      <p className="muted" style={{ marginBottom: "1.25rem", fontSize: "0.9rem" }}>
        Search for readers by their username or email address. Following someone sends them a notification.
      </p>

      <form
        onSubmit={handleSearch}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem", maxWidth: "440px" }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Username or email…"
          style={{ flex: 1 }}
        />
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {searched && results.length === 0 && !error && (
        <p className="muted">
          No readers found for &ldquo;{query}&rdquo;. Try a different username or email.
        </p>
      )}

      {results.length > 0 && (
        <div className="review-list">
          {results.map((user) => {
            const isFollowing = followingIds.has(user.id);
            return (
              <article key={user.id} className="review-row">
                <div>
                  <strong>{user.username}</strong>
                  <p className="muted" style={{ fontSize: "0.85rem", margin: "0.15rem 0 0" }}>
                    {user.followers_count} follower{user.followers_count !== 1 ? "s" : ""} ·{" "}
                    {user.following_count} following
                  </p>
                </div>
                <button
                  className={isFollowing ? "" : "primary-button"}
                  onClick={() => (isFollowing ? unfollow(user) : follow(user))}
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
