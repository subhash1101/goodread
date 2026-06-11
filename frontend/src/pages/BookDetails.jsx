import React from "react";
import { BookMarked, Heart, MessageCircle, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReviewEditor from "../components/ReviewEditor.jsx";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

function filledStars(rating) {
  const r = Number(rating) || 0;
  return [1, 2, 3, 4, 5].map((i) => (
    <Star
      key={i}
      size={16}
      fill={i <= Math.round(r) ? "currentColor" : "none"}
      strokeWidth={1.5}
    />
  ));
}

function Avatar({ name, size = 38 }) {
  const letter = (name || "?")[0].toUpperCase();
  const colors = ["#3d6f63", "#8b5e3c", "#4a6fa5", "#7c5cbf", "#c06b3a"];
  const bg = colors[(name || "").charCodeAt(0) % colors.length];
  return (
    <div
      className="bd-avatar"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {letter}
    </div>
  );
}

function RatingBars({ distribution = {} }) {
  const max = Math.max(1, ...Object.values(distribution).map(Number));
  return (
    <div className="bd-dist">
      {[5, 4, 3, 2, 1].map((star) => {
        const value = Number(distribution[String(star)] || 0);
        return (
          <div className="bd-dist-row" key={star}>
            <span className="bd-dist-label">{star} stars</span>
            <div className="bd-dist-track">
              <div className="bd-dist-fill" style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <span className="bd-dist-count">{value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function SimilarCard({ book }) {
  return (
    <Link to={`/books/${book.id}`} className="bd-similar-card">
      <div className="bd-similar-cover">
        {book.image_url
          ? <img src={book.image_url} alt={book.title} />
          : <div className="bd-similar-fallback">{book.title?.[0]}</div>}
      </div>
      <p className="bd-similar-title">{book.title}</p>
      <p className="bd-similar-author">{book.author}</p>
      <span className="bd-similar-rating">
        <Star size={11} fill="currentColor" />
        {Number(book.avg_rating || 0).toFixed(2)}
      </span>
    </Link>
  );
}

export default function BookDetails() {
  const { id } = useParams();
  const auth = useAuth();
  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [commentText, setCommentText] = useState({});
  const [shelfRecord, setShelfRecord] = useState(null);
  const [shelfBusy, setShelfBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [bookPayload, reviewsPayload, similarPayload, shelfPayload] = await Promise.all([
        api(`/books/${id}/`),
        api(`/reviews/?book=${id}`),
        api(`/books/${id}/similar/`),
        auth.isAuthenticated ? api(`/shelves/?book=${id}`) : Promise.resolve({ results: [] }),
      ]);
      setBook(bookPayload);
      setReviews(unwrap(reviewsPayload));
      setSimilar(unwrap(similarPayload));
      const currentShelf = unwrap(shelfPayload)[0] || null;
      setShelfRecord(currentShelf ? { id: currentShelf.id, status: currentShelf.status } : null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function shelf(status) {
    if (shelfBusy) return;
    setShelfBusy(true);
    try {
      if (shelfRecord?.status === status) {
        await api(`/shelves/${shelfRecord.id}/`, { method: "DELETE" });
        setShelfRecord(null);
      } else {
        const saved = await api("/shelves/", {
          method: "POST",
          body: JSON.stringify({ book_id: Number(id), status }),
        });
        setShelfRecord({ id: saved.id, status: saved.status });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setShelfBusy(false);
    }
  }

  async function like(reviewId) {
    await api(`/reviews/${reviewId}/like/`, { method: "POST" });
    load();
  }

  async function comment(reviewId) {
    const text = commentText[reviewId]?.trim();
    if (!text) return;
    await api(`/reviews/${reviewId}/comment/`, { method: "POST", body: JSON.stringify({ text }) });
    setCommentText((c) => ({ ...c, [reviewId]: "" }));
    load();
  }

  useEffect(() => { load(); }, [id, auth.isAuthenticated]);

  if (error) return <div className="bd-page"><p className="bd-error">{error}</p></div>;
  if (!book)  return <div className="bd-page"><p className="bd-loading">Loading…</p></div>;

  const ratingsCount = Number(book.ratings_count || 0);

  return (
    <div className="bd-page">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bd-hero">
        {/* Cover + shelf buttons */}
        <div className="bd-cover-col">
          <div className="bd-cover-img">
            {book.image_url
              ? <img src={book.image_url} alt={book.title} />
              : <div className="bd-cover-fallback">{book.title?.[0]}</div>}
          </div>

          {auth.isAuthenticated && (
            <div className="bd-shelf-btns">
              <button
                className={`bd-shelf-primary${shelfRecord?.status === "want_to_read" ? " bd-shelf-active" : ""}`}
                disabled={shelfBusy}
                onClick={() => shelf("want_to_read")}
              >
                <BookMarked size={15} />
                {shelfRecord?.status === "want_to_read" ? "On Your Shelf" : "Want to Read"}
              </button>
              <div className="bd-shelf-secondary-row">
                <button
                  className={shelfRecord?.status === "reading" ? "bd-shelf-active" : ""}
                  disabled={shelfBusy}
                  onClick={() => shelf("reading")}
                >
                  Reading
                </button>
                <button
                  className={shelfRecord?.status === "read" ? "bd-shelf-active" : ""}
                  disabled={shelfBusy}
                  onClick={() => shelf("read")}
                >
                  Read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Book info */}
        <div className="bd-info-col">
          <h1 className="bd-title">{book.title}</h1>
          <p className="bd-author">
            by <Link to={`/browse?search=${encodeURIComponent(book.author)}`} className="bd-author-link">{book.author}</Link>
          </p>

          <div className="bd-rating-row">
            <span className="bd-stars-row">{filledStars(book.avg_rating)}</span>
            <strong className="bd-avg">{book.avg_rating}</strong>
            <span className="bd-rating-meta">
              {ratingsCount.toLocaleString()} ratings
              {reviews.length > 0 && ` · ${reviews.length} reviews`}
            </span>
          </div>

          {(book.genres || []).length > 0 && (
            <div className="bd-genre-chips">
              {(book.genres || []).map((g) => (
                <Link key={g} to={`/browse?genre=${encodeURIComponent(g)}`} className="bd-genre-chip">
                  {g}
                </Link>
              ))}
            </div>
          )}

          <p className="bd-description">{book.description || "No description available."}</p>
        </div>
      </div>

      {/* ── Readers also enjoyed ─────────────────────────────────────────── */}
      {similar.length > 0 && (
        <section className="bd-section">
          <h2 className="bd-section-title">Readers also enjoyed</h2>
          <div className="bd-scroll-row">
            {similar.map((b) => <SimilarCard book={b} key={b.id} />)}
          </div>
        </section>
      )}

      {/* ── Ratings & Reviews ────────────────────────────────────────────── */}
      <section className="bd-section">
        <h2 className="bd-section-title">Ratings &amp; Reviews</h2>

        {/* "What do you think?" prompt */}
        {auth.isAuthenticated && (
          <div className="bd-think-prompt">
            <p className="bd-think-label">What do you think?</p>
            <ReviewEditor bookId={Number(id)} onSaved={load} />
          </div>
        )}

        {/* Overview + bars */}
        <div className="bd-reviews-overview">
          <div className="bd-big-rating-col">
            <span className="bd-big-num">{book.avg_rating}</span>
            <span className="bd-big-stars">{filledStars(book.avg_rating)}</span>
            <span className="bd-big-label">{ratingsCount.toLocaleString()} ratings</span>
          </div>
          <div className="bd-bars-col">
            <RatingBars distribution={book.rating_distribution} />
          </div>
        </div>

        {/* Review cards */}
        <div className="bd-review-list">
          {reviews.map((review) => (
            <article className="bd-review-card" key={review.id}>
              <div className="bd-review-top">
                <Avatar name={review.user.username} />
                <div className="bd-review-meta">
                  <span className="bd-reviewer-name">{review.user.username}</span>
                  <div className="bd-review-stars">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} size={13} fill={i <= review.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                    ))}
                    <span className="bd-review-date">{review.rating} stars</span>
                  </div>
                </div>
              </div>

              {review.review_text && (
                <p className="bd-review-text">{review.review_text}</p>
              )}

              <div className="bd-review-actions">
                <button className="bd-react-btn" onClick={() => like(review.id)}>
                  <Heart size={15} fill={review.liked ? "currentColor" : "none"} />
                  <span>{review.likes_count} likes</span>
                </button>
                <button className="bd-react-btn">
                  <MessageCircle size={15} />
                  <span>{review.comments_count} comments</span>
                </button>
              </div>

              {auth.isAuthenticated && (
                <div className="bd-comment-row">
                  <Avatar name={auth.username} size={28} />
                  <input
                    className="bd-comment-input"
                    value={commentText[review.id] || ""}
                    onChange={(e) => setCommentText((c) => ({ ...c, [review.id]: e.target.value }))}
                    placeholder="Add a comment…"
                    onKeyDown={(e) => { if (e.key === "Enter") comment(review.id); }}
                  />
                  <button className="bd-comment-post" onClick={() => comment(review.id)}>Post</button>
                </div>
              )}
            </article>
          ))}
          {reviews.length === 0 && (
            <p className="bd-no-reviews">No reviews yet. Be the first!</p>
          )}
        </div>
      </section>

    </div>
  );
}
