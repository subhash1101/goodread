import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CornerDownRight, Trash2 } from "lucide-react";
import { api } from "../lib/api";
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

function CommentNode({ comment, discussionId, membership, onDelete, depth = 0 }) {
  const auth = useAuth();
  const [showReply,  setShowReply]  = useState(false);
  const [replyText,  setReplyText]  = useState("");
  const [posting,    setPosting]    = useState(false);
  const [error,      setError]      = useState("");
  const [localReplies, setLocalReplies] = useState(comment.replies || []);

  const canReply  = auth.isAuthenticated && membership?.state === "active" && depth < 3;
  const canDelete = auth.isAuthenticated && (
    comment.author?.username === auth.username ||
    membership?.role === "admin" ||
    membership?.role === "moderator"
  );

  async function submitReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setPosting(true); setError("");
    try {
      const newComment = await api(`/discussions/${discussionId}/comments/`, {
        method: "POST",
        body: JSON.stringify({ body: replyText.trim(), parent_comment_id: comment.id }),
      });
      setLocalReplies((prev) => [...prev, { ...newComment, replies: [] }]);
      setReplyText(""); setShowReply(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div
      className={`disc-comment${depth > 0 ? " disc-comment-reply" : ""}`}
      style={{ marginLeft: depth * 24 }}
    >
      <div className="disc-comment-header">
        <Avatar name={comment.author?.username} size={26} />
        <span className="disc-comment-author">{comment.author?.username}</span>
        <span className="disc-comment-date">{fmtDate(comment.created_at)}</span>
        {canDelete && (
          <button className="disc-del-btn" onClick={() => onDelete(comment.id)} title="Delete">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <p className="disc-comment-body">{comment.body}</p>

      {canReply && (
        <div className="disc-reply-area">
          {showReply ? (
            <form onSubmit={submitReply} className="disc-reply-form">
              {error && <p className="grp-error">{error}</p>}
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                className="disc-reply-input"
                required
              />
              <button type="submit" disabled={posting}>{posting ? "…" : "Reply"}</button>
              <button type="button" className="grp-cancel-btn" onClick={() => setShowReply(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button className="disc-reply-btn" onClick={() => setShowReply(true)}>
              <CornerDownRight size={12} /> Reply
            </button>
          )}
        </div>
      )}

      {localReplies.map((r) => (
        <CommentNode
          key={r.id}
          comment={r}
          discussionId={discussionId}
          membership={membership}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function DiscussionDetail() {
  const { groupId, discussionId } = useParams();
  const auth = useAuth();
  const [disc,        setDisc]        = useState(null);
  const [membership,  setMembership]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [commentText, setCommentText] = useState("");
  const [posting,     setPosting]     = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const [discData, groupData] = await Promise.all([
        api(`/discussions/${discussionId}/`),
        api(`/groups/${groupId}/`),
      ]);
      setDisc(discData);
      setMembership(groupData.membership || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [discussionId, groupId]);

  async function postComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const newComment = await api(`/discussions/${discussionId}/comments/`, {
        method: "POST",
        body: JSON.stringify({ body: commentText.trim() }),
      });
      setDisc((d) => ({ ...d, comments: [...(d.comments || []), { ...newComment, replies: [] }] }));
      setCommentText("");
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId) {
    if (!confirm("Delete this comment?")) return;
    try {
      await api(`/group-comments/${commentId}/`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="disc-page"><p className="grp-loading">Loading…</p></div>;
  if (error)   return <div className="disc-page"><p className="grp-error">{error}</p></div>;
  if (!disc)   return null;

  const canComment    = auth.isAuthenticated && membership?.state === "active";
  const topLevelComments = (disc.comments || []).filter((c) => c.parent_comment_id == null);

  return (
    <div className="disc-page">
      <Link to={`/community/groups/${groupId}`} className="grp-back-link">
        ← Back to Group
      </Link>

      <article className="disc-card">
        <h1 className="disc-title">{disc.title}</h1>
        <div className="disc-meta">
          <Avatar name={disc.author?.username} size={26} />
          <span className="disc-author">{disc.author?.username}</span>
          <span className="disc-date">{fmtDate(disc.created_at)}</span>
          {disc.is_pinned && <span className="disc-pinned-badge">Pinned</span>}
        </div>
        {disc.body && <p className="disc-body">{disc.body}</p>}
      </article>

      <section className="disc-comments-section">
        <h2 className="disc-comments-heading">
          {topLevelComments.length + (disc.comments || []).filter((c) => c.parent_comment_id != null).length} Comments
        </h2>

        {canComment && (
          <form onSubmit={postComment} className="disc-add-comment-form">
            <Avatar name={auth.username} size={32} />
            <div className="disc-comment-input-wrap">
              <input
                className="disc-comment-main-input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
              />
              <button type="submit" disabled={posting}>{posting ? "Posting…" : "Post"}</button>
            </div>
          </form>
        )}

        {!auth.isAuthenticated && (
          <p className="disc-login-prompt">
            <Link to="/login">Sign in</Link> to join the discussion.
          </p>
        )}
        {auth.isAuthenticated && !canComment && (
          <p className="disc-login-prompt">
            <Link to={`/community/groups/${groupId}`}>Join the group</Link> to comment.
          </p>
        )}

        <div className="disc-comments-list">
          {topLevelComments.length === 0 ? (
            <p className="grp-empty">No comments yet.{canComment ? " Be the first!" : ""}</p>
          ) : (
            topLevelComments.map((c) => (
              <CommentNode
                key={c.id}
                comment={c}
                discussionId={Number(discussionId)}
                membership={membership}
                onDelete={deleteComment}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
