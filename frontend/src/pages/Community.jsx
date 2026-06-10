import React from "react";
import { UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

export default function Community() {
  const auth = useAuth();
  const location = useLocation();
  const tab = useMemo(() => new URLSearchParams(location.search).get("tab") || "users", [location.search]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load(search = query) {
    try {
      const payload = await api(`/users/${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setUsers(unwrap(payload));
    } catch (err) {
      setError(err.message);
    }
  }

  async function follow(user) {
    await api(`/users/${user.id}/${user.is_following ? "unfollow" : "follow"}/`, { method: "POST" });
    load();
  }

  useEffect(() => {
    if (tab === "users") load("");
  }, [tab]);

  if (tab !== "users") {
    return (
      <section className="content-panel">
        <h1>{tab === "groups" ? "Groups" : "Discussions"}</h1>
        <div className="community-board">
          <article>
            <Users size={20} />
            <h2>Classic Fiction Circle</h2>
            <p>Readers comparing editions, adaptations, and enduring favorites.</p>
          </article>
          <article>
            <Users size={20} />
            <h2>Weekend Mystery Club</h2>
            <p>Chapter-by-chapter threads for suspense and crime novels.</p>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="content-panel">
      <div className="section-head">
        <div>
          <h1>Community</h1>
          <p className="muted">Find readers to follow and populate your home feed.</p>
        </div>
      </div>
      <form className="filters" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label>
          <Users size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" />
        </label>
        <button className="primary-button">Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="user-list">
        {users.map((user) => (
          <article className="user-row" key={user.id}>
            <div>
              <strong>{user.username}</strong>
              <span className="muted">{user.followers_count} followers · {user.following_count} following</span>
            </div>
            {auth.isAuthenticated && (
              <button onClick={() => follow(user)}>
                <UserPlus size={16} />
                {user.is_following ? "Unfollow" : "Follow"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
