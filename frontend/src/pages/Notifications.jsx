import React, { useEffect, useState } from "react";
import { api, unwrap } from "../lib/api";

function label(notification) {
  const actor = notification.actor?.username || "Someone";
  if (notification.type === "FOLLOW") return `${actor} started following you`;
  if (notification.type === "LIKE") return `${actor} liked your review`;
  if (notification.type === "COMMENT") return `${actor} commented on your review`;
  return `${actor} sent a notification`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const payload = await api("/notifications/");
      setNotifications(unwrap(payload));
    } catch (err) {
      setError(err.message);
    }
  }

  async function markRead(id) {
    try {
      await api(`/notifications/${id}/mark_read/`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_status: true } : n))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read_status);
    await Promise.all(unread.map((n) => api(`/notifications/${n.id}/mark_read/`, { method: "POST" }).catch(() => {})));
    setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
  }

  useEffect(() => {
    load();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  return (
    <section className="content-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Notifications {unreadCount > 0 && <span style={{ fontSize: "1rem", color: "#c84b31" }}>({unreadCount} new)</span>}</h1>
        {unreadCount > 0 && (
          <button className="primary-button" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {notifications.length === 0 && !error && (
        <p className="muted">No notifications yet. Follow friends and interact with reviews to get notifications.</p>
      )}
      <div className="review-list">
        {notifications.map((n) => (
          <article
            key={n.id}
            className="review-row"
            style={{
              background: n.read_status ? "transparent" : "#fffbf2",
              borderLeft: n.read_status ? "3px solid transparent" : "3px solid #c84b31",
              paddingLeft: "0.75rem",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: n.read_status ? "normal" : "600" }}>{label(n)}</p>
              <span className="muted" style={{ fontSize: "0.8rem" }}>{timeAgo(n.created_at)}</span>
            </div>
            {!n.read_status && (
              <button onClick={() => markRead(n.id)}>Mark read</button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
