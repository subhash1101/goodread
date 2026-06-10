import React from "react";
import { BookMarked, Heart, MessageCircle, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RatingDistribution from "../components/RatingDistribution.jsx";
import ReviewEditor from "../components/ReviewEditor.jsx";
import BookCard from "../components/BookCard.jsx";
import { api, unwrap } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";

export default function BookDetails() {
  const { id } = useParams();
  const auth = useAuth();
  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [commentText, setCommentText] = useState({});
  const [shelfRecord, setShelfRecord] = useState(null);
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
    if (shelfRecord?.status === status) {
      if (shelfRecord.id) await api(`/shelves/${shelfRecord.id}/`, { method: "DELETE" });
      setShelfRecord(null);
      return;
    }

    const saved = await api("/shelves/", { method: "POST", body: JSON.stringify({ book_id: Number(id), status }) });
    setShelfRecord({ id: saved.id, status: saved.status });
  }

  async function like(reviewId) {
    await api(`/reviews/${reviewId}/like/`, { method: "POST" });
    load();
  }

  async function comment(reviewId) {
    const text = commentText[reviewId]?.trim();
    if (!text) return;
    await api(`/reviews/${reviewId}/comment/`, { method: "POST", body: JSON.stringify({ text }) });
    setCommentText((current) => ({ ...current, [reviewId]: "" }));
    load();
  }

  useEffect(() => {
    load();
  }, [id, auth.isAuthenticated]);

  if (error) return <section className="content-panel"><p className="error">{error}</p></section>;
  if (!book) return <section className="content-panel"><p className="muted">Loading book...</p></section>;

  return (
    <div className="book-detail-layout">
      <aside className="book-cover-panel">
        {book.image_url ? <img src={book.image_url} alt="" /> : <div className="cover-fallback large">{book.title?.[0]}</div>}
        <div className="shelf-stack">
          <button className={shelfRecord?.status === "want_to_read" ? "is-active" : ""} onClick={() => shelf("want_to_read")}><BookMarked size={16} /> Want to Read</button>
          <button className={shelfRecord?.status === "reading" ? "is-active" : ""} onClick={() => shelf("reading")}>Currently Reading</button>
          <button className={shelfRecord?.status === "read" ? "is-active" : ""} onClick={() => shelf("read")}>Read</button>
        </div>
      </aside>

      <section className="content-panel">
        <h1>{book.title}</h1>
        <p className="byline">by {book.author}</p>
        <div className="rating-summary">
          <Star size={20} fill="currentColor" />
          <strong>{book.avg_rating}</strong>
          <span className="muted">{Number(book.ratings_count || 0).toLocaleString()} ratings</span>
        </div>
        <RatingDistribution distribution={book.rating_distribution} />
        <p className="description">{book.description || "No description available."}</p>
        <div className="genre-row">
          {(book.genres || []).map((genre) => <span key={genre}>{genre}</span>)}
        </div>

        {auth.isAuthenticated && <ReviewEditor bookId={Number(id)} onSaved={load} />}

        <h2>Reviews</h2>
        <div className="review-list">
          {reviews.map((review) => (
            <article className="review-row" key={review.id}>
              <div className="review-main">
                <div className="review-meta">
                  <strong>{review.user.username}</strong>
                  <span>{review.rating} stars</span>
                </div>
                <p>{review.review_text || "Rated without text."}</p>
                <div className="review-actions">
                  <button onClick={() => like(review.id)} title="Like review">
                    <Heart size={16} fill={review.liked ? "currentColor" : "none"} />
                    {review.likes_count}
                  </button>
                  <button title="Comments">
                    <MessageCircle size={16} />
                    {review.comments_count}
                  </button>
                </div>
                {auth.isAuthenticated && (
                  <div className="comment-box">
                    <input
                      value={commentText[review.id] || ""}
                      onChange={(event) => setCommentText((current) => ({ ...current, [review.id]: event.target.value }))}
                      placeholder="Add a comment"
                    />
                    <button onClick={() => comment(review.id)}>Post</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="side-panel">
        <h2>Similar Books</h2>
        <div className="compact-list">
          {similar.map((item) => <BookCard book={item} key={item.id} />)}
        </div>
      </aside>
    </div>
  );
}
