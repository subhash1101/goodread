import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

  // Load mutual follows (friends) on mount
  useEffect(() => {
    if (!userId) {
      if (!isAuthenticated) setLoadingFriends(false);
      return;
    }
    setFriendsError("");
    Promise.all([
      api(`/users/${userId}/followers/`),
      api(`/users/${userId}/following/`),
    ])
      .then(([frsPayload, fngPayload]) => {
        const followerList = unwrap(frsPayload);
        const followingList = unwrap(fngPayload);
        const followingIdSet = new Set(followingList.map((u) => u.id));
        // Mutual follows only
        const mutual = followerList.filter((u) => followingIdSet.has(u.id));
        setFriends(mutual);
      })
      .catch((err) => setFriendsError(err.message))
      .finally(() => setLoadingFriends(false));
  }, [userId, isAuthenticated]);

  // Load conversation when a friend is selected
  useEffect(() => {
    if (!selected || !userId) return;
    setLoadingThread(true);
    setThreadError("");
    setThread([]);

    Promise.all([
      api("/reviews/?mine=true"),
      api(`/reviews/?user=${selected.id}`),
    ])
      .then(([myPayload, theirPayload]) => {
        const myReviews = unwrap(myPayload);
        const theirReviews = unwrap(theirPayload);
        const msgs = [];

        // Comments the friend left on my reviews
        for (const review of myReviews) {
          for (const comment of review.comments ?? []) {
            if (comment.user.id === selected.id) {
              msgs.push({
                id: `recv-${comment.id}`,
                fromMe: false,
                text: comment.text,
                context: `on your review of "${review.book.title}"`,
                created_at: comment.created_at,
              });
            }
          }
        }

        // Comments I left on the friend's reviews
        for (const review of theirReviews) {
          for (const comment of review.comments ?? []) {
            if (comment.user.id === userId) {
              msgs.push({
                id: `sent-${comment.id}`,
                fromMe: true,
                text: comment.text,
                context: `on ${selected.username}'s review of "${review.book.title}"`,
                created_at: comment.created_at,
              });
            }
          }
        }

        msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setThread(msgs);
      })
      .catch((err) => setThreadError(err.message))
      .finally(() => setLoadingThread(false));
  }, [selected, userId]);

  return (
    <section className="content-panel">
      <h1>Messages</h1>

      {friendsError && <p className="error">{friendsError}</p>}

      {loadingFriends && <p className="muted">Loading friends…</p>}

      {!loadingFriends && friends.length === 0 && !friendsError && (
        <p className="muted">
          No friends yet. You can only message people who follow you back.{" "}
          <Link to="/add-friends" style={{ color: "#6b5e4e", fontWeight: 600 }}>
            Find friends »
          </Link>
        </p>
      )}

      {!loadingFriends && friends.length > 0 && (
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

          {/* Friends sidebar */}
          <div
            style={{
              minWidth: "180px",
              maxWidth: "200px",
              borderRight: "1px solid #e0d8c8",
              paddingRight: "1rem",
            }}
          >
            <p
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#888",
                marginBottom: "0.75rem",
              }}
            >
              Friends
            </p>
            {friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => setSelected(friend)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.55rem 0.7rem",
                  borderRadius: "5px",
                  border: "none",
                  background: selected?.id === friend.id ? "#f0ebe0" : "transparent",
                  fontWeight: selected?.id === friend.id ? 700 : "normal",
                  color: "#333",
                  cursor: "pointer",
                  marginBottom: "0.25rem",
                  fontSize: "0.9rem",
                  outline: selected?.id === friend.id ? "2px solid #b9a070" : "none",
                }}
              >
                {friend.username}
              </button>
            ))}
          </div>

          {/* Conversation panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selected && (
              <p className="muted" style={{ marginTop: "1rem" }}>
                Select a friend to view your conversation.
              </p>
            )}

            {selected && (
              <>
                <p
                  style={{
                    fontWeight: 700,
                    marginBottom: "1.25rem",
                    fontSize: "1rem",
                    borderBottom: "1px solid #e0d8c8",
                    paddingBottom: "0.6rem",
                  }}
                >
                  {selected.username}
                </p>

                {threadError && <p className="error">{threadError}</p>}
                {loadingThread && <p className="muted">Loading conversation…</p>}

                {!loadingThread && thread.length === 0 && !threadError && (
                  <p className="muted">
                    No messages yet. Comment on each other's reviews to start a conversation.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  {thread.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: msg.fromMe ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "72%",
                          background: msg.fromMe ? "#4a7c6f" : "#f0ebe0",
                          color: msg.fromMe ? "#fff" : "#333",
                          borderRadius: msg.fromMe
                            ? "14px 14px 3px 14px"
                            : "14px 14px 14px 3px",
                          padding: "0.55rem 0.9rem",
                          fontSize: "0.9rem",
                          lineHeight: 1.45,
                        }}
                      >
                        {msg.text}
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "#aaa",
                          marginTop: "3px",
                          paddingLeft: msg.fromMe ? 0 : "4px",
                          paddingRight: msg.fromMe ? "4px" : 0,
                        }}
                      >
                        {msg.context} · {timeAgo(msg.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
