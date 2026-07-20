import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

const TAGS = [
  "bookclub", "fantasy", "romance", "fiction", "book-club",
  "young-adult", "books", "science-fiction", "mystery", "thriller", "ya", "horror",
];

function fmtCount(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}m`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

function GroupCard({ group, onJoin }) {
  const auth = useAuth();
  const m = group.membership;

  function joinBtn() {
    if (!auth.isAuthenticated) return null;
    if (m?.state === "active")  return <span className="grp-badge-joined">Joined</span>;
    if (m?.state === "pending") return <span className="grp-badge-pending">Pending</span>;
    return (
      <button className="grp-join-btn" onClick={(e) => { e.preventDefault(); onJoin(group.id); }}>
        {group.privacy === "private" ? "Request" : "Join"}
      </button>
    );
  }

  return (
    <article className="community-group-row">
      <div className="community-group-thumb" aria-hidden="true">
        <span>{group.name.charAt(0)}</span>
      </div>
      <div className="community-group-body">
        <div className="community-group-row-top">
          <Link to={`/community/groups/${group.id}`} className="community-group-title">
            {group.name}
          </Link>
          {group.privacy === "private" && <span className="grp-privacy-badge">Private</span>}
          {joinBtn()}
        </div>
        <p className="community-group-meta">
          {fmtCount(group.member_count)} members
          {group.created_by && ` · by ${group.created_by.username}`}
        </p>
        {group.description && (
          <p className="community-group-desc">
            {group.description.length > 180 ? group.description.slice(0, 180) + "…" : group.description}
          </p>
        )}
      </div>
    </article>
  );
}

function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      const group = await api("/groups/", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), privacy }),
      });
      onCreated(group);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grp-modal-backdrop" onClick={onClose}>
      <div className="grp-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create a Group</h2>
        {error && <p className="grp-error">{error}</p>}
        <form onSubmit={submit}>
          <label className="grp-modal-label">Group Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </label>
          <label className="grp-modal-label">Description
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </label>
          <label className="grp-modal-label">Privacy
            <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
              <option value="public">Public — anyone can join</option>
              <option value="private">Private — approval required</option>
            </select>
          </label>
          <div className="grp-modal-actions">
            <button type="button" className="grp-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create Group"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Community() {
  const auth      = useAuth();
  const navigate  = useNavigate();
  const [groups,     setGroups]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [query,      setQuery]      = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadGroups = useCallback(async (search = "") => {
    setLoading(true); setError("");
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const payload = await api(`/groups/${qs}`);
      setGroups(unwrap(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  function handleSearch(e) { e.preventDefault(); loadGroups(query); }

  async function handleJoin(groupId) {
    if (!auth.isAuthenticated) { navigate("/login"); return; }
    try {
      await api(`/groups/${groupId}/join/`, { method: "POST" });
      loadGroups(query);
    } catch (err) {
      alert(err.message);
    }
  }

  function handleCreated(group) {
    setShowCreate(false);
    navigate(`/community/groups/${group.id}`);
  }

  return (
    <div className="community-groups-page">
      <main className="community-groups-main">
        <div className="community-groups-header">
          <h1>Groups</h1>
          {auth.isAuthenticated && (
            <button className="grp-create-btn" onClick={() => setShowCreate(true)}>
              + Create Group
            </button>
          )}
        </div>

        <form className="community-group-search" onSubmit={handleSearch}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Group name, description"
          />
          <button type="submit">Search groups</button>
        </form>

        {error && <p className="community-empty">{error}</p>}

        {loading ? (
          <div className="community-group-list">
            {[1, 2, 3].map((i) => <div key={i} className="grp-skeleton" style={{ height: 80, marginBottom: 12 }} />)}
          </div>
        ) : groups.length === 0 ? (
          <p className="community-empty">No groups found.</p>
        ) : (
          <>
            <section>
              <h2>Featured groups</h2>
              <div className="community-group-list">
                {groups.slice(0, 1).map((g) => (
                  <GroupCard key={g.id} group={g} onJoin={handleJoin} />
                ))}
              </div>
            </section>
            {groups.length > 1 && (
              <section>
                <h2>All groups</h2>
                <div className="community-group-list">
                  {groups.slice(1).map((g) => (
                    <GroupCard key={g.id} group={g} onJoin={handleJoin} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <aside className="community-groups-sidebar">
        <section className="community-tags">
          <h2>Browse groups by tag</h2>
          <div>
            {TAGS.map((tag) => (
              <Link to={`/community?tag=${encodeURIComponent(tag)}`} key={tag}>{tag}</Link>
            ))}
          </div>
        </section>

        <section className="community-more">
          <h2>More groups</h2>
          {auth.isAuthenticated ? (
            <Link to="/community" onClick={() => setShowCreate(true)} className="grp-create-link">
              Create a group
            </Link>
          ) : (
            <p><Link to="/login">Sign in</Link> to create or join groups</p>
          )}
        </section>
      </aside>

      {showCreate && (
        <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
