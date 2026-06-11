import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initial(name) {
  return (name || "?")[0].toUpperCase();
}

export default function Messages() {
  const { userId, isAuthenticated } = useAuth();

  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [friendsError, setFriendsError] = useState("");

  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState("");

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const inputRef = useRef(null);

  // ── Load mutual-follow friends ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      if (!isAuthenticated) setLoadingFriends(false);
      return;
    }
    setFriendsError("");
    api("/messages/friends/")
      .then((data) => setFriends(Array.isArray(data) ? data : unwrap(data)))
      .catch((err) => setFriendsError(err.message))
      .finally(() => setLoadingFriends(false));
  }, [userId, isAuthenticated]);

  // ── Load conversation when friend is selected ───────────────────────────
  useEffect(() => {
    if (!selected) return;
    setLoadingThread(true);
    setThreadError("");
    setThread([]);
    api(`/messages/${selected.id}/`)
      .then((data) => setThread(unwrap(data)))
      .catch((err) => setThreadError(err.message))
      .finally(() => setLoadingThread(false));
  }, [selected]);


  // ── Send message ─────────────────────────────────────────────────────────
  async function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    try {
      const msg = await api(`/messages/${selected.id}/`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setThread((prev) => [...prev, msg]);
      setDraft("");
      setFriends((prev) =>
        prev.map((f) =>
          f.id === selected.id
            ? { ...f, last_message: text, last_message_at: msg.created_at }
            : f
        )
      );
      inputRef.current?.focus();
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  function selectFriend(friend) {
    setSelected(friend);
    setFriends((prev) =>
      prev.map((f) => (f.id === friend.id ? { ...f, unread_count: 0 } : f))
    );
  }

  return (
    <section className="content-panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className="chat-layout">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">Conversations</div>

          <div className="chat-friend-list">
            {loadingFriends && (
              <p style={{ padding: "1rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                Loading…
              </p>
            )}

            {friendsError && (
              <p style={{ padding: "1rem", color: "var(--red)", fontSize: "0.85rem" }}>
                {friendsError}
              </p>
            )}

            {!loadingFriends && friends.length === 0 && !friendsError && (
              <div className="chat-sidebar-empty">
                <p>No conversations yet.</p>
                <p>You can chat with people who follow you back.</p>
                <Link to="/add-friends">Find friends »</Link>
              </div>
            )}

            {friends.map((friend) => {
              const active = selected?.id === friend.id;
              return (
                <button
                  key={friend.id}
                  className={[
                    "chat-friend-btn",
                    active ? "active" : "",
                    friend.unread_count > 0 ? "has-unread" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectFriend(friend)}
                >
                  <div className="chat-friend-avatar">{initial(friend.username)}</div>
                  <div className="chat-friend-info">
                    <div className="chat-friend-name-row">
                      <span className="chat-friend-name">{friend.username}</span>
                      {friend.unread_count > 0 && (
                        <span className="chat-unread-badge">{friend.unread_count}</span>
                      )}
                    </div>
                    {friend.last_message && (
                      <div className="chat-friend-preview">{friend.last_message}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chat panel ───────────────────────────────────────────────── */}
        <div className="chat-panel">

          {/* Header */}
          <div className="chat-panel-header">
            {selected ? (
              <>
                <div className="chat-panel-header-avatar">{initial(selected.username)}</div>
                <div>
                  <div className="chat-panel-header-name">{selected.username}</div>
                  <div className="chat-panel-header-hint">
                    {selected.followers_count} follower{selected.followers_count !== 1 ? "s" : ""}
                  </div>
                </div>
              </>
            ) : (
              <div className="chat-panel-header-name" style={{ color: "var(--muted)" }}>
                Select a conversation
              </div>
            )}
          </div>

          {/* Messages area */}
          <div className="chat-messages">
            {!selected && (
              <div className="chat-empty-state">
                <div className="chat-empty-state-icon">💬</div>
                <p>Choose a friend to start chatting.</p>
              </div>
            )}

            {selected && loadingThread && (
              <div className="chat-empty-state">
                <p style={{ color: "var(--muted)" }}>Loading…</p>
              </div>
            )}

            {selected && threadError && (
              <p style={{ color: "var(--red)", fontSize: "0.85rem" }}>{threadError}</p>
            )}

            {selected && !loadingThread && thread.length === 0 && !threadError && (
              <div className="chat-empty-state">
                <div className="chat-empty-state-icon">👋</div>
                <p>Say hello to {selected.username}!</p>
              </div>
            )}

            {thread.map((msg) => (
              <div
                key={msg.id}
                className={`chat-msg-row ${msg.from_me ? "from-me" : "from-friend"}`}
              >
                {msg.from_me ? (
                  <div className="chat-bubble from-me">{msg.text}</div>
                ) : (
                  <div className="chat-msg-with-avatar">
                    <div className="chat-msg-mini-avatar">{initial(selected.username)}</div>
                    <div className="chat-bubble from-friend">{msg.text}</div>
                  </div>
                )}
                <span className="chat-timestamp">{timeAgo(msg.created_at)}</span>
              </div>
            ))}

          </div>

          {/* Input bar */}
          {selected && (
            <form className="chat-input-bar" onSubmit={handleSend}>
              <input
                ref={inputRef}
                className="chat-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${selected.username}…`}
                disabled={sending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) handleSend(e);
                }}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={sending || !draft.trim()}
              >
                {sending ? "…" : "Send"}
              </button>
            </form>
          )}
        </div>

      </div>
    </section>
  );
}
