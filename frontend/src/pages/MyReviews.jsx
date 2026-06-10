import React from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../lib/api";

export default function MyReviews() {
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const payload = await api("/reviews/?mine=true");
      setReviews(unwrap(payload));
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await api(`/reviews/${id}/`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="content-panel">
      <h1>My Reviews</h1>
      {error && <p className="error">{error}</p>}
      <div className="review-list">
        {reviews.map((review) => (
          <article className="review-row" key={review.id}>
            <div>
              <Link to={`/books/${review.book.id}`}>{review.book.title}</Link>
              <p>{review.review_text || "Rated without text."}</p>
              <span className="muted">{review.rating} stars</span>
            </div>
            <button className="icon-button danger" title="Delete review" onClick={() => remove(review.id)}>
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
      {reviews.length === 0 && !error && (
        <p className="muted"><MessageSquare size={16} /> No reviews yet.</p>
      )}
    </section>
  );
}
