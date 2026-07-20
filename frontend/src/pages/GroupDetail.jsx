import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, Globe, Lock, MessageSquare, Pin, Users } from "lucide-react";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ name, size = 32 }) {
  const letter = (name || "?")[0].toUpperCase();
  const colors = ["#3d6f63", "#8b5e3c", "#4a6fa5", "#7c5cbf", "#c06b3a"];
  const bg = colors[(name || "").charCodeAt(0) % colors.length];
  return (
    <div
      className="grp-avatar"
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.42) }}
    >
      {letter}
    </div>
  );
}

// ── Discussions tab ────────────────────────────────────────────────────────────

function DiscussionList({ groupId, membership }) {
  const auth = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [newTitle,    setNewTitle]    = useState("");
  const [newBody,     setNewBody]     = useState("");
  const [posting,     setPosting]     = useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => {
    api(`/groups/${groupId}/discussions/`)
      .then((p) => setDiscussions(unwrap(p)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function postDiscussion(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setPosting(true); setError("");
    try {
      const disc = await api(`/groups/${groupId}/discussions/`, {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),
      });
      setDiscussions((prev) => [disc, ...prev]);
      setNewTitle(""); setNewBody(""); setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  const canPost = auth.isAuthenticated && membership?.state === "active";

  return (
    <div className="grp-tab-content">
      {canPost && (
        <div className="grp-new-disc-box">
          {showForm ? (
            <form onSubmit={postDiscussion} className="grp-disc-form">
              {error && <p className="grp-error">{error}</p>}
              <input
                className="grp-disc-title-input"
                placeholder="Discussion title…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={200}
                required
              />
              <textarea
                className="grp-disc-body-input"
                placeholder="What's on your mind? (optional)"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={3}
              />
              <div className="grp-disc-form-actions">
                <button type="button" className="grp-cancel-btn" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={posting}>
                  {posting ? "Posting…" : "Post Discussion"}
                </button>
              </div>
            </form>
          ) : (
            <button className="grp-start-disc-btn" onClick={() => setShowForm(true)}>
              + Start a Discussion
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div>{[1, 2, 3].map((i) => <div key={i} className="grp-skeleton" style={{ height: 60, marginBottom: 10 }} />)}</div>
      ) : discussions.length === 0 ? (
        <p className="grp-empty">No discussions yet.{canPost ? " Start the first one!" : ""}</p>
      ) : (
        <div className="grp-disc-list">
          {discussions.map((d) => (
            <Link
              key={d.id}
              to={`/community/groups/${groupId}/discussions/${d.id}`}
              className="grp-disc-row"
            >
              {d.is_pinned && <Pin size={13} className="grp-pin-icon" />}
              <div className="grp-disc-row-main">
                <span className="grp-disc-row-title">{d.title}</span>
                <span className="grp-disc-row-meta">
                  {d.author?.username} · {fmtDate(d.created_at)} · {d.comment_count} comments
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Members tab ────────────────────────────────────────────────────────────────

function MembersList({ groupId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/groups/${groupId}/members/`)
      .then((p) => setMembers(unwrap(p)))
      .finally(() => setLoading(false));
  }, [groupId]);

  return (
    <div className="grp-tab-content">
      {loading ? (
        <div>{[1, 2, 3, 4].map((i) => <div key={i} className="grp-skeleton" style={{ height: 48, marginBottom: 8 }} />)}</div>
      ) : members.length === 0 ? (
        <p className="grp-empty">No members yet.</p>
      ) : (
        <div className="grp-member-list">
          {members.map((m) => (
            <div key={m.id} className="grp-member-row">
              <Avatar name={m.username} size={36} />
              <div className="grp-member-info">
                <span className="grp-member-name">{m.username}</span>
                {m.role !== "member" && (
                  <span className={`grp-role-badge grp-role-${m.role}`}>{m.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity tab ───────────────────────────────────────────────────────────────

function ActivityFeed({ groupId }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/groups/${groupId}/activity/`)
      .then((p) => setEvents(unwrap(p)))
      .finally(() => setLoading(false));
  }, [groupId]);

  function describeEvent(evt) {
    switch (evt.event_type) {
      case "GROUP_JOIN":          return "joined the group";
      case "DISCUSSION_CREATED":  return evt.discussion ? `started "${evt.discussion.title}"` : "started a discussion";
      case "COMMENT_ADDED":       return evt.discussion ? `commented on "${evt.discussion.title}"` : "added a comment";
      default: return evt.event_type.toLowerCase().replace(/_/g, " ");
    }
  }

  return (
    <div className="grp-tab-content">
      {loading ? (
        <div>{[1, 2, 3].map((i) => <div key={i} className="grp-skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
      ) : events.length === 0 ? (
        <p className="grp-empty">No activity yet.</p>
      ) : (
        <div className="grp-activity-list">
          {events.map((evt) => (
            <div key={evt.id} className="grp-activity-row">
              <Avatar name={evt.actor?.username} size={28} />
              <div className="grp-activity-body">
                <span className="grp-activity-actor">{evt.actor?.username}</span>
                {" "}{describeEvent(evt)}
                <span className="grp-activity-time"> · {fmtDate(evt.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Group Detail page ──────────────────────────────────────────────────────────

export default function GroupDetail() {
  const { groupId } = useParams();
  const auth = useAuth();
  const [group,   setGroup]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [busy,    setBusy]    = useState(false);
  const [tab,     setTab]     = useState("discussions");

  async function loadGroup() {
    setLoading(true); setError("");
    try {
      setGroup(await api(`/groups/${groupId}/`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadGroup(); }, [groupId]);

  async function handleJoin() {
    if (!auth.isAuthenticated) return;
    setBusy(true);
    try {
      await api(`/groups/${groupId}/join/`, { method: "POST" });
      loadGroup();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!auth.isAuthenticated) return;
    if (!confirm("Leave this group?")) return;
    setBusy(true);
    try {
      await api(`/groups/${groupId}/leave/`, { method: "POST" });
      loadGroup();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="grp-page"><p className="grp-loading">Loading…</p></div>;
  if (error)   return <div className="grp-page"><p className="grp-error">{error}</p></div>;
  if (!group)  return null;

  const membership = group.membership;

  function membershipBtn() {
    if (!auth.isAuthenticated) return null;
    if (membership?.state === "active") {
      return <button className="grp-leave-btn" onClick={handleLeave} disabled={busy}>Leave Group</button>;
    }
    if (membership?.state === "pending") {
      return <button className="grp-pending-btn" disabled>Request Pending</button>;
    }
    return (
      <button className="grp-join-btn-lg" onClick={handleJoin} disabled={busy}>
        {group.privacy === "private" ? "Request to Join" : "Join Group"}
      </button>
    );
  }

  const TABS = [
    { key: "discussions", label: "Discussions", Icon: MessageSquare },
    { key: "members",     label: "Members",     Icon: Users },
    { key: "activity",    label: "Activity",    Icon: Activity },
  ];

  return (
    <div className="grp-page">
      <Link to="/community" className="grp-back-link">← All Groups</Link>

      <div className="grp-header-card">
        <div className="grp-header-thumb">
          <span>{group.name.charAt(0)}</span>
        </div>
        <div className="grp-header-info">
          <div className="grp-header-top">
            <h1 className="grp-name">{group.name}</h1>
            {group.privacy === "private"
              ? <span className="grp-privacy-badge"><Lock size={12} /> Private</span>
              : <span className="grp-privacy-badge grp-privacy-public"><Globe size={12} /> Public</span>}
          </div>
          {group.description && <p className="grp-description">{group.description}</p>}
          <div className="grp-header-meta">
            <Users size={14} />
            <span>{(group.member_count || 0).toLocaleString()} members</span>
            {group.created_by && (
              <span className="grp-created-by">· Created by {group.created_by.username}</span>
            )}
          </div>
        </div>
        <div className="grp-header-action">{membershipBtn()}</div>
      </div>

      <div className="grp-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`grp-tab${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "discussions" && <DiscussionList groupId={Number(groupId)} membership={membership} />}
      {tab === "members"     && <MembersList    groupId={Number(groupId)} />}
      {tab === "activity"    && <ActivityFeed   groupId={Number(groupId)} />}
    </div>
  );
}
